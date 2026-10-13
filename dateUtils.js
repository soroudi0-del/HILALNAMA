// ============================================================
// v3.5 — قالب‌بندی تاریخ/ساعت مستقل از منطقه‌ی زمانی «دستگاه».
// همه‌ی تاریخ‌ها در منطقه‌ی زمانی «شهر/محل» تفسیر می‌شوند و بدون
// وابستگی به Intl (که روی بعضی دستگاه‌های Hermes ناقص است).
// ============================================================
var MoonCalculator = require('../calculations/moonPosition');
var HijriCalendar = require('../calculations/hijriCalendar');

// تاریخ مدنیِ محل برای یک لحظه‌ی واقعی → Date محلیِ ظهرِ همان روز (برای formatterها)
function civilDate(instant, lat, lon) {
  var a = (lat !== undefined && lat !== null && lon !== undefined && lon !== null)
    ? MoonCalculator.getLocalDayAnchor(instant, lat, lon)
    : instant;
  return new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 12, 0, 0);
}

// lang: 'fa' → شمسی؛ 'ar'/'en' → میلادی با نام ماه‌های همان زبان (monthNames از tArray('gregorianMonths'))
function formatCivilDate(instant, lang, lat, lon, monthNames) {
  if (!instant) return '---';
  var c = civilDate(instant, lat, lon);
  if (lang === 'fa') return HijriCalendar.formatJalali(c);
  var m = monthNames && monthNames[c.getMonth()] ? monthNames[c.getMonth()] : HijriCalendar.gregorianMonths[c.getMonth()];
  return c.getDate() + ' ' + m + ' ' + c.getFullYear();
}

function formatTimeHM(instant, lat, lon) {
  if (!instant) return '--:--';
  return MoonCalculator.formatTimeHM(instant, lat, lon);
}

module.exports = {
  civilDate: civilDate,
  formatCivilDate: formatCivilDate,
  formatTimeHM: formatTimeHM,
};
