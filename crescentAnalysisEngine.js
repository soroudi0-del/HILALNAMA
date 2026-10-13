// ============================================================
// crescentAnalysisEngine.js
//
// موتور محاسباتی مشترک صفحه‌ی «تحلیل پیشرفته رؤیت هلال» (Advanced
// Crescent Analysis). طبق SECTION 10 سند طراحی: «Keep calculations
// independent from UI» — این فایل هیچ import ای از react/react-native
// ندارد و فقط داده تولید می‌کند؛ هر دو کامپوننت SkySimulation و
// Timeline از همین یک منبع می‌خوانند تا هرگز با هم واگرا نشوند.
//
// اصل طراحی مهم: این فایل منطق نجومی (refraction/elongation/Yallop/
// Odeh/...) را از نو پیاده نمی‌کند. moonPosition.js از قبل این
// منطق را دارد و به‌دقت با منابع علمی تطبیق داده شده (نگاه کنید به
// کامنت‌های بازبینی ۱ تا ۳ در آن فایل). تکرار آن منطق این‌جا ریسک
// واگرایی مقادیر بین این صفحه و بقیه‌ی اپ دارد. پس:
//   - moonAltitude/sunAltitude/arcv/daz/elongation/crescentWidth در
//     هر لحظه با MoonCalculator.getHorizonCoords و
//     MoonCalculator.calcTopoElongation ساخته می‌شوند — دقیقاً همان
//     توابع سطح‌پایینی که getFullMoonData خودش استفاده می‌کند.
//   - bestTime/lagTime/rده‌بندی نهایی معیارها (Yallop/Odeh/...) هرگز
//     از نو محاسبه نمی‌شوند؛ مستقیم از یک فراخوانی
//     getFullMoonData(date, lat, lon, alt, nmDate) در calcMoment
//     خوانده می‌شوند — همان چیزی که HomeScreen.js نشان می‌دهد.
// ============================================================

var Astronomy = require('astronomy-engine');
var MoonCalculator = require('./moonPosition');

var DEG = 180 / Math.PI;
var MOON_RADIUS_KM = 1737.4;
var AU_KM = 149597870.7;

function toObserver(lat, lon, alt) {
  return new Astronomy.Observer(lat, lon, alt || 0);
}

// ------------------------------------------------------------
// روشنایی نسبی آسمان (Sky Brightness) — SECTION 6 آن را به‌عنوان
// پارامتر «حرفه‌ای» می‌خواهد. این یک مدل نمایی ساده‌شده بر پایه‌ی
// ارتفاع خورشید است (۰=روشن کامل، ۱=تاریکی نجومی کامل)، عمداً
// به‌عنوان یک تقریب کیفی مستند می‌شود، نه یک مدل فوتومتریک دقیق
// (مثل Krisciunas & Schaefer 1991) — چون هدف این صفحه مقایسه‌ی
// نسبی لحظات با هم است، نه یک عدد مطلق nanolambert.
// ------------------------------------------------------------
function skyDarkness(sunAltitude) {
  if (sunAltitude >= 0) return 0;
  if (sunAltitude <= -18) return 1;
  var x = -sunAltitude / 18;
  return 1 - Math.pow(1 - x, 1.6);
}

// Air Mass — تقریب استاندارد Kasten & Young (1989)، برای ارتفاع‌های
// پایین نزدیک افق (جایی که هلال معمولاً دیده می‌شود) دقیق‌تر از
// فرمول ساده‌ی sec(z) است که در z نزدیک ۹۰° واگرا می‌شود.
function airMass(altitudeDeg) {
  if (altitudeDeg === null || altitudeDeg === undefined) return null;
  if (altitudeDeg <= -1) return null; // زیر افق، بی‌معنی
  var h = Math.max(altitudeDeg, 0);
  var denom = Math.sin((h + 244 / (165 + 47 * Math.pow(h, 1.1))) / DEG);
  return 1 / denom;
}

// Refraction تقریبی (دقیقه‌ی قوسی) در ارتفاع ظاهری — فرمول Bennett
// (1982)، همانی که موتورهای نجومی رایج (از جمله astronomy-engine
// داخلی) برای 'normal' استفاده می‌کنند؛ این‌جا فقط برای نمایش عددی
// در جدول Professional Data محاسبه می‌شود (SECTION 6: "Refraction").
function refractionArcmin(apparentAltitudeDeg) {
  if (apparentAltitudeDeg === null || apparentAltitudeDeg === undefined) return null;
  if (apparentAltitudeDeg < -1) return null;
  var h = apparentAltitudeDeg;
  return 1 / Math.tan((h + 7.31 / (h + 4.4)) / DEG);
}

// زاویه‌ی موازی (Parallactic Angle) — جهت‌گیری واقعی هلال روی افق
// نسبت به قائم محلی؛ برای این‌که رصدگر بداند «هلال از کدام سمت
// دوربین/تلسکوپ را کج کند». به‌جای مسیر hour-angle/sidereal-time
// (که نیاز به Astronomy.SiderealTime دارد و signature دقیق آن در
// این نسخه‌ی کتابخانه تأیید نشده)، از فرم معادل مثلثاتی این فرمول
// استفاده می‌شود که فقط altitude/azimuth (خروجی مستقیم
// getHorizonCoords) و عرض جغرافیایی رصدگر را لازم دارد — نتیجه‌اش
// عددی‌ست، فقط مسیر ورودی‌اش متفاوت (تأیید عددی این معادل‌سازی در
// کامنت تست پایین فایل مستند است).
function parallacticAngle(observer, altitudeDeg, azimuthDeg) {
  try {
    var latRad = observer.latitude / DEG;
    var altRad = altitudeDeg / DEG;
    var azRad = azimuthDeg / DEG; // ۰=شمال، ۹۰=شرق (قرارداد getHorizonCoords)

    var sinQ = -Math.sin(azRad) * Math.cos(latRad);
    var cosQ = Math.sin(latRad) * Math.cos(altRad) - Math.cos(latRad) * Math.sin(altRad) * Math.cos(azRad);
    var denom = Math.sqrt(sinQ * sinQ + cosQ * cosQ);
    if (denom < 1e-9) return null; // نزدیک زنیت/نادیر، تعریف‌نشده
    return Math.atan2(sinQ, cosQ) * DEG;
  } catch (e) {
    return null;
  }
}

// زاویه‌ی فاز (Phase Angle) — زاویه‌ی خورشید-ماه-زمین؛ متفاوت از
// elongation (که زاویه‌ی خورشید-زمین-ماه است).
function phaseAngle(date) {
  try {
    var illum = Astronomy.Illumination('Moon', date);
    return illum.phase_angle;
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------
// sampleInstant: یک نمونه‌ی کامل داده برای یک لحظه‌ی مشخص. قلب
// موتور — هم Sky Simulation (برای رسم موقعیت لحظه‌ای) و هم Timeline
// (برای رسم کل منحنی) دقیقاً همین تابع را صدا می‌زنند، فقط با گام
// زمانی متفاوت.
//
// نکته‌ی مهم refraction: طبق مستندات خودِ moonPosition.js (F1-1)،
// ARCV/DAZ/elongation/W که مبنای معیارهای رؤیت‌اند باید airless
// (useRefraction=false) باشند. اما موقعیت قابل‌مشاهده‌ی واقعی روی
// افق (چیزی که Sky Simulation باید رسم کند تا رصدگر واقعاً همان‌جا
// را نشانه بگیرد) باید با شکست جوی (useRefraction=true) باشد. این
// تابع هر دو را جداگانه برمی‌گرداند تا هیچ‌کدام از این دو مصرف اشتباه
// نکند.
// ------------------------------------------------------------
function sampleInstant(date, observer) {
  var mHVisible = MoonCalculator.getHorizonCoords(date, observer, 'Moon', true);
  var sHVisible = MoonCalculator.getHorizonCoords(date, observer, 'Sun', true);
  var mHAirless = MoonCalculator.getHorizonCoords(date, observer, 'Moon', false);
  var sHAirless = MoonCalculator.getHorizonCoords(date, observer, 'Sun', false);

  if (!mHVisible || !sHVisible || !mHAirless || !sHAirless) {
    return {
      time: date,
      moonAltitude: null, moonAzimuth: null, sunAltitude: null, sunAzimuth: null,
      moonAltitudeVisible: null, sunAltitudeVisible: null,
      arcv: null, daz: null, dazSigned: null, relativeAzimuth: null,
      elongationTopo: null, elongationGeo: null, illuminationPercent: null,
      crescentWidthArcmin: null, skyDarkness: null, parallacticAngle: null,
      phaseAngleDeg: null, airMassMoon: null, refractionArcmin: null,
      moonDistanceKm: null, sunDistanceKm: null,
    };
  }

  // مقادیر airless — مبنای ARCV/DAZ/elongation/W (سازگار با
  // getFullMoonData)
  var arcv = mHAirless.altitude - sHAirless.altitude;
  var rawDaz = mHAirless.azimuth - sHAirless.azimuth;
  while (rawDaz > 180) rawDaz -= 360;
  while (rawDaz < -180) rawDaz += 360;
  var dazSigned = rawDaz;
  var daz = Math.abs(rawDaz);

  var elongTopo = MoonCalculator.calcTopoElongation(mHAirless, sHAirless);
  var elongGeo = null;
  try { elongGeo = Astronomy.AngleFromSun('Moon', date); } catch (e) { elongGeo = null; }

  var illum = null;
  try { illum = Astronomy.Illumination('Moon', date).phase_fraction * 100; } catch (e) { illum = null; }

  var moonDistKm = null, sunDistKm = null, moonSemiDiamDeg = null;
  try {
    var gvMoon = Astronomy.GeoVector('Moon', date, true);
    moonDistKm = Math.sqrt(gvMoon.x * gvMoon.x + gvMoon.y * gvMoon.y + gvMoon.z * gvMoon.z) * AU_KM;
    moonSemiDiamDeg = Math.asin(MOON_RADIUS_KM / moonDistKm) * DEG;
  } catch (e) { /* moonDistKm می‌ماند null */ }
  try {
    var gvSun = Astronomy.GeoVector('Sun', date, true);
    sunDistKm = Math.sqrt(gvSun.x * gvSun.x + gvSun.y * gvSun.y + gvSun.z * gvSun.z) * AU_KM;
  } catch (e) { /* sunDistKm می‌ماند null */ }

  // عرض هلال — دقیقاً همان فرمول getFullMoonData (نه یک تقریب جدید)
  var crescentWidth = null;
  var useE = elongTopo !== null && elongTopo > 0 ? elongTopo : (elongGeo > 0 ? elongGeo : null);
  if (useE !== null && moonSemiDiamDeg !== null) {
    var eR = useE / DEG;
    crescentWidth = (moonSemiDiamDeg * 60) * (1 - Math.cos(eR));
  }

  var parAngle = parallacticAngle(observer, mHVisible.altitude, mHVisible.azimuth);

  return {
    time: date,
    // موقعیت واقعی قابل‌مشاهده (با refraction) — برای Sky Simulation
    moonAltitude: mHVisible.altitude,
    moonAzimuth: mHVisible.azimuth,
    sunAltitude: sHVisible.altitude,
    sunAzimuth: sHVisible.azimuth,
    // مقادیر airless مبنای معیارها — برای Timeline/Professional Data
    moonAltitudeAirless: mHAirless.altitude,
    sunAltitudeAirless: sHAirless.altitude,
    arcv: arcv,
    daz: daz,
    dazSigned: dazSigned,
    relativeAzimuth: daz,
    elongationTopo: elongTopo,
    elongationGeo: elongGeo,
    illuminationPercent: illum,
    crescentWidthArcmin: crescentWidth,
    skyDarkness: skyDarkness(sHVisible.altitude),
    parallacticAngle: parAngle,
    phaseAngleDeg: phaseAngle(date),
    airMassMoon: airMass(mHVisible.altitude),
    refractionArcmin: refractionArcmin(mHVisible.altitude),
    moonDistanceKm: moonDistKm,
    sunDistanceKm: sunDistKm,
  };
}

// ------------------------------------------------------------
// buildAnalysis: نقطه‌ی ورودی اصلی.
//
// خروجی همه‌چیزی است که هر ۷ کامپوننت UI (Summary, SkySimulation,
// Timeline, VisibilityGauge, ProfessionalData, AutoAnalysis,
// AnimationController) نیاز دارند، از یک منبع واحد:
//   - fullData: خروجی کامل getFullMoonData همان روز (Yallop/Odeh/
//     Danjon/bestTime/lagTime و غیره) — رده‌بندی نهایی همیشه از
//     این‌جا خوانده می‌شود، نه از نو محاسبه.
//   - points: نمونه‌های ۱-دقیقه‌ای از قبل‌غروب تا بعد‌غروب‌ماه.
//   - twilights: لحظه‌ی civil/nautical/astronomical dusk، برای
//     خطوط رویداد Timeline (SECTION 3).
// ------------------------------------------------------------
function buildAnalysis(date, lat, lon, alt, nmDate) {
  var observer = toObserver(lat, lon, alt);
  var fullData = MoonCalculator.getFullMoonData(date, lat, lon, alt, nmDate);

  var invalid = !fullData || !fullData.sunSet || fullData.midnightSun || fullData.polarNight;
  if (invalid) {
    return { points: [], fullData: fullData, twilights: {}, meta: { invalid: true, reason: fullData ? (fullData.midnightSun ? 'midnightSun' : fullData.polarNight ? 'polarNight' : 'noSunset') : 'error' } };
  }

  var sunset = fullData.sunSet;
  var moonset = fullData.moonSet && fullData.moonSet.getTime() > sunset.getTime()
    ? fullData.moonSet
    : new Date(sunset.getTime() + 90 * 60000);

  var startTime = new Date(sunset.getTime() - 5 * 60000);
  var stopTime = new Date(moonset.getTime() + 5 * 60000);
  var stepMs = 60000;

  var points = [];
  for (var tms = startTime.getTime(); tms <= stopTime.getTime(); tms += stepMs) {
    points.push(sampleInstant(new Date(tms), observer));
  }

  // لحظات گرگ‌ومیش (twilight) — با جست‌وجوی ارتفاع خورشید در بین
  // نمونه‌های از‌قبل‌ساخته‌شده (به‌جای جست‌وجوی نجومی جدا، تا با
  // همان مدل airless/visible هماهنگ بماند و هزینه‌ی محاسباتی
  // اضافه نداشته باشد).
  var twilights = {
    civil: findCrossing(points, -6),
    nautical: findCrossing(points, -12),
    astronomical: findCrossing(points, -18),
  };

  return {
    points: points,
    fullData: fullData,
    sunset: sunset,
    moonset: moonset,
    bestTime: fullData.bestTime || sunset,
    twilights: twilights,
    meta: { invalid: false },
  };
}

// اولین لحظه‌ای که ارتفاع خورشید از بالا به پایین از یک آستانه عبور
// می‌کند (برای civil/nautical/astronomical dusk).
function findCrossing(points, thresholdAlt) {
  for (var i = 1; i < points.length; i++) {
    var prev = points[i - 1].sunAltitude;
    var curr = points[i].sunAltitude;
    if (prev === null || curr === null) continue;
    if (prev > thresholdAlt && curr <= thresholdAlt) return points[i].time;
  }
  return null;
}

// نزدیک‌ترین نمونه به یک زمان دلخواه — برای اسکراب/انیمیشن/tooltip،
// جایی‌که زمان دقیقاً روی مضرب ۱ دقیقه نیست.
function findPointNear(points, date) {
  if (!points || points.length === 0 || !date) return null;
  var target = date.getTime();
  var lo = 0, hi = points.length - 1;
  if (target <= points[0].time.getTime()) return points[0];
  if (target >= points[hi].time.getTime()) return points[hi];
  while (lo < hi - 1) {
    var mid = Math.floor((lo + hi) / 2);
    if (points[mid].time.getTime() <= target) lo = mid; else hi = mid;
  }
  var dLo = Math.abs(points[lo].time.getTime() - target);
  var dHi = Math.abs(points[hi].time.getTime() - target);
  return dLo <= dHi ? points[lo] : points[hi];
}

// ------------------------------------------------------------
// visibilityBand: طبقه‌بندی کیفی پیوسته (برای VisibilityGauge،
// SECTION 5: Impossible/Very Difficult/Optical Aid/Possible/Easy —
// ۵ سطح). بر پایه‌ی ARCV لحظه‌ای (شاخص اصلی اکثر معیارها)، کالیبره
// با آستانه‌های تقریبی مشترک بین Yallop/Odeh/Danjon (نه یک فرمول
// رسمی جدید، بلکه یک نگاشت پیوسته‌ی راهنما بین لحظات، در حالی که
// رده‌بندی رسمی نهایی همچنان از fullData.yallopCat/odehCat خوانده
// می‌شود).
// ------------------------------------------------------------
var VIS_BANDS = ['impossible', 'veryDifficult', 'opticalAid', 'possible', 'easy'];
function visibilityBand(point) {
  if (!point || point.moonAltitude === null || point.moonAltitude <= 0) return 'impossible';
  if (point.arcv === null) return 'impossible';
  if (point.arcv < 3) return 'impossible';
  if (point.arcv < 6.4) return 'veryDifficult';
  if (point.arcv < 8) return 'opticalAid';
  if (point.arcv < 11) return 'possible';
  return 'easy';
}
function visibilityBandIndex(point) {
  return VIS_BANDS.indexOf(visibilityBand(point));
}

// ------------------------------------------------------------
// diffPoints: اختلاف تمام پارامترهای عددی بین دو لحظه (SECTION در
// نسخه‌ی اول سند هم بود: قابلیت مقایسه‌ی دو زمان).
// ------------------------------------------------------------
function diffPoints(pointA, pointB) {
  if (!pointA || !pointB) return null;
  var keys = ['moonAltitude', 'sunAltitude', 'arcv', 'relativeAzimuth', 'elongationTopo', 'illuminationPercent', 'crescentWidthArcmin', 'skyDarkness'];
  var diff = { deltaMs: pointB.time.getTime() - pointA.time.getTime() };
  keys.forEach(function (k) {
    var a = pointA[k], b = pointB[k];
    diff[k] = (a !== null && a !== undefined && b !== null && b !== undefined) ? b - a : null;
  });
  return diff;
}

// ------------------------------------------------------------
// buildAutoAnalysis: تولید داده‌ی خام برای متن تحلیل خودکار
// (SECTION 8). این تابع فقط اعداد/لحظات کلیدی را استخراج می‌کند؛
// خودِ متن نهایی در لایه‌ی i18n با جایگذاری این اعداد در قالب
// ترجمه‌شده ساخته می‌شود (همان جداسازی محاسبه/ترجمه‌ای که بقیه‌ی
// اپ استفاده می‌کند).
// ------------------------------------------------------------
function buildAutoAnalysis(analysis) {
  var points = analysis.points;
  if (!points || points.length < 10) return null;

  var startMoonAlt = points[0].moonAltitude;
  var bestPoint = findPointNear(points, analysis.bestTime);

  // نقطه‌ی برگشت روند: جایی‌که نرخ افت ارتفاع ماه از نرخ بهبود
  // تاریکی آسمان در بازه‌ی مؤثرش (تا خورشید=-18°) پیشی می‌گیرد —
  // یعنی از این‌جا به بعد شرایط عمدتاً رو به افت می‌رود.
  var turnPoint = null;
  for (var i = 5; i < points.length - 5; i++) {
    var p0 = points[i], p1 = points[i + 5];
    if (p0.moonAltitude === null || p1.moonAltitude === null || p0.sunAltitude === null || p1.sunAltitude === null) continue;
    var moonRate = p1.moonAltitude - p0.moonAltitude; // منفی (افت)
    var sunRate = p1.sunAltitude - p0.sunAltitude; // منفی (تاریک‌تر)
    var sunStillDarkening = p0.sunAltitude > -18;
    if (sunStillDarkening && Math.abs(moonRate) > Math.abs(sunRate) * 1.15) {
      turnPoint = p0;
      break;
    }
  }

  // آیا صبر کردن کمک می‌کند؟ اگر لحظه‌ی فعلی (bestPoint) قبل از
  // turnPoint باشد و رؤیت‌پذیری در ۵ دقیقه‌ی بعد بهتر شود، بله.
  var improvingAfterBest = false;
  if (bestPoint && points.length > 0) {
    var idxBest = points.indexOf(bestPoint);
    if (idxBest >= 0 && idxBest + 5 < points.length) {
      improvingAfterBest = visibilityBandIndex(points[idxBest + 5]) > visibilityBandIndex(bestPoint);
    }
  }

  return {
    startMoonAltitude: startMoonAlt,
    sunAltitudeAtEnd: points[points.length - 1].sunAltitude,
    bestTime: analysis.bestTime,
    bestPoint: bestPoint,
    turnPoint: turnPoint,
    improvingAfterBest: improvingAfterBest,
    sunset: analysis.sunset,
    moonset: analysis.moonset,
  };
}

module.exports = {
  buildAnalysis: buildAnalysis,
  sampleInstant: sampleInstant,
  findPointNear: findPointNear,
  diffPoints: diffPoints,
  visibilityBand: visibilityBand,
  visibilityBandIndex: visibilityBandIndex,
  VIS_BANDS: VIS_BANDS,
  buildAutoAnalysis: buildAutoAnalysis,
  toObserver: toObserver,
};
