// ============================================================
// skyModel — v3.5. مدل جوی: میرایی نور و روشنایی آسمان گرگ‌ومیش.
//
// ⚠️ صادقانه: این «مدل کامل Schaefer (۱۹۸۸)» نیست. معادلات کامل آن مقاله در
// دسترس نیست. این ماژول اجزای منتشرشده‌ای را کنار هم می‌گذارد:
//
//  ۱) میرایی (V-band) به‌صورت مجموع سه جزء — Hayes & Latham (1975)، به‌همان‌صورت
//     که در Green (1992) و پیوست B مقاله‌ی Global Meteor Network (arXiv:2107.12335) آمده:
//        k_Rayleigh = 0.1451 · exp(−h/7.996 km)       (یا × P/1013.25 با فشار واقعی)
//        k_aerosol  = 0.12   · exp(−h/1.5 km)         (میانگین) ← با AOD واقعی جایگزین می‌شود:
//                     k_aer = 1.0857 · AOD · exp(−h/1.5 km)
//        k_ozone    = 0.016
//     و جرم هوایی (Green 1992): X(z) = 1 / (cos z + 0.025·exp(−11 cos z)).
//
//  ۲) روشنایی آسمان و حد دید: فرمول‌های Schaefer (۱۹۹۰، ۱۹۹۳) به‌صورت پیاده‌سازی
//     متن‌باز Astro.Lunar.CrescentVisibility (kipcole9/astro، Apache-2.0):
//        B_twilight = 10^{−0.4 (M_sun − M_0 + 32.5 − h_sun − Z/(360 k))} · (1 − 10^{−0.4 k X})
//        حد دید: Th = C1 (1 + √(C2 B))² ،  m_lim = −16.57 − 2.5 log Th − k X
//        (C1,C2) = (10^−9.8, 10^−1.9) برای B < 1500 nL، وگرنه (10^−8.35, 10^−5.9)
//     دامنه‌ی اعتبار: عمق خورشید ۱ تا ۲۰ درجه زیر افق.
//
//  ۳) محدودیت مهم: هلال یک جسم گسترده است؛ این مدل آن را «منبع نقطه‌ای با قدر
//     کل هلال» فرض می‌کند (قدر کل: m = −12.73 + 0.026|α| + 4×10⁻⁹ α⁴). نتیجه
//     یک «حاشیه‌ی قدر» است، نه رده‌بندی رسمی؛ در رده‌ها دخالت داده نمی‌شود.
//
// ورودی‌های جوی واقعی (AOD، فشار، رطوبت) از weatherService می‌آیند (اختیاری).
// ============================================================

var NL_PER_UNIT = 1.11e-15;      // ضریب تبدیل به نانولامبرت
var DARK_SKY_B0 = 1.0e-13;       // پایه‌ی روشنایی آسمان تاریک (≈ ۹۰ nL در سمت‌الرأس)
var MS_V = -26.74, M0_V = -11.05, TWILIGHT_ZP = 32.5;

function airMass(zDeg) {
  if (zDeg >= 90) return 40;
  var c = Math.cos(zDeg * Math.PI / 180);
  return 1 / (c + 0.025 * Math.exp(-11 * c));
}

// ورودی: { elevationM, pressureHPa?, aod?, ozoneDU? }
function extinction(inp) {
  var h = Math.max(0, (inp && inp.elevationM) || 0) / 1000; // km
  var pFactor = inp && inp.pressureHPa ? inp.pressureHPa / 1013.25 : null;
  var kRay = 0.1451 * (pFactor !== null ? pFactor : Math.exp(-h / 7.996));
  var hasAod = inp && typeof inp.aod === 'number' && isFinite(inp.aod) && inp.aod >= 0;
  var kAer = hasAod ? 1.0857 * inp.aod * Math.exp(-h / 1.5) : 0.12 * Math.exp(-h / 1.5);
  var kOz = inp && inp.ozoneDU ? 0.016 * (inp.ozoneDU / 300) : 0.016;
  return {
    kRayleigh: kRay, kAerosol: kAer, kOzone: kOz, k: kRay + kAer + kOz,
    aerosolFromMeasurement: !!hasAod, pressureFromMeasurement: pFactor !== null,
  };
}

function moonTotalMagnitude(phaseAngleDeg) {
  var a = Math.abs(phaseAngleDeg);
  return -12.73 + 0.026 * a + 4.0e-9 * Math.pow(a, 4);
}

function nlToMagArcsec(nl) {
  // تبدیل Garstang: B[nL] = 34.08·exp(20.7233 − 0.92104·S)
  return (20.7233 - Math.log(Math.max(nl, 1e-9) / 34.08)) / 0.92104;
}

// روشنایی آسمان (nL) در نقطه‌ای با فاصله‌ی سمت‌الرأسی zDeg وقتی خورشید در ارتفاع sunAlt است
function skyBrightness(sunAltDeg, zDeg, k) {
  var depression = -sunAltDeg;
  var X = airMass(zDeg);
  var zr = zDeg * Math.PI / 180;
  var vanRhijn = 0.4 + 0.6 / Math.sqrt(Math.max(1 - 0.96 * Math.pow(Math.sin(zr), 2), 0.01));
  var dark = DARK_SKY_B0 * vanRhijn * Math.pow(10, -0.4 * k * X) / NL_PER_UNIT;
  var twilight = 0;
  if (depression > 1 && depression < 20) {
    var logBt = -0.4 * (MS_V - M0_V + TWILIGHT_ZP - sunAltDeg - zDeg / (360 * k));
    twilight = (Math.pow(10, logBt) / NL_PER_UNIT) * (1 - Math.pow(10, -0.4 * k * X));
  }
  return { darkNL: dark, twilightNL: twilight, totalNL: Math.max(dark + twilight, 1), depression: depression, inRange: depression > 1 && depression < 20 };
}

function limitingMagnitude(bNL, extinctionMag) {
  var c1, c2;
  if (bNL < 1500) { c1 = Math.pow(10, -9.8); c2 = Math.pow(10, -1.9); }
  else { c1 = Math.pow(10, -8.35); c2 = Math.pow(10, -5.9); }
  var th = c1 * Math.pow(1 + Math.sqrt(c2 * bNL), 2);
  return -16.57 - 2.5 * Math.log10(Math.max(th, 1e-30)) - extinctionMag;
}

// مقادیر نقطه‌ی تحلیل: { sunAltitude, moonAltitude, phaseAngleDeg }  و  atmosphere = extinction(...)
function evaluate(point, atm) {
  if (!point || point.moonAltitude === null || point.moonAltitude === undefined || point.sunAltitude === null || point.sunAltitude === undefined) return null;
  var k = atm.k;
  var zMoon = 90 - point.moonAltitude;
  var X = airMass(zMoon);
  var sky = skyBrightness(point.sunAltitude, zMoon, k);
  var extMag = k * X;
  var out = {
    k: k, airMassMoon: X, extinctionMag: extMag, sky: sky,
    skyMagArcsec: nlToMagArcsec(sky.totalNL),
    valid: point.moonAltitude > 0 && sky.inRange,
  };
  if (point.phaseAngleDeg !== null && point.phaseAngleDeg !== undefined) {
    out.crescentMagnitude = moonTotalMagnitude(point.phaseAngleDeg) + extMag;
    out.limitingMagnitude = limitingMagnitude(sky.totalNL, extMag);
    out.marginMag = out.limitingMagnitude - out.crescentMagnitude;   // > 0 ⇒ بالاتر از حد دید (برای منبع نقطه‌ای)
    out.rs = out.marginMag / 2.5;
  }
  return out;
}

module.exports = {
  airMass: airMass, extinction: extinction, moonTotalMagnitude: moonTotalMagnitude,
  skyBrightness: skyBrightness, limitingMagnitude: limitingMagnitude, nlToMagArcsec: nlToMagArcsec,
  evaluate: evaluate,
};
