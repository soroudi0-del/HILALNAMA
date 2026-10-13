import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');

// ============================================================
// ErrorBoundary — v3.5. تا پیش از این هر خطای رندر کل اپ را سفید/بسته
// می‌کرد. اکنون یک صفحه‌ی خطای قابل‌فهم با «تلاش دوباره» نشان می‌دهد.
// (برای گزارش خطای راه‌دور، در componentDidCatch می‌توانید Sentry/Crashlytics وصل کنید.)
// ============================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error && error.message, info && info.componentStack);
  }
  render() {
    var self = this;
    if (!this.state.hasError) return this.props.children;
    return (
      <LP.LanguageContext.Consumer>
        {function (ctx) {
          var t = ctx && ctx.t ? ctx.t : function (k) { return k; };
          return (
            <View style={st.box}>
              <Text style={st.icon}>{'🌙'}</Text>
              <Text style={st.title}>{t('unknownError')}</Text>
              <TouchableOpacity
                style={st.btn}
                accessibilityRole="button"
                onPress={function () { self.setState({ hasError: false }); }}
              >
                <Text style={st.btnT}>{t('retry')}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      </LP.LanguageContext.Consumer>
    );
  }
}

var st = StyleSheet.create({
  box: { flex: 1, backgroundColor: theme.colors.bgPage, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 44, marginBottom: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 15, textAlign: 'center', marginBottom: 18 },
  btn: { backgroundColor: theme.colors.gold, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  btnT: { color: theme.colors.goldDark, fontWeight: '700', fontSize: 14 },
});

export default ErrorBoundary;
