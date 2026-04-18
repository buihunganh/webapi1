package com.example.btl_adr1.ui.customer;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.CartItem;
import com.example.btl_adr1.utils.CartManager;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Màn hình thanh toán.
 * Gọi Flask API: POST /api/orders
 */
public class CheckoutActivity extends AppCompatActivity {

    private TextInputEditText etAddress, etPhone, etNotes;
    private RadioGroup rgPayment;
    private TextView tvSubtotal, tvShipping, tvTotal;
    private MaterialButton btnPlaceOrder;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SessionManager sessionManager;

    private static final double SHIPPING_FEE = 2.99;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_checkout);

        apiService = ApiClient.getApiService(this);
        sessionManager = new SessionManager(this);

        initViews();
        displayOrderSummary();

        // Back button
        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        btnPlaceOrder.setOnClickListener(v -> placeOrder());
    }

    private void initViews() {
        etAddress = findViewById(R.id.etAddress);
        etPhone = findViewById(R.id.etPhone);
        etNotes = findViewById(R.id.etNotes);
        rgPayment = findViewById(R.id.rgPayment);
        tvSubtotal = findViewById(R.id.tvSubtotal);
        tvShipping = findViewById(R.id.tvShipping);
        tvTotal = findViewById(R.id.tvTotal);
        btnPlaceOrder = findViewById(R.id.btnPlaceOrder);
        progressBar = findViewById(R.id.progressBar);

        // Pre-fill phone from session
        String phone = sessionManager.getUserPhone();
        if (phone != null && !phone.isEmpty()) {
            etPhone.setText(phone);
        }
    }

    private void displayOrderSummary() {
        CartManager cart = CartManager.getInstance();
        double subtotal = cart.getSubTotal();
        double total = subtotal + SHIPPING_FEE;

        tvSubtotal.setText(String.format(Locale.US, "$%.2f", subtotal));
        tvShipping.setText(String.format(Locale.US, "$%.2f", SHIPPING_FEE));
        tvTotal.setText(String.format(Locale.US, "$%.2f", total));
    }

    private void placeOrder() {
        String address = etAddress.getText().toString().trim();
        String phone = etPhone.getText().toString().trim();
        String notes = etNotes.getText().toString().trim();

        if (TextUtils.isEmpty(address)) {
            etAddress.setError("Vui lòng nhập địa chỉ giao hàng");
            etAddress.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(phone)) {
            etPhone.setError("Vui lòng nhập SĐT");
            etPhone.requestFocus();
            return;
        }

        // Payment method
        String paymentMethod;
        int selectedPayment = rgPayment.getCheckedRadioButtonId();
        if (selectedPayment == R.id.rbCard) paymentMethod = Constants.PAY_CARD;
        else if (selectedPayment == R.id.rbBank) paymentMethod = Constants.PAY_BANK;
        else if (selectedPayment == R.id.rbMomo) paymentMethod = Constants.PAY_MOMO;
        else paymentMethod = Constants.PAY_CASH;

        // Build order JSON matching Flask POST /api/orders
        CartManager cart = CartManager.getInstance();
        List<CartItem> items = cart.getItems();

        JsonArray itemsArray = new JsonArray();
        for (CartItem item : items) {
            JsonObject obj = new JsonObject();
            obj.addProperty("product_id", item.getProduct().getProductId());
            obj.addProperty("quantity", item.getQuantity());
            obj.addProperty("unit_price", item.getProduct().getPrice());
            itemsArray.add(obj);
        }

        JsonObject orderJson = new JsonObject();
        orderJson.addProperty("customer_id", sessionManager.getUserId());
        orderJson.addProperty("customer_name", sessionManager.getUserName());
        orderJson.add("items", itemsArray);
        orderJson.addProperty("shipping_fee", SHIPPING_FEE);
        orderJson.addProperty("delivery_phone", phone);
        orderJson.addProperty("delivery_address", address);
        orderJson.addProperty("notes", notes.isEmpty() ? null : notes);
        orderJson.addProperty("payment_method", paymentMethod);

        setLoading(true);

        apiService.createOrder(orderJson).enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    JsonObject body = response.body();
                    if (body.has("ok") && body.get("ok").getAsBoolean()) {
                        Toast.makeText(CheckoutActivity.this, "🎉 Đặt hàng thành công!", Toast.LENGTH_LONG).show();
                        cart.clearCart();
                        finish();
                    } else {
                        String error = body.has("error") ? body.get("error").getAsString() : "Đặt hàng thất bại";
                        Toast.makeText(CheckoutActivity.this, error, Toast.LENGTH_SHORT).show();
                    }
                } else {
                    Toast.makeText(CheckoutActivity.this, "Đặt hàng thất bại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<JsonObject> call, Throwable t) {
                setLoading(false);
                Toast.makeText(CheckoutActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        btnPlaceOrder.setEnabled(!loading);
    }
}
