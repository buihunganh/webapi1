package com.example.btl_adr1.ui.admin;

import android.content.Intent;
import android.os.Bundle;
import android.widget.PopupMenu;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Order;
import com.example.btl_adr1.api.models.OrderListResponse;
import com.example.btl_adr1.api.models.ProductListResponse;
import com.example.btl_adr1.api.models.UserListResponse;
import com.example.btl_adr1.ui.auth.LoginActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.MoneyUtils;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.tabs.TabLayout;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Admin Dashboard Activity.
 * Hiển thị thống kê + TabLayout quản lý Products/Users/Orders.
 */
public class AdminMainActivity extends AppCompatActivity {

    private TextView tvProductCount, tvUserCount, tvOrderCount;
    private TextView tvRevenueTotal, tvCompletedCount, tvCancelledCount;
    private TabLayout tabLayout;
    private ApiService apiService;
    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_main);

        apiService = ApiClient.getApiService(this);

        // Check role
        sessionManager = new SessionManager(this);
        if (sessionManager.getUserRoleId() != 1) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        tvProductCount = findViewById(R.id.tvProductCount);
        tvUserCount = findViewById(R.id.tvUserCount);
        tvOrderCount = findViewById(R.id.tvOrderCount);
        tvRevenueTotal = findViewById(R.id.tvRevenueTotal);
        tvCompletedCount = findViewById(R.id.tvCompletedCount);
        tvCancelledCount = findViewById(R.id.tvCancelledCount);
        tabLayout = findViewById(R.id.tabLayout);
        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        setupToolbarMenu(toolbar);

        // Add tabs
        tabLayout.addTab(tabLayout.newTab().setText("🍽️ Sản phẩm"));
        tabLayout.addTab(tabLayout.newTab().setText("👥 Users"));
        tabLayout.addTab(tabLayout.newTab().setText("📋 Đơn hàng"));

        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                Fragment fragment;
                switch (tab.getPosition()) {
                    case 1:
                        fragment = new ManageUsersFragment();
                        break;
                    case 2:
                        fragment = new ManageOrdersFragment();
                        break;
                    default:
                        fragment = new ManageProductsFragment();
                        break;
                }
                getSupportFragmentManager()
                        .beginTransaction()
                        .replace(R.id.fragment_container, fragment)
                        .commit();
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {}
            @Override
            public void onTabReselected(TabLayout.Tab tab) {}
        });

        // Default tab
        if (savedInstanceState == null) {
            getSupportFragmentManager()
                    .beginTransaction()
                    .replace(R.id.fragment_container, new ManageProductsFragment())
                    .commit();
        }

        loadStats();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadStats();
    }

    private void loadStats() {
        // Products count
        apiService.getProducts(500).enqueue(new Callback<ProductListResponse>() {
            @Override
            public void onResponse(Call<ProductListResponse> call, Response<ProductListResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    tvProductCount.setText(String.valueOf(response.body().getCount()));
                }
            }
            @Override
            public void onFailure(Call<ProductListResponse> call, Throwable t) {}
        });

        // Users count
        apiService.getAdminUsers(null, 500).enqueue(new Callback<UserListResponse>() {
            @Override
            public void onResponse(Call<UserListResponse> call, Response<UserListResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    tvUserCount.setText(String.valueOf(response.body().getCount()));
                }
            }
            @Override
            public void onFailure(Call<UserListResponse> call, Throwable t) {}
        });

        // Orders count
        apiService.getOrders(500).enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(Call<OrderListResponse> call, Response<OrderListResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    tvOrderCount.setText(String.valueOf(response.body().getCount()));
                    List<Order> items = response.body().getItems();
                    bindOrderMetrics(items != null ? items : new ArrayList<>());
                }
            }
            @Override
            public void onFailure(Call<OrderListResponse> call, Throwable t) {}
        });
    }

    private void bindOrderMetrics(List<Order> orders) {
        double revenue = 0d;
        int completed = 0;
        int cancelled = 0;

        for (Order order : orders) {
            if (Constants.STATUS_COMPLETED.equals(order.getOrderStatus())) {
                completed++;
                revenue += order.getTotalAmount();
            } else if (Constants.STATUS_CANCELLED.equals(order.getOrderStatus())) {
                cancelled++;
            }
        }

        tvRevenueTotal.setText(MoneyUtils.format(revenue));
        tvCompletedCount.setText(String.valueOf(completed));
        tvCancelledCount.setText(String.valueOf(cancelled));
    }

    private void showLogoutDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Đăng xuất")
                .setMessage("Bạn có chắc muốn đăng xuất?")
                .setPositiveButton("Có", (dialog, which) -> {
                    sessionManager.logout();
                    Intent intent = new Intent(this, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                })
                .setNegativeButton("Không", null)
                .show();
    }

    private void setupToolbarMenu(MaterialToolbar toolbar) {
        toolbar.setNavigationIcon(android.R.drawable.ic_menu_sort_by_size);
        toolbar.setNavigationContentDescription("Mở menu");
        toolbar.setNavigationOnClickListener(v -> {
            PopupMenu popupMenu = new PopupMenu(this, v);
            popupMenu.getMenuInflater().inflate(R.menu.menu_account_actions, popupMenu.getMenu());
            popupMenu.setOnMenuItemClickListener(item -> {
                if (item.getItemId() == R.id.action_logout) {
                    showLogoutDialog();
                    return true;
                }
                return false;
            });
            popupMenu.show();
        });
    }
}
