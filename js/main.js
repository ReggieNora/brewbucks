/**
 * BrewBucks — Main JavaScript
 * Navigation, Cart, Filters, FAQ, Email Capture, Scroll Animations
 */

(function () {
  'use strict';

  // ===========================
  // Wallet Connection (Phantom / Solana)
  // ===========================
  var walletBtn = document.getElementById('walletBtn');
  var walletLabel = document.getElementById('walletLabel');
  var connectedWallet = null;

  function truncateAddress(address) {
    return address.slice(0, 4) + '...' + address.slice(-4);
  }

  function setWalletConnected(publicKey) {
    connectedWallet = publicKey;
    var addr = publicKey.toString();
    walletLabel.textContent = truncateAddress(addr);
    walletBtn.classList.add('nav__wallet--connected');
    walletBtn.setAttribute('aria-label', 'Wallet connected: ' + addr);
    localStorage.setItem('brewbucks_wallet_connected', 'true');
  }

  function setWalletDisconnected() {
    connectedWallet = null;
    walletLabel.textContent = 'Connect Wallet';
    walletBtn.classList.remove('nav__wallet--connected');
    walletBtn.setAttribute('aria-label', 'Connect wallet');
    localStorage.removeItem('brewbucks_wallet_connected');
  }

  function getPhantomProvider() {
    if (window.solana && window.solana.isPhantom) {
      return window.solana;
    }
    return null;
  }

  function connectWallet() {
    var provider = getPhantomProvider();
    if (!provider) {
      showToast('Phantom wallet not found. Please install it from phantom.app');
      return;
    }

    provider.connect()
      .then(function (resp) {
        setWalletConnected(resp.publicKey);
        showToast('Wallet connected');
      })
      .catch(function () {
        showToast('Connection cancelled');
      });
  }

  function disconnectWallet() {
    var provider = getPhantomProvider();
    if (provider) {
      provider.disconnect();
    }
    setWalletDisconnected();
    showToast('Wallet disconnected');
  }

  if (walletBtn) {
    walletBtn.addEventListener('click', function () {
      if (connectedWallet) {
        disconnectWallet();
      } else {
        connectWallet();
      }
    });

    // Auto-reconnect if previously connected
    var provider = getPhantomProvider();
    if (provider && localStorage.getItem('brewbucks_wallet_connected') === 'true') {
      provider.connect({ onlyIfTrusted: true })
        .then(function (resp) {
          setWalletConnected(resp.publicKey);
        })
        .catch(function () {
          localStorage.removeItem('brewbucks_wallet_connected');
        });
    }

    // Listen for wallet disconnect events
    if (provider) {
      provider.on('disconnect', function () {
        setWalletDisconnected();
      });
      provider.on('accountChanged', function (publicKey) {
        if (publicKey) {
          setWalletConnected(publicKey);
        } else {
          setWalletDisconnected();
        }
      });
    }
  }

  // ===========================
  // Navigation
  // ===========================
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  // Scroll behavior — add background on scroll
  function handleNavScroll() {
    if (window.scrollY > 40) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  // Mobile toggle
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    // Close nav when a link is clicked
    navLinks.querySelectorAll('.nav__link').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ===========================
  // Cart
  // ===========================
  var cart = JSON.parse(localStorage.getItem('brewbucks_cart') || '[]');

  function saveCart() {
    localStorage.setItem('brewbucks_cart', JSON.stringify(cart));
  }

  function updateCartCount() {
    var total = cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
    document.querySelectorAll('#cartCount').forEach(function (el) {
      el.textContent = total;
    });
  }

  function addToCart(name, price) {
    var existing = cart.find(function (item) { return item.name === name; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ name: name, price: parseFloat(price), qty: 1 });
    }
    saveCart();
    updateCartCount();
    renderCartItems();
    showToast(name + ' added to cart');
  }

  function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartCount();
    renderCartItems();
  }

  function updateQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    saveCart();
    updateCartCount();
    renderCartItems();
  }

  function getCartTotal() {
    return cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  // Cart Drawer
  function createCartDrawer() {
    if (document.getElementById('cartDrawer')) return;

    var overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.id = 'cartOverlay';

    var drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.id = 'cartDrawer';
    drawer.innerHTML =
      '<div class="cart-drawer__header">' +
        '<h3>Your Cart</h3>' +
        '<button class="cart-drawer__close" id="cartClose">&times;</button>' +
      '</div>' +
      '<div class="cart-drawer__items" id="cartItems"></div>' +
      '<div class="cart-drawer__footer" id="cartFooter">' +
        '<div class="cart-drawer__total">' +
          '<span>Total</span>' +
          '<span id="cartTotal">$0</span>' +
        '</div>' +
        '<button class="btn btn--primary">Checkout</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    overlay.addEventListener('click', closeCart);
    document.getElementById('cartClose').addEventListener('click', closeCart);
  }

  function openCart() {
    createCartDrawer();
    renderCartItems();
    document.getElementById('cartOverlay').classList.add('active');
    document.getElementById('cartDrawer').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    var overlay = document.getElementById('cartOverlay');
    var drawer = document.getElementById('cartDrawer');
    if (overlay) overlay.classList.remove('active');
    if (drawer) drawer.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderCartItems() {
    var container = document.getElementById('cartItems');
    var footer = document.getElementById('cartFooter');
    var totalEl = document.getElementById('cartTotal');
    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML =
        '<div class="cart-drawer__empty">' +
          '<span>&#9749;</span>' +
          '<p>Your cart is empty</p>' +
        '</div>';
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = '';
    var html = '';
    cart.forEach(function (item, i) {
      html +=
        '<div class="cart-item">' +
          '<div class="cart-item__info">' +
            '<h4>' + item.name + '</h4>' +
            '<p>$' + item.price.toFixed(2) + '</p>' +
          '</div>' +
          '<div class="cart-item__actions">' +
            '<div class="cart-item__qty">' +
              '<button data-action="decrease" data-index="' + i + '">-</button>' +
              '<span>' + item.qty + '</span>' +
              '<button data-action="increase" data-index="' + i + '">+</button>' +
            '</div>' +
            '<button class="cart-item__remove" data-action="remove" data-index="' + i + '">Remove</button>' +
          '</div>' +
        '</div>';
    });
    container.innerHTML = html;

    if (totalEl) {
      totalEl.textContent = '$' + getCartTotal().toFixed(2);
    }

    // Attach event listeners
    container.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-index'));
        var action = this.getAttribute('data-action');
        if (action === 'increase') updateQty(idx, 1);
        else if (action === 'decrease') updateQty(idx, -1);
        else if (action === 'remove') removeFromCart(idx);
      });
    });
  }

  // Cart button
  document.querySelectorAll('#cartBtn').forEach(function (btn) {
    btn.addEventListener('click', openCart);
  });

  // Add to cart buttons
  document.querySelectorAll('.add-to-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = this.getAttribute('data-name');
      var price = this.getAttribute('data-price');
      addToCart(name, price);
    });
  });

  updateCartCount();

  // ===========================
  // Toast Notifications
  // ===========================
  var toastTimeout;

  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      toast.classList.add('active');
    });

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toast.classList.remove('active');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // ===========================
  // Shop Filters
  // ===========================
  var filterBtns = document.querySelectorAll('.filter-btn');
  var productCards = document.querySelectorAll('.product-card');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var filter = this.getAttribute('data-filter');

      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');

      productCards.forEach(function (card) {
        var categories = card.getAttribute('data-category') || '';
        if (filter === 'all' || categories.indexOf(filter) !== -1) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // ===========================
  // FAQ Accordion
  // ===========================
  document.querySelectorAll('.faq-item__question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = this.closest('.faq-item');
      var isActive = item.classList.contains('active');

      // Close all in the same list
      var list = item.closest('.faq-list');
      if (list) {
        list.querySelectorAll('.faq-item').forEach(function (faq) {
          faq.classList.remove('active');
        });
      }

      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // ===========================
  // Email Capture
  // ===========================
  var emailForm = document.getElementById('emailForm');
  if (emailForm) {
    emailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('emailInput');
      var note = document.getElementById('emailNote');
      var email = input.value.trim();

      if (email) {
        // Placeholder: send to your email service (Mailchimp, ConvertKit, etc.)
        console.log('Email captured:', email);

        input.value = '';
        input.disabled = true;
        note.textContent = 'You\'re on the list! We\'ll be in touch.';
        // Support both hero-home and email-capture note classes
        note.className = note.className.indexOf('hero-home') !== -1
          ? 'hero-home__note hero-home__note--success'
          : 'email-capture__note email-capture__note--success';

        // Re-enable after a delay
        setTimeout(function () {
          input.disabled = false;
          note.textContent = note.className.indexOf('hero-home') !== -1
            ? 'Join 2,500+ coffee lovers. No spam, ever.'
            : 'No spam. Unsubscribe anytime.';
          note.className = note.className.indexOf('hero-home') !== -1
            ? 'hero-home__note'
            : 'email-capture__note';
        }, 5000);
      }
    });
  }

  // ===========================
  // Scroll Animations (fade-in)
  // ===========================
  function initScrollAnimations() {
    var elements = document.querySelectorAll(
      '.coffee-bag-card, .promise-card, .showcase-item, .product-card, .benefit-card, .value-card, .team-card, .nft-step, .stat-box, .faq-category'
    );

    elements.forEach(function (el) {
      el.classList.add('fade-in');
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  if ('IntersectionObserver' in window) {
    initScrollAnimations();
  }

})();

// ===========================
// Copy Contract Address
// ===========================
function copyContract() {
  var address = document.getElementById('contractAddress');
  if (!address) return;
  navigator.clipboard.writeText(address.textContent).then(function () {
    var btn = address.closest('.brew-token__address').querySelector('.brew-token__copy');
    btn.classList.add('copied');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(function () {
      btn.classList.remove('copied');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    }, 2000);
  });
}
