import React from 'react';
import { View, StyleSheet } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var Engine = require('../calculations/crescentAnalysisEngine');

// ============================================================
// VisibilityGauge — SECTION 5 سند طراحی.
//
// نوار رنگی علمی با ۵ سطح (Impossible → Very Difficult → Optical
// Aid → Possible → Easy)، با نشانگری که پیوسته با زمان جابه‌جا
// می‌شود. سطوح از Engine.VIS_BANDS می‌آیند تا رنگ/متن/شاخص همیشه
// با منطق visibilityBand در موتور سازگار بماند.
// ============================================================

var BAND_META = {
  impossible: { colorKey: 'danger', icon: '🔴', labelKey: 'saVisImpossible' },
  veryDifficult: { colorKey: 'ember', icon: '🟠', labelKey: 'saVisVeryDifficult' },
  opticalAid: { colorKey: 'warning', icon: '🟡', labelKey: 'saVisOpticalAid' },
  possible: { colorKey: 'catB', icon: '🟢', labelKey: 'saVisPossible' },
  easy: { colorKey: 'success', icon: '🟢', labelKey: 'saVisEasy' },
};

export default function VisibilityGauge(props) {
  var point = props.point;
  var t = props.t;
  var bandIndex = point ? Engine.visibilityBandIndex(point) : -1;
  var bandKey = bandIndex >= 0 ? Engine.VIS_BANDS[bandIndex] : null;
  var meta = bandKey ? BAND_META[bandKey] : null;
  var segCount = Engine.VIS_BANDS.length;

  return (
    <View style={st.wrap}>
      <View style={st.bar}>
        {Engine.VIS_BANDS.map(function (band) {
          var m = BAND_META[band];
          return <View key={band} style={[st.seg, { backgroundColor: theme.colors[m.colorKey] }]} />;
        })}
        {bandIndex >= 0 ? (
          <View style={[st.marker, { left: ((bandIndex + 0.5) / segCount) * 100 + '%' }]}>
            <Text style={st.markerT}>▲</Text>
          </View>
        ) : null}
      </View>
      <View style={st.legendRow}>
        {Engine.VIS_BANDS.map(function (band) {
          var m = BAND_META[band];
          return <Text key={band} style={st.legendT}>{m.icon + ' ' + (t ? t(m.labelKey) : band)}</Text>;
        })}
      </View>
      {meta ? (
        <Text style={[st.currentT, { color: theme.colors[meta.colorKey] }]}>
          {meta.icon + ' ' + (t ? t(meta.labelKey) : bandKey)}
        </Text>
      ) : null}
    </View>
  );
}

var st = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.md },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'visible' },
  seg: { flex: 1, height: 14 },
  marker: { position: 'absolute', top: -14, marginLeft: -6 },
  markerT: { fontSize: 12, color: theme.colors.textPrimary },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 4 },
  legendT: { color: theme.colors.textMuted, fontSize: 9 },
  currentT: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
});
