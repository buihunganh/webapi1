package com.example.btl_adr1.ui.customer;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Order;
import com.example.btl_adr1.api.models.OrderListResponse;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.MoneyUtils;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.button.MaterialButton;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderDetailActivity extends AppCompatActivity {

    private TextView tvOrderId;
    private TextView tvStatus;
    private TextView tvOrderDate;
    private TextView tvDeliveryPhone;
    private TextView tvAddress;
    private TextView tvNotes;
    private TextView tvSubTotal;
    private TextView tvShippingFee;
    private TextView tvDiscount;
    private TextView tvTotal;
    private MaterialButton btnTrackOrder;

    private ApiService apiService;
    private SessionManager sessionManager;
    private int orderId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        apiService = ApiClient.getApiService(this);
        sessionManager = new SessionManager(this);

        orderId = getIntent().getIntExtra("order_id", 0);
        if (orderId == 0) {
            Toast.makeText(this, "Không tìm thấy đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        bindViews();
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        loadOrderDetail();
    }

    private void bindViews() {
        tvOrderId = findViewById(R.id.tvOrderId);
        tvStatus = findViewById(R.id.tvStatus);
        tvOrderDate = findViewById(R.id.tvOrderDate);
        tvDeliveryPhone = findViewById(R.id.tvDeliveryPhone);
        tvAddress = findViewById(R.id.tvAddress);
        tvNotes = findViewById(R.id.tvNotes);
        tvSubTotal = findViewById(R.id.tvSubTotal);
        tvShippingFee = findViewById(R.id.tvShippingFee);
        tvDiscount = findViewById(R.id.tvDiscount);
        tvTotal = findViewById(R.id.tvTotal);
        btnTrackOrder = findViewById(R.id.btnTrackOrder);
    }

    private void loadOrderDetail() {
        String token = sessionManager.getAuthToken();
        String authorization = (token != null && !token.trim().isEmpty()) ? "Bearer " + token.trim() : null;
        String userId = sessionManager.getUserId() > 0 ? String.valueOf(sessionManager.getUserId()) : null;
        String userEmail = sessionManager.getUserEmail();
        String userRole = sessionManager.getUserRole();

        apiService.getOrdersAuthenticated(authorization, userId, userEmail, userRole, 500).enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(Call<OrderListResponse> call, Response<OrderListResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().getItems() == null) {
                    Toast.makeText(OrderDetailActivity.this, "Không tải được chi tiết đơn hàng", Toast.LENGTH_SHORT).show();
                    return;
                }

                for (Order order : response.body().getItems()) {
                    boolean sameOrder = order.getOrderId() == orderId;
                    boolean sameUser = userEmail != null
                            && order.getCustomerEmail() != null
                            && userEmail.trim().equalsIgnoreCase(order.getCustomerEmail().trim());

                    if (sameOrder && sameUser) {
                        bindOrder(order);
                        return;
                    }
                }

                Toast.makeText(OrderDetailActivity.this, "Không tìm thấy đơn hàng", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onFailure(Call<OrderListResponse> call, Throwable t) {
                Toast.makeText(OrderDetailActivity.this, "Lỗi tải chi tiết: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void bindOrder(Order order) {
        tvOrderId.setText("Đơn #" + order.getOrderId());
        tvStatus.setText(order.getStatusDisplayName());

        String date = order.getOrderDate();
        if (date != null && date.length() > 19) {
            date = date.substring(0, 19).replace("T", " ");
        }
        tvOrderDate.setText(date != null ? date : "-");

        tvDeliveryPhone.setText(order.getDeliveryPhone() != null ? order.getDeliveryPhone() : "-");
        tvAddress.setText(order.getDeliveryAddress() != null ? order.getDeliveryAddress() : "-");
        tvNotes.setText(order.getNotes() != null && !order.getNotes().trim().isEmpty() ? order.getNotes() : "-");

        tvSubTotal.setText(MoneyUtils.format(order.getSubTotal()));
        tvShippingFee.setText(MoneyUtils.format(order.getShippingFee()));
        tvDiscount.setText(MoneyUtils.format(order.getDiscount()));
        tvTotal.setText(MoneyUtils.format(order.getTotalAmount()));

        String status = order.getOrderStatus() != null ? order.getOrderStatus() : "";
        if (Constants.STATUS_SHIPPING.equals(status) || Constants.STATUS_WAITING_SHIPPER.equals(status)) {
            btnTrackOrder.setVisibility(View.VISIBLE);
            btnTrackOrder.setOnClickListener(v -> {
                Intent intent = new Intent(OrderDetailActivity.this, OrderTrackingActivity.class);
                intent.putExtra("order_id", order.getOrderId());
                startActivity(intent);
            });
        } else {
            btnTrackOrder.setVisibility(View.GONE);
        }
    }
}
