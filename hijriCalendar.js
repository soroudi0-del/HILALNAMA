var Astronomy = require('astronomy-engine');

// ============================================================
// نسخه ۳ — بازنویسی تقویم هجری
//
// ---- فاز ۱ نسخه ۳ ----
// F1-9: رفع باگ بحرانی «شماره‌گذاری روز قمری یک روز جلوتر از تقویم
//       رسمی». علت: formatHijri از estimateHijri (یک فرمول تبولار
//       قراردادی، مستقل از مقارنه‌ی نجومی واقعی محاسبه‌شده در همان
//       صفحه) استفاده می‌کرد، در حالی که نام ماه از منطق نجومی واقعی
//       (findPrevNewMoon) می‌آمد. این دو منبع مستقل بودند و می‌توانستند
//       با هم ناسازگار باشند.
//       راه‌حل: تابع جدید formatHijriFromConjunction که شماره‌ی روز
//       را مستقیماً از فاصله‌ی روزانه‌ی تاریخ هدف تا مقارنه‌ی مبنا
//       (prevNewMoon) محاسبه می‌کند — همان مبنایی که در moonPosition.js
//       برای moonAge استفاده می‌شود. estimateHijri همچنان به عنوان
//       fallback برای مواردی که مقارنه در دسترس نیست نگه داشته شده
//       (مثلاً نمایش سریع تاریخ امروز پیش از بارگذاری داده‌ی نجومی)
//       اما دیگر هرگز برای محاسبات دقیق رؤیت‌محور استفاده نمی‌شود.
// F1-10: رفع باگ «کارت روز مقارنه یک روز اشتباه (UTC به‌جای محلی)».
//       علت: buildDays در HomeScreen.js با setUTCHours(12) روی لحظه‌ی
//       مقارنه، تاریخ را به روز تقویمی UTC می‌چسباند، نه روز تقویمی
//       محلی رصدگر. اگر مقارنه نزدیک نیمه‌شب UTC رخ دهد (که برای
//       مناطقی مثل ایران، با اختلاف UTC+3:30، خیلی رایج است)، روز
//       تقویمی محلی و روز تقویمی UTC می‌توانند متفاوت باشند.
//       راه‌حل: تابع toLocalCalendarDay که یک لحظه‌ی UTC و افست
//       منطقه‌ی زمانی (به دقیقه) می‌گیرد و روز تقویمی محلی صحیح را
//       برمی‌گرداند. این تابع باید در buildDays (HomeScreen.js)
//       جایگزین منطق فعلی شود.
// ============================================================

var HijriCalendar = {

  hijriMonths: ['محرم','صفر','ربیع‌الاول','ربیع‌الثانی','جمادی‌الاول','جمادی‌الثانی','رجب','شعبان','شهر رمضان','شوال','ذیقعده','ذیحجه'],
  weekDays: ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'],
  persianMonths: ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'],
  gregorianMonths: ['January','February','March','April','May','June','July','August','September','October','November','December'],

  getNextNewMoon: function(d) {
    try { var r = Astronomy.SearchMoonPhase(0, d, 40); return r ? r.date : null; }
    catch(e) { return null; }
  },

  // ------------------------------------------------------------
  // رفع باگ ریشه‌ای (نسخه ۳ — فاز ۳-ه): این تابع قبلاً از نقطه‌ی
  // d - 35 روز جستجو را شروع می‌کرد. مشکل: دوره‌ی سینودیک واقعی ماه
  // ~۲۹.۵۳ روز است — یعنی ۳۵ روز *بزرگ‌تر* از یک ماه قمری کامل است.
  // در نتیجه، بسته به این‌که دقیقاً چه زمانی از ماه هستیم، ممکن بود
  // بازه‌ی جست‌وجوی [d-35, d+5] دو مقارنه‌ی متوالی را همزمان در بر
  // بگیرد؛ چون SearchMoonPhase «اولین» فاز صفر بعد از نقطه‌ی شروع
  // را برمی‌گرداند (نه لزوماً نزدیک‌ترین به d)، در این حالت‌های مرزی
  // تابع مقارنه‌ی ماه *ماقبل* (نامرتبط) را به‌جای مقارنه‌ی درست
  // برمی‌گرداند — که باعث می‌شد فاصله‌ی محاسبه‌شده تا رصد، به‌جای
  // چند ساعت، حدود یک ماه کامل (~۷۰۰ ساعت) به نظر برسد و خطای
  // AFTER_WINDOW نمایش داده شود، حتی برای رصدهای کاملاً معتبر (مثال
  // مستند: مقارنه ۲۳ تیر ۱۴۰۵ ساعت ۱۳:۱۴ + رصد غروب ۲۴ تیر، که فقط
  // ~۲۷ ساعت فاصله دارند، به‌اشتباه AFTER_WINDOW می‌گرفت).
  //
  // راه‌حل: پنجره‌ی جست‌وجو را به ۲۷ روز (کوچک‌تر از دوره‌ی سینودیک)
  // کاهش می‌دهیم تا تضمین شود حداکثر یک مقارنه در بازه‌ی جست‌وجوی
  // رو-به-جلوی SearchMoonPhase (که ۴۰ روز طول می‌کشد) قرار می‌گیرد.
  // علاوه بر آن، نتیجه اعتبارسنجی می‌شود (باید <= d باشد، وگرنه یعنی
  // d خودش قبل از نزدیک‌ترین مقارنه است) و در صورت نامعتبر بودن،
  // با نقطه‌ی شروع عقب‌تری (۴۰ روز) دوباره تلاش می‌شود — این حالت
  // مرزی «رصد ادعاشده قبل از هر مقارنه‌ای» را هم درست پوشش می‌دهد
  // (نتیجه‌اش باید مقارنه‌ی ماه ماقبل باشد تا validateSightingWindow
  // به‌درستی BEFORE_CONJUNCTION/AFTER_WINDOW را تشخیص دهد).
  // ------------------------------------------------------------
  getPrevNewMoon: function(d) {
    try {
      var dMs = d.getTime();
      var s = new Date(dMs - 27*24*3600000);
      var r = Astronomy.SearchMoonPhase(0, s, 40);
      if (r && r.date.getTime() <= dMs) return r.date;

      // fallback: نتیجه نامعتبر بود (جلوتر از d) — یعنی d به مقارنه‌ی
      // نزدیک هنوز نرسیده؛ از نقطه‌ی عقب‌تری امتحان می‌کنیم تا مقارنه‌ی
      // واقعاً قبلی (نه بعدی) پیدا شود.
      var s2 = new Date(dMs - 40*24*3600000);
      var r2 = Astronomy.SearchMoonPhase(0, s2, 40);
      if (r2 && r2.date.getTime() <= dMs) return r2.date;

      return null;
    } catch(e) { return null; }
  },

  toJalali: function(gy, gm, gd) {
    var g = [0,31,59,90,120,151,181,212,243,273,304,334];
    var jy = (gy <= 1600) ? 0 : 979;
    gy = (gy <= 1600) ? (gy - 621) : (gy - 1600);
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = (365*gy) + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) - 80 + gd + g[gm-1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { year: jy, month: jm, day: jd };
  },

  // ==============================================================
  // فاز ۳-د: تبدیل شمسی به میلادی — معکوس دقیق toJalali، با همان
  // الگوریتم مرجع (تقویم جلالی ۳۳ساله). لازم برای فرم ثبت گزارش
  // استهلال که کاربر می‌تواند تاریخ رصد را به‌صورت شمسی وارد کند و
  // اپ باید آن را به Date واقعی (برای اعتبارسنجی بازه‌ی ۶۰ساعته و
  // محاسبات نجومی) تبدیل کند.
  // ==============================================================
  toGregorian: function(jy, jm, jd) {
    var gy = (jy <= 979) ? 621 : 1600;
    jy = (jy <= 979) ? jy : (jy - 979);
    var days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    var gd = days + 1;
    var salA = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm;
    for (gm = 0; gm < 13; gm++) {
      var v = salA[gm];
      if (gd <= v) break;
      gd -= v;
    }
    return { year: gy, month: gm, day: gd };
  },

  // تبدیل مستقیم تاریخ شمسی به شیء Date جاوااسکریپت (با ساعت/دقیقه
  // اختیاری، پیش‌فرض نیمه‌شب محلی)
  jalaliToDate: function(jy, jm, jd, hour, minute) {
    var g = this.toGregorian(jy, jm, jd);
    return new Date(g.year, g.month - 1, g.day, hour || 0, minute || 0);
  },

  formatJalali: function(date) {
    if (!date) return '---';
    var j = this.toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return j.day + ' ' + this.persianMonths[j.month - 1] + ' ' + j.year;
  },

  formatJalaliShort: function(date) {
    if (!date) return '---';
    var j = this.toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return j.year + '/' + j.month + '/' + j.day;
  },

  formatGregorian: function(date) {
    if (!date) return '---';
    return date.getDate() + ' ' + this.gregorianMonths[date.getMonth()] + ' ' + date.getFullYear();
  },

  // ------------------------------------------------------------
  // فاز ۳-ه: فرمت ساعت:دقیقه (پد شده با صفر) از یک شیء Date محلی.
  // لازم برای نمایش ساعت دقیق رصد در جزئیات گزارش (BrowseReportsScreen).
  // ------------------------------------------------------------
  formatTime: function(date) {
    if (!date) return '---';
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  },

  // تاریخ شمسی + ساعت رصد در یک رشته‌ی واحد (مثلاً «۲۴ تیر ۱۴۰۵ — ۲۰:۱۵»)
  formatJalaliDateTime: function(date) {
    if (!date) return '---';
    return this.formatJalali(date) + ' — ' + this.formatTime(date);
  },

  // نسخه ۳ — فاز ۳-و: معادل formatJalaliDateTime برای تاریخ میلادی —
  // لازم برای نمایش تاریخ میلادی رصد در کنار شمسی در جزئیات گزارش
  // (طبق درخواست کاربر: «حتماً باید تاریخ میلادی هم ثبت گردد»).
  formatGregorianDateTime: function(date) {
    if (!date) return '---';
    return this.formatGregorian(date) + ' — ' + this.formatTime(date);
  },

  getWeekDay: function(date) {
    if (!date) return '---';
    return this.weekDays[date.getDay()];
  },

  // ------------------------------------------------------------
  // F1-10: چسباندن یک لحظه‌ی UTC به روز تقویمی محلی صحیح.
  // برخلاف setUTCHours(12) که همیشه روز تقویمی UTC را مبنا می‌گیرد،
  // این تابع افست منطقه‌ی زمانی (به دقیقه، مثبت شرق گرینویچ) را
  // اعمال می‌کند تا روز تقویمی که رصدگر محلی واقعاً در آن است
  // به‌دست بیاید، سپس آن را به ساعت ۱۲ ظهر UTC همان روز می‌چسباند
  // (برای پایداری محاسبات بعدی، نه برای دقت لحظه‌ای).
  // ------------------------------------------------------------
  toLocalCalendarDay: function(utcMoment, tzOffsetMinutes) {
    var offset = tzOffsetMinutes || 0;
    var localMs = utcMoment.getTime() + offset * 60000;
    var localDate = new Date(localMs);
    // روز تقویمی محلی را با ساعت ۱۲:۰۰ UTC می‌سازیم (پایدار برای
    // محاسبات بعدی، مستقل از ساعت دقیق).
    var y = localDate.getUTCFullYear();
    var m = localDate.getUTCMonth();
    var d = localDate.getUTCDate();
    return new Date(Date.UTC(y, m, d, 12, 0, 0));
  },

  // ------------------------------------------------------------
  // F1-9: fallback تبولار — فقط برای مواردی که مقارنه‌ی واقعی در
  // دسترس نیست (مثلاً نمایش سریع پیش از بارگذاری). هرگز نباید
  // برای گزارش رسمی رؤیت هلال استفاده شود.
  // ------------------------------------------------------------
  estimateHijri: function(date) {
    var jd = Math.floor((date.getTime() / 86400000) + 2440587.5);
    var l = jd - 1948440 + 10632;
    var n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    var m = Math.floor((24 * l) / 709);
    var d = l - Math.floor((709 * m) / 24);
    var y = 30 * n + j - 30;
    return { year: y, month: m, day: d };
  },

  // fallback قدیمی — دیگر در مسیر اصلی اپ استفاده نمی‌شود، فقط
  // برای سازگاری با کدهای قدیمی‌تر نگه داشته شده.
  formatHijri: function(date) {
    if (!date) return '---';
    var h = this.estimateHijri(date);
    return h.day + ' ' + this.hijriMonths[h.month - 1] + ' ' + h.year;
  },

  // ==============================================================
  // F1-9: تابع اصلی و صحیح برای نمایش تاریخ قمری در مسیر رؤیت‌محور.
  //
  // ورودی:
  //   targetDate  - روزی که می‌خواهیم شماره‌اش را نشان دهیم (مثلاً
  //                 یکی از چهار روز dayBefore/dayConjunction/
  //                 dayAfter/twoDaysAfter در HomeScreen)
  //   conjunction - لحظه‌ی مقارنه‌ی مبنا (prevNewMoon واقعی که خودِ
  //                 moonPosition.js هم برای moonAge استفاده می‌کند)
  //   monthIndex  - شماره‌ی ماه قمری‌ای که این مقارنه آغازگر آن است
  //                 (۱=محرم ... ۱۲=ذیحجه) — از getNextHijriMonth یا
  //                 منطق مشابه در HomeScreen گرفته می‌شود
  //   hijriYear   - سال قمری متناظر
  //
  // منطق: شماره‌ی روز = (فاصله‌ی روزانه‌ی targetDate از conjunction) + 1
  // این دقیقاً همان مبنایی است که moonAge از آن مشتق می‌شود، پس این
  // دو مقدار دیگر هرگز نمی‌توانند با هم ناسازگار باشند.
  //
  // ⚠️ نسخه ۳ — فاز ۳-ط: این تابع دیگر نباید برای نمایش کاربرِنهایی
  // استفاده شود. علت: شماره‌ی روزی که این‌جا محاسبه می‌شود صرفاً
  // فاصله‌ی خطی روزانه از لحظه‌ی مقارنه‌ی نجومی است — نه شماره‌ی
  // روز واقعی/شرعی تقویم قمری، که همیشه به رؤیت واقعی هلال وابسته
  // است (نه به یک فرمول نجومی خام). مثال مستند از کاربر: وقتی هلال
  // در روز مقارنه اصلاً قابل‌رؤیت نبوده، این تابع همچنان «۱ صفر»
  // نشان می‌داد؛ وقتی هلال در غروب روز دوم دیده می‌شد (که باید
  // ماه رسمی از همان‌جا شروع و روز بعدش «۲ صفر» باشد)، این تابع
  // «۳ صفر» نشان می‌داد. چون اپ هیچ داده‌ی رؤیت واقعی/تأییدشده‌ای
  // جمع‌آوری نمی‌کند که این عدد را درست بسازد، به‌جای این تابع باید
  // از formatHijriMonthYear (پایین‌تر) استفاده شود که فقط نام ماه و
  // سال را برمی‌گرداند، بدون شماره‌ی روز گمراه‌کننده. این تابع فقط
  // برای سازگاری با فراخوان‌های احتمالی دیگر نگه داشته شده و آگاهانه
  // حذف نشده، اما مصرف‌کننده‌های شناخته‌شده‌اش (HomeScreen.js،
  // sightingReports.js) دیگر آن را صدا نمی‌زنند.
  // ==============================================================
  formatHijriFromConjunction: function(targetDate, conjunction, monthIndex, hijriYear) {
    if (!targetDate || !conjunction) return '---';
    var msPerDay = 86400000;
    // هر دو را به روز تقویمی محلی (ساعت 12 UTC ثابت) گرد می‌کنیم تا
    // فقط تفاوت روز شمرده شود، نه ساعت دقیق.
    var dayIndex = Math.round((targetDate.getTime() - conjunction.getTime()) / msPerDay);
    var dayNumber = dayIndex + 1; // روز مقارنه خودش = روز اول ماه جدید
    if (dayNumber < 1) dayNumber = 1; // ایمنی در برابر خطای ورودی
    var monthName = this.hijriMonths[(monthIndex - 1 + 12) % 12];
    return dayNumber + ' ' + monthName + ' ' + hijriYear;
  },

  // ==============================================================
  // نسخه ۳ — فاز ۳-ط: جایگزین سالم formatHijriFromConjunction — فقط
  // نام ماه قمری و سال را برمی‌گرداند (مثلاً «صفر ۱۴۴۸»)، بدون
  // شماره‌ی روز. مناسب هر جایی که پیش‌تر formatHijriFromConjunction
  // برای نمایش کاربرِنهایی استفاده می‌شد (HomeScreen، hijriDate در
  // گزارش‌های sightingReports.js)، چون نام/سال ماه — برخلاف شماره‌ی
  // روز — مستقل از رؤیت واقعی و صرفاً حاصل شمارش چرخه‌ی مقارنه‌های
  // پیاپی است، پس هرگز گمراه‌کننده نیست.
  // ==============================================================
  formatHijriMonthYear: function(monthIndex, hijriYear) {
    if (!monthIndex || !hijriYear) return '---';
    var monthName = this.hijriMonths[(monthIndex - 1 + 12) % 12];
    return monthName + ' ' + hijriYear;
  },

  getNextHijriMonth: function(date) {
    var h = this.estimateHijri(date);
    var nm = h.month + 1;
    var ny = h.year;
    if (nm > 12) { nm = 1; ny++; }
    return { month: nm, year: ny, name: this.hijriMonths[nm - 1] };
  },

  getMoonPhases: function(d) {
    try {
      var nm = Astronomy.SearchMoonPhase(0, d, 40);
      var fq = Astronomy.SearchMoonPhase(90, d, 40);
      var fm = Astronomy.SearchMoonPhase(180, d, 40);
      var lq = Astronomy.SearchMoonPhase(270, d, 40);
      return {
        newMoon: nm ? nm.date : null,
        firstQuarter: fq ? fq.date : null,
        fullMoon: fm ? fm.date : null,
        lastQuarter: lq ? lq.date : null,
      };
    } catch(e) {
      return { newMoon: null, firstQuarter: null, fullMoon: null, lastQuarter: null };
    }
  },

  // v3.5: generateReport (متن فارسیِ ثابت، بدون مصرف‌کننده) حذف شد.
};

module.exports = HijriCalendar;