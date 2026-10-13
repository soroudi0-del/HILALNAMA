// ============================================================
// نسخه ۴ — مهاجرت از Firebase به Supabase: سرویس گزارش‌های استهلال
//
// این فایل معادل کامل sightingReports.js قبلی (نسخه‌ی Firebase)
// است، با همان امضای دقیق توابع (نام‌ها، پارامترها، شکل خروجی)،
// چون BrowseReportsScreen.js و SightingReportFormScreen.js بدون
// هیچ تغییری منتظر همین API هستند.
//
// تفاوت‌های کلیدی نسبت به نسخه‌ی Firebase:
//   - Firestore (NoSQL, camelCase) → Postgres (SQL, snake_case).
//     تمام تبدیل camelCase↔snake_case اینجا (در همین فایل) انجام
//     می‌شود؛ خروجی به سمت UI همچنان camelCase است (دقیقاً مثل قبل)
//     تا BrowseReportsScreen/SightingReportFormScreen نیازی به
//     تغییر نداشته باشند.
//   - عکس‌ها: به‌جای Base64 داخل سند، حالا فایل واقعی در Supabase
//     Storage (باکت sighting-photos) آپلود می‌شود؛ ستون‌های
//     photo_path/photo_url در دیتابیس ذخیره می‌شوند. سمت UI همچنان
//     از r.photoBase64 برای <Image source={{uri:...}}> استفاده
//     می‌کند — چون uri می‌تواند هم data-URI باشد هم URL معمولی،
//     اینجا r.photoBase64 را به‌همان signed/public URL ست می‌کنیم
//     تا BrowseReportsScreen.js (که r.photoBase64 را می‌خواند)
//     دست‌نخورده کار کند.
//   - composite index دستی لازم نیست: Postgres محدودیت Firestore
//     (نیاز به index از پیش ساخته برای چند where + orderBy) را
//     ندارد، پس همان کوئری‌های ساده‌تر (بدون مرتب‌سازی کلاینتی
//     اجباری) هم ممکن بودند؛ اما برای حداقل‌سازی ریسک تغییر رفتار،
//     همان الگوی «واکشی + مرتب‌سازی سمت کلاینت» قبلی حفظ شده.
// ============================================================

var fb = require('./firebaseConfig');
var supabase = fb.supabase;
var SIGHTING_PHOTOS_BUCKET = fb.SIGHTING_PHOTOS_BUCKET;

var AuthService = require('./authService');
var MoonCalculator = require('../calculations/moonPosition');
var HijriCalendar = require('../calculations/hijriCalendar');

var Astronomy = require('astronomy-engine');
var TABLE = 'sighting_reports';
// نسخه ۴ (افزونه‌ی بج): برای کوئری‌های *خواندنی* (نمایش لیست/جزئیات
// گزارش‌ها)، به‌جای جدول خام از View‌ای استفاده می‌شود که بج صاحب
// هر گزارش (در صورت وجود) را هم در کنارش برمی‌گرداند — بدون نیاز
// به یک کوئری جداگانه در سمت اپ برای هر گزارش. insert/update/delete
// همچنان مستقیماً روی جدول اصلی (TABLE) انجام می‌شوند، چون View
// قابل نوشتن نیست.
var TABLE_FOR_READS = 'sighting_reports_with_badge';

// نسخه ۴ — همان مقدار قبلی، بدون تغییر منطق
var SIGHTING_WINDOW_HOURS = 60;
// v3.5: حداکثر گزارش هر کاربر در هر ماه قمری (سه شب رصد). سقف واقعی را
// تریگر دیتابیس (sql/005) هم اعمال می‌کند؛ این مقدار فقط برای UX زودهنگام است.
var MAX_REPORTS_PER_MONTH = 3;
var MAX_NAME_LENGTH = 80;
var MAX_NOTES_LENGTH = 1000;
var MAX_EMAIL_LENGTH = 120;

var SIGHTING_RESULTS = {
  SEEN_NAKED_EYE: 'seen_naked_eye',
  SEEN_OPTICAL: 'seen_optical',
  NOT_SEEN: 'not_seen',
  NOT_ATTEMPTED: 'not_attempted',
};

var NO_ATTEMPT_REASONS = {
  CLOUDS: 'clouds',
  DUST: 'dust',
  RAIN: 'rain',
  BAD_HORIZON: 'bad_horizon',
  EQUIPMENT_FAILURE: 'equipment_failure',
  OTHER: 'other',
};

var EQUIPMENT_TYPES = {
  NONE: 'none',
  BINOCULARS: 'binoculars',
  TELESCOPE: 'telescope',
  CCD: 'ccd',
  CAMERA: 'camera',
  OTHER: 'other',
};

var WEATHER_CONDITIONS = {
  CLEAR: 'clear',
  PARTLY_CLOUDY: 'partly_cloudy',
  CLOUDY: 'cloudy',
  DUSTY: 'dusty',
  FOGGY: 'foggy',
};

var HORIZON_QUALITY = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  MODERATE: 'moderate',
  POOR: 'poor',
};

var OTHER_COUNTRY_CODE = 'OTHER';

function validateSightingWindow(sightingDateTime, conjunction) {
  if (!sightingDateTime || !conjunction) {
    return { valid: false, reason: 'MISSING_DATA' };
  }
  var diffMs = sightingDateTime.getTime() - conjunction.getTime();
  var diffHours = diffMs / 3600000;
  if (diffHours < 0) return { valid: false, reason: 'BEFORE_CONJUNCTION' };
  if (diffHours > SIGHTING_WINDOW_HOURS) return { valid: false, reason: 'AFTER_WINDOW' };
  return { valid: true };
}

function computeAstronomicalSnapshot(sightingDateTime, latitude, longitude, elevation, conjunction) {
  if (latitude === null || latitude === undefined || isNaN(latitude) ||
      longitude === null || longitude === undefined || isNaN(longitude)) {
    return null;
  }
  try {
    // v3.5 (رفع باگ ۲۴ ساعت): getFullMoonData انتظار «ظهر UTC روز تقویمی
    // محلی» دارد، نه لحظه‌ی خام رصد. بدون این تبدیل، برای طول‌های غربی
    // (اروپای غربی/آفریقا/آمریکا) غروبِ روز بعد محاسبه می‌شد.
    var anchor = MoonCalculator.getLocalDayAnchor(sightingDateTime, latitude, longitude);
    var data = MoonCalculator.getFullMoonData(anchor, latitude, longitude, elevation || 0, conjunction || null);

    // وضعیت واقعی ماه/خورشید در همان لحظه‌ی رصد (برای ارزیابی اعتبار گزارش)
    var moonAltNow = null, sunAltNow = null;
    try {
      var obs = new Astronomy.Observer(latitude, longitude, elevation || 0);
      var mc = MoonCalculator.getHorizonCoords(sightingDateTime, obs, 'Moon', true);
      var sc = MoonCalculator.getHorizonCoords(sightingDateTime, obs, 'Sun', true);
      moonAltNow = mc && typeof mc.altitude === 'number' ? mc.altitude : null;
      sunAltNow = sc && typeof sc.altitude === 'number' ? sc.altitude : null;
    } catch (e2) {}

    return {
      moonAltitude: data.moonAltitude,          // در لحظه‌ی غروب خورشید
      moonAltitudeAtSighting: moonAltNow,       // در لحظه‌ی رصد (v3.5)
      sunAltitudeAtSighting: sunAltNow,         // در لحظه‌ی رصد (v3.5)
      arcv: data.arcv,
      arcl: data.arcl,
      lagTime: data.lagTime,
      moonAge: data.moonAge,
      crescentWidth: data.crescentWidth,
      illuminationPercent: data.illuminationPercent,
      yallopCat: data.yallopCat,
      odehCat: data.odehCat,
      saaoCat: data.saaoCat,
      ilyasCat: data.ilyasCat,
      malaysiaCat: data.malaysiaCat,
      soroudiCat: data.soroudiCat,
      schaeferCat: data.schaeferCat,
      schaeferR: (typeof data.schaeferR === 'number' && isFinite(data.schaeferR)) ? Math.round(data.schaeferR * 100) / 100 : null,
    };
  } catch (e) {
    console.error('خطا در محاسبه‌ی عکس‌فوری نجومی:', e);
    return null;
  }
}

// ==============================================================
// تبدیل ردیف snake_case دیتابیس Postgres به شکل camelCase که
// UI (BrowseReportsScreen.js, SightingReportFormScreen.js) انتظار
// دارد — دقیقاً همان shape که قبلاً از docSnap.data() می‌آمد.
// ==============================================================
function rowToReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.uid,
    fullName: row.full_name,
    email: row.email || '',
    country: row.country || '',
    countryOther: row.country_other || null,
    province: row.province || '',
    city: row.city || '',
    latitude: row.latitude,
    longitude: row.longitude,
    elevation: row.elevation || 0,
    locationSource: row.location_source || 'manual',
    sightingDateISO: row.sighting_date_iso,
    hijriMonthKey: row.hijri_month_key,
    // معادل Timestamp قبلی: یک شیء با toMillis() برای سازگاری با
    // مرتب‌سازی‌های موجود در BrowseReportsScreen.js که به
    // r.timestamp.toMillis() متکی است.
    conjunction: row.conjunction ? new Date(row.conjunction) : null,
    timestamp: wrapAsFirestoreLikeTimestamp(row.created_at),
    sightingResult: row.sighting_result,
    noAttemptReason: row.no_attempt_reason || null,
    equipment: row.equipment || EQUIPMENT_TYPES.NONE,
    weather: row.weather || null,
    horizonQuality: row.horizon_quality || null,
    cloudPercent: row.cloud_percent !== null && row.cloud_percent !== undefined ? row.cloud_percent : null,
    notes: row.notes || '',
    // UI همیشه از photoBase64 به‌عنوان uri تصویر استفاده می‌کند
    // (<Image source={{uri: r.photoBase64}}>) — این‌جا به‌جای رشته‌ی
    // Base64، همان URL عمومی/امضاشده‌ی فایل در Storage قرار
    // می‌گیرد؛ چون Image هم data-URI و هم URL معمولی را می‌پذیرد،
    // این تغییر برای UI شفاف است.
    photoBase64: row.photo_url || null,
    photoPath: row.photo_path || null,
    photoArchived: !!row.photo_archived,
    astronomicalSnapshot: row.astronomical_snapshot || null,
    suspicionLevel: row.suspicion_level || 'none',
    suspicionReason: row.suspicion_reason || '',
    verified: !!row.verified,
    likesCount: row.likes_count || 0,
    editedAt: row.edited_at ? wrapAsFirestoreLikeTimestamp(row.edited_at) : null,
    // نسخه ۴ (افزونه‌ی بج): فقط وقتی از TABLE_FOR_READS (که یک View
    // با join به user_profiles است) خوانده شده باشد مقدار دارد؛ در
    // خواندن از جدول خام TABLE (مثلاً داخل updateReport/deleteReport
    // که فقط برای چک مالکیت است) undefined می‌ماند که بی‌ضرر است.
    reporterBadge: row.reporter_badge || null,
  };
}

// شبیه‌سازی رابط Firestore Timestamp (.toMillis()) که کدهای مرتب‌سازی
// موجود در BrowseReportsScreen.js از آن استفاده می‌کنند، تا آن فایل
// نیازی به تغییر نداشته باشد.
function wrapAsFirestoreLikeTimestamp(isoOrDate) {
  if (!isoOrDate) return null;
  var d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return { toMillis: function () { return d.getTime(); }, toDate: function () { return d; } };
}

// ==============================================================
// آپلود عکس به Supabase Storage. خروجی: { path, url } یا null
// ==============================================================
async function uploadPhoto(uid, localCompressedUri, base64Data) {
  try {
    var fileName = uid + '/' + Date.now() + '.jpg';

    // React Native fetch از base64 → ArrayBuffer برای آپلود باینری
    var arrayBuffer = base64ToArrayBuffer(base64Data);

    var uploadResult = await supabase.storage
      .from(SIGHTING_PHOTOS_BUCKET)
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadResult.error) {
      console.error('خطا در آپلود عکس به Supabase Storage:', uploadResult.error);
      return null;
    }

    var publicUrlResult = supabase.storage.from(SIGHTING_PHOTOS_BUCKET).getPublicUrl(fileName);
    var url = publicUrlResult.data ? publicUrlResult.data.publicUrl : null;

    return { path: fileName, url: url };
  } catch (e) {
    console.error('خطا در آپلود عکس:', e);
    return null;
  }
}

async function deletePhoto(photoPath) {
  if (!photoPath) return;
  try {
    await supabase.storage.from(SIGHTING_PHOTOS_BUCKET).remove([photoPath]);
  } catch (e) {
    console.error('خطا در حذف عکس از Storage:', e);
  }
}

function base64ToArrayBuffer(base64) {
  var binaryString = global.atob ? global.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  var len = binaryString.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

var SightingReports = {

  SIGHTING_RESULTS: SIGHTING_RESULTS,
  NO_ATTEMPT_REASONS: NO_ATTEMPT_REASONS,
  EQUIPMENT_TYPES: EQUIPMENT_TYPES,
  WEATHER_CONDITIONS: WEATHER_CONDITIONS,
  HORIZON_QUALITY: HORIZON_QUALITY,
  SIGHTING_WINDOW_HOURS: SIGHTING_WINDOW_HOURS,
  OTHER_COUNTRY_CODE: OTHER_COUNTRY_CODE,
  MAX_REPORTS_PER_MONTH: MAX_REPORTS_PER_MONTH,
  MAX_NOTES_LENGTH: MAX_NOTES_LENGTH,
  MAX_NAME_LENGTH: MAX_NAME_LENGTH,
  validateSightingWindow: validateSightingWindow,
  computeAstronomicalSnapshot: computeAstronomicalSnapshot,

  evaluateReportPlausibility: function (snapshot, sightingResult) {
    var none = { suspicionLevel: 'none', reason: '', code: null };
    if (!snapshot) return none;
    var claimsSeen = sightingResult === SIGHTING_RESULTS.SEEN_NAKED_EYE
      || sightingResult === SIGHTING_RESULTS.SEEN_OPTICAL;
    if (!claimsSeen) return none;

    if (snapshot.moonAge !== null && snapshot.moonAge !== undefined && snapshot.moonAge < 0) {
      return { suspicionLevel: 'high', code: 'BEFORE_CONJUNCTION',
        reason: 'زمان گزارش‌شده قبل از لحظه‌ی مقارنه (نه‌ماه) است؛ در این حالت هلالی برای رؤیت وجود ندارد.' };
    }
    // v3.5: ارتفاع ماه در «لحظه‌ی رصد» (نه ارتفاع غروب خورشید)
    var alt = (snapshot.moonAltitudeAtSighting !== null && snapshot.moonAltitudeAtSighting !== undefined)
      ? snapshot.moonAltitudeAtSighting : snapshot.moonAltitude;
    if (alt !== null && alt !== undefined && alt < -1) {
      return { suspicionLevel: 'high', code: 'MOON_BELOW_HORIZON',
        reason: 'طبق محاسبات، ماه در این زمان و مکان زیر افق بوده است.' };
    }
    if (snapshot.sunAltitudeAtSighting !== null && snapshot.sunAltitudeAtSighting !== undefined
        && snapshot.sunAltitudeAtSighting > 2 && sightingResult === SIGHTING_RESULTS.SEEN_NAKED_EYE) {
      return { suspicionLevel: 'low', code: 'DAYLIGHT_NAKED_EYE',
        reason: 'در این زمان خورشید بالای افق بوده است؛ رؤیت هلال با چشم غیرمسلح در روشنایی روز بسیار نامحتمل است.' };
    }
    if (sightingResult === SIGHTING_RESULTS.SEEN_NAKED_EYE) {
      var bestCat = snapshot.soroudiCat || snapshot.yallopCat;
      if (bestCat === 'F') {
        return { suspicionLevel: 'low', code: 'ALL_CRITERIA_F',
          reason: 'طبق تمام معیارهای رؤیت‌پذیری این اپ، هلال در این شرایط قابل‌مشاهده با چشم غیرمسلح ارزیابی نشده است.' };
      }
    }
    return none;
  },

  // اعتبارسنجی ورودی فرم (سمت سرویس؛ UI هم پیش از ارسال بررسی می‌کند)
  validateReportInput: function (report) {
    if (!report.fullName || !report.fullName.trim()) return { ok: false, error: 'MISSING_NAME' };
    if (report.fullName.trim().length > MAX_NAME_LENGTH) return { ok: false, error: 'NAME_TOO_LONG' };
    if (report.email && report.email.trim()) {
      var em = report.email.trim();
      if (em.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { ok: false, error: 'INVALID_EMAIL' };
    }
    if (report.notes && report.notes.length > MAX_NOTES_LENGTH) return { ok: false, error: 'NOTES_TOO_LONG' };
    var validResults = Object.keys(SIGHTING_RESULTS).map(function (k) { return SIGHTING_RESULTS[k]; });
    if (validResults.indexOf(report.sightingResult) === -1) return { ok: false, error: 'INVALID_RESULT' };
    if (report.cloudPercent !== null && report.cloudPercent !== undefined) {
      var cp = Number(report.cloudPercent);
      if (isNaN(cp) || cp < 0 || cp > 100) return { ok: false, error: 'INVALID_CLOUD' };
    }
    if (report.latitude !== null && report.latitude !== undefined) {
      if (isNaN(report.latitude) || Math.abs(report.latitude) > 90) return { ok: false, error: 'INVALID_COORDS' };
    }
    if (report.longitude !== null && report.longitude !== undefined) {
      if (isNaN(report.longitude) || Math.abs(report.longitude) > 180) return { ok: false, error: 'INVALID_COORDS' };
    }
    return { ok: true };
  },

  checkFirestoreConnection: async function () {
    // نام تابع عمداً همین نگه داشته شده (نه checkSupabaseConnection)
    // تا SightingReportScreen.js نیازی به تغییر نداشته باشد.
    try {
      var result = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).limit(1);
      if (result.error) return { connected: false, error: result.error.message };
      return { connected: true };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  },

  // v3.5: تا MAX_REPORTS_PER_MONTH گزارش در هر ماه قمری
  checkRateLimit: async function (uid, hijriMonthKey) {
    try {
      var result = await supabase
        .from(TABLE)
        .select('id')
        .eq('uid', uid)
        .eq('hijri_month_key', hijriMonthKey)
        .limit(MAX_REPORTS_PER_MONTH + 1);
      if (result.error) throw result.error;
      var rows = result.data || [];
      return {
        allowed: rows.length < MAX_REPORTS_PER_MONTH,
        count: rows.length,
        max: MAX_REPORTS_PER_MONTH,
        existingReportId: rows.length > 0 ? rows[0].id : null,
      };
    } catch (e) {
      // در خطای شبکه اجازه می‌دهیم؛ سقف نهایی را تریگر سرور اعمال می‌کند
      return { allowed: true, count: 0, max: MAX_REPORTS_PER_MONTH, existingReportId: null };
    }
  },

  submitReport: async function (report, onProgress) {
    var authResult = await AuthService.ensureSignedIn();
    if (!authResult.success) {
      return { success: false, error: 'AUTH_FAILED', message: 'خطا در احراز هویت. اتصال اینترنت خود را بررسی کنید.' };
    }
    var uid = authResult.uid;

    var valid = this.validateReportInput(report);
    if (!valid.ok) {
      return { success: false, error: valid.error, message: 'اطلاعات واردشده معتبر نیست.' };
    }

    var sightingDate = new Date(report.sightingDateISO);
    var windowCheck = validateSightingWindow(sightingDate, report.conjunction);
    if (!windowCheck.valid) {
      if (windowCheck.reason === 'BEFORE_CONJUNCTION') {
        return { success: false, error: 'BEFORE_CONJUNCTION', message: 'تاریخ رصد نمی‌تواند قبل از لحظه‌ی مقارنه باشد.' };
      }
      return { success: false, error: 'AFTER_WINDOW', message: 'تاریخ رصد باید حداکثر تا ' + SIGHTING_WINDOW_HOURS + ' ساعت پس از مقارنه باشد.' };
    }

    var hEst = HijriCalendar.getNextHijriMonth(report.conjunction);
    var hijriMonthKey = hEst.year + '-' + hEst.month;

    var rateCheck = await this.checkRateLimit(uid, hijriMonthKey);
    if (!rateCheck.allowed) {
      return { success: false, error: 'RATE_LIMIT', existingReportId: rateCheck.existingReportId, count: rateCheck.count, max: rateCheck.max };
    }

    var snapshot = computeAstronomicalSnapshot(sightingDate, report.latitude, report.longitude, report.elevation, report.conjunction);
    var plausibility = this.evaluateReportPlausibility(snapshot, report.sightingResult);
    // کد دلیل مشکوک بودن در خودِ snapshot نگهداری می‌شود (بدون نیاز به ستون جدید)
    if (snapshot && plausibility.code) snapshot.suspicionCode = plausibility.code;

    var photoPath = null;
    var photoUrl = null;
    if (report.photoLocalUri) {
      if (onProgress) onProgress('compressing');
      var ImageCompression = require('./imageCompression');
      var compressed = await ImageCompression.compressImageForUpload(report.photoLocalUri);
      if (compressed) {
        if (onProgress) onProgress('uploading');
        var uploaded = await uploadPhoto(uid, compressed.uri, compressed.base64);
        if (uploaded) {
          photoPath = uploaded.path;
          photoUrl = uploaded.url;
        } else {
          console.warn('آپلود عکس ناموفق بود؛ گزارش بدون عکس ثبت می‌شود.');
        }
      } else {
        console.warn('فشرده‌سازی عکس ناموفق بود؛ گزارش بدون عکس ثبت می‌شود.');
      }
    }

    var insertData = {
      uid: uid,
      full_name: report.fullName.trim(),
      email: report.email ? report.email.trim() : '',
      country: report.country || '',
      country_other: report.countryOther || null,
      province: report.province || '',
      city: report.city || '',
      latitude: report.latitude,
      longitude: report.longitude,
      elevation: report.elevation || 0,
      location_source: report.locationSource || 'manual',
      sighting_date_iso: report.sightingDateISO,
      hijri_month_key: hijriMonthKey,
      conjunction: report.conjunction.toISOString(),
      sighting_result: report.sightingResult,
      no_attempt_reason: report.noAttemptReason || null,
      equipment: report.equipment || EQUIPMENT_TYPES.NONE,
      weather: report.weather || null,
      horizon_quality: report.horizonQuality || null,
      cloud_percent: report.cloudPercent !== undefined ? report.cloudPercent : null,
      notes: report.notes || '',
      photo_path: photoPath,
      photo_url: photoUrl,
      astronomical_snapshot: snapshot,
      suspicion_level: plausibility.suspicionLevel,
      suspicion_reason: plausibility.reason,
      verified: false,
      likes_count: 0,
    };

    try {
      if (onProgress) onProgress('uploading');
      var result = await supabase.from(TABLE).insert(insertData).select('id').single();
      if (result.error) throw result.error;
      return { success: true, id: result.data.id, hasPhoto: !!photoUrl, suspicionLevel: plausibility.suspicionLevel };
    } catch (e) {
      console.error('خطا در ثبت گزارش:', e);
      var msg = (e && e.message) || '';
      if (msg.indexOf('REPORT_LIMIT_REACHED') !== -1) {
        // عکس آپلودشده‌ی بی‌مصرف را پاک کن
        if (photoPath) await deletePhoto(photoPath);
        return { success: false, error: 'RATE_LIMIT', max: MAX_REPORTS_PER_MONTH };
      }
      if (photoPath) await deletePhoto(photoPath);
      return { success: false, error: 'NETWORK' };
    }
  },

  updateReport: async function (reportId, updates, onProgress) {
    var authResult = await AuthService.ensureSignedIn();
    if (!authResult.success) {
      return { success: false, error: 'AUTH_FAILED' };
    }
    var uid = authResult.uid;

    try {
      var existingResult = await supabase.from(TABLE).select('*').eq('id', reportId).single();
      if (existingResult.error || !existingResult.data) {
        return { success: false, error: 'NOT_FOUND' };
      }
      var existingData = existingResult.data;
      if (existingData.uid !== uid) {
        return { success: false, error: 'NOT_OWNER', message: 'شما مالک این گزارش نیستید.' };
      }

      var sightingDate = new Date(updates.sightingDateISO || existingData.sighting_date_iso);
      if (updates.conjunction) {
        var windowCheck = validateSightingWindow(sightingDate, updates.conjunction);
        if (!windowCheck.valid) {
          return { success: false, error: windowCheck.reason === 'BEFORE_CONJUNCTION' ? 'BEFORE_CONJUNCTION' : 'AFTER_WINDOW' };
        }
      }

      var photoPath = existingData.photo_path;
      var photoUrl = existingData.photo_url;
      if (updates.photoLocalUri) {
        if (onProgress) onProgress('compressing');
        var ImageCompression = require('./imageCompression');
        var compressed = await ImageCompression.compressImageForUpload(updates.photoLocalUri);
        if (compressed) {
          if (onProgress) onProgress('uploading');
          // عکس قدیمی (اگر بود) پس از موفقیت آپلود جدید حذف می‌شود
          var oldPhotoPath = existingData.photo_path;
          var uploaded = await uploadPhoto(uid, compressed.uri, compressed.base64);
          if (uploaded) {
            photoPath = uploaded.path;
            photoUrl = uploaded.url;
            if (oldPhotoPath) await deletePhoto(oldPhotoPath);
          }
        }
      } else if (updates.removePhoto) {
        if (existingData.photo_path) await deletePhoto(existingData.photo_path);
        photoPath = null;
        photoUrl = null;
      }

      var conjForSnapshot = updates.conjunction || (existingData.conjunction ? new Date(existingData.conjunction) : null);
      var snapshot = updates.latitude !== undefined
        ? computeAstronomicalSnapshot(sightingDate, updates.latitude, updates.longitude, updates.elevation, conjForSnapshot)
        : existingData.astronomical_snapshot;
      var plausibility = this.evaluateReportPlausibility(snapshot, updates.sightingResult || existingData.sighting_result);
      if (snapshot) {
        if (plausibility.code) snapshot.suspicionCode = plausibility.code; else delete snapshot.suspicionCode;
      }

      var updateData = {
        full_name: updates.fullName !== undefined ? updates.fullName.trim() : existingData.full_name,
        email: updates.email !== undefined ? updates.email.trim() : existingData.email,
        country: updates.country !== undefined ? updates.country : existingData.country,
        country_other: updates.countryOther !== undefined ? updates.countryOther : existingData.country_other,
        province: updates.province !== undefined ? updates.province : existingData.province,
        city: updates.city !== undefined ? updates.city : existingData.city,
        latitude: updates.latitude !== undefined ? updates.latitude : existingData.latitude,
        longitude: updates.longitude !== undefined ? updates.longitude : existingData.longitude,
        elevation: updates.elevation !== undefined ? updates.elevation : existingData.elevation,
        sighting_date_iso: updates.sightingDateISO || existingData.sighting_date_iso,
        sighting_result: updates.sightingResult || existingData.sighting_result,
        no_attempt_reason: updates.noAttemptReason !== undefined ? updates.noAttemptReason : existingData.no_attempt_reason,
        equipment: updates.equipment || existingData.equipment,
        weather: updates.weather !== undefined ? updates.weather : existingData.weather,
        horizon_quality: updates.horizonQuality !== undefined ? updates.horizonQuality : existingData.horizon_quality,
        cloud_percent: updates.cloudPercent !== undefined ? updates.cloudPercent : existingData.cloud_percent,
        notes: updates.notes !== undefined ? updates.notes : existingData.notes,
        photo_path: photoPath,
        photo_url: photoUrl,
        astronomical_snapshot: snapshot,
        suspicion_level: plausibility.suspicionLevel,
        suspicion_reason: plausibility.reason,
        edited_at: new Date().toISOString(),
      };

      if (onProgress) onProgress('uploading');
      var updateResult = await supabase.from(TABLE).update(updateData).eq('id', reportId);
      if (updateResult.error) throw updateResult.error;
      return { success: true, id: reportId };
    } catch (e) {
      console.error('خطا در ویرایش گزارش:', e);
      return { success: false, error: 'NETWORK' };
    }
  },

  deleteReport: async function (reportId) {
    var authResult = await AuthService.ensureSignedIn();
    if (!authResult.success) {
      return { success: false, error: 'AUTH_FAILED' };
    }
    var uid = authResult.uid;

    try {
      var existingResult = await supabase.from(TABLE).select('uid, photo_path').eq('id', reportId).single();
      if (existingResult.error || !existingResult.data) {
        return { success: false, error: 'NOT_FOUND' };
      }
      if (existingResult.data.uid !== uid) {
        return { success: false, error: 'NOT_OWNER' };
      }

      var deleteResult = await supabase.from(TABLE).delete().eq('id', reportId);
      if (deleteResult.error) throw deleteResult.error;

      // حذف عکس مرتبط از Storage (best-effort؛ شکست این کار مانع
      // موفقیت حذف گزارش نمی‌شود)
      if (existingResult.data.photo_path) {
        await deletePhoto(existingResult.data.photo_path);
      }

      return { success: true };
    } catch (e) {
      console.error('خطا در حذف گزارش:', e);
      return { success: false, error: 'NETWORK' };
    }
  },

  // v3.5: همه‌ی گزارش‌های کاربر در یک ماه قمری (قدیمی‌ترین اول)
  getMyReportsForMonth: async function (hijriMonthKey) {
    var authResult = await AuthService.ensureSignedIn();
    if (!authResult.success) return [];
    try {
      var result = await supabase
        .from(TABLE_FOR_READS)
        .select('*')
        .eq('uid', authResult.uid)
        .eq('hijri_month_key', hijriMonthKey)
        .order('created_at', { ascending: true })
        .limit(MAX_REPORTS_PER_MONTH + 2);
      if (result.error) throw result.error;
      return (result.data || []).map(rowToReport);
    } catch (e) {
      return [];
    }
  },

  // سازگاری با فراخوان‌های قدیمی: اولین گزارش یا null
  getMyReportForMonth: async function (hijriMonthKey) {
    var list = await this.getMyReportsForMonth(hijriMonthKey);
    return list.length > 0 ? list[0] : null;
  },

  getAvailableMonths: async function () {
    var months = null;
    try {
      // v3.5: شمارش سمت سرور (sql/006)، بدون سقف ۱۰۰۰ردیفیِ پیش‌فرض
      var rpc = await supabase.rpc('report_month_counts');
      if (!rpc.error && Array.isArray(rpc.data)) {
        months = rpc.data.map(function (r) { return { key: r.hijri_month_key, n: Number(r.n) }; });
      }
    } catch (e) {}
    if (!months) {
      try {
        var result = await supabase.from(TABLE).select('hijri_month_key').order('created_at', { ascending: false }).range(0, 4999);
        if (result.error) throw result.error;
        var counts = {};
        (result.data || []).forEach(function (row) {
          if (!row.hijri_month_key) return;
          counts[row.hijri_month_key] = (counts[row.hijri_month_key] || 0) + 1;
        });
        months = Object.keys(counts).map(function (k) { return { key: k, n: counts[k] }; });
      } catch (e2) {
        console.error('خطا در خواندن ماه‌های موجود:', e2);
        return [];
      }
    }
    var out = months.filter(function (m) { return m.key; }).map(function (m) {
      var parts = m.key.split('-');
      return { hijriMonthKey: m.key, year: parseInt(parts[0], 10), monthIndex: parseInt(parts[1], 10), count: m.n };
    });
    out.sort(function (a, b) {
      if (a.year !== b.year) return b.year - a.year;
      return b.monthIndex - a.monthIndex;
    });
    return out;
  },

  getAvailableCountriesForMonth: async function (hijriMonthKey) {
    var list = null;
    try {
      var rpc = await supabase.rpc('report_country_counts', { p_month: hijriMonthKey });
      if (!rpc.error && Array.isArray(rpc.data)) {
        list = rpc.data.map(function (r) { return { countryCode: r.country, count: Number(r.n) }; });
      }
    } catch (e) {}
    if (!list) {
      try {
        var result = await supabase.from(TABLE).select('country').eq('hijri_month_key', hijriMonthKey).range(0, 4999);
        if (result.error) throw result.error;
        var counts = {};
        (result.data || []).forEach(function (row) {
          if (!row.country) return;
          counts[row.country] = (counts[row.country] || 0) + 1;
        });
        list = Object.keys(counts).map(function (c) { return { countryCode: c, count: counts[c] }; });
      } catch (e2) {
        console.error('خطا در خواندن کشورهای موجود:', e2);
        return [];
      }
    }
    list.sort(function (a, b) { return b.count - a.count; });
    return list;
  },

  getReportsByMonthAndCountry: async function (hijriMonthKey, countryCode) {
    try {
      var result = await supabase
        .from(TABLE_FOR_READS)
        .select('*')
        .eq('hijri_month_key', hijriMonthKey)
        .eq('country', countryCode);
      if (result.error) throw result.error;
      var rows = (result.data || []).map(rowToReport);
      rows.sort(function (a, b) {
        var ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
        var tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
        return tb - ta;
      });
      return rows;
    } catch (e) {
      console.error('خطا در خواندن گزارش‌های کشور:', e);
      return [];
    }
  },

  // v3.5: همه‌ی فیلترها سمت سرور + مرتب‌سازی جدیدترین‌ها اول + صفحه‌بندی.
  // filters.limit (پیش‌فرض ۲۰۰) و filters.offset (پیش‌فرض ۰) اختیاری‌اند.
  searchReports: async function (filters) {
    filters = filters || {};
    try {
      var limit = Math.min(Math.max(parseInt(filters.limit, 10) || 200, 1), 500);
      var offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
      var q = supabase.from(TABLE_FOR_READS).select('*');
      if (filters.hijriMonthKey) q = q.eq('hijri_month_key', filters.hijriMonthKey);
      if (filters.country) q = q.eq('country', filters.country);

      var esc = function (txt) { return String(txt).trim().replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ').trim(); };
      if (filters.nameQuery && esc(filters.nameQuery)) {
        var nq = esc(filters.nameQuery);
        q = q.or('full_name.ilike.%' + nq + '%,city.ilike.%' + nq + '%');
      }
      if (filters.cityQuery && esc(filters.cityQuery)) {
        q = q.ilike('city', '%' + esc(filters.cityQuery) + '%');
      }
      if (filters.resultFilter === 'seen_only') {
        q = q.in('sighting_result', [SIGHTING_RESULTS.SEEN_NAKED_EYE, SIGHTING_RESULTS.SEEN_OPTICAL]);
      } else if (filters.resultFilter === 'not_seen_only') {
        q = q.eq('sighting_result', SIGHTING_RESULTS.NOT_SEEN);
      } else if (filters.resultFilter === 'naked_eye_only') {
        q = q.eq('sighting_result', SIGHTING_RESULTS.SEEN_NAKED_EYE);
      } else if (filters.resultFilter === 'equipment_only') {
        q = q.eq('sighting_result', SIGHTING_RESULTS.SEEN_OPTICAL);
      }
      q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      var result = await q;
      if (result.error) throw result.error;
      return (result.data || []).map(rowToReport);
    } catch (e) {
      console.error('خطا در جست‌وجوی گزارش‌ها:', e);
      return [];
    }
  },

  // ⚠️ ابزار مدیریتی — از داخل UI کاربران صدا زده نمی‌شود (و با RLS فعلی فقط
  // ردیف‌های خودِ کاربر را تغییر می‌دهد). آرشیو واقعی با Edge Function انجام می‌شود.
  // v3.5: مقایسه‌ی سال به‌صورت عددی (قبلاً بازه‌ی رشته‌ای ماه‌های ۲ تا ۹ را حذف می‌کرد).
  archivePhotosForYear: async function (hijriYear) {
    try {
      var result = await supabase
        .from(TABLE)
        .select('id, photo_path, hijri_month_key')
        .not('photo_path', 'is', null)
        .range(0, 4999);
      if (result.error) throw result.error;

      var rows = (result.data || []).filter(function (r) {
        return r.photo_path && parseInt(String(r.hijri_month_key).split('-')[0], 10) === hijriYear;
      });
      var updated = 0;

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        await deletePhoto(row.photo_path);
        var updRes = await supabase
          .from(TABLE)
          .update({ photo_path: null, photo_url: null, photo_archived: true })
          .eq('id', row.id);
        if (!updRes.error) updated++;
      }

      return { success: true, count: updated };
    } catch (e) {
      console.error('خطا در آرشیو سالانه:', e);
      return { success: false, count: 0, error: e.message };
    }
  },

  getSightingResultLabelKey: function (result) {
    if (result === SIGHTING_RESULTS.SEEN_NAKED_EYE) return 'resultSeenNakedEye';
    if (result === SIGHTING_RESULTS.SEEN_OPTICAL) return 'resultSeenOptical';
    if (result === SIGHTING_RESULTS.NOT_SEEN) return 'resultNotSeen';
    if (result === SIGHTING_RESULTS.NOT_ATTEMPTED) return 'resultNotAttempted';
    return 'unknownValue';
  },

  getNoAttemptReasonLabelKey: function (reason) {
    if (reason === NO_ATTEMPT_REASONS.CLOUDS) return 'reasonClouds';
    if (reason === NO_ATTEMPT_REASONS.DUST) return 'reasonDust';
    if (reason === NO_ATTEMPT_REASONS.RAIN) return 'reasonRain';
    if (reason === NO_ATTEMPT_REASONS.BAD_HORIZON) return 'reasonBadHorizon';
    if (reason === NO_ATTEMPT_REASONS.EQUIPMENT_FAILURE) return 'reasonEquipmentFailure';
    if (reason === NO_ATTEMPT_REASONS.OTHER) return 'reasonOther';
    return '';
  },

  getEquipmentLabelKey: function (eq) {
    if (eq === EQUIPMENT_TYPES.NONE) return 'equipmentNone';
    if (eq === EQUIPMENT_TYPES.BINOCULARS) return 'equipmentBinoculars';
    if (eq === EQUIPMENT_TYPES.TELESCOPE) return 'equipmentTelescope';
    if (eq === EQUIPMENT_TYPES.CCD) return 'equipmentCCD';
    if (eq === EQUIPMENT_TYPES.CAMERA) return 'equipmentCamera';
    if (eq === EQUIPMENT_TYPES.OTHER) return 'equipmentOther';
    return '';
  },

  getWeatherLabelKey: function (w) {
    if (w === WEATHER_CONDITIONS.CLEAR) return 'weatherClear';
    if (w === WEATHER_CONDITIONS.PARTLY_CLOUDY) return 'weatherPartlyCloudy';
    if (w === WEATHER_CONDITIONS.CLOUDY) return 'weatherCloudy';
    if (w === WEATHER_CONDITIONS.DUSTY) return 'weatherDusty';
    if (w === WEATHER_CONDITIONS.FOGGY) return 'weatherFoggy';
    return '';
  },

  getHorizonQualityLabelKey: function (h) {
    if (h === HORIZON_QUALITY.EXCELLENT) return 'horizonExcellent';
    if (h === HORIZON_QUALITY.GOOD) return 'horizonGood';
    if (h === HORIZON_QUALITY.MODERATE) return 'horizonModerate';
    if (h === HORIZON_QUALITY.POOR) return 'horizonPoor';
    return '';
  },

};

module.exports = SightingReports;