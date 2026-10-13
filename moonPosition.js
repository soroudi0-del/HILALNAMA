var Astronomy = require('astronomy-engine');
require('./deltaT').install(); // v3.5: مدل ΔT واقع‌بینانه‌تر (نگاه کنید به deltaT.js)
var moment = require('moment-timezone');
var tzlookup = require('tz-lookup');
var Schaefer = require('./schaeferModel'); // v3.6: مدل فیزیکی Schaefer (R)

// ============================================================
// نسخه ۳ — بازنویسی موتور محاسباتی هلال
//
// این فایل تمام محاسبات نجومی مربوط به رؤیت هلال را انجام می‌دهد.
// در زیر تاریخچه‌ی کامل اصلاحات علمی و فنی نسخه‌های قبل حفظ شده،
// و بخش «فاز ۱ نسخه ۳» اصلاحات جدید را مستند می‌کند.
//
// ---- فاز ۱ نسخه ۳ (بازبینی کامل با تطبیق منابع علمی) ----
// F1-1: getHorizonCoords اکنون یک پارامتر useRefraction می‌گیرد.
//       طبق تعریف رسمی Yallop (1997) و Odeh (2004/2006)، مقادیر
//       ARCV/W/DAZ/ARCL باید بدون تصحیح شکست جوی (airless) محاسبه
//       شوند؛ فقط طلوع/غروب واقعی (که خودش یک پدیده‌ی قابل مشاهده
//       با شکست جوی است) باید با تصحیح refraction بماند.
//       منبع: npm astronomy-engine docs + "Global lunar visibility
//       maps based on Yallop's method" (uu.nl) + مقاله‌ی اصلی Odeh.
// F1-2: تمام پارامترهای ورودی معیارها (arcv, W, daz, arcl,
//       moonSemiDiam) اکنون در لحظه‌ی bestTime محاسبه می‌شوند،
//       نه در لحظه‌ی غروب خورشید. طبق مقاله‌ی Odeh (astronomycenter.
//       net/pdf/2006_cri.pdf): "All the calculations were done at
//       best time of observation... ARCV, DAZ, ARCL ... at Best Time
//       and are not corrected for refraction."
// F1-3: فرمول Odeh با ضرایب واقعی خودش (نه کپی از Yallop) بازنویسی
//       شد: V = ARCV - (-0.1018W³+0.7319W²-6.3226W+7.1651)
//       با زون‌بندی A:V≥5.65  B:2≤V<5.65  C:-0.96≤V<2  D:V<-0.96
// F1-4: SAAO از نو، بر پایه‌ی جدول واقعی DALT/DAZ (Caldwell & Laney
//       2001) با درون‌یابی خطی، نه فرمول Yallop بازبرچسب‌گذاری‌شده.
// F1-5: «Istanbul/Diyanet» به عنوان معیاری با نام و آستانه‌های
//       ساختگی حذف شد (هیچ منبع رسمی معتبری برایش پیدا نشد؛ Diyanet
//       واقعاً از تقویم محاسباتی صرف استفاده می‌کند، نه یک معیار
//       ARCV/ARCL/lag با این اعداد). جایگزین: معیار Ilyas (1988) بر
//       پایه‌ی فرمول ArcV(DAZ) — نگاه کنید به بازبینی دوم زیر برای
//       جزئیات و اصلاح این بخش.
// F1-6: «Malaysia/JAKIM» به‌روزرسانی به معیار رسمی جدید MABIMS 2021
//       («Neo-MABIMS»، مصوب ۸ دسامبر ۲۰۲۱ توسط مالزی/اندونزی/
//       برونئی/سنگاپور): ARCV ≥ 3° و elongation ≥ 6.4° (دو شرط
//       ساده، بدون شرط سن ماه که در نسخه‌ی ۱۹۹۸ بود و منسوخ شده).
// F1-7: توابع فرمت (formatAge/formatDuration/formatDegree/
//       formatDegreeDM) با carry صحیح بازنویسی شدند تا «60m» یا
//       «60″» هرگز رخ ندهد.
// F1-8: findPrevNewMoon/findNextNewMoon بدون تغییر منطقی — تست شد
//       و در تمام edge caseهای بررسی‌شده درست کار می‌کند.
//
// ---- بازبینی دوم فاز ۱ نسخه ۳ (تطبیق دقیق با منابع اولیه) ----
// این بازبینی در پاسخ به دو سند بررسی مستقل انجام شد. هر ادعای هر
// دو سند مستقیماً با منبع اصلی (نه منابع ثانویه) راستی‌آزمایی شد:
//
// - ضریب Odeh (7.1651): بررسی شد و تأیید شد که خود مقاله‌ی اصلی
//   Odeh (astronomycenter.net/pdf/2006_cri.pdf, معادله ۲) دقیقاً
//   همین عدد را دارد. عدد جایگزین 7.1814 که در یکی از اسناد بررسی
//   پیشنهاد شده بود، در هیچ منبع معتبری یافت نشد؛ بدون تغییر ماند.
// - bestTime با lag منفی/کوچک: بررسی شد. منابع اصلی (از جمله نقشه‌ی
//   جهانی رؤیت مبتنی بر Yallop، دانشگاه اوترخت) این حالت را «منطقه‌ی
//   نامعتبر» می‌دانند، نه چیزی که باید با یک fallback عددی دلبخواهی
//   جایگزین شود. fallback فعلی (بازگشت به sunSet) بدون تغییر ماند.
// - Yallop ARCV topocentric: بررسی شد. خود Odeh صراحتاً می‌گوید
//   ARCV محاسباتی باید topocentric باشد؛ افزودن گزینه‌ی geocentric
//   خلاف منبع اصلی بود و انجام نشد.
// - Danjon (ابزار نوری): اصلاح شد از ۴.۵° (که در واقع از جدول SAAO
//   کپی شده بود) به ۶.۴° طبق مقاله‌ی اصلی Odeh، بخش ۸.
// - Ilyas: کامل بازنویسی شد. روشن شد که «Ilyas 1988» و «Ilyas 1994»
//   دو منبع متفاوتند؛ فقط ۱۹۸۸ (Astronomy & Astrophysics 206,
//   133-135) فرمول عددی بسته دارد: ArcV(DAZ) چندجمله‌ای درجه‌سوم.
//   calcIlyas با این فرمول واقعی جایگزین شد؛ جزئیات و محدودیت‌های
//   شفاف در کامنت بالای خود تابع آمده.
// - catch(e){} خالی: در تمام موارد (۱۳ مورد) یک console.warn با
//   برچسب مشخص اضافه شد؛ رفتار فانکشنی بدون تغییر (همچنان fallback
//   خاموش/مقدار پیش‌فرض)، فقط قابل دیباگ شد.
// - fallback عرض هلال (15.5′): کامنت توضیحی اضافه شد.
//
// ---- بازبینی سوم فاز ۱ نسخه ۳ (اصلاح واقعی SAAO) ----
// این بازبینی خطای خودِ بازبینی دوم را اصلاح می‌کند: در بازبینی
// دوم، جدول ۵ نقطه‌ای SAAO (که از Table IV مقاله‌ی Odeh کپی شده
// بود) به اشتباه «کامل» تلقی شد چون با منبع ثانویه (بازتاب Odeh از
// Caldwell) تطبیق داشت. اما خود مقاله‌ی اصلی Caldwell & Laney
// (astronomycenter.net/pdf/saao_2001.pdf) روشن کرد که آن جدول ۵
// نقطه‌ای فقط یک خلاصه‌ی بسیار درشت از جدول واقعی ۴۳ نقطه‌ای
// (DAZ=0° تا 21°، گام ۰.۵°) است. calcSAAO با جدول کامل و دو منحنی
// واقعی (خط بالا و خط پایین ستون dalt) جایگزین شد؛ جزئیات در کامنت
// بالای خود تابع.
// ============================================================

var MoonCalculator = {

  // ------------------------------------------------------------
  // F1-1: پارامتر useRefraction اضافه شد.
  // useRefraction=false (پیش‌فرض): مقادیر هندسی/airless — برای
  //   محاسبه‌ی ARCV, W, DAZ, ARCL که مبنای معیارهای رؤیت‌اند.
  // useRefraction=true: مقادیر با شکست جوی — فقط برای نمایش
  //   "موقعیت واقعاً دیدنی" در UI (مثلاً روی نقشه یا برای کاربر).
  // ------------------------------------------------------------
  getHorizonCoords: function(date, observer, body, useRefraction) {
    try {
      var eq = Astronomy.Equator(body, date, observer, true, true);
      var refraction = useRefraction ? 'normal' : null;
      var hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, refraction);
      return { altitude: hor.altitude, azimuth: hor.azimuth, ra: eq.ra, dec: eq.dec };
    } catch(e) { console.warn('MoonCalc: getHorizonCoords failed:', e.message); return null; }
  },

  calcTopoElongation: function(mH, sH) {
    if (!mH || !sH) return null; // null نه ۰!
    var mA = mH.altitude * Math.PI / 180;
    var sA = sH.altitude * Math.PI / 180;
    var dAz = (mH.azimuth - sH.azimuth) * Math.PI / 180;
    var cosE = Math.sin(mA)*Math.sin(sA) + Math.cos(mA)*Math.cos(sA)*Math.cos(dAz);
    if (cosE > 1) cosE = 1;
    if (cosE < -1) cosE = -1;
    return Math.acos(cosE) * 180 / Math.PI;
  },

  // ==============================================================
  // فاز ۱ نسخه ۳ (بازبینی سوم): SAAO / Caldwell & Laney — جایگزینی
  // جدول ۵ نقطه‌ای قبلی با جدول کامل اصلی.
  //
  // ایراد نسخه‌ی قبلی: جدول ۵ نقطه‌ای (DAZ=0,5,10,15,20) در واقع از
  // Table IV مقاله‌ی Odeh (2004/2006) کپی شده بود که خودش فقط یک
  // بازتاب بسیار خلاصه‌شده از جدول اصلی بود. جدول کامل و اصلی
  // Caldwell & Laney، «First Visibility of the Lunar Crescent»
  // (نسخه‌ی کامل: astronomycenter.net/pdf/saao_2001.pdf، بخش
  // «Numerical values of the criterion lines in Figs. 1-4»)، ۴۳
  // نقطه دارد: از DAZ=0° تا DAZ=21°، با گام ۰.۵ درجه.
  //
  // ساختار جدول اصلی (طبق متن مقاله): برای هر مقدار x=DAZ، دو منحنی
  // y=dalt گزارش شده — یک «خط بالا» و یک «خط پایین». نقل مستقیم از
  // متن مقاله: «اگر هلال زیر مقدار y بالا (یعنی منحنی بالا) باشد،
  // رصد با چشم غیرمسلح نامحتمل است... اگر هلال نزدیک‌تر به مقدار y
  // پایین (یعنی منحنی پایین) باشد، رصد حتی با ابزار نوری هم به‌شدت
  // بعید خواهد بود.»
  //   ستون ۱ (خط بالا): زیرش → رؤیت با چشم غیرمسلح نامحتمل (اما با
  //           ابزار نوری ممکن است).
  //   ستون ۲ (خط پایین): زیرش → غیرممکن حتی با ابزار نوری.
  // (جدول اصلی همچنین ستون‌های dalt4، dalt+arcl/3 و lag دارد که
  // مبنای دیگری — لحظه‌ی افت خورشید ۴ درجه، یا پارامتر ترکیبی، یا
  // lag — دارند؛ چون این پیاده‌سازی از ارتفاع لبه‌ی پایین ماه در
  // calcMoment/bestTime استفاده می‌کند، فقط ستون dalt خام مستقیماً
  // قابل‌استفاده و سازگار با بقیه‌ی معیارهای این فایل است.)
  //
  // ورودی: moonAltApparent = ارتفاع لبه‌ی پایین ماه (تقریب: ارتفاع
  //   مرکز ماه منهای نیم‌قطر ظاهری)، daz = اختلاف سمت (بدون علامت)
  // ==============================================================
  calcSAAO: function(moonAltApparent, daz) {
    if (moonAltApparent === null || moonAltApparent === undefined) return 'F';
    if (daz === null || daz === undefined) return 'F';

    var DAZ_PTS = [
      0.00, 0.50, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00, 4.50,
      5.00, 5.50, 6.00, 6.50, 7.00, 7.50, 8.00, 8.50, 9.00, 9.50,
      10.00, 10.50, 11.00, 11.50, 12.00, 12.50, 13.00, 13.50, 14.00, 14.50,
      15.00, 15.50, 16.00, 16.50, 17.00, 17.50, 18.00, 18.50, 19.00, 19.50,
      20.00, 20.50, 21.00
    ];
    // خط بالا: زیرش رؤیت با چشم نامحتمل (اما شاید با ابزار نوری ممکن)
    var DALT_UPPER_PTS = [
      8.19, 8.18, 8.16, 8.14, 8.10, 8.06, 8.02, 7.96, 7.91, 7.84,
      7.77, 7.70, 7.62, 7.53, 7.44, 7.35, 7.26, 7.16, 7.05, 6.95,
      6.84, 6.73, 6.61, 6.50, 6.38, 6.26, 6.15, 6.03, 5.91, 5.79,
      5.67, 5.55, 5.43, 5.31, 5.19, 5.08, 4.96, 4.85, 4.74, 4.64,
      4.53, 4.43, 4.33
    ];
    // خط پایین: زیرش غیرممکن حتی با ابزار نوری
    var DALT_LOWER_PTS = [
      6.29, 6.28, 6.26, 6.24, 6.20, 6.16, 6.12, 6.06, 6.01, 5.94,
      5.87, 5.80, 5.72, 5.63, 5.54, 5.45, 5.36, 5.26, 5.15, 5.05,
      4.94, 4.83, 4.71, 4.60, 4.48, 4.36, 4.25, 4.13, 4.01, 3.89,
      3.77, 3.65, 3.53, 3.41, 3.29, 3.18, 3.06, 2.95, 2.84, 2.74,
      2.63, 2.53, 2.43
    ];

    var d = Math.min(Math.abs(daz), 21); // خارج از جدول را به لبه clamp می‌کنیم

    function interp(pts) {
      for (var i = 0; i < DAZ_PTS.length - 1; i++) {
        if (d >= DAZ_PTS[i] && d <= DAZ_PTS[i+1]) {
          var t = (d - DAZ_PTS[i]) / (DAZ_PTS[i+1] - DAZ_PTS[i]);
          return pts[i] + t * (pts[i+1] - pts[i]);
        }
      }
      return pts[pts.length - 1];
    }

    var upperLine = interp(DALT_UPPER_PTS);
    var lowerLine = interp(DALT_LOWER_PTS);

    if (moonAltApparent >= upperLine) return 'B'; // رؤیت با چشم محتمل
    if (moonAltApparent >= lowerLine) return 'C'; // فقط با ابزار نوری
    return 'F'; // غیرممکن حتی با ابزار نوری
  },


  // ==============================================================
  // فاز ۱ نسخه ۳ (بازبینی دوم): Ilyas — جایگزینی کامل با فرمول واقعی
  // و مستند، به‌جای تقریب پله‌ای altitude/elongation قبلی.
  //
  // منبع دقیق: Ilyas, M. (1988). "Limiting Altitude Separation in
  // the New Moon's First Visibility Criterion." Astronomy and
  // Astrophysics, 206, 133-135.
  // (نقل‌شده با فرمول کامل در: Faid et al., "Islamic Historical
  // Review on Middle Age Lunar Crescent Visibility Criterion",
  // Journal of Al-Tamaddun 17(1), 2022 — جدول معیارهای مدرن)
  //
  //   ArcV_min(DAZ) = 10.2832719598
  //                   − 0.0027356815·DAZ
  //                   − 0.0136648716·DAZ²
  //                   + 0.0002119205·DAZ³
  //
  // این معیار (که گاهی «Ilyas (C)» نامیده می‌شود چون منحنی
  // Fotheringham/Maunder/Bruin را برای DAZهای بزرگ‌تر — عرض‌های
  // جغرافیایی بالا — گسترش می‌دهد) یک خط مرزی تک‌سطحی برای رؤیت
  // با چشم غیرمسلح است: اگر ARCV واقعی بالاتر از ArcV_min(DAZ) باشد،
  // رؤیت با چشم محتمل است؛ در غیر این صورت خیر.
  //
  // نکته‌ی مهم درباره‌ی نام‌گذاری قبلی «Ilyas (1988/1994)»:
  // این دو منبع یک معیار واحد نیستند. Ilyas (1994, QJRAS 35:425-461)
  // یک مقاله‌ی مروری/انتقادی جامع است که در آن ایلیاس معیارهای
  // دوپارامتری موجود (از جمله معیار خودش) را «مرتبه‌ی چهارم» می‌نامد
  // و پیشنهاد می‌دهد معیار «مرتبه‌ی پنجم» باید تصحیح extinction جوی
  // را هم لحاظ کند — اما فرمول عددی بسته‌ی جایگزینی در آن مقاله
  // منتشر نشده که بشود مستقیماً کدنویسی کرد. پس تنها فرمول قابل
  // پیاده‌سازی و مستند، همان مقاله‌ی ۱۹۸۸ است.
  //
  // محدودیت شفاف (اصلاح‌شده): منبع اصلی Ilyas (1988) فقط یک خط
  // مرزی دوحالته می‌دهد — رؤیت با چشم غیرمسلح ممکن است یا ممکن
  // نیست — نه سه ناحیه (مثل Yallop/Odeh/SAAO که صراحتاً چندناحیه‌اند
  // و ناحیه‌ی جداگانه‌ی «فقط با ابزار نوری» را در منبع خودشان
  // تعریف کرده‌اند). نسخه‌ی قبلی این تابع یک ناحیه‌ی C («فقط با
  // ابزار نوری»، با حاشیه‌ی ۲ درجه‌ی دلبخواهی زیر خط مرزی) اضافه
  // کرده بود که هیچ‌جای مقاله‌ی Ilyas (1988) نیامده — یک قرارداد
  // خودساخته‌ی این پیاده‌سازی بود، نه بخشی از معیار اصلی. چون این
  // ناحیه در UI به‌اشتباه به‌عنوان «طبق معیار Ilyas» نمایش داده
  // می‌شد (بدون علامت‌گذاری آن به‌عنوان افزوده‌ی غیررسمی این اپ)،
  // حذف شد. اکنون calcIlyas دقیقاً همان دو خروجی منبع اصلی را
  // برمی‌گرداند: B (دیده می‌شود) یا F (دیده نمی‌شود).
  // ==============================================================
  calcIlyas: function(daz, arcv) {
    if (daz === null || daz === undefined) return null;
    if (arcv === null || arcv === undefined) return null;
    if (Math.abs(daz) > 21) return null; // خارج از بازه‌ی معتبر فرمول — این معیار اینجا اعمال‌پذیر نیست
    var d = Math.abs(daz);
    var arcvMin = 10.2832719598 - 0.0027356815*d - 0.0136648716*d*d + 0.0002119205*d*d*d;
    if (arcv >= arcvMin) return 'B'; // رؤیت با چشم غیرمسلح محتمل (طبق منبع اصلی)
    return 'F'; // رؤیت غیرممکن (طبق منبع اصلی — Ilyas (1988) ناحیه‌ی جداگانه‌ای برای «فقط با ابزار نوری» تعریف نمی‌کند)
  },


  getFullMoonData: function(date, latitude, longitude, elevation, nmDate, atmo, options) {
    if (!elevation) elevation = 0;
    var R = {
      sunRise: null, sunSet: null, moonRise: null, moonSet: null,
      nextNewMoon: null, prevNewMoon: null,
      // مقادیر در لحظه‌ی غروب خورشید (برای نمایش "الان" در UI)
      moonAltitude: null, moonAzimuth: null, sunAltitude: null, sunAzimuth: null,
      moonRA: null, moonDec: null,
      // مقادیر در بهترین لحظه‌ی رصد (F1-2) — این‌ها مبنای معیارها هستند
      moonAltitudeBest: null, moonAzimuthBest: null, sunAltitudeBest: null, sunAzimuthBest: null,
      illuminationPercent: 0, moonAge: null, moonAgeNote: '',
      elongation: 0, topoElongation: null, // null نه ۰
      lagTime: null, arcv: null, daz: null, dazSigned: null, arcl: null,
      crescentWidth: null,
      moonEclipticLat: null, moonEclipticLon: null, moonDistance: null, moonSemiDiam: null,
      yallopQ: null, yallopCat: '', odehCat: '', saaoCat: '', ilyasCat: '',
      malaysiaCat: '',
      // ===== Soroudi ★ نسخه ۴ — معیار اجماع چند-هندسی =====
      // بازطراحی کامل: به‌جای امتیاز وزنی دلبخواهی (نسخه‌ی قبل)، اکنون
      // «رده‌ی پایه» مستقیماً از Yallop (بدون تغییر) می‌آید، و یک لایه‌ی
      // «سقف اجماع» (نه اصلاح امتیاز) بر اساس توافق/عدم‌توافق دو شاهد
      // مستقل (SAAO, Ilyas) روی آن اعمال می‌شود. جزئیات کامل در کامنت
      // بالای calcSoroudi.
      soroudiCat: '', soroudiBaseCat: '', soroudiCapApplied: false,
      soroudiAgreement: null, // { saao, ilyas, odeh, independentAgreeCount, independentTotal }
      // فیلدهای نسخه‌ی قبل (soroudiScore/soroudiVeto) دیگر تولید نمی‌شوند؛
      // برای سازگاری با UI قدیمی که ممکن است هنوز به آن‌ها رجوع کند،
      // مقدار null/false نگه داشته می‌شوند نه حذف کامل از شکل شیء.
      soroudiScore: null, soroudiVeto: false,
      // ===== Schaefer (v3.6): مدل فیزیکی — R، رده و احتمال رؤیت با چشم غیرمسلح =====
      schaeferR: null, schaeferCat: '', schaeferProb: null, schaefer: null,
      danjonOkNaked: false, danjonOkTelescope: false,
      bestTime: null, moonAltBest: null, relAz: null,
      isVisible: false, isVisibleNakedEye: false,
      polarNight: false, midnightSun: false,
    };
    try {
      var obs = new Astronomy.Observer(latitude, longitude, elevation);

      var lonOffset = Math.max(-12*60, Math.min(12*60, longitude * 4)); // به دقیقه
      var localNoon = new Date(date.getTime() - lonOffset * 60000);

      // ----- طلوع و غروب خورشید -----
      try {
        var sr = Astronomy.SearchRiseSet('Sun', obs, 1, localNoon, 1);
        if (sr) R.sunRise = sr.date;
      } catch(e) { console.warn('MoonCalc: sunRise search failed:', e.message); }
      try {
        var ss = Astronomy.SearchRiseSet('Sun', obs, -1, localNoon, 1);
        if (ss) R.sunSet = ss.date;
      } catch(e) { console.warn('MoonCalc: sunSet search failed:', e.message); }

      if (!R.sunRise && !R.sunSet) {
        var sunAtNoon = this.getHorizonCoords(localNoon, obs, 'Sun', true);
        if (sunAtNoon) {
          if (sunAtNoon.altitude > 0) R.midnightSun = true;
          else R.polarNight = true;
        }
      }

      if (!R.sunSet && !R.midnightSun) {
        try {
          var ss2 = Astronomy.SearchRiseSet('Sun', obs, -1, localNoon, 2);
          if (ss2) R.sunSet = ss2.date;
        } catch(e) { console.warn('MoonCalc: extended-window sunSet retry failed:', e.message); }
      }

      try {
        var mr = Astronomy.SearchRiseSet('Moon', obs, 1, localNoon, 1);
        if (mr) R.moonRise = mr.date;
      } catch(e) { console.warn('MoonCalc: moonRise search failed:', e.message); }
      try {
        // v3.5: غروب ماهِ «مرتبط با غروب خورشید». پیش‌تر جست‌وجو از ظهر محلی
        // شروع می‌شد؛ اگر ماه پیش از ظهر محلی غروب کرده بود، غروب روز بعد
        // (حدود ۲۴ ساعت دیرتر) انتخاب و lag بیش از حد بزرگ می‌شد. اکنون
        // پنجره از ۱۲ ساعت پیش از غروب خورشید شروع می‌شود تا نزدیک‌ترین
        // غروب ماه (قبل یا بعد از غروب خورشید) برگردد.
        // مسیر سریع = دقیقاً همان جست‌وجوی نسخه‌ی ۳٫۰٫۲ (یک SearchRiseSet از ظهر محلی).
        // فقط اگر جواب نامعقول بود (نیامد، یا بیش از ۱۰ ساعت بعد از غروب خورشید)
        // با پنجره‌ی «نزدیک‌ترین غروب به غروب خورشید» دوباره جست‌وجو می‌شود.
        // نتیجه: برای نقشه (هزاران فراخوانی) هزینه‌ی اضافه صفر است.
        var ms = Astronomy.SearchRiseSet('Moon', obs, -1, localNoon, 1);
        var implausible = !ms || (R.sunSet && (ms.date.getTime() - R.sunSet.getTime()) > 10 * 3600000);
        if (implausible && R.sunSet) {
          var ms2 = Astronomy.SearchRiseSet('Moon', obs, -1, new Date(R.sunSet.getTime() - 12 * 3600000), 1.5);
          if (ms2) ms = ms2;
        }
        if (ms) R.moonSet = ms.date;
      } catch(e) { console.warn('MoonCalc: moonSet search failed:', e.message); }

      // ----- موقعیت افقی در لحظه‌ی غروب خورشید (برای نمایش "الان") -----
      // این‌ها با شکست جوی (useRefraction=true) هستند چون برای UI
      // نمایش می‌شوند، نه برای فرمول‌های معیار.
      var ref = R.sunSet || localNoon;
      var mH = this.getHorizonCoords(ref, obs, 'Moon', true);
      var sH = this.getHorizonCoords(ref, obs, 'Sun', true);
      if (mH) { R.moonAltitude = mH.altitude; R.moonAzimuth = mH.azimuth; R.moonRA = mH.ra; R.moonDec = mH.dec; }
      if (sH) { R.sunAltitude = sH.altitude; R.sunAzimuth = sH.azimuth; }

      // ----- مقارنه (نه‌ماه) -----
      if (nmDate) {
        R.prevNewMoon = nmDate;
        try {
          var afterNM = new Date(nmDate.getTime() + 28 * 24 * 3600000);
          var nn2 = Astronomy.SearchMoonPhase(0, afterNM, 35);
          if (nn2) R.nextNewMoon = nn2.date;
        } catch(e) { console.warn('MoonCalc: nextNewMoon search failed:', e.message); }
      } else {
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
          if (found) R.prevNewMoon = found.date;
          if (candidate && candidate.date.getTime() >= date.getTime()) {
            R.nextNewMoon = candidate.date;
          }
        } catch(e) { console.warn('MoonCalc: prevNewMoon/nextNewMoon fallback search failed:', e.message); }
      }

      // ----- سن هلال (نسبت به غروب محلی) -----
      if (R.prevNewMoon && R.sunSet) {
        var ageMs = R.sunSet.getTime() - R.prevNewMoon.getTime();
        R.moonAge = ageMs / 3600000;
        R.moonAgeNote = 'ageNoteSunset';
      } else if (R.prevNewMoon && !R.sunSet) {
        var ageMs2 = localNoon.getTime() - R.prevNewMoon.getTime();
        R.moonAge = ageMs2 / 3600000;
        R.moonAgeNote = 'ageNotePolar';
      }

      // ----- lag time (برای پیدا کردن bestTime) -----
      if (R.sunSet && R.moonSet) {
        R.lagTime = (R.moonSet.getTime() - R.sunSet.getTime()) / 60000; // دقیقه
      }

      // ==================================================================
      // F1-2: bestTime و تمام مقادیر مبنای معیار (arcv, W, daz, arcl)
      // اکنون در همین لحظه محاسبه می‌شوند — نه در لحظه‌ی غروب خورشید.
      // طبق تعریف رسمی Yallop/Odeh: Tb = Ts + (4/9)×Lag
      // ==================================================================
      var calcMoment = ref; // fallback: اگر bestTime قابل‌محاسبه نبود، از ref استفاده کن
      if (R.sunSet && R.lagTime !== null && R.lagTime > 0) {
        R.bestTime = new Date(R.sunSet.getTime() + (R.lagTime * 4 / 9) * 60000);
        calcMoment = R.bestTime;
      }

      // مختصات افقی بدون شکست جوی (airless) در calcMoment — این‌ها
      // مبنای تمام معیارهای رؤیت‌اند.
      var mHBest = this.getHorizonCoords(calcMoment, obs, 'Moon', false);
      var sHBest = this.getHorizonCoords(calcMoment, obs, 'Sun', false);
      if (mHBest) { R.moonAltitudeBest = mHBest.altitude; R.moonAzimuthBest = mHBest.azimuth; }
      if (sHBest) { R.sunAltitudeBest = sHBest.altitude; R.sunAzimuthBest = sHBest.azimuth; }
      if (mHBest) R.moonAltBest = mHBest.altitude; // سازگاری با نام قدیمی

      // روشنایی
      try {
        var il = Astronomy.Illumination('Moon', calcMoment);
        if (il) R.illuminationPercent = il.phase_fraction * 100;
      } catch(e) { console.warn('MoonCalc: illumination calc failed:', e.message); }
      try { R.elongation = Astronomy.AngleFromSun('Moon', calcMoment); } catch(e) { console.warn('MoonCalc: elongation calc failed:', e.message); }

      R.topoElongation = this.calcTopoElongation(mHBest, sHBest);

      // موقعیت دایره‌البروجی و فاصله (در calcMoment)
      try {
        var ec = Astronomy.EclipticGeoMoon(calcMoment);
        if (ec) { R.moonEclipticLat = ec.lat; R.moonEclipticLon = ec.lon; }
      } catch(e) { console.warn('MoonCalc: ecliptic coords calc failed:', e.message); }
      try {
        var gv = Astronomy.GeoVector('Moon', calcMoment, true);
        if (gv) R.moonDistance = Math.sqrt(gv.x*gv.x + gv.y*gv.y + gv.z*gv.z) * 149597870.7;
      } catch(e) { console.warn('MoonCalc: moon distance calc failed:', e.message); }
      if (R.moonDistance) R.moonSemiDiam = Math.asin(1737.4 / R.moonDistance) * 180 / Math.PI;

      // ARCV و DAZ — از مقادیر airless در calcMoment
      if (R.moonAltitudeBest !== null && R.sunAltitudeBest !== null) {
        R.arcv = R.moonAltitudeBest - R.sunAltitudeBest;
      }
      if (R.moonAzimuthBest !== null && R.sunAzimuthBest !== null) {
        var rawDaz = R.moonAzimuthBest - R.sunAzimuthBest;
        while (rawDaz > 180) rawDaz -= 360;
        while (rawDaz < -180) rawDaz += 360;
        R.dazSigned = rawDaz;
        R.daz = Math.abs(rawDaz);
        R.relAz = R.dazSigned;
      }

      // arcl (elongation توپوسنتریک) — از topoElongation واقعی
      if (R.topoElongation !== null && R.topoElongation > 0) {
        R.arcl = R.topoElongation;
      } else {
        R.arcl = R.elongation > 0 ? R.elongation : null;
      }

      // عرض هلال W
      var useE = R.arcl;
      if (useE !== null && useE > 0) {
        var eR = useE * Math.PI / 180;
        if (R.moonSemiDiam) {
          R.crescentWidth = (R.moonSemiDiam * 60) * (1 - Math.cos(eR));
        } else {
          // fallback نادر: فقط اگر moonSemiDiam به هر دلیلی محاسبه
          // نشده باشد (مثلاً خطای GeoVector). ۱۵.۵′ = نیم‌قطر ظاهری
          // متوسط ماه (میانگین بین حضیض و اوج مداری) بر حسب دقیقه‌ی
          // قوسی؛ عملاً تقریباً همیشه شاخه‌ی بالا (moonSemiDiam واقعی)
          // اجرا می‌شود.
          R.crescentWidth = 15.5 * (1 - Math.cos(eR));
        }
      }

      // ==============================================================
      // فاز ۱ نسخه ۳ (بازبینی دوم): حد Danjon — دو سطح، با اصلاح مقدار
      // «ابزار نوری» طبق منبع اصلی.
      // منبع: Odeh (astronomycenter.net/pdf/2006_cri.pdf), بخش ۸:
      // «Danjon (1936) دریافت که هلال با فاصله‌ی کمتر از ۷ درجه از
      // خورشید دیده نمی‌شود... Schaefer (1991) حد Danjon ۷ درجه را
      // یافت... از دیتابیس ما یک حد Danjon معادل ۶.۴ درجه به دست
      // آمد... بهترین حد Danjon با ابزار نوری ۶.۴ درجه است.»
      // پیش از این نسخه، آستانه‌ی «ابزار نوری» به‌اشتباه ۴.۵° بود —
      // که در واقع از آخرین نقطه‌ی جدول SAAO (DALT2) کپی شده بود، نه
      // از منبعی که مشخصاً «حد Danjon با ابزار نوری» را گزارش کرده
      // باشد. اصلاح شد به ۶.۴° طبق Odeh.
      // ==============================================================
      if (useE !== null) {
        R.danjonOkNaked = useE >= 7.0;
        R.danjonOkTelescope = useE >= 6.4;
      }
      R.danjonOk = R.danjonOkNaked;

      var arcv = R.arcv;
      var W = R.crescentWidth;
      var elong = useE;
      var age = R.moonAge;
      var daz = R.daz;
      var dazSigned = R.dazSigned;
      var lag = R.lagTime;

      // ===== Yallop (1997) — بدون تغییر، تأیید شده =====
      if (arcv !== null && W !== null && W > 0) {
        R.yallopQ = (arcv - (11.8371 - 6.3226*W + 0.7319*W*W - 0.1018*W*W*W)) / 10;
        if (R.yallopQ > 0.216) R.yallopCat = 'A';
        else if (R.yallopQ > -0.014) R.yallopCat = 'B';
        else if (R.yallopQ > -0.160) R.yallopCat = 'C';
        else if (R.yallopQ > -0.232) R.yallopCat = 'D';
        else if (R.yallopQ > -0.293) R.yallopCat = 'E';
        else R.yallopCat = 'F';
      }

      // ===== F1-3: Odeh (2004/2006) — فرمول و آستانه‌های واقعی =====
      // V = ARCV - (-0.1018W³ + 0.7319W² - 6.3226W + 7.1651)
      // A: V≥5.65   B: 2≤V<5.65   C: -0.96≤V<2   D: V<-0.96
      if (arcv !== null && W !== null && W > 0) {
        var odehOffset = -0.1018*W*W*W + 0.7319*W*W - 6.3226*W + 7.1651;
        var V = arcv - odehOffset;
        if (V >= 5.65) R.odehCat = 'A';
        else if (V >= 2) R.odehCat = 'B';
        else if (V >= -0.96) R.odehCat = 'C';
        else R.odehCat = 'D';
      }

      // ===== F1-4: SAAO / Caldwell & Laney — جدول واقعی DALT/DAZ =====
      // ورودی: ارتفاع لبه‌ی پایین ماه ≈ ارتفاع مرکز ماه - نیم‌قطر ظاهری
      if (R.moonAltitudeBest !== null && daz !== null) {
        var moonLowerLimbAlt = R.moonAltitudeBest - (R.moonSemiDiam || 0.25);
        R.saaoCat = this.calcSAAO(moonLowerLimbAlt, daz);
      }

      // ===== فاز ۱ نسخه ۳ (بازبینی دوم): Ilyas (1988) — بر پایه‌ی
      // فرمول واقعی ArcV(DAZ)، به‌جای Istanbul/Diyanet نامعتبر قبلی
      // و به‌جای تقریب پله‌ای altitude/elongation نسخه‌ی قبل‌تر =====
      if (arcv !== null && daz !== null) {
        R.ilyasCat = this.calcIlyas(daz, arcv);
      }

      // ===== F1-6: MABIMS 2021 (Neo-MABIMS) — به‌جای «Malaysia/JAKIM» قدیمی =====
      // معیار رسمی مصوب ۸ دسامبر ۲۰۲۱: ARCV≥3° و elongation≥6.4°
      // (بدون شرط سن ماه که در نسخه‌ی منسوخ ۱۹۹۸ بود)
      if (arcv !== null && elong !== null) {
        if (arcv >= 3 && elong >= 6.4) R.malaysiaCat = 'B';
        else R.malaysiaCat = 'F';
      }

      // ==============================================================
      // Soroudi ★ نسخه ۴ — «معیار اجماع چند-هندسی»
      // (Multi-Geometric Consensus Criterion)
      //
      // چرا نسخه‌ی قبل (امتیاز وزنی ۰-۱۰۰) کنار گذاشته شد: وزن‌های
      // ۰.۴۵/۰.۲۷/۰.۱۶/۰.۱۲ و آستانه‌های امتیازدهی هیچ‌کدام از داده‌ی
      // رصدی واقعی برازش نشده بودند — دقیقاً همان نقدی که به فیت Odeh
      // وارد است (Muslim500، «the-limitations-of-mediocre-erudition»:
      // فیت Odeh را «بوگوس» می‌خواند چون بدون توجیه کمی به دست آمده).
      // یک امتیاز تازه با وزن‌های تازه، همان خطا را با ضرایب دیگر
      // تکرار می‌کرد.
      //
      // طراحی جدید — دو لایه‌ی مجزا:
      //
      // لایه ۱ («رده‌ی پایه»، soroudiBaseCat): مستقیماً برابر رده‌ی
      // Yallop (yallopCat)، بدون تغییر. Yallop به‌عنوان پایه انتخاب
      // شد چون فرمول q-test آن (astronomycenter.net/pdf/yallop_1997.
      // pdf) با ۲۹۵ رصد واقعی Schaefer کالیبره شده، در ادبیات
      // به‌عنوان دقیق‌ترین فرمول‌بندی کلاسیک شناخته می‌شود (NASA/NTRS
      // Moonwatch: «the best specific formulation being due to
      // Yallop» در میان معیارهای هندسی)، و بر خلاف Odeh دچار شبهه‌ی
      // عدم‌شفافیت در اشتقاق نیست.
      //
      // لایه ۲ («سقف اجماع»): رده‌ی پایه فقط در یک حالت نادر و صریح
      // تعدیل می‌شود — وقتی هر دو شاهد مستقل دیگر (SAAO/Caldwell &
      // Laney 2001 با دیتاست کاملاً متفاوت آفریقای جنوبی؛ و Ilyas
      // 1988 با فرمول هندسی متفاوت ArcV(DAZ)) هر دو رده‌ی F بدهند.
      // در آن حالت رده‌ی پایه به سقف C کاهش می‌یابد. اگر فقط یکی از
      // این دو شاهد F بدهد، سقف به B کاهش می‌یابد. این «سقف» یک
      // ضریب عددی اختراعی نیست؛ فقط از رده‌بندی‌ای استفاده می‌کند که
      // خودِ SAAO و Ilyas از قبل، با منبع علمی مستقل خودشان، تعریف
      // کرده‌اند.
      //
      // درباره‌ی Odeh: در گزارش اجماع نمایش داده می‌شود اما در
      // محاسبه‌ی سقف شرکت نمی‌کند، چون طبق بررسی مستقل (Muslim500) و
      // خود مقاله‌ی Odeh، ضرایب چندجمله‌ای او تا رقم‌های اعشاری
      // نزدیک به ضرایب Yallop است — یعنی این دو معیار «شاهد مستقل»
      // نیستند. شمردن Odeh به‌عنوان شاهد مستقل دوم، به کاربر اطلاعات
      // آماری نادرست («۲ منبع مستقل توافق دارند») می‌دهد در حالی که
      // واقعاً فقط ۱ منبع مستقل هست.
      //
      // درباره‌ی age/lag/elongation: دیگر به‌عنوان امتیاز مستقل جمع
      // زده نمی‌شوند (از نظر آماری با ARCV/W هم‌خط بودند). نقش
      // فیزیکی/تعریفی مطلق‌شان در وتوهای زیر حفظ شده: حد Danjon با
      // ابزار نوری (ARCL < 6.4°, طبق Odeh بخش ۸) و سن/تأخیر منفی
      // (یعنی محاسبه نامعتبر یا مقارنه‌ی نیامده، نه «امتیاز پایین»).
      //
      // محدودیت شفاف این معیار: هم‌چنان یک «اجماع چند-هندسی» است، نه
      // یک مدل فیزیکی کامل (که نیازمند مدل روشنایی گرگ‌ومیش Kastner
      // + آستانه‌ی کنتراست چشم Blackwell/Crumey است) و نه یک مدل
      // آماری برازش‌شده به داده‌ی رصدی جدید (که نیازمند دیتاست رصدی
      // مستقل با cross-validation است). این معیار صرفاً چند فرمول
      // هندسی معتبر و مستقل موجود را با یک قانون شفاف و غیر-اختراعی
      // با هم می‌سنجد.
      // ==============================================================
      if (R.yallopCat) {
        R.soroudiBaseCat = R.yallopCat;

        var saaoIsF = R.saaoCat === 'F';
        var ilyasIsF = R.ilyasCat === 'F';
        var independentAgreeCount = 0;
        var independentTotal = 0;
        if (R.saaoCat) { independentTotal++; if (!saaoIsF) independentAgreeCount++; }
        if (R.ilyasCat) { independentTotal++; if (!ilyasIsF) independentAgreeCount++; }

        var odehAgrees = null;
        if (R.odehCat) odehAgrees = (R.odehCat === 'A' || R.odehCat === 'B' || R.odehCat === 'C');

        R.soroudiAgreement = {
          saao: R.saaoCat ? { cat: R.saaoCat, agrees: !saaoIsF } : null,
          ilyas: R.ilyasCat ? { cat: R.ilyasCat, agrees: !ilyasIsF } : null,
          odeh: R.odehCat ? { cat: R.odehCat, agrees: odehAgrees, caveat: 'odehNotIndependentOfYallop' } : null,
          independentAgreeCount: independentTotal > 0 ? independentAgreeCount : null,
          independentTotal: independentTotal,
        };

        // ----- قانون سقف اجماع (بدون هیچ ضریب اختراعی) -----
        var catRank = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
        var rank = catRank[R.soroudiBaseCat] !== undefined ? catRank[R.soroudiBaseCat] : 0;
        var capRank = null;
        if (saaoIsF && ilyasIsF) capRank = catRank['C']; // هر دو شاهد مستقل: غیرممکن
        else if (saaoIsF || ilyasIsF) capRank = catRank['B']; // یک شاهد مستقل: غیرممکن

        var finalCat = R.soroudiBaseCat;
        var capApplied = false;
        if (capRank !== null && rank > capRank) {
          var rankToCat = ['F','E','D','C','B','A'];
          finalCat = rankToCat[capRank];
          capApplied = true;
        }
        R.soroudiCat = finalCat;
        R.soroudiCapApplied = capApplied;

        // ----- وتوهای فیزیکی/تعریفی مطلق (بدون تغییر در قدرت) -----
        // این‌ها روی هیچ امتیازی عمل نمی‌کنند؛ مستقیماً رده را به F
        // می‌برند چون به‌لحاظ فیزیکی/تعریفی نامعتبرند، نه چون «امتیاز
        // کمی» دارند.
        var hardVeto = false;
        if (useE !== null && useE < 6.4) hardVeto = true; // زیر حد Danjon با ابزار نوری (Odeh بخش ۸)
        if (age !== null && age < 0) hardVeto = true; // مقارنه هنوز رخ نداده
        if (lag !== null && lag < 0) hardVeto = true; // ماه پیش از خورشید غروب می‌کند
        if (hardVeto) R.soroudiCat = 'F';
      }

      // ==============================================================
      // Schaefer (v3.6) — مدل فیزیکی. ورودی‌ها از همان لحظه‌ی bestTime:
      // ارتفاع airless ماه/خورشید، کشیدگی ژئوسنتریک، فاصله‌ی ماه. جو از
      // ارتفاع/عرض جغرافیایی (و در صورت وجود، رطوبت/فشار/AOD واقعی در atmo)
      // برآورد می‌شود. نگاه کنید به schaeferModel.js برای منبع و اعتبارسنجی.
      // ==============================================================
      R._schaeferMoment = calcMoment;
      // نقشه‌ی رؤیت‌پذیری عمداً Schaefer ندارد (نیازمند جوّ واقعیِ هر نقطه است) ⇒ options.skipSchaefer
      if (!(options && options.skipSchaefer)) this._applySchaefer(R, latitude, longitude, elevation, calcMoment, obs, atmo || null);

      R.isVisible = R.yallopCat === 'A' || R.yallopCat === 'B' || R.yallopCat === 'C';
      R.isVisibleNakedEye = R.yallopCat === 'A' || R.yallopCat === 'B';

    } catch(e) { console.error('CALC ERROR:', e); }
    return R;
  },

  // Schaefer روی یک شیء نتیجه (R) اعمال می‌شود. atmo: { humidityPct, pressureHPa, aod, tempC } یا null.
  // هم در getFullMoonData و هم در withAtmosphere (بازمحاسبه با جوی که بعداً رسید) استفاده می‌شود.
  _applySchaefer: function(R, latitude, longitude, elevation, calcMoment, obs, atmo) {
    try {
        var schRes = Schaefer.evaluateFromMoonData(
          { moonAltitudeBest: R.moonAltitudeBest, sunAltitudeBest: R.sunAltitudeBest,
            elongation: R.elongation, moonDistance: R.moonDistance, bestTime: calcMoment },
          { latitude: latitude, longitude: longitude, elevation: elevation },
          atmo
        );
        // Schaefer، R را در «بهترین لحظه‌ی شب» (بیشینه‌ی R) تعریف می‌کند؛ bestTime
        // یالوپ/عوده تقریبی است (≈ ±۶ دقیقه با بهینه‌ی Schaefer). پس چند لحظه‌ی
        // نزدیک هم سنجیده و بیشینه برداشته می‌شود (هزینه‌ی کم: چند محاسبه‌ی افقی).
        if (R.sunSet && R.lagTime !== null && R.lagTime > 0 && schRes) {
          var schSite = { latitude: latitude, longitude: longitude, elevation: elevation };
          var scanSteps = [-30, -20, -10, 10, 20, 30];
          for (var si = 0; si < scanSteps.length; si++) {
            try {
              var tS = new Date(calcMoment.getTime() + scanSteps[si] * 60000);
              if (tS.getTime() < R.sunSet.getTime()) continue;
              var mS = this.getHorizonCoords(tS, obs, 'Moon', false);
              var sS = this.getHorizonCoords(tS, obs, 'Sun', false);
              if (!mS || !sS) continue;
              var elS = Astronomy.AngleFromSun('Moon', tS);
              var rS = Schaefer.evaluateFromMoonData(
                { moonAltitudeBest: mS.altitude, sunAltitudeBest: sS.altitude, elongation: elS,
                  moonDistance: R.moonDistance, bestTime: tS }, schSite, atmo);
              if (rS && rS.valid && (!schRes.valid || rS.R > schRes.R)) { rS.scanOffsetMin = scanSteps[si]; schRes = rS; }
            } catch (eScan) { /* نمونه‌ی منفرد؛ نادیده */ }
          }
        }
        if (schRes && schRes.valid) {
          R.schaefer = schRes;
          R.schaeferR = schRes.R;
          R.schaeferProb = schRes.probability;
          R.schaeferCat = Schaefer.categoryFromR(schRes.R);
        } else if (schRes) {
          R.schaefer = schRes; // دلیل نامعتبر بودن (ماه زیر افق، فاز هلالی نیست)
          if (schRes.reason === 'moonBelowHorizon' || schRes.reason === 'notCrescent') R.schaeferCat = 'F';
        }

    } catch (eS) { console.warn('MoonCalc: Schaefer model failed:', eS.message); }
  },

  // نتیجه‌ی getFullMoonData را با جوی که بعداً رسیده (رطوبت/فشار/AOD/دما) دوباره برای Schaefer
  // محاسبه می‌کند و یک کپی برمی‌گرداند (ورودی تغییر نمی‌کند). بقیه‌ی معیارها دست‌نخورده‌اند.
  withAtmosphere: function(data, latitude, longitude, elevation, atmo) {
    if (!data || !atmo) return data;
    var moment = data._schaeferMoment || data.bestTime;
    if (!moment) return data;
    var R = Object.assign({}, data);
    delete R.schaefer; delete R.schaeferR; delete R.schaeferProb; delete R.schaeferCat;
    var obs = new Astronomy.Observer(latitude, longitude, elevation || 0);
    this._applySchaefer(R, latitude, longitude, elevation || 0, moment, obs, atmo);
    R.schaeferAtmo = atmo;
    return R;
  },

  getCatForCrit: function(data, crit) {
    if (crit === 'yallop') return data.yallopCat || '';
    if (crit === 'odeh') return data.odehCat || '';
    if (crit === 'saao') return data.saaoCat || '';
    if (crit === 'ilyas') return data.ilyasCat || '';
    if (crit === 'malaysia') return data.malaysiaCat || '';
    if (crit === 'soroudi') return data.soroudiCat || '';
    if (crit === 'schaefer') return data.schaeferCat || '';
    return data.yallopCat || '';
  },

  getMultiDayData: function(s, d, la, lo, el) {
    var r = [];
    for (var i = 0; i < d; i++) {
      var dt = new Date(s.getTime() + i * 86400000);
      r.push({ date: dt, data: this.getFullMoonData(dt, la, lo, el) });
    }
    return r;
  },

  // ============================================================
  // v3.5 — لنگر روز تقویمی محلی.
  // getFullMoonData انتظار دارد پارامتر date «ظهر UTC روز تقویمی محلی»
  // باشد (همان قرارداد HomeScreen). هرجا که یک «لحظه‌ی واقعی» داریم
  // (لحظه‌ی رصد، لحظه‌ی مقارنه) باید ابتدا با این تابع به آن لنگر
  // تبدیل شود؛ در غیر این صورت برای طول‌های جغرافیایی غربی/شرقی
  // دور از UTC، غروب «روز بعد» محاسبه می‌شود (باگ ۲۴ ساعت).
  // خروجی: Date در ظهر UTC همان روز تقویمیِ محلی (با منطقه‌ی زمانی واقعی
  // محل، نه فقط طول جغرافیایی). dayOffset به روز تقویمی اضافه می‌شود.
  // ============================================================
  getLocalDayAnchor: function(instant, lat, lon, dayOffset) {
    var off = dayOffset || 0;
    var y, m, d;
    try {
      var tz = tzlookup(lat, lon);
      var mm = moment(instant).tz(tz);
      y = mm.year(); m = mm.month(); d = mm.date();
    } catch (e) {
      // fallback: ساعت خورشیدی محلی از روی طول جغرافیایی
      var shifted = new Date(instant.getTime() + Math.max(-12*60, Math.min(12*60, lon * 4)) * 60000);
      y = shifted.getUTCFullYear(); m = shifted.getUTCMonth(); d = shifted.getUTCDate();
    }
    return new Date(Date.UTC(y, m, d + off, 12, 0, 0));
  },

  // v3.5 — تبدیل «ساعت دیواریِ محل رصد» (سال/ماه/روز/ساعت/دقیقه) به لحظه‌ی
  // واقعی. فرم گزارش پیش‌تر ساعت را با منطقه‌ی زمانی «دستگاه» تفسیر می‌کرد؛
  // اگر کاربر برای شهر دیگری گزارش می‌داد، لحظه‌ی UTC اشتباه می‌شد.
  // اگر مختصات نباشد، منطقه‌ی زمانی دستگاه استفاده می‌شود.
  wallClockToInstant: function(y, mo, d, h, mi, lat, lon) {
    if (lat !== null && lat !== undefined && lon !== null && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      try {
        var tz = tzlookup(lat, lon);
        var m = moment.tz([y, mo - 1, d, h, mi, 0, 0], tz);
        if (m.isValid()) return m.toDate();
      } catch (e) { console.warn('MoonCalc: wallClockToInstant tz failed:', e.message); }
    }
    return new Date(y, mo - 1, d, h, mi, 0, 0);
  },

  formatTime: function(d, lat, lon) {
    if (!d) return '---';
    if (lat !== undefined && lon !== undefined) {
      try {
        var tz = tzlookup(lat, lon);
        return moment(d).tz(tz).format('HH:mm:ss');
      } catch(e) { console.warn('MoonCalc: formatTime tz lookup failed:', e.message); }
    }
    return moment(d).utc().format('HH:mm:ss') + ' (UTC)';
  },

  formatTimeHM: function(d, lat, lon) {
    if (!d) return '---';
    if (lat !== undefined && lon !== undefined) {
      try {
        var tz = tzlookup(lat, lon);
        return moment(d).tz(tz).format('HH:mm');
      } catch(e) { console.warn('MoonCalc: formatTimeHM tz lookup failed:', e.message); }
    }
    return moment(d).utc().format('HH:mm') + ' (UTC)';
  },

  // ------------------------------------------------------------
  // F1-7: توابع فرمت با carry صحیح — رفع باگ «60m»/«60″»
  // ------------------------------------------------------------
  formatDegree: function(v) {
    if (v === null || v === undefined) return '---';
    var sign = v < 0 ? '-' : '';
    var totalSeconds = Math.round(Math.abs(v) * 3600); // گرد کردن یک‌بار، در پایین‌ترین واحد
    var d = Math.floor(totalSeconds / 3600);
    var remSec = totalSeconds % 3600;
    var mn = Math.floor(remSec / 60);
    var sc = remSec % 60;
    return sign + d + '° ' + mn + "' " + sc + '"';
  },

  formatDegreeDM: function(v) {
    if (v === null || v === undefined) return '---';
    var sign = v < 0 ? '-' : '';
    var totalMinutes = Math.round(Math.abs(v) * 60); // گرد کردن یک‌بار
    var d = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    return sign + d + '° ' + m + "'";
  },

  formatDuration: function(m) {
    if (m === null || m === undefined) return '---';
    var sign = m < 0 ? '-' : '';
    var totalMinutes = Math.round(Math.abs(m)); // گرد کردن یک‌بار در واحد دقیقه
    var h = Math.floor(totalMinutes / 60);
    var mn = totalMinutes % 60;
    if (h > 0) return sign + h + 'h ' + mn + 'm';
    return sign + mn + 'm';
  },

  formatAge: function(h, note) {
    if (h === null || h === undefined) return '---';
    var sign = h < 0 ? '-' : '';
    var totalMinutes = Math.round(Math.abs(h) * 60); // گرد کردن یک‌بار در واحد دقیقه
    var hr = Math.floor(totalMinutes / 60);
    var mn = totalMinutes % 60;
    var base = sign + hr + 'h ' + mn + 'm';
    if (note) return base + ' *';
    return base;
  },

  getCatColor: function(c) {
    if (c === 'A') return '#00CC44';
    if (c === 'B') return '#88DD00';
    if (c === 'C') return '#FFAA00';
    if (c === 'D') return '#FF6600';
    if (c === 'E') return '#FF2200';
    if (c === 'F') return '#CC0000';
    return '#666666';
  },

  // ==============================================================
  // فاز ۱ نسخه ۳ (بازبینی ششم): پشتیبانی سه‌زبانه برای رده‌های
  // per-criterion — رفع یک رگرسیون که در بازبینی پنجم ایجاد شده بود.
  //
  // ایراد بازبینی پنجم: getCatText/getCatTextFull متن فارسی را
  // مستقیماً و به‌صورت hardcoded برمی‌گرداندند. این باعث می‌شد
  // کاربران عربی/انگلیسی (اپ سه‌زبانه است — نگاه کنید به
  // translations.js و LanguageContext.js) برای رده‌های معیارها
  // همیشه متن فارسی ببینند، صرف‌نظر از زبان انتخابی‌شان — یک
  // رگرسیون در ترجمه‌پذیری اپ.
  //
  // راه‌حل: این دو تابع جدید (getCatTextKey/getCatTextFullKey) به‌
  // جای متن نهایی، فقط کلید ترجمه را برمی‌گردانند (مثلاً
  // 'crit_yallop_catD')، دقیقاً هم‌نام با کلیدهایی که در
  // translations.js برای هر سه زبان (fa/ar/en) اضافه شده‌اند. کد
  // UI (HomeScreen.js/MapScreen.js) این کلید را از این‌جا می‌گیرد و
  // با t(key) از LanguageContext می‌خواند — همان مسیر عادی ترجمه‌ی
  // بقیه‌ی اپ. توابع قدیمی getCatText/getCatTextFull زیر همچنان
  // نگه داشته شده‌اند، اما فقط برای مصرف‌کننده‌هایی که به t() دسترسی
  // ندارند (مثل hijriCalendar.js که یک رشته‌ی متن ساده برای گزارش/
  // اشتراک‌گذاری می‌سازد، خارج از درخت کامپوننت‌های React) — آن‌ها
  // فقط فارسی برمی‌گردانند و باید به‌عنوان fallback در نظر گرفته
  // شوند، نه منبع اصلی برای UI چندزبانه.
  // ==============================================================
  getCatTextKey: function(c, crit) {
    // نسخه‌ی به‌روز (پس از تغییر calcIlyas): برای Ilyas، مقدار خالی
    // (calcIlyas که null برگردانده) یک حالت شناخته‌شده و مورد
    // انتظار است — یعنی «DAZ خارج از بازه‌ی معتبر فرمول Ilyas
    // (1988) است»، نه یک خطای عمومی/نامشخص مثل بقیه‌ی معیارها. اگر
    // این حالت هم با کلید عمومی catUnknown نمایش داده شود، کاربر
    // فکر می‌کند مشکلی در محاسبه رخ داده، در حالی که این معیار
    // صراحتاً و به‌درستی دارد می‌گوید «اینجا قابل‌اعمال نیستم».
    if (!c && crit === 'ilyas') return 'catIlyasOutOfRange';
    if (!c) return 'catUnknown';
    var validLetters = {
      yallop: ['A','B','C','D','E','F'],
      odeh: ['A','B','C','D'],
      saao: ['B','C','F'],
      // Ilyas (1988) فقط یک خط مرزی دوحالته دارد (رؤیت با چشم:
      // بله/خیر) — ناحیه‌ی C («فقط با ابزار نوری») در نسخه‌ی قبلی
      // این پیاده‌سازی به‌اشتباه اضافه شده بود و حذف شد؛ منبع اصلی
      // چنین ناحیه‌ای تعریف نمی‌کند.
      ilyas: ['B','F'],
      malaysia: ['B','F'],
      // Soroudi نسخه ۴: soroudiBaseCat مستقیماً برابر yallopCat است و
      // سقف اجماع فقط می‌تواند رده را به سمت F پایین بیاورد (هرگز رده‌ی
      // خارج از بازه‌ی A-F یالوپ تولید نمی‌کند)، پس بازه‌ی معتبر باید
      // دقیقاً با یالوپ یکسان باشد (شامل E).
      soroudi: ['A','B','C','D','E','F'],
      schaefer: ['A','B','C','D','E','F'],
    };
    if (crit && validLetters[crit] && validLetters[crit].indexOf(c) !== -1) {
      return 'crit_' + crit + '_cat' + c;
    }
    return 'catUnknown';
  },

  getCatTextFullKey: function(c, crit) {
    if (!c && crit === 'ilyas') return 'catIlyasOutOfRangeFull';
    if (!c) return '';
    var validLetters = {
      yallop: ['A','B','C','D','E','F'],
      odeh: ['A','B','C','D'],
      saao: ['B','C','F'],
      ilyas: ['B','F'],
      malaysia: ['B','F'],
      soroudi: ['A','B','C','D','E','F'],
      schaefer: ['A','B','C','D','E','F'],
    };
    if (crit && validLetters[crit] && validLetters[crit].indexOf(c) !== -1) {
      return 'crit_' + crit + '_cat' + c + 'Full';
    }
    return '';
  },

  // ==============================================================
  // فاز ۱ نسخه ۳ (بازبینی پنجم): جداسازی کامل معنی رده‌های A-F بر
  // اساس معیار — رفع یک باگ طراحی مهم.
  //
  // ایراد قبلی: getCatText/getCatTextFull فقط حرف رده (مثلاً 'D')
  // را می‌گرفتند و یک متن ثابت و یکسان برای همه‌ی معیارها برمی‌
  // گرداندند. اما همان حرف در معیارهای مختلف معنی متفاوتی دارد —
  // مثلاً D در Yallop به معنی «فقط با ابزار نوری، بسیار دشوار» است
  // (نزدیک به حد Danjon)، در حالی که D در Odeh یعنی «کاملاً غیرقابل
  // رؤیت، حتی با ابزار نوری». نمایش یک متن مشترک برای هر دو، کاربر
  // را به این باور غلط می‌رساند که این دو رده یک چیز هستند.
  //
  // توجه (بازبینی ششم): این دو تابع (getCatText/getCatTextFull)
  // اکنون فقط fallback فارسی هستند — برای UI چندزبانه از
  // getCatTextKey/getCatTextFullKey به همراه t() استفاده کنید (بالا
  // را ببینید). منبع دقیق هر تعریف (بدون تغییر از بازبینی پنجم):
  //
  // Yallop (1997) — نقل مستقیم از Table 5 مقاله‌ی اصلی

  // (astronomycenter.net/pdf/yallop_1997.pdf), بخش ۶:
  //   A: Easily visible (ARCL ≥ 12°)
  //   B: Visible under perfect conditions
  //   C: May need optical aid to find crescent
  //   D: Will need optical aid to find crescent
  //   E: Not visible with a telescope (ARCL ≤ 8.5°)
  //   F: Not visible, below Danjon limit (ARCL ≤ 8°)
  //
  // Odeh (2004/2006) — نقل مستقیم از astronomycenter.net/pdf/2006_cri.pdf،
  // بخش ۵:
  //   A (ARCV ≥ ARCV3): Crescent is visible by naked eyes
  //   B (ARCV ≥ ARCV2): Crescent is visible by optical aid, and it
  //      could be seen by naked eyes
  //   C (ARCV ≥ ARCV1): Crescent is visible by optical aid only
  //   D (ARCV < ARCV1): Crescent is not visible even by optical aid
  //   (توجه: Odeh فقط ۴ رده دارد؛ E/F در این معیار تعریف نشده)
  //
  // SAAO / Caldwell & Laney (2001) — نقل از همان بخش ۵ مقاله‌ی Odeh
  // که جدول Table IV را توضیح می‌دهد: «If the crescent is below
  // DALT2, naked-eye visibility will be improbable. Visibility with
  // optical aid may be possible... Below DALT1, visibility is
  // impossible even with optical aid.» این معیار ذاتاً فقط ۳ رده
  // دارد (نه A، نه D):
  //   B: بالای DALT2 — رؤیت با چشم غیرمسلح محتمل
  //   C: بین DALT1 و DALT2 — فقط با ابزار نوری ممکن (و حتی این هم
  //      هرچه به DALT1 نزدیک‌تر، نامحتمل‌تر)
  //   F: زیر DALT1 — غیرممکن حتی با ابزار نوری
  //
  // Ilyas (1988) — منبع فقط یک خط مرزی تک‌سطحی رؤیت با چشم می‌دهد
  // (نگاه کنید به کامنت بالای calcIlyas). رده‌ی C اینجا قرارداد خود
  // این پیاده‌سازی است، نه بخشی از منبع اصلی:
  //   B: بالای خط مرزی ArcV_min(DAZ) — رؤیت با چشم محتمل (طبق منبع)
  //   C: زیر خط مرزی چشم، در محدوده‌ی حاشیه‌ی ۲° — فقط با ابزار
  //      نوری (قرارداد این پیاده‌سازی، نه ادعای Ilyas)
  //   F: پایین‌تر از آن — غیرقابل رؤیت
  //
  // Neo-MABIMS 2021 — یک آزمون قبول/رد ساده است (نگاه کنید به کامنت
  // calcMalaysia)، نه رده‌بندی چندسطحی. B/F این‌جا فقط برچسب قبول/رد
  // هستند، بدون معنی «رصد آسان» یا «رصد سخت»:
  //   B: هر دو شرط رسمی برقرار است (ARCV≥3° و Elongation≥6.4°)
  //   F: حداقل یکی از دو شرط برقرار نیست
  //
  // Soroudi ★ — معیار پیشنهادی و ابداعی خود این پیاده‌سازی (غیررسمی،
  // ترکیبی از وزن‌دهی چند معیار دیگر)؛ رده‌های A-D/F هم قرارداد خود
  // این اپ هستند، بر مبنای بازه‌ی امتیاز ۰-۱۰۰:
  //   A: امتیاز ≥ ۷۵    B: امتیاز ۵۵-۷۴    C: امتیاز ۳۵-۵۴
  //   D: امتیاز ۱۸-۳۴   F: امتیاز < ۱۸ یا veto شده
  // ==============================================================
  // v3.5: getCatText/getCatTextFull (متن فارسیِ ثابت، بدون هیچ مصرف‌کننده) حذف شد؛
  // متن رده‌ها از getCatTextKey + t() ترجمه می‌شود.

  getCritLabel: function(crit) {
    if (crit === 'yallop') return 'Yallop (1997)';
    if (crit === 'odeh') return 'Odeh (2004/2006)';
    if (crit === 'saao') return 'SAAO / Caldwell & Laney (2001)';
    if (crit === 'ilyas') return 'Ilyas (1988)';
    if (crit === 'malaysia') return 'MABIMS 2021';
    if (crit === 'soroudi') return 'Soroudi ★';
    if (crit === 'schaefer') return 'Schaefer (1988/1993)';
    return crit;
  },

  // v3.5: توضیح معیار با کلید ترجمه (critDesc_<id>)؛ t همان تابع ترجمه‌ی اپ است.
  getCritDescription: function(crit, t) {
    if (typeof t !== 'function') return '';
    var known = { yallop: 1, odeh: 1, saao: 1, ilyas: 1, malaysia: 1, soroudi: 1, schaefer: 1 };
    return known[crit] ? t('critDesc_' + crit) : '';
  },
};

module.exports = MoonCalculator;