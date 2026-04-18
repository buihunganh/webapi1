package com.example.btl_adr1.ui.customer;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.User;
import com.example.btl_adr1.ui.auth.LoginActivity;
import com.example.btl_adr1.utils.CartManager;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.JsonObject;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Fragment hiển thị thông tin cá nhân + đăng xuất.
 */
public class ProfileFragment extends Fragment {

    private SessionManager session;
    private ApiService apiService;
    private TextView tvName;
    private TextView tvEmail;
    private TextView tvPhone;
    private TextView tvRole;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_profile, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        session = new SessionManager(requireContext());
        apiService = ApiClient.getApiService(requireContext());

        tvName = view.findViewById(R.id.tvName);
        tvEmail = view.findViewById(R.id.tvEmail);
        tvPhone = view.findViewById(R.id.tvPhone);
        tvRole = view.findViewById(R.id.tvRole);
        MaterialButton btnEditProfile = view.findViewById(R.id.btnEditProfile);
        MaterialButton btnLogout = view.findViewById(R.id.btnLogout);

        bindProfile();

        btnEditProfile.setOnClickListener(v -> showEditProfileDialog());

        btnLogout.setOnClickListener(v -> {
            new AlertDialog.Builder(requireContext())
                    .setTitle("Đăng xuất")
                    .setMessage(R.string.confirm_logout)
                    .setPositiveButton(R.string.yes, (dialog, which) -> {
                        session.logout();
                        CartManager.getInstance().clearCart();

                        Intent intent = new Intent(requireContext(), LoginActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    })
                    .setNegativeButton(R.string.no, null)
                    .show();
        });
    }

    private void bindProfile() {
        tvName.setText(session.getUserName());
        tvEmail.setText(session.getUserEmail());

        String phone = session.getUserPhone();
        tvPhone.setText(phone != null && !phone.isEmpty() ? phone : "Chưa cập nhật SĐT");

        String role = session.getUserRole();
        if (role != null) {
            switch (role) {
                case "admin": tvRole.setText("👑 Admin"); break;
                case "shipper": tvRole.setText("🚀 Shipper"); break;
                default: tvRole.setText("🛍️ Customer"); break;
            }
        }
    }

    private void showEditProfileDialog() {
        View dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_edit_profile, null);
        TextInputEditText etEditName = dialogView.findViewById(R.id.etEditName);
        TextInputEditText etEditPhone = dialogView.findViewById(R.id.etEditPhone);

        etEditName.setText(session.getUserName());
        etEditPhone.setText(session.getUserPhone());

        AlertDialog dialog = new AlertDialog.Builder(requireContext())
                .setTitle("Chỉnh sửa thông tin")
                .setView(dialogView)
                .setPositiveButton("Lưu", null)
                .setNegativeButton(R.string.cancel, null)
                .create();

        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String fullName = etEditName.getText() != null ? etEditName.getText().toString().trim() : "";
            String phone = etEditPhone.getText() != null ? etEditPhone.getText().toString().trim() : "";

            if (TextUtils.isEmpty(fullName)) {
                etEditName.setError("Vui lòng nhập họ tên");
                etEditName.requestFocus();
                return;
            }

            updateProfile(fullName, phone, dialog);
        }));

        dialog.show();
    }

    private void updateProfile(String fullName, String phone, AlertDialog dialog) {
        int userId = session.getUserId();
        if (userId <= 0) {
            Toast.makeText(requireContext(), "Không xác định được tài khoản", Toast.LENGTH_SHORT).show();
            return;
        }

        JsonObject payload = new JsonObject();
        payload.addProperty("full_name", fullName);
        payload.addProperty("phone", phone);

        apiService.adminUpdateUser(userId, payload).enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                if (response.isSuccessful() && response.body() != null && response.body().has("ok")
                        && response.body().get("ok").getAsBoolean() && response.body().has("user")) {
                    JsonObject userJson = response.body().getAsJsonObject("user");

                    User user = new User();
                    user.setId(userJson.has("id") ? userJson.get("id").getAsInt() : session.getUserId());
                    user.setName(userJson.has("name") ? userJson.get("name").getAsString() : fullName);
                    user.setEmail(userJson.has("email") ? userJson.get("email").getAsString() : session.getUserEmail());
                    user.setPhone(userJson.has("phone") && !userJson.get("phone").isJsonNull() ? userJson.get("phone").getAsString() : phone);
                    user.setRole(userJson.has("role") ? userJson.get("role").getAsString() : session.getUserRole());
                    user.setRoleId(userJson.has("role_id") ? userJson.get("role_id").getAsInt() : session.getUserRoleId());

                    session.saveUser(user);
                    bindProfile();
                    dialog.dismiss();
                    Toast.makeText(requireContext(), "Đã cập nhật thông tin", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(requireContext(), "Không cập nhật được thông tin", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<JsonObject> call, Throwable t) {
                Toast.makeText(requireContext(), "Lỗi kết nối: " + (t.getMessage() != null ? t.getMessage() : "unknown"), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
