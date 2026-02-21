import {
  PALETTE_STORAGE_KEY,
  DEFAULT_PALETTE,
  type PaletteConfig,
  type HighlightColorEntry,
} from './constants';
import { ICONS } from './icons';
import { openPanel, refreshPanelTheme } from './popup-panel';

function loadPalette(): PaletteConfig {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_PALETTE);
    const parsed = JSON.parse(raw) as PaletteConfig;
    if (!parsed.system || !Array.isArray(parsed.highlights)) {
      return structuredClone(DEFAULT_PALETTE);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_PALETTE);
  }
}

function savePalette(config: PaletteConfig): void {
  localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(config));
}

function uid(): string {
  return 'hl_' + Math.random().toString(36).slice(2, 9);
}

/** Convert any CSS color (including rgba) to a hex string for <input type="color">. */
function colorToHex(color: string): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) return color;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = color;
  const computed = ctx.fillStyle;
  if (computed.startsWith('#')) return computed;
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]!, 10);
  const g = parseInt(match[2]!, 10);
  const b = parseInt(match[3]!, 10);
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ─── Styles (referencing --ap-* CSS vars set on the popup panel root) ────────

const SECTION_TITLE =
  'text-[11px] font-semibold uppercase tracking-wider text-[var(--ap-muted)] mb-2';

const COLOR_ROW =
  'flex items-center gap-2.5 mb-2 last:mb-0';

const SWATCH_INSET = 'inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.12)';

const COLOR_INPUT_WRAP =
  'relative w-7 h-7 rounded-md overflow-hidden border cursor-pointer shrink-0 transition-colors';

const COLOR_INPUT =
  'absolute inset-0 w-full h-full opacity-0 cursor-pointer';

const COLOR_LABEL =
  'text-[12px] text-[var(--ap-text)] select-none opacity-80';

const TAG_INPUT =
  'bg-transparent border-none text-[12px] text-[var(--ap-input-text)] outline-none ' +
  'w-full py-0.5 transition-colors placeholder:text-[var(--ap-faint)]';

const ICON_BTN_DANGER =
  'w-6 h-6 rounded-md border-none bg-transparent text-[var(--ap-icon-idle)] cursor-pointer inline-flex ' +
  'items-center justify-center transition-colors shrink-0';

const ADD_BTN =
  'flex items-center gap-1.5 text-[12px] text-[var(--ap-muted)] bg-transparent border border-dashed ' +
  'rounded-lg py-1.5 px-3 cursor-pointer transition-colors w-full justify-center mt-2';

const SAVE_BTN =
  'flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-[#2e7d32] ' +
  'border-none rounded-lg py-2 px-4 cursor-pointer hover:bg-[#256d29] transition-colors ' +
  'shadow-sm w-full';

const RESET_BTN =
  'flex items-center justify-center gap-1.5 text-[11px] text-[var(--ap-faint)] bg-transparent ' +
  'border-none cursor-pointer transition-colors py-1';

// ─── Rendering ───────────────────────────────────────────────────────────────

function buildColorRow(
  label: string,
  color: string,
  onChange: (hex: string) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = COLOR_ROW;

  const swatch = document.createElement('div');
  swatch.className = COLOR_INPUT_WRAP;
  swatch.style.backgroundColor = color;
  swatch.style.borderColor = 'var(--ap-input-border)';
  swatch.style.boxShadow = SWATCH_INSET;

  const input = document.createElement('input');
  input.type = 'color';
  input.className = COLOR_INPUT;
  input.value = colorToHex(color);
  input.addEventListener('input', () => {
    swatch.style.backgroundColor = input.value;
    onChange(input.value);
  });

  swatch.appendChild(input);
  row.appendChild(swatch);

  const lbl = document.createElement('span');
  lbl.className = COLOR_LABEL;
  lbl.textContent = label;
  row.appendChild(lbl);

  return row;
}

function buildHighlightRow(
  entry: HighlightColorEntry,
  isDefault: boolean,
  onColorChange: (hex: string) => void,
  onTagChange: (tag: string) => void,
  onDelete: (() => void) | null,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className =
    'flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1.5 last:mb-0 ' +
    'group transition-colors';
  row.style.backgroundColor = 'var(--ap-surface)';
  row.style.border = '1px solid var(--ap-border)';

  const swatch = document.createElement('div');
  swatch.className = COLOR_INPUT_WRAP;
  swatch.style.backgroundColor = entry.color;
  swatch.style.borderColor = 'var(--ap-input-border)';
  swatch.style.boxShadow = SWATCH_INSET;

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = COLOR_INPUT;
  colorInput.value = colorToHex(entry.color);
  colorInput.addEventListener('input', () => {
    swatch.style.backgroundColor = colorInput.value;
    onColorChange(colorInput.value);
  });
  swatch.appendChild(colorInput);
  row.appendChild(swatch);

  const tagWrap = document.createElement('div');
  tagWrap.className = 'flex-1 min-w-0';

  const tagInput = document.createElement('input');
  tagInput.type = 'text';
  tagInput.className = TAG_INPUT;
  tagInput.value = entry.tag;
  tagInput.placeholder = 'Tag name…';
  tagInput.maxLength = 30;
  tagInput.style.borderBottom = '1px solid var(--ap-input-border)';
  if (isDefault) {
    tagInput.disabled = true;
    tagInput.style.color = 'var(--ap-faint)';
    tagInput.style.cursor = 'default';
  }
  tagInput.addEventListener('input', () => onTagChange(tagInput.value));
  tagWrap.appendChild(tagInput);
  row.appendChild(tagWrap);

  if (onDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = ICON_BTN_DANGER;
    deleteBtn.title = 'Remove color';
    deleteBtn.innerHTML = ICONS.trash;
    deleteBtn.addEventListener('click', onDelete);
    row.appendChild(deleteBtn);
  }

  return row;
}

function renderPaletteContent(body: HTMLElement): void {
  const config = loadPalette();
  body.innerHTML = '';
  body.style.padding = '12px 16px 16px';

  // ── System Colors ─────────────────────────────────────────────────────────
  const sysSection = document.createElement('div');
  sysSection.className = 'mb-4';

  const sysTitle = document.createElement('div');
  sysTitle.className = SECTION_TITLE;
  sysTitle.textContent = 'System Colors';
  sysSection.appendChild(sysTitle);

  const sysDesc = document.createElement('div');
  sysDesc.className = 'text-[11px] text-[var(--ap-subtle)] mb-3 leading-relaxed';
  sysDesc.textContent = 'Toolbar appearance — text adapts automatically.';
  sysSection.appendChild(sysDesc);

  sysSection.appendChild(
    buildColorRow('Icon color', config.system.iconColor, (hex) => {
      config.system.iconColor = hex;
    }),
  );
  sysSection.appendChild(
    buildColorRow('Background', config.system.backgroundColor, (hex) => {
      config.system.backgroundColor = hex;
    }),
  );

  body.appendChild(sysSection);

  // ── Divider ───────────────────────────────────────────────────────────────
  const divider = document.createElement('div');
  divider.className = 'border-t my-1';
  divider.style.borderColor = 'var(--ap-border)';
  body.appendChild(divider);

  // ── Highlight Colors ──────────────────────────────────────────────────────
  const hlSection = document.createElement('div');
  hlSection.className = 'mt-3';

  const hlTitle = document.createElement('div');
  hlTitle.className = SECTION_TITLE;
  hlTitle.textContent = 'Highlight Colors';
  hlSection.appendChild(hlTitle);

  const hlDesc = document.createElement('div');
  hlDesc.className = 'text-[11px] text-[var(--ap-subtle)] mb-3 leading-relaxed';
  hlDesc.textContent = 'Create tagged colors for different highlight types.';
  hlSection.appendChild(hlDesc);

  const hlList = document.createElement('div');

  function rebuildHighlights(): void {
    hlList.innerHTML = '';
    for (let i = 0; i < config.highlights.length; i++) {
      const entry = config.highlights[i]!;
      const isDefault = entry.id === 'default';
      hlList.appendChild(
        buildHighlightRow(
          entry,
          isDefault,
          (hex) => { entry.color = hex; },
          (tag) => { entry.tag = tag; },
          isDefault
            ? null
            : () => {
                config.highlights.splice(i, 1);
                rebuildHighlights();
              },
        ),
      );
    }
  }

  rebuildHighlights();
  hlSection.appendChild(hlList);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = ADD_BTN;
  addBtn.style.borderColor = 'var(--ap-border-md)';
  addBtn.innerHTML = `${ICONS.plus} <span>Add color</span>`;
  addBtn.addEventListener('click', () => {
    config.highlights.push({ id: uid(), color: '#4fc3f7', tag: '' });
    rebuildHighlights();
    const lastInput = hlList.querySelector<HTMLInputElement>(
      '.group:last-child input[type="text"]',
    );
    lastInput?.focus();
  });
  hlSection.appendChild(addBtn);

  body.appendChild(hlSection);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'mt-4 pt-3 border-t';
  footer.style.borderColor = 'var(--ap-border)';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = SAVE_BTN;
  saveBtn.innerHTML = `${ICONS.check} <span>Save</span>`;
  saveBtn.addEventListener('click', () => {
    savePalette(config);
    applySystemColors(config);
    showToast(body, 'Palette saved');
  });
  footer.appendChild(saveBtn);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = RESET_BTN;
  resetBtn.innerHTML = `${ICONS.reset} <span>Reset to defaults</span>`;
  resetBtn.addEventListener('click', () => {
    savePalette(structuredClone(DEFAULT_PALETTE));
    applySystemColors(DEFAULT_PALETTE);
    renderPaletteContent(body);
  });
  footer.appendChild(resetBtn);

  body.appendChild(footer);
}

function showToast(container: HTMLElement, message: string): void {
  const existing = container.querySelector('.palette-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className =
    'palette-toast fixed left-1/2 bottom-[140px] z-[2147483647] -translate-x-1/2 ' +
    'bg-[#333] text-white text-[12px] py-1.5 px-4 rounded-full shadow-lg ' +
    'opacity-0 transition-opacity duration-200';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 1500);
}

// ─── Color math (WCAG relative luminance) ────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Returns white or dark text depending on which has better contrast against `bg`. */
function contrastingForeground(bgHex: string): string {
  const lum = relativeLuminance(hexToRgb(bgHex));
  return lum > 0.4 ? '#1a1a1a' : '#ffffff';
}

/**
 * Derive a readable text color from the background.
 * Uses soft contrast (not pure black/white) to reduce eye strain and halation
 * — easier for people with astigmatism (~50% of population).
 */
function deriveTextColor(bgHex: string): string {
  const lum = relativeLuminance(hexToRgb(bgHex));
  return lum > 0.4 ? '#1a1a1a' : '#e8e8e8';
}

// ─── Apply system colors to the toolbar ──────────────────────────────────────

function applySystemColors(config: PaletteConfig): void {
  const toolbar = document.getElementById('annotator-extension-toolbar');
  if (!toolbar) return;

  const bgHex = colorToHex(config.system.backgroundColor);
  const textColor = deriveTextColor(bgHex);

  toolbar.style.backgroundColor = config.system.backgroundColor;
  toolbar.style.color = textColor;

  const iconHex = colorToHex(config.system.iconColor);
  const bgLum = relativeLuminance(hexToRgb(bgHex));
  const dividerColor = bgLum > 0.5
    ? 'rgba(0, 0, 0, 0.12)'
    : 'rgba(255, 255, 255, 0.15)';

  const activeBg = iconHex;
  const activeFg = contrastingForeground(iconHex);

  toolbar.querySelectorAll<HTMLElement>('button, [id$="drag-handle"]').forEach((el) => {
    el.style.color = config.system.iconColor;
  });

  toolbar.querySelectorAll<HTMLElement>('[data-divider]').forEach((el) => {
    el.style.borderColor = dividerColor;
  });

  const toggleGroup = toolbar.querySelector<HTMLElement>('[data-toggle-group]');
  if (toggleGroup) {
    const [r, g, b] = hexToRgb(iconHex);
    toggleGroup.style.color = `rgba(${r}, ${g}, ${b}, 0.45)`;
    toggleGroup.style.backgroundColor = 'transparent';
  }

  toolbar.querySelectorAll<HTMLElement>('button[data-mode]').forEach((btn) => {
    const isActive = btn.classList.contains('bg-[#2e7d32]');
    if (isActive) {
      btn.style.backgroundColor = activeBg;
      btn.style.color = activeFg;
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = config.system.iconColor;
    }
  });

  applyPopupPanelColors(config);
}

function applyPopupPanelColors(config: PaletteConfig): void {
  refreshPanelTheme(config.system.backgroundColor);
}

/** Apply saved palette on toolbar injection. */
export function applySavedPalette(): void {
  const config = loadPalette();
  applySystemColors(config);
}

/** Returns all configured highlight colors. */
export function getHighlightColors(): HighlightColorEntry[] {
  return loadPalette().highlights;
}

/** Returns the active/default highlight color. */
export function getActiveHighlightColor(): string {
  const palette = loadPalette();
  return palette.highlights[0]?.color ?? DEFAULT_PALETTE.highlights[0]!.color;
}

export function openPalettePanel(): void {
  openPanel('palette', 'Palette', renderPaletteContent);
}
