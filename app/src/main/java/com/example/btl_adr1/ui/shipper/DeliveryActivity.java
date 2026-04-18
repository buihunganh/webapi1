package com.example.btl_adr1.ui.shipper;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.location.Address;
import android.location.Geocoder;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.MoneyUtils;
import com.example.btl_adr1.utils.SessionManager;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mapbox.geojson.LineString;
import com.mapbox.geojson.Point;
import com.mapbox.maps.CameraOptions;
import com.mapbox.maps.MapView;
import com.mapbox.maps.Style;
import com.mapbox.maps.plugin.annotation.AnnotationPlugin;
import com.mapbox.maps.plugin.annotation.AnnotationsUtils;
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationManager;
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationManagerKt;
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions;
import com.mapbox.maps.plugin.annotation.generated.PolylineAnnotationManager;
import com.mapbox.maps.plugin.annotation.generated.PolylineAnnotationManagerKt;
import com.mapbox.maps.plugin.annotation.generated.PolylineAnnotationOptions;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.ResponseBody;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Shipper: Màn hình giao hàng với Mapbox map.
 * - Hiển thị vị trí giao hàng (customer) + vị trí shipper (GPS)
 * - Cập nhật GPS location lên server mỗi 5 giây
 * - API: POST /api/orders/{id}/location
 * - Nút hoàn thành giao hàng → POST /api/orders/{id}/status
 */
public class DeliveryActivity extends AppCompatActivity {

    private MapView mapView;
    private TextView tvTitle, tvOrderId, tvDeliveryAddress, tvDeliveryPhone, tvTotalAmount, tvNotes;
    private ApiService apiService;
    private SessionManager sessionManager;

    private int orderId;
    private double deliveryLat, deliveryLng;
    private double currentLat, currentLng;
    private String deliveryAddress;
    private String deliveryPhone;
    private String notes;
    private double totalAmount;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Handler handler;
    private Runnable uploadRunnable;
    private PointAnnotationManager pointAnnotationManager;
    private PolylineAnnotationManager polylineAnnotationManager;
    private boolean isLocationUpdatesStarted = false;
    private boolean routeRequested = false;
    private Bitmap deliveryMarkerIcon;
    private Bitmap shipperMarkerIcon;
    private Bitmap storeMarkerIcon;
    private final OkHttpClient directionsClient = new OkHttpClient();

    private static final long LOCATION_INTERVAL = 5_000; // 5 giây
    private static final long UPLOAD_INTERVAL = 5_000; // 5 giây upload lên server
    private static final double STORE_LAT = 51.5033;
    private static final double STORE_LNG = -0.1182;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean fine = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false);
                if (Boolean.TRUE.equals(fine)) {
                    startLocationUpdates();
                } else {
                    Toast.makeText(this, "Cần quyền vị trí để theo dõi giao hàng!", Toast.LENGTH_LONG).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delivery);

        apiService = ApiClient.getApiService(this);
        sessionManager = new SessionManager(this);
        handler = new Handler(Looper.getMainLooper());
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        // Get intent data
        orderId = getIntent().getIntExtra("order_id", 0);
        deliveryLat = getIntent().getDoubleExtra("delivery_lat", 0);
        deliveryLng = getIntent().getDoubleExtra("delivery_lng", 0);
        deliveryAddress = getIntent().getStringExtra("delivery_address");
        deliveryPhone = getIntent().getStringExtra("delivery_phone");
        notes = getIntent().getStringExtra("notes");
        totalAmount = getIntent().getDoubleExtra("total_amount", 0);

        if (orderId == 0) {
            Toast.makeText(this, "Không tìm thấy đơn hàng!", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Bind views
        tvTitle = findViewById(R.id.tvTitle);
        tvOrderId = findViewById(R.id.tvOrderId);
        tvDeliveryAddress = findViewById(R.id.tvDeliveryAddress);
        tvDeliveryPhone = findViewById(R.id.tvDeliveryPhone);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvNotes = findViewById(R.id.tvNotes);

        tvTitle.setText("🛵 Giao đơn #" + orderId);
        tvOrderId.setText("#" + orderId);

        if (deliveryPhone != null && !deliveryPhone.isEmpty()) {
            tvDeliveryPhone.setText(deliveryPhone);
        } else {
            tvDeliveryPhone.setText("N/A");
        }

        tvTotalAmount.setText(MoneyUtils.format(totalAmount));

        if (notes != null && !notes.isEmpty()) {
            tvNotes.setVisibility(View.VISIBLE);
            tvNotes.setText("📝 " + notes);
        }

        if (deliveryAddress != null && !deliveryAddress.trim().isEmpty()) {
            tvDeliveryAddress.setText(deliveryAddress.trim());
        } else if (hasDeliveryCoordinates()) {
            tvDeliveryAddress.setText(String.format(Locale.US, "Lat: %.5f, Lng: %.5f", deliveryLat, deliveryLng));
        } else {
            tvDeliveryAddress.setText("Không có tọa độ giao hàng");
        }

        // Back button
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        // Complete delivery
        findViewById(R.id.btnCompleteDelivery).setOnClickListener(v -> completeDelivery());

        // Open Mapbox route guidance
        findViewById(R.id.btnOpenNavigation).setOnClickListener(v -> requestMapboxRoute(true));

        // My location FAB
        findViewById(R.id.fabMyLocation).setOnClickListener(v -> {
            if (currentLat != 0 && currentLng != 0) {
                mapView.getMapboxMap().setCamera(
                        new CameraOptions.Builder()
                                .center(Point.fromLngLat(currentLng, currentLat))
                                .zoom(16.0)
                                .build()
                );
            }
        });

        // Setup Mapbox
        mapView = findViewById(R.id.mapView);
        mapView.getMapboxMap().loadStyle(Style.MAPBOX_STREETS, style -> {
            AnnotationPlugin annotationPlugin = AnnotationsUtils.getAnnotations(mapView);
            pointAnnotationManager = PointAnnotationManagerKt.createPointAnnotationManager(annotationPlugin, null);
            polylineAnnotationManager = PolylineAnnotationManagerKt.createPolylineAnnotationManager(annotationPlugin, null);

            addStoreMarker();

            // Add delivery location marker
            if (hasDeliveryCoordinates()) {
                addDeliveryMarker();
            } else {
                resolveDeliveryCoordinatesFromAddress();
            }

            // Request location permission
            checkAndRequestLocationPermission();
        });

        // Upload location to server periodically
        uploadRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentLat != 0 && currentLng != 0) {
                    uploadLocation(currentLat, currentLng);
                }
                handler.postDelayed(this, UPLOAD_INTERVAL);
            }
        };
    }

    private void checkAndRequestLocationPermission() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startLocationUpdates();
        } else {
            locationPermissionLauncher.launch(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            });
        }
    }

    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (isLocationUpdatesStarted) {
            return;
        }

        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL)
                .setMinUpdateIntervalMillis(3000)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult locationResult) {
                if (locationResult.getLastLocation() != null) {
                    currentLat = locationResult.getLastLocation().getLatitude();
                    currentLng = locationResult.getLastLocation().getLongitude();
                    updateShipperMarker();
                    if (!routeRequested && hasDeliveryCoordinates()) {
                        requestMapboxRoute(false);
                    }
                }
            }
        };

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
        isLocationUpdatesStarted = true;

        // Start uploading location
        handler.removeCallbacks(uploadRunnable);
        handler.postDelayed(uploadRunnable, UPLOAD_INTERVAL);
    }

    private void addDeliveryMarker() {
        if (pointAnnotationManager == null) return;

        if (deliveryMarkerIcon == null) {
            deliveryMarkerIcon = createMarkerBitmap(Color.parseColor("#E53935"), "📍");
        }
        PointAnnotationOptions options = new PointAnnotationOptions()
                .withPoint(Point.fromLngLat(deliveryLng, deliveryLat))
            .withIconImage(deliveryMarkerIcon)
                .withTextField("Giao tại đây");
        pointAnnotationManager.create(options);

        // Camera focus
        mapView.getMapboxMap().setCamera(
                new CameraOptions.Builder()
                        .center(Point.fromLngLat(deliveryLng, deliveryLat))
                        .zoom(14.0)
                        .build()
        );
    }

    private void addStoreMarker() {
        if (pointAnnotationManager == null) return;

        if (storeMarkerIcon == null) {
            storeMarkerIcon = createMarkerBitmap(Color.parseColor("#00897B"), "🏪");
        }

        PointAnnotationOptions storeOptions = new PointAnnotationOptions()
                .withPoint(Point.fromLngLat(STORE_LNG, STORE_LAT))
                .withIconImage(storeMarkerIcon)
                .withTextField("Cửa hàng");
        pointAnnotationManager.create(storeOptions);
    }

    private boolean hasDeliveryCoordinates() {
        return deliveryLat != 0d && deliveryLng != 0d;
    }

    private void resolveDeliveryCoordinatesFromAddress() {
        if (hasDeliveryCoordinates()) {
            return;
        }
        if (deliveryAddress == null || deliveryAddress.trim().isEmpty()) {
            return;
        }
        if (!Geocoder.isPresent()) {
            return;
        }

        new Thread(() -> {
            try {
                Geocoder geocoder = new Geocoder(this, Locale.getDefault());
                List<Address> results = geocoder.getFromLocationName(deliveryAddress, 1);
                if (results != null && !results.isEmpty()) {
                    Address first = results.get(0);
                    if (first.hasLatitude() && first.hasLongitude()) {
                        double lat = first.getLatitude();
                        double lng = first.getLongitude();
                        runOnUiThread(() -> {
                            deliveryLat = lat;
                            deliveryLng = lng;
                            if (deliveryAddress != null && !deliveryAddress.trim().isEmpty()) {
                                tvDeliveryAddress.setText(deliveryAddress.trim());
                            } else {
                                tvDeliveryAddress.setText(String.format(Locale.US, "Lat: %.5f, Lng: %.5f", lat, lng));
                            }
                            addDeliveryMarker();
                            Toast.makeText(this, "Đã suy ra tọa độ từ địa chỉ giao hàng", Toast.LENGTH_SHORT).show();
                        });
                    }
                }
            } catch (IOException ignored) {
                // Keep UI fallback text when geocoder cannot resolve.
            }
        }).start();
    }

    private void updateShipperMarker() {
        if (pointAnnotationManager == null || currentLat == 0) return;

        // Clear and re-add all markers
        pointAnnotationManager.deleteAll();

        // Re-add store marker
        addStoreMarker();

        // Re-add delivery marker
        if (deliveryLat != 0 && deliveryLng != 0) {
            if (deliveryMarkerIcon == null) {
                deliveryMarkerIcon = createMarkerBitmap(Color.parseColor("#E53935"), "📍");
            }
            PointAnnotationOptions deliveryOptions = new PointAnnotationOptions()
                    .withPoint(Point.fromLngLat(deliveryLng, deliveryLat))
                    .withIconImage(deliveryMarkerIcon);
            pointAnnotationManager.create(deliveryOptions);
        }

        // Add shipper marker
        if (shipperMarkerIcon == null) {
            shipperMarkerIcon = createMarkerBitmap(Color.parseColor("#7E57C2"), "🛵");
        }
        PointAnnotationOptions shipperOptions = new PointAnnotationOptions()
                .withPoint(Point.fromLngLat(currentLng, currentLat))
                .withIconImage(shipperMarkerIcon);
        pointAnnotationManager.create(shipperOptions);
    }

    private void uploadLocation(double lat, double lng) {
        JsonObject json = new JsonObject();
        json.addProperty("lat", lat);
        json.addProperty("lng", lng);

        String token = sessionManager.getAuthToken();
        String authorization = (token != null && !token.trim().isEmpty()) ? "Bearer " + token.trim() : null;
        String userId = sessionManager.getUserId() > 0 ? String.valueOf(sessionManager.getUserId()) : null;
        String userEmail = sessionManager.getUserEmail();
        String userRole = sessionManager.getUserRole();

        apiService.updateShipperLocationAuthenticated(orderId, authorization, userId, userEmail, userRole, json)
                .enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                // Silent - no need to notify user
            }

            @Override
            public void onFailure(Call<JsonObject> call, Throwable t) {
                // Silent fail - will retry next interval
            }
        });
    }

    private void completeDelivery() {
        new AlertDialog.Builder(this)
                .setTitle("🎉 Hoàn thành giao hàng")
                .setMessage("Xác nhận đã giao hàng thành công đơn #" + orderId + "?")
                .setPositiveButton("Đã giao", (d, w) -> {
                    JsonObject json = new JsonObject();
                    json.addProperty("status", Constants.STATUS_COMPLETED);
                    json.addProperty("update_stock", true);

                    String token = sessionManager.getAuthToken();
                    String authorization = (token != null && !token.trim().isEmpty()) ? "Bearer " + token.trim() : null;
                    String userId = sessionManager.getUserId() > 0 ? String.valueOf(sessionManager.getUserId()) : null;
                    String userEmail = sessionManager.getUserEmail();
                    String userRole = sessionManager.getUserRole();

                    apiService.updateOrderStatusAuthenticated(orderId, authorization, userId, userEmail, userRole, json)
                            .enqueue(new Callback<JsonObject>() {
                        @Override
                        public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                            Toast.makeText(DeliveryActivity.this, "🎉 Giao hàng thành công!", Toast.LENGTH_SHORT).show();
                            setResult(RESULT_OK);
                            finish();
                        }

                        @Override
                        public void onFailure(Call<JsonObject> call, Throwable t) {
                            Toast.makeText(DeliveryActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void requestMapboxRoute(boolean showToast) {
        if (!hasDeliveryCoordinates()) {
            resolveDeliveryCoordinatesFromAddress();
            if (showToast) {
                Toast.makeText(this, "Đang thử lấy tọa độ từ địa chỉ, vui lòng thử lại sau vài giây", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        boolean useStoreAsOrigin = currentLat == 0d || currentLng == 0d;
        double originLat = useStoreAsOrigin ? STORE_LAT : currentLat;
        double originLng = useStoreAsOrigin ? STORE_LNG : currentLng;

        if (useStoreAsOrigin && showToast) {
            Toast.makeText(this, "Dùng tọa độ cửa hàng làm điểm xuất phát", Toast.LENGTH_SHORT).show();
        }

        String from = originLng + "," + originLat;
        String to = deliveryLng + "," + deliveryLat;
        String token = getString(R.string.mapbox_access_token);
        String url = "https://api.mapbox.com/directions/v5/mapbox/driving/" + from + ";" + to
                + "?alternatives=false&geometries=polyline6&overview=full&access_token=" + token;

        routeRequested = true;
        Request request = new Request.Builder().url(url).get().build();
        directionsClient.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(@NonNull okhttp3.Call call, @NonNull IOException e) {
                routeRequested = false;
                if (showToast) {
                    runOnUiThread(() -> {
                        Toast.makeText(DeliveryActivity.this, "Mapbox route lỗi, chuyển sang app chỉ đường", Toast.LENGTH_SHORT).show();
                        openExternalNavigation();
                    });
                }
            }

            @Override
            public void onResponse(@NonNull okhttp3.Call call, @NonNull okhttp3.Response response) throws IOException {
                try (ResponseBody body = response.body()) {
                    if (!response.isSuccessful() || body == null) {
                        routeRequested = false;
                        if (showToast) {
                            runOnUiThread(() -> {
                                Toast.makeText(DeliveryActivity.this, "Không lấy được route Mapbox", Toast.LENGTH_SHORT).show();
                                openExternalNavigation();
                            });
                        }
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body.string()).getAsJsonObject();
                    JsonArray routes = json.getAsJsonArray("routes");
                    if (routes == null || routes.size() == 0) {
                        routeRequested = false;
                        if (showToast) {
                            runOnUiThread(() -> {
                                Toast.makeText(DeliveryActivity.this, "Mapbox chưa tìm được lộ trình", Toast.LENGTH_SHORT).show();
                                openExternalNavigation();
                            });
                        }
                        return;
                    }

                    JsonElement firstRoute = routes.get(0);
                    if (!firstRoute.isJsonObject() || !firstRoute.getAsJsonObject().has("geometry")) {
                        routeRequested = false;
                        return;
                    }

                    String geometry = firstRoute.getAsJsonObject().get("geometry").getAsString();
                    List<Point> routePoints = LineString.fromPolyline(geometry, 6).coordinates();
                    runOnUiThread(() -> renderRoute(routePoints, originLat, originLng, showToast));
                }
            }
        });
    }

    private void renderRoute(List<Point> routePoints, double originLat, double originLng, boolean showToast) {
        if (polylineAnnotationManager == null || routePoints == null || routePoints.isEmpty()) {
            routeRequested = false;
            return;
        }

        polylineAnnotationManager.deleteAll();
        PolylineAnnotationOptions routeLine = new PolylineAnnotationOptions()
                .withPoints(new ArrayList<>(routePoints))
                .withLineColor("#1E88E5")
                .withLineWidth(5.5);
        polylineAnnotationManager.create(routeLine);

        mapView.getMapboxMap().setCamera(
            new CameraOptions.Builder()
                .center(Point.fromLngLat(originLng, originLat))
                .zoom(13.5)
                .build()
        );

        if (showToast) {
            Toast.makeText(this, "Đã hiển thị chỉ đường bằng Mapbox", Toast.LENGTH_SHORT).show();
        }
    }

    private void openExternalNavigation() {

        String destination = deliveryLat + "," + deliveryLng;
        Uri gmmIntentUri;
        if (currentLat != 0d && currentLng != 0d) {
            String origin = currentLat + "," + currentLng;
            gmmIntentUri = Uri.parse("https://www.google.com/maps/dir/?api=1&origin=" + origin
                    + "&destination=" + destination + "&travelmode=driving");
        } else {
            String origin = STORE_LAT + "," + STORE_LNG;
            gmmIntentUri = Uri.parse("https://www.google.com/maps/dir/?api=1&origin=" + origin
                    + "&destination=" + destination + "&travelmode=driving");
        }

        Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
        mapIntent.setPackage("com.google.android.apps.maps");

        if (mapIntent.resolveActivity(getPackageManager()) != null) {
            startActivity(mapIntent);
            return;
        }

        Intent fallbackIntent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://www.google.com/maps/search/?api=1&query=" + destination));
        if (fallbackIntent.resolveActivity(getPackageManager()) != null) {
            startActivity(fallbackIntent);
        } else {
            Toast.makeText(this, "Thiết bị chưa có ứng dụng bản đồ", Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Tạo bitmap marker tùy chỉnh
     */
    private Bitmap createMarkerBitmap(int color, String emoji) {
        int size = 80;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        Paint circlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        circlePaint.setColor(color);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4, circlePaint);

        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setColor(Color.WHITE);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(4);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4, borderPaint);

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTextSize(36);
        textPaint.setTextAlign(Paint.Align.CENTER);
        float y = size / 2f - (textPaint.descent() + textPaint.ascent()) / 2;
        canvas.drawText(emoji, size / 2f, y, textPaint);

        return bitmap;
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(uploadRunnable);
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            isLocationUpdatesStarted = false;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (locationCallback != null && ActivityCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startLocationUpdates();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacks(uploadRunnable);
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            isLocationUpdatesStarted = false;
        }
        if (deliveryMarkerIcon != null) {
            deliveryMarkerIcon.recycle();
            deliveryMarkerIcon = null;
        }
        if (shipperMarkerIcon != null) {
            shipperMarkerIcon.recycle();
            shipperMarkerIcon = null;
        }
        if (storeMarkerIcon != null) {
            storeMarkerIcon.recycle();
            storeMarkerIcon = null;
        }
        if (polylineAnnotationManager != null) {
            polylineAnnotationManager.deleteAll();
            polylineAnnotationManager = null;
        }
    }
}
