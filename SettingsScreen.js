import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Linking, Switch, Animated, Text as RNText } from 'react-native';
import Slider from '@react-native-community/slider';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
var UserSettings = require('../data/userSettings');
var Design = require('../design');
var theme = Design.theme;
var Card = Design.Card;
var Button = Design.Button;
var SectionTitle = Design.SectionTitle;
var HilalNotifications = require('../notifications/hilalNotifications');
var AppConfig = require('../data/appConfig');
var WeatherService = require('../calculations/weatherService');
var AsyncStorageModule = require('@react-native-async-storage/async-storage');
var Storage = AsyncStorageModule.default || AsyncStorageModule;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ============================================================
// نسخه ۳ — بازطراحی کامل صفحه‌ی تنظیمات
//
// چرا این بازنویسی لازم بود (بررسی UX/UI):
//   ۱. سلسله‌مراتب اطلاعاتی مسطح بود: ۹ بخش مختلف (زبان، نوتیفیکیشن،
//      مکان، سلب مسئولیت، روش محاسبه، منابع، امتیازدهی، تماس، درباره)
//      همه با وزن بصری یکسان پشت سر هم چیده شده بودند — کاربر باید
//      همان مقدار توجه به «تنظیم مکان» (که رفتار محاسبات را عوض
//      می‌کند) و «ارسال ایمیل باگ» می‌داد.
//   ۲. گروه‌بندی معنایی وجود نداشت؛ اکنون ۴ بخش با SectionTitle:
//      «مکان رصد» (برجسته‌ترین، چون پایه‌ی محاسبات است) → «ترجیحات»
//      (زبان/نوتیف) → «راهنما و پشتیبانی» → «درباره».
//   ۳. «روش‌های محاسباتی» و «منابع علمی» دو منوآیتم جدا بودند اما
//      هر دو دقیقاً به همان مقصد (Guide) هدایت می‌کردند — با هم ادغام
//      شدند تا مقصد تکراری با دو عنوان متفاوت گیج‌کننده نباشد.
//   ۴. کارت مکان فعلی اکنون از Card variant="featured" با accentColor
//      طلایی استفاده می‌کند تا واقعاً برجسته‌ترین عنصر صفحه باشد، نه
//      یک کارت معمولی هم‌وزن با rateBox/contactBox.
//   ۵. Alert.alert سیستمی بعد از انتخاب شهر (که استایلش با بقیه‌ی اپ
//      ناهماهنگ بود و یک کلیک اضافه تحمیل می‌کرد) با یک Toast داخل‌اپ
//      (طلایی، هم‌سبک theme.js) جایگزین شد که خودش محو می‌شود.
//   ۶. دکمه‌ی سبز امتیازدهی گوگل‌پلی (rateBtn) که هرگز رندر نمی‌شد
//      (کد مرده) حذف شد — اپ فعلاً فقط در کافه‌بازار عرضه می‌شود.
//   ۷. تمام استایل‌های تکراری کارت/دکمه با کامپوننت‌های مشترک
//      Card/Button/SectionTitle جایگزین شدند.
// ============================================================

export default function SettingsScreen() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var lang = LCtx.lang;
  var setLang = LCtx.setLang;
  var isRTL = LCtx.isRTL;

  var s1 = useState(null); var city = s1[0]; var setCity = s1[1];
  var s2 = useState(false); var showList = s2[0]; var setShowList = s2[1];
  var s3 = useState(false); var showCustom = s3[0]; var setShowCustom = s3[1];
  var s4 = useState(''); var cName = s4[0]; var setCName = s4[1];
  var s5 = useState(''); var cLat = s5[0]; var setCLat = s5[1];
  var s6 = useState(''); var cLon = s6[0]; var setCLon = s6[1];
  var s7 = useState('0'); var cAlt = s7[0]; var setCAlt = s7[1];
  var s8 = useState(''); var search = s8[0]; var setSearch = s8[1];
  var s9 = useState(false); var showLang = s9[0]; var setShowLang = s9[1];
  var s10 = useState(null); var selectedCountry = s10[0]; var setSelectedCountry = s10[1];
  var s11 = useState(false); var notifEnabled = s11[0]; var setNotifEnabled = s11[1];
  var sNB = useState(false); var notifBlocked = sNB[0]; var setNotifBlocked = sNB[1];
  var sWX = useState(false); var wxOn = sWX[0]; var setWxOn = sWX[1];
  useEffect(function () { WeatherService.isEnabled().then(setWxOn); }, []);
  var sFP = useState(LCtx.fontScale); var fontPreview = sFP[0]; var setFontPreview = sFP[1];
  // وقتی مقدار ذخیره‌شده بعد از بارگذاری عوض شد، پیش‌نمایش هم‌گام شود
  useEffect(function () { setFontPreview(LCtx.fontScale); }, [LCtx.fontScale]);
  // متن پیام Toast — null یعنی مخفی
  var s12 = useState(null); var toastMsg = s12[0]; var setToastMsg = s12[1];

  var navigation = useNavigation();
  var toastOpacity = useRef(new Animated.Value(0)).current;
  var toastTimer = useRef(null);

  useEffect(function () { loadCity(); }, []);
  // v3.5: وضعیت واقعی = «ترجیح کاربر» و «مجوز سیستم‌عامل» با هم (قبلاً سوئیچ
  // به‌طور پیش‌فرض روشن بود حتی بدون هیچ مجوزی).
  var refreshNotifStatus = function () {
    HilalNotifications.getStatus().then(function (st2) {
      setNotifEnabled(st2.enabled);
      setNotifBlocked(!st2.permissionGranted && st2.canAskAgain === false && !st2.unavailable);
    });
  };
  useEffect(function () {
    refreshNotifStatus();
    // بازگشت از تنظیمات سیستم (مثلاً بعد از دادن مجوز) → وضعیت دوباره خوانده شود
    var unsub = navigation.addListener('focus', refreshNotifStatus);
    return unsub;
  }, []);

  var toggleNotifications = async function (value) {
    if (!value) {
      setNotifEnabled(false);
      await HilalNotifications.setEnabled(false);
      return;
    }
    if (!city) {
      setNotifEnabled(false);
      showToast(t('notifPermissionNeeded'), true);
      return;
    }
    // ابتدا ترجیح را ذخیره می‌کنیم، بعد مجوز (با کانال ساخته‌شده) و زمان‌بندی
    await HilalNotifications.setEnabled(true);
    var savedCrit = 'yallop';
    try {
      var v = await Storage.getItem('selectedCriterion');
      if (v) savedCrit = v;
    } catch (e) { }
    var result = null;
    try {
      result = await HilalNotifications.scheduleUpcoming(city, savedCrit);
    } catch (e) {
      console.warn('خطا در زمان‌بندی نوتیفیکیشن:', e);
    }
    if (result && result.success) {
      setNotifEnabled(true);
      setNotifBlocked(false);
      showToast(t('notifScheduledOk', { n: String(result.scheduledCount || 0) }), true);
      return;
    }
    // شکست: سوئیچ خاموش و دلیل واقعی به کاربر گفته شود
    setNotifEnabled(false);
    await HilalNotifications.setEnabled(false);
    if (result && result.error === 'NO_PERMISSION') {
      if (result.reason === 'NOT_A_DEVICE') showToast(t('notifUnavailableDevice'), true);
      else if (result.canAskAgain === false) { setNotifBlocked(true); showToast(t('notifPermissionBlocked'), true); }
      else showToast(t('notifPermissionNeeded'), true);
    } else {
      showToast(t('notifScheduleFailed'), true);
    }
  };

  var loadCity = async function () {
    var c = await UserSettings.loadCity();
    setCity(c);
  };

  var getCityName = function (c) {
    if (!c) return '';
    var cityKey = UserSettings.getCityKey(c.name);
    if (cityKey) return t(cityKey);
    return c.name;
  };

  // ------------------------------------------------------------
  // Toast داخل‌اپ — جایگزین Alert.alert سیستمی برای تأیید ذخیره‌ی
  // مکان. فید-این سریع، ۲ ثانیه می‌ماند، فید-اوت و بعد ناوبری به
  // Home انجام می‌شود؛ کاربر مجبور به زدن دکمه‌ی "OK" نیست.
  // ------------------------------------------------------------
  var showToast = function (msg, stay) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1, duration: 220, useNativeDriver: true,
    }).start();
    toastTimer.current = setTimeout(function () {
      Animated.timing(toastOpacity, {
        toValue: 0, duration: 260, useNativeDriver: true,
      }).start(function () {
        setToastMsg(null);
        if (!stay) navigation.navigate('Home');
      });
    }, 1400);
  };

  var selectCity = async function (c) {
    await UserSettings.saveCity(c);
    setCity(c);
    setShowList(false);
    showToast(t('savedMsg', { name: getCityName(c) }));
  };

  var saveCustom = async function () {
    if (!cName || !cLat || !cLon) {
      Alert.alert(t('errorTitle'), t('errorFillAll'));
      return;
    }
    var lat = parseFloat(cLat);
    var lon = parseFloat(cLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      Alert.alert(t('errorTitle'), t('errorInvalidCoords'));
      return;
    }
    await UserSettings.saveCustomCity(cName, cLat, cLon, cAlt);
    setCity({ name: cName, lat: lat, lon: lon, alt: parseFloat(cAlt) || 0, custom: true });
    setShowCustom(false);
    showToast(t('savedCustom', { name: cName }));
  };

  var filtered = UserSettings.predefinedCities.filter(function (c) {
    if (search) {
      var localName = getCityName(c);
      return c.name.indexOf(search) !== -1 || localName.indexOf(search) !== -1;
    }
    if (selectedCountry) return c.country === selectedCountry;
    return true;
  });
  var countries = UserSettings.getCountries();

  var textAlign = isRTL ? 'right' : 'left';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container}>
        <LinearGradient
          colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]}
          style={st.headerGradient}>
          <Text style={st.titleLabel}>{'⚙️'}</Text>
          <Text style={st.titleT}>{t('headerSettings')}</Text>
        </LinearGradient>

        <View style={st.content}>

          {/* ================= بخش ۱: مکان رصد ================= */}
          <SectionTitle isRTL={isRTL}>{t('sectionLocation')}</SectionTitle>

          <Card variant="featured" accentColor={theme.colors.gold} style={st.locationCard}>
            {city ? (
              <View>
                <Text style={st.currentName}>{getCityName(city)}</Text>
                <Text style={st.currentCoords}>
                  {t('coordLatShort') + ': ' + city.lat.toFixed(4) + '\u00B0 | ' + t('coordLonShort') + ': ' + city.lon.toFixed(4) + '\u00B0 | ' + t('coordAltShort') + ': ' + city.alt + ' ' + t('meterUnit')}
                </Text>
              </View>
            ) : (
              <Text style={st.currentName}>{t('loading')}</Text>
            )}
          </Card>

          <View style={st.locationBtnRow}>
            <Button variant="primary" style={st.locationBtnHalf} onPress={function () { setShowList(true); }}>
              {t('selectFromList')}
            </Button>
            <Button variant="secondary" style={[st.locationBtnHalf, st.locationBtnBorder]} onPress={function () { setShowCustom(true); }}>
              {t('enterManual')}
            </Button>
          </View>

          {/* ================= بخش ۲: ترجیحات ================= */}
          <SectionTitle isRTL={isRTL} style={st.sectionSpacing}>{t('sectionPreferences')}</SectionTitle>

          <TouchableOpacity style={st.menuItem} onPress={function () { setShowLang(true); }}>
            <Text style={st.menuItemIcon}>{'🌐'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('language')}</Text>
              <Text style={[st.menuItemSub, { textAlign: textAlign }]}>
                {lang === 'fa' ? 'فارسی' : lang === 'ar' ? 'العربیة' : 'English'}
              </Text>
            </View>
            <Text style={st.menuItemArrow}>{isRTL ? '◀' : '▶'}</Text>
          </TouchableOpacity>

          <View style={st.menuItem}>
            <Text style={st.menuItemIcon}>{'🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('notificationsToggle')}</Text>
              <Text style={[st.menuItemSub, { textAlign: textAlign }]}>{t('notificationsToggleSub')}</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: theme.colors.border, true: theme.colors.gold }}
              thumbColor={theme.colors.textPrimary}
            />
          </View>

          {/* v3.5: داده‌ی آنلاین ابر و ذرات معلق (Open-Meteo) — پیش‌فرض خاموش */}
          <View style={st.menuItem}>
            <Text style={st.menuItemIcon}>{'☁️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('wxSettingTitle')}</Text>
              <Text style={[st.menuItemSub, { textAlign: textAlign }]}>{t('wxSettingSub')}</Text>
            </View>
            <Switch
              value={wxOn}
              onValueChange={function (v) { setWxOn(v); WeatherService.setEnabled(v); }}
              trackColor={{ false: theme.colors.border, true: theme.colors.gold }}
              thumbColor={theme.colors.textPrimary}
              accessibilityLabel={t('wxSettingTitle')}
            />
          </View>

          {notifBlocked ? (
            <TouchableOpacity style={st.menuItem} onPress={function () { HilalNotifications.openSystemSettings(); }} accessibilityRole="button">
              <Text style={st.menuItemIcon}>{'⚙️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('notifOpenSettings')}</Text>
                <Text style={[st.menuItemSub, { textAlign: textAlign }]}>{t('notifPermissionBlocked')}</Text>
              </View>
              <Text style={st.menuItemArrow}>{isRTL ? '◀' : '▶'}</Text>
            </TouchableOpacity>
          ) : null}

          {/* v3.5: اندازه‌ی متن — نوار پیوسته (۸۰٪ تا ۱۶۰٪، گام ۵٪) */}
          <View style={st.menuItem}>
            <Text style={st.menuItemIcon}>{'🔤'}</Text>
            <View style={{ flex: 1 }}>
              <View style={st.fontHeadRow}>
                <Text style={[st.menuItemTitle, { textAlign: textAlign, flex: 1 }]}>{t('fontSizeTitle')}</Text>
                <Text style={st.fontPct}>{Math.round(fontPreview * 100) + '%'}</Text>
              </View>
              <Text style={[st.menuItemSub, { textAlign: textAlign }]}>{t('fontSizeSub')}</Text>
              <View style={st.fontSliderRow}>
                <RNText style={st.fontEndSmall}>{'A'}</RNText>
                <Slider
                  style={{ flex: 1, height: 40 }}
                  minimumValue={LCtx.FONT_SCALE_MIN}
                  maximumValue={LCtx.FONT_SCALE_MAX}
                  step={LCtx.FONT_SCALE_STEP}
                  value={LCtx.fontScale}
                  minimumTrackTintColor={theme.colors.gold}
                  maximumTrackTintColor={theme.colors.border}
                  thumbTintColor={theme.colors.gold}
                  onValueChange={function (v) { setFontPreview(Math.round(v * 100) / 100); }}
                  onSlidingComplete={function (v) { LCtx.setFontScale(v); }}
                  accessibilityLabel={t('fontSizeTitle')}
                  accessibilityValue={{ min: Math.round(LCtx.FONT_SCALE_MIN * 100), max: Math.round(LCtx.FONT_SCALE_MAX * 100), now: Math.round(fontPreview * 100), text: Math.round(fontPreview * 100) + '%' }}
                />
                <RNText style={st.fontEndBig}>{'A'}</RNText>
              </View>
              {/* پیش‌نمایش زنده هنگام کشیدن (با Text اصلی، تا مقیاس دوبار اعمال نشود) */}
              <RNText style={[st.fontPreviewT, { fontSize: 14 * fontPreview, lineHeight: 22 * fontPreview, textAlign: textAlign }]}>{t('fontSizePreview')}</RNText>
              {Math.abs(fontPreview - 1) > 0.001 ? (
                <TouchableOpacity
                  style={st.fontReset}
                  onPress={function () { setFontPreview(1); LCtx.setFontScale(1); }}
                  accessibilityRole="button"
                  accessibilityLabel={t('fontSizeReset')}
                >
                  <Text style={st.fontResetT}>{t('fontSizeReset')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* ================= بخش ۳: راهنما و پشتیبانی ================= */}
          <SectionTitle isRTL={isRTL} style={st.sectionSpacing}>{t('sectionSupport')}</SectionTitle>

          {/* نسخه ۳: «روش‌های محاسباتی» و «منابع علمی» با هم ادغام شدند
              چون هر دو دقیقاً به همان صفحه (Guide) هدایت می‌کردند —
              دو ورودی برای یک مقصد گیج‌کننده بود. */}
          <TouchableOpacity style={st.menuItem} onPress={function () { navigation.navigate('Guide'); }}>
            <Text style={st.menuItemIcon}>{'🔬'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('calcMethods')}</Text>
              <Text style={[st.menuItemSub, { textAlign: textAlign }]}>{t('calcMethodsSub') + ' · ' + t('referencesSub')}</Text>
            </View>
            <Text style={st.menuItemArrow}>{isRTL ? '◀' : '▶'}</Text>
          </TouchableOpacity>

          {AppConfig.PRIVACY_POLICY_URL ? (
            <TouchableOpacity style={st.menuItem} onPress={function () { Linking.openURL(AppConfig.PRIVACY_POLICY_URL); }} accessibilityRole="link">
              <Text style={st.menuItemIcon}>{'🔒'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('privacyPolicy')}</Text>
              </View>
              <Text style={st.menuItemArrow}>{isRTL ? '◀' : '▶'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={st.menuItem} onPress={function () {
            Alert.alert('⚠️ ' + t('disclaimer'), t('disclaimerText'), [{ text: t('understood') }]);
          }}>
            <Text style={st.menuItemIcon}>{'⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuItemTitle, { textAlign: textAlign }]}>{t('disclaimer')}</Text>
              <Text style={[st.menuItemSub, { textAlign: textAlign }]}>{t('disclaimerSub')}</Text>
            </View>
          </TouchableOpacity>

          <Card style={st.rateCard}>
            <Text style={st.rateTitle}>{t('rateApp')}</Text>
            <Text style={st.rateSub}>{t('rateSub')}</Text>
            <Button variant="secondary" style={st.rateBtnBorder} onPress={function () {
              Linking.openURL('https://cafebazaar.ir/app/com.soroudisoft.hilalnama').catch(function () { });
            }}>
              {t('rateBazaar')}
            </Button>
          </Card>

          <Card style={st.contactCard}>
            <Text style={st.contactTitle}>{t('contactUs')}</Text>
            <TouchableOpacity style={st.contactBtn} onPress={function () {
              Linking.openURL('mailto:info.gamevar.ir@gmail.com?subject=HilalNama Feedback').catch(function () { });
            }}>
              <Text style={st.contactBtnT}>{t('sendEmail')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.contactBtn} onPress={function () {
              Linking.openURL('mailto:info.gamevar.ir@gmail.com?subject=Bug Report - HilalNama').catch(function () { });
            }}>
              <Text style={st.contactBtnT}>{t('reportBug')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.contactBtn, { marginBottom: 0 }]} onPress={function () {
              Linking.openURL('mailto:info.gamevar.ir@gmail.com?subject=Suggestion - HilalNama').catch(function () { });
            }}>
              <Text style={st.contactBtnT}>{t('suggestion')}</Text>
            </TouchableOpacity>
          </Card>

          {/* ================= بخش ۴: درباره ================= */}
          <SectionTitle isRTL={isRTL} style={st.sectionSpacing}>{t('sectionAbout')}</SectionTitle>

          <Card variant="deep" style={st.aboutCard}>
            <Text style={[st.aboutText, { textAlign: textAlign }]}>{t('aboutText')}</Text>
          </Card>

          <View style={{ height: 40 }} />
        </View>

        {/* === Modal زبان === */}
        <Modal visible={showLang} transparent animationType="slide">
          <View style={st.moBg}>
            <View style={st.moBox}>
              <Text style={st.moTitle}>{t('language')}</Text>

              <TouchableOpacity style={[st.langItem, lang === 'fa' && st.langItemActive]}
                onPress={function () { setLang('fa'); setShowLang(false); }}>
                <Text style={[st.langItemT, lang === 'fa' && { color: theme.colors.goldDark }]}>{'🇮🇷  فارسی'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[st.langItem, lang === 'ar' && st.langItemActive]}
                onPress={function () { setLang('ar'); setShowLang(false); }}>
                <Text style={[st.langItemT, lang === 'ar' && { color: theme.colors.goldDark }]}>{'🇸🇦  العربیة'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[st.langItem, lang === 'en' && st.langItemActive]}
                onPress={function () { setLang('en'); setShowLang(false); }}>
                <Text style={[st.langItemT, lang === 'en' && { color: theme.colors.goldDark }]}>{'🇬🇧  English'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={st.moClose} onPress={function () { setShowLang(false); }}>
                <Text style={st.moCloseT}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* === Modal لیست شهرها === */}
        <Modal visible={showList} transparent animationType="slide">
          <View style={st.moBg}>
            <View style={st.moBox}>
              <Text style={st.moTitle}>{t('selectCity')}</Text>
              <TextInput
                style={[st.searchInput, { textAlign: textAlign }]}
                placeholder={t('searchCity')}
                placeholderTextColor={theme.colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {!search ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.countryRow}>
                  <TouchableOpacity
                    style={[st.countryChip, !selectedCountry && st.countryChipActive]}
                    onPress={function(){ setSelectedCountry(null); }}>
                    <Text style={[st.countryChipT, !selectedCountry && st.countryChipTActive]}>{t('allCountries')}</Text>
                  </TouchableOpacity>
                  {countries.map(function(co){
                    var isSel = selectedCountry === co.code;
                    return (
                      <TouchableOpacity
                        key={co.code}
                        style={[st.countryChip, isSel && st.countryChipActive]}
                        onPress={function(){ setSelectedCountry(co.code); }}>
                        <Text style={[st.countryChipT, isSel && st.countryChipTActive]}>{co.flag + ' ' + t(co.nameKey)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
              <ScrollView style={{ maxHeight: 380 }}>
                {filtered.length === 0 ? (
                  <View style={st.emptyBox}>
                    <Text style={st.emptyBoxT}>{t('noCityFound')}</Text>
                  </View>
                ) : filtered.map(function (c, i) {
                  var isSel = city && city.name === c.name;
                  return (
                    <TouchableOpacity key={i}
                      style={[st.cityItem, isSel && st.cityItemSel]}
                      onPress={function () { selectCity(c); }}>
                      <Text style={[st.cityItemName, isSel && { color: theme.colors.goldDark }]}>{getCityName(c)}</Text>
                      <Text style={[st.cityItemCoord, isSel && { color: theme.colors.goldDark }]}>
                        {c.lat.toFixed(2) + '\u00B0, ' + c.lon.toFixed(2) + '\u00B0'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={st.moClose} onPress={function () { setShowList(false); setSearch(''); setSelectedCountry(null); }}>
                <Text style={st.moCloseT}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* === Modal مکان دستی === */}
        <Modal visible={showCustom} transparent animationType="slide">
          <View style={st.moBg}>
            <View style={st.moBox}>
              <Text style={st.moTitle}>{t('manualLocation')}</Text>

              <Text style={[st.inputLabel, { textAlign: textAlign }]}>{t('locationName')}</Text>
              <TextInput style={st.input} value={cName} onChangeText={setCName}
                placeholder={t('locationNameHint')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[st.inputLabel, { textAlign: textAlign }]}>{t('latLabel')}</Text>
              <TextInput style={st.input} value={cLat} onChangeText={setCLat}
                keyboardType="numeric" placeholder={t('latHint')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[st.inputLabel, { textAlign: textAlign }]}>{t('lonLabel')}</Text>
              <TextInput style={st.input} value={cLon} onChangeText={setCLon}
                keyboardType="numeric" placeholder={t('lonHint')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[st.inputLabel, { textAlign: textAlign }]}>{t('altLabel')}</Text>
              <TextInput style={st.input} value={cAlt} onChangeText={setCAlt}
                keyboardType="numeric" placeholder={t('altHint')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[st.helpText, { textAlign: textAlign }]}>{t('coordHelp')}</Text>

              <TouchableOpacity style={st.saveBtn} onPress={saveCustom}>
                <Text style={st.saveBtnT}>{t('saveLocation')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={st.moClose} onPress={function () { setShowCustom(false); }}>
                <Text style={st.moCloseT}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={st.versionT}>{t('appVersionLabel') + ' ' + AppConfig.APP_VERSION}</Text>
      </ScrollView>

      {/* === Toast داخل‌اپ — جایگزین Alert.alert سیستمی === */}
      {toastMsg ? (
        <Animated.View
          pointerEvents="none"
          style={[st.toast, { opacity: toastOpacity, transform: [{ translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}
        >
          <Text style={st.toastIcon}>{'✅'}</Text>
          <Text style={st.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  content: { padding: theme.spacing.lg },
  headerGradient: { paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.lg, alignItems: 'center' },
  titleLabel: { fontSize: 28, marginBottom: 4 },
  titleT: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight },

  sectionSpacing: { marginTop: theme.spacing.lg },

  // --- کارت مکان (برجسته‌ترین عنصر صفحه) ---
  locationCard: { marginBottom: theme.spacing.sm },
  currentName: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  currentCoords: { color: theme.colors.textMuted, fontSize: 11, marginTop: 6, textAlign: 'center' },
  locationBtnRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  locationBtnHalf: { flex: 1, marginBottom: 0 },
  locationBtnBorder: { borderWidth: 1, borderColor: theme.colors.gold },

  // --- آیتم‌های منو (زبان، نوتیفیکیشن، راهنما، سلب مسئولیت) ---
  menuItem: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, padding: 16, marginBottom: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.colors.border },
  menuItemIcon: { fontSize: 22 },
  menuItemTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: 'bold' },
  menuItemSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  menuItemArrow: { color: theme.colors.textMuted, fontSize: 14 },

  // --- امتیازدهی ---
  rateCard: { alignItems: 'center' },
  rateTitle: { color: theme.colors.gold, fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  rateSub: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 16, textAlign: 'center' },
  rateBtnBorder: { width: '100%', borderWidth: 1, borderColor: theme.colors.gold, marginBottom: 0 },

  // --- تماس ---
  contactCard: {},
  contactTitle: { color: theme.colors.gold, fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  contactBtn: { backgroundColor: theme.colors.bgCardDeep, borderRadius: theme.radius.sm + 2, padding: 12, marginBottom: 6, alignItems: 'center' },
  contactBtnT: { color: theme.colors.textLink, fontSize: 13, fontWeight: 'bold' },

  // --- درباره ---
  aboutCard: {},
  aboutText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 22 },

  // --- Modal های مشترک ---
  moBg: { flex: 1, backgroundColor: theme.colors.bgOverlay, justifyContent: 'center', padding: 16 },
  moBox: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.xl, padding: 20, maxHeight: '90%' },
  moTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  moClose: { padding: 12, alignItems: 'center', marginTop: 8 },
  moCloseT: { color: theme.colors.textMuted, fontSize: 14 },
  searchInput: { backgroundColor: theme.colors.bgPage, borderRadius: theme.radius.sm + 2, padding: 12, color: theme.colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm },
  countryRow: { flexDirection: 'row', marginBottom: theme.spacing.sm },
  countryChip: { backgroundColor: theme.colors.bgCardDeep, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill - 4, marginRight: 6, borderWidth: 1, borderColor: theme.colors.border },
  countryChipActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  countryChipT: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
  countryChipTActive: { color: theme.colors.goldDark },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  emptyBoxT: { color: theme.colors.textMuted, fontSize: 13 },
  cityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  cityItemSel: { backgroundColor: theme.colors.gold, borderRadius: theme.radius.sm },
  cityItemName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: 'bold' },
  cityItemCoord: { color: theme.colors.textMuted, fontSize: 11 },
  inputLabel: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: theme.colors.bgPage, borderRadius: theme.radius.sm + 2, padding: 12, color: theme.colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: theme.colors.border, textAlign: 'center' },
  helpText: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 18, marginTop: 12 },
  saveBtn: { backgroundColor: theme.colors.gold, borderRadius: theme.radius.md, padding: 14, alignItems: 'center', marginTop: 14 },
  saveBtnT: { color: theme.colors.goldDark, fontSize: 16, fontWeight: 'bold' },
  langItem: { backgroundColor: theme.colors.bgCardDeep, borderRadius: theme.radius.md, padding: 18, marginBottom: theme.spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  langItemActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  langItemT: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: 'bold' },

  // --- Toast داخل‌اپ ---
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...theme.shadow.card,
  },
  toastIcon: { fontSize: 16 },
  versionT: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 18, marginBottom: 24 },
  fontHeadRow: { flexDirection: 'row', alignItems: 'center' },
  fontPct: { color: theme.colors.gold, fontSize: 13, fontWeight: '700', minWidth: 48, textAlign: 'right' },
  fontSliderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  fontEndSmall: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', width: 16, textAlign: 'center' },
  fontEndBig: { color: theme.colors.textSecondary, fontSize: 22, fontWeight: '700', width: 22, textAlign: 'center' },
  fontPreviewT: { color: theme.colors.textPrimary, marginTop: 4 },
  fontReset: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.gold },
  fontResetT: { color: theme.colors.gold, fontSize: 12, fontWeight: '600' },
  toastText: { color: theme.colors.goldDark, fontSize: 13, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});