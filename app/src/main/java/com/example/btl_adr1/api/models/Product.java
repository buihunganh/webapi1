package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;

public class Product {
    @SerializedName("productid")
    private int productId;

    @SerializedName("productname")
    private String productName;

    @SerializedName("description")
    private String description;

    @SerializedName("price")
    private double price;

    @SerializedName("stockquantity")
    private int stockQuantity;

    @SerializedName("imageurl")
    private String imageUrl;

    @SerializedName("isactive")
    private boolean isActive;

    @SerializedName("categoryid")
    private int categoryId;

    @SerializedName("emoji")
    private String emoji;

    @SerializedName("tags")
    private String tags;

    @SerializedName("createdat")
    private String createdAt;

    // Getters & Setters
    public int getProductId() { return productId; }
    public void setProductId(int productId) { this.productId = productId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public int getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(int stockQuantity) { this.stockQuantity = stockQuantity; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public int getCategoryId() { return categoryId; }
    public void setCategoryId(int categoryId) { this.categoryId = categoryId; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    /**
     * Trả về tên category dựa trên categoryId.
     * Mapping theo seed data trong database_postgres.sql
     */
    public String getCategoryName() {
        switch (categoryId) {
            case 1: return "Noodles";
            case 2: return "Pizza";
            case 3: return "Beverages";
            case 4: return "Sides";
            default: return "Other";
        }
    }
}
