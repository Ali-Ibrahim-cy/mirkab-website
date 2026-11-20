/**
 * مِركاب | MIRKAB — طبقة إدارة البيانات المرتبطة بـ Supabase
 * --------------------------------------------------------------------------
 * تدير القراءة والحفظ بالكامل عبر جداول Supabase:
 *   - public.products (id, category, status, sort_order, data, updated_at)
 *   - public.site_settings (id, data, updated_at)
 *   - Storage bucket: product-images (عبر MirkabMediaDB)
 *
 * بدون أي اعتماد على localStorage أو IndexedDB لحفظ البيانات الأساسية.
 */

import { supabase } from './supabase-client.js';
import { SITE_CONFIG } from './site-config.js';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_IMAGES_BASE_DIR,
  PRODUCTS
} from './products.js';
import { MirkabMediaDB, getPublicStorageUrl } from './media-db.js';

const SETTINGS_ROW_ID = 'main';
const SOCIAL_ORDER = ['instagram', 'tiktok', 'snapchat', 'x', 'whatsapp'];

const memoryState = {
  siteConfig: structuredClone(SITE_CONFIG),
  products: [],
  loadedFromSupabase: false
};

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
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  return `${PRODUCT_IMAGES_BUCKET_OR_DIR(trimmed)}`;
}

function PRODUCT_IMAGES_BUCKET_OR_DIR(fileName) {
  return `${PRODUCT_IMAGES_BASE_DIR}${fileName}`;
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

function mergeSiteConfig(defaults, override) {
  if (!override || typeof override !== 'object') {
    return structuredClone(defaults);
  }

  const mergedSocial = {};
  SOCIAL_ORDER.forEach((key) => {
    const defEntry = defaults.social?.[key] || { id: key, label: { ar: key, en: key }, url: '', enabled: true };
    const ovEntry = override.social?.[key];
    const ovUrl = typeof ovEntry === 'string' ? ovEntry : ovEntry?.url;
    const ovEnabled =
      typeof ovEntry === 'object' && ovEntry !== null && typeof ovEntry.enabled === 'boolean'
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

function rowToProduct(row) {
  if (!row || typeof row !== 'object') return null;
  const payload = row.data && typeof row.data === 'object' ? row.data : {};
  return normalizeProductRecord({
    ...payload,
    id: row.id || payload.id,
    category: row.category || payload.category,
    status: row.status || payload.status,
    order: typeof row.sort_order === 'number' ? row.sort_order : payload.order
  });
}

function productToDbRow(product) {
  const normalized = normalizeProductRecord(product);
  return {
    id: normalized.id,
    category: normalized.category,
    status: normalized.status,
    sort_order: normalized.order,
    data: normalized,
    updated_at: new Date().toISOString()
  };
}

function extractFileNameFromPath(pathStr) {
  const clean = String(pathStr || '').split('?')[0];
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

export const MirkabStore = {
  /**
   * جلب البيانات العامة للزوار من Supabase قبل عرض المنتجات.
   */
  async loadPublicData() {
    const [settingsRes, publishedRes] = await Promise.all([
      supabase
        .from('site_settings')
        .select('id, data')
        .eq('id', SETTINGS_ROW_ID)
        .maybeSingle(),
      supabase
        .from('products')
        .select('id, category, status, sort_order, data')
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
    ]);

    if (settingsRes.error) {
      throw new Error(`LOAD_SETTINGS_FAILED: ${settingsRes.error.message}`);
    }
    if (publishedRes.error) {
      throw new Error(`LOAD_PRODUCTS_FAILED: ${publishedRes.error.message}`);
    }

    const hasSettingsRow = Boolean(settingsRes.data && settingsRes.data.data);
    const publishedRows = Array.isArray(publishedRes.data) ? publishedRes.data : [];

    // إذا كانت قاعدة البيانات مهيأة أو تحتوي على بيانات نعتمدها بالكامل
    if (hasSettingsRow || publishedRows.length > 0) {
      memoryState.siteConfig = mergeSiteConfig(SITE_CONFIG, settingsRes.data?.data);
      memoryState.products = publishedRows
        .map(rowToProduct)
        .filter((item) => item && item.id)
        .sort((a, b) => a.order - b.order);
      memoryState.loadedFromSupabase = true;
      return { source: 'supabase', count: memoryState.products.length };
    }

    // التحقق من وجود مسودات في قاعدة البيانات قبل أي تراجع لقائمة البدء الأولية
    const countRes = await supabase.from('products').select('id', { count: 'exact', head: true });
    if (!countRes.error && (countRes.count || 0) > 0) {
      memoryState.siteConfig = structuredClone(SITE_CONFIG);
      memoryState.products = [];
      memoryState.loadedFromSupabase = true;
      return { source: 'supabase', count: 0 };
    }

    // قاعدة بيانات بكر لم تُهيأ من لوحة المالك بعد: عرض الكتالوج الأولي المضمّن للقراءة فقط
    memoryState.siteConfig = structuredClone(SITE_CONFIG);
    memoryState.products = PRODUCTS.map(normalizeProductRecord)
      .filter((item) => item && item.id && item.status === 'published')
      .sort((a, b) => a.order - b.order);
    memoryState.loadedFromSupabase = false;
    return { source: 'seed-readonly', count: memoryState.products.length };
  },

  /**
   * جلب جميع البيانات للمالك في لوحة التحكم، مع تهيئة تلقائية آمنة عند التشغيل الأول.
   */
  async loadAdminData() {
    const [settingsRes, allProductsRes] = await Promise.all([
      supabase
        .from('site_settings')
        .select('id, data')
        .eq('id', SETTINGS_ROW_ID)
        .maybeSingle(),
      supabase
        .from('products')
        .select('id, category, status, sort_order, data')
        .order('sort_order', { ascending: true })
    ]);

    if (settingsRes.error) {
      throw new Error(`ADMIN_LOAD_SETTINGS_FAILED: ${settingsRes.error.message}`);
    }
    if (allProductsRes.error) {
      throw new Error(`ADMIN_LOAD_PRODUCTS_FAILED: ${allProductsRes.error.message}`);
    }

    const dbProducts = Array.isArray(allProductsRes.data) ? allProductsRes.data : [];
    const hasSettings = Boolean(settingsRes.data && settingsRes.data.data);

    if (dbProducts.length === 0 || !hasSettings) {
      await this.migrateDefaultsToSupabase();
      const [refreshedSettings, refreshedProducts] = await Promise.all([
        supabase.from('site_settings').select('id, data').eq('id', SETTINGS_ROW_ID).maybeSingle(),
        supabase.from('products').select('id, category, status, sort_order, data').order('sort_order', { ascending: true })
      ]);
      memoryState.siteConfig = mergeSiteConfig(SITE_CONFIG, refreshedSettings.data?.data);
      memoryState.products = (refreshedProducts.data || [])
        .map(rowToProduct)
        .filter((item) => item && item.id)
        .sort((a, b) => a.order - b.order);
      memoryState.loadedFromSupabase = true;
      return { seeded: true, count: memoryState.products.length };
    }

    memoryState.siteConfig = mergeSiteConfig(SITE_CONFIG, settingsRes.data?.data);
    memoryState.products = dbProducts
      .map(rowToProduct)
      .filter((item) => item && item.id)
      .sort((a, b) => a.order - b.order);
    memoryState.loadedFromSupabase = true;
    return { seeded: false, count: memoryState.products.length };
  },

  /**
   * تهيئة قابلة لإعادة التشغيل بأمان:
   * - ترفع الصور الـ 11 إلى Storage bucket `product-images`
   * - تنقل المنتجات المفقودة فقط إلى `public.products` دون تكرار أو مسح للتعديلات
   * - تُنشئ صف الإعدادات `main` في `public.site_settings` إذا لم يكن موجوداً
   */
  async migrateDefaultsToSupabase() {
    const [existingProductsRes, existingSettingsRes] = await Promise.all([
      supabase.from('products').select('id, category, status, sort_order, data'),
      supabase.from('site_settings').select('id, data').eq('id', SETTINGS_ROW_ID).maybeSingle()
    ]);

    if (existingProductsRes.error) {
      throw new Error(`MIGRATION_CHECK_FAILED: ${existingProductsRes.error.message}`);
    }

    const existingRows = Array.isArray(existingProductsRes.data) ? existingProductsRes.data : [];
    const existingMap = new Map(existingRows.map((r) => [r.id, r]));

    // 1. تهيئة الإعدادات إذا لم تكن موجودة
    if (!existingSettingsRes.data) {
      const { error: setErr } = await supabase.from('site_settings').upsert(
        {
          id: SETTINGS_ROW_ID,
          data: structuredClone(SITE_CONFIG),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
      if (setErr) {
        throw new Error(`MIGRATION_SETTINGS_FAILED: ${setErr.message}`);
      }
    }

    // 2. التحقق من ملفات الصور الموجودة مسبقاً في product-images/defaults
    const existingDefaultsRes = await supabase.storage
      .from('product-images')
      .list('defaults', { limit: 100 });
    const existingDefaultFiles = new Set(
      (existingDefaultsRes.data || []).map((f) => f.name)
    );

    let addedProducts = 0;
    let uploadedImages = 0;

    for (const seed of PRODUCTS) {
      const normalizedSeed = normalizeProductRecord(seed);
      const fileName = extractFileNameFromPath(normalizedSeed.image);
      const storagePath = `defaults/${fileName}`;
      let publicImageUrl = getPublicStorageUrl(storagePath);

      if (!existingDefaultFiles.has(fileName) && typeof document !== 'undefined' && typeof fetch === 'function') {
        try {
          const baseHref =
            document.baseURI.endsWith('/') || document.baseURI.endsWith('.html')
              ? document.baseURI
              : `${document.baseURI}/`;
          const assetUrl = new URL(`../assets/images/products/${fileName}`, baseHref).href;
          const res = await fetch(assetUrl);
          if (res.ok) {
            const blob = await res.blob();
            publicImageUrl = await MirkabMediaDB.uploadSeedBlob(
              blob,
              storagePath,
              blob.type || 'image/jpeg'
            );
            existingDefaultFiles.add(fileName);
            uploadedImages += 1;
          }
        } catch {
          // الإبقاء على الرابط العام المتوقع أو المحلي إذا تعذر الجلب في بيئة اختبار نصية
        }
      }

      const existingRow = existingMap.get(normalizedSeed.id);
      if (!existingRow) {
        const record = {
          ...normalizedSeed,
          image: publicImageUrl
        };
        const { error: insErr } = await supabase
          .from('products')
          .upsert(productToDbRow(record), { onConflict: 'id' });
        if (insErr) {
          throw new Error(`MIGRATION_PRODUCT_INSERT_FAILED: ${insErr.message}`);
        }
        addedProducts += 1;
      } else {
        // إذا كان المنتج موجوداً وما زال يشير لمسار محلي قديم ./assets/ نحدّث رابط صورته إلى Storage العام دون تغيير باقي بياناته
        const currentProduct = rowToProduct(existingRow);
        if (currentProduct && currentProduct.image.startsWith('./assets/')) {
          const updatedRecord = { ...currentProduct, image: publicImageUrl };
          await supabase
            .from('products')
            .update(productToDbRow(updatedRecord))
            .eq('id', currentProduct.id);
        }
      }
    }

    await this.loadAdminDataIfReady();
    return {
      added: addedProducts,
      uploadedImages,
      total: PRODUCTS.length
    };
  },

  async loadAdminDataIfReady() {
    const [settingsRes, allProductsRes] = await Promise.all([
      supabase.from('site_settings').select('id, data').eq('id', SETTINGS_ROW_ID).maybeSingle(),
      supabase.from('products').select('id, category, status, sort_order, data').order('sort_order', { ascending: true })
    ]);
    if (!settingsRes.error && settingsRes.data?.data) {
      memoryState.siteConfig = mergeSiteConfig(SITE_CONFIG, settingsRes.data.data);
    }
    if (!allProductsRes.error && Array.isArray(allProductsRes.data)) {
      memoryState.products = allProductsRes.data
        .map(rowToProduct)
        .filter((item) => item && item.id)
        .sort((a, b) => a.order - b.order);
      memoryState.loadedFromSupabase = true;
    }
  },

  // ------------------------------------------------------------------------
  // قراءات الذاكرة الحالية بعد المزامنة مع Supabase
  // ------------------------------------------------------------------------
  getSiteConfig() {
    return memoryState.siteConfig;
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
    return memoryState.products
      .filter((item) => {
        if (!includeDrafts && item.status !== 'published') return false;
        if (category && category !== 'all' && item.category !== category) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  },

  getProductById(productId, options = {}) {
    if (!productId) return null;
    const { includeDrafts = false } = options;
    const found = memoryState.products.find((item) => item.id === productId);
    if (!found) return null;
    if (!includeDrafts && found.status !== 'published') return null;
    return found;
  },

  // ------------------------------------------------------------------------
  // عمليات الإدارة عبر Supabase (محمية بصلاحية المالك عبر RLS)
  // ------------------------------------------------------------------------
  async upsertProduct(productInput, originalId = '') {
    const normalized = normalizeProductRecord(productInput);
    const validation = validateProductRecord(normalized);
    if (!validation.valid) {
      const err = new Error('PRODUCT_VALIDATION_FAILED');
      err.details = validation.errors;
      throw err;
    }

    const existingList = memoryState.products.slice();
    const matchId = originalId || normalized.id;
    const existingIndex = existingList.findIndex((p) => p.id === matchId);

    if (existingIndex < 0) {
      if (existingList.some((p) => p.id === normalized.id)) {
        throw new Error('DUPLICATE_PRODUCT_ID');
      }
      if (!Number.isFinite(productInput.order)) {
        normalized.order = existingList.length + 1;
      }
    } else if (normalized.id !== matchId) {
      if (existingList.some((p) => p.id === normalized.id)) {
        throw new Error('DUPLICATE_PRODUCT_ID');
      }
      const { error: delOldErr } = await supabase.from('products').delete().eq('id', matchId);
      if (delOldErr) {
        throw new Error(`PRODUCT_RENAME_DELETE_FAILED: ${delOldErr.message}`);
      }
    }

    const dbRow = productToDbRow(normalized);
    const { error } = await supabase.from('products').upsert(dbRow, { onConflict: 'id' });
    if (error) {
      throw new Error(`PRODUCT_SAVE_FAILED: ${error.message}`);
    }

    if (existingIndex >= 0) {
      existingList[existingIndex] = normalized;
    } else {
      existingList.push(normalized);
    }

    memoryState.products = existingList.sort((a, b) => a.order - b.order);
    return normalized;
  },

  async deleteProduct(productId) {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      throw new Error(`PRODUCT_DELETE_FAILED: ${error.message}`);
    }
    memoryState.products = memoryState.products
      .filter((p) => p.id !== productId)
      .map((p, idx) => ({ ...p, order: idx + 1 }));
    return true;
  },

  async toggleProductStatus(productId) {
    const target = memoryState.products.find((p) => p.id === productId);
    if (!target) return null;
    const nextStatus = target.status === 'published' ? 'draft' : 'published';
    const updated = { ...target, status: nextStatus };

    const { error } = await supabase
      .from('products')
      .update(productToDbRow(updated))
      .eq('id', productId);

    if (error) {
      throw new Error(`TOGGLE_STATUS_FAILED: ${error.message}`);
    }

    memoryState.products = memoryState.products.map((p) => (p.id === productId ? updated : p));
    return updated;
  },

  async moveProductOrder(productId, direction) {
    const current = memoryState.products.slice().sort((a, b) => a.order - b.order);
    const idx = current.findIndex((p) => p.id === productId);
    if (idx < 0) return current;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return current;

    const copy = current.slice();
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    const reindexed = copy.map((item, i) => ({ ...item, order: i + 1 }));

    const rows = reindexed.map(productToDbRow);
    const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw new Error(`REORDER_FAILED: ${error.message}`);
    }

    memoryState.products = reindexed;
    return reindexed;
  },

  async updateProductAmazonAndPrice(productId, { amazonUrl, price }) {
    const target = memoryState.products.find((p) => p.id === productId);
    if (!target) return null;

    const trimmedUrl = typeof amazonUrl === 'string' ? amazonUrl.trim() : '';
    if (trimmedUrl && !sanitizeHttpsUrl(trimmedUrl)) {
      throw new Error('INVALID_AMAZON_URL');
    }

    const updated = {
      ...target,
      amazonUrl: sanitizeHttpsUrl(trimmedUrl),
      price: price ?? ''
    };

    const { error } = await supabase
      .from('products')
      .update(productToDbRow(updated))
      .eq('id', productId);

    if (error) {
      throw new Error(`UPDATE_AMAZON_FAILED: ${error.message}`);
    }

    memoryState.products = memoryState.products.map((p) => (p.id === productId ? updated : p));
    return updated;
  },

  async saveSiteConfig(nextPartialConfig) {
    const merged = mergeSiteConfig(memoryState.siteConfig, nextPartialConfig);
    const { error } = await supabase.from('site_settings').upsert(
      {
        id: SETTINGS_ROW_ID,
        data: merged,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`SAVE_SITE_CONFIG_FAILED: ${error.message}`);
    }

    memoryState.siteConfig = merged;
    return merged;
  },

  async saveSocialAccounts(socialUpdates) {
    const current = this.getSiteConfig();
    const nextSocial = {};

    SOCIAL_ORDER.forEach((key) => {
      const incoming = socialUpdates?.[key];
      const existing = current.social?.[key] || { id: key, label: { ar: key, en: key }, url: '', enabled: true };
      const rawUrl = typeof incoming === 'string' ? incoming : incoming?.url ?? existing.url;
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

  async restoreMissingDefaultProducts() {
    return this.migrateDefaultsToSupabase();
  },

  async resetSiteConfigToDefault() {
    const defaults = structuredClone(SITE_CONFIG);
    const { error } = await supabase.from('site_settings').upsert(
      {
        id: SETTINGS_ROW_ID,
        data: defaults,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`RESET_CONFIG_FAILED: ${error.message}`);
    }

    memoryState.siteConfig = defaults;
    return defaults;
  },

  exportCatalogSnapshot(mediaAssets = []) {
    return {
      schemaVersion: SITE_CONFIG.schemaVersion || '1.0.0',
      exportedAt: new Date().toISOString(),
      source: 'supabase',
      siteConfig: this.getSiteConfig(),
      categories: this.getCategories(),
      products: this.getProducts({ includeDrafts: true }),
      mediaAssets: Array.isArray(mediaAssets) ? mediaAssets : []
    };
  },

  async importCatalogSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.products)) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    // 1. استعادة الصور المرفوعة في Storage إن وجدت داخل النسخة الاحتياطية وتحديث مساراتها
    const refRemap = new Map();
    if (Array.isArray(snapshot.mediaAssets)) {
      for (const asset of snapshot.mediaAssets) {
        if (!asset || !asset.dataUrl) continue;
        const targetPath =
          asset.path ||
          `restored/${Date.now()}_${extractFileNameFromPath(asset.name || 'image.jpg')}`;
        const newPublicUrl = await MirkabMediaDB.uploadDataUrl(asset.dataUrl, targetPath);
        if (asset.ref) refRemap.set(asset.ref, newPublicUrl);
      }
    }

    const remapRef = (src) => (refRemap.has(src) ? refRemap.get(src) : src);

    const validProducts = snapshot.products
      .map((p) => {
        const remappedGallery = Array.isArray(p.gallery) ? p.gallery.map(remapRef) : [];
        return normalizeProductRecord({
          ...p,
          image: remapRef(p.image),
          gallery: remappedGallery
        });
      })
      .filter((item) => validateProductRecord(item).valid)
      .map((item, idx) => ({ ...item, order: Number.isFinite(item.order) ? item.order : idx + 1 }));

    if (!validProducts.length) {
      throw new Error('BACKUP_HAS_NO_VALID_PRODUCTS');
    }

    const rows = validProducts.map(productToDbRow);
    const { error: prodErr } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
    if (prodErr) {
      throw new Error(`IMPORT_PRODUCTS_FAILED: ${prodErr.message}`);
    }

    if (snapshot.siteConfig && typeof snapshot.siteConfig === 'object') {
      const mergedCfg = mergeSiteConfig(SITE_CONFIG, snapshot.siteConfig);
      const { error: cfgErr } = await supabase.from('site_settings').upsert(
        {
          id: SETTINGS_ROW_ID,
          data: mergedCfg,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
      if (cfgErr) {
        throw new Error(`IMPORT_SETTINGS_FAILED: ${cfgErr.message}`);
      }
      memoryState.siteConfig = mergedCfg;
    }

    memoryState.products = validProducts.sort((a, b) => a.order - b.order);
    memoryState.loadedFromSupabase = true;
    return { productsCount: validProducts.length };
  }
};
