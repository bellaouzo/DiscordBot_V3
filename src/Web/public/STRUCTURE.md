# Web Frontend — Structure Guide

This document describes the organization of the `src/Web/public/` frontend
so future features are easy to slot in correctly.

---

## Directory Layout

```
src/Web/public/
├── css/
│   ├── index.css          ← Landing page entry (base, navbar, buttons, badges, landing)
│   ├── base.css / layout/navbar.css / components/{buttons,badges}.css / views/landing.css
│   └── dashboard/         ← Bento dashboard (dashboard.html only)
│       ├── index.css      ← Entry point (only @import statements)
│       ├── base.css       ← Design tokens (:root), reset, icon sizing, utilities, keyframes
│       ├── layout/
│       │   ├── shell.css  ← Page grid, collapsible sidebar, server picker, mobile drawer
│       │   └── header.css ← Top bar (breadcrumb, admin mode), view switching, page titles
│       ├── components/
│       │   ├── buttons.css  ← .btn variants, icon buttons, link buttons
│       │   ├── badges.css   ← Status pills, ID badges, role badges, case tags
│       │   ├── cards.css    ← Tiles, list cards, filter tabs, pagination
│       │   ├── forms.css    ← Inputs, selects, search bar, toggle switches
│       │   ├── toast.css    ← Save toast, unsaved changes bar, field undo button
│       │   └── widgets.css  ← Role multiselect, starboard emoji picker
│       └── views/
│           ├── overview.css ← Bento grid (edit grid-template-areas to move tiles)
│           ├── tickets.css  ← Ticket slide panel and chat transcript
│           ├── lookup.css   ← Member grid and profile panel
│           └── settings.css ← Settings sub-nav and form card
│
├── js/
│   ├── home.js            ← Landing page (command filter, category tabs)
│   └── dashboard/
│       ├── core/
│       │   ├── main.js    ← entry point — DOMContentLoaded, fetch user/mutual guilds, window bindings
│       │   ├── state.js   ← global mutable state object
│       │   ├── api.js     ← thin fetchApi() wrapper with error handling
│       │   ├── router.js  ← view section switching, breadcrumb, updateTitles(), refreshCurrentView()
│       │   ├── sidebar.js ← collapse/expand (remembered per browser, `[` key) and mobile drawer
│       │   └── topbar.js  ← server picker, admin mode toggle (adds body.is-admin), and state updating
│       ├── components/
│       │   ├── multiselect.js ← CustomMultiSelect widget class
│       │   └── emojipicker.js ← EmojiPicker widget module
│       └── views/
│           ├── overview.js    ← bento tiles from /api/overview (staff tiles in admin mode)
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
3. **Add** the sidebar nav button in `dashboard.html` (use `id="nav-giveaways"`, an icon from the sprite, and a `.nav-text` label).
4. **Add** the `<section id="view-giveaways">` content block in `dashboard.html`.
5. **Add** any new styles to a view CSS file (like `css/dashboard/views/giveaways.css`) and import it in `css/dashboard/index.css`.

### 2. New Settings Option

1. Navigate to the relevant tab under `js/dashboard/views/settings/sections/` (e.g. `features.js`).
2. Add the field populating logic, element retrieval, initial setting, and undo handling inside that section file.
3. Register the new field ID to the `KEY_MAP` and section router (`SECTION_MAP`) in `js/dashboard/views/settings/form.js`.

### 3. New Reusable Widget

- Create `js/dashboard/components/<widget-name>.js` and export your widget class or init function.
- Avoid circular imports by passing an `onChange` callback parameter to let parent forms track changes.
- Add its CSS to `css/dashboard/components/widgets.css` (or a new file imported from `css/dashboard/index.css`).

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
