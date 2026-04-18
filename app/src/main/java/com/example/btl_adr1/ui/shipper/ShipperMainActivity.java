package com.example.btl_adr1.ui.shipper;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.ShipperOrderAdapter;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Order;
import com.example.btl_adr1.api.models.OrderListResponse;
import com.example.btl_adr1.ui.auth.LoginActivity;
import com.example.btl_adr1.utils.CartManager;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.MoneyUtils;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.chip.ChipGroup;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.text.SimpleDateFormat;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Shipper workspace.
 * Hiển thị đơn chờ nhận + đơn đang giao + đơn đã hoàn thành.
 * API: GET /api/orders, POST /api/orders/{id}/status
 */
public class ShipperMainActivity extends AppCompatActivity {

    private RecyclerView rvOrders;
    private SwipeRefreshLayout swipeRefresh;
    private LinearLayout emptyState;
    private ChipGroup chipGroupStatus;
    private TextView tvShipperEarning;
    private TextView tvShipperActive;
    private TextView tvShipperDoneToday;
    private ShipperOrderAdapter adapter;
    private ApiService apiService;
    private SessionManager sessionManager;

    private List<Order> allOrders = new ArrayList<>();
    private String currentFilter = "waiting"; // waiting, my, completed

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_shipper_main);

        apiService = ApiClient.getApiService(this);
        sessionManager = new SessionManager(this);

        rvOrders = findViewById(R.id.rvOrders);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        emptyState = findViewById(R.id.emptyState);
        chipGroupStatus = findViewById(R.id.chipGroupStatus);
        tvShipperEarning = findViewById(R.id.tvShipperEarning);
        tvShipperActive = findViewById(R.id.tvShipperActive);
        tvShipperDoneToday = findViewById(R.id.tvShipperDoneToday);
        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        setupToolbarMenu(toolbar);

        adapter = new ShipperOrderAdapter(new ArrayList<>(), sessionManager.getUserId(),
                new ShipperOrderAdapter.OnShipperActionListener() {
                    @Override
                    public void onAcceptOrder(Order order) {
                        acceptOrder(order);
                    }

                    @Override
                    public void onPickupOrder(Order order) {
                        pickupOrder(order);
                    }
                });

        rvOrders.setLayoutManager(new LinearLayoutManager(this));
        rvOrders.setAdapter(adapter);

        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadOrders);

        chipGroupStatus.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (!checkedIds.isEmpty()) {
                int id = checkedIds.get(0);
                if (id == R.id.chipWaiting) currentFilter = "waiting";
                else if (id == R.id.chipMyOrders) currentFilter = "my";
                else if (id == R.id.chipCompleted) currentFilter = "completed";
            }
            filterOrders();
        });

        loadOrders();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadOrders();
    }

    private void loadOrders() {
        swipeRefresh.setRefreshing(true);

        apiService.getOrders(500)
                .enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(Call<OrderListResponse> call, Response<OrderListResponse> response) {
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<Order> items = response.body().getItems();
                    allOrders = items != null ? items : new ArrayList<>();
                    updateOverviewStats();
                    filterOrders();
                } else if (response.code() == 401) {
                    sessionManager.logout();
                    Toast.makeText(ShipperMainActivity.this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_LONG).show();
                    Intent intent = new Intent(ShipperMainActivity.this, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                } else {
                    Toast.makeText(ShipperMainActivity.this, "Không tải được đơn hàng (HTTP " + response.code() + ")", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<OrderListResponse> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(ShipperMainActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
                updateOverviewStats();
            }
        });
    }

    private void updateOverviewStats() {
        int myId = sessionManager.getUserId();
        int activeCount = 0;
        int doneToday = 0;
        double totalEarning = 0d;
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

        for (Order order : allOrders) {
            if (order.getShipperId() == null || order.getShipperId() != myId) {
                continue;
            }

            String status = order.getOrderStatus();
            if (Constants.STATUS_WAITING_SHIPPER.equals(status) || Constants.STATUS_SHIPPING.equals(status)) {
                activeCount++;
            }

            if (Constants.STATUS_COMPLETED.equals(status)) {
                doneToday += isToday(order.getDeliveredDate(), today) || isToday(order.getOrderDate(), today) ? 1 : 0;
                totalEarning += order.getShippingFee();
            }
        }

        tvShipperEarning.setText(MoneyUtils.format(totalEarning));
        tvShipperActive.setText(String.valueOf(activeCount));
        tvShipperDoneToday.setText(String.valueOf(doneToday));
    }

    private boolean isToday(String value, String today) {
        return value != null && value.startsWith(today);
    }

    private void filterOrders() {
        int myId = sessionManager.getUserId();
        List<Order> filtered = new ArrayList<>();

        for (Order o : allOrders) {
            switch (currentFilter) {
                case "waiting":
                    if (Constants.STATUS_PENDING.equals(o.getOrderStatus())) {
                        filtered.add(o);
                    }
                    break;
                case "my":
                    if (o.getShipperId() != null && o.getShipperId() == myId
                            && (Constants.STATUS_WAITING_SHIPPER.equals(o.getOrderStatus())
                            || Constants.STATUS_SHIPPING.equals(o.getOrderStatus()))) {
                        filtered.add(o);
                    }
                    break;
                case "completed":
                    if (o.getShipperId() != null && o.getShipperId() == myId
                            && Constants.STATUS_COMPLETED.equals(o.getOrderStatus())) {
                        filtered.add(o);
                    }
                    break;
            }
        }

        adapter.updateList(filtered);

        if (filtered.isEmpty()) {
            rvOrders.setVisibility(View.GONE);
            emptyState.setVisibility(View.VISIBLE);
        } else {
            rvOrders.setVisibility(View.VISIBLE);
            emptyState.setVisibility(View.GONE);
        }
    }

    private void acceptOrder(Order order) {
        JsonObject json = new JsonObject();
        json.addProperty("status", Constants.STATUS_WAITING_SHIPPER);
        json.addProperty("shipper_id", sessionManager.getUserId());

        apiService.updateOrderStatus(order.getOrderId(), json)
                .enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(ShipperMainActivity.this, "✅ Đã nhận đơn #" + order.getOrderId(), Toast.LENGTH_SHORT).show();
                    loadOrders();
                } else {
                    Toast.makeText(ShipperMainActivity.this, "Nhận đơn thất bại (HTTP " + response.code() + ")", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<JsonObject> call, Throwable t) {
                Toast.makeText(ShipperMainActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void pickupOrder(Order order) {
        JsonObject json = new JsonObject();
        json.addProperty("status", Constants.STATUS_SHIPPING);
        json.addProperty("shipper_id", sessionManager.getUserId());

        apiService.updateOrderStatus(order.getOrderId(), json)
                .enqueue(new Callback<JsonObject>() {
                    @Override
                    public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                        if (response.isSuccessful()) {
                            Toast.makeText(ShipperMainActivity.this, "📦 Đã lấy hàng cho đơn #" + order.getOrderId(), Toast.LENGTH_SHORT).show();
                            loadOrders();
                        } else {
                            Toast.makeText(ShipperMainActivity.this, "Cập nhật thất bại (HTTP " + response.code() + ")", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<JsonObject> call, Throwable t) {
                        Toast.makeText(ShipperMainActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void completeOrder(Order order) {
        new AlertDialog.Builder(this)
                .setTitle("Hoàn thành đơn #" + order.getOrderId())
                .setMessage("Xác nhận đã giao hàng thành công?")
                .setPositiveButton("Đã giao", (d, w) -> {
                    JsonObject json = new JsonObject();
                    json.addProperty("status", Constants.STATUS_COMPLETED);
                    json.addProperty("update_stock", true);

                    apiService.updateOrderStatus(order.getOrderId(), json)
                            .enqueue(new Callback<JsonObject>() {
                        @Override
                        public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                            if (response.isSuccessful()) {
                                Toast.makeText(ShipperMainActivity.this, "🎉 Giao hàng thành công!", Toast.LENGTH_SHORT).show();
                                loadOrders();
                            } else {
                                Toast.makeText(ShipperMainActivity.this, "Cập nhật thất bại (HTTP " + response.code() + ")", Toast.LENGTH_SHORT).show();
                            }
                        }

                        @Override
                        public void onFailure(Call<JsonObject> call, Throwable t) {
                            Toast.makeText(ShipperMainActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void showLogoutDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Đăng xuất")
                .setMessage("Bạn có chắc muốn đăng xuất?")
                .setPositiveButton("Có", (d, w) -> {
                    sessionManager.logout();
                    CartManager.getInstance().clearCart();
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
