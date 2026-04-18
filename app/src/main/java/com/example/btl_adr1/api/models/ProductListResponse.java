package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

/**
 * Response cho GET /api/products
 * Flask trả về: {"count": N, "items": [...]}
 */
public class ProductListResponse {
    @SerializedName("count")
    private int count;

    @SerializedName("items")
    private List<Product> items;

    public int getCount() { return count; }
    public List<Product> getItems() { return items; }
}
