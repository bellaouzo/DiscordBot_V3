/**
 * emojipicker.js — Emoji picker widget for Starboard emoji selection.
 *
 * Call initEmojiPicker(onChange) where onChange is a callback that fires
 * when the emoji value changes (e.g. checkUnsavedChanges from settings.js).
 */

const EMOJI_LIST = [
  '⭐', '❤️', '👍', '😂', '🔥', '😮', '😢', '👎', '🎉', '👀',
  '📌', '🚀', '💯', '✅', '❌', '⚠️', '🔒', '🔓', '🔔', '🔊',
  '💬', '👑', '💎', '💡', '🎨', '🎮', '🎵', '👾', '🤖', '🐱',
  '🐶', '🦊', '🦁', '🐼', '🐨', '🍎', '🍕', '🍔', '🍺', '🌍',
  '✈️', '⏰', '🛠️', '🛡️', '⚙️', '📦', '🎁', '🎈', '🛒', '🎯',
  '🔮', '🔑', '🗺️', '💵',
];

export function initEmojiPicker(onChange = null) {
  const triggerBtn = document.getElementById('btn-emoji-picker');
  const input      = document.getElementById('settings-starboard-emoji');
  const dropdown   = document.getElementById('emoji-picker-dropdown');

  if (!triggerBtn || !input || !dropdown) return;

  // Render emoji grid
  dropdown.innerHTML = `
    <div class="emoji-grid">
      ${EMOJI_LIST.map(e => `<span class="emoji-item">${e}</span>`).join('')}
    </div>
  `;

  const togglePicker = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.add('select-hide'));
    dropdown.classList.toggle('select-hide');
  };

  triggerBtn.addEventListener('click', togglePicker);
  input.addEventListener('click', togglePicker);

  dropdown.querySelectorAll('.emoji-item').forEach(el => {
    el.addEventListener('click', () => {
      input.value = el.textContent;
      dropdown.classList.add('select-hide');
      onChange?.();
    });
  });

  document.addEventListener('click', () => dropdown.classList.add('select-hide'));
}
