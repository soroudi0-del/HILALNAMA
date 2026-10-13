// ============================================================
// moonNowEngine — v3.5. موتور محاسبات صفحه‌ی «ماه اکنون».
//
// هیچ وابستگی به React Native ندارد (قابل تست در Node). همه‌ی مقادیر از
// astronomy-engine می‌آیند؛ تنها فرمول‌های دستی این فایل عبارت‌اند از
// هندسه‌ی کروی ساده (جدایی زاویه‌ای، جهت لبه‌ی روشن، جرم هوایی) و معیارهای
// منتشرشده‌ی یالوپ/ادعه برای «هندسه‌ی هلال در این لحظه».
//
// دو سطح محاسبه:
//   computeFast(now, city)  — مقادیر لحظه‌ای (هر ثانیه صدا زده می‌شود)
//   computeSlow(now, city)  — رویدادها (طلوع/غروب/فازها/خسوف...) و نمودار
//                              (هر ۳۰ ثانیه یا وقتی یک رویداد گذشت)
// ============================================================

var Astronomy = require('astronomy-engine');
require('./deltaT').install(); // v3.5: مدل ΔT واقع‌بینانه‌تر (نگاه کنید به deltaT.js)
var moment = require('moment-timezone');
var tzlookup = require('tz-lookup');

var EARTH_R_KM = 6378.137;
var MOON_R_KM = 1737.4;
var MEAN_DIST_KM = 384400;
var MANSION_SPAN = 360 / 28;
// آستانه‌ی «نزدیک حضیض/اوج»: قاعده‌ی ۹۰٪ ریچارد نول (۱۹۷۹) — فاصله در ۱۰٪ نزدیک
// به حضیض (یا اوج) از بازه‌ی فاصله‌های ممکن. فاصله‌های حدی: ۳۵۶٬۳۷۵ تا ۴۰۶٬۷۲۰ km.
var MIN_DIST_KM = 356375;
var MAX_DIST_KM = 406720;
var NEAR_PERIGEE_KM = MIN_DIST_KM + 0.1 * (MAX_DIST_KM - MIN_DIST_KM); // ≈ 361٬410
var NEAR_APOGEE_KM = MAX_DIST_KM - 0.1 * (MAX_DIST_KM - MIN_DIST_KM);  // ≈ 401٬685
var MS_DAY = 86400000;
var DEG = Math.PI / 180;

function norm360(x) { return ((x % 360) + 360) % 360; }
function norm24(x) { return ((x % 24) + 24) % 24; }
function normDiff(d) { var x = norm360(d); return x > 180 ? x - 360 : x; } // [-180,180]
function sinD(x) { return Math.sin(x * DEG); }
function cosD(x) { return Math.cos(x * DEG); }

// ---------- قالب‌بندی مشترک ----------
function fmtDMS(deg, digits, signed) {
  var sign = deg < 0 ? '-' : (signed ? '+' : '');
  var a = Math.abs(deg);
  var d = Math.floor(a);
  var mFloat = (a - d) * 60;
  var m = Math.floor(mFloat);
  var s = (mFloat - m) * 60;
  var sd = digits === undefined ? 1 : digits;
  var sStr = s.toFixed(sd);
  if (parseFloat(sStr) >= 60) { sStr = (0).toFixed(sd); m += 1; }
  if (m >= 60) { m -= 60; d += 1; }
  return sign + d + '° ' + (m < 10 ? '0' : '') + m + '′ ' + (parseFloat(sStr) < 10 ? '0' : '') + sStr + '″';
}
function fmtHMS(hours, digits) {
  var h = norm24(hours);
  var hh = Math.floor(h);
  var mFloat = (h - hh) * 60;
  var mm = Math.floor(mFloat);
  var ss = (mFloat - mm) * 60;
  var sd = digits === undefined ? 2 : digits;
  var sStr = ss.toFixed(sd);
  if (parseFloat(sStr) >= 60) { sStr = (0).toFixed(sd); mm += 1; }
  if (mm >= 60) { mm -= 60; hh = (hh + 1) % 24; }
  return hh + 'ʰ ' + (mm < 10 ? '0' : '') + mm + 'ᵐ ' + (parseFloat(sStr) < 10 ? '0' : '') + sStr + 'ˢ';
}
// میلی‌ثانیه → { days, hours, minutes, seconds }
function splitDuration(ms) {
  var a = Math.abs(ms);
  var days = Math.floor(a / MS_DAY);
  var hours = Math.floor((a % MS_DAY) / 3600000);
  var minutes = Math.floor((a % 3600000) / 60000);
  var seconds = Math.floor((a % 60000) / 1000);
  return { days: days, hours: hours, minutes: minutes, seconds: seconds };
}
function compassIndex(az) { return Math.round(norm360(az) / 22.5) % 16; }

function phaseKeyFromAngle(ph) {
  if (ph < 6.5 || ph >= 353.5) return 'mnPhaseNew';
  if (ph < 83.5) return 'mnPhaseWaxingCrescent';
  if (ph < 96.5) return 'mnPhaseFirstQuarter';
  if (ph < 173.5) return 'mnPhaseWaxingGibbous';
  if (ph < 186.5) return 'mnPhaseFull';
  if (ph < 263.5) return 'mnPhaseWaningGibbous';
  if (ph < 276.5) return 'mnPhaseLastQuarter';
  return 'mnPhaseWaningCrescent';
}

// ---------- ترسیم قرص ماه ----------
// مسیر بخش روشن؛ همیشه با «لبه‌ی روشن به سمت راست» (چرخش واقعی جداگانه اعمال می‌شود).
// elongationDeg: جدایی زاویه‌ای ۰ تا ۱۸۰ (۰ = ماه نو، ۱۸۰ = بدر)؛ نسبت سطح روشن = (1 − cos) / 2
function litPathRight(elongationDeg, cx, cy, r) {
  var ph = Math.max(0, Math.min(180, elongationDeg));
  var rx = Math.abs(cosD(ph)) * r;
  var top = cx + ' ' + (cy - r);
  var bottom = cx + ' ' + (cy + r);
  var sweepT = ph < 90 ? 0 : 1;
  return 'M ' + top + ' A ' + r + ' ' + r + ' 0 0 1 ' + bottom + ' A ' + rx + ' ' + r + ' 0 0 ' + sweepT + ' ' + top + ' Z';
}
// MoonPhase (۰..۳۶۰، ۰ = نو) → جدایی زاویه‌ای ۰..۱۸۰ برای ترسیم
function drawElongation(moonPhaseDeg) {
  var p = norm360(moonPhaseDeg);
  return p <= 180 ? p : 360 - p;
}

// ---------- جهت لبه‌ی روشن (ساعت‌گرد از بالای آسمان/سمت‌الرأس) ----------
// جهت خورشید دیده‌شده از ماه، روی کره‌ی آسمان محلی. با ارتفاع/سمت هندسی.
function brightLimbPA(moonAlt, moonAz, sunAlt, sunAz) {
  var dAz = sunAz - moonAz;
  var y = sinD(dAz) * cosD(sunAlt);
  var x = cosD(moonAlt) * sinD(sunAlt) - sinD(moonAlt) * cosD(sunAlt) * cosD(dAz);
  return norm360(Math.atan2(y, x) / DEG);
}
function angularSeparation(alt1, az1, alt2, az2) {
  var c = sinD(alt1) * sinD(alt2) + cosD(alt1) * cosD(alt2) * cosD(az1 - az2);
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}
// جرم هوایی (Kasten & Young 1989) روی ارتفاع ظاهری
function airMass(apparentAltDeg) {
  if (apparentAltDeg <= 0) return null;
  return 1 / (sinD(apparentAltDeg) + 0.50572 * Math.pow(apparentAltDeg + 6.07995, -1.6364));
}

// ---------- معیارهای هلال (فرمول‌های منتشرشده) ----------
function yallopQ(arcv, w) {
  return (arcv - (11.8371 - 6.3226 * w + 0.7319 * w * w - 0.1018 * w * w * w)) / 10;
}
function yallopCategory(q) {
  if (q > 0.216) return 'A';
  if (q > -0.014) return 'B';
  if (q > -0.160) return 'C';
  if (q > -0.232) return 'D';
  if (q > -0.293) return 'E';
  return 'F';
}
function odehV(arcv, w) {
  return arcv - (-0.1018 * w * w * w + 0.7319 * w * w - 6.3226 * w + 7.1651);
}
function odehCategory(v) {
  if (v >= 5.65) return 'A';
  if (v >= 2) return 'B';
  if (v >= -0.96) return 'C';
  return 'D';
}

// ---------- منطقه‌ی زمانی ----------
function timezoneInfo(now, lat, lon) {
  try {
    var tz = tzlookup(lat, lon);
    var m = moment(now).tz(tz);
    return { name: tz, offset: m.format('Z'), abbr: m.format('z'), valid: true };
  } catch (e) {
    return { name: 'UTC', offset: '+00:00', abbr: 'UTC', valid: false };
  }
}

// ---------- ریشه‌یاب عبور طول دایره‌البروجی از یک مرز ----------
function eclipticLonAt(date) {
  return norm360(Astronomy.Ecliptic(Astronomy.GeoVector('Moon', date, true)).elon);
}
// زمانی که طول ماه به targetDeg می‌رسد؛ guess = حدس اولیه
function findLonCrossing(targetDeg, guess) {
  var t = guess.getTime();
  for (var i = 0; i < 12; i++) {
    var lon = eclipticLonAt(new Date(t));
    var d = normDiff(targetDeg - lon);
    if (Math.abs(d) < 1e-6) break;
    t += (d / 13.176) * MS_DAY; // میانگین سرعت ماه ≈ ۱۳٫۱۷۶ درجه در روز
  }
  return new Date(t);
}

// ============================================================
// computeFast — مقادیر لحظه‌ای
// ============================================================
function computeFast(now, city) {
  var lat = city.lat, lon = city.lon, elev = city.alt || 0;
  var observer = new Astronomy.Observer(lat, lon, elev);
  var out = { time: now };

  // --- زمان
  var at = new Astronomy.AstroTime(now);
  out.jd = at.ut + 2451545.0;
  out.deltaT = (at.tt - at.ut) * 86400;
  var gast = Astronomy.SiderealTime(now); // ساعت
  out.gast = gast;
  out.lst = norm24(gast + lon / 15);
  out.tz = timezoneInfo(now, lat, lon);

  // --- ماه: مختصات
  var mEq = Astronomy.Equator('Moon', now, observer, true, true);   // توپوسنتریک، تاریخ روز
  var mEqJ = Astronomy.Equator('Moon', now, observer, false, true); // توپوسنتریک، J2000
  var mApp = Astronomy.Horizon(now, observer, mEq.ra, mEq.dec, 'normal');
  var mGeo = Astronomy.Horizon(now, observer, mEq.ra, mEq.dec, null);
  var geoVec = Astronomy.GeoVector('Moon', now, true);
  var dist = geoVec.Length() * Astronomy.KM_PER_AU;
  var ecl = Astronomy.Ecliptic(geoVec);

  out.moon = {
    altApparent: mApp.altitude,
    altGeometric: mGeo.altitude,
    az: mGeo.azimuth,
    compass: compassIndex(mGeo.azimuth),
    zenithDistance: 90 - mApp.altitude,
    airMass: airMass(mApp.altitude),
    ra: mEq.ra, dec: mEq.dec,
    raJ2000: mEqJ.ra, decJ2000: mEqJ.dec,
    hourAngle: (function () { var h = norm24(out.lst - mEq.ra); return h > 12 ? h - 24 : h; })(),
    aboveHorizon: mApp.altitude > 0,
  };

  // --- خورشید
  var sEq = Astronomy.Equator('Sun', now, observer, true, true);
  var sApp = Astronomy.Horizon(now, observer, sEq.ra, sEq.dec, 'normal');
  var sGeo = Astronomy.Horizon(now, observer, sEq.ra, sEq.dec, null);
  out.sun = {
    altApparent: sApp.altitude, altGeometric: sGeo.altitude, az: sGeo.azimuth,
    compass: compassIndex(sGeo.azimuth),
    ra: sEq.ra, dec: sEq.dec,
    distanceKm: Astronomy.GeoVector('Sun', now, true).Length() * Astronomy.KM_PER_AU,
  };

  // --- فاز و روشنایی
  var ill = Astronomy.Illumination('Moon', now);
  var moonPhase = Astronomy.MoonPhase(now);
  out.phase = {
    moonPhaseDeg: moonPhase,                        // ۰=نو ... ۱۸۰=بدر
    physicalAngle: ill.phase_angle,                 // زاویه‌ی فاز فیزیکی
    illuminationPercent: ill.phase_fraction * 100,
    waxing: moonPhase < 180,
    elongationGeo: Astronomy.AngleFromSun('Moon', now),
    elongationTopo: angularSeparation(mGeo.altitude, mGeo.azimuth, sGeo.altitude, sGeo.azimuth),
  };
  // v3.5: نسبت سطح روشن = (1+cos i)/2 با i = زاویه‌ی فاز فیزیکی؛ پس زاویه‌ی ترسیم = ۱۸۰ − i
  out.phase.drawElongation = 180 - ill.phase_angle;
  out.brightLimbPA = brightLimbPA(mGeo.altitude, mGeo.azimuth, sGeo.altitude, sGeo.azimuth);

  // --- اندازه و فاصله
  var sdGeoDeg = Math.asin(MOON_R_KM / dist) / DEG;
  var sdTopoDeg = sdGeoDeg * (1 + (EARTH_R_KM / dist) * sinD(mGeo.altitude));
  out.orbit = {
    distanceKm: dist,
    distanceEarthRadii: dist / EARTH_R_KM,
    vsMeanPercent: (dist / MEAN_DIST_KM - 1) * 100,
    angularDiameterArcmin: sdGeoDeg * 2 * 60,
    angularDiameterTopoArcmin: sdTopoDeg * 2 * 60,
    horizontalParallaxDeg: Math.asin(EARTH_R_KM / dist) / DEG,
    semiDiameterTopoArcmin: sdTopoDeg * 60,
    nearPerigee: dist <= NEAR_PERIGEE_KM,
    nearApogee: dist >= NEAR_APOGEE_KM,
  };

  // --- لیبراسیون
  var lib = Astronomy.Libration(now);
  out.libration = { elon: lib.elon, elat: lib.elat, mlon: lib.mlon, mlat: lib.mlat };

  // --- دایره‌البروج، برج، صورت فلکی، منزل
  var eLon = norm360(ecl.elon);
  var zodiacIndex = Math.floor(eLon / 30) % 12;
  var mansionIndex = Math.floor(eLon / MANSION_SPAN) % 28;
  // v3.5: برج (از طول دایره‌البروجی زمین‌مرکزی) و صورت فلکی باید یک مبنا داشته باشند.
  // پیش‌تر صورت فلکی از مختصات «از دید ناظر» می‌آمد و نزدیک مرز صورت‌های فلکی
  // (اختلاف منظر تا ≈۱°) با برج ناهماهنگ می‌شد. GeoVector همان EQJ زمین‌مرکزی است.
  var constellation = null;
  try {
    var geoEq = Astronomy.EquatorFromVector(geoVec);
    constellation = Astronomy.Constellation(geoEq.ra, geoEq.dec);
  } catch (e) { constellation = null; }
  out.ecliptic = {
    lon: eLon, lat: ecl.elat,
    zodiacIndex: zodiacIndex, degInSign: eLon - zodiacIndex * 30,
    mansionIndex: mansionIndex, degInMansion: eLon - mansionIndex * MANSION_SPAN,
    constellation: constellation ? constellation.name : null,
    constellationSymbol: constellation ? constellation.symbol : null,
  };

  // --- هندسه‌ی هلال در این لحظه (فقط وقتی ماه به خورشید نزدیک است)
  // v3.5: معیارهای یالوپ و عودة فقط برای هلال «نوی» شب‌های بعد از مقارنه‌اند.
  // پیش از مقارنه (ماه در حال کاهش) هیچ هلال نویی برای رؤیت وجود ندارد.
  var arcl = out.phase.elongationTopo;
  out.crescentNA = arcl >= 40 ? 'far' : (!out.phase.waxing ? 'waning' : null);
  if (out.crescentNA === null) {
    var arcv = mGeo.altitude - sGeo.altitude;
    var daz = normDiff(mGeo.azimuth - sGeo.azimuth);
    var w = out.orbit.semiDiameterTopoArcmin * (1 - cosD(arcl)); // دقیقه‌ی قوسی
    var q = yallopQ(arcv, w);
    var v = odehV(arcv, w);
    out.crescent = {
      arcv: arcv, daz: daz, arcl: arcl, widthArcmin: w,
      yallopQ: q, yallopCat: yallopCategory(q),
      odehV: v, odehCat: odehCategory(v),
      sunAltitude: sGeo.altitude, moonAltitude: mGeo.altitude,
      moonBelowHorizon: mApp.altitude <= 0,
    };
  } else {
    out.crescent = null;
  }
  return out;
}

// ============================================================
// computeSlow — رویدادها و نمودار
// ============================================================
function safe(fn, fallback) { try { var r = fn(); return r === undefined ? fallback : r; } catch (e) { return fallback; } }

function horizonAt(body, date, observer) {
  var eq = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
}

function computeSlow(now, city) {
  var lat = city.lat, lon = city.lon, elev = city.alt || 0;
  var observer = new Astronomy.Observer(lat, lon, elev);
  var out = { computedAt: now };

  // --- طلوع/عبور/غروب ماه
  var evt = function (body, dir, limit) {
    var r = safe(function () { return Astronomy.SearchRiseSet(body, observer, dir, now, limit); }, null);
    return r ? r.date : null;
  };
  var withAz = function (date) {
    if (!date) return null;
    var h = horizonAt('Moon', date, observer);
    return { time: date, az: h.azimuth, compass: compassIndex(h.azimuth) };
  };
  out.moonEvents = {
    nextRise: withAz(evt('Moon', 1, 2)),
    nextSet: withAz(evt('Moon', -1, 2)),
    prevRise: withAz(evt('Moon', 1, -2)),
    prevSet: withAz(evt('Moon', -1, -2)),
  };
  var tNext = safe(function () { return Astronomy.SearchHourAngle('Moon', observer, 0, now, 1).time.date; }, null);
  var tPrev = safe(function () { return Astronomy.SearchHourAngle('Moon', observer, 0, now, -1).time.date; }, null);
  out.moonEvents.nextTransit = tNext ? { time: tNext, alt: horizonAt('Moon', tNext, observer).altitude } : null;
  out.moonEvents.prevTransit = tPrev ? { time: tPrev, alt: horizonAt('Moon', tPrev, observer).altitude } : null;

  // --- خورشید و گرگ‌ومیش
  var sunEvt = function (dir, limit) {
    var r = safe(function () { return Astronomy.SearchRiseSet('Sun', observer, dir, now, limit); }, null);
    return r ? r.date : null;
  };
  var twi = function (dir, alt) {
    var r = safe(function () { return Astronomy.SearchAltitude('Sun', observer, dir, now, 2, alt); }, null);
    return r ? r.date : null;
  };
  var nextSunrise = sunEvt(1, 2), nextSunset = sunEvt(-1, 2), prevSunrise = sunEvt(1, -2);
  var dayLengthMs = null;
  if (nextSunrise && nextSunset) {
    dayLengthMs = nextSunrise < nextSunset
      ? nextSunset - nextSunrise
      : (prevSunrise ? nextSunset - prevSunrise : null);
  }
  out.sunEvents = {
    nextSunrise: nextSunrise, nextSunset: nextSunset, dayLengthMs: dayLengthMs,
    civilDusk: twi(-1, -6), civilDawn: twi(1, -6),
    nauticalDusk: twi(-1, -12), nauticalDawn: twi(1, -12),
    astroDusk: twi(-1, -18), astroDawn: twi(1, -18),
  };

  // --- فازهای قبلی و بعدی، سن، شماره‌ی ماه قمری براون
  var q = Astronomy.SearchMoonQuarter(new Date(now.getTime() - 40 * MS_DAY));
  var past = [], upcoming = [], lastNew = null;
  for (var i = 0; i < 20; i++) {
    var d = q.time.date;
    if (d.getTime() <= now.getTime()) {
      past.push({ quarter: q.quarter, date: d });
      if (q.quarter === 0) lastNew = d;
    } else if (upcoming.length < 4) {
      upcoming.push({ quarter: q.quarter, date: d });
    }
    q = Astronomy.NextMoonQuarter(q);
  }
  out.phases = { past: past.slice(-3), upcoming: upcoming };
  out.nextPhaseTime = upcoming.length ? upcoming[0].date : null; // برای تازه‌سازی به‌موقع (سن ماه در لحظه‌ی ماه نو)
  out.lastNewMoon = lastNew;
  out.ageMs = lastNew ? Math.max(0, now.getTime() - lastNew.getTime()) : null;
  if (lastNew) {
    var nmJd = new Astronomy.AstroTime(lastNew).ut + 2451545.0;
    out.lunationNumber = Math.round((nmJd - 2423436.6115) / 29.530588853) + 1; // شماره‌ی براون
    out.cycleProgress = Math.min(1, out.ageMs / (29.530588853 * MS_DAY));
  } else {
    out.lunationNumber = null; out.cycleProgress = null;
  }

  // --- حضیض و اوج
  var ap = safe(function () { return Astronomy.SearchLunarApsis(new Date(now.getTime() - 32 * MS_DAY)); }, null);
  var apsides = { prevPerigee: null, prevApogee: null, nextPerigee: null, nextApogee: null };
  for (var k = 0; ap && k < 8; k++) {
    var item = { time: ap.time.date, distanceKm: ap.dist_km };
    var isPerigee = ap.kind === 0;
    if (ap.time.date.getTime() <= now.getTime()) {
      if (isPerigee) apsides.prevPerigee = item; else apsides.prevApogee = item;
    } else {
      if (isPerigee && !apsides.nextPerigee) apsides.nextPerigee = item;
      if (!isPerigee && !apsides.nextApogee) apsides.nextApogee = item;
    }
    ap = Astronomy.NextLunarApsis(ap);
  }
  out.apsides = apsides;

  // --- ورود/خروج برج و منزل
  var lonNow = eclipticLonAt(now);
  var signStart = Math.floor(lonNow / 30) * 30;
  var mansionStart = Math.floor(lonNow / MANSION_SPAN) * MANSION_SPAN;
  var guessAhead = function (target) { return new Date(now.getTime() + (normDiff(target - lonNow) / 13.176) * MS_DAY); };
  out.ingress = {
    signEnter: findLonCrossing(norm360(signStart), guessAhead(signStart)),
    signLeave: findLonCrossing(norm360(signStart + 30), guessAhead(signStart + 30)),
    mansionEnter: findLonCrossing(norm360(mansionStart), guessAhead(mansionStart)),
    mansionLeave: findLonCrossing(norm360(mansionStart + MANSION_SPAN), guessAhead(mansionStart + MANSION_SPAN)),
  };

  // --- خسوف و کسوف
  var le = safe(function () { return Astronomy.SearchLunarEclipse(now); }, null);
  if (le) {
    var peak = le.peak.date;
    var minus = function (mins) { return new Date(peak.getTime() - mins * 60000); };
    var plus = function (mins) { return new Date(peak.getTime() + mins * 60000); };
    var h = horizonAt('Moon', peak, observer);
    out.lunarEclipse = {
      kind: le.kind, peak: peak,
      penumbralStart: minus(le.sd_penum), penumbralEnd: plus(le.sd_penum),
      partialStart: le.sd_partial > 0 ? minus(le.sd_partial) : null, partialEnd: le.sd_partial > 0 ? plus(le.sd_partial) : null,
      totalStart: le.sd_total > 0 ? minus(le.sd_total) : null, totalEnd: le.sd_total > 0 ? plus(le.sd_total) : null,
      moonAltAtPeak: h.altitude, visibleAtPeak: h.altitude > 0,
    };
  } else { out.lunarEclipse = null; }
  var gse = safe(function () { return Astronomy.SearchGlobalSolarEclipse(now); }, null);
  out.solarEclipse = gse ? { kind: gse.kind, peak: gse.peak.date, obscuration: gse.obscuration } : null;
  var lse = safe(function () { return Astronomy.SearchLocalSolarEclipse(now, observer); }, null);
  out.localSolarEclipse = lse ? {
    kind: lse.kind, obscuration: lse.obscuration * 100,
    peak: lse.peak.time.date, peakAlt: lse.peak.altitude,
    partialBegin: lse.partial_begin ? lse.partial_begin.time.date : null,
    partialEnd: lse.partial_end ? lse.partial_end.time.date : null,
  } : null;

  // --- نمودار ۲۴ ساعته (۱۲ ساعت قبل تا ۱۲ ساعت بعد)، گام ۱۵ دقیقه
  var series = [];
  var t0 = now.getTime() - 12 * 3600000;
  for (var s = 0; s <= 96; s++) {
    var tt = new Date(t0 + s * 15 * 60000);
    series.push({
      t: tt.getTime(),
      moon: horizonAt('Moon', tt, observer).altitude,
      sun: horizonAt('Sun', tt, observer).altitude,
    });
  }
  out.chart = { series: series, start: t0, end: t0 + 24 * 3600000, now: now.getTime() };
  return out;
}

module.exports = {
  computeFast: computeFast,
  computeSlow: computeSlow,
  // ابزارها (برای UI و تست)
  fmtDMS: fmtDMS, fmtHMS: fmtHMS, splitDuration: splitDuration, compassIndex: compassIndex,
  phaseKeyFromAngle: phaseKeyFromAngle, litPathRight: litPathRight, drawElongation: drawElongation,
  brightLimbPA: brightLimbPA, angularSeparation: angularSeparation, airMass: airMass,
  yallopQ: yallopQ, yallopCategory: yallopCategory, odehV: odehV, odehCategory: odehCategory,
  findLonCrossing: findLonCrossing, eclipticLonAt: eclipticLonAt, timezoneInfo: timezoneInfo,
  MANSION_SPAN: MANSION_SPAN,
  NEAR_PERIGEE_KM: NEAR_PERIGEE_KM,
  NEAR_APOGEE_KM: NEAR_APOGEE_KM,
};
