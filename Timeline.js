import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
var Svg = require('react-native-svg').Svg;
var Path = require('react-native-svg').Path;
var Line = require('react-native-svg').Line;
var Circle = require('react-native-svg').Circle;
var G = require('react-native-svg').G;

var Design = require('../design');
var theme = Design.theme;
var Engine = require('../calculations/crescentAnalysisEngine');

// ============================================================
// Timeline — SECTION 3 سند طراحی.
//
// نمودار زمانی (نه آسمان): محور افقی از غروب خورشید تا غروب ماه،
// محور عمودی ارتفاع. کاربر می‌تواند لمس/کشیدن کند تا زمان‌سنج
// (که هم SkySimulation و هم بقیه‌ی صفحه از آن تبعیت می‌کنند) را
// جابه‌جا کند — این کامپوننت خودش state زمان را نگه نمی‌دارد،
// فقط onScrub را صدا می‌زند (SECTION 10: «Keep calculations
// independent from UI» → این‌جا هم state از UI جدا نگه داشته شده،
// state واحد زمان در کامپوننت والد زندگی می‌کند).
//
// props:
//   points, sunset, moonset, bestTime, twilights  - از buildAnalysis
//   cursorTime  - زمان فعلی نشانگر (از parent)
//   onScrub     - callback(date) هنگام لمس/کشیدن نمودار
//   activeLayers- { moonAltitude: true, ... }
//   width       - عرض موجود (از parent، برای واکنش‌گرایی)
// ============================================================

var LAYER_DEFS = [
  { key: 'moonAltitude', color: '#5B9BD5', labelKey: 'saLayerMoonAlt' },
  { key: 'sunAltitude', color: '#E8934A', labelKey: 'saLayerSunAlt' },
  { key: 'arcv', color: '#5FBF7A', labelKey: 'saLayerArcv' },
  { key: 'elongationTopo', color: '#B487D6', labelKey: 'saLayerElong' },
  { key: 'crescentWidthArcmin', color: '#E0C060', labelKey: 'saLayerWidth' },
];

var CHART_H = 200;
var PAD_L = 36;
var PAD_R = 10;
var PAD_T = 10;
var PAD_B = 20;

export default function Timeline(props) {
  var points = props.points || [];
  var sunset = props.sunset;
  var moonset = props.moonset;
  var bestTime = props.bestTime;
  var twilights = props.twilights || {};
  var cursorTime = props.cursorTime;
  var onScrub = props.onScrub;
  var activeLayers = props.activeLayers || {};
  var width = props.width || (Dimensions.get('window').width - 64);

  var plotW = width - PAD_L - PAD_R;
  var plotH = CHART_H - PAD_T - PAD_B;

  var yDomain = useMemo(function () {
    var min = Infinity, max = -Infinity;
    LAYER_DEFS.forEach(function (layer) {
      if (!activeLayers[layer.key]) return;
      points.forEach(function (p) {
        var v = p[layer.key];
        if (v === null || v === undefined) return;
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    if (!isFinite(min) || !isFinite(max)) return { min: -10, max: 20 };
    var pad = (max - min) * 0.12 || 2;
    return { min: min - pad, max: max + pad };
  }, [points, activeLayers]);

  var t0 = points.length ? points[0].time.getTime() : 0;
  var t1 = points.length ? points[points.length - 1].time.getTime() : 1;

  var scaleX = function (timeMs) {
    var frac = (timeMs - t0) / (t1 - t0 || 1);
    return PAD_L + frac * plotW;
  };
  var scaleY = function (v) {
    var frac = (v - yDomain.min) / (yDomain.max - yDomain.min || 1);
    return PAD_T + (1 - frac) * plotH;
  };

  var buildPath = function (key) {
    var d = '';
    var started = false;
    points.forEach(function (p) {
      var v = p[key];
      if (v === null || v === undefined) { started = false; return; }
      var x = scaleX(p.time.getTime());
      var y = scaleY(v);
      d += (started ? ' L ' : ' M ') + x.toFixed(1) + ' ' + y.toFixed(1);
      started = true;
    });
    return d;
  };

  var handleTouch = function (evt) {
    if (!points.length || !onScrub) return;
    var x = evt.nativeEvent.locationX;
    var frac = (x - PAD_L) / plotW;
    var targetMs = t0 + frac * (t1 - t0);
    var nearest = Engine.findPointNear(points, new Date(targetMs));
    if (nearest) onScrub(nearest.time);
  };

  var panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: function () { return true; },
      onMoveShouldSetPanResponder: function () { return true; },
      onPanResponderGrant: handleTouch,
      onPanResponderMove: handleTouch,
    })
  ).current;

  var cursorX = cursorTime && points.length ? scaleX(cursorTime.getTime()) : null;

  return (
    <View {...panResponder.panHandlers}>
      <Svg width={width} height={CHART_H}>
        {/* شبکه‌ی افقی */}
        {[0, 0.25, 0.5, 0.75, 1].map(function (f, i) {
          var y = PAD_T + f * plotH;
          return <Line key={i} x1={PAD_L} y1={y} x2={width - PAD_R} y2={y} stroke={theme.colors.borderSubtle} strokeWidth={0.5} />;
        })}
        {yDomain.min < 0 && yDomain.max > 0 ? (
          <Line x1={PAD_L} y1={scaleY(0)} x2={width - PAD_R} y2={scaleY(0)} stroke={theme.colors.textMuted} strokeWidth={1} strokeDasharray="2,3" />
        ) : null}

        {/* خطوط رویداد */}
        <EvtLine time={sunset} color={theme.colors.textMuted} scaleX={scaleX} t0={t0} t1={t1} width={width} h={plotH} top={PAD_T} />
        <EvtLine time={moonset} color={theme.colors.danger} scaleX={scaleX} t0={t0} t1={t1} width={width} h={plotH} top={PAD_T} />
        <EvtLine time={twilights.civil} color={theme.colors.textLink} scaleX={scaleX} t0={t0} t1={t1} width={width} h={plotH} top={PAD_T} />
        <EvtLine time={twilights.nautical} color={theme.colors.textLink} scaleX={scaleX} t0={t0} t1={t1} width={width} h={plotH} top={PAD_T} />
        <EvtLine time={twilights.astronomical} color={theme.colors.textLink} scaleX={scaleX} t0={t0} t1={t1} width={width} h={plotH} top={PAD_T} />
        <EvtLine time={bestTime} color={theme.colors.gold} scaleX={scaleX} t0={t0} t1={t1} width={width} h={plotH} top={PAD_T} thick />

        {/* منحنی‌ها */}
        {LAYER_DEFS.map(function (layer) {
          if (!activeLayers[layer.key]) return null;
          return <Path key={layer.key} d={buildPath(layer.key)} stroke={layer.color} strokeWidth={2} fill="none" />;
        })}

        {/* نشانگر زمان‌سنج */}
        {cursorX !== null ? (
          <G>
            <Line x1={cursorX} y1={PAD_T} x2={cursorX} y2={PAD_T + plotH} stroke={theme.colors.textPrimary} strokeWidth={1} />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

function EvtLine(props) {
  if (!props.time) return null;
  var x = props.scaleX(props.time.getTime());
  if (x < PAD_L - 15 || x > props.width - PAD_R + 15) return null;
  return (
    <Line
      x1={x} y1={props.top} x2={x} y2={props.top + props.h}
      stroke={props.color} strokeWidth={props.thick ? 2 : 1}
      strokeDasharray={props.thick ? undefined : '3,3'}
    />
  );
}

export { LAYER_DEFS };
