import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Linking, Platform, Pressable } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
var RNSvg = require('react-native-svg');
var Svg = RNSvg.Svg;
var Path = RNSvg.Path;
var Circle = RNSvg.Circle;
var Line = RNSvg.Line;
var G = RNSvg.G;
var SvgText = RNSvg.Text;
var Rect = RNSvg.Rect;

var Location = require('expo-location');
var DeviceMotion = require('expo-sensors').DeviceMotion;
var Magnetometer = require('expo-sensors').Magnetometer;
var AsyncStorageModule = require('@react-native-async-storage/async-storage');
var Storage = AsyncStorageModule.default || AsyncStorageModule;

var Aim = require('../calculations/aimEngine');
var UserSettings = require('../data/userSettings');
var DateUtils = require('../data/dateUtils');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ============================================================
// AimGuideScreen — v3.5 «هلال‌یاب».
//
// گوشی را ایستاده بگیرید (دوربین پشتی به‌سمت آسمان). دو نمای کار:
//  • «دوربین (AR)»: تصویر زنده‌ی دوربین پشتی + نشانگر ماه/خورشید که با نگاشت سمت و ارتفاع
//    هدف به مختصات صفحه (با زاویه‌ی دید دوربین و جبران چرخش گوشی) حرکت می‌کند؛ خط افق و
//    شبکه‌ی ارتفاع هم رسم می‌شود. اگر هدف بیرون کادر باشد، پیکان لبه جهت را نشان می‌دهد.
//  • «قطب‌نما»: صفحه‌ی مدرج + پیکان (بدون دوربین؛ جایگزین وقتی مجوز دوربین نیست).
// وضعیت گوشی از شتاب‌سنج (ارتفاع و roll) و قطب‌نما می‌آید. روی اندروید، سمتِ خامِ expo-location
// جهت «لبه‌ی بالای گوشی» است و در حالت ایستاده ناپایدار/۱۸۰° اشتباه می‌شود؛ پس سمت دوربین
// مستقیماً از شتاب‌سنج+مغناطیس‌سنج با جبران شیب حساب می‌شود (aimEngine.cameraHeadingFromSensors).
//
// دقت: قطب‌نمای گوشی معمولاً چند درجه خطا دارد؛ نزدیک فلز/آهن‌ربا بیشتر.
//  • سمت: trueHeading از expo-location (شمال حقیقی)، یا مغناطیسی + تصحیح دستی/ماه.
//  • ارتفاع: از گرانش؛ قرارداد حسگر هنگام «تنظیم افق» خودکار تشخیص داده می‌شود.
//  • هرگز مستقیم به خورشید نگاه نکنید.
// ============================================================

var CAL_KEY = 'aimCalibration';
var TICK_MS = 50;        // نرخ به‌روزرسانی UI (~۲۰ هرتز؛ برای AR روان‌تر)
var TARGET_MS = 1000;    // محاسبه‌ی دوباره‌ی هدف
var TOLERANCE = 3;       // درجه
var SCREEN_W = Dimensions.get('window').width;
var VIEW_KEY = 'aimView';
var AR_W = SCREEN_W - 32;          // عرض کادر دوربین
var AR_H = Math.round(AR_W * 4 / 3); // نسبت ۳:۴ (عمودی) — زاویه‌ی دید دقیق‌تر بدون برش پیش‌نمایش
var FOV_MIN = 45, FOV_MAX = 90;

var MODES = [
  { id: 'moonNow', key: 'agModeMoonNow' },
  { id: 'moonBest', key: 'agModeMoonBest' },
  { id: 'sunset', key: 'agModeSunset' },
];

function polar(cx, cy, r, azDeg) {
  var a = (azDeg - 90) * Math.PI / 180; // ۰° = بالا
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function Dial(props) {
  var size = props.size, c = size / 2, R = size / 2 - 22;
  var ticks = [];
  for (var a = 0; a < 360; a += 15) {
    var major = a % 90 === 0, mid = a % 45 === 0;
    var p1 = polar(c, c, R, a), p2 = polar(c, c, R - (major ? 14 : (mid ? 10 : 6)), a);
    ticks.push(<Line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={major ? theme.colors.gold : theme.colors.textMuted} strokeWidth={major ? 2 : 1} />);
  }
  var labels = [{ az: 0, k: 0 }, { az: 90, k: 4 }, { az: 180, k: 8 }, { az: 270, k: 12 }].map(function (L) {
    var p = polar(c, c, R - 30, L.az);
    return (
      <G key={L.az} transform={'rotate(' + L.az + ' ' + p.x + ' ' + p.y + ')'}>
        <SvgText x={p.x} y={p.y + 4} fontSize={12} fontWeight="bold" fill={L.az === 0 ? theme.colors.danger : theme.colors.textSecondary} textAnchor="middle">{props.names[L.k]}</SvgText>
      </G>
    );
  });
  var tp = props.targetAz !== null ? polar(c, c, R, props.targetAz) : null;
  var aligned = props.aligned;
  var heading = props.heading === null ? 0 : props.heading;
  var relAz = props.dAz === null ? 0 : props.dAz;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={R + 8} fill="#0F0B1C" stroke={aligned ? theme.colors.success : theme.colors.border} strokeWidth={aligned ? 3 : 1.5} />
      {/* صفحه‌ی قطب‌نما: با چرخش گوشی می‌چرخد */}
      <G transform={'rotate(' + (-heading).toFixed(2) + ' ' + c + ' ' + c + ')'}>
        <Circle cx={c} cy={c} r={R} fill="none" stroke={theme.colors.borderGoldSubtle} strokeWidth={1} />
        {ticks}
        {labels}
        {tp ? (
          <G>
            <Circle cx={tp.x} cy={tp.y} r={11} fill={props.body === 'Sun' ? '#E8934A' : theme.colors.gold} stroke={theme.colors.textPrimary} strokeWidth={1.5} />
            <Circle cx={tp.x + 4} cy={tp.y - 2} r={9} fill="#0F0B1C" fillOpacity={props.body === 'Sun' ? 0 : 0.9} />
          </G>
        ) : null}
      </G>
      {/* نشانگر ثابت: جهتی که دوربین پشتی به آن می‌نگرد */}
      <Path d={'M ' + c + ' ' + (c - R - 14) + ' L ' + (c - 9) + ' ' + (c - R + 4) + ' L ' + (c + 9) + ' ' + (c - R + 4) + ' Z'} fill={theme.colors.textPrimary} />
      {/* پیکان وسط: به‌سمت هدف */}
      {props.dAz !== null ? (
        <G transform={'rotate(' + relAz.toFixed(1) + ' ' + c + ' ' + c + ')'}>
          <Path d={'M ' + c + ' ' + (c - 48) + ' L ' + (c - 15) + ' ' + (c + 6) + ' L ' + c + ' ' + (c - 6) + ' L ' + (c + 15) + ' ' + (c + 6) + ' Z'} fill={aligned ? theme.colors.success : theme.colors.gold} />
        </G>
      ) : null}
    </Svg>
  );
}

function ElevationGauge(props) {
  var h = props.height, w = 54, top = 10, bot = h - 10;
  var lo = -20, hi = 90;
  var y = function (v) { return bot - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (bot - top); };
  var ticks = [];
  for (var v = 0; v <= 90; v += 15) ticks.push(v);
  return (
    <Svg width={w} height={h}>
      <Rect x={20} y={top} width={6} height={bot - top} rx={3} fill="#1B1830" />
      {ticks.map(function (v2) {
        return (
          <G key={v2}>
            <Line x1={14} y1={y(v2)} x2={32} y2={y(v2)} stroke={theme.colors.textMuted} strokeWidth={1} />
            <SvgText x={36} y={y(v2) + 3} fontSize={9} fill={theme.colors.textMuted}>{v2 + '°'}</SvgText>
          </G>
        );
      })}
      <Line x1={10} y1={y(0)} x2={34} y2={y(0)} stroke={theme.colors.danger} strokeWidth={1.5} strokeDasharray="3,2" />
      {props.target !== null ? <Circle cx={23} cy={y(props.target)} r={7} fill={theme.colors.gold} stroke={theme.colors.textPrimary} strokeWidth={1.2} /> : null}
      {props.current !== null ? <Path d={'M 6 ' + y(props.current) + ' L 16 ' + (y(props.current) - 5) + ' L 16 ' + (y(props.current) + 5) + ' Z'} fill={props.aligned ? theme.colors.success : theme.colors.textPrimary} /> : null}
    </Svg>
  );
}


// ---------- لایه‌ی AR روی تصویر دوربین ----------
function ArOverlay(props) {
  var pose = props.pose, cam = props.cam, target = props.target, names = props.names;
  var W = cam.width, H = cam.height;
  var els = [];
  if (!pose || pose.heading === null || pose.elevation === null) {
    return <Svg width={W} height={H} pointerEvents="none" />;
  }
  var gold = theme.colors.gold;
  var okC = theme.colors.success;
  // خط افق و شبکه‌ی ارتفاع
  var alts = [-10, 0, 10, 20, 30, 40, 50, 60, 70, 80];
  alts.forEach(function (alt) {
    var segs = Aim.projectedAltitudeLine(alt, pose, cam, 5, 75);
    segs.forEach(function (seg, si) {
      if (seg.length < 2) return;
      var d = 'M ' + seg.map(function (q) { return q.x.toFixed(1) + ' ' + q.y.toFixed(1); }).join(' L ');
      els.push(<Path key={'a' + alt + '_' + si} d={d} stroke={alt === 0 ? '#5BC0EB' : '#FFFFFF'} strokeOpacity={alt === 0 ? 0.9 : 0.28} strokeWidth={alt === 0 ? 2 : 1} fill="none" strokeDasharray={alt === 0 ? undefined : '4,5'} />);
    });
    // برچسب ارتفاع (نزدیک مرکز افقی)
    var lp = Aim.projectToScreen(pose.heading, alt, pose, cam);
    if (lp.inFront && lp.x > 20 && lp.x < W - 20 && lp.y > 14 && lp.y < H - 14) {
      els.push(<SvgText key={'al' + alt} x={Math.max(8, Math.min(W - 40, lp.x + 8))} y={lp.y - 4} fontSize={10} fill="#FFFFFF" fillOpacity={0.7}>{alt + '°'}</SvgText>);
    }
  });
  // مدرج سمت روی افق
  var base = Math.round(pose.heading / 5) * 5;
  for (var d = -45; d <= 45; d += 5) {
    var az = (base + d + 360) % 360;
    var q = Aim.projectToScreen(az, 0, pose, cam);
    if (!q.inFront || q.x < 6 || q.x > W - 6 || q.y < 6 || q.y > H - 6) continue;
    var major = az % 15 === 0;
    els.push(<Line key={'t' + az} x1={q.x} y1={q.y} x2={q.x} y2={q.y + (major ? 12 : 6)} stroke="#5BC0EB" strokeWidth={major ? 2 : 1} />);
    if (major) {
      var lbl = az % 90 === 0 ? names[(az / 90) * 4] : String(az);
      els.push(<SvgText key={'tl' + az} x={q.x} y={q.y + 26} fontSize={az % 90 === 0 ? 14 : 10} fontWeight={az % 90 === 0 ? 'bold' : 'normal'} fill={az === 0 ? '#FF6B6B' : '#FFFFFF'} textAnchor="middle">{lbl}</SvgText>);
    }
  }
  // خورشید (کنار ماه) — کوچک
  if (target && target.sun && target.body === 'Moon') {
    var sp = Aim.projectToScreen(target.sun.azimuth, target.sun.altitude, pose, cam);
    if (sp.inFront && sp.inFrame) {
      els.push(<Circle key="sun" cx={sp.x} cy={sp.y} r={9} fill="#E8934A" fillOpacity={0.85} stroke="#fff" strokeWidth={1} />);
      els.push(<SvgText key="sunl" x={sp.x} y={sp.y - 14} fontSize={10} fill="#E8934A" textAnchor="middle">{props.labels.sun}</SvgText>);
    }
  }
  // هدف
  if (target && !target.error) {
    var tp = Aim.projectToScreen(target.azimuth, target.altitude, pose, cam);
    var isSun = target.body === 'Sun';
    var tolR = Math.max(14, tp.fpx * Math.tan(props.tolerance * Math.PI / 180));
    if (tp.inFront && tp.inFrame) {
      var col = props.aligned ? okC : gold;
      els.push(<Circle key="tol" cx={tp.x} cy={tp.y} r={tolR} fill="none" stroke={col} strokeWidth={2} strokeDasharray="6,5" />);
      els.push(<Circle key="tm" cx={tp.x} cy={tp.y} r={9} fill={isSun ? '#E8934A' : gold} stroke="#fff" strokeWidth={1.5} />);
      if (!isSun) els.push(<Circle key="tmc" cx={tp.x + 4} cy={tp.y - 2} r={8} fill="#0F0B1C" fillOpacity={0.92} />);
      els.push(<SvgText key="tml" x={tp.x} y={tp.y - tolR - 6} fontSize={13} fontWeight="bold" fill={col} textAnchor="middle">{(isSun ? props.labels.sunTarget : props.labels.moon) + '  ' + target.altitude.toFixed(0) + '°'}</SvgText>);
    } else {
      // پیکان لبه: جهت صفحه‌ای به‌سمت هدف
      var th = tp.screenAngleDeg * Math.PI / 180;
      var dx = Math.sin(th), dy = -Math.cos(th);
      var m = 34, hx = W / 2 - m, hy = H / 2 - m;
      var sc = Math.min(Math.abs(dx) > 1e-6 ? hx / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-6 ? hy / Math.abs(dy) : 1e9);
      var ex = W / 2 + dx * sc, ey = H / 2 + dy * sc;
      els.push(
        <G key="edge" transform={'translate(' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ') rotate(' + tp.screenAngleDeg.toFixed(1) + ')'}>
          <Path d="M 0 -20 L 15 10 L 0 3 L -15 10 Z" fill={isSun ? '#E8934A' : gold} stroke="#fff" strokeWidth={1.5} />
        </G>
      );
      els.push(<SvgText key="edgel" x={Math.max(30, Math.min(W - 30, ex - dx * 34))} y={Math.max(18, Math.min(H - 8, ey - dy * 34))} fontSize={12} fontWeight="bold" fill="#fff" textAnchor="middle">{(tp.inFront ? '' : '↻ ') + tp.offAxisDeg.toFixed(0) + '°'}</SvgText>);
    }
  }
  // چهارنما وسط
  els.push(<Line key="cx1" x1={W / 2 - 14} y1={H / 2} x2={W / 2 + 14} y2={H / 2} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.5} />);
  els.push(<Line key="cx2" x1={W / 2} y1={H / 2 - 14} x2={W / 2} y2={H / 2 + 14} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.5} />);
  return <Svg width={W} height={H} pointerEvents="none">{els}</Svg>;
}

export default function AimGuideScreen() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var isRTL = LCtx.isRTL;
  var lang = LCtx.lang;
  var textAlign = isRTL ? 'right' : 'left';

  var s1 = useState(null); var city = s1[0]; var setCity = s1[1];
  var s2 = useState('moonNow'); var mode = s2[0]; var setMode = s2[1];
  var s3 = useState(null); var target = s3[0]; var setTarget = s3[1];
  var s4 = useState({ heading: null, elevation: null, roll: 0 }); var pose = s4[0]; var setPose = s4[1];
  var s5 = useState(Aim.defaultCalibration()); var cal = s5[0]; var setCal = s5[1];
  var s6 = useState({ location: 'pending', motion: 'pending' }); var perm = s6[0]; var setPerm = s6[1];
  var s7 = useState({ accuracy: -1, usingTrue: false }); var compass = s7[0]; var setCompass = s7[1];
  var s8 = useState(null); var notice = s8[0]; var setNotice = s8[1];
  var s9 = useState('ar'); var view = s9[0]; var setViewState = s9[1];
  var s10 = useState(false); var tapMode = s10[0]; var setTapMode = s10[1];
  var camPermHook = useCameraPermissions(); var camPerm = camPermHook[0]; var requestCamPerm = camPermHook[1];
  var isFocused = useIsFocused();
  var setView = function (v) { setViewState(v); setTapMode(false); Storage.setItem(VIEW_KEY, v).catch(function () {}); };

  var rawRef = useRef({ heading: null, accel: null, mag: null, decl: null, accuracy: -1, usingTrue: false });
  var signRef = useRef(null);
  var poseRef = useRef({ heading: null, elevation: null, roll: 0 });
  var calRef = useRef(cal);
  var cityRef = useRef(null);
  var modeRef = useRef(mode);
  var subs = useRef({ heading: null, motion: null, mag: null, tick: null, targetTimer: null });
  calRef.current = cal;
  modeRef.current = mode;

  var saveCal = function (next) {
    setCal(next);
    calRef.current = next;
    Storage.setItem(CAL_KEY, JSON.stringify(next)).catch(function () {});
  };

  var refreshTarget = useCallback(function () {
    var c = cityRef.current;
    if (!c) return;
    try { setTarget(Aim.computeTarget(modeRef.current, new Date(), c)); } catch (e) { setTarget({ error: 'FAILED' }); }
  }, []);

  var stopAll = useCallback(function () {
    var s = subs.current;
    if (s.heading && s.heading.remove) s.heading.remove();
    if (s.motion && s.motion.remove) s.motion.remove();
    if (s.mag && s.mag.remove) s.mag.remove();
    if (s.tick) clearInterval(s.tick);
    if (s.targetTimer) clearInterval(s.targetTimer);
    subs.current = { heading: null, motion: null, mag: null, tick: null, targetTimer: null };
  }, []);

  useFocusEffect(useCallback(function () {
    var alive = true;
    (async function () {
      var c = await UserSettings.loadCity();
      if (!alive) return;
      cityRef.current = c;
      setCity(c);
      try {
        var saved = await Storage.getItem(CAL_KEY);
        if (saved && alive) { var parsed = JSON.parse(saved); setCal(Object.assign(Aim.defaultCalibration(), parsed)); calRef.current = Object.assign(Aim.defaultCalibration(), parsed); }
      } catch (e) {}
      try {
        var sv = await Storage.getItem(VIEW_KEY);
        if (sv === 'ar' || sv === 'dial') setViewState(sv);
      } catch (e) {}
      refreshTarget();

      // --- قطب‌نما (نیازمند مجوز موقعیت)
      var locStatus = 'denied';
      try {
        var p = await Location.requestForegroundPermissionsAsync();
        locStatus = p.status === 'granted' ? 'granted' : 'denied';
      } catch (e) { locStatus = 'denied'; }
      if (!alive) return;
      if (locStatus === 'granted') {
        try {
          subs.current.heading = await Location.watchHeadingAsync(function (h) {
            var useTrue = typeof h.trueHeading === 'number' && h.trueHeading >= 0;
            rawRef.current.heading = useTrue ? h.trueHeading : h.magHeading;
            rawRef.current.usingTrue = useTrue;
            rawRef.current.accuracy = h.accuracy;
            var dcl = Aim.declinationFromHeading(h);
            if (dcl !== null) rawRef.current.decl = dcl;
          });
        } catch (e) { locStatus = 'denied'; }
      }

      // --- شتاب‌سنج
      var motionStatus = 'unavailable';
      try {
        var avail = await DeviceMotion.isAvailableAsync();
        if (avail) {
          DeviceMotion.setUpdateInterval(TICK_MS);
          subs.current.motion = DeviceMotion.addListener(function (d) {
            var a = d && (d.accelerationIncludingGravity || null);
            if (a && typeof a.x === 'number') {
              var prev = rawRef.current.accel;
              rawRef.current.accel = prev
                ? { x: Aim.ema(prev.x, a.x, 0.35), y: Aim.ema(prev.y, a.y, 0.35), z: Aim.ema(prev.z, a.z, 0.35) }
                : { x: a.x, y: a.y, z: a.z };
            }
          });
          motionStatus = 'ok';
        }
      } catch (e) { motionStatus = 'unavailable'; }
      // مغناطیس‌سنج: برای سمت دوربین روی اندروید (جبران شیب)
      try {
        if (Platform.OS === 'android' && Magnetometer && await Magnetometer.isAvailableAsync()) {
          Magnetometer.setUpdateInterval(TICK_MS);
          subs.current.mag = Magnetometer.addListener(function (d) {
            if (d && typeof d.x === 'number') {
              var pm = rawRef.current.mag;
              rawRef.current.mag = pm ? { x: Aim.ema(pm.x, d.x, 0.3), y: Aim.ema(pm.y, d.y, 0.3), z: Aim.ema(pm.z, d.z, 0.3) } : { x: d.x, y: d.y, z: d.z };
            }
          });
        }
      } catch (e) {}
      if (!alive) return;
      setPerm({ location: locStatus, motion: motionStatus });

      // --- حلقه‌ی به‌روزرسانی UI و هدف
      var smoothHeading = null;
      subs.current.tick = setInterval(function () {
        var r = rawRef.current;
        var cs = calRef.current.accelSign;
        if (cs !== null && cs !== undefined) signRef.current = cs;
        else if (r.accel) { var ds = Aim.detectAccelSign(r.accel); if (ds !== null) signRef.current = ds; }
        var sign = signRef.current !== null ? signRef.current : (Platform.OS === 'ios' ? -1 : 1);
        var elev = r.accel ? Aim.elevationFromAccel(r.accel, sign) : null;
        var roll = r.accel ? Aim.rollFromAccel(r.accel, sign) : 0;
        // سمت دوربین: اندروید ← از حسگرها؛ iOS ← CoreLocation (جهت پشت گوشی را خودش لحاظ می‌کند)
        var hRaw = null;
        if (Platform.OS === 'android' && r.mag && r.accel) {
          var hm = Aim.cameraHeadingFromSensors(r.accel, r.mag, sign);
          if (hm !== null) hRaw = Aim.norm360(hm + (r.decl !== null ? r.decl : 0));
        }
        if (hRaw === null && r.heading !== null) {
          hRaw = r.heading;
          // اندروید بدون مغناطیس‌سنج: سمت خام جهت لبه‌ی بالاست؛ با دوربین بالاتر از افق ۱۸۰° اختلاف دارد
          if (Platform.OS === 'android' && elev !== null && elev > 2) hRaw = Aim.norm360(hRaw + 180);
        }
        if (hRaw !== null) smoothHeading = Aim.circularEma(smoothHeading, hRaw, 0.25);
        var p2 = Aim.applyCalibration({ heading: smoothHeading, elevation: elev }, calRef.current);
        p2.roll = roll === null ? 0 : roll;
        poseRef.current = p2;
        setPose(p2);
        setCompass({ accuracy: r.accuracy, usingTrue: r.usingTrue || r.decl !== null });
      }, TICK_MS);
      subs.current.targetTimer = setInterval(refreshTarget, TARGET_MS);
    })();
    return function () { alive = false; stopAll(); };
  }, [refreshTarget, stopAll]));

  useEffect(function () { refreshTarget(); }, [mode, refreshTarget]);

  // ---------- کالیبراسیون ----------
  var doLevel = function () {
    var a = rawRef.current.accel;
    if (!a) { setNotice(t('agNoSensors')); return; }
    var res = Aim.calibrateLevel(a, calRef.current);
    if (!res.ok) { setNotice(t('agCalibNotUpright')); return; }
    saveCal(res.cal);
    setNotice(t('agCalibLevelDone'));
  };
  var doMoonCal = function () {
    var c = cityRef.current;
    if (!c || rawRef.current.heading === null) { setNotice(t('agNoSensors')); return; }
    var m = Aim.computeTarget('moonNow', new Date(), c);
    if (m.altitude < 3) { setNotice(t('agCalibMoonNeed')); return; }
    var next = Aim.calibrateHeadingToBody(m.azimuth, rawRef.current.heading, calRef.current);
    saveCal(next);
    setNotice(t('agCalibMoonDone', { d: next.headingOffset.toFixed(1) }));
  };
  var stepDeclination = function (delta) {
    var next = Object.assign({}, calRef.current, { declination: Math.round(((calRef.current.declination || 0) + delta) * 10) / 10 });
    saveCal(next);
  };
  var resetCal = function () { saveCal(Aim.defaultCalibration()); setNotice(null); };
  var stepFov = function (delta) {
    var cur = calRef.current.fovLong || 66;
    var nf = Math.max(FOV_MIN, Math.min(FOV_MAX, Math.round((cur + delta) * 10) / 10));
    saveCal(Object.assign({}, calRef.current, { fovLong: nf }));
  };
  // کالیبراسیون با ضربه: روی ماه (یا خورشید) واقعی که در تصویر می‌بینید ضربه بزنید
  var onArTap = function (e) {
    if (!tapMode) return;
    var c = cityRef.current, p = poseRef.current;
    if (!c || p.heading === null || p.elevation === null) { setNotice(t('agNoSensors')); return; }
    var bodyName = target && target.body === 'Sun' ? 'Sun' : 'Moon';
    var b = Aim.bodyNow(bodyName, new Date(), c);
    if (!b || b.altitude < 1) { setNotice(t('agArCalibNeedBody')); setTapMode(false); return; }
    var camNow = { width: AR_W, height: AR_H, fovLongDeg: calRef.current.fovLong || 66 };
    var sol = Aim.solveOffsetsFromTap(b, p, camNow, e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (!sol) { setNotice(t('agArCalibFail')); setTapMode(false); return; }
    var next = Object.assign({}, calRef.current, {
      headingOffset: (calRef.current.headingOffset || 0) + sol.dHeading,
      elevOffset: (calRef.current.elevOffset || 0) + sol.dElevation,
    });
    saveCal(next);
    setTapMode(false);
    setNotice(t('agArCalibDone', { h: sol.dHeading.toFixed(1), e: sol.dElevation.toFixed(1) }));
  };

  // ---------- نمایش ----------
  var g = target && !target.error ? Aim.guidance(target, pose, TOLERANCE) : { ready: false };
  var quality = Aim.compassQuality(compass.accuracy);
  var names = [t('compass_0'), '', '', '', t('compass_4'), '', '', '', t('compass_8'), '', '', '', t('compass_12'), '', '', ''];
  var dialSize = Math.min(SCREEN_W - 96, 300);

  var guideText = '';
  if (target && target.error === 'NO_BEST_TIME') guideText = t('agNoBest');
  else if (target && target.error) guideText = t('agNoTarget');
  else if (!g.ready) guideText = t('agWaiting');
  else if (g.aligned) guideText = t('agAligned');
  else {
    var parts = [];
    if (g.turn !== 'ok') parts.push(t(g.turn === 'right' ? 'agTurnRight' : 'agTurnLeft', { d: Math.abs(g.dAz).toFixed(0) }));
    if (g.tilt !== 'ok') parts.push(t(g.tilt === 'up' ? 'agTiltUp' : 'agTiltDown', { d: Math.abs(g.dAlt).toFixed(0) }));
    guideText = parts.join('\n');
  }
  var compassName = target && !target.error ? t('compass_' + Aim.compassIndex(target.azimuth)) : '';

  return (
    <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.header}>
        <Text style={st.hTitle} accessibilityRole="header">{'🎯 ' + t('agTitle')}</Text>
        <Text style={st.hSub}>{t('agSub')}</Text>
      </LinearGradient>

      <View style={st.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {MODES.map(function (m) {
            var active = m.id === mode;
            return (
              <TouchableOpacity key={m.id} style={[st.chip, active && st.chipActive]} onPress={function () { setMode(m.id); }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[st.chipT, active && st.chipTActive]}>{t(m.key)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* راهنمای متنی بزرگ */}
        <View style={[st.guideBox, g.aligned && st.guideBoxOk]}>
          <Text style={[st.guideT, g.aligned && { color: theme.colors.success }]} accessibilityLiveRegion="polite">{guideText}</Text>
          {g.ready && g.targetBelowHorizon ? <Text style={st.warnT}>{t('agTargetBelow')}</Text> : null}
        </View>

        {/* انتخاب نما: دوربین (AR) یا قطب‌نما */}
        <View style={st.segRow}>
          {[{ id: 'ar', key: 'agViewAr' }, { id: 'dial', key: 'agViewDial' }].map(function (v) {
            var active = view === v.id;
            return (
              <TouchableOpacity key={v.id} style={[st.seg, active && st.segActive]} onPress={function () { setView(v.id); }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[st.segT, active && st.segTActive]}>{t(v.key)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {view === 'ar' ? (
          (camPerm && camPerm.granted) ? (
            <View>
              <View style={[st.arBox, g.aligned && st.arBoxOk]}>
                {isFocused ? <CameraView style={StyleSheet.absoluteFill} facing="back" ratio="4:3" /> : null}
                <ArOverlay
                  pose={pose} target={target && !target.error ? target : null} names={names}
                  cam={{ width: AR_W, height: AR_H, fovLongDeg: cal.fovLong || 66 }}
                  tolerance={TOLERANCE} aligned={!!g.aligned}
                  labels={{ moon: t('agArMoon'), sun: '☀', sunTarget: t('agArSun') }}
                />
                <Pressable style={StyleSheet.absoluteFill} onPress={onArTap} />
                {tapMode ? <View style={st.arTapBanner} pointerEvents="none"><Text style={st.arTapT}>{t('agArTapHint')}</Text></View> : null}
              </View>
              <View style={st.arBar}>
                <TouchableOpacity style={[st.arBtn, tapMode && st.arBtnOn]} onPress={function () { setTapMode(!tapMode); }} accessibilityRole="button" accessibilityState={{ selected: tapMode }}>
                  <Text style={[st.arBtnT, tapMode && { color: theme.colors.goldDark }]}>{tapMode ? t('agArTapCancel') : t('agArTapCalib')}</Text>
                </TouchableOpacity>
                <View style={st.fovBox}>
                  <TouchableOpacity style={st.stepBtn} onPress={function () { stepFov(-2); }} accessibilityRole="button" accessibilityLabel={t('agFov') + ' −2'}><Text style={st.stepT}>{'−'}</Text></TouchableOpacity>
                  <Text style={st.fovT}>{t('agFov') + ' ' + (cal.fovLong || 66).toFixed(0) + '°'}</Text>
                  <TouchableOpacity style={st.stepBtn} onPress={function () { stepFov(2); }} accessibilityRole="button" accessibilityLabel={t('agFov') + ' +2'}><Text style={st.stepT}>{'+'}</Text></TouchableOpacity>
                </View>
              </View>
              <Text style={[st.hint, { textAlign: textAlign }]}>{t('agArNote')}</Text>
            </View>
          ) : (
            <View style={st.infoCard}>
              <Text style={[st.infoT, { textAlign: textAlign }]}>{t('agArNoCamera')}</Text>
              {camPerm && camPerm.canAskAgain === false ? (
                <TouchableOpacity style={st.btn} onPress={function () { try { Linking.openSettings(); } catch (e) {} }} accessibilityRole="button"><Text style={st.btnT}>{t('agPermOpenSettings')}</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity style={st.btn} onPress={requestCamPerm} accessibilityRole="button"><Text style={st.btnT}>{t('agArEnableCamera')}</Text></TouchableOpacity>
              )}
            </View>
          )
        ) : null}

        {(view === 'dial' || !(camPerm && camPerm.granted)) ? (
        <View style={st.instrument}>
          <Dial size={dialSize} heading={pose.heading} targetAz={target && !target.error ? target.azimuth : null} dAz={g.ready ? g.dAz : null} aligned={!!g.aligned} names={names} body={target ? target.body : 'Moon'} />
          <ElevationGauge height={dialSize} current={pose.elevation} target={target && !target.error ? target.altitude : null} aligned={!!g.aligned} />
        </View>
        ) : null}

        {target && !target.error ? (
          <View style={st.infoCard}>
            <Text style={[st.infoT, { textAlign: textAlign }]}>{t('agTargetInfo', { az: target.azimuth.toFixed(1), dir: compassName, alt: target.altitude.toFixed(1) })}</Text>
            <Text style={[st.infoSub, { textAlign: textAlign }]}>{t('agTargetTime', { time: DateUtils.formatTimeHM(target.time, city.lat, city.lon) })}</Text>
            <Text style={[st.infoSub, { textAlign: textAlign }]}>{t('agHeading') + ': ' + (pose.heading === null ? '—' : pose.heading.toFixed(0) + '°') + '   ' + t('agElevation') + ': ' + (pose.elevation === null ? '—' : pose.elevation.toFixed(0) + '°')}</Text>
          </View>
        ) : null}

        {/* وضعیت حسگرها */}
        <View style={st.infoCard}>
          <Text style={[st.infoT, { textAlign: textAlign }]}>{t(compass.usingTrue ? 'agTrueNorth' : 'agMagNorth') + ' — ' + t('agCompass_' + quality)}</Text>
          {perm.location === 'denied' ? (
            <TouchableOpacity onPress={function () { try { Linking.openSettings(); } catch (e) {} }} accessibilityRole="button"><Text style={st.linkT}>{t('agPermLocation')}</Text></TouchableOpacity>
          ) : null}
          {perm.motion === 'unavailable' ? <Text style={st.warnT}>{t('agNoSensors')}</Text> : null}
          {quality === 'poor' ? <Text style={st.warnT}>{t('agFigure8')}</Text> : null}
          {!compass.usingTrue && perm.location === 'granted' ? <Text style={st.hint}>{t('agMagHint')}</Text> : null}
        </View>

        {/* کالیبراسیون */}
        <View style={st.infoCard}>
          <Text style={[st.cardTitle, { textAlign: textAlign }]}>{t('agCalibTitle')}</Text>
          <TouchableOpacity style={st.btn} onPress={doLevel} accessibilityRole="button"><Text style={st.btnT}>{t('agCalibLevel')}</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn} onPress={doMoonCal} accessibilityRole="button"><Text style={st.btnT}>{t('agCalibMoon')}</Text></TouchableOpacity>
          <View style={st.declRow}>
            <TouchableOpacity style={st.stepBtn} onPress={function () { stepDeclination(-1); }} accessibilityRole="button" accessibilityLabel={t('agDeclination') + ' −1'}><Text style={st.stepT}>{'−1°'}</Text></TouchableOpacity>
            <Text style={st.declT}>{t('agDeclination') + ': ' + (cal.declination || 0).toFixed(1) + '°'}</Text>
            <TouchableOpacity style={st.stepBtn} onPress={function () { stepDeclination(1); }} accessibilityRole="button" accessibilityLabel={t('agDeclination') + ' +1'}><Text style={st.stepT}>{'+1°'}</Text></TouchableOpacity>
          </View>
          <Text style={st.hint}>{t('agOffsetInfo', { h: (cal.headingOffset || 0).toFixed(1), e: (cal.elevOffset || 0).toFixed(1) })}</Text>
          <TouchableOpacity style={st.btnGhost} onPress={resetCal} accessibilityRole="button"><Text style={st.btnGhostT}>{t('agCalibReset')}</Text></TouchableOpacity>
          {notice ? <Text style={st.notice}>{notice}</Text> : null}
        </View>

        <Text style={[st.safety, { textAlign: textAlign }]}>{'⚠️ ' + t('agSafety')}</Text>
        <Text style={[st.hint, { textAlign: textAlign }]}>{t('agAccuracyNote')}</Text>
      </View>
    </ScrollView>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  header: { alignItems: 'center', paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  hTitle: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight, textAlign: 'center' },
  hSub: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, textAlign: 'center', marginTop: 4 },
  body: { padding: theme.spacing.lg },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgCard },
  chipActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  chipT: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTActive: { color: theme.colors.goldDark },
  guideBox: { marginTop: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.radius.lg, borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.bgCard, alignItems: 'center', minHeight: 84, justifyContent: 'center' },
  guideBoxOk: { borderColor: theme.colors.success },
  segRow: { flexDirection: 'row', marginTop: theme.spacing.md, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  seg: { flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: theme.colors.bgCard },
  segActive: { backgroundColor: theme.colors.gold },
  segT: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  segTActive: { color: theme.colors.goldDark },
  arBox: { width: AR_W, height: AR_H, alignSelf: 'center', marginTop: theme.spacing.md, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: theme.colors.border },
  arBoxOk: { borderColor: theme.colors.success },
  arTapBanner: { position: 'absolute', top: 10, left: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: theme.radius.md, padding: 8 },
  arTapT: { color: theme.colors.gold, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  arBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  arBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.gold, backgroundColor: theme.colors.bgCardDeep, alignItems: 'center' },
  arBtnOn: { backgroundColor: theme.colors.gold },
  arBtnT: { color: theme.colors.gold, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  fovBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fovT: { color: theme.colors.textSecondary, fontSize: 11 },
  guideT: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 30 },
  warnT: { color: theme.colors.emberLight, fontSize: theme.type.caption.fontSize, textAlign: 'center', marginTop: 6, lineHeight: 17 },
  instrument: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: theme.spacing.md },
  infoCard: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginTop: theme.spacing.md },
  infoT: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: '600' },
  infoSub: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, marginTop: 4 },
  cardTitle: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight, marginBottom: 8 },
  btn: { backgroundColor: theme.colors.bgCardDeep, borderWidth: 1, borderColor: theme.colors.gold, borderRadius: theme.radius.md, padding: 12, marginTop: 8, alignItems: 'center' },
  btnT: { color: theme.colors.gold, fontSize: theme.type.label.fontSize, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  btnGhost: { padding: 10, marginTop: 6, alignItems: 'center' },
  btnGhostT: { color: theme.colors.textMuted, fontSize: theme.type.label.fontSize },
  declRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stepBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgCardDeep },
  stepT: { color: theme.colors.textPrimary, fontWeight: '700' },
  declT: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize },
  hint: { color: theme.colors.textMuted, fontSize: theme.type.micro.fontSize, lineHeight: 16, marginTop: 8 },
  notice: { color: theme.colors.success, fontSize: theme.type.caption.fontSize, marginTop: 8, textAlign: 'center' },
  linkT: { color: theme.colors.textLink, fontSize: theme.type.caption.fontSize, marginTop: 6, textDecorationLine: 'underline' },
  safety: { color: theme.colors.warning, fontSize: theme.type.caption.fontSize, lineHeight: 18, marginTop: theme.spacing.lg, fontWeight: '600' },
});
