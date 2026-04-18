package com.example.btl_adr1.ui.splash;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

import com.example.btl_adr1.ui.auth.LoginActivity;
import com.example.btl_adr1.ui.admin.AdminMainActivity;
import com.example.btl_adr1.ui.customer.CustomerMainActivity;
import com.example.btl_adr1.ui.shipper.ShipperMainActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.SessionManager;

/**
 * Splash screen — sử dụng SplashScreen API mới của Android.
 */
public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Cài đặt SplashScreen API trước khi gọi super.onCreate
        SplashScreen.installSplashScreen(this);
        
        super.onCreate(savedInstanceState);

        // Chuyển hướng ngay lập tức hoặc sau một khoảng delay ngắn nếu cần
        navigateNext();
    }

    private void navigateNext() {
        SessionManager session = new SessionManager(this);
        Intent intent;

        if (!session.isLoggedIn()) {
            intent = new Intent(this, LoginActivity.class);
        } else {
            int roleId = session.getUserRoleId();
            switch (roleId) {
                case Constants.ROLE_ADMIN:
                    intent = new Intent(this, AdminMainActivity.class);
                    break;
                case Constants.ROLE_SHIPPER:
                    intent = new Intent(this, ShipperMainActivity.class);
                    break;
                default:
                    intent = new Intent(this, CustomerMainActivity.class);
                    break;
            }
        }

        startActivity(intent);
        finish();
    }
}
