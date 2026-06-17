import { state } from "../core/state.js";
import { fetchApi } from "../core/api.js";

export async function loadTickets() {
  const container = document.getElementById('tickets-container');
  container.innerHTML = '<p>Loading tickets...</p>';
  try {
    const endpoint = state.isAdminMode ? `/api/admin/tickets/${state.selectedGuildId}` : `/api/tickets/${state.selectedGuildId}`;
    state.loadedTickets = await fetchApi(endpoint);
    state.ticketPage = 1;
    renderTickets();
  } catch (e) {
    container.innerHTML = '<p class="error-text">Failed to load tickets.</p>';
  }
}

export function renderTickets() {
  const container = document.getElementById('tickets-container');
  if (state.loadedTickets.length === 0) {
    container.innerHTML = '<p>No tickets found.</p>';
    return;
  }

  // Filter
  const filtered = state.loadedTickets.filter(t => {
    if (state.ticketFilter === 'all') return true;
    return t.status === state.ticketFilter;
  });

  // Calculate pages
  const totalPages = Math.ceil(filtered.length / state.TICKET_PAGE_SIZE) || 1;
  if (state.ticketPage > totalPages) state.ticketPage = totalPages;

  // Slice
  const start = (state.ticketPage - 1) * state.TICKET_PAGE_SIZE;
  const pageTickets = filtered.slice(start, start + state.TICKET_PAGE_SIZE);

  // Render filters
  let html = `
    <div class="list-filters">
      <button class="filter-tab ${state.ticketFilter === 'all' ? 'active' : ''}" onclick="setTicketFilter('all')">All</button>
      <button class="filter-tab ${state.ticketFilter === 'open' ? 'active' : ''}" onclick="setTicketFilter('open')">Open</button>
      <button class="filter-tab ${state.ticketFilter === 'closed' ? 'active' : ''}" onclick="setTicketFilter('closed')">Closed</button>
    </div>
  `;

  if (filtered.length === 0) {
    html += '<p class="text-muted">No tickets match this filter.</p>';
    container.innerHTML = html;
    return;
  }

  // Render cards
  html += `<div class="data-list">
    ${pageTickets.map(t => `
      <div class="data-card clickable" onclick="openTicketViewer(${t.id})">
        <div class="data-header">
          <span class="data-title">Ticket #${t.id} - ${t.category}</span>
          <span class="status-badge ${t.status}">${t.status.toUpperCase()}</span>
        </div>
        <p class="data-meta">Created: ${new Date(t.created_at).toLocaleDateString()} ${state.isAdminMode ? `by <span class="user-id-badge">${t.user_id}</span>` : ''}</p>
      </div>
    `).join('')}
  </div>`;

  // Render pagination
  if (totalPages > 1) {
    html += `
      <div class="pagination-controls">
        <button class="btn btn-secondary btn-sm" onclick="changeTicketPage(-1)" ${state.ticketPage === 1 ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>Prev</button>
        <span class="pagination-info">Page ${state.ticketPage} of ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeTicketPage(1)" ${state.ticketPage === totalPages ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>Next</button>
      </div>
    `;
  }

  container.innerHTML = html;
}

export function setTicketFilter(filter) {
  state.ticketFilter = filter;
  state.ticketPage = 1;
  renderTickets();
}

export function changeTicketPage(direction) {
  state.ticketPage += direction;
  renderTickets();
}

export async function openTicketViewer(ticketId) {
  state.currentViewingTicketId = ticketId;
  document.getElementById('ticket-slide-panel').classList.add('open');
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('ticket-panel-title').textContent = `Ticket #${ticketId}`;
  document.getElementById('ticket-panel-subtitle').textContent = 'Loading...';
  document.getElementById('ticket-panel-messages').innerHTML = '<div class="loader"></div>';
  document.getElementById('ticket-panel-close-btn').style.display = 'none';

  try {
    const data = await fetchApi(`/api/tickets/${state.selectedGuildId}/${ticketId}`);
    const t = data.ticket;
    const msgs = data.messages;
    
    document.getElementById('ticket-panel-title').textContent = `Ticket #${t.id} - ${t.category}`;
    document.getElementById('ticket-panel-subtitle').innerHTML = `Created by <span class="user-id-badge">${t.creator_username ? `${t.creator_username} (${t.user_id})` : t.user_id}</span> | Status: <span class="status-badge ${t.status}">${t.status.toUpperCase()}</span>`;
    
    if (state.isAdminMode && t.status === 'open') {
      document.getElementById('ticket-panel-close-btn').style.display = 'inline-block';
    }

    let bodyHtml = '';

    // Closed Banner detail
    if (t.status === 'closed') {
      const closedDate = t.closed_at ? new Date(t.closed_at).toLocaleString() : 'Unknown';
      const closerName = t.closed_by_username ? `${t.closed_by_username} (${t.claimed_by})` : (t.claimed_by || 'Unknown');
      bodyHtml += `
        <div class="close-info-banner">
          This ticket was closed by <strong>${closerName}</strong> on <strong>${closedDate}</strong>.
          ${t.close_reason ? `<div class="mt-2"><strong>Reason:</strong> <em>${t.close_reason}</em></div>` : ''}
        </div>
      `;
    }

    if (msgs.length === 0) {
      bodyHtml += '<p class="text-muted text-center" style="margin-top: 2rem;">No messages logged yet.</p>';
      document.getElementById('ticket-panel-messages').innerHTML = bodyHtml;
      return;
    }

    bodyHtml += msgs.map(m => `
      <div class="chat-message ${m.user_id === state.currentUser?.id ? 'self' : ''}">
        <div class="chat-header">
          <span class="chat-author">${m.username ? `${m.username} (${m.user_id})` : m.user_id}</span>
          <span class="chat-time">${new Date(m.timestamp).toLocaleString()}</span>
        </div>
        <div class="chat-bubble">${m.content}</div>
      </div>
    `).join('');

    document.getElementById('ticket-panel-messages').innerHTML = bodyHtml;

    // scroll to bottom
    const pBody = document.getElementById('ticket-panel-messages');
    pBody.scrollTop = pBody.scrollHeight;
  } catch (e) {
    document.getElementById('ticket-panel-messages').innerHTML = '<p class="error-text">Failed to load ticket details. You may lack permission.</p>';
  }
}

export function closeTicketViewer() {
  document.getElementById('ticket-slide-panel').classList.remove('open');
  document.getElementById('panel-overlay').classList.remove('open');
  state.currentViewingTicketId = null;
}

export async function closeCurrentTicket() {
  if (!state.currentViewingTicketId) return;
  
  const reason = prompt('Please enter a reason for closing this ticket (optional):');
  if (reason === null) return; // cancelled

  try {
    await fetchApi(`/api/admin/tickets/${state.selectedGuildId}/close/${state.currentViewingTicketId}`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: reason.trim() || null })
    });
    closeTicketViewer();
    await loadTickets();
  } catch (err) {
    alert("Failed to close ticket.");
  }
}
