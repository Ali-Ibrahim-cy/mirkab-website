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
    { rootMargin: '120px 0px 120px 0px', threshold: 0.01 }
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
    if (rect.top < vh * 1.15 && rect.bottom > -120) {
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
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');

  const pathByPlatform = {
    instagram:
      'M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm9.65 1.9a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3ZM12 6.85A5.15 5.15 0 1 1 6.85 12 5.15 5.15 0 0 1 12 6.85Zm0 1.8A3.35 3.35 0 1 0 15.35 12 3.35 3.35 0 0 0 12 8.65Z',
    tiktok:
      'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3 6.34 6.34 0 0 0 9.49 21.64a6.34 6.34 0 0 0 6.34-6.34V8.69a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.12Z',
    snapchat:
      'M12.2 2c2.87 0 5.14 1.85 5.14 5.25 0 .64-.08 1.3-.15 1.85.37-.04.74-.04 1.07.09.52.2.82.64.82 1.11 0 .62-.54 1.12-1.2 1.3-.47.13-.77.31-.85.56-.1.33.05.78.4 1.24.75.99 1.72 1.66 2.66 1.93.41.12.66.44.66.81 0 .44-.39.84-1.08 1.05-.42.13-.91.22-1.38.28-.14.02-.22.14-.26.35-.08.37-.24.71-.52.9-.31.21-.73.24-1.15.17-.5-.09-1.05-.21-1.7-.21-.84 0-1.46.32-2.06.71-.61.4-1.23.75-2.05.75-.82 0-1.44-.35-2.05-.75-.6-.39-1.22-.71-2.06-.71-.65 0-1.2.12-1.7.21-.42.07-.84.04-1.15-.17-.28-.19-.44-.53-.52-.9-.04-.21-.12-.33-.26-.35-.47-.06-.96-.15-1.38-.28-.69-.21-1.08-.61-1.08-1.05 0-.37.25-.69.66-.81.94-.27 1.91-.94 2.66-1.93.35-.46.5-.91.4-1.24-.08-.25-.38-.43-.85-.56-.66-.18-1.2-.68-1.2-1.3 0-.47.3-.91.82-1.11.33-.13.7-.13 1.07-.09-.07-.55-.15-1.21-.15-1.85C6.86 3.85 9.13 2 12 2h.2Z',
    x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    whatsapp:
      'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2Zm5.82 14.08c-.24.68-1.41 1.3-1.95 1.38-.5.07-1.13.1-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.94-4.38-.14-.19-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1.01-2.41.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.59.82 2.02.89 2.17.07.15.12.32.02.51-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.15-.29.31-.13.6.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.7-.17 1.38Z'
  };

  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', pathByPlatform[platform] || pathByPlatform.x);
  svg.appendChild(p);
  return svg;
}

function renderFooterSocialLinks() {
  const container = document.getElementById('footer-social');
  if (!container) return;

  const allAccounts = MirkabStore.getSocialAccounts({ includeInactive: true });
  const unlinkedLabelSuffix = state.lang === 'en' ? 'Coming soon' : 'قريباً';

  const frag = document.createDocumentFragment();
  allAccounts.forEach((account) => {
    const label = account.label?.[state.lang] || account.label?.ar || account.id;
    const isLinked = account.enabled && Boolean(account.url);

    if (isLinked) {
      const link = createEl('a', 'footer-social-link is-linked');
      link.href = account.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', label);
      link.title = label;
      link.dataset.platform = account.id;
      link.appendChild(createSocialSvgIcon(account.id));
      frag.appendChild(link);
    } else {
      const placeholder = createEl('span', 'footer-social-link is-unlinked');
      placeholder.setAttribute('role', 'img');
      placeholder.setAttribute('aria-disabled', 'true');
      placeholder.setAttribute('aria-label', `${label} (${unlinkedLabelSuffix})`);
      placeholder.title = `${label} — ${unlinkedLabelSuffix}`;
      placeholder.dataset.platform = account.id;
      placeholder.appendChild(createSocialSvgIcon(account.id));
      frag.appendChild(placeholder);
    }
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
  if (document.getElementById('products-sync-notice')) {
    showSupabaseFallbackNotice(true);
  }
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
    imgEl.removeAttribute('src');
    stageEl.classList.add('is-fallback');
    return;
  }

  imgEl.src = srcRef;
}

function renderProducts(isInteractiveUpdate = false) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const filtered = MirkabStore.getProducts({ category: state.selectedCategory });
  if (!filtered.length) {
    const emptyMsg =
      state.lang === 'en'
        ? 'No published products are currently available in this category.'
        : 'لا توجد منتجات منشورة متاحة في هذا التصنيف حالياً.';
    grid.replaceChildren(createEl('p', 'section-subtitle', emptyMsg));
    return;
  }

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

  try {
    showroom3D = createMirkab3DShowroom(canvas, {
      reducedMotion: motionEnv.reducedMotion,
      onContextLost: () => {
        if (fallback) fallback.hidden = false;
      },
      onContextRestored: () => {
        if (fallback) fallback.hidden = true;
      }
    });
  } catch (err) {
    console.error('3D Showroom initialization error:', err);
    showroom3D = null;
  }

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

function showSupabaseFallbackNotice(show) {
  const section = document.getElementById('products');
  const grid = document.getElementById('products-grid');
  if (!section || !grid) return;
  let notice = document.getElementById('products-sync-notice');
  if (!show) {
    if (notice) notice.remove();
    return;
  }
  if (!notice) {
    notice = createEl('p', 'section-subtitle');
    notice.id = 'products-sync-notice';
    notice.style.marginBottom = '20px';
    grid.parentNode.insertBefore(notice, grid);
  }
  notice.textContent =
    state.lang === 'en'
      ? 'Live catalog sync is temporarily unavailable — showing default curated gear.'
      : 'تعذر تحديث البيانات من الخادم حالياً — يتم عرض القائمة الأساسية.';
}

async function initApp() {
  evaluateMotionCapabilities();
  initScrollReveal();
  init3DHeroIntegration();

  // عرض الهوية والأيقونات والأحداث فوراً دون انتظار الشبكة
  applyLanguageBindings();
  renderFooterSocialLinks();
  setupEvents();

  let loadRes = null;
  try {
    loadRes = await MirkabStore.loadPublicData();
  } catch (err) {
    console.error('Supabase public fetch error:', err);
    loadRes = { source: 'fallback-error' };
  }

  applyLanguageBindings();
  renderCategoryFilterBar();
  renderProducts();
  showSupabaseFallbackNotice(loadRes?.source === 'fallback-error');
  renderFooterSocialLinks();
  handleHashRoute();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
