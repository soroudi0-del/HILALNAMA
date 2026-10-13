var AsyncStorage = require('@react-native-async-storage/async-storage');

var Storage = AsyncStorage.default || AsyncStorage;

var UserSettings = {

  // نسخه ۳ — فاز ۳-ز: رفع باگ — قبلاً defaultCity برخلاف همه‌ی
  // آیتم‌های predefinedCities فیلد country نداشت. نتیجه: کاربری که
  // هرگز شهرش را در تنظیمات عوض نکرده بود (یعنی همچنان روی این شهر
  // پیش‌فرض مانده بود) و از "استفاده از شهر تنظیمات" در فرم گزارش
  // رصد استفاده می‌کرد، گزارشش با country: '' (خالی) در Firestore
  // ذخیره می‌شد — در نتیجه در فیلتر کشورِ صفحه‌ی «گزارش‌های کاربران»
  // زیر هیچ کشوری (نه ایران، نه جای دیگر) قابل پیدا شدن نبود.
  defaultCity: {
    name: 'قم',
    lat: 34.6401,
    lon: 50.8764,
    alt: 930,
    country: 'IR',
  },

  predefinedCities: [

    // ============================================================
    // ایران - مراکز استان‌ها (۳۱ استان)
    // ============================================================
    {name:'قم',           lat:34.6401, lon:50.8764,  alt:930,  country:'IR'},
    {name:'تهران',        lat:35.6892, lon:51.3890,  alt:1200, country:'IR'},
    {name:'مشهد',         lat:36.2605, lon:59.6168,  alt:990,  country:'IR'},
    {name:'اصفهان',       lat:32.6546, lon:51.6680,  alt:1570, country:'IR'},
    {name:'شیراز',        lat:29.5918, lon:52.5837,  alt:1486, country:'IR'},
    {name:'تبریز',        lat:38.0800, lon:46.2919,  alt:1350, country:'IR'},
    {name:'اهواز',        lat:31.3183, lon:48.6706,  alt:18,   country:'IR'},
    {name:'کرمان',        lat:30.2839, lon:57.0834,  alt:1755, country:'IR'},
    {name:'رشت',          lat:37.2808, lon:49.5832,  alt:-7,   country:'IR'},
    {name:'همدان',        lat:34.7988, lon:48.5146,  alt:1820, country:'IR'},
    {name:'یزد',          lat:31.8974, lon:54.3569,  alt:1216, country:'IR'},
    {name:'بندرعباس',     lat:27.1865, lon:56.2808,  alt:9,    country:'IR'},
    {name:'سنندج',        lat:35.3219, lon:46.9862,  alt:1480, country:'IR'},
    {name:'ارومیه',       lat:37.5527, lon:45.0761,  alt:1328, country:'IR'},
    {name:'اردبیل',       lat:38.2498, lon:48.2933,  alt:1350, country:'IR'},
    {name:'زاهدان',       lat:29.4963, lon:60.8629,  alt:1370, country:'IR'},
    {name:'کرمانشاه',     lat:34.3142, lon:47.0650,  alt:1319, country:'IR'},
    {name:'اراک',         lat:34.0917, lon:49.7089,  alt:1750, country:'IR'},
    {name:'گرگان',        lat:36.8427, lon:54.4430,  alt:13,   country:'IR'},
    {name:'ساری',         lat:36.5633, lon:53.0601,  alt:7,    country:'IR'},
    {name:'سمنان',        lat:35.5762, lon:53.3975,  alt:1138, country:'IR'},
    {name:'زنجان',        lat:36.6736, lon:48.4787,  alt:1663, country:'IR'},
    {name:'خرم‌آباد',     lat:33.4878, lon:48.3559,  alt:1125, country:'IR'},
    {name:'بجنورد',       lat:37.4747, lon:57.3290,  alt:1069, country:'IR'},
    {name:'ایلام',        lat:33.6374, lon:46.4227,  alt:1337, country:'IR'},
    {name:'بوشهر',        lat:28.9234, lon:50.8203,  alt:2,    country:'IR'},
    {name:'شهرکرد',       lat:32.3256, lon:50.8644,  alt:2062, country:'IR'},
    {name:'بیرجند',       lat:32.8663, lon:59.2210,  alt:1491, country:'IR'},
    {name:'قزوین',        lat:36.2797, lon:50.0045,  alt:1279, country:'IR'},
    {name:'یاسوج',        lat:30.6682, lon:51.5878,  alt:1829, country:'IR'},
    {name:'بندرلنگه',     lat:26.5570, lon:54.8756,  alt:7,    country:'IR'},

    // شهرهای مهم دیگر ایران
    {name:'نیشابور',      lat:36.2132, lon:58.7958,  alt:1150, country:'IR'},
    {name:'سبزوار',       lat:36.2126, lon:57.6819,  alt:970,  country:'IR'},
    {name:'بابل',         lat:36.5500, lon:52.6789,  alt:21,   country:'IR'},
    {name:'آمل',          lat:36.4700, lon:52.3500,  alt:95,   country:'IR'},
    {name:'قائم‌شهر',     lat:36.4719, lon:52.8614,  alt:76,   country:'IR'},
    {name:'نجف‌آباد',     lat:32.6356, lon:51.3636,  alt:1588, country:'IR'},
    {name:'کاشان',        lat:33.9849, lon:51.4336,  alt:982,  country:'IR'},
    {name:'خمینی‌شهر',   lat:32.6767, lon:51.5225,  alt:1570, country:'IR'},

    // ============================================================
    // عراق - استان‌ها و شهرهای مهم
    // ============================================================
    {name:'نجف اشرف',    lat:31.9968, lon:44.3148,  alt:53,   country:'IQ'},
    {name:'کربلای معلی', lat:32.6160, lon:44.0233,  alt:32,   country:'IQ'},
    {name:'بغداد',        lat:33.3152, lon:44.3661,  alt:34,   country:'IQ'},
    {name:'بصره',         lat:30.5085, lon:47.7804,  alt:5,    country:'IQ'},
    {name:'موصل',         lat:36.3350, lon:43.1189,  alt:223,  country:'IQ'},
    {name:'کرکوک',        lat:35.4681, lon:44.3922,  alt:261,  country:'IQ'},
    {name:'اربیل',        lat:36.1901, lon:44.0091,  alt:415,  country:'IQ'},
    {name:'سلیمانیه',     lat:35.5601, lon:45.4329,  alt:851,  country:'IQ'},
    {name:'دهوک',         lat:36.8669, lon:42.9903,  alt:617,  country:'IQ'},
    {name:'حله',          lat:32.4770, lon:44.4420,  alt:29,   country:'IQ'},
    {name:'کاظمین',       lat:33.3815, lon:44.3388,  alt:36,   country:'IQ'},
    {name:'سامراء',       lat:34.1980, lon:43.8741,  alt:74,   country:'IQ'},
    {name:'کوت',          lat:32.5007, lon:45.8228,  alt:18,   country:'IQ'},
    {name:'عماره',        lat:31.8430, lon:47.1487,  alt:14,   country:'IQ'},
    {name:'ناصریه',       lat:31.0484, lon:46.2580,  alt:5,    country:'IQ'},
    {name:'دیوانیه',      lat:31.9898, lon:44.9264,  alt:24,   country:'IQ'},
    {name:'رمادی',        lat:33.4258, lon:43.2993,  alt:53,   country:'IQ'},
    {name:'فلوجه',        lat:33.3530, lon:43.7857,  alt:43,   country:'IQ'},
    {name:'تکریت',        lat:34.6057, lon:43.6784,  alt:101,  country:'IQ'},
    {name:'عمار الشرقی',  lat:30.7500, lon:46.6333,  alt:2,    country:'IQ'},

    // ============================================================
    // افغانستان - مراکز ولایات
    // ============================================================
    {name:'کابل',         lat:34.5553, lon:69.2075,  alt:1791, country:'AF'},
    {name:'هرات',         lat:34.3529, lon:62.2040,  alt:964,  country:'AF'},
    {name:'مزارشریف',     lat:36.7069, lon:67.1100,  alt:378,  country:'AF'},
    {name:'قندهار',       lat:31.6283, lon:65.7372,  alt:1005, country:'AF'},
    {name:'جلال‌آباد',    lat:34.4301, lon:70.4483,  alt:573,  country:'AF'},
    {name:'ننگرهار',      lat:34.4301, lon:70.4483,  alt:573,  country:'AF'},
    {name:'کندز',         lat:36.7280, lon:68.8680,  alt:396,  country:'AF'},
    {name:'بلخ',          lat:36.7558, lon:66.8977,  alt:365,  country:'AF'},
    {name:'بامیان',       lat:34.8166, lon:67.8240,  alt:2620, country:'AF'},
    {name:'غزنی',         lat:33.5545, lon:68.4225,  alt:2219, country:'AF'},
    {name:'پکتیا',        lat:33.8000, lon:69.9333,  alt:2100, country:'AF'},
    {name:'لشکرگاه',      lat:31.5939, lon:64.3700,  alt:762,  country:'AF'},
    {name:'فاریاب',       lat:35.7068, lon:64.9131,  alt:305,  country:'AF'},
    {name:'سرپل',         lat:36.2500, lon:65.9167,  alt:482,  country:'AF'},
    {name:'تخار',         lat:36.7361, lon:69.5400,  alt:1008, country:'AF'},
    {name:'بادغیس',       lat:35.1667, lon:63.7667,  alt:943,  country:'AF'},
    {name:'میمنه',        lat:35.9221, lon:64.7706,  alt:852,  country:'AF'},
    {name:'چاریکار',      lat:35.0167, lon:69.1667,  alt:1701, country:'AF'},
    {name:'لوگر',         lat:33.9833, lon:69.0167,  alt:2100, country:'AF'},
    {name:'قلات',         lat:32.1069, lon:66.8731,  alt:1736, country:'AF'},
    {name:'فراه',         lat:32.3748, lon:62.1133,  alt:652,  country:'AF'},
    {name:'زرنج',         lat:31.1124, lon:61.8869,  alt:490,  country:'AF'},
    {name:'نیمروز',       lat:31.1124, lon:61.8869,  alt:490,  country:'AF'},
    {name:'خوست',         lat:33.3333, lon:70.0000,  alt:1134, country:'AF'},
    {name:'پنجشیر',       lat:35.1500, lon:69.5167,  alt:1524, country:'AF'},
    {name:'کاپیسا',       lat:34.9833, lon:69.5000,  alt:1800, country:'AF'},
    {name:'وردک',         lat:34.3667, lon:68.6667,  alt:2386, country:'AF'},
    {name:'لغمان',        lat:34.6917, lon:70.1428,  alt:698,  country:'AF'},
    {name:'نورستان',      lat:35.3250, lon:70.9103,  alt:1500, country:'AF'},
    {name:'کنر',          lat:34.8466, lon:71.1006,  alt:710,  country:'AF'},
    {name:'بدخشان',       lat:37.1167, lon:70.6000,  alt:1207, country:'AF'},
    {name:'تخار(مرکز)',   lat:36.7361, lon:69.5400,  alt:1008, country:'AF'},
    {name:'سمنگان',       lat:36.1533, lon:67.9550,  alt:839,  country:'AF'},
    {name:'دایکندی',      lat:33.6697, lon:66.0069,  alt:2838, country:'AF'},
    {name:'اروزگان',      lat:32.9264, lon:65.8533,  alt:2095, country:'AF'},
    {name:'زابل',         lat:32.4917, lon:67.1833,  alt:1506, country:'AF'},
    {name:'هلمند',        lat:31.5939, lon:64.3700,  alt:762,  country:'AF'},
    {name:'پکتیکا',       lat:32.2639, lon:68.5204,  alt:1803, country:'AF'},

    // ============================================================
    // پاکستان - مراکز استان‌ها و شهرهای مهم
    // ============================================================
    {name:'کراچی',        lat:24.8607, lon:67.0011,  alt:8,    country:'PK'},
    {name:'اسلام‌آباد',   lat:33.6844, lon:73.0479,  alt:507,  country:'PK'},
    {name:'لاهور',        lat:31.5204, lon:74.3587,  alt:217,  country:'PK'},
    {name:'فیصل‌آباد',    lat:31.4154, lon:73.0952,  alt:184,  country:'PK'},
    {name:'راولپندی',     lat:33.5651, lon:73.0169,  alt:508,  country:'PK'},
    {name:'گوجرانواله',   lat:32.1877, lon:74.1945,  alt:236,  country:'PK'},
    {name:'پشاور',        lat:34.0151, lon:71.5249,  alt:331,  country:'PK'},
    {name:'ملتان',        lat:30.1575, lon:71.5249,  alt:122,  country:'PK'},
    {name:'حیدرآباد(پاک)',lat:25.3960, lon:68.3578,  alt:13,   country:'PK'},
    {name:'کوئته',        lat:30.1798, lon:66.9750,  alt:1600, country:'PK'},
    {name:'گلگت',         lat:35.9221, lon:74.3085,  alt:1500, country:'PK'},
    {name:'موزفرآباد',    lat:34.3700, lon:73.4700,  alt:737,  country:'PK'},
    {name:'سرگودها',      lat:32.0836, lon:72.6711,  alt:188,  country:'PK'},
    {name:'سیالکوت',      lat:32.4945, lon:74.5229,  alt:255,  country:'PK'},
    {name:'بهاولپور',     lat:29.3956, lon:71.6836,  alt:117,  country:'PK'},
    {name:'سکهر',         lat:27.7052, lon:68.8574,  alt:66,   country:'PK'},
    {name:'لاڑکانه',      lat:27.5580, lon:68.2258,  alt:56,   country:'PK'},
    {name:'شیخوپوره',     lat:31.7167, lon:73.9833,  alt:224,  country:'PK'},
    {name:'لیاقت‌پور',    lat:28.0600, lon:68.5400,  alt:57,   country:'PK'},
    {name:'ابوتاباد',     lat:34.1558, lon:73.2194,  alt:1256, country:'PK'},
    {name:'مردان',        lat:34.1985, lon:72.0404,  alt:283,  country:'PK'},
    {name:'نوشهره',       lat:34.0152, lon:71.9764,  alt:281,  country:'PK'},
    {name:'چارسده',       lat:34.1452, lon:71.7342,  alt:276,  country:'PK'},

    // ============================================================
    // عربستان سعودی
    // ============================================================
    {name:'مکه مکرمه',   lat:21.4225, lon:39.8262,  alt:277,  country:'SA'},
    {name:'مدینه منوره', lat:24.4539, lon:39.6142,  alt:597,  country:'SA'},
    {name:'جده',          lat:21.5169, lon:39.2192,  alt:12,   country:'SA'},
    {name:'ریاض',         lat:24.7136, lon:46.6753,  alt:612,  country:'SA'},
    {name:'دمام',         lat:26.4207, lon:50.0888,  alt:4,    country:'SA'},
    {name:'تبوک',         lat:28.3998, lon:36.5715,  alt:768,  country:'SA'},
    {name:'بریده',        lat:26.3260, lon:43.9750,  alt:648,  country:'SA'},
    {name:'خرج',          lat:24.1431, lon:47.3009,  alt:432,  country:'SA'},
    {name:'حائل',         lat:27.5114, lon:41.6931,  alt:973,  country:'SA'},
    {name:'نجران',        lat:17.4924, lon:44.1277,  alt:1210, country:'SA'},

    // ============================================================
    // سایر کشورهای خاورمیانه
    // ============================================================
    {name:'بیروت',        lat:33.8938, lon:35.5018,  alt:0,    country:'LB'},
    {name:'دمشق',         lat:33.5138, lon:36.2765,  alt:680,  country:'SY'},
    {name:'حلب',          lat:36.2021, lon:37.1343,  alt:380,  country:'SY'},
    {name:'قاهره',        lat:30.0444, lon:31.2357,  alt:75,   country:'EG'},
    {name:'اسکندریه',     lat:31.2001, lon:29.9187,  alt:0,    country:'EG'},
    {name:'دوحه',         lat:25.2854, lon:51.5310,  alt:10,   country:'QA'},
    {name:'مسقط',         lat:23.5880, lon:58.3829,  alt:5,    country:'OM'},
    {name:'کویت',         lat:29.3759, lon:47.9774,  alt:0,    country:'KW'},
    {name:'ابوظبی',       lat:24.4539, lon:54.3773,  alt:27,   country:'AE'},
    {name:'دبی',          lat:25.2048, lon:55.2708,  alt:5,    country:'AE'},
    {name:'تل‌آویو',      lat:32.0853, lon:34.7818,  alt:5,    country:'IL'},
    {name:'عمان(اردن)',   lat:31.9539, lon:35.9106,  alt:777,  country:'JO'},
    {name:'صنعا',         lat:15.3694, lon:44.1910,  alt:2250, country:'YE'},
    {name:'عدن',          lat:12.7855, lon:45.0187,  alt:22,   country:'YE'},
    {name:'خارطوم',       lat:15.5007, lon:32.5599,  alt:380,  country:'SD'},
    {name:'طرابلس',       lat:32.8872, lon:13.1913,  alt:81,   country:'LY'},
    {name:'تونس',         lat:36.8190, lon:10.1658,  alt:4,    country:'TN'},
    {name:'الجزایر',      lat:36.7372, lon:3.0865,   alt:23,   country:'DZ'},
    {name:'رباط',         lat:34.0209, lon:-6.8417,  alt:75,   country:'MA'},
    {name:'کازابلانکا',   lat:33.5731, lon:-7.5898,  alt:56,   country:'MA'},

    // ============================================================
    // ترکیه
    // ============================================================
    {name:'استانبول',     lat:41.0082, lon:28.9784,  alt:40,   country:'TR'},
    {name:'آنکارا',       lat:39.9334, lon:32.8597,  alt:938,  country:'TR'},
    {name:'ازمیر',        lat:38.4192, lon:27.1287,  alt:2,    country:'TR'},
    {name:'بورسا',        lat:40.1885, lon:29.0610,  alt:100,  country:'TR'},
    {name:'آنتالیا',      lat:36.8969, lon:30.7133,  alt:30,   country:'TR'},
    {name:'قونیه',        lat:37.8746, lon:32.4932,  alt:1016, country:'TR'},
    {name:'آدانا',        lat:37.0000, lon:35.3213,  alt:23,   country:'TR'},
    {name:'قیصریه',       lat:38.7312, lon:35.4787,  alt:1060, country:'TR'},
    {name:'ارزروم',       lat:39.9055, lon:41.2658,  alt:1890, country:'TR'},
    {name:'طرابزون',      lat:41.0015, lon:39.7178,  alt:39,   country:'TR'},
    {name:'دیاربکر',      lat:37.9144, lon:40.2306,  alt:675,  country:'TR'},

    // ============================================================
    // آسیای مرکزی و قفقاز
    // ============================================================
    {name:'باکو',         lat:40.4093, lon:49.8671,  alt:0,    country:'AZ'},
    {name:'تاشکند',       lat:41.2995, lon:69.2401,  alt:489,  country:'UZ'},
    {name:'سمرقند',       lat:39.6270, lon:66.9750,  alt:702,  country:'UZ'},
    {name:'بخارا',        lat:39.7681, lon:64.4556,  alt:228,  country:'UZ'},
    {name:'دوشنبه',       lat:38.5598, lon:68.7737,  alt:800,  country:'TJ'},
    {name:'آلماتی',       lat:43.2220, lon:76.8512,  alt:817,  country:'KZ'},
    {name:'نورسلطان',     lat:51.1605, lon:71.4704,  alt:347,  country:'KZ'},
    {name:'عشق‌آباد',    lat:37.9601, lon:58.3261,  alt:219,  country:'TM'},
    {name:'بیشکک',        lat:42.8746, lon:74.5698,  alt:800,  country:'KG'},

    // ============================================================
    // جنوب و جنوب شرقی آسیا
    // ============================================================
    {name:'دهلی نو',      lat:28.6139, lon:77.2090,  alt:216,  country:'IN'},
    {name:'ممبای',        lat:19.0760, lon:72.8777,  alt:14,   country:'IN'},
    {name:'حیدرآباد(هند)',lat:17.3850, lon:78.4867,  alt:542,  country:'IN'},
    {name:'ڈهاکا',        lat:23.8103, lon:90.4125,  alt:8,    country:'BD'},
    {name:'چیتاگانگ',     lat:22.3569, lon:91.7832,  alt:9,    country:'BD'},
    {name:'کولومبو',      lat:6.9271,  lon:79.8612,  alt:7,    country:'LK'},
    {name:'کوالالامپور',  lat:3.1390,  lon:101.6869, alt:22,   country:'MY'},
    {name:'جاکارتا',      lat:-6.2088, lon:106.8456, alt:8,    country:'ID'},
    {name:'سینگاپور',     lat:1.3521,  lon:103.8198, alt:15,   country:'SG'},
    {name:'مانیل',        lat:14.5995, lon:120.9842, alt:15,   country:'PH'},

    // ============================================================
    // آفریقا (مسلمان‌نشین)
    // ============================================================
    {name:'لاگوس',        lat:6.5244,  lon:3.3792,   alt:41,   country:'NG'},
    {name:'آبوجا',        lat:9.0765,  lon:7.3986,   alt:840,  country:'NG'},
    {name:'آکرا',         lat:5.6037,  lon:-0.1870,  alt:61,   country:'GH'},
    {name:'داکار',        lat:14.7167, lon:-17.4677, alt:22,   country:'SN'},
    {name:'نایروبی',      lat:-1.2921, lon:36.8219,  alt:1795, country:'KE'},
    {name:'آدیس‌آبابا',   lat:9.0054,  lon:38.7636,  alt:2355, country:'ET'},
    {name:'موگادیشو',     lat:2.0469,  lon:45.3182,  alt:10,   country:'SO'},
    {name:'داراس‌سلام',   lat:-6.7924, lon:39.2083,  alt:0,    country:'TZ'},
    {name:'انتانانریوو',  lat:-18.9137,lon:47.5361,  alt:1276, country:'MG'},

    // ============================================================
    // اروپا
    // ============================================================
    {name:'لندن',         lat:51.5074, lon:-0.1278,  alt:11,   country:'GB'},
    {name:'پاریس',        lat:48.8566, lon:2.3522,   alt:35,   country:'FR'},
    {name:'برلین',        lat:52.5200, lon:13.4050,  alt:34,   country:'DE'},
    {name:'مادرید',       lat:40.4168, lon:-3.7038,  alt:667,  country:'ES'},
    {name:'رم',           lat:41.9028, lon:12.4964,  alt:21,   country:'IT'},
    {name:'آمستردام',     lat:52.3676, lon:4.9041,   alt:0,    country:'NL'},
    {name:'بروکسل',       lat:50.8503, lon:4.3517,   alt:56,   country:'BE'},
    {name:'وین',          lat:48.2082, lon:16.3738,  alt:171,  country:'AT'},
    {name:'زوریخ',        lat:47.3769, lon:8.5417,   alt:408,  country:'CH'},
    {name:'استکهلم',      lat:59.3293, lon:18.0686,  alt:28,   country:'SE'},
    {name:'اسلو',         lat:59.9139, lon:10.7522,  alt:23,   country:'NO'},
    {name:'هلسینکی',      lat:60.1699, lon:24.9384,  alt:26,   country:'FI'},
    {name:'کپنهاگ',       lat:55.6761, lon:12.5683,  alt:6,    country:'DK'},
    {name:'مسکو',         lat:55.7558, lon:37.6173,  alt:156,  country:'RU'},
    {name:'سن‌پترزبورگ', lat:59.9343, lon:30.3351,  alt:5,    country:'RU'},

    // ============================================================
    // آمریکا
    // ============================================================
    {name:'نیویورک',      lat:40.7128, lon:-74.0060, alt:10,   country:'US'},
    {name:'لس‌آنجلس',    lat:34.0522, lon:-118.2437,alt:71,   country:'US'},
    {name:'شیکاگو',       lat:41.8781, lon:-87.6298, alt:181,  country:'US'},
    {name:'هیوستون',      lat:29.7604, lon:-95.3698, alt:15,   country:'US'},
    {name:'واشنگتن',      lat:38.9072, lon:-77.0369, alt:7,    country:'US'},
    {name:'دیترویت',      lat:42.3314, lon:-83.0458, alt:183,  country:'US'},
    {name:'دالاس',        lat:32.7767, lon:-96.7970, alt:139,  country:'US'},
    {name:'تورنتو',       lat:43.6532, lon:-79.3832, alt:76,   country:'CA'},
    {name:'مونترال',      lat:45.5017, lon:-73.5673, alt:57,   country:'CA'},
    {name:'ونکوور',       lat:49.2827, lon:-123.1207,alt:70,   country:'CA'},
    {name:'سائوپائولو',   lat:-23.5505,lon:-46.6333, alt:760,  country:'BR'},
    {name:'بوینس‌آیرس',  lat:-34.6037,lon:-58.3816, alt:25,   country:'AR'},
    {name:'سانتیاگو',     lat:-33.4489,lon:-70.6693, alt:567,  country:'CL'},

    // ============================================================
    // استرالیا و اقیانوسیه
    // ============================================================
    {name:'سیدنی',        lat:-33.8688,lon:151.2093, alt:3,    country:'AU'},
    {name:'ملبورن',       lat:-37.8136,lon:144.9631, alt:31,   country:'AU'},
    {name:'پرت',          lat:-31.9505,lon:115.8605, alt:0,    country:'AU'},
    {name:'بریزبن',       lat:-27.4698,lon:153.0251, alt:9,    country:'AU'},

    // ============================================================
    // شرق دور
    // ============================================================
    {name:'توکیو',        lat:35.6762, lon:139.6503, alt:40,   country:'JP'},
    {name:'پکن',          lat:39.9042, lon:116.4074, alt:43,   country:'CN'},
    {name:'شانگهای',      lat:31.2304, lon:121.4737, alt:4,    country:'CN'},
    {name:'سئول',         lat:37.5665, lon:126.9780, alt:38,   country:'KR'},
    {name:'بانکوک',       lat:13.7563, lon:100.5018, alt:2,    country:'TH'},
    {name:'هانوی',        lat:21.0285, lon:105.8542, alt:6,    country:'VN'},

  ],

  saveCity: async function(city) {
    try {
      await Storage.setItem('userCity', JSON.stringify(city));
      return true;
    } catch(e) {
      console.log('Save error:', e);
      return false;
    }
  },

  loadCity: async function() {
    try {
      var data = await Storage.getItem('userCity');
      if (data) return JSON.parse(data);
      return this.defaultCity;
    } catch(e) {
      return this.defaultCity;
    }
  },

  saveCustomCity: async function(name, lat, lon, alt) {
    var city = {
      name: name,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      alt: parseFloat(alt) || 0,
      custom: true
    };
    return await this.saveCity(city);
  },

  // دریافت شهرها بر اساس کشور
  getCitiesByCountry: function(countryCode) {
    return this.predefinedCities.filter(function(c) {
      return c.country === countryCode;
    });
  },

  // دریافت همه کشورها
  //
  // نسخه ۳ — فاز ۳-ح: رفع باگ چندزبانگی — قبلاً این تابع مستقیماً
  // یک نام ثابت فارسی (مثل '🇮🇷 ایران') برمی‌گرداند که با تغییر
  // زبان اپ به عربی/انگلیسی عوض نمی‌شد (چون اصلاً از سیستم ترجمه
  // t() عبور نمی‌کرد — دقیقاً همان کلاس باگی که پیش‌تر برای
  // getSightingResultLabel و مشابه‌هایش در sightingReports.js رفع
  // شد). راه‌حل، هم‌راستا با الگوی از‌قبل‌موجود getCityKey: به‌جای
  // نام نهایی، فقط *کلید* ترجمه (nameKey، مثل countryIR) و پرچم را
  // جداگانه برمی‌گرداند؛ خودِ کامپوننت UI (SightingReportFormScreen،
  // BrowseReportsScreen) با t(c.nameKey) آن را به زبان جاری ترجمه
  // می‌کند. کلیدهای country<CODE> برای همه‌ی ۶۷ کشوری که واقعاً در
  // predefinedCities استفاده شده‌اند، به translations.js (هر سه
  // زبان) اضافه شدند.
  getCountries: function() {
    var countryCodes = {};
    var countryFlags = {
      'IR': '🇮🇷', 'IQ': '🇮🇶', 'AF': '🇦🇫', 'PK': '🇵🇰', 'SA': '🇸🇦',
      'AE': '🇦🇪', 'TR': '🇹🇷', 'LB': '🇱🇧', 'SY': '🇸🇾', 'EG': '🇪🇬',
      'QA': '🇶🇦', 'OM': '🇴🇲', 'KW': '🇰🇼', 'JO': '🇯🇴', 'YE': '🇾🇪',
      'AZ': '🇦🇿', 'UZ': '🇺🇿', 'TJ': '🇹🇯', 'KZ': '🇰🇿', 'TM': '🇹🇲',
      'KG': '🇰🇬', 'IN': '🇮🇳', 'BD': '🇧🇩', 'LK': '🇱🇰', 'MY': '🇲🇾',
      'ID': '🇮🇩', 'SG': '🇸🇬', 'PH': '🇵🇭', 'GB': '🇬🇧', 'FR': '🇫🇷',
      'DE': '🇩🇪', 'ES': '🇪🇸', 'IT': '🇮🇹', 'NL': '🇳🇱', 'BE': '🇧🇪',
      'AT': '🇦🇹', 'CH': '🇨🇭', 'SE': '🇸🇪', 'NO': '🇳🇴', 'FI': '🇫🇮',
      'DK': '🇩🇰', 'RU': '🇷🇺', 'US': '🇺🇸', 'CA': '🇨🇦', 'BR': '🇧🇷',
      'AR': '🇦🇷', 'CL': '🇨🇱', 'AU': '🇦🇺', 'JP': '🇯🇵', 'CN': '🇨🇳',
      'KR': '🇰🇷', 'TH': '🇹🇭', 'VN': '🇻🇳', 'NG': '🇳🇬', 'GH': '🇬🇭',
      'SN': '🇸🇳', 'KE': '🇰🇪', 'ET': '🇪🇹', 'SO': '🇸🇴', 'TZ': '🇹🇿',
      'SD': '🇸🇩', 'LY': '🇱🇾', 'TN': '🇹🇳', 'DZ': '🇩🇿', 'MA': '🇲🇦',
      'IL': '🇮🇱', 'MG': '🇲🇬',
    };
    this.predefinedCities.forEach(function(c) {
      if (c.country) countryCodes[c.country] = true;
    });
    return Object.keys(countryCodes).map(function(code) {
      return { code: code, nameKey: 'country' + code, flag: countryFlags[code] || '' };
    });
  },

  getCityKey: function(name) {
    var map = {
      // v3.5: شهرهای مخصوص نقشه (در فهرست انتخاب شهر نیستند)
      'مکه':             'cityMecca',
      'نجف':             'cityNajaf',
      'کربلا':           'cityKarbala',
      'مدینه':           'cityMedina',
      // ============================================================
      // ایران - مراکز استان‌ها
      // ============================================================
      'قم':              'cityQom',
      'تهران':           'cityTehran',
      'مشهد':            'cityMashhad',
      'اصفهان':          'cityIsfahan',
      'شیراز':           'cityShiraz',
      'تبریز':           'cityTabriz',
      'اهواز':           'cityAhvaz',
      'کرمان':           'cityKerman',
      'رشت':             'cityRasht',
      'همدان':           'cityHamedan',
      'یزد':             'cityYazd',
      'بندرعباس':        'cityBandarAbbas',
      'سنندج':           'citySanandaj',
      'ارومیه':          'cityUrmia',
      'اردبیل':          'cityArdabil',
      'زاهدان':          'cityZahedan',
      'کرمانشاه':        'cityKermanshah',
      'اراک':            'cityArak',
      'گرگان':           'cityGorgan',
      'ساری':            'citySari',
      'سمنان':           'citySemnan',
      'زنجان':           'cityZanjan',
      'خرم‌آباد':        'cityKhorramabad',
      'بجنورد':          'cityBojnord',
      'ایلام':           'cityIlam',
      'بوشهر':           'cityBushehr',
      'شهرکرد':          'cityShahrKord',
      'بیرجند':          'cityBirjand',
      'قزوین':           'cityQazvin',
      'یاسوج':           'cityYasouj',
      'بندرلنگه':        'cityBandarLengeh',

      // شهرهای مهم دیگر ایران
      'نیشابور':         'cityNeyshabur',
      'سبزوار':          'citySabzevar',
      'بابل':            'cityBabol',
      'آمل':             'cityAmol',
      'قائم‌شهر':        'cityQaemshahr',
      'نجف‌آباد':        'cityNajafabad',
      'کاشان':           'cityKashan',
      'خمینی‌شهر':       'cityKhomeyniShahr',

      // ============================================================
      // عراق
      // ============================================================
      'نجف اشرف':        'cityNajaf',
      'کربلای معلی':     'cityKarbala',
      'بغداد':           'cityBaghdad',
      'بصره':            'cityBasra',
      'موصل':            'cityMosul',
      'کرکوک':           'cityKirkuk',
      'اربیل':           'cityErbil',
      'سلیمانیه':        'citySulaymaniyah',
      'دهوک':            'cityDuhok',
      'حله':             'cityHillah',
      'کاظمین':          'cityKadhimiya',
      'سامراء':          'citySamarra',
      'کوت':             'cityKut',
      'عماره':           'cityAmarah',
      'ناصریه':          'cityNasiriyah',
      'دیوانیه':         'cityDiwaniyah',
      'رمادی':           'cityRamadi',
      'فلوجه':           'cityFallujah',
      'تکریت':           'cityTikrit',
      'عمار الشرقی':     'cityAmmarAlSharqi',

      // ============================================================
      // افغانستان
      // ============================================================
      'کابل':            'cityKabul',
      'هرات':            'cityHerat',
      'مزارشریف':        'cityMazarISharif',
      'قندهار':          'cityKandahar',
      'جلال‌آباد':       'cityJalalabad',
      'ننگرهار':         'cityNangarhar',
      'کندز':            'cityKunduz',
      'بلخ':             'cityBalkh',
      'بامیان':          'cityBamiyan',
      'غزنی':            'cityGhazni',
      'پکتیا':           'cityPaktia',
      'لشکرگاه':         'cityLashkarGah',
      'فاریاب':          'cityFaryab',
      'سرپل':            'citySarIPul',
      'تخار':            'cityTakhar',
      'بادغیس':          'cityBadghis',
      'میمنه':           'cityMaymana',
      'چاریکار':         'cityCharikar',
      'لوگر':            'cityLogar',
      'قلات':            'cityQalat',
      'فراه':            'cityFarah',
      'زرنج':            'cityZaranj',
      'نیمروز':          'cityNimroz',
      'خوست':            'cityKhost',
      'پنجشیر':          'cityPanjshir',
      'کاپیسا':          'cityKapisa',
      'وردک':            'cityWardak',
      'لغمان':           'cityLaghman',
      'نورستان':         'cityNuristan',
      'کنر':             'cityKunar',
      'بدخشان':          'cityBadakhshan',
      'تخار(مرکز)':      'cityTakharCenter',
      'سمنگان':          'citySamangan',
      'دایکندی':         'cityDaykundi',
      'اروزگان':         'cityUruzgan',
      'زابل':            'cityZabol',
      'هلمند':           'cityHelmand',
      'پکتیکا':          'cityPaktika',

      // ============================================================
      // پاکستان
      // ============================================================
      'کراچی':           'cityKarachi',
      'اسلام‌آباد':      'cityIslamabad',
      'لاهور':           'cityLahore',
      'فیصل‌آباد':       'cityFaisalabad',
      'راولپندی':        'cityRawalpindi',
      'گوجرانواله':      'cityGujranwala',
      'پشاور':           'cityPeshawar',
      'ملتان':           'cityMultan',
      'حیدرآباد(پاک)':   'cityHyderabadPK',
      'کوئته':           'cityQuetta',
      'گلگت':            'cityGilgit',
      'موزفرآباد':       'cityMuzaffarabad',
      'سرگودها':         'citySargodha',
      'سیالکوت':         'citySialkot',
      'بهاولپور':        'cityBahawalpur',
      'سکهر':            'citySukkur',
      'لاڑکانه':         'cityLarkana',
      'شیخوپوره':        'citySheikhupura',
      'لیاقت‌پور':       'cityLiaquatpur',
      'ابوتاباد':        'cityAbbottabad',
      'مردان':           'cityMardan',
      'نوشهره':          'cityNowshera',
      'چارسده':          'cityCharsadda',

      // ============================================================
      // عربستان سعودی
      // ============================================================
      'مکه مکرمه':       'cityMecca',
      'مدینه منوره':     'cityMedina',
      'جده':             'cityJeddah',
      'ریاض':            'cityRiyadh',
      'دمام':            'cityDammam',
      'تبوک':            'cityTabuk',
      'بریده':           'cityBuraydah',
      'خرج':             'cityKharj',
      'حائل':            'cityHail',
      'نجران':           'cityNajran',

      // ============================================================
      // سایر کشورهای خاورمیانه
      // ============================================================
      'بیروت':           'cityBeirut',
      'دمشق':            'cityDamascus',
      'حلب':             'cityAleppo',
      'قاهره':           'cityCairo',
      'اسکندریه':        'cityAlexandria',
      'دوحه':            'cityDoha',
      'مسقط':            'cityMuscat',
      'کویت':            'cityKuwait',
      'ابوظبی':          'cityAbuDhabi',
      'دبی':             'cityDubai',
      'تل‌آویو':         'cityTelAviv',
      'عمان(اردن)':      'cityAmman',
      'صنعا':            'citySanaa',
      'عدن':             'cityAden',
      'خارطوم':          'cityKhartoum',
      'طرابلس':          'cityTripoli',
      'تونس':            'cityTunis',
      'الجزایر':         'cityAlgiers',
      'رباط':            'cityRabat',
      'کازابلانکا':      'cityCasablanca',

      // ============================================================
      // ترکیه
      // ============================================================
      'استانبول':        'cityIstanbul',
      'آنکارا':          'cityAnkara',
      'ازمیر':           'cityIzmir',
      'بورسا':           'cityBursa',
      'آنتالیا':         'cityAntalya',
      'قونیه':           'cityKonya',
      'آدانا':           'cityAdana',
      'قیصریه':          'cityKayseri',
      'ارزروم':          'cityErzurum',
      'طرابزون':         'cityTrabzon',
      'دیاربکر':         'cityDiyarbakir',

      // ============================================================
      // آسیای مرکزی و قفقاز
      // ============================================================
      'باکو':            'cityBaku',
      'تاشکند':          'cityTashkent',
      'سمرقند':          'citySamarkand',
      'بخارا':           'cityBukhara',
      'دوشنبه':          'cityDushanbe',
      'آلماتی':          'cityAlmaty',
      'نورسلطان':        'cityNurSultan',
      'عشق‌آباد':        'cityAshgabat',
      'بیشکک':           'cityBishkek',

      // ============================================================
      // جنوب و جنوب شرقی آسیا
      // ============================================================
      'دهلی نو':         'cityNewDelhi',
      'ممبای':           'cityMumbai',
      'حیدرآباد(هند)':   'cityHyderabadIN',
      'ڈهاکا':           'cityDhaka',
      'چیتاگانگ':        'cityChittagong',
      'کولومبو':         'cityColombo',
      'کوالالامپور':     'cityKualaLumpur',
      'جاکارتا':         'cityJakarta',
      'سینگاپور':        'citySingapore',
      'مانیل':           'cityManila',

      // ============================================================
      // آفریقا
      // ============================================================
      'لاگوس':           'cityLagos',
      'آبوجا':           'cityAbuja',
      'آکرا':            'cityAccra',
      'داکار':           'cityDakar',
      'نایروبی':         'cityNairobi',
      'آدیس‌آبابا':      'cityAddisAbaba',
      'موگادیشو':        'cityMogadishu',
      'داراس‌سلام':      'cityDarEsSalaam',
      'انتانانریوو':     'cityAntananarivo',

      // ============================================================
      // اروپا
      // ============================================================
      'لندن':            'cityLondon',
      'پاریس':           'cityParis',
      'برلین':           'cityBerlin',
      'مادرید':          'cityMadrid',
      'رم':              'cityRome',
      'آمستردام':        'cityAmsterdam',
      'بروکسل':          'cityBrussels',
      'وین':             'cityVienna',
      'زوریخ':           'cityZurich',
      'استکهلم':         'cityStockholm',
      'اسلو':            'cityOslo',
      'هلسینکی':         'cityHelsinki',
      'کپنهاگ':          'cityCopenhagen',
      'مسکو':            'cityMoscow',
      'سن‌پترزبورگ':     'citySaintPetersburg',

      // ============================================================
      // آمریکا
      // ============================================================
      'نیویورک':         'cityNewYork',
      'لس‌آنجلس':        'cityLosAngeles',
      'شیکاگو':          'cityChicago',
      'هیوستون':         'cityHouston',
      'واشنگتن':         'cityWashington',
      'دیترویت':         'cityDetroit',
      'دالاس':           'cityDallas',
      'تورنتو':          'cityToronto',
      'مونترال':         'cityMontreal',
      'ونکوور':          'cityVancouver',
      'سائوپائولو':      'citySaoPaulo',
      'بوینس‌آیرس':      'cityBuenosAires',
      'سانتیاگو':        'citySantiago',

      // ============================================================
      // استرالیا و اقیانوسیه
      // ============================================================
      'سیدنی':           'citySydney',
      'ملبورن':          'cityMelbourne',
      'پرت':             'cityPerth',
      'بریزبن':          'cityBrisbane',

      // ============================================================
      // شرق دور
      // ============================================================
      'توکیو':           'cityTokyo',
      'پکن':             'cityBeijing',
      'شانگهای':         'cityShanghai',
      'سئول':            'citySeoul',
      'بانکوک':          'cityBangkok',
      'هانوی':           'cityHanoi',
    };
    return map[name] || null;
  },
};

module.exports = UserSettings;