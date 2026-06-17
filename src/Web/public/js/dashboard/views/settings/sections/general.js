import { CustomMultiSelect } from '../../../components/multiselect.js';

let adminMultiSelect = null;
let modMultiSelect = null;

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
  const roles = data.roles || [];
  const settings = data.settings || {};

  // Populate roles dropdown
  const roleOpts = roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  const autoroleEl = document.getElementById('settings-autorole');
  if (autoroleEl) {
    autoroleEl.innerHTML = '<option value="">None (Disabled)</option>' + roleOpts;
  }

  // Instantiate multiselects
  adminMultiSelect = new CustomMultiSelect('settings-admin-roles', roles, settings.admin_role_ids || [], 'Select admin roles...', onChange);
  modMultiSelect   = new CustomMultiSelect('settings-mod-roles',   roles, settings.mod_role_ids   || [], 'Select mod roles...',   onChange);
}

export function setValues(settings) {
  const autoroleEl = document.getElementById('settings-autorole');
  if (autoroleEl) {
    autoroleEl.value = settings.autorole_id || '';
  }

  if (adminMultiSelect) {
    adminMultiSelect.selectedIds = [...(settings.admin_role_ids || [])];
    adminMultiSelect.renderTags();
    adminMultiSelect.renderOptions();
  }

  if (modMultiSelect) {
    modMultiSelect.selectedIds = [...(settings.mod_role_ids || [])];
    modMultiSelect.renderTags();
    modMultiSelect.renderOptions();
  }
}

export function getValues() {
  const adminRoles = adminMultiSelect ? adminMultiSelect.getSelectedValues() : [];
  const modRoles   = modMultiSelect   ? modMultiSelect.getSelectedValues()   : [];

  return {
    admin_role_ids: [...adminRoles].sort(),
    mod_role_ids:   [...modRoles].sort(),
    autorole_id:    document.getElementById('settings-autorole')?.value || null,
  };
}

export function undoField(fieldId, originalVal) {
  if (fieldId === 'settings-admin-roles') {
    if (adminMultiSelect) {
      adminMultiSelect.selectedIds = [...(originalVal || [])];
      adminMultiSelect.renderTags();
      adminMultiSelect.renderOptions();
    }
  } else if (fieldId === 'settings-mod-roles') {
    if (modMultiSelect) {
      modMultiSelect.selectedIds = [...(originalVal || [])];
      modMultiSelect.renderTags();
      modMultiSelect.renderOptions();
    }
  } else {
    const el = document.getElementById(fieldId);
    if (el) {
      el.value = originalVal != null ? originalVal : '';
    }
  }
}
