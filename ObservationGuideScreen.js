import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
var Text = require('../design/ScaledText');
import { LinearGradient } from 'expo-linear-gradient';

var getObservationGuide = require('../data/observationGuide');
var Design = require('../design');
var theme = Design.theme;
var LP = require('../i18n/LanguageContext');
var useLanguage = LP.useLanguage;

// ------------------------------------------------------------
// RichText — پارسر بسیار سبک markdown-lite برای نشانه‌گذاری
// **bold** داخل رشته‌های body/appLink. چون <Text> در React Native
// خودش هیچ markdown را تفسیر نمی‌کند، این کامپوننت رشته را با یک
// regex ساده به قطعات متن عادی/بولد می‌شکند و هرکدام را با استایل
// مناسب به‌صورت <Text> تودرتو (که در RN مجاز و رایج است) رندر می‌کند.
// پشتیبانی عمداً محدود به ** ** نگه داشته شده (بدون italic، لینک،
// و غیره) چون این تنها نشانه‌گذاری‌ای است که در داده وجود دارد.
// ------------------------------------------------------------
function RichText(props) {
  var text = props.text || '';
  var baseStyle = props.style;
  var boldStyle = props.boldStyle || st.inlineBold;

  var parts = text.split(/(\*\*[^*]+\*\*)/g).filter(function (p) { return p.length > 0; });

  return (
    <Text style={baseStyle}>
      {parts.map(function (part, i) {
        var isBold = part.length > 4 && part.slice(0, 2) === '**' && part.slice(-2) === '**';
        if (isBold) {
          return (
            <Text key={i} style={boldStyle}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

// ------------------------------------------------------------
// LessonTable — رندر جدول‌های علمی/فقهی سند اصلی (که در نسخه‌ی
// قبلی به‌کل نادیده گرفته می‌شدند چون داده اصلاً فیلد tables نداشت).
// چون React Native جدول HTML ندارد، هر جدول به‌صورت یک سری کارت
// (یک کارت به‌ازای هر ردیف، شامل جفت‌های ستون/مقدار) رندر می‌شود —
// این الگو برای صفحه‌ی موبایلِ باریک خواناتر از یک جدول افقی
// اسکرول‌شونده‌ی چندستونی است، به‌خصوص برای جدول‌های ۴-۵ ستونی سند.
// ------------------------------------------------------------
function LessonTable(props) {
  var table = props.table;
  var isRTL = props.isRTL;
  var textAlign = isRTL ? 'right' : 'left';

  return (
    <View style={st.tableWrap}>
      {table.rows.map(function (row, ri) {
        return (
          <View key={ri} style={[st.tableCard, ri === table.rows.length - 1 && st.tableCardLast]}>
            {row.map(function (cell, ci) {
              return (
                <View key={ci} style={st.tableRow}>
                  <Text style={[st.tableHeaderCell, { textAlign: textAlign }]}>{table.headers[ci]}</Text>
                  <RichText text={cell} style={[st.tableValueCell, { textAlign: textAlign }]} />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// نسخه ۵ — رفع دو نقص گزارش‌شده در نسخه‌ی قبلی:
//   ۱. جدول‌ها اصلاً نمایش داده نمی‌شدند — چون خودِ داده
//      (observationGuide.js) هیچ فیلد `tables` نداشت (پارسر اولیه‌ی
//      سند Word، جدول‌های Word را که در `doc.tables` هستند نادیده
//      گرفته بود، چون فقط `doc.paragraphs` را می‌خواند). این نسخه
//      یک کامپوننت <LessonTable> دارد که هر جدول را در نقطه‌ی دقیقش
//      (فیلد lesson.tables[].afterBodyIndex) بین پاراگراف‌ها رندر می‌کند.
//   ۲. نشانه‌گذاری بولد (**متن**) در body/appLink متن خام رشته‌ای
//      نمایش داده می‌شد (خودِ ** روی صفحه دیده می‌شد) چون <Text> در
//      React Native هیچ markdown را خودکار تفسیر نمی‌کند. کامپوننت
//      <RichText> این پایین این نشانه‌گذاری را پارس کرده و بخش‌های
//      بین ** ** را با <Text style={bold}> جداگانه رندر می‌کند.
//
// چرا اصلاً از آکاردئون تخت به ساختار سه‌سطحی تغییر کردیم (نسخه ۴):
// محتوای آموزشی از ۷ بخش کوتاه (نسخه‌ی قبل، ~۲۰۰۰ کلمه) به ۹ ماژول
// / ۱۲ بخش / ۵۸ درس (~۳۶٬۰۰۰ کلمه، برگرفته از learning_rasad.docx)
// رشد کرد. آکاردئون تخت برای این حجم مقیاس نمی‌گیرد.
//
// ساختار سه سطح دارد که با سه 'mode' داخلی این کامپوننت مدیریت
// می‌شود (دقیقاً همان الگوی سوییچ حالت که در SightingReportScreen.js
// برای هاب استهلال استفاده شده):
//   - 'modules'  : فهرست ۹ ماژول (صفحه‌ی ورودی)
//   - 'sections' : فهرست بخش‌ها/درس‌های یک ماژول انتخاب‌شده
//   - 'lesson'   : محتوای کامل یک درس (زیربخش X.Y از سند اصلی)
//
// نکته چندزبانه: این فایل اکنون کاملاً زبان‌مستقل است — همه‌ی
// متن‌های ثابت UI از t('guide...') خوانده می‌شوند و محتوای آموزشی
// بر اساس LCtx.lang از observationGuide.fa/.ar/.en انتخاب می‌شود
// (نگاه کنید به src/data/observationGuide.js). هر سه زبان اکنون
// محتوای کامل و ترجمه‌شده دارند؛ fallback به فارسی صرفاً به‌عنوان
// شبکه‌ی ایمنی برای خطای احتمالی بارگذاری فایل باقی مانده است.
//
// برخی درس‌ها یک فیلد اختیاری «image» هم دارند (رجوع کنید به
// observationGuide.fa/.ar/.en.js) که در صفحه‌ی محتوای درس (سطح ۳)
// بین هدر و کارت متن اصلی نمایش داده می‌شود.
//
// هر درس ممکن است یک بخش «پیوند با اپلیکیشن هلال‌نما» هم داشته
// باشد (فیلد appLink) که به‌صورت جعبه‌ی بصری متمایز (طلایی/برجسته)
// نمایش داده می‌شود تا محتوای علمی از محتوای «کاربردی در اپ» به‌وضوح
// تفکیک شود.
// ============================================================
export default function ObservationGuideScreen() {
  var LCtx = useLanguage();
  var isRTL = LCtx.isRTL;
  var t = LCtx.t;
  var textAlign = isRTL ? 'right' : 'left';

  // نسخه ۵ — چندزبانگی: محتوای آموزشی بر اساس زبان جاری اپ انتخاب
  // می‌شود (fa/ar/en) — هر سه اکنون کامل هستند. اگر بارگذاری فایل
  // زبانی به هر دلیلی شکست بخورد، getObservationGuide به‌عنوان
  // شبکه‌ی ایمنی به فارسی fallback می‌کند (نگاه کنید به
  // src/data/observationGuide.js).
  var ObservationGuide = getObservationGuide(LCtx.lang);

  var s1 = useState('modules'); var mode = s1[0]; var setMode = s1[1]; // 'modules'|'sections'|'lesson'
  var s2 = useState(null); var activeModule = s2[0]; var setActiveModule = s2[1];
  var s3 = useState(null); var activeLesson = s3[0]; var setActiveLesson = s3[1];
  var s4 = useState(null); var expandedSection = s4[0]; var setExpandedSection = s4[1];

  var openModule = function (mod) {
    setActiveModule(mod);
    setExpandedSection(mod.sections.length === 1 ? mod.sections[0].id : null);
    setMode('sections');
  };

  var openLesson = function (lesson) {
    setActiveLesson(lesson);
    setMode('lesson');
  };

  var backToModules = function () {
    setMode('modules');
    setActiveModule(null);
    setExpandedSection(null);
  };

  var backToSections = function () {
    setMode('lesson' === mode ? 'sections' : mode);
    setActiveLesson(null);
  };

  // ------------------------------------------------------------
  // سطح ۱ — فهرست ماژول‌ها
  // ------------------------------------------------------------
  if (mode === 'modules') {
    return (
      <ScrollView style={st.container}>
        <LinearGradient
          colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]}
          style={st.headerGradient}>
          <Text style={st.titleLabel}>{t('guideLabel')}</Text>
          <Text style={st.titleT}>{t('guideTitle')}</Text>
          <Text style={st.titleSub}>{t('guideSubtitle')}</Text>
        </LinearGradient>

        <View style={st.content}>
          <Design.Card variant="deep" style={st.introCard}>
            <Text style={[st.introText, { textAlign: textAlign }]}>
              {t('guideIntro')}
            </Text>
          </Design.Card>

          {ObservationGuide.modules.map(function (mod) {
            var lessonCount = mod.sections.reduce(function (acc, s) { return acc + s.lessons.length; }, 0);
            return (
              <TouchableOpacity
                key={mod.id}
                style={st.moduleCard}
                onPress={function () { openModule(mod); }}
                activeOpacity={0.8}>
                <View style={[st.moduleIconWrap, { backgroundColor: theme.colors[mod.color] ? theme.colors[mod.color] + '22' : theme.colors.bgCardDeep }]}>
                  <Text style={st.moduleIcon}>{mod.icon}</Text>
                </View>
                <View style={st.moduleTextWrap}>
                  <Text style={[st.moduleTitle, { textAlign: textAlign }]}>{mod.title}</Text>
                  <Text style={[st.moduleMeta, { textAlign: textAlign }]}>
                    {t('guideSectionsCount', { count: mod.sections.length }) + ' · ' + t('guideLessonsCount', { count: lessonCount })}
                  </Text>
                </View>
                <Text style={st.chevronModule}>{isRTL ? '◀' : '▶'}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    );
  }

  // ------------------------------------------------------------
  // سطح ۲ — فهرست بخش‌ها/درس‌های یک ماژول (آکاردئون بخش‌ها)
  // ------------------------------------------------------------
  if (mode === 'sections' && activeModule) {
    return (
      <ScrollView style={st.container}>
        <LinearGradient
          colors={[theme.colors.bgHeaderTop, theme.colors.bgHeader, theme.colors.bgPage]}
          style={st.headerGradientSm}>
          <TouchableOpacity style={st.backBtn} onPress={backToModules}>
            <Text style={st.backBtnT}>{t('guideBack')}</Text>
          </TouchableOpacity>
          <Text style={st.moduleIconBig}>{activeModule.icon}</Text>
          <Text style={st.titleT}>{activeModule.title}</Text>
        </LinearGradient>

        <View style={st.content}>
          {activeModule.sections.map(function (sec) {
            var isExp = expandedSection === sec.id;
            return (
              <View key={sec.id} style={[st.sectionCard, isExp && st.sectionCardActive]}>
                <TouchableOpacity
                  style={st.sectionHeader}
                  onPress={function () { setExpandedSection(isExp ? null : sec.id); }}
                  activeOpacity={0.8}>
                  <View style={st.sectionHeaderText}>
                    <Text style={[st.sectionTitle, { textAlign: textAlign }]}>{sec.title}</Text>
                    <Text style={[st.sectionMeta, { textAlign: textAlign }]}>{t('guideLessonsCount', { count: sec.lessons.length })}</Text>
                  </View>
                  <Text style={st.chevron}>{isExp ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExp ? (
                  <View style={st.lessonList}>
                    {sec.lessons.map(function (lesson) {
                      return (
                        <TouchableOpacity
                          key={lesson.num}
                          style={st.lessonRow}
                          onPress={function () { openLesson(lesson); }}
                          activeOpacity={0.7}>
                          <Text style={st.lessonNum}>{lesson.num}</Text>
                          <Text style={[st.lessonTitle, { textAlign: textAlign }]} numberOfLines={2}>
                            {lesson.title}
                          </Text>
                          <Text style={st.lessonArrow}>{isRTL ? '◀' : '▶'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    );
  }

  // ------------------------------------------------------------
  // سطح ۳ — محتوای یک درس
  // ------------------------------------------------------------
  if (mode === 'lesson' && activeLesson) {
    return (
      <ScrollView style={st.container}>
        <View style={st.lessonHeaderWrap}>
          <TouchableOpacity style={st.backBtnLesson} onPress={backToSections}>
            <Text style={st.backBtnT}>{t('guideBack')}</Text>
          </TouchableOpacity>
          <Text style={st.lessonNumBig}>{activeLesson.num}</Text>
          <Text style={[st.lessonTitleBig, { textAlign: textAlign }]}>{activeLesson.title}</Text>
        </View>

        <View style={st.content}>
          {activeLesson.image ? (
            <View style={st.lessonImageWrap}>
              <Image
                source={activeLesson.image}
                style={st.lessonImage}
                resizeMode="cover"
              />
            </View>
          ) : null}

          <Design.Card variant="standard" style={st.lessonBodyCard}>
            {activeLesson.body.map(function (paragraph, pi) {
              // جداول باید دقیقاً بعد از پاراگرافِ اندیس afterBodyIndex بیایند —
              // اگر بیش از یک جدول به همین اندیس اشاره کند (نادر)، همه به‌ترتیب رندر می‌شوند.
              var tablesHere = (activeLesson.tables || []).filter(function (t) {
                return t.afterBodyIndex === pi;
              });
              return (
                <React.Fragment key={pi}>
                  <RichText
                    text={paragraph}
                    style={[st.paragraph, { textAlign: textAlign }]}
                    boldStyle={st.inlineBoldOnDark}
                  />
                  {tablesHere.map(function (table, ti) {
                    return <LessonTable key={ti} table={table} isRTL={isRTL} />;
                  })}
                </React.Fragment>
              );
            })}
          </Design.Card>

          {activeLesson.appLink && activeLesson.appLink.length > 0 ? (
            <View style={st.appLinkCard}>
              <Text style={[st.appLinkHeader, { textAlign: textAlign }]}>
                {t('guideAppLinkHeader')}
              </Text>
              {activeLesson.appLink.map(function (paragraph, pi) {
                return (
                  <RichText
                    key={pi}
                    text={paragraph}
                    style={[st.appLinkText, { textAlign: textAlign }]}
                    boldStyle={st.inlineBoldOnGold}
                  />
                );
              })}
            </View>
          ) : null}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    );
  }

  return null;
}

var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPage },
  content: { padding: theme.spacing.lg },

  headerGradient: { paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.lg, alignItems: 'center' },
  headerGradientSm: { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, alignItems: 'center' },
  titleLabel: { color: theme.colors.textSecondary, fontSize: 11, marginBottom: 2 },
  titleT: { color: theme.colors.gold, fontSize: theme.type.display.fontSize, fontWeight: theme.type.display.fontWeight, textAlign: 'center' },
  titleSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  introCard: { marginBottom: theme.spacing.lg },
  introText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 22 },

  // --- کارت‌های ماژول (سطح ۱) ---
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  moduleIconWrap: {
    width: 48, height: 48, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  moduleIcon: { fontSize: 24 },
  moduleTextWrap: { flex: 1 },
  moduleTitle: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight },
  moduleMeta: { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },
  chevronModule: { color: theme.colors.textMuted, fontSize: 14, marginHorizontal: theme.spacing.sm },
  moduleIconBig: { fontSize: 34, marginBottom: 6 },

  backBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10 },
  backBtnLesson: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  backBtnT: { color: theme.colors.gold, fontSize: 13, fontWeight: '600' },

  // --- بخش‌ها (سطح ۲) ---
  sectionCard: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  sectionCardActive: { borderColor: theme.colors.borderGoldSubtle },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: theme.spacing.lg,
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { color: theme.colors.gold, fontSize: theme.type.subtitle.fontSize, fontWeight: theme.type.subtitle.fontWeight },
  sectionMeta: { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },
  chevron: { color: theme.colors.textMuted, fontSize: 12, marginHorizontal: theme.spacing.sm },

  lessonList: { borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
  lessonRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle,
  },
  lessonNum: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', width: 36 },
  lessonTitle: { flex: 1, color: theme.colors.textPrimary, fontSize: 13 },
  lessonArrow: { color: theme.colors.textMuted, fontSize: 11, marginHorizontal: theme.spacing.xs },

  // --- محتوای درس (سطح ۳) ---
  lessonHeaderWrap: { paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  lessonNumBig: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.sm },
  lessonTitleBig: { color: theme.colors.gold, fontSize: theme.type.title.fontSize, fontWeight: theme.type.title.fontWeight, paddingHorizontal: theme.spacing.lg, marginTop: 4 },

  lessonImageWrap: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lessonImage: { width: '100%', height: 220, backgroundColor: theme.colors.bgCardDeep },

  lessonBodyCard: { marginBottom: theme.spacing.md },
  paragraph: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 23, marginBottom: theme.spacing.md },

  appLinkCard: {
    backgroundColor: 'rgba(212,175,106,0.08)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderGoldSubtle,
    marginBottom: theme.spacing.md,
  },
  appLinkHeader: { color: theme.colors.gold, fontSize: 13, fontWeight: '700', marginBottom: theme.spacing.sm },
  appLinkText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 22, marginBottom: theme.spacing.sm },

  // --- RichText: بولد داخل پاراگراف (رنگ باید با پس‌زمینه‌ی هر جعبه هماهنگ باشد) ---
  inlineBold: { fontWeight: '700', color: theme.colors.textPrimary },
  inlineBoldOnDark: { fontWeight: '700', color: theme.colors.gold },
  inlineBoldOnGold: { fontWeight: '700', color: theme.colors.textPrimary },

  // --- LessonTable ---
  tableWrap: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.md },
  tableCard: {
    backgroundColor: theme.colors.bgCardDeep,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  tableCardLast: { marginBottom: 0 },
  tableRow: { marginBottom: theme.spacing.xs },
  tableHeaderCell: { color: theme.colors.gold, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  tableValueCell: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
});
