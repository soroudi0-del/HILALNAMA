// ============================================================
// deltaT — v3.5. مدل ΔT (= TT − UT1) برای astronomy-engine.
//
// چرا: چندجمله‌ای پیش‌فرض کتابخانه (Espenak & Meeus) برای ۲۰۲۶ عدد ≈ ۷۵٫۰ ثانیه
// می‌دهد، در حالی که مقدار واقعی حدود ۶۹٫۲ ثانیه است (ΔT از ۲۰۲۰ تقریباً ثابت
// مانده و حتی کمی کاهش یافته است). اثر آن روی موقعیت ماه فقط چند ثانیه‌ی قوسی
// است، ولی عدد نمایش‌داده‌شده و محاسبات UT-محور را کمی بهتر می‌کند.
//
// منابع داده:
//   • ۲۰۱۰–۲۰۲۰: مقادیر مشاهده‌ای ΔT (جدول IERS/USNO؛ هم‌خوان با ویکی‌پدیا:
//     ۶۳٫۸۳ در ژانویه‌ی ۲۰۰۰، ۶۸٫۹۷ در ژانویه‌ی ۲۰۱۸، ۶۹٫۳۶۱ در ژانویه‌ی ۲۰۲۰).
//   • ۲۰۰۰–۲۰۰۹: مقادیر تقریبی هم‌خوان با همان منابع (خطای < ۰٫۱ ثانیه).
//   • ۲۰۲۱–۲۰۲۵: تقریبی؛ ΔT کمی کاهش یافته (طبق رصدخانه‌ی ملی ژاپن ΔT در دهه‌ی
//     ۲۰۲۰ «جزئی کاهش» دارد). خطای محتمل ±۰٫۳ ثانیه.
//   • پس از ۲۰۲۵: برون‌یابی؛ تا ۲۰۳۰ ثابت ۶۹٫۲، سپس ۰٫۳ ثانیه در سال. ΔT ذاتاً
//     پیش‌بینی‌ناپذیر است؛ عدم‌قطعیت چند دهم ثانیه تا ۱–۲ ثانیه در چند سال.
//   • پیش از ۲۰۰۰: همان چندجمله‌ای پیش‌فرض کتابخانه.
// ============================================================
var Astronomy = require('astronomy-engine');

var TABLE = [
  [2000, 63.83], [2001, 64.09], [2002, 64.30], [2003, 64.47], [2004, 64.57],
  [2005, 64.69], [2006, 64.85], [2007, 65.15], [2008, 65.46], [2009, 65.78],
  [2010, 66.070], [2011, 66.324], [2012, 66.603], [2013, 66.909], [2014, 67.282],
  [2015, 67.642], [2016, 68.102], [2017, 68.594], [2018, 68.968], [2019, 69.219],
  [2020, 69.362], [2021, 69.36], [2022, 69.30], [2023, 69.25], [2024, 69.20], [2025, 69.20],
];
var LAST_YEAR = TABLE[TABLE.length - 1][0];
var LAST_VALUE = TABLE[TABLE.length - 1][1];
var FLAT_UNTIL = 2030;
var LONG_TERM_SLOPE = 0.3; // ثانیه در سال، پس از FLAT_UNTIL

function yearFromUt(ut) { return 2000 + (ut + 0.5) / 365.2425; }

function modelDeltaT(ut) {
  var y = yearFromUt(ut);
  if (y < 2000) return Astronomy.DeltaT_EspenakMeeus(ut);
  if (y <= LAST_YEAR) {
    var i = Math.min(TABLE.length - 2, Math.floor(y) - 2000);
    var a = TABLE[i], b = TABLE[i + 1];
    return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]);
  }
  if (y <= FLAT_UNTIL) return LAST_VALUE;
  var v = LAST_VALUE + LONG_TERM_SLOPE * (y - FLAT_UNTIL);
  if (y <= 2100) return v;
  // پس از ۲۱۰۰: ادامه با شیب چندجمله‌ای کتابخانه، پیوسته با مقدار ۲۱۰۰
  var ut2100 = (Date.UTC(2100, 0, 1, 12) - Date.UTC(2000, 0, 1, 12)) / 86400000;
  var base = LAST_VALUE + LONG_TERM_SLOPE * (2100 - FLAT_UNTIL);
  return base + (Astronomy.DeltaT_EspenakMeeus(ut) - Astronomy.DeltaT_EspenakMeeus(ut2100));
}

var installed = false;
function install() {
  if (installed) return;
  Astronomy.SetDeltaTFunction(modelDeltaT);
  installed = true;
}

module.exports = { install: install, modelDeltaT: modelDeltaT, TABLE: TABLE };
