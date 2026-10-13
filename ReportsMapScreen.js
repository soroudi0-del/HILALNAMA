import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Dimensions } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
var RNSvg = require('react-native-svg');
var Svg = RNSvg.Svg;
var Path = RNSvg.Path;
var Circle = RNSvg.Circle;
var Line = RNSvg.Line;
var G = RNSvg.G;

var SightingReports = require('../firebase/sightingReports');
var Analysis = require('../calculations/reportAnalysis');
var MoonCalculator = require('../calculations/moonPosition');
var DateUtils = require('../data/dateUtils');
var worldCountries = require('../data/worldCountries.json');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ============================================================
// ReportsMapScreen — v3.5.
//
// گزارش‌های رصد کاربران را روی نقشه نشان می‌دهد و «پیش‌بینی» معیارها را با
// «نتیجه‌ی واقعی» مقایسه می‌کند. این همان ارزش علمی اصلی داده‌هایی است که
// جمع می‌شود (اعتبارسنجی معیارها با رصدهای واقعی).
//
//  • رنگ پرکننده‌ی هر نقطه = نتیجه‌ی رصد؛ رنگ حلقه = سطح پیش‌بینی معیار.
//  • پیش‌بینی هر گزارش از روی مختصات/زمان خودش «دوباره» محاسبه می‌شود
//    (نه snapshot ذخیره‌شده) تا باگ روزِ اشتباه نسخه‌ی ۳٫۰٫۲ اثر نگذارد.
//  • آمار پیش‌فرض فقط آسمان صاف را می‌شمارد: «دیده نشد» زیر ابر، درباره‌ی
//    هندسه‌ی پیش‌بینی چیزی نمی‌گوید.
//  • این نمونه‌ی خودگزارشی است، نه مطالعه‌ی کنترل‌شده؛ تفسیر با احتیاط.
// ============================================================

var PAGE = 500;
var MAX_PAGES = 4;
var PRED_CHUNK = 40;
var SMALL_SAMPLE = 30;
var SCREEN_W = Dimensions.get('window').width;

var REGIONS = [
  { id: 'world', key: 'rmRegWorld', lon: [-180, 180], lat: [-60, 80] },
  { id: 'middleEast', key: 'rmRegMiddleEast', lon: [20, 75], lat: [0, 45] },
  { id: 'europe', key: 'rmRegEurope', lon: [-15, 45], lat: [30, 62] },
  { id: 'southAsia', key: 'rmRegAsia', lon: [60, 140], lat: [-12, 42] },
  { id: 'africa', key: 'rmRegAfrica', lon: [-20, 55], lat: [-36, 38] },
  { id: 'americas', key: 'rmRegAmericas', lon: [-130, -30], lat: [-40, 58] },
];
var CRIT_LABELS = { yallop: 'Yallop', odeh: 'Odeh', saao: 'SAAO', ilyas: 'Ilyas', malaysia: 'MABIMS', soroudi: 'Soroudi ★' };

var RESULT_FILL = {
  seen_naked_eye: theme.colors.success,
  seen_optical: '#5B9BD5',
  not_seen: theme.colors.danger,
};
var LEVEL_RING = { naked: theme.colors.gold, aided: theme.colors.ember, none: theme.colors.textMuted };

function countryPath(polygons, toX, toY, lonMin, lonMax) {
  var d = '';
  for (var pi = 0; pi < polygons.length; pi++) {
    var rings = polygons[pi];
    for (var ri = 0; ri < rings.length; ri++) {
      var ring = rings[ri];
      if (ring.length < 2) continue;
      for (var i = 0; i < ring.length; i++) {
        d += (i === 0 ? 'M' : 'L') + toX(ring[i][0]).toFixed(1) + ',' + toY(ring[i][1]).toFixed(1) + ' ';
      }
      d += 'Z ';
    }
  }
  return d;
}

function pct(v) { return v === null || v === undefined ? '—' : Math.round(v * 100) + '%'; }

export default function ReportsMapScreen() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var tArray = LCtx.tArray;
  var isRTL = LCtx.isRTL;
  var lang = LCtx.lang;
  var textAlign = isRTL ? 'right' : 'left';

  var s1 = useState([]); var months = s1[0]; var setMonths = s1[1];
  var s2 = useState(null); var monthKey = s2[0]; var setMonthKey = s2[1];
  var s3 = useState([]); var reports = s3[0]; var setReports = s3[1];
  var s4 = useState('yallop'); var crit = s4[0]; var setCrit = s4[1];
  var s5 = useState(true); var clearOnly = s5[0]; var setClearOnly = s5[1];
  var s6 = useState('world'); var regionId = s6[0]; var setRegionId = s6[1];
  var s7 = useState(null); var selectedId = s7[0]; var setSelectedId = s7[1];
  var s8 = useState(true); var loading = s8[0]; var setLoading = s8[1];
  var s9 = useState({ done: 0, total: 0 }); var progress = s9[0]; var setProgress = s9[1];
  var runId = useRef(0);

  // ---- ماه‌های موجود
  useEffect(function () {
    var alive = true;
    SightingReports.getAvailableMonths().then(function (list) {
      if (!alive) return;
      setMonths(list);
      if (list.length > 0) setMonthKey(list[0].hijriMonthKey); else setLoading(false);
    });
    return function () { alive = false; };
  }, []);

  // ---- بارگذاری گزارش‌ها + محاسبه‌ی پیش‌بینی (تکه‌تکه تا UI قفل نشود)
  useEffect(function () {
    if (!monthKey) return;
    var my = ++runId.current;
    setLoading(true);
    setReports([]);
    setSelectedId(null);
    (async function () {
      var all = [];
      for (var p = 0; p < MAX_PAGES; p++) {
        var page = await SightingReports.searchReports({ hijriMonthKey: monthKey, limit: PAGE, offset: p * PAGE });
        if (my !== runId.current) return;
        all = all.concat(page);
        if (page.length < PAGE) break;
      }
      setProgress({ done: 0, total: all.length });
      var out = [];
      for (var i = 0; i < all.length; i += PRED_CHUNK) {
        var slice = all.slice(i, i + PRED_CHUNK).map(function (r) {
          return Object.assign({}, r, { prediction: Analysis.recomputePrediction(r) });
        });
        out = out.concat(slice);
        if (my !== runId.current) return;
        setProgress({ done: Math.min(i + PRED_CHUNK, all.length), total: all.length });
        await new Promise(function (res) { setTimeout(res, 0); });
      }
      if (my !== runId.current) return;
      setReports(out);
      setLoading(false);
    })().catch(function (e) {
      console.warn('ReportsMap: load failed', e && e.message);
      if (my === runId.current) setLoading(false);
    });
  }, [monthKey]);

  var stats = useMemo(function () { return Analysis.summarize(reports, { crit: crit, clearOnly: clearOnly }); }, [reports, crit, clearOnly]);

  // ---- هندسه‌ی نقشه
  var region = REGIONS.filter(function (r) { return r.id === regionId; })[0];
  var mapW = Math.min(SCREEN_W, 600) - theme.spacing.lg * 2;
  var lonSpan = region.lon[1] - region.lon[0], latSpan = region.lat[1] - region.lat[0];
  var mapH = Math.max(170, Math.min(430, Math.round(mapW * (latSpan / lonSpan))));
  var toX = function (lon) { return ((lon - region.lon[0]) / lonSpan) * mapW; };
  var toY = function (lat) { return ((region.lat[1] - lat) / latSpan) * mapH; };

  var countryPaths = useMemo(function () {
    return worldCountries.map(function (c) { return countryPath(c.p, toX, toY); });
  }, [regionId, mapW, mapH]);

  var mappable = reports.filter(function (r) {
    return r.latitude !== null && r.latitude !== undefined && r.longitude !== null && r.longitude !== undefined
      && Analysis.observedLevel(r.sightingResult) !== null
      && r.longitude >= region.lon[0] && r.longitude <= region.lon[1] && r.latitude >= region.lat[0] && r.latitude <= region.lat[1];
  });
  var selected = reports.filter(function (r) { return r.id === selectedId; })[0] || null;
  var gridLats = []; for (var la = Math.ceil(region.lat[0] / 20) * 20; la <= region.lat[1]; la += 20) gridLats.push(la);
  var gridLons = []; for (var lo = Math.ceil(region.lon[0] / 30) * 30; lo <= region.lon[1]; lo += 30) gridLons.push(lo);

  var resultLabel = function (r) { return t(SightingReports.getSightingResultLabelKey(r.sightingResult)); };
  var levelLabel = function (lvl) { return lvl === 'naked' ? t('rmLevelNaked') : (lvl === 'aided' ? t('rmLevelAided') : (lvl === 'none' ? t('rmLevelNone') : '—')); };

  return (
    <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.header}>
        <Text style={st.hIcon}>{'🗺️'}</Text>
        <Text style={st.hTitle} accessibilityRole="header">{t('rmTitle')}</Text>
        <Text style={st.hSub}>{t('rmSub')}</Text>
      </LinearGradient>

      <View style={st.body}>
        {/* ماه */}
        <Text style={[st.label, { textAlign: textAlign }]}>{t('rmMonth')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {months.slice(0, 12).map(function (m) {
            var active = m.hijriMonthKey === monthKey;
            var name = (tArray('hijriMonths')[(m.monthIndex - 1 + 12) % 12] || m.monthIndex) + ' ' + m.year;
            return (
              <TouchableOpacity key={m.hijriMonthKey} style={[st.chip, active && st.chipActive]} onPress={function () { setMonthKey(m.hijriMonthKey); }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[st.chipT, active && st.chipTActive]}>{name + ' (' + m.count + ')'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* معیار */}
        <Text style={[st.label, { textAlign: textAlign }]}>{t('rmCriterion')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {Analysis.CRITERIA.filter(function (c) { return c !== 'schaefer'; }).map(function (c) {
            var active = c === crit;
            return (
              <TouchableOpacity key={c} style={[st.chip, active && st.chipActive]} onPress={function () { setCrit(c); }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[st.chipT, active && st.chipTActive]}>{CRIT_LABELS[c]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* آسمان صاف */}
        <View style={st.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[st.switchT, { textAlign: textAlign }]}>{t('rmClearOnly')}</Text>
            <Text style={[st.hint, { textAlign: textAlign }]}>{t('rmClearOnlyHint')}</Text>
          </View>
          <Switch value={clearOnly} onValueChange={setClearOnly} trackColor={{ false: theme.colors.border, true: theme.colors.gold }} thumbColor={theme.colors.textPrimary} accessibilityLabel={t('rmClearOnly')} />
        </View>

        {/* ناحیه */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {REGIONS.map(function (r) {
            var active = r.id === regionId;
            return (
              <TouchableOpacity key={r.id} style={[st.chip, active && st.chipActive]} onPress={function () { setRegionId(r.id); }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[st.chipT, active && st.chipTActive]}>{t(r.key)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* نقشه */}
        <View style={[st.mapBox, { width: mapW, height: mapH }]}>
          <Svg width={mapW} height={mapH} viewBox={'0 0 ' + mapW + ' ' + mapH}>
            {gridLats.map(function (v) { return <Line key={'gy' + v} x1={0} y1={toY(v)} x2={mapW} y2={toY(v)} stroke={theme.mapColors.gridLine} strokeWidth={0.5} />; })}
            {gridLons.map(function (v) { return <Line key={'gx' + v} x1={toX(v)} y1={0} x2={toX(v)} y2={mapH} stroke={theme.mapColors.gridLine} strokeWidth={0.5} />; })}
            {countryPaths.map(function (d, i) { return <Path key={'c' + i} d={d} fill="none" stroke={theme.mapColors.coastLine} strokeWidth={0.6} />; })}
            {mappable.map(function (r) {
              var agr = Analysis.agreementOf(r, crit, r.prediction);
              var lvl = Analysis.predictionLevel(crit, Analysis.predictedCat(r, crit, r.prediction));
              var big = agr === 'surprise' || agr === 'miss';
              var isSel = r.id === selectedId;
              return (
                <G key={r.id}>
                  <Circle
                    cx={toX(r.longitude)} cy={toY(r.latitude)} r={big ? 7 : 5}
                    fill={RESULT_FILL[r.sightingResult] || theme.colors.textMuted} fillOpacity={0.85}
                    stroke={isSel ? theme.colors.textPrimary : (lvl ? LEVEL_RING[lvl] : theme.colors.border)} strokeWidth={isSel ? 2.5 : 1.8}
                    onPress={function () { setSelectedId(r.id); }}
                  />
                </G>
              );
            })}
          </Svg>
        </View>

        {/* راهنما */}
        <View style={st.legend}>
          <LegendDot color={RESULT_FILL.seen_naked_eye} label={t('rmLegendSeenNaked')} />
          <LegendDot color={RESULT_FILL.seen_optical} label={t('rmLegendSeenAided')} />
          <LegendDot color={RESULT_FILL.not_seen} label={t('rmLegendNotSeen')} />
        </View>
        <Text style={[st.hint, { textAlign: textAlign }]}>{t('rmLegendRing')}</Text>

        {loading ? (
          <View style={st.loadBox}>
            <ActivityIndicator color={theme.colors.gold} />
            <Text style={st.hint}>{progress.total > 0 ? t('rmLoadingPredictions', { n: String(progress.done), m: String(progress.total) }) : t('rmLoading')}</Text>
          </View>
        ) : null}
        {!loading && reports.length === 0 ? <Text style={st.empty}>{t('rmNoReports')}</Text> : null}

        {/* گزارش انتخاب‌شده (بدون نام و ایمیل) */}
        {selected ? (
          <View style={st.card}>
            <Text style={[st.cardTitle, { textAlign: textAlign }]}>{t('rmSelected')}</Text>
            <Row l={t('rmPlace')} v={[selected.city, selected.country].filter(Boolean).join(' — ') || '—'} />
            <Row l={t('rmWhen')} v={selected.sightingDateISO ? DateUtils.formatCivilDate(new Date(selected.sightingDateISO), lang, selected.latitude, selected.longitude, tArray('gregorianMonths')) + '  ' + DateUtils.formatTimeHM(new Date(selected.sightingDateISO), selected.latitude, selected.longitude) : '—'} />
            <Row l={t('rmResult')} v={resultLabel(selected)} color={RESULT_FILL[selected.sightingResult]} />
            {selected.cloudPercent !== null && selected.cloudPercent !== undefined ? <Row l={t('cloudPercentTitle')} v={selected.cloudPercent + '%'} /> : null}
            {Analysis.CRITERIA.filter(function (c) { return c !== 'schaefer'; }).map(function (c) {
              var cat = Analysis.predictedCat(selected, c, selected.prediction);
              return <Row key={c} l={t('rmPredictedBy') + ' ' + CRIT_LABELS[c]} v={(cat || '—') + '  (' + levelLabel(Analysis.predictionLevel(c, cat)) + ')'} color={cat ? theme.getCatColor(cat, c) : null} />;
            })}
            <Row l={t('rmAgreement')} v={t('rmAgr_' + Analysis.agreementOf(selected, crit, selected.prediction))} />
          </View>
        ) : null}

        {/* آمار */}
        {!loading && reports.length > 0 ? (
          <View style={st.card}>
            <Text style={[st.cardTitle, { textAlign: textAlign }]}>{t('rmStats') + ' — ' + CRIT_LABELS[crit]}</Text>
            <Row l={t('rmTotal')} v={String(stats.total)} />
            <Row l={t('rmAttempted')} v={String(stats.attempted)} />
            <Row l={t('rmLegendSeenNaked')} v={String(stats.seenNaked)} />
            <Row l={t('rmLegendSeenAided')} v={String(stats.seenAided)} />
            <Row l={t('rmLegendNotSeen')} v={String(stats.notSeen)} />
            <Row l={t('rmExcludedWeather')} v={String(stats.excludedWeather)} />
            <Row l={t('rmNoPrediction')} v={String(stats.noPrediction)} />
            <Row l={t('rmUsable')} v={String(stats.usable)} />

            <Text style={[st.subTitle, { textAlign: textAlign }]}>{t('rmTaskNaked')}</Text>
            <Row l={t('rmAccuracy')} v={pct(stats.nakedRates.accuracy)} />
            <Row l={t('rmPrecision')} v={pct(stats.nakedRates.precision)} />
            <Row l={t('rmRecall')} v={pct(stats.nakedRates.recall)} />
            <Text style={st.matrix}>{'TP ' + stats.naked.tp + '  FP ' + stats.naked.fp + '  FN ' + stats.naked.fn + '  TN ' + stats.naked.tn}</Text>

            <Text style={[st.subTitle, { textAlign: textAlign }]}>{t('rmTaskAny')}</Text>
            <Row l={t('rmAccuracy')} v={pct(stats.anyRates.accuracy)} />
            <Row l={t('rmPrecision')} v={pct(stats.anyRates.precision)} />
            <Row l={t('rmRecall')} v={pct(stats.anyRates.recall)} />
            <Text style={st.matrix}>{'TP ' + stats.any.tp + '  FP ' + stats.any.fp + '  FN ' + stats.any.fn + '  TN ' + stats.any.tn}</Text>

            <Row l={t('rmSurprises')} v={String(stats.surprisesSeenWhenNone)} color={stats.surprisesSeenWhenNone > 0 ? theme.colors.warning : null} />
            <Row l={t('rmMisses')} v={String(stats.missesWhenNaked)} />

            {stats.categories.length > 0 ? (
              <View>
                <Text style={[st.subTitle, { textAlign: textAlign }]}>{t('rmCalibration')}</Text>
                <View style={st.tHead}>
                  <Text style={[st.tc, st.tcH]}>{t('rmCatCol')}</Text>
                  <Text style={[st.tc, st.tcH]}>{t('rmN')}</Text>
                  <Text style={[st.tc, st.tcH]}>{t('rmLegendSeenNaked')}</Text>
                  <Text style={[st.tc, st.tcH]}>{t('rmLegendSeenAided')}</Text>
                  <Text style={[st.tc, st.tcH]}>{t('rmLegendNotSeen')}</Text>
                </View>
                {stats.categories.map(function (c) {
                  return (
                    <View key={c.cat} style={st.tRow}>
                      <Text style={[st.tc, { color: theme.getCatColor(c.cat, crit), fontWeight: '700' }]}>{c.cat}</Text>
                      <Text style={st.tc}>{c.n}</Text>
                      <Text style={st.tc}>{c.seenNaked + ' (' + pct(c.seenNaked / c.n) + ')'}</Text>
                      <Text style={st.tc}>{c.seenAided + ' (' + pct(c.seenAided / c.n) + ')'}</Text>
                      <Text style={st.tc}>{c.notSeen + ' (' + pct(c.notSeen / c.n) + ')'}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {stats.usable < SMALL_SAMPLE ? <Text style={[st.warn, { textAlign: textAlign }]}>{t('rmSmallSample', { n: String(SMALL_SAMPLE) })}</Text> : null}
            <Text style={[st.hint, { textAlign: textAlign }]}>{t('rmCaveat')}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function LegendDot(props) {
  return (
    <View style={st.legendItem}>
      <View style={[st.legendDot, { backgroundColor: props.color }]} />
      <Text style={st.legendT}>{props.label}</Text>
    </View>
  );
}

function Row(props) {
  return (
    <View style={st.row}>
      <Text style={st.rowV}>{props.v}</Text>
      <Text style={st.rowL}>{props.l}</Text>
    </View>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  header: { alignItems: 'center', paddingTop: theme.spacing.xxl + 12, paddingBottom: theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
  hIcon: { fontSize: 30 },
  hTitle: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight, textAlign: 'center', marginTop: 4 },
  hSub: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, textAlign: 'center', marginTop: 4 },
  body: { padding: theme.spacing.lg },
  label: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, marginTop: theme.spacing.md, marginBottom: 6 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgCard },
  chipActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  chipT: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTActive: { color: theme.colors.goldDark },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  switchT: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: '600' },
  hint: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, lineHeight: 16, marginTop: 2 },
  mapBox: { backgroundColor: theme.mapColors.canvasBg, borderRadius: theme.radius.md, overflow: 'hidden', marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, alignSelf: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: theme.spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendT: { color: theme.colors.textSecondary, fontSize: 11 },
  loadBox: { alignItems: 'center', gap: 6, marginTop: theme.spacing.lg },
  empty: { color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.lg, fontSize: theme.type.body.fontSize },
  card: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginTop: theme.spacing.md },
  cardTitle: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight, marginBottom: theme.spacing.sm },
  subTitle: { color: theme.colors.textPrimary, fontSize: theme.type.label.fontSize, fontWeight: '700', marginTop: theme.spacing.md, marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  rowL: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, flex: 1 },
  rowV: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: '600', flex: 1, textAlign: 'left' },
  matrix: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 2 },
  tHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle, paddingBottom: 4, marginTop: 4 },
  tRow: { flexDirection: 'row', paddingVertical: 5 },
  tc: { flex: 1, color: theme.colors.textPrimary, fontSize: 11, textAlign: 'center' },
  tcH: { color: theme.colors.textMuted, fontWeight: '700' },
  warn: { color: theme.colors.warning, fontSize: theme.type.caption.fontSize, lineHeight: 17, marginTop: theme.spacing.md },
});
