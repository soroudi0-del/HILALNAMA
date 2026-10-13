import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
var Text = require('../design/ScaledText');
var Design = require('../design');
var theme = Design.theme;

// ============================================================
// DateLocationBar — رفع مشکل جدید گزارش‌شده: صفحه‌ی تحلیل پیشرفته
// هیچ‌جا نشان نمی‌داد کاربر دارد تحلیل مربوط به کدام شب/شهر را
// می‌بیند (فقط عنوان کلی «تحلیل پیشرفته» بالای صفحه بود). چون کل
// محتوای صفحه معنایش وابسته به همین تاریخ/مکان است، این نوار در
// هدر ثابت (نه داخل ScrollView) قرار می‌گیرد تا هنگام اسکرول هم
// در دید بماند.
//
// رفع باگ (بعد از گزارش کاربر): نسخه‌ی قبلی کل نوار را قابل‌لمس
// کرده بود و لمسِ آن مستقیماً navigation.goBack() صدا می‌زد — یعنی
// با لمس تاریخ، کاربر کاملاً از صفحه‌ی تحلیل خارج می‌شد و جایگاهش
// (cursorTime، تب فعال، حالت مقایسه و...) از دست می‌رفت، فقط برای
// عوض کردن تاریخ. اکنون تغییر تاریخ به‌صورت درجا (بدون خروج از
// صفحه) با دو دکمه‌ی روز قبل/بعد انجام می‌شود — چون خودِ صفحه یک
// state محلی date دارد (نگاه کنید به CrescentAnalysisScreen.js) که
// با این دکمه‌ها ±۱ روز جابه‌جا می‌شود، بدون نیاز به navigation.
// فقط تغییر شهر همچنان از طریق onPressCity به HomeScreen برمی‌گردد،
// چون انتخابگر شهر در این صفحه وجود ندارد و بازسازی‌اش خارج از
// دامنه‌ی این بازطراحی است.
//
// رفع درخواست کاربر: بازه‌ی روزهای قابل‌مشاهده در این صفحه محدود
// به ۴ روز اطراف مقارنه است (مقارنه-۱ تا مقارنه+۲)، نه کل ماه.
// canGoPrev/canGoNext از parent می‌آید (که خودِ بازه‌ی مجاز را
// می‌داند) و دکمه‌ی مرزی را غیرفعال/کم‌رنگ می‌کند — کاربر با یک
// نگاه می‌فهمد اینجا انتهای بازه‌ی مجاز است، نه یک باگ.
//
// props:
//   dateLabel     - رشته‌ی از پیش فرمت‌شده‌ی روز هفته + تاریخ میلادی
//                   (parent می‌سازد، این کامپوننت خودش تاریخ را
//                   قالب‌بندی نمی‌کند)
//   jalaliLabel   - اختیاری: رشته‌ی از پیش فرمت‌شده‌ی تاریخ شمسی
//                   (درخواست کاربر). وقتی داده نشود (مثلاً زبان غیر
//                   از فارسی) چیزی برای آن رندر نمی‌شود.
//   cityName
//   onPrevDay, onNextDay - جابه‌جایی ±۱ روز، درجا در همین صفحه
//   canGoPrev, canGoNext - آیا هنوز در بازه‌ی مجاز جا برای حرکت هست
//   onPressCity   - اختیاری: لمس نام شهر، برای بازگشت به HomeScreen
//                   جهت تغییر شهر (نه تاریخ)
//   isRTL
// ============================================================

export default function DateLocationBar(props) {
  var dateLabel = props.dateLabel;
  var jalaliLabel = props.jalaliLabel;
  var cityName = props.cityName;
  var onPrevDay = props.onPrevDay;
  var onNextDay = props.onNextDay;
  var onPressCity = props.onPressCity;
  var isRTL = props.isRTL;
  var canGoPrev = props.canGoPrev !== false;
  var canGoNext = props.canGoNext !== false;

  // در RTL، جهت بصری «روز قبل/بعد» باید با جهت خواندن هماهنگ بماند:
  // فلش سمت راست = روز قبل (چون در فارسی/عربی گذشته سمت راست است)،
  // فلش سمت چپ = روز بعد. در LTR برعکس.
  var prevArrow = isRTL ? '›' : '‹';
  var nextArrow = isRTL ? '‹' : '›';

  return (
    <View style={st.bar}>
      <TouchableOpacity
        style={[st.stepBtn, !canGoPrev && st.stepBtnDisabled]}
        onPress={onPrevDay}
        disabled={!canGoPrev}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[st.stepBtnT, !canGoPrev && st.stepBtnTDisabled]}>{prevArrow}</Text>
      </TouchableOpacity>

      <View style={st.center}>
        <Text style={st.icon}>{'🗓️'}</Text>
        <View style={st.centerText}>
          <Text style={st.dateT}>{dateLabel || '---'}</Text>
          {jalaliLabel ? <Text style={st.jalaliT}>{jalaliLabel}</Text> : null}
          {cityName ? (
            <TouchableOpacity onPress={onPressCity} disabled={!onPressCity}>
              <Text style={st.cityT}>{cityName + (onPressCity ? '  ✎' : '')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={[st.stepBtn, !canGoNext && st.stepBtnDisabled]}
        onPress={onNextDay}
        disabled={!canGoNext}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[st.stepBtnT, !canGoNext && st.stepBtnTDisabled]}>{nextArrow}</Text>
      </TouchableOpacity>
    </View>
  );
}

var st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.circle,
    backgroundColor: theme.colors.bgCardDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnT: { color: theme.colors.gold, fontSize: theme.type.title.fontSize, fontWeight: 'bold' },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnTDisabled: { color: theme.colors.textMuted },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  centerText: { alignItems: 'center' },
  icon: { fontSize: theme.type.subtitle.fontSize },
  dateT: { color: theme.colors.textPrimary, fontSize: theme.type.body.fontSize, fontWeight: '600' },
  jalaliT: { color: theme.colors.gold, fontSize: theme.type.micro.fontSize, marginTop: 1 },
  cityT: { color: theme.colors.textMuted, fontSize: theme.type.caption.fontSize, marginTop: 1 },
});