/**
 * sidebar.js — Collapsible sidebar (desktop) and slide-in drawer (mobile).
 * Collapsed state is remembered per browser; the `[` key toggles it.
 */

const STORAGE_KEY = 'botv3-sidebar-collapsed';

let shell;
let collapseBtn;

function setCollapsed(collapsed) {
  shell.classList.toggle('is-collapsed', collapsed);
  collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  collapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // storage blocked: state just won't persist
  }
}

function closeDrawer() {
  shell.classList.remove('is-open');
}

export function initSidebar() {
  shell       = document.getElementById('shell');
  collapseBtn = document.getElementById('collapse-btn');
  if (!shell || !collapseBtn) return;

  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
  } catch {
    // ignore
  }

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!shell.classList.contains('is-collapsed'));
  });

  document.getElementById('menu-btn')?.addEventListener('click', () => shell.classList.add('is-open'));
  document.getElementById('scrim')?.addEventListener('click', closeDrawer);

  // Picking a page on mobile should close the drawer
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', closeDrawer));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === '[' && !e.target.closest('input, textarea, select')) {
      setCollapsed(!shell.classList.contains('is-collapsed'));
    }
  });
}
