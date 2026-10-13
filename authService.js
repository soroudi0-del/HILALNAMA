// ============================================================
// نسخه ۴ — مهاجرت از Firebase به Supabase: سرویس احراز هویت ناشناس
//
// معادل دقیق منطق authService.js قبلی (Firebase Anonymous Auth)،
// این‌بار با Supabase Anonymous Sign-in. API این ماژول (نام توابع،
// شکل خروجی { success, uid }) عمداً کاملاً با نسخه‌ی قبلی یکسان
// نگه داشته شده، چون sightingReports.js (و از طریق آن UI) بدون هیچ
// تغییری منتظر همین امضا هستند.
//
// ⚠️ پیش‌نیاز: در Supabase Dashboard → Authentication → Providers
// باید گزینه‌ی «Anonymous Sign-Ins» فعال شده باشد، وگرنه
// signInAnonymously با خطا شکست می‌خورد.
// ============================================================

var fb = require('./firebaseConfig');
var supabase = fb.supabase;

var AuthService = {

  // ------------------------------------------------------------
  // ورود ناشناس (یا بازیابی session موجود). چون persistSession با
  // AsyncStorage در firebaseConfig.js تنظیم شده، اگر کاربر قبلاً
  // یک‌بار وارد شده باشد، Supabase خودش session قبلی را از
  // AsyncStorage بازیابی می‌کند و signInAnonymously دوباره صدا زده
  // نمی‌شود.
  //
  // خروجی: { success, uid } یا { success: false, error }
  // ------------------------------------------------------------
  ensureSignedIn: function () {
    return new Promise(function (resolve) {
      supabase.auth.getSession()
        .then(function (res) {
          var session = res.data && res.data.session;
          if (session && session.user) {
            resolve({ success: true, uid: session.user.id });
            return;
          }

          // هیچ session موجودی نیست (اولین اجرای اپ، یا کش پاک شده) —
          // یک کاربر ناشناس جدید بساز.
          supabase.auth.signInAnonymously()
            .then(function (result) {
              if (result.error) {
                console.error('خطا در ورود ناشناس Supabase:', result.error);
                resolve({ success: false, error: result.error.message || 'UNKNOWN' });
                return;
              }
              var user = result.data && result.data.user;
              if (!user) {
                resolve({ success: false, error: 'NO_USER_RETURNED' });
                return;
              }
              resolve({ success: true, uid: user.id });
            })
            .catch(function (error) {
              console.error('خطا در ورود ناشناس Supabase:', error);
              resolve({ success: false, error: error.message || 'UNKNOWN' });
            });
        })
        .catch(function (error) {
          console.error('خطا در بازیابی session Supabase:', error);
          resolve({ success: false, error: error.message || 'UNKNOWN' });
        });
    });
  },

  // ------------------------------------------------------------
  // گرفتن UID فعلی به‌صورت مستقیم (فقط اگر از قبل signed-in باشیم).
  // ⚠️ توجه: برخلاف نسخه‌ی Firebase که auth.currentUser به‌صورت
  // sync در دسترس بود، Supabase JS SDK این را sync نمی‌دهد. به همین
  // دلیل این تابع cache محلی (که ensureSignedIn پر می‌کند) را
  // برمی‌گرداند. برای مسیرهایی که واقعاً نیاز به مقدار تازه دارند،
  // ensureSignedIn (که async است) را صدا بزنید.
  // ------------------------------------------------------------
  getCurrentUid: function () {
    return cachedUid;
  },

};

// cache ساده‌ی محلی UID، هر بار ensureSignedIn موفق resolve شد پر می‌شود
var cachedUid = null;
var originalEnsureSignedIn = AuthService.ensureSignedIn;
AuthService.ensureSignedIn = function () {
  return originalEnsureSignedIn().then(function (result) {
    if (result.success) cachedUid = result.uid;
    return result;
  });
};

module.exports = AuthService;