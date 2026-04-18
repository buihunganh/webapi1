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

import java.util.List;
import java.util.Locale;

public class AdminProductAdapter extends RecyclerView.Adapter<AdminProductAdapter.ViewHolder> {

    private List<Product> products;
    private final OnAdminProductListener listener;

    public interface OnAdminProductListener {
        void onEditClick(Product product);
        void onDeleteClick(Product product);
    }

    public AdminProductAdapter(List<Product> products, OnAdminProductListener listener) {
        this.products = products;
        this.listener = listener;
    }

    public void updateList(List<Product> newList) {
        this.products = newList;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_admin_product, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Product p = products.get(position);

        String emoji = p.getEmoji() != null ? p.getEmoji() + " " : "";
        holder.tvProductName.setText(emoji + p.getProductName());
        holder.tvPrice.setText(String.format(Locale.US, "$%.2f", p.getPrice()));
        holder.tvStock.setText("Kho: " + p.getStockQuantity());

        if (p.getStockQuantity() <= 0) {
            holder.tvStatus.setText("🟡 Sold out");
            holder.tvStatus.setTextColor(Color.parseColor("#F9A825"));
        } else if (p.isActive()) {
            holder.tvStatus.setText("✅ Đang bán");
            holder.tvStatus.setTextColor(Color.parseColor("#66BB6A"));
        } else {
            holder.tvStatus.setText("⛔ Ngừng bán");
            holder.tvStatus.setTextColor(Color.parseColor("#EF5350"));
        }

        if (p.getImageUrl() != null && !p.getImageUrl().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(p.getImageUrl())
                    .centerCrop()
                    .into(holder.ivProduct);
        } else {
            holder.ivProduct.setImageResource(android.R.drawable.ic_menu_gallery);
        }

        holder.btnEdit.setOnClickListener(v -> listener.onEditClick(p));
        holder.btnDelete.setOnClickListener(v -> listener.onDeleteClick(p));
    }

    @Override
    public int getItemCount() {
        return products.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivProduct, btnEdit, btnDelete;
        TextView tvProductName, tvPrice, tvStock, tvStatus;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivProduct = itemView.findViewById(R.id.ivProduct);
            tvProductName = itemView.findViewById(R.id.tvProductName);
            tvPrice = itemView.findViewById(R.id.tvPrice);
            tvStock = itemView.findViewById(R.id.tvStock);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            btnEdit = itemView.findViewById(R.id.btnEdit);
            btnDelete = itemView.findViewById(R.id.btnDelete);
        }
    }
}
