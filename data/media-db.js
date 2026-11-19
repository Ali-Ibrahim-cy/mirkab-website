/**
 * مِركاب | MIRKAB — مدير الصور المحلي (IndexedDB)
 * --------------------------------------------------------------------------
 * يحفظ صور المنتجات المرفوعة من جهاز المالك محلياً في IndexedDB
 * مع مراعاة أحجام الملفات، ومعاينة فورية، وتحسين الصور الكبيرة تلقائياً،
 * واسترجاعها بسلاسة في كل من لوحة الإدارة والموقع العام عبر معرفات idb://.
 */

const DB_NAME = 'mirkab_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const IDB_PREFIX = 'idb://';
const MAX_RAW_FILE_BYTES = 12 * 1024 * 1024; // 12 MB حد أقصى للملف الخام قبل المعالجة
const OPTIMIZE_THRESHOLD_BYTES = 900 * 1024; // ضغط تلقائي ذكي للصور الأكبر من 900 KB
const MAX_DIMENSION_PX = 1600;

const objectUrlCache = new Map();
let dbPromise = null;

export function isIndexedDbRef(src) {
  return typeof src === 'string' && src.startsWith(IDB_PREFIX);
}

export function extractIdbKey(ref) {
  return isIndexedDbRef(ref) ? ref.slice(IDB_PREFIX.length) : String(ref || '').trim();
}

export function toIdbRef(id) {
  return `${IDB_PREFIX}${id}`;
}

function openMediaDatabase() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('INDEXEDDB_UNSUPPORTED'));
  }

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('productId', 'productId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('INDEXEDDB_OPEN_FAILED'));
    };
  });

  return dbPromise;
}

function generateImageId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `img_${Date.now()}_${rand}`;
}

function loadImageDimensionsAndMaybeOptimize(file) {
  return new Promise((resolve, reject) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (!file || !file.type || !allowedTypes.includes(file.type)) {
      reject(new Error('UNSUPPORTED_IMAGE_TYPE'));
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      reject(new Error('FILE_TOO_LARGE'));
      return;
    }

    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const origW = img.naturalWidth || 0;
      const origH = img.naturalHeight || 0;
      URL.revokeObjectURL(tempUrl);

      const needsResize = origW > MAX_DIMENSION_PX || origH > MAX_DIMENSION_PX;
      const needsCompress = file.size > OPTIMIZE_THRESHOLD_BYTES && file.type !== 'image/gif';

      if (!needsResize && !needsCompress) {
        resolve({
          blob: file,
          mimeType: file.type,
          width: origW,
          height: origH,
          size: file.size
        });
        return;
      }

      const scale = needsResize
        ? Math.min(MAX_DIMENSION_PX / origW, MAX_DIMENSION_PX / origH)
        : 1;
      const targetW = Math.max(1, Math.round(origW * scale));
      const targetH = Math.max(1, Math.round(origH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          blob: file,
          mimeType: file.type,
          width: origW,
          height: origH,
          size: file.size
        });
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
      canvas.toBlob(
        (outBlob) => {
          if (!outBlob) {
            resolve({
              blob: file,
              mimeType: file.type,
              width: origW,
              height: origH,
              size: file.size
            });
            return;
          }
          // استخدم الملف الأصلي إذا كان أصغر حجماً بعد التحويل
          if (outBlob.size >= file.size && !needsResize) {
            resolve({
              blob: file,
              mimeType: file.type,
              width: origW,
              height: origH,
              size: file.size
            });
          } else {
            resolve({
              blob: outBlob,
              mimeType: outBlob.type || outMime,
              width: targetW,
              height: targetH,
              size: outBlob.size
            });
          }
        },
        outMime,
        0.86
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('IMAGE_DECODE_FAILED'));
    };

    img.src = tempUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('READER_FAILED'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export const MirkabMediaDB = {
  isSupported() {
    return typeof indexedDB !== 'undefined';
  },

  async saveImageFile(file, meta = {}) {
    const processed = await loadImageDimensionsAndMaybeOptimize(file);
    const db = await openMediaDatabase();
    const id = meta.id || generateImageId();
    const record = {
      id,
      productId: meta.productId || '',
      role: meta.role === 'gallery' ? 'gallery' : 'main',
      name: file.name || `${id}.jpg`,
      mimeType: processed.mimeType,
      size: processed.size,
      width: processed.width,
      height: processed.height,
      blob: processed.blob,
      createdAt: new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('SAVE_FAILED'));
    });

    if (objectUrlCache.has(id)) {
      URL.revokeObjectURL(objectUrlCache.get(id));
      objectUrlCache.delete(id);
    }

    return {
      ...record,
      ref: toIdbRef(id)
    };
  },

  async saveDataUrl(dataUrl, meta = {}) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error('INVALID_IMAGE_DATA_URL');
    }
    const blob = await dataUrlToBlob(dataUrl);
    const db = await openMediaDatabase();
    const id = extractIdbKey(meta.id) || generateImageId();

    const record = {
      id,
      productId: meta.productId || '',
      role: meta.role === 'gallery' ? 'gallery' : 'main',
      name: meta.name || `${id}.jpg`,
      mimeType: blob.type || meta.mimeType || 'image/jpeg',
      size: blob.size,
      width: Number(meta.width) || 0,
      height: Number(meta.height) || 0,
      blob,
      createdAt: meta.createdAt || new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('RESTORE_IMAGE_FAILED'));
    });

    if (objectUrlCache.has(id)) {
      URL.revokeObjectURL(objectUrlCache.get(id));
      objectUrlCache.delete(id);
    }

    return { ...record, ref: toIdbRef(id) };
  },

  async getImageRecord(refOrId) {
    const id = extractIdbKey(refOrId);
    if (!id) return null;
    try {
      const db = await openMediaDatabase();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async resolveImageUrl(srcRef) {
    if (!isIndexedDbRef(srcRef)) return srcRef || '';
    const id = extractIdbKey(srcRef);
    if (!id) return '';

    if (objectUrlCache.has(id)) {
      return objectUrlCache.get(id);
    }

    const record = await this.getImageRecord(id);
    if (!record || !record.blob) return '';

    const objUrl = URL.createObjectURL(record.blob);
    objectUrlCache.set(id, objUrl);
    return objUrl;
  },

  async listImages() {
    try {
      const db = await openMediaDatabase();
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      });
      return rows
        .map((row) => ({
          ...row,
          ref: toIdbRef(row.id)
        }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    } catch {
      return [];
    }
  },

  async updateImageMetadata(refOrId, patch = {}) {
    const record = await this.getImageRecord(refOrId);
    if (!record) return null;
    const db = await openMediaDatabase();
    const updated = {
      ...record,
      productId: patch.productId !== undefined ? patch.productId : record.productId,
      role: patch.role !== undefined ? patch.role : record.role
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { ...updated, ref: toIdbRef(updated.id) };
  },

  async deleteImage(refOrId) {
    const id = extractIdbKey(refOrId);
    if (!id) return;
    const db = await openMediaDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (objectUrlCache.has(id)) {
      URL.revokeObjectURL(objectUrlCache.get(id));
      objectUrlCache.delete(id);
    }
  },

  async getStorageStats() {
    const items = await this.listImages();
    const totalBytes = items.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    let quotaBytes = 0;
    let browserUsageBytes = 0;
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      try {
        const est = await navigator.storage.estimate();
        quotaBytes = Number(est.quota) || 0;
        browserUsageBytes = Number(est.usage) || 0;
      } catch {
        // تجاهل في المتصفحات غير الداعمة
      }
    }
    return {
      count: items.length,
      totalBytes,
      quotaBytes,
      browserUsageBytes
    };
  },

  async exportAllImagesAsBackupMap() {
    const items = await this.listImages();
    const result = [];
    for (const item of items) {
      if (!item.blob) continue;
      const dataUrl = await blobToDataUrl(item.blob);
      result.push({
        id: item.id,
        ref: toIdbRef(item.id),
        productId: item.productId || '',
        role: item.role || 'main',
        name: item.name || '',
        mimeType: item.mimeType || 'image/jpeg',
        width: item.width || 0,
        height: item.height || 0,
        createdAt: item.createdAt || '',
        dataUrl
      });
    }
    return result;
  }
};
