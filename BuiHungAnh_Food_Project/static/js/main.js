    // ========== DATA STORE ==========
    let state = {
      currentUser: null,
      cart: [],
      orders: [],
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
    };

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

    let PRODUCTS = [
      { id: 1, name: 'Volcano Noodles', cat: 'noodles', price: 14.99, emoji: '🍜', desc: 'Our signature fiery noodle broth with rich pork bone base, extra thick noodles, and a side of habanero oil. A true test of courage.', tags: ['spicy', 'best-seller'], available: true, rating: 5, reviews: [] },
      { id: 2, name: 'Dragon Ramen', cat: 'noodles', price: 13.49, emoji: '🫕', desc: 'Classic ramen elevated with Shisa dragon sauce, soft-boiled egg, chashu pork, and crispy fried shallots.', tags: ['spicy', 'new'], available: true, rating: 4.8, reviews: [] },
      { id: 3, name: 'Inferno Udon', cat: 'noodles', price: 12.99, emoji: '🍝', desc: 'Thick chewy udon noodles in a blazing miso broth, topped with spicy minced pork and seasonal greens.', tags: ['spicy'], available: true, rating: 4.7, reviews: [] },
      { id: 4, name: 'Cold Fire Soba', cat: 'noodles', price: 11.99, emoji: '🥢', desc: 'Chilled soba noodles with our house-made chili dipping sauce — deceptively spicy, refreshingly bold.', tags: ['new'], available: true, rating: 4.6, reviews: [] },
      { id: 5, name: 'Shisa Spicy Pizza', cat: 'pizza', price: 16.99, emoji: '🍕', desc: 'Hand-tossed dough with fire sauce, mozzarella, jalapeño, spicy salami, and a drizzle of chili honey.', tags: ['best-seller', 'spicy'], available: true, rating: 4.9, reviews: [] },
      { id: 6, name: 'Inferno Margherita', cat: 'pizza', price: 15.49, emoji: '🫓', desc: 'Classic margherita reimagined with ghost pepper basil oil, bufala mozzarella, and charred tomatoes.', tags: ['spicy', 'new'], available: true, rating: 4.7, reviews: [] },
      { id: 7, name: 'BBQ Fire Pizza', cat: 'pizza', price: 17.99, emoji: '🔥', desc: 'Smoky BBQ sauce base, pulled pork, caramelized onions, jalapeños, and crispy bacon bits.', tags: ['best-seller'], available: true, rating: 4.8, reviews: [] },
      { id: 8, name: 'Shisa Fire Cola', cat: 'beverages', price: 3.99, emoji: '🥤', desc: 'Our signature spicy cola infusion with a kick of chili and fresh lime. Bold and refreshing.', tags: ['best-seller'], available: true, rating: 4.5, reviews: [] },
      { id: 9, name: 'Mango Habanero Slush', cat: 'beverages', price: 4.99, emoji: '🧃', desc: 'Sweet mango blended with habanero purée and crushed ice. Fruity heat in a glass.', tags: ['new'], available: true, rating: 4.6, reviews: [] },
      { id: 10, name: 'Dragon Bubble Tea', cat: 'beverages', price: 5.49, emoji: '🧋', desc: 'Brown sugar bubble tea with a swirl of red chili syrup. Surprisingly addictive.', tags: ['new', 'best-seller'], available: true, rating: 4.7, reviews: [] },
      { id: 11, name: 'Volcano Fries', cat: 'sides', price: 5.99, emoji: '🍟', desc: 'Thick-cut fries tossed in our signature volcano spice blend, served with sriracha aioli.', tags: ['spicy', 'best-seller'], available: true, rating: 4.8, reviews: [] },
      { id: 12, name: 'Spicy Gyoza (6pcs)', cat: 'sides', price: 7.49, emoji: '🥟', desc: 'Pan-fried pork and chili gyoza with a crispy bottom and juicy filling. Served with chili vinegar.', tags: ['spicy'], available: true, rating: 4.7, reviews: [] },
      { id: 13, name: 'Fire Wings (8pcs)', cat: 'sides', price: 9.99, emoji: '🍗', desc: 'Crispy chicken wings glazed in three levels of heat: mild fire, dragon fire, and inferno.', tags: ['spicy', 'best-seller'], available: true, rating: 4.9, reviews: [] },
      { id: 14, name: 'Kimchi Spring Rolls', cat: 'sides', price: 6.99, emoji: '🥕', desc: 'Crispy golden rolls stuffed with kimchi, glass noodles, and a touch of gochujang.', tags: ['new'], available: false, rating: 4.5, reviews: [] },
    ];

    const USERS_STORAGE_KEY = 'shisa_users';
    const SESSION_STORAGE_KEY = 'shisa_current_user_email';
    const SESSION_USER_KEY = 'shisa_current_user';

    let USERS = [
      { id: 1, name: 'Admin User', email: 'admin@shisa.com', role: 'admin', orders: [], joined: '2024-01-15' },
      { id: 2, name: 'Minh Tran', email: 'minh@example.com', role: 'customer', orders: [], joined: '2024-03-20' },
      { id: 3, name: 'Sarah K.', email: 'sarah@example.com', role: 'customer', orders: [], joined: '2024-05-10' },
    ];

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

    let ORDERS = [
      { id: '#SF1001', customer: 'Minh Tran', items: 'Volcano Noodles x2, Shisa Fire Cola', total: 32.97, status: 'completed', date: '2025-03-20' },
      { id: '#SF1002', customer: 'Sarah K.', items: 'Shisa Spicy Pizza, Dragon Bubble Tea', total: 22.48, status: 'pending', date: '2025-03-21' },
      { id: '#SF1003', customer: 'Alex Nguyen', items: 'Fire Wings, Volcano Fries, Inferno Udon', total: 28.97, status: 'completed', date: '2025-03-22' },
    ];

    const COMBOS = {
      'noodle-drink-combo': { name: 'Noodle + Drink Combo', price: 17.99, emoji: '🍜🥤' },
      'pizza-party-combo': { name: 'Pizza Party Set', price: 29.99, emoji: '🍕🥤🍟' },
      'mega-feast-combo': { name: 'Mega Shisa Feast', price: 44.99, emoji: '🍜🍕🥤🍟' },
    };

    // ========== INIT ==========
    window.addEventListener('load', () => {
      loadUsersFromStorage();
      restoreSession();
      setTimeout(() => {
        document.getElementById('page-loader').classList.add('hidden');
      }, 1800);
      renderCategories();
      renderProducts();
      renderBestSellers();
      setupScrollEffects();
      setupFadeAnimations();
      document.getElementById('admin-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
      grid.innerHTML = page.length ? page.map(productCard).join('') : `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--gray-text)">
    <div style="font-size:48px;margin-bottom:12px">🔍</div>
    <div style="font-family:var(--font-cond);font-size:16px;font-weight:700;letter-spacing:1px">No products found</div>
  </div>`;
      renderPagination(filtered.length);
    }

    function productCard(p) {
      const tagHtml = p.tags.map(t => `<span class="tag tag-${t === 'spicy' ? 'spicy' : t === 'best-seller' ? 'best' : t === 'new' ? 'new' : 'hot'}">${t === 'spicy' ? '🌶️' : t === 'best-seller' ? '⭐' : '✨'} ${t}</span>`).join('');
      const stars = '★'.repeat(Math.round(p.rating)) + '☆'.repeat(5 - Math.round(p.rating));
      return `<div class="product-card" onclick="openProductDetail(${p.id})">
    ${p.tags.includes('best-seller') ? '<div class="badge">BEST SELLER</div>' : ''}
    <div class="product-img">${p.emoji}${!p.available ? '<div class="availability-overlay">SOLD OUT</div>' : ''}</div>
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
      const bs = PRODUCTS.filter(p => p.tags.includes('best-seller')).slice(0, 4);
      document.getElementById('bestsellers-grid').innerHTML = bs.map(productCard).join('');
    }

    function renderPagination(total) {
      const pages = Math.ceil(total / state.perPage);
      const pag = document.getElementById('pagination');
      if (pages <= 1) { pag.innerHTML = ''; return; }
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
      state.priceMin = 0; state.priceMax = 9999;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts();
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
    }

    function filterByPrice(min, max, btn) {
      state.priceMin = min; state.priceMax = max;
      state.currentPage = 1;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts();
    }

    function filterProducts() {
      state.searchQuery = document.getElementById('search-input').value.toLowerCase();
      state.currentPage = 1;
      renderProducts();
    }

    // ========== PRODUCT DETAIL ==========
    function openProductDetail(id) {
      const p = PRODUCTS.find(x => x.id === id);
      if (!p) return;
      state.currentProduct = p;
      state.detailQty = 1;
      document.getElementById('modal-product-name').textContent = p.name;
      document.getElementById('modal-product-img').textContent = p.emoji;
      document.getElementById('modal-product-cat').textContent = CATEGORIES.find(c => c.id === p.cat)?.name || p.cat;
      document.getElementById('modal-product-price').textContent = `$${p.price.toFixed(2)}`;
      document.getElementById('modal-product-desc').textContent = p.desc;
      document.getElementById('modal-product-stars').textContent = '★'.repeat(Math.round(p.rating));
      document.getElementById('detail-qty').textContent = '1';
      document.getElementById('modal-product-tags').innerHTML = p.tags.map(t => `<span class="tag tag-${t === 'spicy' ? 'spicy' : t === 'best-seller' ? 'best' : 'new'}">${t}</span>`).join('');
      const avail = document.getElementById('modal-availability');
      const addBtn = document.getElementById('modal-add-cart');
      if (!p.available) { avail.textContent = '⛔ Currently unavailable'; addBtn.disabled = true; }
      else { avail.textContent = '✅ In Stock'; addBtn.disabled = false; }
      renderProductReviews(p);
      openModal('product-modal');
    }

    function changeDetailQty(d) {
      state.detailQty = Math.max(1, state.detailQty + d);
      document.getElementById('detail-qty').textContent = state.detailQty;
    }

    function addFromModal() {
      if (!state.currentProduct) return;
      requireLogin(() => {
        for (let i = 0; i < state.detailQty; i++) addToCart(state.currentProduct.id, true);
        showToast(`${state.detailQty}x ${state.currentProduct.name} added to cart! 🛒`);
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
      document.querySelectorAll('#star-selector span').forEach((s, i) => s.classList.toggle('active', i < n));
    }

    function submitReview() {
      if (!state.currentUser) { openModal('login-modal'); return; }
      const text = document.getElementById('review-text').value.trim();
      if (!text) { showToast('Please write a review text!', 'error'); return; }
      const review = { name: state.currentUser.name, stars: state.selectedReviewStar, text };
      state.currentProduct.reviews.push(review);
      renderProductReviews(state.currentProduct);
      document.getElementById('review-text').value = '';
      showToast('Review submitted! Thank you 🌟', 'success');
    }

    // ========== AUTH ==========
    async function login() {
      const email = document.getElementById('login-email').value.trim().toLowerCase();
      const pass = document.getElementById('login-password').value;
      if (!email || !pass) { showToast('Please fill in all fields', 'error'); return; }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error || 'Login failed', 'error');
          return;
        }
        state.currentUser = data.user;
        onLoginSuccess(true);
        closeModal('login-modal');
      } catch (err) {
        showToast('Cannot connect to auth API', 'error');
      }
    }

    function socialLogin(provider) {
      const fakeUser = { id: Date.now(), name: provider + ' User', email: provider.toLowerCase() + '@social.com', role: 'customer', orders: [], joined: new Date().toISOString().split('T')[0] };
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
      if (!first || !last || !email || !pass) { showToast('Please fill in all required fields', 'error'); return; }
      if (pass !== confirm) { showToast('Passwords do not match', 'error'); return; }
      if (pass.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: `${first} ${last}`,
            email,
            phone,
            password: pass,
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error || 'Register failed', 'error');
          return;
        }
        state.currentUser = data.user;
        onLoginSuccess(true);
        closeModal('register-modal');
      } catch (err) {
        showToast('Cannot connect to auth API', 'error');
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
      } else {
        document.getElementById('admin-access-btn').style.display = 'none';
      }
      updateCartCount();
      if (showWelcomeToast) {
        showToast(`Welcome back, ${state.currentUser.name.split(' ')[0]}! 🔥`, 'success');
      }
    }

    function logout() {
      state.currentUser = null;
      state.cart = [];
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
      const d = document.getElementById('user-dropdown');
      d.style.display = d.style.display === 'none' ? 'block' : 'none';
    }
    document.addEventListener('click', e => {
      const menu = document.getElementById('user-menu');
      if (menu && !menu.contains(e.target)) {
        const d = document.getElementById('user-dropdown');
        if (d) d.style.display = 'none';
      }
    });

    function requireLogin(fn, ...args) {
      if (!state.currentUser) { openModal('login-modal'); return; }
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
      if (!silent) showToast(`${p.name} added to cart! 🛒`);
    }

    function removeFromCart(id) {
      state.cart = state.cart.filter(i => i.id !== id);
      updateCartCount();
      renderCartItems();
    }

    function changeQty(id, d) {
      const item = state.cart.find(i => i.id === id);
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
      showToast(`${c.name} added! 🎁`);
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
      <div class="cart-item-img">${item.emoji.split('').slice(0, 2).join('')}</div>
      <div style="flex:1;min-width:0">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
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

    function updateCartTotals() {
      const sub = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      let delivery = 2.99;
      let discount = 0;
      if (state.promoApplied) {
        const p = state.promoApplied;
        if (p.type === 'percent') discount = sub * p.value / 100;
        else if (p.type === 'flat') discount = p.value;
        else if (p.type === 'delivery') { delivery = 0; discount = 2.99; }
        document.getElementById('cart-discount-row').style.display = 'flex';
        document.getElementById('cart-discount').textContent = `-$${discount.toFixed(2)}`;
      } else {
        document.getElementById('cart-discount-row').style.display = 'none';
      }
      const total = Math.max(0, sub + delivery - discount);
      document.getElementById('cart-subtotal').textContent = `$${sub.toFixed(2)}`;
      document.getElementById('cart-delivery').textContent = `$${delivery.toFixed(2)}`;
      document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
    }

    function applyPromo() {
      const code = document.getElementById('promo-input').value.trim().toUpperCase();
      if (!code) return;
      const promo = PROMOS[code];
      if (!promo) { showToast('Invalid promo code', 'error'); return; }
      const sub = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      if (sub < promo.min) { showToast(`Minimum order $${promo.min} required`, 'error'); return; }
      state.promoApplied = promo;
      updateCartTotals();
      showToast(`Promo applied! ${promo.desc} 🎉`, 'success');
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
      const sub = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      document.getElementById('co-subtotal').textContent = `$${sub.toFixed(2)}`;
      document.getElementById('co-total').textContent = `$${(sub + 2.99).toFixed(2)}`;
      state.selectedPayment = 'cod';
      goCheckoutStep(1);
      openModal('checkout-modal');
    }

    function goCheckoutStep(n) {
      [1, 2, 3].forEach(i => {
        document.getElementById(`checkout-step${i}`).style.display = i === n ? 'block' : 'none';
        const ind = document.getElementById(`step${i}-indicator`);
        ind.classList.toggle('active', i === n);
        ind.classList.toggle('done', i < n);
      });
      if (n === 3) placeOrder();
    }

    function selectPayment(method) {
      state.selectedPayment = method;
      ['cod', 'card', 'momo', 'bank'].forEach(m => {
        document.getElementById(`pay-${m}`).classList.toggle('selected', m === method);
      });
      document.getElementById('card-fields').style.display = method === 'card' ? 'block' : 'none';
    }

    function placeOrder() {
      const orderId = '#SF' + (1000 + ORDERS.length + 1);
      const order = {
        id: orderId,
        customer: state.currentUser.name,
        items: state.cart.map(i => `${i.name} x${i.qty}`).join(', '),
        total: parseFloat(document.getElementById('co-total').textContent.replace('$', '')),
        status: 'pending',
        date: new Date().toISOString().split('T')[0]
      };
      ORDERS.push(order);
      if (state.currentUser.orders) state.currentUser.orders.push(order);
      document.getElementById('order-id-display').textContent = orderId;
      state.cart = [];
      state.promoApplied = null;
      updateCartCount();
      renderCartItems();
      updateAdminStats();
      showToast('Order placed successfully! 🎉', 'success');
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
      showToast(`Code "${code}" copied! Use it at checkout 🎉`, 'success');
    }

    // ========== MODAL HELPERS ==========
    function openModal(id) {
      document.getElementById(id).classList.remove('hidden');
      if (id === 'orders-modal') renderOrdersModal();
      document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
      document.getElementById(id).classList.add('hidden');
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
      document.getElementById('mobile-menu').classList.remove('open');
    }

    // ========== TOAST ==========
    function showToast(msg, type = 'default') {
      const icons = { default: '🔥', success: '✅', error: '❌', info: 'ℹ️' };
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span class="toast-icon">${icons[type] || '🔥'}</span><span>${msg}</span>`;
      document.getElementById('toast-container').appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    // ========== ADMIN DASHBOARD ==========
    function openAdminDashboard() {
      if (!state.currentUser || state.currentUser.role !== 'admin') {
        showToast('Only admin can access dashboard', 'error');
        return;
      }
      window.location.href = '/admin/dashboard';
    }

    function closeAdminDashboard() {
      document.getElementById('admin-dashboard').style.display = 'none';
    }

    function showAdminPanel(name) {
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${name}`).classList.add('active');
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      event.currentTarget.classList.add('active');
      if (name === 'products') renderAdminProducts();
      if (name === 'categories') renderAdminCategories();
      if (name === 'orders') renderAdminOrders();
      if (name === 'users') renderAdminUsers();
      if (name === 'promos') renderAdminPromos();
    }

    function updateAdminStats() {
      document.getElementById('admin-orders-count').textContent = ORDERS.length;
      document.getElementById('admin-products-count').textContent = PRODUCTS.length;
      document.getElementById('admin-users-count').textContent = USERS.length;
      renderAdminRecentOrders();
    }

    function renderAdminRecentOrders() {
      const tbody = document.getElementById('admin-recent-orders');
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
      const list = filter ? PRODUCTS.filter(p => p.name.toLowerCase().includes(filter)) : PRODUCTS;
      tbody.innerHTML = list.map(p => `
    <tr>
      <td><span style="font-size:20px;margin-right:8px">${p.emoji}</span>${p.name}</td>
      <td><span style="text-transform:capitalize">${p.cat}</span></td>
      <td style="color:var(--red-light);font-weight:700">$${p.price.toFixed(2)}</td>
      <td><span class="status-badge status-${p.available ? 'active' : 'inactive'}">${p.available ? 'Active' : 'Inactive'}</span></td>
      <td>${p.tags.join(', ')}</td>
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

    function renderAdminTables() {
      renderAdminProducts();
      renderAdminRecentOrders();
    }

    function filterAdminProducts(q) { renderAdminProducts(q.toLowerCase()); }

    function changeOrderStatus(id, status) {
      const o = ORDERS.find(x => x.id === id);
      if (o) { o.status = status; renderAdminOrders(); updateAdminStats(); showToast(`Order ${id} marked as ${status}`, 'success'); }
    }

    function deleteProduct(id) {
      if (!confirm('Delete this product?')) return;
      PRODUCTS = PRODUCTS.filter(p => p.id !== id);
      renderAdminProducts();
      renderProducts();
      renderBestSellers();
      updateAdminStats();
      showToast('Product deleted', 'success');
    }

    function deleteUser(id) {
      if (id === 1) { showToast('Cannot delete admin user', 'error'); return; }
      if (!confirm('Remove this user?')) return;
      USERS.splice(USERS.findIndex(u => u.id === id), 1);
      renderAdminUsers();
      updateAdminStats();
      showToast('User removed', 'success');
    }

    function addCategory() { showToast('Category creation coming soon!', 'info'); }

    function openAddProduct() {
      document.getElementById('admin-product-modal-title').textContent = 'ADD PRODUCT';
      document.getElementById('edit-product-id').value = '';
      ['prod-name', 'prod-price', 'prod-desc', 'prod-emoji', 'prod-tags'].forEach(id => document.getElementById(id).value = '');
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
      document.getElementById('prod-tags').value = p.tags.join(', ');
      openModal('admin-product-modal');
    }

    function saveProduct() {
      const name = document.getElementById('prod-name').value.trim();
      const cat = document.getElementById('prod-cat').value;
      const price = parseFloat(document.getElementById('prod-price').value);
      const desc = document.getElementById('prod-desc').value.trim();
      const emoji = document.getElementById('prod-emoji').value.trim() || '🍜';
      const available = document.getElementById('prod-avail').value === 'true';
      const tags = document.getElementById('prod-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const editId = document.getElementById('edit-product-id').value;
      if (!name || !price || !desc) { showToast('Please fill in required fields', 'error'); return; }
      if (editId) {
        const p = PRODUCTS.find(x => x.id === parseInt(editId));
        if (p) Object.assign(p, { name, cat, price, desc, emoji, available, tags });
        showToast('Product updated! ✅', 'success');
      } else {
        PRODUCTS.push({ id: PRODUCTS.length + 1, name, cat, price, desc, emoji, available, tags, rating: 4.5, reviews: [] });
        showToast('Product added! 🎉', 'success');
      }
      closeModal('admin-product-modal');
      renderAdminProducts();
      renderProducts();
      renderBestSellers();
      renderCategories();
      updateAdminStats();
    }
