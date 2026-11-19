/**
 * مِركاب | MIRKAB — طبقة إدارة البيانات والتخزين المحلي (Store Adapter)
 * --------------------------------------------------------------------------
 * تجمع بين البيانات الافتراضية المضمّنة (data/products.js و data/site-config.js)
 * والتعديلات المحفوظة محلياً في المتصفح (localStorage) بحيث:
 *   - يقرأ الموقع العام التعديلات تلقائياً دون أي كود إداري ظاهر للزوار.
 *   - تدير لوحة التحكم المنتجات والإعدادات والروابط وحسابات التواصل بشكل كامل.
 *   - تحفظ البيانات الـ 11 الافتراضية ولا تُفقد أبداً عند التحديث.
 */

import { SITE_CONFIG } from './site-config.js';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_IMAGES_BASE_DIR,
  PRODUCTS
} from './products.js';

const STORAGE_KEYS = {
  PRODUCTS: 'mirkab_catalog_override_v1',
  SITE_CONFIG: 'mirkab_site_config_override_v1'
};

const SOCIAL_ORDER = ['instagram', 'tiktok', 'snapchat', 'x', 'whatsapp'];

export function sanitizeHttpsUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function resolveProductImagePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('idb://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  return `${PRODUCT_IMAGES_BASE_DIR}${trimmed}`;
}

export function normalizeProductRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const mainImage = resolveProductImagePath(raw.image);
  const rawGallery = Array.isArray(raw.gallery) ? raw.gallery : [];
  const gallery = rawGallery
    .map(resolveProductImagePath)
    .filter((src, idx, arr) => src !== '' && src !== mainImage && arr.indexOf(src) === idx);

  const normalizeSpecs = (specs) =>
    Array.isArray(specs)
      ? specs
          .filter((s) => s && (String(s.label || '').trim() || String(s.value || '').trim()))
          .map((s) => ({
            label: String(s.label || '').trim(),
            value: String(s.value || '').trim()
          }))
      : [];

  const normalizeFeatures = (features) =>
    Array.isArray(features)
      ? features.map((f) => String(f || '').trim()).filter(Boolean)
      : [];

  return {
    id: String(raw.id || '').trim(),
    category: String(raw.category || 'tech').trim(),
    status: raw.status === 'draft' ? 'draft' : 'published',
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 999,
    image: mainImage,
    gallery,
    price: raw.price ?? '',
    amazonUrl: sanitizeHttpsUrl(raw.amazonUrl),
    ar: {
      name: String(raw.ar?.name || '').trim(),
      benefit: String(raw.ar?.benefit || '').trim(),
      description: String(raw.ar?.description || '').trim(),
      features: normalizeFeatures(raw.ar?.features),
      specs: normalizeSpecs(raw.ar?.specs)
    },
    en: {
      name: String(raw.en?.name || raw.ar?.name || '').trim(),
      benefit: String(raw.en?.benefit || '').trim(),
      description: String(raw.en?.description || '').trim(),
      features: normalizeFeatures(raw.en?.features),
      specs: normalizeSpecs(raw.en?.specs)
    }
  };
}

export function validateProductRecord(product) {
  const errors = [];
  if (!product || typeof product !== 'object') {
    return { valid: false, errors: ['INVALID_RECORD'] };
  }
  if (!product.id) errors.push('MISSING_ID');
  if (!product.category) errors.push('MISSING_CATEGORY');
  if (!product.image) errors.push('MISSING_MAIN_IMAGE');
  if (!product.ar?.name) errors.push('MISSING_AR_NAME');
  return { valid: errors.length === 0, errors };
}

function readLocalJson(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalJson(key, value) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function mergeSiteConfig(defaults, override) {
  if (!override || typeof override !== 'object') {
    return structuredClone(defaults);
  }

  const mergedSocial = {};
  SOCIAL_ORDER.forEach((key) => {
    const defEntry = defaults.social?.[key] || { id: key, label: { ar: key, en: key }, url: '', enabled: true };
    const ovEntry = override.social?.[key];
    const ovUrl = typeof ovEntry === 'string' ? ovEntry : ovEntry?.url;
    const ovEnabled = typeof ovEntry === 'object' && ovEntry !== null && typeof ovEntry.enabled === 'boolean'
      ? ovEntry.enabled
      : defEntry.enabled !== false;

    mergedSocial[key] = {
      id: key,
      label: defEntry.label,
      url: ovEntry !== undefined ? sanitizeHttpsUrl(ovUrl || '') : sanitizeHttpsUrl(defEntry.url || ''),
      enabled: ovEnabled
    };
  });

  return {
    schemaVersion: defaults.schemaVersion || '1.0.0',
    brand: {
      ar: override.brand?.ar ?? defaults.brand.ar,
      en: override.brand?.en ?? defaults.brand.en,
      separator: override.brand?.separator ?? defaults.brand.separator,
      copyrightYear: override.brand?.copyrightYear ?? defaults.brand.copyrightYear,
      tagline: {
        ar: override.brand?.tagline?.ar ?? defaults.brand.tagline.ar,
        en: override.brand?.tagline?.en ?? defaults.brand.tagline.en
      }
    },
    seo: {
      ar: {
        title: override.seo?.ar?.title ?? defaults.seo.ar.title,
        description: override.seo?.ar?.description ?? defaults.seo.ar.description
      },
      en: {
        title: override.seo?.en?.title ?? defaults.seo.en.title,
        description: override.seo?.en?.description ?? defaults.seo.en.description
      }
    },
    affiliate: {
      marketplaceName: defaults.affiliate.marketplaceName,
      currency: defaults.affiliate.currency,
      disclosure: {
        ar: override.affiliate?.disclosure?.ar ?? defaults.affiliate.disclosure.ar,
        en: override.affiliate?.disclosure?.en ?? defaults.affiliate.disclosure.en
      },
      productLiveNotice: {
        ar: override.affiliate?.productLiveNotice?.ar ?? defaults.affiliate.productLiveNotice.ar,
        en: override.affiliate?.productLiveNotice?.en ?? defaults.affiliate.productLiveNotice.en
      },
      productPendingNotice: {
        ar: override.affiliate?.productPendingNotice?.ar ?? defaults.affiliate.productPendingNotice.ar,
        en: override.affiliate?.productPendingNotice?.en ?? defaults.affiliate.productPendingNotice.en
      }
    },
    social: mergedSocial
  };
}

function readPersistedOrSeedProducts() {
  const override = readLocalJson(STORAGE_KEYS.PRODUCTS);
  if (Array.isArray(override)) {
    return override
      .map(normalizeProductRecord)
      .filter((item) => item && item.id)
      .sort((a, b) => a.order - b.order);
  }
  return PRODUCTS.map(normalizeProductRecord)
    .filter((item) => item && item.id)
    .sort((a, b) => a.order - b.order);
}

function persistProductsList(list) {
  const normalized = list
    .map(normalizeProductRecord)
    .filter((item) => item && item.id)
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: idx + 1 }));
  if (!writeLocalJson(STORAGE_KEYS.PRODUCTS, normalized)) {
    throw new Error('LOCALSTORAGE_WRITE_FAILED');
  }
  return normalized;
}

export const MirkabStore = {
  getSiteConfig() {
    const override = readLocalJson(STORAGE_KEYS.SITE_CONFIG);
    return mergeSiteConfig(SITE_CONFIG, override);
  },

  getSocialAccounts(options = {}) {
    const { includeInactive = false } = options;
    const cfg = this.getSiteConfig();
    const socialMap = cfg.social || {};

    return SOCIAL_ORDER.reduce((acc, key) => {
      const entry = socialMap[key] || { id: key, label: { ar: key, en: key }, url: '', enabled: true };
      const validUrl = sanitizeHttpsUrl(entry.url || '');
      const isEnabled = entry.enabled !== false;

      if (includeInactive) {
        acc.push({
          id: key,
          label: entry.label || { ar: key, en: key },
          url: validUrl,
          enabled: isEnabled
        });
      } else if (isEnabled && validUrl) {
        acc.push({
          id: key,
          label: entry.label || { ar: key, en: key },
          url: validUrl,
          enabled: true
        });
      }
      return acc;
    }, []);
  },

  getCategories() {
    return PRODUCT_CATEGORIES.slice();
  },

  getProducts(options = {}) {
    const { category = 'all', includeDrafts = false } = options;
    return readPersistedOrSeedProducts().filter((item) => {
      if (!includeDrafts && item.status !== 'published') return false;
      if (category && category !== 'all' && item.category !== category) return false;
      return true;
    });
  },

  getProductById(productId, options = {}) {
    if (!productId) return null;
    const { includeDrafts = false } = options;
    const found = readPersistedOrSeedProducts().find((item) => item.id === productId);
    if (!found) return null;
    if (!includeDrafts && found.status !== 'published') return null;
    return found;
  },

  // ------------------------------------------------------------------------
  // عمليات الإدارة والحفظ المحلي (تُستدعى من لوحة التحكم فقط بعد تسجيل الدخول)
  // ------------------------------------------------------------------------
  upsertProduct(productInput, originalId = '') {
    const current = readPersistedOrSeedProducts();
    const normalized = normalizeProductRecord(productInput);
    const validation = validateProductRecord(normalized);
    if (!validation.valid) {
      const err = new Error('PRODUCT_VALIDATION_FAILED');
      err.details = validation.errors;
      throw err;
    }

    const matchId = originalId || normalized.id;
    const existingIndex = current.findIndex((p) => p.id === matchId);

    if (existingIndex >= 0) {
      if (normalized.id !== matchId && current.some((p) => p.id === normalized.id)) {
        throw new Error('DUPLICATE_PRODUCT_ID');
      }
      current[existingIndex] = normalized;
    } else {
      if (current.some((p) => p.id === normalized.id)) {
        throw new Error('DUPLICATE_PRODUCT_ID');
      }
      if (!Number.isFinite(productInput.order)) {
        normalized.order = current.length + 1;
      }
      current.push(normalized);
    }

    persistProductsList(current);
    return normalized;
  },

  deleteProduct(productId) {
    const current = readPersistedOrSeedProducts();
    const filtered = current.filter((p) => p.id !== productId);
    if (filtered.length === current.length) return false;
    persistProductsList(filtered);
    return true;
  },

  toggleProductStatus(productId) {
    const current = readPersistedOrSeedProducts();
    const idx = current.findIndex((p) => p.id === productId);
    if (idx < 0) return null;
    current[idx] = {
      ...current[idx],
      status: current[idx].status === 'published' ? 'draft' : 'published'
    };
    persistProductsList(current);
    return current[idx];
  },

  moveProductOrder(productId, direction) {
    const current = readPersistedOrSeedProducts();
    const idx = current.findIndex((p) => p.id === productId);
    if (idx < 0) return current;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return current;

    const copy = current.slice();
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    const reindexed = copy.map((item, i) => ({ ...item, order: i + 1 }));
    return persistProductsList(reindexed);
  },

  updateProductAmazonAndPrice(productId, { amazonUrl, price }) {
    const current = readPersistedOrSeedProducts();
    const idx = current.findIndex((p) => p.id === productId);
    if (idx < 0) return null;
    const trimmedUrl = typeof amazonUrl === 'string' ? amazonUrl.trim() : '';
    if (trimmedUrl && !sanitizeHttpsUrl(trimmedUrl)) {
      throw new Error('INVALID_AMAZON_URL');
    }
    current[idx] = {
      ...current[idx],
      amazonUrl: sanitizeHttpsUrl(trimmedUrl),
      price: price ?? ''
    };
    persistProductsList(current);
    return current[idx];
  },

  saveSiteConfig(nextPartialConfig) {
    const current = this.getSiteConfig();
    const merged = mergeSiteConfig(current, nextPartialConfig);
    if (!writeLocalJson(STORAGE_KEYS.SITE_CONFIG, merged)) {
      throw new Error('LOCALSTORAGE_WRITE_FAILED');
    }
    return merged;
  },

  saveSocialAccounts(socialUpdates) {
    const current = this.getSiteConfig();
    const nextSocial = {};

    SOCIAL_ORDER.forEach((key) => {
      const incoming = socialUpdates?.[key];
      const existing = current.social?.[key] || { id: key, label: { ar: key, en: key }, url: '', enabled: true };
      const rawUrl = typeof incoming === 'string' ? incoming : (incoming?.url ?? existing.url);
      const trimmed = String(rawUrl || '').trim();
      if (trimmed && !sanitizeHttpsUrl(trimmed)) {
        const err = new Error(`INVALID_SOCIAL_URL:${key}`);
        err.platform = key;
        throw err;
      }
      nextSocial[key] = {
        ...existing,
        url: sanitizeHttpsUrl(trimmed),
        enabled: typeof incoming?.enabled === 'boolean' ? incoming.enabled : existing.enabled
      };
    });

    return this.saveSiteConfig({ ...current, social: nextSocial });
  },

  restoreMissingDefaultProducts() {
    const current = readPersistedOrSeedProducts();
    const existingIds = new Set(current.map((p) => p.id));
    let added = 0;

    PRODUCTS.forEach((seed) => {
      const normalized = normalizeProductRecord(seed);
      if (normalized && !existingIds.has(normalized.id)) {
        normalized.order = current.length + 1;
        current.push(normalized);
        existingIds.add(normalized.id);
        added += 1;
      }
    });

    if (added > 0) {
      persistProductsList(current);
    }
    return { added, total: current.length };
  },

  resetSiteConfigToDefault() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SITE_CONFIG);
    }
    return this.getSiteConfig();
  },

  exportCatalogSnapshot(mediaAssets = []) {
    return {
      schemaVersion: SITE_CONFIG.schemaVersion || '1.0.0',
      exportedAt: new Date().toISOString(),
      siteConfig: this.getSiteConfig(),
      categories: this.getCategories(),
      products: this.getProducts({ includeDrafts: true }),
      mediaAssets: Array.isArray(mediaAssets) ? mediaAssets : []
    };
  },

  importCatalogSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.products)) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    const validProducts = snapshot.products
      .map(normalizeProductRecord)
      .filter((item) => validateProductRecord(item).valid);

    if (!validProducts.length) {
      throw new Error('BACKUP_HAS_NO_VALID_PRODUCTS');
    }

    persistProductsList(validProducts);

    if (snapshot.siteConfig && typeof snapshot.siteConfig === 'object') {
      const mergedCfg = mergeSiteConfig(SITE_CONFIG, snapshot.siteConfig);
      writeLocalJson(STORAGE_KEYS.SITE_CONFIG, mergedCfg);
    }

    return {
      productsCount: validProducts.length
    };
  }
};
