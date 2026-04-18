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
import com.example.btl_adr1.ui.shipper.DeliveryActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.MoneyUtils;
import com.google.android.material.button.MaterialButton;

import java.util.List;

public class ShipperOrderAdapter extends RecyclerView.Adapter<ShipperOrderAdapter.ViewHolder> {

    private List<Order> orders;
    private final int shipperId;
    private final OnShipperActionListener listener;

    public interface OnShipperActionListener {
        void onAcceptOrder(Order order);
        void onPickupOrder(Order order);
    }

    public ShipperOrderAdapter(List<Order> orders, int shipperId, OnShipperActionListener listener) {
        this.orders = orders;
        this.shipperId = shipperId;
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
                .inflate(R.layout.item_shipper_order, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Order order = orders.get(position);

        holder.tvOrderId.setText("Đơn #" + order.getOrderId());
        holder.tvTotal.setText(MoneyUtils.format(order.getTotalAmount()));

        holder.tvStatus.setText(order.getStatusDisplayName());

        // Address & phone
        String deliveryAddress = order.getDeliveryAddress();
        if (deliveryAddress != null && !deliveryAddress.trim().isEmpty()) {
            holder.tvAddress.setText("📍 " + deliveryAddress.trim());
        } else {
            holder.tvAddress.setText("📍 KH ID: " + order.getCustomerId());
        }
        String phone = order.getDeliveryPhone();
        holder.tvPhone.setText("📞 " + (phone != null ? phone : "Không có SĐT"));

        // Status color & actions
        String status = order.getOrderStatus();
        if (Constants.STATUS_PENDING.equals(status)) {
            holder.tvStatus.setTextColor(Color.parseColor("#42A5F5"));
            holder.btnAction.setText("🛵 Nhận đơn");
            holder.btnAction.setVisibility(View.VISIBLE);
            holder.btnAction.setOnClickListener(v -> listener.onAcceptOrder(order));
        } else if (Constants.STATUS_WAITING_SHIPPER.equals(status)
                && order.getShipperId() != null
                && order.getShipperId() == shipperId) {
            holder.tvStatus.setTextColor(Color.parseColor("#42A5F5"));
            holder.btnAction.setText("📦 Đã lấy hàng");
            holder.btnAction.setVisibility(View.VISIBLE);
            holder.btnAction.setOnClickListener(v -> listener.onPickupOrder(order));
        } else if (Constants.STATUS_SHIPPING.equals(status)) {
            holder.tvStatus.setTextColor(Color.parseColor("#7E57C2"));
            holder.btnAction.setText("🗺️ Mở bản đồ giao hàng");
            holder.btnAction.setVisibility(View.VISIBLE);
            holder.btnAction.setOnClickListener(v -> {
                Context context = holder.itemView.getContext();
                Intent intent = new Intent(context, DeliveryActivity.class);
                intent.putExtra("order_id", order.getOrderId());
                intent.putExtra("delivery_lat", order.getLatitude() != null ? order.getLatitude() : 0.0);
                intent.putExtra("delivery_lng", order.getLongitude() != null ? order.getLongitude() : 0.0);
                intent.putExtra("delivery_address", order.getDeliveryAddress());
                intent.putExtra("delivery_phone", order.getDeliveryPhone());
                intent.putExtra("notes", order.getNotes());
                intent.putExtra("total_amount", order.getTotalAmount());
                context.startActivity(intent);
            });
        } else if (Constants.STATUS_COMPLETED.equals(status)) {
            holder.tvStatus.setTextColor(Color.parseColor("#66BB6A"));
            holder.btnAction.setVisibility(View.GONE);
        } else {
            holder.btnAction.setVisibility(View.GONE);
        }
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvStatus, tvAddress, tvPhone, tvTotal;
        MaterialButton btnAction;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tvOrderId);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            tvAddress = itemView.findViewById(R.id.tvAddress);
            tvPhone = itemView.findViewById(R.id.tvPhone);
            tvTotal = itemView.findViewById(R.id.tvTotal);
            btnAction = itemView.findViewById(R.id.btnAction);
        }
    }
}
