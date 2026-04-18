package com.example.btl_adr1.ui.customer;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.ProductAdapter;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Product;
import com.example.btl_adr1.api.models.ProductListResponse;
import com.example.btl_adr1.utils.CartManager;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Fragment hiển thị danh sách sản phẩm.
 * Gọi Flask API: GET /api/products
 */
public class HomeFragment extends Fragment {

    private RecyclerView rvProducts;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextInputEditText etSearch;
    private ChipGroup chipGroup;
    private ProductAdapter adapter;
    private ApiService apiService;

    private List<Product> allProducts = new ArrayList<>();
    private int selectedCategoryId = 0; // 0 = All

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_home, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getApiService(requireContext());

        initViews(view);
        setupRecyclerView();
        setupChipFilters(view);
        setupSearch();
        loadProducts();
    }

    private void initViews(View view) {
        rvProducts = view.findViewById(R.id.rvProducts);
        swipeRefresh = view.findViewById(R.id.swipeRefresh);
        progressBar = view.findViewById(R.id.progressBar);
        etSearch = view.findViewById(R.id.etSearch);

        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadProducts);
    }

    private void setupRecyclerView() {
        adapter = new ProductAdapter(new ArrayList<>(), new ProductAdapter.OnProductClickListener() {
            @Override
            public void onProductClick(Product product) {
                Intent intent = new Intent(requireContext(), ProductDetailActivity.class);
                intent.putExtra("product_id", product.getProductId());
                intent.putExtra("product_name", product.getProductName());
                intent.putExtra("product_price", product.getPrice());
                intent.putExtra("product_desc", product.getDescription());
                intent.putExtra("product_image", product.getImageUrl());
                intent.putExtra("product_category", product.getCategoryId());
                intent.putExtra("product_emoji", product.getEmoji());
                intent.putExtra("product_stock", product.getStockQuantity());
                intent.putExtra("product_is_active", product.isActive());
                startActivity(intent);
            }

            @Override
            public void onAddToCartClick(Product product) {
                if (!product.isActive() || product.getStockQuantity() <= 0) {
                    Toast.makeText(requireContext(), product.getProductName() + " đã Sold out", Toast.LENGTH_SHORT).show();
                    return;
                }
                CartManager.getInstance().addItem(product, 1);
                Toast.makeText(requireContext(), product.getProductName() + " đã thêm vào giỏ!", Toast.LENGTH_SHORT).show();
            }
        });

        rvProducts.setLayoutManager(new GridLayoutManager(requireContext(), 2));
        rvProducts.setAdapter(adapter);
    }

    private void setupChipFilters(View view) {
        chipGroup = view.findViewById(R.id.chipGroup);

        chipGroup.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty()) {
                selectedCategoryId = 0;
            } else {
                int checkedId = checkedIds.get(0);
                if (checkedId == R.id.chipAll) selectedCategoryId = 0;
                else if (checkedId == R.id.chipNoodles) selectedCategoryId = 1;
                else if (checkedId == R.id.chipPizza) selectedCategoryId = 2;
                else if (checkedId == R.id.chipBeverages) selectedCategoryId = 3;
                else if (checkedId == R.id.chipSides) selectedCategoryId = 4;
            }
            filterProducts();
        });
    }

    private void setupSearch() {
        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                filterProducts();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void loadProducts() {
        progressBar.setVisibility(View.VISIBLE);

        apiService.getProducts(100).enqueue(new Callback<ProductListResponse>() {
            @Override
            public void onResponse(Call<ProductListResponse> call, Response<ProductListResponse> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    List<Product> items = response.body().getItems();
                    allProducts = items != null ? items : new ArrayList<>();
                    filterProducts();
                } else {
                    Toast.makeText(requireContext(), "Không thể tải sản phẩm", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ProductListResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                Toast.makeText(requireContext(), "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void filterProducts() {
        String query = etSearch.getText() != null ? etSearch.getText().toString().toLowerCase().trim() : "";
        List<Product> filtered = new ArrayList<>();

        for (Product p : allProducts) {
            // Filter by category
            if (selectedCategoryId != 0 && p.getCategoryId() != selectedCategoryId) continue;

            // Filter by search text
            if (!query.isEmpty()) {
                boolean match = (p.getProductName() != null && p.getProductName().toLowerCase().contains(query))
                        || (p.getDescription() != null && p.getDescription().toLowerCase().contains(query));
                if (!match) continue;
            }

            filtered.add(p);
        }

        adapter.updateList(filtered);
    }
}
