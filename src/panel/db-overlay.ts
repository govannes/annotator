import { loadAnnotations } from '../core';
import { openPanel } from './popup-panel';
import { $id } from './shadow-host';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmptyCard(): HTMLDivElement {
  const empty = document.createElement('div');
  empty.className = 'an:text-center an:py-8 an:text-[#999] an:font-sans an:text-sm';
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
  card.className = 'an:bg-[#f5f5f5] an:border an:border-[#e0e0e0] an:rounded-lg an:py-3 an:px-4 an:mb-3';
  const quote = ann.selector?.exact ?? '(no quote)';
  const truncated = quote.length > 80 ? quote.slice(0, 80) + '...' : quote;
  const created = ann.created
    ? new Date(ann.created).toLocaleString()
    : 'unknown';
  card.innerHTML = `
    <div class="an:text-[#333] an:mb-2 an:font-sans an:text-[13px]">"${escapeHtml(truncated)}"</div>
    <div class="an:text-[#888] an:text-[11px]">
      <span>id: ${escapeHtml(ann.id.slice(0, 8))}...</span>
      <span class="an:ml-2">created: ${escapeHtml(created)}</span>
      ${ann.highlightColor ? `<span class="an:ml-2 an:inline-block an:w-2.5 an:h-2.5 an:rounded-sm an:align-middle" style="background: ${ann.highlightColor}"></span>` : ''}
    </div>
  `;
  return card;
}

export function setupShowDbButton(): void {
  const btn = $id('annotator-btn-showdb');
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
