import React, { useState, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var Engine = require('../calculations/crescentAnalysisEngine');

var SkySimulation = require('./SkySimulation').default;
var TimelineModule = require('./Timeline');
var Timeline = TimelineModule.default;
var TIMELINE_LAYER_DEFS = TimelineModule.LAYER_DEFS;

var SCRUB_W_PAD = 14; // فاصله‌ی افقی از لبه‌ی کارت، برای جا دادن دستگیره

// ============================================================
// ExploreSection — بازطراحی SECTION 2 + SECTION 3 + SECTION 4 سند
// طراحی، که قبلاً سه بخش کاملاً جدا و هم‌وزن با فاصله‌ی زیاد روی
// صفحه بودند (Sky Simulation card، Timeline card، ردیف Play جدا).
//
// چرا ادغام: هر دو نما (آسمان و نمودار زمانی) دقیقاً یک زمان‌سنج
// مشترک (از useAnimationController) را نشان می‌دهند — نمایش
// هم‌زمان‌شان به‌صورت دو کارت جدا باعث می‌شد کاربر مجبور شود بین
// دو منبع بصری اسکرول کند تا یک مفهوم واحد را دنبال کند. این‌جا
// یک ناوبری تب‌دار (🌌 آسمان / 📈 نمودار) ساخته شده؛ Play/Pause و
// نشانگر زمان به‌عنوان نوار کنترل مشترک زیر هر دو تب ثابت می‌ماند
// (نه بین دو کارت شناور). دکمه‌های Compare و Layers هم به‌جای دو
// کارت جداگانه‌ی همیشه‌باز، به‌صورت آیکون‌های کوچک کنار تب‌ها به
// این بخش وصل شدند — چون هر دو ابزار کاوشِ همین نما هستند، نه
// محتوای مستقل.
//
// رفع باگ (بعد از گزارش کاربر):
//   ۱. «برای شبیه‌ساز آسمان دکمه‌ای با عنوان پخش از اول قرار داده
//      نشده» + «در نمودار زمانی می‌شود زمان را جلو/عقب برد ولی در
//      شبیه‌ساز آسمان نمی‌شود» — هر دو از یک نقص واحد می‌آیند: تب
//      آسمان هیچ نشانه‌ی بصری از «محور زمان» نداشت، پس دکمه‌ی پخشِ
//      زیرش بی‌ارجاع به نظر می‌رسید و هیچ راه لمسی برای جابه‌جایی
//      زمان (فقط چرخش آسمان، که کاملاً کار متفاوتی است) وجود
//      نداشت. راه‌حل: MiniScrubBar — یک نوار افقی جمع‌وجور که
//      همیشه، در هر دو تب، زیر محتوا نمایش داده می‌شود، قابل کشیدن
//      است (دقیقاً با همان منطق نگاشت زمان Timeline.js)، و نشانگرهای
//      غروب خورشید/بهترین‌زمان/غروب ماه را روی خودش نشان می‌دهد —
//      یعنی حالا دکمه‌ی پخش، یک محور واقعی زیر خودش دارد که به آن
//      اشاره کند، در هر دو تب.
//   ۲. دکمه‌ی «بازنشانی چرخش» قبلاً فقط وقتی skyRotation !== 0 بود
//      نمایش داده می‌شد — یعنی همیشه، پیش از اولین چرخش، وجود
//      نداشت و کاربر نمی‌دانست چنین قابلیتی هست. اکنون همیشه در
//      دید است (غیرفعال/کم‌رنگ وقتی چرخشی برای بازنشانی نیست).
//
// props:
//   points, sunsetPoint, moonsetPoint, sunset, moonset, bestTime,
//   twilights, chartWidth, isRTL, t
//   anim          - خروجی useAnimationController (از parent)
//   activeLayers, onToggleLayer
//   skyRotation, onRotateSky, onResetRotation
//   compareA, compareB, compareDiff, onMarkCompare, onResetCompare
//   fmtTime
// ============================================================

export default function ExploreSection(props) {
  var t = props.t;
  var isRTL = props.isRTL;
  var textAlign = isRTL ? 'right' : 'left';
  var anim = props.anim;

  var s1 = useState('sky'); var tab = s1[0]; var setTab = s1[1];
  var s2 = useState(false); var showLayers = s2[0]; var setShowLayers = s2[1];
  var s3 = useState(false); var showCompare = s3[0]; var setShowCompare = s3[1];

  var compareActive = !!(props.compareA || props.compareB);

  return (
    <Design.Card variant="deep" style={st.card}>
      <View style={st.tabRow}>
        <TouchableOpacity style={[st.tabBtn, tab === 'sky' && st.tabBtnActive]} onPress={function () { setTab('sky'); }}>
          <Text style={[st.tabT, tab === 'sky' && st.tabTActive]}>{'🌌 ' + t('saSkySimulation')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.tabBtn, tab === 'timeline' && st.tabBtnActive]} onPress={function () { setTab('timeline'); }}>
          <Text style={[st.tabT, tab === 'timeline' && st.tabTActive]}>{'📈 ' + t('saTimeline')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.iconBtn, compareActive && st.iconBtnActive]}
          onPress={function () { setShowCompare(!showCompare); }}
        >
          <Text style={[st.iconBtnT, compareActive && st.iconBtnTActive]}>{'⇄'}</Text>
        </TouchableOpacity>
        {tab === 'timeline' ? (
          <TouchableOpacity style={[st.iconBtn, showLayers && st.iconBtnActive]} onPress={function () { setShowLayers(!showLayers); }}>
            <Text style={[st.iconBtnT, showLayers && st.iconBtnTActive]}>{'☰'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={st.body}>
        {tab === 'sky' ? (
          <View style={st.skyWrap}>
            <SkySimulation
              point={anim.cursorPoint}
              sunsetPoint={props.sunsetPoint}
              moonsetPoint={props.moonsetPoint}
              pathPoints={props.points}
              rotation={props.skyRotation}
              onRotate={props.onRotateSky}
              isRTL={isRTL}
              t={t}
            />
            {/* بازنشانی چرخش — رفع باگ گزارش‌شده: قبلاً این دکمه فقط
                بعد از اولین چرخش دستی ظاهر می‌شد، پس کاربر از وجودش
                خبر نداشت. اکنون همیشه در دید است؛ وقتی چرخشی برای
                بازنشانی نیست فقط کم‌رنگ/غیرفعال می‌شود. */}
            <TouchableOpacity
              style={[st.resetRotationBtn, props.skyRotation === 0 && st.resetRotationBtnDisabled]}
              onPress={props.onResetRotation}
              disabled={props.skyRotation === 0}
            >
              <Text style={[st.resetRotationBtnT, props.skyRotation === 0 && st.resetRotationBtnTDisabled]}>
                {'↺ ' + t('saResetRotation')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={st.timelineWrap}>
            <Timeline
              points={props.points}
              sunset={props.sunset}
              moonset={props.moonset}
              bestTime={props.bestTime}
              twilights={props.twilights}
              cursorTime={anim.cursorTime}
              onScrub={anim.scrub}
              activeLayers={props.activeLayers}
              width={props.chartWidth}
            />
            {showLayers ? (
              <View style={st.layerPanel}>
                {TIMELINE_LAYER_DEFS.map(function (layer) {
                  var on = !!props.activeLayers[layer.key];
                  return (
                    <TouchableOpacity key={layer.key} style={st.layerRow} onPress={function () { props.onToggleLayer(layer.key); }}>
                      <View style={[st.layerCheck, on && { backgroundColor: layer.color, borderColor: layer.color }]}>
                        {on ? <Text style={st.layerCheckT}>✓</Text> : null}
                      </View>
                      <View style={[st.layerDot, { backgroundColor: layer.color }]} />
                      <Text style={[st.layerLabel, !on && st.layerLabelOff]}>{t(layer.labelKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}

        {/* نوار کوچک کشیدنی زمان — همیشه زیر هر دو تب، رفع باگ
            گزارش‌شده («در شبیه‌ساز آسمان نمی‌شود زمان را جلو/عقب
            برد»). دقیقاً همان منطق نگاشت زمان Timeline.js را دارد،
            فقط جمع‌وجورتر و بدون منحنی‌های داده — صرفاً یک محور
            زمان با نشانگرهای غروب/بهترین‌زمان/غروب‌ماه. */}
        <MiniScrubBar
          points={props.points}
          sunset={props.sunset}
          moonset={props.moonset}
          bestTime={props.bestTime}
          cursorTime={anim.cursorTime}
          onScrub={anim.scrub}
          width={props.chartWidth}
        />

        {/* نوار کنترل مشترک — همیشه زیر هر دو تب، نه بین دو کارت جدا.
            Button سیستم طراحی (variant="primary") به‌جای
            TouchableOpacity دستی، تا با سایر CTAهای اپ یکسان بماند. */}
        <View style={st.controlRow}>
          <Design.Button variant="primary" style={st.playBtn} onPress={anim.toggle}>
            {anim.playing ? '⏸ ' + t('saPause') : '▶ ' + t('saPlay')}
          </Design.Button>
          {anim.cursorTime ? <Text style={st.cursorTimeT}>{props.fmtTime(anim.cursorTime)}</Text> : null}
        </View>

        {/* تولتیپ لحظه‌ی انتخاب‌شده — SECTION 7 */}
        {anim.cursorPoint ? (
          <View style={st.tooltip}>
            <TR l={t('saLayerMoonAlt')} v={anim.cursorPoint.moonAltitude !== null ? anim.cursorPoint.moonAltitude.toFixed(1) + '°' : '---'} />
            <TR l={t('saLayerSunAlt')} v={anim.cursorPoint.sunAltitude !== null ? anim.cursorPoint.sunAltitude.toFixed(1) + '°' : '---'} />
            <TR l={t('saLayerArcv')} v={anim.cursorPoint.arcv !== null ? anim.cursorPoint.arcv.toFixed(1) + '°' : '---'} />
            <TR l={t('saLayerElong')} v={anim.cursorPoint.elongationTopo !== null ? anim.cursorPoint.elongationTopo.toFixed(1) + '°' : '---'} />
          </View>
        ) : null}

        {showCompare ? (
          <View style={st.comparePanel}>
            <View style={st.compareHeaderRow}>
              <Text style={[st.compareTitle, { textAlign: textAlign }]}>{t('saCompareTitle')}</Text>
              <TouchableOpacity onPress={props.onResetCompare}>
                <Text style={st.compareResetT}>{t('saCompareReset')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[st.compareHint, { textAlign: textAlign }]}>{t('saCompareHint')}</Text>
            <View style={st.compareSlotsRow}>
              <View style={st.compareSlot}>
                <Text style={st.compareSlotLabel}>A</Text>
                <Text style={st.compareSlotValue}>{props.compareA ? props.fmtTime(props.compareA.time) : '---'}</Text>
              </View>
              <View style={st.compareSlot}>
                <Text style={st.compareSlotLabel}>B</Text>
                <Text style={st.compareSlotValue}>{props.compareB ? props.fmtTime(props.compareB.time) : '---'}</Text>
              </View>
              <TouchableOpacity style={st.compareMarkBtn} onPress={props.onMarkCompare}>
                <Text style={st.compareMarkBtnT}>{'⊕ ' + t('saMarkForCompare')}</Text>
              </TouchableOpacity>
            </View>
            {props.compareDiff ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <TR l={t('saLayerMoonAlt')} v={fmtSigned(props.compareDiff.moonAltitude)} />
                <TR l={t('saLayerSunAlt')} v={fmtSigned(props.compareDiff.sunAltitude)} />
                <TR l={t('saLayerArcv')} v={fmtSigned(props.compareDiff.arcv)} />
                <TR l={t('saLayerElong')} v={fmtSigned(props.compareDiff.elongationTopo)} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Design.Card>
  );
}

function fmtSigned(v) {
  if (v === null || v === undefined || isNaN(v)) return '---';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '°';
}

// ------------------------------------------------------------
// MiniScrubBar — کنترل زمان جمع‌وجور و همیشه‌دردسترس، مستقل از
// تب فعال. رفع باگ گزارش‌شده: قبلاً فقط Timeline (به‌خاطر منحنی‌های
// رسم‌شده‌اش) قابل کشیدن بود؛ Sky Simulation فقط چرخش (rotation)
// را با کشیدن پشتیبانی می‌کرد که کاملاً کار متفاوتی است (نه جابه‌جا
// کردن زمان). این کامپوننت همان نگاشت خطی زمان→پیکسل Timeline.js
// را با یک نوار باریک (بدون منحنی) بازتولید می‌کند تا هر دو تب یک
// محور زمان مشترک و همیشه در دسترس داشته باشند.
// ------------------------------------------------------------
var SCRUB_H = 34;
var SCRUB_TRACK_H = 5;

function MiniScrubBar(props) {
  var points = props.points || [];
  var width = props.width || 260;
  var cursorTime = props.cursorTime;
  var onScrub = props.onScrub;

  var t0 = points.length ? points[0].time.getTime() : 0;
  var t1 = points.length ? points[points.length - 1].time.getTime() : 1;
  var usableW = width - SCRUB_W_PAD * 2;

  var scaleX = function (timeMs) {
    var frac = (timeMs - t0) / (t1 - t0 || 1);
    return SCRUB_W_PAD + Math.min(1, Math.max(0, frac)) * usableW;
  };

  var handleTouch = function (evt) {
    if (!points.length || !onScrub) return;
    var x = evt.nativeEvent.locationX;
    var frac = (x - SCRUB_W_PAD) / usableW;
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
  var sunsetX = props.sunset ? scaleX(props.sunset.getTime()) : null;
  var bestX = props.bestTime ? scaleX(props.bestTime.getTime()) : null;
  var moonsetX = props.moonset ? scaleX(props.moonset.getTime()) : null;

  return (
    <View style={st.scrubWrap} {...panResponder.panHandlers}>
      <View style={[st.scrubTrack, { width: width }]}>
        {sunsetX !== null ? <View style={[st.scrubTick, { left: sunsetX - 1, backgroundColor: theme.colors.textMuted }]} /> : null}
        {moonsetX !== null ? <View style={[st.scrubTick, { left: moonsetX - 1, backgroundColor: theme.colors.danger }]} /> : null}
        {bestX !== null ? <View style={[st.scrubTickBest, { left: bestX - 1.5 }]} /> : null}
        {cursorX !== null ? (
          <View style={[st.scrubHandle, { left: cursorX - 8 }]}>
            <View style={st.scrubHandleDot} />
          </View>
        ) : null}
      </View>
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
  card: { padding: 0, overflow: 'hidden' },

  tabRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.gold },
  tabT: { color: theme.colors.textMuted, fontSize: theme.type.label.fontSize, fontWeight: '600' },
  tabTActive: { color: theme.colors.gold },
  iconBtn: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: {},
  iconBtnT: { color: theme.colors.textMuted, fontSize: theme.type.subtitle.fontSize },
  iconBtnTActive: { color: theme.colors.gold },

  body: { padding: theme.spacing.xl - 2 },
  skyWrap: { alignItems: 'center' },
  timelineWrap: { alignItems: 'center' },

  resetRotationBtn: { marginTop: 10, backgroundColor: theme.colors.bgCard, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.pill - 4, borderWidth: 1, borderColor: theme.colors.border },
  resetRotationBtnT: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize },
  resetRotationBtnDisabled: { opacity: 0.35 },
  resetRotationBtnTDisabled: { color: theme.colors.textMuted },

  scrubWrap: { width: '100%', marginTop: theme.spacing.md, alignItems: 'center', height: SCRUB_H, justifyContent: 'center' },
  scrubTrack: { height: SCRUB_TRACK_H, borderRadius: SCRUB_TRACK_H / 2, backgroundColor: theme.colors.bgCardDeep, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  scrubTick: { position: 'absolute', top: -2, width: 2, height: SCRUB_TRACK_H + 4, borderRadius: 1 },
  scrubTickBest: { position: 'absolute', top: -4, width: 3, height: SCRUB_TRACK_H + 8, borderRadius: 1.5, backgroundColor: theme.colors.gold },
  scrubHandle: { position: 'absolute', top: -12, width: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.bgCard },
  scrubHandleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.goldDark },

  layerPanel: { width: '100%', marginTop: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
  layerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  layerCheck: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  layerCheckT: { color: theme.colors.bgPage, fontSize: theme.type.caption.fontSize, fontWeight: 'bold' },
  layerDot: { width: 9, height: 9, borderRadius: 5 },
  layerLabel: { color: theme.colors.textPrimary, fontSize: theme.type.label.fontSize, flex: 1 },
  layerLabelOff: { color: theme.colors.textMuted },

  controlRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.md, justifyContent: 'center' },
  playBtn: { marginBottom: 0, paddingHorizontal: theme.spacing.xl, minWidth: 120 },
  cursorTimeT: { color: theme.colors.textPrimary, fontSize: theme.type.title.fontSize, fontWeight: theme.type.title.fontWeight },

  tooltip: { width: '100%', marginTop: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },

  tr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  trL: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, flex: 1 },
  trV: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: theme.type.body.fontWeight, flex: 1, textAlign: 'left' },

  comparePanel: { width: '100%', marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
  compareHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareTitle: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight },
  compareResetT: { color: theme.colors.textLink, fontSize: theme.type.caption.fontSize },
  compareHint: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize, marginTop: 4, marginBottom: theme.spacing.sm, lineHeight: 17 },
  compareSlotsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  compareSlot: { flex: 1, backgroundColor: theme.colors.bgCardDeep, borderRadius: theme.radius.sm, padding: 10, alignItems: 'center' },
  compareSlotLabel: { color: theme.colors.gold, fontSize: theme.type.caption.fontSize, fontWeight: 'bold' },
  compareSlotValue: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: '600', marginTop: 2 },
  compareMarkBtn: { alignItems: 'center', backgroundColor: theme.colors.bgCardDeep, borderRadius: theme.radius.sm, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border },
  compareMarkBtnT: { color: theme.colors.gold, fontSize: theme.type.caption.fontSize, fontWeight: 'bold' },
});