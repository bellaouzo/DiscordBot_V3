import * as general from './sections/general.js';
import * as tickets from './sections/tickets.js';
import * as logging from './sections/logging.js';
import * as verification from './sections/verification.js';
import * as features from './sections/features.js';

export let originalSettings = null;

const KEY_MAP = {
  admin_role_ids:                    'settings-admin-roles',
  mod_role_ids:                      'settings-mod-roles',
  autorole_id:                       'settings-autorole',
  ticket_category_id:                'settings-ticket-category',
  ticket_log_channel_id:             'settings-ticket-log',
  appeal_review_category_id:         'settings-appeal-category',
  command_log_channel_id:            'settings-command-log',
  delete_log_channel_id:             'settings-delete-log',
  production_log_channel_id:         'settings-production-log',
  welcome_channel_id:                'settings-welcome-channel',
  announcement_channel_id:           'settings-announcement-channel',
  verification_enabled:              'settings-verify-enabled',
  verification_channel_id:           'settings-verify-channel',
  unverified_role_id:                'settings-unverified-role',
  verified_role_id:                  'settings-verified-role',
  verification_min_account_age_days: 'settings-verify-age',
  starboard_channel_id:              'settings-starboard-channel',
  starboard_emoji:                   'settings-starboard-emoji',
  starboard_threshold:               'settings-starboard-threshold',
  economy_enabled:                   'settings-economy-enabled',
  giveaways_enabled:                 'settings-giveaways-enabled',
};

// Section-by-field router for undo
const SECTION_MAP = {
  'settings-admin-roles':            general,
  'settings-mod-roles':              general,
  'settings-autorole':               general,
  'settings-ticket-category':        tickets,
  'settings-ticket-log':             tickets,
  'settings-appeal-category':        tickets,
  'settings-command-log':            logging,
  'settings-delete-log':             logging,
  'settings-production-log':         logging,
  'settings-welcome-channel':        logging,
  'settings-announcement-channel':   logging,
  'settings-verify-enabled':          verification,
  'settings-verify-channel':          verification,
  'settings-unverified-role':         verification,
  'settings-verified-role':           verification,
  'settings-verify-age':              verification,
  'settings-starboard-channel':       features,
  'settings-starboard-emoji':         features,
  'settings-starboard-threshold':     features,
  'settings-economy-enabled':         features,
  'settings-giveaways-enabled':       features,
};

export function getFormState() {
  return {
    ...general.getValues(),
    ...tickets.getValues(),
    ...logging.getValues(),
    ...verification.getValues(),
    ...features.getValues(),
  };
}

export function setOriginalSettings(settings) {
  originalSettings = settings;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  for (let i = 0; i < aSorted.length; i++) {
    if (aSorted[i] !== bSorted[i]) return false;
  }
  return true;
}

export function checkUnsavedChanges() {
  if (!originalSettings) return;
  const current = getFormState();

  let hasChanges = false;

  for (const key of Object.keys(originalSettings)) {
    const valCurrent  = current[key];
    const valOriginal = originalSettings[key];

    let isFieldChanged = Array.isArray(valOriginal)
      ? !arraysEqual(valCurrent || [], valOriginal)
      : valCurrent !== valOriginal;

    if (isFieldChanged) hasChanges = true;

    // Add/remove per-field undo button
    const fieldId = KEY_MAP[key];
    const element = document.getElementById(fieldId);
    if (element) {
      const group = element.closest('.form-group');
      const label = group?.querySelector('label');
      if (label) {
        let undoBtn = label.querySelector('.field-undo-btn');
        if (isFieldChanged && !undoBtn) {
          undoBtn = document.createElement('span');
          undoBtn.className = 'field-undo-btn';
          undoBtn.title = 'Undo recent change for this setting';
          undoBtn.innerHTML = '&#8634;';
          undoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            undoField(fieldId);
          });
          label.appendChild(undoBtn);
        } else if (!isFieldChanged && undoBtn) {
          undoBtn.remove();
        }
      }
    }
  }

  document.getElementById('unsaved-changes-banner')
    ?.classList.toggle('show', hasChanges);
}

export function undoField(fieldId) {
  if (!originalSettings) return;

  const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === fieldId);
  if (!key) return;

  const originalVal = originalSettings[key];
  const section = SECTION_MAP[fieldId];
  if (section) {
    section.undoField(fieldId, originalVal);
  }

  checkUnsavedChanges();
}

export function undoSettingsChanges() {
  if (!originalSettings) return;

  general.setValues(originalSettings);
  tickets.setValues(originalSettings);
  logging.setValues(originalSettings);
  verification.setValues(originalSettings);
  features.setValues(originalSettings);

  document.querySelectorAll('.field-undo-btn').forEach(btn => btn.remove());
  document.getElementById('unsaved-changes-banner')?.classList.remove('show');
}
