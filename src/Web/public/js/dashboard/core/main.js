/**
 * main.js — Dashboard entry point.
 * Wires up topbar, router, and state, and binds event handlers.
 */

import { state } from './state.js';
import { fetchApi } from './api.js';
import { initTopbar, renderServerDropdown } from './topbar.js';
import { initRouter } from './router.js';

import {
  openTicketViewer,
  closeTicketViewer,
  closeCurrentTicket,
  changeTicketPage,
  setTicketFilter,
} from '../views/tickets.js';

import {
  setInfractionFilter,
  changeInfractionPage,
} from '../views/infractions.js';

import {
  loadUsers,
  viewUserProfile,
  changeProfileTicketsPage,
  closeUserProfile,
  switchProfileTab,
} from '../views/lookup.js';

import {
  switchSettingsTab,
  saveSettings,
  undoSettingsChanges,
} from '../views/settings/index.js';

/* ── Load Dashboard (user + guild list) ───────────────────── */
async function loadDashboard() {
  try {
    state.currentUser = await fetchApi('/api/@me');
    const avatarUrl = state.currentUser.avatar
      ? `https://cdn.discordapp.com/avatars/${state.currentUser.id}/${state.currentUser.avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const topbarAvatar = document.getElementById('topbar-avatar');
    const topbarUsername = document.getElementById('topbar-username');
    const overviewAvatar = document.getElementById('overview-avatar');
    const overviewName = document.getElementById('overview-name');

    if (topbarAvatar) topbarAvatar.src = avatarUrl;
    if (topbarUsername) topbarUsername.textContent = state.currentUser.username;
    if (overviewAvatar) overviewAvatar.src = avatarUrl;
    if (overviewName) overviewName.textContent = `Welcome, ${state.currentUser.username}!`;

    state.mutualGuilds = await fetchApi('/api/guilds');
    renderServerDropdown();
  } catch (e) {
    console.error(e);
  }
}

/* ── User Lookup Search ───────────────────────────────────── */
document.getElementById('user-search-btn')?.addEventListener('click', () => {
  const q = document.getElementById('user-search-input').value;
  loadUsers(q);
});

document.getElementById('user-search-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loadUsers(e.target.value);
});

/* ── Save Settings trigger ────────────────────────────────── */
function triggerSaveSettings() {
  document.getElementById('settings-form')?.requestSubmit();
}

/* ── Bind to window for inline HTML event handlers ─────────── */
window.switchProfileTab     = switchProfileTab;
window.closeUserProfile     = closeUserProfile;
window.viewUserProfile      = viewUserProfile;
window.changeProfileTicketsPage = changeProfileTicketsPage;
window.openTicketViewer     = openTicketViewer;
window.closeTicketViewer    = closeTicketViewer;
window.closeCurrentTicket   = closeCurrentTicket;
window.changeTicketPage     = changeTicketPage;
window.setTicketFilter      = setTicketFilter;
window.changeInfractionPage = changeInfractionPage;
window.setInfractionFilter  = setInfractionFilter;
window.switchSettingsTab    = switchSettingsTab;
window.saveSettings         = saveSettings;
window.undoSettingsChanges  = undoSettingsChanges;
window.triggerSaveSettings  = triggerSaveSettings;

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTopbar();
  initRouter();
  loadDashboard();
});
