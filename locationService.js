// ============================================================
// نسخه ۳ — فاز ۳-د: سرویس دریافت موقعیت GPS
//
// طبق طرح کاربر برای «محل دقیق»: «ثبت خودکار مختصات یا ورود دستی؛
// ارتفاع محل از سطح دریا اگر GPS باشد خودکار محاسبه شود». این فایل
// دقیقاً همین دو مسیر را پیاده می‌کند — expo-location هم مختصات و
// هم ارتفاع (altitude) را در یک فراخوانی می‌دهد.
// ============================================================

var Location = require('expo-location');

var LocationService = {

  // ------------------------------------------------------------
  // درخواست موقعیت فعلی. خروجی: { success, latitude, longitude,
  // elevation } یا { success: false, error }
  // ------------------------------------------------------------
  getCurrentLocation: async function () {
    try {
      var perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        return { success: false, error: 'PERMISSION_DENIED' };
      }

      var position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        success: true,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        // altitude ممکن است روی برخی دستگاه‌ها/بدون GPS واقعی null
        // باشد (مثلاً فقط بر پایه‌ی wifi/شبکه)؛ در آن صورت 0 می‌گذاریم
        // و کاربر می‌تواند دستی اصلاح کند.
        elevation: position.coords.altitude !== null && position.coords.altitude !== undefined
          ? Math.round(position.coords.altitude)
          : 0,
      };
    } catch (e) {
      console.error('خطا در دریافت موقعیت GPS:', e);
      return { success: false, error: e.message || 'UNKNOWN' };
    }
  },

};

module.exports = LocationService;
