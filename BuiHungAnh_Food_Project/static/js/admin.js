const ADMIN_DATA = {
  products: [],
  orders: [],
  users: [],
  shippers: [],
  promos: [], // Will load from API
  revenue: [
    { day: 'Mon', amount: 840 },
    { day: 'Tue', amount: 1220 },
    { day: 'Wed', amount: 980 },
    { day: 'Thu', amount: 1540 },
    { day: 'Fri', amount: 1890 },
    { day: 'Sat', amount: 2340 },
    { day: 'Sun', amount: 1650 },
  ],
};

const STATUS_MAP = {
  pending: { label: 'Pending', cls: 'sbadge-warning' },
  waiting_for_shipper: { label: 'Waiting Shipper', cls: 'sbadge-warning' },
  shipping: { label: 'Shipping', cls: 'sbadge-info' },
  completed: { label: 'Completed', cls: 'sbadge-success' },
  cancelled: { label: 'Cancelled', cls: 'sbadge-danger' },
};

let unsubscribeOrdersRealtime = null;
let editingId = null;
let editingUserId = null;
let editingUserRole = 'customer';
const filterTimers = {};

function initContrastModeWatcher() {
  if (typeof window === 'undefined') return;

  const contrastQueries = [
    window.matchMedia('(forced-colors: active)'),
    window.matchMedia('(prefers-contrast: more)')
  ];

  const update = () => {
    const shouldForce = contrastQueries.some((mq) => mq && mq.matches);
    if (shouldForce) {
      document.body.classList.add('admin-contrast-mode');
    } else {
      document.body.classList.remove('admin-contrast-mode');
    }
  };

  contrastQueries.forEach((mq) => {
    if (!mq) return;
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(update);
    }
  });

  update();
}

function getAdminApiBase() {
  if (typeof window === 'undefined') return '/api';
  const { protocol, hostname, port, host } = window.location;
  if (port === '5501') return `${protocol}//${hostname}:5500/api`;
  return `${protocol}//${host}/api`;
}

async function fetchItems(path, limit = 200) {
  const url = `${getAdminApiBase()}${path}?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!text) return [];
  const data = JSON.parse(text);
  if (!res.ok) throw new Error(data.error || `Request failed: ${path}`);
  return Array.isArray(data.items) ? data.items : [];
}

async function fetchAdminUsers(role, limit = 200) {
  const params = new URLSearchParams();
  params.set('limit', limit);
  if (role) params.set('role', role);
  const url = `${getAdminApiBase()}/admin/users?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!text) return [];
  const data = JSON.parse(text);
  if (!res.ok) throw new Error(data.error || 'Request failed: admin users');
  return Array.isArray(data.items) ? data.items : [];
}

function adminToast(msg, type = 'info') {
  // Always use inline toast - never use alert() which blocks JS execution
  const icons = { default: '🔥', success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = `
    display:flex;align-items:center;gap:10px;
    background:${type==='error'?'rgba(232,0,13,0.92)':type==='success'?'rgba(34,197,94,0.92)':'rgba(30,30,30,0.95)'};
    color:#fff;padding:13px 20px;border-radius:10px;
    font-family:var(--font-cond,sans-serif);font-size:14px;font-weight:700;letter-spacing:.5px;
    box-shadow:0 4px 24px rgba(0,0,0,0.5);min-width:220px;max-width:360px;
    border:1px solid rgba(255,255,255,0.1);
    animation:fadeInUp .25s ease;
  `;
  toast.innerHTML = `<span style="font-size:18px">${icons[type] || '🔥'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; toast.style.transition = 'all .3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function formatOrderDisplayId(dbId) {
  return `#SF-${String(dbId).padStart(4, '0')}`;
}

function parseAmount(v) {
  if (typeof v === 'number') return v;
  return Number(String(v || '').replace('$', '')) || 0;
}

function mapCategory(categoryId) {
  const n = Number(categoryId);
  if (n === 1) return 'noodles';
  if (n === 2) return 'pizza';
  if (n === 3) return 'beverages';
  return 'sides';
}

function showPanel(id, el) {
  document.querySelectorAll('.a-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.a-nav-item').forEach((n) => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  if (el) el.classList.add('active');
}

function filterTable(tbodyId, query) {
  const q = String(query || '').toLowerCase();
  document.querySelectorAll('#' + tbodyId + ' tr').forEach((tr) => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function debouncedFilterTable(tbodyId, query, delay = 180) {
  clearTimeout(filterTimers[tbodyId]);
  filterTimers[tbodyId] = setTimeout(() => filterTable(tbodyId, query), delay);
}

async function loadAdminDataFromAPI() {
  try {
    console.log('[Admin] Starting data load from backend API...');

    let products = [];
    let customerUsers = [];
    let shipperUsers = [];
    let orders = [];

    // Load products, users, orders in parallel from backend
    // NOTE: We skip Supabase REST directly because publishable key is not a valid JWT anon key.
    //       All data comes from the Flask backend which uses the service role key safely.
    try {
      if (
        typeof APIClient !== 'undefined' &&
        APIClient.getProducts &&
        APIClient.getAdminUsers &&
        APIClient.getOrders
      ) {
        console.log('[Admin] Using APIClient to load all data...');
        [products, orders, customerUsers, shipperUsers] = await Promise.all([
          APIClient.getProducts(300),
          APIClient.getOrders(300),
          APIClient.getAdminUsers('customer', 300),
          APIClient.getAdminUsers('shipper', 300),
        ]);
      } else {
        console.log('[Admin] APIClient not available, using fetchItems fallback...');
        [products, orders, customerUsers, shipperUsers] = await Promise.all([
          fetchItems('/products', 300),
          fetchItems('/orders', 300),
          fetchAdminUsers('customer', 300),
          fetchAdminUsers('shipper', 300),
        ]);
      }
      console.log('[Admin] Raw API response - products:', products.length, 'customers:', customerUsers.length, 'shippers:', shipperUsers.length, 'orders:', orders.length);
    } catch (err) {
      console.error('[Admin] Failed to load data from backend:', err);
      products = products || [];
      customerUsers = customerUsers || [];
      shipperUsers = shipperUsers || [];
      orders = orders || [];
    }

    const safeDate = (value) => {
      if (!value) return '-';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '-';
      return parsed.toISOString().slice(0, 10);
    };

    // Map products
    ADMIN_DATA.products = (products || []).map((p) => ({
      id: Number(p.productid),
      name: p.productname || 'Unnamed product',
      cat: mapCategory(p.categoryid),
      price: Number(p.price || 0),
      available: p.isactive !== false,
      imageurl: p.imageurl || '',
    }));

    // Map orders first to build aggregates for users & shippers
    const ordersByCustomer = {};
    const ordersByShipper = {};

    ADMIN_DATA.orders = (orders || []).map((o) => {
      const dbId = Number(o.orderid);
      const customerId = Number(o.customerid) || null;
      const shipperId = Number(o.shipperid) || null;
      if (customerId) {
        ordersByCustomer[customerId] = (ordersByCustomer[customerId] || 0) + 1;
      }
      if (shipperId) {
        ordersByShipper[shipperId] = (ordersByShipper[shipperId] || 0) + 1;
      }
      return {
        id: formatOrderDisplayId(o.orderid),
        dbId,
        customerId,
        shipperId,
        customer: customerId ? `Customer #${customerId}` : 'Customer',
        items: o.notes || 'View order details',
        total: Number(o.totalamount || o.subtotal || 0),
        shipper: shipperId ? `Shipper #${shipperId}` : '-',
        status: o.orderstatus || 'pending',
        date: o.orderdate ? new Date(o.orderdate).toLocaleString('vi-VN') : '-',
        notes: o.notes || '',
        address: o.deliveryaddress || o.deliveryphone || '-',
      };
    });

    // Map customers & shippers from admin endpoints
    ADMIN_DATA.users = (customerUsers || []).map((u) => {
      const id = Number(u.id || u.userid);
      return {
        id,
        name: u.name || u.fullname || 'Unknown',
        email: u.email || '-',
        phone: u.phone || '-',
        roleid: 3,
        joined: safeDate(u.created_at || u.createdat),
        orders: ordersByCustomer[id] || 0,
        active: u.is_active !== false,
      };
    });

    ADMIN_DATA.shippers = (shipperUsers || []).map((u) => {
      const id = Number(u.id || u.userid);
      const active = u.is_active !== false;
      return {
        id,
        name: u.name || u.fullname || 'Unknown',
        phone: u.phone || '-',
        email: u.email || '-',
        completed: ordersByShipper[id] || 0,
        status: active ? 'online' : 'offline',
        active,
      };
    });

    console.log('[Admin] ✅ Data loaded successfully:', {
      products: ADMIN_DATA.products.length,
      users: ADMIN_DATA.users.length,
      orders: ADMIN_DATA.orders.length,
      shippers: ADMIN_DATA.shippers.length,
    });
  } catch (err) {
    console.error('[Admin] CRITICAL - Data load failed:', err);
    adminToast(`Cannot load dashboard data: ${err.message || err}`, 'error');
  }
}

function renderStats() {
  try {
    const deliveredRevenue = ADMIN_DATA.orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + parseAmount(o.total), 0);

    const statRevenue = document.getElementById('stat-revenue');
    const statOrders = document.getElementById('stat-orders');
    const statUsers = document.getElementById('stat-users');
    const statShippers = document.getElementById('stat-shippers');

    if (statRevenue) statRevenue.textContent = '$' + deliveredRevenue.toFixed(2);
    if (statOrders) statOrders.textContent = ADMIN_DATA.orders.length;
    if (statUsers) statUsers.textContent = ADMIN_DATA.users.length;
    if (statShippers) statShippers.textContent = ADMIN_DATA.shippers.length;
  } catch (err) {
    console.error('[Admin] renderStats error:', err);
  }
}

function renderRevenueChart() {
  try {
    const wrap = document.getElementById('revenue-chart');
    if (!wrap) return;
    const data = ADMIN_DATA.revenue;
    if (!data || !data.length) return;
    const max = Math.max(...data.map((d) => d.amount));
    wrap.innerHTML = data.map((d) => {
      const pct = max > 0 ? ((d.amount / max) * 100).toFixed(1) : 0;
      return `<div class="chart-bar-item">
        <div class="chart-bar-label">${d.day}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        <div class="chart-bar-val">$${d.amount.toLocaleString()}</div>
      </div>`;
    }).join('');
    console.log('[Admin] renderRevenueChart success');
  } catch (err) {
    console.error('[Admin] renderRevenueChart error:', err);
  }
}

function renderRecentOrders() {
  try {
    const tbody = document.getElementById('recent-orders-body');
    if (!tbody) {
      console.warn('[Admin] recent-orders-body element not found');
      return;
    }
    if (!ADMIN_DATA.orders || ADMIN_DATA.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No recent orders</td></tr>';
      return;
    }
    const html = ADMIN_DATA.orders.slice(0, 8).map((o) => {
      const s = STATUS_MAP[o.status] || { label: o.status, cls: 'sbadge-info' };
      return `<tr>
        <td>${o.id}</td>
        <td>${o.customer}</td>
        <td class="muted">${o.items}</td>
        <td>$${parseAmount(o.total).toFixed(2)}</td>
        <td><span class="sbadge ${s.cls}">${s.label}</span></td>
        <td class="muted">${o.date}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = html;
    console.log('[Admin] renderRecentOrders success, inserted', Math.min(ADMIN_DATA.orders.length, 8), 'rows');
  } catch (err) {
    console.error('[Admin] renderRecentOrders error:', err);
  }
}

function renderProducts() {
  try {
    const tbody = document.getElementById('products-body');
    if (!tbody) {
      console.warn('[Admin] products-body element not found');
      return;
    }
    if (!ADMIN_DATA.products || ADMIN_DATA.products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No products</td></tr>';
      return;
    }
    const html = ADMIN_DATA.products.map((p) => `<tr>
      <td>${p.name}</td>
      <td>${p.cat}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td><span class="sbadge ${p.available ? 'sbadge-success' : 'sbadge-danger'}">${p.available ? 'In stock' : 'Out of stock'}</span></td>
      <td></td>
      <td><div class="abtns">
        <button class="abtn abtn-edit" onclick="editProduct(${p.id})">Edit</button>
        <button class="abtn abtn-del" onclick="deleteProduct(${p.id})">Delete</button>
      </div></td>
    </tr>`).join('');
    tbody.innerHTML = html;
    console.log('[Admin] renderProducts success, inserted', ADMIN_DATA.products.length, 'rows');
  } catch (err) {
    console.error('[Admin] renderProducts error:', err);
  }
}

function renderOrders() {
  try {
    const tbody = document.getElementById('orders-body');
    if (!tbody) {
      console.warn('[Admin] orders-body element not found');
      return;
    }
    if (!ADMIN_DATA.orders || ADMIN_DATA.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No orders</td></tr>';
      return;
    }

    const html = ADMIN_DATA.orders.map((o) => {
      const s = STATUS_MAP[o.status] || { label: o.status, cls: 'sbadge-info' };
      const statusOptions = Object.keys(STATUS_MAP)
        .map((k) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${STATUS_MAP[k].label}</option>`)
        .join('');
      return `<tr>
        <td>${o.id}</td>
        <td>${o.customer}</td>
        <td class="muted">${o.items}</td>
        <td>$${parseAmount(o.total).toFixed(2)}</td>
        <td>${o.shipper}</td>
        <td>
          <span class="sbadge ${s.cls}">${s.label}</span>
          <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
            ${statusOptions}
          </select>
        </td>
        <td class="muted">${o.date}</td>
        <td><button class="abtn abtn-view" onclick="openOrderDetails('${o.id}')">View</button></td>
      </tr>`;
    }).join('');
    tbody.innerHTML = html;
    console.log('[Admin] renderOrders success, inserted', ADMIN_DATA.orders.length, 'rows');
  } catch (err) {
    console.error('[Admin] renderOrders error:', err);
  }
}

async function updateOrderStatus(orderId, status) {
  const order = ADMIN_DATA.orders.find((o) => o.id === orderId);
  if (!order) return;

  try {
    await APIClient.updateOrderStatus(order.dbId, status);
    order.status = status;
    renderStats();
    renderRecentOrders();
    renderOrders();
    adminToast(`Updated ${orderId}`, 'success');
  } catch (err) {
    adminToast(`Update failed: ${err.message || err}`, 'error');
    renderOrders();
  }
}

function renderUsers() {
  try {
    const tbody = document.getElementById('users-body');
    if (!tbody) {
      console.warn('[Admin] users-body element not found');
      return;
    }
    if (!ADMIN_DATA.users || ADMIN_DATA.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No users</td></tr>';
      return;
    }
    const html = ADMIN_DATA.users.map((u) => {
      const statusClass = u.active ? 'sbadge-success' : 'sbadge-danger';
      const statusLabel = u.active ? 'Active' : 'Inactive';
      const actionLabel = u.active ? 'Deactivate' : 'Activate';
      return `<tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone}</td>
        <td>${u.orders || 0}</td>
        <td>${u.joined}</td>
        <td><span class="sbadge ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="abtns">
            <button class="abtn abtn-edit" onclick="openUserModal('customer', ${u.id})">Edit</button>
            <button class="abtn ${u.active ? 'abtn-del' : 'abtn-view'}" onclick="toggleUserActive(${u.id}, ${!u.active}, 'customer')">${actionLabel}</button>
          </div>
        </td>
      </tr>`;
    }).join('');
    tbody.innerHTML = html;
    console.log('[Admin] renderUsers success, inserted', ADMIN_DATA.users.length, 'rows');
  } catch (err) {
    console.error('[Admin] renderUsers error:', err);
  }
}

function renderShippers() {
  try {
    const tbody = document.getElementById('shippers-body');
    if (!tbody) {
      console.warn('[Admin] shippers-body element not found');
      return;
    }
    if (!ADMIN_DATA.shippers || ADMIN_DATA.shippers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No shippers</td></tr>';
      return;
    }
    const html = ADMIN_DATA.shippers.map((s) => {
      const statusClass = s.active ? 'sbadge-success' : 'sbadge-danger';
      const statusLabel = s.active ? 'Online' : 'Offline';
      const actionLabel = s.active ? 'Deactivate' : 'Activate';
      return `<tr>
        <td>${s.name}</td>
        <td>${s.phone}</td>
        <td>${s.completed ?? 0}</td>
        <td><span class="sbadge ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="abtns">
            <button class="abtn abtn-edit" onclick="openUserModal('shipper', ${s.id})">Edit</button>
            <button class="abtn ${s.active ? 'abtn-del' : 'abtn-view'}" onclick="toggleUserActive(${s.id}, ${!s.active}, 'shipper')">${actionLabel}</button>
          </div>
        </td>
      </tr>`;
    }).join('');
    tbody.innerHTML = html;
    console.log('[Admin] renderShippers success, inserted', ADMIN_DATA.shippers.length, 'rows');
  } catch (err) {
    console.error('[Admin] renderShippers error:', err);
  }
}

function renderPromos() {
  const tbody = document.getElementById('promos-body');
  if (!tbody) {
    console.warn('[Admin] promos-body element not found');
    return;
  }
  if (!ADMIN_DATA.promos || !Array.isArray(ADMIN_DATA.promos) || ADMIN_DATA.promos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No promotions</td></tr>';
    return;
  }
  tbody.innerHTML = ADMIN_DATA.promos.map((p) => `<tr>
    <td>${p.code || '-'}</td>
    <td>${p.discount || '-'}</td>
    <td>${p.minOrder || '-'}</td>
    <td>${p.used || 0}</td>
    <td>${p.expires || '-'}</td>
    <td><span class="sbadge ${p.active ? 'sbadge-success' : 'sbadge-danger'}">${p.active ? 'Active' : 'Expired'}</span></td>
    <td><button class="abtn abtn-edit" onclick="showAdminToast('Promo ${p.code}')">Edit</button></td>
  </tr>`).join('');
}

function openProductModal(id = null) {
  editingId = id;
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

function editProduct(id) {
  openProductModal(id);
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  const imageInput = document.getElementById('p-image-file');
  if (imageInput) imageInput.value = '';
  modal.classList.add('hidden');
}

async function saveProduct() {
  const imageInput = document.getElementById('p-image-file');
  const file = imageInput && imageInput.files ? imageInput.files[0] : null;

  if (!file) {
    adminToast('Saved product form (no image selected).', 'success');
    closeProductModal();
    return;
  }

  if (!editingId) {
    adminToast('Please edit an existing product before uploading image.', 'info');
    return;
  }

  if (!window.SupabaseWeb || typeof window.SupabaseWeb.uploadProductImage !== 'function') {
    adminToast('Supabase Storage is not ready.', 'error');
    return;
  }

  try {
    const upload = await window.SupabaseWeb.uploadProductImage(file, editingId, 'product-images');
    await APIClient.updateProductImage(editingId, upload.publicUrl);

    const product = ADMIN_DATA.products.find((p) => p.id === Number(editingId));
    if (product) product.imageurl = upload.publicUrl;

    adminToast('Image uploaded to Supabase Storage.', 'success');
    closeProductModal();
    await loadAdminDataFromAPI();
    renderProducts();
  } catch (err) {
    adminToast(`Upload failed: ${err.message || err}`, 'error');
  }
}

function getUserCollection(role) {
  return role === 'shipper' ? ADMIN_DATA.shippers : ADMIN_DATA.users;
}

function openUserModal(role = 'customer', userId = null) {
  editingUserRole = role;
  editingUserId = userId;
  const modal = document.getElementById('user-modal');
  if (!modal) return;

  const title = document.getElementById('user-modal-title');
  const nameInput = document.getElementById('u-name');
  const emailInput = document.getElementById('u-email');
  const phoneInput = document.getElementById('u-phone');
  const passwordInput = document.getElementById('u-password');
  const badge = document.getElementById('u-status-pill');
  const submitBtn = document.getElementById('user-modal-submit');

  const roleLabel = role === 'shipper' ? 'Shipper' : 'Customer';
  if (title) title.textContent = `${userId ? 'Update' : 'Create'} ${roleLabel}`;
  if (badge) {
    badge.textContent = roleLabel;
    badge.className = `sbadge ${role === 'shipper' ? 'sbadge-info' : 'sbadge-success'}`;
  }

  const existing = userId ? getUserCollection(role).find((u) => Number(u.id) === Number(userId)) : null;
  nameInput.value = existing ? existing.name : '';
  emailInput.value = existing ? existing.email : '';
  emailInput.disabled = Boolean(existing);
  phoneInput.value = existing ? (existing.phone === '-' ? '' : existing.phone) : '';
  passwordInput.value = '';
  passwordInput.placeholder = existing ? 'Leave blank to keep current password' : 'Temp password (min 8 chars)';
  submitBtn.textContent = existing ? 'Save Changes' : 'Create User';

  modal.classList.remove('hidden');
}

function closeUserModal() {
  const modal = document.getElementById('user-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  editingUserId = null;
}

async function saveUserInfo() {
  const nameInput = document.getElementById('u-name');
  const emailInput = document.getElementById('u-email');
  const phoneInput = document.getElementById('u-phone');
  const passwordInput = document.getElementById('u-password');

  const payload = {
    role: editingUserRole,
    full_name: (nameInput.value || '').trim(),
    phone: (phoneInput.value || '').trim() || null,
  };

  if (!payload.full_name) {
    adminToast('Please enter full name', 'warning');
    return;
  }

  try {
    if (editingUserId) {
      if (passwordInput.value) {
        payload.password = passwordInput.value;
      }
      if (!emailInput.disabled) {
        payload.email = (emailInput.value || '').trim().toLowerCase();
      }
      await APIClient.updateAdminUser(editingUserId, payload);
      adminToast('User updated successfully', 'success');
    } else {
      payload.email = (emailInput.value || '').trim().toLowerCase();
      payload.password = passwordInput.value;
      if (!payload.email || !payload.password) {
        adminToast('Email và mật khẩu là bắt buộc', 'warning');
        return;
      }
      await APIClient.createAdminUser(payload);
      adminToast('User created successfully', 'success');
    }

    closeUserModal();
    await loadAdminDataFromAPI();
    renderStats();
    renderUsers();
    renderShippers();
  } catch (err) {
    adminToast(err.message || 'Operation failed', 'error');
  }
}

async function toggleUserActive(userId, shouldActivate, role = 'customer') {
  try {
    if (shouldActivate) {
      await APIClient.updateAdminUser(userId, { role, is_active: true });
      adminToast('User activated', 'success');
    } else {
      await APIClient.deactivateAdminUser(userId);
      adminToast('User deactivated', 'success');
    }
    await loadAdminDataFromAPI();
    renderStats();
    renderUsers();
    renderShippers();
  } catch (err) {
    adminToast(err.message || 'Update failed', 'error');
  }
}

function deleteProduct(id) {
  ADMIN_DATA.products = ADMIN_DATA.products.filter((p) => p.id !== id);
  renderProducts();
  adminToast('Deleted from UI list', 'success');
}

function showAdminToast(msg) {
  adminToast(msg, 'info');
}

function openOrderDetails(orderId) {
  const modal = document.getElementById('order-modal');
  if (!modal) return;
  const order = ADMIN_DATA.orders.find((o) => o.id === orderId);
  if (!order) {
    adminToast('Không tìm thấy đơn hàng', 'error');
    return;
  }
  const fields = {
    'order-detail-id': order.id,
    'order-detail-customer': order.customer,
    'order-detail-shipper': order.shipper,
    'order-detail-total': `$${parseAmount(order.total).toFixed(2)}`,
    'order-detail-status': order.status,
    'order-detail-date': order.date,
    'order-detail-items': order.items || '-',
    'order-detail-notes': order.notes || '-',
  };
  Object.keys(fields).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fields[id];
  });
  modal.classList.remove('hidden');
}

function closeOrderModal() {
  const modal = document.getElementById('order-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function updateClock() {
  const el = document.getElementById('admin-clock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function initOrdersRealtime() {
  if (!window.SupabaseWeb) return;
  try {
    unsubscribeOrdersRealtime = await window.SupabaseWeb.subscribeOrders(async () => {
      await loadAdminDataFromAPI();
      renderStats();
      renderRecentOrders();
      renderProducts();
      renderOrders();
      renderUsers();
      renderShippers();
      renderPromos();
    });
  } catch (err) {
    adminToast(`Realtime disabled: ${err.message || err}`, 'info');
  }
}

function logout() {
  adminToast('Logged out. See you soon!', 'info');
  setTimeout(() => {
    window.location.href = '/index.html';
  }, 800);
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Admin] DOMContentLoaded event fired');
  try {
    initContrastModeWatcher();
    console.log('[Admin] Calling loadAdminDataFromAPI...');
    await loadAdminDataFromAPI();
    console.log('[Admin] Data load complete, rendering...');
    
    renderStats();
    console.log('[Admin] Stats rendered');
    
    renderRevenueChart();
    console.log('[Admin] Revenue chart rendered');
    
    renderRecentOrders();
    console.log('[Admin] Recent orders rendered');
    
    renderProducts();
    console.log('[Admin] Products rendered');
    
    renderOrders();
    console.log('[Admin] Orders rendered');
    
    renderUsers();
    console.log('[Admin] Users rendered');
    
    renderShippers();
    console.log('[Admin] Shippers rendered');
    
    renderPromos();
    console.log('[Admin] Promos rendered');
    
    updateClock();
    setInterval(updateClock, 1000);
    
    console.log('[Admin] Initializing realtime subscriptions...');
    await initOrdersRealtime();
    console.log('[Admin] Dashboard fully loaded!');
  } catch (err) {
    console.error('[Admin] DOMContentLoaded error:', err);
    adminToast(`Dashboard initialization failed: ${err.message || err}`, 'error');
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeOrdersRealtime === 'function') {
    unsubscribeOrdersRealtime();
  }
});
