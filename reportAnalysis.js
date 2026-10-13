// ============================================================
// reportAnalysis — v3.5. مقایسه‌ی «پیش‌بینی معیارها» با «نتیجه‌ی واقعی رصد».
//
// این ماژول هیچ وابستگی به UI یا شبکه ندارد (قابل تست در Node).
//
// تعریف سطح پیش‌بینی هر رده (طبق توصیف خودِ معیارها):
//   'naked' = قابل رؤیت با چشم غیرمسلح
//   'aided' = فقط با ابزار نوری (یا یافتن هلال با ابزار)
//   'none'  = غیرقابل رؤیت
//
//   Yallop / Soroudi / Schaefer:  A,B → naked ؛ C,D → aided ؛ E,F → none
//   Odeh:              A → naked ؛ B,C → aided ؛ D → none
//   SAAO:              B → naked ؛ C → aided ؛ F → none
//   Ilyas / MABIMS:    B → naked ؛ F → none
//
// نتیجه‌ی رصد: seen_naked_eye → naked ؛ seen_optical → aided ؛ not_seen → none.
// گزارش‌های «تلاش نکردم» (not_attempted) کنار گذاشته می‌شوند.
//
// ملاحظه‌ی علمی مهم: «دیده نشد» زیر آسمان ابری یا غبارآلود درباره‌ی درستی
// پیش‌بینی هندسی چیزی نمی‌گوید. به همین دلیل گزینه‌ی clearOnly (پیش‌فرض: روشن)
// گزارش‌های ابری/مه/غبار یا با ابر بیش از ۳۰٪ را از آمار دقت حذف می‌کند.
// ============================================================

var MoonCalculator = require('./moonPosition');

var CRITERIA = ['yallop', 'odeh', 'saao', 'ilyas', 'malaysia', 'soroudi', 'schaefer'];
var CAT_FIELD = {
  yallop: 'yallopCat', odeh: 'odehCat', saao: 'saaoCat',
  ilyas: 'ilyasCat', malaysia: 'malaysiaCat', soroudi: 'soroudiCat', schaefer: 'schaeferCat',
};
var LEVEL_BY_CAT = {
  yallop:   { A: 'naked', B: 'naked', C: 'aided', D: 'aided', E: 'none', F: 'none' },
  soroudi:  { A: 'naked', B: 'naked', C: 'aided', D: 'aided', E: 'none', F: 'none' },
  schaefer: { A: 'naked', B: 'naked', C: 'aided', D: 'aided', E: 'none', F: 'none' },
  odeh:     { A: 'naked', B: 'aided', C: 'aided', D: 'none' },
  saao:     { B: 'naked', C: 'aided', F: 'none' },
  ilyas:    { B: 'naked', F: 'none' },
  malaysia: { B: 'naked', F: 'none' },
};
var CLEAR_MAX_CLOUD_PERCENT = 30;
var BAD_WEATHER = { cloudy: 1, foggy: 1, dusty: 1 };

function predictionLevel(crit, cat) {
  var m = LEVEL_BY_CAT[crit];
  return (m && cat && m[cat]) || null;
}

function observedLevel(result) {
  if (result === 'seen_naked_eye') return 'naked';
  if (result === 'seen_optical') return 'aided';
  if (result === 'not_seen') return 'none';
  return null; // not_attempted یا ناشناخته
}

// آسمان «به‌قدر کافی صاف» برای سنجیدن پیش‌بینی؟ (ناشناخته = نامعلوم، true)
function isClearEnough(report) {
  if (report.weather && BAD_WEATHER[report.weather]) return false;
  if (report.cloudPercent !== null && report.cloudPercent !== undefined && report.cloudPercent > CLEAR_MAX_CLOUD_PERCENT) return false;
  return true;
}

// پیش‌بینی را از روی مختصات و زمان خودِ گزارش دوباره حساب می‌کند (به‌جای
// snapshot ذخیره‌شده). دلیل: snapshotهای نسخه‌ی ۳٫۰٫۲ برای غرب طول ۷٫۵° شرقی
// ممکن است ۲۴ ساعت جابه‌جا باشند. خروجی: همان فیلدهای رده‌ی getFullMoonData.
function recomputePrediction(report) {
  if (report.latitude === null || report.latitude === undefined || report.longitude === null || report.longitude === undefined) return null;
  var when = report.sightingDateISO ? new Date(report.sightingDateISO) : null;
  if (!when || isNaN(when.getTime())) return null;
  var conj = report.conjunction ? new Date(report.conjunction) : null;
  if (conj && isNaN(conj.getTime())) conj = null;
  try {
    var anchor = MoonCalculator.getLocalDayAnchor(when, report.latitude, report.longitude);
    var d = MoonCalculator.getFullMoonData(anchor, report.latitude, report.longitude, report.elevation || 0, conj);
    if (!d) return null;
    var out = {};
    CRITERIA.forEach(function (c) { out[CAT_FIELD[c]] = d[CAT_FIELD[c]] || null; });
    out.arcv = d.arcv; out.yallopQ = d.yallopQ; out.moonAge = d.moonAge;
    return out;
  } catch (e) { return null; }
}

// رده‌ی پیش‌بینی‌شده‌ی یک گزارش برای یک معیار (از prediction محاسبه‌شده، وگرنه snapshot)
function predictedCat(report, crit, prediction) {
  var field = CAT_FIELD[crit];
  var src = prediction || report.astronomicalSnapshot;
  return src && src[field] ? src[field] : null;
}

// ---------- آمار ----------
function emptyConfusion() { return { tp: 0, fp: 0, fn: 0, tn: 0 }; }
function rates(c) {
  var n = c.tp + c.fp + c.fn + c.tn;
  return {
    n: n,
    accuracy: n ? (c.tp + c.tn) / n : null,
    precision: (c.tp + c.fp) ? c.tp / (c.tp + c.fp) : null,   // وقتی «قابل رؤیت» گفته، چند درصد درست بود
    recall: (c.tp + c.fn) ? c.tp / (c.tp + c.fn) : null,      // از رؤیت‌های واقعی چند درصد را پیش‌بینی کرده بود
    specificity: (c.tn + c.fp) ? c.tn / (c.tn + c.fp) : null,
  };
}

// reports: [{ ...report, prediction? }]
// opts: { crit, clearOnly (پیش‌فرض true) }
function summarize(reports, opts) {
  var crit = (opts && opts.crit) || 'yallop';
  var clearOnly = !(opts && opts.clearOnly === false);
  var res = {
    crit: crit, clearOnly: clearOnly,
    total: reports.length, attempted: 0, usable: 0, excludedWeather: 0, noPrediction: 0,
    seenNaked: 0, seenAided: 0, notSeen: 0,
    naked: emptyConfusion(), any: emptyConfusion(),
    surprisesSeenWhenNone: 0, missesWhenNaked: 0,
    byCategory: {},
  };
  reports.forEach(function (r) {
    var obs = observedLevel(r.sightingResult);
    if (obs === null) return;
    res.attempted++;
    if (obs === 'naked') res.seenNaked++; else if (obs === 'aided') res.seenAided++; else res.notSeen++;
    var cat = predictedCat(r, crit, r.prediction);
    var pred = predictionLevel(crit, cat);
    if (pred === null) { res.noPrediction++; return; }
    if (clearOnly && !isClearEnough(r)) { res.excludedWeather++; return; }
    res.usable++;

    // جدول هر رده (کالیبراسیون): از گزارش‌های آن رده چند درصد رؤیت شد
    var row = res.byCategory[cat] || (res.byCategory[cat] = { cat: cat, level: pred, n: 0, seenNaked: 0, seenAided: 0, notSeen: 0 });
    row.n++;
    if (obs === 'naked') row.seenNaked++; else if (obs === 'aided') row.seenAided++; else row.notSeen++;

    // وظیفه‌ی ۱: چشم غیرمسلح
    var pN = pred === 'naked', oN = obs === 'naked';
    if (pN && oN) res.naked.tp++; else if (pN && !oN) res.naked.fp++; else if (!pN && oN) res.naked.fn++; else res.naked.tn++;
    // وظیفه‌ی ۲: با هر وسیله
    var pA = pred === 'naked' || pred === 'aided', oA = obs !== 'none';
    if (pA && oA) res.any.tp++; else if (pA && !oA) res.any.fp++; else if (!pA && oA) res.any.fn++; else res.any.tn++;

    if (pred === 'none' && obs !== 'none') res.surprisesSeenWhenNone++;
    if (pred === 'naked' && obs === 'none') res.missesWhenNaked++;
  });
  res.nakedRates = rates(res.naked);
  res.anyRates = rates(res.any);
  res.categories = Object.keys(res.byCategory).sort().map(function (k) { return res.byCategory[k]; });
  return res;
}

// وضعیت یک گزارش برای رنگ‌آمیزی نقشه
//   'agree'    پیش‌بینی و مشاهده هم‌سطح‌اند
//   'surprise' رؤیت شد ولی پیش‌بینی «none» بود
//   'miss'     پیش‌بینی «naked» بود ولی دیده نشد (با آسمان صاف)
//   'partial'  بقیه‌ی ناهم‌خوانی‌های ملایم
//   'unknown'  پیش‌بینی نداریم
function agreementOf(report, crit, prediction) {
  var obs = observedLevel(report.sightingResult);
  var pred = predictionLevel(crit, predictedCat(report, crit, prediction));
  if (obs === null || pred === null) return 'unknown';
  if (obs === pred) return 'agree';
  if (pred === 'none' && obs !== 'none') return 'surprise';
  if (pred === 'naked' && obs === 'none') return isClearEnough(report) ? 'miss' : 'partial';
  return 'partial';
}

module.exports = {
  CRITERIA: CRITERIA, CAT_FIELD: CAT_FIELD, LEVEL_BY_CAT: LEVEL_BY_CAT,
  CLEAR_MAX_CLOUD_PERCENT: CLEAR_MAX_CLOUD_PERCENT,
  predictionLevel: predictionLevel, observedLevel: observedLevel, isClearEnough: isClearEnough,
  recomputePrediction: recomputePrediction, predictedCat: predictedCat,
  summarize: summarize, agreementOf: agreementOf, rates: rates,
};
