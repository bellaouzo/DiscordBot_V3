/**
 * multiselect.js — CustomMultiSelect widget
 * A pill-based multi-select dropdown for role management.
 *
 * To avoid circular imports, an `onChange` callback is passed in
 * rather than importing checkUnsavedChanges directly.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class CustomMultiSelect {
  /**
   * @param {string} elementId       - ID of the container element
   * @param {Array}  roles           - Array of { id, name } objects
   * @param {Array}  selectedIds     - Array of initially selected IDs
   * @param {string} [placeholder]   - Placeholder text
   * @param {Function} [onChange]    - Callback fired when selection changes
   */
  constructor(elementId, roles, selectedIds, placeholder = 'Select roles...', onChange = null) {
    this.container   = document.getElementById(elementId);
    this.roles       = roles;
    this.selectedIds = [...selectedIds];
    this.placeholder = placeholder;
    this.onChange    = onChange;

    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="multiselect-trigger">
        <div class="multiselect-tags"></div>
        <div class="multiselect-arrow">&#9662;</div>
      </div>
      <div class="multiselect-dropdown select-hide">
        <input type="text" class="multiselect-search" placeholder="Search roles..." />
        <div class="multiselect-options"></div>
      </div>
    `;

    this.trigger          = this.container.querySelector('.multiselect-trigger');
    this.dropdown         = this.container.querySelector('.multiselect-dropdown');
    this.search           = this.container.querySelector('.multiselect-search');
    this.optionsContainer = this.container.querySelector('.multiselect-options');
    this.tagsContainer    = this.container.querySelector('.multiselect-tags');

    // Toggle dropdown
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.multiselect-dropdown').forEach(d => {
        if (d !== this.dropdown) d.classList.add('select-hide');
      });
      this.dropdown.classList.toggle('select-hide');
      if (!this.dropdown.classList.contains('select-hide')) {
        this.search.focus();
      }
    });

    // Prevent closing when clicking inside dropdown
    this.dropdown.addEventListener('click', (e) => e.stopPropagation());

    // Search filter
    this.search.addEventListener('input', () => this.renderOptions(this.search.value));

    this.renderOptions();
    this.renderTags();

    // Close on click outside
    document.addEventListener('click', () => this.dropdown.classList.add('select-hide'));
  }

  renderOptions(query = '') {
    const q        = query.toLowerCase();
    const filtered = this.roles.filter(r => r.name.toLowerCase().includes(q));

    if (filtered.length === 0) {
      this.optionsContainer.innerHTML =
        '<span class="text-muted" style="padding: 0.5rem; display: block;">No roles found.</span>';
      return;
    }

    this.optionsContainer.innerHTML = filtered.map(r => {
      const isChecked = this.selectedIds.includes(r.id);
      return `
        <div class="checkbox-item">
          <input type="checkbox" id="opt-${this.container.id}-${r.id}" value="${r.id}" ${isChecked ? 'checked' : ''} />
          <label for="opt-${this.container.id}-${r.id}">${escapeHtml(r.name)}</label>
        </div>
      `;
    }).join('');

    this.optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const val = e.target.value;
        if (e.target.checked) {
          if (!this.selectedIds.includes(val)) this.selectedIds.push(val);
        } else {
          this.selectedIds = this.selectedIds.filter(id => id !== val);
        }
        this.renderTags();
        this.onChange?.();
      });
    });
  }

  renderTags() {
    this.tagsContainer.innerHTML = '';
    if (this.selectedIds.length === 0) {
      this.tagsContainer.innerHTML = `<span class="placeholder">${this.placeholder}</span>`;
      return;
    }

    this.selectedIds.forEach(id => {
      const role = this.roles.find(r => r.id === id);
      const name = role ? role.name : id;

      const pill = document.createElement('span');
      pill.className = 'multiselect-pill';
      pill.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <span class="remove-btn">&times;</span>
      `;

      pill.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedIds = this.selectedIds.filter(x => x !== id);
        this.renderTags();
        this.renderOptions(this.search.value);
        this.onChange?.();
      });

      this.tagsContainer.appendChild(pill);
    });
  }

  getSelectedValues() {
    return this.selectedIds;
  }
}
