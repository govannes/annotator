# Browser extension

Run the annotator on any website via a Chrome/Edge extension. Annotations are stored in the extension’s storage (keyed by page URL).

## Build

```bash
npm run build:extension
```

Output: `dist-extension/` with `content.js` and `manifest.json`.

## Load in Chrome (or Edge)

1. Open **chrome://extensions** (or **edge://extensions**).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Choose the **`dist-extension`** folder (inside this repo).

The extension should appear in the list and be enabled.

## Use on a real website

1. Go to any page (e.g. a news article, Wikipedia).
2. A small **Annotator** panel appears at the bottom-right. The **sidebar** and **trigger** are in a fixed viewport overlay so they stay on the side (they no longer “append to the bottom” on flex/grid pages).
3. You can also open **Chrome’s Side Panel** (click the extension icon or right-click → Open side panel) for a chrome-level panel; see [SIDEPANEL.md](./SIDEPANEL.md).
4. Select some text on the page.
4. Click **Add annotation** in the panel. The selection is saved and highlighted.
5. Reload the page: highlights are re-attached from stored selectors.
6. **Re-attach** restores the last selection you made (for testing anchoring).

Annotations are stored via the backend API (see BACKEND-STORAGE.md). Configure the API URL in `chrome.storage.local.annotatorApiUrl` or use the default (localhost:3000).

## Technical notes

- **Content script** runs at `document_idle` on `<all_urls>`.
- **Storage**: Backend API (configurable via `annotatorApiUrl` in chrome.storage.local).
- **Root**: The whole page body is the annotation root; the floating panel is injected by the content script.
- The same highlight algorithm and anchoring (Range → TextPosition → TextQuote) are used as in the web app.

## Development

After changing code, run `npm run build:extension` again, then go to **chrome://extensions** and click the **Reload** icon on the Annotator extension.
