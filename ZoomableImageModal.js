import React, { useRef, useState } from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Animated, PanResponder, Dimensions } from 'react-native';
var Text = require('../design/ScaledText');

var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ============================================================
// نسخه ۳ — فاز ۳-ب: نمایشگر عکس تمام‌صفحه با قابلیت بزرگ‌نمایی/جابه‌جایی
//
// چرا لازم شد: عکس‌های گزارش استهلال در لیست با اندازه‌ی ثابت و
// برش‌خورده (crop) نمایش داده می‌شوند (طبق استایل reportPhoto:
// height 180). چون این عکس‌ها اغلب از موبایل با نسبت‌ابعاد بلند
// گرفته می‌شوند، بخش برش‌خورده ممکن است دقیقاً همان جایی باشد که
// هلال در آن دیده شده — پس کاربر نیاز دارد بتواند عکس کامل و
// بدون برش را با pinch-to-zoom ببیند.
//
// چرا بدون کتابخانه‌ی جانبی: پروژه هیچ‌کدام از
// react-native-gesture-handler، react-native-reanimated یا
// کتابخانه‌های مخصوص zoom (مثل react-native-image-zoom-viewer) را
// نصب نکرده. برای جلوگیری از نیاز به نصب/native-rebuild (که با
// Expo Go ممکن است سازگار نباشد)، این کامپوننت فقط از Animated و
// PanResponder داخل خودِ react-native استفاده می‌کند — هر دو از
// اول در دسترس‌اند و به هیچ پکیج اضافه‌ای نیاز ندارند.
//
// رفتار پشتیبانی‌شده:
//   - دو-انگشتی (pinch) برای zoom in/out
//   - دو-انگشتی pan وقتی zoom شده، برای جابه‌جایی و دیدن گوشه‌های عکس
//   - دبل‌تپ برای toggle بین حالت عادی و zoom×2.5
//   - دکمه‌ی بستن + تپ روی پس‌زمینه‌ی تیره برای بستن
// ============================================================

var SCREEN = Dimensions.get('window');
var MIN_SCALE = 1;
var MAX_SCALE = 4;
var DOUBLE_TAP_SCALE = 2.5;
var DOUBLE_TAP_DELAY_MS = 280;

function distanceBetweenTouches(touches) {
  var dx = touches[0].pageX - touches[1].pageX;
  var dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpointOfTouches(touches) {
  return {
    x: (touches[0].pageX + touches[1].pageX) / 2,
    y: (touches[0].pageY + touches[1].pageY) / 2,
  };
}

export default function ZoomableImageModal(props) {
  var visible = props.visible;
  var imageUri = props.imageUri;
  var onClose = props.onClose;
  var LCtx = useLanguage();
  var t = LCtx ? LCtx.t : function (k) { return k; };

  // مقدار فعلی scale/translate (هم به‌عنوان state معمولی برای محاسبات
  // ژست، هم به‌عنوان Animated.ValueXY/Value برای اعمال روی UI)
  var scaleRef = useRef(1);
  var translateRef = useRef({ x: 0, y: 0 });
  var lastDistanceRef = useRef(null);
  var lastMidpointRef = useRef(null);
  var lastTapTimeRef = useRef(0);
  var panStartRef = useRef({ x: 0, y: 0 });

  var animScale = useRef(new Animated.Value(1)).current;
  var animTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  var s1 = useState(1); var scaleTick = s1[0]; var setScaleTick = s1[1]; // فقط برای force re-render جزئی در صورت نیاز

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function applyTransform(scale, translate, animated) {
    scaleRef.current = scale;
    translateRef.current = translate;
    if (animated) {
      Animated.parallel([
        Animated.spring(animScale, { toValue: scale, useNativeDriver: true, friction: 7 }),
        Animated.spring(animTranslate, { toValue: translate, useNativeDriver: true, friction: 7 }),
      ]).start();
    } else {
      animScale.setValue(scale);
      animTranslate.setValue(translate);
    }
  }

  function resetTransform(animated) {
    applyTransform(1, { x: 0, y: 0 }, animated !== false);
  }

  function handleDoubleTap(touchX, touchY) {
    if (scaleRef.current > 1) {
      resetTransform(true);
    } else {
      // هنگام دبل‌تپ روی نقطه‌ی X: تصویر طوری zoom/جابه‌جا شود که آن
      // نقطه تقریباً همان‌جا (نزدیک مرکز) بماند.
      var targetScale = DOUBLE_TAP_SCALE;
      var cx = SCREEN.width / 2;
      var cy = SCREEN.height / 2;
      var tx = (cx - touchX) * (targetScale - 1);
      var ty = (cy - touchY) * (targetScale - 1);
      applyTransform(targetScale, { x: tx, y: ty }, true);
    }
  }

  var panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: function () { return true; },
      onMoveShouldSetPanResponder: function () { return true; },

      onPanResponderGrant: function (evt) {
        var touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          lastDistanceRef.current = distanceBetweenTouches(touches);
          lastMidpointRef.current = midpointOfTouches(touches);
        } else if (touches.length === 1) {
          panStartRef.current = {
            x: touches[0].pageX - translateRef.current.x,
            y: touches[0].pageY - translateRef.current.y,
          };
        }
      },

      onPanResponderMove: function (evt) {
        var touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // Pinch zoom
          var newDistance = distanceBetweenTouches(touches);
          if (lastDistanceRef.current) {
            var scaleDelta = newDistance / lastDistanceRef.current;
            var newScale = clamp(scaleRef.current * scaleDelta, MIN_SCALE, MAX_SCALE);
            applyTransform(newScale, translateRef.current, false);
          }
          lastDistanceRef.current = newDistance;
        } else if (touches.length === 1 && scaleRef.current > 1) {
          // Pan فقط وقتی zoom شده معنا دارد؛ در حالت عادی swipe باید
          // برای بستن مودال یا اسکرول لیست پشت آن آزاد بماند.
          var t = touches[0];
          var newX = t.pageX - panStartRef.current.x;
          var newY = t.pageY - panStartRef.current.y;
          applyTransform(scaleRef.current, { x: newX, y: newY }, false);
        }
      },

      onPanResponderRelease: function (evt, gestureState) {
        lastDistanceRef.current = null;

        var touches = evt.nativeEvent.changedTouches;
        var singleTapMove = Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8;

        if (singleTapMove && touches && touches.length === 1) {
          var now = Date.now();
          var tx = touches[0].pageX;
          var ty = touches[0].pageY;
          if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY_MS) {
            handleDoubleTap(tx, ty);
            lastTapTimeRef.current = 0;
          } else {
            lastTapTimeRef.current = now;
          }
        }

        // اگر بعد از pinch به کمتر از حالت عادی رسید، برگردان به حالت پایه
        if (scaleRef.current <= 1) {
          resetTransform(true);
        } else {
          // مرزهای translate را طوری محدود کن که تصویر بیش‌ازحد از دید خارج نشود
          var maxTranslateX = (SCREEN.width * (scaleRef.current - 1)) / 2;
          var maxTranslateY = (SCREEN.height * (scaleRef.current - 1)) / 2;
          var clampedX = clamp(translateRef.current.x, -maxTranslateX, maxTranslateX);
          var clampedY = clamp(translateRef.current.y, -maxTranslateY, maxTranslateY);
          applyTransform(scaleRef.current, { x: clampedX, y: clampedY }, true);
        }
      },
    })
  ).current;

  function handleRequestClose() {
    resetTransform(false);
    if (onClose) onClose();
  }

  if (!imageUri) return null;

  return (
    <Modal
      visible={!!visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleRequestClose}
      statusBarTranslucent={true}
    >
      <View style={st.backdrop}>
        <TouchableOpacity
          style={st.closeBtn}
          onPress={handleRequestClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        >
          <Text style={st.closeBtnT}>{'✕'}</Text>
        </TouchableOpacity>

        <View style={st.imageArea} {...panResponder.panHandlers}>
          <Animated.Image
            source={{ uri: imageUri }}
            style={[
              st.image,
              {
                transform: [
                  { translateX: animTranslate.x },
                  { translateY: animTranslate.y },
                  { scale: animScale },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        <Text style={st.hintT}>{t('zoomHint')}</Text>
      </View>
    </Modal>
  );
}

var st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center' },
  imageArea: { width: SCREEN.width, height: SCREEN.height, justifyContent: 'center', alignItems: 'center' },
  image: { width: SCREEN.width, height: SCREEN.height * 0.85 },
  closeBtn: {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnT: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  hintT: {
    position: 'absolute', bottom: 36, left: 24, right: 24,
    color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center',
  },
});
