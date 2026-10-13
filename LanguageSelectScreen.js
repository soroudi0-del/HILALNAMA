import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';

var Design = require('../design');
var theme = Design.theme;

// ============================================================
// LanguageSelectScreen — صفحه‌ی انتخاب زبان اولیه (فقط بار اول)
//
// چرا این صفحه لازم است:
//   قبلاً زبان اپ فقط از روی زبان سیستم‌عامل حدس زده می‌شد
//   (getDeviceLanguage در LanguageContext.js) و کاربر فقط از داخل
//   «تنظیمات» می‌توانست آن را عوض کند — یعنی اگر حدس اشتباه بود
//   (مثلاً زبان سیستم فارسی ولی کاربر عرب‌زبان بود)، او باید اول
//   محتوای زبان اشتباه را می‌دید و بعد به‌صورت فعال به تنظیمات
//   می‌رفت. این صفحه یک انتخاب صریح و آگاهانه را همان اولین لحظه
//   قرار می‌دهد.
//
// چرا فقط بار اول:
//   هر بار پرسیدن این سوال از کاربر آزاردهنده است. تصمیم با یک
//   فلگ در AsyncStorage (از طریق setLang(lang, {isInitialChoice:true})
//   در LanguageContext.js) دائمی می‌شود؛ App.js دیگر هیچ‌وقت این
//   صفحه را برای همین نصب نشان نمی‌دهد.
//
// طراحی بصری:
//   عمداً هم‌خانواده‌ی SplashScreen.js است (همان گرادیان
//   bgHeaderTop→bgHeader→bgPage، همان هلال SVG با تکنیک evenodd،
//   همان ستاره‌های چشمک‌زن) — چون این صفحه از نظر توالی، جزئی از
//   همان تجربه‌ی ورود اولیه است، نه یک مودال جدا و ناهماهنگ. سه
//   دکمه‌ی زبان با پرچم + نام بومی هر زبان، به ترتیب فارسی → عربی
//   → انگلیسی (فارسی اول، چون این زبان پیش‌فرض/اصلی اپ است).
// ============================================================

var SCREEN = Dimensions.get('window');

var LANGUAGES = [
  { code: 'fa', flag: '🇮🇷', name: 'فارسی', sub: 'Persian' },
  { code: 'ar', flag: '🇸🇦', name: 'العربیة', sub: 'Arabic' },
  { code: 'en', flag: '🇬🇧', name: 'English', sub: 'انگلیسی' },
];

export default function LanguageSelectScreen(props) {
  var onSelect = props.onSelect; // (langCode) => void — از App.js پاس داده می‌شود

  var fadeSky = useRef(new Animated.Value(0)).current;
  var contentFade = useRef(new Animated.Value(0)).current;
  var starTwinkle = useRef(new Animated.Value(0.4)).current;
  var s1 = useState(buildStars()); var stars = s1[0];
  var s2 = useState(null); var pressedCode = s2[0]; var setPressedCode = s2[1];

  useEffect(function () {
    Animated.timing(fadeSky, {
      toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(starTwinkle, { toValue: 0.9, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(starTwinkle, { toValue: 0.3, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(contentFade, {
      toValue: 1, duration: 650, delay: 300, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start();
  }, []);

  var handlePress = function (code) {
    if (pressedCode) return; // جلوگیری از دابل‌تپ حین انیمیشن خروج
    setPressedCode(code);
    // یک تأخیر کوتاه برای اینکه کاربر بازخورد بصری انتخابش را ببیند
    // (پس‌زمینه‌ی طلایی دکمه)، قبل از رفتن به مرحله‌ی بعد.
    setTimeout(function () {
      if (onSelect) onSelect(code);
    }, 180);
  };

  return (
    <View style={ls.container}>
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

      <Animated.View style={[sp.horizonWrap, { opacity: fadeSky }]} pointerEvents="none">
        <Svg width={SCREEN.width} height={140} viewBox={'0 0 ' + SCREEN.width + ' 140'}>
          <Defs>
            <RadialGradient id="horizonGlowLS" cx="50%" cy="0%" r="75%">
              <Stop offset="0" stopColor={theme.colors.ember} stopOpacity="0.16" />
              <Stop offset="1" stopColor={theme.colors.ember} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={'M0 0 L' + SCREEN.width + ' 0 L' + SCREEN.width + ' 140 L0 140 Z'} fill="url(#horizonGlowLS)" />
          <Path
            d={'M0 46 Q ' + (SCREEN.width / 2) + ' 4, ' + SCREEN.width + ' 46 L' + SCREEN.width + ' 140 L0 140 Z'}
            fill={theme.colors.bgPage}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          ls.content,
          { opacity: contentFade, transform: [{ translateY: contentFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
        ]}
      >
        <Text style={ls.crescentIcon}>🌙</Text>

        <Text style={ls.title}>زبان را انتخاب کنید</Text>
        <Text style={ls.titleAr}>اختر اللغة</Text>
        <Text style={ls.titleEn}>Choose your language</Text>

        <View style={ls.optionsWrap}>
          {LANGUAGES.map(function (item) {
            var active = pressedCode === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                activeOpacity={0.85}
                style={[ls.option, active && ls.optionActive]}
                onPress={function () { handlePress(item.code); }}
              >
                <Text style={ls.optionFlag}>{item.flag}</Text>
                <View style={ls.optionTextWrap}>
                  <Text style={[ls.optionName, active && ls.optionNameActive]}>{item.name}</Text>
                  <Text style={[ls.optionSub, active && ls.optionSubActive]}>{item.sub}</Text>
                </View>
                <Text style={[ls.optionArrow, active && ls.optionArrowActive]}>{'‹'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={ls.hint}>{'می‌توانید بعداً از تنظیمات آن را تغییر دهید\nيمكنك تغييرها لاحقاً من الإعدادات\nYou can change this later in Settings'}</Text>
      </Animated.View>
    </View>
  );
}

function buildStars() {
  var stars = [];
  for (var i = 0; i < 40; i++) {
    stars.push({
      top: Math.random() * 55,
      left: Math.random() * 100,
      size: Math.random() * 1.8 + 0.8,
      baseOpacity: Math.random() * 0.6 + 0.3,
    });
  }
  return stars;
}

// استایل افق مشترک با SplashScreen (نگاشت مشابه، اسم متفاوت برای
// جلوگیری از تداخل در صورت import همزمان)
var sp = StyleSheet.create({
  horizonWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

var ls = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPage,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  crescentIcon: {
    fontSize: 46,
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.display.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleAr: {
    color: theme.colors.textSecondary,
    fontSize: theme.type.subtitle.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  titleEn: {
    color: theme.colors.textMuted,
    fontSize: theme.type.caption.fontSize,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  optionsWrap: {
    width: '100%',
    marginTop: theme.spacing.xxl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg - 2,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  optionFlag: {
    fontSize: 26,
    marginRight: theme.spacing.md,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionName: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
  },
  optionNameActive: {
    color: theme.colors.goldDark,
  },
  optionSub: {
    color: theme.colors.textMuted,
    fontSize: theme.type.caption.fontSize,
    marginTop: 2,
  },
  optionSubActive: {
    color: theme.colors.goldDark,
    opacity: 0.75,
  },
  optionArrow: {
    color: theme.colors.textMuted,
    fontSize: 20,
    fontWeight: '300',
    transform: [{ scaleX: -1 }],
  },
  optionArrowActive: {
    color: theme.colors.goldDark,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro.fontSize,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: theme.spacing.xl,
  },
});
