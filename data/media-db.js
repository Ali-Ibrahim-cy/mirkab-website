/**
 * مِركاب | MIRKAB — مدير صور المنتجات عبر Supabase Storage
 * --------------------------------------------------------------------------
 * يرفع الصور إلى Storage bucket `product-images` (للمالك فقط عبر سياسات RLS)،
 * ويوفر الروابط العامة للزوار دون أي تخزين محلي (بدون IndexedDB).
 */

import {
  supabase,
  SUPABASE_URL,
  PRODUCT_IMAGES_BUCKET
} from './supabase-client.js';

const MAX_RAW_FILE_BYTES = 12 * 1024 * 1024; // 12 MB
const OPTIMIZE_THRESHOLD_BYTES = 900 * 1024; // ضغط ذكي للصور الكبيرة
const MAX_DIMENSION_PX = 1600;

function optimizeImageBlob(file) {
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
        resolve({ blob: file, mimeType: file.type, width: origW, height: origH, size: file.size });
        return;
      }

      const scale = needsResize ? Math.min(MAX_DIMENSION_PX / origW, MAX_DIMENSION_PX / origH) : 1;
      const targetW = Math.max(1, Math.round(origW * scale));
      const targetH = Math.max(1, Math.round(origH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ blob: file, mimeType: file.type, width: origW, height: origH, size: file.size });
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
      canvas.toBlob(
        (outBlob) => {
          if (!outBlob || (outBlob.size >= file.size && !needsResize)) {
            resolve({ blob: file, mimeType: file.type, width: origW, height: origH, size: file.size });
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

function sanitizeFileBaseName(name) {
  return String(name || 'image')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'image';
}

function extFromMime(mimeType) {
  switch (mimeType) {
    case 'image/webp':
      return 'webp';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    default:
      return 'jpg';
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('READER_FAILED'));
    reader.readAsDataURL(blob);
  });
}

export function extractStoragePathFromUrl(publicUrl) {
  if (typeof publicUrl !== 'string') return '';
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return '';
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
}

export function getPublicStorageUrl(storagePath) {
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;
}

export const MirkabMediaDB = {
  async saveImageFile(file, meta = {}) {
    const processed = await optimizeImageBlob(file);
    const folder = sanitizeFileBaseName(meta.productId || 'general');
    const baseName = sanitizeFileBaseName(file.name);
    const ext = extFromMime(processed.mimeType);
    const storagePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${baseName}.${ext}`;

    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(storagePath, processed.blob, {
        contentType: processed.mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);
    }

    const publicUrl = getPublicStorageUrl(storagePath);
    return {
      path: storagePath,
      ref: publicUrl,
      publicUrl,
      name: file.name || `${baseName}.${ext}`,
      mimeType: processed.mimeType,
      size: processed.size,
      width: processed.width,
      height: processed.height
    };
  },

  async uploadSeedBlob(blob, storagePath, mimeType = 'image/jpeg') {
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(storagePath, blob, {
        contentType: mimeType,
        cacheControl: '86400',
        upsert: true
      });

    if (error) {
      throw new Error(`SEED_UPLOAD_FAILED: ${error.message}`);
    }

    return getPublicStorageUrl(storagePath);
  },

  async uploadDataUrl(dataUrl, storagePath) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error('INVALID_IMAGE_DATA_URL');
    }
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(storagePath, blob, {
        contentType: blob.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });
    if (error) {
      throw new Error(`BACKUP_MEDIA_UPLOAD_FAILED: ${error.message}`);
    }
    return getPublicStorageUrl(storagePath);
  },

  async listImages() {
    const collected = [];

    async function walkFolder(prefix) {
      const { data, error } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .list(prefix, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

      if (error || !Array.isArray(data)) return;

      for (const entry of data) {
        if (!entry || !entry.name || entry.name === '.emptyFolderPlaceholder') continue;
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        // في Supabase Storage العناصر التي لا تملك id أو metadata تكون مجلدات
        if (!entry.id && !entry.metadata) {
          await walkFolder(fullPath);
        } else {
          collected.push({
            id: entry.id || fullPath,
            path: fullPath,
            name: entry.name,
            ref: getPublicStorageUrl(fullPath),
            size: Number(entry.metadata?.size) || 0,
            mimeType: entry.metadata?.mimetype || 'image/jpeg',
            createdAt: entry.created_at || entry.updated_at || ''
          });
        }
      }
    }

    await walkFolder('');
    return collected.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  async deleteImage(urlOrPath) {
    const path = urlOrPath.startsWith('http')
      ? extractStoragePathFromUrl(urlOrPath)
      : String(urlOrPath || '').trim();
    if (!path) return;

    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([path]);

    if (error) {
      throw new Error(`STORAGE_DELETE_FAILED: ${error.message}`);
    }
  },

  async getStorageStats() {
    const items = await this.listImages();
    const totalBytes = items.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    return {
      count: items.length,
      totalBytes
    };
  },

  async exportAllImagesAsBackupMap() {
    const items = await this.listImages();
    const result = [];
    for (const item of items) {
      try {
        const res = await fetch(item.ref);
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        result.push({
          path: item.path,
          ref: item.ref,
          name: item.name,
          mimeType: item.mimeType,
          size: item.size,
          createdAt: item.createdAt,
          dataUrl
        });
      } catch {
        // تخطي ملف غير قابل للقراءة دون إيقاف التصدير
      }
    }
    return result;
  }
};
