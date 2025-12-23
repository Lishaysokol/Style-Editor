# Style Editor

Figma plugin for quickly browsing paint styles, adjusting colors, and keeping layers linked to variables.

## Features
- Folder tree view with search, badges, and hover previews.
- Detail panel for editing each style's layers: new swatches, hex tweaks, opacity, and variable bindings.
- Save multiple styles at once while drafts are kept per style until you hit **Save**.
- Folder warning badges in the header.
- GitHub issues side panel to review open requests and recent fixes without leaving Figma.

## Usage
1. Open the plugin in Figma to load the current styles and variables.
2. Search or browse folders, click a style to load it into the detail panel, and expand its layers.
3. Edit hex/opacity, reorder layers, unlink/link variables, or add new solids.
4. Click **Save Changes** or use the batch save control to push all pending changes.
5. Hit **Refresh** if you change styles or variables outside the plugin.

## Preferences
- Density (`compact`, `default`, `comfortable`) and the folder warning badge choice are saved to `figma.clientStorage` to keep your view consistent.

## Accessibility
- Keyboard users can navigate the folder tree and styles list with arrow keys, open the detail panel with Enter/Space, and close menus with Escape thanks to the focus management hooks in `ui.html`.
- Focus indicators, touch-friendly controls help the layout stay readable regardless of theme or density.

## Development notes
- `code.js` talks to the Figma API, tracks drafts, and posts updates back to the UI.
- `ui.html` renders the master/detail screens, handles keyboard behavior, and wires up the picker controls.
- `manifest.json` declares the metadata, entry files, and scope (`figma` editor only).
- GitHub issues data is fetched from the UI without auth, so refreshes are rate-limited; the panel caches recent results in memory.
