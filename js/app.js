/**
 * مِركاب | MIRKAB — Minimal 2-Section 3D Automotive Platform
 *   1. Interactive WebGL2 3D Hero (Left-to-Right Drive-In + Studio Reflections)
 *   2. Minimal Curated Products Showcase + In-Site Product Detail Overlay
 *
 * إدارة البيانات:
 *   - إعدادات الموقع والهوية وروابط التواصل: data/site-config.js
 *   - بيانات المنتجات والتصنيفات: data/products.js
 *   - مجلد صور المنتجات: assets/images/products/
 *   - طبقة قراءة البيانات القابلة للتطوير للوحة تحكم: data/store-adapter.js
 */

import { createMirkab3DShowroom } from './car3d.js';
import { MirkabStore, sanitizeHttpsUrl } from '../data/store-adapter.js';
import { MirkabMediaDB, isIndexedDbRef } from '../data/media-db.js';

const UI_TEXT = {
  ar: {
    skipLink: 'انتقل إلى المحتوى الرئيسي',
    langSwitchLabel: 'EN',
    langSwitchAria: 'Switch language to English',
    navHome: 'الرئيسية',
    navProducts: 'المنتجات',
    heroCtaProducts: 'اكتشف المنتجات',
    productsTitle: 'المنتجات المختارة',
    productsSubtitle: 'تشكيلة مختصرة تعرض الزبدة فقط — متوفرة عبر أمازون السعودية.',
    allCategories: 'الكل',
    pricePendingSar: 'السعر بالريال السعودي على Amazon',
    viewProductBtn: 'عرض المنتج',
    buyOnAmazonBtn: 'شراء من Amazon',
    detailFeaturesTitle: 'المميزات',
    detailSpecsTitle: 'المواصفات',
    detailCloseBtn: 'العودة إلى قائمة المنتجات',
    detailCloseAria: 'إغلاق نافذة تفاصيل المنتج',
    privacyLabel: 'سياسة الخصوصية',
    disclosureLabel: 'الإفصاح عن العمولة'
  },
  en: {
    skipLink: 'Skip to main content',
    langSwitchLabel: 'عربي',
    langSwitchAria: 'التبديل إلى اللغة العربية',
    navHome: 'Home',
    navProducts: 'Products',
    heroCtaProducts: 'Discover Products',
    productsTitle: 'Curated Products',
    productsSubtitle: 'Essential automotive gear — straight to the point, via Amazon.sa.',
    allCategories: 'All',
    pricePendingSar: 'Price in SAR on Amazon',
    viewProductBtn: 'View Product',
    buyOnAmazonBtn: 'Buy on Amazon',
    detailFeaturesTitle: 'Key Features',
    detailSpecsTitle: 'Specifications',
    detailCloseBtn: 'Back to Products',
    detailCloseAria: 'Close product details',
    privacyLabel: 'Privacy Policy',
    disclosureLabel: 'Affiliate Disclosure'
  }
};

const state = {
  lang: 'ar',
  selectedCategory: 'all',
  lastFocusedElement: null,
  modalCloseTimer: 0
};

const SECTIONS = ['home', 'products'];
let showroom3D = null;

function getConfigText(key) {
  const cfg = MirkabStore.getSiteConfig();
  const lang = state.lang;
  switch (key) {
    case 'pageTitle':
      return cfg.seo?.[lang]?.title || cfg.seo?.ar?.title || '';
    case 'pageDesc':
      return cfg.seo?.[lang]?.description || cfg.seo?.ar?.description || '';
    case 'heroTagline':
      return cfg.brand?.tagline?.[lang] || cfg.brand?.tagline?.ar || '';
    case 'footerDisclosure':
      return cfg.affiliate?.disclosure?.[lang] || cfg.affiliate?.disclosure?.ar || '';
    case 'liveNotice':
      return cfg.affiliate?.productLiveNotice?.[lang] || cfg.affiliate?.productLiveNotice?.ar || '';
    case 'demoNotice':
      return cfg.affiliate?.productPendingNotice?.[lang] || cfg.affiliate?.productPendingNotice?.ar || '';
    default:
      return '';
  }
}

function t(key) {
  const fromConfig = getConfigText(key);
  if (fromConfig) return fromConfig;
  const dict = UI_TEXT[state.lang] || UI_TEXT.ar;
  return dict[key] !== undefined ? dict[key] : (UI_TEXT.ar[key] || '');
}

function getCategoryName(categoryId) {
  const found = MirkabStore.getCategories().find((cat) => cat.id === categoryId);
  return found ? found[state.lang] : t('allCategories');
}

function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof textContent === 'string') el.textContent = textContent;
  return el;
}

function createSvgIcon(iconName, size = 18) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const pathsByIcon = {
    box: [
      'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
      'm3.3 7 8.7 5 8.7-5',
      'M12 22V12'
    ],
    close: ['M18 6 6 18', 'm6 6 12 12'],
    arrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
    external: [
      'M15 3h6v6',
      'M10 14 21 3',
      'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'
    ]
  };

  (pathsByIcon[iconName] || pathsByIcon.box).forEach((d) => {
    const pathEl = document.createElementNS(ns, 'path');
    pathEl.setAttribute('d', d);
    svg.appendChild(pathEl);
  });

  return svg;
}

/* ==========================================================================
   بيئة الحركة والكشف التدريجي عند التمرير
   ========================================================================== */
const motionEnv = {
  reducedMotion: false,
  rich3D: false,
  revealObserver: null
};

function evaluateMotionCapabilities() {
  const canMatch = typeof window.matchMedia === 'function';
  motionEnv.reducedMotion =
    canMatch && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer =
    canMatch && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  motionEnv.rich3D = !motionEnv.reducedMotion && finePointer;
}

function initScrollReveal() {
  if (motionEnv.reducedMotion || !('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('has-reveal');
    return;
  }

  document.documentElement.classList.add('has-reveal');
  motionEnv.revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          motionEnv.revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0.06 }
  );

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    motionEnv.revealObserver.observe(el);
  });
}

function observeRevealItems(scopeEl) {
  if (!scopeEl) return;
  const items = scopeEl.querySelectorAll('.reveal-item');
  if (!items.length) return;

  if (!motionEnv.revealObserver || motionEnv.reducedMotion) {
    items.forEach((item) => item.classList.add('is-revealed'));
    return;
  }

  const vh = window.innerHeight || 800;
  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.top < vh * 0.98 && rect.bottom > 0) {
      item.classList.add('is-revealed');
    } else {
      motionEnv.revealObserver.observe(item);
    }
  });
}

/* ==========================================================================
   تبديل اللغة (عربي / إنجليزي)
   ========================================================================== */
function createSocialSvgIcon(platform) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '17');
  svg.setAttribute('height', '17');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const pathsByPlatform = {
    instagram: [
      'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z',
      'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z',
      'M17.5 6.5h.01'
    ],
    tiktok: ['M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5'],
    snapchat: [
      'M12 3c-2.6 0-4.2 1.8-4.2 4.3v1.9c-.6.2-1.2.4-1.6.7-.3.2-.3.7.1.9.7.3 1.4.6 1.5 1.1.1.8-.8 2.1-2.5 2.7-.4.2-.5.7-.1 1 .8.5 1.8.8 2.8 1 .4.1.6.7.8 1.2.2.4.7.6 1.2.5.7-.1 1.4-.3 2-.3s1.3.2 2 .3c.5.1 1-.1 1.2-.5.2-.5.4-1.1.8-1.2 1-.2 2-.5 2.8-1 .4-.3.3-.8-.1-1-1.7-.6-2.6-1.9-2.5-2.7.1-.5.8-.8 1.5-1.1.4-.2.4-.7.1-.9-.4-.3-1-.5-1.6-.7V7.3C16.2 4.8 14.6 3 12 3Z'
    ],
    x: ['M4 4l16 16', 'M20 4 4 20'],
    whatsapp: [
      'M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21',
      'M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1'
    ]
  };

  (pathsByPlatform[platform] || pathsByPlatform.x).forEach((d) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  });

  return svg;
}

function renderFooterSocialLinks() {
  const container = document.getElementById('footer-social');
  if (!container) return;

  const activeAccounts = MirkabStore.getSocialAccounts();
  if (!activeAccounts.length) {
    container.replaceChildren();
    container.hidden = true;
    return;
  }

  const frag = document.createDocumentFragment();
  activeAccounts.forEach((account) => {
    const label = account.label?.[state.lang] || account.label?.ar || account.id;
    const link = createEl('a', 'footer-social-link');
    link.href = account.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', label);
    link.title = label;
    link.appendChild(createSocialSvgIcon(account.id));
    frag.appendChild(link);
  });

  container.replaceChildren(frag);
  container.hidden = false;
}

function applyBrandSettings() {
  const cfg = MirkabStore.getSiteConfig();
  const brand = cfg.brand || {};
  const arName = brand.ar || 'مِركاب';
  const enName = brand.en || 'MIRKAB';
  const sep = brand.separator || '|';
  const year = brand.copyrightYear || '2026';

  document.querySelectorAll('[data-brand-ar]').forEach((el) => {
    el.textContent = arName;
  });
  document.querySelectorAll('[data-brand-en]').forEach((el) => {
    el.textContent = enName;
  });
  document.querySelectorAll('[data-brand-sep]').forEach((el) => {
    el.textContent = sep;
  });
  document.querySelectorAll('[data-brand-copy]').forEach((el) => {
    el.textContent = `© ${year} ${arName} ${sep} ${enName}`;
  });
}

function applyLanguageBindings() {
  const isEn = state.lang === 'en';
  document.documentElement.lang = isEn ? 'en' : 'ar';
  document.documentElement.dir = isEn ? 'ltr' : 'rtl';
  document.title = t('pageTitle');

  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', t('pageDesc'));

  applyBrandSettings();

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = t(key);
  });

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    const code = langBtn.querySelector('.lang-code');
    if (code) {
      code.textContent = t('langSwitchLabel');
      code.setAttribute('lang', isEn ? 'ar' : 'en');
    }
    langBtn.setAttribute('aria-label', t('langSwitchAria'));
  }
}

function toggleLanguage() {
  state.lang = state.lang === 'ar' ? 'en' : 'ar';
  applyLanguageBindings();
  renderCategoryFilterBar();
  renderProducts(true);
  renderFooterSocialLinks();

  // تحديث نافذة التفاصيل المفتوحة إن وجدت
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('product/')) {
    openProductModal(hash.slice('product/'.length));
  } else if (hash === 'privacy' || hash === 'disclosure') {
    openPolicyModal(hash);
  }
}

/* ==========================================================================
   القسم 2: عرض المنتجات المختصرة (5 عناصر فقط لكل بطاقة)
   ========================================================================== */
function formatPriceLabel(rawPrice) {
  if (typeof rawPrice === 'string' && rawPrice.trim() !== '') {
    return { text: rawPrice.trim(), confirmed: true };
  }
  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice > 0) {
    const currency = MirkabStore.getSiteConfig().affiliate?.currency?.[state.lang] || (state.lang === 'en' ? 'SAR' : 'ر.س');
    return {
      text: `${rawPrice} ${currency}`,
      confirmed: true
    };
  }
  return { text: t('pricePendingSar'), confirmed: false };
}

function renderCategoryFilterBar() {
  const bar = document.getElementById('categories-bar');
  if (!bar) return;

  const frag = document.createDocumentFragment();
  const makeTab = (id, label) => {
    const isActive = state.selectedCategory === id;
    const btn = createEl('button', `cat-filter-btn ${isActive ? 'is-active' : ''}`.trim(), label);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(isActive));
    btn.addEventListener('click', () => {
      state.selectedCategory = id;
      renderCategoryFilterBar();
      renderProducts(true);
    });
    return btn;
  };

  frag.appendChild(makeTab('all', t('allCategories')));
  MirkabStore.getCategories().forEach((cat) => {
    frag.appendChild(makeTab(cat.id, cat[state.lang]));
  });

  bar.replaceChildren(frag);
}

function bindProductCard3D(card) {
  if (!motionEnv.rich3D || !card) return;

  let rafId = 0;
  let lastX = 0.5;
  let lastY = 0.22;

  const commitFrame = () => {
    rafId = 0;
    const rx = (0.5 - lastY) * 5.2;
    const ry = (lastX - 0.5) * 6.0;
    card.style.setProperty('--tilt-rx', `${rx.toFixed(2)}deg`);
    card.style.setProperty('--tilt-ry', `${ry.toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(lastX * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(lastY * 100).toFixed(1)}%`);
  };

  const resetCard = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    card.classList.remove('is-tilting');
    card.style.removeProperty('--tilt-rx');
    card.style.removeProperty('--tilt-ry');
    card.style.removeProperty('--mx');
    card.style.removeProperty('--my');
  };

  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    card.classList.add('is-tilting');
  });

  card.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    lastX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    lastY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (!card.classList.contains('is-tilting')) {
      card.classList.add('is-tilting');
    }
    if (!rafId) {
      rafId = window.requestAnimationFrame(commitFrame);
    }
  });

  card.addEventListener('pointerleave', resetCard);
  card.addEventListener('pointercancel', resetCard);
}

function applyResolvedProductImage(imgEl, stageEl, srcRef) {
  if (!imgEl || !stageEl) return;
  stageEl.classList.remove('is-fallback');
  if (!srcRef) {
    stageEl.classList.add('is-fallback');
    return;
  }

  if (isIndexedDbRef(srcRef)) {
    imgEl.removeAttribute('src');
    MirkabMediaDB.resolveImageUrl(srcRef)
      .then((resolvedUrl) => {
        if (!imgEl.isConnected) return;
        if (resolvedUrl) {
          imgEl.src = resolvedUrl;
        } else {
          stageEl.classList.add('is-fallback');
        }
      })
      .catch(() => {
        if (stageEl.isConnected) stageEl.classList.add('is-fallback');
      });
    return;
  }

  imgEl.src = srcRef;
}

function renderProducts(isInteractiveUpdate = false) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const filtered = MirkabStore.getProducts({ category: state.selectedCategory });

  const fragment = document.createDocumentFragment();

  filtered.forEach((product, index) => {
    const copy = product[state.lang];
    const card = createEl('article', 'product-card reveal-item');
    card.style.setProperty('--stagger-index', isInteractiveUpdate ? '0' : String(index % 3));
    if (isInteractiveUpdate) card.classList.add('is-revealed');

    // 1. صورة المنتج
    const media = createEl('div', 'product-media');
    const img = document.createElement('img');
    img.className = 'product-img';
    img.alt = copy.name;
    img.width = 800;
    img.height = 600;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => media.classList.add('is-fallback'));
    applyResolvedProductImage(img, media, product.image);

    const fallback = createEl('div', 'media-fallback');
    fallback.append(createSvgIcon('box', 28), createEl('span', '', copy.name));
    media.append(img, fallback);

    const body = createEl('div', 'product-body');

    // 2. اسم المنتج
    const title = createEl('h3', 'product-title', copy.name);

    // 3. السعر بالريال السعودي (مؤكد أو مؤشر التوفر على Amazon دون أسعار وهمية)
    const priceInfo = formatPriceLabel(product.price);
    const priceEl = createEl(
      'p',
      `product-price ${priceInfo.confirmed ? 'is-confirmed' : ''}`.trim(),
      priceInfo.text
    );

    // 4. فائدة المنتج في جملة قصيرة جداً
    const benefit = createEl('p', 'product-benefit', copy.benefit);

    // 5. زر «عرض المنتج» الفضي الأنيق لفتح واجهة التفاصيل داخل الموقع
    const actions = createEl('div', 'product-actions');
    const viewBtn = createEl('button', 'btn btn-silver product-view-btn');
    viewBtn.type = 'button';
    const arrow = createSvgIcon('arrowLeft', 16);
    arrow.classList.add('btn-arrow');
    viewBtn.append(createEl('span', '', t('viewProductBtn')), arrow);
    viewBtn.addEventListener('click', () => openProductModal(product.id));
    actions.appendChild(viewBtn);

    body.append(title, priceEl, benefit, actions);
    card.append(media, body);
    bindProductCard3D(card);
    fragment.appendChild(card);
  });

  grid.replaceChildren(fragment);
  if (!isInteractiveUpdate) {
    observeRevealItems(grid);
  }
}

/* ==========================================================================
   واجهة تفاصيل المنتج داخل نفس الموقع (انتقال سلس + تقسيم احترافي)
   ========================================================================== */
function openModal({ kicker, title, bodyNodes, hashValue, isProductDetail = false, labelledById = 'modal-title' }) {
  const backdrop = document.getElementById('mirkab-modal');
  const dialog = backdrop ? backdrop.querySelector('.modal-dialog') : null;
  const kickerEl = document.getElementById('modal-kicker');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!backdrop || !dialog || !kickerEl || !titleEl || !bodyEl) return;

  if (state.modalCloseTimer) {
    clearTimeout(state.modalCloseTimer);
    state.modalCloseTimer = 0;
  }

  if (backdrop.hidden) {
    state.lastFocusedElement = document.activeElement;
  }

  dialog.classList.toggle('is-product-detail', isProductDetail);
  backdrop.setAttribute('aria-labelledby', labelledById);
  kickerEl.textContent = kicker || '';
  titleEl.textContent = title || '';
  bodyEl.replaceChildren(...bodyNodes);

  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';

  if (motionEnv.reducedMotion) {
    backdrop.classList.add('is-open');
  } else {
    void backdrop.offsetWidth;
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
  }

  if (hashValue && window.location.hash !== `#${hashValue}`) {
    history.pushState(null, '', `#${hashValue}`);
  }
  dialog.focus({ preventScroll: true });
}

function closeModal(updateHash = true) {
  const backdrop = document.getElementById('mirkab-modal');
  const dialog = backdrop ? backdrop.querySelector('.modal-dialog') : null;
  if (!backdrop || backdrop.hidden) return;

  if (state.modalCloseTimer) {
    clearTimeout(state.modalCloseTimer);
    state.modalCloseTimer = 0;
  }

  backdrop.classList.remove('is-open');
  document.body.style.overflow = '';

  if (updateHash && /^#(product|privacy|disclosure)/.test(window.location.hash)) {
    history.pushState(null, '', '#products');
  }

  const finishClose = () => {
    state.modalCloseTimer = 0;
    backdrop.hidden = true;
    if (dialog) dialog.classList.remove('is-product-detail');
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus({ preventScroll: true });
    }
  };

  if (motionEnv.reducedMotion) {
    finishClose();
  } else {
    state.modalCloseTimer = window.setTimeout(finishClose, 320);
  }
}

function openProductModal(productId) {
  const product = MirkabStore.getProductById(productId);
  if (!product) return;

  const copy = product[state.lang];
  const layout = createEl('div', 'detail-layout');

  // زر إغلاق سريع أعلى النافذة
  const floatingClose = createEl('button', 'modal-close-btn detail-close-floating');
  floatingClose.type = 'button';
  floatingClose.setAttribute('aria-label', t('detailCloseAria'));
  floatingClose.appendChild(createSvgIcon('close', 20));
  floatingClose.addEventListener('click', () => closeModal(true));
  layout.appendChild(floatingClose);

  // الجهة اليمنى (على الديسكتوب RTL) / الأعلى (على الجوال): صورة المنتج الكبيرة + الصور الإضافية إن توفرت
  const galleryCol = createEl('div', 'detail-gallery');
  const mainStage = createEl('div', 'detail-main-stage');

  const rawGallery = [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(
    (src, idx, arr) => typeof src === 'string' && src.trim() !== '' && arr.indexOf(src) === idx
  );

  const mainImg = document.createElement('img');
  mainImg.className = 'detail-main-img';
  mainImg.alt = copy.name;
  mainImg.width = 1000;
  mainImg.height = 750;
  mainImg.referrerPolicy = 'no-referrer';
  mainImg.addEventListener('error', () => mainStage.classList.add('is-fallback'));
  applyResolvedProductImage(mainImg, mainStage, rawGallery[0] || product.image);

  const fallback = createEl('div', 'media-fallback');
  fallback.append(createSvgIcon('box', 34), createEl('span', '', copy.name));
  mainStage.append(mainImg, fallback);
  galleryCol.appendChild(mainStage);

  if (rawGallery.length > 1) {
    const thumbs = createEl('div', 'detail-thumbs');
    rawGallery.forEach((src, idx) => {
      const thumbBtn = createEl('button', `detail-thumb-btn ${idx === 0 ? 'is-active' : ''}`.trim());
      thumbBtn.type = 'button';
      thumbBtn.setAttribute('aria-label', `${copy.name} ${idx + 1}`);
      const thumbImg = document.createElement('img');
      thumbImg.alt = '';
      thumbImg.loading = 'lazy';
      thumbImg.referrerPolicy = 'no-referrer';
      applyResolvedProductImage(thumbImg, thumbBtn, src);
      thumbBtn.appendChild(thumbImg);
      thumbBtn.addEventListener('click', () => {
        applyResolvedProductImage(mainImg, mainStage, src);
        thumbs.querySelectorAll('.detail-thumb-btn').forEach((b) => b.classList.toggle('is-active', b === thumbBtn));
      });
      thumbs.appendChild(thumbBtn);
    });
    galleryCol.appendChild(thumbs);
  }

  // الجهة اليسرى (على الديسكتوب RTL) / الأسفل (على الجوال): المعلومات
  const infoCol = createEl('div', 'detail-info');

  // 1. أول عنصر ظاهر: زر «شراء من Amazon»
  const topCtaWrap = createEl('div', 'detail-top-cta-wrap');
  const validUrl = sanitizeHttpsUrl(product.amazonUrl);
  const inlineNotice = createEl('div', 'detail-amazon-note', validUrl ? t('liveNotice') : t('demoNotice'));

  if (validUrl) {
    const buyLink = createEl('a', 'btn btn-primary detail-amazon-btn');
    buyLink.href = validUrl;
    buyLink.target = '_blank';
    buyLink.rel = 'sponsored nofollow noopener noreferrer';
    buyLink.append(createEl('span', '', t('buyOnAmazonBtn')), createSvgIcon('external', 16));
    topCtaWrap.append(buyLink, inlineNotice);
  } else {
    inlineNotice.hidden = true;
    const buyBtn = createEl('button', 'btn btn-primary detail-amazon-btn');
    buyBtn.type = 'button';
    buyBtn.append(createEl('span', '', t('buyOnAmazonBtn')), createSvgIcon('external', 16));
    buyBtn.addEventListener('click', () => {
      inlineNotice.hidden = false;
    });
    topCtaWrap.append(buyBtn, inlineNotice);
  }
  infoCol.appendChild(topCtaWrap);

  // 2. اسم المنتج والسعر
  const head = createEl('div', 'detail-head');
  const titleEl = createEl('h2', 'detail-title', copy.name);
  titleEl.id = 'detail-product-title';
  const priceInfo = formatPriceLabel(product.price);
  const priceEl = createEl(
    'p',
    `detail-price ${priceInfo.confirmed ? 'is-confirmed' : ''}`.trim(),
    priceInfo.text
  );
  head.append(titleEl, priceEl);
  infoCol.appendChild(head);

  // 3. وصف مختصر
  infoCol.appendChild(createEl('p', 'detail-desc', copy.description));

  // 4. المميزات والمواصفات الكاملة (حقائق عملية فقط دون أي بيانات وهمية)
  if (Array.isArray(copy.features) && copy.features.length > 0) {
    const featBlock = createEl('div', 'detail-block');
    featBlock.appendChild(createEl('h3', 'detail-block-title', t('detailFeaturesTitle')));
    const ul = createEl('ul', 'detail-list');
    copy.features.forEach((item) => ul.appendChild(createEl('li', '', item)));
    featBlock.appendChild(ul);
    infoCol.appendChild(featBlock);
  }

  if (Array.isArray(copy.specs) && copy.specs.length > 0) {
    const specsBlock = createEl('div', 'detail-block');
    specsBlock.appendChild(createEl('h3', 'detail-block-title', t('detailSpecsTitle')));
    const dl = createEl('dl', 'detail-specs');
    copy.specs.forEach((row) => {
      const rowWrap = createEl('div', 'detail-spec-row');
      rowWrap.append(createEl('dt', '', row.label), createEl('dd', '', row.value));
      dl.appendChild(rowWrap);
    });
    specsBlock.appendChild(dl);
    infoCol.appendChild(specsBlock);
  }

  // 5. زر إغلاق للعودة إلى قائمة المنتجات
  const footerActions = createEl('div', 'detail-footer-actions');
  const backBtn = createEl('button', 'btn btn-surface detail-back-btn', t('detailCloseBtn'));
  backBtn.type = 'button';
  backBtn.addEventListener('click', () => closeModal(true));
  footerActions.appendChild(backBtn);
  infoCol.appendChild(footerActions);

  layout.append(galleryCol, infoCol);

  openModal({
    kicker: getCategoryName(product.category),
    title: copy.name,
    bodyNodes: [layout],
    hashValue: `product/${product.id}`,
    isProductDetail: true,
    labelledById: 'detail-product-title'
  });
}

function openPolicyModal(type) {
  const brandCode = MirkabStore.getSiteConfig().brand?.en || 'MIRKAB';

  if (type === 'privacy') {
    const nodes =
      state.lang === 'en'
        ? [
            createEl('p', 'modal-paragraph', `${brandCode} operates as a static site without personal data collection or tracking databases.`),
            createEl('p', 'modal-paragraph', 'When navigating to Amazon.sa, Amazon’s privacy policy applies.')
          ]
        : [
            createEl('p', 'modal-paragraph', 'يعمل مِركاب كموقع ثابت دون جمع بيانات شخصية أو قواعد تتبع خلفية.'),
            createEl('p', 'modal-paragraph', 'عند الانتقال إلى أمازون السعودية عبر الروابط الخارجية، تطبق سياسة الخصوصية الخاصة بأمازون.')
          ];
    openModal({
      kicker: brandCode,
      title: t('privacyLabel'),
      bodyNodes: nodes,
      hashValue: 'privacy',
      isProductDetail: false,
      labelledById: 'modal-title'
    });
    return;
  }

  if (type === 'disclosure') {
    const nodes =
      state.lang === 'en'
        ? [
            createEl('div', 'modal-notice', t('footerDisclosure')),
            createEl('p', 'modal-paragraph', `${brandCode} is an independent affiliate curation platform participating in Amazon.sa Affiliate.`)
          ]
        : [
            createEl('div', 'modal-notice', t('footerDisclosure')),
            createEl('p', 'modal-paragraph', 'مِركاب منصة مستقلة للتسويق بالعمولة عبر برنامج أمازون السعودية ولا تمثل أمازون رسمياً.')
          ];
    openModal({
      kicker: brandCode,
      title: t('disclosureLabel'),
      bodyNodes: nodes,
      hashValue: 'disclosure',
      isProductDetail: false,
      labelledById: 'modal-title'
    });
  }
}

/* ==========================================================================
   التنقل وتزامن المشهد 3D
   ========================================================================== */
function setActiveNavItem(sectionId) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const isMatch = link.getAttribute('data-nav') === sectionId;
    link.classList.toggle('is-active', isMatch);
    if (isMatch) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function scrollToSection(sectionId, updateHash = true) {
  closeMobileDrawer();
  closeModal(false);
  setActiveNavItem(sectionId);

  if (updateHash && window.location.hash !== `#${sectionId}`) {
    history.pushState(null, '', `#${sectionId}`);
  }

  if (sectionId === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const target = document.getElementById(sectionId);
  if (target) {
    if (target.hasAttribute('data-reveal')) {
      target.classList.add('is-revealed');
      observeRevealItems(target);
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeMobileDrawer() {
  const btn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (!btn || !drawer) return;
  drawer.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

function handleHashRoute() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) {
    closeModal(false);
    setActiveNavItem('home');
    return;
  }
  if (raw.startsWith('product/')) {
    const id = raw.slice('product/'.length);
    if (MirkabStore.getProductById(id)) {
      openProductModal(id);
      return;
    }
  }
  if (raw === 'privacy' || raw === 'disclosure') {
    openPolicyModal(raw);
    return;
  }
  closeModal(false);
  if (SECTIONS.includes(raw)) {
    scrollToSection(raw, false);
  }
}

function init3DHeroIntegration() {
  const canvas = document.getElementById('mirkab-3d-canvas');
  const fallback = document.getElementById('hero-webgl-fallback');
  const hero = document.getElementById('home');
  const header = document.getElementById('site-header');
  if (!canvas || !hero) return;

  showroom3D = createMirkab3DShowroom(canvas, {
    reducedMotion: motionEnv.reducedMotion,
    onContextLost: () => {
      if (fallback) fallback.hidden = false;
    },
    onContextRestored: () => {
      if (fallback) fallback.hidden = true;
    }
  });

  if (!showroom3D && fallback) {
    fallback.hidden = false;
  }

  let scrollRaf = 0;
  const onScroll = () => {
    scrollRaf = 0;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
    if (showroom3D) {
      const h = hero.offsetHeight || 720;
      const progress = Math.max(0, Math.min(1, window.scrollY / (h * 0.9)));
      showroom3D.setScrollProgress(progress);
    }
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!scrollRaf && !document.hidden) {
        scrollRaf = requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );

  if ('IntersectionObserver' in window && showroom3D) {
    const visObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => showroom3D?.setVisible(entry.isIntersecting));
      },
      { threshold: 0.02 }
    );
    visObserver.observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    if (showroom3D) showroom3D.setVisible(!document.hidden);
  });
}

function setupEvents() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => {
      const willOpen = drawer.hidden;
      drawer.hidden = !willOpen;
      menuBtn.setAttribute('aria-expanded', String(willOpen));
    });
  }

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) langBtn.addEventListener('click', toggleLanguage);

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = (anchor.getAttribute('href') || '').slice(1);
      if (SECTIONS.includes(targetId)) {
        e.preventDefault();
        scrollToSection(targetId, true);
      }
    });
  });

  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openPolicyModal(btn.getAttribute('data-open-modal')));
  });

  const modalBackdrop = document.getElementById('mirkab-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => closeModal(true));
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal(true);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(true);
      closeMobileDrawer();
    }
  });

  window.addEventListener('hashchange', handleHashRoute);

  window.addEventListener('storage', (e) => {
    if (e.key === 'mirkab_catalog_override_v1' || e.key === 'mirkab_site_config_override_v1') {
      applyLanguageBindings();
      renderCategoryFilterBar();
      renderProducts(true);
      renderFooterSocialLinks();
    }
  });

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            setActiveNavItem(entry.target.id);
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    );

    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) navObserver.observe(el);
    });
  }
}

function initApp() {
  evaluateMotionCapabilities();
  initScrollReveal();
  applyLanguageBindings();
  renderCategoryFilterBar();
  renderProducts();
  renderFooterSocialLinks();
  setupEvents();
  init3DHeroIntegration();
  handleHashRoute();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
