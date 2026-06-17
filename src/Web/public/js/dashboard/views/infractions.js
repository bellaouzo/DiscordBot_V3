import { state } from "../core/state.js";
import { fetchApi } from "../core/api.js";
import { viewUserProfile } from "./lookup.js";

export async function loadInfractions() {
  const container = document.getElementById('infractions-container');
  container.innerHTML = '<p>Loading infractions...</p>';
  try {
    const endpoint = state.isAdminMode ? `/api/admin/infractions/${state.selectedGuildId}` : `/api/infractions/${state.selectedGuildId}`;
    const data = await fetchApi(endpoint);
    
    if (state.isAdminMode) {
      state.loadedInfractions = [
        ...data.events.map(i => ({...i, type: i.action})),
        ...data.tempActions.map(i => ({...i, type: i.action}))
      ];
    } else {
      state.loadedInfractions = [
        ...data.kicks.map(i => ({...i, type: 'Kick'})),
        ...data.bans.map(i => ({...i, type: 'Ban'})),
        ...data.mutes.map(i => ({...i, type: 'Mute', created_at: i.created_at || i.expires_at}))
      ];
    }
    
    state.loadedInfractions.sort((a, b) => b.created_at - a.created_at);
    state.infractionPage = 1;
    renderInfractions();
  } catch (e) {
    container.innerHTML = '<p class="error-text">Failed to load infractions.</p>';
  }
}

export function renderInfractions() {
  const container = document.getElementById('infractions-container');
  if (state.loadedInfractions.length === 0) {
    container.innerHTML = state.isAdminMode ? '<p>No infractions recorded.</p>' : '<p>Clean record! No infractions found.</p>';
    return;
  }

  // Filter
  const filtered = state.loadedInfractions.filter(i => {
    if (state.infractionFilter === 'all') return true;
    return i.type.toLowerCase() === state.infractionFilter;
  });

  // Calculate pages
  const totalPages = Math.ceil(filtered.length / state.INFRACTION_PAGE_SIZE) || 1;
  if (state.infractionPage > totalPages) state.infractionPage = totalPages;

  // Slice
  const start = (state.infractionPage - 1) * state.INFRACTION_PAGE_SIZE;
  const pageInfractions = filtered.slice(start, start + state.INFRACTION_PAGE_SIZE);

  // Render filters
  let html = `
    <div class="list-filters">
      <button class="filter-tab ${state.infractionFilter === 'all' ? 'active' : ''}" onclick="setInfractionFilter('all')">All</button>
      <button class="filter-tab ${state.infractionFilter === 'kick' ? 'active' : ''}" onclick="setInfractionFilter('kick')">Kicks</button>
      <button class="filter-tab ${state.infractionFilter === 'ban' ? 'active' : ''}" onclick="setInfractionFilter('ban')">Bans</button>
      <button class="filter-tab ${state.infractionFilter === 'mute' ? 'active' : ''}" onclick="setInfractionFilter('mute')">Mutes</button>
    </div>
  `;

  if (filtered.length === 0) {
    html += '<p class="text-muted">No infractions match this filter.</p>';
    container.innerHTML = html;
    return;
  }

  // Render cards
  html += `<div class="data-list">
    ${pageInfractions.map(i => `
      <div class="data-card">
        <div class="data-header">
          <span class="data-title type-${i.type.toLowerCase()}">${i.type.toUpperCase()}</span>
          <span class="data-meta">${new Date(i.created_at).toLocaleDateString()}</span>
        </div>
        ${state.isAdminMode ? `<p class="data-meta mb-1">User: <span class="user-id-badge clickable-badge" onclick="viewUserProfile('${i.user_id}')" title="Lookup User">${i.user_id}</span> | Mod: <span class="user-id-badge">${i.moderator_id}</span></p>` : ''}
        <p class="data-desc"><strong>Reason:</strong> ${escapeHtml(i.reason || 'No reason provided')}</p>
      </div>
    `).join('')}
  </div>`;

  // Render pagination
  if (totalPages > 1) {
    html += `
      <div class="pagination-controls">
        <button class="btn btn-secondary btn-sm" onclick="changeInfractionPage(-1)" ${state.infractionPage === 1 ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>Prev</button>
        <span class="pagination-info">Page ${state.infractionPage} of ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeInfractionPage(1)" ${state.infractionPage === totalPages ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>Next</button>
      </div>
    `;
  }

  container.innerHTML = html;
}

export function setInfractionFilter(filter) {
  state.infractionFilter = filter;
  state.infractionPage = 1;
  renderInfractions();
}

export function changeInfractionPage(direction) {
  state.infractionPage += direction;
  renderInfractions();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
