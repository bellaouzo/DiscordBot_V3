import { state } from './state.js';
import { updateTitles, refreshCurrentView } from './router.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── DOM Refs ─────────────────────────────────────────────── */
let chipServerName;
let chipServerAvatar;
let chipPlaceholderIcon;
let serverDropdown;
let serverPickerChip;
let adminModeBtn;
let adminModeLabel;
let navLookup;
let navSettings;

export function initTopbar() {
  chipServerName      = document.getElementById('chip-server-name');
  chipServerAvatar    = document.getElementById('chip-server-avatar');
  chipPlaceholderIcon = document.getElementById('chip-placeholder-icon');
  serverDropdown      = document.getElementById('server-dropdown');
  serverPickerChip    = document.getElementById('server-picker-chip');
  adminModeBtn        = document.getElementById('admin-mode-btn');
  adminModeLabel      = document.getElementById('admin-mode-label');
  navLookup           = document.getElementById('nav-lookup');
  navSettings         = document.getElementById('nav-settings');

  if (serverPickerChip) {
    serverPickerChip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (serverDropdown.classList.contains('open')) {
        closeServerDropdown();
      } else {
        openServerDropdown();
      }
    });
  }

  document.addEventListener('click', () => closeServerDropdown());
  if (serverDropdown) {
    serverDropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  if (adminModeBtn) {
    adminModeBtn.addEventListener('click', () => {
      state.isAdminMode = !state.isAdminMode;
      applyAdminModeState();
      updateTitles();
      refreshCurrentView();
    });
  }
}

export function openServerDropdown() {
  if (serverDropdown) serverDropdown.classList.add('open');
  if (serverPickerChip) serverPickerChip.classList.add('open');
}

export function closeServerDropdown() {
  if (serverDropdown) serverDropdown.classList.remove('open');
  if (serverPickerChip) serverPickerChip.classList.remove('open');
}

export function applyAdminModeState() {
  if (!adminModeBtn) return;

  if (state.isAdminMode) {
    adminModeBtn.classList.add('active');
    adminModeBtn.title = 'Exit Admin Mode';
    if (adminModeLabel) adminModeLabel.textContent = 'Exit Admin';
    navLookup?.removeAttribute('style');
    navSettings?.removeAttribute('style');
  } else {
    adminModeBtn.classList.remove('active');
    adminModeBtn.title = 'Enter Admin Mode';
    if (adminModeLabel) adminModeLabel.textContent = 'Admin Mode';
    if (navLookup) navLookup.style.display = 'none';
    if (navSettings) navSettings.style.display = 'none';

    // If currently on an admin-only view, go to overview
    const activeView = document.querySelector('.nav-btn.active')?.getAttribute('data-view');
    if (activeView === 'lookup' || activeView === 'settings') {
      document.querySelector('.nav-btn[data-view="overview"]')?.click();
    }
  }
}

export function renderServerDropdown() {
  if (!serverDropdown) return;

  if (!state.mutualGuilds || state.mutualGuilds.length === 0) {
    serverDropdown.innerHTML = '<div class="server-dropdown-empty">No mutual servers found.</div>';
    if (chipServerName) chipServerName.textContent = 'No mutual servers';
    return;
  }

  serverDropdown.innerHTML = state.mutualGuilds
    .map(g => {
      const iconHtml = g.icon
        ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" alt="${escapeHtml(g.name)}" />`
        : `<span>${escapeHtml(g.name.charAt(0))}</span>`;
      return `
        <div class="server-dropdown-item" data-guild-id="${g.id}">
          <div class="server-icon">${iconHtml}</div>
          <span>${escapeHtml(g.name)}</span>
        </div>`;
    })
    .join('');

  serverDropdown.querySelectorAll('.server-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const guildId = item.getAttribute('data-guild-id');
      // Mark active
      serverDropdown.querySelectorAll('.server-dropdown-item')
        .forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      state.selectedGuildId = guildId;
      const guild = state.mutualGuilds.find(g => g.id === guildId);
      if (chipServerName) chipServerName.textContent = guild ? guild.name : guildId;

      // Update chip avatar
      if (guild?.icon && chipServerAvatar) {
        chipServerAvatar.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
        chipServerAvatar.alt = guild.name;
        chipServerAvatar.classList.add('visible');
        chipPlaceholderIcon?.classList.add('hidden');
      } else if (chipServerAvatar) {
        chipServerAvatar.classList.remove('visible');
        chipPlaceholderIcon?.classList.remove('hidden');
      }

      closeServerDropdown();
      onGuildSelected();
    });
  });
}

function onGuildSelected() {
  const guild = state.mutualGuilds.find(g => g.id === state.selectedGuildId);

  if (adminModeBtn) {
    if (guild?.isAdmin) {
      adminModeBtn.style.display = 'inline-flex';
    } else {
      adminModeBtn.style.display = 'none';
      // Force out of admin mode if user lacks permissions
      if (state.isAdminMode) {
        state.isAdminMode = false;
        applyAdminModeState();
      }
    }
  }

  updateTitles();
  refreshCurrentView();
}
