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
  const roles = data.roles || [];

  // Text channels
  const textChannels = channels.filter(c => c.type === 'text');
  const channelOpts = textChannels.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('');

  const verifyChanEl = document.getElementById('settings-verify-channel');
  if (verifyChanEl) {
    verifyChanEl.innerHTML = `<option value="">Disabled</option>` + channelOpts;
  }

  // Roles
  const roleOpts = roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  
  const unverifyRoleEl = document.getElementById('settings-unverified-role');
  if (unverifyRoleEl) {
    unverifyRoleEl.innerHTML = `<option value="">None</option>` + roleOpts;
  }

  const verifyRoleEl = document.getElementById('settings-verified-role');
  if (verifyRoleEl) {
    verifyRoleEl.innerHTML = `<option value="">None</option>` + roleOpts;
  }
}

export function setValues(settings) {
  const verifyEnabledEl = document.getElementById('settings-verify-enabled');
  if (verifyEnabledEl) verifyEnabledEl.checked = !!settings.verification_enabled;

  const verifyChanEl = document.getElementById('settings-verify-channel');
  if (verifyChanEl) verifyChanEl.value = settings.verification_channel_id || '';

  const unverifyRoleEl = document.getElementById('settings-unverified-role');
  if (unverifyRoleEl) unverifyRoleEl.value = settings.unverified_role_id || '';

  const verifyRoleEl = document.getElementById('settings-verified-role');
  if (verifyRoleEl) verifyRoleEl.value = settings.verified_role_id || '';

  const verifyAgeEl = document.getElementById('settings-verify-age');
  if (verifyAgeEl) verifyAgeEl.value = settings.verification_min_account_age_days ?? 0;
}

export function getValues() {
  return {
    verification_enabled:              document.getElementById('settings-verify-enabled')?.checked,
    verification_channel_id:           document.getElementById('settings-verify-channel')?.value || null,
    unverified_role_id:                document.getElementById('settings-unverified-role')?.value || null,
    verified_role_id:                  document.getElementById('settings-verified-role')?.value || null,
    verification_min_account_age_days: parseInt(document.getElementById('settings-verify-age')?.value) || 0,
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
