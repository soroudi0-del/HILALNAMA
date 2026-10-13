var React = require('react');
var TouchableOpacity = require('react-native').TouchableOpacity;
var Text = require('./ScaledText');
var StyleSheet = require('react-native').StyleSheet;
var theme = require('./theme');

// ============================================================
// Button — جایگزین shareBtn/refreshBtn/moOk/moCancel که هرکدام
// جداگانه با استایل مشابه اما کد تکراری تعریف شده بودند.
//
// variant: 'primary' (طلایی، برای CTA اصلی مثل تأیید)
//          'success'  (سبز، برای اشتراک‌گذاری)
//          'secondary' (خنثی، برای رفرش/لغو)
//          'ghost'    (بدون پس‌زمینه، فقط متن — برای لغو)
// ============================================================
function Button(props) {
  var variant = props.variant || 'secondary';
  var style = [st.base, st[variant + 'Bg']];
  var textStyle = [st.text, st[variant + 'Text']];
  if (props.disabled) style.push(st.disabled);

  return React.createElement(
    TouchableOpacity,
    {
      style: [style, props.style], onPress: props.onPress, disabled: props.disabled,
      accessibilityRole: 'button',
      accessibilityState: { disabled: !!props.disabled },
      accessibilityLabel: props.accessibilityLabel || (typeof props.children === 'string' ? props.children : undefined),
    },
    React.createElement(Text, { style: textStyle }, props.children)
  );
}

var st = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg - 2,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  text: { fontSize: theme.type.subtitle.fontSize, fontWeight: '700' },

  primaryBg: { backgroundColor: theme.colors.gold },
  primaryText: { color: theme.colors.goldDark },

  successBg: {
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  successText: { color: theme.colors.success },

  secondaryBg: { backgroundColor: theme.colors.bgCard },
  secondaryText: { color: theme.colors.gold },

  ghostBg: { backgroundColor: 'transparent', marginBottom: 0 },
  ghostText: { color: theme.colors.textMuted, fontWeight: '500' },

  disabled: { opacity: 0.5 },
});

module.exports = Button;
