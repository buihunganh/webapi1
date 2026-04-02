const MAX_ACTIVE_ORDERS = 2;
const POLLING_INTERVAL_MS = 20000;

const SHIPPER_STATE = {
    profile: {
        name: 'Shipper',
        isOnline: true,
    },
    newOrders: [], // Will load from API
    activeOrders: [], // Will load from API
    doneOrders: [], // Will load from API
};

const SESSION_USER_KEY = 'shisa_current_user';
const SESSION_STORAGE_KEY = 'shisa_current_user_email';

let unsubscribeOrdersRealtime = null;
let ordersPollingHandle = null;

function shipperToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    alert(message);
}

function money(v) {
    return `$${Number(v).toFixed(2)}`;
}

function formatOrderDisplayId(dbId) {
    return `#SF-${String(dbId).padStart(4, '0')}`;
}

function mapApiOrder(order) {
    const createdAt = order.orderdate ? new Date(order.orderdate) : null;
    return {
        dbId: Number(order.orderid),
        id: formatOrderDisplayId(order.orderid),
        customer: order.customerid ? `Customer #${order.customerid}` : 'Customer',
        phone: order.deliveryphone || 'N/A',
        pickup: 'ShisaFood - 123 Fire Street',
        dropoff: order.addressid ? `Address #${order.addressid}` : 'Customer address',
        items: [order.notes || 'View order details'],
        value: Number(order.totalamount || 0),
        fee: Number(order.shippingfee || 0),
        distanceKm: 3,
        eta: '20 mins',
        stage: 'picked',
        rawStatus: order.orderstatus || 'pending',
        time: createdAt ? createdAt.toLocaleString() : '-',
        createdAt: createdAt ? createdAt.getTime() : 0,
    };
}

async function loadShipperOrdersFromAPI() {
    if (typeof APIClient === 'undefined') return;
    try {
        const orders = await APIClient.getOrders(400);
        if (!Array.isArray(orders) || !orders.length) return;

        const mapped = orders.map(mapApiOrder);
        const sortAsc = (list) => list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        SHIPPER_STATE.newOrders = sortAsc(
            mapped.filter((o) => o.rawStatus === 'pending' || o.rawStatus === 'waiting_for_shipper')
        );
        SHIPPER_STATE.activeOrders = sortAsc(
            mapped
                .filter((o) => o.rawStatus === 'shipping')
                .map((o) => ({ ...o, stage: 'picked', eta: '10 mins' }))
        );
        SHIPPER_STATE.doneOrders = mapped
            .filter((o) => o.rawStatus === 'completed')
            .map((o) => ({
                id: o.id,
                customer: o.customer,
                address: o.dropoff,
                value: o.value,
                time: o.time,
                rating: 5,
                fee: o.fee,
                createdAt: o.createdAt,
            }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (err) {
        shipperToast(`Using local fallback data: ${err.message || err}`, 'info');
    }
}

async function initOrdersRealtime() {
    if (!window.SupabaseWeb || typeof window.SupabaseWeb.subscribeOrders !== 'function') {
        shipperToast('Supabase realtime unavailable, falling back to polling', 'info');
        startOrdersPolling();
        return;
    }
    try {
        unsubscribeOrdersRealtime = await window.SupabaseWeb.subscribeOrders(async () => {
            await loadShipperOrdersFromAPI();
            renderNewOrders();
            renderActiveOrders();
            renderHistory();
            renderStats();
        });
        stopOrdersPolling();
    } catch (err) {
        shipperToast(`Realtime disabled: ${err.message || err}`, 'info');
        startOrdersPolling();
    }
}

function startOrdersPolling() {
    if (ordersPollingHandle) return;
    ordersPollingHandle = setInterval(async () => {
        await loadShipperOrdersFromAPI();
        renderNewOrders();
        renderActiveOrders();
        renderHistory();
        renderStats();
    }, POLLING_INTERVAL_MS);
}

function stopOrdersPolling() {
    if (!ordersPollingHandle) return;
    clearInterval(ordersPollingHandle);
    ordersPollingHandle = null;
}

function renderStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const completedToday = SHIPPER_STATE.doneOrders.filter((o) => (o.createdAt || 0) >= startOfDay && (o.createdAt || 0) < endOfDay).length;
    const todayEarning = SHIPPER_STATE.doneOrders
        .filter((o) => (o.createdAt || 0) >= startOfDay && (o.createdAt || 0) < endOfDay)
        .reduce((sum, o) => sum + o.fee, 0);
    
    // Calculate lifetime stats from doneOrders
    const totalDeliveries = SHIPPER_STATE.doneOrders.length;
    const avgRatingValue = SHIPPER_STATE.doneOrders.length > 0
        ? (SHIPPER_STATE.doneOrders.reduce((sum, o) => sum + (o.rating || 4), 0) / SHIPPER_STATE.doneOrders.length)
        : 4.5;

    const nameEl = document.getElementById('s-name');
    const earningEl = document.getElementById('today-earnings');
    const completeEl = document.getElementById('completed-today');
    const totalDeliveriesEl = document.getElementById('total-deliveries');
    const avgRatingEl = document.getElementById('avg-rating');
    const totalEarningsEl = document.getElementById('total-earnings');
    const badgeNew = document.getElementById('badge-new');

    if (nameEl) nameEl.textContent = SHIPPER_STATE.profile.name.toUpperCase();
    if (earningEl) earningEl.textContent = money(todayEarning);
    if (completeEl) completeEl.textContent = `${completedToday} completed orders`;
    if (totalDeliveriesEl) totalDeliveriesEl.textContent = totalDeliveries;
    if (avgRatingEl) avgRatingEl.textContent = avgRatingValue.toFixed(1);
    if (totalEarningsEl) totalEarningsEl.textContent = money(SHIPPER_STATE.doneOrders.reduce((sum, o) => sum + (o.fee || 0), 0));
    if (badgeNew) badgeNew.textContent = SHIPPER_STATE.newOrders.length;
}

function deliveryCard(order, mode) {
    const isNew = mode === 'new';
    const canPickup = mode === 'active' && order.stage === 'accepted';
    const canDeliver = mode === 'active' && order.stage === 'picked';
    return `
        <div class="delivery-card">
            <div class="delivery-card-header">
                <div class="delivery-order-id">${order.id}</div>
                <span class="sbadge ${isNew ? 'sbadge-warning' : 'sbadge-info'}">${isNew ? 'New Order' : canDeliver ? 'In Delivery' : 'Accepted'}</span>
            </div>
            <div class="delivery-card-body">
                <div class="delivery-info-grid">
                    <div class="d-info-block">
                        <div class="d-info-label">Customer</div>
                        <div class="d-info-val">${order.customer} • ${order.phone}</div>
                    </div>
                    <div class="d-info-block">
                        <div class="d-info-label">Order Value</div>
                        <div class="d-info-val">${money(order.value)} • Delivery fee ${money(order.fee)}</div>
                    </div>
                    <div class="d-info-block">
                        <div class="d-info-label">Pickup</div>
                        <div class="d-info-val">${order.pickup}</div>
                    </div>
                    <div class="d-info-block">
                        <div class="d-info-label">Dropoff</div>
                        <div class="d-info-val">${order.dropoff} • ${order.distanceKm} km • ETA ${order.eta}</div>
                    </div>
                </div>
                <div class="delivery-items">
                    <div class="delivery-items-title">Order Items</div>
                    ${order.items.join(' • ')}
                </div>
                <div class="delivery-actions">
                    ${isNew ? `<button class="btn btn-primary" onclick="acceptOrder('${order.id}')">Accept</button>
                    <button class="btn btn-outline" onclick="rejectOrder('${order.id}')">Skip</button>` : ''}
                    ${canPickup ? `<button class="btn btn-primary" onclick="pickupOrder('${order.id}')">Picked Up</button>` : ''}
                    ${canDeliver ? `<button class="btn btn-primary" onclick="completeOrder('${order.id}')">Delivered</button>` : ''}
                    <button class="btn btn-ghost" onclick="callCustomer('${order.phone}')">Call Customer</button>
                    <button class="btn btn-outline" onclick="navigateOrder('${order.id}')">Navigate</button>
                </div>
            </div>
        </div>`;
}

function renderNewOrders() {
    const panel = document.getElementById('stab-new');
    if (!panel) return;
    if (!SHIPPER_STATE.newOrders.length) {
        panel.innerHTML = '<div class="settings-card">No new orders in your delivery zone.</div>';
        return;
    }
    panel.innerHTML = SHIPPER_STATE.newOrders.map((o) => deliveryCard(o, 'new')).join('');
}

function renderActiveOrders() {
    const panel = document.getElementById('stab-active');
    if (!panel) return;
    if (!SHIPPER_STATE.activeOrders.length) {
        panel.innerHTML = '<div class="settings-card">You have no active deliveries yet.</div>';
        return;
    }
    panel.innerHTML = SHIPPER_STATE.activeOrders.map((o) => deliveryCard(o, 'active')).join('');
}

function renderHistory() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    tbody.innerHTML = SHIPPER_STATE.doneOrders
        .slice()
        .reverse()
        .map(
            (o) => `
            <tr>
                <td style="font-family:var(--font-cond);font-weight:700;color:var(--red-light)">${o.id}</td>
                <td>${o.customer}</td>
                <td style="color:var(--gray-text)">${o.address}</td>
                <td>${money(o.value)}</td>
                <td style="font-size:12px;color:var(--gray-text)">${o.time}</td>
                <td>${'⭐'.repeat(o.rating)}</td>
            </tr>`
        )
        .join('');
}

function switchShipTab(tab, button) {
    document.querySelectorAll('.s-tab').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.s-panel').forEach((el) => el.classList.remove('active'));
    if (button) button.classList.add('active');
    const panel = document.getElementById(`stab-${tab}`);
    if (panel) panel.classList.add('active');
}

function toggleStatus() {
    const checked = document.getElementById('status-toggle')?.checked;
    SHIPPER_STATE.profile.isOnline = Boolean(checked);
    const label = document.getElementById('status-label');
    if (label) {
        label.textContent = checked ? '🟢 ONLINE' : '⚫ OFFLINE';
    }
    shipperToast(checked ? 'You are now online' : 'You are now offline', 'info');
}

async function acceptOrder(orderId) {
    if (!SHIPPER_STATE.profile.isOnline) {
        shipperToast('You are offline and cannot accept orders', 'error');
        return;
    }
    if (SHIPPER_STATE.activeOrders.length >= MAX_ACTIVE_ORDERS) {
        shipperToast(`Bạn chỉ được nhận tối đa ${MAX_ACTIVE_ORDERS} đơn cùng lúc`, 'error');
        return;
    }
    const index = SHIPPER_STATE.newOrders.findIndex((o) => o.id === orderId);
    if (index < 0) return;
    const order = SHIPPER_STATE.newOrders.splice(index, 1)[0];
    try {
        await APIClient.updateOrderStatus(order.dbId, 'shipping');
    } catch (err) {
        SHIPPER_STATE.newOrders.splice(index, 0, order);
        shipperToast(`Accept failed: ${err.message || err}`, 'error');
        return;
    }
    order.stage = 'accepted';
    SHIPPER_STATE.activeOrders.unshift(order);
    renderNewOrders();
    renderActiveOrders();
    renderStats();
    shipperToast(`Order ${orderId} accepted`, 'success');
}

function rejectOrder(orderId) {
    SHIPPER_STATE.newOrders = SHIPPER_STATE.newOrders.filter((o) => o.id !== orderId);
    renderNewOrders();
    renderStats();
    shipperToast(`Order ${orderId} skipped`, 'info');
}

function pickupOrder(orderId) {
    const order = SHIPPER_STATE.activeOrders.find((o) => o.id === orderId);
    if (!order) return;
    order.stage = 'picked';
    renderActiveOrders();
    shipperToast(`Picked up order ${orderId}`, 'success');
}

async function completeOrder(orderId) {
    const index = SHIPPER_STATE.activeOrders.findIndex((o) => o.id === orderId);
    if (index < 0) return;
    const order = SHIPPER_STATE.activeOrders.splice(index, 1)[0];
    try {
        await APIClient.updateOrderStatus(order.dbId, 'completed');
    } catch (err) {
        SHIPPER_STATE.activeOrders.splice(index, 0, order);
        shipperToast(`Complete failed: ${err.message || err}`, 'error');
        return;
    }
    SHIPPER_STATE.doneOrders.push({
        id: order.id,
        customer: order.customer,
        address: order.dropoff,
        value: order.value,
        time: new Date().toLocaleString(),
        rating: 5,
        fee: order.fee,
        createdAt: Date.now(),
    });

    renderActiveOrders();
    renderHistory();
    renderStats();
    shipperToast(`Order ${orderId} has been completed`, 'success');
}

function callCustomer(phone) {
    shipperToast(`Calling ${phone}`, 'info');
}

function navigateOrder(orderId) {
    shipperToast(`Opening navigation for ${orderId}`, 'info');
}

async function logout() {
    try {
        if (window.SupabaseWeb && typeof window.SupabaseWeb.signOut === 'function') {
            await window.SupabaseWeb.signOut();
        }
    } catch (err) {
        console.warn('[Shipper] Supabase signOut failed:', err);
    }

    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(SESSION_USER_KEY);
    } catch (err) {
        console.warn('[Shipper] Failed to clear session storage:', err);
    }

    shipperToast('Shipper account logged out', 'info');
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 800);
}

function updateClock() {
    const el = document.getElementById('s-clock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadShipperOrdersFromAPI();
    renderNewOrders();
    renderActiveOrders();
    renderHistory();
    renderStats();
    setInterval(updateClock, 1000);
    updateClock();
    await initOrdersRealtime();
});

window.addEventListener('beforeunload', () => {
    if (typeof unsubscribeOrdersRealtime === 'function') {
        unsubscribeOrdersRealtime();
    }
    stopOrdersPolling();
});
