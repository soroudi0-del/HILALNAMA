var React = require('react');
var TouchableOpacity = require('react-native').TouchableOpacity;
var View = require('react-native').View;
var Text = require('./ScaledText');
var StyleSheet = require('react-native').StyleSheet;
var theme = require('./theme');

// جایگزین دکمه‌های چهارگانه‌ی dayBtn در HomeScreen
function DayCard(props) {
  var active = props.active;
  return React.createElement(
    TouchableOpacity,
    {
      style: [st.base, active && st.active], onPress: props.onPress,
      accessibilityRole: 'button',
      accessibilityState: { selected: !!active },
      accessibilityLabel: [props.label, props.weekDay, props.dateStr].filter(Boolean).join(' '),
    },
    React.createElement(Text, { style: [st.label, active && st.activeText] }, props.label),
    React.createElement(Text, { style: [st.sub, active && st.activeSub] }, props.weekDay),
    React.createElement(Text, { style: [st.sub, active && st.activeSub] }, props.dateStr)
  );
}

var st = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.sm + 1,
    padding: theme.spacing.sm - 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  label: { color: theme.colors.textSecondary, fontSize: 9, fontWeight: '600' },
  sub: { color: theme.colors.textMuted, fontSize: 8, marginTop: 1 },
  activeText: { color: theme.colors.goldDark },
  activeSub: { color: theme.colors.goldDark },
});

module.exports = DayCard;
