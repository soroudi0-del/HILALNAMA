// ============================================================
// نسخه ۴ — فشرده‌سازی عکس پیش از آپلود به Supabase Storage
//
// این فایل نسبت به نسخه‌ی قبلی (Firebase) از نظر منطق فشرده‌سازی
// هیچ تغییری نکرده — آن نسخه هم مستقیماً به Firebase وابسته نبود.
// تنها تفاوت مصرف‌کننده‌ی خروجی این فایل است: در نسخه‌ی Firebase،
// base64 خروجی مستقیم در ستون Firestore ذخیره می‌شد (چون Storage
// در دسترس نبود). در نسخه‌ی Supabase، همین base64 توسط
// sightingReports.js به یک فایل باینری واقعی تبدیل و در باکت
// Supabase Storage آپلود می‌شود — پس هدف ۱۵۰ کیلوبایتی همچنان
// معنا دارد (سرعت آپلود روی اینترنت ضعیف)، هرچند دیگر محدودیت
// «هر سند حداکثر ۱ مگابایت» Firestore وجود ندارد.
//
// روش: فشرده‌سازی تکراری (iterative) — به‌جای حدس یک عدد ثابت
// compress، اندازه را می‌سنجیم و در صورت لزوم دوباره با ابعاد/
// کیفیت کمتر امتحان می‌کنیم تا به هدف برسیم.
// ============================================================

var ImageManipulator = require('expo-image-manipulator');
var File = require('expo-file-system').File;

var TARGET_SIZE_KB = 150;

var ATTEMPT_STEPS = [
  { width: 1280, compress: 0.7 },
  { width: 1024, compress: 0.6 },
  { width: 800, compress: 0.5 },
  { width: 640, compress: 0.4 },
  { width: 480, compress: 0.3 },
];

function getFileSizeKB(uri) {
  try {
    var f = new File(uri);
    if (!f.exists || f.size === undefined || f.size === null) return null;
    return f.size / 1024;
  } catch (e) {
    return null;
  }
}

// ==============================================================
// فشرده‌سازی تکراری تا رسیدن به حجم هدف (یا اتمام تلاش‌ها).
// خروجی: { uri, base64, sizeKB } یا در صورت خطا null
// ==============================================================
async function compressImageForUpload(localUri) {
  try {
    var result = null;
    for (var i = 0; i < ATTEMPT_STEPS.length; i++) {
      var step = ATTEMPT_STEPS[i];
      var manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: step.width } }],
        { compress: step.compress, format: ImageManipulator.SaveFormat.JPEG, base64: false }
      );
      var sizeKB = getFileSizeKB(manipulated.uri);
      result = { uri: manipulated.uri, sizeKB: sizeKB };

      if (sizeKB !== null && sizeKB <= TARGET_SIZE_KB) {
        break;
      }
    }

    if (!result) return null;

    // base64() در کلاس File یک متد async است (Promise<string>)
    var base64 = await new File(result.uri).base64();
    return { uri: result.uri, base64: base64, sizeKB: result.sizeKB };
  } catch (e) {
    console.error('خطا در فشرده‌سازی عکس:', e);
    return null;
  }
}

module.exports = {
  compressImageForUpload: compressImageForUpload,
  TARGET_SIZE_KB: TARGET_SIZE_KB,
};