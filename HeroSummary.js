import React from 'react';
import { View, StyleSheet } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var CrescentBadge = Design.CrescentBadge;
var MoonCalculator = require('../calculations/moonPosition');
var Engine = require('../calculations/crescentAnalysisEngine');

// ============================================================
// HeroSummary — جایگزین ترکیب قبلی SummaryPanel (گرید ۹خانه‌ای
// مسطح) + VisibilityGauge به‌عنوان دو بلوک جدا با فاصله‌ی زیاد.
//
// اصلاحیه (بعد از دریافت فایل‌های واقعی design/): نسخه‌ی اول این
// فایل رنگ‌های hex دستی و theme tokens فرضی استفاده می‌کرد چون
// theme.js واقعی هنوز دیده نشده بود. این نسخه اصلاح شده تا:
//   - رنگ رده‌ها فقط از theme.getCatColor(cat, crit) بیاید (نه
//     رنگ خام)، چون این تابع طبق تاریخچه‌ی خودِ theme.js مشکل
//     «قاطی شدن سبزها»ی نسخه‌ی قبلی را حل کرده است.
//   - به‌جای فقط حرف رده («C»)، معنی واقعی آن از
//     MoonCalculator.getCatTextKey(cat, crit) + t(key) خوانده شود
//     — نسخه‌ی قدیمی حرف تنها را بدون توضیح نشان می‌داد که برای
//     مخاطب حرفه‌ای هم کم‌فایده است (حرف کدام معیار؟ یعنی چی؟).
//   - MoonCalculator.formatTimeHM (نه formatTime) برای زمان‌های
//     درشتِ Hero استفاده شود، چون formatTime ثانیه هم برمی‌گرداند
//     (HH:mm:ss) که برای نمایش بزرگ در بالای صفحه شلوغ است.
//   - CrescentBadge (المان امضادار سیستم طراحی) برای نمایش رده‌ی
//     اصلی معیار انتخابی به‌کار رود، به‌جای یک متن ساده — این‌جا
//     دقیقاً همان‌جایی است که CrescentBadge برایش طراحی شده بود.
//
// props: fullData, city, crit, cursorPoint, t
// ============================================================

var BAND_META = {
  impossible: { colorKey: 'danger', icon: '🔴', labelKey: 'saVisImpossible' },
  veryDifficult: { colorKey: 'ember', icon: '🟠', labelKey: 'saVisVeryDifficult' },
  opticalAid: { colorKey: 'warning', icon: '🟡', labelKey: 'saVisOpticalAid' },
  possible: { colorKey: 'catB', icon: '🟢', labelKey: 'saVisPossible' },
  easy: { colorKey: 'success', icon: '🟢', labelKey: 'saVisEasy' },
};

export default function HeroSummary(props) {
  var fullData = props.fullData;
  var city = props.city;
  var t = props.t;
  var crit = props.crit || 'yallop';
  var cursorPoint = props.cursorPoint;

  var fmtTime = function (d) {
    if (!d || !city) return '--:--';
    return MoonCalculator.formatTimeHM(d, city.lat, city.lon);
  };

  if (!fullData) return null;

  var cat = MoonCalculator.getCatForCrit(fullData, crit);
  var catColor = theme.getCatColor(cat, crit);
  var catTextKey = MoonCalculator.getCatTextKey(cat, crit);

  var bandIndex = cursorPoint ? Engine.visibilityBandIndex(cursorPoint) : -1;
  var bandKey = bandIndex >= 0 ? Engine.VIS_BANDS[bandIndex] : null;
  var meta = bandKey ? BAND_META[bandKey] : null;
  var segCount = Engine.VIS_BANDS.length;

  return (
    <View style={st.wrap}>
      <View style={st.topRow}>
        {CrescentBadge ? <CrescentBadge cat={cat} crit={crit} size={52} /> : null}
        <View style={st.timeRow}>
          <TimeCell label={t('sunset')} value={fmtTime(fullData.sunSet)} />
          <TimeCell label={t('saBestTime')} value={fmtTime(fullData.bestTime)} highlight />
          <TimeCell label={t('saMoonset')} value={fmtTime(fullData.moonSet)} />
        </View>
      </View>

      <View style={st.gaugeBar}>
        {Engine.VIS_BANDS.map(function (band) {
          var m = BAND_META[band];
          return <View key={band} style={[st.gaugeSeg, { backgroundColor: theme.colors[m.colorKey] }]} />;
        })}
        {bandIndex >= 0 ? (
          <View style={[st.marker, { left: ((bandIndex + 0.5) / segCount) * 100 + '%' }]}>
            <Text style={st.markerT}>▲</Text>
          </View>
        ) : null}
      </View>

      <View style={st.statusRow}>
        {meta ? (
          <Text style={[st.statusT, { color: theme.colors[meta.colorKey] }]}>
            {meta.icon + ' ' + t(meta.labelKey)}
          </Text>
        ) : (
          <Text style={[st.statusT, { color: catColor }]}>{cat || '---'}</Text>
        )}
        <Text style={st.lagT}>{t('lagTimeLabel') + ' ' + MoonCalculator.formatDuration(fullData.lagTime)}</Text>
      </View>

      <View style={[st.catExplainer, { borderColor: catColor }]}>
        <Text style={[st.catExplainerCat, { color: catColor }]}>{(crit ? crit.charAt(0).toUpperCase() + crit.slice(1) : 'Yallop') + ' ' + (cat || '---')}</Text>
        <Text style={st.catExplainerT}>{t(catTextKey)}</Text>
      </View>

      <View style={st.indicatorRow}>
        <IndicatorCell
          label="Odeh"
          value={fullData.odehCat || '---'}
          color={theme.getCatColor(fullData.odehCat, 'odeh')}
        />
        <IndicatorCell
          label={t('illumination')}
          value={fullData.illuminationPercent ? fullData.illuminationPercent.toFixed(1) + '%' : '---'}
        />
        <IndicatorCell
          label={t('moonAgeLabel')}
          value={MoonCalculator.formatAge(fullData.moonAge)}
        />
      </View>
    </View>
  );
}

function TimeCell(p) {
  return (
    <View style={st.timeCell}>
      <Text style={st.timeLabel}>{p.label}</Text>
      <Text style={[st.timeValue, p.highlight && { color: theme.colors.gold }]}>{p.value}</Text>
    </View>
  );
}

function IndicatorCell(p) {
  return (
    <View style={st.indicatorCell}>
      <Text style={[st.indicatorValue, p.color && { color: p.color }]}>{p.value}</Text>
      <Text style={st.indicatorLabel}>{p.label}</Text>
    </View>
  );
}

var st = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  timeRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  timeCell: { alignItems: 'center', flex: 1 },
  timeLabel: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, marginBottom: 3 },
  timeValue: { color: theme.colors.textPrimary, fontSize: theme.type.title.fontSize, fontWeight: theme.type.title.fontWeight },

  gaugeBar: { flexDirection: 'row', height: 10, borderRadius: theme.radius.sm - 2, overflow: 'visible', marginBottom: 6 },
  gaugeSeg: { flex: 1, height: 10 },
  marker: { position: 'absolute', top: -13, marginLeft: -6 },
  markerT: { fontSize: 11, color: theme.colors.textPrimary },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: theme.spacing.md },
  statusT: { fontSize: theme.type.label.fontSize, fontWeight: '700' },
  lagT: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize },

  catExplainer: { borderWidth: 1, borderRadius: theme.radius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md },
  catExplainerCat: { fontSize: theme.type.label.fontSize, fontWeight: '700', marginBottom: 2 },
  catExplainerT: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, lineHeight: 18 },

  indicatorRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, paddingTop: theme.spacing.md, gap: 8 },
  indicatorCell: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.bgCardDeep, borderRadius: theme.radius.sm, paddingVertical: 8 },
  indicatorValue: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: '700' },
  indicatorLabel: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, marginTop: 3 },
});