package com.example.btl_adr1.ui.customer;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.CartAdapter;
import com.example.btl_adr1.api.models.CartItem;
import com.example.btl_adr1.utils.CartManager;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Fragment giỏ hàng.
 * Sử dụng CartManager singleton để quản lý items local.
 */
public class CartFragment extends Fragment {

    private RecyclerView rvCart;
    private LinearLayout emptyState;
    private MaterialCardView bottomCard;
    private TextView tvSubtotal;
    private MaterialButton btnCheckout;
    private CartAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_cart, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        rvCart = view.findViewById(R.id.rvCart);
        emptyState = view.findViewById(R.id.emptyState);
        bottomCard = view.findViewById(R.id.bottomCard);
        tvSubtotal = view.findViewById(R.id.tvSubtotal);
        btnCheckout = view.findViewById(R.id.btnCheckout);

        adapter = new CartAdapter(new ArrayList<>(), new CartAdapter.OnCartActionListener() {
            @Override
            public void onQuantityChanged(int productId, int newQuantity) {
                CartManager.getInstance().updateQuantity(productId, newQuantity);
                refreshCart();
            }

            @Override
            public void onRemoveItem(int productId) {
                CartManager.getInstance().removeItem(productId);
                refreshCart();
            }
        });

        rvCart.setLayoutManager(new LinearLayoutManager(requireContext()));
        rvCart.setAdapter(adapter);

        btnCheckout.setOnClickListener(v -> {
            startActivity(new Intent(requireContext(), CheckoutActivity.class));
        });

        refreshCart();
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshCart();
    }

    private void refreshCart() {
        CartManager cart = CartManager.getInstance();
        List<CartItem> items = cart.getItems();

        if (items.isEmpty()) {
            rvCart.setVisibility(View.GONE);
            emptyState.setVisibility(View.VISIBLE);
            bottomCard.setVisibility(View.GONE);
        } else {
            rvCart.setVisibility(View.VISIBLE);
            emptyState.setVisibility(View.GONE);
            bottomCard.setVisibility(View.VISIBLE);
            adapter.updateList(items);
            tvSubtotal.setText(String.format(Locale.US, "$%.2f", cart.getSubTotal()));
        }
    }
}
