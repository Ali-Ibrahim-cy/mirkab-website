/**
 * مِركاب | MIRKAB — ملف إعدادات الموقع والهوية وروابط التواصل الاجتماعي
 * --------------------------------------------------------------------------
 * هذا الملف مستقل لإدارة:
 *   1. اسم العلامة التجارية وشعارها ومعلومات حقوق النشر والوصف التعريفي.
 *   2. حسابات التواصل الاجتماعي (Instagram, TikTok, Snapchat, X, WhatsApp).
 *   3. إعدادات برنامج التسويق بالعمولة (Amazon.sa).
 *
 * تنبيه مهم:
 *   - اترك حقل الرابط فارغاً '' لأي حساب غير مفعّل؛ ولن يظهر أي رابط أو حساب وهمي في الموقع.
 *   - عند إضافة حساب فعلي، أدخل الرابط الكامل بصيغة HTTPS فقط:
 *       instagram: 'https://www.instagram.com/your_account/'
 *       tiktok:    'https://www.tiktok.com/@your_account'
 *       snapchat:  'https://www.snapchat.com/add/your_account'
 *       x:         'https://x.com/your_account'
 *       whatsapp:  'https://wa.me/9665XXXXXXXX'
 */

export const SITE_CONFIG = {
  schemaVersion: '1.0.0',

  brand: {
    ar: 'مِركاب',
    en: 'MIRKAB',
    separator: '|',
    copyrightYear: '2026',
    tagline: {
      ar: 'حلول ذكية وتقنيات عملية للسيارات — بتصميم يرتقي بكل رحلة.',
      en: 'Smart automotive solutions and practical cockpit gear for every kilometer.'
    }
  },

  seo: {
    ar: {
      title: 'مِركاب | MIRKAB — حلول وإكسسوارات السيارات',
      description: 'مِركاب منصة متخصصة في حلول وإكسسوارات السيارات العملية بتجربة عرض ثلاثية الأبعاد.'
    },
    en: {
      title: 'MIRKAB | مِركاب — Automotive Gear & Solutions',
      description: 'Interactive 3D showcase for practical automotive gear and solutions in Saudi Arabia.'
    }
  },

  affiliate: {
    marketplaceName: 'Amazon.sa',
    currency: {
      ar: 'ر.س',
      en: 'SAR'
    },
    disclosure: {
      ar: 'قد يحصل مِركاب على عمولة عبر روابط أمازون السعودية عند الشراء المؤهل، دون أي تكلفة إضافية عليك.',
      en: 'MIRKAB may earn an affiliate commission on qualifying Amazon.sa purchases at no extra cost to you.'
    },
    productLiveNotice: {
      ar: 'قد يحصل مِركاب على عمولة عند الشراء عبر أمازون السعودية دون أي تكلفة إضافية عليك.',
      en: 'MIRKAB may earn a commission via Amazon.sa when purchasing through this link at no additional cost.'
    },
    productPendingNotice: {
      ar: 'رابط الشراء الخاص بهذا المنتج غير مضاف بعد. أضف رابط Amazon.sa في حقل amazonUrl (والسعر المؤكد في price) داخل data/products.js دون استخدام أسعار أو بيانات وهمية.',
      en: 'The direct Amazon.sa link for this item has not been added yet. Update amazonUrl (and verified SAR price) inside data/products.js.'
    }
  },

  /**
   * حسابات التواصل الاجتماعي الرسمية للموقع:
   * اترك url فارغاً ('') لأي منصة لا يتوفر لها حساب فعلي.
   */
  social: {
    instagram: {
      id: 'instagram',
      label: { ar: 'إنستغرام', en: 'Instagram' },
      url: '',
      enabled: true
    },
    tiktok: {
      id: 'tiktok',
      label: { ar: 'تيك توك', en: 'TikTok' },
      url: '',
      enabled: true
    },
    snapchat: {
      id: 'snapchat',
      label: { ar: 'سناب شات', en: 'Snapchat' },
      url: '',
      enabled: true
    },
    x: {
      id: 'x',
      label: { ar: 'إكس (X)', en: 'X' },
      url: '',
      enabled: true
    },
    whatsapp: {
      id: 'whatsapp',
      label: { ar: 'واتساب', en: 'WhatsApp' },
      url: '',
      enabled: true
    }
  }
};
