/**
 * مِركاب | MIRKAB — مصادقة لوحة التحكم عبر Supabase Auth (حساب المالك فقط)
 * --------------------------------------------------------------------------
 * - تستخدم مصادقة Supabase Auth بالبريد الإلكتروني وكلمة المرور.
 * - لا يُسمح بإنشاء حسابات جديدة من لوحة الإدارة.
 * - يُسمح بالدخول فقط لحساب المالك المعرّف بـ SUPABASE_OWNER_UID.
 */

import { supabase, SUPABASE_OWNER_UID } from '../data/supabase-client.js';

let currentSession = null;

function isOwnerUser(user) {
  return Boolean(user && user.id === SUPABASE_OWNER_UID);
}

export const AdminAuth = {
  async restoreSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      currentSession = null;
      return null;
    }

    if (!isOwnerUser(data.session.user)) {
      await supabase.auth.signOut();
      currentSession = null;
      return null;
    }

    currentSession = data.session;
    return currentSession;
  },

  isAuthenticated() {
    return Boolean(currentSession && isOwnerUser(currentSession.user));
  },

  getCurrentUser() {
    return this.isAuthenticated() ? currentSession.user : null;
  },

  async signInWithEmail(email, password) {
    const cleanEmail = String(email || '').trim();
    const cleanPass = String(password || '');

    if (!cleanEmail || !cleanPass) {
      throw new Error('MISSING_CREDENTIALS');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass
    });

    if (error) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!isOwnerUser(data.user)) {
      await supabase.auth.signOut();
      currentSession = null;
      throw new Error('UNAUTHORIZED_NOT_OWNER');
    }

    currentSession = data.session;
    return data.session;
  },

  async updateOwnerPassword(newPassword, confirmPassword) {
    if (!this.isAuthenticated()) {
      throw new Error('NOT_AUTHENTICATED');
    }
    const cleanNew = String(newPassword || '');
    if (cleanNew.length < 6) {
      throw new Error('PASSWORD_TOO_SHORT');
    }
    if (cleanNew !== String(confirmPassword || '')) {
      throw new Error('PASSWORD_MISMATCH');
    }

    const { error } = await supabase.auth.updateUser({ password: cleanNew });
    if (error) {
      throw new Error(error.message || 'PASSWORD_UPDATE_FAILED');
    }
    return true;
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && !isOwnerUser(session.user)) {
        await supabase.auth.signOut();
        currentSession = null;
      } else {
        currentSession = session || null;
      }
      if (typeof callback === 'function') {
        callback(currentSession);
      }
    });
    return () => data?.subscription?.unsubscribe();
  },

  async signOut() {
    currentSession = null;
    await supabase.auth.signOut();
  }
};
