export {
  DB_OVERLAY_ID, PANEL_ID, POPUP_PANEL_ID,
  SELECTION_TOOLBAR_ID
} from './constants';
export type { HighlightColorEntry, PaletteConfig } from './constants';

export { setupShowDbButton } from './db-overlay';
export { getActiveHighlightColor, getHighlightColors } from './palette-panel';
export { closePanel, getOpenPanelId, openPanel, syncPanelOffset } from './popup-panel';
export { destroySelectionToolbar, hideSelectionToolbar, initSelectionToolbar } from './selection-toolbar';
export { applyHighlightVisibility, getActiveMode, injectToolbar, isHighlightDisabled, registerInkCallback } from './toolbar';

export { renderCapturePanel } from './panels/capture-panel';
export { renderScreenshotPanel } from './panels/screenshot-panel';
export { renderNotePanel } from './panels/note-panel';
export { renderSwipePanel } from './panels/swipe-panel';
export { renderColorsPanel } from './panels/colors-panel';
export { renderAIPanel } from './panels/ai-panel';
export { renderSettingsPanel } from './panels/settings-panel';
