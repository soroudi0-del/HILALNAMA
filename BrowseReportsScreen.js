import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';

var UserSettings = require('../data/userSettings');
var HijriCalendar = require('../calculations/hijriCalendar');
var MoonCalculator = require('../calculations/moonPosition');
var SightingReports = require('../firebase/sightingReports');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;
var ZoomableImageModal = require('./ZoomableImageModal').default;

// ============================================================
// نسخه ۳ — فاز ۳-د: صفحه‌ی مرور گزارش‌های استهلال (۴ مرحله)
//
// طبق طرح دقیق کاربر:
//   مرحله ۱: انتخاب ماه قمری — فقط ماه‌هایی که گزارش دارند
//   مرحله ۲: انتخاب کشور — فقط کشورهایی که در آن ماه گزارش دارند
//   مرحله ۳: لیست گزارش‌ها (نام، شهر، تاریخ، نتیجه، ابزار) + جست‌وجو/فیلتر
//   مرحله ۴: جزئیات کامل یک گزارش
//
// به‌جای ۴ Screen جدا (که ناوبری پشته‌ای React Navigation را پیچیده
// می‌کرد)، یک کامپوننت با state داخلی 'step' است — سبک‌تر و دکمه‌ی
// برگشت داخلی خودش را دارد، بدون نیاز به ثبت ۴ route جدید در App.js.
// ============================================================
// ============================================================
// نسخه ۴ (رفع تکرار ساعت): formatJalaliDateTime و
// formatGregorianDateTime (در hijriCalendar.js) هر دو ساعت را در
// انتهای رشته‌ی خروجی برمی‌گردانند (مثلاً «۱۵ July 2026 — ۱۶:۰۲»).
// چون در صفحه‌ی جزئیات، خط تاریخ شمسی از قبل ساعت را نشان می‌دهد،
// خط تاریخ میلادی زیرش دیگر نیازی به تکرار همان ساعت ندارد — این
// تابع فقط جداکننده‌ی « — HH:MM» انتهای رشته را (در صورت وجود) حذف
// می‌کند و بقیه‌ی رشته (خودِ تاریخ) را دست‌نخورده برمی‌گرداند.
// اگر فرمت ورودی تغییر کند و این الگو یافت نشود، رشته‌ی اصلی بدون
// تغییر برگردانده می‌شود (fail-safe).
// ============================================================
function stripTimeSuffix(dateTimeStr) {
  if (!dateTimeStr) return dateTimeStr;
  return dateTimeStr.replace(/\s*[—-]\s*\d{1,2}:\d{2}\s*$/, '');
}

export default function BrowseReportsScreen() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var isRTL = LCtx.isRTL;
  var textAlign = isRTL ? 'right' : 'left';

  // نسخه ۳ — فاز ۳-ی: نمایش روز هفته‌ی تاریخ رصد — طبق همان الگوی
  // getWeekDayLocal در HomeScreen.js (LCtx.tArray('weekDays') یک
  // آرایه‌ی ۷تایی ترجمه‌شده برمی‌گرداند، اندیس با date.getDay()).
  var resolveWeekDay = function (date) {
    if (!date) return '';
    var days = LCtx.tArray('weekDays');
    return days[date.getDay()];
  };

  var s1 = useState('years'); var step = s1[0]; var setStep = s1[1]; // 'years'|'months'|'countries'|'list'|'detail'
  var s2 = useState([]); var months = s2[0]; var setMonths = s2[1];
  var s3 = useState(true); var loadingMonths = s3[0]; var setLoadingMonths = s3[1];
  var s4 = useState(null); var selectedMonth = s4[0]; var setSelectedMonth = s4[1];
  var s5 = useState([]); var countries = s5[0]; var setCountries = s5[1];
  var s6 = useState(true); var loadingCountries = s6[0]; var setLoadingCountries = s6[1];
  var s7 = useState(null); var selectedCountry = s7[0]; var setSelectedCountry = s7[1];
  var s8 = useState([]); var reports = s8[0]; var setReports = s8[1];
  var s9 = useState(true); var loadingReports = s9[0]; var setLoadingReports = s9[1];
  var s10 = useState(null); var selectedReport = s10[0]; var setSelectedReport = s10[1];
  var s11 = useState(''); var searchQuery = s11[0]; var setSearchQuery = s11[1];
  var s12 = useState('all'); var resultFilter = s12[0]; var setResultFilter = s12[1];
  var s13 = useState(null); var zoomedPhotoUri = s13[0]; var setZoomedPhotoUri = s13[1];
  // نسخه ۳ — فاز ۳-ط: سال قمری‌ای که کاربر در مرحله‌ی اول (جدید)
  // انتخاب کرده — طبق خواسته‌ی صریح کاربر، ترتیب مرور گزارش‌ها باید
  // اول سال، بعد ماه قمری، بعد کشور باشد (نه مستقیم «ماه+سال» با هم
  // در یک مرحله، که ترتیب قبلی بود).
  var s14 = useState(null); var selectedYear = s14[0]; var setSelectedYear = s14[1];
  // نسخه ۳ — فاز ۳-ه: ref برای نگهداری تایمر دیباونس جست‌وجو (نگاه
  // کنید به applySearch) — از useRef استفاده می‌شود نه useState چون
  // تغییرش نباید باعث رندر مجدد شود.
  var searchDebounceRef = useRef(null);

  // نسخه ۳ — فاز ۳-ح: رفع باگ چندزبانگی — قبلاً از c.name (متن ثابت
  // فارسی که getCountries برمی‌گرداند) استفاده می‌شد که با تغییر
  // زبان اپ ترجمه نمی‌شد. حالا از c.nameKey با t() ترجمه می‌شود؛ چون
  // این خط داخل بدنه‌ی کامپوننت است، با هر رندر مجدد (از جمله وقتی
  // زبان عوض می‌شود) دوباره با t فعلی محاسبه می‌شود.
  var countryNameByCode = {};
  UserSettings.getCountries().forEach(function (c) { countryNameByCode[c.code] = (c.flag ? c.flag + ' ' : '') + t(c.nameKey); });

  // نسخه ۳ — فاز ۳-ح: تابع کمکی واحد برای نمایش نام شهر یک گزارش —
  // اگر r.city یکی از شهرهای از‌پیش‌تعریف‌شده باشد (یعنی
  // UserSettings.getCityKey برایش یک کلید معتبر برگرداند)، آن کلید
  // با t() به زبان جاری ترجمه می‌شود؛ در غیر این صورت (شهر سفارشی
  // که کاربر خودش دستی تایپ کرده) همان متن خام بدون تغییر نمایش
  // داده می‌شود، چون کلید ترجمه‌ای برایش وجود ندارد.
  var resolveCityName = function (cityRaw) {
    if (!cityRaw) return cityRaw;
    var key = UserSettings.getCityKey(cityRaw);
    return key ? t(key) : cityRaw;
  };

  // نسخه ۳ — فاز ۳-و: تابع کمکی واحد برای نمایش نام کشور یک گزارش —
  // اگر کشورِ گزارش «سایر» بود، به‌جای کد خام OTHER، نام دستی‌ای که
  // خودِ کاربر هنگام ثبت تایپ کرده (countryOther) نمایش داده می‌شود.
  var resolveCountryName = function (r) {
    if (r.country === SightingReports.OTHER_COUNTRY_CODE) {
      return r.countryOther || t('countryOtherOption');
    }
    return countryNameByCode[r.country] || r.country;
  };

  useEffect(function () {
    loadMonths();
    // پاک‌سازی تایمر دیباونس هنگام unmount شدن کامپوننت، تا بعد از
    // خروج کاربر از این صفحه، تلاش برای setState روی کامپوننت
    // unmount شده رخ ندهد.
    return function () {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  var loadMonths = async function () {
    setLoadingMonths(true);
    var data = await SightingReports.getAvailableMonths();
    setMonths(data);
    setLoadingMonths(false);
  };

  // نسخه ۳ — فاز ۳-ط: مرحله‌ی جدید اول — انتخاب سال قمری. months
  // (که از قبل توسط getAvailableMonths با {year, monthIndex, count}
  // جداگانه برمی‌گردد) همین‌جا در کلاینت بر اساس year گروه‌بندی
  // می‌شود؛ نیازی به تغییر sightingReports.js/ساختار Firestore نبود.
  var openYear = function (year) {
    setSelectedYear(year);
    setStep('months');
  };

  var openMonth = async function (month) {
    setSelectedMonth(month);
    setStep('countries');
    setLoadingCountries(true);
    var data = await SightingReports.getAvailableCountriesForMonth(month.hijriMonthKey);
    setCountries(data);
    setLoadingCountries(false);
  };

  var openCountry = async function (country) {
    setSelectedCountry(country);
    setStep('list');
    setSearchQuery('');
    setResultFilter('all');
    await reloadReportsList(selectedMonth.hijriMonthKey, country.countryCode, '', 'all');
  };

  var reloadReportsList = async function (hijriMonthKey, countryCode, nameQuery, filter) {
    setLoadingReports(true);
    var data = await SightingReports.searchReports({
      hijriMonthKey: hijriMonthKey,
      country: countryCode,
      nameQuery: nameQuery,
      resultFilter: filter === 'all' ? null : filter,
    });
    setReports(data);
    setLoadingReports(false);
  };

  // نسخه ۳ — فاز ۳-ه: رفع نبود دیباونس در جست‌وجو. قبلاً هر keystroke
  // بلافاصله یک کوئری کامل به Firestore می‌فرستاد (بدون تأخیر) — هم
  // برای UX ضعیف بود (چشمک‌زدن مکرر لیست حین تایپ) و هم برای مصرف
  // داده‌ی شبکه، که با توجه به شرایط اتصال کاربران ایرانی (مستند در
  // کامنت‌های firebaseConfig.js) اهمیت ویژه دارد. حالا کوئری واقعی
  // فقط ۴۰۰ میلی‌ثانیه بعد از آخرین حرف تایپ‌شده ارسال می‌شود؛
  // ورودی خودِ TextInput (searchQuery) بلافاصله آپدیت می‌شود تا کاربر
  // حس تأخیر در تایپ نکند.
  var applySearch = function (text) {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(function () {
      reloadReportsList(selectedMonth.hijriMonthKey, selectedCountry.countryCode, text, resultFilter);
    }, 400);
  };

  var applyFilter = function (filter) {
    setResultFilter(filter);
    reloadReportsList(selectedMonth.hijriMonthKey, selectedCountry.countryCode, searchQuery, filter);
  };

  var openDetail = function (report) {
    setSelectedReport(report);
    setStep('detail');
  };

  var resultIcon = function (result) {
    if (result === SightingReports.SIGHTING_RESULTS.SEEN_NAKED_EYE) return '👁';
    if (result === SightingReports.SIGHTING_RESULTS.SEEN_OPTICAL) return '🔭';
    if (result === SightingReports.SIGHTING_RESULTS.NOT_SEEN) return '🚫';
    return '⏸';
  };

  var filterOptions = [
    { id: 'all', label: t('filterAll') },
    { id: 'seen_only', label: t('filterSeenOnly') },
    { id: 'not_seen_only', label: t('filterNotSeenOnly') },
    { id: 'naked_eye_only', label: t('filterNakedEyeOnly') },
    { id: 'equipment_only', label: t('filterEquipmentOnly') },
  ];

  // ==============================================================
  // مرحله ۰ (جدید): انتخاب سال قمری
  //
  // نسخه ۳ — فاز ۳-ط: طبق خواسته‌ی صریح کاربر، ترتیب مرور باید
  // «اول سال، بعد ماه قمری، بعد کشور» باشد. years همین‌جا از روی
  // آرایه‌ی تخت months (که getAvailableMonths برمی‌گرداند) با جمع‌
  // زدن count هر سال ساخته می‌شود.
  // ==============================================================
  var years = (function () {
    var byYear = {};
    months.forEach(function (m) {
      if (!byYear[m.year]) byYear[m.year] = { year: m.year, count: 0 };
      byYear[m.year].count += m.count;
    });
    return Object.keys(byYear).map(function (y) { return byYear[y]; }).sort(function (a, b) { return b.year - a.year; });
  })();

  var renderYears = function () {
    return (
      <View style={st.content}>
        {loadingMonths ? (
          <View style={st.loadingBox}><ActivityIndicator size="large" color={theme.colors.gold} /></View>
        ) : years.length === 0 ? (
          <View style={st.emptyBox}><Text style={st.emptyBoxT}>{t('noMonthsAvailable')}</Text></View>
        ) : (
          years.map(function (y) {
            return (
              <TouchableOpacity key={y.year} style={st.listCard} onPress={function () { openYear(y.year); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.listCardTitle, { textAlign: textAlign }]}>{y.year}</Text>
                  <Text style={[st.listCardSub, { textAlign: textAlign }]}>{y.count + ' ' + t('reportsCount')}</Text>
                </View>
                <Text style={st.listCardArrow}>{isRTL ? '◀' : '▶'}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // مرحله ۱: انتخاب ماه قمری (فقط ماه‌های سالِ انتخاب‌شده در مرحله‌ی قبل)
  // ==============================================================
  var renderMonths = function () {
    var monthsInYear = months.filter(function (m) { return m.year === selectedYear; });
    return (
      <View style={st.content}>
        <TouchableOpacity style={st.backLink} onPress={function () { setStep('years'); }}>
          <Text style={st.backLinkT}>{(isRTL ? '▶ ' : '◀ ') + t('backToYears')}</Text>
        </TouchableOpacity>
        {loadingMonths ? (
          <View style={st.loadingBox}><ActivityIndicator size="large" color={theme.colors.gold} /></View>
        ) : monthsInYear.length === 0 ? (
          <View style={st.emptyBox}><Text style={st.emptyBoxT}>{t('noMonthsAvailable')}</Text></View>
        ) : (
          monthsInYear.map(function (m) {
            var monthName = HijriCalendar.hijriMonths[(m.monthIndex - 1 + 12) % 12];
            return (
              <TouchableOpacity key={m.hijriMonthKey} style={st.listCard} onPress={function () { openMonth(m); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.listCardTitle, { textAlign: textAlign }]}>{monthName}</Text>
                  <Text style={[st.listCardSub, { textAlign: textAlign }]}>{m.count + ' ' + t('reportsCount')}</Text>
                </View>
                <Text style={st.listCardArrow}>{isRTL ? '◀' : '▶'}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // مرحله ۲: انتخاب کشور
  // ==============================================================
  var renderCountries = function () {
    return (
      <View style={st.content}>
        <TouchableOpacity style={st.backLink} onPress={function () { setStep('months'); }}>
          <Text style={st.backLinkT}>{(isRTL ? '▶ ' : '◀ ') + t('backToMonths')}</Text>
        </TouchableOpacity>
        {loadingCountries ? (
          <View style={st.loadingBox}><ActivityIndicator size="large" color={theme.colors.gold} /></View>
        ) : (
          countries.map(function (c) {
            return (
              <TouchableOpacity key={c.countryCode} style={st.listCard} onPress={function () { openCountry(c); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.listCardTitle, { textAlign: textAlign }]}>
                    {c.countryCode === SightingReports.OTHER_COUNTRY_CODE ? t('countryOtherOption') : (countryNameByCode[c.countryCode] || c.countryCode)}
                  </Text>
                  <Text style={[st.listCardSub, { textAlign: textAlign }]}>{c.count + ' ' + t('reportsCount')}</Text>
                </View>
                <Text style={st.listCardArrow}>{isRTL ? '◀' : '▶'}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // مرحله ۳: لیست گزارش‌ها با جست‌وجو/فیلتر
  // ==============================================================
  var renderList = function () {
    return (
      <View style={st.content}>
        <TouchableOpacity style={st.backLink} onPress={function () { setStep('countries'); }}>
          <Text style={st.backLinkT}>{(isRTL ? '▶ ' : '◀ ') + t('backToCountries')}</Text>
        </TouchableOpacity>

        <TextInput
          style={[st.searchInput, { textAlign: textAlign }]}
          placeholder={t('searchByNameCityLabel')}
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={applySearch}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow}>
          {filterOptions.map(function (f) {
            var isSel = resultFilter === f.id;
            return (
              <TouchableOpacity key={f.id} style={[st.filterChip, isSel && st.filterChipActive]} onPress={function () { applyFilter(f.id); }}>
                <Text style={[st.filterChipT, isSel && st.filterChipTActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loadingReports ? (
          <View style={st.loadingBox}><ActivityIndicator size="large" color={theme.colors.gold} /></View>
        ) : reports.length === 0 ? (
          <View style={st.emptyBox}><Text style={st.emptyBoxT}>{t('noReportsYet')}</Text></View>
        ) : (
          reports.map(function (r) {
            var catColor = theme.getCatColor(r.sightingResult === SightingReports.SIGHTING_RESULTS.SEEN_NAKED_EYE ? 'A' : r.sightingResult === SightingReports.SIGHTING_RESULTS.NOT_SEEN ? 'F' : 'C');
            var sd = r.sightingDateISO ? new Date(r.sightingDateISO) : null;
            return (
              <TouchableOpacity key={r.id} style={st.reportListItem} onPress={function () { openDetail(r); }} activeOpacity={0.75}>
                {/* نسخه ۳ — فاز ۳-ی: بهبود UI/UX — به‌جای یک نقطه‌ی
                    رنگی کوچک (که فقط با رنگ، بدون متن/آیکون، وضعیت
                    رصد را نشان می‌داد)، یک نشان دایره‌ای بزرگ‌تر با
                    خودِ ایموجی نتیجه‌ی رصد داخلش — هم واضح‌تر است، هم
                    نیازی به حدس‌زدن معنی رنگ نیست. */}
                <View style={[st.reportListBadge, { borderColor: catColor }]}>
                  <Text style={st.reportListBadgeT}>{resultIcon(r.sightingResult)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {/* نسخه ۳ — فاز ۳-ی: نام کاربر به‌عنوان مهم‌ترین
                      شناسه‌ی هر کارت، حالا در بالاترین ردیف و با
                      وزن بصری بیشتر (به‌جای اینکه در ردیف سوم و
                      کم‌رنگ باشد) — تسریع مرور چشمی لیست. */}
                  {/* نسخه ۴ — بج «رصدگر ماهر و باتجربه»: فقط اگر
                      admin از سمت سرور این بج را به کاربر داده باشد
                      نمایش داده می‌شود (r.reporterBadge از
                      sighting_reports_with_badge View می‌آید). */}
                  <View style={[st.reportListNameRow, isRTL && st.reportListMetaRowRTL]}>
                    <Text style={[st.reportListName, { textAlign: textAlign }]} numberOfLines={1}>{r.fullName}</Text>
                    {r.reporterBadge === 'expert_observer' ? (
                      <View style={st.expertBadge}>
                        <Text style={st.expertBadgeT}>{'🎖️ ' + t('badgeExpertObserver')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[st.reportListResult, { textAlign: textAlign }]}>{t(SightingReports.getSightingResultLabelKey(r.sightingResult))}</Text>
                  <View style={[st.reportListMetaRow, isRTL && st.reportListMetaRowRTL]}>
                    <Text style={st.reportListMetaIcon}>{'📍'}</Text>
                    <Text style={[st.reportListMeta, { textAlign: textAlign }]} numberOfLines={1}>{resolveCityName(r.city)}</Text>
                  </View>
                  {sd ? (
                    <View style={[st.reportListMetaRow, isRTL && st.reportListMetaRowRTL]}>
                      <Text style={st.reportListMetaIcon}>{'🕐'}</Text>
                      <Text style={[st.reportListMeta, { textAlign: textAlign }]}>
                        {resolveWeekDay(sd) + ' ' + HijriCalendar.formatTime(sd)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={st.listCardArrow}>{isRTL ? '◀' : '▶'}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // مرحله ۴: جزئیات کامل گزارش
  // ==============================================================
  var renderDetail = function () {
    var r = selectedReport;
    if (!r) return null;
    var snap = r.astronomicalSnapshot;
    var sd = r.sightingDateISO ? new Date(r.sightingDateISO) : null;
    var catColor = theme.getCatColor(r.sightingResult === SightingReports.SIGHTING_RESULTS.SEEN_NAKED_EYE ? 'A' : r.sightingResult === SightingReports.SIGHTING_RESULTS.NOT_SEEN ? 'F' : 'C');
    return (
      <View style={st.content}>
        <TouchableOpacity style={st.backLink} onPress={function () { setStep('list'); }}>
          <Text style={st.backLinkT}>{(isRTL ? '▶ ' : '◀ ') + t('reportDetails')}</Text>
        </TouchableOpacity>

        {/* نسخه ۳ — فاز ۳-ی: بهبود UI/UX — نتیجه‌ی رصد به‌عنوان
            مهم‌ترین اطلاعات، حالا در یک نوار برجسته و رنگی بالای
            کارت (نه فقط یک ردیف معمولی در میان بقیه‌ی داده‌ها)،
            هم‌راستا با همان رنگ‌بندی دسته (Yallop-style) که در
            بقیه‌ی اپ استفاده می‌شود. */}
        <View style={[st.resultBanner, { borderColor: catColor, backgroundColor: catColor + '22' }]}>
          <Text style={st.resultBannerIcon}>{resultIcon(r.sightingResult)}</Text>
          <Text style={[st.resultBannerT, { color: catColor }]}>{t(SightingReports.getSightingResultLabelKey(r.sightingResult))}</Text>
        </View>

        <Design.Card>
          <View style={[st.reportListNameRow, isRTL && st.reportListMetaRowRTL]}>
            <Text style={[st.detailName, { textAlign: textAlign }]}>{r.fullName}</Text>
            {r.reporterBadge === 'expert_observer' ? (
              <View style={st.expertBadge}>
                <Text style={st.expertBadgeT}>{'🎖️ ' + t('badgeExpertObserver')}</Text>
              </View>
            ) : null}
          </View>
          <View style={[st.detailMetaRow, isRTL && st.reportListMetaRowRTL]}>
            <Text style={st.reportListMetaIcon}>{'📍'}</Text>
            <Text style={[st.detailMeta, { textAlign: textAlign }]}>{resolveCityName(r.city) + (r.province ? ' — ' + r.province : '') + ' — ' + resolveCountryName(r)}</Text>
          </View>
          {sd ? (
            <React.Fragment>
              {/* نسخه ۳ — فاز ۳-ی: روز هفته اضافه شد و با تاریخ شمسی
                  یکپارچه شد (مثلاً «سه‌شنبه، ۲۴ تیر ۱۴۰۵ — ۲۰:۱۵»)
                  به‌جای یک ردیف جدا و بی‌ربط. */}
              <View style={[st.detailMetaRow, isRTL && st.reportListMetaRowRTL]}>
                <Text style={st.reportListMetaIcon}>{'🕐'}</Text>
                <Text style={[st.detailMeta, { textAlign: textAlign }]}>
                  {resolveWeekDay(sd) + '، ' + HijriCalendar.formatJalaliDateTime(sd)}
                </Text>
              </View>
              {/* نسخه ۴ (رفع تکرار ساعت): formatGregorianDateTime هم
                  ساعت را برمی‌گرداند، در حالی که همان ساعت دقیقاً
                  یک خط بالاتر (کنار تاریخ شمسی) هم نمایش داده شده —
                  برای جلوگیری از تکرار بی‌فایده‌ی «— ۱۶:۰۲» در هر دو
                  خط، اینجا فقط بخش تاریخ (قبل از جداکننده‌ی ساعت)
                  نگه داشته می‌شود. */}
              <View style={[st.detailMetaRow, isRTL && st.reportListMetaRowRTL]}>
                <Text style={st.reportListMetaIcon}>{'📅'}</Text>
                <Text style={[st.detailMeta, { textAlign: textAlign }]}>{stripTimeSuffix(HijriCalendar.formatGregorianDateTime(sd))}</Text>
              </View>
            </React.Fragment>
          ) : null}
          {r.editedAt ? <Text style={st.editedBadge}>{t('editedLabel')}</Text> : null}
        </Design.Card>

        <Design.Card>
          {r.noAttemptReason ? <Design.DataRow label={t('noAttemptReasonTitle')} value={t(SightingReports.getNoAttemptReasonLabelKey(r.noAttemptReason))} isRTL={isRTL} /> : null}
          <Design.DataRow label={t('equipmentTitle')} value={t(SightingReports.getEquipmentLabelKey(r.equipment))} isRTL={isRTL} />
          {r.weather ? <Design.DataRow label={t('weatherTitle')} value={t(SightingReports.getWeatherLabelKey(r.weather))} isRTL={isRTL} /> : null}
          {r.horizonQuality ? <Design.DataRow label={t('horizonQualityTitle')} value={t(SightingReports.getHorizonQualityLabelKey(r.horizonQuality))} isRTL={isRTL} /> : null}
          {r.cloudPercent !== null && r.cloudPercent !== undefined ? <Design.DataRow label={t('cloudPercentTitle')} value={r.cloudPercent + '%'} isRTL={isRTL} /> : null}
        </Design.Card>

        {r.notes ? (
          <Design.Card>
            <Design.SectionTitle isRTL={isRTL}>{t('notesTitle')}</Design.SectionTitle>
            <Text style={[st.notesText, { textAlign: textAlign }]}>{r.notes}</Text>
          </Design.Card>
        ) : null}

        {r.photoBase64 ? (
          <TouchableOpacity activeOpacity={0.85} onPress={function () { setZoomedPhotoUri(r.photoBase64); }}>
            <Image source={{ uri: r.photoBase64 }} style={st.detailPhoto} />
          </TouchableOpacity>
        ) : r.photoArchived ? (
          <Text style={st.archivedNote}>{'📦 ' + t('photoArchivedNote')}</Text>
        ) : null}

        {snap ? (
          <Design.Card variant="deep">
            <Design.SectionTitle isRTL={isRTL}>{t('astronomicalDataTitle')}</Design.SectionTitle>
            <Design.DataRow label={t('moonAltitude')} value={MoonCalculator.formatDegree(snap.moonAltitude)} isRTL={isRTL} />
            <Design.DataRow label="ARCV" value={snap.arcv !== null ? snap.arcv.toFixed(2) + '°' : '---'} isRTL={isRTL} />
            <Design.DataRow label="ARCL" value={snap.arcl !== null ? snap.arcl.toFixed(2) + '°' : '---'} isRTL={isRTL} />
            <Design.DataRow label={t('lagTimeLabel')} value={MoonCalculator.formatDuration(snap.lagTime)} isRTL={isRTL} />
            <Design.DataRow label="Yallop" value={snap.yallopCat || '---'} valueColor={theme.getCatColor(snap.yallopCat, 'yallop')} isRTL={isRTL} />
            <Design.DataRow label="Odeh" value={snap.odehCat || '---'} valueColor={theme.getCatColor(snap.odehCat, 'odeh')} isRTL={isRTL} />
            <Design.DataRow label="MABIMS" value={snap.malaysiaCat || '---'} valueColor={theme.getCatColor(snap.malaysiaCat, 'malaysia')} isRTL={isRTL} />
            {snap.schaeferCat ? (
              <Design.DataRow label="Schaefer" value={snap.schaeferCat + (typeof snap.schaeferR === 'number' ? '  (R = ' + snap.schaeferR.toFixed(2) + ')' : '')} valueColor={theme.getCatColor(snap.schaeferCat, 'schaefer')} isRTL={isRTL} />
            ) : null}
          </Design.Card>
        ) : null}

        {r.suspicionLevel === 'high' ? (
          <Text style={st.suspicionHigh}>{'⚠️ ' + t('suspicionHighWarning')}</Text>
        ) : r.suspicionLevel === 'low' ? (
          <Text style={st.suspicionLow}>{'ⓘ ' + t('suspicionLowNote')}</Text>
        ) : null}
        {r.suspicionLevel !== 'none' && r.astronomicalSnapshot && r.astronomicalSnapshot.suspicionCode
          && t('suspicion_' + r.astronomicalSnapshot.suspicionCode) !== 'suspicion_' + r.astronomicalSnapshot.suspicionCode ? (
          <Text style={st.suspicionLow}>{t('suspicion_' + r.astronomicalSnapshot.suspicionCode)}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <React.Fragment>
      <ScrollView style={st.container}>
        <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.headerGradient}>
          <Text style={st.titleLabel}>{'🌙'}</Text>
          <Text style={st.titleT}>{t('browseReports')}</Text>
        </LinearGradient>

        {step === 'years' ? renderYears() : null}
        {step === 'months' ? renderMonths() : null}
        {step === 'countries' ? renderCountries() : null}
        {step === 'list' ? renderList() : null}
        {step === 'detail' ? renderDetail() : null}

        <View style={{ height: 30 }} />
      </ScrollView>

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

  backLink: { marginBottom: theme.spacing.md },
  backLinkT: { color: theme.colors.textLink, fontSize: 13, fontWeight: '600' },

  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyBoxT: { color: theme.colors.textMuted, fontSize: 13 },

  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, padding: 16, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  listCardTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: 'bold' },
  listCardSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  listCardArrow: { color: theme.colors.textMuted, fontSize: 14 },

  searchInput: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.sm + 2, padding: 12, color: theme.colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm },
  filterRow: { marginBottom: theme.spacing.md },
  filterChip: { backgroundColor: theme.colors.bgCard, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill - 4, marginRight: 6, borderWidth: 1, borderColor: theme.colors.border },
  filterChipActive: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  filterChipT: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTActive: { color: theme.colors.goldDark },

  reportListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, padding: 14, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  // نسخه ۳ — فاز ۳-ی: نشان دایره‌ای بزرگ‌تر با ایموجی نتیجه‌ی رصد
  // به‌جای نقطه‌ی رنگی صرف — واضح‌تر و بدون نیاز به حدس‌زدن رنگ.
  reportListBadge: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bgPage },
  reportListBadgeT: { fontSize: 20 },
  reportListName: { color: theme.colors.gold, fontSize: 14, fontWeight: 'bold' },
  // نسخه ۴ — ردیف نام+بج: با flexWrap تا در نام‌های بلند، بج به خط
  // بعد برود نه اینکه فشرده/بریده شود.
  reportListNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  expertBadge: { backgroundColor: theme.colors.goldDark, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: theme.colors.borderGoldSubtle },
  expertBadgeT: { color: theme.colors.gold, fontSize: 10, fontWeight: '700' },
  reportListResult: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  reportListMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  reportListMetaRowRTL: { flexDirection: 'row-reverse' },
  reportListMetaIcon: { fontSize: 11 },
  reportListMeta: { color: theme.colors.textMuted, fontSize: 11, flexShrink: 1 },

  // نسخه ۳ — فاز ۳-ی: بنر برجسته‌ی نتیجه‌ی رصد در بالای صفحه‌ی
  // جزئیات — رنگ پس‌زمینه با شفافیت کم (کد رنگ + '22') از همان
  // catColor مشترک با بقیه‌ی اپ می‌آید.
  resultBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: theme.radius.md, paddingVertical: 12, marginBottom: theme.spacing.md, gap: 8 },
  resultBannerIcon: { fontSize: 22 },
  resultBannerT: { fontSize: 15, fontWeight: 'bold' },

  detailName: { color: theme.colors.gold, fontSize: 17, fontWeight: 'bold' },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  detailMeta: { color: theme.colors.textSecondary, fontSize: 12, flexShrink: 1 },
  editedBadge: { color: theme.colors.warning, fontSize: 10, marginTop: 6, fontStyle: 'italic' },
  notesText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 21 },
  detailPhoto: { width: '100%', height: 220, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
  archivedNote: { color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginBottom: theme.spacing.md },
  suspicionHigh: { color: theme.colors.danger, fontSize: 12, lineHeight: 18, marginBottom: theme.spacing.md },
  suspicionLow: { color: theme.colors.warning, fontSize: 12, lineHeight: 18, marginBottom: theme.spacing.md },
});