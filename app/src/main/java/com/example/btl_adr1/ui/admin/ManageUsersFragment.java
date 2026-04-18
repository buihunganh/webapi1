package com.example.btl_adr1.ui.admin;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.AdminUserAdapter;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.User;
import com.example.btl_adr1.api.models.UserListResponse;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Fragment quản lý users cho Admin.
 * CRUD qua Flask API: /api/admin/users
 */
public class ManageUsersFragment extends Fragment {

    private RecyclerView rvUsers;
    private SwipeRefreshLayout swipeRefresh;
    private FloatingActionButton fabAdd;
    private ChipGroup chipGroupRole;
    private AdminUserAdapter adapter;
    private ApiService apiService;
    private List<User> allUsers = new ArrayList<>();
    private String selectedRole = null; // null = all

    private final String[] ROLES = {"Customer", "Shipper"};

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_manage_users, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getApiService(requireContext());

        rvUsers = view.findViewById(R.id.rvUsers);
        swipeRefresh = view.findViewById(R.id.swipeRefresh);
        fabAdd = view.findViewById(R.id.fabAdd);
        chipGroupRole = view.findViewById(R.id.chipGroupRole);

        adapter = new AdminUserAdapter(new ArrayList<>(), new AdminUserAdapter.OnAdminUserListener() {
            @Override
            public void onEditClick(User user) {
                showUserDialog(user);
            }

            @Override
            public void onToggleClick(User user) {
                confirmToggle(user);
            }
        });

        rvUsers.setLayoutManager(new LinearLayoutManager(requireContext()));
        rvUsers.setAdapter(adapter);

        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadUsers);

        fabAdd.setOnClickListener(v -> showUserDialog(null));

        chipGroupRole.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty() || checkedIds.get(0) == R.id.chipAll) {
                selectedRole = null;
            } else if (checkedIds.get(0) == R.id.chipAdmin) {
                selectedRole = "admin";
            } else if (checkedIds.get(0) == R.id.chipShipper) {
                selectedRole = "shipper";
            } else if (checkedIds.get(0) == R.id.chipCustomer) {
                selectedRole = "customer";
            }
            loadUsers();
        });

        loadUsers();
    }

    private void loadUsers() {
        swipeRefresh.setRefreshing(true);

        apiService.getAdminUsers(selectedRole, 500).enqueue(new Callback<UserListResponse>() {
            @Override
            public void onResponse(Call<UserListResponse> call, Response<UserListResponse> response) {
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<User> items = response.body().getItems();
                    allUsers = items != null ? items : new ArrayList<>();
                    adapter.updateList(allUsers);
                }
            }

            @Override
            public void onFailure(Call<UserListResponse> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(requireContext(), "Lỗi tải users", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showUserDialog(@Nullable User user) {
        View dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_user, null);

        TextInputEditText etName = dialogView.findViewById(R.id.etFullName);
        TextInputEditText etEmail = dialogView.findViewById(R.id.etEmail);
        TextInputEditText etPhone = dialogView.findViewById(R.id.etPhone);
        TextInputEditText etPassword = dialogView.findViewById(R.id.etPassword);
        Spinner spinnerRole = dialogView.findViewById(R.id.spinnerRole);
        android.widget.TextView tvTitle = dialogView.findViewById(R.id.tvDialogTitle);

        ArrayAdapter<String> roleAdapter = new ArrayAdapter<>(requireContext(),
                android.R.layout.simple_spinner_dropdown_item, ROLES);
        spinnerRole.setAdapter(roleAdapter);

        boolean isEdit = user != null;
        tvTitle.setText(isEdit ? "Sửa người dùng" : "Thêm người dùng");

        if (isEdit) {
            etName.setText(user.getName());
            etEmail.setText(user.getEmail());
            etEmail.setEnabled(false); // Không cho sửa email
            etPhone.setText(user.getPhone());
            etPassword.setHint("Để trống nếu không đổi");
            if (user.getRoleId() == 2) spinnerRole.setSelection(1);
            else spinnerRole.setSelection(0);
        }

        new AlertDialog.Builder(requireContext())
                .setView(dialogView)
                .setPositiveButton(isEdit ? "Cập nhật" : "Thêm", (dialog, which) -> {
                    String name = etName.getText().toString().trim();
                    String email = etEmail.getText().toString().trim();
                    String phone = etPhone.getText().toString().trim();
                    String password = etPassword.getText().toString().trim();
                    String role = spinnerRole.getSelectedItemPosition() == 1 ? "shipper" : "customer";

                    if (name.isEmpty() || email.isEmpty()) {
                        Toast.makeText(requireContext(), "Tên và email là bắt buộc", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    JsonObject json = new JsonObject();

                    if (isEdit) {
                        json.addProperty("full_name", name);
                        if (!phone.isEmpty()) json.addProperty("phone", phone);
                        if (!password.isEmpty()) json.addProperty("password", password);
                        json.addProperty("role", role);

                        apiService.adminUpdateUser(user.getId(), json).enqueue(new Callback<JsonObject>() {
                            @Override
                            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                                Toast.makeText(requireContext(), "Đã cập nhật!", Toast.LENGTH_SHORT).show();
                                loadUsers();
                            }
                            @Override
                            public void onFailure(Call<JsonObject> call, Throwable t) {
                                Toast.makeText(requireContext(), "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        });
                    } else {
                        if (password.isEmpty()) {
                            Toast.makeText(requireContext(), "Mật khẩu là bắt buộc", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        json.addProperty("full_name", name);
                        json.addProperty("email", email);
                        if (!phone.isEmpty()) json.addProperty("phone", phone);
                        json.addProperty("password", password);
                        json.addProperty("role", role);

                        apiService.adminCreateUser(json).enqueue(new Callback<JsonObject>() {
                            @Override
                            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                                if (response.isSuccessful()) {
                                    Toast.makeText(requireContext(), "Đã thêm user!", Toast.LENGTH_SHORT).show();
                                    loadUsers();
                                } else {
                                    Toast.makeText(requireContext(), "Thêm thất bại", Toast.LENGTH_SHORT).show();
                                }
                            }
                            @Override
                            public void onFailure(Call<JsonObject> call, Throwable t) {
                                Toast.makeText(requireContext(), "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void confirmToggle(User user) {
        new AlertDialog.Builder(requireContext())
                .setTitle("Xóa / Vô hiệu hóa")
                .setMessage("Vô hiệu hóa user \"" + user.getName() + "\"?")
                .setPositiveButton("Xác nhận", (dialog, which) -> {
                    apiService.adminDeleteUser(user.getId()).enqueue(new Callback<JsonObject>() {
                        @Override
                        public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                            Toast.makeText(requireContext(), "Đã cập nhật!", Toast.LENGTH_SHORT).show();
                            loadUsers();
                        }
                        @Override
                        public void onFailure(Call<JsonObject> call, Throwable t) {
                            Toast.makeText(requireContext(), "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Hủy", null)
                .show();
    }
}
