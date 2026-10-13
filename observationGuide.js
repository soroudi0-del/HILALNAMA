// ============================================================
// نسخه ۵ — نقطه‌ی ورود چندزبانه‌ی محتوای آموزشی
//
// این فایل جایگزین observationGuide.js قبلی شده و بر اساس زبان
// جاری اپ (fa/ar/en) فایل داده‌ی مناسب را برمی‌گرداند.
//
// وضعیت فعلی: هر سه فایل (fa/ar/en) اکنون محتوای کامل و ترجمه‌شده
// دارند (۵۸ درس در هر زبان). fallback به فارسی همچنان به‌عنوان یک
// شبکه‌ی ایمنی (safety net) نگه داشته شده — اگر در آینده فایل زبانی
// به هر دلیلی (مثلاً خطای build یا حذف تصادفی) لود نشود، اپ کرش
// نمی‌کند یا صفحه‌ی خالی نشان نمی‌دهد، بلکه به فارسی برمی‌گردد.
//
// نحوه‌ی استفاده در Screen:
//   var getObservationGuide = require('../data/observationGuide');
//   var ObservationGuide = getObservationGuide(LCtx.lang);
// ============================================================

var faGuide = require('./observationGuide.fa');

var arGuide;
try {
  arGuide = require('./observationGuide.ar');
} catch (e) {
  arGuide = null; // شبکه‌ی ایمنی: در صورت خطای بارگذاری فایل عربی
}

var enGuide;
try {
  enGuide = require('./observationGuide.en');
} catch (e) {
  enGuide = null; // شبکه‌ی ایمنی: در صورت خطای بارگذاری فایل انگلیسی
}

function getObservationGuide(lang) {
  if (lang === 'ar') return arGuide || faGuide;
  if (lang === 'en') return enGuide || faGuide;
  return faGuide;
}

module.exports = getObservationGuide;
