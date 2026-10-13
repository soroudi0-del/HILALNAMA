var MoonCalculator = require('../calculations/moonPosition');
var HijriCalendar = require('../calculations/hijriCalendar');

// ============================================================
// reportBuilder — سرویس ساخت HTML گزارش رسمی رؤیت هلال.
//
// بازنویسی کامل (بعد از گزارش کاربر: «خیلی گیج‌کننده و نامرتبه،
// ui-ux ضعیفه، کاربر گم می‌شه»). نسخه‌ی قبلی صرفاً یک «دامپ داده»
// بود — جدول پشت جدول بدون سلسله‌مراتب، بدون عنوان قمری، بدون
// تفسیر. این نسخه دقیقاً همان ساختاری را دنبال می‌کند که کاربر
// خواسته:
//
//   ۱. عنوان بزرگ: «وضعیت جهانی رؤیت هلال ماه [نام ماه قمری] ۱۴۴۸
//      هجری قمری» — از HijriCalendar.formatHijriMonthYear ساخته
//      می‌شود (نه estimateHijri خام)، چون طبق کامنت‌های خودِ
//      hijriCalendar.js این تابع تنها مسیر «سالم» برای نمایش
//      نام/سال ماه به کاربر نهایی است (شماره‌ی روز گمراه‌کننده در
//      آن نیست، چون آن به رؤیت واقعی وابسته است نه فرمول نجومی خام).
//   ۲. زیرعنوان هر روز: «در غروب روز [نام روز هفته] [تاریخ شمسی]
//      هجری شمسی برابر با [تاریخ میلادی] میلادی (روز مقارنه/روز
//      بعد از مقارنه/...)» — دقیقاً فرمت درخواستی کاربر.
//   ۳. برای هر معیار انتخاب‌شده‌ی نقشه: «نقشه‌ی میزان رؤیت‌پذیری بر
//      اساس معیار [نام معیار]» → خودِ نقشه → راهنمای رنگ‌ها →
//      یک پاراگراف تفسیر متنی (نه فقط عدد خام).
//   ۴. بعد از نقشه‌(ها)، جزئیات نجومی کامل با گروه‌بندی معنادار
//      (نه یک جدول ۲۰ردیفی تخت) — همان الگوی گروه‌بندی که در
//      ProfessionalData.js (کاوش پیشرفته) هم استفاده شد: هندسه،
//      معیارها، شرایط جوی.
//
// چرا نجوم بعد از نقشه (نه قبلش): نقشه «نمایش بصریِ همان اعداد»
// است؛ منطقی‌تر است کاربر اول ببیند وضعیت کجا چطور است (نقشه)، بعد
// برای شهر خودش عدد دقیق را بخواند (جدول‌ها) — همان ترتیبی که
// CrescentAnalysisScreen.js هم دنبال می‌کند (Hero بصری اول، داده‌ی
// دقیق بعد).
// ============================================================

var REPORT_CSS = ''
  + '@page { margin: 30px 26px 42px 26px; }'
  + '* { box-sizing: border-box; }'
  + 'body { font-family: Tahoma, Vazirmatn, Arial, sans-serif; color: #222; font-size: 12px; direction: {{DIR}}; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }'
  + 'h1,h2,h3 { margin: 0; }'
  + 'p { margin: 0 0 6px; }'

  // --- جلد / عنوان بزرگ ---
  + '.cover { text-align: center; padding: 24px 12px 20px; border-bottom: 4px solid #C9A84C; margin-bottom: 18px; }'
  + '.cover .logoImg { width: 54px; height: 54px; border-radius: 13px; margin-bottom: 7px; }'
  + '.cover .appName { color: #8a6d1f; font-size: 15px; font-weight: 700; letter-spacing: 0.4px; }'
  + '.cover .bigTitle { font-size: 21px; font-weight: 700; margin: 11px 0 3px; color: #1B1230; line-height: 1.55; }'
  + '.cover .reportMeta { color: #777; font-size: 10.5px; margin-top: 9px; }'

  + '.disclaimerBox { background: #fdf6e3; border: 1px solid #d9c27e; border-{{ALIGN}}: 4px solid #C9A84C; border-radius: 6px; padding: 11px 15px; margin: 14px 0 20px; font-size: 10px; line-height: 1.8; color: #5a4a12; }'
  + '.disclaimerBox b { color: #8a6d1f; display: block; margin-bottom: 3px; font-size: 10.5px; }'

  // --- زیرعنوان کامل هر روز (بلوک درشت بالای هر بخش‌روز) ---
  + '.dayHeaderBlock { background: linear-gradient(135deg,#1B1230,#2A1F3D); color: #fff; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px; }'
  + '.dayHeaderBlock .dayBadge { display: inline-block; background: #D4AF6A; color: #3D2E12; font-size: 10.5px; font-weight: 700; padding: 3px 12px; border-radius: 20px; margin-bottom: 10px; letter-spacing: 0.2px; }'
  + '.dayHeaderBlock .dayMainLine { font-size: 14.5px; font-weight: 600; line-height: 2.05; }'
  + '.dayHeaderBlock .dayMainLine b { color: #D4AF6A; }'

  // --- عناوین بخش ---
  + '.section { margin: 18px 0 24px; page-break-inside: avoid; }'
  + '.sectionTitle { background: #1B1230; color: #D4AF6A; padding: 9px 15px; border-radius: 6px; font-size: 13px; font-weight: 700; margin-bottom: 11px; letter-spacing: 0.2px; }'
  + '.subTitle { color: #1B1230; font-size: 12px; font-weight: 700; margin: 14px 0 7px; border-bottom: 2px solid #e8dfc0; padding-bottom: 5px; }'
  + '.dayPage { page-break-before: always; }'
  // اصلاح باگ: به‌جای «:first-of-type» (که در برخی موتورهای رندر PDF
  // قابل‌اعتماد نیست)، یک کلاس صریح که همیشه توسط جاوااسکریپت فقط به
  // روز اول اضافه می‌شود (نگاه کنید به buildReportHtml) — این‌جا هم
  // به‌عنوان لایه‌ی دوم اطمینان، صریحاً page-break را برای آن خاموش
  // می‌کند.
  + '.dayPageFirst { page-break-before: auto !important; }'

  // --- نقشه ---
  + '.mapFrame { border: 1px solid #ddd; border-radius: 10px; padding: 12px 12px 4px; margin-bottom: 16px; background: #fafafa; }'
  + '.mapBlock { text-align: center; margin-bottom: 4px; }'
  // نقشه‌ی پرتره («سریع‌تر») مثل قبل با سقف ۶۴۰px نمایش داده می‌شود،
  // داخل یک صفحه‌ی PDF پرتره‌ی معمولی.
  // نقشه‌ی لندسکیپ («دقیق‌تر») واقعاً با نسبت ابعاد افقی گرفته شده
  // (نگاه کنید به MapScreen.js: exportRequest.landscape===true →
  // mapRotated=true → curSW/curMH افقی) و علاوه‌بر حذف سقف عرض،
  // خودِ صفحه‌ی PDF هم در این حالت لندسکیپ ساخته می‌شود (نگاه کنید
  // به ReportExportScreen.js: Print.printToFileAsync({orientation:
  // Print.Orientation.landscape}) وقتی mapDetailLevel==='detailed').
  // در نتیجه '.mapImg' که width:100% دارد، حالا واقعاً روی یک صفحه‌ی
  // عریض‌تر رندر می‌شود و نقشه به‌طور محسوس بزرگ‌تر دیده می‌شود —
  // نه فقط «بدون سقف در همان قاب باریک پرتره‌ی قبلی».
  + '.mapImg { width: 100%; max-width: 640px; display: block; margin: 0 auto 10px; border: 1px solid #ccc; border-radius: 8px; }'
  + '.mapImg.mapImgLandscape { max-width: none; }'
  + '.mapLegendStrip { text-align: center; padding: 8px 6px; border-top: 1px dashed #ddd; margin-top: 2px; }'
  + '.mapLegendLabel { font-size: 8.5px; color: #999; letter-spacing: 0.4px; margin-bottom: 5px; }'
  + '.legendChip { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9.5px; font-weight: 700; color: #fff; margin: 2px 3px; }'
  + '.mapInterpretation { background: #f7f5ef; border-radius: 8px; padding: 11px 15px; font-size: 10.5px; line-height: 1.9; color: #444; margin-top: 10px; }'
  + '.mapInterpretation b { color: #1B1230; }'

  // --- جدول‌های داده ---
  + 'table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 10.8px; }'
  + 'table th, table td { border: 1px solid #e6e2d6; padding: 6px 10px; text-align: {{ALIGN}}; }'
  + 'table th { background: #f2ede0; color: #333; font-weight: 700; width: 46%; }'
  + 'table td.val { font-weight: 600; text-align: {{ALIGN_OPP}}; color: #1B1230; }'
  + 'table tr:nth-child(even) td.val, table tr:nth-child(even) th { background-color: rgba(0,0,0,0.02); }'
  + '.critTable td.catCell { font-weight: 700; text-align: {{ALIGN_OPP}}; }'
  + '.critTable tr.selectedCritRow td, .critTable tr.selectedCritRow th { background: #fdf3d9 !important; }'
  + '.critTable .starMark { color: #C9A84C; }'

  + '.groupCard { border: 1px solid #e6e2d6; border-{{ALIGN}}: 4px solid #C9A84C; border-radius: 8px; overflow: hidden; margin-bottom: 13px; }'
  + '.groupHeader { background: #f8f6f0; color: #444; font-size: 10.5px; font-weight: 700; padding: 7px 13px; letter-spacing: 0.2px; }'
  + '.groupCard table { margin-bottom: 0; }'
  + '.groupCard table th, .groupCard table td { border: none; border-bottom: 1px solid #f0eee6; }'
  + '.groupCard table tr:last-child th, .groupCard table tr:last-child td { border-bottom: none; }'
  + '.groupCard table tr:nth-child(even) th, .groupCard table tr:nth-child(even) td { background: #fbfaf7; }'

  + '.critLegendTable { width: 100%; }'
  + '.critLegendTable tr:nth-child(even) td { background: #fafaf7; }'
  + '.critLegendTable td { border: none; padding: 5px 10px; }'
  + '.critLegendTable td:first-child { color: #8a6d1f; }'

  + '.footer { position: fixed; bottom: -32px; left: 0; right: 0; font-size: 8.5px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }'
  + '.warnRow { color: #a15c00; font-weight: 600; }'
  + '.dangerRow { color: #b00020; font-weight: 600; background: #fdecea; padding: 8px 12px; border-radius: 6px; }'
  ;
  ;

var ALL_CRIT_IDS = ['yallop', 'odeh', 'saao', 'ilyas', 'malaysia', 'soroudi', 'schaefer'];

// حروف رده‌ی معتبر برای هر معیار — هر معیار فقط زیرمجموعه‌ای از
// A..F را واقعاً استفاده می‌کند (مثلاً Odeh فقط A-D دارد، SAAO/Ilyas/
// Malaysia فقط B/C/F یا B/F). این نگاشت هم برای راهنمای کامل
// (buildGuideTable) و هم برای نوار راهنمای کوچک زیر خودِ نقشه
// (buildMapBlock) استفاده می‌شود تا هر دو همیشه دقیقاً همان حروفی را
// نشان دهند که برای آن معیار معنا دارد — رفع باگ: قبلاً نوار زیر نقشه
// همیشه هر ۶ حرف A-F را نشان می‌داد، حتی برای معیارهایی که اصلاً
// رده‌ی E یا حتی C/D ندارند، که هم گمراه‌کننده بود و هم با راهنمای
// کامل (که درست فقط حروف واقعی را نشان می‌دهد) ناسازگار بود.
var CRIT_LETTERS = {
  yallop: ['A', 'B', 'C', 'D', 'E', 'F'], odeh: ['A', 'B', 'C', 'D'],
  saao: ['B', 'C', 'F'], ilyas: ['B', 'F'], malaysia: ['B', 'F'],
  soroudi: ['A', 'B', 'C', 'D', 'E', 'F'],
  schaefer: ['A', 'B', 'C', 'D', 'E', 'F'],
};
function lettersForCrit(crit) {
  return CRIT_LETTERS[crit] || CRIT_LETTERS.yallop;
}

// رنگ هر رده (A تا F) برای legend chip های نقشه — هم‌راستا با
// طیف ۶پله‌ای theme.js (SEVERITY_COLOR_SCALE) که در بقیه‌ی اپ هم
// همین رنگ‌ها استفاده می‌شود؛ چون theme.js در این فایل (که کاملاً
// جدا از React است) در دسترس نیست، همان hex ها مستقیم تکرار شده‌اند.
var CAT_COLORS = { A: '#0A6E2E', B: '#84BD00', C: '#ffe17b', D: '#F5BD14', E: '#CB450B', F: '#7F1019' };

// رنگ متن مناسب روی هر رنگ رده — رفع مشکل خوانایی: متن سفید روی
// B/C/D (سبز-زرد/زرد روشن/زرد پررنگ) کنتراست فاجعه‌باری داشت
// (مثلاً سفید روی C فقط ۱.۳:۱، در حالی که حداقل استاندارد WCAG
// برای متن معمولی ۴.۵:۱ است) — عملاً غیرقابل‌خواندن روی کاغذ چاپی.
// این نگاشت بر اساس محاسبه‌ی luminance واقعی هر رنگ تعیین شده، نه
// حدس بصری. برای «متن روی پس‌زمینه‌ی پرِ رنگِ همان رده» (مثل badge).
var CAT_TEXT_COLORS = { A: '#fff', B: '#2b2b00', C: '#4a3b00', D: '#3d2e00', E: '#fff', F: '#fff' };

// نسخه‌ی جداگانه برای «متن با رنگِ رده روی پس‌زمینه‌ی سفید/کرم‌رنگ»
// (مثل خط verdict روی کارت نتیجه) — چون خودِ رنگ‌های اصلی B/C/D
// آن‌قدر روشن‌اند که حتی به‌عنوان متنِ تیره روی پس‌زمینه‌ی روشن هم
// کنتراست کافی ندارند (مثلاً C خام روی سفید فقط ۱.۳:۱). این‌ها
// نسخه‌ی تیره‌ترشده‌ی همان هیوی رنگی‌اند، نه رنگ‌های دلبخواه.
var CAT_TEXT_ON_LIGHT = { A: '#0A6E2E', B: '#5c7d00', C: '#8a6d00', D: '#8a5f00', E: '#CB450B', F: '#7F1019' };

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtDeg(v) { return MoonCalculator.formatDegree(v); }
function fmtTime(d, city) {
  if (!d || !city) return '---';
  return MoonCalculator.formatTime(d, city.lat, city.lon);
}

// ------------------------------------------------------------
// buildReportHtml — تابع اصلی و تنها export مهم این فایل.
//
// params:
//   t, isRTL, appLogoBase64, city
//   hijriMonthLabel - رشته‌ی «نام ماه + سال» از
//                     HijriCalendar.formatHijriMonthYear (نه
//                     formatJalali — آن تاریخ شمسی است، این ماه
//                     قمری. ReportExportScreen.js این را می‌سازد).
//   options        - { includeMap, includeFullAstronomy,
//                       includeCriteriaComparison, includeGuide,
//                       criteriaForMap: [ids] }
//   selectedCrit
//   days           - آرایه‌ای از حداکثر ۴ آیتم، هرکدام:
//     { label        - 'روز قبل'/'روز مقارنه'/...
//       weekDayLabel  - نام روز هفته (مثلاً «سه‌شنبه»)
//       jalaliLabel   - تاریخ شمسی کامل (مثلاً «۲۳ تیر ۱۴۰۵»)
//       gregorianLabel- تاریخ میلادی کامل (مثلاً «۱۴ ژوئیه ۲۰۲۶»)
//       moonData، mapImagesBase64: [{crit, base64, landscape}] }
// ------------------------------------------------------------
function buildReportHtml(params) {
  var t = params.t;
  var isRTL = !!params.isRTL;
  var city = params.city;
  var options = params.options || {};
  var days = params.days || [];
  var selectedCrit = params.selectedCrit || 'yallop';

  var css = REPORT_CSS
    .replace(/\{\{DIR\}\}/g, isRTL ? 'rtl' : 'ltr')
    .replace(/\{\{ALIGN\}\}/g, isRTL ? 'right' : 'left')
    .replace(/\{\{ALIGN_OPP\}\}/g, isRTL ? 'left' : 'right');

  var now = new Date();
  var generatedAtStr = now.toISOString().slice(0, 16).replace('T', '  ') + ' UTC';

  var html = '<html><head><meta charset="utf-8"/><style>' + css + '</style></head><body>';
  html += buildCoverBlock(t, isRTL, params.appLogoBase64, city, params.hijriMonthLabel, generatedAtStr);

  // اصلاح باگ صفحه‌ی اول: قبلاً هر روز (از جمله روز اول) داخل
  // <div class="dayPage"> با page-break-before:always پیچیده می‌شد و
  // فقط با selector CSS «:first-of-type» سعی می‌شد جلوی شکست صفحه
  // برای روز اول گرفته شود. این selector در برخی موتورهای رندر PDF
  // (مثلاً WebView داخلیِ expo-print) همیشه قابل‌اعتماد نیست و می‌تواند
  // باعث شود صفحه‌ی اول فقط لوگو+باکس سلب‌مسئولیت باشد و همه‌چیز
  // (نقشه‌ها و بقیه) از صفحه‌ی دوم شروع شود — دقیقاً باگی که کاربر
  // گزارش داد. الان به‌جای تکیه به CSS selector، مستقیم در جاوااسکریپت
  // فقط از روزِ دوم به بعد کلاس صفحه‌شکن اضافه می‌شود؛ روز اول همیشه
  // بدون هیچ page-break، درست زیر باکس سلب‌مسئولیت در همان صفحه‌ی اول
  // شروع می‌شود.
  days.forEach(function (day, dayIdx) {
    var wrapClass = dayIdx === 0 ? 'dayPage dayPageFirst' : 'dayPage';
    html += '<div class="' + wrapClass + '">';
    html += buildDaySection(t, isRTL, city, day, options, selectedCrit);
    html += '</div>';
  });

  html += buildFooterBlock(t);
  html += '</body></html>';
  return html;
}

function buildCoverBlock(t, isRTL, logoBase64, city, hijriMonthLabel, generatedAtStr) {
  var logoHtml = logoBase64
    ? '<img class="logoImg" src="data:image/png;base64,' + logoBase64 + '" />'
    : '🌙';

  var html = '<div class="cover">';
  html += logoHtml;
  html += '<div class="appName">' + esc(t('appNameSplash')) + '</div>';
  // عنوان بزرگ — دقیقاً فرمت درخواستی کاربر: «وضعیت جهانی رؤیت
  // هلال ماه [نام ماه قمری] ۱۴۴۸ هجری قمری»
  html += '<div class="bigTitle">' + esc(t('reportBigTitlePrefix')) + ' ' + esc(hijriMonthLabel || '---') + ' ' + esc(t('reportHijriQamariSuffix')) + '</div>';
  html += '<div class="reportMeta">'
    + esc(city ? city.name : '') + ' (' + (city ? city.lat.toFixed(4) : '---') + '°, ' + (city ? city.lon.toFixed(4) : '---') + '°)'
    + ' — ' + esc(t('reportGeneratedAt')) + ': ' + esc(generatedAtStr)
    + '</div>';
  html += '</div>';

  html += '<div class="disclaimerBox"><b>' + esc(t('reportDisclaimerTitle')) + '</b><br/>' + esc(t('reportDisclaimerBody')) + '</div>';
  return html;
}

// زیرعنوان کامل هر روز — دقیقاً فرمت درخواستی کاربر (تکرار کامل
// برای هر روز، چون هر روز تاریخ متفاوتی دارد):
// «وضعیت جهانی رؤیت هلال ماه [ماه قمری] [سال] هجری قمری در غروب
//  روز [روزهفته] [تاریخ شمسی] هجری شمسی برابر با [تاریخ میلادی]»
function buildDayHeaderBlock(t, isRTL, day, hijriMonthLabel) {
  var sep = isRTL ? '،' : ',';
  var html = '<div class="dayHeaderBlock">';
  html += '<span class="dayBadge">' + esc(day.label) + '</span>';
  html += '<div class="dayMainLine">';
  html += esc(t('reportBigTitlePrefix')) + ' <b>' + esc(hijriMonthLabel || '---') + '</b> ';
  html += esc(t('reportHijriQamariSuffix')) + ' ';
  html += esc(t('reportSunsetOfDayPrefix')) + ' <b>' + esc(day.weekDayLabel || '') + '</b>' + sep + ' ';
  html += '<b>' + esc(day.jalaliLabel || '---') + '</b> ' + esc(t('reportHijriShamsiSuffix')) + ' ';
  html += esc(t('reportEquivalentTo')) + ' <b>' + esc(day.gregorianLabel || '---') + '</b> ' + esc(t('reportGregorianSuffix'));
  html += '</div></div>';
  return html;
}

function buildDaySection(t, isRTL, city, day, options, selectedCrit) {
  var moonData = day.moonData;
  var html = buildDayHeaderBlock(t, isRTL, day, day.hijriMonthLabel);

  if (!moonData) {
    html += '<p>' + esc(t('reportNoData')) + '</p>';
    return html;
  }

  // کارت نتیجه‌ی برجسته (resultCard) به‌طور کامل حذف شد — طبق
  // درخواست کاربر: این کارت همیشه فقط به یک معیار (selectedCrit،
  // که پیش‌فرضش Yallop بود) گره خورده بود و رنگ/نتیجه‌اش گاهی سبز،
  // گاهی قرمز و... به‌صورت مجزا از باقی گزارش نمایش داده می‌شد. حالا
  // بلافاصله بعد از عنوان روز مستقیم به نقشه(ها)/جزئیات نجومی/جدول
  // مقایسه‌ی هر ۶ معیار می‌رسیم که تصویر کامل‌تر و بی‌طرفانه‌تری از
  // وضعیت رؤیت‌پذیری (بدون تک‌معیاری کردن نتیجه) ارائه می‌دهد.

  if (moonData.polarNight || moonData.midnightSun) {
    html += '<p class="dangerRow">' + (moonData.midnightSun ? esc(t('midnightSunWarn')) : esc(t('polarNightWarn'))) + '</p>';
  }

  // ۱. نقشه(ها) + بلافاصله زیر هر نقشه، راهنمای کامل همان معیار.
  // اصلاح باگ: قبلاً راهنما (buildGuideTable) فقط یک‌بار و فقط برای
  // selectedCrit، در انتهای کل بخش روز (بعد از نجوم و جدول مقایسه)
  // رندر می‌شد. این هم باعث می‌شد راهنما از نقشه‌اش کاملاً دور بیفتد،
  // و هم اگر کاربر چند معیار برای نقشه انتخاب کرده بود (مثلاً هم Odeh
  // هم Yallop)، فقط یکی از آن‌ها راهنمای متنی می‌گرفت و بقیه اصلاً
  // توضیحی نداشتند. الان هر نقشه بلافاصله راهنمای مخصوص همان معیار را
  // زیر خودش دارد.
  if (options.includeMap && day.mapImagesBase64 && day.mapImagesBase64.length) {
    day.mapImagesBase64.forEach(function (item) {
      html += buildMapBlock(t, item.crit, item.base64, moonData, city, !!item.landscape);
      if (options.includeGuide) {
        html += buildGuideTable(t, item.crit);
      }
    });
  } else if (options.includeMap) {
    html += '<p class="warnRow">' + esc(t('reportMapUnavailable')) + '</p>';
    // نقشه‌ای نبود که راهنما زیرش برود؛ حداقل راهنمای معیار اصلی روز
    // را نشان می‌دهیم تا کاربر بی‌راهنما نماند.
    if (options.includeGuide) {
      html += buildGuideTable(t, selectedCrit);
    }
  }

  // ۲. جزئیات نجومی — بعد از نقشه (نقشه نمایش بصری همین اعداد است)
  if (options.includeFullAstronomy !== false) {
    html += buildAstronomySection(t, city, moonData);
  }

  // ۳. مقایسه‌ی ۶ معیار + جزئیات اجماع Soroudi
  if (options.includeCriteriaComparison !== false) {
    html += buildCriteriaComparisonTable(t, moonData, selectedCrit);
    if (moonData.soroudiAgreement) {
      html += buildSoroudiAgreementBlock(t, moonData);
    }
  }

  return html;
}

// ------------------------------------------------------------
// buildMapBlock — «نقشه‌ی میزان رؤیت‌پذیری بر اساس معیار X» + خودِ
// نقشه + راهنمای رنگ‌ها + یک پاراگراف تفسیر متنی (نه فقط عدد خام؛
// کاربر گفت «تفسیر نقشه» هم لازم است).
//
// isLandscape: true وقتی این نقشه با حالت «دقیق‌تر» (لندسکیپ) در
// ReportExportScreen.js/MapScreen.js گرفته شده — رفع باگ: قبلاً
// سقف عرض ۶۴۰px بدون توجه به orientation واقعی تصویر روی همه‌ی
// نقشه‌ها اعمال می‌شد و نقشه‌ی افقی/دقیق‌تر را در همان قاب باریک
// نقشه‌ی پرتره فشرده می‌کرد. الان با کلاس mapImgLandscape (نگاه
// کنید به REPORT_CSS بالا) این نقشه از عرض کامل صفحه استفاده
// می‌کند.
// ------------------------------------------------------------
function buildMapBlock(t, crit, base64, moonData, city, isLandscape) {
  var html = '<div class="section">';
  html += '<div class="sectionTitle">' + esc(t('reportMapTitlePrefix')) + ' ' + esc(MoonCalculator.getCritLabel(crit)) + '</div>';

  html += '<div class="mapFrame">';
  // رفع باگ (PDF نهایی خالی/سفید بود با چند نقشه‌ی «دقیق‌تر»): نقشه‌ها
  // در MapScreen.js اکنون به‌صورت JPEG فشرده گرفته می‌شوند (نه PNG
  // بدون‌فشرده‌سازی)، پس نوع MIME این‌جا هم باید همان باشد، وگرنه
  // تصویر اصلاً در PDF نمایش داده نمی‌شود.
  html += '<div class="mapBlock"><img class="mapImg' + (isLandscape ? ' mapImgLandscape' : '') + '" src="data:image/png;base64,' + base64 + '" /></div>';

  // راهنمای رنگ‌ها — فقط حروف رده‌ای که خودِ این معیار واقعاً استفاده
  // می‌کند (مثلاً Odeh: A-D، SAAO/Ilyas/Malaysia: زیرمجموعه‌ای کوچک‌تر)
  // — مستقیماً زیر خودِ نقشه، داخل همان قاب، تا ارتباط بصری بین
  // رنگ‌ها و نقشه واضح باشد. اصلاح باگ: قبلاً همیشه هر ۶ حرف A-F
  // نشان داده می‌شد، حتی برای معیارهایی که آن رده‌ها را اصلاً ندارند.
  html += '<div class="mapLegendStrip">';
  html += '<div class="mapLegendLabel">' + esc(t('reportMapLegendLabel')) + '</div>';
  lettersForCrit(crit).forEach(function (letter) {
    html += '<span class="legendChip" style="background:' + CAT_COLORS[letter] + ';color:' + CAT_TEXT_COLORS[letter] + ';">' + letter + '</span>';
  });
  html += '</div>';
  html += '</div>'; // .mapFrame

  // تفسیر متنی نقشه — رده‌ی محلی شهر انتخابی به‌عنوان لنگر تفسیر
  var localCat = MoonCalculator.getCatForCrit(moonData, crit);
  var localCatText = localCat ? t(MoonCalculator.getCatTextKey(localCat, crit)) : '';
  html += '<div class="mapInterpretation">';
  html += esc(t('reportMapInterpretationIntro'));
  if (localCat && city) {
    html += ' ' + esc(t('reportMapInterpretationLocal')
      .replace('{city}', city.name)
      .replace('{cat}', localCat)
      .replace('{catText}', localCatText));
  }
  html += '</div>';

  html += '</div>';
  return html;
}

// ------------------------------------------------------------
// buildAstronomySection — جزئیات نجومی، گروه‌بندی‌شده (نه یک جدول
// تخت ۱۶ردیفی) — همان الگوی گروه‌بندی ProfessionalData.js.
// ------------------------------------------------------------
function buildAstronomySection(t, city, moonData) {
  var html = '<div class="section"><div class="sectionTitle">' + esc(t('hilalSpecs')) + '</div>';

  html += groupCard(t('reportGroupTiming'), [
    [t('sunsetTime'), fmtTime(moonData.sunSet, city)],
    [t('moonsetTime'), fmtTime(moonData.moonSet, city)],
    [t('lagTimeLabel'), MoonCalculator.formatDuration(moonData.lagTime)],
    [t('moonAgeLabel'), MoonCalculator.formatAge(moonData.moonAge, moonData.moonAgeNote)],
  ]);

  html += groupCard(t('saGroupGeometry'), [
    [t('moonAltitude'), fmtDeg(moonData.moonAltitude)],
    [t('sunAzimuth'), fmtDeg(moonData.sunAzimuth)],
    [t('moonAzimuth'), fmtDeg(moonData.moonAzimuth)],
    [t('dazLabel') + ' (DAZ)', moonData.dazSigned !== null && moonData.dazSigned !== undefined ? (moonData.dazSigned >= 0 ? '+' : '') + moonData.dazSigned.toFixed(2) + '°' : '---'],
    [t('elongationTopo'), moonData.topoElongation !== null && moonData.topoElongation !== undefined ? moonData.topoElongation.toFixed(2) + '°' : '---'],
    [t('elongationGeo'), moonData.elongation !== null && moonData.elongation !== undefined ? moonData.elongation.toFixed(2) + '°' : '---'],
    [t('eclipticLat'), MoonCalculator.formatDegreeDM(moonData.moonEclipticLat)],
  ]);

  html += groupCard(t('saGroupCriteria'), [
    [t('illumination'), moonData.illuminationPercent !== null && moonData.illuminationPercent !== undefined ? moonData.illuminationPercent.toFixed(3) + '%' : '---'],
    [t('crescentWidthLabel'), moonData.crescentWidth ? moonData.crescentWidth.toFixed(3) + "'" : '---'],
    [t('moonSemiDiamLabel'), moonData.moonSemiDiam ? (moonData.moonSemiDiam * 60).toFixed(1) + "'" : '---'],
    ['Yallop q', moonData.yallopQ !== null && moonData.yallopQ !== undefined ? moonData.yallopQ.toFixed(4) : '---'],
    [t('danjonLimit') + ' (' + t('danjonNakedEyeLabel') + ')', moonData.danjonOkNaked ? t('danjonPassed') : t('danjonNotPassed')],
    [t('danjonLimit') + ' (' + t('danjonTelescopeLabel') + ')', moonData.danjonOkTelescope ? t('danjonPassed') : t('danjonNotPassed')],
  ]);

  html += groupCard(t('saGroupAtmosphere'), [
    [t('moonDistanceLabel'), moonData.moonDistance ? moonData.moonDistance.toFixed(0) + ' km' : '---'],
  ]);

  html += '</div>';
  return html;
}

function groupCard(titleText, rows) {
  var html = '<div class="groupCard"><div class="groupHeader">' + esc(titleText) + '</div><table>';
  rows.forEach(function (r) {
    html += '<tr><th>' + esc(r[0]) + '</th><td class="val">' + esc(r[1]) + '</td></tr>';
  });
  html += '</table></div>';
  return html;
}

function buildCriteriaComparisonTable(t, moonData, selectedCrit) {
  var catByCrit = {
    yallop: moonData.yallopCat, odeh: moonData.odehCat, saao: moonData.saaoCat,
    ilyas: moonData.ilyasCat, malaysia: moonData.malaysiaCat, soroudi: moonData.soroudiCat,
    schaefer: moonData.schaeferCat,
  };

  var html = '<div class="section"><div class="sectionTitle">' + esc(t('compareCriteria')) + '</div><table class="critTable">';
  html += '<tr><th>' + esc(t('criterion')) + '</th><th>' + esc(t('saVisibilityClass')) + '</th><th>' + esc(t('shareCriterionResult')) + '</th></tr>';
  ALL_CRIT_IDS.forEach(function (id) {
    var cat = catByCrit[id];
    var isSelected = id === selectedCrit;
    var label = MoonCalculator.getCritLabel(id) + (isSelected ? ' <span class="starMark">★</span>' : '');
    var text = t(MoonCalculator.getCatTextKey(cat, id));
    var catCellText = cat || (id === 'ilyas' ? t('catIlyasOutOfRange') : '?');
    if (id === 'schaefer' && moonData.schaeferAtmoStatus) {
      text += ' — ' + t(moonData.schaeferAtmoStatus === 'live' ? 'schAtmoPdfLive' : 'schAtmoPdfDefault');
    }
    html += '<tr' + (isSelected ? ' class="selectedCritRow"' : '') + '><td>' + label + '</td><td class="catCell">' + esc(catCellText) + '</td><td>' + esc(text) + '</td></tr>';
  });
  html += '</table></div>';
  return html;
}

function buildSoroudiAgreementBlock(t, moonData) {
  var ag = moonData.soroudiAgreement;
  var html = '<div class="subTitle">' + esc(t('reportSoroudiAgreementTitle')) + '</div><table>';
  html += '<tr><th>' + esc(t('reportSoroudiBaseCat')) + '</th><td class="val">' + esc(moonData.soroudiBaseCat || '---') + ' (Yallop)</td></tr>';
  if (ag.saao) html += '<tr><th>SAAO</th><td class="val">' + esc(ag.saao.cat) + ' — ' + (ag.saao.agrees ? esc(t('reportWitnessAgrees')) : esc(t('reportWitnessDisagrees'))) + '</td></tr>';
  if (ag.ilyas) html += '<tr><th>Ilyas</th><td class="val">' + esc(ag.ilyas.cat) + ' — ' + (ag.ilyas.agrees ? esc(t('reportWitnessAgrees')) : esc(t('reportWitnessDisagrees'))) + '</td></tr>';
  if (ag.odeh) html += '<tr><th>Odeh</th><td class="val">' + esc(ag.odeh.cat) + ' — ' + (ag.odeh.agrees ? esc(t('reportWitnessAgrees')) : esc(t('reportWitnessDisagrees'))) + '</td></tr>';
  html += '</table>';
  if (ag.odeh) html += '<p style="font-size:9px;color:#888;font-style:italic;margin-top:4px;">' + esc(t('reportOdehNotIndependentNote')) + '</p>';
  if (moonData.soroudiCapApplied) html += '<p class="warnRow" style="margin-top:6px;">' + esc(t('reportSoroudiCapApplied')) + '</p>';
  return html;
}

function buildGuideTable(t, selectedCrit) {
  var letters = lettersForCrit(selectedCrit);
  var html = '<div class="section"><div class="sectionTitle">' + esc(t('guide') + ' — ' + MoonCalculator.getCritLabel(selectedCrit)) + '</div><table class="critLegendTable">';
  letters.forEach(function (letter) {
    html += '<tr><td style="font-weight:700;width:22px;">' + esc(letter) + '</td><td>' + esc(t(MoonCalculator.getCatTextKey(letter, selectedCrit))) + '</td></tr>';
  });
  html += '</table></div>';
  return html;
}

function buildFooterBlock(t) {
  return '<div class="footer">' + esc(t('appNameSplash')) + ' — ' + esc(t('reportFooterNote')) + '</div>';
}

module.exports = {
  buildReportHtml: buildReportHtml,
};