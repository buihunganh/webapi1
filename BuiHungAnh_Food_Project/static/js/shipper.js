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

const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
const STORE_COORDS = { lat: 51.5033, lng: -0.1182 }; // 10 York Road, London

let simulationMap = null;
let simulationMarker = null;
let simulationInterval = null;
let currentSimOrders = []; // Array of orders in current simulation
let isSimulating = false;
let activeSimId = 0;

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
        customer: order.customer?.fullname || `Customer #${order.customerid || '—'}`,
        phone: order.deliveryphone || 'N/A',
        pickup: '10 York Road, London SE1 7ND',
        dropoff: order.address?.fulladdress || 'Customer address',
        items: [order.items_summary || 'Order details'],
        subtotal: Number(order.subtotal || 0),
        value: Number(order.totalamount || 0),
        fee: Number(order.shippingfee || 0),
        discount: Number(order.discount || 0),
        lat: Number(order.latitude),
        lng: Number(order.longitude),
        distanceKm: order.latitude ? (calculateDistance(STORE_COORDS.lat, STORE_COORDS.lng, Number(order.latitude), Number(order.longitude))).toFixed(1) : 3,
        eta: order.estimated_delivery_time || '20 mins',
        stage: order.orderstatus === 'shipping' ? 'picked' : 'accepted',
        rawStatus: order.orderstatus || 'pending',
        time: createdAt ? createdAt.toLocaleString() : '-',
        createdAt: createdAt ? createdAt.getTime() : 0,
    };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function loadShipperOrdersFromAPI() {
    if (typeof APIClient === 'undefined') return;
    try {
        const orders = await APIClient.getOrders(400);
        if (!Array.isArray(orders) || !orders.length) return;

        const mapped = orders.map(mapApiOrder);
        const sortAsc = (list) => list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        SHIPPER_STATE.newOrders = sortAsc(
            mapped.filter((o) => o.rawStatus === 'pending')
        );
        SHIPPER_STATE.activeOrders = mapped
            .filter((o) => o.rawStatus === 'waiting_for_shipper' || o.rawStatus === 'shipping')
            .sort((a, b) => (parseFloat(a.distanceKm) || 0) - (parseFloat(b.distanceKm) || 0));
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
                        <div class="d-info-val">
                            ${money(order.subtotal)}
                            <span style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 4px">+</span>
                            ${money(order.fee)} (Fee)
                            ${order.discount > 0 ? `<span style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 4px">-</span> ${money(order.discount)} (Promo)` : ''}
                            <span style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 4px">=</span>
                            <span style="color:var(--red-light);font-weight:700">${money(order.value)}</span>
                        </div>
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
                    ${canDeliver ? `<button class="btn btn-primary" onclick="startDelivery('${order.id}')">Start Delivery</button>` : ''}
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
    const list = document.getElementById('active-orders-list');
    if (!list) return;
    if (!SHIPPER_STATE.activeOrders.length) {
        list.innerHTML = '<div class="settings-card">You have no active deliveries yet.</div>';
        return;
    }
    list.innerHTML = SHIPPER_STATE.activeOrders.map((o) => deliveryCard(o, 'active')).join('');
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
        await APIClient.updateOrderStatus(order.dbId, 'waiting_for_shipper', SHIPPER_STATE.profile.id);
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

    // Explicit UI update
    order.stage = 'picked';
    renderActiveOrders();
    shipperToast(`Picked up order ${orderId}`, 'success');
}

async function startDelivery(orderId) {
    if (isSimulating) {
        shipperToast('A delivery simulation is already in progress', 'warning');
        return;
    }

    // Find all 'picked' orders for batch delivery
    const pickedOrders = SHIPPER_STATE.activeOrders.filter(o => o.stage === 'picked');
    if (pickedOrders.length === 0) {
        shipperToast('No picked up orders to deliver', 'error');
        return;
    }

    try {
        isSimulating = true;
        // Officially start delivery in DB for all orders in batch
        for (const order of pickedOrders) {
            await APIClient.updateOrderStatus(order.dbId, 'shipping', SHIPPER_STATE.profile.id);
            order.rawStatus = 'shipping';
        }
        renderActiveOrders();
    } catch (err) {
        isSimulating = false;
        shipperToast(`Failed to start delivery: ${err.message || err}`, 'error');
        return;
    }

    currentSimOrders = pickedOrders;
    activeSimId++; // New simulation started

    const orderIds = pickedOrders.map(o => o.id).join(' & ');
    document.getElementById('sim-order-id').textContent = pickedOrders.length > 1 ? `Batch: ${orderIds}` : orderIds;
    document.getElementById('sim-eta').textContent = pickedOrders.length > 1 ? 'Multi-stop Route' : `ETA: ${pickedOrders[0].eta}`;

    document.getElementById('simulation-modal').classList.remove('hidden');
    document.getElementById('sim-complete-overlay').classList.add('is-hidden');
    document.getElementById('sim-complete-overlay').style.display = 'none';

    initSimulationMap(pickedOrders);
}

function initSimulationMap(orders) {
    if (!window.mapboxgl) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    if (simulationMap) {
        simulationMap.remove();
        simulationMap = null;
    }

    simulationMap = new mapboxgl.Map({
        container: 'simulation-map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [STORE_COORDS.lng, STORE_COORDS.lat],
        zoom: 14
    });

    // Store Marker (ShisaFood HQ)
    const storeEl = document.createElement('div');
    storeEl.className = 'store-marker';
    storeEl.style.fontSize = '32px';
    storeEl.innerHTML = '🏬';
    new mapboxgl.Marker(storeEl)
        .setLngLat([STORE_COORDS.lng, STORE_COORDS.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<h3>ShisaFood</h3><p>Order departs here</p>'))
        .addTo(simulationMap);

    // Moto Marker
    const el = document.createElement('div');
    el.className = 'shipper-marker';
    el.style.fontSize = '32px';
    el.innerHTML = '🛵';

    simulationMarker = new mapboxgl.Marker(el)
        .setLngLat([STORE_COORDS.lng, STORE_COORDS.lat])
        .addTo(simulationMap);

    // Customer Markers
    orders.forEach((order, idx) => {
        const markerEl = document.createElement('div');
        markerEl.style.fontSize = '24px';
        markerEl.innerHTML = orders.length > 1 ? (idx === 0 ? '➊' : '➋') : '🏠';
        markerEl.title = `Order ${order.id}`;

        new mapboxgl.Marker(markerEl)
            .setLngLat([order.lng, order.lat])
            .addTo(simulationMap);
    });

    fetchRoute(orders);
}

async function fetchRoute(orders) {
    // Sort destinations by distance from Store to prioritize nearest
    const sortedOrders = [...orders].sort((a, b) => {
        const distA = calculateDistance(STORE_COORDS.lat, STORE_COORDS.lng, a.lat, a.lng);
        const distB = calculateDistance(STORE_COORDS.lat, STORE_COORDS.lng, b.lat, b.lng);
        return distA - distB;
    });

    // Build waypoints: Store -> Stop1 -> Stop2
    const waypoints = [
        `${STORE_COORDS.lng},${STORE_COORDS.lat}`,
        ...sortedOrders.map(o => `${o.lng},${o.lat}`)
    ].join(';');

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!data.routes || !data.routes.length) {
            throw new Error('Could not calculate batch delivery route');
        }
        const route = data.routes[0].geometry.coordinates;

        simulationMap.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': { 'type': 'LineString', 'coordinates': route }
            }
        });

        simulationMap.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': { 'line-join': 'round', 'line-cap': 'round' },
            'paint': { 'line-color': '#e8000d', 'line-width': 4, 'line-opacity': 0.6 }
        });

        // Store sorted orders back to state to ensure animation logic knows the stop sequence
        currentSimOrders = sortedOrders;
        animateMotorbike(route, data.routes[0]);
    } catch (err) {
        console.error('[Sim] Routing error:', err);
        shipperToast(err.message, 'error');
        closeSimulation();
    }
}

function animateMotorbike(route, routeData) {
    if (!route || route.length < 2) return;

    // 1. Calculate cumulative stops
    let totalDistM = 0;
    const stopDistances = []; // Meter mark for each destination

    if (routeData && routeData.legs) {
        let currentSum = 0;
        routeData.legs.forEach((leg, i) => {
            currentSum += leg.distance;
            stopDistances.push(currentSum);
        });
        totalDistM = currentSum;
    } else {
        // Fallback for simple routes
        totalDistM = calculateDistance(route[0][1], route[0][0], route[route.length - 1][1], route[route.length - 1][0]) * 1000;
        stopDistances.push(totalDistM);
    }

    // Pre-calculate cumulative distances for each node in route for interpolation
    let cumulativeDistances = [0];
    let runningDist = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const d = calculateDistance(route[i][1], route[i][0], route[i + 1][1], route[i + 1][0]) * 1000;
        runningDist += Math.max(0, d);
        cumulativeDistances.push(runningDist);
    }

    if (totalDistM < 50) {
        shipperToast('Trip too short to simulate', 'error');
        closeSimulation();
        return;
    }

    document.getElementById('hud-total-m').textContent = totalDistM.toFixed(0);

    const speedKmh = parseFloat(document.getElementById('sim-speed-select')?.value || 40);
    const speedMs = (speedKmh * 1000) / 3600;
    const startTime = Date.now();
    let lastBackendSync = 0;
    let stopsReached = 0;

    const thisSimId = activeSimId;

    async function tick() {
        if (!isSimulating || thisSimId !== activeSimId) return;

        const elapsed = Date.now() - startTime;
        let currentDist = speedMs * (elapsed / 1000);

        // Update HUD
        const pct = Math.min(100, Math.floor((currentDist / totalDistM) * 100));
        document.getElementById('hud-pct').textContent = `${pct}%`;
        document.getElementById('hud-elapsed').textContent = `${(elapsed / 1000).toFixed(0)}s`;

        // Check intermediate stops
        if (stopsReached < stopDistances.length - 1) {
            if (currentDist >= stopDistances[stopsReached]) {
                const reachedOrder = currentSimOrders[stopsReached];
                shipperToast(`Dropped off Order ${reachedOrder.id}! Continuing...`, 'success');
                stopsReached++;
            }
        }

        // Check if finished
        if (currentDist >= totalDistM && elapsed > 1000) {
            const final = route[route.length - 1];
            simulationMarker.setLngLat(final);

            currentSimOrders.forEach(order => {
                APIClient.updateShipperLocation(order.dbId, final[1], final[0]).catch(() => { });
            });

            document.getElementById('sim-complete-overlay').classList.remove('is-hidden');
            document.getElementById('sim-complete-overlay').style.display = 'flex';
            return;
        }

        // Find segments for currentDist
        let idx = 0;
        while (idx < cumulativeDistances.length - 1 && cumulativeDistances[idx + 1] < currentDist) {
            idx++;
        }

        const p1 = route[idx];
        const p2 = route[idx + 1] || route[idx];
        const segDist = (cumulativeDistances[idx + 1] || totalDistM) - cumulativeDistances[idx];
        const distInSeg = currentDist - cumulativeDistances[idx];
        const t = segDist > 0 ? distInSeg / segDist : 0;

        const lng = p1[0] + (p2[0] - p1[0]) * t;
        const lat = p1[1] + (p2[1] - p1[1]) * t;
        const pos = [lng, lat];

        simulationMarker.setLngLat(pos);
        simulationMap.easeTo({ center: pos, duration: 80 });

        // Backend Update every 5s for all orders in batch
        if (Date.now() - lastBackendSync > 5100) {
            lastBackendSync = Date.now();
            currentSimOrders.forEach(order => {
                APIClient.updateShipperLocation(order.dbId, lat, lng).catch(() => { });
            });
        }

        simulationInterval = setTimeout(tick, 50);
    }

    tick();
}



function closeSimulation() {
    isSimulating = false;
    if (simulationInterval) clearTimeout(simulationInterval);
    document.getElementById('simulation-modal').classList.add('hidden');
}

function finishSimulation() {
    closeSimulation();
    const batch = [...currentSimOrders];
    currentSimOrders = [];
    batch.forEach(o => completeOrder(o.id));
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
