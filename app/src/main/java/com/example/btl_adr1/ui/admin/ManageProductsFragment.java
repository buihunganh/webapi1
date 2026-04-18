package com.example.btl_adr1.ui.admin;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.ImageView;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.bumptech.glide.Glide;
import com.example.btl_adr1.R;
import com.example.btl_adr1.adapters.AdminProductAdapter;
import com.example.btl_adr1.api.ApiClient;
import com.example.btl_adr1.api.ApiService;
import com.example.btl_adr1.api.models.Product;
import com.example.btl_adr1.api.models.ProductListResponse;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.JsonObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Fragment quản lý sản phẩm cho Admin.
 * CRUD qua Flask API: GET/POST/PUT/DELETE /api/products
 */
public class ManageProductsFragment extends Fragment {

    private RecyclerView rvProducts;
    private SwipeRefreshLayout swipeRefresh;
    private FloatingActionButton fabAdd;
    private AdminProductAdapter adapter;
    private ApiService apiService;
    private List<Product> products = new ArrayList<>();
    private ActivityResultLauncher<String> imagePickerLauncher;
    private TextInputEditText activeImageUrlInput;
    private ImageView activeImagePreview;

    private final String[] CATEGORIES = {"Noodles", "Pizza", "Beverages", "Sides"};

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_manage_products, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getApiService(requireContext());
        imagePickerLauncher = registerForActivityResult(new ActivityResultContracts.GetContent(), this::onImagePicked);

        rvProducts = view.findViewById(R.id.rvProducts);
        swipeRefresh = view.findViewById(R.id.swipeRefresh);
        fabAdd = view.findViewById(R.id.fabAdd);

        adapter = new AdminProductAdapter(products, new AdminProductAdapter.OnAdminProductListener() {
            @Override
            public void onEditClick(Product product) {
                showProductDialog(product);
            }

            @Override
            public void onDeleteClick(Product product) {
                confirmDelete(product);
            }
        });

        rvProducts.setLayoutManager(new LinearLayoutManager(requireContext()));
        rvProducts.setAdapter(adapter);

        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadProducts);

        fabAdd.setOnClickListener(v -> showProductDialog(null));

        loadProducts();
    }

    private void loadProducts() {
        swipeRefresh.setRefreshing(true);

        apiService.getProducts(500).enqueue(new Callback<ProductListResponse>() {
            @Override
            public void onResponse(Call<ProductListResponse> call, Response<ProductListResponse> response) {
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<Product> items = response.body().getItems();
                    products = items != null ? items : new ArrayList<>();
                    adapter.updateList(products);
                }
            }

            @Override
            public void onFailure(Call<ProductListResponse> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(requireContext(), "Lỗi tải sản phẩm", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProductDialog(@Nullable Product product) {
        View dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_product, null);

        TextInputEditText etName = dialogView.findViewById(R.id.etProductName);
        TextInputEditText etPrice = dialogView.findViewById(R.id.etPrice);
        TextInputEditText etDesc = dialogView.findViewById(R.id.etDescription);
        TextInputEditText etImageUrl = dialogView.findViewById(R.id.etImageUrl);
        TextInputEditText etEmoji = dialogView.findViewById(R.id.etEmoji);
        TextInputEditText etStock = dialogView.findViewById(R.id.etStock);
        MaterialButton btnPickImage = dialogView.findViewById(R.id.btnPickImage);
        ImageView ivImagePreview = dialogView.findViewById(R.id.ivImagePreview);
        Spinner spinnerCategory = dialogView.findViewById(R.id.spinnerCategory);
        SwitchMaterial switchIsActive = dialogView.findViewById(R.id.switchIsActive);
        android.widget.TextView tvTitle = dialogView.findViewById(R.id.tvDialogTitle);

        activeImageUrlInput = etImageUrl;
        activeImagePreview = ivImagePreview;

        btnPickImage.setOnClickListener(v -> imagePickerLauncher.launch("image/*"));

        ArrayAdapter<String> catAdapter = new ArrayAdapter<>(requireContext(),
                android.R.layout.simple_spinner_dropdown_item, CATEGORIES);
        spinnerCategory.setAdapter(catAdapter);

        boolean isEdit = product != null;
        tvTitle.setText(isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm");
        switchIsActive.setChecked(true);

        if (isEdit) {
            etName.setText(product.getProductName());
            etPrice.setText(String.valueOf(product.getPrice()));
            etDesc.setText(product.getDescription());
            etImageUrl.setText(product.getImageUrl());
            etEmoji.setText(product.getEmoji());
            etStock.setText(String.valueOf(product.getStockQuantity()));
            switchIsActive.setChecked(product.isActive());
            if (product.getCategoryId() >= 1 && product.getCategoryId() <= 4) {
                spinnerCategory.setSelection(product.getCategoryId() - 1);
            }
            if (product.getImageUrl() != null && !product.getImageUrl().trim().isEmpty()) {
                Glide.with(this)
                        .load(product.getImageUrl().trim())
                        .centerCrop()
                        .placeholder(android.R.drawable.ic_menu_gallery)
                        .into(ivImagePreview);
            }
        }

        new AlertDialog.Builder(requireContext())
                .setView(dialogView)
                .setPositiveButton(isEdit ? "Cập nhật" : "Thêm", (dialog, which) -> {
                    String name = etName.getText().toString().trim();
                    String priceStr = etPrice.getText().toString().trim();
                    String desc = etDesc.getText().toString().trim();
                    String imageUrl = etImageUrl.getText().toString().trim();
                    String emoji = etEmoji.getText().toString().trim();
                    String stockStr = etStock.getText().toString().trim();
                    boolean isActive = switchIsActive.isChecked();
                    int categoryId = spinnerCategory.getSelectedItemPosition() + 1;

                    if (name.isEmpty() || priceStr.isEmpty()) {
                        Toast.makeText(requireContext(), "Tên và giá là bắt buộc", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    double price;
                    int stockQty;
                    try {
                        price = Double.parseDouble(priceStr);
                        stockQty = stockStr.isEmpty() ? 100 : Integer.parseInt(stockStr);
                    } catch (NumberFormatException ex) {
                        Toast.makeText(requireContext(), "Giá hoặc tồn kho không hợp lệ", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    if (price < 0 || stockQty < 0) {
                        Toast.makeText(requireContext(), "Giá và tồn kho phải >= 0", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    JsonObject json = new JsonObject();
                    json.addProperty("productname", name);
                    json.addProperty("price", price);
                    json.addProperty("description", desc);
                    if (!imageUrl.isEmpty()) {
                        json.addProperty("imageurl", imageUrl);
                    }
                    json.addProperty("emoji", emoji);
                    json.addProperty("categoryid", categoryId);
                    json.addProperty("stockquantity", stockQty);
                    json.addProperty("isactive", isActive);
                    json.addProperty("is_active", isActive);

                    if (isEdit) {
                        apiService.updateProduct(product.getProductId(), json).enqueue(new Callback<JsonObject>() {
                            @Override
                            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                                if (!response.isSuccessful()) {
                                    Toast.makeText(requireContext(), "Cập nhật thất bại (HTTP " + response.code() + ")", Toast.LENGTH_SHORT).show();
                                    return;
                                }
                                if (!imageUrl.isEmpty()) {
                                    JsonObject imageBody = new JsonObject();
                                    imageBody.addProperty("image_url", imageUrl);
                                    imageBody.addProperty("imageurl", imageUrl);
                                    apiService.updateProductImage(product.getProductId(), imageBody).enqueue(new Callback<JsonObject>() {
                                        @Override
                                        public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                                            Toast.makeText(requireContext(), "Đã cập nhật sản phẩm!", Toast.LENGTH_SHORT).show();
                                            loadProducts();
                                        }

                                        @Override
                                        public void onFailure(Call<JsonObject> call, Throwable t) {
                                            Toast.makeText(requireContext(), "Đã cập nhật, nhưng lỗi ảnh: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                                            loadProducts();
                                        }
                                    });
                                } else {
                                    Toast.makeText(requireContext(), "Đã cập nhật!", Toast.LENGTH_SHORT).show();
                                    loadProducts();
                                }
                            }
                            @Override
                            public void onFailure(Call<JsonObject> call, Throwable t) {
                                Toast.makeText(requireContext(), "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        });
                    } else {
                        apiService.createProduct(json).enqueue(new Callback<JsonObject>() {
                            @Override
                            public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                                Toast.makeText(requireContext(), "Đã thêm sản phẩm!", Toast.LENGTH_SHORT).show();
                                loadProducts();
                            }
                            @Override
                            public void onFailure(Call<JsonObject> call, Throwable t) {
                                Toast.makeText(requireContext(), "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void confirmDelete(Product product) {
        new AlertDialog.Builder(requireContext())
                .setTitle("Xóa sản phẩm")
                .setMessage("Xóa \"" + product.getProductName() + "\"?")
                .setPositiveButton("Xóa", (dialog, which) -> {
                    apiService.deleteProduct(product.getProductId()).enqueue(new Callback<JsonObject>() {
                        @Override
                        public void onResponse(Call<JsonObject> call, Response<JsonObject> response) {
                            Toast.makeText(requireContext(), "Đã xóa!", Toast.LENGTH_SHORT).show();
                            loadProducts();
                        }
                        @Override
                        public void onFailure(Call<JsonObject> call, Throwable t) {
                            Toast.makeText(requireContext(), "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void onImagePicked(@Nullable Uri imageUri) {
        if (imageUri == null || activeImageUrlInput == null) {
            return;
        }

        String imageValue = imageUri.toString();
        String encoded = encodeImageAsDataUrl(imageUri);
        if (encoded != null && !encoded.isEmpty()) {
            imageValue = encoded;
        }

        activeImageUrlInput.setText(imageValue);

        if (activeImagePreview != null) {
            Glide.with(this)
                    .load(imageUri)
                    .centerCrop()
                    .placeholder(android.R.drawable.ic_menu_gallery)
                    .into(activeImagePreview);
        }
    }

    private String encodeImageAsDataUrl(@NonNull Uri imageUri) {
        try (InputStream in = requireContext().getContentResolver().openInputStream(imageUri)) {
            if (in == null) return null;

            Bitmap bitmap = BitmapFactory.decodeStream(in);
            if (bitmap == null) return null;

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out);
            byte[] bytes = out.toByteArray();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            return "data:image/jpeg;base64," + base64;
        } catch (IOException e) {
            return null;
        }
    }
}
