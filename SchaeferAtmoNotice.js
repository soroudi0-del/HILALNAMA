import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;

// ============================================================
// SchaeferAtmoNotice — v3.6. وضعیتِ داده‌ی جوی که مدل Schaefer با آن محاسبه شده است.
// Schaefer بدون AOD/فشار/رطوبتِ واقعی همان لحظه فقط یک «برآورد پیش‌فرض» است؛ این کارت
// همیشه به کاربر می‌گوید کدام حالت برقرار است و اگر داده‌ی آنلاین خاموش است، می‌خواهد روشنش کند.
// props: status ('loading'|'live'|'partial'|'off'|'unavailable'|'outOfRange'), atmosphere,
//        t, isRTL, onEnable
// ابر در مدل Schaefer نیست؛ فقط هشدار جداگانه نشان داده می‌شود (R و رده دست‌نخورده).
// ============================================================
export default function SchaeferAtmoNotice(props) {
  var t = props.t, status = props.status, a = props.atmosphere;
  var textAlign = props.isRTL ? 'right' : 'left';
  if (!status) return null;
  var tone = status === 'live' ? 'ok' : (status === 'loading' ? 'info' : 'warn');
  var msg = '';
  if (status === 'loading') msg = t('schAtmoLoading');
  else if (status === 'live') {
    msg = t('schAtmoLive', {
      aod: typeof a.aod === 'number' ? a.aod.toFixed(2) : '—',
      p: typeof a.pressureHPa === 'number' ? Math.round(a.pressureHPa) : '—',
      h: typeof a.humidity === 'number' ? Math.round(a.humidity) : '—',
    });
  }
  else if (status === 'partial') msg = t('schAtmoPartial');
  else if (status === 'off') msg = t('schAtmoOff');
  else if (status === 'outOfRange') msg = t('schAtmoOutOfRange');
  else msg = t('schAtmoUnavailable');

  var cloudMsg = null;
  if (a && a.cloud && ((typeof a.cloud.total === 'number' && a.cloud.total >= 50) || (typeof a.cloud.low === 'number' && a.cloud.low >= 30))) {
    cloudMsg = t('schAtmoCloud', {
      total: a.cloud.total === null ? '—' : Math.round(a.cloud.total),
      low: a.cloud.low === null ? '—' : Math.round(a.cloud.low),
    });
  }

  return (
    <View style={[st.box, tone === 'ok' && st.boxOk, tone === 'warn' && st.boxWarn]}>
      <Text style={[st.txt, tone === 'ok' && { color: theme.colors.success }, tone === 'warn' && { color: theme.colors.emberLight }, { textAlign: textAlign }]}>
        {(tone === 'ok' ? '☁️ ' : tone === 'warn' ? '⚠️ ' : '⏳ ') + msg}
      </Text>
      {status === 'off' && props.onEnable ? (
        <TouchableOpacity style={st.btn} onPress={props.onEnable} accessibilityRole="button" accessibilityLabel={t('wxEnable')}>
          <Text style={st.btnT}>{t('wxEnable')}</Text>
        </TouchableOpacity>
      ) : null}
      {cloudMsg ? <Text style={[st.cloud, { textAlign: textAlign }]}>{'☁️ ' + cloudMsg}</Text> : null}
    </View>
  );
}

var st = StyleSheet.create({
  box: { marginTop: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgCard },
  boxOk: { borderColor: theme.colors.success },
  boxWarn: { borderColor: theme.colors.ember },
  txt: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, lineHeight: 18 },
  cloud: { color: theme.colors.emberLight, fontSize: theme.type.caption.fontSize, lineHeight: 18, marginTop: 6 },
  btn: { marginTop: 8, backgroundColor: theme.colors.bgCardDeep, borderWidth: 1, borderColor: theme.colors.gold, borderRadius: theme.radius.md, padding: 10, alignItems: 'center' },
  btnT: { color: theme.colors.gold, fontWeight: '700', fontSize: theme.type.label.fontSize },
});
