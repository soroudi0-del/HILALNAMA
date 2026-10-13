// ============================================================
// نسخه ۴ — مهاجرت از Firebase به Supabase
//
// این فایل نقطه‌ی ورود واحد Supabase در کل اپ است (جایگزین
// firebaseConfig.js قبلی). نام فایل و مسیر (src/firebase/) عمداً
// همان قبلی نگه داشته شده تا هیچ import‌ای در بقیه‌ی اپ
// (authService.js, sightingReports.js) نیاز به تغییر نداشته باشد.
//
// چرا Supabase به‌جای Firebase:
//   - Firebase (Firestore + Auth + Storage) توسط گوگل برای کاربران
//     ایرانی مسدود/محدود شده و کاربران مجبور بودند از VPN استفاده
//     کنند.
//   - Supabase روی Postgres ساخته شده، این محدودیت جغرافیایی را
//     ندارد.
//   - بر خلاف فاز قبلی Firebase (که مجبور به حذف Storage و ذخیره‌ی
//     Base64 داخل خودِ سند شدیم)، اینجا از همان ابتدا Supabase
//     Storage به‌طور کامل و بدون محدودیت اضافی در دسترس است — پس
//     عکس‌ها به‌صورت فایل واقعی در باکت 'sighting-photos' ذخیره
//     می‌شوند، نه Base64 داخل ردیف دیتابیس.
//
// ⚠️ پیش‌نیازها (یک‌بار توسط توسعه‌دهنده در Supabase Dashboard):
//   ۱. یک پروژه‌ی جدید در https://supabase.com بسازید.
//   ۲. Project Settings → API از SUPABASE_URL و anon public key را
//      کپی و در SUPABASE_CONFIG زیر جایگزین کنید.
//   ۳. SQL Editor → کل محتوای sql/001_schema.sql (که همراه این
//      مهاجرت داده شده) را اجرا کنید — جدول، ایندکس‌ها، RLS
//      policyها، و Storage bucket را می‌سازد.
//   ۴. Authentication → Providers → «Anonymous Sign-Ins» را فعال
//      کنید (دقیقاً معادل «Anonymous» در Firebase Console قبلی) —
//      بدون این، signInAnonymously با خطا شکست می‌خورد.
// ============================================================

var AsyncStorageModule = require('@react-native-async-storage/async-storage');
var AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
var createClient = require('@supabase/supabase-js').createClient;

// مقادیر واقعی پروژه‌ی Supabase را اینجا جایگزین کنید
// (Project Settings → API در Supabase Dashboard)
var SUPABASE_CONFIG = {
  url: 'https://ukfgelzvbtdcmxgbxjvj.supabase.co',
  anonKey: 'sb_publishable_i7qzk71l-on41g_bjG82VQ_u892K-P4',
};

// نام باکت Storage برای عکس‌های گزارش استهلال (باید دقیقاً با
// sql/001_schema.sql هماهنگ باشد)
var SIGHTING_PHOTOS_BUCKET = 'sighting-photos';

// ⚠️ نکته‌ی حیاتی معادل همان نکته‌ی initializeAuth قبلی: باید
// persistSession با AsyncStorage تنظیم شود، وگرنه session کاربر
// فقط در حافظه‌ی موقت نگه داشته می‌شود و با هر بار بستن/بازکردن اپ
// از بین می‌رود — یعنی هر بار یک کاربر anonymous *جدید* ساخته
// می‌شود و محدودیت «یک گزارش در ماه» و امکان «ویرایش/حذف گزارش
// خودم» کاملاً از کار می‌افتد.
var supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

module.exports = {
  supabase: supabase,
  SIGHTING_PHOTOS_BUCKET: SIGHTING_PHOTOS_BUCKET,
};