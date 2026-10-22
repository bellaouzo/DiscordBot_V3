/**
 * overview.js — Bento overview for the selected server.
 * Admin mode shows the staff tiles (ticket queue, recent cases);
 * otherwise the user sees their own tickets and record.
 */

import { state } from '../core/state.js';
import { fetchApi } from '../core/api.js';
import { openTicketViewer } from './tickets.js';
import { viewUserProfile } from './lookup.js';

const MODULE_LABELS = {
  economy:      'Economy',
  giveaways:    'Giveaways',
  spamFilter:   'Spam filter',
  verification: 'Verification',
  starboard:    'Starboard',
  tickets:      'Ticket category',
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const fmt = (n) => Number(n || 0).toLocaleString();
const compact = (n) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n || 0);

function timeAgo(ms) {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function initials(name) {
  return (String(name || '').replace(/[^a-z0-9]/gi, '').slice(0, 2) || '?');
}

function emptyTile(message, extra = '') {
  return `<div class="tile empty-tile">${extra}<p>${escapeHtml(message)}</p></div>`;
}

/* ── Load ─────────────────────────────────────────────────── */
export async function loadOverview() {
  const container = document.getElementById('overview-container');
  if (!container) return;

  if (!state.selectedGuildId) {
    container.innerHTML = emptyTile('Choose a server to load its overview.');
    return;
  }

  const guildId = state.selectedGuildId;
  const adminView = state.isAdminMode;
  container.innerHTML = emptyTile('Loading overview…', '<div class="loader"></div>');

  try {
    const [data, prefetched] = await Promise.all([
      fetchApi(`/api/overview/${guildId}`),
      adminView ? null : loadPersonal(guildId),
    ]);
    const staff = adminView && data.admin;
    const personal = staff ? null : (prefetched ?? await loadPersonal(guildId));

    // Server or mode changed while we were waiting
    if (guildId !== state.selectedGuildId || adminView !== state.isAdminMode) return;

    const desc = document.getElementById('overview-desc');
    if (desc) desc.textContent = `Here's what's happening in ${data.guild.name}.`;

    container.innerHTML = [
      membersTile(data),
      staff ? queueTile(data) : myTicketsTile(personal.tickets),
      leaderTile(data.leaderboard),
      staff ? casesTile(data) : recordTile(personal.infractions),
      economyTile(data.richest),
      modulesTile(data.modules),
    ].join('');
  } catch (e) {
    container.innerHTML = '<div class="tile empty-tile"><p class="error-text">Failed to load the overview.</p></div>';
  }
}

async function loadPersonal(guildId) {
  const [tickets, infractions] = await Promise.all([
    fetchApi(`/api/tickets/${guildId}`),
    fetchApi(`/api/infractions/${guildId}`),
  ]);
  return { tickets, infractions };
}

/* ── Tiles ────────────────────────────────────────────────── */
function membersTile(data) {
  const g = data.guild;
  const icon = g.icon
    ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64" alt="" />`
    : `<span class="server-icon">${escapeHtml(g.name.charAt(0))}</span>`;
  return `
    <section class="tile dark t-members">
      <div class="tile-head"><h3>Members</h3><span class="meta">${data.isAdmin ? 'You are staff' : 'Member'}</span></div>
      <p class="huge">${fmt(g.memberCount)}</p>
      <div class="server-line tile-foot">${icon}<b>${escapeHtml(g.name)}</b></div>
    </section>`;
}

function ticketRows(tickets, usernames) {
  return tickets.map(t => {
    const who = usernames ? ` · ${escapeHtml(usernames[t.user_id] || t.user_id)}` : '';
    return `
      <li data-ticket-id="${Number(t.id)}">
        <span class="mini-id">#${Number(t.id)}</span>
        <span class="mini-title">${escapeHtml(t.category)}${who}</span>
        <span class="mini-age">${timeAgo(t.created_at)}</span>
      </li>`;
  }).join('');
}

function queueTile(data) {
  const { openTicketCount, openTickets } = data.admin;
  return `
    <section class="tile accent t-tickets">
      <div class="tile-head"><h3>Open tickets</h3><button type="button" class="link-btn" data-goto="tickets">Open queue</button></div>
      <div class="tickets-top"><span class="huge">${fmt(openTicketCount)}</span><span class="meta">${openTicketCount === 1 ? 'ticket needs' : 'tickets need'} attention</span></div>
      ${openTickets.length
        ? `<ul class="mini-list">${ticketRows(openTickets, data.usernames)}</ul>`
        : '<p class="tile-foot">Queue is clear.</p>'}
    </section>`;
}

function myTicketsTile(tickets) {
  const open = tickets.filter(t => t.status === 'open').sort((a, b) => b.created_at - a.created_at);
  return `
    <section class="tile accent t-tickets">
      <div class="tile-head"><h3>Your tickets</h3><button type="button" class="link-btn" data-goto="tickets">View all</button></div>
      <div class="tickets-top"><span class="huge">${open.length}</span><span class="meta">open · ${tickets.length} total</span></div>
      ${open.length
        ? `<ul class="mini-list">${ticketRows(open.slice(0, 4))}</ul>`
        : '<p class="tile-foot">No open tickets. Use /ticket in Discord if you need help.</p>'}
    </section>`;
}

function leaderTile(leaderboard) {
  const rows = leaderboard.map((e, i) => `
    <li>
      <span class="rank">${i + 1}</span>
      <span class="av">${escapeHtml(initials(e.username))}</span>
      <span class="who">${escapeHtml(e.username)}<small>${fmt(e.totalXpEarned)} XP</small></span>
      <em>Lv ${Number(e.level)}</em>
    </li>`).join('');
  return `
    <section class="tile t-leader">
      <div class="tile-head"><h3>Top levels</h3></div>
      ${rows ? `<ol class="rank-list">${rows}</ol>` : '<p class="text-muted">Nobody has earned XP yet.</p>'}
    </section>`;
}

function casesTile(data) {
  const { recentCases, casesLast7d } = data.admin;
  const rows = recentCases.map(c => `
    <tr>
      <td><span class="case-tag ${escapeHtml(c.action)}">${escapeHtml(c.action)}</span></td>
      <td><span class="case-user" data-user-id="${escapeHtml(c.user_id)}">${escapeHtml(data.usernames[c.user_id] || c.user_id)}</span></td>
      <td class="reason">${escapeHtml(c.reason || 'No reason')}</td>
      <td>${timeAgo(c.created_at)}</td>
    </tr>`).join('');
  return `
    <section class="tile t-cases">
      <div class="tile-head"><h3>Recent cases</h3><span class="meta">${fmt(casesLast7d)} in the last 7 days</span></div>
      ${rows ? `<table class="case-table"><tbody>${rows}</tbody></table>` : '<p class="text-muted">No moderation actions yet.</p>'}
      <button type="button" class="link-btn tile-foot" data-goto="infractions">All infractions</button>
    </section>`;
}

function recordTile(infractions) {
  const counts = {
    Kicks: infractions.kicks.length,
    Bans:  infractions.bans.length,
    Mutes: infractions.mutes.length,
  };
  const total = counts.Kicks + counts.Bans + counts.Mutes;
  return `
    <section class="tile t-cases">
      <div class="tile-head"><h3>Your record</h3><button type="button" class="link-btn" data-goto="infractions">Details</button></div>
      <div class="record-grid">
        ${Object.entries(counts).map(([label, n]) => `<div><b>${n}</b><span>${label}</span></div>`).join('')}
      </div>
      <p class="tile-foot">${total === 0 ? 'Clean record. Nice.' : 'Think something is wrong? Use /appeal in Discord.'}</p>
    </section>`;
}

function economyTile(richest) {
  const rows = richest.map((e, i) => `
    <li>
      <span class="rank">${i + 1}</span>
      <span class="av">${escapeHtml(initials(e.username))}</span>
      <span class="who">${escapeHtml(e.username)}</span>
      <em>${compact(e.balance)}</em>
    </li>`).join('');
  return `
    <section class="tile t-econ">
      <div class="tile-head"><h3>Richest members</h3><span class="meta">coins</span></div>
      ${rows ? `<ol class="rank-list">${rows}</ol>` : '<p class="text-muted">Nobody has coins yet.</p>'}
    </section>`;
}

function modulesTile(modules) {
  const entries = Object.entries(MODULE_LABELS);
  const onCount = entries.filter(([key]) => modules[key]).length;
  const manage = state.isAdminMode
    ? '<button type="button" class="link-btn" data-goto="settings">Manage</button>'
    : `<span class="meta">${onCount} of ${entries.length} on</span>`;
  return `
    <section class="tile t-mods">
      <div class="tile-head"><h3>Modules</h3>${manage}</div>
      <ul class="mods">
        ${entries.map(([key, label]) => `
          <li><span>${label}</span><span class="state ${modules[key] ? 'on' : ''}">${modules[key] ? 'On' : 'Off'}</span></li>`).join('')}
      </ul>
    </section>`;
}

/* ── Tile interactions (event delegation, bound once) ─────── */
export function initOverview() {
  document.getElementById('overview-container')?.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) {
      document.querySelector(`.nav-btn[data-view="${goto.dataset.goto}"]`)?.click();
      return;
    }

    const ticket = e.target.closest('[data-ticket-id]');
    if (ticket) {
      openTicketViewer(Number(ticket.dataset.ticketId));
      return;
    }

    const user = e.target.closest('[data-user-id]');
    if (user) viewUserProfile(user.dataset.userId);
  });
}
