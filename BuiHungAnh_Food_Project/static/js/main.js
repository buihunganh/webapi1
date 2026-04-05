// ========== DATA STORE ==========
let state = {
  currentUser: null,
  cart: [],
  selectedPayment: 'cod',
  selectedReviewStar: 5,
  currentProduct: null,
  detailQty: 1,
  currentFilter: 'all',
  currentPage: 1,
  perPage: 8,
  priceMin: 0,
  priceMax: 9999,
  searchQuery: '',
  promoApplied: null,
  shippingInfo: {
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    notes: '',
    calculatedFee: 0,
    distance: 0,
  },
  isCalculatingFee: false,
};

const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
if (window.mapboxgl) {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
}
const STORE_COORDS = { lat: 51.5033, lng: -0.1182 };
let checkoutMap = null;
let checkoutMarker = null;
let geocoder = null;

/**
 * Initialize Footer Mapbox
 */
function initFooterMap() {
  const container = document.getElementById('footer-map-canvas');
  if (!container || !window.mapboxgl) return;

  const footerMap = new mapboxgl.Map({
    container: 'footer-map-canvas',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [STORE_COORDS.lng, STORE_COORDS.lat],
    zoom: 15,
    scrollZoom: false,
    attributionControl: false
  });

  // Add custom marker
  const el = document.createElement('div');
  el.className = 'store-marker';

  new mapboxgl.Marker(el)
    .setLngLat([STORE_COORDS.lng, STORE_COORDS.lat])
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<h3>ShisaFood</h3><p>Bold flavors, explosive spice.</p>'))
    .addTo(footerMap);

  footerMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
}
let isPlacingOrder = false;

function formatOrderDisplayId(orderId) {
  const numeric = parseInt(orderId, 10);
  if (Number.isNaN(numeric)) {
    return orderId || '#SF-0001';
  }
  return `#SF-${String(numeric).padStart(4, '0')}`;
}

function getAppBaseUrl() {
  const { protocol, hostname, port, host } = window.location;
  if (port === '5501') {
    return `${protocol}//${hostname}:5500`;
  }
  return `${protocol}//${host}`;
}

const PROMOS = {
  'SHISA20': { type: 'percent', value: 20, min: 20, desc: '20% off' },
  'FIRE10': { type: 'flat', value: 10, min: 35, desc: '$10 off' },
  'NEWBIE': { type: 'delivery', value: 2.99, min: 0, desc: 'Free delivery' },
};

const CATEGORIES = [
  { id: 'noodles', name: 'Noodles', icon: '🍜', desc: 'Spicy Noodles' },
  { id: 'pizza', name: 'Pizza', icon: '🍕', desc: 'Signature Pizzas' },
  { id: 'beverages', name: 'Beverages', icon: '🥤', desc: 'Drinks & More' },
  { id: 'sides', name: 'Sides', icon: '🍟', desc: 'Side Dishes' },
];

let PRODUCTS = []; // Will be loaded from API

const USERS_STORAGE_KEY = 'shisa_users';
const SESSION_STORAGE_KEY = 'shisa_current_user_email';
const SESSION_USER_KEY = 'shisa_current_user';

let USERS = []; // Will be loaded from API

function saveUsersToStorage() {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(USERS));
}

function loadUsersFromStorage() {
  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) {
    saveUsersToStorage();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      USERS = parsed;
    }
  } catch (e) {
    saveUsersToStorage();
  }
}

function restoreSession() {
  const raw = localStorage.getItem(SESSION_USER_KEY);
  if (!raw) return;
  let user = null;
  try {
    user = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!user) return;
  state.currentUser = user;
  onLoginSuccess(false);
}

async function restoreSupabaseSession() {
  if (state.currentUser || !window.SupabaseWeb) return;
  try {
    const sbUser = await window.SupabaseWeb.getSessionUser();
    if (!sbUser || !sbUser.email) return;
    const profile = await resolveProfileByEmail(sbUser.email);
    state.currentUser = profile;
    onLoginSuccess(false);
  } catch (err) {
    console.warn('Cannot restore Supabase session:', err);
  }
}

async function resolveProfileByEmail(email) {
  try {
    const profileData = await APIClient.getAuthProfile(email);
    if (profileData && profileData.ok && profileData.user) {
      return profileData.user;
    }
  } catch (_) {
    // Use fallback profile below.
  }
  return {
    id: null,
    name: email.split('@')[0],
    email,
    phone: null,
    role: 'customer',
    role_id: 3,
  };
}

let ORDERS = []; // Will be loaded from API

let COMBOS = []; // Will be loaded from API

// ========== API DATA LOADING ==========
/**
 * Load products dari backend API
 * Fallback ke hardcoded data jika API gagal
 */
async function loadProductsFromAPI() {
  try {
    let apiProducts = [];

    if (window.SupabaseWeb && typeof window.SupabaseWeb.fetchProductsViaRest === 'function') {
      try {
        apiProducts = await window.SupabaseWeb.fetchProductsViaRest(100);
        console.log('Loaded ' + apiProducts.length + ' products from Supabase REST');
      } catch (sbErr) {
        console.warn('Supabase REST products failed, fallback to backend API:', sbErr);
      }
    }

    if (!apiProducts || !apiProducts.length) {
      apiProducts = await APIClient.getProducts(100);
    }

    if (apiProducts && apiProducts.length > 0) {
      // Map API products ke format UI
      PRODUCTS = apiProducts.map((p, idx) => ({
        id: p.productid || idx + 1,
        name: p.productname || 'Unnamed product',
        cat: p.categoryid === 1 ? 'noodles' : p.categoryid === 2 ? 'pizza' : p.categoryid === 3 ? 'beverages' : 'sides',
        price: parseFloat(p.price || 0),
        emoji: p.emoji || '🍕', // Use emoji from database, fallback to default
        desc: p.description || '',
        tags: p.tags ? (typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()) : p.tags) : [],
        available: p.isactive !== false,
        rating: 4.5,
        reviews: [],
        imageurl: p.imageurl || '', // Include image URL from database
      }));
      console.log('✅ Loaded ' + PRODUCTS.length + ' products from API');
    }
  } catch (err) {
    console.warn('⚠️ Failed to load products from API, using hardcoded data:', err);
  }
}

/**
 * Load users dari backend API
 * Fallback ke hardcoded data jika API gagal
 */
async function loadUsersFromAPI() {
  try {
    const apiUsers = await APIClient.getUsers(100);
    if (apiUsers && apiUsers.length > 0) {
      USERS = apiUsers.map(u => ({
        id: u.userid,
        name: u.fullname,
        email: u.email,
        role: u.roleid === 1 ? 'admin' : u.roleid === 2 ? 'shipper' : 'customer',
        orders: [],
        joined: u.createdat ? new Date(u.createdat).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      }));
      console.log('✅ Loaded ' + USERS.length + ' users from API');
    }
  } catch (err) {
    console.warn('⚠️ Failed to load users from API, using hardcoded data:', err);
  }
}

async function loadOrdersFromAPI() {
  try {
    const apiOrders = await APIClient.getOrders(200);
    if (Array.isArray(apiOrders) && apiOrders.length) {
      ORDERS = apiOrders.map(mapApiOrderToRow);
    }
  } catch (err) {
    console.warn('⚠️ Failed to load orders from API, using local data:', err);
  }
}

function mapApiOrderToRow(row) {
  if (!row) {
    return {
      id: formatOrderDisplayId(Date.now()),
      customer: 'Customer',
      items: '—',
      total: 0,
      status: 'pending',
      date: new Date().toLocaleString(),
    };
  }
  const customerInfo = row.customer || {};
  const customerLabel = customerInfo.fullname || row.customername || customerInfo.name || `Customer #${row.customerid || '—'}`;
  const status = (row.orderstatus || row.status || 'pending').toLowerCase();
  const itemsText = row.items_summary || row.notes || 'See details';
  let totalVal = 0;
  if (typeof row.totalamount !== 'undefined') totalVal = Number(row.totalamount);
  else if (typeof row.subtotal !== 'undefined') totalVal = Number(row.subtotal);
  else if (typeof row.total !== 'undefined') totalVal = Number(row.total);
  const orderDate = row.orderdate ? new Date(row.orderdate).toLocaleString() : new Date().toLocaleString();
  return {
    id: row.display_id || formatOrderDisplayId(row.orderid || row.id || Date.now()),
    customer: customerLabel,
    items: itemsText,
    total: Number.isFinite(totalVal) ? totalVal : 0,
    status,
    date: orderDate,
  };
}

/**
 * Check API Server Health
 */
async function checkAPIHealth() {
  try {
    const health = await APIClient.health();
    if (health.ok) {
      console.log('✅ API Server OK - Database: ' + health.database);
      document.title = 'ShisaFood ✅ [Connected to ' + health.database + ']';
    }
  } catch (err) {
    console.warn('⚠️ API Server not reachable:', err);
  }
}

// ========== INIT ==========
window.addEventListener('load', async () => {
  if (window.SupabaseWeb) {
    try {
      await window.SupabaseWeb.init();
    } catch (err) {
      console.warn('Supabase init failed:', err);
    }
  }

  // Check API Server
  await checkAPIHealth();

  // Load data from API
  await loadProductsFromAPI();
  await loadUsersFromAPI();
  await loadOrdersFromAPI();

  // Initialize Footer Map
  initFooterMap();

  // Load local storage
  loadUsersFromStorage();
  restoreSession();
  await restoreSupabaseSession();
  setTimeout(() => {
    document.getElementById('page-loader').classList.add('hidden');
  }, 1800);
  renderCategories();
  renderProducts();
  renderBestSellers();
  updateAdminStats();
  setupScrollEffects();
  setupFadeAnimations();
  document.getElementById('admin-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  setTimeout(() => restoreMenuVisibility(true), 300);
});

// ========== SCROLL EFFECTS ==========
function setupScrollEffects() {
  const navbar = document.getElementById('navbar');
  const backTop = document.getElementById('back-top');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
    backTop.classList.toggle('show', window.scrollY > 400);
    updateActiveNav();
  });
  document.getElementById('cart-toggle').addEventListener('click', () => {
    if (state.currentUser) openCart();
    else openModal('login-modal');
  });
}

function updateActiveNav() {
  const sections = ['hero', 'menu', 'about', 'promotions'];
  const links = document.querySelectorAll('[data-nav]');
  let current = 'hero';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 100) current = id;
  });
  links.forEach(l => {
    l.classList.toggle('active', l.getAttribute('href') === '#' + current);
  });
}

function setupFadeAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ========== CATEGORIES ==========
function renderCategories() {
  const grid = document.getElementById('categories-grid');
  grid.innerHTML = CATEGORIES.map(c => {
    const count = PRODUCTS.filter(p => p.cat === c.id).length;
    return `<div class="category-card" onclick="filterByCat('${c.id}')">
      <span class="category-icon">${c.icon}</span>
      <div class="category-name">${c.name}</div>
      <div class="category-count">${count} Items</div>
    </div>`;
  }).join('');
}

function filterByCat(catId) {
  state.currentFilter = catId;
  state.currentPage = 1;
  state.priceMin = 0; state.priceMax = 9999;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  renderProducts();
  document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
  document.querySelectorAll('.category-card').forEach((c, i) => {
    c.classList.toggle('active', CATEGORIES[i].id === catId);
  });
}

// ========== PRODUCTS ==========
function getFilteredProducts() {
  return PRODUCTS.filter(p => {
    const matchFilter = state.currentFilter === 'all' || p.cat === state.currentFilter || p.tags.includes(state.currentFilter);
    const matchPrice = p.price >= state.priceMin && p.price <= state.priceMax;
    const matchSearch = !state.searchQuery || p.name.toLowerCase().includes(state.searchQuery) || p.desc.toLowerCase().includes(state.searchQuery);
    return matchFilter && matchPrice && matchSearch;
  });
}

function renderProducts() {
  const filtered = getFilteredProducts();
  const start = (state.currentPage - 1) * state.perPage;
  const page = filtered.slice(start, start + state.perPage);
  const grid = document.getElementById('products-grid');
  grid.innerHTML = page.length
    ? page.map(productCard).join('')
    : `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--gray-text)">
    <div style="font-size:48px;margin-bottom:12px">🔍</div>
    <div style="font-family:var(--font-cond);font-size:16px;font-weight:700;letter-spacing:1px">No products found</div>
  </div>`;
  renderPagination(filtered.length);
}

function productCard(p) {
  const tagHtml = p.tags
    .map(
      (t) =>
        `<span class="tag tag-${t === 'spicy' ? 'spicy' : t === 'best-seller' ? 'best' : t === 'new' ? 'new' : 'hot'}">${t === 'spicy' ? '🌶️' : t === 'best-seller' ? '⭐' : '✨'} ${t}</span>`,
    )
    .join('');
  const stars = '★'.repeat(Math.round(p.rating)) + '☆'.repeat(5 - Math.round(p.rating));

  // Display image URL if available, otherwise show emoji
  const imageHtml = p.imageurl
    ? `<img src="${p.imageurl}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">`
    : p.emoji;

  return `<div class="product-card" onclick="openProductDetail(${p.id})">
    ${p.tags.includes('best-seller') ? '<div class="badge">BEST SELLER</div>' : ''}
    <div class="product-img">${imageHtml}${!p.available ? '<div class="availability-overlay">SOLD OUT</div>' : ''}</div>
    <div class="product-body">
      <div class="product-tags">${tagHtml}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-desc">${p.desc.substring(0, 70)}...</div>
      <div class="product-meta">
        <div class="product-price">$${p.price.toFixed(2)}<span class="currency">USD</span></div>
        <div class="product-rating"><span class="stars" style="font-size:11px">${stars}</span> ${p.rating}</div>
      </div>
      <div class="product-actions" onclick="event.stopPropagation()">
        <button class="add-to-cart" onclick="requireLogin(addToCart, ${p.id})" ${!p.available ? 'disabled' : ''}>${p.available ? '🛒 Add to Cart' : 'Sold Out'}</button>
        <button class="wishlist-btn" onclick="showToast('Added to wishlist!','info')">♡</button>
      </div>
    </div>
  </div>`;
}

function renderBestSellers() {
  const bs = PRODUCTS.filter((p) => p.tags.includes('best-seller')).slice(0, 4);
  document.getElementById('bestsellers-grid').innerHTML = bs
    .map(productCard)
    .join('');
}

function renderPagination(total) {
  const pages = Math.ceil(total / state.perPage);
  const pag = document.getElementById('pagination');
  if (pages <= 1) {
    pag.innerHTML = '';
    return;
  }
  let html = `<button class="page-btn" onclick="goPage(${state.currentPage - 1})" ${state.currentPage === 1 ? 'disabled' : ''}>←</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="goPage(${state.currentPage + 1})" ${state.currentPage === pages ? 'disabled' : ''}>→</button>`;
  pag.innerHTML = html;
}

function goPage(p) {
  state.currentPage = p;
  renderProducts();
  document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
}

function setFilter(filter, btn) {
  state.currentFilter = filter;
  state.currentPage = 1;
  state.priceMin = 0;
  state.priceMax = 9999;
  document
    .querySelectorAll('.filter-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
  document
    .querySelectorAll('.category-card')
    .forEach((c) => c.classList.remove('active'));
}

function filterByPrice(min, max, btn) {
  state.priceMin = min;
  state.priceMax = max;
  state.currentPage = 1;
  document
    .querySelectorAll('.filter-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

function filterProducts() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  const rawValue = searchInput.value.trim();
  const looksAutofilled = /@/.test(rawValue) || rawValue.length > 16;
  if (looksAutofilled) {
    if (rawValue !== lastAutoClearedSearch) {
      lastAutoClearedSearch = rawValue;
      searchInput.value = '';
    }
    if (state.searchQuery) {
      state.searchQuery = '';
      state.currentPage = 1;
      renderProducts();
    }
    return;
  }
  state.searchQuery = rawValue.toLowerCase();
  state.currentPage = 1;
  renderProducts();
}
let lastAutoClearedSearch = '';

function restoreMenuVisibility(force = false) {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  const currentValue = searchInput.value.trim();
  const looksAutofilled = /@/.test(currentValue) || currentValue.length > 16;
  if (!force && (!currentValue || !looksAutofilled || currentValue === lastAutoClearedSearch)) {
    return;
  }
  if (!currentValue && !state.searchQuery) return;
  searchInput.value = '';
  lastAutoClearedSearch = currentValue;
  if (state.searchQuery) {
    state.searchQuery = '';
    state.currentPage = 1;
    renderProducts();
  }
}

function addFromModal() {
  if (!state.currentProduct) return;
  requireLogin(() => {
    for (let i = 0; i < state.detailQty; i++) {
      addToCart(state.currentProduct.id, true);
    }
    showToast(`${state.detailQty}x ${state.currentProduct.name} added to cart! ✅`);
    closeModal('product-modal');
  });
}

function renderProductReviews(p) {
  const list = document.getElementById('product-reviews-list');
  if (!p.reviews || p.reviews.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--gray-text);font-size:14px">No reviews yet. Be the first!</div>`;
    return;
  }
  list.innerHTML = p.reviews.map(r => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-family:var(--font-cond);font-size:14px;font-weight:700">${r.name}</div>
        <div class="stars" style="font-size:12px">${'★'.repeat(r.stars)}</div>
      </div>
      <div style="font-size:14px;color:rgba(255,255,255,0.7)">${r.text}</div>
    </div>`).join('');
}

function setReviewStar(n) {
  state.selectedReviewStar = n;
  document
    .querySelectorAll('#star-selector span')
    .forEach((s, i) => s.classList.toggle('active', i < n));
}

function submitReview() {
  if (!state.currentUser) {
    openModal('login-modal');
    return;
  }
  const text = document.getElementById('review-text').value.trim();
  if (!text) {
    showToast('Please write a review text!', 'error');
    return;
  }
  const review = {
    name: state.currentUser.name,
    stars: state.selectedReviewStar,
    text,
  };
  state.currentProduct.reviews.push(review);
  renderProductReviews(state.currentProduct);
  document.getElementById('review-text').value = '';
  showToast('Review submitted! Thank you 🌟', 'success');
}

// ========== AUTH ==========
async function login() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  if (window.SupabaseWeb) {
    try {
      await window.SupabaseWeb.signIn(email, pass);
      state.currentUser = await resolveProfileByEmail(email);
      onLoginSuccess(true);
      closeModal('login-modal');
      return;
    } catch (err) {
      console.warn('Supabase login failed, fallback to app auth:', err);
    }
  }

  try {
    const data = await APIClient.login(email, pass);
    if (!data.ok) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }
    state.currentUser = data.user;
    onLoginSuccess(true);
    closeModal('login-modal');
  } catch (err) {
    showToast(err.message || 'Cannot connect to auth API', 'error');
  }
}

function socialLogin(provider) {
  if (provider === 'Facebook') {
    window.location.href = getAppBaseUrl() + '/login/facebook';
    return;
  }
  if (provider === 'Google') {
    window.location.href = getAppBaseUrl() + '/login/google';
    return;
  }
  const fakeUser = {
    id: Date.now(),
    name: provider + ' User',
    email: provider.toLowerCase() + '@social.com',
    role: 'customer',
    orders: [],
    joined: new Date().toISOString().split('T')[0],
  };
  USERS.push(fakeUser);
  saveUsersToStorage();
  state.currentUser = fakeUser;
  onLoginSuccess(true);
  closeModal('login-modal');
}

async function register() {
  const first = document.getElementById('reg-first').value.trim();
  const last = document.getElementById('reg-last').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const confirm = document.getElementById('reg-confirm').value;
  if (!first || !last || !email || !pass) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  if (pass !== confirm) {
    showToast('Passwords do not match', 'error');
    return;
  }
  if (pass.length < 8) {
    showToast('Password must be at least 8 characters', 'error');
    return;
  }

  if (window.SupabaseWeb) {
    try {
      await window.SupabaseWeb.signUp(email, pass);
      try {
        await APIClient.register(email, `${first} ${last}`, phone, pass);
      } catch (_) {
        // Ignore duplicate local profile errors and continue.
      }
      state.currentUser = await resolveProfileByEmail(email);
      onLoginSuccess(true);
      closeModal('register-modal');
      showToast('Supabase account created successfully', 'success');
      return;
    } catch (err) {
      console.warn('Supabase register failed, fallback to app register:', err);
    }
  }

  try {
    const data = await APIClient.register(email, `${first} ${last}`, phone, pass);
    if (!data.ok) {
      showToast(data.error || 'Register failed', 'error');
      return;
    }
    state.currentUser = data.user;
    onLoginSuccess(true);
    closeModal('register-modal');
  } catch (err) {
    showToast(err.message || 'Cannot connect to auth API', 'error');
  }
}

function onLoginSuccess(showWelcomeToast = true) {
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('user-menu').style.display = 'flex';
  document.getElementById('cart-toggle').style.display = 'flex';
  document.getElementById('cart-count').classList.add('show');
  document.getElementById('user-greeting').textContent = `Hello, ${state.currentUser.name.split(' ')[0]} 👋`;
  localStorage.setItem(SESSION_STORAGE_KEY, (state.currentUser.email || '').toLowerCase());
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(state.currentUser));

  if (state.currentUser.role === 'admin') {
    document.getElementById('admin-access-btn').style.display = 'block';
    document.getElementById('shipper-access-btn').style.display = 'none';
    document.getElementById('customer-access-btn').style.display = 'none';
  } else if (state.currentUser.role === 'shipper') {
    document.getElementById('admin-access-btn').style.display = 'none';
    document.getElementById('shipper-access-btn').style.display = 'block';
    document.getElementById('customer-access-btn').style.display = 'none';
  } else {
    document.getElementById('admin-access-btn').style.display = 'none';
    document.getElementById('shipper-access-btn').style.display = 'none';
    document.getElementById('customer-access-btn').style.display = 'block';
  }
  updateCartCount();
  setTimeout(() => restoreMenuVisibility(true), 250);
  setTimeout(() => restoreMenuVisibility(true), 1000);
  if (showWelcomeToast) {
    showToast(`Welcome back, ${state.currentUser.name.split(' ')[0]}! 🎉`, 'success');

    let target = null;
    if (state.currentUser.role === 'admin') {
      target = '/admin/dashboard';
    } else if (state.currentUser.role === 'shipper') {
      target = '/shipper/workspace';
    } else {
      target = '/customer';
    }

    setTimeout(() => {
      window.location.href = `${getAppBaseUrl()}${target}`;
    }, 250);
  }
}

async function logout() {
  state.currentUser = null;
  state.cart = [];

  if (window.SupabaseWeb) {
    try {
      await window.SupabaseWeb.signOut();
    } catch (err) {
      console.warn('Supabase signOut failed:', err);
    }
  }

  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
  document.getElementById('login-btn').style.display = 'flex';
  document.getElementById('user-menu').style.display = 'none';
  document.getElementById('cart-toggle').style.display = 'none';
  document.getElementById('user-dropdown').style.display = 'none';
  updateCartCount();
  closeAdminDashboard();
  showToast('Logged out successfully. See you soon! 👋');
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.style.display === 'none'
    || (!dropdown.style.display && window.getComputedStyle(dropdown).display === 'none');
  const nextDisplay = isHidden ? 'block' : 'none';
  dropdown.style.display = nextDisplay;
  // No automatic menu reset here to avoid disruptive rerender.
}
document.addEventListener('click', e => {
  const menu = document.getElementById('user-menu');
  if (menu && !menu.contains(e.target)) {
    const d = document.getElementById('user-dropdown');
    if (d) d.style.display = 'none';
  }
});

function requireLogin(fn, ...args) {
  if (!state.currentUser) {
    openModal('login-modal');
    return;
  }
  fn(...args);
}

// ========== CART ==========
function addToCart(productId, silent = false) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p || !p.available) return;
  const existing = state.cart.find(i => i.id === productId);
  if (existing) existing.qty++;
  else state.cart.push({ id: productId, name: p.name, price: p.price, emoji: p.emoji, qty: 1 });
  updateCartCount();
  renderCartItems();
  if (!silent) showToast(`${p.name} added to cart! ✅`);
}

function removeFromCart(id) {
  const nid = !isNaN(id) && id !== '' ? Number(id) : id;
  state.cart = state.cart.filter(i => i.id !== nid);
  updateCartCount();
  renderCartItems();
}

function changeQty(id, d) {
  const nid = !isNaN(id) && id !== '' ? Number(id) : id;
  const item = state.cart.find(i => i.id === nid);
  if (!item) return;
  item.qty = Math.max(1, item.qty + d);
  updateCartCount();
  renderCartItems();
}

function addComboToCart(comboId) {
  const c = COMBOS[comboId];
  const existing = state.cart.find(i => i.id === 'combo-' + comboId);
  if (existing) existing.qty++;
  else state.cart.push({ id: 'combo-' + comboId, name: c.name, price: c.price, emoji: c.emoji, qty: 1 });
  updateCartCount();
  renderCartItems();
  showToast(`${c.name} added! ✅`);
  openCart();
}

function updateCartCount() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById('cart-count');
  el.textContent = count;
  el.classList.toggle('show', count > 0);
}

function renderCartItems() {
  const list = document.getElementById('cart-items-list');
  const footer = document.getElementById('cart-footer');
  if (!state.cart.length) {
    list.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><div style="font-family:var(--font-cond);font-size:16px;font-weight:700;letter-spacing:1px">Your cart is empty</div><div style="font-size:14px;color:var(--gray-text);text-align:center">Add some fire to your order!</div></div>`;
    footer.style.display = 'none';
    return;
  }
  list.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji.split("").slice(0, 2).join("")}</div>
      <div style="flex:1;min-width:0">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">-</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
          <span style="font-family:var(--font-cond);font-size:13px;font-weight:700;color:var(--red-light);margin-left:8px">$${(item.price * item.qty).toFixed(2)}</span>
        </div>
      </div>
      <button class="remove-item" onclick="removeFromCart('${item.id}')">✕</button>
    </div>`).join('');
  footer.style.display = 'block';
  updateCartTotals();
}

function computeCartTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  let shippingFee = state.shippingInfo.calculatedFee || 0;
  let discount = 0;
  let promoCode = null;

  if (state.promoApplied) {
    const promo = state.promoApplied;
    promoCode = promo.code || null;
    if (promo.type === 'percent') discount = subtotal * promo.value / 100;
    else if (promo.type === 'flat') discount = promo.value;
    else if (promo.type === 'delivery') {
      discount = shippingFee;
      shippingFee = 0;
    }
  }

  discount = Math.min(discount, subtotal + shippingFee);
  const total = Math.max(0, subtotal + shippingFee - discount);
  return { subtotal, shippingFee, discount, total, promoCode };
}

function updateCartTotals() {
  const totals = computeCartTotals();
  const discountRow = document.getElementById('cart-discount-row');
  const discountValue = document.getElementById('cart-discount');
  if (discountRow && discountValue) {
    if (totals.discount > 0) {
      discountRow.style.display = 'flex';
      discountValue.textContent = `-$${totals.discount.toFixed(2)}`;
    } else {
      discountRow.style.display = 'none';
    }
  }
  document.getElementById('cart-subtotal').textContent = `$${totals.subtotal.toFixed(2)}`;
  const cartDeliveryRow = document.getElementById('cart-delivery-row');
  if (cartDeliveryRow) {
    if (state.shippingInfo.distance > 0) {
      cartDeliveryRow.style.display = 'flex';
      document.getElementById('cart-delivery').textContent = `$${totals.shippingFee.toFixed(2)}`;
    } else {
      cartDeliveryRow.style.display = 'none';
    }
  }
  const coDeliveryValue = document.getElementById('co-delivery');
  if (coDeliveryValue) {
    if (state.shippingInfo.distance > 0) {
      const distKm = (state.shippingInfo.distance / 1000).toFixed(1);
      coDeliveryValue.innerHTML = `$${totals.shippingFee.toFixed(2)} <span style="font-size:12px;color:rgba(255,255,255,0.5);font-weight:400;margin-left:4px">(${distKm}km)</span>`;
    } else {
      coDeliveryValue.textContent = `$${totals.shippingFee.toFixed(2)}`;
    }
  }
  document.getElementById('cart-total').textContent = `$${totals.total.toFixed(2)}`;
  const coSubtotal = document.getElementById('co-subtotal');
  if (coSubtotal) coSubtotal.textContent = `$${totals.subtotal.toFixed(2)}`;
  const coTotal = document.getElementById('co-total');
  if (coTotal) coTotal.textContent = `$${totals.total.toFixed(2)}`;
}

function applyPromo() {
  const code = document.getElementById('promo-input').value.trim().toUpperCase();
  if (!code) return;
  const promo = PROMOS[code];
  if (!promo) { showToast('Invalid promo code', 'error'); return; }
  const sub = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (sub < promo.min) { showToast(`Minimum order $${promo.min} required`, 'error'); return; }
  state.promoApplied = { ...promo, code };
  updateCartTotals();
  showToast(`Promo applied! ${promo.desc} 🎫`, 'success');
}

function openCart() {
  if (!state.currentUser) { openModal('login-modal'); return; }
  renderCartItems();
  document.getElementById('cart-sidebar').classList.add('open');
  document.getElementById('cart-overlay').classList.add('show');
}

function closeCart() {
  document.getElementById('cart-sidebar').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('show');
}

// ========== CHECKOUT ==========
function openCheckout() {
  if (!state.cart.length) { showToast('Your cart is empty!', 'error'); return; }
  closeCart();
  const totals = computeCartTotals();
  document.getElementById('co-subtotal').textContent = `$${totals.subtotal.toFixed(2)}`;
  updateCartTotals(); // This will refresh co-delivery label
  document.getElementById('co-total').textContent = `$${totals.total.toFixed(2)}`;
  state.selectedPayment = 'cod';
  selectPayment('cod');
  setCheckoutStep(1);
  openModal('checkout-modal');

  // Initialize Mapbox for address picking
  setTimeout(initCheckoutMap, 300);
}

function initCheckoutMap() {
  if (!window.mapboxgl) return;
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

  const mapContainer = document.getElementById('checkout-map');
  if (!mapContainer) return;

  checkoutMap = new mapboxgl.Map({
    container: 'checkout-map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [STORE_COORDS.lng, STORE_COORDS.lat],
    zoom: 13
  });

  // Store Marker (ShisaFood)
  const storeEl = document.createElement('div');
  storeEl.className = 'store-marker';
  storeEl.style.fontSize = '32px';
  storeEl.innerHTML = '🏬';

  new mapboxgl.Marker(storeEl)
    .setLngLat([STORE_COORDS.lng, STORE_COORDS.lat])
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<h3>ShisaFood - Store</h3><p>Your meal starts here!</p>'))
    .addTo(checkoutMap);

  checkoutMarker = new mapboxgl.Marker({ draggable: true, color: '#e8000d' })
    .setLngLat([STORE_COORDS.lng, STORE_COORDS.lat])
    .addTo(checkoutMap);

  function onDragEnd() {
    const lngLat = checkoutMarker.getLngLat();
    updateShipCoords(lngLat.lat, lngLat.lng);
  }
  checkoutMarker.on('dragend', onDragEnd);

  // Initial calculation for default spot (Store Coords)
  updateShipCoords(STORE_COORDS.lat, STORE_COORDS.lng);

  checkoutMap.on('click', (e) => {
    checkoutMarker.setLngLat(e.lngLat);
    updateShipCoords(e.lngLat.lat, e.lngLat.lng);
  });

  // Add Geocoder
  const geocoderContainer = document.getElementById('geocoder-container');
  if (geocoderContainer && !geocoderContainer.hasChildNodes()) {
    geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Search for address...'
    });
    geocoder.addTo('#geocoder-container');
    geocoder.on('result', (e) => {
      const coords = e.result.geometry.coordinates;
      checkoutMarker.setLngLat(coords);
      checkoutMap.flyTo({ center: coords, zoom: 15 });
      updateShipCoords(coords[1], coords[0]);

      document.getElementById('ship-address').value = e.result.place_name;

      // Try to extract city from context
      const cityContext = e.result.context?.find(c => c.id.startsWith('place'));
      if (cityContext) {
        document.getElementById('ship-city').value = cityContext.text;
      } else {
        document.getElementById('ship-city').value = 'London';
      }
    });
  }
}

async function updateShipCoords(lat, lng) {
  document.getElementById('ship-lat').value = lat;
  document.getElementById('ship-lng').value = lng;

  const continueBtn = document.querySelector('.checkout-continue-btn');
  let rangeWarning = document.getElementById('range-warning');
  if (!rangeWarning) {
    rangeWarning = document.createElement('div');
    rangeWarning.id = 'range-warning';
    rangeWarning.style.color = '#e8000d';
    rangeWarning.style.fontSize = '12px';
    rangeWarning.style.marginTop = '8px';
    rangeWarning.style.textAlign = 'center';
    rangeWarning.style.fontWeight = '700';
    continueBtn.parentNode.insertBefore(rangeWarning, continueBtn);
  }

  state.isCalculatingFee = true;
  const placeBtn = document.querySelector('.checkout-place-btn');
  if (placeBtn) {
    placeBtn.disabled = true;
    placeBtn.textContent = 'CALCULATING FEE...';
  }

  // 1. Reverse Geocode (Retrieve Address)
  try {
    const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (geoData.features && geoData.features.length > 0) {
      const address = geoData.features[0].place_name;
      document.getElementById('ship-address').value = address;
      document.getElementById('ship-lat').value = lat;
      document.getElementById('ship-lng').value = lng;
      if (geocoder) geocoder.setInput(address);

      const cityContext = geoData.features[0].context?.find(c => c.id.startsWith('place'));
      if (cityContext) {
        document.getElementById('ship-city').value = cityContext.text;
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding failed:', err);
  }

  // 2. Calculate ETA and Distance
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${STORE_COORDS.lng},${STORE_COORDS.lat};${lng},${lat}?access_token=${MAPBOX_ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      const distance = data.routes[0].distance; // meters
      const duration = Math.round(data.routes[0].duration / 60) + 15; // +15 mins prep
      const etaText = `${duration - 5}-${duration + 5} minutes`;

      state.shippingInfo.estimatedEta = etaText;
      state.shippingInfo.lat = lat;
      state.shippingInfo.lng = lng;
      state.shippingInfo.distance = distance;

      // Fee logic: $1 if < 1km, $2/km if 1km to 10km.
      if (distance < 1000) {
        state.shippingInfo.calculatedFee = 1.00;
      } else {
        state.shippingInfo.calculatedFee = parseFloat(((distance / 1000) * 2.0).toFixed(2));
      }

      const etaDisplay = document.querySelector('.checkout-success-eta strong');
      if (etaDisplay) etaDisplay.textContent = etaText;

      // Range limit check (10km)
      if (distance > 10000) {
        rangeWarning.textContent = '? Out of delivery range (Max 10km)';
        if (continueBtn) continueBtn.disabled = true;
      } else {
        rangeWarning.textContent = '';
        if (continueBtn) continueBtn.disabled = false;
      }

      // Update cart totals immediately so the user sees the fee update
      updateCartTotals();
    }
  } catch (err) {
    console.warn('Mapbox Calculation failed:', err);
  } finally {
    state.isCalculatingFee = false;
    const placeBtn = document.querySelector('.checkout-place-btn');
    if (placeBtn) {
      placeBtn.disabled = false;
      placeBtn.textContent = 'PLACE ORDER ?';
    }
  }
}

function setCheckoutStep(step) {
  [1, 2, 3].forEach(i => {
    const panel = document.getElementById(`checkout-step${i}`);
    const indicator = document.getElementById(`step${i}-indicator`);
    if (panel) panel.style.display = i === step ? 'block' : 'none';
    if (indicator) {
      indicator.classList.toggle('active', i === step);
      indicator.classList.toggle('done', i < step);
    }
  });
}

async function goCheckoutStep(n) {
  if (n === 2 && !saveShippingInfo()) return;
  if (n === 3) {
    const success = await placeOrder();
    if (!success) return;
  }
  setCheckoutStep(n);
}

function selectPayment(method) {
  state.selectedPayment = method;
  ['cod', 'card', 'momo', 'bank'].forEach(m => {
    document.getElementById(`pay-${m}`).classList.toggle('selected', m === method);
  });
  document.getElementById('card-fields').style.display = method === 'card' ? 'block' : 'none';
}

function saveShippingInfo() {
  const first = document.getElementById('ship-first').value.trim();
  const last = document.getElementById('ship-last').value.trim();
  const phone = document.getElementById('ship-phone').value.trim();
  const address = document.getElementById('ship-address').value.trim();
  const city = document.getElementById('ship-city').value.trim();
  const notes = document.getElementById('ship-notes').value.trim();

  if (!first || !last || !phone || !address) {
    showToast('Please complete shipping information', 'error');
    return false;
  }

  Object.assign(state.shippingInfo, { firstName: first, lastName: last, phone, address, city, notes });
  return true;
}

function resetCheckoutForm() {
  ['ship-first', 'ship-last', 'ship-phone', 'ship-address', 'ship-city', 'ship-notes'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  // Clear Geocoder
  if (geocoder) geocoder.clear();
  // Clear Coords
  ['ship-lat', 'ship-lng'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  state.shippingInfo = { firstName: '', lastName: '', phone: '', address: '', city: '', notes: '', lat: null, lng: null, estimatedEta: '', calculatedFee: 0, distance: 0 };
  state.selectedPayment = 'cod';
  selectPayment('cod');
}

async function placeOrder() {
  if (isPlacingOrder || state.isCalculatingFee) {
    if (state.isCalculatingFee) showToast('Still calculating shipping fee. Please wait...', 'info');
    return false;
  }
  if (!state.currentUser || !state.currentUser.id) {
    showToast('Please log in before placing an order', 'error');
    return false;
  }
  if (!state.cart.length) {
    showToast('Your cart is empty!', 'error');
    return false;
  }

  if (!state.shippingInfo.firstName && !saveShippingInfo()) return false;
  const shipping = state.shippingInfo;
  if (!shipping.firstName || !shipping.lastName || !shipping.phone || !shipping.address) {
    showToast('Please complete shipping information', 'error');
    return false;
  }

  const lineItems = state.cart
    .map(item => ({ productId: Number(item.id), quantity: item.qty }))
    .filter(item => Number.isInteger(item.productId) && item.productId > 0);
  if (!lineItems.length) {
    showToast('Some items are not linked to the menu yet. Please re-add them.', 'error');
    return false;
  }

  const totals = computeCartTotals();
  const payload = {
    customer_id: state.currentUser.id,
    customer_name: `${shipping.firstName} ${shipping.lastName}`.trim(),
    items: lineItems.map(item => ({ product_id: item.productId, quantity: item.quantity })),
    delivery_phone: shipping.phone,
    delivery_address: shipping.address,
    city: shipping.city || 'London',
    notes: shipping.notes,
    promotion_code: totals.promoCode,
    shipping_fee: totals.shippingFee || state.shippingInfo.calculatedFee || 0,
    payment_method: state.selectedPayment,
    latitude: parseFloat(document.getElementById('ship-lat').value) || null,
    longitude: parseFloat(document.getElementById('ship-lng').value) || null,
    estimated_eta: state.shippingInfo.estimatedEta || '25-35 minutes',
  };

  const placeBtn = document.querySelector('.checkout-place-btn');
  isPlacingOrder = true;
  if (placeBtn) {
    placeBtn.disabled = true;
    placeBtn.textContent = 'PROCESSING...';
  }

  try {
    const order = await APIClient.createOrder(payload);
    const displayId = order.display_id || formatOrderDisplayId(order.order_id);
    document.getElementById('order-id-display').textContent = displayId;
    const adminOrderRow = mapApiOrderToRow({
      ...order,
      orderid: order.order_id,
      orderstatus: order.status,
      totalamount: order.total_amount,
      orderdate: order.order_date,
      items_summary: order.items_summary,
      customername: order.customer_name || state.currentUser.name,
      customerid: order.customer_id || state.currentUser.id,
    });
    ORDERS.push(adminOrderRow);
    if (!Array.isArray(state.currentUser.orders)) state.currentUser.orders = [];
    state.currentUser.orders.push(adminOrderRow);
    state.cart = [];
    state.promoApplied = null;
    updateCartCount();
    renderCartItems();
    updateAdminStats();
    resetCheckoutForm();
    renderOrdersModal();
    showToast('Order placed successfully! 🎉', 'success');
    return true;
  } catch (err) {
    console.error('Place order error:', err);
    showToast(err.message || 'Failed to place order', 'error');
    return false;
  }
}

// ========== ORDERS MODAL ==========
function renderOrdersModal() {
  const list = document.getElementById('orders-list');
  const orders = state.currentUser?.orders || [];
  if (!orders.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray-text)"><div style="font-size:48px;margin-bottom:12px">📦</div><div style="font-family:var(--font-cond);font-size:16px;font-weight:700;letter-spacing:1px">No orders yet</div><p>Your order history will appear here.</p></div>`;
    return;
  }
  list.innerHTML = orders.map(o => `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-family:var(--font-display);font-size:20px;letter-spacing:2px">${o.id}</div>
        <span class="status-badge status-${o.status}">${o.status}</span>
      </div>
      <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:4px">${o.items}</div>
      <div style="display:flex;justify-content:space-between;margin-top:10px">
        <span style="font-size:13px;color:var(--gray-text)">${o.date}</span>
        <span style="font-family:var(--font-cond);font-size:15px;font-weight:700;color:var(--red-light)">$${(o.total || 0).toFixed(2)}</span>
      </div>
    </div>`).join('');
}

// ========== PROMOS ==========
function copyCode(code) {
  navigator.clipboard?.writeText(code).catch(() => { });
  document.getElementById('promo-input').value = code;
  showToast(`Code "${code}" copied! Use it at checkout 🎫`, 'success');
}

// ========== MODAL HELPERS ==========
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'orders-modal') renderOrdersModal();
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  document.body.style.overflow = '';
}

function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 100);
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ========== MOBILE MENU ==========
function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
}
function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.remove('open');
}

// ========== TOAST ==========
function showToast(msg, type = 'default') {
  const icons = { default: '🔔', success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '🔔'}</span><span>${msg}</span>`;
  const container = document.getElementById('toast-container');
  if (container) {
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
}

// ========== ADMIN DASHBOARD ==========
function openAdminDashboard() {
  if (!state.currentUser || state.currentUser.role !== 'admin') {
    showToast('Only admin can access dashboard', 'error');
    return;
  }
  window.location.href = `${getAppBaseUrl()}/admin/dashboard`;
}

function openShipperWorkspace() {
  if (!state.currentUser || state.currentUser.role !== 'shipper') {
    showToast('Only shipper can access workspace', 'error');
    return;
  }
  window.location.href = `${getAppBaseUrl()}/shipper/workspace`;
}

function openCustomerPortal() {
  if (!state.currentUser) {
    openModal('login-modal');
    return;
  }
  window.location.href = `${getAppBaseUrl()}/customer`;
}

function closeAdminDashboard() {
  const panel = document.getElementById('admin-dashboard');
  if (panel) panel.style.display = 'none';
}

function showAdminPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const targetPanel = document.getElementById(`panel-${name}`);
  if (targetPanel) targetPanel.classList.add('active');
  document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  if (name === 'products') renderAdminProducts();
  if (name === 'categories') renderAdminCategories();
  if (name === 'orders') renderAdminOrders();
  if (name === 'users') renderAdminUsers();
  if (name === 'promos') renderAdminPromos();
}

function updateAdminStats() {
  const ordersEl = document.getElementById('admin-orders-count');
  const productsEl = document.getElementById('admin-products-count');
  const usersEl = document.getElementById('admin-users-count');
  if (ordersEl) ordersEl.textContent = ORDERS.length;
  if (productsEl) productsEl.textContent = PRODUCTS.length;
  if (usersEl) usersEl.textContent = USERS.length;
  renderAdminRecentOrders();
}

function renderAdminRecentOrders() {
  const tbody = document.getElementById('admin-recent-orders');
  if (!tbody) return;
  tbody.innerHTML = ORDERS.slice(-5).reverse().map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.customer}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.items}</td>
      <td style="color:var(--red-light);font-weight:700">$${(o.total || 0).toFixed(2)}</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td style="color:var(--gray-text)">${o.date}</td>
    </tr>`).join('');
}

function renderAdminProducts(filter = '') {
  const tbody = document.getElementById('admin-products-table');
  if (!tbody) return;
  const list = filter ? PRODUCTS.filter(p => (p.name || '').toLowerCase().includes(filter)) : PRODUCTS;
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><span style="font-size:20px;margin-right:8px">${p.emoji}</span>${p.name}</td>
      <td><span style="text-transform:capitalize">${p.cat}</span></td>
      <td style="color:var(--red-light);font-weight:700">$${(p.price || 0).toFixed(2)}</td>
      <td><span class="status-badge status-${p.available ? 'active' : 'inactive'}">${p.available ? 'Active' : 'Inactive'}</span></td>
      <td>${(p.tags || []).join(', ')}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn action-edit" onclick="openEditProduct(${p.id})">Edit</button>
          <button class="action-btn action-delete" onclick="deleteProduct(${p.id})">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAdminCategories() {
  const tbody = document.getElementById('admin-categories-table');
  if (!tbody) return;
  tbody.innerHTML = CATEGORIES.map(c => `
    <tr>
      <td style="font-size:24px">${c.icon}</td>
      <td><strong>${c.name}</strong></td>
      <td>${PRODUCTS.filter(p => p.cat === c.id).length} products</td>
      <td>
        <div class="action-btns">
          <button class="action-btn action-edit" onclick="showToast('Category editing coming soon!','info')">Edit</button>
          <button class="action-btn action-delete" onclick="showToast('Cannot delete: products exist','error')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAdminOrders() {
  const tbody = document.getElementById('admin-orders-table');
  if (!tbody) return;
  tbody.innerHTML = ORDERS.map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.customer}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.items}</td>
      <td style="color:var(--red-light);font-weight:700">$${(o.total || 0).toFixed(2)}</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td style="color:var(--gray-text)">${o.date}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn action-view" onclick="changeOrderStatus('${o.id}','completed')">Complete</button>
          <button class="action-btn action-delete" onclick="changeOrderStatus('${o.id}','cancelled')">Cancel</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-table');
  if (!tbody) return;
  tbody.innerHTML = USERS.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td><span class="status-badge ${u.role === 'admin' ? 'status-pending' : 'status-active'}">${u.role}</span></td>
      <td>${(u.orders || []).length}</td>
      <td style="color:var(--gray-text)">${u.joined}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn action-edit" onclick="showToast('User editing coming soon!','info')">Edit</button>
          <button class="action-btn action-delete" onclick="deleteUser(${u.id})">Remove</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAdminPromos() {
  const tbody = document.getElementById('admin-promos-table');
  if (!tbody) return;
  const promoList = Object.entries(PROMOS).map(([code, p]) => ({ code, ...p }));
  tbody.innerHTML = promoList.map(p => `
    <tr>
      <td><strong style="font-family:var(--font-display);letter-spacing:2px;color:var(--red-light)">${p.code}</strong></td>
      <td>${p.type === 'percent' ? p.value + '%' : p.type === 'flat' ? '$' + p.value : 'Free Delivery'}</td>
      <td>$${p.min}</td>
      <td>—</td>
      <td><span class="status-badge status-active">Active</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn action-edit" onclick="showToast('Promo editing soon!','info')">Edit</button>
          <button class="action-btn action-delete" onclick="showToast('Promo deleted!','success')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterAdminProducts(q) {
  renderAdminProducts(q.toLowerCase());
}

function changeOrderStatus(id, status) {
  const o = ORDERS.find(x => x.id === id);
  if (o) {
    o.status = status;
    renderAdminOrders();
    updateAdminStats();
    showToast(`Order ${id} marked as ${status}`, 'success');
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await APIClient.deleteProduct(id);
    PRODUCTS = PRODUCTS.filter(p => p.id !== id);
    renderAdminProducts();
    renderProducts();
    renderBestSellers();
    updateAdminStats();
    showToast('Product deleted', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to delete product', 'error');
  }
}

function deleteUser(id) {
  if (id === 1) {
    showToast('Cannot delete admin user', 'error');
    return;
  }
  if (!confirm('Remove this user?')) return;
  const idx = USERS.findIndex(u => u.id === id);
  if (idx !== -1) USERS.splice(idx, 1);
  renderAdminUsers();
  updateAdminStats();
  showToast('User removed', 'success');
}

function addCategory() {
  showToast('Category creation coming soon!', 'info');
}

function openAddProduct() {
  document.getElementById('admin-product-modal-title').textContent = 'ADD PRODUCT';
  document.getElementById('edit-product-id').value = '';
  ['prod-name', 'prod-price', 'prod-desc', 'prod-emoji', 'prod-tags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('prod-cat').value = 'noodles';
  document.getElementById('prod-avail').value = 'true';
  openModal('admin-product-modal');
}

function openEditProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  document.getElementById('admin-product-modal-title').textContent = 'EDIT PRODUCT';
  document.getElementById('edit-product-id').value = id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-cat').value = p.cat;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-desc').value = p.desc;
  document.getElementById('prod-emoji').value = p.emoji;
  document.getElementById('prod-avail').value = p.available ? 'true' : 'false';
  document.getElementById('prod-tags').value = (p.tags || []).join(', ');
  openModal('admin-product-modal');
}

async function saveProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const cat = document.getElementById('prod-cat').value;
  const price = parseFloat(document.getElementById('prod-price').value);
  const desc = document.getElementById('prod-desc').value.trim();
  const emoji = document.getElementById('prod-emoji').value.trim() || '🍲';
  const available = document.getElementById('prod-avail').value === 'true';
  const tagsRaw = document.getElementById('prod-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const editId = document.getElementById('edit-product-id').value;

  if (!name) { showToast('Product name is required', 'error'); return; }
  if (!price || price <= 0) { showToast('Price must be greater than 0', 'error'); return; }

  const saveBtn = document.querySelector('#admin-product-modal .btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    if (editId) {
      const metadata = {
        productname: name,
        price: price,
        description: desc,
        categoryid: cat === 'noodles' ? 1 : cat === 'pizza' ? 2 : cat === 'beverages' ? 3 : 4,
        emoji: emoji,
        isactive: available,
        tags: tagsRaw.join(', '),
      };
      await APIClient.updateProductMetadata(parseInt(editId), metadata);
      const p = PRODUCTS.find(x => x.id === parseInt(editId));
      if (p) Object.assign(p, { name, cat, price, desc, emoji, available, tags: tagsRaw });
      showToast('Product updated! ✅', 'success');
    } else {
      const payload = {
        productname: name,
        price: price,
        description: desc,
        categoryid: cat === 'noodles' ? 1 : cat === 'pizza' ? 2 : cat === 'beverages' ? 3 : 4,
        emoji: emoji,
        isactive: available,
        tags: tagsRaw.join(', '),
        stockquantity: 100,
      };
      const response = await APIClient.createProduct(payload);
      const newProduct = response.product;
      if (newProduct) {
        PRODUCTS.push({
          id: Number(newProduct.productid),
          name: newProduct.productname || name,
          cat: cat,
          price: Number(newProduct.price || price),
          desc: newProduct.description || desc,
          emoji: newProduct.emoji || emoji,
          available: newProduct.isactive !== false,
          tags: tagsRaw,
          rating: 4.5,
          reviews: [],
        });
      }
      showToast('Product added successfully! 🎉', 'success');
    }
    closeModal('admin-product-modal');
    renderAdminProducts();
    renderProducts();
    renderBestSellers();
    renderCategories();
    updateAdminStats();
  } catch (err) {
    console.error('saveProduct error:', err);
    showToast(`Failed to save product: ${err.message || err}`, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'SAVE PRODUCT'; }
  }
}
