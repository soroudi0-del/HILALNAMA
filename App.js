import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, I18nManager, Platform } from 'react-native';
var Text = require('./src/design/ScaledText');
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// غیرفعال کردن RTL سیستمی
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

import SplashScreen from './src/screens/SplashScreen';
import LanguageSelectScreen from './src/screens/LanguageSelectScreen';
import HomeScreen from './src/screens/HomeScreen';
import SightingReportScreen from './src/screens/SightingReportScreen';
import ObservationGuideScreen from './src/screens/ObservationGuideScreen';
import MapScreen from './src/screens/MapScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CrescentAnalysisScreen from './src/screens/CrescentAnalysisScreen';
import ReportExportScreen from './src/screens/ReportExportScreen';
import MoonNowScreen from './src/screens/MoonNowScreen';
import AimGuideScreen from './src/screens/AimGuideScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

var LP = require('./src/i18n/LanguageContext');
var LanguageProvider = LP.LanguageProvider;
var useLanguage = LP.useLanguage;

var Tab = createBottomTabNavigator();
var Stack = createNativeStackNavigator();

function MainTabs(props) {
  var t = props.t;
  var tabBarHeight = props.tabBarHeight;
  var bottomInset = props.bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B1120' },
        headerTintColor: '#C9A84C',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 16 },
        tabBarStyle: {
          backgroundColor: '#0B1120',
          borderTopColor: '#1a2a4a',
          borderTopWidth: 1,
          height: tabBarHeight,
          // paddingBottom باید به اندازه inset پایین باشد تا زیر gesture bar نرود
          paddingBottom: bottomInset > 0 ? bottomInset + 4 : 8,
          paddingTop: 6,
          // position absolute باعث می‌شود روی محتوا نرود
          // اما برای حل مشکل gesture navigation بهتر است relative بماند
        },
        // این گزینه مهم است: به navigator می‌گوید safe area را خودش مدیریت کند
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#C9A84C',
        tabBarInactiveTintColor: '#4a5a7a',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{
          headerTitle: t('headerHome'),
          tabBarLabel: t('tabHome'),
          tabBarAccessibilityLabel: t('tabHome'),
          tabBarIcon: function () { return <Text style={{ fontSize: 22 }}>🏠</Text>; },
        }}
      />
      {/* نسخه ۳ — فاز ۳-و: قبلاً این تب هم دقیقاً از همان ایموجی 🌙
          تب Home استفاده می‌کرد و در نوار پایین از هم قابل تشخیص
          نبودند. 🌒 (هلال) هم موضوعاً مرتبط با «استهلال» باقی
          می‌ماند و هم بصری متفاوت از 🌙 تب خانه است. */}
      <Tab.Screen name="SightingReport" component={SightingReportScreen}
        options={{
          headerTitle: t('headerSightingReport'),
          tabBarLabel: t('tabSightingReport'),
          tabBarAccessibilityLabel: t('tabSightingReport'),
          tabBarIcon: function () { return <Text style={{ fontSize: 22 }}>🌙</Text>; },
        }}
      />
      <Tab.Screen name="Map" component={MapScreen}
        options={{
          headerTitle: t('headerMap'),
          tabBarLabel: t('tabMap'),
          tabBarAccessibilityLabel: t('tabMap'),
          tabBarIcon: function () { return <Text style={{ fontSize: 22 }}>🗺️</Text>; },
        }}
      />
      <Tab.Screen name="Guide" component={ObservationGuideScreen}
        options={{
          headerTitle: t('headerGuide'),
          tabBarLabel: t('tabGuide'),
          tabBarAccessibilityLabel: t('tabGuide'),
          tabBarIcon: function () { return <Text style={{ fontSize: 22 }}>🔭</Text>; },
        }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{
          headerTitle: t('headerSettings'),
          tabBarLabel: t('tabSettings'),
          tabBarAccessibilityLabel: t('tabSettings'),
          tabBarIcon: function () { return <Text style={{ fontSize: 22 }}>⚙️</Text>; },
        }}
      />
    </Tab.Navigator>
  );
}

function MainApp() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var loaded = LCtx.loaded;
  var setLang = LCtx.setLang;
  var hasChosenLanguage = LCtx.hasChosenLanguage;

  // دریافت safe area insets برای مدیریت gesture navigation bar
  var insets = useSafeAreaInsets();

  var s1 = useState(true);
  var showSplash = s1[0];
  var setShowSplash = s1[1];

  // loaded=false یعنی هنوز appLanguage از AsyncStorage خوانده نشده
  // (و به تبع آن hasChosenLanguage هم هنوز null است) — تا این لحظه
  // نمی‌دانیم کاربر قدیمی است یا اولین‌بار است، پس اسپیلنر ساده
  // نشان می‌دهیم تا از یک چشمک اشتباه (نمایش لحظه‌ای صفحه‌ی زبان
  // به کاربر قدیمی، یا برعکس) جلوگیری شود.
  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1120' }}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  // نسخه ۳ — Splash همیشه اول اجرا می‌شود (چه کاربر جدید باشد چه
  // قدیمی) چون معرف برند/هویت بصری اپ است و نباید مشروط به هیچ
  // تصمیمی (مثل انتخاب زبان) شود.
  if (showSplash) {
    return (
      <SplashScreen onFinish={function () { setShowSplash(false); }} />
    );
  }

  // نسخه ۳ — فاز ۳-ح: صفحه‌ی انتخاب زبان اولیه. فقط وقتی که هیچ
  // appLanguage ذخیره‌شده‌ای وجود ندارد (یعنی واقعاً اولین اجرای
  // این نصب است) و بعد از پایان Splash نمایش داده می‌شود؛ بعد از
  // یک انتخاب، setLang با {isInitialChoice:true} فراخوانی می‌شود که
  // هم زبان را ذخیره می‌کند و هم hasChosenLanguage را در کل عمر اپ
  // true نگه می‌دارد — این صفحه دیگر هرگز برای همین نصب ظاهر
  // نمی‌شود، حتی اگر کاربر بعداً زبان را از تنظیمات عوض کند.
  if (!hasChosenLanguage) {
    return (
      <LanguageSelectScreen
        onSelect={function (code) { setLang(code, { isInitialChoice: true }); }}
      />
    );
  }

  // محاسبه ارتفاع tab bar با احتساب inset پایین (gesture navigation bar)
  // insets.bottom روی اندروید gesture: معمولاً 24-48px
  // روی اندروید button: 0
  // روی iOS: 20-34px
  var bottomInset = insets.bottom || 0;
  var tabBarHeight = 60 + bottomInset;

  // نسخه ۳ — فاز ۳-ز: صفحه‌ی «تحلیل پیشرفته رؤیت هلال» یک تب
  // ششم نیست (فضای نوار پایین برای ۵ تب ثابت طراحی شده — نگاه
  // کنید به کامنت مشابه در SightingReportScreen.js). به‌جای آن،
  // یک Stack.Navigator بیرونی اضافه شد که Tab.Navigator قبلی را
  // به‌عنوان یک صفحه‌ی واحد ('MainTabs') در بر می‌گیرد، و
  // CrescentAnalysis صفحه‌ی دومِ همان Stack است — با
  // headerShown:false چون خودِ CrescentAnalysisScreen هدر/دکمه‌ی
  // برگشت اختصاصی خودش را دارد (همان الگوی floatingBack که در
  // SightingReportScreen.js هم استفاده شده). navigation.navigate
  // از هر تب می‌تواند مستقیم 'CrescentAnalysis' را روی این Stack
  // صدا بزند؛ React Navigation این را به‌طور خودکار به ناوبر والد
  // منتقل می‌کند، نیازی به getParent() نیست.
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs">
          {function () { return <MainTabs t={t} tabBarHeight={tabBarHeight} bottomInset={bottomInset} />; }}
        </Stack.Screen>
        <Stack.Screen name="CrescentAnalysis" component={CrescentAnalysisScreen} />
        {/* v3.5: «ماه اکنون» — وضعیت لحظه‌ای ماه، برج و منازل (هدر نیتیو با دکمه‌ی برگشت) */}
        <Stack.Screen
          name="AimGuide"
          component={AimGuideScreen}
          options={{
            headerShown: true,
            title: t('agTitle'),
            headerStyle: { backgroundColor: '#0B1120' },
            headerTintColor: '#C9A84C',
            headerTitleStyle: { fontWeight: 'bold', fontSize: 16 },
          }}
        />
        <Stack.Screen
          name="MoonNow"
          component={MoonNowScreen}
          options={{
            headerShown: true,
            title: t('mnTitle'),
            headerStyle: { backgroundColor: '#0B1120' },
            headerTintColor: '#C9A84C',
            headerTitleStyle: { fontWeight: 'bold', fontSize: 16 },
          }}
        />
        {/* صفحه‌ی خروجی رسمی PDF — دقیقاً همان الگوی CrescentAnalysis:
            headerShown:false چون خودِ ReportExportScreen هدر/دکمه‌ی
            برگشت اختصاصی خودش را دارد. */}
        <Stack.Screen name="ReportExport" component={ReportExportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    // SafeAreaProvider ضروری است تا useSafeAreaInsets کار کند
    <SafeAreaProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <MainApp />
        </ErrorBoundary>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}