# Web Frontend — Structure Guide

This document describes the organization of the `src/Web/public/` frontend
so future features are easy to slot in correctly.

---

## Directory Layout

```
src/Web/public/
├── css/
│   ├── index.css          ← Entry point (only @import statements)
│   ├── base.css           ← Design tokens, resets, keyframes, utilities
│   ├── layout/
│   │   ├── navbar.css     ← Global navbar (shared)
│   │   ├── topbar.css     ← Dashboard context topbar (server picker, admin mode, user avatar)
│   │   └── content.css    ← Main dashboard layouts, ticket slide panels, and chat layout
│   ├── components/
│   │   ├── buttons.css    ← Button variants (.btn, icon buttons)
│   │   ├── badges.css     ← Status pills, Category tags, User/Role badges
│   │   ├── cards.css      ← Data cards, small info cards, list filters, pagination
│   │   ├── forms.css      ← Text inputs, select dropdowns, toggle switches
│   │   ├── toast.css      ← Save toast, unsaved changes banner, field undo button
│   │   └── widgets/
│   │       ├── multiselect.css ← Custom multiselect role picker dropdown
│   │       └── emojipicker.css ← Starboard emoji picker grid popover
│   └── views/
│       ├── landing.css    ← Landing / Home page hero & command lists
│       ├── profile.css    ← User lookup list & profile detail tabs
│       └── settings.css   ← Settings view layout (split-pane, sub-sidebar)
│
├── js/
│   ├── home.js            ← Landing page (command filter, category tabs)
│   └── dashboard/
│       ├── core/
│       │   ├── main.js    ← entry point — DOMContentLoaded, fetch user/mutual guilds, window bindings
│       │   ├── state.js   ← global mutable state object
│       │   ├── api.js     ← thin fetchApi() wrapper with error handling
│       │   ├── router.js  ← view section switching, updateTitles(), refreshCurrentView()
│       │   └── topbar.js  ← server picker, admin mode toggle, and state updating
│       ├── components/
│       │   ├── multiselect.js ← CustomMultiSelect widget class
│       │   └── emojipicker.js ← EmojiPicker widget module
│       └── views/
│           ├── tickets.js     ← tickets list, pagination, and slide-panel viewer
│           ├── infractions.js ← infractions list and pagination
│           ├── lookup.js      ← user search and profile detail panel
│           └── settings/
│               ├── index.js   ← settings loading, sub-tab switching, and save/submit handler
│               ├── form.js    ← form state snapshot, difference comparison, and undo/reset
│               └── sections/
│                   ├── general.js      ← roles, permissions, autorole, and welcome/announcement channels
│                   ├── tickets.js      ← ticket categories, categories, and logs
│                   ├── logging.js      ← logging routes for bot activities
│                   ├── verification.js ← verification toggle, roles, and account age restrictions
│                   └── features.js     ← economy, giveaways, and starboard configurations
│
├── dashboard.html         ← Dashboard SPA shell
└── index.html             ← Landing / home page
```

---

## Adding a New Feature

### 1. New Dashboard "page" (e.g. Giveaways)

1. **Create** `js/dashboard/views/giveaways.js` — export `loadGiveaways()` and any sub-functions.
2. **Import** it in `js/dashboard/core/main.js` to register it to window globals and register view updates in `js/dashboard/core/router.js`.
3. **Add** the nav button in `dashboard.html` (use `id="nav-giveaways"` pattern).
4. **Add** the `<section id="view-giveaways">` content block in `dashboard.html`.
5. **Add** any new styles to a view CSS file (like `css/views/giveaways.css`) and import it in `css/index.css`.

### 2. New Settings Option

1. Navigate to the relevant tab under `js/dashboard/views/settings/sections/` (e.g. `features.js`).
2. Add the field populating logic, element retrieval, initial setting, and undo handling inside that section file.
3. Register the new field ID to the `KEY_MAP` and section router (`SECTION_MAP`) in `js/dashboard/views/settings/form.js`.

### 3. New Reusable Widget

- Create `js/dashboard/components/<widget-name>.js` and export your widget class or init function.
- Avoid circular imports by passing an `onChange` callback parameter to let parent forms track changes.
- Add its CSS to `css/components/widgets/<widget-name>.css` and import it in `css/index.css`.

---

## CSS Architecture

Every CSS file is split cleanly into a semantic subdirectory under `css/`:
- **base**: basic tokens, animations, utility helpers.
- **layout**: grid layouts, headers, navbars, sidebars, dashboard shell.
- **components**: generic atoms and molecules like buttons, badges, and complex inputs.
- **views**: page-level specific layouts, grids, or one-off styles.

---

## State Management

All shared runtime state lives in [`state.js`](./js/dashboard/core/state.js):

```js
state.currentUser      // Discord user object from /api/@me
state.selectedGuildId  // Currently selected guild snowflake string
state.mutualGuilds     // Array of guilds from /api/guilds
state.isAdminMode      // Boolean — admin mode toggled on/off
```

Modules import `{ state }` from `../core/state.js` (or relative equivalent).

---

## API Calls

All HTTP calls go through [`api.js`](./js/dashboard/core/api.js) `fetchApi(path, options?)`.
It automatically throws on non-2xx responses (redirecting to `/` on unauthorized 401 statuses).

---

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| JS modules | camelCase file | `multiselect.js` |
| CSS classes | BEM-lite kebab-case | `.server-picker-chip`, `.chip-server-avatar` |
| HTML IDs | kebab-case | `id="chip-server-name"` |
| JS functions | camelCase | `loadSettings()`, `checkUnsavedChanges()` |
| Exported window globals | camelCase | `window.switchProfileTab` |
