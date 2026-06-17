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
  const textChannels = channels.filter(c => c.type === 'text');
  const channelOpts = textChannels.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('');

  const dropdownIds = [
    'settings-command-log',
    'settings-delete-log',
    'settings-production-log',
    'settings-welcome-channel',
    'settings-announcement-channel',
  ];

  dropdownIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `<option value="">Disabled</option>` + channelOpts;
    }
  });
}

export function setValues(settings) {
  const fields = {
    'settings-command-log':          settings.command_log_channel_id,
    'settings-delete-log':           settings.delete_log_channel_id,
    'settings-production-log':       settings.production_log_channel_id,
    'settings-welcome-channel':      settings.welcome_channel_id,
    'settings-announcement-channel': settings.announcement_channel_id,
  };

  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }
}

export function getValues() {
  return {
    command_log_channel_id:        document.getElementById('settings-command-log')?.value || null,
    delete_log_channel_id:         document.getElementById('settings-delete-log')?.value || null,
    production_log_channel_id:     document.getElementById('settings-production-log')?.value || null,
    welcome_channel_id:            document.getElementById('settings-welcome-channel')?.value || null,
    announcement_channel_id:       document.getElementById('settings-announcement-channel')?.value || null,
  };
}

export function undoField(fieldId, originalVal) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = originalVal != null ? originalVal : '';
  }
}
