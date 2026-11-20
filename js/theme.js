/**
 * مِركاب | MIRKAB — Shared Dark / Light Theme Controller
 * --------------------------------------------------------------------------
 * - الأولوية لاختيار المستخدم المحفوظ في localStorage ('mirkab_theme')
 * - عند أول زيارة (عدم وجود قيمة محفوظة)، يعتمد إعدادات الجهاز الافتراضية
 * - يحافظ على عدم تغيير أي أبعاد أو عناصر أو تأثيرات ثلاثية الأبعاد
 */

const THEME_STORAGE_KEY = 'mirkab_theme';

export function getSystemPreferredTheme() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function getSavedTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // تجاهل أي تقييد على localStorage في وضع التصفح الخاص
  }
  return null;
}

export function resolveInitialTheme() {
  return getSavedTheme() || getSystemPreferredTheme();
}

export function applyTheme(theme, { persist = false } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', next === 'light' ? '#f4f5f7' : '#050505');
  }

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // تجاهل
    }
  }

  syncAllThemeButtons(next);
  return next;
}

function createSunOrMoonIcon(targetModeToSwitchTo) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  if (targetModeToSwitchTo === 'light') {
    // أيقونة الشمس (للانتقال من الليلي إلى النهاري)
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '4');
    svg.appendChild(circle);

    [
      'M12 2v2',
      'M12 20v2',
      'm4.93 4.93 1.41 1.41',
      'm17.66 17.66 1.41 1.41',
      'M2 12h2',
      'M20 12h2',
      'm6.34 17.66-1.41 1.41',
      'm19.07 4.93-1.41 1.41'
    ].forEach((d) => {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
  } else {
    // أيقونة القمر (للانتقال من النهاري إلى الليلي)
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z');
    svg.appendChild(p);
  }

  return svg;
}

export function syncAllThemeButtons(currentTheme) {
  const activeTheme = currentTheme || document.documentElement.getAttribute('data-theme') || 'dark';
  const isLight = activeTheme === 'light';
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';

  const label = isLight
    ? lang === 'en'
      ? 'Switch to Dark Mode'
      : 'التبديل إلى الوضع الليلي'
    : lang === 'en'
      ? 'Switch to Light Mode'
      : 'التبديل إلى الوضع النهاري';

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('aria-pressed', String(isLight));
    btn.dataset.currentTheme = activeTheme;
    const iconSlot = btn.querySelector('.theme-icon-slot') || btn;
    iconSlot.replaceChildren(createSunOrMoonIcon(isLight ? 'dark' : 'light'));
  });
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  return applyTheme(current === 'light' ? 'dark' : 'light', { persist: true });
}

export function initThemeSystem() {
  const initial = resolveInitialTheme();
  applyTheme(initial, { persist: false });

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    if (btn.dataset.themeBound === '1') return;
    btn.dataset.themeBound = '1';
    btn.addEventListener('click', () => {
      toggleTheme();
    });
  });

  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onSystemChange = (e) => {
      if (!getSavedTheme()) {
        applyTheme(e.matches ? 'light' : 'dark', { persist: false });
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onSystemChange);
    }
  }
}
