const CUSTOMER_STATE = {
    user: {
        id: null,
        name: 'Guest',
        email: '',
        phone: '',
        // ❌ REMOVED: dob, points, totalSaved (not in database)
    },
    orders: [], // Will load from API
    wishlist: [], // Will load from API
    addresses: [], // Will load from API
};

const SESSION_USER_KEY = 'shisa_current_user';

const ORDER_STATUS = {
    delivered: { label: '✅ Completed', cls: 'sbadge-success' },
    shipping: { label: '🚚 Delivering', cls: 'sbadge-info' },
    preparing: { label: '👨‍🍳 Preparing', cls: 'sbadge-warning' },
    pending: { label: '⏳ Waiting For Confirmation', cls: 'sbadge-warning' },
    cancelled: { label: '❌ Cancelled', cls: 'sbadge-danger' },
};

function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    alert(message);
}

function formatMoney(value) {
    return `$${Number(value).toFixed(2)}`;
}

function formatOrderDisplayId(dbId) {
    return `#SF-${String(dbId).padStart(4, '0')}`;
}

function loadUserFromSession() {
    try {
        const raw = localStorage.getItem(SESSION_USER_KEY);
        if (!raw) return;
        const user = JSON.parse(raw);
        if (!user) return;
        CUSTOMER_STATE.user.name = user.name || CUSTOMER_STATE.user.name;
        CUSTOMER_STATE.user.email = user.email || CUSTOMER_STATE.user.email;
    } catch (_) {
        // Keep default state when session data is not available.
    }
}

async function loadOrdersFromAPI() {
    if (typeof APIClient === 'undefined') return;
    try {
        const items = await APIClient.getOrders(200);
        if (!Array.isArray(items) || !items.length) return;

        CUSTOMER_STATE.orders = items.map((o) => ({
            id: formatOrderDisplayId(o.orderid),
            items: [o.notes || 'View order details'],
            total: Number(o.totalamount || 0),
            date: o.orderdate ? new Date(o.orderdate).toLocaleString() : '-',
            status: o.orderstatus === 'completed'
                ? 'delivered'
                : o.orderstatus === 'shipping'
                ? 'shipping'
                : o.orderstatus === 'waiting_for_shipper'
                ? 'preparing'
                : o.orderstatus || 'pending',
            eta: o.orderstatus === 'completed' ? 'Delivered' : 'Processing',
        }));
    } catch (err) {
        toast(`Using local order data: ${err.message || err}`, 'info');
    }
}

function switchTab(tab, button) {
    document.querySelectorAll('.cust-tab').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.c-panel').forEach((el) => el.classList.remove('active'));

    if (button) button.classList.add('active');
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.classList.add('active');
}

function renderProfile() {
    const { user, orders } = CUSTOMER_STATE;
    const avatarLetter = document.getElementById('avatar-letter');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const statOrders = document.getElementById('pstat-orders');

    if (avatarLetter) avatarLetter.textContent = user.name.charAt(0).toUpperCase();
    if (profileName) profileName.textContent = user.name.toUpperCase();
    if (profileEmail) profileEmail.textContent = user.email;
    if (statOrders) statOrders.textContent = orders.length;
    // ❌ REMOVED: points and totalSaved display (not in database)

    const nameInput = document.getElementById('s-name');
    const emailInput = document.getElementById('s-email');
    const phoneInput = document.getElementById('s-phone');

    if (nameInput) nameInput.value = user.name;
    if (emailInput) emailInput.value = user.email;
    if (phoneInput) phoneInput.value = user.phone;
    // ❌ REMOVED: dob input (not in database)
}}

function renderOrders() {
    const list = document.getElementById('orders-list');
    if (!list) return;

    const sorted = [...CUSTOMER_STATE.orders].sort((a, b) => b.date.localeCompare(a.date));

    list.innerHTML = sorted
        .map((o) => {
            const status = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            const canCancel = o.status === 'pending' || o.status === 'preparing';
            return `
            <div class="order-card fade-in">
                <div class="order-card-top">
                    <div class="order-id">${o.id}</div>
                    <span class="sbadge ${status.cls}">${status.label}</span>
                </div>
                <div class="order-items">${o.items.join(' • ')}</div>
                <div class="order-footer">
                    <div>
                        <div class="order-total">${formatMoney(o.total)}</div>
                        <div class="order-date">${o.date} • ETA: ${o.eta}</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn btn-outline" style="padding:8px 12px" onclick="trackOrder('${o.id}')">Track</button>
                        <button class="btn btn-ghost" style="padding:8px 12px" onclick="reorder('${o.id}')">Reorder</button>
                        ${canCancel ? `<button class="btn" style="padding:8px 12px;background:rgba(232,0,13,0.12);color:var(--red-light);border:1px solid rgba(232,0,13,0.2)" onclick="cancelOrder('${o.id}')">Cancel Order</button>` : ''}
                    </div>
                </div>
            </div>`;
        })
        .join('');
}

function renderWishlist() {
    const grid = document.getElementById('wishlist-grid');
    if (!grid) return;

    if (!CUSTOMER_STATE.wishlist.length) {
        grid.innerHTML = '<div class="settings-card" style="grid-column:1/-1">Your wishlist is currently empty.</div>';
        return;
    }

    grid.innerHTML = CUSTOMER_STATE.wishlist
        .map(
            (item) => `
        <div class="wish-card">
            <div class="wish-img">${item.emoji}</div>
            <div class="wish-body">
                <div class="wish-name">${item.name}</div>
                <div class="wish-price">${formatMoney(item.price)}</div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-primary" style="padding:8px 12px" onclick="addWishlistToCart(${item.id})">Add To Cart</button>
                    <button class="btn btn-outline" style="padding:8px 12px" onclick="removeWishlist(${item.id})">Remove</button>
                </div>
            </div>
        </div>`
        )
        .join('');
}

function renderAddresses() {
    const list = document.getElementById('address-list');
    if (!list) return;

    list.innerHTML = CUSTOMER_STATE.addresses
        .map(
            (addr) => `
            <div class="addr-card">
                <div class="addr-icon">${addr.icon}</div>
                <div style="flex:1">
                    <div class="addr-name">${addr.name}</div>
                    <div class="addr-text">${addr.address}</div>
                    <div class="addr-text" style="font-size:13px;margin-top:4px">${addr.note}</div>
                    ${addr.isDefault ? '<span class="addr-default">DEFAULT</span>' : ''}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                    ${!addr.isDefault ? `<button class="btn btn-outline" style="padding:8px 12px" onclick="setDefaultAddress(${addr.id})">Set As Default</button>` : ''}
                    <button class="btn btn-ghost" style="padding:8px 12px" onclick="editAddress(${addr.id})">Edit</button>
                    <button class="btn" style="padding:8px 12px;background:rgba(232,0,13,0.12);color:var(--red-light);border:1px solid rgba(232,0,13,0.2)" onclick="removeAddress(${addr.id})">Delete</button>
                </div>
            </div>`
        )
        .join('');
}

function trackOrder(orderId) {
    const order = CUSTOMER_STATE.orders.find((o) => o.id === orderId);
    if (!order) return;
    toast(`Order ${orderId}: ${ORDER_STATUS[order.status]?.label || order.status} - ETA ${order.eta}`, 'info');
}

function reorder(orderId) {
    const order = CUSTOMER_STATE.orders.find((o) => o.id === orderId);
    if (!order) return;
    toast(`Items from ${orderId} have been added to your cart`, 'success');
}

function cancelOrder(orderId) {
    const order = CUSTOMER_STATE.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.status !== 'pending' && order.status !== 'preparing') {
        toast('This order cannot be cancelled', 'error');
        return;
    }
    order.status = 'cancelled';
    order.eta = 'Cancelled';
    renderOrders();
    toast(`Order ${orderId} has been cancelled`, 'success');
}

function addWishlistToCart(productId) {
    const item = CUSTOMER_STATE.wishlist.find((w) => w.id === productId);
    if (!item) return;
    toast(`${item.name} has been added to cart`, 'success');
}

function removeWishlist(productId) {
    const index = CUSTOMER_STATE.wishlist.findIndex((w) => w.id === productId);
    if (index < 0) return;
    const removed = CUSTOMER_STATE.wishlist.splice(index, 1)[0];
    renderWishlist();
    toast(`${removed.name} has been removed from wishlist`, 'info');
}

function setDefaultAddress(addressId) {
    CUSTOMER_STATE.addresses.forEach((addr) => {
        addr.isDefault = addr.id === addressId;
    });
    renderAddresses();
    toast('Default address updated successfully', 'success');
}

function editAddress(addressId) {
    const addr = CUSTOMER_STATE.addresses.find((a) => a.id === addressId);
    if (!addr) return;
    toast(`Edit address: ${addr.name}`, 'info');
}

function removeAddress(addressId) {
    const addr = CUSTOMER_STATE.addresses.find((a) => a.id === addressId);
    if (!addr) return;
    if (addr.isDefault) {
        toast('Cannot delete the default address', 'error');
        return;
    }
    CUSTOMER_STATE.addresses = CUSTOMER_STATE.addresses.filter((a) => a.id !== addressId);
    renderAddresses();
    toast('Address deleted successfully', 'success');
}

function saveSettings() {
    const name = document.getElementById('s-name')?.value.trim();
    const email = document.getElementById('s-email')?.value.trim();
    const phone = document.getElementById('s-phone')?.value.trim();
    // ✗ REMOVED: dob (not in database)

    if (!name || !email || !phone) {
        toast('Please fill in all required information', 'error');
        return;
    }

    Object.assign(CUSTOMER_STATE.user, { name, email, phone });
    renderProfile();
    toast('Profile updated successfully', 'success');
}

function openCartSidebar() {
    if (typeof window.openCart === 'function') {
        window.openCart();
        return;
    }
    toast('Cart feature will be connected to backend soon', 'info');
}

function logout() {
    toast('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 800);
}

document.addEventListener('DOMContentLoaded', async () => {
    loadUserFromSession();
    await loadOrdersFromAPI();
    renderProfile();
    renderOrders();
    renderWishlist();
    renderAddresses();
});
