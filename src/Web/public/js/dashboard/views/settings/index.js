import { state } from '../../core/state.js';
import { fetchApi } from '../../core/api.js';
import * as general from './sections/general.js';
import * as tickets from './sections/tickets.js';
import * as logging from './sections/logging.js';
import * as verification from './sections/verification.js';
import * as features from './sections/features.js';
import {
  getFormState,
  setOriginalSettings,
  checkUnsavedChanges,
  undoSettingsChanges
} from './form.js';

export { undoSettingsChanges };

/* ── Load Settings from API ───────────────────────────────── */
export async function loadSettings() {
  try {
    const data     = await fetchApi(`/api/admin/settings/${state.selectedGuildId}`);
    const settings = data.settings || {};

    // Populate all section dropdowns/multiselects
    general.populate(data, checkUnsavedChanges);
    tickets.populate(data, checkUnsavedChanges);
    logging.populate(data, checkUnsavedChanges);
    verification.populate(data, checkUnsavedChanges);
    features.populate(data, checkUnsavedChanges);

    // Set initial values on fields
    general.setValues(settings);
    tickets.setValues(settings);
    logging.setValues(settings);
    verification.setValues(settings);
    features.setValues(settings);

    // Reset sub-nav to first tab & clear leftover undo buttons
    switchSettingsTab('general');
    document.querySelectorAll('.field-undo-btn').forEach(btn => btn.remove());

    // Snapshot for change tracking
    const initialFormState = getFormState();
    setOriginalSettings(initialFormState);
    document.getElementById('unsaved-changes-banner')?.classList.remove('show');

    // Attach change listeners
    const formEl = document.getElementById('settings-form');
    if (formEl) {
      formEl.removeEventListener('input',  checkUnsavedChanges);
      formEl.removeEventListener('change', checkUnsavedChanges);
      formEl.addEventListener('input',     checkUnsavedChanges);
      formEl.addEventListener('change',    checkUnsavedChanges);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

/* ── Settings Sub-Nav Tab Switch ──────────────────────────── */
export function switchSettingsTab(settingsTabName) {
  document.querySelectorAll('.settings-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-stab') === settingsTabName);
  });
  document.querySelectorAll('.settings-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `spanel-${settingsTabName}`);
  });
}

/* ── Save Settings to API ─────────────────────────────────── */
export async function saveSettings(event) {
  if (event) event.preventDefault();

  const toast = document.getElementById('save-status-toast');
  if (toast) toast.classList.remove('show', 'error');

  const currentSettings = getFormState();

  try {
    const response = await fetchApi(`/api/admin/settings/${state.selectedGuildId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSettings),
    });

    if (response.success) {
      if (toast) {
        toast.innerHTML = `<span class="toast-icon">✓</span> Settings saved successfully!`;
        toast.classList.remove('error');
        toast.classList.add('show');
      }

      setOriginalSettings(currentSettings);
      document.getElementById('unsaved-changes-banner')?.classList.remove('show');
      document.querySelectorAll('.field-undo-btn').forEach(btn => btn.remove());

      if (toast) {
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
    } else {
      throw new Error('Failed to save settings');
    }
  } catch (err) {
    if (toast) {
      toast.innerHTML = `<span class="toast-icon">✗</span> Error: Failed to save settings.`;
      toast.classList.add('show', 'error');
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }
}
