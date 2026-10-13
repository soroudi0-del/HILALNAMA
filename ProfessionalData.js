import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var Schaefer = require('../calculations/schaeferModel');

// ============================================================
// ProfessionalData — SECTION 6 سند طراحی (بازطراحی).
//
// چرا این تغییر: کاربر هدف رصدگر حرفه‌ای/نیمه‌حرفه‌ای است، پس داده
// باید از همان ابتدا در دید باشد (نه پشت یک toggle واحد در سطح
// صفحه — آن toggle در CrescentAnalysisScreen حذف شده). اما ۱۸ ردیف
// هم‌شکل پشت‌سرهم برای چشم غیرقابل‌اسکن است؛ راه‌حل «داده‌ی کامل
// بدون پنهان‌کاری» + «گروه‌بندی معنادار قابل جمع‌کردن» است:
//   ۱. هندسه و موقعیت  (Moon/Sun alt، azimuth‌ها، ARCV، elongation…)
//   ۲. معیارهای رؤیت‌پذیری (illumination، Yallop q، Odeh، Danjon، عرض هلال)
//   ۳. شرایط جوی (air mass، refraction، sky brightness، فاصله‌ها)
// هر گروه پیش‌فرض باز است (چون مخاطب حرفه‌ای است و این داده اصلی
// اوست)، ولی هر گروه جدا جمع/باز می‌شود تا وقتی فقط یک بخش لازم
// است، بقیه از راه چشم کنار بروند — بدون این‌که واقعاً محو شوند.
//
// props: point (سمپل لحظه‌ای), fullData (Yallop q / Danjon), t
// ============================================================

function fmtDeg(v, digits) {
  if (v === null || v === undefined || isNaN(v)) return '---';
  return (v >= 0 ? '+' : '') + v.toFixed(digits === undefined ? 2 : digits) + '°';
}
function fmtDegPlain(v, digits) {
  if (v === null || v === undefined || isNaN(v)) return '---';
  return v.toFixed(digits === undefined ? 2 : digits) + '°';
}

var GROUPS = [
  { key: 'geometry', icon: '📐', labelKey: 'saGroupGeometry' },
  { key: 'criteria', icon: '🎯', labelKey: 'saGroupCriteria' },
  { key: 'atmosphere', icon: '🌫️', labelKey: 'saGroupAtmosphere' },
];

export default function ProfessionalData(props) {
  var point = props.point;
  var fullData = props.fullData;
  var atmosphere = props.atmosphere || null;
  var elevationM = props.elevationM || 0;
  var t = props.t;

  var s1 = useState({ geometry: true, criteria: true, atmosphere: true });
  var open = s1[0];
  var setOpen = s1[1];

  if (!point) return null;

  // v3.6: مدل فیزیکی Schaefer روی لحظه‌ی مکان‌نما؛ با داده‌ی واقعی AOD/فشار/رطوبت اگر در دسترس باشد
  var atmModel = null;
  try {
    var wx = atmosphere || {};
    var ext = Schaefer.extinction({
      elevationM: elevationM, latitudeDeg: props.latitude || 0,
      sunRaDeg: Schaefer.sunRaApproxDeg(point.time instanceof Date ? point.time : new Date()),
      humidityPct: wx.humidity, pressureHPa: wx.pressureHPa, aod: wx.aod,
    });
    var ev = Schaefer.crescentR({
      moonAltDeg: point.moonAltitudeAirless, sunAltDeg: point.sunAltitudeAirless,
      phaseAngleDeg: point.phaseAngleDeg, moonDistKm: point.moonDistanceKm,
      atmosphere: ext, pressureHPa: wx.pressureHPa, tempC: wx.tempC,
    });
    atmModel = { ext: ext, ev: ev };
  } catch (e) { atmModel = null; }

  var toggleGroup = function (key) {
    var next = {};
    Object.keys(open).forEach(function (k) { next[k] = open[k]; });
    next[key] = !next[key];
    setOpen(next);
  };

  return (
    <View style={st.wrap}>
      <Group def={GROUPS[0]} t={t} isOpen={open.geometry} onToggle={toggleGroup} count={8}>
        <TR l={t('saLayerMoonAlt')} v={fmtDegPlain(point.moonAltitude, 3)} />
        <TR l={t('saLayerSunAlt')} v={fmtDeg(point.sunAltitude, 3)} />
        <TR l={t('moonAzimuth')} v={fmtDegPlain(point.moonAzimuth, 2)} />
        <TR l={t('sunAzimuth')} v={fmtDegPlain(point.sunAzimuth, 2)} />
        <TR l={t('saRelativeAzimuth')} v={fmtDegPlain(point.relativeAzimuth, 2)} />
        <TR l={t('saLayerArcv')} v={fmtDegPlain(point.arcv, 3)} />
        <TR l={t('saArcl')} v={fmtDegPlain(point.elongationTopo, 3)} />
        <TR l={t('elongationGeo')} v={fmtDegPlain(point.elongationGeo, 3)} />
      </Group>

      <Group def={GROUPS[1]} t={t} isOpen={open.criteria} onToggle={toggleGroup} count={fullData ? 4 + 4 : 4}>
        <TR l={t('illumination')} v={point.illuminationPercent !== null ? point.illuminationPercent.toFixed(3) + '%' : '---'} />
        <TR l={t('saPhaseAngle')} v={fmtDegPlain(point.phaseAngleDeg, 2)} />
        <TR l={t('saParallacticAngle')} v={fmtDegPlain(point.parallacticAngle, 2)} />
        <TR l={t('crescentWidthLabel')} v={point.crescentWidthArcmin !== null ? point.crescentWidthArcmin.toFixed(3) + "'" : '---'} />
        {fullData ? (
          <View>
            <TR l="Yallop q" v={fullData.yallopQ !== null && fullData.yallopQ !== undefined ? fullData.yallopQ.toFixed(4) : '---'} />
            <TR l={t('saOdehCriterion')} v={fullData.odehCat || '---'} />
            <TR l={t('danjonLimit') + ' 👁'} v={fullData.danjonOkNaked ? t('danjonPassed') : t('danjonNotPassed')} />
            <TR l={t('danjonLimit') + ' 🔭'} v={fullData.danjonOkTelescope ? t('danjonPassed') : t('danjonNotPassed')} />
          </View>
        ) : null}
      </Group>

      <Group def={GROUPS[2]} t={t} isOpen={open.atmosphere} onToggle={toggleGroup} count={atmModel ? 14 : 5} last>
        <TR l={t('saAirMass')} v={point.airMassMoon !== null ? point.airMassMoon.toFixed(3) : '---'} />
        <TR l={t('saRefraction')} v={point.refractionArcmin !== null ? point.refractionArcmin.toFixed(2) + "'" : '---'} />
        <TR l={t('saSkyBrightness')} v={point.skyDarkness !== null ? (point.skyDarkness * 100).toFixed(0) + '%' : '---'} />
        <TR l={t('saMoonDistance')} v={point.moonDistanceKm ? point.moonDistanceKm.toFixed(0) + ' km' : '---'} />
        <TR l={t('saSunDistance')} v={point.sunDistanceKm ? (point.sunDistanceKm / 1e6).toFixed(2) + ' Mkm' : '---'} />
        <Text style={st.note}>{t('saSkyBrightnessNote')}</Text>
        {atmModel ? (
          <View>
            <TR l={t('skModelK')} v={atmModel.ext.k.toFixed(3) + '  (' + t(atmModel.ext.kASource === 'aod' ? 'skKMeasured' : 'skKDefault') + ')'} />
            <TR l={t('skKParts')} v={'R ' + atmModel.ext.kR.toFixed(3) + ' + A ' + atmModel.ext.kA.toFixed(3) + ' + O ' + atmModel.ext.kOz.toFixed(3)} />
            {atmModel.ev && atmModel.ev.valid ? (
              <View>
                <TR l={t('skR')} v={(atmModel.ev.R >= 0 ? '+' : '') + atmModel.ev.R.toFixed(2) + '  (' + Schaefer.categoryFromR(atmModel.ev.R) + ')'} />
                <TR l={t('skProb')} v={Math.round(atmModel.ev.probability * 100) + '%'} />
                <TR l={t('skSkyMag')} v={Schaefer.nlToMagArcsec(atmModel.ev.skyNL).toFixed(2) + ' mag/arcsec²'} />
                <TR l={t('skSkyNL')} v={String(Math.round(atmModel.ev.skyNL)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' nL'} />
                <TR l={t('skCrescentNL')} v={String(Math.round(atmModel.ev.crescentSurfaceNL)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                <TR l={t('skWidth')} v={atmModel.ev.crescentWidthArcmin.toFixed(3) + "'"} />
                <TR l={t('skTheta')} v={atmModel.ev.criticalAngleArcmin.toFixed(2) + "'"} />
              </View>
            ) : (
              <Text style={st.note}>{t('skInvalid')}</Text>
            )}
            <Text style={st.note}>{t('skNote')}</Text>
          </View>
        ) : null}
      </Group>
    </View>
  );
}

function Group(props) {
  var def = props.def;
  var t = props.t;
  var isOpen = props.isOpen;
  var onToggle = props.onToggle;
  var count = props.count;

  return (
    <View style={[st.group, props.last && st.groupLast]}>
      <TouchableOpacity style={st.groupHeader} onPress={function () { onToggle(def.key); }} activeOpacity={0.7}>
        <Text style={st.groupIcon}>{def.icon}</Text>
        <Text style={st.groupTitle}>{t(def.labelKey)}</Text>
        <Text style={st.groupCount}>{count + ' ' + t('saParamCount')}</Text>
        <Text style={st.groupChevron}>{isOpen ? '︿' : '﹀'}</Text>
      </TouchableOpacity>
      {isOpen ? <View style={st.groupBody}>{props.children}</View> : null}
    </View>
  );
}

function TR(p) {
  return (
    <View style={st.tr}>
      <Text style={st.trV}>{p.v}</Text>
      <Text style={st.trL}>{p.l}</Text>
    </View>
  );
}

var st = StyleSheet.create({
  wrap: { borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.border },

  group: { borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  groupLast: { borderBottomWidth: 0 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm + 4, paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  groupIcon: { fontSize: theme.type.subtitle.fontSize },
  groupTitle: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, fontWeight: '600', flex: 1 },
  groupCount: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize },
  groupChevron: { color: theme.colors.textMuted, fontSize: theme.type.label.fontSize, marginLeft: 4 },
  groupBody: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm + 2 },

  tr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  trL: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, flex: 1 },
  trV: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: theme.type.body.fontWeight, flex: 1, textAlign: 'left' },
  note: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, fontStyle: 'italic', lineHeight: 16, marginTop: theme.spacing.sm - 2 },
});