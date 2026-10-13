// ============================================================
// نسخه ۷ (اپ 3.5) — بازنویسی پایداری سرویس اعلان محلی.
//
// تغییرات 3.5 (رفع «تا یک بار خاموش/روشن نشود کار نمی‌کند»):
//   ۱. ساخت کانال اعلان اندروید (HIGH) پیش از هر درخواست مجوز — در اندروید
//      ۱۳+ بدون کانال ممکن است پنجره‌ی مجوز اصلاً نمایش داده نشود.
//   ۲. هیچ درخواست مجوزی دیگر به‌صورت پنهان از Home انجام نمی‌شود؛ Home فقط
//      بی‌صدا هم‌گام‌سازی می‌کند (syncSchedule). مجوز با اقدام صریح کاربر
//      (Settings) یا یک پرسش یک‌باره (maybeAskOnce) گرفته می‌شود.
//   ۳. قفل ترتیبی (mutex) روی زمان‌بندی: دو اجرای هم‌زمان دیگر اعلان‌های
//      یکدیگر را لغو نمی‌کنند. امضای زمان‌بندی از اجرای تکراریِ بی‌مورد
//      جلوگیری می‌کند.
//   ۴. ابتدا همه‌ی کاندیدها محاسبه می‌شوند، بعد لغو+زمان‌بندی (پنجره‌ی بدون
//      اعلان به حداقل می‌رسد).
//   ۵. روزهای day0/1/2 با لنگر «روز تقویمی محلی شهر» ساخته می‌شوند (نه لحظه‌ی
//      خامِ مقارنه) — هم‌تراز با HomeScreen.
//   ۶. اعلان «قابل رؤیت» با معیار انتخابی کاربر (نه همیشه Yallop) ساخته می‌شود
//      و نام معیار در متن می‌آید؛ یادآور «ثبت رصد» دیگر هم‌زمان با اعلان
//      قبلی نمی‌آید (در پایان پنجره‌ی رصد می‌آید).
//   ۷. isEnabled: اگر کاربر هرگز انتخاب نکرده باشد، فقط وقتی «فعال» حساب
//      می‌شود که مجوز از قبل داده شده باشد (دیگر سوئیچِ «روشن» بدون مجوز نداریم).
//   ۸. خطاها دیگر بی‌صدا قورت داده نمی‌شوند؛ خروجی شمارش موفق/ناموفق دارد.
//
// این نسخه هم‌چنان Local Notification است (نه Push سرورمحور)، طبق
// تصمیم فعلی: کاربر ترجیح داد بازه‌ی زمان‌بندی محلی را تا حد ممکن
// تقویت کند به‌جای رفتن سراغ زیرساخت سرور.
//
// ⚠️ محدودیت ذاتی معماری Local-only (غیرقابل رفع کامل با کد):
// چون تمام زمان‌بندی‌ها فقط داخل خودِ گوشی و فقط هنگام باز شدن اپ
// انجام می‌شود، اگر کاربر برای مدتی طولانی‌تر از بازه‌ی پوشش
// (SCHEDULE_DAYS_AHEAD) اصلاً اپ را باز نکند، نوتیف قطع می‌شود. این
// نسخه دو کار برای کاهش (نه حذف کامل) این ریسک انجام می‌دهد:
//   ۱. بازه‌ی پوشش از ۱۴ روز به ۶۰ روز افزایش یافته.
//   ۲. یک «نوتیف یادآوری بازکردن اپ» نزدیک پایان بازه‌ی ۶۰‌روزه
//      زمان‌بندی می‌شود (روز REOPEN_REMINDER_DAY).
// اگر در آینده نیاز به تضمین کامل پیش آمد، تنها راه واقعی افزودن یک
// لایه‌ی Push سرورمحور (مثلاً Supabase Edge Function + Cron) است.
//
// ⚠️ چندزبانگی: متن خودِ نوتیف‌ها از translations.js خوانده می‌شود.
// این ماژول یک شیء ساده است و نمی‌تواند از useLanguage() استفاده
// کند، پس زبان جاری مستقیماً از همان کلید AsyncStorage
// (`appLanguage`) خوانده می‌شود که LanguageContext.js هم از آن پر
// می‌شود. نام شهر هم با همان الگوی getCityName در SettingsScreen.js
// (از طریق UserSettings.getCityKey + ترجمه) به زبان جاری تبدیل
// می‌شود.
//
// ⚠️ نکته‌ی دیباگ مهم (GitHub Issue #10700): هرگز فقط ۱-۲ روز جلوتر
// زمان‌بندی نکنید. این نسخه با هر بار اجرا، کل بازه‌ی پیش‌رو را از
// نو می‌سازد.
//
// ⚠️ محدودیت سخت‌افزاری iOS: حداکثر ۶۴ نوتیف local هم‌زمان در صف هر
// اپ مجاز است. این نسخه با MAX_SCHEDULED_NOTIFICATIONS این سقف را
// قبل از رسیدن به آن رعایت می‌کند (نزدیک‌ترین‌ها در اولویت).
//
// ==============================================================
// منطق «سه روز پس از مقارنه» (نسخه ۶ — طبق تصمیم صریح کاربر،
// جایگزین بازه‌ی شناور قبلی که هر شبِ رده A/B/C را نوتیف می‌داد):
//
// برای هر مقارنه (نه‌ماه)، دقیقاً سه روز کاندید داریم: روز مقارنه
// (day0)، روز بعد (day1)، دو روز بعد (day2). نکته‌ی نجومیِ تأییدشده:
// day1 و day2 هرگز رده‌ی F نمی‌گیرند — فقط day0 ممکن است F باشد.
//
//   day0 (روز مقارنه):
//     رده=A     → نوتیف برو؛ زنجیره همین‌جا برای این مقارنه تمام شود
//                 (نه day1 بررسی شود، نه day2)
//     رده=F     → نوتیف نرو؛ ادامه بده به day1
//     B/C/D/E   → نوتیف برو؛ ادامه بده به day1
//
//   day1 (روز بعد از مقارنه) — فقط اگر day0 رده‌اش A نبود:
//     رده=F     → نوتیف نرو؛ ادامه بده به day2
//     رده≠F     → نوتیف برو؛ ادامه بده به day2
//
//   day2 (دو روز بعد از مقارنه) — فقط اگر day0 رده‌اش A نبود:
//     نوتیف فقط اگر: رده‌ی day0 دقیقاً F بود و رده‌ی day1 ≠A بود.
//     (توجیه: اگر day0 از قبل B..E بود، یک هشدار واقعی همان روز
//     رفته؛ برای جلوگیری از spam، day2 فقط وقتی بررسی می‌شود که
//     day0 کاملاً ساکت (F) بوده باشد.)
// ==============================================================

var Notifications = require('expo-notifications');
var Device = require('expo-device');
var RN = require('react-native');
var Platform = RN.Platform;
var Alert = RN.Alert;
var Linking = RN.Linking;
var AsyncStorageModule = require('@react-native-async-storage/async-storage');
var AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
var Astronomy = require('astronomy-engine');
var MoonCalculator = require('../calculations/moonPosition');
var HijriCalendar = require('../calculations/hijriCalendar');
var translations = require('../i18n/translations');
var UserSettings = require('../data/userSettings');

// v3.5: افق زمان‌بندی از ۶۰ روز (≈ ۲ ماه قمری) به ۲۰۰ روز (≈ ۷ ماه قمری) رسید تا
// حتی اگر کاربر چند ماه اپ را باز نکند، هشدار ماه‌های بعد برسد. سقف ۶۰ اعلان
// (محدودیت iOS) همچنان اعمال می‌شود و نزدیک‌ترین‌ها اولویت دارند.
var SCHEDULE_DAYS_AHEAD = 200;
var REOPEN_REMINDER_DAY = 190; // باید < SCHEDULE_DAYS_AHEAD باشد
var VISIBILITY_LEAD_MINUTES = 30; // چند دقیقه قبل از bestTime هشدار بده
var SIGHTING_AFTER_BEST_MINUTES = 20; // یادآور ثبت رصد: حداقل این‌قدر بعد از bestTime
var MIN_LEAD_SECONDS = 60; // اگر فاصله‌ی فایر تا الان کمتر از این باشد، صرف‌نظر کن
var NOTIFICATION_ID_PREFIX = 'hilal-';
var ENABLED_STORAGE_KEY = 'notificationsEnabled';
var LANGUAGE_STORAGE_KEY = 'appLanguage';
var SIGNATURE_STORAGE_KEY = 'notificationsSignature';
var PROMPTED_STORAGE_KEY = 'notificationsPrompted';
var CHANNEL_ID = 'hilal-alerts';
var SCHEDULE_BATCH = 8;

// سقف واقعی iOS ۶۴ است؛ کمی محافظه‌کارانه‌تر برای جای خالی نوتیف‌های
// احتمالی دیگر اپ.
var MAX_SCHEDULED_NOTIFICATIONS = 60;

// v3.5: وقفه برای واگذاری رشته‌ی JS به UI (نقشه/ناوبری) بین بخش‌های محاسبه‌ی سنگین
function yieldToUI() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

// v3.5: معنای رده‌ها در هر معیار. «بدون امید» یعنی طبق همان معیار هلال حتی با
// ابزار نوری هم دیده نمی‌شود؛ برای این شب‌ها هشدار «احتمال رؤیت» فرستاده نمی‌شود.
// (قبلاً فقط 'F' کنار گذاشته می‌شد؛ در Odeh رده‌ی D و در Yallop رده‌ی E هم
// «غیرقابل رؤیت» هستند ولی هشدار می‌گرفتند.)
var HOPELESS_CATS = {
  yallop: ['E', 'F'], odeh: ['D'], saao: ['F'], ilyas: ['F'], malaysia: ['F'], soroudi: ['E', 'F'], schaefer: ['E', 'F'],
};
// بهترین رده‌ی هر معیار (اگر شب مقارنه این رده بود، شب‌های بعد هشدار لازم نیست)
var BEST_CAT = { yallop: 'A', odeh: 'A', saao: 'B', ilyas: 'B', malaysia: 'B', soroudi: 'A', schaefer: 'A' };

// نام نمایشی معیارها در متن اعلان
var CRIT_NOTIF_LABEL = {
  yallop: 'Yallop', odeh: 'Odeh', saao: 'SAAO', ilyas: 'Ilyas',
  malaysia: 'MABIMS', soroudi: 'Soroudi', schaefer: 'Schaefer',
};

// ------------------------------------------------------------
// پیکربندی نحوه‌ی نمایش نوتیف وقتی اپ در foreground است.
// (shouldShowAlert در SDKهای جدید منسوخ است؛ هر دو مجموعه کلید داده شده تا
// با نسخه‌های قدیمی و جدید expo-notifications سازگار بماند.)
// ------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async function () {
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// صف ترتیبی برای جلوگیری از اجرای هم‌زمان schedule/cancel
var _queue = Promise.resolve();
function runExclusive(fn) {
  var run = _queue.then(fn, fn);
  _queue = run.then(function () {}, function () {});
  return run;
}

var HilalNotifications = {

  // ------------------------------------------------------------
  // ساخت کانال اندروید. باید قبل از هر درخواست مجوز/زمان‌بندی صدا زده
  // شود. idempotent است.
  // ------------------------------------------------------------
  ensureChannel: async function (tr) {
    if (Platform.OS !== 'android') return true;
    try {
      var translation = tr || await this._getCurrentTranslation();
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: this._translate(translation, 'notifChannelName'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility
          ? Notifications.AndroidNotificationVisibility.PUBLIC : undefined,
      });
      return true;
    } catch (e) {
      console.warn('Notifications: channel setup failed:', e && e.message);
      return false;
    }
  },

  // وضعیت مجوز بدون نمایش هیچ پنجره‌ای
  getPermissionState: async function () {
    if (!Device.isDevice) {
      return { granted: false, canAskAgain: false, status: 'unavailable', reason: 'NOT_A_DEVICE' };
    }
    try {
      var p = await Notifications.getPermissionsAsync();
      var granted = p.status === 'granted' || p.granted === true;
      return {
        granted: granted,
        canAskAgain: p.canAskAgain !== false,
        status: p.status,
        reason: p.status,
      };
    } catch (e) {
      return { granted: false, canAskAgain: false, status: 'error', reason: 'ERROR' };
    }
  },

  // درخواست صریح مجوز (فقط با اقدام کاربر صدا بزنید)
  requestPermissions: async function () {
    var state = await this.getPermissionState();
    if (state.reason === 'NOT_A_DEVICE') return { granted: false, reason: 'NOT_A_DEVICE', canAskAgain: false };
    if (state.granted) return { granted: true, canAskAgain: true };
    if (state.status === 'denied' && state.canAskAgain === false) {
      return { granted: false, reason: 'DENIED', canAskAgain: false };
    }
    await this.ensureChannel();
    try {
      var requested = await Notifications.requestPermissionsAsync();
      var granted = requested.status === 'granted' || requested.granted === true;
      return { granted: granted, reason: requested.status, canAskAgain: requested.canAskAgain !== false };
    } catch (e) {
      return { granted: false, reason: 'ERROR', canAskAgain: false };
    }
  },

  openSystemSettings: function () {
    try { return Linking.openSettings(); } catch (e) { return Promise.resolve(); }
  },

  cancelAllHilalNotifications: async function () {
    var scheduled = await Notifications.getAllScheduledNotificationsAsync();
    var ours = scheduled.filter(function (n) {
      return n.identifier && n.identifier.indexOf(NOTIFICATION_ID_PREFIX) === 0;
    });
    await Promise.all(ours.map(function (n) {
      return Notifications.cancelScheduledNotificationAsync(n.identifier).catch(function () {});
    }));
    return ours.length;
  },

  _countScheduled: async function () {
    try {
      var scheduled = await Notifications.getAllScheduledNotificationsAsync();
      return scheduled.filter(function (n) {
        return n.identifier && n.identifier.indexOf(NOTIFICATION_ID_PREFIX) === 0;
      }).length;
    } catch (e) { return 0; }
  },

  // ------------------------------------------------------------
  // isEnabled: مقدار صریح کاربر؛ اگر هرگز انتخاب نکرده، فقط وقتی فعال
  // است که مجوز از قبل داده شده باشد (کاربران نسخه‌های قدیمی که قبلاً
  // مجوز داده‌اند فعال می‌مانند؛ بقیه خاموش تا اقدام صریح).
  // ------------------------------------------------------------
  isEnabled: async function () {
    try {
      var val = await AsyncStorage.getItem(ENABLED_STORAGE_KEY);
      if (val === 'true') return true;
      if (val === 'false') return false;
    } catch (e) {}
    var state = await this.getPermissionState();
    return !!state.granted;
  },

  setEnabled: async function (enabled) {
    try {
      await AsyncStorage.setItem(ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (e) {}
    if (!enabled) {
      var self = this;
      await runExclusive(function () { return self.cancelAllHilalNotifications(); });
      try { await AsyncStorage.removeItem(SIGNATURE_STORAGE_KEY); } catch (e) {}
    }
  },

  // وضعیت کامل برای UI تنظیمات
  getStatus: async function () {
    var enabledPref = await this.isEnabled();
    var perm = await this.getPermissionState();
    return {
      enabled: !!(enabledPref && perm.granted),
      preferenceOn: enabledPref,
      permissionGranted: perm.granted,
      canAskAgain: perm.canAskAgain,
      unavailable: perm.reason === 'NOT_A_DEVICE',
    };
  },

  _getCurrentTranslation: async function () {
    var lang = 'fa';
    try {
      var saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && translations[saved]) lang = saved;
    } catch (e) {}
    return translations[lang] || translations.fa;
  },

  _translate: function (tr, key, params) {
    var text = (tr && tr[key] !== undefined) ? tr[key] : translations.fa[key];
    if (text === undefined) return key;
    if (params) {
      var keys = Object.keys(params);
      for (var i = 0; i < keys.length; i++) {
        text = text.split('{' + keys[i] + '}').join(params[keys[i]]);
      }
    }
    return text;
  },

  _getCityLabel: function (tr, city) {
    if (!city || !city.name) return this._translate(tr, 'notifDefaultCityName');
    try {
      var cityKey = UserSettings.getCityKey(city.name);
      if (cityKey && tr && tr[cityKey] !== undefined) return tr[cityKey];
      if (cityKey && translations.fa[cityKey] !== undefined) return translations.fa[cityKey];
    } catch (e) {}
    return city.name;
  },

  _safeHijriLabel: function (targetDate) {
    try {
      var next = HijriCalendar.getNextHijriMonth(targetDate);
      if (!next || !next.month || !next.year) return null;
      return HijriCalendar.formatHijriMonthYear(next.month, next.year);
    } catch (e) {
      return null;
    }
  },

  // ------------------------------------------------------------
  // تابع خالص تصمیم‌گیری: با گرفتن سه رده (cat0/cat1/cat2)، برمی‌گرداند
  // کدام‌یک از سه روز باید نوتیف «قابل رؤیت» بگیرند. بدون وابستگی به
  // تاریخ، شهر، یا هر چیز جانبی — تا مستقل قابل تست باشد.
  // خروجی: { day0: bool, day1: bool, day2: bool }
  // ------------------------------------------------------------
  _decideVisibilityDays: function (cat0, cat1, cat2, crit) {
    var hopeless = HOPELESS_CATS[crit || 'yallop'] || HOPELESS_CATS.yallop;
    var best = BEST_CAT[crit || 'yallop'] || 'A';
    var known = function (c) { return c !== undefined && c !== null; };
    var possible = function (c) { return known(c) && hopeless.indexOf(c) === -1; };
    var result = { day0: false, day1: false, day2: false };

    if (cat0 === best) {
      result.day0 = true;
      return result; // زنجیره همین‌جا تمام می‌شود
    }

    if (possible(cat0)) result.day0 = true;
    if (possible(cat1)) result.day1 = true;

    // شب سوم فقط وقتی که شب مقارنه امیدی نداشته، شب دوم بهترین رده را نگرفته،
    // و خودِ شب سوم امکان رؤیت دارد
    if (known(cat0) && !possible(cat0) && cat1 !== best && possible(cat2)) {
      result.day2 = true;
    }

    return result;
  },

  // date باید «لنگر روز تقویمی محلی» (ظهر UTC) باشد، نه یک لحظه‌ی خام.
  _computeDay: function (date, city, crit, nmHint) {
    var data;
    try {
      data = MoonCalculator.getFullMoonData(date, city.lat, city.lon, city.alt || 0, nmHint);
    } catch (e) {
      return null;
    }
    if (!data || !data.sunSet) return null;
    var cat = MoonCalculator.getCatForCrit(data, crit);
    return { date: date, data: data, cat: cat };
  },

  _signature: function (city, crit, lang) {
    var today = new Date().toISOString().slice(0, 10);
    return [
      city.lat.toFixed(3), city.lon.toFixed(3), (city.alt || 0), crit, lang, today,
    ].join('|');
  },

  // ------------------------------------------------------------
  // محاسبه‌ی کاندیدها (بدون هیچ side-effect) — برای تست‌پذیری جدا شد.
  // ------------------------------------------------------------
  // نسخه‌ی همگام (برای تست)؛ UI از _buildCandidatesAsync استفاده می‌کند.
  _buildCandidates: function (city, crit, tr, now) {
    var gen = this._candidateGenerator(city, crit, tr, now);
    var step = gen.next();
    while (!step.done) step = gen.next();
    return step.value;
  },

  _buildCandidatesAsync: async function (city, crit, tr, now) {
    var gen = this._candidateGenerator(city, crit, tr, now);
    var step = gen.next();
    while (!step.done) {
      await yieldToUI();
      step = gen.next();
    }
    return step.value;
  },

  // مولّد: بعد از هر مقارنه yield می‌کند تا نسخه‌ی async بتواند وقفه بدهد.
  _candidateGenerator: function* (city, crit, tr, now) {
    var candidates = [];
    var minFireTime = new Date(now.getTime() + MIN_LEAD_SECONDS * 1000);
    var scheduleEndDate = new Date(now.getTime() + SCHEDULE_DAYS_AHEAD * 24 * 3600000);
    // v3.5: مقارنه‌ها را مستقیم از موتور نجومی می‌گیریم (نه با «کاوش روز»)،
    // چون لنگر روز تقویمی ممکن است قبل از لحظه‌ی مقارنه باشد و prevNewMoon
    // همان ماه قبل را برگرداند. از ۴ روز پیش شروع می‌کنیم تا روزهای
    // ۰ تا ۲ مقارنه‌ی اخیر که هنوز در آینده‌اند از دست نروند.
    var cursor = new Date(now.getTime() - 4 * 24 * 3600000);
    var guard = 0;

    while (guard < 6) {
      guard++;
      var nmEvent = null;
      try { nmEvent = Astronomy.SearchMoonPhase(0, cursor, 40); } catch (e) { nmEvent = null; }
      if (!nmEvent || nmEvent.date.getTime() > scheduleEndDate.getTime()) break;

      var conjunction = nmEvent.date;
      cursor = new Date(conjunction.getTime() + 5 * 24 * 3600000);

      // سه «روز تقویمی محلی» پس از مقارنه (هم‌تراز با HomeScreen)
      var a0 = MoonCalculator.getLocalDayAnchor(conjunction, city.lat, city.lon, 0);
      var a1 = MoonCalculator.getLocalDayAnchor(conjunction, city.lat, city.lon, 1);
      var a2 = MoonCalculator.getLocalDayAnchor(conjunction, city.lat, city.lon, 2);

      var d0 = this._computeDay(a0, city, crit, conjunction);
      var d1 = this._computeDay(a1, city, crit, conjunction);
      var d2 = this._computeDay(a2, city, crit, conjunction);

      if (d0) {
        var cat1 = d1 ? d1.cat : null;
        var cat2 = d2 ? d2.cat : null;
        var decision = this._decideVisibilityDays(d0.cat, cat1, cat2, crit);

        var chosen = [];
        if (decision.day0) chosen.push(d0);
        if (decision.day1 && d1) chosen.push(d1);
        if (decision.day2 && d2) chosen.push(d2);

        for (var i = 0; i < chosen.length; i++) {
          this._addVisibilityCandidate(candidates, chosen[i], tr, city, crit, minFireTime);
          // یادآور ثبت رصد فقط برای همان شب‌هایی که هشدار رؤیت دارند
          this._addSightingCandidate(candidates, chosen[i], tr, minFireTime);
        }
      }
      yield;
    }

    var reopenFireDate = new Date(now.getTime() + REOPEN_REMINDER_DAY * 24 * 3600000);
    reopenFireDate.setHours(12, 0, 0, 0);
    if (reopenFireDate.getTime() > minFireTime.getTime()) {
      candidates.push({
        dayOffset: REOPEN_REMINDER_DAY,
        id: NOTIFICATION_ID_PREFIX + 'reopen-' + reopenFireDate.toISOString().slice(0, 10),
        fireTime: reopenFireDate,
        content: {
          title: this._translate(tr, 'notifReopenTitle'),
          body: this._translate(tr, 'notifReopenBody'),
          data: { type: 'reopen_reminder' },
        },
        meta: {},
        record: null,
      });
    }

    candidates.sort(function (a, b) { return a.fireTime.getTime() - b.fireTime.getTime(); });
    return candidates;
  },

  // ------------------------------------------------------------
  // هم‌گام‌سازی بی‌صدا (Home): هرگز پنجره‌ی مجوز نشان نمی‌دهد. اگر
  // چیزی عوض نشده باشد و اعلان‌ها هنوز در صف باشند، کاری نمی‌کند.
  // ------------------------------------------------------------
  syncSchedule: function (city, criterionId, opts) {
    var self = this;
    return runExclusive(function () {
      return self._scheduleImpl(city, criterionId, { requestPermission: false, force: !!(opts && opts.force) });
    });
  },

  // سازگار با نام قدیمی؛ requestPermission پیش‌فرض در مسیر Settings فعال می‌شود
  scheduleUpcoming: function (city, criterionId, opts) {
    var self = this;
    var o = opts || {};
    return runExclusive(function () {
      return self._scheduleImpl(city, criterionId, {
        requestPermission: o.requestPermission !== false,
        force: o.force !== false,
      });
    });
  },

  _scheduleImpl: async function (city, criterionId, opts) {
    if (!city || city.lat === undefined || city.lon === undefined) {
      return { success: false, error: 'NO_CITY' };
    }

    var enabled = await this.isEnabled();
    // مسیر Settings با requestPermission=true یعنی کاربر همین الان روشن کرده
    if (!enabled && !opts.requestPermission) {
      return { success: true, scheduledCount: 0, disabled: true, visibilityNights: [], sightingReminders: [] };
    }

    var perm;
    if (opts.requestPermission) {
      perm = await this.requestPermissions();
    } else {
      perm = await this.getPermissionState();
      if (!perm.granted) {
        return { success: false, error: 'NO_PERMISSION', reason: perm.reason, silent: true, canAskAgain: perm.canAskAgain };
      }
    }
    if (!perm.granted) {
      return { success: false, error: 'NO_PERMISSION', reason: perm.reason, canAskAgain: perm.canAskAgain };
    }

    var tr = await this._getCurrentTranslation();
    await this.ensureChannel(tr);

    var crit = criterionId || 'yallop';
    var lang = 'fa';
    try { lang = (await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)) || 'fa'; } catch (e) {}
    var signature = this._signature(city, crit, lang);

    if (!opts.force) {
      try {
        var stored = await AsyncStorage.getItem(SIGNATURE_STORAGE_KEY);
        if (stored === signature && (await this._countScheduled()) > 0) {
          return { success: true, skipped: true, scheduledCount: 0, visibilityNights: [], sightingReminders: [] };
        }
      } catch (e) {}
    }

    var now = new Date();
    // ابتدا محاسبه (سنگین)، سپس لغو+زمان‌بندی (سریع)
    var candidates = await this._buildCandidatesAsync(city, crit, tr, now);
    var truncated = false;
    if (candidates.length > MAX_SCHEDULED_NOTIFICATIONS) {
      truncated = true;
      candidates = candidates.slice(0, MAX_SCHEDULED_NOTIFICATIONS);
    }

    await this.cancelAllHilalNotifications();

    var scheduledCount = 0;
    var failedCount = 0;
    var firstError = null;
    var visibilityNights = [];
    var sightingReminders = [];

    for (var i = 0; i < candidates.length; i += SCHEDULE_BATCH) {
      var batch = candidates.slice(i, i + SCHEDULE_BATCH);
      var results = await Promise.all(batch.map(function (c) {
        var trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: c.fireTime };
        if (Platform.OS === 'android') trigger.channelId = CHANNEL_ID;
        return Notifications.scheduleNotificationAsync({
          identifier: c.id,
          content: c.content,
          trigger: trigger,
        }).then(function () { return { ok: true, c: c }; }, function (e) { return { ok: false, c: c, e: e }; });
      }));
      results.forEach(function (r) {
        if (r.ok) {
          scheduledCount++;
          if (r.c.record === 'visibilityNights') visibilityNights.push(r.c.meta);
          if (r.c.record === 'sightingReminders') sightingReminders.push(r.c.meta);
        } else {
          failedCount++;
          if (!firstError) firstError = (r.e && r.e.message) || 'UNKNOWN';
        }
      });
    }

    if (failedCount > 0) console.warn('Notifications: ' + failedCount + ' failed, first error:', firstError);

    // امضا فقط وقتی ذخیره می‌شود که همه موفق بوده باشند
    if (failedCount === 0) {
      try { await AsyncStorage.setItem(SIGNATURE_STORAGE_KEY, signature); } catch (e) {}
    }

    return {
      success: scheduledCount > 0 || candidates.length === 0,
      scheduledCount: scheduledCount,
      failedCount: failedCount,
      error: failedCount > 0 && scheduledCount === 0 ? 'SCHEDULE_FAILED' : undefined,
      errorDetail: firstError,
      visibilityNights: visibilityNights,
      sightingReminders: sightingReminders,
      truncated: truncated,
    };
  },

  // ------------------------------------------------------------
  // پرسش یک‌باره‌ی فعال‌سازی هشدارها (جای درخواست پنهان قبلی).
  // فقط وقتی مجوز هنوز تعیین‌نشده است، کاربر قبلاً انتخاب صریح نکرده،
  // و این پرسش پیش‌تر نمایش داده نشده است. نتیجه: true اگر فعال شد.
  // ------------------------------------------------------------
  maybeAskOnce: async function () {
    try {
      if (!Device.isDevice) return false;
      var prompted = await AsyncStorage.getItem(PROMPTED_STORAGE_KEY);
      if (prompted === 'true') return false;
      var pref = await AsyncStorage.getItem(ENABLED_STORAGE_KEY);
      if (pref === 'true' || pref === 'false') return false;
      var state = await this.getPermissionState();
      if (state.granted || !state.canAskAgain) return false;

      await AsyncStorage.setItem(PROMPTED_STORAGE_KEY, 'true');
      var tr = await this._getCurrentTranslation();
      var self = this;
      return await new Promise(function (resolve) {
        Alert.alert(
          self._translate(tr, 'notifAskTitle'),
          self._translate(tr, 'notifAskBody'),
          [
            { text: self._translate(tr, 'notifAskLater'), style: 'cancel', onPress: function () { resolve(false); } },
            {
              text: self._translate(tr, 'notifAskEnable'),
              onPress: function () {
                self.setEnabled(true).then(function () { return self.requestPermissions(); }).then(function (p) {
                  if (!p.granted) { self.setEnabled(false).then(function () { resolve(false); }); }
                  else resolve(true);
                }).catch(function () { resolve(false); });
              },
            },
          ],
          { cancelable: true, onDismiss: function () { resolve(false); } }
        );
      });
    } catch (e) {
      return false;
    }
  },

  _addVisibilityCandidate: function (candidates, dayInfo, tr, city, crit, minFireTime) {
    var data = dayInfo.data;
    var cat = dayInfo.cat;
    var targetDate = dayInfo.date;
    var alertTime = data.bestTime || data.sunSet;
    var fireTime = new Date(alertTime.getTime() - VISIBILITY_LEAD_MINUTES * 60000);
    if (fireTime.getTime() <= minFireTime.getTime()) return;

    var dayOffset = Math.floor((targetDate.getTime() - minFireTime.getTime()) / (24 * 3600000));
    var hijriLabel = this._safeHijriLabel(targetDate);
    var cityLabel = this._getCityLabel(tr, city);

    candidates.push({
      dayOffset: dayOffset,
      id: NOTIFICATION_ID_PREFIX + 'visible-' + targetDate.toISOString().slice(0, 10),
      fireTime: fireTime,
      content: {
        title: this._translate(tr, 'notifVisibleTitle'),
        body: this._translate(tr, 'notifVisibleBody', { city: cityLabel, cat: cat, crit: CRIT_NOTIF_LABEL[crit] || crit }),
        data: { type: 'visibility', dateISO: targetDate.toISOString() },
      },
      meta: { date: targetDate, hijriDate: hijriLabel, cat: cat },
      record: 'visibilityNights',
    });
  },

  // یادآور ثبت رصد: پایان پنجره‌ی رصد (غروب ماه یا bestTime+۲۰ دقیقه — هرکدام دیرتر)
  _addSightingCandidate: function (candidates, dayInfo, tr, minFireTime) {
    var data = dayInfo.data;
    var targetDate = dayInfo.date;
    if (!data.sunSet) return;
    var base = data.bestTime || data.sunSet;
    var fireMs = base.getTime() + SIGHTING_AFTER_BEST_MINUTES * 60000;
    if (data.moonSet && data.moonSet.getTime() > fireMs && data.moonSet.getTime() - base.getTime() < 3 * 3600000) {
      fireMs = data.moonSet.getTime();
    }
    var fireTime = new Date(fireMs);
    if (fireTime.getTime() <= minFireTime.getTime()) return;

    var dayOffset = Math.floor((targetDate.getTime() - minFireTime.getTime()) / (24 * 3600000));

    candidates.push({
      dayOffset: dayOffset,
      id: NOTIFICATION_ID_PREFIX + 'sighting-' + targetDate.toISOString().slice(0, 10),
      fireTime: fireTime,
      content: {
        title: this._translate(tr, 'notifSightingTitle'),
        body: this._translate(tr, 'notifSightingBody'),
        data: { type: 'sighting_reminder', dateISO: targetDate.toISOString() },
      },
      meta: { date: targetDate },
      record: 'sightingReminders',
    });
  },

  disableAll: async function () {
    var count = await this.cancelAllHilalNotifications();
    return { success: true, cancelledCount: count };
  },

};

module.exports = HilalNotifications;
