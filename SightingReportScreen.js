import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import SightingReportFormScreen from './SightingReportFormScreen';
import BrowseReportsScreen from './BrowseReportsScreen';
import ReportsMapScreen from './ReportsMapScreen';

var HijriCalendar = require('../calculations/hijriCalendar');
var DateUtils = require('../data/dateUtils');
var SightingReports = require('../firebase/sightingReports');
var AuthService = require('../firebase/authService');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ============================================================
// نسخه ۳ — فاز ۳-د: هاب تب «استهلال»
//
// چون فضای تب پایین محدود است (۵ تب ثابت طراحی اصلی)، این کامپوننت
// جایگزین تب SightingReport شده و خودش بین دو حالت سوییچ می‌کند:
//   - 'hub': صفحه‌ی انتخاب (دو دکمه‌ی بزرگ)
//   - 'form': فرم ثبت/ویرایش گزارش
//   - 'browse': صفحه‌ی مرور گزارش‌های دیگران
//
// همچنین پیش از رسیدن به فرم، بررسی می‌کند که آیا کاربر برای ماه
// قمری جاری از قبل گزارشی ثبت کرده — اگر بله، فرم را در «حالت
// ویرایش» با داده‌ی موجود پر می‌کند (طبق منطق rate limit یک گزارش
// در ماه)، نه این‌که کاربر را رد کند.
// ============================================================
export default function SightingReportHub() {
  var LCtx = useLanguage();
  var t = LCtx.t;
  var isRTL = LCtx.isRTL;

  var s1 = useState('hub'); var mode = s1[0]; var setMode = s1[1]; // 'hub'|'form'|'browse'
  var s2 = useState(null); var existingReport = s2[0]; var setExistingReport = s2[1];
  var sL = useState([]); var myReports = sL[0]; var setMyReports = sL[1];
  var s3 = useState(false); var checkingExisting = s3[0]; var setCheckingExisting = s3[1];
  var s4 = useState(false); var connectionOk = s4[0]; var setConnectionOk = s4[1];
  var s5 = useState(true); var checkingConnection = s5[0]; var setCheckingConnection = s5[1];

  // نسخه ۳ — فاز ۳-د (رفع باگ): وقتی کاربر تب «استهلال» را ترک
  // می‌کند (مثلاً به تب نقشه می‌رود)، React Navigation به‌طور
  // پیش‌فرض این کامپوننت را unmount نمی‌کند — فقط پنهانش می‌کند.
  // نتیجه: state داخلی mode ('form' یا 'browse') دست‌نخورده باقی
  // می‌مانَد، و وقتی کاربر دوباره به تب استهلال برمی‌گردد، به‌جای
  // صفحه‌ی انتخاب (hub)، مستقیم همان فرم/مرور قبلی را می‌بیند —
  // انگار هرگز از آن خارج نشده. راه‌حل: useFocusEffect تابع
  // cleanup خودش را دقیقاً وقتی صدا می‌زند که این تب focus را از
  // دست می‌دهد (blur) — یعنی همان لحظه‌ای که کاربر به تب دیگری
  // می‌رود. آنجا mode را به 'hub' برمی‌گردانیم، تا هر بار کاربر به
  // این تب برمی‌گردد از صفحه‌ی انتخاب شروع شود؛ عمداً *blur* را
  // مبنا گرفتیم (نه *focus*)، چون اگر روی focus ریست می‌کردیم،
  // خودِ اولین بار وارد شدن به فرم هم بلافاصله ریست می‌شد.
  useFocusEffect(
    React.useCallback(function () {
      return function () {
        setMode('hub');
        setExistingReport(null);
        setMyReports([]);
      };
    }, [])
  );

  useEffect(function () {
    // نسخه ۴ (مهاجرت به Supabase): گرم‌کردن زودهنگام Supabase
    // Anonymous Auth. اینجا (نه در App.js) صدا زده می‌شود چون auth
    // فقط برای همین هاب استهلال کاربرد دارد — بقیه‌ی تب‌های اپ
    // (Home/Map/Guide/Settings) هیچ نیازی به این سرویس ندارند و
    // نباید بدون دلیل این درخواست شبکه را متحمل شوند. عمداً بدون
    // await: نتیجه‌اش لازم نیست، sightingReports.js پیش از هر
    // عملیات واقعی (ثبت/ویرایش/حذف/بررسی) دوباره ensureSignedIn را
    // صدا می‌زند و چون idempotent است (اگر از قبل signed-in باشد
    // فوراً resolve می‌شود)، این فقط یک warm-up است تا وقتی کاربر
    // روی «ثبت گزارش» می‌زند، منتظر round-trip اول نماند.
    AuthService.ensureSignedIn();

    // نسخه ۴: چون دیگر به Firebase وصل نیستیم (که برای کاربران
    // ایرانی نیاز به VPN داشت)، این چک صرفاً یک تست عمومی اتصال به
    // سرور Supabase است — نه یک هشدار VPN. اگر ناموفق بود، احتمالاً
    // مشکل از اینترنت کاربر است، نه فیلترینگ.
    var check = async function () {
      setCheckingConnection(true);
      var result = await SightingReports.checkFirestoreConnection();
      setConnectionOk(result.connected);
      setCheckingConnection(false);
    };
    check();
  }, []);

  var openSubmitFlow = async function () {
    setCheckingExisting(true);
    var now = new Date();
    var conjunction = HijriCalendar.getPrevNewMoon(now);
    // رفع همان باگ estimateHijri (نگاه کنید به sightingReports.js):
    // باید دقیقاً همان تابعی که هنگام ذخیره‌ی گزارش برای ساخت
    // hijriMonthKey استفاده می‌شود اینجا هم برای *جست‌وجوی* گزارش
    // موجود به‌کار رود، وگرنه حتی با کلید درستِ ذخیره‌شده، این‌جا
    // ممکن است دنبال کلید نادرست دیگری بگردد و گزارش موجود کاربر
    // پیدا نشود.
    var hEst = HijriCalendar.getNextHijriMonth(conjunction);
    var hijriMonthKey = hEst.year + '-' + hEst.month;

    // v3.5: تا ۳ گزارش در ماه. اگر هنوز گزارشی نیست مستقیم فرم جدید؛
    // وگرنه فهرست گزارش‌های من (ویرایش یا ثبت گزارش جدید).
    var list = await SightingReports.getMyReportsForMonth(hijriMonthKey);
    setMyReports(list);
    setExistingReport(null);
    setCheckingExisting(false);
    setMode(list.length === 0 ? 'form' : 'list');
  };

  var retryConnection = async function () {
    setCheckingConnection(true);
    var result = await SightingReports.checkFirestoreConnection();
    setConnectionOk(result.connected);
    setCheckingConnection(false);
  };

  var handleFormDone = function () {
    setExistingReport(null);
    setMyReports([]);
    setMode('hub');
  };

  if (mode === 'form') {
    return <SightingReportFormScreen editingReport={existingReport} onDone={handleFormDone} />;
  }
  if (mode === 'list') {
    var maxReports = SightingReports.MAX_REPORTS_PER_MONTH;
    var canAddMore = myReports.length < maxReports;
    return (
      <View style={st.container}>
        <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.headerGradient}>
          <Text style={st.titleLabel}>{'📝'}</Text>
          <Text style={st.titleT}>{t('myReportsThisMonth')}</Text>
          <Text style={st.counterT}>{t('reportCounter', { n: String(myReports.length), max: String(maxReports) })}</Text>
        </LinearGradient>
        <ScrollView contentContainerStyle={st.content}>
          {myReports.map(function (r, idx) {
            var d = r.sightingDateISO ? new Date(r.sightingDateISO) : null;
            var when = d
              ? DateUtils.formatCivilDate(d, LCtx.lang, r.latitude, r.longitude, LCtx.tArray('gregorianMonths')) + '  ' + DateUtils.formatTimeHM(d, r.latitude, r.longitude)
              : '';
            return (
              <TouchableOpacity
                key={r.id}
                style={st.hubCard}
                accessibilityRole="button"
                accessibilityLabel={t('editThisReport') + ' ' + (idx + 1)}
                onPress={function () { setExistingReport(r); setMode('form'); }}
              >
                <Text style={st.hubCardTitle}>{t('reportNumber', { n: String(idx + 1) }) + ' — ' + t(SightingReports.getSightingResultLabelKey(r.sightingResult))}</Text>
                <Text style={st.hubCardSub}>{when + (r.city ? '  •  ' + r.city : '')}</Text>
                <Text style={st.editHintT}>{t('editThisReport')}</Text>
              </TouchableOpacity>
            );
          })}
          {canAddMore ? (
            <TouchableOpacity
              style={[st.hubCard, st.hubCardPrimary]}
              accessibilityRole="button"
              accessibilityLabel={t('newReportBtn')}
              onPress={function () { setExistingReport(null); setMode('form'); }}
            >
              <Text style={st.hubCardIcon}>{'➕'}</Text>
              <Text style={st.hubCardTitle}>{t('newReportBtn')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={st.limitBox}><Text style={st.limitBoxT}>{t('rateLimitMsg', { max: String(maxReports) })}</Text></View>
          )}
          <TouchableOpacity style={st.backLink} onPress={function () { setMode('hub'); }} accessibilityRole="button">
            <Text style={st.backLinkT}>{t('back')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
  if (mode === 'map') {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={st.floatingBack} onPress={function () { setMode('hub'); }} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Text style={st.floatingBackT}>{isRTL ? '▶' : '◀'}</Text>
        </TouchableOpacity>
        <ReportsMapScreen />
      </View>
    );
  }
  if (mode === 'browse') {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={st.floatingBack} onPress={function () { setMode('hub'); }}>
          <Text style={st.floatingBackT}>{isRTL ? '▶' : '◀'}</Text>
        </TouchableOpacity>
        <BrowseReportsScreen />
      </View>
    );
  }

  // ------------------------------------------------------------
  // حالت 'hub' — صفحه‌ی انتخاب
  // ------------------------------------------------------------
  return (
    <View style={st.container}>
      <LinearGradient colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]} style={st.headerGradient}>
        <Text style={st.titleLabel}>{'🌙'}</Text>
        <Text style={st.titleT}>{t('sightingReportTitle')}</Text>
      </LinearGradient>

      <View style={st.content}>
        {!checkingConnection && !connectionOk ? (
          <View style={st.connectionWarning}>
            <Text style={st.connectionWarningT}>{t('connectionIssueMsg')}</Text>
            <TouchableOpacity onPress={retryConnection} accessibilityRole="button" style={st.retryBtn}>
              <Text style={st.retryBtnT}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={st.hubCard} onPress={openSubmitFlow} disabled={checkingExisting}>
          {checkingExisting ? (
            <ActivityIndicator size="small" color={theme.colors.gold} />
          ) : (
            <React.Fragment>
              <Text style={st.hubCardIcon}>{'📝'}</Text>
              <Text style={st.hubCardTitle}>{t('submitReport')}</Text>
              <Text style={st.hubCardSub}>{t('editExistingReport')}</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={st.hubCard} onPress={function () { setMode('browse'); }}>
          <Text style={st.hubCardIcon}>{'🔍'}</Text>
          <Text style={st.hubCardTitle}>{t('browseReports')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.hubCard} onPress={function () { setMode('map'); }} accessibilityRole="button" accessibilityLabel={t('rmEntry')}>
          <Text style={st.hubCardIcon}>{'🗺️'}</Text>
          <Text style={st.hubCardTitle}>{t('rmEntry')}</Text>
          <Text style={st.hubCardSub}>{t('rmEntrySub')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  content: { padding: theme.spacing.lg },
  headerGradient: { paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.lg, alignItems: 'center' },
  titleLabel: { fontSize: 28, marginBottom: 4 },
  titleT: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight },

  connectionWarning: { backgroundColor: '#241608', borderRadius: theme.radius.sm + 2, padding: theme.spacing.md, marginBottom: theme.spacing.lg, borderLeftWidth: 3, borderLeftColor: theme.colors.ember },
  connectionWarningT: { color: theme.colors.emberLight, fontSize: 12, lineHeight: 20 },

  hubCard: { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.spacing.xxl, alignItems: 'center', marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  hubCardIcon: { fontSize: 36, marginBottom: theme.spacing.sm },
  hubCardTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: 'bold' },
  hubCardSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },

  counterT: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, marginTop: 4 },
  editHintT: { color: theme.colors.gold, fontSize: theme.type.caption.fontSize, marginTop: 6 },
  hubCardPrimary: { borderColor: theme.colors.gold },
  limitBox: { padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgCardDeep },
  limitBoxT: { color: theme.colors.textSecondary, fontSize: theme.type.label.fontSize, lineHeight: 20, textAlign: 'center' },
  backLink: { alignItems: 'center', padding: theme.spacing.md },
  backLinkT: { color: theme.colors.textLink, fontSize: theme.type.body.fontSize },
  retryBtn: { alignSelf: 'flex-start', marginTop: theme.spacing.sm, paddingVertical: 6, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.ember },
  retryBtnT: { color: theme.colors.emberLight, fontSize: theme.type.label.fontSize, fontWeight: '600' },
  floatingBack: { position: 'absolute', top: 50, left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  floatingBackT: { color: theme.colors.gold, fontSize: 16, fontWeight: 'bold' },
});