import { initEmojiPicker as _initEmojiPicker } from '../../../components/emojipicker.js';

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

  const starboardChanEl = document.getElementById('settings-starboard-channel');
  if (starboardChanEl) {
    starboardChanEl.innerHTML = `<option value="">Disabled</option>` + channelOpts;
  }

  _initEmojiPicker(onChange);
}

export function setValues(settings) {
  const starboardChanEl = document.getElementById('settings-starboard-channel');
  if (starboardChanEl) starboardChanEl.value = settings.starboard_channel_id || '';

  const starboardEmojiEl = document.getElementById('settings-starboard-emoji');
  if (starboardEmojiEl) starboardEmojiEl.value = settings.starboard_emoji || '⭐';

  const starboardThresholdEl = document.getElementById('settings-starboard-threshold');
  if (starboardThresholdEl) starboardThresholdEl.value = settings.starboard_threshold || 3;

  const economyEnabledEl = document.getElementById('settings-economy-enabled');
  if (economyEnabledEl) {
    economyEnabledEl.checked = settings.economy_enabled !== undefined ? !!settings.economy_enabled : true;
  }

  const giveawaysEnabledEl = document.getElementById('settings-giveaways-enabled');
  if (giveawaysEnabledEl) {
    giveawaysEnabledEl.checked = settings.giveaways_enabled !== undefined ? !!settings.giveaways_enabled : true;
  }
}

export function getValues() {
  return {
    starboard_channel_id: document.getElementById('settings-starboard-channel')?.value || null,
    starboard_emoji:      document.getElementById('settings-starboard-emoji')?.value || '⭐',
    starboard_threshold:  parseInt(document.getElementById('settings-starboard-threshold')?.value) || 3,
    economy_enabled:      document.getElementById('settings-economy-enabled')?.checked,
    giveaways_enabled:    document.getElementById('settings-giveaways-enabled')?.checked,
  };
}

export function undoField(fieldId, originalVal) {
  const el = document.getElementById(fieldId);
  if (el) {
    if (el.type === 'checkbox') {
      el.checked = !!originalVal;
    } else {
      el.value = originalVal != null ? originalVal : '';
    }
  }
}
