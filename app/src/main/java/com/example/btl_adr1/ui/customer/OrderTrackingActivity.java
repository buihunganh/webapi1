package com.example.btl_adr1.ui.customer;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.LinearLayout;
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
import com.mapbox.geojson.Point;
import com.mapbox.maps.CameraOptions;
import com.mapbox.maps.MapView;
import com.mapbox.maps.Style;
import com.mapbox.maps.plugin.annotation.AnnotationPlugin;
import com.mapbox.maps.plugin.annotation.AnnotationsUtils;
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationManager;
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationManagerKt;
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Customer: Theo dõi đơn hàng đang giao trên bản đồ Mapbox.
 * Hiển thị vị trí giao hàng + vị trí shipper real-time.
 * Poll API mỗi 10 giây để cập nhật vị trí shipper.
 */
public class OrderTrackingActivity extends AppCompatActivity {

    private MapView mapView;
    private TextView tvTitle, tvOrderStatus, tvOrderId, tvStatusBadge;
    private TextView tvDeliveryPhone, tvTotalAmount, tvShipperName;
    private LinearLayout layoutShipperInfo;

    private ApiService apiService;
    private SessionManager sessionManager;
    private int orderId;
    private Handler handler;
    private Runnable pollRunnable;
    private PointAnnotationManager pointAnnotationManager;
    private Bitmap deliveryMarkerIcon;
    private Bitmap shipperMarkerIcon;

    private static final long POLL_INTERVAL = 10_000; // 10 giây

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_tracking);

        apiService = ApiClient.getApiService(this);
        sessionManager = new SessionManager(this);
        handler = new Handler(Looper.getMainLooper());

        orderId = getIntent().getIntExtra("order_id", 0);
        if (orderId == 0) {
            Toast.makeText(this, "Không tìm thấy đơn hàng!", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Bind views
        tvTitle = findViewById(R.id.tvTitle);
        tvOrderStatus = findViewById(R.id.tvOrderStatus);
        tvOrderId = findViewById(R.id.tvOrderId);
        tvStatusBadge = findViewById(R.id.tvStatusBadge);
        tvDeliveryPhone = findViewById(R.id.tvDeliveryPhone);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvShipperName = findViewById(R.id.tvShipperName);
        layoutShipperInfo = findViewById(R.id.layoutShipperInfo);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.fabRefresh).setOnClickListener(v -> loadOrderData());

        // Setup Mapbox
        mapView = findViewById(R.id.mapView);
        mapView.getMapboxMap().loadStyle(Style.MAPBOX_STREETS, style -> {
            AnnotationPlugin annotationPlugin = AnnotationsUtils.getAnnotations(mapView);
            pointAnnotationManager = PointAnnotationManagerKt.createPointAnnotationManager(annotationPlugin, null);
            loadOrderData();
        });

        // Start polling
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                loadOrderData();
                handler.postDelayed(this, POLL_INTERVAL);
            }
        };
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.postDelayed(pollRunnable, POLL_INTERVAL);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(pollRunnable);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (deliveryMarkerIcon != null) {
            deliveryMarkerIcon.recycle();
            deliveryMarkerIcon = null;
        }
        if (shipperMarkerIcon != null) {
            shipperMarkerIcon.recycle();
            shipperMarkerIcon = null;
        }
    }

    private void loadOrderData() {
        String token = sessionManager.getAuthToken();
        String authorization = (token != null && !token.trim().isEmpty()) ? "Bearer " + token.trim() : null;
        String userId = sessionManager.getUserId() > 0 ? String.valueOf(sessionManager.getUserId()) : null;
        String userEmail = sessionManager.getUserEmail();
        String userRole = sessionManager.getUserRole();

        apiService.getOrdersAuthenticated(authorization, userId, userEmail, userRole, 500)
                .enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(Call<OrderListResponse> call, Response<OrderListResponse> response) {
                if (response.isSuccessful() && response.body() != null && response.body().getItems() != null) {
                    for (Order order : response.body().getItems()) {
                        if (order.getOrderId() == orderId) {
                            updateUI(order);
                            updateMap(order);
                            return;
                        }
                    }
                } else if (response.code() == 401) {
                    Toast.makeText(OrderTrackingActivity.this, "Phiên đăng nhập đã hết hạn", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<OrderListResponse> call, Throwable t) {
                Toast.makeText(OrderTrackingActivity.this, "Lỗi kết nối!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateUI(Order order) {
        tvTitle.setText("📍 Đơn hàng #" + order.getOrderId());
        tvOrderId.setText("Đơn #" + order.getOrderId());
        tvStatusBadge.setText(order.getStatusDisplayName());

        // Status badge color
        int statusColor;
        switch (order.getOrderStatus() != null ? order.getOrderStatus() : "") {
            case "pending":
                statusColor = getResources().getColor(R.color.status_pending, null);
                break;
            case "waiting_for_shipper":
                statusColor = getResources().getColor(R.color.status_waiting, null);
                break;
            case "shipping":
                statusColor = getResources().getColor(R.color.status_shipping, null);
                break;
            case "completed":
                statusColor = getResources().getColor(R.color.status_completed, null);
                break;
            case "cancelled":
                statusColor = getResources().getColor(R.color.status_cancelled, null);
                break;
            default:
                statusColor = getResources().getColor(R.color.text_secondary, null);
        }
        if (tvStatusBadge.getBackground() != null) {
            tvStatusBadge.getBackground().setTint(statusColor);
        }
        tvOrderStatus.setText(order.getStatusDisplayName());
        if (tvOrderStatus.getBackground() != null) {
            tvOrderStatus.getBackground().setTint(statusColor);
        }

        // Order info
        if (order.getDeliveryPhone() != null) {
            tvDeliveryPhone.setText(order.getDeliveryPhone());
        }

        tvTotalAmount.setText(MoneyUtils.format(order.getTotalAmount()));

        // Shipper info
        if (order.getShipperId() != null && order.getShipperId() > 0) {
            layoutShipperInfo.setVisibility(View.VISIBLE);
            tvShipperName.setText("ID: " + order.getShipperId());
        }
    }

    private void updateMap(Order order) {
        if (pointAnnotationManager == null) return;

        pointAnnotationManager.deleteAll();

        boolean hasDeliveryLocation = order.getLatitude() != null && order.getLongitude() != null
                && order.getLatitude() != 0 && order.getLongitude() != 0;
        boolean hasShipperLocation = order.getShipperLat() != null && order.getShipperLng() != null
                && order.getShipperLat() != 0 && order.getShipperLng() != 0;

        // Marker cho vị trí giao hàng (đỏ)
        if (hasDeliveryLocation) {
            if (deliveryMarkerIcon == null) {
                deliveryMarkerIcon = createMarkerBitmap(Color.parseColor("#E53935"), "📍");
            }
            PointAnnotationOptions deliveryOptions = new PointAnnotationOptions()
                    .withPoint(Point.fromLngLat(order.getLongitude(), order.getLatitude()))
                    .withIconImage(deliveryMarkerIcon)
                    .withTextField("Giao hàng");
            pointAnnotationManager.create(deliveryOptions);
        }

        // Marker cho shipper (tím)
        if (hasShipperLocation) {
            if (shipperMarkerIcon == null) {
                shipperMarkerIcon = createMarkerBitmap(Color.parseColor("#7E57C2"), "🛵");
            }
            PointAnnotationOptions shipperOptions = new PointAnnotationOptions()
                    .withPoint(Point.fromLngLat(order.getShipperLng(), order.getShipperLat()))
                    .withIconImage(shipperMarkerIcon)
                    .withTextField("Shipper");
            pointAnnotationManager.create(shipperOptions);
        }

        // Camera: ưu tiên shipper > delivery > Hà Nội default
        Point cameraTarget;
        if (hasShipperLocation) {
            cameraTarget = Point.fromLngLat(order.getShipperLng(), order.getShipperLat());
        } else if (hasDeliveryLocation) {
            cameraTarget = Point.fromLngLat(order.getLongitude(), order.getLatitude());
        } else {
            cameraTarget = Point.fromLngLat(106.6297, 10.8231); // HCM default
        }

        mapView.getMapboxMap().setCamera(
                new CameraOptions.Builder()
                        .center(cameraTarget)
                        .zoom(14.0)
                        .build()
        );
    }

    /**
     * Tạo bitmap marker tùy chỉnh với emoji
     */
    private Bitmap createMarkerBitmap(int color, String emoji) {
        int size = 80;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // Vẽ circle
        Paint circlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        circlePaint.setColor(color);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4, circlePaint);

        // Viền trắng
        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setColor(Color.WHITE);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(4);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4, borderPaint);

        // Emoji text
        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTextSize(36);
        textPaint.setTextAlign(Paint.Align.CENTER);
        float y = size / 2f - (textPaint.descent() + textPaint.ascent()) / 2;
        canvas.drawText(emoji, size / 2f, y, textPaint);

        return bitmap;
    }
}
