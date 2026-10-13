import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
var Text = require('../design/ScaledText');
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

var UserSettings = require('../data/userSettings');
var HijriCalendar = require('../calculations/hijriCalendar');
var MoonCalculator = require('../calculations/moonPosition');
var SightingReports = require('../firebase/sightingReports');
var LocationService = require('../locationService');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;
var ZoomableImageModal = require('./ZoomableImageModal').default;

// ============================================================
// نسخه ۳ — فاز ۳-د: فرم کامل ثبت/ویرایش گزارش استهلال
//
// طبق طرح تفصیلی کاربر: نام (اجباری)، ایمیل (اختیاری)، مکان (شهر
// تنظیمات یا دستی با کشور/استان/شهر + GPS یا دستی)، تاریخ شمسی/
// میلادی با اعتبارسنجی بازه‌ی ۶۰ساعته از مقارنه، نتیجه‌ی رصد
// رادیویی (۴ گزینه)، علت عدم رصد، ابزار، وضعیت هوا، کیفیت افق،
// درصد ابر (اسلایدر)، متن گزارش، عکس، تأیید صحت.
// ============================================================
export default function SightingReportFormScreen(props) {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var isRTL = LCtx.isRTL;
  var textAlign = isRTL ? 'right' : 'left';

  var SR = SightingReports;

  // --- هویت و مکان ---
  var s1 = useState(''); var fullName = s1[0]; var setFullName = s1[1];
  var s2 = useState(''); var email = s2[0]; var setEmail = s2[1];
  var s3 = useState(true); var useSettingsCity = s3[0]; var setUseSettingsCity = s3[1];
  var s4 = useState(null); var settingsCity = s4[0]; var setSettingsCity = s4[1];
  var s5 = useState(''); var manualCountry = s5[0]; var setManualCountry = s5[1];
  var s6 = useState(''); var manualProvince = s6[0]; var setManualProvince = s6[1];
  var s7 = useState(''); var manualCity = s7[0]; var setManualCity = s7[1];
  var s8 = useState('manual'); var locationSource = s8[0]; var setLocationSource = s8[1]; // 'gps'|'manual'
  var s9 = useState(''); var latInput = s9[0]; var setLatInput = s9[1];
  var s10 = useState(''); var lonInput = s10[0]; var setLonInput = s10[1];
  var s11 = useState(''); var elevInput = s11[0]; var setElevInput = s11[1];
  var s12 = useState(false); var gettingLocation = s12[0]; var setGettingLocation = s12[1];
  var s13 = useState(false); var showCountryPicker = s13[0]; var setShowCountryPicker = s13[1];
  // نسخه ۳ — فاز ۳-و: متن نام کشور در حالتی که کاربر گزینه‌ی «سایر»
  // را از لیست کشورها انتخاب کرده (کشور او در لیست ثابت اپ نیست).
  var s13b = useState(''); var countryOtherText = s13b[0]; var setCountryOtherText = s13b[1];

  // --- تاریخ/ساعت رصد ---
  var s14 = useState('jalali'); var dateType = s14[0]; var setDateType = s14[1];
  var now = new Date();
  var nowJalali = HijriCalendar.toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  var s15 = useState(String(nowJalali.year)); var jYear = s15[0]; var setJYear = s15[1];
  var s16 = useState(String(nowJalali.month)); var jMonth = s16[0]; var setJMonth = s16[1];
  var s17 = useState(String(nowJalali.day)); var jDay = s17[0]; var setJDay = s17[1];
  var s18 = useState(String(now.getFullYear())); var gYear = s18[0]; var setGYear = s18[1];
  var s19 = useState(String(now.getMonth() + 1)); var gMonth = s19[0]; var setGMonth = s19[1];
  var s20 = useState(String(now.getDate())); var gDay = s20[0]; var setGDay = s20[1];
  var s21 = useState(String(now.getHours())); var hourInput = s21[0]; var setHourInput = s21[1];
  var s22 = useState(String(now.getMinutes())); var minuteInput = s22[0]; var setMinuteInput = s22[1];

  // --- نتیجه‌ی رصد و جزئیات ---
  var s23 = useState(SR.SIGHTING_RESULTS.NOT_SEEN); var sightingResult = s23[0]; var setSightingResult = s23[1];
  var s24 = useState(SR.NO_ATTEMPT_REASONS.CLOUDS); var noAttemptReason = s24[0]; var setNoAttemptReason = s24[1];
  var s25 = useState(SR.EQUIPMENT_TYPES.NONE); var equipment = s25[0]; var setEquipment = s25[1];
  var s26 = useState(null); var weather = s26[0]; var setWeather = s26[1];
  var s27 = useState(null); var horizonQuality = s27[0]; var setHorizonQuality = s27[1];
  var s28 = useState(0); var cloudPercent = s28[0]; var setCloudPercent = s28[1];
  var s29 = useState(''); var notes = s29[0]; var setNotes = s29[1];
  var s30 = useState(null); var photoUri = s30[0]; var setPhotoUri = s30[1];
  var s31 = useState(false); var confirmAccuracy = s31[0]; var setConfirmAccuracy = s31[1];
  // v3.5: درصد ابر فقط وقتی ارسال می‌شود که کاربر آن را دست زده باشد
  var sCT = useState(false); var cloudTouched = sCT[0]; var setCloudTouched = sCT[1];

  // --- وضعیت عملیات ---
  var s32 = useState(false); var submitting = s32[0]; var setSubmitting = s32[1];
  var s33 = useState(''); var progressLabel = s33[0]; var setProgressLabel = s33[1];
  var s34 = useState(null); var zoomedPhotoUri = s34[0]; var setZoomedPhotoUri = s34[1];
  var s35 = useState(null); var conjunction = s35[0]; var setConjunction = s35[1];

  // --- حالت ویرایش (اگر گزارش موجودی برای این ماه پاس داده شده) ---
  var editingReport = props.editingReport || null;
  var onDone = props.onDone || function () {};

  useEffect(function () {
    UserSettings.loadCity().then(function (c) { if (c) setSettingsCity(c); });
    // مقارنه‌ی مبنا: نزدیک‌ترین مقارنه‌ی گذشته نسبت به لحظه‌ی فعلی —
    // مبنای اعتبارسنجی بازه‌ی ۶۰ساعته‌ی همین ماه قمری جاری.
    var conj = HijriCalendar.getPrevNewMoon(now);
    setConjunction(conj);
  }, []);

  useEffect(function () {
    if (editingReport) {
      setFullName(editingReport.fullName || '');
      setEmail(editingReport.email || '');
      setManualCountry(editingReport.country || '');
      setCountryOtherText(editingReport.countryOther || '');
      setManualProvince(editingReport.province || '');
      setManualCity(editingReport.city || '');
      setUseSettingsCity(false);
      setLatInput(String(editingReport.latitude || ''));
      setLonInput(String(editingReport.longitude || ''));
      setElevInput(String(editingReport.elevation || ''));
      setSightingResult(editingReport.sightingResult);
      if (editingReport.noAttemptReason) setNoAttemptReason(editingReport.noAttemptReason);
      setEquipment(editingReport.equipment || SR.EQUIPMENT_TYPES.NONE);
      if (editingReport.weather) setWeather(editingReport.weather);
      if (editingReport.horizonQuality) setHorizonQuality(editingReport.horizonQuality);
      if (editingReport.cloudPercent !== null && editingReport.cloudPercent !== undefined) { setCloudPercent(editingReport.cloudPercent); setCloudTouched(true); }
      setNotes(editingReport.notes || '');
      if (editingReport.sightingDateISO) {
        var d = new Date(editingReport.sightingDateISO);
        var jd = HijriCalendar.toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        setJYear(String(jd.year)); setJMonth(String(jd.month)); setJDay(String(jd.day));
        setGYear(String(d.getFullYear())); setGMonth(String(d.getMonth() + 1)); setGDay(String(d.getDate()));
        setHourInput(String(d.getHours())); setMinuteInput(String(d.getMinutes()));
      }
    }
  }, [editingReport]);

  // نسخه ۳ — فاز ۳-و: هرگاه نتیجه‌ی رصد تغییر می‌کند، مقدار equipment
  // را با آن هماهنگ نگه می‌داریم تا داده‌ی متناقض حتی در state داخلی
  // (نه فقط در UI) هم امکان وجود نداشته باشد:
  //   - اگر «با چشم عادی دیدم» انتخاب شد: ابزار را قطعاً NONE می‌کنیم.
  //   - اگر «فقط با ابزار دیدم» انتخاب شد و ابزار فعلی هنوز NONE بود
  //     (یعنی کاربر تازه از حالت دیگری به این حالت آمده)، به‌طور
  //     پیش‌فرض روی BINOCULARS (رایج‌ترین ابزار) قرار می‌دهیم تا
  //     ترکیب نامعتبر "دیدم با ابزار" + "بدون ابزار" ذخیره نشود.
  useEffect(function () {
    if (sightingResult === SR.SIGHTING_RESULTS.SEEN_NAKED_EYE) {
      if (equipment !== SR.EQUIPMENT_TYPES.NONE) setEquipment(SR.EQUIPMENT_TYPES.NONE);
    } else if (sightingResult === SR.SIGHTING_RESULTS.SEEN_OPTICAL) {
      if (equipment === SR.EQUIPMENT_TYPES.NONE) setEquipment(SR.EQUIPMENT_TYPES.BINOCULARS);
    }
  }, [sightingResult]);

  // ------------------------------------------------------------
  // ساخت شیء Date نهایی از فیلدهای تاریخ/ساعت فعلی (بسته به این‌که
  // dateType شمسی یا میلادی است)
  // ------------------------------------------------------------
  // نسخه ۳ — فاز ۳-ه: رفع باگ — قبلاً هیچ اعتبارسنجی محدوده‌ای روی
  // ساعت/دقیقه/روز/ماه وجود نداشت. جاوااسکریپت مقادیر خارج از محدوده
  // را بی‌صدا سرریز می‌کند (مثلاً ساعت ۲۵ خودش به ساعت ۱ روز بعد
  // تبدیل می‌شود، دقیقه ۷۰ به ۱۰ دقیقه‌ی ساعت بعد)، بدون هیچ خطایی به
  // کاربر — که می‌تواند دقیقاً باعث جابه‌جایی چند-ساعته‌ی تاریخ رصد و
  // رد نادرست شدنش از بازه‌ی مجاز شود. حالا هر مقدار خارج از محدوده‌ی
  // معتبر باعث برگشت null می‌شود (که در handleSubmit پیام خطا نشان
  // می‌دهد)، به‌جای سرریز خاموش.
  var buildSightingDate = function (lat, lon) {
    // v3.5: ساعت و دقیقه اجباری‌اند (قبلاً خالی ⇒ ۰۰:۰۰ و گزارش «مشکوک» می‌شد)،
    // روز واقعی ماه بررسی می‌شود (۳۱ اسفند/۳۰ فوریه رد می‌شود)، و ساعت دیواری
    // با منطقه‌ی زمانی «محل رصد» تفسیر می‌شود.
    if (String(hourInput).trim() === '' || String(minuteInput).trim() === '') return null;
    var h = parseInt(hourInput, 10);
    var m = parseInt(minuteInput, 10);
    if (isNaN(h) || isNaN(m)) return null;
    if (h < 0 || h > 23) return null;
    if (m < 0 || m > 59) return null;

    var gy, gm, gd;
    if (dateType === 'jalali') {
      var jy = parseInt(jYear, 10), jm = parseInt(jMonth, 10), jd = parseInt(jDay, 10);
      if (!jy || !jm || !jd) return null;
      if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
      var g = HijriCalendar.toGregorian(jy, jm, jd);
      var back = HijriCalendar.toJalali(g.year, g.month, g.day);
      if (back.year !== jy || back.month !== jm || back.day !== jd) return null; // مثل ۳۱ شهریور+ / ۳۰ اسفند در سال غیرکبیسه
      gy = g.year; gm = g.month; gd = g.day;
    } else {
      gy = parseInt(gYear, 10); gm = parseInt(gMonth, 10); gd = parseInt(gDay, 10);
      if (!gy || !gm || !gd) return null;
      if (gm < 1 || gm > 12 || gd < 1 || gd > 31) return null;
      var probe = new Date(Date.UTC(gy, gm - 1, gd));
      if (probe.getUTCFullYear() !== gy || probe.getUTCMonth() !== gm - 1 || probe.getUTCDate() !== gd) return null;
    }
    return MoonCalculator.wallClockToInstant(gy, gm, gd, h, m, lat, lon);
  };

  // وقتی کاربر نوع تاریخ را عوض می‌کند، فیلدهای نوع دیگر را همگام کن
  var switchDateType = function (newType) {
    if (newType === dateType) return;
    if (newType === 'gregorian') {
      var jy = parseInt(jYear, 10), jm = parseInt(jMonth, 10), jd = parseInt(jDay, 10);
      if (jy && jm && jd) {
        var g = HijriCalendar.toGregorian(jy, jm, jd);
        setGYear(String(g.year)); setGMonth(String(g.month)); setGDay(String(g.day));
      }
    } else {
      var gy = parseInt(gYear, 10), gm = parseInt(gMonth, 10), gd = parseInt(gDay, 10);
      if (gy && gm && gd) {
        var j = HijriCalendar.toJalali(gy, gm, gd);
        setJYear(String(j.year)); setJMonth(String(j.month)); setJDay(String(j.day));
      }
    }
    setDateType(newType);
  };

  var handleUseGPS = async function () {
    setGettingLocation(true);
    var result = await LocationService.getCurrentLocation();
    setGettingLocation(false);
    if (result.success) {
      setLatInput(String(result.latitude.toFixed(6)));
      setLonInput(String(result.longitude.toFixed(6)));
      setElevInput(String(result.elevation));
      setLocationSource('gps');
    } else if (result.error === 'PERMISSION_DENIED') {
      Alert.alert(t('permissionNeeded'), t('locationPermissionMsg'));
    } else {
      Alert.alert(t('error'), t('unknownError'));
    }
  };

  var pickPhoto = async function () {
    var perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permissionNeeded'), t('photoPermissionMsg')); return; }
    var result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: (ImagePicker.MediaType ? ['images'] : ImagePicker.MediaTypeOptions.Images), quality: 1 });
    if (!result.canceled && result.assets && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  var takePhoto = async function () {
    var perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permissionNeeded'), t('cameraPermissionMsg')); return; }
    var result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  var getEffectiveLocation = function () {
    if (useSettingsCity && settingsCity) {
      return {
        country: settingsCity.country || '', province: '', city: settingsCity.name,
        latitude: settingsCity.lat, longitude: settingsCity.lon, elevation: settingsCity.alt || 0,
      };
    }
    return {
      country: manualCountry, province: manualProvince, city: manualCity,
      latitude: parseFloat(latInput), longitude: parseFloat(lonInput), elevation: parseFloat(elevInput) || 0,
    };
  };

  // v3.5: پیام خطا بر اساس «کد» و با ترجمه (نه متن فارسیِ سرویس)
  var errorText = function (result) {
    var map = {
      MISSING_NAME: 'fullNameRequired', NAME_TOO_LONG: 'errNameTooLong', INVALID_EMAIL: 'errInvalidEmail',
      NOTES_TOO_LONG: 'errNotesTooLong', INVALID_RESULT: 'unknownError', INVALID_CLOUD: 'unknownError',
      INVALID_COORDS: 'errInvalidCoords', BEFORE_CONJUNCTION: 'dateBeforeConjunctionError',
      AFTER_WINDOW: 'dateAfterWindowError', AUTH_FAILED: 'errAuthFailed', NETWORK: 'errNetwork',
      NOT_OWNER: 'errNotOwner', NOT_FOUND: 'errNotFound',
    };
    if (result && result.error === 'RATE_LIMIT') return t('rateLimitMsg', { max: String(result.max || SR.MAX_REPORTS_PER_MONTH) });
    var key = result && map[result.error];
    return key ? t(key) : t('unknownError');
  };

  var handleSubmit = async function () {
    if (!fullName.trim()) { Alert.alert(t('error'), t('fullNameRequired')); return; }
    if (!confirmAccuracy) { Alert.alert(t('error'), t('confirmAccuracyRequired')); return; }

    // نسخه ۳ — فاز ۳-و: اگر کاربر گزینه‌ی «سایر» را برای کشور انتخاب
    // کرده، باید حتماً نام کشور را هم تایپ کرده باشد؛ وگرنه گزارش با
    // کشوری نامشخص/خالی ذخیره می‌شود که در آمار و فیلتر کشور در صفحه‌ی
    // مرور گزارش‌ها بی‌معنی خواهد بود.
    if (!useSettingsCity && manualCountry === SR.OTHER_COUNTRY_CODE && !countryOtherText.trim()) {
      Alert.alert(t('error'), t('countryOtherLabel'));
      return;
    }

    // نسخه ۳ — فاز ۳-ز: رفع باگ/محدودیت غیرضروری — قبلاً ثبت مختصات
    // دقیق (چه از GPS، چه دستی) عملاً اجباری بود، چون اگر lat/lon
    // خالی می‌ماند (isNaN)، ارسال گزارش کلاً مسدود می‌شد. طبق خواسته‌ی
    // صریح کاربر: مختصات دقیق کاملاً اختیاری است (چه GPS چه دستی)،
    // اما کشور/استان/شهر باید الزامی باشند — چون این‌ها حداقل اطلاعات
    // مکانی لازم برای معنادار بودن گزارش رصد هستند، در حالی که
    // مختصات دقیق صرفاً برای محاسبات دقیق‌تر تکمیلی است.
    if (!useSettingsCity) {
      if (!manualCountry) { Alert.alert(t('error'), t('selectCountry') + ': ' + t('fieldRequiredError')); return; }
      if (!manualProvince.trim()) { Alert.alert(t('error'), t('provinceLabel') + ': ' + t('fieldRequiredError')); return; }
      if (!manualCity.trim()) { Alert.alert(t('error'), t('cityManualLabel') + ': ' + t('fieldRequiredError')); return; }
    }

    var loc = getEffectiveLocation();
    // مختصات دیگر اجباری نیست: فقط اگر کاربر مقداری برای lat/lon وارد
    // کرده (خالی نگذاشته)، محدوده‌ی معتبر جغرافیایی را چک می‌کنیم تا
    // داده‌ی بی‌معنی (مثل عرض جغرافیایی ۹۹۹) وارد Firestore نشود؛ اگر
    // خالی گذاشته، بدون خطا و بدون مختصات ادامه می‌دهیم.
    var hasLat = latInput !== '' && latInput !== null && latInput !== undefined;
    var hasLon = lonInput !== '' && lonInput !== null && lonInput !== undefined;
    if (!useSettingsCity && (hasLat || hasLon)) {
      if (isNaN(loc.latitude) || isNaN(loc.longitude)) {
        Alert.alert(t('error'), t('locationSectionTitle'));
        return;
      }
      if (loc.latitude < -90 || loc.latitude > 90 || loc.longitude < -180 || loc.longitude > 180) {
        Alert.alert(t('error'), t('locationSectionTitle'));
        return;
      }
    }

    var sightingDate = buildSightingDate(isNaN(loc.latitude) ? null : loc.latitude, isNaN(loc.longitude) ? null : loc.longitude);
    if (!sightingDate) { Alert.alert(t('error'), t('invalidDateTimeError')); return; }

    // رفع باگ: قبلاً از state ثابت `conjunction` (که فقط یک‌بار در
    // mount فرم، بر مبنای لحظه‌ی *باز شدن فرم* محاسبه می‌شد) استفاده
    // می‌شد — نه بر مبنای تاریخ رصدی که کاربر واقعاً در فرم وارد
    // کرده. اگر این دو در دو ماه قمری متفاوت می‌افتادند (مثلاً فرم
    // مدتی باز مانده، یا کاربر روز/ساعت دیگری را دستی وارد کرده)،
    // هم اعتبارسنجی بازه‌ی ۶۰ساعته و هم hijriMonthKey ذخیره‌شده در
    // sightingReports.js (که مستقیماً از همین conjunction محاسبه
    // می‌شود) به مقارنه‌ی اشتباه/قدیمی گره می‌خوردند — نتیجه‌اش
    // گزارشی بود که زیر ماه قمری نادرست ثبت و در فهرست مرور گزارش‌ها
    // ظاهر نمی‌شد. راه‌حل: بلافاصله پیش از ساخت reportData، مقارنه‌ی
    // مبنا را دوباره از روی خودِ sightingDate واقعی می‌گیریم.
    var effectiveConjunction = HijriCalendar.getPrevNewMoon(sightingDate);

    var windowCheck = SR.validateSightingWindow(sightingDate, effectiveConjunction);
    if (!windowCheck.valid) {
      var msg = windowCheck.reason === 'BEFORE_CONJUNCTION' ? t('dateBeforeConjunctionError') : t('dateAfterWindowError');
      Alert.alert(t('error'), msg);
      return;
    }

    // نسخه ۳ — فاز ۳-و: لایه‌ی دفاعی دوم در برابر ترکیب متناقض
    // sightingResult/equipment (نگاه کنید به useEffect بالا که همین
    // را زودتر، حین تعامل کاربر، مدیریت می‌کند). این‌جا بار دیگر
    // پیش از ارسال قطعی به سرور تضمین می‌کنیم، چون این حالت‌ها ممکن
    // است از useEffect عبور کرده باشند (مثلاً یک گزارش قدیمی در
    // حالت ویرایش که از قبل داده‌ی متناقض داشته و کاربر submit را
    // بدون دست‌زدن به این دو فیلد زده است).
    var finalEquipment = equipment;
    if (sightingResult === SR.SIGHTING_RESULTS.SEEN_NAKED_EYE) {
      finalEquipment = SR.EQUIPMENT_TYPES.NONE;
    } else if (sightingResult === SR.SIGHTING_RESULTS.SEEN_OPTICAL && equipment === SR.EQUIPMENT_TYPES.NONE) {
      finalEquipment = SR.EQUIPMENT_TYPES.BINOCULARS;
    }

    // نسخه ۳ — فاز ۳-ز: چون مختصات دیگر اجباری نیست، ممکن است
    // loc.latitude/longitude برابر NaN باشد (وقتی کاربر آن‌ها را
    // خالی گذاشته). Firestore مقدار NaN را نمی‌پذیرد (خطای write
    // می‌دهد)، پس پیش از ساخت reportData هر NaN را به null تبدیل
    // می‌کنیم تا فیلد به‌صورت «ثبت‌نشده» ذخیره شود، نه باعث خطا.
    var finalLat = isNaN(loc.latitude) ? null : loc.latitude;
    var finalLon = isNaN(loc.longitude) ? null : loc.longitude;

    var reportData = {
      fullName: fullName,
      email: email,
      country: loc.country,
      countryOther: loc.country === SR.OTHER_COUNTRY_CODE ? countryOtherText.trim() : null,
      province: loc.province,
      city: loc.city,
      latitude: finalLat,
      longitude: finalLon,
      elevation: loc.elevation,
      locationSource: useSettingsCity ? 'settings' : locationSource,
      sightingDateISO: sightingDate.toISOString(),
      conjunction: effectiveConjunction,
      sightingResult: sightingResult,
      noAttemptReason: sightingResult === SR.SIGHTING_RESULTS.NOT_ATTEMPTED ? noAttemptReason : null,
      equipment: finalEquipment,
      weather: weather,
      horizonQuality: horizonQuality,
      cloudPercent: cloudTouched ? cloudPercent : null,
      notes: notes.trim(),
      photoLocalUri: photoUri,
    };

    setSubmitting(true);
    var onProgress = function (stage) {
      if (stage === 'compressing') setProgressLabel(t('compressingPhoto'));
      if (stage === 'uploading') setProgressLabel(t('savingReport'));
    };

    var result = editingReport
      ? await SR.updateReport(editingReport.id, reportData, onProgress)
      : await SR.submitReport(reportData, onProgress);

    setSubmitting(false);
    setProgressLabel('');

    if (result.success) {
      Alert.alert(t('reportSubmitted'), editingReport ? t('reportUpdated') : t('reportSubmittedMsg'));
      onDone();
    } else {
      Alert.alert(t('error'), errorText(result));
    }
  };

  var handleDelete = function () {
    if (!editingReport) return;
    Alert.alert(t('deleteReport'), t('deleteReportConfirm'), [
      { text: t('close'), style: 'cancel' },
      {
        text: t('deleteReport'), style: 'destructive', onPress: async function () {
          setSubmitting(true);
          var result = await SR.deleteReport(editingReport.id);
          setSubmitting(false);
          if (result.success) {
            Alert.alert(t('reportDeleted'));
            onDone();
          } else {
            Alert.alert(t('error'), t('unknownError'));
          }
        }
      },
    ]);
  };

  var resultOptions = [
    { id: SR.SIGHTING_RESULTS.SEEN_NAKED_EYE, icon: '👁', label: t('resultSeenNakedEye') },
    { id: SR.SIGHTING_RESULTS.SEEN_OPTICAL, icon: '🔭', label: t('resultSeenOptical') },
    { id: SR.SIGHTING_RESULTS.NOT_SEEN, icon: '🚫', label: t('resultNotSeen') },
    { id: SR.SIGHTING_RESULTS.NOT_ATTEMPTED, icon: '⏸', label: t('resultNotAttempted') },
  ];
  var reasonOptions = [
    { id: SR.NO_ATTEMPT_REASONS.CLOUDS, label: t('reasonClouds') },
    { id: SR.NO_ATTEMPT_REASONS.DUST, label: t('reasonDust') },
    { id: SR.NO_ATTEMPT_REASONS.RAIN, label: t('reasonRain') },
    { id: SR.NO_ATTEMPT_REASONS.BAD_HORIZON, label: t('reasonBadHorizon') },
    { id: SR.NO_ATTEMPT_REASONS.EQUIPMENT_FAILURE, label: t('reasonEquipmentFailure') },
    { id: SR.NO_ATTEMPT_REASONS.OTHER, label: t('reasonOther') },
  ];
  var equipmentOptionsAll = [
    { id: SR.EQUIPMENT_TYPES.NONE, label: t('equipmentNone') },
    { id: SR.EQUIPMENT_TYPES.BINOCULARS, label: t('equipmentBinoculars') },
    { id: SR.EQUIPMENT_TYPES.TELESCOPE, label: t('equipmentTelescope') },
    { id: SR.EQUIPMENT_TYPES.CCD, label: t('equipmentCCD') },
    { id: SR.EQUIPMENT_TYPES.CAMERA, label: t('equipmentCamera') },
    { id: SR.EQUIPMENT_TYPES.OTHER, label: t('equipmentOther') },
  ];
  // نسخه ۳ — فاز ۳-و: رفع باگ — قبلاً بخش «ابزار» همیشه با همه‌ی
  // گزینه‌ها (از جمله «بدون ابزار») نمایش داده می‌شد، صرف‌نظر از
  // اینکه کاربر در «نتیجه‌ی رصد» چه انتخاب کرده بود. این یعنی کاربر
  // می‌توانست هم‌زمان «با چشم عادی دیدم» و «تلسکوپ» را انتخاب کند —
  // که از نظر تعریف با هم متناقض‌اند (رؤیت با چشم غیرمسلح یعنی بدون
  // ابزار نوری). راه‌حل: لیست ابزار بر اساس نتیجه‌ی رصد فیلتر می‌شود:
  //   - SEEN_NAKED_EYE: بخش ابزار اصلاً نمایش داده نمی‌شود (همیشه NONE)
  //   - SEEN_OPTICAL: گزینه‌ی «بدون ابزار» حذف می‌شود (باید یک ابزار
  //     واقعی انتخاب شود، چون ادعا شده با ابزار دیده)
  //   - NOT_SEEN / NOT_ATTEMPTED: همه‌ی گزینه‌ها (شامل «بدون ابزار»)
  //     در دسترس می‌مانند، چون این دو حالت با ابزار خاصی گره نخورده‌اند
  var equipmentOptions = sightingResult === SR.SIGHTING_RESULTS.SEEN_OPTICAL
    ? equipmentOptionsAll.filter(function (o) { return o.id !== SR.EQUIPMENT_TYPES.NONE; })
    : equipmentOptionsAll;
  var weatherOptions = [
    { id: SR.WEATHER_CONDITIONS.CLEAR, label: t('weatherClear') },
    { id: SR.WEATHER_CONDITIONS.PARTLY_CLOUDY, label: t('weatherPartlyCloudy') },
    { id: SR.WEATHER_CONDITIONS.CLOUDY, label: t('weatherCloudy') },
    { id: SR.WEATHER_CONDITIONS.DUSTY, label: t('weatherDusty') },
    { id: SR.WEATHER_CONDITIONS.FOGGY, label: t('weatherFoggy') },
  ];
  var horizonOptions = [
    { id: SR.HORIZON_QUALITY.EXCELLENT, label: t('horizonExcellent') },
    { id: SR.HORIZON_QUALITY.GOOD, label: t('horizonGood') },
    { id: SR.HORIZON_QUALITY.MODERATE, label: t('horizonModerate') },
    { id: SR.HORIZON_QUALITY.POOR, label: t('horizonPoor') },
  ];
  var countries = UserSettings.getCountries();
  var selectedCountryObj = countries.filter(function (c) { return c.code === manualCountry; })[0] || null;

  function ChipRow(chProps) {
    return (
      <View style={st.chipRow}>
        {chProps.options.map(function (opt) {
          var isSel = chProps.value === opt.id;
          return (
            <TouchableOpacity key={opt.id} style={[st.chip, isSel && st.chipActive]} onPress={function () { chProps.onChange(opt.id); }}>
              {opt.icon ? <Text style={st.chipIcon}>{opt.icon}</Text> : null}
              <Text style={[st.chipT, isSel && st.chipTActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <React.Fragment>
      <ScrollView style={st.container}>
        <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.headerGradient}>
          <Text style={st.titleLabel}>{'🌙'}</Text>
          <Text style={st.titleT}>{editingReport ? t('editReportTitle') : t('sightingReportTitle')}</Text>
        </LinearGradient>

        <View style={st.content}>

          {editingReport ? (
            <View style={st.editModeBanner}>
              <Text style={st.editModeBannerIcon}>{'✏️'}</Text>
              <Text style={st.editModeBannerT}>{t('editModeMsg')}</Text>
            </View>
          ) : null}

          {/* === نام و ایمیل === */}
          <Design.SectionTitle isRTL={isRTL}>{t('fullNameLabel') + ' *'}</Design.SectionTitle>
          <TextInput style={[st.input, { textAlign: textAlign }]} placeholder={t('yourNamePlaceholder')} placeholderTextColor={theme.colors.textMuted} value={fullName} onChangeText={setFullName} />

          <Design.SectionTitle isRTL={isRTL}>{t('emailLabel')}</Design.SectionTitle>
          <Text style={[st.helpText, { textAlign: textAlign }]}>{t('emailOptional')}</Text>
          <TextInput style={[st.input, { textAlign: textAlign }]} placeholder={t('emailPlaceholder')} placeholderTextColor={theme.colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          {/* === مکان رصد === */}
          <Design.SectionTitle isRTL={isRTL}>{t('locationSectionTitle')}</Design.SectionTitle>
          <Text style={[st.helpText, { textAlign: textAlign }]}>{t('useSettingsCityQ')}</Text>
          <View style={st.yesNoRow}>
            <TouchableOpacity style={[st.yesNoBtn, useSettingsCity && st.yesNoBtnActive]} onPress={function () { setUseSettingsCity(true); }}>
              <Text style={[st.yesNoT, useSettingsCity && st.yesNoTActive]}>{t('yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.yesNoBtn, !useSettingsCity && st.yesNoBtnActive]} onPress={function () { setUseSettingsCity(false); }}>
              <Text style={[st.yesNoT, !useSettingsCity && st.yesNoTActive]}>{t('no')}</Text>
            </TouchableOpacity>
          </View>

          {useSettingsCity ? (
            <View style={st.cityBox}>
              {/* نسخه ۳ — فاز ۳-ح: رفع باگ چندزبانگی — قبلاً
                  settingsCity.name (نام خام فارسی از predefinedCities)
                  مستقیم چاپ می‌شد و با تغییر زبان اپ تغییر نمی‌کرد.
                  حالا اگر این شهر در لیست از‌پیش‌تعیین‌شده باشد،
                  UserSettings.getCityKey نام آن را به کلید ترجمه
                  (مثل cityQom) تبدیل می‌کند و با t() ترجمه می‌شود؛
                  برای شهرهای سفارشی (که کاربر خودش با نام دلخواه در
                  تنظیمات ثبت کرده و طبعاً کلید ترجمه ندارند)، همان
                  نامی که خودِ کاربر تایپ کرده بدون تغییر نمایش داده
                  می‌شود. */}
              <Text style={st.cityBoxT}>
                {settingsCity
                  ? (function () {
                      var key = UserSettings.getCityKey(settingsCity.name);
                      return key ? t(key) : settingsCity.name;
                    })()
                  : t('loading')}
              </Text>
              <Text style={st.cityBoxSub}>{t('changeCityInSettings')}</Text>
            </View>
          ) : (
            <View>
              <Text style={[st.fieldLabel, { textAlign: textAlign }]}>{t('selectCountry') + ' *'}</Text>
              <TouchableOpacity style={st.pickerBtn} onPress={function () { setShowCountryPicker(true); }}>
                <Text style={st.pickerBtnT}>
                  {manualCountry === SR.OTHER_COUNTRY_CODE
                    ? t('countryOtherOption')
                    : (manualCountry ? (selectedCountryObj ? selectedCountryObj.flag + ' ' + t(selectedCountryObj.nameKey) : '') : t('selectCountryPlaceholder'))}
                </Text>
              </TouchableOpacity>

              {/* نسخه ۳ — فاز ۳-و: وقتی کاربر «سایر» را انتخاب کرده،
                  یک فیلد متنی برای تایپ نام کشور واقعی‌اش نمایش داده
                  می‌شود؛ این متن در countryOther ذخیره می‌شود. */}
              {manualCountry === SR.OTHER_COUNTRY_CODE ? (
                <React.Fragment>
                  <Text style={[st.fieldLabel, { textAlign: textAlign }]}>{t('countryOtherLabel') + ' *'}</Text>
                  <TextInput
                    style={[st.input, { textAlign: textAlign }]}
                    placeholder={t('countryOtherPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={countryOtherText}
                    onChangeText={setCountryOtherText}
                  />
                </React.Fragment>
              ) : null}

              <Text style={[st.fieldLabel, { textAlign: textAlign }]}>{t('provinceLabel') + ' *'}</Text>
              <TextInput style={[st.input, { textAlign: textAlign }]} placeholder={t('provincePlaceholder')} placeholderTextColor={theme.colors.textMuted} value={manualProvince} onChangeText={setManualProvince} />

              <Text style={[st.fieldLabel, { textAlign: textAlign }]}>{t('cityManualLabel') + ' *'}</Text>
              <TextInput style={[st.input, { textAlign: textAlign }]} placeholder={t('cityManualPlaceholder')} placeholderTextColor={theme.colors.textMuted} value={manualCity} onChangeText={setManualCity} />

              {/* نسخه ۳ — فاز ۳-ز: قبلاً ثبت مختصات دقیق (چه GPS چه
                  دستی) عملاً اجباری بود. طبق خواسته‌ی کاربر این بخش
                  حالا کاملاً اختیاری است — عنوان بخش و راهنما به‌طور
                  صریح این را اعلام می‌کنند تا ابهامی برای کاربر
                  نماند. */}
              <Design.SectionTitle isRTL={isRTL}>{t('exactLocationTitle')}</Design.SectionTitle>
              {gettingLocation ? (
                <View style={st.submittingBox}><ActivityIndicator size="small" color={theme.colors.gold} /><Text style={st.submittingT}>{t('gettingLocation')}</Text></View>
              ) : (
                <TouchableOpacity style={st.gpsBtn} onPress={handleUseGPS}>
                  <Text style={st.gpsBtnT}>{'📍 ' + t('useGPS')}</Text>
                </TouchableOpacity>
              )}
              <Text style={[st.helpText, { textAlign: 'center', marginTop: theme.spacing.sm }]}>{t('enterManually')}</Text>
              <View style={st.coordRow}>
                <TextInput style={[st.input, st.coordInput]} placeholder={t('latitudeLabel') + ' (' + t('optionalLabel') + ')'} placeholderTextColor={theme.colors.textMuted} value={latInput} onChangeText={setLatInput} keyboardType="numbers-and-punctuation" />
                <TextInput style={[st.input, st.coordInput]} placeholder={t('longitudeLabel') + ' (' + t('optionalLabel') + ')'} placeholderTextColor={theme.colors.textMuted} value={lonInput} onChangeText={setLonInput} keyboardType="numbers-and-punctuation" />
              </View>
              <Text style={[st.fieldLabel, { textAlign: textAlign }]}>{t('elevationLabel') + ' (' + t('optionalLabel') + ')'}</Text>
              <TextInput style={[st.input, { textAlign: textAlign }]} placeholder="0" placeholderTextColor={theme.colors.textMuted} value={elevInput} onChangeText={setElevInput} keyboardType="numbers-and-punctuation" />
            </View>
          )}

          {/* === تاریخ و ساعت === */}
          <Design.SectionTitle isRTL={isRTL}>{t('dateSectionTitle')}</Design.SectionTitle>
          <Text style={[st.helpText, { textAlign: 'center' }]}>{t('sightingWindowNote')}</Text>
          <View style={st.yesNoRow}>
            <TouchableOpacity style={[st.yesNoBtn, dateType === 'jalali' && st.yesNoBtnActive]} onPress={function () { switchDateType('jalali'); }}>
              <Text style={[st.yesNoT, dateType === 'jalali' && st.yesNoTActive]}>{t('dateTypeJalali')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.yesNoBtn, dateType === 'gregorian' && st.yesNoBtnActive]} onPress={function () { switchDateType('gregorian'); }}>
              <Text style={[st.yesNoT, dateType === 'gregorian' && st.yesNoTActive]}>{t('dateTypeGregorian')}</Text>
            </TouchableOpacity>
          </View>

          <View style={st.dateRow}>
            {dateType === 'jalali' ? (
              <React.Fragment>
                <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('yearLabel')}</Text><TextInput style={st.dateInput} value={jYear} onChangeText={setJYear} keyboardType="number-pad" maxLength={4} /></View>
                <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('monthLabel')}</Text><TextInput style={st.dateInput} value={jMonth} onChangeText={setJMonth} keyboardType="number-pad" maxLength={2} /></View>
                <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('dayLabel')}</Text><TextInput style={st.dateInput} value={jDay} onChangeText={setJDay} keyboardType="number-pad" maxLength={2} /></View>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('yearLabel')}</Text><TextInput style={st.dateInput} value={gYear} onChangeText={setGYear} keyboardType="number-pad" maxLength={4} /></View>
                <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('monthLabel')}</Text><TextInput style={st.dateInput} value={gMonth} onChangeText={setGMonth} keyboardType="number-pad" maxLength={2} /></View>
                <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('dayLabel')}</Text><TextInput style={st.dateInput} value={gDay} onChangeText={setGDay} keyboardType="number-pad" maxLength={2} /></View>
              </React.Fragment>
            )}
          </View>
          <View style={st.dateRow}>
            <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('hourLabel')}</Text><TextInput style={st.dateInput} value={hourInput} onChangeText={setHourInput} keyboardType="number-pad" maxLength={2} /></View>
            <View style={st.dateField}><Text style={st.dateFieldLabel}>{t('minuteLabel')}</Text><TextInput style={st.dateInput} value={minuteInput} onChangeText={setMinuteInput} keyboardType="number-pad" maxLength={2} /></View>
          </View>

          {/* === نتیجه‌ی رصد === */}
          <Design.SectionTitle isRTL={isRTL}>{t('sightingResultSectionTitle')}</Design.SectionTitle>
          <View style={st.resultGrid}>
            {resultOptions.map(function (opt) {
              var isSel = sightingResult === opt.id;
              return (
                <TouchableOpacity key={opt.id} style={[st.resultOption, isSel && st.resultOptionActive]} onPress={function () { setSightingResult(opt.id); }}>
                  <Text style={st.resultOptionIcon}>{opt.icon}</Text>
                  <Text style={[st.resultOptionT, isSel && st.resultOptionTActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {sightingResult === SR.SIGHTING_RESULTS.NOT_ATTEMPTED ? (
            <View>
              <Design.SectionTitle isRTL={isRTL}>{t('noAttemptReasonTitle')}</Design.SectionTitle>
              <ChipRow options={reasonOptions} value={noAttemptReason} onChange={setNoAttemptReason} />
            </View>
          ) : null}

          {sightingResult !== SR.SIGHTING_RESULTS.SEEN_NAKED_EYE ? (
            <React.Fragment>
              <Design.SectionTitle isRTL={isRTL}>{t('equipmentTitle')}</Design.SectionTitle>
              <ChipRow options={equipmentOptions} value={equipment} onChange={setEquipment} />
            </React.Fragment>
          ) : null}

          <Design.SectionTitle isRTL={isRTL}>{t('weatherTitle')}</Design.SectionTitle>
          <ChipRow options={weatherOptions} value={weather} onChange={setWeather} />

          <Design.SectionTitle isRTL={isRTL}>{t('horizonQualityTitle')}</Design.SectionTitle>
          <ChipRow options={horizonOptions} value={horizonQuality} onChange={setHorizonQuality} />

          <Design.SectionTitle isRTL={isRTL}>{t('cloudPercentTitle') + ': ' + cloudPercent + '%'}</Design.SectionTitle>
          <Slider
            style={{ marginBottom: theme.spacing.md }}
            minimumValue={0} maximumValue={100} step={5}
            value={cloudPercent}
            onValueChange={function (v) { setCloudTouched(true); setCloudPercent(v); }}
            minimumTrackTintColor={theme.colors.gold}
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.gold}
          />

          <Design.SectionTitle isRTL={isRTL}>{t('reportTextLabel')}</Design.SectionTitle>
          <TextInput style={[st.input, st.textArea, { textAlign: textAlign }]} placeholder={t('reportTextPlaceholder')} placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline numberOfLines={4} />

          <Design.SectionTitle isRTL={isRTL}>{t('photoOptional')}</Design.SectionTitle>
          {photoUri ? (
            <View style={st.photoPreviewBox}>
              <TouchableOpacity activeOpacity={0.85} onPress={function () { setZoomedPhotoUri(photoUri); }}>
                <Image source={{ uri: photoUri }} style={st.photoPreview} />
              </TouchableOpacity>
              <TouchableOpacity style={st.photoRemove} onPress={function () { setPhotoUri(null); }}><Text style={st.photoRemoveT}>{t('removePhoto')}</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={st.photoButtons}>
              <TouchableOpacity style={st.photoBtn} onPress={takePhoto}><Text style={st.photoBtnT}>{'📷 ' + t('takePhoto')}</Text></TouchableOpacity>
              <TouchableOpacity style={st.photoBtn} onPress={pickPhoto}><Text style={st.photoBtnT}>{'🖼 ' + t('choosePhoto')}</Text></TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={st.confirmRow} onPress={function () { setConfirmAccuracy(!confirmAccuracy); }}>
            <View style={[st.checkbox, confirmAccuracy && st.checkboxActive]}>{confirmAccuracy ? <Text style={st.checkboxCheck}>{'✓'}</Text> : null}</View>
            <Text style={st.confirmT}>{t('confirmAccuracy')}</Text>
          </TouchableOpacity>

          {submitting ? (
            <View style={st.submittingBox}><ActivityIndicator size="small" color={theme.colors.gold} /><Text style={st.submittingT}>{progressLabel}</Text></View>
          ) : (
            <Design.Button variant="primary" onPress={handleSubmit} style={{ marginTop: theme.spacing.lg }}>
              {t('submitReportBtn')}
            </Design.Button>
          )}

          {editingReport ? (
            <TouchableOpacity style={st.deleteBtn} onPress={handleDelete}><Text style={st.deleteBtnT}>{t('deleteReport')}</Text></TouchableOpacity>
          ) : null}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {showCountryPicker ? (
        <View style={st.countryModalBg}>
          <View style={st.countryModalBox}>
            <Text style={st.countryModalTitle}>{t('selectCountry')}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {countries.map(function (c) {
                return (
                  <TouchableOpacity key={c.code} style={st.countryItem} onPress={function () { setManualCountry(c.code); setShowCountryPicker(false); }}>
                    <Text style={st.countryItemT}>{c.flag + ' ' + t(c.nameKey)}</Text>
                  </TouchableOpacity>
                );
              })}
              {/* نسخه ۳ — فاز ۳-و: گزینه‌ی «سایر» همیشه در انتهای لیست
                  کشورهای ثابت اپ اضافه می‌شود، برای کاربرانی که کشورشان
                  در این لیست از پیش‌تعیین‌شده نیست. */}
              <TouchableOpacity style={st.countryItem} onPress={function () { setManualCountry(SR.OTHER_COUNTRY_CODE); setShowCountryPicker(false); }}>
                <Text style={st.countryItemT}>{t('countryOtherOption')}</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={st.moClose} onPress={function () { setShowCountryPicker(false); }}><Text style={st.moCloseT}>{t('close')}</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ZoomableImageModal visible={!!zoomedPhotoUri} imageUri={zoomedPhotoUri} onClose={function () { setZoomedPhotoUri(null); }} />
    </React.Fragment>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  content: { padding: theme.spacing.lg },
  headerGradient: { paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.lg, alignItems: 'center' },
  titleLabel: { fontSize: 28, marginBottom: 4 },
  titleT: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight },

  editModeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(212,175,106,0.1)', borderRadius: theme.radius.sm + 2, padding: 12, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.borderGoldSubtle },
  editModeBannerIcon: { fontSize: 18 },
  editModeBannerT: { color: theme.colors.gold, fontSize: 12, flex: 1, lineHeight: 18 },

  helpText: { color: theme.colors.textMuted, fontSize: 11, marginBottom: theme.spacing.sm, lineHeight: 17 },
  fieldLabel: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 12, color: theme.colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  yesNoRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.md },
  yesNoBtn: { flex: 1, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  yesNoBtnActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  yesNoT: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  yesNoTActive: { color: theme.colors.goldDark },

  cityBox: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 14, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  cityBoxT: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: 'bold' },
  cityBoxSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },

  pickerBtn: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 12, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  pickerBtnT: { color: theme.colors.textPrimary, fontSize: 14 },

  gpsBtn: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.gold, marginBottom: theme.spacing.sm },
  gpsBtnT: { color: theme.colors.gold, fontSize: 14, fontWeight: '600' },
  coordRow: { flexDirection: 'row', gap: 8 },
  coordInput: { flex: 1 },

  dateRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm },
  dateField: { flex: 1 },
  dateFieldLabel: { color: theme.colors.textMuted, fontSize: 10, marginBottom: 3, textAlign: 'center' },
  dateInput: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm, padding: 10, color: theme.colors.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'center', borderWidth: 1, borderColor: theme.colors.border },

  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.md },
  resultOption: { width: '47%', backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  resultOptionActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  resultOptionIcon: { fontSize: 22, marginBottom: 4 },
  resultOptionT: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  resultOptionTActive: { color: theme.colors.goldDark },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: theme.spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bgCard, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill - 4, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  chipIcon: { fontSize: 13, marginRight: 4 },
  chipT: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTActive: { color: theme.colors.goldDark },

  photoButtons: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.md },
  photoBtn: { flex: 1, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  photoBtnT: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  photoPreviewBox: { marginBottom: theme.spacing.md },
  photoPreview: { width: '100%', height: 200, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  photoRemove: { alignSelf: 'center' },
  photoRemoveT: { color: theme.colors.danger, fontSize: 12 },

  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  checkboxCheck: { color: theme.colors.goldDark, fontSize: 14, fontWeight: 'bold' },
  confirmT: { color: theme.colors.textPrimary, fontSize: 13, flex: 1 },

  submittingBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 16 },
  submittingT: { color: theme.colors.textSecondary, fontSize: 13 },
  deleteBtn: { alignItems: 'center', padding: 12, marginTop: theme.spacing.sm },
  deleteBtnT: { color: theme.colors.danger, fontSize: 13, fontWeight: '600' },

  countryModalBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.bgOverlay, justifyContent: 'center', padding: 20 },
  countryModalBox: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.xl, padding: 20, maxHeight: '80%' },
  countryModalTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  countryItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  countryItemT: { color: theme.colors.textPrimary, fontSize: 14 },
  moClose: { padding: 12, alignItems: 'center', marginTop: 8 },
  moCloseT: { color: theme.colors.textMuted, fontSize: 14 },
});