package com.example.btl_adr1.utils;

import android.content.Context;
import android.content.SharedPreferences;

import com.example.btl_adr1.api.models.User;

/**
 * Quản lý session đăng nhập qua SharedPreferences.
 */
public class SessionManager {
    private final SharedPreferences prefs;
    private final SharedPreferences.Editor editor;

    public SessionManager(Context context) {
        prefs = context.getSharedPreferences(Constants.PREF_NAME, Context.MODE_PRIVATE);
        editor = prefs.edit();
    }

    /**
     * Lưu thông tin user sau khi login thành công
     */
    public void saveUser(User user) {
        saveUser(user, null);
    }

    /**
     * Lưu thông tin user + token (nếu backend trả về)
     */
    public void saveUser(User user, String token) {
        editor.putBoolean(Constants.KEY_IS_LOGGED_IN, true);
        editor.putInt(Constants.KEY_USER_ID, user.getId());
        editor.putString(Constants.KEY_USER_NAME, user.getName());
        editor.putString(Constants.KEY_USER_EMAIL, user.getEmail());
        editor.putString(Constants.KEY_USER_PHONE, user.getPhone());
        editor.putString(Constants.KEY_USER_ROLE, user.getRole());
        editor.putInt(Constants.KEY_USER_ROLE_ID, user.getRoleId());
        if (token != null && !token.trim().isEmpty()) {
            editor.putString(Constants.KEY_AUTH_TOKEN, token.trim());
        }
        editor.apply();
    }

    /**
     * Kiểm tra đã đăng nhập chưa
     */
    public boolean isLoggedIn() {
        return prefs.getBoolean(Constants.KEY_IS_LOGGED_IN, false);
    }

    /**
     * Lấy user ID
     */
    public int getUserId() {
        return prefs.getInt(Constants.KEY_USER_ID, 0);
    }

    /**
     * Lấy tên user
     */
    public String getUserName() {
        return prefs.getString(Constants.KEY_USER_NAME, "");
    }

    /**
     * Lấy email user
     */
    public String getUserEmail() {
        return prefs.getString(Constants.KEY_USER_EMAIL, "");
    }

    /**
     * Lấy SĐT user
     */
    public String getUserPhone() {
        return prefs.getString(Constants.KEY_USER_PHONE, "");
    }

    /**
     * Lấy role string (admin/shipper/customer)
     */
    public String getUserRole() {
        return prefs.getString(Constants.KEY_USER_ROLE, "customer");
    }

    /**
     * Lấy role ID (1=Admin, 2=Shipper, 3=Customer)
     */
    public int getUserRoleId() {
        return prefs.getInt(Constants.KEY_USER_ROLE_ID, Constants.ROLE_CUSTOMER);
    }

    /**
     * Lấy token xác thực đã lưu
     */
    public String getAuthToken() {
        return prefs.getString(Constants.KEY_AUTH_TOKEN, "");
    }

    /**
     * Tạo User object từ session
     */
    public User getUser() {
        if (!isLoggedIn()) return null;
        User user = new User();
        user.setId(getUserId());
        user.setName(getUserName());
        user.setEmail(getUserEmail());
        user.setPhone(getUserPhone());
        user.setRole(getUserRole());
        user.setRoleId(getUserRoleId());
        return user;
    }

    /**
     * Đăng xuất - xóa hết session
     */
    public void logout() {
        editor.clear();
        editor.apply();
    }
}
