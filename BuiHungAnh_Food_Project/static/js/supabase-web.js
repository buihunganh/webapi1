(function () {
  let client = null;
  let configCache = null;

  function resolveApiBase() {
    if (typeof window === "undefined") return "/api";

    const { protocol, hostname, port, host } = window.location;
    if (port === "5501") {
      return `${protocol}//${hostname}:5500/api`;
    }

    return `${protocol}//${host}/api`;
  }

  async function fetchConfig() {
    if (configCache) return configCache;
    const res = await fetch(`${resolveApiBase()}/config`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load Supabase config");
    }
    configCache = data;
    return configCache;
  }

  async function init() {
    if (client) return client;

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      throw new Error("Supabase browser SDK not loaded");
    }

    const cfg = await fetchConfig();
    client = window.supabase.createClient(
      cfg.supabase_url,
      cfg.supabase_publishable_key,
    );
    return client;
  }

  async function signIn(email, password) {
    const sb = await init();
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    const sb = await init();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const sb = await init();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function getSessionUser() {
    const sb = await init();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  async function subscribeOrders(onChange) {
    const sb = await init();
    const channel = sb
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (typeof onChange === "function") {
            onChange();
          }
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }

  async function fetchProductsViaRest(limit = 100) {
    const cfg = await fetchConfig();
    const url = `${cfg.supabase_url}/rest/v1/products?select=productid,productname,description,price,categoryid,isactive,imageurl,emoji,tags&order=productid.asc&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.supabase_publishable_key,
        Authorization: `Bearer ${cfg.supabase_publishable_key}`,
      },
    });

    const text = await res.text();
    if (!res.ok) {
      let errorMsg = `Supabase REST error (${res.status})`;
      if (text) {
        try {
          const errJson = JSON.parse(text);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch (_) {
          errorMsg = text;
        }
      }
      throw new Error(errorMsg);
    }

    if (!text) return [];
    return JSON.parse(text);
  }

  async function uploadProductImage(
    file,
    productId,
    bucketName = "product-images",
  ) {
    if (!file) throw new Error("No file selected");

    const sb = await init();
    const safeName = String(file.name || "image").replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    const path = `products/${productId || "new"}/${Date.now()}_${safeName}`;

    const { error } = await sb.storage.from(bucketName).upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
    });

    if (error) throw error;

    const publicResult = sb.storage.from(bucketName).getPublicUrl(path);
    const publicUrl =
      publicResult && publicResult.data ? publicResult.data.publicUrl : "";
    if (!publicUrl) {
      throw new Error("Cannot resolve public URL for uploaded image");
    }

    return { path, publicUrl, bucket: bucketName };
  }

  window.SupabaseWeb = {
    init,
    signIn,
    signUp,
    signOut,
    getSessionUser,
    subscribeOrders,
    fetchProductsViaRest,
    uploadProductImage,
  };
})();
