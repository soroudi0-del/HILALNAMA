import React from 'react';
import { View, StyleSheet } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var MoonCalculator = require('../calculations/moonPosition');

// ============================================================
// SummaryPanel — SECTION 1 سند طراحی.
//
// Sunset / Moonset / Lag Time / Best Time / Moon Age / Illumination
// / Yallop / Odeh / Visibility Class / Current Observation Status.
// همه از fullData (خروجی مستقیم getFullMoonData) خوانده می‌شوند —
// این کامپوننت هیچ محاسبه‌ای انجام نمی‌دهد.
// ============================================================

export default function SummaryPanel(props) {
  var fullData = props.fullData;
  var city = props.city;
  var t = props.t;
  var crit = props.crit || 'yallop';

  var fmtTime = function (d) {
    if (!d || !city) return '--:--';
    return MoonCalculator.formatTime(d, city.lat, city.lon);
  };

  if (!fullData) return null;

  var cat = MoonCalculator.getCatForCrit(fullData, crit);
  var catColor = theme.getCatColor(cat, crit);

  return (
    <View style={st.grid}>
      <Cell label={t('sunset')} value={fmtTime(fullData.sunSet)} />
      <Cell label={t('saMoonset')} value={fmtTime(fullData.moonSet)} />
      <Cell label={t('lagTimeLabel')} value={MoonCalculator.formatDuration(fullData.lagTime)} />
      <Cell label={t('saBestTime')} value={fmtTime(fullData.bestTime)} highlight />
      <Cell label={t('moonAgeLabel')} value={MoonCalculator.formatAge(fullData.moonAge)} />
      <Cell label={t('illumination')} value={fullData.illuminationPercent ? fullData.illuminationPercent.toFixed(2) + '%' : '---'} />
      <Cell label="Yallop" value={fullData.yallopCat || '---'} valueColor={theme.getCatColor(fullData.yallopCat, 'yallop')} />
      <Cell label="Odeh" value={fullData.odehCat || '---'} valueColor={theme.getCatColor(fullData.odehCat, 'odeh')} />
      <Cell label={t('saVisibilityClass')} value={cat || '---'} valueColor={catColor} wide />
    </View>
  );
}

function Cell(p) {
  return (
    <View style={[st.cell, p.wide && st.cellWide]}>
      <Text style={[st.value, p.highlight && { color: theme.colors.gold }, p.valueColor && { color: p.valueColor }]}>{p.value}</Text>
      <Text style={st.label}>{p.label}</Text>
    </View>
  );
}

var st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  cell: { flexBasis: '30%', flexGrow: 1, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, padding: theme.spacing.md - 2, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  cellWide: { flexBasis: '100%' },
  value: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: 'bold' },
  label: { color: theme.colors.textMuted, fontSize: 10, marginTop: 3, textAlign: 'center' },
});
