// ============================================================
// schaeferModel — v3.6. مدل فیزیکی رؤیت هلال به روش B. E. Schaefer.
//
// خروجی اصلی: پارامتر R (لگاریتم دهدهی نسبت «روشنایی سطحی مؤثر هلال» به
// «روشنایی سطحی لازم برای رؤیت مرزی»). R = 0 یعنی ۵۰٪ احتمال رؤیت با چشم
// غیرمسلح؛ R > 0 یعنی دیده می‌شود؛ R < 0 یعنی دیده نمی‌شود.
// (Schaefer 1988 QJRAS 29:511؛ Doggett & Schaefer 1994 Icarus 107:388)
//
// ─── اجزای مدل و منبع هرکدام (همه از مقالات پیوست‌شده، با راستی‌آزمایی روی تصویر صفحات) ───
//  ۱) جرم هوایی کلی (معادله‌ی 2b، حداکثر ۴۰ در افق)            Schaefer 1993, Vistas 36:311, Table 3
//  ۲) جرم هوایی لایه‌های نمایی X_e(H) و ازن X_L(H)  (معادلات 3a,3b)  همان
//  ۳) میرایی k = k_R + k_oz + k_a و Δm = k_R·X_e(8.2) + k_oz·X_L(20) + k_a·X_e(1.5)
//     k_R = 0.1066·exp(−H/8.2)  (4b)،  k_oz = 0.031·D_oz/3  (5a,5b)،
//     k_a = 0.12·e^{−H/1.5}[1 − 0.32/ln S]^{4/3}[1 + 0.33 sin α_s]  (6a)   همان
//  ۴) قدر کل ماه m = −12.73 + 0.026|α| + 4×10⁻⁹α⁴  (12)  و تبدیل‌های (10),(11)   همان
//  ۵) آستانه‌ی دید چشم (Blackwell 1946 به‌صورت برازش Schaefer):
//     زاویه‌ی بحرانی دید θ_CVA (27a,b)،  C_th = max[2.4B^−0.1, 20B^−0.4]·(θ_CVA/ζ)² (36a,
//     قانون ریکو)                                                              همان
//  ۶) روشنایی آسمان گرگ‌ومیش و شب (فرم Schaefer با جمله‌ی Z/(360k)) و (1−10^{−0.4kX})
//
// ─── صداقت علمی: کدام بخش «بازسازی کالیبره‌شده» است ───
//  مرحله‌ی «تشخیص هلالِ باریک» (معادله‌ی نهایی که از روشنایی ماه، روشنایی آسمان و
//  آستانه‌ی چشم، R می‌سازد) در مقالات پیوست منتشر نشده است (خود Schaefer 1998 هم
//  معادلاتش را نمی‌آورد؛ «نیمی از الگوریتم از منابع منتشرنشده است»). این ماژول آن
//  مرحله را چنین بازسازی می‌کند: هلال نواری به عرض مرکزی w = ρ(1+cos α) است که از
//  نظر عرض با چشم حل نمی‌شود، پس قانون ریکو بر عرض اعمال می‌شود:
//
//        R = log10(B_c) + 2·log10(w/θ_CVA) − log10(B_sky · C0(B_sky))
//
//  که B_c میانگین روشنایی سطحی هلال (nL) پس از میرایی، و C0 = max[2.4B^−0.1, 20B^−0.4]
//  است. در این رابطه «هیچ پارامتر آزادی» برازش نشده است: توان ریکو ۲ و ثابت ۰ است.
//  اعتبارسنجی روی ۹۴ مقدار R که خودِ برنامه‌ی Schaefer منتشر کرده (Doggett & Schaefer 1994
//  جدول IV و Schaefer 1996 جدول I): RMS = 0.17 ، میانگین خطا = +0.01 ، بیشینه‌ی خطا = 0.53 ،
//  ۸۹٪ ردیف‌ها در ±0.3 ، توافق علامت R حدود ۹۴٪، و زمان بهینه‌ی مدل با زمان Schaefer
//  حدود ±6 دقیقه می‌خواند. احتمال رؤیت از رصدهای چشم غیرمسلح: لجستیک با مرکز −0.05 و
//  مقیاس 0.44 (یعنی همان σ ≈ 0.43 گزارش‌شده‌ی خود Schaefer).
//
//  محدودیت‌ها (شفاف):
//   • این بازسازی است، نه کد اصلی Schaefer؛ هماهنگی عددی آن با R منتشرشده‌ی خودش اندازه‌گیری شده.
//   • ردیف ۲۳۶ جدول (kA=0.40 در ارتفاع ۳ کیلومتر) غلط‌چاپی است و کنار گذاشته شد؛ ردیف‌های
//     235، 245 (ناسازگاری هندسه) و 289 (بدون عرض جغرافیایی) نیز.
//   • عامل بزرگ عدم‌قطعیت، میرایی (k_a) است؛ بدون اندازه‌گیری محلی ≈ ±۲۰–۵۰٪.
//   • بیننده‌ی استاندارد (بینایی 20/20 ≈ S=1، دوچشمی) فرض شده؛ سن/حدّت بینایی اعمال نمی‌شود.
//   • مدل برای ماه بالای افق، خورشید ≥ ۱ درجه زیر افق و اندازه‌ی زاویه‌ای ماه نزدیک به معمول اعتبار دارد.
// ============================================================

var DEG = Math.PI / 180;
var NL_REF = 1.11e-15;           // ضریب تبدیل روشنایی فرم Schaefer به نانولامبرت
var MS_V = -26.74, M0_V = -11.05, TWILIGHT_ZP = 32.5;
var DEFAULT_NIGHT_SKY_NL = 180;  // B0 (Schaefer 1993 eq. 15a — «سایت تاریک معمول»)

// ثابت‌های اعتبارسنجی/احتمال (از آزمون ۹۴ ردیف)
var LOGISTIC_CENTER = -0.05;
var LOGISTIC_SCALE = 0.44;
var SIGMA_R_OBS = 0.43;          // عدم‌قطعیت ۱σ رصدی R (Doggett & Schaefer 1994)
var RMS_VS_SCHAEFER = 0.17;      // خطای بازسازی نسبت به R منتشرشده‌ی Schaefer

// ---------- جرم هوایی ----------
function airMass(zDeg) {            // معادله‌ی 2b
  if (zDeg >= 90) return 40;
  var c = Math.cos(zDeg * DEG);
  return Math.min(40, 1 / (c + 0.025 * Math.exp(-11 * c)));
}
function airMassLayer(zDeg, Hkm) {  // معادله‌ی 3a (لایه‌ی نمایی با ارتفاع مقیاس H)
  var sq = Math.sqrt(Hkm);
  var z = Math.min(zDeg, 90);
  var c = Math.cos(z * DEG);
  var d = c + 0.01 * sq * Math.exp(-30 * c / sq);
  return 1 / Math.max(d, 0.01 * sq);
}
function airMassOzone(zDeg) {       // معادله‌ی 3b (لایه‌ی ازن در ۲۰ کیلومتر)
  var z = Math.min(zDeg, 90);
  var s = Math.sin(z * DEG) / (1 + 20 / 6378);
  return 1 / Math.sqrt(1 - s * s);
}

// ---------- شکست جوی (Sæmundsson) ----------
function refractionDeg(hAirlessDeg, pressureHPa, tempC) {
  var h = Math.max(hAirlessDeg, -1);
  var R = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG);   // دقیقه‌ی قوسی (۱۰۱۰ hPa، ۱۰°C)
  var P = pressureHPa || 1010, T = (tempC === undefined || tempC === null) ? 10 : tempC;
  return R * (P / 1010) * (283 / (273 + T)) / 60;
}

// ---------- ابزار تقویمی ----------
function sunRaApproxDeg(date) {      // بس برای ازن (اثر بسیار کوچک)
  var d = (date.getTime() / 86400000) + 2440587.5 - 2451545.0;
  var L = (280.460 + 0.9856474 * d) % 360;
  var g = (357.528 + 0.9856003 * d) % 360;
  var lam = (L + 1.915 * Math.sin(g * DEG) + 0.020 * Math.sin(2 * g * DEG)) * DEG;
  var ra = Math.atan2(Math.cos(23.439 * DEG) * Math.sin(lam), Math.cos(lam)) / DEG;
  return (ra + 360) % 360;
}

// ---------- میرایی ----------
// ورودی: { elevationM, latitudeDeg, sunRaDeg, humidityPct?, pressureHPa?, aod?, kAerosol? }
// kAerosol (مقدار V-band مستقیم) بر aod و رطوبت اولویت دارد؛ aod = عمق اپتیکی ستون در ۵۵۰nm.
function extinction(inp) {
  inp = inp || {};
  var H = Math.max(0, inp.elevationM || 0) / 1000;
  var lat = (inp.latitudeDeg || 0) * DEG;
  var aS = (inp.sunRaDeg || 0) * DEG;
  // (4b) — با فشار واقعی (اگر داده شود) به‌جای تقریب ارتفاعی
  var kR = inp.pressureHPa ? 0.1066 * inp.pressureHPa / 1013.25 : 0.1066 * Math.exp(-H / 8.2);
  var Doz = 3.0 + 0.4 * (lat * Math.cos(aS) - Math.cos(3 * lat));        // (5a)
  var kOz = 0.031 * Doz / 3.0;                                             // (5b)
  var kA, kASource;
  if (typeof inp.kAerosol === 'number' && isFinite(inp.kAerosol) && inp.kAerosol >= 0) {
    kA = inp.kAerosol; kASource = 'given';
  } else if (typeof inp.aod === 'number' && isFinite(inp.aod) && inp.aod >= 0) {
    kA = 1.0857 * inp.aod; kASource = 'aod';                              // k = 1.086·τ
  } else {
    var S = (typeof inp.humidityPct === 'number' && isFinite(inp.humidityPct)) ? inp.humidityPct : 60;
    S = Math.min(0.99, Math.max(0.05, S / 100));
    kA = 0.12 * Math.exp(-H / 1.5) * Math.pow(1 - 0.32 / Math.log(S), 4 / 3) * (1 + 0.33 * Math.sin(aS)); // (6a)
    kASource = 'estimate';
  }
  return { kR: kR, kOz: kOz, kA: kA, k: kR + kOz + kA, kASource: kASource, Hkm: H };
}
function extinctionMagnitude(atm, zDeg) {                                   // (8b)
  return atm.kR * airMassLayer(zDeg, 8.2) + atm.kOz * airMassOzone(zDeg) + atm.kA * airMassLayer(zDeg, 1.5);
}

// ---------- ماه ----------
function moonTotalMagnitude(alphaDeg) {                                     // (12)
  var a = Math.abs(alphaDeg);
  return -12.73 + 0.026 * a + 4.0e-9 * Math.pow(a, 4);
}
// زاویه‌ی فاز (خورشید–ماه–زمین) از کشیدگی ژئوسنتریک و فاصله‌ی ماه
function phaseAngleDeg(elongationGeoDeg, moonDistKm, sunDistKm) {
  var psi = elongationGeoDeg * DEG, Ds = sunDistKm || 149597870.7;
  return Math.atan2(Ds * Math.sin(psi), moonDistKm - Ds * Math.cos(psi)) / DEG;
}

// ---------- آسمان ----------
function skyBrightnessNL(sunAltDeg, moonZenithDeg, k, nightSkyNL) {
  var X = airMass(moonZenithDeg);
  var atten = Math.pow(10, -0.4 * k * X);
  var s = Math.sin(Math.min(moonZenithDeg, 89.9) * DEG);
  var night = (nightSkyNL || DEFAULT_NIGHT_SKY_NL) * (0.4 + 0.6 / Math.sqrt(1 - 0.96 * s * s)) * atten;
  var twilight = (Math.pow(10, -0.4 * (MS_V - M0_V + TWILIGHT_ZP - sunAltDeg - moonZenithDeg / (360 * k))) / NL_REF) * (1 - atten);
  return { nightNL: night, twilightNL: twilight, totalNL: night + twilight };
}

// تبدیل روشنایی (nL) به قدر بر ثانیه‌ی قوسی² (Garstang)
function nlToMagArcsec(nl) {
  return (20.7233 - Math.log(Math.max(nl, 1e-9) / 34.08)) / 0.92104;
}

// ---------- چشم ----------
function criticalVisualAngleArcsec(B, snellen) {                            // (27a,b)
  var S = snellen || 1;
  if (Math.log10(B) > 3.17) return (40 / S) * Math.pow(10, 8.28 * Math.pow(B, -0.29));
  return Math.min(900, (380 / S) * Math.pow(10, 0.3 * Math.pow(B, -0.29)));
}
function contrastFloor(B) {                                                  // ضریب (36a)
  return Math.max(2.4 * Math.pow(B, -0.1), 20 * Math.pow(B, -0.4));
}

// ================================================================
// هسته: محاسبه‌ی R در یک لحظه
// ورودی: {
//   moonAltDeg      ارتفاع توپوسنتریک ماه «بدون شکست»
//   sunAltDeg       ارتفاع خورشید (هندسی)
//   elongationDeg   زاویه‌ی ماه–خورشید (ژئوسنتریک؛ اگر phaseAngleDeg نباشد)
//   phaseAngleDeg   اختیاری (اولویت دارد)
//   moonDistKm      فاصله‌ی ماه (برای نیم‌قطر و زاویه‌ی فاز)
//   atmosphere      خروجی extinction()
//   pressureHPa, tempC (برای شکست)، nightSkyNL، snellen
// }
// ================================================================
function crescentR(p) {
  if (!p || p.moonAltDeg === null || p.moonAltDeg === undefined || p.sunAltDeg === null || p.sunAltDeg === undefined) return null;
  var dist = p.moonDistKm || 384400;
  var alpha = (typeof p.phaseAngleDeg === 'number') ? p.phaseAngleDeg
            : phaseAngleDeg(p.elongationDeg, dist);
  var out = { valid: false, R: null, phaseAngleDeg: alpha };
  var appAlt = p.moonAltDeg + refractionDeg(p.moonAltDeg, p.pressureHPa, p.tempC);
  out.moonAppAltDeg = appAlt;
  if (!(appAlt > 0) || !(alpha > 90)) {   // ماه زیر افق یا فاز هلالی نیست
    out.reason = !(appAlt > 0) ? 'moonBelowHorizon' : 'notCrescent';
    return out;
  }
  var atm = p.atmosphere;
  var z = 90 - appAlt;
  var dm = extinctionMagnitude(atm, z);
  var sky = skyBrightnessNL(p.sunAltDeg, z, atm.k, p.nightSkyNL);
  var B = sky.totalNL;

  var rhoArcmin = Math.asin(1737.4 / dist) / DEG * 60;                      // نیم‌قطر ماه
  var cosA = Math.cos(alpha * DEG);
  var kFrac = (1 + cosA) / 2;                                               // کسر روشن
  var Icand = Math.pow(10, -0.4 * (moonTotalMagnitude(alpha) + 16.57 + dm)); // (10) با میرایی، فوت‌کندل
  var areaArcmin2 = Math.PI * rhoArcmin * rhoArcmin * kFrac;
  var omega = areaArcmin2 * Math.pow(DEG / 60, 2);                          // استرادیان
  var Bc = Icand / (2.95e-7 * omega);                                       // (11)
  var w = rhoArcmin * (1 + cosA);                                           // عرض مرکزی هلال (دقیقه‌ی قوسی)
  var theta = criticalVisualAngleArcsec(B, p.snellen) / 60;                 // دقیقه‌ی قوسی
  var C0 = contrastFloor(B);
  var R = Math.log10(Bc) + 2 * Math.log10(w / theta) - Math.log10(B * C0);

  out.valid = isFinite(R);
  out.R = out.valid ? R : null;
  out.crescentSurfaceNL = Bc;
  out.skyNL = B;
  out.skyNightNL = sky.nightNL;
  out.skyTwilightNL = sky.twilightNL;
  out.crescentWidthArcmin = w;
  out.criticalAngleArcmin = theta;
  out.contrastFloor = C0;
  out.extinctionMag = dm;
  out.kTotal = atm.k;
  out.kAerosol = atm.kA;
  out.kAerosolSource = atm.kASource;
  out.probability = out.valid ? probabilityFromR(R) : null;
  return out;
}

// ---------- احتمال و رده‌بندی ----------
function probabilityFromR(R) {
  return 1 / (1 + Math.exp(-(R - LOGISTIC_CENTER) / LOGISTIC_SCALE));
}
// رده‌ها (هم‌سبک A–F سایر معیارها؛ آستانه‌ها از ۹۴ ردیف اعتبارسنجی):
//  A: R ≥ 1.0          (احتمال ≳ ۹۰٪ — به‌آسانی با چشم)  — در داده‌ها ۲۷ از ۲۷ دیده شد
//  B: 0.4 ≤ R < 1.0    (≈ ۷۰–۹۰٪ — با چشم غیرمسلح در شرایط خوب)
//  C: −0.4 ≤ R < 0.4   (≈ ۳۰–۷۰٪ — ناحیه‌ی عدم‌قطعیت؛ مرزی)
//  D: −1.15 ≤ R < −0.4 (چشم غیرمسلح نه؛ با دوربین دوچشمی/تلسکوپ محتمل — در داده‌ها I(V))
//  E: −2.0 ≤ R < −1.15 (حتی با دوربین دوچشمی دیده نمی‌شود — در داده‌ها I(I))
//  F: R < −2.0         (کاملاً غیرممکن)
function categoryFromR(R) {
  if (R === null || R === undefined || !isFinite(R)) return '';
  if (R >= 1.0) return 'A';
  if (R >= 0.4) return 'B';
  if (R >= -0.4) return 'C';
  if (R >= -1.15) return 'D';
  if (R >= -2.0) return 'E';
  return 'F';
}

// ================================================================
// رابط راحت برای برنامه: از خروجی getFullMoonData (در لحظه‌ی bestTime)
// data = { moonAltitudeBest (airless)، sunAltitudeBest، elongation (ژئوسنتریک)،
//          moonDistance (km)، bestTime (Date) }
// site = { latitude, longitude, elevation (m) }  ·  wx = { humidityPct, pressureHPa, aod, tempC } (اختیاری)
// ================================================================
function evaluateFromMoonData(data, site, wx) {
  if (!data || data.moonAltitudeBest === null || data.sunAltitudeBest === null || data.elongation === null || data.elongation === undefined) return null;
  wx = wx || {};
  var when = data.bestTime || new Date();
  var atm = extinction({
    elevationM: site.elevation || 0, latitudeDeg: site.latitude, sunRaDeg: sunRaApproxDeg(when),
    humidityPct: wx.humidityPct, pressureHPa: wx.pressureHPa, aod: wx.aod, kAerosol: wx.kAerosol,
  });
  return crescentR({
    moonAltDeg: data.moonAltitudeBest, sunAltDeg: data.sunAltitudeBest,
    elongationDeg: data.elongation, moonDistKm: data.moonDistance,
    atmosphere: atm, pressureHPa: wx.pressureHPa, tempC: wx.tempC,
  });
}

// بیشینه‌ی R روی چند لحظه‌ی نزدیک (برای صفحات تحلیلی). samplerFn(dtMinutes) باید
// { moonAltDeg, sunAltDeg, elongationDeg, moonDistKm } برگرداند.
function scanBestR(samplerFn, atmosphere, spanMin, stepMin, extra) {
  var best = null;
  spanMin = spanMin || 40; stepMin = stepMin || 4;
  for (var dt = -spanMin; dt <= spanMin; dt += stepMin) {
    var s = samplerFn(dt);
    if (!s) continue;
    var r = crescentR({
      moonAltDeg: s.moonAltDeg, sunAltDeg: s.sunAltDeg, elongationDeg: s.elongationDeg,
      moonDistKm: s.moonDistKm, atmosphere: atmosphere,
      pressureHPa: extra && extra.pressureHPa, tempC: extra && extra.tempC,
    });
    if (r && r.valid && (best === null || r.R > best.R)) { best = r; best.dtMinutes = dt; }
  }
  return best;
}

module.exports = {
  airMass: airMass, airMassLayer: airMassLayer, airMassOzone: airMassOzone,
  refractionDeg: refractionDeg, sunRaApproxDeg: sunRaApproxDeg,
  extinction: extinction, extinctionMagnitude: extinctionMagnitude,
  moonTotalMagnitude: moonTotalMagnitude, phaseAngleDeg: phaseAngleDeg,
  skyBrightnessNL: skyBrightnessNL, nlToMagArcsec: nlToMagArcsec,
  criticalVisualAngleArcsec: criticalVisualAngleArcsec, contrastFloor: contrastFloor,
  crescentR: crescentR, probabilityFromR: probabilityFromR, categoryFromR: categoryFromR,
  evaluateFromMoonData: evaluateFromMoonData, scanBestR: scanBestR,
  constants: { LOGISTIC_CENTER: LOGISTIC_CENTER, LOGISTIC_SCALE: LOGISTIC_SCALE, SIGMA_R_OBS: SIGMA_R_OBS, RMS_VS_SCHAEFER: RMS_VS_SCHAEFER },
};
