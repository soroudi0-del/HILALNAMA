import React, { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
var Text = require('../design/ScaledText');
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as ImageManipulator from 'expo-image-manipulator';

var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;
var MoonCalculator = require('../calculations/moonPosition');
var WeatherService = require('../calculations/weatherService');
var HijriCalendar = require('../calculations/hijriCalendar');
var ReportBuilder = require('../services/reportBuilder');
var MapScreen = require('./MapScreen').default;

// ============================================================
// ReportExportScreen — درخواست کاربر: «خروجی PDF/DOCX دقیق برای
// کمیسیون‌های رؤیت هلال، شامل نقشه‌ی کامل، اطلاعات نجومی دقیق و
// هرچه لازم است، با اشاره‌ی واضح به هلال‌نما».
//
// این نسخه فقط PDF می‌سازد (طبق تصمیم کاربر — DOCX بعداً در صورت
// نیاز اضافه می‌شود).
//
// معماری:
//   ۱. UI انتخاب محتوا (نقشه/داده‌ی کامل/مقایسه‌ی معیارها/راهنما،
//      و این‌که نقشه با کدام معیار(ها) رسم شود).
//   ۲. برای هر یک از ۴ روز (قبل/مقارنه/بعد/دو‌روز‌بعد)، داده‌ی
//      نجومی کامل مستقیماً با MoonCalculator.getFullMoonData
//      محاسبه می‌شود (سریع، synchronous، نیازی به MapScreen ندارد).
//   ۳. اگر «نقشه» انتخاب شده باشد، یک نمونه‌ی MapScreen به‌صورت
//      کاملاً نامرئی (position:absolute، خارج از صفحه با
//      opacity:0 + pointerEvents:none) رندر می‌شود و با
//      route.params.exportRequest به‌ترتیب برای هر (روز، معیار)
//      درخواست عکس می‌دهد — نگاه کنید به کامنت‌های «حالت export»
//      در بالای MapScreen.js.
//   ۴. همه‌چیز (متن + عکس‌های base64) به reportBuilder.buildReportHtml
//      داده می‌شود، سپس expo-print.printToFileAsync HTML→PDF
//      می‌سازد، و expo-sharing برگه‌ی اشتراک‌گذاری/ذخیره را باز
//      می‌کند.
//
// props: navigation, route.params = {date, city, nmDate, crit}
// (دقیقاً همان چهار مقداری که HomeScreen.js به CrescentAnalysis هم
// می‌فرستد — نگاه کنید به دکمه‌ی analysisBtn در HomeScreen.js)
// ============================================================

// Schaefer عمداً در معیارهای «نقشه» نیست (نقشه‌ی آن نیازمند جوّ واقعی هر نقطه است و نادقیق می‌شود)
var ALL_CRIT_IDS = ['yallop', 'odeh', 'saao', 'ilyas', 'malaysia', 'soroudi'];
var DAY_LABEL_KEYS = ['dayBefore', 'dayConjunction', 'dayAfter', 'twoDaysAfter'];

// ============================================================
// تصمیم کاربر (رفع باگ «PDF خالی ۶۰۰ بایتی» در حالت نقشه‌ی دقیق‌تر):
// وقتی نقشه‌ی «دقیق‌تر» (لندسکیپ، GRID_FULL در MapScreen.js) انتخاب
// شده، هر عکس نقشه چند صد کیلوبایت base64 می‌شود؛ اگر همه‌ی ۴ روز
// × تا ۶ معیار با هم درخواست شوند، حجم کل HTML (که یک‌جا باید از
// طریق پل React Native به expo-print منتقل شود) به چند مگابایت
// می‌رسد و آن انتقال بی‌صدا شکست می‌خورد — نتیجه یک PDF تقریباً
// خالی (~600 بایت) است، بدون هیچ خطای قابل‌مشاهده در try/catch.
//
// راه‌حل: در حالت «دقیق‌تر»، حداکثر ۲ روز هم‌زمان مجاز است. این هم
// حجم واقعی HTML را در محدوده‌ی امن نگه می‌دارد و هم با این‌که نقشه‌ی
// لندسکیپ حالا در PDF بزرگ‌تر/تمام‌عرض دیده می‌شود (نگاه کنید به
// orientation: landscape در handleBuildReport و mapImgLandscape در
// reportBuilder.js) هم‌خوانی منطقی دارد: کاربر برای دقتِ بیشتر روی
// تعداد کمتری روز تمرکز می‌کند.
// ============================================================
var MAX_DETAILED_DAYS = 2;

export default function ReportExportScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var params = (route && route.params) || {};

  var LCtx = useLanguage();
  var t = LCtx.t;
  var isRTL = LCtx.isRTL;
  var textAlign = isRTL ? 'right' : 'left';

  var s1 = useState({
    days: [true, true, true, true],
    includeMap: true,
    includeFullAstronomy: true,
    includeCriteriaComparison: true,
    includeGuide: true,
    mapCriteria: [params.crit && ALL_CRIT_IDS.indexOf(params.crit) >= 0 ? params.crit : 'yallop'],
    // درخواست کاربر: انتخاب بین نقشه‌ی سریع‌تر (کم‌جزئیات‌تر، همان
    // grid سبک پیش‌فرض portrait خودِ MapScreen.js) و نقشه‌ی دقیق‌تر
    // (کندتر، همان grid کامل landscape). پیش‌فرض 'fast' چون این
    // همان چیزی است که خودِ MapScreen.js هم به‌طور پیش‌فرض
    // (portrait) نشان می‌دهد؛ کاربر آگاهانه باید برای دقت بیشتر
    // «detailed» را انتخاب کند و هزینه‌ی زمانی‌اش را بپذیرد.
    mapDetailLevel: 'fast',
  });
  var opts = s1[0]; var setOpts = s1[1];

  var s2 = useState(false); var building = s2[0]; var setBuilding = s2[1];
  var s3 = useState(''); var progressText = s3[0]; var setProgressText = s3[1];
  var s4 = useState(null); var errorMsg = s4[0]; var setErrorMsg = s4[1];

  // صف درخواست‌های عکس نقشه — {dayIndex, crit, nmDate, detailLevel,
  // requestId}. این‌ها یکی‌یکی (نه هم‌زمان) به MapScreen headless
  // داده می‌شوند چون MapScreen فقط یک activeDay/crit/mapRotated در
  // لحظه دارد.
  var s5 = useState(null); var currentMapRequest = s5[0]; var setCurrentMapRequest = s5[1];
  var mapQueueRef = useRef([]);
  var mapResultsRef = useRef({}); // key: dayIndex + '|' + crit → base64
  var requestIdRef = useRef(0);
  var resolveQueueRef = useRef(null); // فراخوانی وقتی کل صف تمام شد

  var toggleDay = function (idx) {
    setOpts(function (o) {
      var next = o.days.slice();
      var turningOn = !next[idx];
      // در حالت «دقیق‌تر»، اجازه‌ی روشن‌کردن روز جدید را نده اگر از قبل
      // MAX_DETAILED_DAYS روز روشن است (نگاه کنید به کامنت بالای
      // MAX_DETAILED_DAYS برای دلیل کامل).
      if (turningOn && o.mapDetailLevel === 'detailed') {
        var currentlyOn = next.filter(Boolean).length;
        if (currentlyOn >= MAX_DETAILED_DAYS) return o; // بی‌اثر — سقف پر است
      }
      next[idx] = turningOn;
      return Object.assign({}, o, { days: next });
    });
  };
  // وقتی کاربر از «سریع» به «دقیق‌تر» سوییچ می‌کند و از قبل بیش از
  // MAX_DETAILED_DAYS روز انتخاب کرده بود، فقط اولین‌ها را نگه
  // می‌داریم تا حجم HTML از همان لحظه‌ی انتخاب در محدوده‌ی امن بماند
  // (کاربر مجبور نیست خودش قبل از تولید گزارش متوجه محدودیت شود).
  var selectDetailLevel = function (level) {
    setOpts(function (o) {
      if (level !== 'detailed') return Object.assign({}, o, { mapDetailLevel: level });
      var kept = 0;
      var next = o.days.map(function (on) {
        if (!on) return false;
        if (kept >= MAX_DETAILED_DAYS) return false;
        kept += 1;
        return true;
      });
      return Object.assign({}, o, { mapDetailLevel: level, days: next });
    });
  };
  var toggleOpt = function (key) {
    setOpts(function (o) {
      var next = {};
      Object.assign(next, o);
      next[key] = !o[key];
      return next;
    });
  };
  var toggleMapCrit = function (id) {
    setOpts(function (o) {
      var has = o.mapCriteria.indexOf(id) >= 0;
      var next = has ? o.mapCriteria.filter(function (c) { return c !== id; }) : o.mapCriteria.concat([id]);
      if (next.length === 0) return o; // حداقل یک معیار باید انتخاب بماند
      return Object.assign({}, o, { mapCriteria: next });
    });
  };

  // ------------------------------------------------------------
  // اجرای صف درخواست‌های نقشه، یکی‌یکی. هر آیتم صف یک Promise جدا
  // می‌سازد که با onCaptured/onError آن حل می‌شود؛ بعد از حل شدن،
  // آیتم بعدی صف شروع می‌شود (requestId افزایش می‌یابد تا
  // MapScreen.js effect جدید را تشخیص دهد).
  // ------------------------------------------------------------
  var runNextMapRequest = function () {
    if (mapQueueRef.current.length === 0) {
      setCurrentMapRequest(null);
      if (resolveQueueRef.current) { resolveQueueRef.current(); resolveQueueRef.current = null; }
      return;
    }
    var item = mapQueueRef.current[0];
    requestIdRef.current += 1;
    setProgressText(t('reportBuildingMap') + ' — ' + t(DAY_LABEL_KEYS[item.dayIndex]) + ' (' + MoonCalculator.getCritLabel(item.crit) + ')');
    setCurrentMapRequest({
      requestId: requestIdRef.current,
      dayIndex: item.dayIndex,
      crit: item.crit,
      nmDate: item.nmDate,
      detailLevel: item.detailLevel,
      // رفع باگ: MapScreen.js مقدار exportRequest.landscape را می‌خواند
      // (نه detailLevel) تا mapRotated/GRID_FULL-یا-LIGHT را ست کند
      // (نگاه کنید به MapScreen.js خط ~883: setMapRotated(!!exportRequest.landscape)).
      // این‌جا قبلاً فقط detailLevel پاس داده می‌شد و landscape همیشه
      // undefined (یعنی falsy) می‌ماند — در نتیجه انتخاب «دقیق‌تر» کاربر
      // هیچ اثری نداشت و همیشه همان نقشه‌ی سریع/کم‌جزئیات (GRID_LIGHT،
      // پرتره) در گزارش قرار می‌گرفت، حتی وقتی کاربر «دقیق‌تر» را
      // انتخاب کرده بود.
      landscape: item.detailLevel === 'detailed',
      onCaptured: function (base64) {
        mapResultsRef.current[item.dayIndex + '|' + item.crit] = base64;
        mapQueueRef.current.shift();
        runNextMapRequest();
      },
      onError: function (err) {
        // یک عکس شکست‌خورده کل گزارش را متوقف نمی‌کند — فقط آن
        // نقشه‌ی خاص در گزارش نهایی «نقشه در دسترس نیست» نشان
        // می‌دهد (نگاه کنید به reportBuilder.js: reportMapUnavailable).
        mapQueueRef.current.shift();
        runNextMapRequest();
      },
    });
  };

  var captureAllMaps = function (selectedDayIndices) {
    return new Promise(function (resolve) {
      mapQueueRef.current = [];
      selectedDayIndices.forEach(function (dayIndex) {
        opts.mapCriteria.forEach(function (crit) {
          mapQueueRef.current.push({ dayIndex: dayIndex, crit: crit, nmDate: params.nmDate, detailLevel: opts.mapDetailLevel });
        });
      });
      if (mapQueueRef.current.length === 0) { resolve(); return; }
      resolveQueueRef.current = resolve;
      runNextMapRequest();
    });
  };

  var loadAppLogoBase64 = async function () {
    try {
      var asset = Asset.fromModule(require('../../assets/icon.png'));
      await asset.downloadAsync();
      var result = await ImageManipulator.manipulateAsync(asset.localUri || asset.uri, [], { base64: true, compress: 1 });
      return result.base64 || null;
    } catch (e) {
      return null; // بدون لوگو هم گزارش ساخته می‌شود — فقط بدون تصویر آیکون
    }
  };

  var handleBuildReport = async function () {
    setErrorMsg(null);
    var selectedDayIndices = [];
    opts.days.forEach(function (on, idx) { if (on) selectedDayIndices.push(idx); });
    if (selectedDayIndices.length === 0) {
      setErrorMsg(t('reportSelectAtLeastOneDay'));
      return;
    }
    // لایه‌ی دوم اطمینان (علاوه بر toggleDay/selectDetailLevel که در UI
    // جلوی انتخاب بیش از MAX_DETAILED_DAYS روز را می‌گیرند) — اگر به
    // هر دلیلی opts.days با این سقف هماهنگ نبود، همین‌جا هم قبل از
    // شروع capture واقعی جلوگیری می‌کنیم؛ چون تولید تصادفیِ HTML
    // چندمگابایتی همان باگ «PDF خالی ۶۰۰ بایتی» را دوباره برمی‌گرداند.
    if (opts.includeMap && opts.mapDetailLevel === 'detailed' && selectedDayIndices.length > MAX_DETAILED_DAYS) {
      setErrorMsg(t('reportMaxDetailedDaysError', { n: MAX_DETAILED_DAYS }));
      return;
    }
    if (!params.city || !params.nmDate) {
      setErrorMsg(t('reportMissingContext'));
      return;
    }

    setBuilding(true);
    try {
      setProgressText(t('reportComputingAstronomy'));
      var d0 = HijriCalendar.toLocalCalendarDay(params.nmDate, 0);
      var dayDates = [
        new Date(d0.getTime() - 24 * 3600000),
        new Date(d0.getTime()),
        new Date(d0.getTime() + 24 * 3600000),
        new Date(d0.getTime() + 2 * 24 * 3600000),
      ];

      // عنوان بزرگ گزارش: «نام ماه قمری + سال» — رفع باگ گزارش‌شده
      // (قبلاً این‌جا اشتباهاً از formatJalali(nmDate) استفاده شده
      // بود که یک تاریخ *شمسی* می‌دهد، نه نام ماه قمری). طبق کامنت
      // خودِ hijriCalendar.js، formatHijriMonthYear تنها مسیر «سالم»
      // برای نمایش ماه/سال قمری به کاربر نهایی است (بدون شماره‌ی
      // روزِ گمراه‌کننده). hMonth/hYear را HomeScreen.js پاس می‌دهد؛
      // اگر به هر دلیلی نبود (ناوبری مستقیم/قدیمی)، از
      // getNextHijriMonth(nmDate) به‌عنوان جایگزین امن استفاده می‌شود.
      var hMonth = params.hMonth;
      var hYear = params.hYear;
      if (!hMonth || !hYear) {
        var estimated = HijriCalendar.getNextHijriMonth(params.nmDate);
        hMonth = estimated.month;
        hYear = estimated.year;
      }
      var hijriMonthLabel = HijriCalendar.formatHijriMonthYear(hMonth, hYear);

      var weekDaysArr = LCtx.tArray('weekDays');
      var gregMonthsArr = LCtx.tArray('gregorianMonths');

      // مرحله ۱: داده‌ی نجومی کامل + برچسب‌های تاریخ هر روز
      // انتخابی (سریع/همزمان). دقیقاً همان منطق city-longitude-
      // anchored که در CrescentAnalysisScreen.js برای رفع باگ «روز
      // اشتباه بر اساس timezone گوشی» ساخته شد — این‌جا هم باید
      // «روز» از دیدِ شهرِ رصد باشد، نه device timezone.
      var daysData = selectedDayIndices.map(function (idx) {
        var date = dayDates[idx];
        var moonData = MoonCalculator.getFullMoonData(date, params.city.lat, params.city.lon, params.city.alt || 0, params.nmDate);

        var lonOffset = Math.max(-12 * 60, Math.min(12 * 60, params.city.lon * 4));
        var localNoon = new Date(date.getTime() - lonOffset * 60000);
        var weekDayLabel = weekDaysArr && weekDaysArr.length === 7 ? weekDaysArr[localNoon.getUTCDay()] : '';
        var gregMonthName = gregMonthsArr && gregMonthsArr.length === 12 ? gregMonthsArr[localNoon.getUTCMonth()] : '';
        var gregorianLabel = gregMonthName ? (localNoon.getUTCDate() + ' ' + gregMonthName + ' ' + localNoon.getUTCFullYear()) : HijriCalendar.formatGregorian(date);

        var jalaliLabel = '---';
        try {
          var j = HijriCalendar.toJalali(localNoon.getUTCFullYear(), localNoon.getUTCMonth() + 1, localNoon.getUTCDate());
          jalaliLabel = j.day + ' ' + HijriCalendar.persianMonths[j.month - 1] + ' ' + j.year;
        } catch (e) { jalaliLabel = '---'; }

        return {
          idx: idx,
          label: t(DAY_LABEL_KEYS[idx]),
          weekDayLabel: weekDayLabel,
          jalaliLabel: jalaliLabel,
          gregorianLabel: gregorianLabel,
          hijriMonthLabel: hijriMonthLabel,
          date: date,
          moonData: moonData,
        };
      });

      // v3.6: جوّ واقعیِ هر شب برای ردیف Schaefer در جدول مقایسه (نه نقشه)
      await Promise.all(daysData.map(function (d) {
        var when = d.moonData && (d.moonData.bestTime || d.moonData.sunSet);
        return WeatherService.resolveForSchaefer(params.city, when).then(function (res) {
          var md = res.wx ? MoonCalculator.withAtmosphere(d.moonData, params.city.lat, params.city.lon, params.city.alt || 0, res.wx) : d.moonData;
          d.moonData = Object.assign({}, md, { schaeferAtmoStatus: res.status });
        }).catch(function () {});
      }));

      // مرحله ۲: نقشه‌ها (اگر انتخاب شده)، یکی‌یکی
      if (opts.includeMap) {
        await captureAllMaps(selectedDayIndices);
      }

      // مرحله ۳: لوگو
      setProgressText(t('reportPreparingLogo'));
      var logoBase64 = await loadAppLogoBase64();

      // مرحله ۴: ساخت HTML
      setProgressText(t('reportAssemblingHtml'));
      var days = daysData.map(function (d) {
        var mapImagesBase64 = [];
        if (opts.includeMap) {
          opts.mapCriteria.forEach(function (crit) {
            var b64 = mapResultsRef.current[d.idx + '|' + crit];
            // landscape: true فقط برای حالت «دقیق‌تر» — تصویر واقعاً با
            // نسبت ابعاد افقی (landscape) گرفته شده (نگاه کنید به
            // MapScreen.js: exportRequest.landscape === true →
            // mapRotated=true → curSW/curMH افقی). reportBuilder.js از
            // این پرچم استفاده می‌کند تا نقشه‌ی افقی را به‌جای فشرده‌شدن
            // در همان قاب باریک پرتره، با عرض کامل صفحه نشان دهد.
            if (b64) mapImagesBase64.push({ crit: crit, base64: b64, landscape: opts.mapDetailLevel === 'detailed' });
          });
        }
        return {
          label: d.label,
          weekDayLabel: d.weekDayLabel,
          jalaliLabel: d.jalaliLabel,
          gregorianLabel: d.gregorianLabel,
          hijriMonthLabel: d.hijriMonthLabel,
          moonData: d.moonData,
          mapImagesBase64: mapImagesBase64,
        };
      });

      var html = ReportBuilder.buildReportHtml({
        t: t,
        isRTL: isRTL,
        appLogoBase64: logoBase64,
        city: params.city,
        hijriMonthLabel: hijriMonthLabel,
        selectedCrit: params.crit,
        options: opts,
        days: days,
      });

      // مرحله ۵: HTML → PDF
      // نکته‌ی مهم: FilePrintOptions (که printToFileAsync از آن
      // استفاده می‌کند) اصلاً پارامتری به نام orientation ندارد —
      // این پارامتر فقط روی PrintOptions (مخصوص printAsync/چاپ
      // فیزیکی) وجود دارد و آن‌هم فقط iOS (طبق مستندات رسمی expo-print:
      // https://docs.expo.dev/versions/latest/sdk/print/#fileprintoptions).
      // یعنی نسخه‌ی قبلی این کد (orientation: Print.Orientation.landscape)
      // بی‌صدا نادیده گرفته می‌شد و هیچ اثری نداشت.
      //
      // راه‌حل واقعی طبق همان جدول مستندات: FilePrintOptions دارای
      // width/height (پیکسل، پیش‌فرض ۶۱۲×۷۹۲ یعنی US Letter در ۷۲ PPI)
      // است. برای صفحه‌ی واقعاً landscape، این دو را برعکس می‌کنیم —
      // این هم روی Android هم iOS کار می‌کند، برخلاف orientation.
      setProgressText(t('reportGeneratingPdf'));
      var wantsLandscapePage = opts.includeMap && opts.mapDetailLevel === 'detailed';
      var PAGE_PORTRAIT = { width: 612, height: 792 };
      var PAGE_LANDSCAPE = { width: 792, height: 612 };
      var pageSize = wantsLandscapePage ? PAGE_LANDSCAPE : PAGE_PORTRAIT;
      var pdfResult = await Print.printToFileAsync({
        html: html,
        base64: false,
        width: pageSize.width,
        height: pageSize.height,
      });

      setProgressText(t('reportOpeningShareSheet'));
      var canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(pdfResult.uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }


      setBuilding(false);
      setProgressText('');
    } catch (err) {
      setBuilding(false);
      setProgressText('');
      setErrorMsg((err && err.message) ? err.message : String(err));
    }
  };

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={function () { navigation.goBack(); }}>
          <Text style={st.backBtnT}>{isRTL ? '▶' : '◀'}</Text>
        </TouchableOpacity>
        <Text style={st.headerT}>{'📄 ' + t('reportExportTitle')}</Text>
        <View style={st.backBtn} />
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={{ padding: theme.spacing.lg }}>

        <View style={st.disclaimerCard}>
          <Text style={[st.disclaimerT, { textAlign: textAlign }]}>{t('reportDisclaimerShort')}</Text>
        </View>

        <Design.SectionTitle isRTL={isRTL}>{t('reportSectionDays')}</Design.SectionTitle>
        <View style={st.optCard}>
          {opts.mapDetailLevel === 'detailed' && opts.includeMap ? (
            <Text style={[st.mapCritHint, { textAlign: textAlign }]}>{t('reportMaxDetailedDaysHint', { n: MAX_DETAILED_DAYS })}</Text>
          ) : null}
          {DAY_LABEL_KEYS.map(function (key, idx) {
            // در حالت «دقیق‌تر»، اگر این روز خاموش است و سقف پر شده،
            // چک‌باکس را غیرفعال/کم‌رنگ نشان بده تا کاربر قبل از تلاش
            // برای روشن‌کردنش دلیل را ببیند (به‌جای این‌که فقط بی‌اثر
            // بماند و کاربر گمان کند باگ است).
            var atCap = opts.mapDetailLevel === 'detailed' && opts.includeMap
              && !opts.days[idx] && opts.days.filter(Boolean).length >= MAX_DETAILED_DAYS;
            return (
              <OptRow
                key={key}
                label={t(key)}
                checked={opts.days[idx]}
                onPress={function () { toggleDay(idx); }}
                isRTL={isRTL}
                disabled={atCap}
              />
            );
          })}
        </View>

        <Design.SectionTitle isRTL={isRTL}>{t('reportSectionContent')}</Design.SectionTitle>
        <View style={st.optCard}>
          <OptRow label={t('reportOptFullAstronomy')} checked={opts.includeFullAstronomy} onPress={function () { toggleOpt('includeFullAstronomy'); }} isRTL={isRTL} />
          <OptRow label={t('reportOptCriteriaComparison')} checked={opts.includeCriteriaComparison} onPress={function () { toggleOpt('includeCriteriaComparison'); }} isRTL={isRTL} />
          <OptRow label={t('reportOptGuide')} checked={opts.includeGuide} onPress={function () { toggleOpt('includeGuide'); }} isRTL={isRTL} />
          <OptRow label={t('reportOptMap')} checked={opts.includeMap} onPress={function () { toggleOpt('includeMap'); }} isRTL={isRTL} />
        </View>

        {opts.includeMap ? (
          <View>
            <Design.SectionTitle isRTL={isRTL}>{t('reportSectionMapCriteria')}</Design.SectionTitle>
            <View style={st.optCard}>
              <Text style={[st.mapCritHint, { textAlign: textAlign }]}>{t('reportMapCriteriaHint')}</Text>
              {ALL_CRIT_IDS.map(function (id) {
                return (
                  <OptRow
                    key={id}
                    label={MoonCalculator.getCritLabel(id)}
                    checked={opts.mapCriteria.indexOf(id) >= 0}
                    onPress={function () { toggleMapCrit(id); }}
                    isRTL={isRTL}
                  />
                );
              })}
            </View>

            {/* درخواست کاربر: انتخاب بین نقشه‌ی سریع‌تر/کم‌جزئیات‌تر
                و نقشه‌ی دقیق‌تر/کندتر — دقیقاً همان سوییچ portrait/
                landscape خودِ MapScreen.js (نگاه کنید به کامنت‌های
                GRID_LIGHT/GRID_FULL آن‌جا). چون این دو گزینه از هم
                جدا و متضادند (نه چک‌باکس مستقل)، از یک انتخابگر
                radio-مانند استفاده شده، نه OptRow معمولی. */}
            <Design.SectionTitle isRTL={isRTL} style={{ marginTop: theme.spacing.lg }}>{t('reportSectionMapDetail')}</Design.SectionTitle>
            <View style={st.optCard}>
              <DetailLevelRow
                label={t('reportMapDetailFast')}
                hint={t('reportMapDetailFastHint')}
                selected={opts.mapDetailLevel === 'fast'}
                onPress={function () { selectDetailLevel('fast'); }}
                isRTL={isRTL}
              />
              <DetailLevelRow
                label={t('reportMapDetailDetailed')}
                hint={t('reportMapDetailDetailedHint')}
                selected={opts.mapDetailLevel === 'detailed'}
                onPress={function () { selectDetailLevel('detailed'); }}
                isRTL={isRTL}
                last
              />
            </View>
          </View>
        ) : null}

        {errorMsg ? <Text style={st.errorT}>{errorMsg}</Text> : null}

        {building ? (
          <View style={st.buildingBox}>
            <ActivityIndicator size="large" color={theme.colors.gold} />
            <Text style={st.buildingT}>{progressText}</Text>
            <Text style={st.buildingHintT}>{opts.includeMap && opts.mapDetailLevel === 'detailed' ? t('reportBuildingHintDetailed') : t('reportBuildingHint')}</Text>
          </View>
        ) : (
          <Design.Button variant="primary" onPress={handleBuildReport} style={{ marginTop: theme.spacing.lg }}>
            {'📄 ' + t('reportGenerateBtn')}
          </Design.Button>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ============================================================
          نمونه‌ی نامرئی MapScreen برای گرفتن عکس (حالت export) — طبق
          کامنت‌های بالای MapScreen.js. هیچ‌گاه در دید کاربر نیست
          (opacity:0 + pointerEvents:'none' + خارج از layout عادی با
          position:'absolute')؛ فقط زمانی رندر می‌شود که واقعاً یک
          درخواست عکس در جریان باشد، تا وقتی گزارش‌ساز غیرفعال است
          منابع/محاسبات اضافی مصرف نشود. */}
      {currentMapRequest ? (
        <View style={st.hiddenMapHost} pointerEvents="none">
          <MapScreen route={{ params: { exportRequest: currentMapRequest } }} />
        </View>
      ) : null}
    </View>
  );
}

function OptRow(props) {
  var textAlign = props.isRTL ? 'right' : 'left';
  return (
    <TouchableOpacity
      style={[st.optRow, props.disabled && st.optRowDisabled]}
      onPress={props.disabled ? null : props.onPress}
      activeOpacity={props.disabled ? 1 : 0.7}
      disabled={!!props.disabled}
    >
      <View style={[st.checkbox, props.checked && st.checkboxOn, props.disabled && st.checkboxDisabled]}>
        {props.checked ? <Text style={st.checkboxT}>✓</Text> : null}
      </View>
      <Text style={[st.optLabel, { textAlign: textAlign }, props.disabled && st.optLabelDisabled]}>{props.label}</Text>
    </TouchableOpacity>
  );
}

// DetailLevelRow — ردیف انتخابِ radio-مانند (نه چک‌باکس مستقل، چون
// «سریع» و «دقیق» دو گزینه‌ی متضاد از یک انتخابِ واحدند) با یک خط
// توضیح کوچک زیرِ برچسب، تا کاربر قبل از انتخاب بداند این تصمیم
// چه هزینه/فایده‌ای دارد (زمان بیشتر در برابر جزئیات بیشتر).
function DetailLevelRow(props) {
  var textAlign = props.isRTL ? 'right' : 'left';
  return (
    <TouchableOpacity
      style={[st.optRow, props.last && st.optRowLast]}
      onPress={props.onPress}
      activeOpacity={0.7}
    >
      <View style={[st.radioOuter, props.selected && st.radioOuterOn]}>
        {props.selected ? <View style={st.radioInner} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.optLabel, { textAlign: textAlign }]}>{props.label}</Text>
        <Text style={[st.detailHintT, { textAlign: textAlign }]}>{props.hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: theme.spacing.md, paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.bgHeader,
  },
  backBtn: { width: 36, height: 36, borderRadius: theme.radius.circle, backgroundColor: theme.colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  backBtnT: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: 'bold' },
  headerT: { color: theme.colors.gold, fontSize: theme.type.title.fontSize, fontWeight: theme.type.title.fontWeight },

  scroll: { flex: 1 },

  disclaimerCard: { backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.borderGoldSubtle, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.lg },
  disclaimerT: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, lineHeight: 19 },

  optCard: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 11, paddingHorizontal: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  optRowLast: { borderBottomWidth: 0 },
  optRowDisabled: { opacity: 0.4 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  checkboxDisabled: { borderColor: theme.colors.borderSubtle },
  checkboxT: { color: theme.colors.goldDark, fontSize: 13, fontWeight: 'bold' },
  optLabel: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, flex: 1 },
  optLabelDisabled: { color: theme.colors.textMuted },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterOn: { borderColor: theme.colors.gold },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.gold },
  detailHintT: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize, marginTop: 2 },

  mapCritHint: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize, padding: theme.spacing.md, paddingBottom: 0 },

  errorT: { color: theme.colors.danger, fontSize: theme.type.body.fontSize, marginTop: theme.spacing.md, textAlign: 'center' },

  buildingBox: { alignItems: 'center', marginTop: theme.spacing.xl, padding: theme.spacing.lg },
  buildingT: { color: theme.colors.gold, fontSize: theme.type.body.fontSize, marginTop: theme.spacing.md, textAlign: 'center' },
  buildingHintT: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize, marginTop: theme.spacing.sm, textAlign: 'center' },

  hiddenMapHost: { position: 'absolute', top: -3000, left: -3000, opacity: 0 },
});