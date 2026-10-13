import React from 'react';
import { View, StyleSheet } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;
var MoonCalculator = require('../calculations/moonPosition');

// ============================================================
// AutoAnalysis — SECTION 8 سند طراحی.
//
// متن تحلیل خودکار، ساخته‌شده از buildAutoAnalysis (موتور) + قالب
// ترجمه‌شده (t('saAnalysisTemplate...')). این کامپوننت خودش هیچ
// عدد جدیدی محاسبه نمی‌کند، فقط داده‌ی summary را در قالب می‌گذارد
// — همان جداسازی محاسبه/i18n که بقیه‌ی اپ استفاده می‌کند.
//
// رفع باگ (دور دوم، بعد از گزارش کاربر: «برای ماه آینده هم می‌گوید
// پس از آن شرایط رو به افت گذاشت»):
//
// دور اول این رفع‌باگ فقط قالب دستورِ زنده («صبر کن چند دقیقه‌ی
// دیگر» / «همین حالا بهترین زمان است») را با یک توصیف زمان‌بندیِ
// همان شب («شرایط بعد از {bestTime} رو به افت گذاشت») جایگزین کرد.
// اما خودِ آن جمله هنوز زمان دستوری اشتباهی داشت: «رو به افت
// گذاشت» فعل ماضی است — یعنی این اتفاق قبلاً افتاده. این برای یک
// تاریخِ گذشته (یا امروزی که آن ساعت از آن گذشته) درست است، اما
// برای یک تاریخِ آینده (یا حتی «امروز» وقتی هنوز به آن ساعت
// نرسیده‌ایم) کاملاً غلط است — هیچ‌چیز هنوز «افت نکرده»، این فقط
// یک پیش‌بینی بر مبنای محاسبات نجومی است، نه یک واقعیت رخ‌داده.
//
// راه‌حل: این کامپوننت اکنون moonset همان شب (summary.moonset) را
// با زمان واقعیِ حال (new Date()) مقایسه می‌کند تا تشخیص دهد کل آن
// شب قبلاً تمام شده (moonset < الان → حالت "past"، فعل ماضی درست
// است) یا هنوز نیامده/در جریان است (moonset >= الان → حالت
// "future"، باید با فعل پیش‌بینی/آینده نوشته شود، نه ماضی قطعی).
// این مقایسه با moonset (نه با «تاریخ» به‌تنهایی) انجام می‌شود چون
// این‌طور هم حالت «تاریخ گذشته» و هم حالت ظریف‌تر «امروز ولی هنوز
// غروب/طلوع ماه آن شب نرسیده» را با یک قاعده‌ی واحد درست تشخیص
// می‌دهد — یک تاریخ می‌تواند «امروز» باشد ولی هنوز رویدادش در
// آینده باشد، یا «امروز» باشد ولی رویدادش چند ساعت پیش تمام شده
// باشد؛ فقط «امروز/نه‌امروز» بودنِ تاریخ برای تشخیص زمان دستوری
// درست کافی نیست.
//
// چهار کلید ترجمه‌ی جدید (به‌جای دو کلید ماضی-محورِ دور اول):
//   saAnalysisTrendImprovedPast   / saAnalysisTrendDeclinedPast
//   saAnalysisTrendImprovedFuture / saAnalysisTrendDeclinedFuture
// کلیدهای دور اول (ImprovedPast معادل ImprovedPast اسم قدیم) در
// translations.js بازنویسی/جایگزین شدند؛ کلیدهای خیلی قدیمی‌تر
// (saAnalysisWaitHelps/saAnalysisWaitDoesNotHelp) دست‌نخورده در
// فایل باقی مانده‌اند، فقط از این‌جا صدا زده نمی‌شوند.
// ============================================================

export default function AutoAnalysis(props) {
  var summary = props.summary;
  var city = props.city;
  var t = props.t;
  var textAlign = props.textAlign || 'left';

  if (!summary) return null;

  var fmtTime = function (d) {
    if (!d || !city) return '--:--';
    return MoonCalculator.formatTime(d, city.lat, city.lon);
  };

  // آیا کل آن شب (تا غروب ماه) قبلاً واقعاً اتفاق افتاده؟ اگر
  // moonset در دسترس نباشد (حالت غیرمنتظره)، برای احتیاط حالت
  // «آینده/پیش‌بینی» در نظر گرفته می‌شود — چون ادعای قطعی درباره‌ی
  // چیزی که مطمئن نیستیم گذشته، از ابهام در فعل آینده بدتر است.
  var isPast = !!(summary.moonset && summary.moonset.getTime() <= Date.now());

  var trendKey;
  if (summary.improvingAfterBest) {
    trendKey = isPast ? 'saAnalysisTrendImprovedPast' : 'saAnalysisTrendImprovedFuture';
  } else {
    trendKey = isPast ? 'saAnalysisTrendDeclinedPast' : 'saAnalysisTrendDeclinedFuture';
  }

  var text = t('saAnalysisTemplate')
    .replace('{startAlt}', summary.startMoonAltitude !== null ? summary.startMoonAltitude.toFixed(1) : '---')
    .replace('{sunAlt}', summary.sunAltitudeAtEnd !== null ? Math.abs(summary.sunAltitudeAtEnd).toFixed(1) : '---')
    .replace('{bestTime}', fmtTime(summary.bestTime))
    .replace('{turnTime}', summary.turnPoint ? fmtTime(summary.turnPoint.time) : fmtTime(summary.moonset));

  var trendText = t(trendKey).replace('{bestTime}', fmtTime(summary.bestTime));

  return (
    <View>
      <Text style={[st.text, { textAlign: textAlign }]}>{text}</Text>
      <Text style={[st.trendText, { textAlign: textAlign }]}>{trendText}</Text>
    </View>
  );
}

var st = StyleSheet.create({
  text: { color: theme.colors.textSecondary, fontSize: theme.type.body.fontSize, lineHeight: 23 },
  trendText: { color: theme.colors.gold, fontSize: theme.type.label.fontSize, lineHeight: 20, marginTop: theme.spacing.sm, fontWeight: '600' },
});