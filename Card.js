var React = require('react');
var View = require('react-native').View;
var StyleSheet = require('react-native').StyleSheet;
var theme = require('./theme');

// ============================================================
// کامپوننت Card — جایگزین ده‌ها تعریف مشابه و پراکنده‌ی
// backgroundColor+borderRadius+padding که در هر صفحه (HomeScreen,
// MapScreen, MarajeScreen, ...) جداگانه و کمی متفاوت نوشته شده بود.
//
// variant:
//   'standard' (پیش‌فرض) — کارت معمولی محتوا
//   'deep'     — کارت تودرتو با پس‌زمینه‌ی تیره‌تر (توضیح معیار و...)
//   'featured' — کارت با border رنگی (نتیجه‌ی رؤیت، هشدارها)
// ============================================================
function Card(props) {
  var variant = props.variant || 'standard';
  var style = [st.base];
  if (variant === 'deep') style.push(st.deep);
  if (variant === 'featured') {
    style.push(st.featured);
    if (props.accentColor) style.push({ borderColor: props.accentColor });
  }
  if (props.style) style.push(props.style);

  return React.createElement(View, { style: style }, props.children);
}

var st = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  deep: {
    backgroundColor: theme.colors.bgCardDeep,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  featured: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    borderWidth: 2,
    ...theme.shadow.card,
  },
});

module.exports = Card;
