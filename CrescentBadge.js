var React = require('react');
var View = require('react-native').View;
var Text = require('./ScaledText');
var StyleSheet = require('react-native').StyleSheet;
var Svg = require('react-native-svg').Svg;
var Path = require('react-native-svg').Path;
var Circle = require('react-native-svg').Circle;
var ClipPath = require('react-native-svg').ClipPath;
var Defs = require('react-native-svg').Defs;
var theme = require('./theme');

// ============================================================
// CrescentBadge — عنصر امضادار طراحی نسخه ۳. بازسازی نهایی.
//
// جایگزین badge دایره‌ای رنگی با حرف تنها (که قبلاً در HomeScreen
// به‌صورت <View style={catBadge}><Text>C</Text></View> بود) با یک
// آیکون هلال واقعی — چون خودِ موضوع اپ «هلال» است.
//
// تاریخچه‌ی رفع باگ (دو دور):
//   دور ۱: مسیر SVG اولیه با یک path تکی و کمان‌های sweep-flag
//   ساخته می‌شد؛ شعاع کمان داخلی نامعتبر بود (کوچک‌تر از نصف طول
//   وتر) و به‌طور خودکار به اندازه‌ی کمان بیرونی گرد می‌شد، پس
//   خروجی یک دایره‌ی کامل (ماه) بود، نه هلال.
//
//   دور ۲: با تکنیک «دو دایره‌ی کامل + evenodd» جایگزین شد، اما
//   دایره‌ی داخلی هم‌اندازه‌ی دایره‌ی بیرونی و جابه‌جا‌شده به راست
//   تعریف شده بود — چون دایره‌ی داخلی از سمت راستِ دایره‌ی بیرونی
//   بیرون می‌زد، قانون evenodd آن بخشِ «فقط داخل دایره‌ی داخلی، خارج
//   از بیرونی» را هم پر می‌کرد. نتیجه: یک تکه/هلال دوم ناخواسته در
//   سمت راست، بیرون از مرز دایره‌ی اصلی.
//
// راه‌حل نهایی: همان دو دایره + evenodd، اما این‌بار کل نتیجه با
// یک <ClipPath> دقیقاً به‌اندازه‌ی دایره‌ی بیرونی محدود می‌شود — هر
// چیزی که بیرون از مرز دایره‌ی اصلی بیفتد (مثل زائده‌ی دور۲) قطع
// و حذف می‌شود. نتیجه: فقط و فقط یک هلال، سمت چپ، بدون هیچ اثر
// اضافه در هیچ گوشه‌ای — تست‌شده با رندر واقعی (نه فقط ریاضی).
//
// props:
//   cat   - رده‌ی رؤیت (A تا F)، رنگ هلال از این تعیین می‌شود
//   crit  - شناسه‌ی معیار (مثلاً 'yallop'، 'odeh') — اختیاری، اما
//           برای رنگ صحیح لازم است چون معنای شدت هر حرف بین
//           معیارها فرق می‌کند (نگاه کنید به رفع باگ در theme.js:
//           بدون این prop، getCatColor به رفتار قدیمی/Yallop-محور
//           برمی‌گردد که برای معیارهایی مثل Odeh رنگ اشتباه می‌دهد).
//   size  - اندازه (پیش‌فرض ۶۰)
// ============================================================
function CrescentBadge(props) {
  var cat = props.cat || '';
  var size = props.size || 60;
  var color = theme.getCatColor(cat, props.crit);

  var cx = size / 2;
  var cy = size / 2;
  var outerR = size / 2 - 2;   // دایره‌ی بیرونی — مرز نهایی و قطعیِ کل شکل
  var offsetX = outerR * 0.58; // جابه‌جایی دایره‌ی داخلی به سمت راست (ضخامت هلال را تعیین می‌کند)
  var clipId = 'crescentClip' + Math.round(size); // شناسه‌ی یکتا برای چند نمونه هم‌زمان در یک صفحه

  var outerCircle = circlePath(cx, cy, outerR);
  var innerCircle = circlePath(cx + offsetX, cy, outerR); // هم‌اندازه‌ی بیرونی، فقط جابه‌جا شده
  var pathD = outerCircle + ' ' + innerCircle;

  return React.createElement(
    View,
    { style: [st.wrap, { width: size, height: size }] },
    React.createElement(
      Svg,
      { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size },
      React.createElement(
        Defs,
        null,
        React.createElement(
          ClipPath,
          { id: clipId },
          React.createElement(Circle, { cx: cx, cy: cy, r: outerR })
        )
      ),
      React.createElement(Path, {
        d: pathD,
        fill: color,
        fillRule: 'evenodd',
        clipPath: 'url(#' + clipId + ')',
      })
    ),
    React.createElement(
      View,
      { style: st.letterOverlay },
      React.createElement(Text, { style: [st.letter, { color: color }] }, cat || '?')
    )
  );
}

// یک دایره‌ی کامل به‌صورت مسیر SVG (دو کمان نیم‌دایره‌ای با شعاع
// برابر، بدون هیچ ابهامی در sweep-flag یا اعتبار شعاع).
function circlePath(cx, cy, r) {
  return (
    'M ' + (cx - r) + ' ' + cy + ' ' +
    'A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy + ' ' +
    'A ' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy + ' Z'
  );
}

var st = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  letterOverlay: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.circle,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.bgPage,
  },
  letter: {
    fontSize: 12,
    fontWeight: '700',
  },
});

module.exports = CrescentBadge;