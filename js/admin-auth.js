/**
 * مِركاب | MIRKAB — مصادقة لوحة التحكم المحلية (بدون أسرار مضمنة)
 * --------------------------------------------------------------------------
 * - لا يحتوي هذا الملف على أي كلمات مرور أو أسرار دخول مضمّنة.
 * - يتم إعداد رمز الدخول من المالك محلياً وحفظ بصمته المشفّرة (SHA-256 + Salt)
 *   داخل localStorage، مع حفظ جلسة الدخول المؤقتة في sessionStorage.
 * - تنبيه أمني صريح: المصادقة المحلية مخصصة للتنظيم الشخصي على المتصفح فقط
 *   وليست حماية أمنية خادمية ضد المتطفلين عند النشر الثابت (Static Site).
 */

const AUTH_STORAGE_KEY = 'mirkab_admin_auth_v1';
const SESSION_STORAGE_KEY = 'mirkab_admin_session_v1';

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSaltHex(length = 16) {
  const arr = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i += 1) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(arr);
}

/**
 * خوارزمية SHA-256 خالصة احتياطية عند غياب crypto.subtle في سياقات HTTP غير الآمنة.
 */
function sha256FallbackHex(inputStr) {
  const utf8 = unescape(encodeURIComponent(inputStr));
  const words = [];
  for (let i = 0; i < utf8.length; i += 1) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const rrot = (n, x) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < words.length; i += 16) {
    const W = new Array(64);
    for (let t = 0; t < 16; t += 1) W[t] = words[i + t] | 0;
    for (let t = 16; t < 64; t += 1) {
      const s0 = rrot(7, W[t - 15]) ^ rrot(18, W[t - 15]) ^ (W[t - 15] >>> 3);
      const s1 = rrot(17, W[t - 2]) ^ rrot(19, W[t - 2]) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t += 1) {
      const S1 = rrot(6, e) ^ rrot(11, e) ^ rrot(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rrot(2, a) ^ rrot(13, a) ^ rrot(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map((val) => (val >>> 0).toString(16).padStart(8, '0')).join('');
}

async function computeSaltedHashHex(saltHex, passphrase) {
  const payload = `${saltHex}:${passphrase}`;
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const data = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(digest));
  }
  return sha256FallbackHex(payload);
}

function readAuthRecord() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.saltHex === 'string' && typeof parsed.hashHex === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function openSession(hashHex) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      hashHex,
      signedInAt: new Date().toISOString()
    })
  );
}

export const AdminAuth = {
  hasConfiguredPassphrase() {
    return Boolean(readAuthRecord());
  },

  isAuthenticated() {
    const authRecord = readAuthRecord();
    if (!authRecord || typeof sessionStorage === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return false;
      const session = JSON.parse(raw);
      return Boolean(session && session.hashHex === authRecord.hashHex);
    } catch {
      return false;
    }
  },

  async setupInitialPassphrase(passphrase, confirmPassphrase) {
    if (readAuthRecord()) {
      throw new Error('AUTH_ALREADY_CONFIGURED');
    }
    const clean = String(passphrase || '');
    const confirm = String(confirmPassphrase || '');
    if (clean.length < 6) {
      throw new Error('PASSPHRASE_TOO_SHORT');
    }
    if (clean !== confirm) {
      throw new Error('PASSPHRASE_MISMATCH');
    }

    const saltHex = generateSaltHex(16);
    const hashHex = await computeSaltedHashHex(saltHex, clean);
    const record = {
      version: 1,
      saltHex,
      hashHex,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(record));
    openSession(hashHex);
    return true;
  },

  async verifyAndSignIn(passphrase) {
    const record = readAuthRecord();
    if (!record) {
      throw new Error('AUTH_NOT_CONFIGURED');
    }
    const candidateHash = await computeSaltedHashHex(record.saltHex, String(passphrase || ''));
    if (candidateHash !== record.hashHex) {
      throw new Error('INVALID_PASSPHRASE');
    }
    openSession(record.hashHex);
    return true;
  },

  async changePassphrase(currentPassphrase, newPassphrase, confirmNewPassphrase) {
    const record = readAuthRecord();
    if (!record) {
      throw new Error('AUTH_NOT_CONFIGURED');
    }
    const currentHash = await computeSaltedHashHex(record.saltHex, String(currentPassphrase || ''));
    if (currentHash !== record.hashHex) {
      throw new Error('CURRENT_PASSPHRASE_INVALID');
    }

    const cleanNew = String(newPassphrase || '');
    if (cleanNew.length < 6) {
      throw new Error('PASSPHRASE_TOO_SHORT');
    }
    if (cleanNew !== String(confirmNewPassphrase || '')) {
      throw new Error('PASSPHRASE_MISMATCH');
    }

    const saltHex = generateSaltHex(16);
    const hashHex = await computeSaltedHashHex(saltHex, cleanNew);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        saltHex,
        hashHex,
        updatedAt: new Date().toISOString()
      })
    );
    openSession(hashHex);
    return true;
  },

  signOut() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }
};
