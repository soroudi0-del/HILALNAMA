// ============================================================
// aimEngine — v3.5. محاسبات خالص «هلال‌یاب» (بدون وابستگی به حسگر یا UI).
//
// گوشی را به‌صورت «ایستاده» (portrait) می‌گیرید و دوربین پشتی به‌سمت آسمان
// است. دو زاویه لازم است:
//   • سمت (heading): از expo-location (trueHeading = شمال حقیقی؛ اگر نبود
//     magHeading + تصحیح دستی/کالیبراسیون با خورشید).
//   • ارتفاع (elevation) راستای دوربین پشتی: از بردار گرانش (شتاب‌سنج).
//
// ارتفاع از گرانش:  اگر a بردار شتاب‌سنج در دستگاه باشد (x راست، y بالای صفحه،
// z عمود بر صفحه به‌سمت کاربر)، راستای دوربین پشتی d = (0, 0, −1) است و
//   elevation = asin( s · (−a_z) / |a| )
// که s = +۱ برای قرارداد اندروید (a به‌سمت بالا) و −۱ برای قرارداد iOS خام
// (a به‌سمت پایین) است. چون قرارداد روی دستگاه‌ها فرق می‌کند، s هنگام «تنظیم
// افق» (گوشی ایستاده، a_y بزرگ) از علامت a_y خودکار تشخیص داده می‌شود؛ بنابراین
// به دانستن پلتفرم نیاز نیست.
// ============================================================

var MoonCalculator = require('./moonPosition');
var Astronomy = require('astronomy-engine');

var DEG = Math.PI / 180;

function norm360(a) { return ((a % 360) + 360) % 360; }
// اختلاف زاویه‌ای هدف − فعلی در بازه‌ی (−۱۸۰, ۱۸۰]  (مثبت = به راست بچرخید)
function angDiff(target, current) {
  var d = norm360(target - current);
  return d > 180 ? d - 360 : d;
}
function compassIndex(az) { return Math.round(norm360(az) / 22.5) % 16; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// میانگین متحرک نمایی برای زاویه‌ی دایره‌ای (بدون پرش در ۰/۳۶۰)
function circularEma(prev, next, alpha) {
  if (prev === null || prev === undefined || isNaN(prev)) return norm360(next);
  var d = angDiff(next, prev);
  return norm360(prev + alpha * d);
}
function ema(prev, next, alpha) {
  if (prev === null || prev === undefined || isNaN(prev)) return next;
  return prev + alpha * (next - prev);
}

// ---- ارتفاع از بردار شتاب‌سنج
function elevationFromAccel(a, sign) {
  var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  if (!mag || !isFinite(mag)) return null;
  var s = sign === -1 ? -1 : 1;
  return Math.asin(clamp((s * -a.z) / mag, -1, 1)) / DEG;
}
// قرارداد شتاب‌سنج را از یک نمونه‌ی «گوشی ایستاده» تشخیص می‌دهد.
// خروجی: +۱ / −۱، یا null اگر گوشی به‌اندازه‌ی کافی ایستاده نیست.
function detectAccelSign(a) {
  var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  if (!mag) return null;
  // «ایستاده» = مؤلفه‌ی طولی (y) بر مؤلفه‌ی عمق (z) غالب باشد. کج‌شدن دوربین تا ≈۶۰° بالای
  // افق هنوز |a_y|/|a| = cos 60° = 0.5 می‌دهد، پس آستانه‌ی ۰٫۴ و شرط |a_y| > |a_z| کافی است.
  if (Math.abs(a.y) / mag < 0.4 || Math.abs(a.y) <= Math.abs(a.z)) return null;
  return a.y > 0 ? 1 : -1;
}

// ---- کالیبراسیون
// cal = { headingOffset (deg), elevOffset (deg), accelSign (+1/-1/null), declination (deg) }
function defaultCalibration() { return { headingOffset: 0, elevOffset: 0, accelSign: null, declination: 0, fovLong: 66 }; }
function applyCalibration(raw, cal) {
  var c = cal || defaultCalibration();
  return {
    heading: raw.heading === null || raw.heading === undefined ? null : norm360(raw.heading + (c.headingOffset || 0) + (c.declination || 0)),
    elevation: raw.elevation === null || raw.elevation === undefined ? null : clamp(raw.elevation + (c.elevOffset || 0), -90, 90),
  };
}
// «تنظیم افق»: گوشی ایستاده و دوربین افقی ⇒ ارتفاع باید ۰ باشد.
function calibrateLevel(accel, cal) {
  var sign = detectAccelSign(accel);
  if (sign === null) return { ok: false, reason: 'NOT_UPRIGHT' };
  var next = Object.assign({}, cal || defaultCalibration(), { accelSign: sign, elevOffset: 0 });
  var raw = elevationFromAccel(accel, sign);
  next.elevOffset = -raw;
  return { ok: true, cal: next, rawElevation: raw };
}
// «کالیبراسیون با خورشید/ماه»: جهت واقعی جرم معلوم است؛ اختلاف با heading خام ⇒ offset.
function calibrateHeadingToBody(trueAzimuth, rawHeading, cal) {
  var next = Object.assign({}, cal || defaultCalibration());
  next.declination = 0;
  next.headingOffset = angDiff(trueAzimuth, rawHeading);
  return next;
}

// ---- هدف
// mode: 'moonNow' | 'moonBest' | 'sunNow' | 'sunset'
function bodyAltAz(body, date, city) {
  var obs = new Astronomy.Observer(city.lat, city.lon, city.alt || 0);
  var h = MoonCalculator.getHorizonCoords(date, obs, body, true);
  return { azimuth: h.azimuth, altitude: h.altitude };
}
function computeTarget(mode, now, city) {
  if (mode === 'moonNow') {
    var m = bodyAltAz('Moon', now, city);
    var sn = bodyAltAz('Sun', now, city);
    return { mode: mode, time: now, azimuth: m.azimuth, altitude: m.altitude, body: 'Moon', sun: { azimuth: sn.azimuth, altitude: sn.altitude } };
  }
  if (mode === 'sunNow') {
    var s = bodyAltAz('Sun', now, city);
    return { mode: mode, time: now, azimuth: s.azimuth, altitude: s.altitude, body: 'Sun' };
  }
  if (mode === 'sunset' || mode === 'moonBest') {
    var anchor = MoonCalculator.getLocalDayAnchor(now, city.lat, city.lon);
    var data = MoonCalculator.getFullMoonData(anchor, city.lat, city.lon, city.alt || 0, null);
    // اگر غروب امروز گذشته، غروب فردا
    if (data && data.sunSet && data.sunSet.getTime() < now.getTime() - 30 * 60000) {
      var tomorrow = MoonCalculator.getLocalDayAnchor(now, city.lat, city.lon, 1);
      data = MoonCalculator.getFullMoonData(tomorrow, city.lat, city.lon, city.alt || 0, null);
    }
    if (!data || !data.sunSet) return { mode: mode, error: 'NO_SUNSET' };
    if (mode === 'sunset') {
      var ss = bodyAltAz('Sun', data.sunSet, city);
      return { mode: mode, time: data.sunSet, azimuth: ss.azimuth, altitude: ss.altitude, body: 'Sun' };
    }
    var when = data.bestTime || null;
    if (!when) return { mode: mode, error: 'NO_BEST_TIME', sunSet: data.sunSet };
    var mb = bodyAltAz('Moon', when, city);
    var sb = bodyAltAz('Sun', when, city);
    return { mode: mode, time: when, azimuth: mb.azimuth, altitude: mb.altitude, body: 'Moon', category: data.yallopCat, schaeferR: data.schaeferR, sun: { azimuth: sb.azimuth, altitude: sb.altitude } };
  }
  return { mode: mode, error: 'UNKNOWN_MODE' };
}

// ---- راهنمایی
// tolerance: درجه (پیش‌فرض ۳). خروجی برای نمایش: جهت و مقدار چرخش/کج‌کردن.
function guidance(target, pose, tolerance) {
  var tol = tolerance === undefined ? 3 : tolerance;
  if (!target || target.azimuth === undefined || !pose || pose.heading === null || pose.elevation === null) {
    return { ready: false };
  }
  var dAz = angDiff(target.azimuth, pose.heading);
  var dAlt = target.altitude - pose.elevation;
  var aligned = Math.abs(dAz) <= tol && Math.abs(dAlt) <= tol;
  return {
    ready: true,
    dAz: dAz, dAlt: dAlt,
    turn: Math.abs(dAz) <= tol ? 'ok' : (dAz > 0 ? 'right' : 'left'),
    tilt: Math.abs(dAlt) <= tol ? 'ok' : (dAlt > 0 ? 'up' : 'down'),
    aligned: aligned,
    targetBelowHorizon: target.altitude < 0,
    separation: Math.sqrt(dAz * dAz * Math.pow(Math.cos(Math.max(-89, Math.min(89, target.altitude)) * DEG), 2) + dAlt * dAlt),
  };
}

// ============================================================
// v3.6 — واقعیت افزوده (AR) روی تصویر دوربین پشتی.
//
// دستگاه: x راست، y بالای صفحه، z عمود بر صفحه به‌سمت کاربر؛ دوربین پشتی در راستای −z.
// جهان: ENU (شرق، شمال، بالا). وضعیت گوشی با سه زاویه: سمت دوربین H، ارتفاع دوربین E
// و چرخش حول محور دوربین (roll) ρ. محورهای دستگاه در دستگاه ENU:
//   f = (cosE sinH, cosE cosH, sinE)               ← جهت دوربین (−z)
//   r₀ = (cosH, −sinH, 0) ،  u₀ = (−sinE sinH, −sinE cosH, cosE)
//   r = r₀ cosρ − u₀ sinρ  (راست صفحه) ،  u = u₀ cosρ + r₀ sinρ  (بالای صفحه)
// جهت هدف v (بردار یکه از سمت/ارتفاع) به صفحه چنین می‌افتد (مدل پین‌هول):
//   x = v·r ، y = v·u ، z = v·f ،  X = W/2 + f_px·x/z ،  Y = H/2 − f_px·y/z
// f_px از زاویه‌ی دید «بُعد بلند» (عمودیِ حالت ایستاده): f_px = (Hpx/2)/tan(FOV/2).
// ============================================================
function unitFromAzAlt(azDeg, altDeg) {
  var az = azDeg * DEG, al = altDeg * DEG;
  return [Math.cos(al) * Math.sin(az), Math.cos(al) * Math.cos(az), Math.sin(al)];
}
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a) { var m = Math.sqrt(dot3(a, a)); return m ? [a[0] / m, a[1] / m, a[2] / m] : null; }

function cameraAxes(headingDeg, elevDeg, rollDeg) {
  var H = headingDeg * DEG, E = elevDeg * DEG, R = (rollDeg || 0) * DEG;
  var f = [Math.cos(E) * Math.sin(H), Math.cos(E) * Math.cos(H), Math.sin(E)];
  var r0 = [Math.cos(H), -Math.sin(H), 0];
  var u0 = [-Math.sin(E) * Math.sin(H), -Math.sin(E) * Math.cos(H), Math.cos(E)];
  var cr = Math.cos(R), sr = Math.sin(R);
  return {
    f: f,
    r: [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr],
    u: [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr],
  };
}

// roll از شتاب‌سنج (درجه). مثبت = گوشی ساعت‌گرد چرخیده (بالای صفحه به‌سمت راست).
function rollFromAccel(a, sign) {
  var s = sign === -1 ? -1 : 1;
  if (!a) return null;
  if (Math.abs(a.x) + Math.abs(a.y) < 1e-6) return 0;   // رو به آسمان/زمین: roll تعریف‌نشده
  return Math.atan2(-s * a.x, s * a.y) / DEG;
}

// سمت مغناطیسی دوربین پشتی (−z) از شتاب‌سنج و مغناطیس‌سنج، با جبران کامل شیب.
// برخلاف heading خامِ اندروید (جهت «لبه‌ی بالای گوشی»، که در حالت ایستاده ناپایدار و با
// ۱۸۰° اختلاف است)، این مقدار مستقیماً به‌سمتی است که دوربین نگاه می‌کند.
// m بردار میدان مغناطیسی در دستگاه (هر یکایی)، sign=+۱ اگر a به‌سمت بالا باشد.
function cameraHeadingFromSensors(a, m, sign) {
  if (!a || !m) return null;
  var s = sign === -1 ? -1 : 1;
  var up = norm3([s * a.x, s * a.y, s * a.z]);
  if (!up) return null;
  var east = norm3(cross3([m.x, m.y, m.z], up));        // m × up ⇒ شرق (افقی)
  if (!east) return null;
  var north = cross3(up, east);
  // دوربین به‌سمت −z است. اگر دوربین تقریباً عمود (سمت‌الرأس/نادیر) باشد، سمت تعریف‌نشده است.
  var fe = -east[2], fn = -north[2];
  if (Math.abs(fe) + Math.abs(fn) < 0.02) return null;
  return norm360(Math.atan2(fe, fn) / DEG);
}
// اختلاف شمال حقیقی و مغناطیسی (انحراف مغناطیسی) از یک نمونه‌ی expo-location
function declinationFromHeading(h) {
  if (!h || typeof h.trueHeading !== 'number' || h.trueHeading < 0 || typeof h.magHeading !== 'number' || h.magHeading < 0) return null;
  return angDiff(h.trueHeading, h.magHeading);
}

// نگاشت یک جهت (سمت/ارتفاع) به مختصات صفحه. cam = { width, height, fovLongDeg }
// pose = { heading, elevation, roll }.
function projectToScreen(azDeg, altDeg, pose, cam) {
  var ax = cameraAxes(pose.heading, pose.elevation, pose.roll || 0);
  var v = unitFromAzAlt(azDeg, altDeg);
  var x = dot3(v, ax.r), y = dot3(v, ax.u), z = dot3(v, ax.f);
  var fpx = (cam.height / 2) / Math.tan(cam.fovLongDeg * DEG / 2);
  var out = { x: null, y: null, inFront: z > 0.02, inFrame: false, fpx: fpx, camX: x, camY: y, camZ: z };
  // زاویه‌ی خارج‌شدن از محور دوربین
  out.offAxisDeg = Math.acos(Math.max(-1, Math.min(1, z))) / DEG;
  if (out.inFront) {
    out.x = cam.width / 2 + fpx * x / z;
    out.y = cam.height / 2 - fpx * y / z;
    out.inFrame = out.x >= 0 && out.x <= cam.width && out.y >= 0 && out.y <= cam.height;
  }
  // جهت پیکان لبه‌ی صفحه (زاویه‌ی صفحه‌ای: ۰ = بالا، ساعت‌گرد مثبت)، حتی وقتی هدف بیرون یا پشت است
  var mag = Math.sqrt(x * x + y * y);
  out.screenAngleDeg = mag > 1e-9 ? norm360(Math.atan2(x, y) / DEG) : 0;
  return out;
}

// خطوط راهنما (افق/شبکه‌ی ارتفاع) به‌صورت چندخط روی صفحه؛ فقط نقاط جلوی دوربین.
// خروجی: آرایه‌ی تکه‌خط‌ها؛ هر تکه آرایه‌ای از {x,y}.
function projectedAltitudeLine(altDeg, pose, cam, stepDeg, halfSpanDeg) {
  var step = stepDeg || 5, span = halfSpanDeg || 70;
  var segs = [], cur = [];
  var cz = Math.round(pose.heading / step) * step;
  for (var d = -span; d <= span; d += step) {
    var p = projectToScreen(cz + d, altDeg, pose, cam);
    if (p.inFront && Math.abs(p.x) < cam.width * 4 && Math.abs(p.y) < cam.height * 4) cur.push({ x: p.x, y: p.y });
    else if (cur.length) { segs.push(cur); cur = []; }
  }
  if (cur.length) segs.push(cur);
  return segs;
}

// کالیبراسیون با ضربه: کاربر روی نقطه‌ی (tapX, tapY) که جرم واقعی را در تصویر می‌بیند ضربه می‌زند.
// offset های سمت/ارتفاع (اضافه روی pose فعلی) را چنان می‌یابد که نگاشت جرم دقیقاً روی ضربه بیفتد.
// گاوس–نیوتن با ژاکوبین عددی؛ pose = وضعیت «پس از کالیبراسیون قبلی».
function solveOffsetsFromTap(body, pose, cam, tapX, tapY) {
  var dH = 0, dE = 0, eps = 0.05;
  function proj(h, e) {
    var p = projectToScreen(body.azimuth, body.altitude, { heading: pose.heading + h, elevation: pose.elevation + e, roll: pose.roll || 0 }, cam);
    return p.inFront ? p : null;
  }
  for (var it = 0; it < 12; it++) {
    var p0 = proj(dH, dE);
    if (!p0) return null;
    var rx = tapX - p0.x, ry = tapY - p0.y;
    if (Math.abs(rx) < 0.3 && Math.abs(ry) < 0.3) break;
    var pH = proj(dH + eps, dE), pE = proj(dH, dE + eps);
    if (!pH || !pE) return null;
    var j11 = (pH.x - p0.x) / eps, j21 = (pH.y - p0.y) / eps;
    var j12 = (pE.x - p0.x) / eps, j22 = (pE.y - p0.y) / eps;
    var det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-9) return null;
    dH += (j22 * rx - j12 * ry) / det;
    dE += (-j21 * rx + j11 * ry) / det;
    if (Math.abs(dH) > 45 || Math.abs(dE) > 45) return null;
  }
  return { dHeading: dH, dElevation: dE };
}

// موقعیت فعلی یک جرم (با شکست جوی) — برای کالیبراسیون و رسم خورشید کنار هدف
function bodyNow(body, date, city) { return bodyAltAz(body, date, city); }

// دقت قطب‌نما (expo-location: ۰ تا ۳؛ −۱ نامعتبر) ⇒ نیاز به کالیبراسیون؟
function compassQuality(accuracy) {
  if (accuracy === null || accuracy === undefined || accuracy < 0) return 'unknown';
  if (accuracy >= 3) return 'good';
  if (accuracy === 2) return 'fair';
  return 'poor';
}

module.exports = {
  norm360: norm360, compassIndex: compassIndex, angDiff: angDiff, circularEma: circularEma, ema: ema,
  elevationFromAccel: elevationFromAccel, detectAccelSign: detectAccelSign,
  defaultCalibration: defaultCalibration, applyCalibration: applyCalibration,
  calibrateLevel: calibrateLevel, calibrateHeadingToBody: calibrateHeadingToBody,
  computeTarget: computeTarget, guidance: guidance, compassQuality: compassQuality,
  // v3.6 AR
  cameraAxes: cameraAxes, rollFromAccel: rollFromAccel, cameraHeadingFromSensors: cameraHeadingFromSensors,
  declinationFromHeading: declinationFromHeading, projectToScreen: projectToScreen,
  projectedAltitudeLine: projectedAltitudeLine, solveOffsetsFromTap: solveOffsetsFromTap, bodyNow: bodyNow,
};
