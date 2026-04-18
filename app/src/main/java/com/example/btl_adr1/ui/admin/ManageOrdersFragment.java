package com.example.btl_adr1.ui.admin;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.AdminOrderAdapter;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Order;
import com.example.btl_adr1.api.models.OrderListResponse;
import com.example.btl_adr1.utils.Constants;
import com.google.android.material.chip.ChipGroup;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Fragment quản lý đơn hàng cho Admin.
 * GET /api/orders + POST /api/orders/{id}/status
 */
public class ManageOrdersFragment extends Fragment {

    private RecyclerView rvOrders;
    private SwipeRefreshLayout swipeRefresh;
    private ChipGroup chipGroupStatus;
    private AdminOrderAdapter adapter;
    private ApiService apiService;
    private List<Order> allOrders = new ArrayList<>();
    private String selectedStatus = "all";

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_manage_orders, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getApiService(requireContext());

        rvOrders = view.findViewById(R.id.rvOrders);
        swipeRefresh = view.findViewById(R.id.swipeRefresh);
        chipGroupStatus = view.findViewById(R.id.chipGroupStatus);

        adapter = new AdminOrderAdapter(new ArrayList<>(), order -> showStatusUpdateDialog(order));

        rvOrders.setLayoutManager(new LinearLayoutManager(requireContext()));
        rvOrders.setAdapter(adapter);

        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadOrders);

        chipGroupStatus.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty() || checkedIds.get(0) == R.id.chipAll) {
                selectedStatus = "all";
            } else if (checkedIds.get(0) == R.id.chipPending) {
                selectedStatus = Constants.STATUS_PENDING;
            } else if (checkedIds.get(0) == R.id.chipWaiting) {
                selectedStatus = Constants.STATUS_WAITING_SHIPPER;
            } else if (checkedIds.get(0) == R.id.chipShipping) {
                selectedStatus = Constants.STATUS_SHIPPING;
            } else if (checkedIds.get(0) == R.id.chipCompleted) {
                selectedStatus = Constants.STATUS_COMPLETED;
            } else if (checkedIds.get(0) == R.id.chipCancelled) {
                selectedStatus = Constants.STATUS_CANCELLED;
            }
            filterOrders();
        });

        loadOrders();
    }

    private void loadOrders() {
        swipeRefresh.setRefreshing(true);

        apiService.getOrders(500).enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(Call<OrderListResponse> call, Response<OrderListResponse> response) {
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<Order> items = response.body().getItems();
                    allOrders = items != null ? items : new ArrayList<>();
                    filterOrders();
                }
            }

            @Override
            public void onFailure(Call<OrderListResponse> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(requireContext(), "Lỗi tải đơn hàng", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void filterOrders() {
        List<Order> filtered = new ArrayList<>();
        for (Order o : allOrders) {
            if ("all".equals(selectedStatus) || selectedStatus.equals(o.getOrderStatus())) {
                filtered.add(o);
            }
        }
        adapter.updateList(filtered);
    }

    private void showStatusUpdateDialog(Order order) {
        String[] statuses = {"pending", "waiting_for_shipper", "shipping", "completed", "cancelled"};
        String[] displayNames = {"⏳ Chờ xác nhận", "🔍 Chờ shipper", "🚀 Đang giao", "✅ Hoàn thành", "❌ Đã hủy"};

        // Find current index
        int currentIndex = 0;
        for (int i = 0; i < statuses.length; i++) {
            if (statuses[i].equals(order.getOrderStatus())) {
                currentIndex = i;
                break;
            }
        }

        final int[] selectedIndex = {currentIndex};

        new AlertDialog.Builder(requireContext())
                .setTitle("Đơn #" + order.getOrderId() + " — Cập nhật trạng thái")
                .setSingleChoiceItems(displayNames, currentIndex, (dialog, which) -> {
                    selectedIndex[0] = which;
                })
                .setPositiveButton("Cập nhật", (dialog, which) -> {
                    String newStatus = statuses[selectedIndex[0]];
                    JsonObject json = new JsonObject();
                    json.addProperty("status", newStatus);

                    // Yêu cầu backend cập nhật tồn kho khi đơn chuyển sang hoàn thành.
                    if (Constants.STATUS_COMPLETED.equals(newStatus)
                            && !Constants.STATUS_COMPLETED.equals(order.getOrderStatus())) {
                        json.addProperty("update_stock", true);
                    }

                    apiService.updateOrderStatus(order.getOrderId(), json).enqueue(new Callback<JsonObject>() {
                        @Override
                        public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                            Toast.makeText(requireContext(), "Đã cập nhật trạng thái!", Toast.LENGTH_SHORT).show();
                            loadOrders();
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
