var React = require('react');
var RN = require('react-native');
var LC = require('../i18n/LanguageContext');

// ============================================================
// ScaledText — v3.5 (درخواست کاربران: «امکان تنظیم فونت»).
//
// جایگزین مستقیم <Text> از react-native. ضریب فونتِ انتخابیِ کاربر
// (LanguageContext.fontScale) را روی fontSize و lineHeight اعمال می‌کند.
//
// - ضریب ۱ ⇒ هیچ کپی/محاسبه‌ای نمی‌شود؛ props مستقیماً به Text اصلی می‌رسد
//   (رفتار و هزینه‌ی ۳٫۰٫۲).
// - ضریب ≠ ۱ ⇒ fontSize و lineHeight ضرب می‌شوند و سقف بزرگ‌نمایی سیستم‌عامل
//   (maxFontSizeMultiplier) برای جلوگیری از شکستن چیدمان گذاشته می‌شود.
// ============================================================
var ScaledText = React.forwardRef(function ScaledText(props, ref) {
  var ctx = React.useContext(LC.LanguageContext);
  var scale = ctx && ctx.fontScale ? ctx.fontScale : 1;
  if (scale === 1) {
    return React.createElement(RN.Text, ref ? Object.assign({ ref: ref }, props) : props);
  }
  var flat = RN.StyleSheet.flatten(props.style) || {};
  var style = Object.assign({}, flat);
  if (typeof flat.fontSize === 'number') style.fontSize = Math.round(flat.fontSize * scale * 10) / 10;
  if (typeof flat.lineHeight === 'number') style.lineHeight = Math.round(flat.lineHeight * scale * 10) / 10;
  var p = Object.assign({}, props, { style: style });
  if (p.maxFontSizeMultiplier === undefined) p.maxFontSizeMultiplier = 1.4;
  if (ref) p.ref = ref;
  return React.createElement(RN.Text, p);
});
ScaledText.displayName = 'ScaledText';

module.exports = ScaledText;
