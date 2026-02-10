# Chrome Side Panel

The extension can show a **Side Panel** in the browser chrome (next to the address bar). The panel is always on the side and is not affected by page layout, transforms, or scroll.

## How to open the Side Panel

1. **Toolbar:** Click the extension icon (puzzle piece → Annotator), or pin Annotator to the toolbar and click it.
2. **Menu:** Right-click the extension icon → **Open side panel**.

Chrome may show the side panel on the right or left depending on user settings.

## Current behavior

- **sidepanel.html** is a static panel that explains the Side Panel. It does not yet load annotations.
- **In-page sidebar** (green trigger on the page) is the full UI: it uses a **fixed viewport overlay** so it stays on the side regardless of where the page appends our DOM. If the sidebar still appears at the bottom on some sites, those pages likely use `transform`/`filter`/`perspective` on an ancestor, which changes how `position: fixed` works; using the **Chrome Side Panel** avoids that entirely.

## Wiring the Side Panel to annotations (future)

To show the full Highlighter UI inside the Side Panel:

1. **Build a side panel bundle** (e.g. `sidepanel.js`) that renders the same sidebar shell and tabs, but gets data via messaging instead of from the page.
2. **Content script** handles messages from the side panel, e.g.:
   - `getPageUrl` → return `window.location.href`
   - `getAnnotations` → call `getStore().then(s => s.load())` and return annotations for the current tab.
3. **Side panel** sends `chrome.tabs.sendMessage(tabId, { type: 'getAnnotations' })` (or similar) to the active tab’s content script and renders the list.
4. **“Go to source”** in the panel could focus the tab and send a message to the content script to scroll to the annotation and open the in-page sidebar.

The Side Panel has no access to the page DOM, so highlighting and “scroll to highlight” still require the content script on the page.
