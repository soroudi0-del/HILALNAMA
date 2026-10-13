var React = require('react');
var View = require('react-native').View;
var Text = require('./ScaledText');
var StyleSheet = require('react-native').StyleSheet;
var theme = require('./theme');

// ============================================================
// DataRow — نسخه‌ی یکپارچه‌ی کامپوننت DR که قبلاً در انتهای
// HomeScreen.js تعریف شده بود (و نسخه‌های مشابهش احتمالاً در
// MoonDataScreen/MapScreen هم جدا تکرار شده بودند). اکنون یک
// نسخه‌ی مشترک با استایل از theme.js.
//
// props:
//   label      - برچسب سمت چپ/راست (بسته به جهت زبان)
//   value      - مقدار
//   valueColor - رنگ اختصاصی مقدار (مثلاً سبز برای ارتفاع مثبت)
//   isRTL      - جهت متن
//   note       - یادداشت اختیاری زیر ردیف (مثل «* از مقارنه تا غروب محلی»)
// ============================================================
function DataRow(props) {
  var textAlign = props.isRTL ? 'right' : 'left';
  return React.createElement(
    View,
    { style: st.wrap },
    React.createElement(
      View,
      { style: st.row },
      React.createElement(Text, { style: [st.value, props.valueColor ? { color: props.valueColor } : null] }, props.value),
      React.createElement(Text, { style: [st.label, { textAlign: textAlign }] }, props.label)
    ),
    props.note
      ? React.createElement(Text, { style: [st.note, { textAlign: textAlign }] }, '* ' + props.note)
      : null
  );
}

var st = StyleSheet.create({
  wrap: { marginBottom: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm - 2,
  },
  label: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, flex: 1 },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.body.fontSize,
    fontWeight: theme.type.body.fontWeight,
    flex: 1,
    textAlign: 'left',
  },
  note: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro.fontSize,
    fontStyle: 'italic',
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
});

module.exports = DataRow;
