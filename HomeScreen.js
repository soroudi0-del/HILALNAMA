import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Share, TextInput } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';

import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

var MoonCalculator = require('../calculations/moonPosition');
var WeatherService = require('../calculations/weatherService');
var SchaeferAtmoNotice = require('../components/SchaeferAtmoNotice').default;
var HijriCalendar = require('../calculations/hijriCalendar');
var UserSettings = require('../data/userSettings');
var Astronomy = require('astronomy-engine');
var tzlookup = require('tz-lookup');
var Design = require('../design');
var HilalNotifications = require('../notifications/hilalNotifications');
var AsyncStorageModule = require('@react-native-async-storage/async-storage');
var Storage = AsyncStorageModule.default || AsyncStorageModule;

var CRIT_STORAGE_KEY = 'selectedCriterion';
var VALID_CRITS = ['yallop', 'odeh', 'saao', 'ilyas', 'malaysia', 'soroudi', 'schaefer'];
var MAX_HIJRI_YEAR = 1700;
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ------------------------------------------------------------
// فاز ۱ نسخه ۳ (F1-10): افست منطقه‌ی زمانی محلی واقعی شهر (به
// دقیقه، مثبت شرق گرینویچ). برخلاف تقریب longitude*4 که فقط یک
// میانگین نجومی است، این تابع از نام واقعی منطقه‌ی زمانی سیاسی
// (IANA tz) استفاده می‌کند — همان چیزی که moonPosition.js برای
// نمایش ساعت هم استفاده می‌کند، تا سراسر اپ یک مبنای زمانی واحد
// داشته باشد.
// ------------------------------------------------------------
function getCityTzOffsetMinutes(city, atDate) {
  if (!city || city.lat === undefined || city.lon === undefined) return 0;
  try {
    var tz = tzlookup(city.lat, city.lon);
    var moment = require('moment-timezone');
    var m = moment(atDate || new Date()).tz(tz);
    return m.utcOffset(); // به دقیقه، با علامت صحیح
  } catch (e) {
    // fallback به تقریب طول جغرافیایی در صورت شکست tz-lookup
    return Math.max(-12*60, Math.min(12*60, city.lon * 4));
  }
}

function hijriToApproxDate(hY, hM) {
  var jd = Math.floor((11*hY+3)/30) + 354*hY + 30*hM - Math.floor((hM-1)/2) + 1948440 - 385;
  var a = jd+68569; var b = Math.floor(4*a/146097);
  a = a - Math.floor((146097*b+3)/4);
  var c = Math.floor(4000*(a+1)/1461001);
  a = a - Math.floor(1461*c/4) + 31;
  var d = Math.floor(80*a/2447);
  var day = a - Math.floor(2447*d/80);
  a = Math.floor(d/11);
  var month = d+2-12*a;
  var year = 100*(b-49)+c+a;
  return new Date(year, month-1, day);
}

function findNewMoonNear(date) {
  try {
    var sf = new Date(date.getTime() - 5*24*3600000);
    var nm = Astronomy.SearchMoonPhase(0, sf, 35);
    if (nm) return nm.date;
  } catch(e) {}
  return date;
}

function findNextNewMoon(date) {
  try {
    var r = Astronomy.SearchMoonPhase(0, date, 40);
    if (r) return r.date;
  } catch(e) {}
  return null;
}

// ===== اصلاح ۲: findPrevNewMoon صحیح =====
// آخرین مقارنه قبل از date را پیدا می‌کند (نه اولین)
function findPrevNewMoon(date) {
  try {
    var sb = new Date(date.getTime() - 35 * 24 * 3600000);
    var found = null;
    var candidate = Astronomy.SearchMoonPhase(0, sb, 40);
    var maxIter = 5;
    while (candidate && maxIter-- > 0) {
      if (candidate.date.getTime() < date.getTime()) {
        found = candidate; // این مقارنه قبل از date است - ادامه جستجو
        var nextSearch = new Date(candidate.date.getTime() + 28 * 24 * 3600000);
        candidate = Astronomy.SearchMoonPhase(0, nextSearch, 35);
      } else {
        break; // اولین مقارنه بعد از date - دیگر نیازی به ادامه نیست
      }
    }
    return found ? found.date : null;
  } catch(e) {}
  return null;
}

export default function HomeScreen(props) {
  var navigation = props.navigation;
  var LCtx = useLanguage();
  var t = LCtx.t;
  var lang = LCtx.lang;
  var isRTL = LCtx.isRTL;
  var HIJRI_MONTHS = LCtx.tArray('hijriMonths');

  var nextH = HijriCalendar.getNextHijriMonth(new Date());

  var s1 = useState(true); var loading = s1[0]; var setLoading = s1[1];
  var s2 = useState(null); var city = s2[0]; var setCity = s2[1];
  var s3 = useState(null); var moonData = s3[0]; var setMoonData = s3[1];
  var s4 = useState(null); var selDate = s4[0]; var setSelDate = s4[1];
  var s5 = useState('yallop'); var crit = s5[0]; var setCrit = s5[1];
  var s6 = useState([]); var fourDays = s6[0]; var setFourDays = s6[1];
  var s7 = useState(2); var activeDay = s7[0]; var setActiveDay = s7[1];
  var s8 = useState(null); var nmDate = s8[0]; var setNmDate = s8[1];
  var s9 = useState(false); var showPicker = s9[0]; var setShowPicker = s9[1];
  var s10 = useState(nextH.year); var hYear = s10[0]; var setHYear = s10[1];
  var s11 = useState(nextH.month); var hMonth = s11[0]; var setHMonth = s11[1];
  var sWx = useState({ status: 'loading', atmosphere: null, wx: null }); var wxRes = sWx[0]; var setWxRes = sWx[1];
  var s13 = useState(false); var showCritInfo = s13[0]; var setShowCritInfo = s13[1];
  // مورد ۱۰ کاربر: امکان تایپ مستقیم سال به‌جای کلیک‌های مکرر فلش.
  // یک state متنی جدا نگه می‌داریم تا حین تایپ (مثلاً وقتی کاربر
  // فیلد را موقتاً خالی می‌کند) hYear عددی خراب نشود.
  var s14 = useState(nextH.year.toString()); var yearInput = s14[0]; var setYearInput = s14[1];

  // v3.5: پشتیبان انتخابگر ماه (برای «لغو»)، توکن محاسبه (ضد رقابت)، و کلید شهر
  var pickerBackup = useRef(null);
  var calcToken = useRef(0);
  var baseData = useRef(null);   // نتیجه‌ی محاسبه بدون جوّ واقعی (برای بازمحاسبه‌ی Schaefer)
  var baseCity = useRef(null);
  var lastCityKey = useRef(null);
  var askedNotifications = useRef(false);

  // معیار انتخابی کاربر ماندگار می‌شود (قبلاً با هر اجرا به Yallop برمی‌گشت)
  useEffect(function() {
    Storage.getItem(CRIT_STORAGE_KEY).then(function(v) {
      if (v && VALID_CRITS.indexOf(v) !== -1) setCrit(v);
    }).catch(function() {});
  }, []);
  var changeCrit = function(c) {
    setCrit(c);
    Storage.setItem(CRIT_STORAGE_KEY, c).catch(function() {});
    if (city) HilalNotifications.syncSchedule(city, c).catch(function() {});
  };

  useFocusEffect(
    useCallback(function() {
      loadCity();
    }, [])
  );

  // فاز ۱ نسخه ۳ (رفع مورد ۱۲ کاربر: «با تغییر سال/ماه، اطلاعات
  // به‌روز نمی‌شود مگر یک‌بار فلش زده شود»):
  //
  // علت ریشه‌ای: پیش از این، changeMonth فقط state (hMonth/hYear)
  // را عوض می‌کرد و یک useEffect جداگانه با dependency [hYear,
  // hMonth] منتظر می‌ماند تا واکنش نشان بدهد. این الگو دو ضعف دارد:
  // (۱) یک چرخه‌ی رندر اضافه بین «کلیک کاربر» و «شروع محاسبه»
  // فاصله می‌اندازد، و (۲) چون findNM از طریق closure به hMonth/
  // hYear دسترسی داشت، در برخی توالی‌های سریع کلیک ممکن بود از
  // مقدار state یک رندر قدیمی‌تر (stale) بخواند.
  //
  // راه‌حل: changeMonth اکنون مقادیر جدید ماه/سال را مستقیم (نه از
  // طریق state/closure) به findNM پاس می‌دهد و findNM بلافاصله
  // (نه در یک effect جداگانه) محاسبه را اجرا می‌کند. این کل کلاس
  // باگ‌های «یک قدم عقب‌تر» را حذف می‌کند، نه فقط این نمونه‌ی خاص.
  var findNM = function(targetMonth, targetYear) {
    var approx = hijriToApproxDate(targetYear, targetMonth);
    var nm = findNewMoonNear(approx);
    setNmDate(nm);
    buildDays(nm, city);
  };

  var getCityName = function(c) {
    if (!c) return '';
    var key = UserSettings.getCityKey(c.name);
    if (key) return t(key);
    return c.name;
  };

  var loadCity = async function() {
    var c = await UserSettings.loadCity();
    setCity(c);
    // v3.5: با هر فوکوس تب، ماه/روزِ انتخاب‌شده‌ی کاربر پاک نشود؛
    // فقط وقتی شهر عوض شده (یا اولین بار است) محاسبه از نو انجام شود.
    var key = c ? [c.lat, c.lon, c.alt || 0].join('|') : null;
    if (key !== lastCityKey.current || !nmDate) {
      lastCityKey.current = key;
      findDefaultNM(c);
    }

    if (c) {
      // هم‌گام‌سازی بی‌صدا (بدون پنجره‌ی مجوز) با معیار انتخابی کاربر
      Storage.getItem(CRIT_STORAGE_KEY).then(function(v) {
        var useCrit = (v && VALID_CRITS.indexOf(v) !== -1) ? v : 'yallop';
        return HilalNotifications.syncSchedule(c, useCrit);
      }).catch(function(e) {
        console.warn('خطا در زمان‌بندی نوتیفیکیشن:', e);
      });
      // پرسش یک‌باره‌ی فعال‌سازی هشدار (فقط بار اول، پس از اولین بارگذاری)
      if (!askedNotifications.current) {
        askedNotifications.current = true;
        setTimeout(function() { HilalNotifications.maybeAskOnce().then(function(on) {
          if (on) HilalNotifications.syncSchedule(c, crit, { force: true }).catch(function() {});
        }); }, 1500);
      }
    }
  };

  var findDefaultNM = function(c) {
    var now = new Date();
    var nextNM = findNextNewMoon(now);
    var prevNM = findPrevNewMoon(now); // اصلاح ۲
    var nm;
    if (prevNM && nextNM) {
      var daysSincePrev = (now.getTime() - prevNM.getTime()) / (24*3600000);
      nm = daysSincePrev <= 20 ? prevNM : nextNM;
    } else {
      nm = prevNM || nextNM || now;
    }
    var hEst = HijriCalendar.getNextHijriMonth(nm);
    setHYear(hEst.year);
    setHMonth(hEst.month);
    setYearInput(hEst.year.toString());
    setNmDate(nm);
    buildDays(nm, c);
  };

  // فاز ۱ نسخه ۳ (F1-10): روز تقویمی «روز مقارنه» اکنون بر مبنای
  // منطقه‌ی زمانی محلی شهر انتخاب‌شده محاسبه می‌شود، نه روز تقویمی
  // UTC. پیش از این، اگر مقارنه نزدیک نیمه‌شب UTC رخ می‌داد (که برای
  // ایران با UTC+3:30 خیلی رایج است)، کارت «روز مقارنه» یک روز
  // اشتباه‌تر از تاریخ محلی واقعی نشان می‌داد.
  var buildDays = function(nm, c) {
    if (!nm) return;
    var tzOffset = getCityTzOffsetMinutes(c, nm);
    var d0 = HijriCalendar.toLocalCalendarDay(nm, tzOffset);
    var days = [
      {date: new Date(d0.getTime() - 24*3600000), short: t('dayBefore')},
      {date: new Date(d0.getTime()), short: t('dayConjunction')},
      {date: new Date(d0.getTime() + 24*3600000), short: t('dayAfter')},
      {date: new Date(d0.getTime() + 2*24*3600000), short: t('twoDaysAfter')},
    ];
    setFourDays(days);
    setActiveDay(2);
    if (c) doCalc(c, days[2].date, nm);
  };

  var doCalc = function(c, date, nm) {
    if (!c || !date) return;
    setLoading(true);
    setSelDate(date);
    var token = ++calcToken.current;
    setTimeout(function() {
      var data = MoonCalculator.getFullMoonData(date, c.lat, c.lon, c.alt, nm);
      if (token !== calcToken.current) return; // نتیجه‌ی کهنه (کاربر در این فاصله چیز دیگری خواست)
      baseData.current = data; baseCity.current = c;
      setMoonData(data);
      setLoading(false);
      applyAtmosphere(token);
    }, 50);
  };

  // v3.6: جوّ واقعیِ لحظه‌ی رؤیت (AOD/فشار/رطوبت/دما از Open-Meteo) را می‌گیرد و فقط Schaefer را
  // با آن بازمحاسبه می‌کند. اگر خاموش/آفلاین/خارج از بازه باشد، وضعیتش به کاربر نشان داده می‌شود.
  var applyAtmosphere = function(token) {
    var data = baseData.current, c = baseCity.current;
    if (!data || !c) return;
    var when = data.bestTime || data.sunSet;
    setWxRes({ status: 'loading', atmosphere: null, wx: null });
    WeatherService.resolveForSchaefer(c, when).then(function(res) {
      if (token !== undefined && token !== calcToken.current) return;
      if (baseData.current !== data) return;
      setWxRes(res);
      setMoonData(res.wx ? MoonCalculator.withAtmosphere(data, c.lat, c.lon, c.alt || 0, res.wx) : data);
    }).catch(function() {
      if (baseData.current === data) setWxRes({ status: 'unavailable', atmosphere: null, wx: null });
    });
  };
  var enableWeather = function() {
    WeatherService.setEnabled(true).then(function() { applyAtmosphere(); });
  };
  // برگشت از تنظیمات (کاربر ممکن است داده‌ی آنلاین را روشن/خاموش کرده باشد)
  useFocusEffect(
    useCallback(function() {
      if (baseData.current) applyAtmosphere();
    }, [])
  );

  // نکته (هماهنگ با رفع همین باگ در MapScreen.js): changeMonth باید
  // yearInput را هم هم‌گام نگه دارد — وگرنه اگر کاربر با فلش‌های ماه
  // (بیرون از مودال) از مرز سال عبور کند، hYear درست به‌روز می‌شود
  // ولی فیلد متنی سال در مودال انتخاب ماه/سال (yearInput) مقدار
  // قدیمی را نشان می‌دهد تا دفعه‌ی بعد که خودِ کاربر آن را دستی لمس
  // کند.
  var cancelPicker = function() {
    var b = pickerBackup.current;
    if (b) { setHMonth(b.m); setHYear(b.y); setYearInput(b.y.toString()); }
    setShowPicker(false);
  };

  var changeMonth = function(d) {
    var nm = hMonth + d; var ny = hYear;
    if (nm > 12) {nm=1; ny++;}
    if (nm < 1) {nm=12; ny--;}
    setHMonth(nm); setHYear(ny);
    setYearInput(ny.toString());
    findNM(nm, ny); // فراخوانی مستقیم با مقادیر تازه — نه از طریق state/useEffect
  };

  // ===== اصلاح ۶: getCat از getCatForCrit خالص استفاده می‌کند =====
  var getCat = function() {
    if (!moonData) return '';
    return MoonCalculator.getCatForCrit(moonData, crit);
  };

  // فاز ۱ نسخه ۳ (بازبینی ششم): رفع یک رگرسیون از بازبینی پنجم.
  // نسخه‌ی قبلی این دو تابع مستقیماً از MoonCalculator.getCatText/
  // getCatTextFull می‌خواند که متن فارسی hardcoded برمی‌گرداندند —
  // یعنی کاربران عربی/انگلیسی همیشه متن فارسی می‌دیدند، صرف‌نظر از
  // زبان انتخابی خودشان. حالا از MoonCalculator.getCatTextKey/
  // getCatTextFullKey فقط کلید ترجمه (مثلاً 'crit_yallop_catD')
  // گرفته می‌شود و با t(key) از LanguageContext خوانده می‌شود —
  // دقیقاً مسیر عادی ترجمه‌ی بقیه‌ی این فایل. کلیدهای per-criterion
  // برای هر سه زبان (fa/ar/en) در translations.js اضافه شده‌اند.
  var getCatTextLocal = function(cat, forCrit) {
    return t(MoonCalculator.getCatTextKey(cat, forCrit || crit));
  };

  var getCatFullLocal = function(cat, forCrit) {
    var key = MoonCalculator.getCatTextFullKey(cat, forCrit || crit);
    return key ? t(key) : '';
  };

  // فاز ۱ نسخه ۳ (بازبینی پنجم): هر معیار فقط زیرمجموعه‌ای از حروف
  // A-F را واقعاً استفاده می‌کند (مثلاً Odeh فقط A-D دارد، SAAO فقط
  // B/C/F، Ilyas فقط B/F، و MABIMS فقط B/F). این لیست برای ساخت
  // راهنمای مخصوص هر معیار (به‌جای یک راهنمای ثابت و مشترک با ۶ حرف)
  // لازم است، تا کاربر حرفی را در راهنما نبیند که آن معیار اصلاً
  // تولید نمی‌کند.
  var CRIT_LETTERS = {
    yallop: ['A','B','C','D','E','F'],
    odeh: ['A','B','C','D'],
    saao: ['B','C','F'],
    // Ilyas (1988) فقط یک خط مرزی دوحالته دارد (رؤیت با چشم: بله/
    // خیر). ناحیه‌ی C («فقط با ابزار نوری») قبلاً اینجا بود اما در
    // منبع اصلی وجود نداشت — یک قرارداد خودساخته بود که حذف شد.
    ilyas: ['B','F'],
    malaysia: ['B','F'],
    // Soroudi نسخه ۴: soroudiCat مستقیماً از yallopCat مشتق می‌شود
    // (رده‌ی پایه) و سقف اجماع فقط می‌تواند به سمت F حرکت کند —
    // هرگز خارج از بازه‌ی یالوپ. پیش از این اصلاح، نبودِ 'E' در این
    // آرایه باعث می‌شد وقتی soroudiCat برابر E بود، آن رده از راهنمای
    // مخصوص معیار غایب باشد.
    soroudi: ['A','B','C','D','E','F'],
    schaefer: ['A','B','C','D','E','F'],
  };

  // v3.5: روز تقویمیِ «مدنی» از یک لنگر (ظهر UTC) یا یک لحظه‌ی واقعی در منطقه‌ی
  // زمانی شهر؛ مستقل از منطقه‌ی زمانی دستگاه (قبلاً getDate()/getDay() دستگاه
  // استفاده می‌شد).
  var civil = function(date, isInstant) {
    if (!date) return date;
    var a = (isInstant && city) ? MoonCalculator.getLocalDayAnchor(date, city.lat, city.lon) : date;
    return new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 12, 0, 0);
  };

  var formatGregorianLocal = function(c) {
    var months = LCtx.tArray('gregorianMonths');
    return c.getDate() + ' ' + (months[c.getMonth()] || (c.getMonth() + 1)) + ' ' + c.getFullYear();
  };

  // فارسی: شمسی؛ عربی/انگلیسی: میلادی
  var formatDateLocal = function(date, isInstant) {
    if (!date) return '---';
    var c = civil(date, isInstant);
    if (lang === 'en') return HijriCalendar.formatGregorian(c);
    if (lang === 'ar') return formatGregorianLocal(c);
    return HijriCalendar.formatJalali(c);
  };

  var formatDateShortLocal = function(date) {
    if (!date) return '---';
    var c = civil(date, false);
    if (lang === 'en' || lang === 'ar') return (c.getMonth()+1)+'/'+c.getDate();
    return HijriCalendar.formatJalaliShort(c);
  };

  var getWeekDayLocal = function(date, isInstant) {
    if (!date) return '---';
    var days = LCtx.tArray('weekDays');
    return days[civil(date, isInstant).getDay()];
  };

  var doShare = function() {
    var cat = getCat();
    var msg = t('shareTitle') + ' ' + HIJRI_MONTHS[hMonth-1] + ' ' + hYear + '\n\n';
    msg += t('shareCity') + ' ' + getCityName(city) + '\n';
    msg += t('shareSunset') + ' ' + getWeekDayLocal(selDate) + ' ' + formatDateLocal(selDate) + '\n';
    msg += HijriCalendar.formatGregorian(civil(selDate, false)) + '\n\n';
    if (nmDate) {
      msg += t('shareConjunction') + ' ' + formatDateLocal(nmDate, true) + ' ' + t('shareTime') + ' ' + MoonCalculator.formatTime(nmDate, city ? city.lat : undefined, city ? city.lon : undefined) + '\n\n';
    }
    msg += t('shareCriterionResult') + ' ' + MoonCalculator.getCritLabel(crit) + ':\n';
    msg += getCatTextLocal(cat) + '\n';
    msg += getCatFullLocal(cat) + '\n\n';
    msg += t('shareCompare') + '\n';
    msg += '• Yallop: ' + getCatTextLocal(moonData.yallopCat, 'yallop') + '\n';
    msg += '• Odeh: ' + getCatTextLocal(moonData.odehCat, 'odeh') + '\n';
    msg += '• SAAO / Caldwell: ' + getCatTextLocal(moonData.saaoCat, 'saao') + '\n';
    msg += '• Ilyas: ' + getCatTextLocal(moonData.ilyasCat, 'ilyas') + '\n';
    msg += '• MABIMS 2021: ' + getCatTextLocal(moonData.malaysiaCat, 'malaysia') + '\n';
    // نسخه ۴ Soroudi: soroudiScore/soroudiVeto دیگر تولید نمی‌شوند
    // (نگاه کنید به moonPosition.js). به‌جای آن‌ها، خلاصه‌ی سطح
    // توافق شاهدهای مستقل (SAAO/Ilyas) نمایش داده می‌شود.
    msg += '• Soroudi ★ ' + t('soroudiProposedLabel') + ': ' + getCatTextLocal(moonData.soroudiCat, 'soroudi') + ' (' + soroudiAgreementSummary(moonData, t) + ')\n';
    msg += '• Schaefer: ' + getCatTextLocal(moonData.schaeferCat, 'schaefer') + (moonData.schaeferR !== null && moonData.schaeferR !== undefined ? ' (R = ' + moonData.schaeferR.toFixed(2) + ')' : '') + '\n\n';
    msg += t('shareSpecs') + '\n';
    msg += '• ' + t('shareAltitude') + ' ' + MoonCalculator.formatDegree(moonData.moonAltitude) + '\n';
    msg += '• ' + t('shareAge') + ' ' + MoonCalculator.formatAge(moonData.moonAge) + ' ' + (moonData.moonAgeNote ? t(moonData.moonAgeNote) : '') + '\n';
    msg += '• ' + t('shareLag') + ' ' + MoonCalculator.formatDuration(moonData.lagTime) + '\n';
    msg += '• ' + t('shareBrightness') + ' ' + (moonData.illuminationPercent ? moonData.illuminationPercent.toFixed(2)+'%' : '---') + '\n';
    msg += '• Elongation: ' + (moonData.topoElongation !== null ? moonData.topoElongation.toFixed(2)+'°' : '---') + '\n\n';
    msg += t('shareApp');
    Share.share({message: msg}).catch(function(e) {});
  };

  if (loading && !moonData) {
    return (
      <View style={st.lc}>
        <Text style={{fontSize:60}}>🌙</Text>
        <ActivityIndicator size="large" color={theme.colors.gold} style={{marginTop:20}} />
        <Text style={st.lt}>{t('calculating')}</Text>
      </View>
    );
  }

  var cat = getCat();
  var catColor = theme.getCatColor(cat, crit);
  var textAlign = isRTL ? 'right' : 'left';

  return (
    <ScrollView style={st.container}>
      {/* هویت بصری نسخه ۳: گرادیان غروب (بنفش گرگ‌ومیش تا سرمه‌ی
          عمیق) به‌جای پس‌زمینه‌ی تخت قبلی — مستقیماً از موضوع اپ
          (لحظه‌ی غروب که هلال در آن رصد می‌شود) الهام گرفته شده. */}
      <LinearGradient
        colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]}
        style={st.headerGradient}>
        <View style={st.titleBox}>
          <Text style={st.titleLabel}>{t('hilalStatus')}</Text>
          <Text style={st.titleT}>{HIJRI_MONTHS[hMonth-1] + ' ' + hYear}</Text>
          {city ? <Text style={st.titleCity}>{getCityName(city)}</Text> : null}
        </View>
      </LinearGradient>

      <View style={st.content}>

        <View style={st.monthSel}>
          <TouchableOpacity onPress={function(){changeMonth(-1);}}>
            <Text style={st.mBtnT}>{isRTL ? '▶' : '◀'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={function(){ pickerBackup.current = { m: hMonth, y: hYear }; setYearInput(hYear.toString()); setShowPicker(true); }} style={st.mCenter}>
            <Text style={st.mCenterT}>{HIJRI_MONTHS[hMonth-1]+' '+hYear}</Text>
            <Text style={st.mCenterSub}>{t('selectMonthYear')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={function(){changeMonth(1);}}>
            <Text style={st.mBtnT}>{isRTL ? '◀' : '▶'}</Text>
          </TouchableOpacity>
        </View>

        {/* اصلاح ۱: نمایش هشدار polar night / midnight sun */}
        {moonData && moonData.midnightSun ? (
          <View style={st.polarWarn}>
            <Text style={st.polarWarnT}>☀️ {t('midnightSunWarn')}</Text>
          </View>
        ) : null}
        {moonData && moonData.polarNight ? (
          <View style={st.polarWarn}>
            <Text style={st.polarWarnT}>🌑 {t('polarNightWarn')}</Text>
          </View>
        ) : null}

        {nmDate ? (
          <View style={st.conjCard}>
            <Text style={st.conjTitle}>{t('conjunction')}</Text>
            <Text style={st.conjText}>{formatDateLocal(nmDate, true) + ' ' + t('shareTime') + ' ' + MoonCalculator.formatTime(nmDate, city ? city.lat : undefined, city ? city.lon : undefined)}</Text>
            <Text style={st.conjText2}>{HijriCalendar.formatGregorian(nmDate)}</Text>
          </View>
        ) : null}

        {fourDays.length > 0 ? (
          <View>
            <Design.SectionTitle isRTL={isRTL}>{t('selectDay')}</Design.SectionTitle>
            <View style={st.dayBtns}>
              {fourDays.map(function(d, i) {
                var isA = activeDay === i;
                return (
                  <Design.DayCard
                    key={i}
                    active={isA}
                    label={d.short}
                    weekDay={getWeekDayLocal(d.date)}
                    dateStr={formatDateShortLocal(d.date)}
                    onPress={function(){setActiveDay(i); doCalc(city, d.date, nmDate);}}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {selDate ? (
          <View style={st.dateBox}>
            <Text style={st.dateW}>{t('sunset') + ' ' + getWeekDayLocal(selDate)}</Text>
            <Text style={st.dateJ}>{formatDateLocal(selDate)}</Text>
            {/* نسخه ۳ — فاز ۳-ط: رفع اشکال اساسی — شماره‌ی روز قمری
                (مثلاً «۱ صفر») که این‌جا قبلاً نمایش داده می‌شد، صرفاً
                یک شمارش خطی فاصله‌ی روزانه از لحظه‌ی مقارنه‌ی نجومی
                بود (formatHijriFromConjunction)، بدون هیچ آگاهی از
                اینکه آیا هلال واقعاً در غروب هر روز دیده شده یا نه.
                نتیجه‌اش گمراه‌کننده بود: حتی وقتی هلال اصلاً در روز
                مقارنه قابل‌رؤیت نبود (که در چنین حالتی اساساً «۱
                صفر» بی‌معناست)، یا وقتی هلال در روز دوم دیده می‌شد
                (که باید ماه صفر رسمی از همان غروب شروع شود و روز
                بعدش «۲ صفر» باشد)، عدد نمایش‌داده‌شده با شمارش
                تقویمی واقعی/شرعی همخوانی نداشت — چون تقویم قمری
                رسمی همیشه به رؤیت واقعی وابسته است، نه به یک فرمول
                نجومی خطی. چون اپ فعلاً هیچ داده‌ی رؤیت واقعی و
                تأییدشده‌ای جمع‌آوری نمی‌کند که بتواند این عدد را
                درست بسازد، نمایش شماره‌ی روز طبق تصمیم آگاهانه حذف
                شد؛ فقط تاریخ شمسی و میلادی (که واقعی و بدون ابهام‌
                اند) نمایش داده می‌شوند. نام/سال ماه قمری (مثلاً
                «صفر ۱۴۴۸» بدون شماره‌ی روز) در عنوان بالای صفحه
                دست‌نخورده باقی مانده، چون آن مستقل از این ابهام و
                صرفاً حاصل شمارش چرخه‌ی ماه‌هاست. */}
            <Text style={st.dateG}>{HijriCalendar.formatGregorian(selDate)}</Text>
          </View>
        ) : null}

        {/* انتخاب معیار - با دکمه اطلاعات */}
        <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
            {[
              {id:'yallop', n:'YALLOP'},
              {id:'odeh', n:'ODEH'},
              {id:'saao', n:'SAAO'},
              {id:'ilyas', n:'ILYAS'},
              {id:'malaysia', n:'MABIMS'},
              {id:'soroudi', n:'SOROUDI ★'}, /* اصلاح علمی ۳: علامت‌گذاری */
              {id:'schaefer', n:'SCHAEFER'}
            ].map(function(c) {
              return (
                <TouchableOpacity key={c.id} style={[st.crBtn, crit===c.id&&st.crBtnA]}
                  onPress={function(){changeCrit(c.id);}}>
                  <Text style={[st.crBtnT, crit===c.id&&{color:theme.colors.goldDark}]}>{c.n}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={st.infoBtn} onPress={function(){setShowCritInfo(true);}}>
            <Text style={st.infoBtnT}>ℹ</Text>
          </TouchableOpacity>
        </View>

        {/* نمایش توضیح معیار فعال */}
        <View style={st.critDescBox}>
          <Text style={[st.critDescLabel, {textAlign: textAlign}]}>{MoonCalculator.getCritLabel(crit)}</Text>
          <Text style={[st.critDescText, {textAlign: textAlign}]}>{MoonCalculator.getCritDescription(crit, t)}</Text>
          {/* اصلاح علمی ۳: هشدار برای Soroudi */}
          {crit === 'soroudi' ? (
            <Text style={[st.critWarn, {textAlign: textAlign}]}>
              ★ {t('soroudiWarnText')}
            </Text>
          ) : null}
          {crit === 'schaefer' ? (
            <Text style={[st.critWarn, {textAlign: textAlign}]}>
              {t('schaeferNote')}
            </Text>
          ) : null}
          {crit === 'schaefer' ? (
            <SchaeferAtmoNotice status={wxRes.status} atmosphere={wxRes.atmosphere} t={t} isRTL={isRTL} onEnable={enableWeather} />
          ) : null}
        </View>

        {moonData ? (
          <Design.Card variant="featured" accentColor={catColor} style={st.resultBoxOverride}>
            <Design.CrescentBadge cat={cat} crit={crit} size={64} />
            <Text style={[st.resultMainT, {color:catColor}]}>{getCatTextLocal(cat)}</Text>
            <Text style={st.resultDescT}>{getCatFullLocal(cat)}</Text>
            <Text style={st.resultSunset}>{t('sunset') + ' ' + getWeekDayLocal(selDate) + ' ' + formatDateLocal(selDate)}</Text>
            <Text style={st.resultCrit}>{t('criterion') + ': ' + MoonCalculator.getCritLabel(crit)}</Text>
          </Design.Card>
        ) : null}

        {moonData && city ? (
          <View style={st.card}>
            <Text style={[st.cardTitle, {textAlign: textAlign}]}>{t('hilalSpecs')}</Text>
            <DR l={t('sunsetTime')} v={MoonCalculator.formatTime(moonData.sunSet, city.lat, city.lon)} rtl={isRTL} />
            <DR l={t('sunAzimuth')} v={MoonCalculator.formatDegree(moonData.sunAzimuth)} rtl={isRTL} />
            <View style={st.sep}/>
            <DR l={t('moonAzimuth')} v={MoonCalculator.formatDegree(moonData.moonAzimuth)} rtl={isRTL} />
            <DR l={t('moonAltitude')} v={MoonCalculator.formatDegree(moonData.moonAltitude)} c={moonData.moonAltitude>0?theme.colors.success:theme.colors.danger} rtl={isRTL} />
            {/* اصلاح ۵: DAZ با علامت */}
            <DR l={t('dazLabel') + ' (DAZ)'} v={moonData.dazSigned !== null ? (moonData.dazSigned >= 0 ? '+' : '') + moonData.dazSigned.toFixed(2) + '°' : '---'} rtl={isRTL} />
            <DR l={t('elongationTopo')} v={moonData.topoElongation !== null ? moonData.topoElongation.toFixed(2)+'°' : '---'} rtl={isRTL} />
            <DR l={t('elongationGeo')} v={moonData.elongation ? moonData.elongation.toFixed(2)+'°' : '---'} rtl={isRTL} />
            <View style={st.sep}/>
            <DR l={t('moonsetTime')} v={MoonCalculator.formatTime(moonData.moonSet, city.lat, city.lon)} rtl={isRTL} />
            <DR l={t('lagTimeLabel')} v={MoonCalculator.formatDuration(moonData.lagTime)} c={moonData.lagTime>0?theme.colors.success:theme.colors.danger} rtl={isRTL} />
            {/* اصلاح علمی ۶: سن هلال با توضیح */}
            <DR l={t('moonAgeLabel')} v={MoonCalculator.formatAge(moonData.moonAge, moonData.moonAgeNote)} rtl={isRTL} />
            {moonData.moonAgeNote ? (
              <Text style={[st.ageNote, {textAlign: textAlign}]}>* {t(moonData.moonAgeNote)}</Text>
            ) : null}
            <DR l={t('illumination')} v={moonData.illuminationPercent ? moonData.illuminationPercent.toFixed(3)+'%' : '---'} rtl={isRTL} />
            <DR l={t('crescentWidthLabel')} v={moonData.crescentWidth ? moonData.crescentWidth.toFixed(3)+" '" : '---'} rtl={isRTL} />
            <DR l={t('moonSemiDiamLabel')} v={moonData.moonSemiDiam ? (moonData.moonSemiDiam*60).toFixed(1)+" '" : '---'} rtl={isRTL} />
            <View style={st.sep}/>
            <DR l={t('eclipticLat')} v={MoonCalculator.formatDegreeDM(moonData.moonEclipticLat)} rtl={isRTL} />
            <DR l={t('moonDistanceLabel')} v={moonData.moonDistance ? moonData.moonDistance.toFixed(0)+' km' : '---'} rtl={isRTL} />
            <DR l="Yallop q" v={moonData.yallopQ !== null ? moonData.yallopQ.toFixed(4) : '---'} c={catColor} rtl={isRTL} />
            {/* نسخه ۴ Soroudi: ردیف قدیمی "Soroudi Score ★" حذف شد
                چون moonData.soroudiScore دیگر هرگز تولید نمی‌شود
                (همیشه null بود و همیشه '---' نشان می‌داد — داده‌ی
                مرده‌ی باقی‌مانده از نسخه‌ی امتیازی قبلی). به‌جای آن،
                رده‌ی پایه (مستقیماً از یالوپ) و خلاصه‌ی توافق شاهدهای
                مستقل نمایش داده می‌شود. */}
            {moonData.schaeferR !== null && moonData.schaeferR !== undefined ? (
              <View>
                <DR l={t('schaeferRLabel')} v={(moonData.schaeferR >= 0 ? '+' : '') + moonData.schaeferR.toFixed(2)} c={theme.getCatColor(moonData.schaeferCat, 'schaefer')} rtl={isRTL} />
                <DR l={t('schaeferProbLabel')} v={Math.round(moonData.schaeferProb * 100) + '%'} c={theme.getCatColor(moonData.schaeferCat, 'schaefer')} rtl={isRTL} />
                <DR l={t('schaeferSkyLabel')} v={Math.round(moonData.schaefer.skyNL).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' nL'} rtl={isRTL} />
                <DR l={t('schaeferExtLabel')} v={moonData.schaefer.extinctionMag.toFixed(2) + ' mag  (k = ' + moonData.schaefer.kTotal.toFixed(2) + ')'} rtl={isRTL} />
              </View>
            ) : null}
            <DR l={t('soroudiBaseLabel')} v={getCatTextLocal(moonData.soroudiBaseCat, 'yallop')} c={theme.getCatColor(moonData.soroudiBaseCat, 'yallop')} rtl={isRTL} />
            <DR l={t('soroudiAgreementLabel')} v={soroudiAgreementSummary(moonData, t)} c={theme.getCatColor(moonData.soroudiCat, 'soroudi')} rtl={isRTL} />
            {/* اصلاح علمی ۵: Danjon دو سطح */}
            <View style={st.sep}/>
            <View style={st.danjonRow}>
              <Text style={[st.dl, {textAlign: textAlign, flex:1}]}>{t('danjonLimit')}</Text>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{color: moonData.danjonOkNaked ? theme.colors.success : theme.colors.danger, fontSize:11, fontWeight:'600'}}>
                  {'👁 ' + t('danjonNakedEyeLabel') + ': ' + (moonData.danjonOkNaked ? t('danjonPassed') : t('danjonNotPassed'))}
                </Text>
                <Text style={{color: moonData.danjonOkTelescope ? theme.colors.catB : theme.colors.ember, fontSize:10, marginTop:2}}>
                  {'🔭 ' + t('danjonTelescopeLabel') + ': ' + (moonData.danjonOkTelescope ? t('danjonPassed') : t('danjonNotPassed'))}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {moonData ? (
          <View style={st.card}>
            <Text style={[st.cardTitle, {textAlign: textAlign}]}>{t('compareCriteria')}</Text>
            {/* اصلاح ۶: getCatForCrit خالص */}
            {/* فاز ۱ نسخه ۳ (بازبینی چهارم): برچسب‌های ثابت قبلی
                (مثلاً "Ilyas (1988/1994)") جایگزین شدند با
                MoonCalculator.getCritLabel(crit) — دقیقاً همان تابعی
                که در بقیه‌ی این فایل (خط توضیح معیار، دکمه‌ی اشتراک،
                پاپ‌آپ اطلاعات معیارها) استفاده می‌شود. علت: بعد از
                اصلاح Ilyas در moonPosition.js (از "Ilyas (1988/1994)"
                به "Ilyas (1988)"، چون ۱۹۹۴ فرمول عددی مستقلی ندارد)،
                رشته‌ی هاردکد شده‌ی این‌جا هم‌گام نشده بود. با خواندن
                از getCritLabel، این بخش دیگر هرگز از بقیه‌ی اپ عقب
                نمی‌ماند — هر تغییر برچسب فقط در moonPosition.js لازم
                است، نه در چند جای پراکنده. */}
            <CR name={MoonCalculator.getCritLabel('yallop')} cat={MoonCalculator.getCatForCrit(moonData,'yallop')} crit="yallop" t={getCatTextLocal} />
            <CR name={MoonCalculator.getCritLabel('odeh')} cat={MoonCalculator.getCatForCrit(moonData,'odeh')} crit="odeh" t={getCatTextLocal} />
            <CR name={MoonCalculator.getCritLabel('saao')} cat={MoonCalculator.getCatForCrit(moonData,'saao')} crit="saao" t={getCatTextLocal} />
            <CR name={MoonCalculator.getCritLabel('ilyas')} cat={MoonCalculator.getCatForCrit(moonData,'ilyas')} crit="ilyas" t={getCatTextLocal} />
            <CR name={MoonCalculator.getCritLabel('malaysia')} cat={MoonCalculator.getCatForCrit(moonData,'malaysia')} crit="malaysia" t={getCatTextLocal} />
            <CR name={MoonCalculator.getCritLabel('soroudi')} cat={MoonCalculator.getCatForCrit(moonData,'soroudi')} crit="soroudi" t={getCatTextLocal} isProposed={true} proposedLabel={t('soroudiProposedLabel')} />
            <CR name={MoonCalculator.getCritLabel('schaefer')} cat={MoonCalculator.getCatForCrit(moonData,'schaefer')} crit="schaefer" t={getCatTextLocal} />
            {/* توضیح علمی: اختلاف بین معیارها در روزهای مرزی طبیعی و
                مستند در ادبیات علمی رصد هلال است، نه نشانه‌ی خطا؛
                هر معیار از مجموعه‌داده‌ی رصدی و روش آماری متفاوتی
                ساخته شده و در نقاط مرزی می‌تواند نتیجه‌ی متفاوتی بدهد. */}
            {criteriaDisagree(moonData) ? (
              <Text style={st.compareNote}>
                {t('criteriaDisagreeNote')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={st.card}>
          {/* فاز ۱ نسخه ۳ (بازبینی پنجم): این راهنما قبلاً همیشه ۶
              حرف A-F را با یک متن ثابت (از t('catXText')) نشان
              می‌داد، بدون توجه به این‌که کدام معیار در بالای صفحه
              انتخاب شده. مشکل این‌جا مهم‌تر از تکرارِ برچسب‌های
              نادرست بود: چون معیارهایی مثل SAAO/Ilyas/MABIMS اصلاً
              حرف A یا D تولید نمی‌کنند، نمایش آن‌ها در راهنما به
              کاربر القا می‌کرد که معیار انتخاب‌شده هم می‌تواند به آن
              رده‌ها برسد، در حالی که هرگز نمی‌رسد. اکنون راهنما فقط
              حروفی را نشان می‌دهد که خودِ معیار انتخاب‌شده (crit)
              واقعاً تولید می‌کند، با متن مخصوص همان معیار. */}
          <Text style={[st.cardTitle, {textAlign: textAlign}]}>{t('guide') + ' — ' + MoonCalculator.getCritLabel(crit)}</Text>
          {(CRIT_LETTERS[crit] || CRIT_LETTERS.yallop).map(function(letter) {
            return <LR key={letter} cat={letter} text={getCatTextLocal(letter, crit)} crit={crit} />;
          })}
          {crit !== 'yallop' ? (
            <Text style={st.critWarn}>
              {t('critLettersLegendNote') + ' ' + MoonCalculator.getCritLabel(crit) + ' ' + t('critLettersLegendNoteSuffix')}
            </Text>
          ) : null}
        </View>

        {city ? (
          <View style={st.locBox}>
            <Text style={st.locT}>{'📍 '+getCityName(city)+' | '+city.lat.toFixed(4)+'°, '+city.lon.toFixed(4)+'° | '+city.alt+'m'}</Text>
          </View>
        ) : null}

        {moonData && selDate && city ? (
          <TouchableOpacity style={st.shareBtn} onPress={doShare}>
            <Text style={st.shareBtnT}>{t('share')}</Text>
          </TouchableOpacity>
        ) : null}

        {navigation ? (
          <TouchableOpacity
            style={st.analysisBtn}
            accessibilityRole="button"
            accessibilityLabel={t('mnEntry')}
            onPress={function () { navigation.navigate('MoonNow'); }}>
            <Text style={st.analysisBtnT}>{'🌗 ' + t('mnEntry')}</Text>
            <Text style={st.analysisBtnSub}>{t('mnEntrySub')}</Text>
          </TouchableOpacity>
        ) : null}

        {navigation ? (
          <TouchableOpacity
            style={st.analysisBtn}
            accessibilityRole="button"
            accessibilityLabel={t('agEntry')}
            onPress={function () { navigation.navigate('AimGuide'); }}>
            <Text style={st.analysisBtnT}>{'🎯 ' + t('agEntry')}</Text>
            <Text style={st.analysisBtnSub}>{t('agEntrySub')}</Text>
          </TouchableOpacity>
        ) : null}

        {moonData && selDate && city && navigation ? (
          <TouchableOpacity
            style={st.analysisBtn}
            onPress={function () {
              navigation.navigate('CrescentAnalysis', {
                date: selDate,
                city: city,
                nmDate: nmDate,
                crit: crit,
              });
            }}>
            <Text style={st.analysisBtnT}>{'🔭 ' + t('saTitle')}</Text>
          </TouchableOpacity>
        ) : null}

        {/* دکمه‌ی خروجی رسمی PDF — درخواست کاربر: «کاربر بتواند خروجی
            دقیقی برای کمیسیون‌های رؤیت هلال بگیرد». دقیقاً همان چهار
            پارامتری که به CrescentAnalysis می‌رود این‌جا هم می‌رود
            (date, city, nmDate, crit) چون ReportExportScreen خودش از
            روی nmDate هر ۴ روز مقارنه را می‌سازد (نگاه کنید به
            ReportExportScreen.js — دقیقاً همان الگوی
            CrescentAnalysisScreen.js). */}
        {moonData && selDate && city && nmDate && navigation ? (
          <TouchableOpacity
            style={st.reportExportBtn}
            onPress={function () {
              navigation.navigate('ReportExport', {
                date: selDate,
                city: city,
                nmDate: nmDate,
                crit: crit,
                hMonth: hMonth,
                hYear: hYear,
              });
            }}>
            <Text style={st.reportExportBtnT}>{'📄 ' + t('reportExportBtnLabel')}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={st.refreshBtn} onPress={function(){loadCity();}}>
          <Text style={st.refreshBtnT}>{t('refresh')}</Text>
        </TouchableOpacity>

        <View style={{height:40}} />
      </View>

      {/* Modal انتخاب ماه */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={cancelPicker}>
        <View style={st.moBg}><View style={st.moBox}>
          <Text style={st.moTitle}>{t('selectMonthYear')}</Text>
          <View style={st.yrRow}>
            <TouchableOpacity onPress={function(){ var ny=hYear-1; setHYear(ny); setYearInput(ny.toString()); }} style={st.yrBtn}>
              <Text style={st.yrBtnT}>{isRTL ? '▶' : '◀'}</Text>
            </TouchableOpacity>
            {/* مورد ۱۰ کاربر: تایپ مستقیم سال به‌جای کلیک‌های مکرر.
                onChangeText فقط متن را نگه می‌دارد (اجازه‌ی خالی/ناقص
                بودن موقت حین تایپ)؛ onBlur/onSubmitEditing عدد را
                اعتبارسنجی و به hYear واقعی اعمال می‌کند. */}
            <TextInput
              style={st.yrInput}
              value={yearInput}
              onChangeText={function(txt){ setYearInput(txt.replace(/[^0-9]/g, '')); }}
              onEndEditing={function(){
                var n = parseInt(yearInput, 10);
                if (isNaN(n) || n < 1 || n > MAX_HIJRI_YEAR) {
                  setYearInput(hYear.toString()); // برگشت به آخرین مقدار معتبر
                } else {
                  setHYear(n);
                  setYearInput(n.toString());
                }
              }}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />
            <TouchableOpacity onPress={function(){ var ny=hYear+1; setHYear(ny); setYearInput(ny.toString()); }} style={st.yrBtn}>
              <Text style={st.yrBtnT}>{isRTL ? '◀' : '▶'}</Text>
            </TouchableOpacity>
          </View>
          <View style={st.moGrid}>
            {HIJRI_MONTHS.map(function(name, i) {
              var isSel = hMonth === (i+1);
              return (
                <TouchableOpacity key={i} style={[st.moItem, isSel&&st.moItemA]}
                  onPress={function(){setHMonth(i+1);}}>
                  <Text style={[st.moItemT, isSel&&{color:theme.colors.goldDark}]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={st.moOk} onPress={function(){
            // سال تایپ‌شده را همین‌جا اعتبارسنجی می‌کنیم (onEndEditing ممکن است دیرتر از این لمس برسد)
            var typed = parseInt(yearInput, 10);
            var y = (isNaN(typed) || typed < 1 || typed > MAX_HIJRI_YEAR) ? hYear : typed;
            setHYear(y); setYearInput(y.toString());
            setShowPicker(false); findNM(hMonth, y);
          }}>
            <Text style={st.moOkT}>{t('confirm')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.moCancel} onPress={cancelPicker}>
            <Text style={st.moCancelT}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* Modal اطلاعات معیارها */}
      <Modal visible={showCritInfo} transparent animationType="fade">
        <View style={st.moBg}>
          <View style={st.infoBox}>
            <Text style={st.infoTitle}>{t('criteriaInfoTitle')}</Text>
            <ScrollView>
              {[
                {id:'yallop'},{id:'odeh'},{id:'saao'},{id:'ilyas'},{id:'malaysia'},{id:'soroudi'},{id:'schaefer'}
              ].map(function(c) {
                return (
                  <View key={c.id} style={st.infoItem}>
                    <Text style={st.infoItemTitle}>{MoonCalculator.getCritLabel(c.id)}</Text>
                    <Text style={st.infoItemDesc}>{MoonCalculator.getCritDescription(c.id, t)}</Text>
                    {c.id === 'soroudi' ? (
                      <Text style={st.infoItemWarn}>⚠ {t('nonOfficialCriterionWarn')}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={st.moOk} onPress={function(){setShowCritInfo(false);}}>
              <Text style={st.moOkT}>{t('closeBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// نسخه ۳: DR اکنون به theme.js وصل است تا رنگ پیش‌فرض مقدار
// (وقتی p.c مشخص نشده) با پالت جدید هماهنگ باشد، بدون نیاز به
// تغییر ده‌ها فراخوانی <DR ... /> در سراسر فایل.
// نسخه ۳: تشخیص اختلاف قابل‌توجه بین معیارها — وقتی هم‌زمان رده‌ای
// «مطلوب» (A/B) و رده‌ای «نامطلوب» (E/F) در بین ۶ معیار دیده شود.
// این تابع خالص است (فقط از moonData می‌خواند)، بدون وابستگی به state.
function criteriaDisagree(data) {
  var cats = [data.yallopCat, data.odehCat, data.saaoCat, data.ilyasCat, data.malaysiaCat, data.soroudiCat, data.schaeferCat];
  var hasGood = cats.some(function(c){ return c === 'A' || c === 'B'; });
  var hasBad = cats.some(function(c){ return c === 'E' || c === 'F'; });
  return hasGood && hasBad;
}

// نسخه ۴ Soroudi: خلاصه‌ی متنی سطح توافق شاهدهای مستقل (SAAO/Ilyas)،
// از روی moonData.soroudiAgreement (نگاه کنید به moonPosition.js).
// این تابع خالص است. اگر داده‌ی اجماع در دسترس نباشد (مثلاً یالوپ
// قابل‌محاسبه نبوده)، رشته‌ی خالی برمی‌گرداند.
function soroudiAgreementSummary(data, t) {
  var ag = data && data.soroudiAgreement;
  if (!ag || ag.independentTotal === 0) return t('soroudiAgreementUnknown');
  if (ag.independentAgreeCount === ag.independentTotal) return t('soroudiAgreementFull');
  if (ag.independentAgreeCount === 0) return t('soroudiAgreementNone');
  return t('soroudiAgreementPartial');
}

function DR(p) {
  return (
    <View style={st.dr}>
      <Text style={[st.dv, p.c?{color:p.c}:null]}>{p.v}</Text>
      <Text style={[st.dl, {textAlign: p.rtl ? 'right' : 'left'}]}>{p.l}</Text>
    </View>
  );
}

function CR(p) {
  // رفع باگ رنگ: دقیقاً همان مشکلی که برای متن (p.t(p.cat, p.crit))
  // پیش‌تر رفع شده بود، برای رنگ هم وجود داشت — getCatColor بدون
  // p.crit صدا زده می‌شد و رنگ را فقط از روی حرف (نه معیار) تعیین
  // می‌کرد. مثال ملموس: D در Odeh («کاملاً غیرقابل رؤیت») با همان
  // نارنجی D در Yallop («فقط با ابزار نوری») نمایش داده می‌شد، در
  // حالی که باید مثل بدترین رده (قرمز) دیده شود.
  var color = theme.getCatColor(p.cat, p.crit);
  return (
    <View style={st.critRow}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        <View style={[st.critDot,{backgroundColor:color}]}/>
        <Text style={[st.critCatT,{color:color}]}>{p.cat||'?'}</Text>
        {/* فاز ۱ نسخه ۳ (بازبینی پنجم): قبلاً p.t(p.cat) بدون شناسه‌ی
            معیار صدا زده می‌شد، و چون t همان getCatTextLocal بود که
            بدون آرگومان دوم به crit (معیار فعلاً انتخاب‌شده در بالای
            صفحه) بازمی‌گشت، همه‌ی ۶ ردیف این لیست مقایسه یک متن
            یکسان (متعلق به فقط یک معیار) نشان می‌دادند — دقیقاً همان
            باگی که قرار بود این لیست از آن جلوگیری کند. اکنون p.crit
            (شناسه‌ی همان معیاری که این ردیف مربوط به آن است) صریحاً
            پاس داده می‌شود. */}
        <Text style={st.critDescT}>{p.t(p.cat, p.crit)}</Text>
      </View>
      <View style={{alignItems:'flex-end'}}>
        <Text style={st.critNameT}>{p.name}</Text>
        {p.isProposed ? <Text style={st.proposedTag}>{p.proposedLabel}</Text> : null}
      </View>
    </View>
  );
}

function LR(p) {
  // رفع باگ رنگ: مشابه CR — رنگ باید بر اساس معیار (p.crit) باشد،
  // نه فقط حرف. LR فقط برای راهنمای معیار انتخاب‌شده استفاده می‌شود
  // (نگاه کنید به فراخوانی‌اش با CRIT_LETTERS[crit])، پس p.crit
  // همیشه همان معیار فعلی است.
  var color = theme.getCatColor(p.cat, p.crit);
  return (
    <View style={st.legRow}>
      <Text style={st.legText}>{p.text}</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
        <Text style={{color:color,fontWeight:'bold'}}>{p.cat}</Text>
        <View style={[st.legDot,{backgroundColor:color}]}/>
      </View>
    </View>
  );
}

var st = StyleSheet.create({
  container:{flex:1,backgroundColor:theme.colors.bgPage},
  content:{padding:theme.spacing.lg},
  lc:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:theme.colors.bgPage},
  lt:{color:theme.colors.gold,fontSize:16,marginTop:15},
  // اصلاح ۱: polar warning — با رنگ ember جدید به‌جای نارنجی جنریک قبلی
  polarWarn:{backgroundColor:'#241608',borderRadius:theme.radius.sm+2,padding:theme.spacing.md,marginBottom:theme.spacing.md,borderLeftWidth:3,borderLeftColor:theme.colors.ember},
  polarWarnT:{color:theme.colors.emberLight,fontSize:12,lineHeight:20},
  // هدر با گرادیان غروب (LinearGradient) — این استایل برای container
  // گرادیان است، نه یک پس‌زمینه‌ی تخت مثل نسخه‌ی قبل
  headerGradient:{paddingVertical:theme.spacing.xxl,paddingHorizontal:theme.spacing.lg,alignItems:'center'},
  titleBox:{alignItems:'center'},
  titleLabel:{color:theme.colors.textSecondary,fontSize:11,marginBottom:2},
  titleT:{color:theme.colors.gold,fontSize:theme.type.display.fontSize,fontWeight:theme.type.display.fontWeight,textAlign:'center'},
  titleSub:{color:theme.colors.textSecondary,fontSize:13,marginTop:4},
  titleCity:{color:theme.colors.textMuted,fontSize:12,marginTop:6},
  monthSel:{flexDirection:'row',alignItems:'center',backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.md,padding:theme.spacing.sm+2,marginBottom:theme.spacing.md},
  mBtnT:{color:theme.colors.gold,fontSize:18,fontWeight:'bold',padding:10},
  mCenter:{flex:1,alignItems:'center'},
  mCenterT:{color:theme.colors.textPrimary,fontSize:15,fontWeight:'bold'},
  mCenterSub:{color:theme.colors.textMuted,fontSize:9,marginTop:2},
  conjCard:{backgroundColor:theme.colors.bgHeader,borderRadius:theme.radius.lg,padding:theme.spacing.lg,marginBottom:theme.spacing.md,alignItems:'center',borderWidth:1,borderColor:theme.colors.borderGoldSubtle},
  conjTitle:{color:theme.colors.gold,fontSize:14,fontWeight:'bold',marginBottom:8},
  conjText:{color:theme.colors.textPrimary,fontSize:14,fontWeight:'600',textAlign:'center'},
  conjText2:{color:theme.colors.textMuted,fontSize:12,textAlign:'center',marginTop:4},
  secTitle:{color:theme.colors.gold,fontSize:13,fontWeight:'bold',marginBottom:8},
  dayBtns:{flexDirection:'row',gap:5,marginBottom:theme.spacing.md},
  // dayBtn/dayBtnA/dayBtnT/dayBtnD دیگر مستقیم استفاده نمی‌شوند
  // (جایگزین با Design.DayCard) اما برای سازگاری با ارجاعات احتمالی
  // باقی‌مانده نگه داشته شده‌اند.
  dayBtn:{flex:1,backgroundColor:theme.colors.bgCard,borderRadius:10,padding:10,alignItems:'center',borderWidth:1,borderColor:theme.colors.border},
  dayBtnA:{backgroundColor:theme.colors.gold,borderColor:theme.colors.gold},
  dayBtnT:{color:theme.colors.textSecondary,fontSize:11,fontWeight:'bold'},
  dayBtnD:{color:theme.colors.textMuted,fontSize:8,marginTop:2},
  dateBox:{alignItems:'center',backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.lg,padding:theme.spacing.lg,marginBottom:theme.spacing.md},
  dateW:{color:theme.colors.gold,fontSize:16,fontWeight:'bold'},
  dateJ:{color:theme.colors.textPrimary,fontSize:15,fontWeight:'bold',marginTop:4},
  dateG:{color:theme.colors.textMuted,fontSize:12,marginTop:2},
  crBtn:{backgroundColor:theme.colors.bgCard,paddingHorizontal:16,paddingVertical:9,borderRadius:theme.radius.pill-4,marginRight:6,borderWidth:1,borderColor:theme.colors.border},
  crBtnA:{backgroundColor:theme.colors.gold,borderColor:theme.colors.gold},
  crBtnT:{color:theme.colors.textPrimary,fontSize:11,fontWeight:'bold'},
  infoBtn:{backgroundColor:theme.colors.border,width:32,height:32,borderRadius:16,justifyContent:'center',alignItems:'center',marginLeft:4},
  infoBtnT:{color:theme.colors.textLink,fontSize:16,fontWeight:'bold'},
  // توضیح معیار فعال
  critDescBox:{backgroundColor:theme.colors.bgCardDeep,borderRadius:theme.radius.sm,padding:theme.spacing.sm+2,marginBottom:theme.spacing.md,borderWidth:1,borderColor:theme.colors.border},
  critDescLabel:{color:theme.colors.gold,fontSize:12,fontWeight:'bold',marginBottom:3},
  critDescText:{color:theme.colors.textSecondary,fontSize:11,lineHeight:18},
  critWarn:{color:theme.colors.warning,fontSize:10,marginTop:4,fontStyle:'italic'},
  compareNote:{color:theme.colors.textMuted,fontSize:11,lineHeight:18,marginTop:theme.spacing.sm,paddingTop:theme.spacing.sm,borderTopWidth:1,borderTopColor:theme.colors.borderSubtle,textAlign:'center'},
  // resultBox/catBadge دیگر مستقیم استفاده نمی‌شوند (جایگزین با
  // Design.Card variant="featured" + Design.CrescentBadge)
  resultBox:{backgroundColor:theme.colors.bgCard,borderRadius:18,padding:24,alignItems:'center',marginBottom:14,borderWidth:2},
  resultBoxOverride:{backgroundColor:theme.colors.bgCard},
  catBadge:{width:50,height:50,borderRadius:25,justifyContent:'center',alignItems:'center',marginBottom:12},
  catBadgeT:{color:theme.colors.textPrimary,fontSize:24,fontWeight:'bold'},
  resultMainT:{fontSize:theme.type.title.fontSize,fontWeight:theme.type.title.fontWeight,textAlign:'center',marginBottom:8},
  resultDescT:{color:theme.colors.textSecondary,fontSize:13,textAlign:'center',lineHeight:22},
  resultSunset:{color:theme.colors.textLink,fontSize:12,marginTop:8,textAlign:'center'},
  resultCrit:{color:theme.colors.textMuted,fontSize:11,marginTop:4},
  card:{backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.lg,padding:theme.spacing.xl-2,marginBottom:theme.spacing.md},
  cardTitle:{color:theme.colors.gold,fontSize:15,fontWeight:'bold',marginBottom:12},
  dr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:6},
  dl:{color:theme.colors.textSecondary,fontSize:12,flex:1},
  dv:{color:theme.colors.textPrimary,fontSize:13,fontWeight:'600',flex:1,textAlign:'left'},
  sep:{height:1,backgroundColor:theme.colors.border,marginVertical:8},
  // اصلاح علمی ۶: ageNote
  ageNote:{color:theme.colors.textMuted,fontSize:10,fontStyle:'italic',paddingHorizontal:4,marginBottom:4},
  // اصلاح علمی ۵: danjonRow
  danjonRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:6},
  critRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:theme.colors.border},
  critDot:{width:10,height:10,borderRadius:5},
  critCatT:{fontSize:16,fontWeight:'bold'},
  critDescT:{color:theme.colors.textSecondary,fontSize:11},
  critNameT:{color:theme.colors.textMuted,fontSize:12},
  proposedTag:{color:theme.colors.warning,fontSize:8,marginTop:2},
  legRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:5},
  legDot:{width:12,height:12,borderRadius:6},
  legText:{color:theme.colors.textSecondary,fontSize:12},
  locBox:{backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.sm+2,padding:theme.spacing.md,marginBottom:theme.spacing.sm+2,alignItems:'center'},
  locT:{color:theme.colors.textMuted,fontSize:10},
  shareBtn:{backgroundColor:'rgba(74,222,128,0.1)',borderRadius:theme.radius.md,padding:14,alignItems:'center',marginBottom:8,borderWidth:1,borderColor:theme.colors.success},
  shareBtnT:{color:theme.colors.success,fontSize:15,fontWeight:'bold'},
  analysisBtn:{backgroundColor:'rgba(212,175,106,0.1)',borderRadius:theme.radius.md,padding:14,alignItems:'center',marginBottom:8,borderWidth:1,borderColor:theme.colors.gold},
  analysisBtnT:{color:theme.colors.gold,fontSize:15,fontWeight:'bold'},
  analysisBtnSub:{color:theme.colors.textMuted,fontSize:11,marginTop:3,textAlign:'center'},
  reportExportBtn:{backgroundColor:'rgba(196,98,45,0.1)',borderRadius:theme.radius.md,padding:14,alignItems:'center',marginBottom:8,borderWidth:1,borderColor:theme.colors.ember},
  reportExportBtnT:{color:theme.colors.ember,fontSize:15,fontWeight:'bold'},
  refreshBtn:{backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.md,padding:14,alignItems:'center'},
  refreshBtnT:{color:theme.colors.gold,fontSize:15,fontWeight:'bold'},
  moBg:{flex:1,backgroundColor:theme.colors.bgOverlay,justifyContent:'center',padding:20},
  moBox:{backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.xl,padding:20},
  moTitle:{color:theme.colors.gold,fontSize:15,fontWeight:'bold',textAlign:'center',marginBottom:14},
  // اطلاعات معیارها
  infoBox:{backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.xl,padding:20,maxHeight:'80%'},
  infoTitle:{color:theme.colors.gold,fontSize:16,fontWeight:'bold',textAlign:'center',marginBottom:14},
  infoItem:{backgroundColor:theme.colors.bgCardDeep,borderRadius:theme.radius.sm,padding:12,marginBottom:8},
  infoItemTitle:{color:theme.colors.gold,fontSize:13,fontWeight:'bold',marginBottom:4},
  infoItemDesc:{color:theme.colors.textSecondary,fontSize:11,lineHeight:18},
  infoItemWarn:{color:theme.colors.warning,fontSize:10,marginTop:4,fontStyle:'italic'},
  yrRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:20,marginBottom:14},
  yrBtn:{backgroundColor:theme.colors.border,width:36,height:36,borderRadius:18,justifyContent:'center',alignItems:'center'},
  yrBtnT:{color:theme.colors.gold,fontSize:16,fontWeight:'bold'},
  yrTxt:{color:theme.colors.textPrimary,fontSize:22,fontWeight:'bold',minWidth:55,textAlign:'center'},
  yrInput:{color:theme.colors.textPrimary,fontSize:22,fontWeight:'bold',minWidth:80,textAlign:'center',borderBottomWidth:1,borderBottomColor:theme.colors.gold,paddingVertical:2},
  moGrid:{flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:14},
  moItem:{backgroundColor:theme.colors.border,paddingHorizontal:11,paddingVertical:7,borderRadius:8},
  moItemA:{backgroundColor:theme.colors.gold},
  moItemT:{color:theme.colors.textPrimary,fontSize:10,fontWeight:'bold'},
  moOk:{backgroundColor:theme.colors.gold,borderRadius:10,padding:12,alignItems:'center',marginBottom:8},
  moOkT:{color:theme.colors.goldDark,fontSize:14,fontWeight:'bold'},
  moCancel:{padding:10,alignItems:'center'},
  moCancelT:{color:theme.colors.textMuted,fontSize:13},
});