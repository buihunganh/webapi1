package com.example.btl_adr1.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.models.Order;
import com.google.android.material.button.MaterialButton;

import java.util.List;
import java.util.Locale;

public class AdminOrderAdapter extends RecyclerView.Adapter<AdminOrderAdapter.ViewHolder> {

    private List<Order> orders;
    private final OnStatusUpdateListener listener;

    public interface OnStatusUpdateListener {
        void onUpdateStatusClick(Order order);
    }

    public AdminOrderAdapter(List<Order> orders, OnStatusUpdateListener listener) {
        this.orders = orders;
        this.listener = listener;
    }

    public void updateList(List<Order> newList) {
        this.orders = newList;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_admin_order, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Order order = orders.get(position);

        holder.tvOrderId.setText("Đơn #" + order.getOrderId());
        holder.tvTotal.setText(String.format(Locale.US, "$%.2f", order.getTotalAmount()));
        holder.tvCustomer.setText("KH ID: " + order.getCustomerId());

        // Date
        String date = order.getOrderDate();
        if (date != null && date.length() > 16) {
            date = date.substring(0, 16).replace("T", " ");
        }
        holder.tvDate.setText(date);

        // Status
        holder.tvStatus.setText(order.getStatusDisplayName());
        String statusColor;
        String status = order.getOrderStatus();
        if (status == null) status = "";
        switch (status) {
            case "pending": statusColor = "#FFA726"; break;
            case "waiting_for_shipper": statusColor = "#42A5F5"; break;
            case "shipping": statusColor = "#7E57C2"; break;
            case "completed": statusColor = "#66BB6A"; break;
            case "cancelled": statusColor = "#EF5350"; break;
            default: statusColor = "#9E9E9E"; break;
        }
        holder.tvStatus.setTextColor(Color.parseColor(statusColor));

        holder.btnUpdateStatus.setOnClickListener(v -> listener.onUpdateStatusClick(order));
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvStatus, tvCustomer, tvDate, tvTotal;
        MaterialButton btnUpdateStatus;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tvOrderId);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            tvCustomer = itemView.findViewById(R.id.tvCustomer);
            tvDate = itemView.findViewById(R.id.tvDate);
            tvTotal = itemView.findViewById(R.id.tvTotal);
            btnUpdateStatus = itemView.findViewById(R.id.btnUpdateStatus);
        }
    }
}
