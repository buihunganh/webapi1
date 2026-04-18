package com.example.btl_adr1.utils;

import com.example.btl_adr1.api.models.CartItem;
import com.example.btl_adr1.api.models.Product;

import java.util.ArrayList;
import java.util.List;

/**
 * Singleton quản lý giỏ hàng local.
 * Giỏ hàng lưu trong memory, gửi lên server khi checkout.
 */
public class CartManager {
    private static CartManager instance;
    private final List<CartItem> cartItems;

    private CartManager() {
        cartItems = new ArrayList<>();
    }

    public static synchronized CartManager getInstance() {
        if (instance == null) {
            instance = new CartManager();
        }
        return instance;
    }

    /**
     * Thêm sản phẩm vào giỏ hàng
     */
    public void addItem(Product product, int quantity) {
        // Kiểm tra sản phẩm đã có trong giỏ chưa
        for (CartItem item : cartItems) {
            if (item.getProduct().getProductId() == product.getProductId()) {
                item.setQuantity(item.getQuantity() + quantity);
                return;
            }
        }
        cartItems.add(new CartItem(product, quantity));
    }

    /**
     * Cập nhật số lượng sản phẩm
     */
    public void updateQuantity(int productId, int quantity) {
        for (CartItem item : cartItems) {
            if (item.getProduct().getProductId() == productId) {
                if (quantity <= 0) {
                    cartItems.remove(item);
                } else {
                    item.setQuantity(quantity);
                }
                return;
            }
        }
    }

    /**
     * Xóa sản phẩm khỏi giỏ
     */
    public void removeItem(int productId) {
        cartItems.removeIf(item -> item.getProduct().getProductId() == productId);
    }

    /**
     * Lấy danh sách items
     */
    public List<CartItem> getItems() {
        return cartItems;
    }

    /**
     * Tổng số lượng items
     */
    public int getItemCount() {
        int count = 0;
        for (CartItem item : cartItems) {
            count += item.getQuantity();
        }
        return count;
    }

    /**
     * Tổng tiền (subtotal)
     */
    public double getSubTotal() {
        double total = 0;
        for (CartItem item : cartItems) {
            total += item.getTotalPrice();
        }
        return total;
    }

    /**
     * Xóa toàn bộ giỏ hàng
     */
    public void clearCart() {
        cartItems.clear();
    }

    /**
     * Kiểm tra giỏ hàng có trống không
     */
    public boolean isEmpty() {
        return cartItems.isEmpty();
    }
}
