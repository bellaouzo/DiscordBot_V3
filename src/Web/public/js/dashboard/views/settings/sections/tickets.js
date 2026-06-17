function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function populate(data, onChange) {
  const channels = data.channels || [];

  // Categories
  const categories = channels.filter(c => c.type === 'category');
  const categoryOpts = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  
  const ticketCatEl = document.getElementById('settings-ticket-category');
  if (ticketCatEl) {
    ticketCatEl.innerHTML = `<option value="">Create automatically (Support Tickets)</option>` + categoryOpts;
  }

  const appealCatEl = document.getElementById('settings-appeal-category');
  if (appealCatEl) {
    appealCatEl.innerHTML = `<option value="">Disabled</option>` + categoryOpts;
  }

  // Text channels
  const textChannels = channels.filter(c => c.type === 'text');
  const channelOpts = textChannels.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('');

  const ticketLogEl = document.getElementById('settings-ticket-log');
  if (ticketLogEl) {
    ticketLogEl.innerHTML = `<option value="">Disabled</option>` + channelOpts;
  }
}

export function setValues(settings) {
  const ticketCatEl = document.getElementById('settings-ticket-category');
  if (ticketCatEl) ticketCatEl.value = settings.ticket_category_id || '';

  const ticketLogEl = document.getElementById('settings-ticket-log');
  if (ticketLogEl) ticketLogEl.value = settings.ticket_log_channel_id || '';

  const appealCatEl = document.getElementById('settings-appeal-category');
  if (appealCatEl) appealCatEl.value = settings.appeal_review_category_id || '';
}

export function getValues() {
  return {
    ticket_category_id:        document.getElementById('settings-ticket-category')?.value || null,
    ticket_log_channel_id:     document.getElementById('settings-ticket-log')?.value || null,
    appeal_review_category_id: document.getElementById('settings-appeal-category')?.value || null,
  };
}

export function undoField(fieldId, originalVal) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = originalVal != null ? originalVal : '';
  }
}
