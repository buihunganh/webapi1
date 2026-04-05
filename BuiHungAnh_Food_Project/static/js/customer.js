const CUSTOMER_POLLING_INTERVAL_MS = 20000;

const CUSTOMER_STATE = {
    user: {
        id: null,
        name: 'Guest',
        email: '',
        phone: '',
    },
    orders: [],
    wishlist: [],
    addresses: [],
};

const SESSION_USER_KEY = 'shisa_current_user';
const DELIVERY_PAGE_SIZE = 3;

let customerOrdersPollingHandle = null;
let customerRealtimeUnsub = null;
let orderSnapshot = new Map();
let deliveryPagination = {
    activePage: 1,
    historyPage: 1,
};
let deliveryView = 'active';

const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
const STORE_COORDS = { lat: 51.5033, lng: -0.1182 };
let trackerMap = null;
let trackerMarker = null;
let activeTrackingOrderId = null;

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
    return `$${Number(value || 0).toFixed(2)}`;
}

function formatOrderDisplayId(dbId) {
    return `#SF-${String(dbId ?? 0).padStart(4, '0')}`;
}

function normalizeOrderStatus(rawStatus) {
    const status = (rawStatus || 'pending').toLowerCase();
    if (status === 'completed') return 'delivered';
    if (status === 'shipping') return 'shipping';
    if (status === 'waiting_for_shipper') return 'preparing';
    if (status === 'cancelled') return 'cancelled';
    return 'pending';
}

function loadUserFromSession() {
    try {
        const raw = localStorage.getItem(SESSION_USER_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed) return;
        CUSTOMER_STATE.user.id = parsed.id ?? CUSTOMER_STATE.user.id;
        CUSTOMER_STATE.user.name = parsed.name || CUSTOMER_STATE.user.name;
        CUSTOMER_STATE.user.email = parsed.email || CUSTOMER_STATE.user.email;
        CUSTOMER_STATE.user.phone = parsed.phone || CUSTOMER_STATE.user.phone;
    } catch (err) {
        console.warn('Unable to load customer session:', err);
    }
}

async function loadOrdersFromAPI() {
    if (typeof APIClient === 'undefined') return;
    try {
        const items = await APIClient.getOrders(200);
        if (!Array.isArray(items)) {
            CUSTOMER_STATE.orders = [];
            return;
        }

        const currentUserId = CUSTOMER_STATE.user.id;
        const currentEmail = (CUSTOMER_STATE.user.email || '').toLowerCase();
        const belongsToCustomer = (order) => {
            if (currentUserId && Number(order.customerid) === Number(currentUserId)) {
                return true;
            }
            const orderEmail = order.customer?.email || order.customeremail;
            if (currentEmail && orderEmail) {
                return String(orderEmail).toLowerCase() === currentEmail;
            }
            return !currentUserId && !currentEmail;
        };

        CUSTOMER_STATE.orders = items
            .filter(belongsToCustomer)
            .map((order) => {
                const status = normalizeOrderStatus(order.orderstatus);
                const orderDate = order.orderdate ? new Date(order.orderdate) : null;
                const totalValue = Number(order.totalamount ?? order.subtotal ?? 0);
                return {
                    id: formatOrderDisplayId(order.orderid ?? order.id),
                    dbId: order.orderid ?? order.id,
                    total: Number.isFinite(totalValue) ? totalValue : 0,
                    date: orderDate ? orderDate.toLocaleString() : '-',
                    sortKey: orderDate ? orderDate.getTime() : 0,
                    status,
                    eta: order.estimated_delivery_time || (status === 'delivered' ? 'Delivered' : 'Processing'),
                    lat: Number(order.latitude),
                    lng: Number(order.longitude),
                    shipper_lat: Number(order.shipper_lat),
                    shipper_lng: Number(order.shipper_lng),
                };
            });

        checkActiveTracking();
    } catch (err) {
        console.warn('Failed to load customer orders:', err);
        toast(`Không thể tải đơn hàng: ${err.message || err}`, 'info');
        CUSTOMER_STATE.orders = [];
    }
}

function renderProfile() {
    const { user, orders } = CUSTOMER_STATE;
    const avatarLetter = document.getElementById('avatar-letter');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const statOrders = document.getElementById('pstat-orders');
    const statLive = document.getElementById('pstat-live');

    if (avatarLetter) avatarLetter.textContent = user.name.charAt(0).toUpperCase();
    if (profileName) profileName.textContent = user.name.toUpperCase();
    if (profileEmail) profileEmail.textContent = user.email;
    if (statOrders) statOrders.textContent = orders.length;
    if (statLive) {
        const liveCount = orders.filter((order) => order.status === 'shipping' || order.status === 'preparing').length;
        statLive.textContent = liveCount;
    }

    const nameInput = document.getElementById('s-name');
    const emailInput = document.getElementById('s-email');
    const phoneInput = document.getElementById('s-phone');
    if (nameInput) nameInput.value = user.name;
    if (emailInput) emailInput.value = user.email;
    if (phoneInput) phoneInput.value = user.phone;
}

function setDeliveryView(view) {
    deliveryView = view === 'history' ? 'history' : 'active';
    deliveryPagination.activePage = 1;
    deliveryPagination.historyPage = 1;
    renderDeliverySections();
}

function getPagedItems(items, page, pageSize) {
    const safePageSize = Math.max(1, pageSize || DELIVERY_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
    const currentPage = Math.min(Math.max(1, page || 1), totalPages);
    const startIndex = (currentPage - 1) * safePageSize;
    return {
        items: items.slice(startIndex, startIndex + safePageSize),
        page: currentPage,
        totalPages,
        totalItems: items.length,
    };
}

function renderPaginationControls(containerId, page, totalPages, onPrev, onNext) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap">
            <div style="font-size:13px;color:rgba(255,255,255,0.65)">Page ${page} / ${totalPages}</div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-ghost" style="padding:8px 12px" ${page <= 1 ? 'disabled' : ''} onclick='${onPrev}'>Previous</button>
                <button class="btn btn-ghost" style="padding:8px 12px" ${page >= totalPages ? 'disabled' : ''} onclick='${onNext}'>Next</button>
            </div>
        </div>`;
}

function renderDeliverySections() {
    const panel = document.getElementById('customer-delivery-panel');
    const activeSection = document.getElementById('delivery-active-section');
    const historySection = document.getElementById('delivery-history-section');
    const activeToggle = document.getElementById('delivery-toggle-active');
    const historyToggle = document.getElementById('delivery-toggle-history');
    const statusList = document.getElementById('delivery-status-list');
    const historyList = document.getElementById('delivery-history-list');
    const activeSummary = document.getElementById('delivery-active-summary');
    const historySummary = document.getElementById('delivery-history-summary');

    if (!panel || !statusList || !historyList) return;

    panel.style.display = '';

    const activeOrders = CUSTOMER_STATE.orders
        .filter((order) => order.status === 'pending' || order.status === 'preparing' || order.status === 'shipping')
        .sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

    const deliveredOrders = CUSTOMER_STATE.orders
        .filter((order) => order.status === 'delivered')
        .sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

    const renderEmpty = (message) => `<div class="delivery-empty">${message}</div>`;

    const activePageData = getPagedItems(activeOrders, deliveryPagination.activePage, DELIVERY_PAGE_SIZE);
    const historyPageData = getPagedItems(deliveredOrders, deliveryPagination.historyPage, DELIVERY_PAGE_SIZE);

    deliveryPagination.activePage = activePageData.page;
    deliveryPagination.historyPage = historyPageData.page;

    if (activeSummary) {
        activeSummary.textContent = String(activeOrders.length);
    }
    if (historySummary) {
        historySummary.textContent = String(deliveredOrders.length);
    }

    if (activeSection) activeSection.classList.toggle('is-hidden', deliveryView !== 'active');
    if (historySection) historySection.classList.toggle('is-hidden', deliveryView !== 'history');
    if (activeToggle) activeToggle.classList.toggle('active', deliveryView === 'active');
    if (historyToggle) historyToggle.classList.toggle('active', deliveryView === 'history');

    statusList.innerHTML = activePageData.items.length
        ? activePageData.items.map((order) => {
            const status = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
            const isLive = order.status === 'shipping' || order.status === 'preparing';
            const summaryText = isLive ? 'On the way' : 'Waiting';
            return `
            <div class="delivery-card ${isLive ? 'live-order' : ''}">
                <div class="delivery-card-head">
                    <div class="delivery-card-id">${order.id}</div>
                    <span class="sbadge ${status.cls}">${status.label}</span>
                </div>
                <div class="delivery-card-meta">${summaryText} • ${order.date}</div>
            </div>`;
        }).join('')
        : renderEmpty('No active delivery right now.');

    renderPaginationControls('delivery-active-pagination', activePageData.page, activePageData.totalPages, 'changeDeliveryPage("active", -1)', 'changeDeliveryPage("active", 1)');

    historyList.innerHTML = historyPageData.items.length
        ? historyPageData.items.map((order) => `
            <div class="delivery-card">
                <div class="delivery-card-head">
                    <div class="delivery-card-id">${order.id}</div>
                    <span class="sbadge ${ORDER_STATUS.delivered.cls}">${ORDER_STATUS.delivered.label}</span>
                </div>
                <div class="delivery-card-meta">${order.date} • ${formatMoney(order.total)}</div>
            </div>`).join('')
        : renderEmpty('No delivered orders yet.');

    renderPaginationControls('delivery-history-pagination', historyPageData.page, historyPageData.totalPages, 'changeDeliveryPage("history", -1)', 'changeDeliveryPage("history", 1)');
}

function checkActiveTracking() {
    const shippingOrder = CUSTOMER_STATE.orders.find(o => o.status === 'shipping');
    const container = document.getElementById('customer-delivery-tracker');

    if (shippingOrder) {
        if (container) container.classList.remove('is-hidden');
        initTrackerMap(shippingOrder);
    } else {
        if (container) container.classList.add('is-hidden');
        activeTrackingOrderId = null;
    }
}

function initTrackerMap(order) {
    if (activeTrackingOrderId === order.dbId) {
        updateTrackerMarker(order);
        return;
    }
    activeTrackingOrderId = order.dbId;

    if (!window.mapboxgl) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    if (!trackerMap) {
        trackerMap = new mapboxgl.Map({
            container: 'customer-tracker-map',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [order.lng || STORE_COORDS.lng, order.lat || STORE_COORDS.lat],
            zoom: 14
        });

        // 1. Store Marker (🏮)
        const storeEl = document.createElement('div');
        storeEl.className = 'store-marker';
        storeEl.style.fontSize = '30px';
        storeEl.innerHTML = '🏬';
        new mapboxgl.Marker(storeEl)
            .setLngLat([STORE_COORDS.lng, STORE_COORDS.lat])
            .addTo(trackerMap);

        // 2. House Marker (🏠) + ETA Label
        const houseEl = document.createElement('div');
        houseEl.style.textAlign = 'center';
        houseEl.innerHTML = `
            <div style="background:var(--red);color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;margin-bottom:4px;white-space:nowrap">
                ETA: ${order.eta}
            </div>
            <div style="font-size:30px">🏠</div>
        `;
        new mapboxgl.Marker(houseEl)
            .setLngLat([order.lng, order.lat])
            .addTo(trackerMap);



        // 4. Shipper Marker (🛵)
        const el = document.createElement('div');
        el.className = 'shipper-marker';
        el.innerHTML = '🛵';
        el.style.fontSize = '32px';
        el.style.zIndex = '5';

        trackerMarker = new mapboxgl.Marker(el)
            .setLngLat([order.shipper_lng || STORE_COORDS.lng, order.shipper_lat || STORE_COORDS.lat])
            .addTo(trackerMap);

        const bounds = new mapboxgl.LngLatBounds()
            .extend([STORE_COORDS.lng, STORE_COORDS.lat])
            .extend([order.lng, order.lat]);
        trackerMap.fitBounds(bounds, { padding: 50 });
    } else {
        updateTrackerMarker(order);
    }
}



function updateTrackerMarker(order) {
    if (!trackerMarker || !order.shipper_lat) return;
    trackerMarker.setLngLat([order.shipper_lng, order.shipper_lat]);

    // Auto-center (Lock screen to shipper)
    if (trackerMap) {
        trackerMap.easeTo({
            center: [order.shipper_lng, order.shipper_lat],
            duration: 2000
        });
    }
}

function changeDeliveryPage(section, delta) {
    if (section === 'active') {
        deliveryPagination.activePage += delta;
    } else if (section === 'history') {
        deliveryPagination.historyPage += delta;
    }
    renderDeliverySections();
}

function buildOrderSnapshot(orders) {
    const snap = new Map();
    orders.forEach((order) => snap.set(order.id, order.status));
    return snap;
}

function notifyOrderStatusChanges(previousSnapshot, newOrders) {
    newOrders.forEach((order) => {
        const prevStatus = previousSnapshot.get(order.id);
        if (!prevStatus || prevStatus === order.status) return;
        const statusInfo = ORDER_STATUS[order.status];
        const label = statusInfo ? statusInfo.label : order.status;
        toast(`Đơn ${order.id} hiện ${label}`, 'info');
    });
}

async function refreshCustomerOrders(notifyChanges = false) {
    const prevSnap = new Map(orderSnapshot);
    await loadOrdersFromAPI();
    renderDeliverySections();
    if (notifyChanges) {
        notifyOrderStatusChanges(prevSnap, CUSTOMER_STATE.orders);
    }
    orderSnapshot = buildOrderSnapshot(CUSTOMER_STATE.orders);
    renderProfile();
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
                <div class="addr-icon">${addr.icon || '🏠'}</div>
                <div style="flex:1">
                    <div class="addr-name">${addr.name}</div>
                    <div class="addr-text">${addr.address}</div>
                    <div class="addr-text" style="font-size:13px;margin-top:4px">${addr.note || ''}</div>
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

async function initCustomerRealtime() {
    if (!window.SupabaseWeb || typeof window.SupabaseWeb.subscribeOrders !== 'function') {
        startCustomerOrdersPolling();
        return;
    }
    try {
        await refreshCustomerOrders(false);
        initRealtimeSubscription();
    } catch (_) { }

    renderWishlist();
    renderAddresses();
    renderProfile();

    customerOrdersPollingHandle = setInterval(() => {
        refreshCustomerOrders(true);
    }, CUSTOMER_POLLING_INTERVAL_MS);
}

async function initRealtimeSubscription() {
    if (!window.SupabaseWeb || !CUSTOMER_STATE.user.id) return;
    const sb = window.SupabaseWeb.getClient();
    if (!sb) return;

    customerRealtimeUnsub = sb
        .channel('public:orders')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customerid=eq.${CUSTOMER_STATE.user.id}` }, (payload) => {
            console.log('Real-time order update:', payload.new);
            handleRealtimeUpdate(payload.new);
        })
        .subscribe();
}

function handleRealtimeUpdate(newOrder) {
    // Check if status changed
    const existingIdx = CUSTOMER_STATE.orders.findIndex(o => o.dbId === newOrder.orderid);
    if (existingIdx !== -1) {
        const oldStatus = CUSTOMER_STATE.orders[existingIdx].status;
        const newStatus = normalizeOrderStatus(newOrder.orderstatus);

        if (oldStatus !== newStatus) {
            toast(`Order ${formatOrderDisplayId(newOrder.orderid)} is now ${newStatus}!`, 'success');
        }

        // Update state
        CUSTOMER_STATE.orders[existingIdx] = {
            ...CUSTOMER_STATE.orders[existingIdx],
            status: newStatus,
            shipper_lat: Number(newOrder.shipper_lat),
            shipper_lng: Number(newOrder.shipper_lng),
            eta: newOrder.estimated_delivery_time || CUSTOMER_STATE.orders[existingIdx].eta
        };

        // 🔥 CRITICAL: Update the map tracker marker immediately
        if (newStatus === 'shipping') {
            updateTrackerMarker(CUSTOMER_STATE.orders[existingIdx]);
        }

        renderDeliverySections();
        checkActiveTracking();
    }
}

function stopCustomerOrdersPolling() {
    if (!customerOrdersPollingHandle) return;
    clearInterval(customerOrdersPollingHandle);
    customerOrdersPollingHandle = null;
}

document.addEventListener('DOMContentLoaded', async () => {
    loadUserFromSession();
    await refreshCustomerOrders(false);
    renderWishlist();
    renderAddresses();
    initCustomerRealtime();
});

window.addEventListener('beforeunload', () => {
    stopCustomerOrdersPolling();
    if (typeof customerRealtimeUnsub === 'function') {
        customerRealtimeUnsub();
    }
});
