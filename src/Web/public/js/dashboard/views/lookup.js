import { state } from "../core/state.js";
import { fetchApi } from "../core/api.js";
import { openTicketViewer } from "./tickets.js";

export async function loadUsers(query) {
  document.getElementById('lookup-profile-panel').style.display = 'none';
  const container = document.getElementById('lookup-list-container');
  container.style.display = 'block';
  container.innerHTML = '<div class="loader"></div> Loading members...';
  
  try {
    const users = await fetchApi(`/api/admin/users/${state.selectedGuildId}?q=${encodeURIComponent(query)}`);
    if (users.length === 0) {
      container.innerHTML = '<p class="text-muted">No members found matching your search.</p>';
      return;
    }
    
    container.innerHTML = `<div class="user-grid">
      ${users.map(u => `
        <div class="user-card clickable" onclick="viewUserProfile('${u.id}')">
          <img src="${u.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" class="user-card-avatar" />
          <div class="user-card-info">
            <strong>${escapeHtml(u.username)}</strong>
            <span class="user-id-badge mt-1" style="display:inline-block">${u.id}</span>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (e) {
    container.innerHTML = '<p class="error-text">Failed to search members.</p>';
  }
}

export async function viewUserProfile(userId) {
  // If we clicked from infractions tab, swap to lookup tab
  if (document.querySelector('.nav-btn.active').getAttribute('data-view') !== 'lookup') {
    document.querySelector('.nav-btn[data-view="lookup"]').click();
  }
  
  document.getElementById('lookup-list-container').style.display = 'none';
  const panel = document.getElementById('lookup-profile-panel');
  panel.style.display = 'block';
  
  document.getElementById('profile-username').textContent = 'Loading Profile...';
  document.getElementById('profile-id').textContent = userId;
  document.getElementById('profile-avatar').src = 'https://cdn.discordapp.com/embed/avatars/0.png';
  document.getElementById('profile-meta-strip').innerHTML = '';
  document.getElementById('profile-roles-container').innerHTML = '';
  
  document.getElementById('profile-warnings').innerHTML = '<div class="loader-sm"></div>';
  document.getElementById('profile-infractions').innerHTML = '<div class="loader-sm"></div>';
  document.getElementById('profile-tickets').innerHTML = '<div class="loader-sm"></div>';
  
  // Reset tabs to warnings by default
  switchProfileTab('warnings');

  try {
    const data = await fetchApi(`/api/admin/user/${state.selectedGuildId}/${userId}`);
    
    if (data.profile) {
      document.getElementById('profile-username').textContent = data.profile.username;
      if (data.profile.avatarUrl) {
        document.getElementById('profile-avatar').src = data.profile.avatarUrl;
      }
    } else {
      document.getElementById('profile-username').textContent = 'Unknown User (Not Cached)';
    }

    // Populate metadata strip
    let metaStripHtml = '';
    if (data.member) {
      const joinedStr = data.member.joinedAt 
        ? new Date(data.member.joinedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
        : 'Not in Server';
      const createdStr = data.member.createdAt
        ? new Date(data.member.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
        : 'Unknown';
      
      metaStripHtml = `
        <div class="meta-item">
          <span class="meta-label">Nickname</span>
          <span class="meta-value">${escapeHtml(data.member.nickname || 'None')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Joined Server</span>
          <span class="meta-value">${joinedStr}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Account Created</span>
          <span class="meta-value">${createdStr}</span>
        </div>
      `;
    } else {
      metaStripHtml = `
        <div class="meta-item">
          <span class="meta-label">Status</span>
          <span class="meta-value text-danger">Not a server member</span>
        </div>
      `;
    }
    document.getElementById('profile-meta-strip').innerHTML = metaStripHtml;

    // Populate role list tags
    let rolesHtml = '';
    if (data.member && data.member.roles && data.member.roles.length > 0) {
      rolesHtml = data.member.roles.map(r => {
        const color = r.color === '#000000' ? 'rgba(255,255,255,0.2)' : r.color;
        return `<span class="profile-role-badge" style="border: 1px solid ${color}; color: ${color}; background-color: ${color}15;">${escapeHtml(r.name)}</span>`;
      }).join('');
    } else {
      rolesHtml = '<span class="text-muted" style="font-size: 0.85rem;">No roles assigned</span>';
    }
    document.getElementById('profile-roles-container').innerHTML = rolesHtml;
    
    // Warnings Tab
    const warningsList = data.infractions.warnings || [];
    if (warningsList.length === 0) {
      document.getElementById('profile-warnings').innerHTML = '<p class="text-muted text-center" style="padding: 2rem 0;">No warnings recorded for this user.</p>';
    } else {
      document.getElementById('profile-warnings').innerHTML = warningsList.map(w => `
        <div class="sm-card">
          <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 0.4rem;">
            <strong style="color: #FAA81A;">WARNING #${w.id}</strong>
            <small>${new Date(w.created_at).toLocaleDateString()}</small>
          </div>
          <p style="margin:0; font-size:0.85rem;">${escapeHtml(w.reason || 'No reason provided')}</p>
          <div style="margin-top: 0.4rem; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
            Moderator: <span class="user-id-badge">${w.moderator_id}</span>
          </div>
        </div>
      `).join('');
    }

    // Infractions Tab
    const allInfractions = [
      ...data.infractions.kicks.map(i => ({...i, type: 'Kick'})),
      ...data.infractions.bans.map(i => ({...i, type: 'Ban'})),
      ...data.infractions.mutes.map(i => ({...i, type: 'Mute', created_at: i.created_at || i.expires_at}))
    ].sort((a, b) => b.created_at - a.created_at);

    if (allInfractions.length === 0) {
      document.getElementById('profile-infractions').innerHTML = '<p class="text-muted text-center" style="padding: 2rem 0;">Clean moderation record.</p>';
    } else {
      document.getElementById('profile-infractions').innerHTML = allInfractions.map(i => `
        <div class="sm-card">
          <div style="display:flex; justify-content:space-between; margin-bottom: 0.2rem;">
            <strong class="type-${i.type.toLowerCase()}">${i.type.toUpperCase()}</strong>
            <small>${new Date(i.created_at).toLocaleDateString()}</small>
          </div>
          <p style="margin:0; font-size:0.85rem;">${escapeHtml(i.reason || 'No reason')}</p>
        </div>
      `).join('');
    }

    // Tickets Tab
    state.loadedProfileTickets = data.tickets.sort((a, b) => b.created_at - a.created_at);
    state.profileTicketsPage = 1;
    renderProfileTickets();
    
  } catch (err) {
    document.getElementById('profile-username').textContent = 'Error fetching user';
    document.getElementById('profile-warnings').innerHTML = '<p class="error-text">Error</p>';
    document.getElementById('profile-infractions').innerHTML = '<p class="error-text">Error</p>';
    document.getElementById('profile-tickets').innerHTML = '<p class="error-text">Error</p>';
  }
}

export function renderProfileTickets() {
  const container = document.getElementById('profile-tickets');
  if (state.loadedProfileTickets.length === 0) {
    container.innerHTML = '<p class="text-muted text-center" style="padding: 2rem 0;">No tickets created.</p>';
    return;
  }

  const totalPages = Math.ceil(state.loadedProfileTickets.length / state.PROFILE_TICKETS_PAGE_SIZE) || 1;
  if (state.profileTicketsPage > totalPages) state.profileTicketsPage = totalPages;

  const start = (state.profileTicketsPage - 1) * state.PROFILE_TICKETS_PAGE_SIZE;
  const pageTickets = state.loadedProfileTickets.slice(start, start + state.PROFILE_TICKETS_PAGE_SIZE);

  let html = `<div class="profile-data-list">
    ${pageTickets.map(t => `
      <div class="sm-card clickable" onclick="openTicketViewer(${t.id})">
        <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 0.2rem;">
          <strong>#${t.id} - ${t.category}</strong>
          <span class="status-badge ${t.status}" style="font-size:0.6rem; padding:0.1rem 0.3rem; line-height: 1;">${t.status.toUpperCase()}</span>
        </div>
        <small>${new Date(t.created_at).toLocaleDateString()}</small>
      </div>
    `).join('')}
  </div>`;

  if (totalPages > 1) {
    html += `
      <div class="pagination-controls" style="margin-top: 0.5rem; padding-top: 0.5rem; gap: 0.5rem;">
        <button class="btn btn-secondary btn-sm" onclick="changeProfileTicketsPage(-1)" ${state.profileTicketsPage === 1 ? 'disabled style="opacity: 0.5; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: default;"' : 'style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"'}>&larr;</button>
        <span class="pagination-info" style="font-size: 0.8rem;">${state.profileTicketsPage}/${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeProfileTicketsPage(1)" ${state.profileTicketsPage === totalPages ? 'disabled style="opacity: 0.5; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: default;"' : 'style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"'}>&rarr;</button>
      </div>
    `;
  }

  container.innerHTML = html;
}

export function changeProfileTicketsPage(direction) {
  state.profileTicketsPage += direction;
  renderProfileTickets();
}

export function closeUserProfile() {
  document.getElementById('lookup-profile-panel').style.display = 'none';
  document.getElementById('lookup-list-container').style.display = 'block';
}

export function switchProfileTab(tabName) {
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick').includes(tabName)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  document.querySelectorAll('.profile-tab-content').forEach(content => {
    if (content.id === `tab-${tabName}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
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
