var React = require('react');
var Text = require('./ScaledText');
var StyleSheet = require('react-native').StyleSheet;
var theme = require('./theme');

// جایگزین cardTitle تکرارشونده در همه صفحات
function SectionTitle(props) {
  var textAlign = props.isRTL ? 'right' : 'left';
  return React.createElement(Text, { style: [st.title, { textAlign: textAlign }, props.style] }, props.children);
}

var st = StyleSheet.create({
  title: {
    color: theme.colors.gold,
    fontSize: theme.type.subtitle.fontSize,
    fontWeight: theme.type.subtitle.fontWeight,
    marginBottom: theme.spacing.md,
  },
});

module.exports = SectionTitle;
