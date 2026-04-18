package com.example.btl_adr1.utils;

import com.example.btl_adr1.BuildConfig;

public class Constants {
    // ====================================================
    // BASE_URL: Đổi thành IP máy chạy Flask server
    // Emulator: http://10.0.2.2:5500/
    // Real device (cùng WiFi): http://192.168.x.x:5500/
    // Deployed: https://your-domain.com/
    // ====================================================
    public static final String BASE_URL = normalizeBaseUrl(BuildConfig.API_BASE_URL);

    private static String normalizeBaseUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            return "http://10.0.2.2:5500/";
        }

        String trimmed = rawUrl.trim();
        return trimmed.endsWith("/") ? trimmed : trimmed + "/";
    }

    // SharedPreferences keys
    public static final String PREF_NAME = "shisafood_prefs";
    public static final String KEY_USER_ID = "user_id";
    public static final String KEY_USER_NAME = "user_name";
    public static final String KEY_USER_EMAIL = "user_email";
    public static final String KEY_USER_PHONE = "user_phone";
    public static final String KEY_USER_ROLE = "user_role";
    public static final String KEY_USER_ROLE_ID = "user_role_id";
    public static final String KEY_AUTH_TOKEN = "auth_token";
    public static final String KEY_IS_LOGGED_IN = "is_logged_in";

    // Role IDs (matching database)
    public static final int ROLE_ADMIN = 1;
    public static final int ROLE_SHIPPER = 2;
    public static final int ROLE_CUSTOMER = 3;

    // Order statuses
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_WAITING_SHIPPER = "waiting_for_shipper";
    public static final String STATUS_SHIPPING = "shipping";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_CANCELLED = "cancelled";

    // Payment methods
    public static final String PAY_CASH = "cash";
    public static final String PAY_CARD = "card";
    public static final String PAY_BANK = "banktransfer";
    public static final String PAY_MOMO = "momo";
}
