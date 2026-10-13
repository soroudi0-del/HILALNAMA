import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share, Dimensions } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
var RNSvg = require('react-native-svg');
var Svg = RNSvg.Svg;
var Path = RNSvg.Path;
var Circle = RNSvg.Circle;
var G = RNSvg.G;
var Line = RNSvg.Line;
var Rect = RNSvg.Rect;
var SvgText = RNSvg.Text;

var moment = require('moment-timezone');
var Engine = require('../calculations/moonNowEngine');
var UserSettings = require('../data/userSettings');
var DateUtils = require('../data/dateUtils');
var Design = require('../design');
var theme = Design.theme;
var DataRow = Design.DataRow;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ============================================================
// MoonNowScreen — v3.5 (نسخه‌ی تفصیلی و لحظه‌ای).
//
// داشبورد زنده‌ی ماه: مقادیر سریع هر ثانیه، رویدادها هر ۳۰ ثانیه (یا همین‌که
// یک رویداد گذشت) به‌روز می‌شوند. همه‌ی محاسبات در moonNowEngine.js هستند.
//
// تعاریف:
//   • برج: ۳۰ درجه‌ی «گرمسیری» طول دایره‌البروجی ماه (حمل = ۰°–۳۰°).
//   • صورت فلکی: صورت فلکی IAU؛ به‌دلیل تقدیم اعتدالین با برج گرمسیری فرق دارد.
//   • منزل: ۲۸ قسمت مساوی (۱۲٫۸۵۷°) از ۰° حمل (روش مرسوم).
//   این‌ها فقط موقعیت نجومی‌اند، نه پیش‌گویی.
//   • هندسه‌ی هلال «لحظه‌ای» است؛ رده‌ی رسمی معیارها در Tbest محاسبه می‌شود.
//   • این صفحه هیچ تقویم قمری یا تاریخ هجری نمی‌سازد و ادعایی درباره‌ی آغاز
//     ماه‌های قمری ندارد (آغاز ماه فقط با رؤیت تعیین می‌شود).
// ============================================================

var TICK_MS = 1000;
var SLOW_REFRESH_MS = 30000;
var SCREEN_W = Dimensions.get('window').width;

// ---------------- قرص ماه ----------------
function MoonDisc(props) {
  var size = props.size || 170;
  var r = size / 2 - 6;
  var cx = size / 2, cy = size / 2;
  var path = Engine.litPathRight(props.drawElongation, cx, cy, r);
  var rotation = props.brightLimbPA - 90; // لبه‌ی روشن به‌سمت خورشید
  return (
    <Svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
      <Circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={theme.colors.borderGoldFaint} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={r} fill="#1B1830" stroke={theme.colors.borderGoldSubtle} strokeWidth={1.5} />
      <G transform={'rotate(' + rotation.toFixed(2) + ' ' + cx + ' ' + cy + ')'}>
        <Path d={path} fill={theme.colors.gold} fillOpacity={0.96} />
      </G>
      {/* نشانگر سمت‌الرأس (بالای آسمان) */}
      <Path d={'M ' + cx + ' 0 L ' + (cx - 5) + ' 8 L ' + (cx + 5) + ' 8 Z'} fill={theme.colors.textMuted} />
    </Svg>
  );
}

// ---------------- نمودار ۲۴ ساعته ----------------
function AltitudeChart(props) {
  var chart = props.chart;
  var tz = props.tz;
  var width = Math.max(220, props.width);
  var height = 170;
  var padL = 30, padR = 8, padT = 10, padB = 22;
  var plotW = width - padL - padR;
  var plotH = height - padT - padB;
  var series = chart.series;

  var lo = -30, hi = 30;
  series.forEach(function (p) {
    if (p.moon < lo) lo = p.moon;
    if (p.moon > hi) hi = p.moon;
    if (p.sun < lo) lo = p.sun;
    if (p.sun > hi) hi = p.sun;
  });
  lo = Math.floor(lo / 10) * 10;
  hi = Math.ceil(hi / 10) * 10;

  var x = function (tt) { return padL + ((tt - chart.start) / (chart.end - chart.start)) * plotW; };
  var y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * plotH; };
  var pathOf = function (key) {
    return series.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + x(p.t).toFixed(1) + ' ' + y(p[key]).toFixed(1); }).join(' ');
  };

  // شب (خورشید زیر ۶- درجه) به‌صورت نوار پس‌زمینه
  var nightRects = [];
  var runStart = null;
  series.forEach(function (p, i) {
    var night = p.sun < -6;
    if (night && runStart === null) runStart = p.t;
    if ((!night || i === series.length - 1) && runStart !== null) {
      var endT = night ? p.t : series[i - 1].t;
      nightRects.push({ x1: x(runStart), x2: x(endT) });
      runStart = null;
    }
  });

  // برچسب ساعت‌ها هر ۳ ساعتِ محلی
  var ticks = [];
  series.forEach(function (p) {
    var m = moment(p.t).tz(tz);
    if (m.minutes() === 0 && m.hours() % 3 === 0) ticks.push({ x: x(p.t), label: m.format('HH') });
  });
  var yTicks = [];
  var stepY = (hi - lo) > 100 ? 30 : 20;
  for (var v = lo; v <= hi; v += stepY) yTicks.push(v);

  return (
    <Svg width={width} height={height}>
      {nightRects.map(function (r, i) {
        return <Rect key={'n' + i} x={r.x1} y={padT} width={Math.max(0, r.x2 - r.x1)} height={plotH} fill="#2A2150" fillOpacity={0.55} />;
      })}
      {yTicks.map(function (val) {
        return (
          <G key={'y' + val}>
            <Line x1={padL} y1={y(val)} x2={width - padR} y2={y(val)} stroke={theme.colors.borderSubtle} strokeWidth={0.6} />
            <SvgText x={padL - 4} y={y(val) + 3} fontSize={9} fill={theme.colors.textMuted} textAnchor="end">{val + '°'}</SvgText>
          </G>
        );
      })}
      <Line x1={padL} y1={y(0)} x2={width - padR} y2={y(0)} stroke={theme.colors.textSecondary} strokeWidth={1} strokeDasharray="4,3" />
      {ticks.map(function (tk, i) {
        return (
          <G key={'t' + i}>
            <Line x1={tk.x} y1={padT + plotH} x2={tk.x} y2={padT + plotH + 4} stroke={theme.colors.textMuted} strokeWidth={0.8} />
            <SvgText x={tk.x} y={height - 6} fontSize={9} fill={theme.colors.textMuted} textAnchor="middle">{tk.label}</SvgText>
          </G>
        );
      })}
      <Path d={pathOf('sun')} stroke="#E8934A" strokeWidth={1.8} fill="none" />
      <Path d={pathOf('moon')} stroke={theme.colors.gold} strokeWidth={2.4} fill="none" />
      <Line x1={x(chart.now)} y1={padT} x2={x(chart.now)} y2={padT + plotH} stroke={theme.colors.textPrimary} strokeWidth={1.2} />
    </Svg>
  );
}

// ---------------- گروه قابل جمع‌شدن ----------------
function Group(props) {
  var s1 = useState(props.defaultOpen !== false);
  var open = s1[0];
  var setOpen = s1[1];
  return (
    <View style={st.group}>
      <TouchableOpacity
        style={st.groupHeader}
        onPress={function () { setOpen(!open); }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={props.title}
      >
        <Text style={st.groupIcon}>{props.icon}</Text>
        <Text style={st.groupTitle}>{props.title}</Text>
        <Text style={st.groupChevron}>{open ? '︿' : '﹀'}</Text>
      </TouchableOpacity>
      {open ? <View style={st.groupBody}>{props.children}</View> : null}
    </View>
  );
}

function Tile(props) {
  return (
    <View style={st.tile}>
      <Text style={st.tileValue}>{props.value}</Text>
      <Text style={st.tileSub}>{props.sub || ' '}</Text>
      <Text style={st.tileLabel}>{props.label}</Text>
    </View>
  );
}

export default function MoonNowScreen() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var tArray = LCtx.tArray;
  var isRTL = LCtx.isRTL;
  var lang = LCtx.lang;
  var textAlign = isRTL ? 'right' : 'left';

  var s1 = useState(null); var city = s1[0]; var setCity = s1[1];
  var s2 = useState(null); var fast = s2[0]; var setFast = s2[1];
  var s3 = useState(null); var slow = s3[0]; var setSlow = s3[1];
  var s4 = useState(false); var noCity = s4[0]; var setNoCity = s4[1];

  var cityRef = useRef(null);
  var slowRef = useRef(null);
  var timer = useRef(null);

  var tick = useCallback(function () {
    var c = cityRef.current;
    if (!c) return;
    var n = new Date();
    try {
      setFast(Engine.computeFast(n, c));
      var sl = slowRef.current;
      var stale = !sl || (n.getTime() - sl.computedAt.getTime() >= SLOW_REFRESH_MS);
      if (!stale && sl.moonEvents) {
        var ev = sl.moonEvents;
        // هر رویدادی که گذشت (طلوع/غروب/عبور یا فاز بعدی) ⇒ محاسبه‌ی کند فوراً تازه شود
        stale = [ev.nextRise && ev.nextRise.time, ev.nextSet && ev.nextSet.time, ev.nextTransit && ev.nextTransit.time, sl.nextPhaseTime]
          .some(function (d) { return d && d.getTime() <= n.getTime(); });
      }
      if (stale) {
        var fresh = Engine.computeSlow(n, c);
        slowRef.current = fresh;
        setSlow(fresh);
      }
    } catch (e) {
      console.warn('MoonNow: compute failed', e && e.message);
    }
  }, []);

  useFocusEffect(useCallback(function () {
    var alive = true;
    UserSettings.loadCity().then(function (c) {
      if (!alive) return;
      if (!c) { setNoCity(true); return; }
      cityRef.current = c;
      slowRef.current = null;
      setCity(c);
      tick();
      timer.current = setInterval(tick, TICK_MS);
    });
    return function () {
      alive = false;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [tick]));

  if (noCity) {
    return (
      <View style={st.container}>
        <View style={st.emptyBox}><Text style={st.emptyT}>{t('mnNeedCity')}</Text></View>
      </View>
    );
  }
  if (!city || !fast || !slow) {
    return (
      <View style={st.container}>
        <View style={st.emptyBox}><Text style={st.emptyT}>{'…'}</Text></View>
      </View>
    );
  }

  // ---------- قالب‌بندی‌ها ----------
  var tzName = fast.tz.valid ? fast.tz.name : 'UTC';
  var now = fast.time;
  var nowMs = now.getTime();
  // جداکننده‌ی هزارگان بدون وابستگی به Intl (روی بعضی دستگاه‌های Hermes ناقص است)
  var fmtInt = function (v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var nf = function (v, d) { return (v === null || v === undefined || isNaN(v)) ? '---' : v.toFixed(d); };
  var clock = function (date, withSec) { return date ? moment(date).tz(tzName).format(withSec ? 'HH:mm:ss' : 'HH:mm') : '--:--'; };
  var civil = function (date) { return DateUtils.formatCivilDate(date, lang, city.lat, city.lon, tArray('gregorianMonths')); };
  var dayDiff = function (date) {
    var a = moment(date).tz(tzName).startOf('day');
    var b = moment(now).tz(tzName).startOf('day');
    return a.diff(b, 'days');
  };
  var eventStamp = function (date, withSec) {
    if (!date) return '---';
    return (dayDiff(date) === 0 ? '' : civil(date) + '  ') + clock(date, withSec);
  };
  var dur = function (ms) {
    var p = Engine.splitDuration(ms);
    if (p.days > 0) return p.days + ' ' + t('mnDays') + ' ' + p.hours + ' ' + t('mnHours');
    if (p.hours > 0) return p.hours + ' ' + t('mnHours') + ' ' + p.minutes + ' ' + t('mnMinShort');
    return p.minutes + ' ' + t('mnMinShort') + ' ' + p.seconds + ' ' + t('mnSecShort');
  };
  var rel = function (date) {
    if (!date) return '';
    var diff = date.getTime() - nowMs;
    return diff >= 0 ? t('mnIn', { x: dur(diff) }) : t('mnAgo', { x: dur(-diff) });
  };
  var withRel = function (date, withSec) { return date ? eventStamp(date, withSec) + '  (' + rel(date) + ')' : '---'; };
  var compassName = function (idx) { return t('compass_' + idx); };
  var degAz = function (az, idx) { return nf(az, 2) + '°  ' + compassName(idx); };
  var eclName = function (kind) {
    var map = { penumbral: 'mnEclPenumbral', partial: 'mnEclPartial', total: 'mnEclTotal', annular: 'mnEclAnnular' };
    return map[kind] ? t(map[kind]) : kind;
  };
  var QUARTER_KEYS = ['mnNewMoon', 'mnFirstQuarter', 'mnFullMoon', 'mnLastQuarter'];

  var m = fast.moon, ph = fast.phase, orb = fast.orbit, ec = fast.ecliptic, sunF = fast.sun;
  var me = slow.moonEvents, se = slow.sunEvents;
  var ageMs = slow.lastNewMoon ? Math.max(0, nowMs - slow.lastNewMoon.getTime()) : null;
  var ageP = ageMs !== null ? Engine.splitDuration(ageMs) : null;

  var nextEdge = m.aboveHorizon ? me.nextSet : me.nextRise;
  var edgeLabel = m.aboveHorizon ? t('mnNextSet') : t('mnNextRise');
  var perigeeNear = orb.nearPerigee;
  var apogeeNear = orb.nearApogee;
  var chartWidth = Math.min(SCREEN_W, 560) - theme.spacing.lg * 4 - 2;
  var cr = fast.crescent;

  var doShare = function () {
    var key = UserSettings.getCityKey(city.name);
    var cname = key ? t(key) : city.name;
    var lines = [
      t('mnShareHeader', { city: cname }),
      civil(now) + '  ' + clock(now, true) + ' (UTC' + fast.tz.offset + ')',
      '',
      t(Engine.phaseKeyFromAngle(ph.moonPhaseDeg)) + ' — ' + nf(ph.illuminationPercent, 1) + '%',
      t('mnAge') + ': ' + (ageP ? ageP.days + ' ' + t('mnDays') + ' ' + ageP.hours + ' ' + t('mnHours') + ' ' + ageP.minutes + ' ' + t('mnMinShort') : '---'),
      t('mnAltApparent') + ': ' + nf(m.altApparent, 2) + '°',
      t('mnAzimuth') + ': ' + degAz(m.az, m.compass),
      t('mnDistance') + ': ' + fmtInt(orb.distanceKm) + ' km',
      t('mnZodiac') + ': ' + t('zodiac_' + ec.zodiacIndex) + ' ' + nf(ec.degInSign, 2) + '°',
      t('mnMansion') + ': ' + (ec.mansionIndex + 1) + ' — ' + t('mansion_' + ec.mansionIndex),
    ];
    Share.share({ message: lines.join('\n') }).catch(function () {});
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* ===== سربرگ ===== */}
      <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.header}>
        <View style={st.liveRow}>
          <View style={st.liveDot} />
          <Text style={st.liveT}>{t('mnLive')}</Text>
        </View>
        <MoonDisc drawElongation={ph.drawElongation} brightLimbPA={fast.brightLimbPA} size={170} />
        <Text style={st.phaseName} accessibilityRole="header">{t(Engine.phaseKeyFromAngle(ph.moonPhaseDeg))}</Text>
        <Text style={st.bigPct}>{nf(ph.illuminationPercent, 2) + '%'}</Text>
        <Text style={st.sub}>{(ph.waxing ? t('mnWaxing') : t('mnWaning')) + '  •  ' + t('mnIllumination')}</Text>

        <View style={st.clockBox}>
          <Text style={st.clockBig}>{clock(now, true)}</Text>
          <Text style={st.clockSub}>{civil(now)}</Text>
          <Text style={st.clockSub}>{t('mnTimezone') + ': ' + tzName + ' (UTC' + fast.tz.offset + ')'}</Text>
          <Text style={st.clockSub}>{t('mnUtc') + ': ' + moment.utc(now).format('YYYY-MM-DD HH:mm:ss')}</Text>
        </View>

        {nextEdge ? (
          <View style={st.edgeBox}>
            <Text style={st.edgeLabel}>{edgeLabel}</Text>
            <Text style={st.edgeValue}>{clock(nextEdge.time, true) + '  •  ' + rel(nextEdge.time)}</Text>
          </View>
        ) : null}
      </LinearGradient>

      <View style={st.body}>
        {/* ===== کاشی‌های سریع ===== */}
        <View style={st.tiles}>
          <Tile label={t('mnAltitude')} value={nf(m.altApparent, 2) + '°'} sub={m.aboveHorizon ? t('mnAboveHorizon') : t('mnBelowHorizon')} />
          <Tile label={t('mnAzimuth')} value={nf(m.az, 1) + '°'} sub={compassName(m.compass)} />
          <Tile label={t('mnDistance')} value={fmtInt(orb.distanceKm)} sub="km" />
          <Tile label={t('mnElongation')} value={nf(ph.elongationTopo, 2) + '°'} sub={t('mnElongTopo')} />
          <Tile label={t('mnAngularDiameter')} value={nf(orb.angularDiameterTopoArcmin, 2) + '′'} sub={t('mnAngDiamTopo')} />
          <Tile label={t('mnAge')} value={ageP ? (ageP.days + ' ' + t('mnDays')) : '---'} sub={ageP ? (ageP.hours + ' ' + t('mnHours') + ' ' + ageP.minutes + ' ' + t('mnMinShort')) : ' '} />
        </View>

        {/* ===== موقعیت در آسمان ===== */}
        <Group icon="🧭" title={t('mnSecSky')}>
          <DataRow label={t('mnAltApparent')} value={nf(m.altApparent, 3) + '°'} valueColor={m.aboveHorizon ? theme.colors.success : theme.colors.textSecondary} isRTL={isRTL} />
          <DataRow label={t('mnAltGeometric')} value={nf(m.altGeometric, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnAzimuth')} value={nf(m.az, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnCompass')} value={compassName(m.compass)} isRTL={isRTL} />
          <DataRow label={t('mnZenithDist')} value={nf(m.zenithDistance, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnAirMass')} value={m.airMass === null ? '---' : nf(m.airMass, 3)} isRTL={isRTL} />
          <DataRow label={t('mnHourAngle')} value={Engine.fmtHMS(m.hourAngle < 0 ? m.hourAngle + 24 : m.hourAngle, 1)} isRTL={isRTL} />
          <DataRow label={t('mnNextRise')} value={me.nextRise ? withRel(me.nextRise.time, true) : t('mnNever')} isRTL={isRTL} note={me.nextRise ? t('mnAzimuth') + ': ' + degAz(me.nextRise.az, me.nextRise.compass) : null} />
          <DataRow label={t('mnNextTransit')} value={me.nextTransit ? withRel(me.nextTransit.time, true) : t('mnNever')} isRTL={isRTL} note={me.nextTransit ? t('mnMaxAlt') + ': ' + nf(me.nextTransit.alt, 2) + '°' : null} />
          <DataRow label={t('mnNextSet')} value={me.nextSet ? withRel(me.nextSet.time, true) : t('mnNever')} isRTL={isRTL} note={me.nextSet ? t('mnAzimuth') + ': ' + degAz(me.nextSet.az, me.nextSet.compass) : null} />
          <DataRow label={t('mnPrevRise')} value={me.prevRise ? withRel(me.prevRise.time, true) : t('mnNever')} isRTL={isRTL} />
          <DataRow label={t('mnPrevTransit')} value={me.prevTransit ? withRel(me.prevTransit.time, true) : t('mnNever')} isRTL={isRTL} note={me.prevTransit ? t('mnMaxAlt') + ': ' + nf(me.prevTransit.alt, 2) + '°' : null} />
          <DataRow label={t('mnPrevSet')} value={me.prevSet ? withRel(me.prevSet.time, true) : t('mnNever')} isRTL={isRTL} />
        </Group>

        {/* ===== نمودار ===== */}
        <Group icon="📈" title={t('mnSecChart')}>
          <AltitudeChart chart={slow.chart} tz={tzName} width={chartWidth} />
          <View style={st.legendRow}>
            <View style={[st.legendDot, { backgroundColor: theme.colors.gold }]} />
            <Text style={st.legendT}>{'🌙'}</Text>
            <View style={[st.legendDot, { backgroundColor: '#E8934A' }]} />
            <Text style={st.legendT}>{'☀️'}</Text>
            <Text style={st.legendNote}>{tzName}</Text>
          </View>
        </Group>

        {/* ===== فاز و چرخه ===== */}
        <Group icon="🌓" title={t('mnSecPhase')}>
          <DataRow label={t('mnPhase')} value={t(Engine.phaseKeyFromAngle(ph.moonPhaseDeg)) + ' — ' + (ph.waxing ? t('mnWaxing') : t('mnWaning'))} isRTL={isRTL} />
          <DataRow label={t('mnIllumination')} value={nf(ph.illuminationPercent, 4) + '%'} isRTL={isRTL} />
          <DataRow label={t('mnPhaseAngle')} value={nf(ph.physicalAngle, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnElongGeo')} value={nf(ph.elongationGeo, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnElongTopo')} value={nf(ph.elongationTopo, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnAge')} value={ageP ? (ageP.days + ' ' + t('mnDays') + ' ' + ageP.hours + ' ' + t('mnHours') + ' ' + ageP.minutes + ' ' + t('mnMinShort') + ' ' + ageP.seconds + ' ' + t('mnSecShort')) : '---'} isRTL={isRTL} />
          <DataRow label={t('mnLunation')} value={slow.lunationNumber !== null ? String(slow.lunationNumber) : '---'} isRTL={isRTL} />
          <DataRow label={t('mnCycleProgress')} value={slow.cycleProgress !== null ? nf(slow.cycleProgress * 100, 2) + '%' : '---'} isRTL={isRTL} />
          <DataRow label={t('mnBrightLimb')} value={nf(fast.brightLimbPA, 1) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnLibration')} value={nf(fast.libration.elon, 2) + '° / ' + nf(fast.libration.elat, 2) + '°'} isRTL={isRTL} />
          {slow.phases.past.slice().reverse().map(function (u, idx) {
            return <DataRow key={'p' + idx} label={(idx === 0 ? t('mnPrevPhases') + ' — ' : '') + t(QUARTER_KEYS[u.quarter])} value={withRel(u.date, false)} isRTL={isRTL} />;
          })}
          {slow.phases.upcoming.map(function (u, idx) {
            return <DataRow key={'u' + idx} label={(idx === 0 ? t('mnNextPhases') + ' — ' : '') + t(QUARTER_KEYS[u.quarter])} value={withRel(u.date, false)} isRTL={isRTL} />;
          })}
        </Group>

        {/* ===== مدار ===== */}
        <Group icon="🛰️" title={t('mnSecOrbit')}>
          <DataRow label={t('mnDistance')} value={fmtInt(orb.distanceKm) + ' km'} isRTL={isRTL} />
          <DataRow label={t('mnDistanceRadii')} value={nf(orb.distanceEarthRadii, 3)} isRTL={isRTL} />
          <DataRow label={t('mnVsMean')} value={(orb.vsMeanPercent >= 0 ? '+' : '') + nf(orb.vsMeanPercent, 2) + '%'} isRTL={isRTL} />
          <DataRow label={t('mnAngularDiameter')} value={nf(orb.angularDiameterArcmin, 3) + '′'} isRTL={isRTL} />
          <DataRow label={t('mnAngDiamTopo')} value={nf(orb.angularDiameterTopoArcmin, 3) + '′'} isRTL={isRTL} />
          <DataRow label={t('mnParallax')} value={nf(orb.horizontalParallaxDeg, 4) + '°'} isRTL={isRTL} />
          {slow.apsides.prevPerigee ? <DataRow label={t('mnPrevPerigee')} value={withRel(slow.apsides.prevPerigee.time, false)} isRTL={isRTL} note={fmtInt(slow.apsides.prevPerigee.distanceKm) + ' km'} /> : null}
          {slow.apsides.nextPerigee ? <DataRow label={t('mnNextPerigee')} value={withRel(slow.apsides.nextPerigee.time, false)} isRTL={isRTL} note={fmtInt(slow.apsides.nextPerigee.distanceKm) + ' km'} /> : null}
          {slow.apsides.prevApogee ? <DataRow label={t('mnPrevApogee')} value={withRel(slow.apsides.prevApogee.time, false)} isRTL={isRTL} note={fmtInt(slow.apsides.prevApogee.distanceKm) + ' km'} /> : null}
          {slow.apsides.nextApogee ? <DataRow label={t('mnNextApogee')} value={withRel(slow.apsides.nextApogee.time, false)} isRTL={isRTL} note={fmtInt(slow.apsides.nextApogee.distanceKm) + ' km'} /> : null}
          {perigeeNear ? <Text style={[st.note, { textAlign: textAlign }]}>{t('mnNearPerigee')}</Text> : null}
          {apogeeNear ? <Text style={[st.note, { textAlign: textAlign }]}>{t('mnNearApogee')}</Text> : null}
        </Group>

        {/* ===== برج، صورت فلکی، منزل ===== */}
        <Group icon="♈" title={t('mnSecSign')}>
          <DataRow label={t('mnZodiac')} value={t('zodiac_' + ec.zodiacIndex) + '  ' + Engine.fmtDMS(ec.degInSign, 0)} isRTL={isRTL} />
          <DataRow label={t('mnEnteredSign')} value={withRel(slow.ingress.signEnter, false)} isRTL={isRTL} />
          <DataRow label={t('mnLeavesSign')} value={withRel(slow.ingress.signLeave, false)} isRTL={isRTL} />
          <DataRow label={t('mnConstellation')} value={ec.constellation ? ec.constellation + ' (' + ec.constellationSymbol + ')' : '---'} isRTL={isRTL} />
          <DataRow label={t('mnMansion')} value={(ec.mansionIndex + 1) + ' — ' + t('mansion_' + ec.mansionIndex)} isRTL={isRTL} />
          <DataRow label={t('mnDegInMansion')} value={Engine.fmtDMS(ec.degInMansion, 0) + ' / ' + Engine.fmtDMS(Engine.MANSION_SPAN, 0)} isRTL={isRTL} />
          <DataRow label={t('mnEnteredMansion')} value={withRel(slow.ingress.mansionEnter, false)} isRTL={isRTL} />
          <DataRow label={t('mnLeavesMansion')} value={withRel(slow.ingress.mansionLeave, false)} isRTL={isRTL} note={t('mnMansionNote')} />
          <Text style={[st.note, { textAlign: textAlign }]}>{t('mnDisclaimer')}</Text>
        </Group>

        {/* ===== مختصات و زمان ===== */}
        <Group icon="🔭" title={t('mnSecCoords')} defaultOpen={false}>
          <DataRow label={t('mnEcliptic')} value={Engine.fmtDMS(ec.lon, 2) + '  (' + nf(ec.lon, 4) + '°)'} isRTL={isRTL} />
          <DataRow label={t('mnEclLat')} value={Engine.fmtDMS(ec.lat, 2, true)} isRTL={isRTL} />
          <DataRow label={t('mnRA')} value={Engine.fmtHMS(m.ra, 2)} isRTL={isRTL} />
          <DataRow label={t('mnDec')} value={Engine.fmtDMS(m.dec, 1, true)} isRTL={isRTL} />
          <DataRow label={t('mnRAJ2000')} value={Engine.fmtHMS(m.raJ2000, 2)} isRTL={isRTL} />
          <DataRow label={t('mnDecJ2000')} value={Engine.fmtDMS(m.decJ2000, 1, true)} isRTL={isRTL} />
          <DataRow label={t('mnGAST')} value={Engine.fmtHMS(fast.gast, 1)} isRTL={isRTL} />
          <DataRow label={t('mnLST')} value={Engine.fmtHMS(fast.lst, 1)} isRTL={isRTL} />
          <DataRow label={t('mnJD')} value={nf(fast.jd, 6)} isRTL={isRTL} />
          <DataRow label={t('mnDeltaT')} value={nf(fast.deltaT, 2) + ' s'} isRTL={isRTL} />
        </Group>

        {/* ===== هندسه‌ی هلال ===== */}
        <Group icon="🌙" title={t('mnSecCrescent')}>
          {cr ? (
            <View>
              <DataRow label={t('mnArcv')} value={nf(cr.arcv, 3) + '°'} isRTL={isRTL} />
              <DataRow label={t('mnDaz')} value={nf(cr.daz, 3) + '°'} isRTL={isRTL} />
              <DataRow label={t('mnArcl')} value={nf(cr.arcl, 3) + '°'} isRTL={isRTL} />
              <DataRow label={t('mnCrescentWidth')} value={nf(cr.widthArcmin, 3) + '′'} isRTL={isRTL} />
              <DataRow label={t('mnSunAlt')} value={nf(cr.sunAltitude, 3) + '°'} isRTL={isRTL} />
              <DataRow label={t('mnYallopQ')} value={nf(cr.yallopQ, 4)} isRTL={isRTL} />
              <DataRow label={t('mnYallopCatNow')} value={cr.yallopCat} valueColor={theme.getCatColor(cr.yallopCat, 'yallop')} isRTL={isRTL} />
              <DataRow label={t('mnOdehV')} value={nf(cr.odehV, 3)} isRTL={isRTL} />
              <DataRow label={t('mnOdehCatNow')} value={cr.odehCat} valueColor={theme.getCatColor(cr.odehCat, 'odeh')} isRTL={isRTL} />
              {cr.moonBelowHorizon ? <Text style={[st.noteWarn, { textAlign: textAlign }]}>{t('mnCrescentBelow')}</Text> : null}
              <Text style={[st.note, { textAlign: textAlign }]}>{t('mnCrescentNote')}</Text>
            </View>
          ) : (
            <Text style={[st.note, { textAlign: textAlign }]}>{fast.crescentNA === 'waning' ? t('mnCrescentNAWaning') : t('mnCrescentNA')}</Text>
          )}
        </Group>

        {/* ===== خورشید و گرگ‌ومیش ===== */}
        <Group icon="☀️" title={t('mnSecSun')} defaultOpen={false}>
          <DataRow label={t('mnSunAlt')} value={nf(sunF.altApparent, 3) + '°'} isRTL={isRTL} />
          <DataRow label={t('mnSunAz')} value={degAz(sunF.az, sunF.compass)} isRTL={isRTL} />
          <DataRow label={t('mnSunrise')} value={withRel(se.nextSunrise, true)} isRTL={isRTL} />
          <DataRow label={t('mnSunset')} value={withRel(se.nextSunset, true)} isRTL={isRTL} />
          <DataRow label={t('mnDayLength')} value={se.dayLengthMs ? dur(se.dayLengthMs) : '---'} isRTL={isRTL} />
          <DataRow label={t('mnCivilTw')} value={clock(se.civilDawn, false) + ' / ' + clock(se.civilDusk, false)} isRTL={isRTL} />
          <DataRow label={t('mnNauticalTw')} value={clock(se.nauticalDawn, false) + ' / ' + clock(se.nauticalDusk, false)} isRTL={isRTL} />
          <DataRow label={t('mnAstroTw')} value={clock(se.astroDawn, false) + ' / ' + clock(se.astroDusk, false)} isRTL={isRTL} />
          <DataRow label={t('mnSunDistance')} value={nf(sunF.distanceKm / 1e6, 4) + ' Mkm'} isRTL={isRTL} />
        </Group>

        {/* ===== خسوف و کسوف ===== */}
        <Group icon="🌑" title={t('mnSecEclipse')} defaultOpen={false}>
          {slow.lunarEclipse ? (
            <View>
              <DataRow label={t('mnLunarEclipse')} value={eclName(slow.lunarEclipse.kind) + ' — ' + eventStamp(slow.lunarEclipse.peak, false)} isRTL={isRTL} note={rel(slow.lunarEclipse.peak)} />
              <DataRow label={t('mnPenStart')} value={eventStamp(slow.lunarEclipse.penumbralStart, false)} isRTL={isRTL} />
              {slow.lunarEclipse.partialStart ? <DataRow label={t('mnPartStart')} value={eventStamp(slow.lunarEclipse.partialStart, false)} isRTL={isRTL} /> : null}
              {slow.lunarEclipse.totalStart ? <DataRow label={t('mnTotStart')} value={eventStamp(slow.lunarEclipse.totalStart, false)} isRTL={isRTL} /> : null}
              <DataRow label={t('mnPeak')} value={eventStamp(slow.lunarEclipse.peak, true)} isRTL={isRTL} />
              {slow.lunarEclipse.totalEnd ? <DataRow label={t('mnTotEnd')} value={eventStamp(slow.lunarEclipse.totalEnd, false)} isRTL={isRTL} /> : null}
              {slow.lunarEclipse.partialEnd ? <DataRow label={t('mnPartEnd')} value={eventStamp(slow.lunarEclipse.partialEnd, false)} isRTL={isRTL} /> : null}
              <DataRow label={t('mnPenEnd')} value={eventStamp(slow.lunarEclipse.penumbralEnd, false)} isRTL={isRTL} />
              <Text style={[st.note, { textAlign: textAlign }]}>
                {slow.lunarEclipse.visibleAtPeak ? t('mnVisibleHere', { alt: nf(slow.lunarEclipse.moonAltAtPeak, 0) }) : t('mnNotVisibleHere')}
              </Text>
            </View>
          ) : null}
          {slow.solarEclipse ? (
            <DataRow label={t('mnSolarEclipse')} value={eclName(slow.solarEclipse.kind) + ' — ' + eventStamp(slow.solarEclipse.peak, false)} isRTL={isRTL} note={rel(slow.solarEclipse.peak)} />
          ) : null}
          {slow.localSolarEclipse ? (
            <View>
              <DataRow label={t('mnLocalSolar')} value={eclName(slow.localSolarEclipse.kind) + ' — ' + eventStamp(slow.localSolarEclipse.peak, false)} isRTL={isRTL} note={rel(slow.localSolarEclipse.peak)} />
              <DataRow label={t('mnObscuration')} value={nf(slow.localSolarEclipse.obscuration, 1) + '%'} isRTL={isRTL} />
              <DataRow label={t('mnAltAtPeak')} value={nf(slow.localSolarEclipse.peakAlt, 1) + '°'} isRTL={isRTL} />
            </View>
          ) : null}
        </Group>

        <TouchableOpacity style={st.shareBtn} onPress={doShare} accessibilityRole="button" accessibilityLabel={t('mnShare')}>
          <Text style={st.shareBtnT}>{'📤 ' + t('mnShare')}</Text>
        </TouchableOpacity>
        <Text style={st.footerT}>{t('mnUpdatedEvery')}</Text>
      </View>
    </ScrollView>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  header: { alignItems: 'center', paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl, paddingHorizontal: theme.spacing.lg },
  liveRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success, marginRight: 6 },
  liveT: { color: theme.colors.success, fontSize: theme.type.caption.fontSize, fontWeight: '700' },
  phaseName: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight, marginTop: theme.spacing.md },
  bigPct: { color: theme.colors.textPrimary, fontSize: 34, fontWeight: '700', marginTop: 2 },
  sub: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, marginTop: 2, textAlign: 'center' },
  clockBox: { alignItems: 'center', marginTop: theme.spacing.lg, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(15,11,28,0.55)', alignSelf: 'stretch' },
  clockBig: { color: theme.colors.textPrimary, fontSize: 30, fontWeight: '700', letterSpacing: 1 },
  clockSub: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, marginTop: 2, textAlign: 'center' },
  edgeBox: { marginTop: theme.spacing.md, alignItems: 'center' },
  edgeLabel: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize },
  edgeValue: { color: theme.colors.gold, fontSize: theme.type.label.fontSize, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  body: { padding: theme.spacing.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  tile: { flexBasis: '31%', flexGrow: 1, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.md, paddingHorizontal: 6, alignItems: 'center' },
  tileValue: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
  tileSub: { color: theme.colors.gold, fontSize: 10, marginTop: 1, textAlign: 'center' },
  tileLabel: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'center' },

  group: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  groupIcon: { fontSize: theme.type.subtitle.fontSize },
  groupTitle: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight, flex: 1 },
  groupChevron: { color: theme.colors.textMuted, fontSize: theme.type.label.fontSize },
  groupBody: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendT: { color: theme.colors.textSecondary, fontSize: 12, marginRight: 8 },
  legendNote: { color: theme.colors.textMuted, fontSize: 10, flex: 1, textAlign: 'right' },

  note: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, lineHeight: 16, marginTop: theme.spacing.sm, fontStyle: 'italic' },
  noteWarn: { color: theme.colors.emberLight, fontSize: theme.type.caption.fontSize, lineHeight: 17, marginTop: theme.spacing.sm },
  shareBtn: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm },
  shareBtnT: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: '700' },
  footerT: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, textAlign: 'center', marginTop: theme.spacing.md },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xxl },
  emptyT: { color: theme.colors.textSecondary, fontSize: theme.type.body.fontSize, textAlign: 'center' },
});
