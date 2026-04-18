package com.example.btl_adr1.api;

import com.example.btl_adr1.api.models.*;
import com.google.gson.JsonObject;

import retrofit2.Call;
import retrofit2.http.*;

/**
 * Tất cả REST API endpoints của Flask backend.
 * Đã được tối ưu hóa: Header Authorization và User Info được xử lý tự động bởi ApiClient.
 */
public interface ApiService {

    // ==================== AUTH ====================

    @POST("api/auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @POST("api/auth/register")
    Call<LoginResponse> register(@Body RegisterRequest request);

    @GET("api/auth/profile")
    Call<LoginResponse> getProfile(@Query("email") String email);

    // ==================== PRODUCTS ====================

    @GET("api/products")
    Call<ProductListResponse> getProducts(@Query("limit") int limit);

    @POST("api/products")
    Call<JsonObject> createProduct(@Body JsonObject product);

    @PUT("api/products/{id}")
    Call<JsonObject> updateProduct(@Path("id") int productId, @Body JsonObject updates);

    @DELETE("api/products/{id}")
    Call<JsonObject> deleteProduct(@Path("id") int productId);

    @POST("api/products/{id}/image")
    Call<JsonObject> updateProductImage(@Path("id") int productId, @Body JsonObject imageUrl);

    // ==================== ORDERS ====================

    @GET("api/orders")
    Call<OrderListResponse> getOrders(@Query("limit") int limit);

    /**
     * Lấy danh sách đơn hàng với đầy đủ Header xác thực (tương thích ngược).
     */
    @GET("api/orders")
    Call<OrderListResponse> getOrdersAuthenticated(
            @Header("Authorization") String auth,
            @Header("X-User-Id") String userId,
            @Header("X-User-Email") String userEmail,
            @Header("X-User-Role") String userRole,
            @Query("limit") int limit
    );

    @POST("api/orders")
    Call<JsonObject> createOrder(@Body JsonObject order);

    @POST("api/orders/{id}/status")
    Call<JsonObject> updateOrderStatus(@Path("id") int orderId, @Body JsonObject status);

    /**
     * Cập nhật trạng thái đơn hàng với Header xác thực (tương thích ngược).
     */
    @POST("api/orders/{id}/status")
    Call<JsonObject> updateOrderStatusAuthenticated(
            @Path("id") int orderId,
            @Header("Authorization") String auth,
            @Header("X-User-Id") String userId,
            @Header("X-User-Email") String userEmail,
            @Header("X-User-Role") String userRole,
            @Body JsonObject status
    );

    @POST("api/orders/{id}/location")
    Call<JsonObject> updateShipperLocation(@Path("id") int orderId, @Body JsonObject location);

    /**
     * Cập nhật vị trí shipper với Header xác thực (tương thích ngược).
     */
    @POST("api/orders/{id}/location")
    Call<JsonObject> updateShipperLocationAuthenticated(
            @Path("id") int orderId,
            @Header("Authorization") String auth,
            @Header("X-User-Id") String userId,
            @Header("X-User-Email") String userEmail,
            @Header("X-User-Role") String userRole,
            @Body JsonObject location
    );

    // ==================== ADMIN - USERS ====================

    @GET("api/admin/users")
    Call<UserListResponse> getAdminUsers(
            @Query("role") String role,
            @Query("limit") int limit
    );

    @POST("api/admin/users")
    Call<JsonObject> adminCreateUser(@Body JsonObject user);

    @PUT("api/admin/users/{id}")
    Call<JsonObject> adminUpdateUser(@Path("id") int userId, @Body JsonObject updates);

    @DELETE("api/admin/users/{id}")
    Call<JsonObject> adminDeleteUser(@Path("id") int userId);

    // ==================== UTILITY ====================

    @GET("api/health")
    Call<JsonObject> healthCheck();
}
