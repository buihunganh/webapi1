package com.example.btl_adr1.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.btl_adr1.R;
import com.example.btl_adr1.api.models.User;

import java.util.List;

public class AdminUserAdapter extends RecyclerView.Adapter<AdminUserAdapter.ViewHolder> {

    private List<User> users;
    private final OnAdminUserListener listener;

    public interface OnAdminUserListener {
        void onEditClick(User user);
        void onToggleClick(User user);
    }

    public AdminUserAdapter(List<User> users, OnAdminUserListener listener) {
        this.users = users;
        this.listener = listener;
    }

    public void updateList(List<User> newList) {
        this.users = newList;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_admin_user, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        User user = users.get(position);

        holder.tvUserName.setText(user.getName());
        holder.tvEmail.setText(user.getEmail());

        // Role display
        String role = user.getRole();
        if (role == null) role = "customer";
        switch (role) {
            case "admin":
                holder.tvRole.setText("👑 Admin");
                holder.tvRole.setTextColor(Color.parseColor("#E53935"));
                holder.tvAvatar.setText("👑");
                break;
            case "shipper":
                holder.tvRole.setText("🚀 Shipper");
                holder.tvRole.setTextColor(Color.parseColor("#7E57C2"));
                holder.tvAvatar.setText("🚀");
                break;
            default:
                holder.tvRole.setText("🛍️ Customer");
                holder.tvRole.setTextColor(Color.parseColor("#42A5F5"));
                holder.tvAvatar.setText("🛍️");
                break;
        }

        // Active status
        if (user.isActive()) {
            holder.tvActiveStatus.setText("● Hoạt động");
            holder.tvActiveStatus.setTextColor(Color.parseColor("#66BB6A"));
        } else {
            holder.tvActiveStatus.setText("● Đã khóa");
            holder.tvActiveStatus.setTextColor(Color.parseColor("#EF5350"));
        }

        holder.btnEdit.setOnClickListener(v -> listener.onEditClick(user));
        holder.btnToggle.setOnClickListener(v -> listener.onToggleClick(user));
    }

    @Override
    public int getItemCount() {
        return users.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvAvatar, tvUserName, tvEmail, tvRole, tvActiveStatus;
        ImageView btnEdit, btnToggle;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvAvatar = itemView.findViewById(R.id.tvAvatar);
            tvUserName = itemView.findViewById(R.id.tvUserName);
            tvEmail = itemView.findViewById(R.id.tvEmail);
            tvRole = itemView.findViewById(R.id.tvRole);
            tvActiveStatus = itemView.findViewById(R.id.tvActiveStatus);
            btnEdit = itemView.findViewById(R.id.btnEdit);
            btnToggle = itemView.findViewById(R.id.btnToggle);
        }
    }
}
