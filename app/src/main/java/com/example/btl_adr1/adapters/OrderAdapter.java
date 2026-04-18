package com.example.btl_adr1.adapters;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.models.Order;
import com.example.btl_adr1.ui.customer.OrderDetailActivity;
import com.example.btl_adr1.ui.customer.OrderTrackingActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.MoneyUtils;

import java.util.List;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {

    private List<Order> orders;

    public OrderAdapter(List<Order> orders) {
        this.orders = orders;
    }

    public void updateList(List<Order> newList) {
        this.orders = newList;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        Order order = orders.get(position);

        holder.tvOrderId.setText("Đơn #" + order.getOrderId());
        holder.tvStatus.setText(order.getStatusDisplayName());

        holder.tvTotal.setText(MoneyUtils.format(order.getTotalAmount()));

        // Format date
        String date = order.getOrderDate();
        if (date != null && date.length() > 10) {
            date = date.substring(0, 10); // YYYY-MM-DD
        }
        holder.tvDate.setText(date);

        // Status color
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

        // Click -> mở chi tiết đơn hàng
        holder.itemView.setOnClickListener(v -> {
            Context context = holder.itemView.getContext();
            Intent intent = new Intent(context, OrderDetailActivity.class);
            intent.putExtra("order_id", order.getOrderId());
            context.startActivity(intent);
        });
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class OrderViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvStatus, tvDate, tvTotal;

        OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tvOrderId);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            tvDate = itemView.findViewById(R.id.tvDate);
            tvTotal = itemView.findViewById(R.id.tvTotal);
        }
    }
}
