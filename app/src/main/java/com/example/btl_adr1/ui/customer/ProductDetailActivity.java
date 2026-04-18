package com.example.btl_adr1.ui.customer;

import android.os.Bundle;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.bumptech.glide.Glide;
import com.example.btl_adr1.R;
import com.example.btl_adr1.api.models.Product;
import com.example.btl_adr1.utils.CartManager;
import com.google.android.material.button.MaterialButton;

import java.util.Locale;

/**
 * Hiển thị chi tiết sản phẩm.
 * Nhận data qua Intent extras.
 */
public class ProductDetailActivity extends AppCompatActivity {

    private int quantity = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_product_detail);

        // Get data from intent
        int productId = getIntent().getIntExtra("product_id", 0);
        String name = getIntent().getStringExtra("product_name");
        double price = getIntent().getDoubleExtra("product_price", 0);
        String desc = getIntent().getStringExtra("product_desc");
        String imageUrl = getIntent().getStringExtra("product_image");
        int categoryId = getIntent().getIntExtra("product_category", 0);
        String emoji = getIntent().getStringExtra("product_emoji");
        int stockQuantity = getIntent().getIntExtra("product_stock", 0);
        boolean isActive = getIntent().getBooleanExtra("product_is_active", true);

        // Views
        ImageView ivProduct = findViewById(R.id.ivProduct);
        TextView tvName = findViewById(R.id.tvProductName);
        TextView tvCategory = findViewById(R.id.tvCategory);
        TextView tvSaleStatus = findViewById(R.id.tvSaleStatus);
        TextView tvPrice = findViewById(R.id.tvPrice);
        TextView tvDesc = findViewById(R.id.tvDescription);
        TextView tvQuantity = findViewById(R.id.tvQuantity);
        MaterialButton btnMinus = findViewById(R.id.btnMinus);
        MaterialButton btnPlus = findViewById(R.id.btnPlus);
        MaterialButton btnAddToCart = findViewById(R.id.btnAddToCart);

        // Set data
        String emojiPrefix = (emoji != null && !emoji.isEmpty()) ? emoji + " " : "";
        tvName.setText(emojiPrefix + name);
        tvPrice.setText(String.format(Locale.US, "$%.2f", price));
        tvDesc.setText(desc != null ? desc : "");

        // Category name
        String catName;
        switch (categoryId) {
            case 1: catName = "🍜 Noodles"; break;
            case 2: catName = "🍕 Pizza"; break;
            case 3: catName = "🥤 Beverages"; break;
            case 4: catName = "🍟 Sides"; break;
            default: catName = "Other"; break;
        }
        tvCategory.setText(catName);

        boolean soldOut = !isActive || stockQuantity <= 0;
        if (soldOut) {
            tvSaleStatus.setText("Sold out");
            tvSaleStatus.setTextColor(0xFFD32F2F);
            btnMinus.setEnabled(false);
            btnPlus.setEnabled(false);
            btnAddToCart.setEnabled(false);
            btnAddToCart.setText("Đã hết hàng");
            btnAddToCart.setAlpha(0.6f);
        } else {
            tvSaleStatus.setText("Đang bán");
            tvSaleStatus.setTextColor(0xFF2E7D32);
        }

        // Image
        if (imageUrl != null && !imageUrl.isEmpty()) {
            Glide.with(this).load(imageUrl).centerCrop().into(ivProduct);
        }

        // Quantity controls
        btnMinus.setOnClickListener(v -> {
            if (quantity > 1) {
                quantity--;
                tvQuantity.setText(String.valueOf(quantity));
            }
        });

        btnPlus.setOnClickListener(v -> {
            quantity++;
            tvQuantity.setText(String.valueOf(quantity));
        });

        // Add to cart
        btnAddToCart.setOnClickListener(v -> {
            if (soldOut) {
                Toast.makeText(this, "Sản phẩm đã Sold out", Toast.LENGTH_SHORT).show();
                return;
            }
            Product product = new Product();
            product.setProductId(productId);
            product.setProductName(name);
            product.setPrice(price);
            product.setDescription(desc);
            product.setImageUrl(imageUrl);
            product.setCategoryId(categoryId);
            product.setEmoji(emoji);
            product.setStockQuantity(stockQuantity);
            product.setActive(isActive);

            CartManager.getInstance().addItem(product, quantity);
            Toast.makeText(this, name + " x" + quantity + " đã thêm vào giỏ!", Toast.LENGTH_SHORT).show();
            finish();
        });
    }
}
