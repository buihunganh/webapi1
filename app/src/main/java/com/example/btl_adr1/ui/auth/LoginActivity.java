package com.example.btl_adr1.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.LoginRequest;
import com.example.btl_adr1.api.models.LoginResponse;
import com.example.btl_adr1.api.models.User;
import com.example.btl_adr1.ui.admin.AdminMainActivity;
import com.example.btl_adr1.ui.customer.CustomerMainActivity;
import com.example.btl_adr1.ui.shipper.ShipperMainActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

import org.json.JSONObject;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Màn hình đăng nhập.
 * Gọi Flask API: POST /api/auth/login
 */
public class LoginActivity extends AppCompatActivity {

    private TextInputEditText etEmail, etPassword;
    private MaterialButton btnLogin;
    private ProgressBar progressBar;
    private TextView tvError, tvRegister;
    private ApiService apiService;
    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        apiService = ApiClient.getApiService(this);
        sessionManager = new SessionManager(this);

        // Nếu đã login, chuyển thẳng
        if (sessionManager.isLoggedIn()) {
            navigateToMain();
            return;
        }

        initViews();
        setupListeners();
    }

    private void initViews() {
        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);
        progressBar = findViewById(R.id.progressBar);
        tvError = findViewById(R.id.tvError);
        tvRegister = findViewById(R.id.tvRegister);
    }

    private void setupListeners() {
        btnLogin.setOnClickListener(v -> attemptLogin());

        tvRegister.setOnClickListener(v -> {
            startActivity(new Intent(this, RegisterActivity.class));
        });
    }

    private void attemptLogin() {
        String email = etEmail.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        // Validation
        if (TextUtils.isEmpty(email)) {
            etEmail.setError("Vui lòng nhập email");
            etEmail.requestFocus();
            return;
        }
        if (TextUtils.isEmpty(password)) {
            etPassword.setError("Vui lòng nhập mật khẩu");
            etPassword.requestFocus();
            return;
        }

        setLoading(true);
        tvError.setVisibility(View.GONE);

        LoginRequest request = new LoginRequest(email, password);
        apiService.login(request).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    LoginResponse loginResponse = response.body();
                    if (loginResponse.isOk() && loginResponse.getUser() != null) {
                        User user = loginResponse.getUser();
                        sessionManager.saveUser(user, loginResponse.getToken());
                        Toast.makeText(LoginActivity.this, "Xin chào " + user.getName() + "!", Toast.LENGTH_SHORT).show();
                        navigateToMain();
                    } else {
                        showError(loginResponse.getError() != null ? loginResponse.getError() : "Đăng nhập thất bại");
                    }
                } else {
                    showError(parseBackendError(response));
                }
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                setLoading(false);
                showError("Lỗi kết nối tới " + Constants.BASE_URL + "\nChi tiết: " + t.getMessage());
            }
        });
    }

    private void navigateToMain() {
        int roleId = sessionManager.getUserRoleId();
        Intent intent;

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

        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        btnLogin.setEnabled(!loading);
        etEmail.setEnabled(!loading);
        etPassword.setEnabled(!loading);
    }

    private void showError(String msg) {
        tvError.setText(msg);
        tvError.setVisibility(View.VISIBLE);
    }

    private String parseBackendError(Response<LoginResponse> response) {
        String message = null;
        try {
            if (response.errorBody() != null) {
                String raw = response.errorBody().string();
                if (raw != null && !raw.trim().isEmpty()) {
                    JSONObject json = new JSONObject(raw);
                    if (json.has("error")) {
                        message = json.optString("error", null);
                    }
                }
            }
        } catch (Exception ignored) {
            message = null;
        }

        if (message == null || message.trim().isEmpty()) {
            message = "Đăng nhập thất bại";
        }

        return "HTTP " + response.code() + ": " + message;
    }
}
