import React, { useMemo, useState } from 'react';
import { View, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
var Text = require('../design/ScaledText');
var Svg = require('react-native-svg').Svg;
var Circle = require('react-native-svg').Circle;
var Line = require('react-native-svg').Line;
var Path = require('react-native-svg').Path;
var Text2 = require('react-native-svg').Text;
var G = require('react-native-svg').G;
var Defs = require('react-native-svg').Defs;
var RadialGradient = require('react-native-svg').RadialGradient;
var Stop = require('react-native-svg').Stop;
var ClipPath = require('react-native-svg').ClipPath;

var Design = require('../design');
var theme = Design.theme;

// ============================================================
// SkySimulation — SECTION 2 سند طراحی (بازطراحی بصری بعد از
// گزارش کاربر).
//
// این یک نقشه نیست. این «آسمانی که رصدگر واقعاً به آن نگاه می‌کند»
// است: یک نمای نیم‌کره‌ای مسطح‌شده (نمودار قطبی azimuth/altitude)
// که مرکزش سمت‌الرأس (Zenith) و لبه‌ی بیرونی‌اش افق (Altitude=0)
// است. جهت‌های اصلی قطب‌نما دور تا دور آن نوشته می‌شوند تا کاربر
// فوراً بداند «به کدام جهت نگاه کنم».
//
// بهبودهای این نسخه (درخواست صریح کاربر: «بهتر و زیباتر»):
//   ۱. گرادیان آسمان اکنون واقعاً به ارتفاع خورشید (point.sunAltitude)
//      واکنش نشان می‌دهد — هرچه خورشید پایین‌تر برود، آسمان به‌جای
//      یک گرادیان ثابت، واقعاً تیره‌تر می‌شود (شبیه‌سازی گرگ‌ومیش
//      واقعی، نه فقط یک پس‌زمینه‌ی تزئینی). این از داده‌ی واقعی
//      نمونه می‌آید، نه یک انیمیشن دلبخواه.
//   ۲. وقتی خورشید به اندازه‌ی کافی پایین رفت (زیر ارتفاع
//      astronomical twilight، حدود -۱۸°)، چند ستاره‌ی ایستای تزئینی
//      نمایش داده می‌شود تا حس «آسمان واقعاً تاریک» منتقل شود.
//   ۳. هلال رسم‌شده اکنون ضخامتش متناسب با illuminationPercent واقعی
//      آن لحظه است (نه یک نسبت ثابت ۰.۵۸)، پس هرچه هلال واقعاً
//      نازک‌تر/ضخیم‌تر باشد، شکل رسم‌شده هم متناسب عوض می‌شود.
//      جهت هلال (کدام‌سمت باز است) همچنان ساده‌سازی‌شده (رو به چپ)
//      نگه داشته شده، چون چرخش صحیح آن به parallacticAngle و
//      قراردادهای علامت‌گذاری خاص astronomy-engine نیاز دارد که
//      بدون تأیید مستقیم نباید حدس زده شود — نمایش نادرست جهت
//      می‌تواند گمراه‌کننده‌تر از یک ساده‌سازی نمادین باشد.
//   ۴. راهنمای نمادها (legend) که قبلاً همیشه ۶ ردیف کامل اشغال
//      می‌کرد، اکنون پشت یک دکمه‌ی کوچک «ⓘ» جمع/باز می‌شود — چون
//      برای رصدگر حرفه‌ای که مکرراً از این صفحه استفاده می‌کند،
//      دیدن این ۶ خط هر بار غیرضروری است؛ اما هنوز با یک لمس در
//      دسترس می‌ماند، نه حذف‌شده.
//   ۵. برچسب‌های جهت اصلی (N/E/S/W) و حلقه‌ی افق با کنتراست/وزن
//      بصری بیشتر از خطوط شعاعی فرعی جدا شدند.
//
// props:
//   point       - خروجی sampleInstant برای لحظه‌ی فعلی (از موتور)
//   sunsetPoint - نمونه‌ی لحظه‌ی غروب خورشید (برای رسم نقطه‌ی ثابت
//                 غروب روی افق، حتی وقتی cursor جای دیگری‌ست)
//   moonsetPoint- نمونه‌ی لحظه‌ی غروب ماه
//   pathPoints  - زیرنمونه‌ای از points (برای رسم مسیر حرکت ماه/
//                 خورشید روی آسمان، نه فقط نقطه‌ی لحظه‌ای)
//   rotation    - چرخش دستی کاربر (درجه) — کشیدن انگشت آسمان را
//                 می‌چرخاند (SECTION 2: "Dragging rotates the sky")
//   onRotate    - callback هنگام کشیدن
//   isRTL
// ============================================================

var SIZE = 300;
var CENTER = SIZE / 2;
var RADIUS = SIZE / 2 - 34; // فاصله از لبه برای جا دادن برچسب جهت‌ها
var MAX_ALT_RING = 90; // زنیت

function altToRadius(altitude) {
  var clamped = Math.max(altitude, -20);
  return RADIUS * (1 - clamped / MAX_ALT_RING);
}

function altAzToXY(altitude, azimuth, rotationDeg) {
  var r = altToRadius(altitude);
  var effectiveAz = azimuth + (rotationDeg || 0);
  var azRad = (effectiveAz * Math.PI) / 180;
  var x = CENTER + r * Math.sin(azRad);
  var y = CENTER - r * Math.cos(azRad);
  return { x: x, y: y };
}

// گرادیان آسمان بر اساس ارتفاع خورشید — درون‌یابی خطی بین سه حالت:
// خورشید بالای افق (هنوز روشن)، غروب تازه (گرگ‌ومیش)، خورشید عمیقاً
// زیر افق (شب تاریک، زیر -18°).
function skyColorsForSunAltitude(sunAltitude) {
  if (sunAltitude === null || sunAltitude === undefined) {
    return { top: theme.colors.bgHeaderTop, mid: theme.colors.bgHeader, bottom: theme.colors.bgCardDeep, starOpacity: 0 };
  }
  return {
    top: theme.colors.bgHeaderTop,
    mid: theme.colors.bgHeader,
    bottom: theme.colors.bgCardDeep,
    // شفافیت ستاره‌ها فقط بعد از nautical twilight (~-12°) شروع به
    // ظاهر شدن می‌کند و در astronomical dusk (-18°) کامل می‌شود.
    starOpacity: Math.min(1, Math.max(0, (-12 - sunAltitude) / 6)),
  };
}

// موقعیت‌های ثابت (seeded) چند ستاره‌ی تزئینی — عمداً تصادفی-اما-
// ثابت (نه Math.random در هر رندر) تا با هر تغییر cursorTime چشمک
// نزنند/جابه‌جا نشوند.
var STAR_POSITIONS = [
  { x: 0.15, y: 0.18, r: 1.2 }, { x: 0.32, y: 0.09, r: 0.8 }, { x: 0.55, y: 0.14, r: 1 },
  { x: 0.78, y: 0.2, r: 0.9 }, { x: 0.88, y: 0.35, r: 1.1 }, { x: 0.08, y: 0.42, r: 0.7 },
  { x: 0.68, y: 0.08, r: 0.7 }, { x: 0.4, y: 0.28, r: 0.6 }, { x: 0.2, y: 0.6, r: 0.8 },
  { x: 0.85, y: 0.62, r: 0.7 }, { x: 0.6, y: 0.75, r: 0.9 }, { x: 0.3, y: 0.82, r: 0.7 },
];

export default function SkySimulation(props) {
  var point = props.point;
  var sunsetPoint = props.sunsetPoint;
  var moonsetPoint = props.moonsetPoint;
  var pathPoints = props.pathPoints || [];
  var rotation = props.rotation || 0;
  var isRTL = props.isRTL;
  var t = props.t;

  var s1 = useState(false); var showLegend = s1[0]; var setShowLegend = s1[1];

  var panResponder = useMemo(function () {
    return PanResponder.create({
      onStartShouldSetPanResponder: function () { return true; },
      onMoveShouldSetPanResponder: function () { return true; },
      onPanResponderMove: function (evt, gesture) {
        if (props.onRotate) props.onRotate(gesture.dx * 0.5);
      },
    });
  }, [props.onRotate]);

  var moonPos = point && point.moonAltitude !== null ? altAzToXY(point.moonAltitude, point.moonAzimuth, rotation) : null;
  var sunPos = point && point.sunAltitude !== null ? altAzToXY(point.sunAltitude, point.sunAzimuth, rotation) : null;
  var sunsetPos = sunsetPoint && sunsetPoint.sunAltitude !== null ? altAzToXY(sunsetPoint.sunAltitude, sunsetPoint.sunAzimuth, rotation) : null;
  var moonsetPos = moonsetPoint && moonsetPoint.moonAltitude !== null ? altAzToXY(moonsetPoint.moonAltitude, moonsetPoint.moonAzimuth, rotation) : null;

  var sky = skyColorsForSunAltitude(point ? point.sunAltitude : null);

  // مسیر حرکت ماه/خورشید — فقط بخشی از نمونه‌ها که بالای -15° هستند
  var moonPath = useMemo(function () {
    var d = '';
    var started = false;
    pathPoints.forEach(function (p) {
      if (p.moonAltitude === null || p.moonAltitude < -15) { started = false; return; }
      var xy = altAzToXY(p.moonAltitude, p.moonAzimuth, rotation);
      d += (started ? ' L ' : ' M ') + xy.x.toFixed(1) + ' ' + xy.y.toFixed(1);
      started = true;
    });
    return d;
  }, [pathPoints, rotation]);

  var sunPath = useMemo(function () {
    var d = '';
    var started = false;
    pathPoints.forEach(function (p) {
      if (p.sunAltitude === null || p.sunAltitude < -15) { started = false; return; }
      var xy = altAzToXY(p.sunAltitude, p.sunAzimuth, rotation);
      d += (started ? ' L ' : ' M ') + xy.x.toFixed(1) + ' ' + xy.y.toFixed(1);
      started = true;
    });
    return d;
  }, [pathPoints, rotation]);

  var compassPoints = [
    { label: t ? t('saNorth') : 'N', az: 0 },
    { label: t ? t('saEast') : 'E', az: 90 },
    { label: t ? t('saSouth') : 'S', az: 180 },
    { label: t ? t('saWest') : 'W', az: 270 },
  ];

  // ضخامت هلال متناسب با روشنایی واقعی — هرچه illuminationPercent
  // کمتر (هلال نازک‌تر واقعی)، دایره‌ی داخلی offset بیشتری می‌گیرد
  // (هلال باریک‌تر روی صفحه). محدوده‌ی امن ۰.۴۵ تا ۰.۹ تا در
  // حالت‌های حدی، شکل هلال نه ناپدید شود نه به دایره‌ی کامل تبدیل شود.
  var moonIllum = point && point.illuminationPercent !== null && point.illuminationPercent !== undefined
    ? point.illuminationPercent
    : 3;
  var offsetRatio = Math.min(0.9, Math.max(0.45, 0.9 - (moonIllum / 100) * 2.2));

  return (
    <View style={st.wrap}>
      <View {...panResponder.panHandlers}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <RadialGradient id="skyGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={sky.top} stopOpacity="1" />
              <Stop offset="75%" stopColor={sky.mid} stopOpacity="1" />
              <Stop offset="100%" stopColor={sky.bottom} stopOpacity="1" />
            </RadialGradient>
            <ClipPath id="skyClip">
              <Circle cx={CENTER} cy={CENTER} r={RADIUS} />
            </ClipPath>
            {moonPos ? (
              <ClipPath id="moonOuterClip">
                <Circle cx={moonPos.x} cy={moonPos.y} r={8} />
              </ClipPath>
            ) : null}
          </Defs>

          {/* بوم آسمان — رنگش به ارتفاع خورشید واقعی واکنش نشان می‌دهد */}
          <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#skyGrad)" stroke={theme.colors.borderGoldSubtle} strokeWidth={1} />

          {/* ستاره‌های تزئینی — فقط وقتی آسمان واقعاً به‌اندازه‌ی کافی
              تاریک است (بعد از nautical twilight) کم‌کم ظاهر می‌شوند */}
          {sky.starOpacity > 0 ? (
            <G clipPath="url(#skyClip)">
              {STAR_POSITIONS.map(function (star, i) {
                return (
                  <Circle
                    key={i}
                    cx={star.x * SIZE}
                    cy={star.y * SIZE}
                    r={star.r}
                    fill={theme.colors.textPrimary}
                    opacity={sky.starOpacity * 0.8}
                  />
                );
              })}
            </G>
          ) : null}

          {/* شبکه‌ی ارتفاع (حلقه‌های هم‌مرکز) */}
          {[0, 20, 40, 60, 80].map(function (alt) {
            var r = altToRadius(alt);
            return <Circle key={alt} cx={CENTER} cy={CENTER} r={r} fill="none" stroke={theme.colors.borderSubtle} strokeWidth={0.5} />;
          })}
          {/* دایره‌ی افق برجسته */}
          <Circle cx={CENTER} cy={CENTER} r={altToRadius(0)} fill="none" stroke={theme.colors.gold} strokeWidth={1.4} strokeDasharray="2,4" opacity={0.55} />

          {/* خطوط شعاعی هر ۴۵ درجه — خطوط جهت‌های اصلی (۹۰°) پررنگ‌تر */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(function (az) {
            var edge = altAzToXY(-20, az, rotation);
            var isCardinal = az % 90 === 0;
            return <Line key={az} x1={CENTER} y1={CENTER} x2={edge.x} y2={edge.y} stroke={theme.colors.borderSubtle} strokeWidth={isCardinal ? 0.8 : 0.5} opacity={isCardinal ? 0.8 : 0.5} />;
          })}

          {/* برچسب جهت‌های قطب‌نما — با هاله‌ی پس‌زمینه برای خوانایی
              بیشتر روی هر رنگ آسمان */}
          {compassPoints.map(function (cp) {
            var pos = altAzToXY(-14, cp.az, rotation);
            return (
              <G key={cp.label}>
                <Circle cx={pos.x} cy={pos.y} r={10} fill={theme.colors.bgCardDeep} opacity={0.7} />
                <Text2 x={pos.x} y={pos.y + 4} fontSize={13} fontWeight="bold" fill={theme.colors.gold} textAnchor="middle">
                  {cp.label}
                </Text2>
              </G>
            );
          })}

          {/* برچسب زنیت */}
          <Text2 x={CENTER} y={CENTER - 4} fontSize={8} fill={theme.colors.textMuted} textAnchor="middle">{t ? t('saZenith') : 'Zenith'}</Text2>

          {/* مسیر خورشید و ماه */}
          {sunPath ? <Path d={sunPath} stroke={theme.colors.ember} strokeWidth={1.5} strokeDasharray="1,3" fill="none" opacity={0.6} /> : null}
          {moonPath ? <Path d={moonPath} stroke="#5B9BD5" strokeWidth={1.5} strokeDasharray="1,3" fill="none" opacity={0.6} /> : null}

          {/* نقطه‌ی ثابت غروب خورشید و غروب ماه روی افق */}
          {sunsetPos ? (
            <Circle cx={sunsetPos.x} cy={sunsetPos.y} r={4} fill="none" stroke={theme.colors.ember} strokeWidth={1.5} />
          ) : null}
          {moonsetPos ? (
            <Circle cx={moonsetPos.x} cy={moonsetPos.y} r={4} fill="none" stroke={theme.colors.danger} strokeWidth={1.5} />
          ) : null}

          {/* موقعیت فعلی خورشید — با هاله‌ی ملایم برای حس درخشش */}
          {sunPos && point.sunAltitude > -18 ? (
            <G opacity={point.sunAltitude < 0 ? 0.4 : 0.9}>
              <Circle cx={sunPos.x} cy={sunPos.y} r={11} fill={theme.colors.ember} opacity={0.25} />
              <Circle cx={sunPos.x} cy={sunPos.y} r={7} fill={theme.colors.ember} />
            </G>
          ) : null}

          {/* موقعیت فعلی ماه — هلال با ضخامت متناسب با روشنایی واقعی */}
          {moonPos ? (
            <G opacity={point.moonAltitude < 0 ? 0.35 : 1}>
              <Circle cx={moonPos.x} cy={moonPos.y} r={9} fill={theme.colors.gold} opacity={0.18} />
              <Circle cx={moonPos.x} cy={moonPos.y} r={8} fill={theme.colors.gold} />
              <G clipPath="url(#moonOuterClip)">
                <Circle cx={moonPos.x + 8 * offsetRatio} cy={moonPos.y - 1} r={8} fill={sky.bottom} />
              </G>
            </G>
          ) : null}

          {/* خط راهنما از مرکز به ماه: فاصله‌ی زاویه‌ای بصری از زنیت */}
          {moonPos ? <Line x1={CENTER} y1={CENTER} x2={moonPos.x} y2={moonPos.y} stroke={theme.colors.gold} strokeWidth={0.5} strokeDasharray="1,2" opacity={0.3} /> : null}
        </Svg>
      </View>

      {point ? (
        <View style={st.readout}>
          <View style={st.readoutRow}>
            <View style={[st.readoutDot, { backgroundColor: theme.colors.gold }]} />
            <Text style={st.readoutT}>{'🌙 ' + (point.moonAltitude !== null ? point.moonAltitude.toFixed(1) + '°' : '---') + ' / ' + (point.moonAzimuth !== null ? point.moonAzimuth.toFixed(0) + '°' : '---')}</Text>
          </View>
          <View style={st.readoutRow}>
            <View style={[st.readoutDot, { backgroundColor: theme.colors.ember }]} />
            <Text style={st.readoutT}>{'☀️ ' + (point.sunAltitude !== null ? point.sunAltitude.toFixed(1) + '°' : '---') + ' / ' + (point.sunAzimuth !== null ? point.sunAzimuth.toFixed(0) + '°' : '---')}</Text>
          </View>
        </View>
      ) : null}

      {/* راهنمای نمادها — اکنون پشت دکمه‌ی «ⓘ» جمع/باز می‌شود (بهبود
          این نسخه: قبلاً همیشه ۶ ردیف کامل فضا می‌گرفت) */}
      <TouchableOpacity style={st.legendToggle} onPress={function () { setShowLegend(!showLegend); }}>
        <Text style={st.legendToggleT}>{(showLegend ? '▲ ' : '▼ ') + 'ⓘ ' + (t ? t('saSkyHint') : 'Legend')}</Text>
      </TouchableOpacity>

      {showLegend ? (
        <View style={st.legend}>
          <View style={st.legendRow}>
            <View style={[st.legendSwatch, { backgroundColor: theme.colors.gold }]} />
            <Text style={st.legendT}>{t ? t('saLegendMoonNow') : 'Moon now'}</Text>
          </View>
          <View style={st.legendRow}>
            <View style={[st.legendSwatch, { backgroundColor: theme.colors.ember }]} />
            <Text style={st.legendT}>{t ? t('saLegendSunNow') : 'Sun now'}</Text>
          </View>
          <View style={st.legendRow}>
            <View style={[st.legendSwatchRing, { borderColor: theme.colors.ember }]} />
            <Text style={st.legendT}>{t ? t('saLegendSunsetPoint') : 'Sunset point (fixed)'}</Text>
          </View>
          <View style={st.legendRow}>
            <View style={[st.legendSwatchRing, { borderColor: theme.colors.danger }]} />
            <Text style={st.legendT}>{t ? t('saLegendMoonsetPoint') : 'Moonset point (fixed)'}</Text>
          </View>
          <View style={st.legendRow}>
            <View style={[st.legendLine, { backgroundColor: '#5B9BD5' }]} />
            <Text style={st.legendT}>{t ? t('saLegendMoonPath') : "Moon's path tonight"}</Text>
          </View>
          <View style={st.legendRow}>
            <View style={[st.legendLine, { backgroundColor: theme.colors.ember }]} />
            <Text style={st.legendT}>{t ? t('saLegendSunPath') : "Sun's path tonight"}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

var st = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  readout: { flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm + 2 },
  readoutRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readoutDot: { width: 8, height: 8, borderRadius: 4 },
  readoutT: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, fontWeight: '600' },

  legendToggle: { marginTop: theme.spacing.md, paddingVertical: 4 },
  legendToggleT: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize, textAlign: 'center' },

  legend: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    width: '100%',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 3 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendSwatchRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, backgroundColor: 'transparent' },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendT: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize },
});