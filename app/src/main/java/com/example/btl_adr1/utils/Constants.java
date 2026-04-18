package com.example.btl_adr1.utils;

import android.os.Build;

import com.example.btl_adr1.BuildConfig;

import java.net.URI;

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

        String trimmed = adaptHostForEmulator(rawUrl.trim());
        return trimmed.endsWith("/") ? trimmed : trimmed + "/";
    }

    private static String adaptHostForEmulator(String url) {
        if (!isProbablyEmulator()) {
            return url;
        }

        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            if (host == null || !isLocalOrLanHost(host)) {
                return url;
            }

            StringBuilder rebuilt = new StringBuilder();
            rebuilt.append(uri.getScheme()).append("://").append("10.0.2.2");

            if (uri.getPort() != -1) {
                rebuilt.append(":").append(uri.getPort());
            }

            if (uri.getRawPath() != null && !uri.getRawPath().isEmpty()) {
                rebuilt.append(uri.getRawPath());
            }
            if (uri.getRawQuery() != null && !uri.getRawQuery().isEmpty()) {
                rebuilt.append("?").append(uri.getRawQuery());
            }
            if (uri.getRawFragment() != null && !uri.getRawFragment().isEmpty()) {
                rebuilt.append("#").append(uri.getRawFragment());
            }

            return rebuilt.toString();
        } catch (Exception ignored) {
            return url;
        }
    }

    private static boolean isLocalOrLanHost(String host) {
        if ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host)) {
            return true;
        }

        String[] parts = host.split("\\.");
        if (parts.length != 4) {
            return false;
        }

        try {
            int first = Integer.parseInt(parts[0]);
            int second = Integer.parseInt(parts[1]);

            if (first == 10) {
                return true;
            }
            if (first == 172 && second >= 16 && second <= 31) {
                return true;
            }
            return first == 192 && second == 168;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static boolean isProbablyEmulator() {
        return Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
                || "google_sdk".equals(Build.PRODUCT);
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
