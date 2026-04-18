package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

/**
 * Response cho GET /api/admin/users
 * Flask trả về: {"ok": true, "count": N, "items": [...]}
 */
public class UserListResponse {
    @SerializedName("ok")
    private boolean ok;

    @SerializedName("count")
    private int count;

    @SerializedName("items")
    private List<User> items;

    public boolean isOk() { return ok; }
    public int getCount() { return count; }
    public List<User> getItems() { return items; }
}
