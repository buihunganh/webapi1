const SHIPPER_STATE = {
    profile: {
        name: 'Nguyen Van A',
        zone: 'Hoan Kiem, Ha Noi',
        isOnline: true,
        rating: 4.9,
        avgMinutes: 24,
        totalDeliveries: 142,
        totalEarnings: 1580,
    },
    newOrders: [
        {
            id: '#SF-3011',
            customer: 'Minh Tran',
            phone: '+84 901 234 567',
            pickup: 'ShisaFood - 123 Fire Street',
            dropoff: '21 Hang Bong, Hoan Kiem',
            items: ['Volcano Noodles x2', 'Fire Cola x1'],
            value: 32.97,
            fee: 2.2,
            distanceKm: 3.4,
            eta: '20 mins',
        },
        {
            id: '#SF-3012',
            customer: 'Sarah K.',
            phone: '+84 902 345 678',
            pickup: 'ShisaFood - 123 Fire Street',
            dropoff: '4 Ly Thuong Kiet, Hoan Kiem',
            items: ['BBQ Fire Pizza x1', 'Bubble Tea x2'],
            value: 28.47,
            fee: 2.6,
            distanceKm: 4.1,
            eta: '23 mins',
        },
    ],
    activeOrders: [
        {
            id: '#SF-3009',
            customer: 'Thu Ha',
            phone: '+84 904 567 890',
            pickup: 'ShisaFood - 123 Fire Street',
            dropoff: '88 Tran Hung Dao, Hoan Kiem',
            items: ['Dragon Ramen x1', 'Volcano Fries x1'],
            value: 19.48,
            fee: 1.9,
            distanceKm: 2.8,
            eta: '11 mins',
            stage: 'picked',
        },
    ],
    doneOrders: [
        {
            id: '#SF-3001',
            customer: 'Alex Nguyen',
            address: '12 Trang Thi, Hoan Kiem',
            value: 22.49,
            time: '2026-03-28 11:30',
            rating: 5,
            fee: 2.1,
        },
        {
            id: '#SF-3004',
            customer: 'Binh Nguyen',
            address: '120 Doi Can, Ba Dinh',
            value: 17.97,
            time: '2026-03-28 13:05',
            rating: 4,
            fee: 2.0,
        },
    ],
};

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

function renderStats() {
    const completedToday = SHIPPER_STATE.doneOrders.filter((o) => o.time.startsWith('2026-03-29')).length;
    const todayEarning = SHIPPER_STATE.doneOrders
        .filter((o) => o.time.startsWith('2026-03-29'))
        .reduce((sum, o) => sum + o.fee, 0);

    const nameEl = document.getElementById('s-name');
    const earningEl = document.getElementById('today-earnings');
    const completeEl = document.getElementById('completed-today');
    const totalDeliveries = document.getElementById('total-deliveries');
    const avgRating = document.getElementById('avg-rating');
    const avgTime = document.getElementById('avg-time');
    const totalEarnings = document.getElementById('total-earnings');
    const badgeNew = document.getElementById('badge-new');

    if (nameEl) nameEl.textContent = SHIPPER_STATE.profile.name.toUpperCase();
    if (earningEl) earningEl.textContent = money(todayEarning);
    if (completeEl) completeEl.textContent = `${completedToday} completed orders`;
    if (totalDeliveries) totalDeliveries.textContent = SHIPPER_STATE.profile.totalDeliveries;
    if (avgRating) avgRating.textContent = SHIPPER_STATE.profile.rating.toFixed(1);
    if (avgTime) avgTime.textContent = SHIPPER_STATE.profile.avgMinutes;
    if (totalEarnings) totalEarnings.textContent = money(SHIPPER_STATE.profile.totalEarnings);
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

function acceptOrder(orderId) {
    if (!SHIPPER_STATE.profile.isOnline) {
        shipperToast('You are offline and cannot accept orders', 'error');
        return;
    }
    const index = SHIPPER_STATE.newOrders.findIndex((o) => o.id === orderId);
    if (index < 0) return;
    const order = SHIPPER_STATE.newOrders.splice(index, 1)[0];
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

function completeOrder(orderId) {
    const index = SHIPPER_STATE.activeOrders.findIndex((o) => o.id === orderId);
    if (index < 0) return;
    const order = SHIPPER_STATE.activeOrders.splice(index, 1)[0];
    SHIPPER_STATE.profile.totalDeliveries += 1;
    SHIPPER_STATE.profile.totalEarnings += order.fee;
    SHIPPER_STATE.doneOrders.push({
        id: order.id,
        customer: order.customer,
        address: order.dropoff,
        value: order.value,
        time: '2026-03-29 12:10',
        rating: 5,
        fee: order.fee,
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

function logout() {
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

document.addEventListener('DOMContentLoaded', () => {
    renderNewOrders();
    renderActiveOrders();
    renderHistory();
    renderStats();
    setInterval(updateClock, 1000);
    updateClock();
});
