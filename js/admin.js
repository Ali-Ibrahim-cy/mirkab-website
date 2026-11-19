/**
 * مِركاب | MIRKAB — محرك لوحة التحكم الإدارية الخاصة
 * --------------------------------------------------------------------------
 * واجهة إدارية مستقلة تماماً عن الموقع العام، محجوبة خلف شاشة دخول محلية،
 * تدير المنتجات (localStorage)، الصور (IndexedDB)، روابط Amazon.sa،
 * حسابات التواصل الاجتماعي، إعدادات الهوية، والنسخ الاحتياطي الكامل.
 */

import { AdminAuth } from './admin-auth.js';
import { MirkabStore, sanitizeHttpsUrl } from '../data/store-adapter.js';
import { MirkabMediaDB, isIndexedDbRef } from '../data/media-db.js';

const SECTION_TITLES = {
  dashboard: '1. الرئيسية',
  products: '2. إدارة المنتجات',
  'product-form': '3. إضافة / تعديل منتج',
  media: '4. إدارة الصور (IndexedDB)',
  'amazon-links': '5. إدارة روابط Amazon',
  social: '6. حسابات التواصل الاجتماعي',
  settings: '7. إعدادات الموقع والأمان',
  backup: '8. النسخ الاحتياطي والاستعادة'
};

const adminState = {
  activeSection: 'dashboard',
  editingProductId: '',
  searchQuery: '',
  categoryFilter: 'all',
  statusFilter: 'all',
  toastTimer: 0,
  draftMedia: {
    mainFile: null,
    mainPreviewUrl: '',
    mainExistingRef: '',
    galleryItems: [] // عناصر: { kind: 'existing', ref } أو { kind: 'file', file, previewUrl }
  },
  mediaUploadDraft: {
    file: null,
    previewUrl: ''
  },
  pendingBackupData: null
};

/* ==========================================================================
   أدوات مساعدة عامة (DOM، صور، إشعارات، تأكيد)
   ========================================================================== */
function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof textContent === 'string') el.textContent = textContent;
  return el;
}

function formatBytes(bytes) {
  const num = Number(bytes) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

function resolveAdminPreviewPath(srcRef) {
  if (!srcRef || typeof srcRef !== 'string') return '';
  if (srcRef.startsWith('./')) {
    return `../${srcRef.slice(2)}`;
  }
  return srcRef;
}

function bindPreviewImage(imgEl, srcRef) {
  if (!imgEl) return;
  if (!srcRef) {
    imgEl.removeAttribute('src');
    return;
  }
  if (isIndexedDbRef(srcRef)) {
    imgEl.removeAttribute('src');
    MirkabMediaDB.resolveImageUrl(srcRef)
      .then((url) => {
        if (imgEl.isConnected && url) imgEl.src = url;
      })
      .catch(() => {});
    return;
  }
  imgEl.src = resolveAdminPreviewPath(srcRef);
}

function showToast(message) {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;
  if (adminState.toastTimer) clearTimeout(adminState.toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  adminState.toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    adminState.toastTimer = 0;
  }, 3400);
}

function askConfirmation(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('admin-confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      resolve(false);
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    modal.hidden = false;

    const cleanup = (result) => {
      modal.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onEsc);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => {
      if (e.target === modal) cleanup(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onEsc);
    cancelBtn.focus();
  });
}

function slugifyId(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function revokeDraftMediaUrls() {
  if (adminState.draftMedia.mainPreviewUrl) {
    URL.revokeObjectURL(adminState.draftMedia.mainPreviewUrl);
    adminState.draftMedia.mainPreviewUrl = '';
  }
  adminState.draftMedia.galleryItems.forEach((item) => {
    if (item.kind === 'file' && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

function clearMediaUploadDraft() {
  if (adminState.mediaUploadDraft.previewUrl) {
    URL.revokeObjectURL(adminState.mediaUploadDraft.previewUrl);
  }
  adminState.mediaUploadDraft = { file: null, previewUrl: '' };
}

function getCategoryLabel(categoryId) {
  const found = MirkabStore.getCategories().find((c) => c.id === categoryId);
  return found ? found.ar : categoryId;
}

/* ==========================================================================
   الحماية والتحقق من الجلسة قبل أي إجراء إداري
   ========================================================================== */
function requireAdminAuth() {
  if (!AdminAuth.isAuthenticated()) {
    lockAdminInterface();
    return false;
  }
  return true;
}

function lockAdminInterface() {
  const loginScreen = document.getElementById('admin-login-screen');
  const shell = document.getElementById('admin-shell');
  const workspace = document.getElementById('admin-workspace');
  if (workspace) workspace.replaceChildren();
  if (shell) shell.hidden = true;
  if (loginScreen) loginScreen.hidden = false;
  renderAuthGateState();
}

function unlockAdminInterface() {
  if (!AdminAuth.isAuthenticated()) return;
  const loginScreen = document.getElementById('admin-login-screen');
  const shell = document.getElementById('admin-shell');
  if (loginScreen) loginScreen.hidden = true;
  if (shell) shell.hidden = false;

  const cfg = MirkabStore.getSiteConfig();
  const brandLabel = document.getElementById('sidebar-brand-name');
  if (brandLabel) {
    brandLabel.textContent = `${cfg.brand.ar} ${cfg.brand.separator} ${cfg.brand.en}`;
  }

  navigateToSection(adminState.activeSection || 'dashboard');
}

function renderAuthGateState() {
  const isConfigured = AdminAuth.hasConfiguredPassphrase();
  const subtitle = document.getElementById('auth-subtitle');
  const confirmWrap = document.getElementById('auth-confirm-wrap');
  const confirmInput = document.getElementById('auth-passphrase-confirm');
  const passInput = document.getElementById('auth-passphrase');
  const passLabel = document.getElementById('auth-pass-label');
  const submitBtn = document.getElementById('auth-submit-btn');
  const errorEl = document.getElementById('auth-error');

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  if (passInput) {
    passInput.value = '';
    passInput.setAttribute('autocomplete', isConfigured ? 'current-password' : 'new-password');
  }
  if (confirmInput) confirmInput.value = '';

  if (isConfigured) {
    if (subtitle) subtitle.textContent = 'أدخل رمز الدخول المحلي للوصول إلى لوحة إدارة المنتجات والصور والإعدادات.';
    if (passLabel) passLabel.textContent = 'رمز الدخول المحلي';
    if (confirmWrap) confirmWrap.hidden = true;
    if (confirmInput) confirmInput.required = false;
    if (submitBtn) submitBtn.textContent = 'دخول إلى الإدارة';
  } else {
    if (subtitle) {
      subtitle.textContent =
        'الإعداد الأولي للمالك: عيّن رمز دخول محلياً (6 أحرف على الأقل) لحفظه مشفّراً في متصفحك دون تضمين أي كلمة مرور في الكود.';
    }
    if (passLabel) passLabel.textContent = 'إنشاء رمز الدخول المحلي';
    if (confirmWrap) confirmWrap.hidden = false;
    if (confirmInput) confirmInput.required = true;
    if (submitBtn) submitBtn.textContent = 'حفظ رمز الدخول والبدء';
  }
}

function setupAuthForm() {
  const form = document.getElementById('auth-form');
  const passInput = document.getElementById('auth-passphrase');
  const confirmInput = document.getElementById('auth-passphrase-confirm');
  const errorEl = document.getElementById('auth-error');
  if (!form || !passInput || !errorEl) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = '';

    try {
      if (AdminAuth.hasConfiguredPassphrase()) {
        await AdminAuth.verifyAndSignIn(passInput.value);
      } else {
        await AdminAuth.setupInitialPassphrase(passInput.value, confirmInput?.value || '');
      }
      passInput.value = '';
      if (confirmInput) confirmInput.value = '';
      unlockAdminInterface();
    } catch (err) {
      const code = err?.message || '';
      const messages = {
        PASSPHRASE_TOO_SHORT: 'يجب أن يتكون رمز الدخول من 6 أحرف على الأقل.',
        PASSPHRASE_MISMATCH: 'رمز الدخول وتأكيده غير متطابقين.',
        INVALID_PASSPHRASE: 'رمز الدخول غير صحيح.'
      };
      errorEl.textContent = messages[code] || 'تعذر التحقق من رمز الدخول.';
      errorEl.hidden = false;
    }
  });
}

/* ==========================================================================
   التنقل بين أقسام لوحة التحكم الثمانية
   ========================================================================== */
function navigateToSection(sectionKey, options = {}) {
  if (!requireAdminAuth()) return;

  const validSection = SECTION_TITLES[sectionKey] ? sectionKey : 'dashboard';
  adminState.activeSection = validSection;

  if (validSection === 'product-form' && options.resetForm) {
    adminState.editingProductId = '';
  }

  document.querySelectorAll('#admin-nav .nav-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-section') === validSection);
  });

  const titleEl = document.getElementById('topbar-view-title');
  if (titleEl) {
    if (validSection === 'product-form' && adminState.editingProductId) {
      titleEl.textContent = '3. تعديل منتج حالي';
    } else {
      titleEl.textContent = SECTION_TITLES[validSection];
    }
  }

  const sidebar = document.getElementById('admin-sidebar');
  if (sidebar) sidebar.classList.remove('is-open');

  renderActiveWorkspace();
}

async function renderActiveWorkspace() {
  if (!requireAdminAuth()) return;
  const workspace = document.getElementById('admin-workspace');
  if (!workspace) return;

  switch (adminState.activeSection) {
    case 'dashboard':
      await renderDashboardSection(workspace);
      break;
    case 'products':
      renderProductsSection(workspace);
      break;
    case 'product-form':
      renderProductFormSection(workspace);
      break;
    case 'media':
      await renderMediaSection(workspace);
      break;
    case 'amazon-links':
      renderAmazonLinksSection(workspace);
      break;
    case 'social':
      renderSocialSection(workspace);
      break;
    case 'settings':
      renderSettingsSection(workspace);
      break;
    case 'backup':
      await renderBackupSection(workspace);
      break;
    default:
      await renderDashboardSection(workspace);
  }
}

/* ==========================================================================
   1. الرئيسية (Dashboard)
   ========================================================================== */
async function renderDashboardSection(container) {
  const products = MirkabStore.getProducts({ includeDrafts: true });
  const publishedCount = products.filter((p) => p.status === 'published').length;
  const draftCount = products.length - publishedCount;
  const linkedAmazon = products.filter((p) => Boolean(sanitizeHttpsUrl(p.amazonUrl))).length;
  const activeSocial = MirkabStore.getSocialAccounts();
  const mediaStats = await MirkabMediaDB.getStorageStats();
  const cfg = MirkabStore.getSiteConfig();

  const statsGrid = createEl('div', 'stats-grid');
  const cards = [
    {
      label: 'إجمالي المنتجات',
      value: String(products.length),
      hint: `${publishedCount} منشور • ${draftCount} مسودة`
    },
    {
      label: 'روابط Amazon.sa',
      value: `${linkedAmazon} / ${products.length}`,
      hint: linkedAmazon === products.length ? 'جميع المنتجات مرتبطة' : `${products.length - linkedAmazon} منتج بانتظار الرابط`
    },
    {
      label: 'الصور المرفوعة (IndexedDB)',
      value: String(mediaStats.count),
      hint: `الحجم المحفوظ: ${formatBytes(mediaStats.totalBytes)}`
    },
    {
      label: 'حسابات التواصل الظاهرة',
      value: `${activeSocial.length} / 5`,
      hint: activeSocial.length ? 'تظهر تلقائياً في تذييل الموقع' : 'لا توجد حسابات مفعّلة حالياً'
    }
  ];

  cards.forEach((c) => {
    const card = createEl('div', 'stat-card');
    card.append(
      createEl('span', 'stat-label', c.label),
      createEl('strong', 'stat-value', c.value),
      createEl('span', 'stat-hint', c.hint)
    );
    statsGrid.appendChild(card);
  });

  const actionsPanel = createEl('section', 'panel');
  const header = createEl('div', 'panel-header');
  const hWrap = createEl('div');
  hWrap.append(
    createEl('h3', 'panel-title', `مركز تشغيل ${cfg.brand.ar} | ${cfg.brand.en}`),
    createEl('p', 'panel-subtitle', 'جميع التعديلات تُحفظ محلياً في المتصفح وتنعكس فوراً على الموقع العام دون المساس بالتصميم.')
  );
  header.appendChild(hWrap);

  const btnRow = createEl('div', 'toolbar-row');
  const quickButtons = [
    { label: '+ إضافة منتج جديد', section: 'product-form', cls: 'btn btn-primary', resetForm: true },
    { label: 'إدارة المنتجات والترتيب', section: 'products', cls: 'btn btn-silver' },
    { label: 'تحديث روابط Amazon.sa', section: 'amazon-links', cls: 'btn btn-surface' },
    { label: 'رفع وإدارة الصور', section: 'media', cls: 'btn btn-surface' },
    { label: 'تصدير نسخة احتياطية', section: 'backup', cls: 'btn btn-surface' }
  ];

  quickButtons.forEach((b) => {
    const btn = createEl('button', b.cls, b.label);
    btn.type = 'button';
    btn.addEventListener('click', () => navigateToSection(b.section, { resetForm: b.resetForm }));
    btnRow.appendChild(btn);
  });

  actionsPanel.append(header, btnRow);

  const infoPanel = createEl('section', 'panel');
  infoPanel.append(
    createEl('h3', 'panel-title', 'نطاق التخزين والخصوصية'),
    createEl(
      'p',
      'panel-subtitle',
      'يُحفظ كتالوج المنتجات وإعدادات الموقع في localStorage وتُحفظ الصور المرفوعة في IndexedDB على هذا المتصفح. لتأمين نسخة محمولة من بياناتك وصورك أو نقلها لجهاز آخر، استخدم قسم «النسخ الاحتياطي» بانتظام.'
    )
  );

  container.replaceChildren(statsGrid, actionsPanel, infoPanel);
}

/* ==========================================================================
   2. إدارة المنتجات (بحث، تصفية، ترتيب، إظهار/إخفاء، تعديل، حذف)
   ========================================================================== */
function renderProductsSection(container) {
  const panel = createEl('section', 'panel');

  const header = createEl('div', 'panel-header');
  const hWrap = createEl('div');
  hWrap.append(
    createEl('h3', 'panel-title', 'قائمة المنتجات'),
    createEl('p', 'panel-subtitle', 'ابحث، رتّب، أظهر أو أخفِ أي منتج، أو افتحه للتعديل.')
  );
  const addBtn = createEl('button', 'btn btn-primary', '+ إضافة منتج');
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => navigateToSection('product-form', { resetForm: true }));
  header.append(hWrap, addBtn);

  // شريط البحث والتصفية
  const toolbar = createEl('div', 'toolbar-row');

  const searchInput = createEl('input', 'field-input');
  searchInput.type = 'search';
  searchInput.placeholder = 'ابحث باسم المنتج أو المعرف...';
  searchInput.value = adminState.searchQuery;
  searchInput.addEventListener('input', () => {
    adminState.searchQuery = searchInput.value;
    renderTableBody();
  });

  const catSelect = createEl('select', 'field-select');
  catSelect.appendChild(new Option('كل التصنيفات', 'all'));
  MirkabStore.getCategories().forEach((c) => {
    catSelect.appendChild(new Option(c.ar, c.id));
  });
  catSelect.value = adminState.categoryFilter;
  catSelect.addEventListener('change', () => {
    adminState.categoryFilter = catSelect.value;
    renderTableBody();
  });

  const statusSelect = createEl('select', 'field-select');
  statusSelect.append(
    new Option('جميع الحالات', 'all'),
    new Option('منشور فقط', 'published'),
    new Option('مسودة (مخفي) فقط', 'draft')
  );
  statusSelect.value = adminState.statusFilter;
  statusSelect.addEventListener('change', () => {
    adminState.statusFilter = statusSelect.value;
    renderTableBody();
  });

  toolbar.append(searchInput, catSelect, statusSelect);

  const tableWrap = createEl('div', 'table-wrap');
  const table = createEl('table', 'admin-table');
  const thead = createEl('thead');
  const headRow = createEl('tr');
  ['الترتيب', 'الصورة', 'المنتج', 'التصنيف', 'السعر', 'Amazon', 'الحالة', 'الإجراءات'].forEach((label) => {
    headRow.appendChild(createEl('th', '', label));
  });
  thead.appendChild(headRow);
  const tbody = createEl('tbody');
  table.append(thead, tbody);
  tableWrap.appendChild(table);

  function renderTableBody() {
    const allProducts = MirkabStore.getProducts({ includeDrafts: true });
    const query = adminState.searchQuery.trim().toLowerCase();

    const filtered = allProducts.filter((p) => {
      if (adminState.categoryFilter !== 'all' && p.category !== adminState.categoryFilter) return false;
      if (adminState.statusFilter !== 'all' && p.status !== adminState.statusFilter) return false;
      if (query) {
        const hay = `${p.id} ${p.ar.name} ${p.en.name} ${p.ar.benefit}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      const emptyRow = createEl('tr');
      const td = createEl('td', '', 'لا توجد منتجات مطابقة لخيارات البحث الحالية.');
      td.colSpan = 8;
      emptyRow.appendChild(td);
      tbody.replaceChildren(emptyRow);
      return;
    }

    const frag = document.createDocumentFragment();
    const isUnfiltered = !query && adminState.categoryFilter === 'all' && adminState.statusFilter === 'all';

    filtered.forEach((product, idx) => {
      const tr = createEl('tr');

      // عمود الترتيب
      const orderTd = createEl('td');
      const orderWrap = createEl('div', 'row-actions');
      orderWrap.appendChild(createEl('span', 'badge', `#${product.order}`));
      if (isUnfiltered) {
        const upBtn = createEl('button', 'btn btn-surface btn-sm', '▲');
        upBtn.type = 'button';
        upBtn.title = 'تقديم للأعلى';
        upBtn.disabled = idx === 0;
        upBtn.addEventListener('click', () => {
          MirkabStore.moveProductOrder(product.id, 'up');
          renderTableBody();
        });

        const downBtn = createEl('button', 'btn btn-surface btn-sm', '▼');
        downBtn.type = 'button';
        downBtn.title = 'تأخير للأسفل';
        downBtn.disabled = idx === filtered.length - 1;
        downBtn.addEventListener('click', () => {
          MirkabStore.moveProductOrder(product.id, 'down');
          renderTableBody();
        });
        orderWrap.append(upBtn, downBtn);
      }
      orderTd.appendChild(orderWrap);

      // الصورة
      const imgTd = createEl('td');
      const thumbBox = createEl('div', 'thumb-box');
      const img = document.createElement('img');
      img.alt = product.ar.name;
      bindPreviewImage(img, product.image);
      thumbBox.appendChild(img);
      imgTd.appendChild(thumbBox);

      // الاسم والمعرف
      const nameTd = createEl('td');
      nameTd.append(
        createEl('div', '', product.ar.name),
        createEl('div', 'field-hint', `${product.id}${product.gallery.length ? ` • +${product.gallery.length} صور` : ''}`)
      );

      // التصنيف
      const catTd = createEl('td', '', getCategoryLabel(product.category));

      // السعر
      const priceText = product.price ? String(product.price) : 'غير محدد';
      const priceTd = createEl('td', '', priceText);

      // Amazon
      const amzTd = createEl('td');
      const hasUrl = Boolean(sanitizeHttpsUrl(product.amazonUrl));
      amzTd.appendChild(
        createEl('span', `badge ${hasUrl ? 'is-published' : ''}`.trim(), hasUrl ? 'مرتبط' : 'غير مضاف')
      );

      // الحالة
      const statusTd = createEl('td');
      const isPub = product.status === 'published';
      const toggleStatusBtn = createEl(
        'button',
        `btn btn-sm ${isPub ? 'btn-silver' : 'btn-surface'}`,
        isPub ? 'منشور' : 'مسودة (مخفي)'
      );
      toggleStatusBtn.type = 'button';
      toggleStatusBtn.title = 'انقر لتبديل الظهور في الموقع العام';
      toggleStatusBtn.addEventListener('click', () => {
        if (!requireAdminAuth()) return;
        const updated = MirkabStore.toggleProductStatus(product.id);
        showToast(updated?.status === 'published' ? 'تم نشر المنتج في الموقع العام.' : 'تم تحويل المنتج إلى مسودة وإخفاؤه.');
        renderTableBody();
      });
      statusTd.appendChild(toggleStatusBtn);

      // الإجراءات
      const actTd = createEl('td');
      const actWrap = createEl('div', 'row-actions');
      const editBtn = createEl('button', 'btn btn-surface btn-sm', 'تعديل');
      editBtn.type = 'button';
      editBtn.addEventListener('click', () => {
        adminState.editingProductId = product.id;
        navigateToSection('product-form');
      });

      const delBtn = createEl('button', 'btn btn-danger btn-sm', 'حذف');
      delBtn.type = 'button';
      delBtn.addEventListener('click', async () => {
        if (!requireAdminAuth()) return;
        const confirmed = await askConfirmation(
          'تأكيد حذف المنتج',
          `هل أنت متأكد من حذف «${product.ar.name}»؟ لا يمكن التراجع عن هذا الحذف إلا عبر النسخة الاحتياطية.`
        );
        if (!confirmed) return;

        const refsToCheck = [product.image, ...(product.gallery || [])].filter(isIndexedDbRef);
        MirkabStore.deleteProduct(product.id);

        // تنظيف صور IndexedDB غير المستخدمة في منتجات أخرى
        const remainingRefs = new Set();
        MirkabStore.getProducts({ includeDrafts: true }).forEach((item) => {
          [item.image, ...(item.gallery || [])].forEach((r) => remainingRefs.add(r));
        });
        for (const ref of refsToCheck) {
          if (!remainingRefs.has(ref)) {
            await MirkabMediaDB.deleteImage(ref);
          }
        }

        showToast('تم حذف المنتج بنجاح.');
        renderTableBody();
      });

      actWrap.append(editBtn, delBtn);
      actTd.appendChild(actWrap);

      tr.append(orderTd, imgTd, nameTd, catTd, priceTd, amzTd, statusTd, actTd);
      frag.appendChild(tr);
    });

    tbody.replaceChildren(frag);
  }

  renderTableBody();
  panel.append(header, toolbar, tableWrap);
  container.replaceChildren(panel);
}

/* ==========================================================================
   3. إضافة / تعديل منتج (مع رفع الصور ومعاينتها قبل الحفظ)
   ========================================================================== */
function renderProductFormSection(container) {
  revokeDraftMediaUrls();

  const existing = adminState.editingProductId
    ? MirkabStore.getProductById(adminState.editingProductId, { includeDrafts: true })
    : null;
  const isEdit = Boolean(existing);

  adminState.draftMedia = {
    mainFile: null,
    mainPreviewUrl: '',
    mainExistingRef: existing ? existing.image : '',
    galleryItems: existing && Array.isArray(existing.gallery)
      ? existing.gallery.map((ref) => ({ kind: 'existing', ref }))
      : []
  };

  const panel = createEl('section', 'panel');
  const header = createEl('div', 'panel-header');
  const hWrap = createEl('div');
  hWrap.append(
    createEl('h3', 'panel-title', isEdit ? `تعديل: ${existing.ar.name}` : 'إضافة منتج جديد'),
    createEl('p', 'panel-subtitle', 'أدخل بيانات المنتج باللغتين وارفع الصورة الرئيسية والصور الإضافية مباشرة من جهازك.')
  );
  const headerActions = createEl('div', 'row-actions');
  if (isEdit) {
    const newBtn = createEl('button', 'btn btn-surface', 'إنشاء منتج جديد بدلاً من ذلك');
    newBtn.type = 'button';
    newBtn.addEventListener('click', () => {
      adminState.editingProductId = '';
      renderProductFormSection(container);
    });
    headerActions.appendChild(newBtn);
  }
  const backListBtn = createEl('button', 'btn btn-surface', 'العودة لقائمة المنتجات');
  backListBtn.type = 'button';
  backListBtn.addEventListener('click', () => navigateToSection('products'));
  headerActions.appendChild(backListBtn);
  header.append(hWrap, headerActions);

  const form = createEl('form', 'form-grid');
  form.noValidate = true;

  const makeField = (labelText, inputEl, { full = false, hint = '' } = {}) => {
    const wrap = createEl('div', `form-field ${full ? 'is-full' : ''}`.trim());
    const label = createEl('label', 'field-label', labelText);
    if (inputEl.id) label.setAttribute('for', inputEl.id);
    wrap.append(label, inputEl);
    if (hint) wrap.appendChild(createEl('span', 'field-hint', hint));
    return wrap;
  };

  // الحقول الأساسية
  const nameArInput = createEl('input', 'field-input');
  nameArInput.id = 'pf-name-ar';
  nameArInput.required = true;
  nameArInput.value = existing?.ar?.name || '';

  const nameEnInput = createEl('input', 'field-input');
  nameEnInput.id = 'pf-name-en';
  nameEnInput.dir = 'ltr';
  nameEnInput.value = existing?.en?.name || '';

  const idInput = createEl('input', 'field-input');
  idInput.id = 'pf-id';
  idInput.dir = 'ltr';
  idInput.placeholder = 'example-product-id';
  idInput.value = existing?.id || '';

  if (!isEdit) {
    nameEnInput.addEventListener('input', () => {
      if (!idInput.dataset.touched) {
        idInput.value = slugifyId(nameEnInput.value);
      }
    });
    idInput.addEventListener('input', () => {
      idInput.dataset.touched = '1';
    });
  }

  const catSelect = createEl('select', 'field-select');
  catSelect.id = 'pf-category';
  MirkabStore.getCategories().forEach((c) => catSelect.appendChild(new Option(c.ar, c.id)));
  catSelect.value = existing?.category || 'tech';

  const statusSelect = createEl('select', 'field-select');
  statusSelect.id = 'pf-status';
  statusSelect.append(new Option('منشور (يظهر للزوار)', 'published'), new Option('مسودة (مخفي)', 'draft'));
  statusSelect.value = existing?.status || 'published';

  const orderInput = createEl('input', 'field-input');
  orderInput.id = 'pf-order';
  orderInput.type = 'number';
  orderInput.min = '1';
  orderInput.value = String(existing?.order || MirkabStore.getProducts({ includeDrafts: true }).length + 1);

  const priceInput = createEl('input', 'field-input');
  priceInput.id = 'pf-price';
  priceInput.placeholder = 'مثال: 149 ر.س (أو اتركه فارغاً)';
  priceInput.value = existing?.price !== undefined ? String(existing.price) : '';

  const amazonInput = createEl('input', 'field-input');
  amazonInput.id = 'pf-amazon';
  amazonInput.type = 'url';
  amazonInput.dir = 'ltr';
  amazonInput.placeholder = 'https://www.amazon.sa/dp/...';
  amazonInput.value = existing?.amazonUrl || '';

  const benefitArInput = createEl('input', 'field-input');
  benefitArInput.id = 'pf-benefit-ar';
  benefitArInput.value = existing?.ar?.benefit || '';

  const benefitEnInput = createEl('input', 'field-input');
  benefitEnInput.id = 'pf-benefit-en';
  benefitEnInput.dir = 'ltr';
  benefitEnInput.value = existing?.en?.benefit || '';

  const descArInput = createEl('textarea', 'field-textarea');
  descArInput.id = 'pf-desc-ar';
  descArInput.value = existing?.ar?.description || '';

  const descEnInput = createEl('textarea', 'field-textarea');
  descEnInput.id = 'pf-desc-en';
  descEnInput.dir = 'ltr';
  descEnInput.value = existing?.en?.description || '';

  const featArInput = createEl('textarea', 'field-textarea');
  featArInput.id = 'pf-feat-ar';
  featArInput.placeholder = 'اكتب كل ميزة في سطر مستقل';
  featArInput.value = (existing?.ar?.features || []).join('\n');

  const featEnInput = createEl('textarea', 'field-textarea');
  featEnInput.id = 'pf-feat-en';
  featEnInput.dir = 'ltr';
  featEnInput.placeholder = 'One feature per line';
  featEnInput.value = (existing?.en?.features || []).join('\n');

  // محرر المواصفات الديناميكي (عربي / إنجليزي)
  function createSpecsBuilder(titleText, initialSpecs, isLtr = false) {
    const wrap = createEl('div', 'form-field is-full');
    const top = createEl('div', 'social-row-top');
    top.appendChild(createEl('span', 'field-label', titleText));
    const addRowBtn = createEl('button', 'btn btn-surface btn-sm', '+ إضافة مواصفة');
    addRowBtn.type = 'button';
    top.appendChild(addRowBtn);

    const listEl = createEl('div', 'spec-editor-list');

    const appendSpecRow = (label = '', value = '') => {
      const row = createEl('div', 'spec-editor-row');
      const lIn = createEl('input', 'field-input');
      lIn.placeholder = isLtr ? 'Label (e.g. Power)' : 'الخاصية (مثال: التصنيف)';
      lIn.value = label;
      if (isLtr) lIn.dir = 'ltr';

      const vIn = createEl('input', 'field-input');
      vIn.placeholder = isLtr ? 'Value' : 'القيمة';
      vIn.value = value;
      if (isLtr) vIn.dir = 'ltr';

      const remBtn = createEl('button', 'btn btn-surface btn-sm', 'حذف');
      remBtn.type = 'button';
      remBtn.addEventListener('click', () => row.remove());

      row.append(lIn, vIn, remBtn);
      listEl.appendChild(row);
    };

    const seed = Array.isArray(initialSpecs) && initialSpecs.length ? initialSpecs : [{ label: '', value: '' }];
    seed.forEach((s) => appendSpecRow(s.label || '', s.value || ''));
    addRowBtn.addEventListener('click', () => appendSpecRow());

    wrap.append(top, listEl);
    return {
      element: wrap,
      readSpecs: () =>
        Array.from(listEl.querySelectorAll('.spec-editor-row'))
          .map((row) => {
            const inputs = row.querySelectorAll('input');
            return {
              label: inputs[0]?.value.trim() || '',
              value: inputs[1]?.value.trim() || ''
            };
          })
          .filter((s) => s.label || s.value)
    };
  }

  const specsArBuilder = createSpecsBuilder('المواصفات (بالعربية)', existing?.ar?.specs, false);
  const specsEnBuilder = createSpecsBuilder('المواصفات (بالإنجليزية - اختياري)', existing?.en?.specs, true);

  // قسم رفع ومعاينة الصورة الرئيسية
  const mainMediaField = createEl('div', 'form-field is-full');
  mainMediaField.appendChild(createEl('span', 'field-label', 'الصورة الرئيسية للمنتج (تُحفظ في IndexedDB عند الرفع من جهازك)'));
  const mainStage = createEl('div', 'upload-stage');
  const mainPreviewBox = createEl('div', 'preview-main-box');
  const mainPreviewImg = document.createElement('img');
  const mainEmptySpan = createEl('span', '', 'لم يتم اختيار صورة رئيسية بعد');

  function refreshMainPreview() {
    mainPreviewBox.replaceChildren();
    if (adminState.draftMedia.mainPreviewUrl) {
      mainPreviewImg.src = adminState.draftMedia.mainPreviewUrl;
      mainPreviewImg.alt = 'معاينة الصورة الرئيسية';
      mainPreviewBox.appendChild(mainPreviewImg);
    } else if (adminState.draftMedia.mainExistingRef) {
      mainPreviewImg.alt = 'الصورة الرئيسية الحالية';
      bindPreviewImage(mainPreviewImg, adminState.draftMedia.mainExistingRef);
      mainPreviewBox.appendChild(mainPreviewImg);
    } else {
      mainPreviewBox.appendChild(mainEmptySpan);
    }
  }
  refreshMainPreview();

  const mainControls = createEl('div', 'toolbar-row');
  const mainFileInput = document.createElement('input');
  mainFileInput.type = 'file';
  mainFileInput.accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
  mainFileInput.className = 'field-input';
  mainFileInput.addEventListener('change', () => {
    const file = mainFileInput.files?.[0];
    if (!file) return;
    if (adminState.draftMedia.mainPreviewUrl) {
      URL.revokeObjectURL(adminState.draftMedia.mainPreviewUrl);
    }
    adminState.draftMedia.mainFile = file;
    adminState.draftMedia.mainPreviewUrl = URL.createObjectURL(file);
    refreshMainPreview();
  });

  const mainClearBtn = createEl('button', 'btn btn-surface btn-sm', 'إزالة الصورة الرئيسية');
  mainClearBtn.type = 'button';
  mainClearBtn.addEventListener('click', () => {
    if (adminState.draftMedia.mainPreviewUrl) {
      URL.revokeObjectURL(adminState.draftMedia.mainPreviewUrl);
    }
    adminState.draftMedia.mainFile = null;
    adminState.draftMedia.mainPreviewUrl = '';
    adminState.draftMedia.mainExistingRef = '';
    mainFileInput.value = '';
    refreshMainPreview();
  });

  mainControls.append(mainFileInput, mainClearBtn);
  mainStage.append(mainPreviewBox, mainControls);
  mainMediaField.appendChild(mainStage);

  // قسم رفع ومعاينة الصور الإضافية
  const galleryMediaField = createEl('div', 'form-field is-full');
  galleryMediaField.appendChild(createEl('span', 'field-label', 'الصور الإضافية للمنتج (تظهر أسفل الصورة الرئيسية داخل نافذة التفاصيل)'));
  const galleryStage = createEl('div', 'upload-stage');
  const galleryGrid = createEl('div', 'gallery-preview-grid');

  function refreshGalleryPreview() {
    galleryGrid.replaceChildren();
    if (!adminState.draftMedia.galleryItems.length) {
      galleryGrid.appendChild(createEl('span', 'field-hint', 'لا توجد صور إضافية حالياً.'));
      return;
    }

    adminState.draftMedia.galleryItems.forEach((item, idx) => {
      const card = createEl('div', 'gallery-preview-item');
      const img = document.createElement('img');
      img.alt = `صورة إضافية ${idx + 1}`;
      if (item.kind === 'file') {
        img.src = item.previewUrl;
      } else {
        bindPreviewImage(img, item.ref);
      }

      const remBtn = createEl('button', 'btn btn-surface btn-sm', 'حذف');
      remBtn.type = 'button';
      remBtn.addEventListener('click', () => {
        if (item.kind === 'file' && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        adminState.draftMedia.galleryItems.splice(idx, 1);
        refreshGalleryPreview();
      });

      card.append(img, remBtn);
      galleryGrid.appendChild(card);
    });
  }
  refreshGalleryPreview();

  const galleryInput = document.createElement('input');
  galleryInput.type = 'file';
  galleryInput.accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
  galleryInput.multiple = true;
  galleryInput.className = 'field-input';
  galleryInput.addEventListener('change', () => {
    const files = Array.from(galleryInput.files || []);
    files.forEach((file) => {
      adminState.draftMedia.galleryItems.push({
        kind: 'file',
        file,
        previewUrl: URL.createObjectURL(file)
      });
    });
    galleryInput.value = '';
    refreshGalleryPreview();
  });

  galleryStage.append(galleryGrid, galleryInput);
  galleryMediaField.appendChild(galleryStage);

  const formError = createEl('p', 'form-error is-full');
  formError.hidden = true;

  const submitWrap = createEl('div', 'form-field is-full');
  const submitRow = createEl('div', 'toolbar-row');
  const saveBtn = createEl('button', 'btn btn-primary', isEdit ? 'حفظ التعديلات' : 'حفظ ونشر المنتج');
  saveBtn.type = 'submit';
  submitRow.appendChild(saveBtn);
  submitWrap.appendChild(submitRow);

  form.append(
    makeField('اسم المنتج (بالعربية) *', nameArInput),
    makeField('اسم المنتج (بالإنجليزية)', nameEnInput),
    makeField('المعرف الفريد للمنتج (ID) *', idInput, { hint: 'أحرف إنجليزية صغيرة وشرطات فقط' }),
    makeField('التصنيف', catSelect),
    makeField('حالة العرض', statusSelect),
    makeField('الترتيب', orderInput),
    makeField('السعر بالريال السعودي', priceInput, { hint: 'أدخل السعر المؤكد أو اتركه فارغاً دون أسعار وهمية' }),
    makeField('رابط Amazon السعودية (اختياري)', amazonInput, { hint: 'يجب أن يبدأ بـ https://' }),
    makeField('الفائدة الأساسية (بالعربية)', benefitArInput, { full: true }),
    makeField('الفائدة الأساسية (بالإنجليزية)', benefitEnInput, { full: true }),
    makeField('وصف مختصر (بالعربية)', descArInput),
    makeField('وصف مختصر (بالإنجليزية)', descEnInput),
    makeField('المميزات بالعربية (سطر لكل ميزة)', featArInput),
    makeField('المميزات بالإنجليزية (سطر لكل ميزة)', featEnInput),
    specsArBuilder.element,
    specsEnBuilder.element,
    mainMediaField,
    galleryMediaField,
    formError,
    submitWrap
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAdminAuth()) return;

    formError.hidden = true;
    formError.textContent = '';

    const arName = nameArInput.value.trim();
    let productId = slugifyId(idInput.value) || slugifyId(nameEnInput.value);
    if (!isEdit && !productId && arName) {
      productId = `product-${Date.now()}`;
    }

    if (!arName) {
      formError.textContent = 'يرجى إدخال اسم المنتج باللغة العربية.';
      formError.hidden = false;
      return;
    }
    if (!productId) {
      formError.textContent = 'يرجى إدخال معرف فريد صحيح للمنتج بالإنجليزية.';
      formError.hidden = false;
      return;
    }

    const rawAmazon = amazonInput.value.trim();
    if (rawAmazon && !sanitizeHttpsUrl(rawAmazon)) {
      formError.textContent = 'رابط Amazon.sa غير صالح؛ يجب أن يبدأ بـ https://';
      formError.hidden = false;
      return;
    }

    if (!adminState.draftMedia.mainFile && !adminState.draftMedia.mainExistingRef) {
      formError.textContent = 'يرجى اختيار صورة رئيسية للمنتج.';
      formError.hidden = false;
      return;
    }

    saveBtn.disabled = true;
    const prevBtnText = saveBtn.textContent;
    saveBtn.textContent = 'جاري الحفظ...';

    try {
      let finalMainImage = adminState.draftMedia.mainExistingRef;
      if (adminState.draftMedia.mainFile) {
        const savedMain = await MirkabMediaDB.saveImageFile(adminState.draftMedia.mainFile, {
          productId,
          role: 'main'
        });
        finalMainImage = savedMain.ref;
      }

      const finalGallery = [];
      for (const item of adminState.draftMedia.galleryItems) {
        if (item.kind === 'existing' && item.ref) {
          finalGallery.push(item.ref);
        } else if (item.kind === 'file' && item.file) {
          const savedExtra = await MirkabMediaDB.saveImageFile(item.file, {
            productId,
            role: 'gallery'
          });
          finalGallery.push(savedExtra.ref);
        }
      }

      const splitLines = (text) =>
        String(text || '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

      const payload = {
        id: productId,
        category: catSelect.value,
        status: statusSelect.value === 'draft' ? 'draft' : 'published',
        order: Number(orderInput.value) || 99,
        image: finalMainImage,
        gallery: finalGallery,
        price: priceInput.value.trim(),
        amazonUrl: rawAmazon,
        ar: {
          name: arName,
          benefit: benefitArInput.value.trim(),
          description: descArInput.value.trim(),
          features: splitLines(featArInput.value),
          specs: specsArBuilder.readSpecs()
        },
        en: {
          name: nameEnInput.value.trim() || arName,
          benefit: benefitEnInput.value.trim(),
          description: descEnInput.value.trim(),
          features: splitLines(featEnInput.value),
          specs: specsEnBuilder.readSpecs()
        }
      };

      MirkabStore.upsertProduct(payload, existing ? existing.id : '');
      revokeDraftMediaUrls();
      adminState.editingProductId = '';
      showToast(isEdit ? 'تم حفظ تعديلات المنتج بنجاح.' : 'تم إضافة المنتج وحفظه بنجاح.');
      navigateToSection('products');
    } catch (err) {
      const code = err?.message || '';
      const errorMap = {
        DUPLICATE_PRODUCT_ID: 'معرّف المنتج مستخدم بالفعل لمنتج آخر. اختر معرفاً مختلفاً.',
        UNSUPPORTED_IMAGE_TYPE: 'صيغة الصورة غير مدعومة (استخدم JPG أو PNG أو WebP).',
        FILE_TOO_LARGE: 'حجم الصورة يتجاوز الحد الأقصى المسموح (12 MB).',
        LOCALSTORAGE_WRITE_FAILED: 'تعذر الكتابة إلى التخزين المحلي للمتصفح (تحقق من المساحة المتاحة).'
      };
      formError.textContent = errorMap[code] || 'حدث خطأ أثناء حفظ المنتج أو معالجة صوره.';
      formError.hidden = false;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = prevBtnText;
    }
  });

  panel.append(header, form);
  container.replaceChildren(panel);
}

/* ==========================================================================
   4. إدارة الصور (IndexedDB Upload + Preview + Product Binding + Cleanup)
   ========================================================================== */
async function renderMediaSection(container) {
  clearMediaUploadDraft();
  const products = MirkabStore.getProducts({ includeDrafts: true });
  const storedImages = await MirkabMediaDB.listImages();
  const stats = await MirkabMediaDB.getStorageStats();

  // اللوحة 1: رفع صورة من الجهاز وربطها مباشرة بمنتج
  const uploadPanel = createEl('section', 'panel');
  const uploadHeader = createEl('div', 'panel-header');
  const uhWrap = createEl('div');
  uhWrap.append(
    createEl('h3', 'panel-title', 'رفع صورة جديدة وحفظها في IndexedDB'),
    createEl(
      'p',
      'panel-subtitle',
      `الصور المحفوظة محلياً: ${stats.count} (${formatBytes(stats.totalBytes)})${
        stats.quotaBytes ? ` • سعة المتصفح المقدرة: ${formatBytes(stats.quotaBytes)}` : ''
      }`
    )
  );
  uploadHeader.appendChild(uhWrap);

  const uploadGrid = createEl('div', 'form-grid');
  const previewBox = createEl('div', 'preview-main-box');
  previewBox.appendChild(createEl('span', '', 'معاينة الصورة قبل الحفظ'));

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
  fileInput.className = 'field-input';
  fileInput.addEventListener('change', () => {
    clearMediaUploadDraft();
    const file = fileInput.files?.[0];
    if (!file) {
      previewBox.replaceChildren(createEl('span', '', 'معاينة الصورة قبل الحفظ'));
      return;
    }
    adminState.mediaUploadDraft.file = file;
    adminState.mediaUploadDraft.previewUrl = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = adminState.mediaUploadDraft.previewUrl;
    img.alt = file.name;
    previewBox.replaceChildren(img);
  });

  const targetProductSelect = createEl('select', 'field-select');
  products.forEach((p) => targetProductSelect.appendChild(new Option(p.ar.name, p.id)));

  const roleSelect = createEl('select', 'field-select');
  roleSelect.append(
    new Option('استبدال / تعيين كصورة رئيسية', 'main'),
    new Option('إضافة إلى الصور الإضافية للمنتج', 'gallery')
  );

  const saveMediaBtn = createEl('button', 'btn btn-primary', 'حفظ الصورة وربطها بالمنتج');
  saveMediaBtn.type = 'button';
  saveMediaBtn.addEventListener('click', async () => {
    if (!requireAdminAuth()) return;
    if (!adminState.mediaUploadDraft.file) {
      showToast('اختر صورة من جهازك أولاً.');
      return;
    }
    const targetProduct = MirkabStore.getProductById(targetProductSelect.value, { includeDrafts: true });
    if (!targetProduct) {
      showToast('اختر منتجاً صحيحاً.');
      return;
    }

    saveMediaBtn.disabled = true;
    try {
      const saved = await MirkabMediaDB.saveImageFile(adminState.mediaUploadDraft.file, {
        productId: targetProduct.id,
        role: roleSelect.value
      });

      const updated = { ...targetProduct };
      if (roleSelect.value === 'main') {
        updated.image = saved.ref;
      } else {
        updated.gallery = [...(updated.gallery || []), saved.ref];
      }

      MirkabStore.upsertProduct(updated, updated.id);
      clearMediaUploadDraft();
      showToast('تم حفظ الصورة في IndexedDB وربطها بالمنتج.');
      await renderMediaSection(container);
    } catch {
      showToast('تعذر حفظ الصورة. تأكد من الصيغة وحجم الملف.');
    } finally {
      saveMediaBtn.disabled = false;
    }
  });

  const controlsCol = createEl('div', 'form-field');
  controlsCol.append(
    createEl('label', 'field-label', '1. اختر الصورة من الجهاز'),
    fileInput,
    createEl('label', 'field-label', '2. اختر المنتج المرتبط'),
    targetProductSelect,
    createEl('label', 'field-label', '3. نوع الارتباط'),
    roleSelect,
    saveMediaBtn
  );

  uploadGrid.append(previewBox, controlsCol);
  uploadPanel.append(uploadHeader, uploadGrid);

  // اللوحة 2: استعراض الصور المرفوعة في IndexedDB
  const galleryPanel = createEl('section', 'panel');
  galleryPanel.appendChild(createEl('h3', 'panel-title', `مكتبة الصور المحفوظة في IndexedDB (${storedImages.length})`));

  if (!storedImages.length) {
    galleryPanel.appendChild(
      createEl('p', 'panel-subtitle', 'لا توجد صور مرفوعة بعد في IndexedDB. جميع المنتجات تستخدم حالياً صورها الافتراضية، ويمكنك رفع واستبدال أي صورة من النموذج أعلاه.')
    );
  } else {
    const cardsGrid = createEl('div', 'media-cards-grid');
    storedImages.forEach((imgRec) => {
      const card = createEl('article', 'media-card');
      const img = document.createElement('img');
      img.className = 'media-card-img';
      img.alt = imgRec.name || imgRec.id;
      bindPreviewImage(img, imgRec.ref);

      const linkedProduct = products.find(
        (p) => p.image === imgRec.ref || (p.gallery || []).includes(imgRec.ref)
      );

      const body = createEl('div', 'media-card-body');
      body.append(
        createEl('strong', '', imgRec.name || imgRec.id),
        createEl('span', 'field-hint', `${formatBytes(imgRec.size)}${imgRec.width ? ` • ${imgRec.width}×${imgRec.height}` : ''}`),
        createEl('span', 'badge', linkedProduct ? `مرتبطة بـ: ${linkedProduct.ar.name}` : 'غير مرتبطة بمنتج')
      );

      const delBtn = createEl('button', 'btn btn-danger btn-sm', 'حذف الصورة');
      delBtn.type = 'button';
      delBtn.addEventListener('click', async () => {
        if (!requireAdminAuth()) return;
        const ok = await askConfirmation(
          'حذف صورة من IndexedDB',
          'هل تريد حذف هذه الصورة؟ سيتم فصلها تلقائياً عن أي منتج مرتبط بها.'
        );
        if (!ok) return;

        // فك الارتباط من المنتجات (مع الحفاظ على صورة احتياطية إن كانت رئيسية إذا توفرت في gallery)
        products.forEach((p) => {
          const inGallery = (p.gallery || []).includes(imgRec.ref);
          const isMain = p.image === imgRec.ref;
          if (!inGallery && !isMain) return;
          const nextGallery = (p.gallery || []).filter((r) => r !== imgRec.ref);
          const nextMain = isMain ? (nextGallery.shift() || './assets/images/products/prod-thermal-sunshade.jpg') : p.image;
          MirkabStore.upsertProduct({ ...p, image: nextMain, gallery: nextGallery }, p.id);
        });

        await MirkabMediaDB.deleteImage(imgRec.ref);
        showToast('تم حذف الصورة وفك ارتباطها.');
        await renderMediaSection(container);
      });

      body.appendChild(delBtn);
      card.append(img, body);
      cardsGrid.appendChild(card);
    });
    galleryPanel.appendChild(cardsGrid);
  }

  // اللوحة 3: صور كل منتج (رئيسية + إضافية) لسهولة الاستبدال أو التعديل المباشر
  const perProductPanel = createEl('section', 'panel');
  perProductPanel.appendChild(createEl('h3', 'panel-title', 'صور المنتجات الحالية'));
  const tableWrap = createEl('div', 'table-wrap');
  const table = createEl('table', 'admin-table');
  const thead = createEl('thead');
  const hr = createEl('tr');
  ['الرئيسية', 'المنتج', 'الصور الإضافية', 'تعديل'].forEach((h) => hr.appendChild(createEl('th', '', h)));
  thead.appendChild(hr);
  const tbody = createEl('tbody');

  products.forEach((p) => {
    const tr = createEl('tr');
    const tdImg = createEl('td');
    const tb = createEl('div', 'thumb-box');
    const im = document.createElement('img');
    im.alt = p.ar.name;
    bindPreviewImage(im, p.image);
    tb.appendChild(im);
    tdImg.appendChild(tb);

    const tdName = createEl('td', '', p.ar.name);
    const tdExtra = createEl('td', '', p.gallery.length ? `${p.gallery.length} صورة إضافية` : 'لا توجد صور إضافية');
    const tdAct = createEl('td');
    const editMediaBtn = createEl('button', 'btn btn-surface btn-sm', 'تعديل صور المنتج');
    editMediaBtn.type = 'button';
    editMediaBtn.addEventListener('click', () => {
      adminState.editingProductId = p.id;
      navigateToSection('product-form');
    });
    tdAct.appendChild(editMediaBtn);

    tr.append(tdImg, tdName, tdExtra, tdAct);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  perProductPanel.appendChild(tableWrap);

  container.replaceChildren(uploadPanel, galleryPanel, perProductPanel);
}

/* ==========================================================================
   5. إدارة روابط Amazon.sa والأسعار المؤكدة
   ========================================================================== */
function renderAmazonLinksSection(container) {
  const products = MirkabStore.getProducts({ includeDrafts: true });
  const panel = createEl('section', 'panel');

  const header = createEl('div', 'panel-header');
  const hWrap = createEl('div');
  hWrap.append(
    createEl('h3', 'panel-title', 'إدارة روابط Amazon.sa والأسعار'),
    createEl('p', 'panel-subtitle', 'أضف أو عدّل رابط Amazon.sa المباشر والسعر المؤكد بالريال السعودي لكل منتج؛ عند الحفظ ينتقل زر «شراء من Amazon» للرابط فوراً.')
  );
  header.appendChild(hWrap);

  const tableWrap = createEl('div', 'table-wrap');
  const table = createEl('table', 'admin-table');
  const thead = createEl('thead');
  const hr = createEl('tr');
  ['المنتج', 'السعر (ر.س)', 'رابط Amazon.sa (HTTPS)', 'إجراءات'].forEach((h) => hr.appendChild(createEl('th', '', h)));
  thead.appendChild(hr);

  const tbody = createEl('tbody');

  products.forEach((p) => {
    const tr = createEl('tr');
    const nameTd = createEl('td');
    nameTd.append(
      createEl('div', '', p.ar.name),
      createEl('div', 'field-hint', p.status === 'published' ? 'منشور' : 'مسودة')
    );

    const priceTd = createEl('td');
    const priceIn = createEl('input', 'field-input');
    priceIn.placeholder = 'مثال: 149 ر.س';
    priceIn.value = p.price !== undefined ? String(p.price) : '';
    priceTd.appendChild(priceIn);

    const urlTd = createEl('td');
    const urlIn = createEl('input', 'field-input');
    urlIn.type = 'url';
    urlIn.dir = 'ltr';
    urlIn.placeholder = 'https://www.amazon.sa/dp/...';
    urlIn.value = p.amazonUrl || '';
    urlTd.appendChild(urlIn);

    const actTd = createEl('td');
    const actWrap = createEl('div', 'row-actions');

    const saveRowBtn = createEl('button', 'btn btn-silver btn-sm', 'حفظ');
    saveRowBtn.type = 'button';
    saveRowBtn.addEventListener('click', () => {
      if (!requireAdminAuth()) return;
      try {
        MirkabStore.updateProductAmazonAndPrice(p.id, {
          amazonUrl: urlIn.value,
          price: priceIn.value.trim()
        });
        showToast(`تم حفظ رابط وسعر «${p.ar.name}».`);
      } catch {
        showToast('الرابط غير صالح؛ يجب إدخال رابط Amazon.sa يبدأ بـ https:// أو تركه فارغاً.');
      }
    });

    const clearRowBtn = createEl('button', 'btn btn-surface btn-sm', 'مسح الرابط');
    clearRowBtn.type = 'button';
    clearRowBtn.addEventListener('click', () => {
      if (!requireAdminAuth()) return;
      urlIn.value = '';
      MirkabStore.updateProductAmazonAndPrice(p.id, {
        amazonUrl: '',
        price: priceIn.value.trim()
      });
      showToast(`تمت إزالة رابط Amazon لـ «${p.ar.name}».`);
    });

    const openLink = createEl('a', 'btn btn-surface btn-sm', 'اختبار');
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    const syncOpenBtn = () => {
      const valid = sanitizeHttpsUrl(urlIn.value);
      if (valid) {
        openLink.href = valid;
        openLink.hidden = false;
      } else {
        openLink.removeAttribute('href');
        openLink.hidden = true;
      }
    };
    syncOpenBtn();
    urlIn.addEventListener('input', syncOpenBtn);

    actWrap.append(saveRowBtn, clearRowBtn, openLink);
    actTd.appendChild(actWrap);

    tr.append(nameTd, priceTd, urlTd, actTd);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  panel.append(header, tableWrap);
  container.replaceChildren(panel);
}

/* ==========================================================================
   6. حسابات التواصل الاجتماعي (Instagram, TikTok, Snapchat, X, WhatsApp)
   ========================================================================== */
function renderSocialSection(container) {
  const accounts = MirkabStore.getSocialAccounts({ includeInactive: true });
  const panel = createEl('section', 'panel');

  const header = createEl('div', 'panel-header');
  const hWrap = createEl('div');
  hWrap.append(
    createEl('h3', 'panel-title', 'إدارة حسابات التواصل الاجتماعي'),
    createEl('p', 'panel-subtitle', 'تظهر الحسابات المفعّلة ذات الروابط الصحيحة فقط في تذييل الموقع العام، وتُخفى الحسابات الفارغة أو المعطّلة تلقائياً.')
  );
  header.appendChild(hWrap);

  const form = createEl('form', 'social-card-list');
  form.noValidate = true;

  const placeholders = {
    instagram: 'https://www.instagram.com/your_account/',
    tiktok: 'https://www.tiktok.com/@your_account',
    snapchat: 'https://www.snapchat.com/add/your_account',
    x: 'https://x.com/your_account',
    whatsapp: 'https://wa.me/9665XXXXXXXX'
  };

  const rowsRef = [];

  accounts.forEach((acc) => {
    const card = createEl('div', 'social-row-card');
    const top = createEl('div', 'social-row-top');

    const titleWrap = createEl('div', 'row-actions');
    titleWrap.appendChild(createEl('strong', '', `${acc.label.ar} (${acc.label.en})`));

    const isVisible = acc.enabled && Boolean(acc.url);
    const statusBadge = createEl(
      'span',
      `badge ${isVisible ? 'is-published' : ''}`.trim(),
      isVisible ? 'ظاهر في التذييل' : (acc.url ? 'مخفي يدوياً' : 'فارغ — لن يظهر')
    );
    titleWrap.appendChild(statusBadge);

    const toggleLabel = createEl('label', 'toggle-label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = acc.enabled !== false;
    toggleLabel.append(checkbox, createEl('span', '', 'تفعيل الظهور في الموقع العام'));

    top.append(titleWrap, toggleLabel);

    const controlRow = createEl('div', 'toolbar-row');
    const urlInput = createEl('input', 'field-input');
    urlInput.type = 'url';
    urlInput.dir = 'ltr';
    urlInput.placeholder = placeholders[acc.id] || 'https://...';
    urlInput.value = acc.url || '';

    const clearBtn = createEl('button', 'btn btn-surface btn-sm', 'حذف الرابط');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', () => {
      urlInput.value = '';
      syncStatusBadge();
    });

    function syncStatusBadge() {
      const valid = Boolean(sanitizeHttpsUrl(urlInput.value));
      const active = checkbox.checked && valid;
      statusBadge.className = `badge ${active ? 'is-published' : ''}`.trim();
      statusBadge.textContent = active ? 'ظاهر في التذييل' : (valid ? 'مخفي يدوياً' : 'فارغ — لن يظهر');
    }

    urlInput.addEventListener('input', syncStatusBadge);
    checkbox.addEventListener('change', syncStatusBadge);

    controlRow.append(urlInput, clearBtn);
    card.append(top, controlRow);
    form.appendChild(card);

    rowsRef.push({ id: acc.id, urlInput, checkbox });
  });

  const errorEl = createEl('p', 'form-error');
  errorEl.hidden = true;

  const saveBtn = createEl('button', 'btn btn-primary', 'حفظ حسابات التواصل');
  saveBtn.type = 'submit';
  const actionsRow = createEl('div', 'toolbar-row');
  actionsRow.appendChild(saveBtn);

  form.append(errorEl, actionsRow);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!requireAdminAuth()) return;
    errorEl.hidden = true;
    errorEl.textContent = '';

    const updates = {};
    rowsRef.forEach((r) => {
      updates[r.id] = {
        url: r.urlInput.value.trim(),
        enabled: r.checkbox.checked
      };
    });

    try {
      MirkabStore.saveSocialAccounts(updates);
      showToast('تم حفظ حسابات التواصل الاجتماعي بنجاح.');
      renderSocialSection(container);
    } catch (err) {
      errorEl.textContent = 'تأكد من كتابة الروابط بصيغة HTTPS صحيحة (أو ترك الحقل فارغاً لإزالته).';
      errorEl.hidden = false;
    }
  });

  panel.append(header, form);
  container.replaceChildren(panel);
}

/* ==========================================================================
   7. إعدادات الموقع وتغيير رمز الدخول المحلي
   ========================================================================== */
function renderSettingsSection(container) {
  const cfg = MirkabStore.getSiteConfig();

  // اللوحة 1: إعدادات العلامة التجارية والموقع
  const brandPanel = createEl('section', 'panel');
  const brandHeader = createEl('div', 'panel-header');
  const bhWrap = createEl('div');
  bhWrap.append(
    createEl('h3', 'panel-title', 'إعدادات العلامة التجارية والنصوص العامة'),
    createEl('p', 'panel-subtitle', 'عدّل اسم العلامة التجارية والشعار النصي وبيانات SEO ونص الإفصاح.')
  );
  const resetCfgBtn = createEl('button', 'btn btn-surface btn-sm', 'استعادة الإعدادات الافتراضية');
  resetCfgBtn.type = 'button';
  resetCfgBtn.addEventListener('click', async () => {
    if (!requireAdminAuth()) return;
    const ok = await askConfirmation(
      'استعادة إعدادات الموقع الافتراضية',
      'هل تريد إعادة اسم العلامة التجارية ونصوص الموقع إلى القيم الافتراضية دون المساس بالمنتجات أو الصور؟'
    );
    if (!ok) return;
    MirkabStore.resetSiteConfigToDefault();
    showToast('تمت استعادة الإعدادات الافتراضية للموقع.');
    unlockAdminInterface();
  });
  brandHeader.append(bhWrap, resetCfgBtn);

  const form = createEl('form', 'form-grid');
  form.noValidate = true;

  const makeIn = (val, ltr = false) => {
    const input = createEl('input', 'field-input');
    input.value = val || '';
    if (ltr) input.dir = 'ltr';
    return input;
  };
  const makeTa = (val, ltr = false) => {
    const ta = createEl('textarea', 'field-textarea');
    ta.value = val || '';
    if (ltr) ta.dir = 'ltr';
    return ta;
  };
  const wrapField = (label, el, full = false) => {
    const d = createEl('div', `form-field ${full ? 'is-full' : ''}`.trim());
    d.append(createEl('label', 'field-label', label), el);
    return d;
  };

  const brandArIn = makeIn(cfg.brand.ar);
  const brandEnIn = makeIn(cfg.brand.en, true);
  const sepIn = makeIn(cfg.brand.separator, true);
  const yearIn = makeIn(cfg.brand.copyrightYear, true);
  const tagArIn = makeIn(cfg.brand.tagline.ar);
  const tagEnIn = makeIn(cfg.brand.tagline.en, true);
  const seoTitleArIn = makeIn(cfg.seo.ar.title);
  const seoTitleEnIn = makeIn(cfg.seo.en.title, true);
  const seoDescArIn = makeTa(cfg.seo.ar.description);
  const seoDescEnIn = makeTa(cfg.seo.en.description, true);
  const discArIn = makeTa(cfg.affiliate.disclosure.ar);
  const discEnIn = makeTa(cfg.affiliate.disclosure.en, true);

  const saveCfgBtn = createEl('button', 'btn btn-primary', 'حفظ إعدادات الموقع');
  saveCfgBtn.type = 'submit';
  const saveWrap = createEl('div', 'form-field is-full');
  saveWrap.appendChild(saveCfgBtn);

  form.append(
    wrapField('اسم العلامة التجارية (بالعربية)', brandArIn),
    wrapField('اسم العلامة التجارية (بالإنجليزية)', brandEnIn),
    wrapField('الفاصل بين الاسمين', sepIn),
    wrapField('سنة حقوق النشر', yearIn),
    wrapField('الشعار النصي للواجهة (بالعربية)', tagArIn),
    wrapField('الشعار النصي للواجهة (بالإنجليزية)', tagEnIn),
    wrapField('عنوان الصفحة SEO (بالعربية)', seoTitleArIn),
    wrapField('عنوان الصفحة SEO (بالإنجليزية)', seoTitleEnIn),
    wrapField('الوصف التعريفي SEO (بالعربية)', seoDescArIn),
    wrapField('الوصف التعريفي SEO (بالإنجليزية)', seoDescEnIn),
    wrapField('نص الإفصاح عن العمولة (بالعربية)', discArIn),
    wrapField('نص الإفصاح عن العمولة (بالإنجليزية)', discEnIn),
    saveWrap
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!requireAdminAuth()) return;
    MirkabStore.saveSiteConfig({
      brand: {
        ar: brandArIn.value.trim() || 'مِركاب',
        en: brandEnIn.value.trim() || 'MIRKAB',
        separator: sepIn.value.trim() || '|',
        copyrightYear: yearIn.value.trim() || '2026',
        tagline: {
          ar: tagArIn.value.trim(),
          en: tagEnIn.value.trim()
        }
      },
      seo: {
        ar: { title: seoTitleArIn.value.trim(), description: seoDescArIn.value.trim() },
        en: { title: seoTitleEnIn.value.trim(), description: seoDescEnIn.value.trim() }
      },
      affiliate: {
        disclosure: {
          ar: discArIn.value.trim(),
          en: discEnIn.value.trim()
        }
      }
    });

    const updatedBrandLabel = document.getElementById('sidebar-brand-name');
    if (updatedBrandLabel) {
      updatedBrandLabel.textContent = `${brandArIn.value.trim() || 'مِركاب'} ${sepIn.value.trim() || '|'} ${brandEnIn.value.trim() || 'MIRKAB'}`;
    }
    showToast('تم حفظ إعدادات الموقع بنجاح.');
  });

  brandPanel.append(brandHeader, form);

  // اللوحة 2: تحديث رمز الدخول المحلي للوحة الإدارة
  const secPanel = createEl('section', 'panel');
  secPanel.append(
    createEl('h3', 'panel-title', 'تغيير رمز الدخول المحلي'),
    createEl('p', 'panel-subtitle', 'تذكير: رمز الدخول يُحفظ مشفّراً محلياً في متصفحك فقط ولا يغني عن المصادقة الخادمية عند الاستضافة العامة.')
  );

  const secForm = createEl('form', 'form-grid');
  secForm.noValidate = true;

  const curPass = createEl('input', 'field-input');
  curPass.type = 'password';
  curPass.autocomplete = 'current-password';

  const newPass = createEl('input', 'field-input');
  newPass.type = 'password';
  newPass.autocomplete = 'new-password';
  newPass.minLength = 6;

  const confPass = createEl('input', 'field-input');
  confPass.type = 'password';
  confPass.autocomplete = 'new-password';
  confPass.minLength = 6;

  const secErr = createEl('p', 'form-error is-full');
  secErr.hidden = true;

  const changeBtn = createEl('button', 'btn btn-silver', 'تحديث رمز الدخول');
  changeBtn.type = 'submit';
  const changeWrap = createEl('div', 'form-field is-full');
  changeWrap.appendChild(changeBtn);

  secForm.append(
    wrapField('رمز الدخول الحالي', curPass),
    wrapField('رمز الدخول الجديد (6 أحرف فأكثر)', newPass),
    wrapField('تأكيد رمز الدخول الجديد', confPass, true),
    secErr,
    changeWrap
  );

  secForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAdminAuth()) return;
    secErr.hidden = true;
    secErr.textContent = '';
    try {
      await AdminAuth.changePassphrase(curPass.value, newPass.value, confPass.value);
      curPass.value = '';
      newPass.value = '';
      confPass.value = '';
      showToast('تم تحديث رمز الدخول المحلي بنجاح.');
    } catch (err) {
      const msgs = {
        CURRENT_PASSPHRASE_INVALID: 'رمز الدخول الحالي غير صحيح.',
        PASSPHRASE_TOO_SHORT: 'الرمز الجديد يجب أن يكون 6 أحرف على الأقل.',
        PASSPHRASE_MISMATCH: 'الرمز الجديد وتأكيده غير متطابقين.'
      };
      secErr.textContent = msgs[err?.message] || 'تعذر تحديث رمز الدخول.';
      secErr.hidden = false;
    }
  });

  secPanel.appendChild(secForm);
  container.replaceChildren(brandPanel, secPanel);
}

/* ==========================================================================
   8. النسخ الاحتياطي والاستعادة (JSON + IndexedDB Media)
   ========================================================================== */
async function renderBackupSection(container) {
  adminState.pendingBackupData = null;

  // تصدير نسخة احتياطية كاملة
  const exportPanel = createEl('section', 'panel');
  const expHeader = createEl('div', 'panel-header');
  const ehWrap = createEl('div');
  ehWrap.append(
    createEl('h3', 'panel-title', 'تصدير نسخة احتياطية كاملة'),
    createEl('p', 'panel-subtitle', 'يُنشئ ملف JSON يحتوي على جميع المنتجات والإعدادات وحسابات التواصل والصور المرفوعة في IndexedDB.')
  );
  expHeader.appendChild(ehWrap);

  const exportBtn = createEl('button', 'btn btn-primary', 'تنزيل النسخة الاحتياطية (.json)');
  exportBtn.type = 'button';
  exportBtn.addEventListener('click', async () => {
    if (!requireAdminAuth()) return;
    exportBtn.disabled = true;
    exportBtn.textContent = 'جاري تجهيز النسخة...';
    try {
      const mediaBackup = await MirkabMediaDB.exportAllImagesAsBackupMap();
      const snapshot = MirkabStore.exportCatalogSnapshot(mediaBackup);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `mirkab-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
      showToast('تم تنزيل النسخة الاحتياطية الكاملة.');
    } catch {
      showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'تنزيل النسخة الاحتياطية (.json)';
    }
  });

  exportPanel.append(expHeader, exportBtn);

  // استيراد نسخة احتياطية
  const importPanel = createEl('section', 'panel');
  importPanel.append(
    createEl('h3', 'panel-title', 'استيراد نسخة احتياطية'),
    createEl('p', 'panel-subtitle', 'اختر ملف .json مصدر مسبقاً لاستعادة المنتجات والإعدادات والصور المحفوظة داخله.')
  );

  const fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = '.json,application/json';
  fileIn.className = 'field-input';

  const summaryEl = createEl('p', 'panel-subtitle');
  summaryEl.hidden = true;

  const applyImportBtn = createEl('button', 'btn btn-silver', 'استعادة البيانات من الملف');
  applyImportBtn.type = 'button';
  applyImportBtn.disabled = true;

  fileIn.addEventListener('change', async () => {
    adminState.pendingBackupData = null;
    applyImportBtn.disabled = true;
    summaryEl.hidden = true;

    const file = fileIn.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.products)) {
        throw new Error('INVALID_FORMAT');
      }
      adminState.pendingBackupData = parsed;
      const imgsCount = Array.isArray(parsed.mediaAssets) ? parsed.mediaAssets.length : 0;
      summaryEl.textContent = `ملف صالح: يحتوي على ${parsed.products.length} منتج و ${imgsCount} صورة مرفوعة.`;
      summaryEl.hidden = false;
      applyImportBtn.disabled = false;
    } catch {
      summaryEl.textContent = 'ملف النسخة الاحتياطية غير صالح أو تالف.';
      summaryEl.hidden = false;
    }
  });

  applyImportBtn.addEventListener('click', async () => {
    if (!requireAdminAuth() || !adminState.pendingBackupData) return;
    const ok = await askConfirmation(
      'تأكيد استيراد النسخة الاحتياطية',
      'سيتم تحديث قائمة المنتجات وإعدادات الموقع واستعادة الصور الموجودة في ملف النسخة الاحتياطية.'
    );
    if (!ok) return;

    try {
      const backup = adminState.pendingBackupData;
      if (Array.isArray(backup.mediaAssets)) {
        for (const asset of backup.mediaAssets) {
          if (asset && asset.dataUrl) {
            await MirkabMediaDB.saveDataUrl(asset.dataUrl, {
              id: asset.id || asset.ref,
              productId: asset.productId,
              role: asset.role,
              name: asset.name,
              mimeType: asset.mimeType,
              width: asset.width,
              height: asset.height,
              createdAt: asset.createdAt
            });
          }
        }
      }
      const res = MirkabStore.importCatalogSnapshot(backup);
      showToast(`تمت استعادة ${res.productsCount} منتج وملفات الصور بنجاح.`);
      adminState.pendingBackupData = null;
      fileIn.value = '';
      applyImportBtn.disabled = true;
      await renderBackupSection(container);
    } catch {
      showToast('تعذر استيراد النسخة الاحتياطية.');
    }
  });

  importPanel.append(fileIn, summaryEl, applyImportBtn);

  // استعادة المنتجات الـ 11 الافتراضية المفقودة دون حذف المنتجات الجديدة
  const seedPanel = createEl('section', 'panel');
  seedPanel.append(
    createEl('h3', 'panel-title', 'استعادة المنتجات الأساسية الـ 11'),
    createEl('p', 'panel-subtitle', 'تعيد أي منتج تم حذفه من الكتالوج الأساسي دون التأثير على المنتجات الجديدة أو التعديلات القائمة.')
  );
  const restoreSeedsBtn = createEl('button', 'btn btn-surface', 'استعادة المنتجات الافتراضية المفقودة');
  restoreSeedsBtn.type = 'button';
  restoreSeedsBtn.addEventListener('click', () => {
    if (!requireAdminAuth()) return;
    const result = MirkabStore.restoreMissingDefaultProducts();
    if (result.added > 0) {
      showToast(`تمت استعادة ${result.added} منتج من القائمة الأساسية.`);
    } else {
      showToast('جميع المنتجات الـ 11 الأساسية موجودة بالفعل.');
    }
  });
  seedPanel.appendChild(restoreSeedsBtn);

  container.replaceChildren(exportPanel, importPanel, seedPanel);
}

/* ==========================================================================
   تهيئة الأحداث وتشغيل لوحة التحكم
   ========================================================================== */
function setupAdminShellEvents() {
  document.querySelectorAll('#admin-nav .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-section');
      if (target) navigateToSection(target, { resetForm: target === 'product-form' });
    });
  });

  const quickAddBtn = document.getElementById('topbar-quick-add-btn');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => navigateToSection('product-form', { resetForm: true }));
  }

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      AdminAuth.signOut();
      lockAdminInterface();
      showToast('تم تسجيل الخروج وإغلاق الجلسة الإدارية.');
    });
  }

  const sidebar = document.getElementById('admin-sidebar');
  const openBtn = document.getElementById('sidebar-open-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  if (openBtn && sidebar) openBtn.addEventListener('click', () => sidebar.classList.add('is-open'));
  if (closeBtn && sidebar) closeBtn.addEventListener('click', () => sidebar.classList.remove('is-open'));
}

function initAdminConsole() {
  setupAuthForm();
  setupAdminShellEvents();

  if (AdminAuth.isAuthenticated()) {
    unlockAdminInterface();
  } else {
    lockAdminInterface();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminConsole);
} else {
  initAdminConsole();
}
