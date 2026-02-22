import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  type HighlightColorEntry,
  type PaletteConfig,
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const SECTION_TITLE =
  'text-[11px] font-semibold uppercase tracking-wider text-[var(--ap-muted)] mb-2';

const SWATCH_INSET = 'inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.12)';

// ─── Tooltip ─────────────────────────────────────────────────────────────────

let tooltipEl: HTMLElement | null = null;

function showTooltipAt(anchor: HTMLElement, text: string): void {
  hideTooltipEl();
  const tip = document.createElement('div');
  tip.className =
    'fixed z-[2147483647] py-1 px-2.5 rounded text-[11px] font-sans ' +
    'whitespace-nowrap pointer-events-none select-none';
  tip.style.backgroundColor = '#1a1a1a';
  tip.style.color = '#eee';
  tip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  tip.textContent = text;
  document.body.appendChild(tip);

  const ar = anchor.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const gap = 6;

  let left = ar.left + ar.width / 2 - tw / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - tw - 4));
  let top = ar.top - th - gap;
  if (top < 4) top = ar.bottom + gap;

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tooltipEl = tip;
}

function hideTooltipEl(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

// ─── Inline Editor Popover ───────────────────────────────────────────────────

let activeEditor: HTMLElement | null = null;

function closeEditor(): void {
  if (activeEditor) {
    activeEditor.remove();
    activeEditor = null;
  }
}

interface EditorOpts {
  color: string;
  label: string;
  labelEditable: boolean;
  onSave: (hex: string, label: string) => void;
  onDelete: (() => void) | null;
  anchor: HTMLElement;
  container: HTMLElement;
  config: PaletteConfig;
}

function openEditor(opts: EditorOpts): void {
  closeEditor();

  const editor = document.createElement('div');
  editor.className =
    'rounded-lg overflow-hidden mt-3 mb-1';
  editor.style.backgroundColor = 'var(--ap-surface)';
  editor.style.border = '1px solid var(--ap-border)';

  const inner = document.createElement('div');
  inner.className = 'p-3 flex flex-col gap-3';

  // Color picker row
  const colorRow = document.createElement('div');
  colorRow.className = 'flex items-center gap-3';

  const swatchWrap = document.createElement('div');
  swatchWrap.className = 'relative w-9 h-9 rounded-lg overflow-hidden cursor-pointer shrink-0';
  swatchWrap.style.backgroundColor = opts.color;
  swatchWrap.style.boxShadow = SWATCH_INSET;
  swatchWrap.style.border = '1px solid var(--ap-input-border)';

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'absolute inset-0 w-full h-full opacity-0 cursor-pointer';
  colorInput.value = colorToHex(opts.color);
  swatchWrap.appendChild(colorInput);
  colorRow.appendChild(swatchWrap);

  const hexField = document.createElement('div');
  hexField.className = 'flex-1 min-w-0';
  const hexFieldLabel = document.createElement('div');
  hexFieldLabel.className = 'text-[10px] text-[var(--ap-muted)] uppercase tracking-wider mb-1';
  hexFieldLabel.textContent = 'Hex';
  hexField.appendChild(hexFieldLabel);

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className =
    'text-[12px] text-[var(--ap-input-text)] font-mono outline-none ' +
    'w-full py-1.5 px-2.5 rounded-md transition-colors placeholder:text-[var(--ap-faint)]';
  hexInput.style.border = '1px solid var(--ap-border-md)';
  hexInput.style.backgroundColor = 'var(--ap-hover)';
  hexInput.value = colorToHex(opts.color);
  hexInput.placeholder = '#000000';
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;

  function normalizeHex(raw: string): string | null {
    let v = raw.trim();
    if (!v.startsWith('#')) v = '#' + v;
    v = v.toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return '#' + v[1]! + v[1]! + v[2]! + v[2]! + v[3]! + v[3]!;
    }
    return null;
  }

  colorInput.addEventListener('input', () => {
    swatchWrap.style.backgroundColor = colorInput.value;
    hexInput.value = colorInput.value;
    hexInput.style.borderColor = 'var(--ap-border-md)';
  });

  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) {
      colorInput.value = hex;
      swatchWrap.style.backgroundColor = hex;
      hexInput.style.borderColor = 'var(--ap-border-md)';
    } else {
      hexInput.style.borderColor = 'var(--ap-danger)';
    }
  });

  hexInput.addEventListener('blur', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) {
      hexInput.value = hex;
      colorInput.value = hex;
      swatchWrap.style.backgroundColor = hex;
    }
    hexInput.style.borderColor = 'var(--ap-border-md)';
  });

  hexInput.addEventListener('focus', () => {
    const hex = normalizeHex(hexInput.value);
    hexInput.style.borderColor = hex ? 'var(--ap-input-focus)' : 'var(--ap-danger)';
  });

  hexField.appendChild(hexInput);
  colorRow.appendChild(hexField);
  inner.appendChild(colorRow);

  // Label input
  const labelField = document.createElement('div');
  const labelFieldLabel = document.createElement('div');
  labelFieldLabel.className = 'text-[10px] text-[var(--ap-muted)] uppercase tracking-wider mb-1';
  labelFieldLabel.textContent = 'Label';
  labelField.appendChild(labelFieldLabel);

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className =
    'text-[12px] text-[var(--ap-input-text)] outline-none ' +
    'w-full py-1.5 px-2.5 rounded-md transition-colors placeholder:text-[var(--ap-faint)]';
  labelInput.style.border = '1px solid var(--ap-border-md)';
  labelInput.style.backgroundColor = 'var(--ap-hover)';
  labelInput.value = opts.label;
  labelInput.placeholder = 'Label…';
  labelInput.maxLength = 30;

  if (!opts.labelEditable) {
    labelInput.disabled = true;
    labelInput.style.opacity = '0.6';
    labelInput.style.cursor = 'default';
  }

  labelInput.addEventListener('focus', () => {
    labelInput.style.borderColor = 'var(--ap-input-focus)';
  });
  labelInput.addEventListener('blur', () => {
    labelInput.style.borderColor = 'var(--ap-border-md)';
  });

  labelField.appendChild(labelInput);
  inner.appendChild(labelField);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-2';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className =
    'flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium text-white ' +
    'bg-[#2e7d32] border-none rounded-md py-1.5 cursor-pointer hover:bg-[#256d29] transition-colors';
  saveBtn.innerHTML = `${ICONS.check} <span>Save</span>`;
  saveBtn.addEventListener('click', () => {
    const hex = normalizeHex(hexInput.value) ?? colorInput.value;
    opts.onSave(hex, labelInput.value);
    savePalette(opts.config);
    applySystemColors(opts.config);
    closeEditor();
  });
  actions.appendChild(saveBtn);

  if (opts.onDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className =
      'flex items-center justify-center w-8 h-8 rounded-md border-none ' +
      'bg-transparent text-[var(--ap-icon-idle)] cursor-pointer transition-colors shrink-0';
    deleteBtn.title = 'Remove color';
    deleteBtn.innerHTML = ICONS.trash;
    deleteBtn.style.color = 'var(--ap-danger)';
    deleteBtn.addEventListener('click', () => {
      opts.onDelete!();
      closeEditor();
    });
    actions.appendChild(deleteBtn);
  }

  inner.appendChild(actions);
  editor.appendChild(inner);

  opts.container.appendChild(editor);
  activeEditor = editor;

  colorInput.click();
}

// ─── Swatch Builder ──────────────────────────────────────────────────────────

function buildSwatch(
  color: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'w-7 h-7 rounded-full border-none cursor-pointer shrink-0 ' +
    'transition-all duration-150 hover:scale-110';
  btn.style.backgroundColor = color;
  btn.style.boxShadow = SWATCH_INSET;

  btn.addEventListener('mouseenter', () => showTooltipAt(btn, label));
  btn.addEventListener('mouseleave', () => hideTooltipEl());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltipEl();
    onClick();
  });

  return btn;
}

function buildAddButton(onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'w-7 h-7 rounded-full border border-dashed cursor-pointer shrink-0 ' +
    'transition-all duration-150 hover:scale-110 inline-flex items-center justify-center';
  btn.style.borderColor = 'var(--ap-border-md)';
  btn.style.color = 'var(--ap-muted)';
  btn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>';

  btn.addEventListener('mouseenter', () => showTooltipAt(btn, 'Add color'));
  btn.addEventListener('mouseleave', () => hideTooltipEl());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltipEl();
    onClick();
  });

  return btn;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

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

  const sysGrid = document.createElement('div');
  sysGrid.className = 'flex flex-wrap gap-2 items-center';

  const sysColors: { key: 'iconColor' | 'backgroundColor'; label: string }[] = [
    { key: 'iconColor', label: 'Icon color' },
    { key: 'backgroundColor', label: 'Background' },
  ];

  for (const sc of sysColors) {
    const swatch = buildSwatch(config.system[sc.key], sc.label, () => {
      openEditor({
        color: config.system[sc.key],
        label: sc.label,
        labelEditable: false,
        anchor: swatch,
        container: sysSection,
        onSave: (hex) => {
          config.system[sc.key] = hex;
          swatch.style.backgroundColor = hex;
        },
        onDelete: null,
        config,
      });
    });
    sysGrid.appendChild(swatch);
  }

  sysSection.appendChild(sysGrid);
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

  const hlGrid = document.createElement('div');
  hlGrid.className = 'flex flex-wrap gap-2 items-center';

  function rebuildHighlights(): void {
    hlGrid.innerHTML = '';
    for (let i = 0; i < config.highlights.length; i++) {
      const entry = config.highlights[i]!;
      const isDefault = entry.id === 'default';
      const label = entry.tag || entry.id;

      const swatch = buildSwatch(entry.color, label, () => {
        openEditor({
          color: entry.color,
          label: entry.tag,
          labelEditable: !isDefault,
          anchor: swatch,
          container: hlSection,
          onSave: (hex, tag) => {
            entry.color = hex;
            entry.tag = tag;
            swatch.style.backgroundColor = hex;
          },
          config,
          onDelete: isDefault
            ? null
            : () => {
                config.highlights.splice(i, 1);
                rebuildHighlights();
              },
        });
      });
      hlGrid.appendChild(swatch);
    }

    const addBtn = buildAddButton(() => {
      const newEntry: HighlightColorEntry = { id: uid(), color: '#4fc3f7', tag: '' };
      config.highlights.push(newEntry);
      rebuildHighlights();
      const swatches = hlGrid.querySelectorAll<HTMLButtonElement>('button:not(:last-child)');
      const last = swatches[swatches.length - 1];
      last?.click();
    });
    hlGrid.appendChild(addBtn);
  }

  rebuildHighlights();
  hlSection.appendChild(hlGrid);
  body.appendChild(hlSection);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'mt-4 pt-3 border-t';
  footer.style.borderColor = 'var(--ap-border)';



  body.appendChild(footer);
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
