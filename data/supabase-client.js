/**
 * مِركاب | MIRKAB — الإعداد المركزي لـ Supabase
 * --------------------------------------------------------------------------
 * يحتوي فقط على رابط المشروع والمفتاح العام القابل للنشر (Publishable Key)
 * ومعرّف حساب المالك واسم حاوية التخزين.
 * لا يحتوي على أي Service Role Key أو أسرار خاصة.
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://dyfwxwzdixhvbgdulzcr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qPL37BeIe5JMvM2G6a0bXg_56XpJ3iB';
export const SUPABASE_OWNER_UID = 'efec3494-679b-4d7f-b3cf-c58ed64c6c74';
export const PRODUCT_IMAGES_BUCKET = 'product-images';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
