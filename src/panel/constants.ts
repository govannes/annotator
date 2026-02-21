export const PANEL_ID = 'annotator-extension-panel';
export const TOOLBAR_ID = 'annotator-extension-toolbar';
export const TOOLBAR_DRAG_HANDLE_ID = 'annotator-toolbar-drag-handle';
export const TOOLBAR_OFFSET_STORAGE_KEY = 'annotatorToolbarOffsetX';
export const DB_OVERLAY_ID = 'annotator-db-overlay';
export const POPUP_PANEL_ID = 'annotator-popup-panel';
export const PALETTE_STORAGE_KEY = 'annotator_palette_config';
export const SELECTION_TOOLBAR_ID = 'annotator-selection-toolbar';
export const ACTIVE_HIGHLIGHT_COLOR_KEY = 'annotator_active_highlight_color';

export interface HighlightColorEntry {
  id: string;
  color: string;
  tag: string;
}

export interface PaletteConfig {
  system: {
    iconColor: string;
    backgroundColor: string;
  };
  highlights: HighlightColorEntry[];
}

export const DEFAULT_PALETTE: PaletteConfig = {
  system: {
    iconColor: '#444444',
    backgroundColor: '#f0f0f0',
  },
  highlights: [
    { id: 'default', color: 'rgba(255, 220, 0, 0.35)', tag: 'Default' },
  ],
};
