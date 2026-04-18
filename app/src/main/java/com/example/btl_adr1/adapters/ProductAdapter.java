package com.example.btl_adr1.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.example.btl_adr1.R;
import com.example.btl_adr1.api.models.Product;
import com.google.android.material.button.MaterialButton;

import java.util.List;
import java.util.Locale;

public class ProductAdapter extends RecyclerView.Adapter<ProductAdapter.ProductViewHolder> {

    private List<Product> products;
    private final OnProductClickListener listener;

    public interface OnProductClickListener {
        void onProductClick(Product product);
        void onAddToCartClick(Product product);
    }

    public ProductAdapter(List<Product> products, OnProductClickListener listener) {
        this.products = products;
        this.listener = listener;
    }

    public void updateList(List<Product> newList) {
        this.products = newList;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ProductViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_product, parent, false);
        return new ProductViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ProductViewHolder holder, int position) {
        Product product = products.get(position);

        // Name with emoji
        String emoji = product.getEmoji() != null ? product.getEmoji() + " " : "";
        holder.tvProductName.setText(emoji + product.getProductName());

        // Category
        holder.tvCategory.setText(product.getCategoryName());

        // Price
        holder.tvPrice.setText(String.format(Locale.US, "$%.2f", product.getPrice()));

        boolean soldOut = !product.isActive() || product.getStockQuantity() <= 0;
        if (soldOut) {
            holder.tvSaleStatus.setText("Sold out");
            holder.tvSaleStatus.setTextColor(Color.parseColor("#D32F2F"));
            holder.btnAdd.setEnabled(false);
            holder.btnAdd.setAlpha(0.45f);
        } else {
            holder.tvSaleStatus.setText("Đang bán");
            holder.tvSaleStatus.setTextColor(Color.parseColor("#2E7D32"));
            holder.btnAdd.setEnabled(true);
            holder.btnAdd.setAlpha(1f);
        }

        // Image
        if (product.getImageUrl() != null && !product.getImageUrl().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(product.getImageUrl())
                    .centerCrop()
                    .placeholder(android.R.drawable.ic_menu_gallery)
                    .into(holder.ivProduct);
        } else {
            holder.ivProduct.setImageResource(android.R.drawable.ic_menu_gallery);
        }

        // Click listeners
        holder.itemView.setOnClickListener(v -> listener.onProductClick(product));
        holder.btnAdd.setOnClickListener(v -> {
            if (!soldOut) {
                listener.onAddToCartClick(product);
            }
        });
    }

    @Override
    public int getItemCount() {
        return products.size();
    }

    static class ProductViewHolder extends RecyclerView.ViewHolder {
        ImageView ivProduct;
        TextView tvProductName, tvCategory, tvPrice, tvSaleStatus;
        MaterialButton btnAdd;

        ProductViewHolder(@NonNull View itemView) {
            super(itemView);
            ivProduct = itemView.findViewById(R.id.ivProduct);
            tvProductName = itemView.findViewById(R.id.tvProductName);
            tvCategory = itemView.findViewById(R.id.tvCategory);
            tvPrice = itemView.findViewById(R.id.tvPrice);
            tvSaleStatus = itemView.findViewById(R.id.tvSaleStatus);
            btnAdd = itemView.findViewById(R.id.btnAdd);
        }
    }
}
