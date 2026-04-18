package com.example.btl_adr1.ui.customer;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.OrderAdapter;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Order;
import com.example.btl_adr1.api.models.OrderListResponse;
import com.example.btl_adr1.ui.auth.LoginActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.chip.ChipGroup;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Fragment lịch sử đơn hàng.
 * Gọi Flask API: GET /api/orders
 */
public class OrdersFragment extends Fragment {

    private RecyclerView rvOrders;
    private SwipeRefreshLayout swipeRefresh;
    private LinearLayout emptyState;
    private ChipGroup chipGroupStatus;
    private OrderAdapter adapter;
    private ApiService apiService;
    private SessionManager sessionManager;
    private String currentUserEmail;

    private List<Order> allOrders = new ArrayList<>();
    private String selectedStatus = "all";

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_orders, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getApiService(requireContext());
        sessionManager = new SessionManager(requireContext());
        currentUserEmail = sessionManager.getUserEmail() != null
            ? sessionManager.getUserEmail().trim()
            : "";

        rvOrders = view.findViewById(R.id.rvOrders);
        swipeRefresh = view.findViewById(R.id.swipeRefresh);
        emptyState = view.findViewById(R.id.emptyState);
        chipGroupStatus = view.findViewById(R.id.chipGroupStatus);

        adapter = new OrderAdapter(new ArrayList<>());
        rvOrders.setLayoutManager(new LinearLayoutManager(requireContext()));
        rvOrders.setAdapter(adapter);

        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadOrders);

        // Status filter
        chipGroupStatus.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty()) {
                selectedStatus = "all";
            } else {
                int id = checkedIds.get(0);
                if (id == R.id.chipStatusAll) selectedStatus = "all";
                else if (id == R.id.chipStatusPending) selectedStatus = "pending";
                else if (id == R.id.chipStatusShipping) selectedStatus = "shipping";
                else if (id == R.id.chipStatusCompleted) selectedStatus = "completed";
            }
            filterOrders();
        });

        loadOrders();
    }

    private void loadOrders() {
        swipeRefresh.setRefreshing(true);

        String token = sessionManager.getAuthToken();
        String authorization = (token != null && !token.trim().isEmpty()) ? "Bearer " + token.trim() : null;
        String userId = sessionManager.getUserId() > 0 ? String.valueOf(sessionManager.getUserId()) : null;
        String userRole = sessionManager.getUserRole();

        // Gửi đầy đủ ngữ cảnh xác thực để tương thích backend đang yêu cầu auth.
        apiService.getOrdersAuthenticated(
                authorization,
                userId,
                currentUserEmail,
                userRole,
                100
        ).enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(Call<OrderListResponse> call, Response<OrderListResponse> response) {
                swipeRefresh.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    List<Order> items = response.body().getItems();
                    allOrders = items != null ? items : new ArrayList<>();
                    filterOrders();
                } else if (response.code() == 401) {
                    sessionManager.logout();
                    Toast.makeText(requireContext(), "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_LONG).show();
                    startActivity(new android.content.Intent(requireContext(), LoginActivity.class)
                            .setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK));
                } else {
                    Toast.makeText(requireContext(), "Không thể tải đơn hàng (HTTP " + response.code() + ")", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<OrderListResponse> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                String detail = t.getMessage() != null ? t.getMessage() : "unknown";
                Toast.makeText(requireContext(), "Lỗi kết nối tới " + Constants.BASE_URL + "\n" + detail, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void filterOrders() {
        List<Order> filtered = new ArrayList<>();

        // Không có email session hợp lệ => coi như chưa có dữ liệu đơn của user hiện tại
        if (currentUserEmail.isEmpty()) {
            adapter.updateList(filtered);
            rvOrders.setVisibility(View.GONE);
            emptyState.setVisibility(View.VISIBLE);
            return;
        }

        for (Order o : allOrders) {
            String orderCustomerEmail = o.getCustomerEmail();
            boolean matchByEmail = currentUserEmail != null
                    && orderCustomerEmail != null
                    && currentUserEmail.equalsIgnoreCase(orderCustomerEmail.trim());

            if (!matchByEmail) {
                continue;
            }

            if ("all".equals(selectedStatus) || selectedStatus.equals(o.getOrderStatus())) {
                filtered.add(o);
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
}
