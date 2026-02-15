

import { DB_OVERLAY_ID } from './constants';
import { loadAnnotations } from '../core';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOverlayElement(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = DB_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: #1e1e1e;
    color: #d4d4d4;
    border: 1px solid #333;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 12px;
    max-width: 600px;
    width: 90vw;
    max-height: 50vh;
    overflow-y: auto;
    padding: 16px;
  `;
  return overlay;
}

function buildHeader(pageCount: number, totalCount: number): HTMLDivElement {
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #333;
  `;
  header.innerHTML = `
    <span style="font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; color: #eee;">
      Annotations DB (${pageCount} on this page, ${totalCount} total)
    </span>
    <button id="annotator-db-close" style="
      background: none; border: none; color: #888; cursor: pointer;
      font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 4px;
    ">&times;</button>
  `;
  return header;
}

function buildEmptyCard(): HTMLDivElement {
  const empty = document.createElement('div');
  empty.style.cssText =
    'text-align: center; padding: 20px; color: #666; font-family: system-ui, sans-serif;';
  empty.textContent = 'No annotations for this page.';
  return empty;
}

interface AnnotationCardData {
  id: string;
  target?: { selector?: { textQuote?: { exact?: string } } };
  created?: string;
  highlightColor?: string;
}

function buildAnnotationCard(ann: AnnotationCardData): HTMLDivElement {
  const card = document.createElement('div');
  card.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
  `;
  const quote = ann.target?.selector?.textQuote?.exact ?? '(no quote)';
  const truncated = quote.length > 80 ? quote.slice(0, 80) + '...' : quote;
  const created = ann.created
    ? new Date(ann.created).toLocaleString()
    : 'unknown';
  card.innerHTML = `
    <div style="color: #e0e0e0; margin-bottom: 4px; font-family: system-ui, sans-serif; font-size: 13px;">"${escapeHtml(truncated)}"</div>
    <div style="color: #888; font-size: 11px;">
      <span>id: ${escapeHtml(ann.id.slice(0, 8))}...</span>
      <span style="margin-left: 8px;">created: ${escapeHtml(created)}</span>
      ${ann.highlightColor ? `<span style="margin-left: 8px; display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${ann.highlightColor}; vertical-align: middle;"></span>` : ''}
    </div>
  `;
  return card;
}

function addClickOutsideDismiss(
  overlay: HTMLElement,
  toggleButtonId: string,
): void {
  function onClickOutside(e: MouseEvent): void {
    if (
      !overlay.contains(e.target as Node) &&
      (e.target as Element)?.id !== toggleButtonId
    ) {
      overlay.remove();
      document.removeEventListener('click', onClickOutside, true);
    }
  }
  setTimeout(
    () => document.addEventListener('click', onClickOutside, true),
    0,
  );
}

export function setupShowDbButton(
): void {
  const btn = document.getElementById('annotator-btn-showdb');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    
    const existing = document.getElementById(DB_OVERLAY_ID);
    if (existing) {
      existing.remove();
      return;
    }

    const all = await loadAnnotations();
    const pageUrl = window.location.href;
    const pageAnnotations = all.filter(
      (a) => a.pageUrl === pageUrl || a.target?.source === pageUrl,
    );

    const overlay = buildOverlayElement();
    overlay.appendChild(buildHeader(pageAnnotations.length, all.length));

    if (pageAnnotations.length === 0) {
      overlay.appendChild(buildEmptyCard());
    } else {
      for (const ann of pageAnnotations) {
        overlay.appendChild(buildAnnotationCard(ann));
      }
    }

    document.body.appendChild(overlay);

    document
      .getElementById('annotator-db-close')
      ?.addEventListener('click', () => overlay.remove());

    addClickOutsideDismiss(overlay, 'annotator-btn-showdb');
  });
}
