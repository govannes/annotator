

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
  overlay.className = 'fixed bottom-[70px] left-1/2 -translate-x-1/2 z-[2147483647] bg-[#1e1e1e] text-[#d4d4d4] border border-[#333] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] font-mono text-xs max-w-[600px] w-[90vw] max-h-[50vh] overflow-y-auto p-4';
  return overlay;
}

function buildHeader(pageCount: number, totalCount: number): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-3 pb-2 border-b border-[#333]';
  header.innerHTML = `
    <span class="font-sans text-[13px] font-semibold text-[#eee]">
      Annotations DB (${pageCount} on this page, ${totalCount} total)
    </span>
    <button id="annotator-db-close" class="bg-transparent border-none text-[#888] cursor-pointer text-lg leading-none py-1 px-2 rounded">&times;</button>
  `;
  return header;
}

function buildEmptyCard(): HTMLDivElement {
  const empty = document.createElement('div');
  empty.className = 'text-center py-5 text-[#666] font-sans';
  empty.textContent = 'No annotations for this page.';
  return empty;
}

interface AnnotationCardData {
  id: string;
  selector?: { exact?: string };
  created?: string;
  highlightColor?: string;
}

function buildAnnotationCard(ann: AnnotationCardData): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg py-2.5 px-3 mb-2';
  const quote = ann.selector?.exact ?? '(no quote)';
  const truncated = quote.length > 80 ? quote.slice(0, 80) + '...' : quote;
  const created = ann.created
    ? new Date(ann.created).toLocaleString()
    : 'unknown';
  card.innerHTML = `
    <div class="text-[#e0e0e0] mb-1 font-sans text-[13px]">"${escapeHtml(truncated)}"</div>
    <div class="text-[#888] text-[11px]">
      <span>id: ${escapeHtml(ann.id.slice(0, 8))}...</span>
      <span class="ml-2">created: ${escapeHtml(created)}</span>
      ${ann.highlightColor ? `<span class="ml-2 inline-block w-2.5 h-2.5 rounded-sm align-middle" style="background: ${ann.highlightColor}"></span>` : ''}
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
      (a) => a.pageUrl === pageUrl,
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
