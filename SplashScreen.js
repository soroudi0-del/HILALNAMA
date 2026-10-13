import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

var Design = require('../design');
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;
var theme = Design.theme;

// ============================================================
// نسخه ۳ — بازطراحی کامل اسپلش‌اسکرین
//
// چرا این بازنویسی لازم بود:
//   ۱. باگ نمایشی: متن نسخه هاردکد «نسخه ۲.۱» بود، در حالی که کل
//      اپ (کامنت‌ها، ساختار، سیستم طراحی) نسخه ۳ است — کاربر در
//      همان اولین ثانیه‌ی باز کردن اپ عدد اشتباه می‌دید.
//   ۲. ناهماهنگی بصری: این تنها صفحه‌ی باقی‌مانده در کل اپ بود که
//      از theme.js (سیستم طراحی مرکزی نسخه ۳) استفاده نمی‌کرد —
//      رنگ‌ها/فونت‌ها مستقیم و پراکنده هاردکد شده بودند
//      (#050D1A، #C9A84C و...)، دقیقاً همان مشکلی که theme.js برای
//      حل آن ساخته شد.
//   ۳. هویت بصری عمومی: ایموجی 🌙 ساده + ستاره‌های تصادفی پراکنده
//      هیچ ارتباطی با موضوع واقعی اپ (محاسبات نجومی رؤیت هلال)
//      نداشت — می‌توانست اسپلش هر اپ نجومی دیگری باشد.
//
// جهت طراحی جدید: به‌جای یک هلال کارتونی، از خودِ زبان بصری اپ
// استفاده شده — یک هلال SVG واقعی (همان تکنیک CrescentBadge.js:
// دایره‌ی بیرونی منهای دایره‌ی داخلی جابه‌جاشده) روی یک افق محو،
// دقیقاً همان صحنه‌ای که در صفحه‌ی اصلی محاسبه و توصیف می‌شود:
// لحظه‌ی غروب خورشید که هلال در آن رصد می‌شود. این اسپلش را از یک
// «صفحه‌ی برند جدا» به «پیش‌درآمد بصری صفحه‌ی اصلی» تبدیل می‌کند.
//
// توالی حرکت (choreographed، نه پراکنده):
//   ۱. افق و آسمان محو ظاهر می‌شوند (پس‌زمینه)
//   ۲. هلال از پشت افق «طلوع» می‌کند (translateY + fade + scale)
//   ۳. یک تلألؤ نرم (glow) دور هلال شروع به تپش می‌کند
//   ۴. نام برند و عنوان اپ ظاهر می‌شوند
//   ۵. آیه/جمله‌ی پایانی محو ظاهر می‌شود
//   ۶. گذار به صفحه‌ی اصلی
// ============================================================

var SCREEN = Dimensions.get('window');

export default function SplashScreen(props) {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var fadeSky = useRef(new Animated.Value(0)).current;
  var moonRise = useRef(new Animated.Value(0)).current;   // 0 → 1: طلوع هلال از پشت افق
  var moonGlow = useRef(new Animated.Value(0.35)).current; // تپش نرم نور هلال
  var textFade = useRef(new Animated.Value(0)).current;
  var verseFade = useRef(new Animated.Value(0)).current;
  var starTwinkle = useRef(new Animated.Value(0.4)).current;

  var s1 = useState(buildStars()); var stars = s1[0];

  useEffect(function () {
    // مرحله ۱: آسمان و افق محو ظاهر شوند
    Animated.timing(fadeSky, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // چشمک ملایم و مداوم ستاره‌ها — در پس‌زمینه، مستقل از بقیه‌ی توالی
    Animated.loop(
      Animated.sequence([
        Animated.timing(starTwinkle, { toValue: 0.9, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(starTwinkle, { toValue: 0.3, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // مرحله ۲: هلال از پشت افق طلوع می‌کند (کمی بعد از آسمان)
    setTimeout(function () {
      Animated.timing(moonRise, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.back(0.9)),
        useNativeDriver: true,
      }).start();
    }, 350);

    // مرحله ۳: بعد از رسیدن هلال به جای خودش، تلألؤ نرم و مداوم شروع شود
    setTimeout(function () {
      Animated.loop(
        Animated.sequence([
          Animated.timing(moonGlow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(moonGlow, { toValue: 0.45, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    }, 1450);

    // مرحله ۴: نام برند
    setTimeout(function () {
      Animated.timing(textFade, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 1200);

    // مرحله ۵: جمله‌ی پایانی
    setTimeout(function () {
      Animated.timing(verseFade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 1900);

    // مرحله ۶: گذار به صفحه‌ی اصلی
    var exitTimer = setTimeout(function () {
      if (props.onFinish) props.onFinish();
    }, 3600);

    return function () { clearTimeout(exitTimer); };
  }, []);

  // هلال از کمی پایین‌تر از جای نهایی‌اش با شفافیت صفر شروع می‌کند
  // و با مقیاس کوچک‌تر «طلوع» می‌کند — دقیقاً حس یک جسم نجومی که از
  // افق بالا می‌آید، نه یک آیکون که فقط fade-in می‌شود.
  var moonTranslateY = moonRise.interpolate({ inputRange: [0, 1], outputRange: [46, 0] });
  var moonOpacity = moonRise;
  var moonScale = moonRise.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <View style={sp.container}>
      <LinearGradient
        colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeSky }]}>
        {stars.map(function (s, i) {
          return (
            <Animated.View
              key={'star' + i}
              style={{
                position: 'absolute',
                top: s.top + '%',
                left: s.left + '%',
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                backgroundColor: theme.colors.textPrimary,
                opacity: Animated.multiply(starTwinkle, s.baseOpacity),
              }}
            />
          );
        })}
      </Animated.View>

      {/* منحنی افق — همان خط غروبی که در صفحه‌ی اصلی محاسبه می‌شود،
          اینجا به‌عنوان یک عنصر بصری ثابت و آرام در پایین صحنه */}
      <Animated.View style={[sp.horizonWrap, { opacity: fadeSky }]} pointerEvents="none">
        <Svg width={SCREEN.width} height={140} viewBox={'0 0 ' + SCREEN.width + ' 140'}>
          <Defs>
            <RadialGradient id="horizonGlow" cx="50%" cy="0%" r="75%">
              <Stop offset="0" stopColor={theme.colors.ember} stopOpacity="0.16" />
              <Stop offset="1" stopColor={theme.colors.ember} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={'M0 0 L' + SCREEN.width + ' 0 L' + SCREEN.width + ' 140 L0 140 Z'} fill="url(#horizonGlow)" />
          <Path
            d={'M0 46 Q ' + (SCREEN.width / 2) + ' 4, ' + SCREEN.width + ' 46 L' + SCREEN.width + ' 140 L0 140 Z'}
            fill={theme.colors.bgPage}
          />
        </Svg>
      </Animated.View>

      {/* هلال — طلوع از پشت افق، با تلألؤ نرم و مداوم */}
      <Animated.View
        style={[
          sp.moonWrap,
          {
            opacity: moonOpacity,
            transform: [{ translateY: moonTranslateY }, { scale: moonScale }],
          },
        ]}
      >
        <CrescentGlyph glowValue={moonGlow} />
      </Animated.View>

      {/* نام برند و عنوان اپ */}
      <Animated.View style={[sp.brandBox, { opacity: textFade, transform: [{ translateY: textFade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        <Text style={sp.appName}>هلال‌نما</Text>
        <Text style={sp.appTagline}>{t('splashTagline')}</Text>
        <View style={sp.brandDivider} />
        <Text style={sp.brandNameEn}>HILALNAMA</Text>
        <Text style={sp.appTaglineEn}>SMART CRESCENT OBSERVATION PLATFORM</Text>
      </Animated.View>

      {/* جمله‌ی پایانی */}
      <Animated.View style={[sp.verseBox, { opacity: verseFade }]}>
        <Text style={sp.verseText}>
          {t('splashVerse')}
        </Text>
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------
// هلال SVG — همان تکنیک CrescentBadge.js (دایره‌ی بیرونی منهای
// دایره‌ی داخلی جابه‌جاشده، evenodd) تا زبان بصری اسپلش با
// مهم‌ترین نماد بصری خودِ اپ (نتیجه‌ی رؤیت در HomeScreen) یکی
// باشد، نه یک هلال کارتونی جداگانه.
// ------------------------------------------------------------
function CrescentGlyph(props) {
  var size = 104;
  var r = size / 2;
  var pathD =
    'M ' + r + ' 3 ' +
    'A ' + (r - 3) + ' ' + (r - 3) + ' 0 1 1 ' + r + ' ' + (size - 3) + ' ' +
    'A ' + (r * 0.68) + ' ' + (r * 0.68) + ' 0 1 0 ' + r + ' 3 Z';

  var glowOpacity = props.glowValue.interpolate({ inputRange: [0.35, 1], outputRange: [0.25, 0.65] });
  var glowScale = props.glowValue.interpolate({ inputRange: [0.35, 1], outputRange: [1, 1.18] });

  return (
    <View style={{ width: size + 60, height: size + 60, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size + 60,
          height: size + 60,
          borderRadius: (size + 60) / 2,
          backgroundColor: theme.colors.gold,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      />
      <Svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <Defs>
          <RadialGradient id="crescentFill" cx="35%" cy="35%" r="75%">
            <Stop offset="0" stopColor={theme.colors.gold} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.colors.ember} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Path d={pathD} fill="url(#crescentFill)" fillRule="evenodd" />
      </Svg>
    </View>
  );
}

function buildStars() {
  var stars = [];
  for (var i = 0; i < 40; i++) {
    stars.push({
      top: Math.random() * 62, // فقط در نیمه‌ی بالای صحنه — پایین صحنه افق است، نه آسمان
      left: Math.random() * 100,
      size: Math.random() * 1.8 + 0.8,
      baseOpacity: Math.random() * 0.6 + 0.3,
    });
  }
  return stars;
}

var sp = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPage,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  horizonWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  moonWrap: {
    marginBottom: theme.spacing.xxl + 14,
  },
  brandBox: {
    alignItems: 'center',
  },
  appName: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.display.fontSize + 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  appTagline: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: theme.spacing.xs,
    letterSpacing: 0.3,
  },
  brandDivider: {
    width: 28,
    height: 1,
    backgroundColor: theme.colors.borderGoldSubtle,
    marginVertical: theme.spacing.md,
  },
  brandNameEn: {
    color: theme.colors.gold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 4,
  },
  appTaglineEn: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.4,
    marginTop: theme.spacing.xs,
  },
  verseBox: {
    position: 'absolute',
    bottom: 64,
    paddingHorizontal: theme.spacing.xxl + 6,
  },
  verseText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
});