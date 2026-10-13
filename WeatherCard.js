import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var DataRow = Design.DataRow;
var DateUtils = require('../data/dateUtils');
var Schaefer = require('../calculations/schaeferModel');

// ============================================================
// WeatherCard — v3.5. ابر، دید افقی و ذرات معلق برای شب رصد (Open-Meteo).
// داده‌ی پیش‌بینی است، نه اندازه‌گیری محلی. اگر کاربر فعال نکرده باشد فقط
// دعوت به فعال‌سازی نشان می‌دهد (پیش‌فرض خاموش؛ حریم خصوصی).
// props: enabled, loading, atmosphere, city, lang, tArray, t, isRTL, onEnable
// ============================================================
export default function WeatherCard(props) {
  var t = props.t, a = props.atmosphere, isRTL = props.isRTL;
  var textAlign = isRTL ? 'right' : 'left';
  var nf = function (v, d) { return (v === null || v === undefined || isNaN(v)) ? '---' : v.toFixed(d); };

  var body = null;
  if (!props.enabled) {
    body = (
      <View>
        <Text style={[st.note, { textAlign: textAlign }]}>{t('wxEnablePrompt')}</Text>
        <TouchableOpacity style={st.btn} onPress={props.onEnable} accessibilityRole="button" accessibilityLabel={t('wxEnable')}>
          <Text style={st.btnT}>{t('wxEnable')}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (props.loading) {
    body = <Text style={[st.note, { textAlign: textAlign }]}>{t('rmLoading')}</Text>;
  } else if (!a) {
    body = <Text style={[st.note, { textAlign: textAlign }]}>{t('wxUnavailable')}</Text>;
  } else {
    var when = a.forecastHour || a.airHour || a.when;
    var ext = Schaefer.extinction({
      elevationM: props.city ? props.city.alt : 0, latitudeDeg: props.city ? props.city.lat : 0,
      sunRaDeg: Schaefer.sunRaApproxDeg(when instanceof Date ? when : new Date()), humidityPct: a.humidity, pressureHPa: a.pressureHPa, aod: a.aod,
    });
    body = (
      <View>
        <Text style={[st.sub, { textAlign: textAlign }]}>{t('wxForTime', { time: DateUtils.formatTimeHM(when, props.city.lat, props.city.lon) })}</Text>
        <DataRow label={t('wxCloudTotal')} value={a.cloud.total === null ? '---' : a.cloud.total + '%'} isRTL={isRTL} />
        <DataRow label={t('wxCloudLow')} value={a.cloud.low === null ? '---' : a.cloud.low + '%'} isRTL={isRTL} />
        <DataRow label={t('wxCloudMid')} value={a.cloud.mid === null ? '---' : a.cloud.mid + '%'} isRTL={isRTL} />
        <DataRow label={t('wxCloudHigh')} value={a.cloud.high === null ? '---' : a.cloud.high + '%'} isRTL={isRTL} />
        <DataRow label={t('wxVisibility')} value={a.visibilityKm === null ? '---' : nf(a.visibilityKm, 1) + ' km'} isRTL={isRTL} />
        <DataRow label={t('wxAod')} value={nf(a.aod, 3)} isRTL={isRTL} />
        <DataRow label={t('wxDust')} value={a.dust === null ? '---' : nf(a.dust, 0) + ' µg/m³'} isRTL={isRTL} />
        <DataRow label={t('wxHumidity')} value={a.humidity === null ? '---' : Math.round(a.humidity) + '%'} isRTL={isRTL} />
        <DataRow label={t('wxPressure')} value={a.pressureHPa === null ? '---' : nf(a.pressureHPa, 0) + ' hPa'} isRTL={isRTL} />
        <DataRow label={t('wxTemp')} value={a.tempC === null ? '---' : nf(a.tempC, 1) + ' °C'} isRTL={isRTL} />
        <DataRow label={t('skModelK')} value={nf(ext.k, 3)} isRTL={isRTL} note={t(ext.kASource === 'aod' ? 'skKMeasured' : 'skKDefault')} />
        {a.cloud.low !== null && a.cloud.low >= 60 ? <Text style={[st.warn, { textAlign: textAlign }]}>{t('wxLowCloudWarn')}</Text> : null}
        {a.aod !== null && a.aod >= 0.5 ? <Text style={[st.warn, { textAlign: textAlign }]}>{t('wxHighAod')}</Text> : null}
        <Text style={[st.note, { textAlign: textAlign }]}>{t('wxSource')}</Text>
      </View>
    );
  }
  return (
    <View style={st.wrap}>
      <Text style={[st.title, { textAlign: textAlign }]}>{'☁️ ' + t('wxTitle')}</Text>
      {body}
    </View>
  );
}

var st = StyleSheet.create({
  wrap: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg },
  title: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight, marginBottom: theme.spacing.sm },
  sub: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, marginBottom: 4 },
  note: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, lineHeight: 16, marginTop: theme.spacing.sm },
  warn: { color: theme.colors.emberLight, fontSize: theme.type.caption.fontSize, lineHeight: 17, marginTop: theme.spacing.sm },
  btn: { marginTop: theme.spacing.md, backgroundColor: theme.colors.bgCardDeep, borderWidth: 1, borderColor: theme.colors.gold, borderRadius: theme.radius.md, padding: 12, alignItems: 'center' },
  btnT: { color: theme.colors.gold, fontWeight: '700', fontSize: theme.type.label.fontSize },
});
