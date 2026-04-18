package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

/**
 * Response cho GET /api/orders
 * Flask trả về: {"count": N, "items": [...]}
 */
public class OrderListResponse {
    @SerializedName("count")
    private int count;

    @SerializedName("items")
    private List<Order> items;

    public int getCount() { return count; }
    public List<Order> getItems() { return items; }
}
