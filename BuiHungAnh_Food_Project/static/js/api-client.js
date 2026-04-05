/**
 * API Client - Kết nối Frontend với Backend API
 * Base URL: http://localhost:5500/api
 */

function resolveApiBase() {
  if (typeof window === "undefined") return "/api";

  const { protocol, hostname, port, host } = window.location;
  // When opened with VS Code Live Server (commonly 5501), call Flask backend on 5500.
  if (port === "5501") {
    return `${protocol}//${hostname}:5500/api`;
  }

  return `${protocol}//${host}/api`;
}

const API_BASE = resolveApiBase();

class APIClient {
  /**
   * Fetch user login
   * POST /api/auth/login
   */
  static async login(email, password) {
    console.log("[APIClient] login() called for:", email);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      console.log("[APIClient] login response status:", res.status);
      const text = await res.text();
      console.log("[APIClient] login response text:", text.substring(0, 100));
      if (!text) throw new Error("Empty response from server");
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || "Login failed");
      console.log("[APIClient] login success:", data);
      return data; // { ok: true, user: {...} }
    } catch (err) {
      console.error("[APIClient] Login error:", err);
      throw err;
    }
  }

  /**
   * Register new user
   * POST /api/auth/register
   */
  static async register(email, fullName, phone, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, phone, password }),
      });
      const text = await res.text();
      if (!text) throw new Error("Empty response from server");
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || "Register failed");
      return data;
    } catch (err) {
      console.error("Register error:", err);
      throw err;
    }
  }

  /**
   * Get all users with pagination
   * GET /api/users?limit=N
   */
  static async getUsers(limit = 100) {
    try {
      const res = await fetch(`${API_BASE}/users?limit=${limit}`);
      const text = await res.text();
      if (!text) return [];
      const data = JSON.parse(text);
      if (!res.ok) {
        console.warn("Get users error:", data.error);
        return [];
      }
      return data.items || [];
    } catch (err) {
      console.error("Get users error:", err);
      return [];
    }
  }

  /**
   * Get all products with pagination
   * GET /api/products?limit=N
   */
  static async getProducts(limit = 100) {
    try {
      const res = await fetch(`${API_BASE}/products?limit=${limit}`);
      const text = await res.text();
      if (!text) return [];
      const data = JSON.parse(text);
      if (!res.ok) {
        console.warn("Get products error:", data.error);
        return [];
      }
      return data.items || [];
    } catch (err) {
      console.error("Get products error:", err);
      return [];
    }
  }

  /**
   * Get all orders with pagination
   * GET /api/orders?limit=N
   */
  static async getOrders(limit = 100) {
    try {
      const res = await fetch(`${API_BASE}/orders?limit=${limit}`);
      const text = await res.text();
      if (!text) return [];
      const data = JSON.parse(text);
      if (!res.ok) {
        console.warn("Get orders error:", data.error);
        return [];
      }
      return data.items || [];
    } catch (err) {
      console.error("Get orders error:", err);
      return [];
    }
  }

  /**
   * Create a new order (storefront checkout)
   * POST /api/orders
   */
  static async createOrder(payload) {
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const text = await res.text();
      if (!text) throw new Error("Empty response from server");
      const data = JSON.parse(text);
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to create order");
      }
      return data.order || data;
    } catch (err) {
      console.error("Create order error:", err);
      throw err;
    }
  }

  static async deleteProduct(productId) {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: "DELETE",
    });
    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Failed to delete product");
    }
    return data;
  }


  /**
   * Admin-only list users by role.
   * GET /api/admin/users?role=customer&limit=200
   */
  static async getAdminUsers(role, limit = 200) {
    try {
      const params = new URLSearchParams();
      params.set("limit", limit);
      if (role) params.set("role", role);
      const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`);
      const text = await res.text();
      if (!text) return [];
      const data = JSON.parse(text);
      if (!res.ok || data.ok === false) {
        console.warn("Get admin users error:", data.error);
        return [];
      }
      return data.items || [];
    } catch (err) {
      console.error("Get admin users error:", err);
      return [];
    }
  }

  /**
   * Create customer/shipper account
   */
  static async createAdminUser(payload) {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Failed to create user");
    }
    return data.user;
  }

  /**
   * Update customer/shipper account
   */
  static async updateAdminUser(userId, payload) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Failed to update user");
    }
    return data.user;
  }

  static async deleteAdminUser(userId) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "DELETE",
    });
    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Failed to delete user");
    }
    return data;
  }

  /**
   * Get health check
   * GET /api/health
   */
  static async health() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      return data; // { ok: true, database: 'postgres', server: '...' }
    } catch (err) {
      console.error("Health check error:", err);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Update order status
   * POST /api/orders/{id}/status
   */
  static async updateOrderStatus(orderId, status) {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const text = await res.text();
      if (!text) throw new Error("Empty response from server");
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || "Failed to update order");
      return data;
    } catch (err) {
      console.error("Update order error:", err);
      throw err;
    }
  }

  /**
   * Get application profile by email
   * GET /api/auth/profile?email=...
   */
  static async getAuthProfile(email) {
    console.log("[APIClient] getAuthProfile() called for:", email);
    try {
      const encoded = encodeURIComponent(email || "");
      const url = `${API_BASE}/auth/profile?email=${encoded}`;
      console.log("[APIClient] calling:", url);
      const res = await fetch(url);
      console.log("[APIClient] auth profile response status:", res.status);

      // Check if response is valid
      if (!res.ok) {
        const errorText = await res.text();
        console.log("[APIClient] auth profile error text:", errorText);
        const data = errorText ? JSON.parse(errorText) : {};
        throw new Error(
          data.error || `HTTP ${res.status}: Failed to load user profile`,
        );
      }

      const text = await res.text();
      console.log(
        "[APIClient] auth profile response text:",
        text.substring(0, 100),
      );
      if (!text) throw new Error("Empty response from server");

      const data = JSON.parse(text);
      if (!data.ok)
        throw new Error(data.error || "Failed to load user profile");
      console.log("[APIClient] auth profile success:", data);
      return data;
    } catch (err) {
      console.error("[APIClient] Auth profile error:", err);
      throw err;
    }
  }

  /**
   * Persist product image URL
   * POST /api/products/{id}/image
   */
  static async updateProductImage(productId, imageUrl) {
    const res = await fetch(`${API_BASE}/products/${productId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to update product image");
    }
    return data;
  }

  /**
   * Update product metadata
   * POST /api/products/{id}
   */
  static async updateProductMetadata(productId, metadata) {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to update product");
    }
    return data;
  }

  /**
   * Create a new product
   * POST /api/products
   */
  static async createProduct(metadata) {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    const text = await res.text();
    if (!text) throw new Error("Empty response from server");
    const data = JSON.parse(text);
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to create product");
    }
    return data;
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = APIClient;
}
