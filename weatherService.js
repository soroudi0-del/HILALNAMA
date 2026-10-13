// ============================================================
// weatherService — v3.6. داده‌ی جوی آنلاین (پیش‌فرض روشن؛ کاربر می‌تواند در تنظیمات خاموش کند).
//
// دلیل روشن‌بودن: مدل Schaefer برای ضریب میرایی (k) به AOD، فشار و رطوبت واقعیِ همان شب نیاز
// دارد. بدون آن، از برآورد پیش‌فرض (ارتفاع + رطوبت ۶۰٪) استفاده می‌شود که می‌تواند چند دهم
// تا چند واحد R خطا داشته باشد.
//
// منبع: Open-Meteo (رایگان، بدون کلید؛ استفاده‌ی غیرتجاری):
//   • https://api.open-meteo.com/v1/forecast          — ابر (کل/پایین/میانی/بالا)، دما، رطوبت، فشار، دید افقی
//   • https://air-quality-api.open-meteo.com/v1/air-quality — aerosol_optical_depth، dust، pm10، ozone (CAMS)
//
// حریم خصوصی: فقط مختصات (به ۲ رقم اعشار گرد، ≈ ۱ کیلومتر) به Open-Meteo فرستاده
// می‌شود، آن هم تا وقتی کاربر در تنظیمات خاموش نکرده باشد. بدون حساب/شناسه.
//
// هر خطا (شبکه، فیلترینگ، سقف نرخ، خارج از بازه‌ی پیش‌بینی) ⇒ null؛ برنامه با مقادیر
// پیش‌فرض (میانگین) ادامه می‌دهد و هرگز نمی‌شکند.
// ============================================================
var AsyncStorageModule = require('@react-native-async-storage/async-storage');
var Storage = AsyncStorageModule.default || AsyncStorageModule;

var ENABLED_KEY = 'weatherEnabled';
var CACHE_PREFIX = 'atmo:';
var CACHE_TTL_MS = 3 * 3600000;
var TIMEOUT_MS = 9000;
var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
var AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

function round2(v) { return Math.round(v * 100) / 100; }

function parseUtc(s) { return new Date(s + (/Z$|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')).getTime(); }

// نزدیک‌ترین اندیس ساعت به when؛ اگر بیش از ۹۰ دقیقه فاصله باشد: -1
function nearestIndex(times, when) {
  if (!times || !times.length) return -1;
  var t = when.getTime(), best = -1, bd = Infinity;
  for (var i = 0; i < times.length; i++) {
    var d = Math.abs(parseUtc(times[i]) - t);
    if (d < bd) { bd = d; best = i; }
  }
  return bd <= 90 * 60000 ? best : -1;
}
function at(arr, i) { return arr && i >= 0 && typeof arr[i] === 'number' ? arr[i] : null; }

// تابع خالص برای تست: دو پاسخ JSON ⇒ شیء جوی
function parseAtmosphere(forecast, air, when) {
  var out = { source: 'open-meteo', when: when, cloud: { total: null, low: null, mid: null, high: null }, tempC: null, humidity: null, pressureHPa: null, visibilityKm: null, aod: null, dust: null, pm10: null, ozone: null, forecastHour: null, airHour: null };
  var hf = forecast && forecast.hourly, ha = air && air.hourly;
  if (hf) {
    var i = nearestIndex(hf.time, when);
    if (i >= 0) {
      out.forecastHour = new Date(parseUtc(hf.time[i]));
      out.cloud.total = at(hf.cloud_cover, i); out.cloud.low = at(hf.cloud_cover_low, i);
      out.cloud.mid = at(hf.cloud_cover_mid, i); out.cloud.high = at(hf.cloud_cover_high, i);
      out.tempC = at(hf.temperature_2m, i); out.humidity = at(hf.relative_humidity_2m, i);
      out.pressureHPa = at(hf.surface_pressure, i);
      var vis = at(hf.visibility, i); out.visibilityKm = vis === null ? null : vis / 1000;
    }
  }
  if (ha) {
    var j = nearestIndex(ha.time, when);
    if (j >= 0) {
      out.airHour = new Date(parseUtc(ha.time[j]));
      out.aod = at(ha.aerosol_optical_depth, j); out.dust = at(ha.dust, j);
      out.pm10 = at(ha.pm10, j); out.ozone = at(ha.ozone, j);
    }
  }
  var any = out.cloud.total !== null || out.aod !== null || out.pressureHPa !== null;
  return any ? out : null;
}

async function fetchJson(url) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
  try {
    var res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}

var WeatherService = {
  parseAtmosphere: parseAtmosphere, nearestIndex: nearestIndex,

  // پیش‌فرض روشن: فقط اگر کاربر صریحاً خاموش کرده باشد ('false') خاموش است.
  isEnabled: async function () {
    try { return (await Storage.getItem(ENABLED_KEY)) !== 'false'; } catch (e) { return true; }
  },
  setEnabled: async function (on) {
    try { await Storage.setItem(ENABLED_KEY, on ? 'true' : 'false'); } catch (e) {}
  },

  buildUrls: function (lat, lon) {
    var q = 'latitude=' + round2(lat) + '&longitude=' + round2(lon) + '&timezone=GMT';
    return {
      forecast: FORECAST_URL + '?' + q + '&past_days=3&forecast_days=7&hourly=temperature_2m,relative_humidity_2m,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility',
      air: AIR_URL + '?' + q + '&past_days=3&forecast_days=5&hourly=aerosol_optical_depth,dust,pm10,ozone',
    };
  },

  // when: لحظه‌ی موردنظر (مثلاً غروب خورشید یا Tbest). فقط اگر کاربر فعال کرده باشد.
  getAtmosphere: async function (city, when) {
    if (!city || !when) return null;
    if (!(await this.isEnabled())) return null;
    var key = CACHE_PREFIX + round2(city.lat) + ':' + round2(city.lon);
    try {
      var cached = JSON.parse((await Storage.getItem(key)) || 'null');
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        var hit = parseAtmosphere(cached.forecast, cached.air, when);
        if (hit) { hit.fromCache = true; return hit; }
      }
    } catch (e) {}
    var urls = this.buildUrls(city.lat, city.lon);
    var results = await Promise.all([fetchJson(urls.forecast), fetchJson(urls.air)]);
    if (!results[0] && !results[1]) return null;
    try { await Storage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), forecast: results[0], air: results[1] })); } catch (e) {}
    return parseAtmosphere(results[0], results[1], when);
  },
};

// ورودی مدل Schaefer از شیء جوی (فقط مقادیر واقعاً دریافت‌شده؛ بقیه undefined تا مدل برآورد کند)
function toSchaeferInput(atm) {
  if (!atm) return null;
  var w = {};
  if (typeof atm.humidity === 'number') w.humidityPct = atm.humidity;
  if (typeof atm.pressureHPa === 'number') w.pressureHPa = atm.pressureHPa;
  if (typeof atm.aod === 'number') w.aod = atm.aod;
  if (typeof atm.tempC === 'number') w.tempC = atm.tempC;
  return (w.aod !== undefined || w.pressureHPa !== undefined || w.humidityPct !== undefined) ? w : null;
}

var PAST_DAYS = 3, FORECAST_DAYS = 7, AIR_FORECAST_DAYS = 5;
// آیا لحظه‌ی when در بازه‌ای است که Open-Meteo داده دارد؟
function inRange(when) {
  var d = (when.getTime() - Date.now()) / 86400000;
  return d >= -PAST_DAYS && d <= FORECAST_DAYS;
}

// وضعیت داده‌ی جوی برای Schaefer در لحظه‌ی when:
//   'off'         کاربر خاموش کرده ⇒ Schaefer با برآورد پیش‌فرض (کم‌دقت)
//   'outOfRange'  تاریخ خارج از بازه‌ی Open-Meteo (حدود ۳ روز قبل تا ۷ روز بعد)
//   'unavailable' دریافت نشد (آفلاین/فیلترینگ/خطا)
//   'partial'     فقط بخشی (مثلاً AOD نبود) ⇒ k نیمه‌واقعی
//   'live'        AOD و فشار واقعی ⇒ دقیق‌ترین حالت
// خروجی: { status, atmosphere, wx }
async function resolveForSchaefer(city, when) {
  if (!city || !when) return { status: 'unavailable', atmosphere: null, wx: null };
  if (!(await WeatherService.isEnabled())) return { status: 'off', atmosphere: null, wx: null };
  if (!inRange(when)) return { status: 'outOfRange', atmosphere: null, wx: null };
  var atm = null;
  try { atm = await WeatherService.getAtmosphere(city, when); } catch (e) { atm = null; }
  var wx = toSchaeferInput(atm);
  if (!wx) return { status: 'unavailable', atmosphere: atm, wx: null };
  var full = typeof wx.aod === 'number' && typeof wx.pressureHPa === 'number';
  return { status: full ? 'live' : 'partial', atmosphere: atm, wx: wx };
}
WeatherService.toSchaeferInput = toSchaeferInput;
WeatherService.inRange = inRange;
WeatherService.resolveForSchaefer = resolveForSchaefer;

module.exports = WeatherService;
