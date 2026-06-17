import { state } from './state.js';
import { loadTickets } from '../views/tickets.js';
import { loadInfractions } from '../views/infractions.js';
import { loadUsers } from '../views/lookup.js';
import { loadSettings } from '../views/settings/index.js';

export function updateTitles() {
  const ticketsTitle = document.getElementById('tickets-title');
  const ticketsDesc = document.getElementById('tickets-desc');
  if (ticketsTitle) ticketsTitle.textContent = state.isAdminMode ? 'Server Tickets' : 'My Tickets';
  if (ticketsDesc) ticketsDesc.textContent = state.isAdminMode
    ? 'View and manage all tickets in this server.'
    : 'View your active and closed tickets for this server.';

  const infractionsTitle = document.getElementById('infractions-title');
  const infractionsDesc = document.getElementById('infractions-desc');
  if (infractionsTitle) infractionsTitle.textContent = state.isAdminMode ? 'Server Infractions' : 'My Infractions';
  if (infractionsDesc) infractionsDesc.textContent = state.isAdminMode
    ? 'View recent infractions given in this server.'
    : 'View your kicks, bans, and mutes for this server.';
}

export async function refreshCurrentView() {
  const activeView = document.querySelector('.nav-btn.active')?.getAttribute('data-view');
  if (!state.selectedGuildId && activeView !== 'overview') {
    const container = document.getElementById(`${activeView}-container`);
    if (container) {
      container.innerHTML = '<p class="error-text">Please select a server first.</p>';
    }
    return;
  }

  if (activeView === 'tickets')     await loadTickets();
  if (activeView === 'infractions') await loadInfractions();
  if (activeView === 'lookup')      await loadUsers('');
  if (activeView === 'settings')    await loadSettings();
}

export function initRouter() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');

      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
      const targetView = e.currentTarget.getAttribute('data-view');
      document.getElementById(`view-${targetView}`)?.classList.add('active');

      refreshCurrentView();
    });
  });
}
