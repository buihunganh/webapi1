// ============================================================
// admin.js – ShisaFood Admin Dashboard Logic
// ============================================================

// ── MOCK DATA ──
const ADMIN_DATA = {
  products: [
    { id: 1, name: 'Volcano Noodles', cat: 'noodles', price: 14.99, emoji: '🍜', available: true, tags: ['spicy','best-seller'] },
    { id: 2, name: 'Dragon Ramen',    cat: 'noodles', price: 13.49, emoji: '🫕', available: true, tags: ['spicy','new'] },
    { id: 3, name: 'Shisa Spicy Pizza', cat: 'pizza', price: 16.99, emoji: '🍕', available: true, tags: ['best-seller','spicy'] },
    { id: 4, name: 'BBQ Fire Pizza',  cat: 'pizza',   price: 17.99, emoji: '🔥', available: true, tags: ['best-seller'] },
    { id: 5, name: 'Shisa Fire Cola', cat: 'beverages',price: 3.99, emoji: '🥤', available: true, tags: ['best-seller'] },
    { id: 6, name: 'Dragon Bubble Tea',cat:'beverages',price: 5.49, emoji: '🧋', available: true, tags: ['new'] },
    { id: 7, name: 'Volcano Fries',   cat: 'sides',   price: 5.99, emoji: '🍟', available: true, tags: ['spicy','best-seller'] },
    { id: 8, name: 'Kimchi Spring Rolls',cat:'sides', price: 6.99, emoji: '🥕', available: false, tags: ['new'] },
  ],
  orders: [
    { id: '#SF-0101', customer: 'Minh Tran',   items: 'Volcano Noodles × 2, Shisa Fire Cola', total: '$32.97', shipper: 'Nguyen Van A', status: 'delivered', date: '2025-03-27 14:22' },
    { id: '#SF-0102', customer: 'Sarah K.',     items: 'BBQ Fire Pizza × 1, Bubble Tea × 2',   total: '$28.47', shipper: 'Tran Van B',   status: 'delivering', date: '2025-03-27 14:45' },
    { id: '#SF-0103', customer: 'Alex Nguyen',  items: 'Dragon Ramen × 1, Volcano Fries',      total: '$19.48', shipper: 'Le Van C',     status: 'preparing', date: '2025-03-27 15:01' },
    { id: '#SF-0104', customer: 'Thu Ha',       items: 'Shisa Spicy Pizza × 1',                total: '$16.99', shipper: '-',            status: 'pending',   date: '2025-03-27 15:18' },
    { id: '#SF-0105', customer: 'Binh Nguyen',  items: 'Kimchi Rolls × 2, Fire Cola × 1',      total: '$17.97', shipper: 'Nguyen Van A', status: 'cancelled', date: '2025-03-27 13:55' },
  ],
  users: [
    { name: 'Minh Tran',   email: 'minh@example.com',  phone: '+84 901 234 567', orders: 12, joined: '2024-03-20' },
    { name: 'Sarah K.',    email: 'sarah@example.com', phone: '+84 902 345 678', orders: 8,  joined: '2024-05-10' },
    { name: 'Alex Nguyen', email: 'alex@example.com',  phone: '+84 903 456 789', orders: 3,  joined: '2025-01-15' },
    { name: 'Thu Ha',      email: 'thuha@example.com', phone: '+84 904 567 890', orders: 5,  joined: '2024-11-02' },
  ],
  shippers: [
    { name: 'Nguyen Van A', phone: '+84 905 111 222', zone: 'Hoan Kiem', completed: 142, status: 'online' },
    { name: 'Tran Van B',   phone: '+84 906 222 333', zone: 'Dong Da',   completed: 98,  status: 'delivering' },
    { name: 'Le Van C',     phone: '+84 907 333 444', zone: 'Hai Ba Trung', completed: 67, status: 'online' },
    { name: 'Pham Thi D',   phone: '+84 908 444 555', zone: 'Tay Ho',   completed: 210, status: 'offline' },
  ],
  promos: [
    { code: 'SHISA20', discount: '20%', minOrder: '$20', used: 234, expires: '2025-12-31', active: true },
    { code: 'FIRE10',  discount: '$10', minOrder: '$35', used: 88,  expires: '2025-06-30', active: true },
    { code: 'NEWBIE',  discount: 'Free Delivery', minOrder: '$0', used: 56, expires: '2025-03-31', active: false },
  ],
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
  pending:    { label: 'Pending',  cls: 'sbadge-warning' },
  preparing:  { label: 'Preparing',   cls: 'sbadge-info' },
  delivering: { label: 'Delivering',  cls: 'sbadge-info' },
  delivered:  { label: 'Delivered',    cls: 'sbadge-success' },
  cancelled:  { label: 'Cancelled',     cls: 'sbadge-danger' },
};

const CAT_MAP = { noodles: '🍜 Noodles', pizza: '🍕 Pizza', beverages: '🥤 Beverages', sides: '🍟 Sides' };

// ── PANEL SWITCHING ──
function showPanel(id, el) {
  document.querySelectorAll('.a-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.a-nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  if (el) {
    el.classList.add('active');
  } else {
    const matched = Array.from(document.querySelectorAll('.a-nav-item')).find((item) => item.textContent.toLowerCase().includes(id));
    if (matched) matched.classList.add('active');
  }
}

// ── FILTER TABLE ──
function filterTable(tbodyId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#' + tbodyId + ' tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── STATS ──
function renderStats() {
  const maxRev = Math.max(...ADMIN_DATA.revenue.map(r => r.amount));
  const deliveredRevenue = ADMIN_DATA.orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + Number(o.total.replace('$', '')), 0);

  document.getElementById('stat-revenue').textContent = '$' + deliveredRevenue.toFixed(2);
  document.getElementById('stat-orders').textContent = ADMIN_DATA.orders.length;
  document.getElementById('stat-users').textContent = ADMIN_DATA.users.length;
  document.getElementById('stat-shippers').textContent = ADMIN_DATA.shippers.filter(s => s.status !== 'offline').length;

  // Revenue chart
  const chart = document.getElementById('revenue-chart');
  if (chart) {
    chart.innerHTML = ADMIN_DATA.revenue.map(r => `
      <div class="chart-bar-item">
        <div class="chart-bar-label">${r.day}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round(r.amount/maxRev*100)}%"></div></div>
        <div class="chart-bar-val">$${r.amount}</div>
      </div>
    `).join('');
  }
}

// ── RECENT ORDERS (Dashboard) ──
function renderRecentOrders() {
  const tbody = document.getElementById('recent-orders-body');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_DATA.orders.slice(0, 5).map(o => {
    const s = STATUS_MAP[o.status] || { label: o.status, cls: 'sbadge-info' };
    return `<tr>
      <td style="font-family:var(--font-cond);font-weight:700;color:var(--red-light)">${o.id}</td>
      <td>${o.customer}</td>
      <td style="font-size:12px;color:rgba(255,255,255,0.6);max-width:200px">${o.items}</td>
      <td style="font-family:var(--font-display);font-size:18px">${o.total}</td>
      <td><span class="sbadge ${s.cls}">${s.label}</span></td>
      <td style="font-size:12px;color:var(--gray-text)">${o.date}</td>
    </tr>`;
  }).join('');
}

// ── PRODUCTS TABLE ──
function renderProducts() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_DATA.products.map(p => `<tr>
    <td><span style="font-size:22px;margin-right:8px">${p.emoji}</span><span style="font-weight:700">${p.name}</span></td>
    <td><span style="color:var(--gray-text)">${CAT_MAP[p.cat] || p.cat}</span></td>
    <td style="font-family:var(--font-display);font-size:20px;color:var(--red-light)">$${p.price}</td>
    <td><span class="sbadge ${p.available ? 'sbadge-success' : 'sbadge-danger'}">${p.available ? '✅ In stock' : '❌ Out of stock'}</span></td>
    <td style="font-size:12px">${p.tags.map(t=>`<span class="tag tag-${t==='spicy'?'spicy':t==='new'?'new':'best'}" style="margin-right:4px">${t}</span>`).join('')}</td>
    <td><div class="abtns">
      <button class="abtn abtn-edit" onclick="editProduct(${p.id})">✏️ Edit</button>
      <button class="abtn abtn-del"  onclick="deleteProduct(${p.id})">🗑️ Delete</button>
    </div></td>
  </tr>`).join('');
}

// ── ORDERS TABLE ──
function renderOrders() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_DATA.orders.map(o => {
    const s = STATUS_MAP[o.status] || { label: o.status, cls: 'sbadge-info' };
    const shipperOptions = ['-', ...ADMIN_DATA.shippers.map(s => s.name)]
      .map((name) => `<option value="${name}" ${o.shipper === name ? 'selected' : ''}>${name}</option>`)
      .join('');

    const statusOptions = Object.entries(STATUS_MAP)
      .map(([key, val]) => `<option value="${key}" ${o.status === key ? 'selected' : ''}>${val.label}</option>`)
      .join('');

    return `<tr>
      <td style="font-family:var(--font-cond);font-weight:700;color:var(--red-light)">${o.id}</td>
      <td>${o.customer}</td>
      <td style="font-size:12px;color:rgba(255,255,255,0.6);max-width:160px">${o.items}</td>
      <td style="font-family:var(--font-display);font-size:18px">${o.total}</td>
      <td>
        <select class="form-control" style="min-width:140px" onchange="assignShipper('${o.id}', this.value)">
          ${shipperOptions}
        </select>
      </td>
      <td>
        <span class="sbadge ${s.cls}" style="margin-bottom:8px">${s.label}</span>
        <select class="form-control" style="min-width:140px" onchange="updateOrderStatus('${o.id}', this.value)">
          ${statusOptions}
        </select>
      </td>
      <td style="font-size:12px;color:var(--gray-text)">${o.date}</td>
      <td><div class="abtns">
        <button class="abtn abtn-view" onclick="showAdminToast('Order details ${o.id}: ${o.items}')">👁 View</button>
      </div></td>
    </tr>`;
  }).join('');
}

function updateOrderStatus(orderId, status) {
  const order = ADMIN_DATA.orders.find((o) => o.id === orderId);
  if (!order) return;
  order.status = status;
  renderOrders();
  renderRecentOrders();
  renderStats();
  showToast(`Updated ${orderId} to ${STATUS_MAP[status]?.label || status}`, 'success');
}

function assignShipper(orderId, shipperName) {
  const order = ADMIN_DATA.orders.find((o) => o.id === orderId);
  if (!order) return;
  order.shipper = shipperName;
  renderOrders();
  showToast(`Assigned shipper for ${orderId}`, 'success');
}

// ── USERS TABLE ──
function renderUsers() {
  const tbody = document.getElementById('users-body');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_DATA.users.map(u => `<tr>
    <td><span style="font-size:20px;margin-right:8px">👤</span><span style="font-weight:700">${u.name}</span></td>
    <td style="color:var(--gray-text)">${u.email}</td>
    <td>${u.phone}</td>
    <td style="font-family:var(--font-display);font-size:20px;color:var(--red-light)">${u.orders}</td>
    <td style="font-size:12px;color:var(--gray-text)">${u.joined}</td>
    <td><div class="abtns">
      <button class="abtn abtn-view" onclick="showAdminToast('View customer profile')">👁 View</button>
      <button class="abtn abtn-del"  onclick="showAdminToast('Confirm deleting this account?')">🗑️</button>
    </div></td>
  </tr>`).join('');
}

// ── SHIPPERS TABLE ──
function renderShippers() {
  const tbody = document.getElementById('shippers-body');
  if (!tbody) return;
  const sMap = { online: 'sbadge-success', delivering: 'sbadge-info', offline: 'sbadge-danger' };
  const sLabel = { online: '🟢 Online', delivering: '🚀 Delivering', offline: '⚫ Offline' };
  tbody.innerHTML = ADMIN_DATA.shippers.map(s => `<tr>
    <td><span style="font-size:20px;margin-right:8px">🛵</span><span style="font-weight:700">${s.name}</span></td>
    <td style="color:var(--gray-text)">${s.phone}</td>
    <td>${s.zone}</td>
    <td style="font-family:var(--font-display);font-size:20px;color:var(--gold)">${s.completed}</td>
    <td><span class="sbadge ${sMap[s.status]}">${sLabel[s.status]}</span></td>
    <td><div class="abtns">
      <button class="abtn abtn-view" onclick="showAdminToast('View shipper profile')">👁 View</button>
      <button class="abtn abtn-del"  onclick="showAdminToast('Lock shipper account?')">🔒</button>
    </div></td>
  </tr>`).join('');
}

// ── PROMOS TABLE ──
function renderPromos() {
  const tbody = document.getElementById('promos-body');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_DATA.promos.map(p => `<tr>
    <td style="font-family:var(--font-display);font-size:20px;letter-spacing:2px;color:var(--red-light)">${p.code}</td>
    <td style="font-weight:700">${p.discount}</td>
    <td style="color:var(--gray-text)">${p.minOrder}</td>
    <td style="font-family:var(--font-display);font-size:20px">${p.used}</td>
    <td style="font-size:12px;color:var(--gray-text)">${p.expires}</td>
    <td><span class="sbadge ${p.active ? 'sbadge-success' : 'sbadge-danger'}">${p.active ? '✅ Active' : '❌ Expired'}</span></td>
    <td><div class="abtns">
      <button class="abtn abtn-edit" onclick="showAdminToast('Edit promotion code')">✏️ Edit</button>
    </div></td>
  </tr>`).join('');
}

function showAdminToast(msg) {
  if (window.showToast) showToast(msg, 'info');
}

// ── PRODUCT MODAL ──
let editingId = null;
function openProductModal(id = null) {
  editingId = id;
  document.getElementById('prod-modal-title').textContent = id ? 'EDIT PRODUCT' : 'ADD PRODUCT';
  if (id) {
    const p = ADMIN_DATA.products.find(x => x.id === id);
    if (p) {
      document.getElementById('p-name').value = p.name;
      document.getElementById('p-cat').value = p.cat;
      document.getElementById('p-price').value = p.price;
      document.getElementById('p-desc').value = '';
      document.getElementById('p-emoji').value = p.emoji;
      document.getElementById('p-avail').value = String(p.available);
      document.getElementById('p-tags').value = p.tags.join(', ');
    }
  } else {
    ['p-name','p-price','p-desc','p-emoji','p-tags'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  }
  document.getElementById('product-modal').classList.remove('hidden');
}
function editProduct(id) { openProductModal(id); }
function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

function saveProduct() {
  const name  = document.getElementById('p-name').value.trim();
  const cat   = document.getElementById('p-cat').value;
  const price = parseFloat(document.getElementById('p-price').value);
  const desc  = document.getElementById('p-desc').value.trim();
  const emoji = document.getElementById('p-emoji').value.trim() || '🍜';
  const avail = document.getElementById('p-avail').value === 'true';
  const tags  = document.getElementById('p-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if (!name || isNaN(price)) { showToast('Please fill in all required fields!', 'error'); return; }
  if (editingId) {
    const p = ADMIN_DATA.products.find(x => x.id === editingId);
    if (p) Object.assign(p, { name, cat, price, desc, emoji, available: avail, tags });
    showToast('✅ Product updated successfully!', 'success');
  } else {
    ADMIN_DATA.products.push({ id: Date.now(), name, cat, price, desc, emoji, available: avail, tags });
    showToast('🎉 Product added successfully!', 'success');
  }
  closeProductModal();
  renderProducts();
  renderStats();
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  const idx = ADMIN_DATA.products.findIndex(p => p.id === id);
  if (idx > -1) {
    ADMIN_DATA.products.splice(idx, 1);
    renderProducts();
    renderStats();
    showToast('🗑️ Product deleted!', 'success');
  }
}

// ── CLOCK ──
function updateClock() {
  const el = document.getElementById('admin-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function logout() {
  if (window.showToast) showToast('Logged out. See you soon! 👋', 'info');
  setTimeout(() => { window.location.href = '/index.html'; }, 1200);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Date display
  const dateEl = document.getElementById('date-display');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  renderStats();
  renderRecentOrders();
  renderProducts();
  renderOrders();
  renderUsers();
  renderShippers();
  renderPromos();

  setInterval(updateClock, 1000);
  updateClock();
});
