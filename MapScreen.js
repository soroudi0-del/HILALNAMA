import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Dimensions, Modal,
  PanResponder, Animated, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
var Svg = require('react-native-svg').Svg;
var Path = require('react-native-svg').Path;
var Line = require('react-native-svg').Line;
var Circle = require('react-native-svg').Circle;
// نکته: SvgText عمداً دیگر import نمی‌شود — دلیل دقیق در کامنت
// بازبینی هشتم پایین‌تر (رفع باگ حروف فارسی از هم پراکنده).

import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

// ============================================================
// فاز ۱ نسخه ۳ (بازطراحی کامل نقشه): worldCountries.json اکنون
// مرزهای واقعی ۱۷۷ کشور (نه ۶ قاره‌ی دست‌کشیده‌ی قبلی) را دارد —
// منبع: Natural Earth 1:110m (Public Domain)، به فرمت فشرده‌ی
// [{n: نام, p: [[[ [lon,lat], ... ] ...]]]}] (چندضلعی‌های ساده، نه
// TopoJSON خام) تبدیل شده تا نیازی به decode کردن آرک در زمان اجرا
// نباشد — decode یک‌بار در زمان ساخت این فایل انجام شده.
// ============================================================
var worldCountries = require('../data/worldCountries.json');
var MoonCalculator = require('../calculations/moonPosition');
var HijriCalendar = require('../calculations/hijriCalendar');
var UserSettings = require('../data/userSettings');
var Astronomy = require('astronomy-engine');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// فاز ۱ نسخه ۳ (بازبینی هشتم): SW/MH ثابت قبلی حذف شدند — این دو
// فقط یک‌بار در زمان import محاسبه می‌شدند و به چرخش صفحه
// (portrait/landscape) واکنش نشان نمی‌دادند. جایگزین: curSW/curMH
// که داخل کامپوننت و reactive به Dimensions محاسبه می‌شوند (به
// useEffect مربوط به Dimensions.addEventListener نگاه کنید).

// فاز ۱ نسخه ۳ (بازبینی هشتم): رفع مشکل کندی ۱۰-۱۵ ثانیه‌ای.
//
// ریشه‌ی واقعی کندی: مشکل از خودِ SVG نبود — از این بود که هر نقطه‌ی
// GRID یک محاسبه‌ی نجومی کامل (getFullMoonData: شامل SearchRiseSet،
// SearchMoonPhase و چند محاسبه‌ی مثلثاتی) می‌طلبد، و همه‌ی این
// محاسبات به‌صورت synchronous و یکجا روی همان JS thread اصلی اجرا
// می‌شوند — دقیقاً چیزی که UI را قفل می‌کند. بازبینی قبلی (که گرید
// را برای «صافی بصری بهتر» از ۱۲ درجه به ۶ درجه برد) این مشکل را
// جدی‌تر کرد چون تعداد محاسبات از ۲۸۰ به ۱۳۴۲ رسید.
//
// راه‌حل (پیشنهاد کاربر، پیاده‌سازی شد): دو سطح گرید.
//   - سبک (پیش‌فرض، حالت portrait): ۱۰ درجه → برای بار اول سریع
//     لود می‌شود، بدون قفل UI.
//   - کامل (فقط در حالت landscape که کاربر عمداً برای دیدن جزئیات
//     می‌رود): همان ۱۳۴۲ نقطه‌ی ۶ درجه‌ای که در بازبینی قبل ساخته
//     شد — دقیق و صاف، دقیقاً جایی که ارزشش را دارد.
function buildGrid(stepDeg) {
  var g = [];
  for (var la=-60; la<=70; la+=stepDeg) {
    for (var lo=-180; lo<=180; lo+=stepDeg) {
      g.push({lat:la, lon:lo});
    }
  }
  return g;
}
var GRID_LIGHT = buildGrid(10);  // ~518 نقطه — پیش‌فرض portrait
var GRID_FULL = buildGrid(6);    // ~1342 نقطه — فقط landscape

// فاز ۱ نسخه ۳: کشورهایی که نامشان مستقیماً روی نقشه نوشته می‌شود —
// انتخاب بر اساس کشورهای پرجمعیت مسلمان یا مهم برای رؤیت هلال، به
// همراه چند کشور بزرگ برای جهت‌یابی کلی نقشه (مشابه تصویر مرجع
// HilalMap که هم کشورهای اسلامی هم کشورهای بزرگ غربی را نام می‌برد).
var LABELED_COUNTRIES = [
  'Iran','Saudi Arabia','Turkey','Egypt','Pakistan','Indonesia','Malaysia',
  'Iraq','United Arab Emirates','Morocco','Algeria','Nigeria','Bangladesh',
  'Afghanistan','Yemen','Jordan','Syria','Libya','Tunisia','Sudan','Somalia',
  'United States of America','Canada','Brazil','United Kingdom','Germany',
  'France','Russia','China','India','Australia','Japan','South Africa',
  'Mexico','Argentina','Kazakhstan',
];


// نکته: آرایه‌ی LAND قبلی (۶ قاره‌ی دست‌کشیده با ~۲۵۰ نقطه‌ی مختصات
// تقریبی) کاملاً حذف شد. جایگزین: worldCountries (بالا import شده)
// که مرزهای واقعی ۱۷۷ کشور را دارد و مستقیماً در JSX نقشه با
// <Path> رسم می‌شود (تابع countryToPathD در پایین فایل).

var MAP_CITIES = [
  {name:'تهران',lat:35.69,lon:51.39,show:true},
  {name:'مکه',lat:21.42,lon:39.83,show:true},
  {name:'قاهره',lat:30.04,lon:31.24,show:true},
  {name:'استانبول',lat:41.01,lon:28.98,show:true},
  {name:'لندن',lat:51.51,lon:-0.13,show:true},
  {name:'نیویورک',lat:40.71,lon:-74.01,show:true},
  {name:'لس‌آنجلس',lat:34.05,lon:-118.24,show:true},
  {name:'کراچی',lat:24.86,lon:67.00,show:true},
  {name:'جاکارتا',lat:-6.21,lon:106.85,show:true},
  {name:'سیدنی',lat:-33.87,lon:151.21,show:true},
];

var ALL_CITIES = [
  {name:'تهران',lat:35.69,lon:51.39,flag:'🇮🇷',countryKey:'countryIran'},
  {name:'قم',lat:34.64,lon:50.88,flag:'🇮🇷',countryKey:'countryIran'},
  {name:'مشهد',lat:36.26,lon:59.62,flag:'🇮🇷',countryKey:'countryIran'},
  {name:'اصفهان',lat:32.65,lon:51.67,flag:'🇮🇷',countryKey:'countryIran'},
  {name:'شیراز',lat:29.59,lon:52.58,flag:'🇮🇷',countryKey:'countryIran'},
  {name:'تبریز',lat:38.08,lon:46.29,flag:'🇮🇷',countryKey:'countryIran'},
  {name:'نجف',lat:32.00,lon:44.31,flag:'🇮🇶',countryKey:'countryIraq'},
  {name:'کربلا',lat:32.62,lon:44.02,flag:'🇮🇶',countryKey:'countryIraq'},
  {name:'مکه',lat:21.42,lon:39.83,flag:'🇸🇦',countryKey:'countrySaudi'},
  {name:'مدینه',lat:24.45,lon:39.61,flag:'🇸🇦',countryKey:'countrySaudi'},
  {name:'بیروت',lat:33.89,lon:35.50,flag:'🇱🇧',countryKey:'countryLebanon'},
  {name:'دمشق',lat:33.51,lon:36.28,flag:'🇸🇾',countryKey:'countrySyria'},
  {name:'قاهره',lat:30.04,lon:31.24,flag:'🇪🇬',countryKey:'countryEgypt'},
  {name:'استانبول',lat:41.01,lon:28.98,flag:'🇹🇷',countryKey:'countryTurkey'},
  {name:'کراچی',lat:24.86,lon:67.00,flag:'🇵🇰',countryKey:'countryPakistan'},
  {name:'لندن',lat:51.51,lon:-0.13,flag:'🇬🇧',countryKey:'countryUK'},
  {name:'نیویورک',lat:40.71,lon:-74.01,flag:'🇺🇸',countryKey:'countryUSA'},
  {name:'لس‌آنجلس',lat:34.05,lon:-118.24,flag:'🇺🇸',countryKey:'countryUSA'},
  {name:'تورنتو',lat:43.65,lon:-79.38,flag:'🇨🇦',countryKey:'countryCanada'},
  {name:'سیدنی',lat:-33.87,lon:151.21,flag:'🇦🇺',countryKey:'countryAustralia'},
  {name:'جاکارتا',lat:-6.21,lon:106.85,flag:'🇮🇩',countryKey:'countryIndonesia'},
  {name:'کوالالامپور',lat:3.14,lon:101.69,flag:'🇲🇾',countryKey:'countryMalaysia'},
];

function hijriToApproxDate(hY,hM){var jd=Math.floor((11*hY+3)/30)+354*hY+30*hM-Math.floor((hM-1)/2)+1948440-385;var a=jd+68569;var b=Math.floor(4*a/146097);a=a-Math.floor((146097*b+3)/4);var c=Math.floor(4000*(a+1)/1461001);a=a-Math.floor(1461*c/4)+31;var d=Math.floor(80*a/2447);var day=a-Math.floor(2447*d/80);a=Math.floor(d/11);var month=d+2-12*a;var year=100*(b-49)+c+a;return new Date(year,month-1,day);}

// دو تابع کمکی زیر عیناً از ZoomableImageModal.js گرفته شده‌اند تا
// همان الگوی pinch-zoom در کل اپ یکسان باشد.
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

function findNewMoonNear(date){try{var sf=new Date(date.getTime()-5*24*3600000);var nm=Astronomy.SearchMoonPhase(0,sf,35);if(nm)return nm.date;}catch(e){}return date;}

// ==============================================================
// فاز ۱ نسخه ۳ (بازطراحی کامل نقشه): تبدیل چندضلعی‌های یک کشور
// (آرایه‌ای از حلقه‌ها، هر حلقه آرایه‌ای از [lon,lat]) به یک رشته‌ی
// SVG path معتبر — جایگزین منطق قبلی که هر ضلع نقشه را با صدها
// <View> جداگانه‌ی چرخیده (rotate transform) می‌کشید.
//
// چرا این روش بهتر است:
//   - یک <Path> واحد به‌جای صدها View یعنی performance بسیار بهتر
//     (خصوصاً در اسکرول/رندر مجدد هنگام تغییر معیار یا zoom)
//   - خطوط واقعاً صاف و پیوسته‌اند، نه تقریب چندضلعی‌های کوتاه
//   - fill-rule: evenodd به‌صورت خودکار حفره‌های داخلی (مثل دریاچه‌
//     ی بزرگ داخل یک کشور، اگر در داده وجود داشته باشد) را درست
//     مدیریت می‌کند
//
// toX/toY باید از بیرون پاس داده شوند چون به عرض/ارتفاع فعلی نقشه
// (که با zoom تغییر می‌کند) وابسته‌اند.
// ==============================================================
function countryToPathD(polygons, toX, toY) {
  var d = '';
  for (var pi = 0; pi < polygons.length; pi++) {
    var rings = polygons[pi];
    for (var ri = 0; ri < rings.length; ri++) {
      var ring = rings[ri];
      if (ring.length < 2) continue;
      for (var i = 0; i < ring.length; i++) {
        var x = toX(ring[i][0]);
        var y = toY(ring[i][1]);
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      }
      d += 'Z ';
    }
  }
  return d;
}

// مرکز تقریبی یک کشور برای قرارگیری برچسب نام — میانگین ساده‌ی
// نقاط بزرگ‌ترین حلقه‌ی چندضلعی (نه centroid هندسی دقیق، ولی برای
// قرار دادن یک برچسب متن کافی و بسیار سریع‌تر است).
function countryLabelPoint(polygons) {
  var biggest = null, biggestLen = 0;
  for (var pi = 0; pi < polygons.length; pi++) {
    var ring = polygons[pi][0];
    if (ring && ring.length > biggestLen) { biggestLen = ring.length; biggest = ring; }
  }
  if (!biggest) return null;
  var sumLon = 0, sumLat = 0;
  for (var i = 0; i < biggest.length; i++) { sumLon += biggest[i][0]; sumLat += biggest[i][1]; }
  return { lon: sumLon / biggest.length, lat: sumLat / biggest.length };
}

// فاز ۱ نسخه ۳ (بازبینی هفتم): این دو تابع عیناً از HomeScreen.js
// پورت شدند — رفع باگ «صفحه‌ی نقشه با ماه اشتباه باز می‌شود».
//
// ریشه‌ی باگ: قبل از این، حالت اولیه‌ی hMonth/hYear این صفحه فقط از
// HijriCalendar.getNextHijriMonth(new Date()) می‌آمد که خودش از
// estimateHijri (فرمول تبولار قراردادی، همان که در hijriCalendar.js
// به‌عنوان «هرگز نباید برای گزارش رسمی رؤیت هلال استفاده شود» علامت‌
// گذاری شده) مشتق می‌شود. سپس findNM() (که در mount هم بدون آرگومان
// صدا زده می‌شد) از همین hMonth/hYear تخمینی یک approx date می‌ساخت
// و مقارنه‌ی واقعی نجومی را «نزدیک آن approx» جست‌وجو می‌کرد. نتیجه:
// نزدیک مرز دو ماه قمری، تخمین تبولار و مقارنه‌ی واقعی نجومی می‌
// توانستند یک ماه با هم اختلاف داشته باشند — برچسب ماه (مثلاً
// «ربیع‌الاول») از منبع تخمینی می‌آمد، ولی چهار روز واقعی نمایش‌
// داده‌شده (بر مبنای مقارنه‌ی واقعی) متعلق به ماه قبل (مثلاً «صفر»)
// بودند. تعویض دستی ماه و برگشت به همان ماه، این ناهماهنگی را مخفیانه
// رفع می‌کرد چون در آن نقطه findNM دیگر از تخمین اولیه استفاده
// نمی‌کرد.
//
// راه‌حل: دقیقاً همان الگوی findDefaultNM در HomeScreen.js — مقارنه‌
// ی واقعی نجومی نزدیک «اکنون» با findNextNewMoon/findPrevNewMoon
// پیدا می‌شود (نه تخمین تبولار)، سپس بر اساس فاصله‌ی روزانه از
// مقارنه‌ی قبلی (قاعده‌ی ≤۲۰ روز) تصمیم گرفته می‌شود کدام مقارنه
// مبنای «ماه جاری» است، و فقط در پایان از getNextHijriMonth صرفاً
// برای گرفتن نام/شماره‌ی نمایشی همان ماه (نه برای پیدا کردن مقارنه)
// استفاده می‌شود.
function findNextNewMoon(date) {
  try {
    var r = Astronomy.SearchMoonPhase(0, date, 40);
    if (r) return r.date;
  } catch(e) {}
  return null;
}

function findPrevNewMoon(date) {
  try {
    var sb = new Date(date.getTime() - 35 * 24 * 3600000);
    var found = null;
    var candidate = Astronomy.SearchMoonPhase(0, sb, 40);
    var maxIter = 5;
    while (candidate && maxIter-- > 0) {
      if (candidate.date.getTime() < date.getTime()) {
        found = candidate;
        var nextSearch = new Date(candidate.date.getTime() + 28 * 24 * 3600000);
        candidate = Astronomy.SearchMoonPhase(0, nextSearch, 35);
      } else {
        break;
      }
    }
    return found ? found.date : null;
  } catch(e) {}
  return null;
}

// ============================================================
// حالت خروجی رسمی (export mode) — درخواست کاربر: «نقشه‌ی کامل و
// بزرگ کره زمین با هر معیاری که خواست، برای هر روز و زمانی که
// خواست، باید از MapScreen گرفته شود». این‌جا این صفحه دو حالت
// دارد:
//   ۱. حالت عادی (تب Map در App.js) — props.route همیشه undefined
//      است (Tab.Screen بدون params صدا می‌زند)، پس exportRequest
//      پایین همیشه falsy می‌ماند و تمام این بلوک به‌طور کامل
//      غیرفعال است. هیچ رفتار موجودی از حالت عادی تغییر نکرده.
//   ۲. حالت export — وقتی ReportExportScreen.js این کامپوننت را
//      با route.params.exportRequest = {crit, dayIndex, nmDate,
//      requestId, landscape, onCaptured, onError} صدا می‌زند (به
//      روش headless: خارج از دید، در یک View با position:absolute
//      که هیچ‌جا رندر بصری‌اش دیده نمی‌شود — نگاه کنید به
//      ReportExportScreen.js)، این کامپوننت خودش crit/day را ست
//      می‌کند، صبر می‌کند calcDay واقعاً تمام شود، zoom را صفر
//      می‌کند، عکس می‌گیرد، و نتیجه (base64) را با onCaptured
//      برمی‌گرداند.
//
//      exportRequest.landscape (بازطراحی جاری — کیفیت نقشه‌ی گزارش
//      PDF): کاربر در ReportExportScreen.js بین دو حالت انتخاب
//      می‌کند: «سریع» (پرتره، گرید سبک ۱۰ درجه‌ای — GRID_LIGHT) یا
//      «دقیق‌تر» (لندسکیپ، گرید کامل ۶ درجه‌ای — GRID_FULL، شبیه
//      همان حالتی که کاربر با دکمه‌ی چرخش دستی در حالت عادی
//      می‌بیند). این مقدار مستقیماً mapRotated را برای طول عمر این
//      exportRequest ست می‌کند (نگاه کنید به effect پایین) — از
//      همان effectiveLandscape/GRID_FULL-یا-LIGHT موجود استفاده
//      می‌کند، هیچ مسیر محاسباتی جدیدی لازم نبود.
// ============================================================
export default function MapScreen(props) {
  var route = props && props.route;
  var exportRequest = route && route.params && route.params.exportRequest;


  var LCtx = useLanguage();
  var t = LCtx.t;
  var lang = LCtx.lang;
  var isRTL = LCtx.isRTL;
  var HIJRI_MONTHS = LCtx.tArray('hijriMonths');

  var curH = HijriCalendar.getNextHijriMonth(new Date());

  var s1=useState(false);var loading=s1[0];var setLoading=s1[1];
  var s2=useState(curH.year);var hYear=s2[0];var setHYear=s2[1];
  var s3=useState(curH.month);var hMonth=s3[0];var setHMonth=s3[1];
  var s4=useState(null);var nmDate=s4[0];var setNmDate=s4[1];
  var s5=useState('yallop');var crit=s5[0];var setCrit=s5[1];
  var s6=useState(false);var showPicker=s6[0];var setShowPicker=s6[1];
  // امکان تایپ مستقیم سال هجری (به‌جای فقط فلش‌های افزایش/کاهش) —
  // دقیقاً همان الگوی HomeScreen.js: یک state متنی جدا نگه داشته
  // می‌شود تا حین تایپ (مثلاً وقتی کاربر فیلد را موقتاً خالی
  // می‌کند) خودِ hYear عددی خراب نشود؛ اعتبارسنجی در onEndEditing
  // انجام می‌شود.
  var s19=useState(curH.year.toString());var yearInput=s19[0];var setYearInput=s19[1];
  var s7=useState(null);var mapData=s7[0];var setMapData=s7[1];
  var s7b=useState(null);var rawCalcData=s7b[0];var setRawCalcData=s7b[1];
  var s8=useState([]);var cityData=s8[0];var setCityData=s8[1];
  var s9=useState(2);var activeDay=s9[0];var setActiveDay=s9[1];
  var s10=useState(null);var selCity=s10[0];var setSelCity=s10[1];
  var s11=useState([]);var fourDays=s11[0];var setFourDays=s11[1];
  var s12=useState(false);var nmFound=s12[0];var setNmFound=s12[1];
  var s13=useState(null);var userCity=s13[0];var setUserCity=s13[1];
  var s14=useState(null);var userCityData=s14[0];var setUserCityData=s14[1];
  // حالت export: ref روی همان View که SVG نقشه + لایه‌ی برچسب‌های
  // متنی را در بر می‌گیرد (نگاه کنید به پایین‌تر — دقیقاً همان View
  // که panHandlers رویش نصب است، نه z.mapBox بیرونی‌تر که دکمه‌ی
  // reset-zoom/راهنمای pinch را هم شامل می‌شود؛ برای گزارش رسمی فقط
  // خودِ نقشه باید در تصویر باشد، نه کنترل‌های تعاملی).
  var mapCaptureRef = useRef(null);

  // فاز ۱ نسخه ۳ (بازبینی هشتم): پیش از این SW/MH فقط یک‌بار در
  // زمان import محاسبه می‌شدند (خط بالای فایل) و به تغییر orientation
  // واکنش نشان نمی‌دادند — یعنی چرخاندن گوشی به landscape هیچ اثری
  // روی اندازه‌ی واقعی نقشه نداشت. حالا با useState + رویداد change
  // در Dimensions، اندازه‌ی صفحه reactive شده و هم برای محاسبه‌ی
  // ابعاد نقشه، هم برای انتخاب گرید سبک/کامل (پایین را ببینید)
  // استفاده می‌شود.
  var s17=useState(Dimensions.get('window'));var screenDim=s17[0];var setScreenDim=s17[1];
  useEffect(function(){
    var sub = Dimensions.addEventListener('change', function(result){
      setScreenDim(result.window);
    });
    return function(){ if (sub && sub.remove) sub.remove(); };
  }, []);
  var isLandscape = screenDim.width > screenDim.height;

  // دکمه‌ی چرخش دستی نقشه — نسخه‌ی اصلاح‌شده.
  //
  // نسخه‌ی قبلی از expo-screen-orientation (lockAsync) استفاده
  // می‌کرد که کل صفحه‌ی گوشی را فیزیکی می‌چرخاند — دقیقاً همان چیزی
  // که کاربر گفت نمی‌خواهد («نمی‌خوام اپ لندسکیپ بشه»). آن روش دو
  // مشکل هم داشت: (۱) چون کل OS می‌چرخید، Dimensions.addEventListener
  // بالا هم فعال می‌شد و isLandscape را عوض می‌کرد، که با
  // useFocusEffect/چرخه‌ی رندر تداخل می‌کرد و باعث قطع‌ووصل‌شدن
  // می‌شد؛ (۲) در برخی گوشی‌ها/شبیه‌سازها چرخش OS اصلاً فوری اعمال
  // نمی‌شود یا توسط تنظیمات auto-rotate گوشی نادیده گرفته می‌شود،
  // که باعث می‌شد دکمه انگار اثری نداشته باشد.
  //
  // راه‌حل درست: هیچ‌چیزی در سطح OS/دستگاه تغییر نمی‌کند. فقط خودِ
  // باکس نقشه (mapBox) با transform: rotate(90deg) به‌صورت بصری
  // می‌چرخد و ابعادش (عرض/ارتفاع) جابه‌جا می‌شود تا کل صفحه‌ی گوشی
  // را به‌صورت افقی پر کند — این یک state ساده‌ی محلی است
  // (mapRotated)، کاملاً مستقل از Dimensions/orientation دستگاه، و
  // فقط با دوباره زدن همان دکمه (یا واقعاً چرخاندن فیزیکی گوشی که
  // isLandscape را true می‌کند) به حالت قبل برمی‌گردد.
  var s18=useState(false);var mapRotated=s18[0];var setMapRotated=s18[1];
  // mapRotatedRef: چون PanResponder.create فقط یک‌بار داخل useRef
  // ساخته می‌شود، callback‌های آن (onPanResponderMove و...) یک
  // closure از همان اولین رندر نگه می‌دارند و اگر مستقیم از state
  // (mapRotated) بخوانند همیشه مقدار اولیه (false) را می‌بینند، نه
  // مقدار به‌روز را. این ref (دقیقاً هم‌الگو با mapScaleRef/
  // mapTranslateRef که از قبل برای همین مشکل استفاده شده بودند) هر
  // بار با مقدار تازه‌ی mapRotated هم‌گام نگه داشته می‌شود.
  var mapRotatedRef = useRef(false);
  useEffect(function(){ mapRotatedRef.current = mapRotated; }, [mapRotated]);
  var toggleMapRotation = function(){
    setMapRotated(function(prev){ return !prev; });
  };

  // اگر کاربر واقعاً گوشی را به landscape چرخاند، دیگر نیازی به
  // چرخش دستی نیست — و اگر قبلاً دستی چرخانده بود، حالت دستی را
  // خاموش می‌کنیم تا دو چرخش روی هم اعمال نشود.
  useEffect(function(){
    if (isLandscape && mapRotated) setMapRotated(false);
  }, [isLandscape]);

  // effectiveLandscape: یا با چرخش واقعی گوشی true می‌شود، یا با
  // چرخش دستیِ خودِ نقشه (mapRotated) — هرجا قبلاً از isLandscape
  // برای منطق «آیا الان landscape‌واره هستیم» استفاده می‌شد (انتخاب
  // گرید کامل/سبک، ابعاد نقشه)، اکنون از این مقدار استفاده می‌کنیم.
  var effectiveLandscape = isLandscape || mapRotated;

  // فاز ۱ نسخه ۳ (بازبینی هشتم): وقتی جهت صفحه عوض می‌شود (مثلاً
  // کاربر گوشی را برای دیدن جزئیات به landscape می‌چرخاند)، داده‌ی
  // نقشه باید با گرید متناظر (سبک یا کامل) دوباره محاسبه شود — وگرنه
  // در landscape هنوز همان گرید کم‌نقطه‌ی portrait روی صفحه می‌ماند.
  // isLandscapeRef برای جلوگیری از recalc غیرضروری در اولین رندر
  // است (چون calcDay/findDefaultNM خودشان یک‌بار در mount اجرا
  // می‌شوند).
  var isLandscapeRef = useRef(effectiveLandscape);
  useEffect(function(){
    if (isLandscapeRef.current === effectiveLandscape) return;
    isLandscapeRef.current = effectiveLandscape;
    if (fourDays.length > 0 && nmDate) {
      calcDay(activeDay);
    }
  }, [effectiveLandscape]);

  // در portrait، عرض نقشه به‌اندازه‌ی عرض صفحه منهای padding است؛
  // در landscape (چه با چرخش واقعی گوشی، چه با چرخش دستیِ خودِ
  // نقشه)، از فضای بیشتر افقی واقعاً بهره می‌بریم. وقتی mapRotated
  // فعال است، صفحه‌ی فیزیکی گوشی هنوز portrait است، پس برای این‌که
  // نقشه‌ی چرخانده‌شده کل صفحه را افقی پر کند، از ارتفاع صفحه به‌جای
  // عرض به‌عنوان بعد افقی نقشه استفاده می‌کنیم (چون بعد از چرخش ۹۰
  // درجه، آنچه قبلاً ارتفاع صفحه بود اکنون طول افقی دید کاربر است).
  // curSW/curMH هر رندر یک var محلی تازه هستند، ولی مقدار واقعی‌شان
  // با چرخش نقشه (mapRotated) یا چرخش واقعی گوشی در طول عمر
  // کامپوننت واقعاً تغییر می‌کند. چون mapPanResponder با useRef فقط
  // در اولین رندر ساخته می‌شود، callback هایش (onPanResponderRelease)
  // بدون این ref همیشه curSW/curMH رندر اول را می‌دیدند — این ref
  // آن مقدار را هر رندر تازه نگه می‌دارد.
  var curSizeRef = useRef({sw:0, mh:0});
  var curSW = effectiveLandscape
    ? (mapRotated ? screenDim.height - 24 : screenDim.width - 24)
    : screenDim.width - 32;
  var curMH = effectiveLandscape
    ? (mapRotated ? Math.round(screenDim.width - 140) : Math.round(screenDim.height - 180))
    : Math.round(curSW * 0.55);
  curSizeRef.current = {sw:curSW, mh:curMH};


  // فاز ۱ نسخه ۳ (بازطراحی کامل نقشه): state برای pinch-zoom/pan —
  // دقیقاً همان الگوی ZoomableImageModal.js (PanResponder ساده،
  // بدون نیاز به کتابخانه‌ی جدید چون این پروژه از قبل هیچ‌کدام از
  // react-native-gesture-handler/reanimated را نصب نکرده).
  var s15=useState(1);var mapScale=s15[0];var setMapScale=s15[1];
  var s16=useState({x:0,y:0});var mapTranslate=s16[0];var setMapTranslate=s16[1];

  // فاز ۱ نسخه ۳ (بازطراحی کامل نقشه): pinch-to-zoom/pan روی خود
  // نقشه — تا سطح دیدن جزئیات کشور/منطقه (نه سطح خیابان، چون داده‌ی
  // مرزی این‌جا در مقیاس ۱:۱۱۰ میلیون است؛ برای دقت محلی دقیق‌تر،
  // کارت «شهر شما» پایین صفحه از محاسبه‌ی مستقیم مختصات دقیق کاربر
  // استفاده می‌کند، نه از این نقشه‌ی گرافیکی).
  var MAP_MIN_SCALE = 1;
  var MAP_MAX_SCALE = 6;
  var mapScaleRef = useRef(1);
  var mapTranslateRef = useRef({x:0, y:0});
  var mapLastDistanceRef = useRef(null);
  var mapPanStartRef = useRef({x:0, y:0});
  var mapAnimScale = useRef(new Animated.Value(1)).current;
  var mapAnimTranslate = useRef(new Animated.ValueXY({x:0, y:0})).current;

  function clampMap(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function applyMapTransform(scale, translate) {
    mapScaleRef.current = scale;
    mapTranslateRef.current = translate;
    mapAnimScale.setValue(scale);
    mapAnimTranslate.setValue(translate);
    setMapScale(scale);
  }

  function resetMapTransform() {
    Animated.parallel([
      Animated.spring(mapAnimScale, {toValue:1, useNativeDriver:true, friction:7}),
      Animated.spring(mapAnimTranslate, {toValue:{x:0,y:0}, useNativeDriver:true, friction:7}),
    ]).start();
    mapScaleRef.current = 1;
    mapTranslateRef.current = {x:0,y:0};
    setMapScale(1);
  }

  var mapPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: function(){ return true; },
      onMoveShouldSetPanResponder: function(evt, g){
        // فقط وقتی دو انگشت است، یا وقتی از قبل zoom شده، pan را
        // بگیر — تا اسکرول عمودی صفحه (لیست شهرها و...) وقتی نقشه
        // در حالت عادی (بدون zoom) است، دست‌نخورده بماند.
        var touches = evt.nativeEvent.touches;
        if (touches.length === 2) return true;
        if (mapScaleRef.current > 1) return true;
        return false;
      },
      onPanResponderGrant: function(evt){
        var touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          mapLastDistanceRef.current = distanceBetweenTouches(touches);
        } else if (touches.length === 1) {
          // فاز ۱ نسخه ۳ (رفع باگ زوم/پن در حالت چرخش دستی نقشه):
          // وقتی mapRotated فعال است، خودِ باکس نقشه با
          // transform: rotate(90deg) بصری چرخیده، ولی touches[0].pageX/Y
          // مختصات فیزیکی صفحه‌ی گوشی (نچرخیده) هستند. برای این‌که
          // مبنای محاسبه‌ی pan درست باشد، این‌جا هم مختصات لمس اولیه
          // را به فضای محتوای نچرخیده تبدیل می‌کنیم (چرخش معکوس
          // ۹۰ درجه: contentX = pageY، contentY = -pageX — مشتق‌شده
          // از این‌که rotate(90deg) در CSS ساعت‌گرد است).
          var px = touches[0].pageX, py = touches[0].pageY;
          var cx0 = mapRotatedRef.current ? py : px;
          var cy0 = mapRotatedRef.current ? -px : py;
          mapPanStartRef.current = {
            x: cx0 - mapTranslateRef.current.x,
            y: cy0 - mapTranslateRef.current.y,
          };
        }
      },
      onPanResponderMove: function(evt){
        var touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          var newDistance = distanceBetweenTouches(touches);
          if (mapLastDistanceRef.current) {
            var scaleDelta = newDistance / mapLastDistanceRef.current;
            var newScale = clampMap(mapScaleRef.current * scaleDelta, MAP_MIN_SCALE, MAP_MAX_SCALE);
            applyMapTransform(newScale, mapTranslateRef.current);
          }
          mapLastDistanceRef.current = newDistance;
        } else if (touches.length === 1 && mapScaleRef.current > 1) {
          var tt = touches[0];
          // همان تبدیل چرخش معکوس بالا، این‌بار برای نقطه‌ی جاری لمس
          var ctx = mapRotatedRef.current ? tt.pageY : tt.pageX;
          var cty = mapRotatedRef.current ? -tt.pageX : tt.pageY;
          var newX = ctx - mapPanStartRef.current.x;
          var newY = cty - mapPanStartRef.current.y;
          applyMapTransform(mapScaleRef.current, {x:newX, y:newY});
        }
      },
      onPanResponderRelease: function(){
        mapLastDistanceRef.current = null;
        if (mapScaleRef.current <= 1) {
          resetMapTransform();
        } else {
          var sz = curSizeRef.current;
          var maxTX = (sz.sw * (mapScaleRef.current - 1)) / 2;
          var maxTY = (sz.mh * (mapScaleRef.current - 1)) / 2;
          var cx = clampMap(mapTranslateRef.current.x, -maxTX, maxTX);
          var cy = clampMap(mapTranslateRef.current.y, -maxTY, maxTY);
          applyMapTransform(mapScaleRef.current, {x:cx, y:cy});
        }
      },
    })
  ).current;


  useFocusEffect(
    useCallback(function() {
      // در حالت export، نباید مقارنه‌ی «امروز» به‌طور خودکار جای
      // مقارنه‌ی درخواستی بنشیند — نگاه کنید به useEffect جدید
      // «حالت export» پایین‌تر که خودش nmDate/fourDays درست را از
      // روی exportRequest.date می‌سازد.
      if (exportRequest) return;
      loadUserCity();
      // فاز ۱ نسخه ۳ (بازبینی هفتم): findNM() → findDefaultNM().
      // findNM بدون آرگومان از hMonth/hYour فعلی (که در mount هنوز
      // مقدار تخمینی/تبولار اولیه هستند) یک approx می‌ساخت؛
      // findDefaultNM مستقیماً مقارنه‌ی واقعی نجومی نزدیک «اکنون» را
      // پیدا می‌کند و hMonth/hYear را هم بر همان مبنا تنظیم می‌کند.
      findDefaultNM();
    }, [])
  );

  // فاز ۱ نسخه ۳: همان اصلاحی که در HomeScreen انجام شد — changeMonth
  // اکنون findNM را مستقیم با مقادیر تازه صدا می‌زند، به‌جای وابستگی
  // به یک useEffect جداگانه که می‌توانست از state قدیمی بخواند.
  // ===== اصلاح ۶: getCatForCrit خالص - crit به عنوان آرگومان =====
  // وقتی crit تغییر می‌کند، از rawData رنگ‌ها را بدون recalc کامل به‌روز کن
  useEffect(function(){
    if (!rawCalcData) return;
    // اصلاح ۶: MoonCalculator.getCatForCrit به جای closure
    var gd = rawCalcData.grid.map(function(p){
      return {lat:p.lat, lon:p.lon, cat:MoonCalculator.getCatForCrit(p.data, crit)};
    });
    setMapData(gd);
    var cd = rawCalcData.cities.map(function(c){
      return {
        name:c.name, flag:c.flag, countryKey:c.countryKey,
        lat:c.lat, lon:c.lon,
        cat:MoonCalculator.getCatForCrit(c.data, crit),
        data:c.data
      };
    });
    cd.sort(function(a,b){return(b.data.yallopQ||-999)-(a.data.yallopQ||-999);});
    setCityData(cd);
    if (rawCalcData.userCity) {
      setUserCityData({
        name:rawCalcData.userCity.name,
        lat:rawCalcData.userCity.lat,
        lon:rawCalcData.userCity.lon,
        cat:MoonCalculator.getCatForCrit(rawCalcData.userCity.data, crit),
        data:rawCalcData.userCity.data
      });
    }
  },[crit, rawCalcData]);

  var loadUserCity = async function(){var c = await UserSettings.loadCity();setUserCity(c);};

  var getCityName = function(c) {
    if (!c) return '';
    var key = UserSettings.getCityKey(c.name);
    if (key) return t(key);
    return c.name;
  };

  // فاز ۱ نسخه ۳ (بازبینی ششم): رفع یک رگرسیون از بازبینی پنجم —
  // نسخه‌ی قبلی مستقیماً از MoonCalculator.getCatText/getCatTextFull
  // می‌خواند که متن فارسی hardcoded برمی‌گرداندند، یعنی کاربران
  // عربی/انگلیسی همیشه متن فارسی می‌دیدند. حالا کلید ترجمه از
  // MoonCalculator.getCatTextKey/getCatTextFullKey گرفته می‌شود و با
  // t(key) خوانده می‌شود — همان مسیر عادی ترجمه‌ی بقیه‌ی این فایل.
  var getCatTextLocal = function(cat) {
    return t(MoonCalculator.getCatTextKey(cat, crit));
  };

  var getCatFullLocal = function(cat) {
    var key = MoonCalculator.getCatTextFullKey(cat, crit);
    return key ? t(key) : '';
  };

  // فاز ۱ نسخه ۳ (بازبینی هفتم): هر معیار فقط زیرمجموعه‌ای از حروف
  // A-F را واقعاً تولید می‌کند (نگاه کنید به توضیح کامل در
  // HomeScreen.js). این لیست برای legend نقشه لازم است تا حروفی که
  // معیار فعلی اصلاً تولید نمی‌کند (مثلاً 'A' یا 'D' برای SAAO)
  // نشان داده نشوند.
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
    // آرایه باعث می‌شد وقتی soroudiCat برابر E بود، آن رده از راهنما
    // (legend) نقشه غایب باشد.
    soroudi: ['A','B','C','D','E','F'],
  };

  var formatDateLocal = function(date) {
    if (!date) return '---';
    if (lang==='en') return HijriCalendar.formatGregorian(date);
    return HijriCalendar.formatJalali(date);
  };

  var getWeekDayLocal = function(date) {
    if (!date) return '---';
    var days = LCtx.tArray('weekDays');
    return days[date.getDay()];
  };

  var formatDateShortLocal = function(date) {
    if (!date) return '---';
    if (lang==='en') return (date.getMonth()+1)+'/'+date.getDate();
    return HijriCalendar.formatJalaliShort(date);
  };

  // کش نتایج محاسبه‌ی سنگین نجومی — برای هر یک از ۴ روز (قبل/
  // مقارنه/بعد/دو‌روزبعد)، هر دو حالت portrait/landscape، **و هر
  // ماه/سالی که کاربر تا‌به‌حال دیده** جدا نگه داشته می‌شود. چون
  // خودِ کلید کش شامل nmDate.getTime() است، کلیدهای ماه‌های مختلف
  // طبیعتاً با هم تصادم نمی‌کنند — یعنی کاربر می‌تواند بین ماه‌ها
  // رفت‌وآمد کند و به ماهی که قبلاً دیده بدون صبر برگردد.
  //
  // برای جلوگیری از رشد بی‌رویه‌ی حافظه در یک نشست خیلی طولانی
  // (مثلاً کاربری که ده‌ها ماه پشت‌سرهم مرور می‌کند)، یک سقف ساده
  // گذاشته شده: حداکثر MAX_CACHE_ENTRIES ورودی هم‌زمان (پیش‌فرض ۲۴،
  // یعنی حدود ۳ ماه کامل با ۴ روز × ۲ orientation هرکدام). وقتی از
  // سقف رد شود، قدیمی‌ترین ورودی (FIFO ساده، نه LRU پیچیده — چون
  // نیاز واقعی این سطح از دقت را ندارد) حذف می‌شود.
  var MAX_CACHE_ENTRIES = 24;
  var calcCacheRef = useRef({});
  var calcCacheOrderRef = useRef([]); // ترتیب ورود کلیدها، برای FIFO eviction
  var makeCalcCacheKey = function(dayIdx, landscapeMode){
    var ucKey = userCity ? (userCity.name + ':' + userCity.lat + ',' + userCity.lon) : 'none';
    var nmKey = nmDate ? nmDate.getTime() : 'none';
    return dayIdx + '|' + (landscapeMode ? 'L' : 'P') + '|' + nmKey + '|' + ucKey;
  };
  var storeInCalcCache = function(key, value){
    if (!(key in calcCacheRef.current)) {
      calcCacheOrderRef.current.push(key);
      if (calcCacheOrderRef.current.length > MAX_CACHE_ENTRIES) {
        var oldestKey = calcCacheOrderRef.current.shift();
        delete calcCacheRef.current[oldestKey];
      }
    }
    calcCacheRef.current[key] = value;
  };

  var findNM = function(targetMonth, targetYear){
    var approx = hijriToApproxDate(targetYear !== undefined ? targetYear : hYear, targetMonth !== undefined ? targetMonth : hMonth);
    var nm = findNewMoonNear(approx);
    setNmDate(nm);
    // فاز ۱ نسخه ۳ (F1-10): استفاده از toLocalCalendarDay به‌جای
    // setUTCHours(12) خام — همان رفع باگ «کارت روز مقارنه یک روز
    // اشتباه» که در HomeScreen انجام شد. برای MapScreen چون شهر
    // مشخصی هنوز انتخاب نشده (نقشه‌ی جهانی است)، از افست UTC (صفر)
    // به‌عنوان مرجع خنثی استفاده می‌کنیم؛ این حداقل یک مبنای واحد و
    // قابل‌پیش‌بینی برای رسم گرید جهانی است.
    var d0 = HijriCalendar.toLocalCalendarDay(nm, 0);
    var days=[
      {date:new Date(d0.getTime()-24*3600000), short:t('dayBefore')},
      {date:new Date(d0.getTime()), short:t('dayConjunction')},
      {date:new Date(d0.getTime()+24*3600000), short:t('dayAfter')},
      {date:new Date(d0.getTime()+2*24*3600000), short:t('twoDaysAfter')},
    ];
    setFourDays(days);
    setNmFound(true);
    // توجه: کش عمداً پاک نمی‌شود — کلید کش شامل nmDate.getTime() است،
    // پس نتایج ماه قبلی خودکار غیرقابل‌دسترس می‌شوند (نه استفاده
    // می‌شوند، نه فضا هدر می‌دهند بیش از سقف MAX_CACHE_ENTRIES) و اگر
    // کاربر به همان ماه برگردد، کش هنوز آنجاست و صبر لازم نیست.
    setRawCalcData(null);setMapData(null);setCityData([]);setUserCityData(null);
  };

  // فاز ۱ نسخه ۳ (بازبینی هفتم): پورت مستقیم findDefaultNM از
  // HomeScreen.js — رفع باگ «صفحه‌ی نقشه با ماه اشتباه باز می‌شود»
  // (توضیح کامل ریشه‌ی باگ در کامنت بالای findNextNewMoon/
  // findPrevNewMoon). برخلاف HomeScreen، این تابع باید هم hMonth/
  // hYear (برچسب نمایشی) و هم مستقیماً fourDays/nmDate (بر مبنای
  // همان مقارنه‌ی واقعی، نه یک approx جداگانه) را تنظیم کند، چون
  // findNM معمولی از hMonth/hYear فعلی یک approx دوباره می‌سازد که
  // برای اولین بارگذاری صفحه لازم نیست و فقط دوباره در معرض همان
  // خطای احتمالی تخمین تبولار قرار می‌گیرد.
  var findDefaultNM = function() {
    var now = new Date();
    var nextNM = findNextNewMoon(now);
    var prevNM = findPrevNewMoon(now);
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
    var d0 = HijriCalendar.toLocalCalendarDay(nm, 0);
    var days=[
      {date:new Date(d0.getTime()-24*3600000), short:t('dayBefore')},
      {date:new Date(d0.getTime()), short:t('dayConjunction')},
      {date:new Date(d0.getTime()+24*3600000), short:t('dayAfter')},
      {date:new Date(d0.getTime()+2*24*3600000), short:t('twoDaysAfter')},
    ];
    setFourDays(days);
    setNmFound(true);
    // همان دلیل بالا در findNM: کش عمداً پاک نمی‌شود. کلید کش شامل
    // nmDate.getTime() و شناسه‌ی شهر کاربر است، پس اگر کاربر بدون
    // تغییر واقعی این دو به صفحه برگردد (مثلاً از تنظیمات برگردد)،
    // کش هنوز معتبر و قابل‌استفاده است.
    setRawCalcData(null);setMapData(null);setCityData([]);setUserCityData(null);
  };

  // فاز ۱ نسخه ۵: رفع کندی واقعی (نه فقط ظاهری).
  //
  // مشکلِ نسخه‌ی قبلی این نبود که محاسبات کند بودند — مشکل این بود
  // که همه‌ی ۵۴۱ (portrait) یا ۱۳۶۵ (landscape) فراخوانی
  // getFullMoonData پشت‌سرهم و بدون وقفه روی یک تابع synchronous
  // اجرا می‌شدند. setTimeout(..., 50) فقط یک فریم را برای نمایش
  // اسپینر آزاد می‌کرد، اما بعد از آن خودِ حلقه یکجا اجرا می‌شد و
  // در طول آن (۱۵ تا ۳۰ ثانیه) هیچ فریمی رندر نمی‌شد — یعنی کل اپ،
  // نه فقط نقشه، قفل می‌ماند.
  //
  // راه‌حل: همان تعداد محاسبات، همان دقت، ولی تقسیم‌شده به تکه‌های
  // کوچک (CHUNK_SIZE نقطه در هر تکه) که هرکدام در یک event-loop tick
  // جدا (setTimeout(fn, 0)) اجرا می‌شوند. بین هر تکه، React Native
  // فرصت می‌کند UI را رندر کند — یعنی اسپینر واقعاً می‌چرخد، لمس
  // دکمه‌های دیگر (مثل چرخش نقشه) قفل نمی‌شود، و زمان کل حس‌شده به‌
  // مراتب کمتر است چون کاربر فریز نمی‌بیند، حتی اگر عدد کل تغییر
  // چندانی نکند.
  var CALC_CHUNK_SIZE = 60;
  // نسل (generation) جاری محاسبه — چون الان محاسبه chunked/async است
  // (برخلاف قبل که synchronous بود)، اگر کاربر سریع بین روزها جابه‌
  // جا شود در حالی که یک calcDay قبلی هنوز در حال پردازش تکه‌های
  // خودش است، باید نتیجه‌ی قدیمی نتیجه‌ی جدید را overwrite نکند.
  var calcGenRef = useRef(0);

  var calcDay = function(dayIdx){
    if(fourDays.length===0||!nmDate)return;
    setActiveDay(dayIdx);setSelCity(null);
    var myGen = ++calcGenRef.current;

    // اول کش را چک می‌کنیم — اگر همین روز با همین orientation و
    // همین nmDate/شهر کاربر قبلاً محاسبه شده، بدون هیچ محاسبه‌ی
    // مجددی مستقیماً همان نتیجه اعمال می‌شود (تقریباً آنی).
    var cacheKey = makeCalcCacheKey(dayIdx, effectiveLandscape);
    var cached = calcCacheRef.current[cacheKey];
    if (cached) {
      setRawCalcData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTimeout(function(){
      if (myGen !== calcGenRef.current) return; // یک calcDay جدیدتر شروع شده — این اجرا را رها کن
      var theDate = fourDays[dayIdx].date;
      var activeGrid = effectiveLandscape ? GRID_FULL : GRID_LIGHT;

      // یک لیست واحد از همه‌ی کارها (نقاط گرید + شهرها + شهر کاربر)
      // می‌سازیم تا فقط یک مکانیزم chunking لازم باشد.
      var jobs = [];
      for (var gi=0; gi<activeGrid.length; gi++){
        jobs.push({type:'grid', p:activeGrid[gi]});
      }
      for (var ci=0; ci<ALL_CITIES.length; ci++){
        jobs.push({type:'city', c:ALL_CITIES[ci]});
      }
      if (userCity) jobs.push({type:'userCity', c:userCity});

      var gridRaw = [];
      var citiesRaw = [];
      var userCityRaw = null;
      var idx = 0;

      var processChunk = function(){
        if (myGen !== calcGenRef.current) return; // لغو تمیز اگر محاسبه‌ی جدیدتری شروع شده
        var end = Math.min(idx + CALC_CHUNK_SIZE, jobs.length);
        for (; idx<end; idx++){
          var job = jobs[idx];
          if (job.type === 'grid') {
            var p = job.p;
            var data = MoonCalculator.getFullMoonData(theDate,p.lat,p.lon,0,nmDate,null,{skipSchaefer:true});
            gridRaw.push({lat:p.lat,lon:p.lon,data:data});
          } else if (job.type === 'city') {
            var c = job.c;
            var cdata = MoonCalculator.getFullMoonData(theDate,c.lat,c.lon,0,nmDate,null,{skipSchaefer:true});
            citiesRaw.push({name:c.name,flag:c.flag,countryKey:c.countryKey,lat:c.lat,lon:c.lon,data:cdata});
          } else {
            var uc = job.c;
            var udata = MoonCalculator.getFullMoonData(theDate,uc.lat,uc.lon,uc.alt||0,nmDate,null,{skipSchaefer:true});
            userCityRaw = {name:uc.name,lat:uc.lat,lon:uc.lon,data:udata};
          }
        }
        if (idx < jobs.length) {
          // هنوز کار باقی است — یک تیک به event loop فرصت رندر
          // می‌دهیم و ادامه می‌دهیم. setTimeout(fn,0) (نه Promise
          // یا requestAnimationFrame) عمداً انتخاب شده چون در
          // React Native این تضمین می‌کند رشته‌ی JS واقعاً بین
          // تکه‌ها آزاد می‌شود.
          setTimeout(processChunk, 0);
        } else {
          if (myGen !== calcGenRef.current) return;
          var result = {grid:gridRaw, cities:citiesRaw, userCity:userCityRaw};
          storeInCalcCache(cacheKey, result); // ذخیره در کش (با رعایت سقف MAX_CACHE_ENTRIES) برای دفعات بعد
          setRawCalcData(result);
          setLoading(false);
        }
      };

      processChunk();
    },50);
  };

  var changeMonth=function(d){var nm=hMonth+d;var ny=hYear;if(nm>12){nm=1;ny++;}if(nm<1){nm=12;ny--;}setHMonth(nm);setHYear(ny);findNM(nm, ny);};

  // ============================================================
  // حالت export — مرحله‌ی ۱: راه‌اندازی. وقتی exportRequest عوض شود
  // (یعنی ReportExportScreen.js یک روز/معیار جدید خواسته)، nmDate و
  // fourDays مستقیماً از روی exportRequest.nmDate ساخته می‌شوند —
  // دقیقاً همان الگوی toLocalCalendarDay که findNM/findDefaultNM
  // استفاده می‌کنند، تا هر ۴ روز این‌جا با همان ۴ روزی که
  // CrescentAnalysisScreen.js/ReportExportScreen.js حساب کرده‌اند
  // یکی بمانند. crit هم مستقیم از درخواست ست می‌شود.
  //
  // چرا یک effect جدا و نه مستقیم در جایی که exportRequest تعریف
  // می‌شود: چون این باید هر بار که parent یک exportRequest *جدید*
  // (روز/معیار بعدی در صف) می‌فرستد دوباره اجرا شود — با
  // requestId در dependency-array این تشخیص داده می‌شود (یک شیء
  // date/crit یکسان اتفاقی دوباره فرستاده نشود مشکلی نیست چون
  // requestId هر بار توسط ReportExportScreen.js افزایش می‌یابد).
  // ============================================================
  useEffect(function () {
    if (!exportRequest) return;
    setCrit(exportRequest.crit && exportRequest.crit !== 'schaefer' ? exportRequest.crit : 'yallop');
    setNmDate(exportRequest.nmDate);
    var d0 = HijriCalendar.toLocalCalendarDay(exportRequest.nmDate, 0);
    var days = [
      { date: new Date(d0.getTime() - 24 * 3600000), short: t('dayBefore') },
      { date: new Date(d0.getTime()), short: t('dayConjunction') },
      { date: new Date(d0.getTime() + 24 * 3600000), short: t('dayAfter') },
      { date: new Date(d0.getTime() + 2 * 24 * 3600000), short: t('twoDaysAfter') },
    ];
    setFourDays(days);
    setNmFound(true);
    setRawCalcData(null); setMapData(null); setCityData([]); setUserCityData(null);
    resetMapTransform();
    // انتخاب کیفیت نقشه‌ی گزارش — نگاه کنید به کامنت بالای exportRequest.
    // مستقیماً همان state چرخش دستی موجود (mapRotated) را ست می‌کنیم؛
    // effectiveLandscape/GRID_FULL/curSW-curMH پایین‌تر خودشان بر
    // اساسش تنظیم می‌شوند، چیز جدیدی لازم نیست.
    setMapRotated(!!exportRequest.landscape);
    // eslint-disable-next-line
  }, [exportRequest && exportRequest.requestId]);

  // ============================================================
  // حالت export — مرحله‌ی ۲: صدا زدن calcDay وقتی fourDays/nmDate
  // بالا آماده شدند (این effect جدا از مرحله‌ی ۱ است چون setState
  // آسنکرون است — نمی‌شود بلافاصله بعد از setFourDays/setNmDate در
  // همان تابع به fourDays/nmDate تازه متکی بود).
  // ============================================================
  var exportDayIdxRef = useRef(1); // پیش‌فرض: روز مقارنه
  useEffect(function () {
    if (!exportRequest) return;
    if (fourDays.length === 0 || !nmDate) return;
    var targetIdx = typeof exportRequest.dayIndex === 'number' ? exportRequest.dayIndex : 1;
    exportDayIdxRef.current = targetIdx;
    calcDay(targetIdx);
    // eslint-disable-next-line
  }, [exportRequest && exportRequest.requestId, fourDays, nmDate]);

  // ============================================================
  // حالت export — مرحله‌ی ۳: گرفتن عکس وقتی calcDay واقعاً تمام شد
  // (loading=false و rawCalcData آماده) — دقیقاً سیگنال اتمامی که
  // خودِ calcDay در پایان تنظیم می‌کند (نگاه کنید به تعریف calcDay
  // بالا: setRawCalcData(result)+setLoading(false) فقط بعد از
  // پردازش کامل همه‌ی jobs، یا بلافاصله در مسیر cache-hit).
  //
  // رفع باگ «نقشه‌ی روز دوم/سوم در دسترس نیست»: وقتی صف export از
  // یک درخواست به بعدی می‌رود (requestId++)، effect۱ (بالا) و effect۲
  // هر دو در همان React effect-flush یکی پس از دیگری اجرا می‌شوند و
  // setRawCalcData(null)/calcDay(newDay) را صدا می‌زنند — اما این
  // setStateها فقط برای رندر *بعدی* اعمال می‌شوند. در همان flush،
  // این effect (شماره ۳) هنوز با مقادیر loading/rawCalcData متعلق به
  // رندرِ فعلی (یعنی هنوز داده‌های روز قبلی، چون setLoading(true) و
  // setRawCalcData(null) هنوز به این رندر نرسیده‌اند) بررسی می‌شود.
  // نتیجه: شرط loading=false && rawCalcData (کهنه، ولی truthy) پاس
  // می‌شود و capture زودتر از موعد—با state روز قبلی یا در وسط
  // انتقال—انجام می‌شود؛ گاهی حتی captureRef روی یک view در حال
  // تغییر throw می‌کند که مستقیماً به onError و پیام «نقشه در دسترس
  // نیست» برای همان روز می‌انجامد.
  //
  // راه‌حل: علاوه بر loading/rawCalcData، باید activeDay (که calcDay
  // با setActiveDay(dayIdx) ست می‌کند) واقعاً با دی‌روزِ همین
  // exportRequest یکی باشد. این تضمین می‌کند رندر واقعاً به‌روز شده و
  // متعلق به همین درخواست است، نه یک snapshot کهنه از درخواست قبلی.
  //
  // یک تأخیر کوتاه (250ms) قبل از عکس‌گیری لازم است چون:
  //   ۱. resetMapTransform یک انیمیشن spring است (نه فوری) — باید
  //      صبر کرد scale واقعاً به ۱ برسد وگرنه عکس با کمی zoom/pan
  //      باقی‌مانده گرفته می‌شود.
  //   ۲. بعد از setRawCalcData، خودِ SVG/برچسب‌های overlay باید یک
  //      فریم رندر شوند تا captureRef چیزی خالی/نصفه نگیرد.
  // ============================================================
  useEffect(function () {
    if (!exportRequest) return;
    var targetDayIdx = typeof exportRequest.dayIndex === 'number' ? exportRequest.dayIndex : 1;
    if (activeDay !== targetDayIdx) return; // هنوز رندر به این درخواست نرسیده — منتظر بمان
    if (loading || !rawCalcData) return;
    var cancelled = false;
    var timer = setTimeout(function () {
      if (cancelled) return;
      if (!mapCaptureRef.current) {
        if (exportRequest.onError) exportRequest.onError(new Error('mapCaptureRef not mounted'));
        return;
      }
      captureRef(mapCaptureRef.current, { format: 'png', result: 'base64', quality: 0.92 })
        .then(function (base64) {
          if (cancelled) return;
          if (exportRequest.onCaptured) exportRequest.onCaptured(base64);
        })
        .catch(function (err) {
          if (cancelled) return;
          if (exportRequest.onError) exportRequest.onError(err);
        });
    }, 250);
    return function () { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line
  }, [exportRequest && exportRequest.requestId, activeDay, loading, rawCalcData]);


  // فاز ۱ نسخه ۳ (بازطراحی کامل نقشه): محدوده‌ی toY هماهنگ با محدوده‌ی
  // جدید GRID (-60 تا +70 درجه، جمعاً ۱۳۰ درجه) به‌روزرسانی شد تا با
  // بازه‌ی داده هم‌خوانی کامل داشته باشد (قبلاً 75 تا -60 بود که با
  // GRID قدیمی -55 تا 65 هم‌خوان نبود و باعث کمی فشردگی نامتقارن
  // می‌شد).
  var toX=function(lon){return((lon+180)/360)*curSW;};
  var toY=function(lat){return Math.max(0, Math.min(curMH, ((70-lat)/130)*curMH));};
  var textAlign = isRTL ? 'right' : 'left';

  return(
    <ScrollView style={z.container}>
      <LinearGradient
        colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]}
        style={z.headerGradient}>
        <Text style={z.titleLabel}>{t('worldMap')}</Text>
        <Text style={z.titleT}>{HIJRI_MONTHS[hMonth-1]+' '+hYear}</Text>
        {userCity?<Text style={z.titleCity}>{t('yourCity')+': '+getCityName(userCity)}</Text>:null}
      </LinearGradient>

      <View style={z.content}>

        <View style={z.monthSel}>
          <TouchableOpacity onPress={function(){changeMonth(-1);}}><Text style={z.mBtnT}>{isRTL?'▶':'◀'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={function(){setShowPicker(true);}} style={z.mCenter}>
            <Text style={z.mCenterT}>{HIJRI_MONTHS[hMonth-1]+' '+hYear}</Text>
            <Text style={z.mCenterSub}>{t('selectMonthYear')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={function(){changeMonth(1);}}><Text style={z.mBtnT}>{isRTL?'◀':'▶'}</Text></TouchableOpacity>
        </View>

        {nmDate?(
          <View style={z.nmCard}>
            <Text style={z.nmT}>{'🌑 '+formatDateLocal(nmDate)}</Text>
            <Text style={z.nmT}>{HijriCalendar.formatGregorian(nmDate)}</Text>
            <Text style={z.nmT2}>{t('shareTime')+' '+MoonCalculator.formatTime(nmDate)}</Text>
          </View>
        ):null}

        {/* انتخاب معیار - با label معیار Soroudi اصلاح شده */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
          {[
            {id:'yallop',n:'YALLOP'},
            {id:'odeh',n:'ODEH'},
            {id:'saao',n:'SAAO'},
            {id:'ilyas',n:'ILYAS'},
            {id:'malaysia',n:'MABIMS'},
            {id:'soroudi',n:'SOROUDI ★'} // اصلاح علمی ۳؛ Schaefer عمداً در نقشه نیست (نیازمند جوّ واقعی هر نقطه)
          ].map(function(c){
            return(<TouchableOpacity key={c.id} style={[z.crBtn,crit===c.id&&z.crBtnA]}
              onPress={function(){setCrit(c.id);}}>
              <Text style={[z.crBtnT,crit===c.id&&{color:theme.colors.goldDark}]}>{c.n}</Text>
            </TouchableOpacity>);
          })}
        </ScrollView>

        {/* توضیح معیار فعال */}
        <View style={z.critDescBox}>
          <Text style={z.critDescLabel}>{MoonCalculator.getCritLabel(crit)}</Text>
          {crit === 'soroudi' ? (
            <Text style={z.critWarn}>★ {t('nonOfficialCriterionWarn')}</Text>
          ) : null}
        </View>

        {fourDays.length>0?(
          <View>
            <View style={z.dayBtns}>
              {fourDays.map(function(d,i){
                var isA=activeDay===i&&mapData!==null;
                return(
                  <Design.DayCard
                    key={i}
                    active={isA}
                    label={d.short}
                    weekDay={getWeekDayLocal(d.date)}
                    dateStr={formatDateShortLocal(d.date)}
                    onPress={function(){calcDay(i);}}
                  />
                );
              })}
            </View>
            {activeDay!==null && mapData!==null && fourDays.length>0 ? (
              <Text style={z.dayNote}>{t('hilalStatusInCity')+' '+getWeekDayLocal(fourDays[activeDay].date)+' '+formatDateLocal(fourDays[activeDay].date)}</Text>
            ) : null}
          </View>
        ):null}

        {loading?(<View style={z.loadBox}><ActivityIndicator size="large" color={theme.colors.gold}/><Text style={z.lt}>{t('calculating')}</Text></View>):null}

        {!loading&&mapData&&fourDays.length>0?(
          <View>
            <View style={z.mapHeader}>
              <Text style={z.mapHT}>{fourDays[activeDay].short}</Text>
              <Text style={z.mapHT2}>{getWeekDayLocal(fourDays[activeDay].date)+' '+formatDateLocal(fourDays[activeDay].date)}</Text>
              <Text style={z.mapHT3}>{HijriCalendar.formatGregorian(fourDays[activeDay].date)+' | '+MoonCalculator.getCritLabel(crit)}</Text>
            </View>

            {/* فاز ۱ نسخه ۳ (بازطراحی کامل نقشه):
                - LAND دستی (۶ قاره، ~۲۵۰ نقطه‌ی تقریبی، رسم با
                  صدها View چرخیده) کاملاً حذف شد.
                - جایگزین: worldCountries.json (۱۷۷ کشور واقعی،
                  منبع Natural Earth Public Domain) که با یک
                  <Path> واحد به‌ازای هر کشور رسم می‌شود — دقیق‌تر،
                  صاف‌تر، و بسیار سریع‌تر از حالت قبلی.
                - نواحی رؤیت‌پذیری هم اکنون به‌جای دایره‌های
                  پراکنده (فاصله‌ی ۱۲ درجه)، از GRID ریزتر (۴ درجه)
                  با دایره‌های هم‌پوشان بزرگ‌تر استفاده می‌کنند تا
                  ظاهری پیوسته‌تر و شبیه نقشه‌های رسمی رؤیت هلال
                  (مثل HilalMap) داشته باشند.
                - همه‌چیز داخل یک Animated.View با pinch-zoom/pan
                  است (همان الگوی ZoomableImageModal.js) — کاربر
                  می‌تواند برای دیدن جزئیات یک منطقه/کشور خاص zoom
                  کند. */}
            <View style={mapRotated ? {width:curMH+22, height:curSW, alignItems:'center', justifyContent:'center', alignSelf:'center'} : null}>
              <View style={[
                z.mapBox,
                {width:curSW,height:curMH+22},
                mapRotated ? z.mapBoxRotated : null,
              ]}>
                <View
                  ref={mapCaptureRef}
                  collapsable={false}
                  style={{width:curSW,height:curMH,backgroundColor:theme.mapColors.canvasBg,overflow:'hidden'}}
                  {...mapPanResponder.panHandlers}
                >
                <Animated.View style={{
                  width:curSW,height:curMH,
                  transform:[
                    {translateX:mapAnimTranslate.x},
                    {translateY:mapAnimTranslate.y},
                    {scale:mapAnimScale},
                  ],
                }}>
                  <Svg width={curSW} height={curMH} viewBox={'0 0 '+curSW+' '+curMH}>
                    {/* گرید latitude/longitude */}
                    {[-60,-30,0,30,60].map(function(lat,i){
                      return <Line key={'h'+i} x1={0} y1={toY(lat)} x2={curSW} y2={toY(lat)} stroke={theme.mapColors.gridLine} strokeWidth={0.5}/>;
                    })}
                    {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(function(lon,i){
                      return <Line key={'v'+i} x1={toX(lon)} y1={0} x2={toX(lon)} y2={curMH} stroke={theme.mapColors.gridLine} strokeWidth={0.5}/>;
                    })}
                    <Line x1={0} y1={toY(0)} x2={curSW} y2={toY(0)} stroke={theme.mapColors.equatorLine} strokeWidth={1}/>

                    {/* نواحی رنگی رؤیت‌پذیری — دایره‌های هم‌پوشان با
                        شعاع کمی بزرگ‌تر از فاصله‌ی گرید تا حس ناحیه‌ی
                        پیوسته (نه دات‌های مجزا) بدهند */}
                    {mapData.map(function(p,i){
                      if(!p.cat)return null;
                      var isPolar = Math.abs(p.lat) > 60;
                      var color=theme.getCatColor(p.cat, crit);
                      return(
                        <Circle key={'g'+i}
                          cx={toX(p.lon)} cy={toY(p.lat)} r={11}
                          fill={color}
                          opacity={isPolar ? 0.22 : 0.5}
                        />
                      );
                    })}

                    {/* مرزهای واقعی کشورها */}
                    {worldCountries.map(function(country, ci){
                      var d = countryToPathD(country.p, toX, toY);
                      return (
                        <Path key={'country'+ci}
                          d={d}
                          fill="none"
                          stroke={theme.mapColors.coastLine}
                          strokeWidth={0.6}
                        />
                      );
                    })}

                    {/* شهرهای شاخص — فقط دایره‌ی نشانگر این‌جا، متن
                        اسم شهر در لایه‌ی overlay پایین (به دلیل رفع
                        باگ حروف بریده‌بریده‌ی فارسی — پایین را ببینید) */}
                    {MAP_CITIES.map(function(c,i){
                      var cd=cityData.find(function(x){return x.name===c.name;});
                      var cat=cd?cd.cat:'';
                      var color=cat?theme.getCatColor(cat, crit):'#444';
                      var x=toX(c.lon),y=toY(c.lat);
                      return(
                        <Circle key={'mc'+i} cx={x} cy={y} r={2.5} fill={color} stroke={theme.colors.textSecondary} strokeWidth={1}/>
                      );
                    })}

                    {/* نشانگر شهر کاربر — فقط دایره، متن در overlay */}
                    {userCityData?(function(){
                      var color=theme.getCatColor(userCityData.cat, crit);
                      var x=toX(userCityData.lon),y=toY(userCityData.lat);
                      return(
                        <React.Fragment>
                          <Circle cx={x} cy={y} r={8} fill="none" stroke={theme.colors.textPrimary} strokeWidth={2}/>
                          <Circle cx={x} cy={y} r={5} fill={color}/>
                        </React.Fragment>
                      );
                    })():null}
                  </Svg>

                  {/* ==============================================
                      فاز ۱ نسخه ۳ (بازبینی هشتم): رفع باگ «حروف فارسی
                      از هم پراکنده روی نقشه».
                      علت دقیق: SvgText در react-native-svg موتور
                      text-shaping کامل (مثل HarfBuzz/ICU که خودِ
                      <Text> بومی React Native استفاده می‌کند) ندارد؛
                      این یک محدودیت شناخته‌شده و حل‌نشده‌ی خودِ
                      کتابخانه است (مثلاً Issue #439 در ریپازیتوری
                      رسمی react-native-svg، از سال ۲۰۱۷ تا امروز باز
                      مانده) — نه چیزی که با تغییر پارامترهای SvgText
                      حل شود. حروف فارسی/عربی برای پیوسته دیده شدن به
                      شکل‌های وابسته‌به‌موقعیت (ابتدایی/وسطی/پایانی)
                      نیاز دارند که SvgText اصلاً محاسبه نمی‌کند.
                      راه‌حل: تمام برچسب‌های متنی (اسم کشور، اسم شهر،
                      اسم شهر کاربر) از داخل <Svg> بیرون آمدند و به‌
                      جای SvgText با <Text> معمولی React Native (که
                      از موتور شکل‌دهی کامل سیستم‌عامل استفاده می‌کند)
                      در یک لایه‌ی overlay مطلق‌موقعیت رسم می‌شوند.
                      این لایه هم از همان transform (scale/translate)
                      نقشه استفاده می‌کند تا هنگام zoom/pan هم‌زمان و
                      هماهنگ با نقشه حرکت کند. */}
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* فاز ۱ نسخه ۳ (بازبینی هشتم): رفع باگ «نوشته‌های
                        انگلیسی هنگام زوم تودرتو و ناخوانا می‌شوند».
                        علت: این لایه‌ی overlay داخل همان Animated.View
                        است که transform:scale نقشه را دارد — یعنی
                        بدون کار اضافی، اندازه‌ی متن هم دقیقاً هم‌نسبت
                        با zoom بزرگ می‌شد (مثلاً در zoom×4، فونت هم
                        عملاً ۴ برابر بزرگ‌تر از حالت عادی دیده می‌شد و
                        روی هم می‌افتاد). راه‌حل: هر Text یک
                        counter-scale معکوس (1/mapScale) می‌گیرد تا
                        اندازه‌ی واقعی روی صفحه تقریباً ثابت بماند —
                        دقیقاً رفتاری که کاربر خواسته بود: «با زوم نقشه
                        نوشته‌ها هم ریز بشن» (یعنی اندازه‌ی ظاهریشان
                        تغییر نکند، نه این‌که با نقشه بزرگ شوند). */}
                    {worldCountries.map(function(country, ci){
                      if (LABELED_COUNTRIES.indexOf(country.n) === -1) return null;
                      var pt = countryLabelPoint(country.p);
                      if (!pt) return null;
                      var lx = toX(pt.lon), ly = toY(pt.lat);
                      var inv = 1 / mapScale;
                      // نکته: نام کشورها فعلاً به انگلیسی نمایش داده
                      // می‌شود (دقیقاً مثل تصویر مرجع HilalMap) — ترجمه‌ی
                      // ۳۶ نام کشور به سه زبان یک بهبود جداگانه است که
                      // در صورت درخواست می‌توان به translations.js اضافه
                      // کرد؛ فعلاً اولویت رفع باگ‌های گزارش‌شده بود.
                      return (
                        <Text key={'label'+ci}
                          style={[z.mapCountryLabel, {
                            left:lx-40, top:ly-6, width:80,
                            transform:[{scale:inv}],
                          }]}
                          numberOfLines={1}>
                          {country.n}
                        </Text>
                      );
                    })}
                    {/* فاز ۱ نسخه ۴: برچسب‌های متنی اسم شهرهای رصدی
                        (قاهره، سیدنی و...) که این‌جا پخش می‌شدند حذف
                        شدند — کاربر گزارش داد با انبوه‌شدن نام‌ها روی
                        نقشه (به‌خصوص در زوم پایین) نقشه شلوغ و ناخوانا
                        می‌شود. خودِ نقطه‌های رنگی این شهرها (Circle
                        بالاتر در <Svg>) دست‌نخورده باقی مانده‌اند —
                        رنگشان طبق legend پایین صفحه قابل تفسیر است؛
                        فقط اسم متنی هرکدام حذف شد. */}
                  </View>
                </Animated.View>
              </View>

              {mapScale > 1 ? (
                <TouchableOpacity style={z.zoomResetBtn} onPress={resetMapTransform}>
                  <Text style={z.zoomResetT}>{'↺ '+t('resetZoom')}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={z.zoomHint}>{t('pinchToZoomHint')}</Text>
              )}

              </View>
            </View>

            {/* دکمه‌ی چرخش دستی نقشه — عمداً بیرون از باکسِ
                چرخانده‌شده قرار دارد تا همیشه به‌صورت عمودی و
                قابل‌لمس بماند (اگر داخل باکسِ چرخیده می‌بود، خودِ
                دکمه هم ۹۰ درجه کج می‌شد و لمس کردنش گیج‌کننده
                می‌شد). این دکمه فقط ظاهر خودِ نقشه را می‌چرخاند —
                نه کل صفحه یا اپ را — و state آن (mapRotated) کاملاً
                پایدار و مستقل از رویدادهای چرخش دستگاه است؛ فقط با
                لمس دوباره‌ی همین دکمه، یا با چرخاندن واقعی گوشی،
                به حالت قبل برمی‌گردد. */}
            <TouchableOpacity style={z.rotateBtn} onPress={toggleMapRotation}>
              <Text style={z.rotateBtnT}>
                {mapRotated ? '↕ ' + t('backToPortrait') : '⤢ ' + t('viewInLandscape')}
              </Text>
            </TouchableOpacity>

            {/* راهنمای معنی حروف/رنگ‌ها — دقیقاً همان کارت «راهنما»ی
                پایین HomeScreen.js (نه راهنمای کوتاه/داخل-نقشه‌ی
                قبلی که حذف شد). فقط حروفی نشان داده می‌شود که خودِ
                معیار انتخاب‌شده (crit) واقعاً تولید می‌کند. */}
            <View style={z.card}>
              <Text style={[z.cardTitle,{textAlign:textAlign}]}>{t('guide') + ' — ' + MoonCalculator.getCritLabel(crit)}</Text>
              {(CRIT_LETTERS[crit] || CRIT_LETTERS.yallop).map(function(letter){
                return <MapLegendRow key={letter} cat={letter} text={getCatTextLocal(letter)} crit={crit} />;
              })}
              {crit !== 'yallop' ? (
                <Text style={z.critWarn}>
                  {t('critLettersLegendNote') + ' ' + MoonCalculator.getCritLabel(crit) + ' ' + t('critLettersLegendNoteSuffix')}
                </Text>
              ) : null}
            </View>

            {userCityData?(
              <View style={[z.userCityBox,{borderColor:theme.getCatColor(userCityData.cat, crit)}]}>
                <Text style={[z.userCityTitle,{textAlign:textAlign}]}>{'⭐ '+getCityName(userCityData)+':'}</Text>
                {/* اصلاح ۱: هشدار polar night / midnight sun */}
                {userCityData.data.midnightSun ? (
                  <Text style={z.polarWarn}>☀️ {t('midnightSunWarnShort')}</Text>
                ) : null}
                {userCityData.data.polarNight ? (
                  <Text style={z.polarWarn}>🌑 {t('polarNightWarnShort')}</Text>
                ) : null}
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:8}}>
                  <View style={[z.badge,{backgroundColor:theme.getCatColor(userCityData.cat, crit)}]}>
                    <Text style={z.badgeT}>{userCityData.cat||'?'}</Text>
                  </View>
                  <Text style={[z.userCatText,{color:theme.getCatColor(userCityData.cat, crit)}]}>{getCatTextLocal(userCityData.cat)}</Text>
                </View>
                <View style={{marginTop:8}}>
                  <CDR l={t('moonAltitude')} v={MoonCalculator.formatDegree(userCityData.data.moonAltitude)} c={userCityData.data.moonAltitude>0?theme.colors.success:theme.colors.danger} />
                  {/* اصلاح علمی ۶: moonAge با note */}
                  <CDR l={t('moonAgeLabel')} v={MoonCalculator.formatAge(userCityData.data.moonAge, userCityData.data.moonAgeNote)} />
                  {userCityData.data.moonAgeNote?<Text style={z.ageNote}>* {t(userCityData.data.moonAgeNote)}</Text>:null}
                  <CDR l={t('lagTimeLabel')} v={MoonCalculator.formatDuration(userCityData.data.lagTime)} c={userCityData.data.lagTime>0?theme.colors.success:theme.colors.danger} />
                  {/* اصلاح ۳: topoElongation null-safe */}
                  <CDR l="Elongation" v={userCityData.data.topoElongation!==null?userCityData.data.topoElongation.toFixed(2)+'°':'---'} />
                  <CDR l={t('illumination')} v={userCityData.data.illuminationPercent?userCityData.data.illuminationPercent.toFixed(2)+'%':'---'} />
                  {/* اصلاح ۵: DAZ signed */}
                  <CDR l="DAZ (signed)" v={userCityData.data.dazSigned!==null?((userCityData.data.dazSigned>=0?'+':'')+userCityData.data.dazSigned.toFixed(1)+'°'):'---'} />
                  <CDR l="Yallop q" v={userCityData.data.yallopQ!==null?userCityData.data.yallopQ.toFixed(4):'---'} c={theme.getCatColor(userCityData.data.yallopCat, 'yallop')} />
                  {/* اصلاح علمی ۵: Danjon دو سطح */}
                  {/* فاز ۱ نسخه ۳ (بازبینی هفتم): این دو خط قبلاً
                      متن ثابت و اشتباه داشتند — '✓ رد شد' برای حالت
                      true (یعنی «عبور کرد از حد Danjon»، سبز/موفق)
                      و '✗ نشد' برای حالت false (یعنی «رد شد»، قرمز/
                      ناموفق). این دقیقاً برعکس معنی واقعی کلمات
                      بود: «رد شد» باید برای حالت ناموفق (قرمز)
                      باشد، نه موفق. کلیدهای t('danjonPassed')/
                      t('danjonNotPassed') در HomeScreen.js همین اپ
                      از قبل درست تعریف شده بودند («عبور کرده» /
                      «عبور نکرده»)؛ این‌جا هم از همان کلیدها استفاده
                      می‌شود، به‌جای متن جداگانه و اشتباه. */}
                  <CDR l={"Danjon (👁 " + t('danjonNakedEyeLabel') + ")"} v={userCityData.data.danjonOkNaked?t('danjonPassed'):t('danjonNotPassed')} c={userCityData.data.danjonOkNaked?theme.colors.success:theme.colors.danger} />
                  <CDR l={"Danjon (🔭 " + t('danjonTelescopeLabel') + ")"} v={userCityData.data.danjonOkTelescope?t('danjonPassed'):t('danjonNotPassed')} c={userCityData.data.danjonOkTelescope?theme.colors.catB:theme.colors.ember} />
                </View>
              </View>
            ):null}

            <Text style={[z.secTitle,{textAlign:textAlign}]}>{t('cityStatus')}</Text>
            {cityData.map(function(city,i){
              var color=theme.getCatColor(city.cat, crit);
              var isExp=selCity===i;
              return(<TouchableOpacity key={i} style={[z.cityCard,{borderLeftColor:color}]} onPress={function(){setSelCity(isExp?null:i);}}>
                <View style={z.cityH}>
                  <Text style={{fontSize:16}}>{city.flag}</Text>
                  <View style={{flex:1}}>
                    <Text style={z.cityN}>{getCityName(city)}</Text>
                    <Text style={z.cityC}>{t(city.countryKey)}</Text>
                    {/* اصلاح ۱: هشدار polar */}
                    {city.data.midnightSun?<Text style={z.cityPolar}>☀️ {t('midnightSunLabel')}</Text>:null}
                    {city.data.polarNight?<Text style={z.cityPolar}>🌑 {t('polarNightLabel')}</Text>:null}
                  </View>
                  <View style={[z.badge,{backgroundColor:color}]}><Text style={z.badgeT}>{city.cat||'?'}</Text></View>
                </View>
                {isExp?(<View style={z.cityExp}>
                  <Text style={[z.cityFull,{color:color,textAlign:textAlign}]}>{getCatFullLocal(city.cat)}</Text>
                  <CDR l={t('altitude')} v={MoonCalculator.formatDegree(city.data.moonAltitude)} c={city.data.moonAltitude>0?theme.colors.success:theme.colors.danger} />
                  {/* اصلاح علمی ۶: moonAge note */}
                  <CDR l={t('age')} v={MoonCalculator.formatAge(city.data.moonAge, city.data.moonAgeNote)} />
                  <CDR l={t('lag')} v={MoonCalculator.formatDuration(city.data.lagTime)} c={city.data.lagTime>0?theme.colors.success:theme.colors.danger} />
                  {/* اصلاح ۳: null-safe */}
                  <CDR l="Elong" v={city.data.topoElongation!==null?city.data.topoElongation.toFixed(2)+'°':(city.data.elongation?city.data.elongation.toFixed(2)+'°':'---')} />
                  <CDR l={t('brightness')} v={city.data.illuminationPercent?city.data.illuminationPercent.toFixed(2)+'%':'---'} />
                  <CDR l={t('sunsetShort')} v={MoonCalculator.formatTimeHM(city.data.sunSet, city.lat, city.lon)} />
                  {/* اصلاح ۵: DAZ signed */}
                  <CDR l="DAZ" v={city.data.dazSigned!==null?((city.data.dazSigned>=0?'+':'')+city.data.dazSigned.toFixed(1)+'°'):'---'} />
                  <CDR l="Q" v={city.data.yallopQ!==null?city.data.yallopQ.toFixed(4):'---'} c={theme.getCatColor(city.data.yallopCat, 'yallop')} />
                </View>):null}
                <Text style={z.expH}>{isExp?'▲':'▼'}</Text>
              </TouchableOpacity>);
            })}
          </View>
        ):null}

        {!loading&&!mapData&&nmFound?(<View style={z.emptyBox}><Text style={{fontSize:40}}>👆</Text><Text style={z.emptyT}>{t('selectADay')}</Text></View>):null}

        <View style={{height:40}}/>
      </View>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={z.moBg}><View style={z.moBox}>
          <Text style={z.moTitle}>{t('selectMonthYear')}</Text>
          <View style={z.yrRow}>
            <TouchableOpacity onPress={function(){ var ny=hYear-1; setHYear(ny); setYearInput(ny.toString()); }} style={z.yrBtn}><Text style={z.yrBtnT}>{isRTL?'▶':'◀'}</Text></TouchableOpacity>
            {/* امکان تایپ مستقیم سال هجری — دقیقاً همان الگوی
                HomeScreen.js. onChangeText فقط متن را نگه می‌دارد
                (اجازه‌ی خالی/ناقص بودن موقت حین تایپ)؛ onEndEditing
                عدد را اعتبارسنجی و به hYear واقعی اعمال می‌کند. */}
            <TextInput
              style={z.yrInput}
              value={yearInput}
              onChangeText={function(txt){ setYearInput(txt.replace(/[^0-9]/g, '')); }}
              onEndEditing={function(){
                var n = parseInt(yearInput, 10);
                if (isNaN(n) || n < 1 || n > 9999) {
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
            <TouchableOpacity onPress={function(){ var ny=hYear+1; setHYear(ny); setYearInput(ny.toString()); }} style={z.yrBtn}><Text style={z.yrBtnT}>{isRTL?'◀':'▶'}</Text></TouchableOpacity>
          </View>
          <View style={z.moGrid}>
            {HIJRI_MONTHS.map(function(name,i){var isSel=hMonth===(i+1);
              return(<TouchableOpacity key={i} style={[z.moItem,isSel&&z.moItemA]} onPress={function(){setHMonth(i+1);}}>
                <Text style={[z.moItemT,isSel&&{color:theme.colors.goldDark}]}>{name}</Text>
              </TouchableOpacity>);})}
          </View>
          <TouchableOpacity style={z.moOk} onPress={function(){setShowPicker(false); findNM(hMonth, hYear);}}><Text style={z.moOkT}>{t('confirm')}</Text></TouchableOpacity>
        </View></View>
      </Modal>

    </ScrollView>
  );
}

function CDR(p){return(<View style={z.cdr}><Text style={[z.cdrV,p.c?{color:p.c}:null]}>{p.v}</Text><Text style={z.cdrL}>{p.l}</Text></View>);}

// معادل دقیق کامپوننت LR در HomeScreen.js — رنگ باید بر اساس معیار
// (p.crit) باشد نه فقط حرف، چون همان حرف در معیارهای مختلف می‌تواند
// رنگ متفاوتی داشته باشد.
function MapLegendRow(p){
  var color = theme.getCatColor(p.cat, p.crit);
  return (
    <View style={z.legRow}>
      <Text style={z.legText}>{p.text}</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
        <Text style={{color:color,fontWeight:'bold'}}>{p.cat}</Text>
        <View style={[z.legDot,{backgroundColor:color}]}/>
      </View>
    </View>
  );
}

var z = StyleSheet.create({
  container:{flex:1,backgroundColor:theme.colors.bgPage},
  content:{padding:theme.spacing.lg},
  lt:{color:theme.colors.gold,fontSize:13,marginTop:10},
  // اصلاح ۱
  polarWarn:{color:theme.colors.emberLight,fontSize:10,marginTop:4,fontStyle:'italic'},
  cityPolar:{color:theme.colors.emberLight,fontSize:8,marginTop:1},
  // اصلاح علمی ۶
  ageNote:{color:theme.colors.textMuted,fontSize:9,fontStyle:'italic',marginBottom:2},
  // توضیح معیار
  critDescBox:{backgroundColor:theme.colors.bgCardDeep,borderRadius:8,padding:8,marginBottom:8,borderWidth:1,borderColor:theme.colors.border},
  critDescLabel:{color:theme.colors.gold,fontSize:11,fontWeight:'bold'},
  critWarn:{color:theme.colors.warning,fontSize:10,marginTop:2,fontStyle:'italic'},
  // کارت راهنمای معنی حروف/رنگ‌ها (دقیقاً هم‌الگو با HomeScreen.js)
  card:{backgroundColor:theme.colors.bgCard,borderRadius:theme.radius.lg,padding:theme.spacing.xl-2,marginBottom:theme.spacing.md},
  cardTitle:{color:theme.colors.gold,fontSize:15,fontWeight:'bold',marginBottom:12},
  legRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:5},
  legDot:{width:12,height:12,borderRadius:6},
  legText:{color:theme.colors.textSecondary,fontSize:12},
  // هدر گرادیانی (جایگزین titleBox تخت قبلی)
  headerGradient:{paddingVertical:theme.spacing.xl,paddingHorizontal:theme.spacing.lg,alignItems:'center'},
  titleBox:{alignItems:'center',paddingVertical:16,backgroundColor:theme.colors.bgCard,borderRadius:14,marginBottom:10},
  titleLabel:{color:theme.colors.textSecondary,fontSize:11,marginBottom:2},
  titleT:{color:theme.colors.gold,fontSize:theme.type.display.fontSize,fontWeight:theme.type.display.fontWeight},
  titleT2:{color:theme.colors.textPrimary,fontSize:13,marginTop:4},
  titleCity:{color:theme.colors.textMuted,fontSize:12,marginTop:6},
  monthSel:{flexDirection:'row',alignItems:'center',backgroundColor:theme.colors.bgCard,borderRadius:12,padding:10,marginBottom:8},
  mBtnT:{color:theme.colors.gold,fontSize:18,fontWeight:'bold',padding:10},
  mCenter:{flex:1,alignItems:'center'},
  mCenterT:{color:theme.colors.textPrimary,fontSize:15,fontWeight:'bold'},
  mCenterSub:{color:theme.colors.textMuted,fontSize:9,marginTop:2},
  nmCard:{backgroundColor:theme.colors.bgHeader,borderRadius:10,padding:10,marginBottom:8,alignItems:'center',borderWidth:1,borderColor:theme.colors.borderGoldSubtle},
  nmT:{color:theme.colors.textPrimary,fontSize:12},
  nmT2:{color:theme.colors.textLink,fontSize:11,marginTop:2},
  crBtn:{backgroundColor:theme.colors.bgCard,paddingHorizontal:12,paddingVertical:7,borderRadius:20,marginRight:5,borderWidth:1,borderColor:theme.colors.border},
  crBtnA:{backgroundColor:theme.colors.gold},
  crBtnT:{color:theme.colors.textPrimary,fontSize:10,fontWeight:'bold'},
  dayBtns:{flexDirection:'row',gap:5,marginBottom:10,marginTop:4},
  // dayBtn/dayBtnA/... دیگر مستقیم استفاده نمی‌شوند (جایگزین با
  // Design.DayCard)، برای سازگاری احتمالی نگه داشته شده‌اند.
  dayBtn:{flex:1,backgroundColor:theme.colors.bgCard,borderRadius:8,padding:8,alignItems:'center',borderWidth:1,borderColor:theme.colors.border},
  dayBtnA:{backgroundColor:theme.colors.gold},
  dayBtnT:{color:theme.colors.textSecondary,fontSize:9,fontWeight:'bold'},
  dayBtnD:{color:theme.colors.textMuted,fontSize:7,marginTop:1},
  loadBox:{alignItems:'center',paddingVertical:30},
  mapHeader:{backgroundColor:theme.colors.bgCard,borderTopLeftRadius:12,borderTopRightRadius:12,padding:10,alignItems:'center'},
  mapHT:{color:theme.colors.gold,fontSize:12,fontWeight:'bold'},
  mapHT2:{color:theme.colors.textPrimary,fontSize:11,marginTop:2},
  mapHT3:{color:theme.colors.textMuted,fontSize:9,marginTop:2},
  mapBox:{backgroundColor:theme.mapColors.canvasBg,borderBottomLeftRadius:12,borderBottomRightRadius:12,overflow:'hidden',marginBottom:10,borderWidth:1,borderColor:theme.colors.border},
  // چرخش بصری نقشه (بدون چرخاندن OS/کل اپ): چون transform در
  // React Native جای واقعی عنصر را در چیدمان (layout flow) تغییر
  // نمی‌دهد (فقط ظاهرش را)، باید فضای عمودی کافی برای اندازه‌ی
  // چرخانده‌شده‌ی جعبه در ScrollView رزرو کنیم — وگرنه محتوای بعدی
  // (زیرنویس‌ها، لیست شهرها) روی نقشه‌ی چرخانده‌شده می‌افتد یا فضای
  // خالی زشت می‌ماند. marginVertical منفی/مثبت اینجا با توجه به
  // نسبت عرض/ارتفاع باکس (که خودش قبلاً بر اساس ابعاد چرخانده‌شده
  // محاسبه شده) تنظیم می‌شود؛ alignSelf:center هم باکس را در وسط
  // عرض صفحه (که بعد از چرخش، عملاً بعد افقی محدودتری دارد) نگه
  // می‌دارد.
  mapBoxRotated:{transform:[{rotate:'90deg'}],alignSelf:'center'},
  // فاز ۱ نسخه ۳ (بازطراحی کامل نقشه): استایل‌های راهنمای zoom
  zoomHint:{color:theme.colors.textMuted,fontSize:9,textAlign:'center',paddingVertical:4,backgroundColor:theme.mapColors.legendBg},
  zoomResetBtn:{alignItems:'center',paddingVertical:5,backgroundColor:theme.mapColors.legendBg},
  zoomResetT:{color:theme.colors.gold,fontSize:10,fontWeight:'bold'},
  // فاز ۱ نسخه ۳ (بازبینی هشتم): استایل‌های لایه‌ی overlay برچسب‌های
  // نقشه (native Text به‌جای SvgText — رفع باگ حروف فارسی بریده).
  mapCountryLabel:{position:'absolute',color:theme.colors.textSecondary,fontSize:9,textAlign:'center',opacity:0.85},
  mapUserCityLabel:{position:'absolute',color:theme.colors.gold,fontSize:10,fontWeight:'bold'},
  // فاز ۱ نسخه ۳ (بازبینی هشتم): استایل‌های راهنمای کامل نقشه (رفع
  // نقص «معنی رنگ‌ها/حروف اصلاً روی نقشه نیست»)
  mapLegendBox:{backgroundColor:theme.mapColors.legendBg,padding:theme.spacing.sm},
  mapLegendTitle:{color:theme.colors.gold,fontSize:11,fontWeight:'700',marginBottom:4},
  mapLegendRow:{flexDirection:'row',alignItems:'center',paddingVertical:2,gap:6},
  mapLegendDot:{width:9,height:9,borderRadius:5},
  mapLegendLetter:{color:theme.colors.textSecondary,fontSize:10,fontWeight:'700',width:14,textAlign:'center'},
  mapLegendMeaning:{color:theme.colors.textSecondary,fontSize:10,flex:1},
  mapLegendFooter:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:4,paddingTop:4,borderTopWidth:1,borderTopColor:theme.colors.borderSubtle},
  mapLegendFooterT:{color:theme.colors.textMuted,fontSize:9},
  rotateBtn:{alignItems:'center',paddingVertical:6,backgroundColor:theme.mapColors.legendBg,borderBottomLeftRadius:12,borderBottomRightRadius:12},
  rotateBtnT:{color:theme.colors.gold,fontSize:10,fontWeight:'bold'},
  userCityBox:{backgroundColor:theme.colors.bgCard,borderRadius:12,padding:14,marginBottom:10,borderWidth:2},
  userCityTitle:{color:theme.colors.gold,fontSize:13,fontWeight:'bold'},
  userCatText:{fontSize:13,fontWeight:'bold'},
  badge:{width:26,height:26,borderRadius:13,justifyContent:'center',alignItems:'center'},
  badgeT:{color:theme.colors.textPrimary,fontSize:12,fontWeight:'bold'},
  secTitle:{color:theme.colors.gold,fontSize:13,fontWeight:'bold',marginBottom:8},
  cityCard:{backgroundColor:theme.colors.bgCard,borderRadius:10,padding:12,marginBottom:5,borderLeftWidth:3},
  cityH:{flexDirection:'row',alignItems:'center',gap:6},
  cityN:{color:theme.colors.textPrimary,fontSize:12,fontWeight:'bold'},
  cityC:{color:theme.colors.textMuted,fontSize:9},
  cityExp:{marginTop:8,paddingTop:8,borderTopWidth:1,borderTopColor:theme.colors.border},
  cityFull:{fontSize:10,lineHeight:16,marginBottom:4},
  cdr:{flexDirection:'row',justifyContent:'space-between',paddingVertical:3},
  cdrL:{color:theme.colors.textMuted,fontSize:10},
  cdrV:{color:theme.colors.textPrimary,fontSize:10,fontWeight:'600'},
  expH:{color:theme.colors.textMuted,fontSize:9,textAlign:'center',marginTop:4},
  emptyBox:{alignItems:'center',paddingVertical:40},
  emptyT:{color:theme.colors.textMuted,fontSize:13,marginTop:8},
  noteBox:{backgroundColor:theme.colors.bgCard,borderRadius:10,padding:12,marginTop:6},
  noteT:{color:theme.colors.textSecondary,fontSize:10,lineHeight:18},
  moBg:{flex:1,backgroundColor:theme.colors.bgOverlay,justifyContent:'center',padding:20},
  moBox:{backgroundColor:theme.colors.bgCard,borderRadius:16,padding:20},
  moTitle:{color:theme.colors.gold,fontSize:15,fontWeight:'bold',textAlign:'center',marginBottom:14},
  yrRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:20,marginBottom:14},
  yrBtn:{backgroundColor:theme.colors.border,width:36,height:36,borderRadius:18,justifyContent:'center',alignItems:'center'},
  yrBtnT:{color:theme.colors.gold,fontSize:16,fontWeight:'bold'},
  yrInput:{color:theme.colors.textPrimary,fontSize:22,fontWeight:'bold',minWidth:80,textAlign:'center',borderBottomWidth:1,borderBottomColor:theme.colors.gold,paddingVertical:2},
  moGrid:{flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:14},
  moItem:{backgroundColor:theme.colors.border,paddingHorizontal:11,paddingVertical:7,borderRadius:8},
  moItemA:{backgroundColor:theme.colors.gold},
  moItemT:{color:theme.colors.textPrimary,fontSize:10,fontWeight:'bold'},
  moOk:{backgroundColor:theme.colors.gold,borderRadius:10,padding:12,alignItems:'center'},
  moOkT:{color:theme.colors.goldDark,fontSize:14,fontWeight:'bold'},
  dayNote:{color:theme.colors.textLink,fontSize:11,textAlign:'center',marginTop:6,marginBottom:4,fontStyle:'italic'},
});