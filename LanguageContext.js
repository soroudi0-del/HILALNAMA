var React = require('react');
var createContext = React.createContext;
var useState = React.useState;
var useEffect = React.useEffect;
var useContext = React.useContext;
var useMemo = React.useMemo;
var useCallback = React.useCallback;

var NativeModules = require('react-native').NativeModules;
var Platform = require('react-native').Platform;

var translations = require('./translations');

var AsyncStorage = require('@react-native-async-storage/async-storage');
var Storage = AsyncStorage.default || AsyncStorage;

var LanguageContext = createContext();

// v3.5: ضریب اندازه‌ی فونت (تنظیمات → اندازه‌ی متن) — نوار پیوسته از ۸۰٪ تا ۱۶۰٪ با گام ۵٪.
var FONT_SCALE_MIN = 0.8;
var FONT_SCALE_MAX = 1.6;
var FONT_SCALE_STEP = 0.05;
var FONT_SCALE_KEY = 'fontScale';
function normalizeFontScale(v) {
  var n = parseFloat(v);
  if (isNaN(n)) return 1;
  n = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, n));
  return Math.round(Math.round(n / FONT_SCALE_STEP) * FONT_SCALE_STEP * 100) / 100; // گرد به نزدیک‌ترین گام ۰٫۰۵
}

function getDeviceLanguage() {
  try {
    var locale = '';
    if (Platform.OS === 'ios') {
      var settings = NativeModules.SettingsManager;
      if (settings && settings.settings) {
        var langs = settings.settings.AppleLanguages;
        if (langs && langs.length > 0) locale = langs[0];
      }
    } else {
      var loc = NativeModules.I18nManager;
      if (loc && loc.localeIdentifier) locale = loc.localeIdentifier;
    }
    if (!locale) locale = 'fa';
    locale = locale.toLowerCase();
    if (locale.indexOf('ar') === 0) return 'ar';
    if (locale.indexOf('en') === 0) return 'en';
    return 'fa';
  } catch (e) {
    return 'fa';
  }
}

function LanguageProvider(props) {
  var deviceLang = getDeviceLanguage();
  var s1 = useState(deviceLang);
  var lang = s1[0];
  var setLangState = s1[1];
  var s2 = useState(false);
  var loaded = s2[0];
  var setLoaded = s2[1];
  // آیا کاربر قبلاً (در همین دستگاه) زبان را دستی/آگاهانه انتخاب
  // کرده است؟ null یعنی «هنوز مشخص نیست» (در حال خواندن از حافظه)،
  // که App.js از آن برای جلوگیری از یک چشمک اشتباه (نمایش لحظه‌ای
  // صفحه‌ی انتخاب زبان به کاربر قدیمی) استفاده می‌کند.
  var s3 = useState(null);
  var hasChosenLanguage = s3[0];
  var setHasChosenLanguage = s3[1];

  var s4 = useState(1);
  var fontScale = s4[0];
  var setFontScaleState = s4[1];

  var currentTranslation = useMemo(function() {
    return translations[lang] || translations.fa;
  }, [lang]);

  useEffect(function () {
    loadSavedLang();
  }, []);

  var loadSavedLang = async function () {
    try {
      var rawScale = await Storage.getItem(FONT_SCALE_KEY);
      if (rawScale !== null && rawScale !== undefined) setFontScaleState(normalizeFontScale(rawScale));
    } catch (e) { }
    try {
      var saved = await Storage.getItem('appLanguage');
      if (saved && translations[saved]) {
        setLangState(saved);
        // اگر زبان ذخیره‌شده وجود دارد، یعنی یا کاربر قبلاً دستی
        // انتخاب کرده، یا این یک نصب خیلی قدیمی‌تر از این قابلیت
        // است — در هر دو حالت نباید دوباره از او انتخاب زبان
        // خواسته شود.
        setHasChosenLanguage(true);
      } else {
        setHasChosenLanguage(false);
      }
    } catch (e) {
      // در صورت خطای غیرمنتظره در خواندن حافظه، برای جلوگیری از
      // نمایش مکرر و آزاردهنده‌ی صفحه‌ی انتخاب زبان، فرض می‌کنیم
      // انتخاب قبلاً انجام شده است.
      setHasChosenLanguage(true);
    }
    setLoaded(true);
  };

  var setLang = useCallback(async function (newLang, opts) {
    if (!translations[newLang]) return;
    setLangState(newLang);
    try {
      await Storage.setItem('appLanguage', newLang);
    } catch (e) { }
    // RTL حذف شد - دیگه هیچ تغییری نمیدیم
    // وقتی از صفحه‌ی انتخاب اولیه صدا زده می‌شود (opts.isInitialChoice)،
    // فلگ اولین‌اجرا هم علامت زده می‌شود تا App.js دیگر این صفحه را
    // نشان ندهد. تغییر زبان از داخل تنظیمات (بدون این پرچم) روی این
    // مقدار اثر نمی‌گذارد، چون آن انتخاب همیشه true بوده است.
    if (opts && opts.isInitialChoice) {
      setHasChosenLanguage(true);
    }
  }, []);

  var setFontScale = useCallback(async function (scale) {
    var v = normalizeFontScale(scale);
    setFontScaleState(v);
    try { await Storage.setItem(FONT_SCALE_KEY, String(v)); } catch (e) { }
  }, []);

  var t = useCallback(function (key, params) {
    var text = currentTranslation[key];
    if (text === undefined) {
      text = translations.fa[key];
    }
    if (text === undefined) return key;
    if (typeof text !== 'string') return text;
    if (params) {
      var keys = Object.keys(params);
      for (var i = 0; i < keys.length; i++) {
        text = text.split('{' + keys[i] + '}').join(params[keys[i]]);
      }
    }
    return text;
  }, [currentTranslation]);

  var tArray = useCallback(function (key) {
    var arr = currentTranslation[key];
    if (!arr) arr = translations.fa[key];
    return arr || [];
  }, [currentTranslation]);

  // همیشه RTL=false - نقشه خراب نمیشه
  var isRTL = (lang === 'fa' || lang === 'ar');

  var value = useMemo(function() {
    return {
      lang: lang,
      setLang: setLang,
      t: t,
      tArray: tArray,
      isRTL: isRTL,
      loaded: loaded,
      hasChosenLanguage: hasChosenLanguage,
      fontScale: fontScale,
      setFontScale: setFontScale,
      FONT_SCALE_MIN: FONT_SCALE_MIN,
      FONT_SCALE_MAX: FONT_SCALE_MAX,
      FONT_SCALE_STEP: FONT_SCALE_STEP,
    };
  }, [lang, loaded, t, tArray, isRTL, setLang, hasChosenLanguage, fontScale, setFontScale]);

  return React.createElement(LanguageContext.Provider, { value: value }, props.children);
}

function useLanguage() {
  return useContext(LanguageContext);
}

module.exports = {
  normalizeFontScale: normalizeFontScale,
  FONT_SCALE_MIN: FONT_SCALE_MIN,
  FONT_SCALE_MAX: FONT_SCALE_MAX,
  LanguageProvider: LanguageProvider,
  useLanguage: useLanguage,
  LanguageContext: LanguageContext,
};