import { loadAnnotations } from '../core';
import { openPanel } from './popup-panel';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmptyCard(): HTMLDivElement {
  const empty = document.createElement('div');
  empty.className = 'text-center py-5 text-[#999] font-sans text-sm';
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
  card.className = 'bg-[#f5f5f5] border border-[#e0e0e0] rounded-lg py-2.5 px-3 mb-2';
  const quote = ann.selector?.exact ?? '(no quote)';
  const truncated = quote.length > 80 ? quote.slice(0, 80) + '...' : quote;
  const created = ann.created
    ? new Date(ann.created).toLocaleString()
    : 'unknown';
  card.innerHTML = `
    <div class="text-[#333] mb-1 font-sans text-[13px]">"${escapeHtml(truncated)}"</div>
    <div class="text-[#888] text-[11px]">
      <span>id: ${escapeHtml(ann.id.slice(0, 8))}...</span>
      <span class="ml-2">created: ${escapeHtml(created)}</span>
      ${ann.highlightColor ? `<span class="ml-2 inline-block w-2.5 h-2.5 rounded-sm align-middle" style="background: ${ann.highlightColor}"></span>` : ''}
    </div>
  `;
  return card;
}

export function setupShowDbButton(): void {
  const btn = document.getElementById('annotator-btn-showdb');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const all = await loadAnnotations();
    const pageUrl = window.location.href;
    const pageAnnotations = all.filter((a) => a.pageUrl === pageUrl);

    const title = `Annotations (${pageAnnotations.length} on page, ${all.length} total)`;

    openPanel('database', title, (body) => {
      if (pageAnnotations.length === 0) {
        body.appendChild(buildEmptyCard());
      } else {
        for (const ann of pageAnnotations) {
          body.appendChild(buildAnnotationCard(ann));
        }
      }
    });
  });
}
