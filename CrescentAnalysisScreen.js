import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';

var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;
var MoonCalculator = require('../calculations/moonPosition');
var Engine = require('../calculations/crescentAnalysisEngine');
var useAnimationController = require('../hooks/useAnimationController');
// نکته: مسیر این import یک فرض است — چون hijriCalendar.js کنار
// moonPosition.js (هر دو در calculations/) آپلود شد و از همان الگو
// پیروی می‌کند، این مسیر با قیاس انتخاب شده. اگر مسیر واقعی در
// پروژه فرق دارد (مثلاً utils/hijriCalendar)، بیلد بلافاصله با خطای
// «module not found» مشخص می‌کند و فقط کافی‌ست همین یک خط اصلاح شود.
var HijriCalendar = require('../calculations/hijriCalendar');

var DateLocationBar = require('../components/DateLocationBar').default;
var HeroSummary = require('../components/HeroSummary').default;
var ExploreSection = require('../components/ExploreSection').default;
var ProfessionalData = require('../components/ProfessionalData').default;
var AutoAnalysis = require('../components/AutoAnalysis').default;
var WeatherCard = require('../components/WeatherCard').default;
var WeatherService = require('../calculations/weatherService');
var SchaeferAtmoNotice = require('../components/SchaeferAtmoNotice').default;

// ============================================================
// CrescentAnalysisScreen — «Advanced Crescent Analysis» (بازطراحی UX)
//
// این صفحه همچنان یک ارکستراتور است (SECTION 10)؛ محاسبه و رسم در
// جای دیگری انجام می‌شود. آنچه در این بازطراحی عوض شده، فقط
// چیدمان/سلسله‌مراتب بصری است، نه منطق:
//
//   ۱. نوار تاریخ/شهر ثابت زیر هدر (رفع مشکل گزارش‌شده: قبلاً هیچ
//      نشانه‌ای از این‌که این تحلیل مربوط به کدام شب/مکان است وجود
//      نداشت).
//   ۲. HeroSummary: پاسخ اصلی («رؤیت ممکنه؟ کِی؟») در یک بلوک واحد
//      و فشرده، فوراً زیر نوار تاریخ — به‌جای دو بلوک جدا
//      (SummaryPanel گرید‌محور + VisibilityGauge) با فاصله‌ی زیاد.
//   ۳. ExploreSection: Sky Simulation + Timeline + Play/Pause +
//      Layers + Compare همگی در یک بخش تب‌دار واحد ادغام شدند
//      (قبلاً سه بلوک جدا با کنترل‌های پراکنده بودند).
//   ۴. ProfessionalData همیشه در دید است (نه پشت toggle) چون
//      مخاطب این صفحه رصدگر حرفه‌ای/نیمه‌حرفه‌ای است؛ خودِ آن
//      کامپوننت اکنون به گروه‌های قابل‌جمع‌شدن تقسیم شده تا با وجود
//      حجم بالای داده قابل‌اسکن بماند.
//
// ناوبری بدون تغییر: این صفحه یک تب مستقل نیست؛ از کارت نتیجه‌ی
// HomeScreen با navigation.navigate('CrescentAnalysis', {date, city,
// nmDate, crit}) باز می‌شود.
// ============================================================

var SCREEN_W = Dimensions.get('window').width;

var DEFAULT_LAYERS = { moonAltitude: true, sunAltitude: true, arcv: true, elongationTopo: false, crescentWidthArcmin: false };

// روز را به نیمه‌شب UTC همان روز گرد می‌کند — برای مقایسه‌ی صرفاً
// «کدام روز» بدون دخالت ساعت/دقیقه‌ی دقیق یا timezone دستگاه.
function startOfUTCDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export default function CrescentAnalysisScreen(props) {
  var route = props.route;
  var navigation = props.navigation;
  var params = (route && route.params) || {};

  var LCtx = useLanguage();
  var t = LCtx.t;
  var tArray = LCtx.tArray;
  var isRTL = LCtx.isRTL;
  var analysisLang = LCtx.lang;
  var textAlign = isRTL ? 'right' : 'left';

  var s1 = useState(true); var loading = s1[0]; var setLoading = s1[1];
  var s2 = useState(null); var analysis = s2[0]; var setAnalysis = s2[1];
  var s3 = useState(DEFAULT_LAYERS); var activeLayers = s3[0]; var setActiveLayers = s3[1];
  var s5 = useState(0); var skyRotation = s5[0]; var setSkyRotation = s5[1];
  var s6 = useState(null); var compareA = s6[0]; var setCompareA = s6[1];
  var s7 = useState(null); var compareB = s7[0]; var setCompareB = s7[1];
  // state محلی تاریخ — رفع باگ گزارش‌شده: قبلاً تغییر تاریخ فقط با
  // خروج کامل از این صفحه (navigation.goBack) ممکن بود. حالا date
  // این‌جا نگه داشته می‌شود و با دکمه‌های روز قبل/بعد جابه‌جا می‌شود،
  // بدون نیاز به ناوبری. مقدار اولیه از params.date می‌آید.
  var s8 = useState(params.date || new Date()); var date = s8[0]; var setDate = s8[1];
  // مقارنه‌ی این ماه قمری (Date دقیق لحظه‌ی conjunction) — لنگرِ ثابتِ
  // بازه‌ی مجاز روزها (رفع درخواست کاربر: «فقط یک روز قبل از مقارنه،
  // روز مقارنه، روز بعد، و دو روز بعد از مقارنه را می‌خواهیم، نه کل
  // ماه را»). این مقدار فقط یک‌بار (از params.nmDate اگر داده شده
  // باشد، وگرنه از اولین نتیجه‌ی buildAnalysis روی params.date) ست
  // می‌شود و دیگر با جابه‌جایی بین ۴ روز مجاز عوض نمی‌شود — چون همه‌ی
  // این ۴ روز به یک مقارنه‌ی واحد تعلق دارند.
  var s9 = useState(params.nmDate || null); var conjunctionDate = s9[0]; var setConjunctionDate = s9[1];
  // v3.5: داده‌ی جوی آنلاین (اختیاری؛ پیش‌فرض خاموش)
  var sW1 = useState(false); var wxEnabled = sW1[0]; var setWxEnabled = sW1[1];
  var sW2 = useState(null); var atmosphere = sW2[0]; var setAtmosphere = sW2[1];
  var sW3 = useState(false); var wxLoading = sW3[0]; var setWxLoading = sW3[1];
  var sW4 = useState('loading'); var wxStatus = sW4[0]; var setWxStatus = sW4[1];
  var sW6 = useState(0); var wxTick = sW6[0]; var setWxTick = sW6[1];
  var sW5 = useState(null); var wxInput = sW5[0]; var setWxInput = sW5[1];

  useEffect(function () {
    setLoading(true);
    var timer = setTimeout(function () {
      // در بار اول (وقتی هنوز conjunctionDate نداریم)، nmDate را
      // undefined می‌فرستیم تا موتور خودش با جست‌وجوی نجومی مقارنه
      // را از روی همان date پیدا کند (مسیر else در moonPosition.js).
      // در دفعات بعد (وقتی conjunctionDate از قبل مشخص شده)، همیشه
      // همان مقدار ثابت پاس داده می‌شود — چون هر ۴ روز مجاز به یک
      // مقارنه‌ی واحد تعلق دارند، نه این‌که هر روز مقارنه‌ی خودش را
      // از نو جست‌وجو کند.
      var result = Engine.buildAnalysis(date, params.city.lat, params.city.lon, params.city.alt, conjunctionDate || undefined);
      setAnalysis(result);
      setLoading(false);
      // با تغییر روز، حالت کاوش مخصوص روز قبلی (چرخش آسمان، دو نقطه‌ی
      // مقایسه‌شده) دیگر معنی ندارد — پاک می‌شود تا کاربر گیج نشود.
      setSkyRotation(0);
      setCompareA(null);
      setCompareB(null);
      // اگر هنوز لنگر مقارنه نداشتیم، از نتیجه‌ی همین محاسبه قفلش
      // می‌کنیم تا از این به بعد همه‌ی ۴ روز مجاز به همین یک مقارنه
      // ارجاع بدهند. عمداً conjunctionDate در وابستگی‌های این effect
      // نیست (فقط یک‌بار، در پایین، جدا ست می‌شود) تا این setState خودش
      // باعث یک اجرای اضافه/تکراری از همین effect با همان date نشود.
      if (!conjunctionDate && result && result.fullData && result.fullData.prevNewMoon) {
        setConjunctionDate(result.fullData.prevNewMoon);
      }
    }, 50);
    return function () { clearTimeout(timer); };
    // eslint-disable-next-line
  }, [date, params.city]);

  // بازه‌ی مجاز روزها: [مقارنه-۱, مقارنه, مقارنه+۱, مقارنه+۲] — طبق
  // درخواست صریح کاربر. تا وقتی conjunctionDate هنوز مشخص نشده
  // (اولین رندر، قبل از برگشتن اولین نتیجه)، بازه از روی همان date
  // اولیه تخمین زده می‌شود تا دکمه‌های قبل/بعد فوراً درست/غلط بودن
  // را نشان دهند؛ به‌محض رسیدن conjunctionDate واقعی، بازه با مقدار
  // دقیق جایگزین می‌شود.
  // v3.5: بازه بر مبنای «روز تقویمی محلیِ شهر» در مقارنه (هم‌تراز با HomeScreen)،
  // نه روز UTC — وگرنه برای مقارنه‌های نزدیک نیمه‌شب محلی، یک روز جابه‌جا می‌شد
  // و روز انتخاب‌شده از Home (مثلاً «دو روز بعد») بیرون از بازه می‌افتاد.
  var anchorForRange = (conjunctionDate && params.city)
    ? MoonCalculator.getLocalDayAnchor(conjunctionDate, params.city.lat, params.city.lon)
    : (conjunctionDate || date);
  var minAllowedDate = useMemo(function () {
    return startOfUTCDay(new Date(anchorForRange.getTime() - 86400000));
  }, [anchorForRange]);
  var maxAllowedDate = useMemo(function () {
    return startOfUTCDay(new Date(anchorForRange.getTime() + 2 * 86400000));
  }, [anchorForRange]);
  var canGoPrev = startOfUTCDay(date).getTime() > minAllowedDate.getTime();
  var canGoNext = startOfUTCDay(date).getTime() < maxAllowedDate.getTime();

  var points = analysis ? analysis.points : [];
  var anim = useAnimationController(points, analysis ? analysis.bestTime : null);

  // ساعت مرجع برای داده‌ی جوی: بهترین زمان رؤیت، وگرنه غروب خورشید همان شب
  var wxTime = analysis && analysis.fullData ? (analysis.fullData.bestTime || analysis.fullData.sunSet || null) : null;
  var wxTimeMs = wxTime ? wxTime.getTime() : null;
  useEffect(function () {
    var alive = true;
    if (!wxTimeMs || !params.city) { setAtmosphere(null); setWxInput(null); setWxStatus('unavailable'); return; }
    setWxLoading(true); setWxStatus('loading');
    WeatherService.resolveForSchaefer(params.city, new Date(wxTimeMs)).then(function (res) {
      if (!alive) return;
      setWxEnabled(res.status !== 'off');
      setAtmosphere(res.atmosphere);
      setWxInput(res.wx);
      setWxStatus(res.status);
      setWxLoading(false);
    }).catch(function () { if (alive) { setAtmosphere(null); setWxInput(null); setWxStatus('unavailable'); setWxLoading(false); } });
    return function () { alive = false; };
  }, [wxTimeMs, wxTick]);
  var enableWeather = function () { WeatherService.setEnabled(true).then(function () { setWxEnabled(true); setWxTick(function (n) { return n + 1; }); }); };

  // Schaefer با جوّ واقعی (اگر رسیده باشد) دوباره محاسبه می‌شود؛ بقیه‌ی معیارها دست‌نخورده
  var fullDataEff = useMemo(function () {
    if (!analysis || !analysis.fullData || !wxInput || !params.city) return analysis ? analysis.fullData : null;
    return MoonCalculator.withAtmosphere(analysis.fullData, params.city.lat, params.city.lon, params.city.alt || 0, wxInput);
  }, [analysis, wxInput, params.city]);

  var sunsetPoint = useMemo(function () {
    return analysis && analysis.sunset ? Engine.findPointNear(points, analysis.sunset) : null;
  }, [analysis, points]);
  var moonsetPoint = useMemo(function () {
    return analysis && analysis.moonset ? Engine.findPointNear(points, analysis.moonset) : null;
  }, [analysis, points]);

  var autoSummary = useMemo(function () {
    if (!analysis || analysis.meta.invalid) return null;
    return Engine.buildAutoAnalysis(analysis);
  }, [analysis]);

  var compareDiff = useMemo(function () {
    if (!compareA || !compareB) return null;
    return Engine.diffPoints(compareA, compareB);
  }, [compareA, compareB]);

  // نمایش روز هفته + تاریخ در نوار بالا — رفع مشکل گزارش‌شده.
  //
  // رفع باگ (بعد از گزارش کاربر: «چهارشنبه ۱۴ ژوئیه، ۱۵ نوشته شده»):
  // نسخه‌ی قبلی از date.getDay()/getDate()/getMonth() استفاده
  // می‌کرد که این متدها در JS همیشه با timezone محلیِ خودِ دستگاه
  // خوانده می‌شوند. اما «کدام روز تقویمی» این تحلیل مربوط به آن
  // است را خودِ موتور (moonPosition.js: getFullMoonData) نه بر
  // اساس timezone دستگاه، بلکه بر اساس طول جغرافیایی شهر رصد تعیین
  // می‌کند — دقیقاً همان چیزی که متغیر لحظه‌ی «localNoon» آن‌جا
  // می‌سازد: lonOffset = longitude*4 دقیقه (کلمپ‌شده به ±۱۲ ساعت)،
  // سپس localNoon = date - lonOffset. یعنی وقتی کاربر (روی دستگاهی
  // با timezone متفاوت از شهر رصد) به یک تاریخ نگاه می‌کند، «روز»
  // درست همانی است که از دیدِ آن شهر دیده می‌شود، نه از دیدِ
  // timezone گوشی. نسخه‌ی قبلی این عدم‌تطابق را نادیده می‌گرفت و
  // می‌توانست یک روز جلو/عقب نمایش دهد.
  //
  // راه‌حل: همان فرمول lonOffset/localNoon اینجا هم بازتولید شده،
  // و روز/ماه از localNoon (با متدهای UTC، نه local) خوانده
  // می‌شود — چون localNoon از قبل با تفریق offset، به‌گونه‌ای ساخته
  // شده که خواندنش با getUTC* دقیقاً همان روز تقویمیِ شهر رصد را
  // می‌دهد، صرف‌نظر از این‌که دستگاه در چه timezone ای است.
  var dateLabels = useMemo(function () {
    if (!date || !tArray || !params.city) return { gregorian: null, jalali: null };
    var weekDays = tArray('weekDays');
    var monthNames = tArray('gregorianMonths');
    // v3.5: date همیشه «لنگر روز تقویمی محلی» (ظهر UTC) است؛ پس مؤلفه‌های
    // UTC مستقیماً همان روز شهرند (بدون تفریق افست طول جغرافیایی).
    var localNoon = new Date(date.getTime());
    var wd = weekDays && weekDays.length === 7 ? weekDays[localNoon.getUTCDay()] : '';
    var mn = monthNames && monthNames.length === 12 ? monthNames[localNoon.getUTCMonth()] : '';
    var sep = isRTL ? '،' : ',';
    var gregorianLabel = (wd && mn) ? (wd + sep + ' ' + localNoon.getUTCDate() + ' ' + mn) : null;

    // تاریخ شمسی — درخواست کاربر. عمداً فقط برای زبان فارسی نمایش
    // داده می‌شود (HijriCalendar.persianMonths فقط فارسی دارد، و
    // تقویم جلالی اساساً مختص کاربر فارسی/افغانستانی است، نه عربی).
    // نکته‌ی حیاتی: HijriCalendar.formatJalali(date) مستقیم صدا زده
    // نمی‌شود چون داخلش از date.getFullYear()/getMonth()/getDate()
    // استفاده می‌کند — دقیقاً همان باگِ وابستگی به timezone دستگاه که
    // برای تاریخ میلادی رفع شد. به‌جایش HijriCalendar.toJalali (که
    // فقط عدد خام می‌گیرد، بدون هیچ متد وابسته به timezone) با همان
    // localNoon (سال/ماه/روزِ UTC، دقیقاً همان روزی که برچسب میلادی
    // بالا هم از آن ساخته شد) صدا زده می‌شود — تا دو تاریخ هیچ‌وقت
    // با هم یک روز اختلاف نگیرند.
    var jalaliLabelLocal = null;
    if (analysisLang === 'fa' && HijriCalendar && typeof HijriCalendar.toJalali === 'function' && HijriCalendar.persianMonths) {
      try {
        var j = HijriCalendar.toJalali(localNoon.getUTCFullYear(), localNoon.getUTCMonth() + 1, localNoon.getUTCDate());
        var jm = HijriCalendar.persianMonths[j.month - 1];
        if (jm) jalaliLabelLocal = j.day + ' ' + jm + ' ' + j.year;
      } catch (e) {
        jalaliLabelLocal = null;
      }
    }

    return { gregorian: gregorianLabel, jalali: jalaliLabelLocal };
  }, [date, tArray, isRTL, analysisLang, params.city]);
  var dateLabel = dateLabels.gregorian;
  var jalaliLabel = dateLabels.jalali;

  // جابه‌جایی ±۱ روز — درجا، بدون خروج از صفحه (رفع باگ گزارش‌شده).
  // به بازه‌ی مجاز (مقارنه-۱ تا مقارنه+۲) محدود می‌شود؛ خارج از این
  // بازه اصلاً حرکتی رخ نمی‌دهد (طبق درخواست کاربر: «فقط این ۴ روز
  // را می‌خواهیم، نه کل ماه را»).
  var shiftDay = function (deltaDays) {
    setDate(function (d) {
      var next = new Date(d.getTime() + deltaDays * 86400000);
      var nextDay = startOfUTCDay(next);
      if (nextDay.getTime() < minAllowedDate.getTime() || nextDay.getTime() > maxAllowedDate.getTime()) {
        return d; // خارج از بازه‌ی مجاز — بدون تغییر
      }
      return next;
    });
  };

  var toggleLayer = function (key) {
    var next = {};
    Object.keys(activeLayers).forEach(function (k) { next[k] = activeLayers[k]; });
    next[key] = !next[key];
    setActiveLayers(next);
  };

  var fmtTime = function (d) {
    if (!d || !params.city) return '--:--';
    return MoonCalculator.formatTime(d, params.city.lat, params.city.lon);
  };

  var markCompare = function () {
    if (!anim.cursorPoint) return;
    if (!compareA) { setCompareA(anim.cursorPoint); return; }
    if (!compareB) { setCompareB(anim.cursorPoint); return; }
    setCompareA(anim.cursorPoint); setCompareB(null);
  };

  var resetCompare = function () { setCompareA(null); setCompareB(null); };

  if (loading) {
    return (
      <View style={st.lc}>
        <Text style={{ fontSize: 50 }}>🔭</Text>
        <ActivityIndicator size="large" color={theme.colors.gold} style={{ marginTop: 20 }} />
        <Text style={st.lt}>{t('saCalculating')}</Text>
      </View>
    );
  }

  if (!analysis || analysis.meta.invalid) {
    return (
      <View style={st.container}>
        <View style={[st.headerGradient, { backgroundColor: theme.colors.bgHeader }]}>
          <View style={st.headerTopRow}>
            <TouchableOpacity style={st.floatingBack} onPress={function () { navigation.goBack(); }}>
              <Text style={st.floatingBackT}>{isRTL ? '▶' : '◀'}</Text>
            </TouchableOpacity>
            <Text style={st.titleT}>{'🔭 ' + t('saTitle')}</Text>
            <View style={st.floatingBack} />
          </View>
          <DateLocationBar
            dateLabel={dateLabel}
            jalaliLabel={jalaliLabel}
            cityName={params.city ? params.city.name : null}
            onPrevDay={function () { shiftDay(-1); }}
            onNextDay={function () { shiftDay(1); }}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPressCity={function () { navigation.goBack(); }}
            isRTL={isRTL}
          />
        </View>
        <View style={st.lc}>
          <Text style={{ fontSize: 50 }}>☀️</Text>
          <Text style={[st.lt, { textAlign: 'center', paddingHorizontal: theme.spacing.xxl + 2 }]}>{t('saInvalidLocation')}</Text>
          <Design.Button variant="primary" style={{ marginTop: theme.spacing.lg }} onPress={function () { navigation.goBack(); }}>
            {t('back')}
          </Design.Button>
        </View>
      </View>
    );
  }

  var chartWidth = SCREEN_W - theme.spacing.lg * 2 - (theme.spacing.xl - 2) * 2;

  return (
    <View style={st.container}>
      <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.headerGradient}>
        <View style={st.headerTopRow}>
          <TouchableOpacity style={st.floatingBack} onPress={function () { navigation.goBack(); }}>
            <Text style={st.floatingBackT}>{isRTL ? '▶' : '◀'}</Text>
          </TouchableOpacity>
          <Text style={st.titleT}>{'🔭 ' + t('saTitle')}</Text>
          <View style={st.floatingBack} />
        </View>
        <Text style={st.titleSub}>{t('saSubtitle')}</Text>

        {/* نوار تاریخ/شهر — رفع مشکل گزارش‌شده. تغییر تاریخ حالا
            درجا (بدون خروج از صفحه) با دکمه‌های روز قبل/بعد انجام
            می‌شود، فقط در بازه‌ی ۴روزه‌ی مجاز (مقارنه-۱ تا مقارنه+۲)؛
            فقط لمس نام شهر به HomeScreen برمی‌گردد (چون انتخابگر
            شهر این‌جا وجود ندارد). */}
        <DateLocationBar
          dateLabel={dateLabel}
          jalaliLabel={jalaliLabel}
          cityName={params.city ? params.city.name : null}
          onPrevDay={function () { shiftDay(-1); }}
          onNextDay={function () { shiftDay(1); }}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPressCity={function () { navigation.goBack(); }}
          isRTL={isRTL}
        />
        {/* راهنمای تغییر ماه/شهر/سال — درخواست کاربر: چون این صفحه
            فقط ۴ روز اطراف مقارنه‌ی همین ماه را نشان می‌دهد و شهر را
            هم نمی‌تواند مستقیماً عوض کند، باید صریحاً به کاربر گفته
            شود که برای ماه/شهر/سال دیگر باید به صفحه‌ی اصلی برگردد؛
            وگرنه از قصد بودنِ این محدودیت مطمئن نمی‌شود. */}
        <TouchableOpacity onPress={function () { navigation.goBack(); }}>
          <Text style={st.changeHintT}>{t('saChangeDateHint')}</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={st.scroll}>
        <View style={st.content}>

          {/* پاسخ اصلی: رؤیت ممکنه؟ کِی؟ */}
          <HeroSummary fullData={fullDataEff || analysis.fullData} city={params.city} crit={params.crit} cursorPoint={anim.cursorPoint} t={t} />
          {params.crit === 'schaefer' ? (
            <SchaeferAtmoNotice status={wxStatus} atmosphere={atmosphere} t={t} isRTL={isRTL} onEnable={enableWeather} />
          ) : null}

          {/* تحلیل خودکار — مستقیم زیر پاسخ اصلی، چون توضیح زبانیِ
              همان چیزی است که Hero به‌صورت بصری نشان می‌دهد */}
          {autoSummary ? (
            <Design.Card style={st.autoCard}>
              <AutoAnalysis summary={autoSummary} city={params.city} t={t} textAlign={textAlign} />
            </Design.Card>
          ) : null}

          {/* کاوش تعاملی: آسمان + نمودار زمانی + پخش + لایه‌ها + مقایسه */}
          <Design.SectionTitle isRTL={isRTL}>{t('saExplore')}</Design.SectionTitle>
          <ExploreSection
            points={points}
            sunsetPoint={sunsetPoint}
            moonsetPoint={moonsetPoint}
            sunset={analysis.sunset}
            moonset={analysis.moonset}
            bestTime={analysis.bestTime}
            twilights={analysis.twilights}
            chartWidth={chartWidth}
            isRTL={isRTL}
            t={t}
            anim={anim}
            activeLayers={activeLayers}
            onToggleLayer={toggleLayer}
            skyRotation={skyRotation}
            onRotateSky={function (delta) { setSkyRotation(function (r) { return r + delta; }); }}
            onResetRotation={function () { setSkyRotation(0); }}
            compareA={compareA}
            compareB={compareB}
            compareDiff={compareDiff}
            onMarkCompare={markCompare}
            onResetCompare={resetCompare}
            fmtTime={fmtTime}
          />

          {/* داده‌ی کامل — همیشه در دید (مخاطب حرفه‌ای)، گروه‌بندی‌شده
              و هر گروه جدا قابل جمع‌شدن (نگاه کنید به ProfessionalData.js) */}
          <Design.SectionTitle isRTL={isRTL}>{t('saProfessionalMode') + ' — ' + fmtTime(anim.cursorTime)}</Design.SectionTitle>
          <ProfessionalData point={anim.cursorPoint} fullData={fullDataEff || analysis.fullData} t={t} atmosphere={atmosphere} elevationM={params.city ? params.city.alt : 0} latitude={params.city ? params.city.lat : 0} />

          {/* v3.5: ابر، دید افقی و ذرات معلق شب رصد (اختیاری) */}
          <View style={{ height: theme.spacing.md }} />
          <WeatherCard enabled={wxEnabled} loading={wxLoading} atmosphere={atmosphere} city={params.city} lang={analysisLang} tArray={tArray} t={t} isRTL={isRTL} onEnable={enableWeather} />

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.lg },
  lc: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bgPage },
  lt: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, marginTop: theme.spacing.lg - 1 },

  headerGradient: { paddingTop: 50, paddingBottom: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  floatingBack: { width: 36, height: 36, borderRadius: theme.radius.circle, backgroundColor: theme.colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  floatingBackT: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: 'bold' },
  titleT: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight },
  titleSub: { color: theme.colors.textSecondary, fontSize: theme.type.caption.fontSize, textAlign: 'center', marginTop: 2 },
  changeHintT: { color: theme.colors.textLink, fontSize: theme.type.micro.fontSize, textAlign: 'center', marginTop: theme.spacing.sm - 2 },

  autoCard: { marginTop: theme.spacing.md },
});