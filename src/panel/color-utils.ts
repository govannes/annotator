import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  type PaletteConfig,
} from './constants';

export function loadPalette(): PaletteConfig {
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

/** Convert any CSS color (including rgba) to a 7-char hex string. */
export function colorToHex(color: string): string {
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

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Convenience: luminance directly from a hex string. */
export function luminance(hex: string): number {
  return relativeLuminance(hexToRgb(hex));
}

export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Mix a foreground color toward white or black until it reaches `minRatio`
 * contrast against `bgLum`.
 */
export function ensureContrast(fg: string, bgLum: number, minRatio: number): string {
  const [r, g, b] = hexToRgb(fg);
  const fgLum = luminance(fg);
  if (contrastRatio(fgLum, bgLum) >= minRatio) return fg;

  const goLight = bgLum <= 0.5;
  const target = goLight ? [255, 255, 255] : [0, 0, 0];

  for (let t = 0.05; t <= 1; t += 0.05) {
    const mr = r + (target[0]! - r) * t;
    const mg = g + (target[1]! - g) * t;
    const mb = b + (target[2]! - b) * t;
    const mixed = rgbToHex(mr, mg, mb);
    if (contrastRatio(luminance(mixed), bgLum) >= minRatio) return mixed;
  }
  return goLight ? '#ffffff' : '#000000';
}

/** Returns white or dark text depending on which has better contrast against `bg`. */
export function contrastingForeground(bgHex: string): string {
  const lum = luminance(bgHex);
  return lum > 0.4 ? '#1a1a1a' : '#ffffff';
}

/**
 * Derive a readable text color from the background.
 * Uses soft contrast (not pure black/white) to reduce eye strain and halation.
 */
export function deriveTextColor(bgHex: string): string {
  const lum = luminance(bgHex);
  return lum > 0.4 ? '#1a1a1a' : '#e8e8e8';
}
