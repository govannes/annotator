/**
 * Annotation card for the sidebar (Step 4).
 * Design: color strip, snippet, author · time · project, optional comment, "Notes (n)", "Go to source".
 */

import type { Annotation } from '../types';

function formatTimeAgo(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const ms = now - d.getTime();
    if (ms < 60_000) return 'Just now';
    if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`;
    if (ms < 604800_000) return `${Math.floor(ms / 86400_000)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso ?? '';
  }
}

export interface AnnotationCardOptions {
  /** Note count for this annotation (overrides ann.noteCount when provided). */
  noteCount?: number;
  /** Callback when "Go to source" is clicked. */
  onGoToSource?: (annotationId: string) => void;
}

export function renderAnnotationCard(
  ann: Annotation,
  options: AnnotationCardOptions = {}
): HTMLElement {
  const noteCount = options.noteCount ?? ann.noteCount ?? 0;
  const { onGoToSource } = options;
  const snippet = ann.target?.selector?.textQuote?.exact ?? '';
  const comment = ann.body?.value ?? '';
  const color = ann.highlightColor ?? 'rgba(255, 220, 0, 0.35)';
  const timeAgo = formatTimeAgo(ann.created);
  const authorLabel = ann.authorId ? 'Author' : ''; // TODO: resolve author name via GET /authors/:id
  const projectLabel = ann.projectId ? 'Project' : ''; // TODO: resolve project name via GET /projects/:id
  const metaParts = [authorLabel, timeAgo, projectLabel].filter(Boolean);

  const card = document.createElement('article');
  card.className = 'annotator-annotation-card';
  card.dataset.annotationId = ann.id;
  card.style.cssText = `
    background: #fff;
    border-radius: 8px;
    padding: 0;
    margin-bottom: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    border: 1px solid #e8e8e8;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    overflow: hidden;
  `;

  const colorStrip = document.createElement('div');
  colorStrip.style.cssText = `height: 4px; background: ${color};`;
  card.appendChild(colorStrip);

  const body = document.createElement('div');
  body.style.cssText = 'padding: 12px 14px;';

  if (snippet.trim()) {
    const quoteEl = document.createElement('div');
    quoteEl.style.cssText = `
      color: #374151;
      margin-bottom: 8px;
      font-style: italic;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    `;
    quoteEl.textContent = `"${snippet.trim()}"`;
    body.appendChild(quoteEl);
  }

  const meta = document.createElement('div');
  meta.style.cssText = 'color: #6b7280; font-size: 12px; margin-bottom: 8px;';
  meta.textContent = metaParts.join(' · ');
  body.appendChild(meta);

  if (comment.trim()) {
    const commentEl = document.createElement('div');
    commentEl.style.cssText = 'color: #111; white-space: pre-wrap; word-break: break-word; margin-bottom: 8px;';
    commentEl.textContent = comment;
    body.appendChild(commentEl);
  }

  const footer = document.createElement('div');
  footer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;';

  const left = document.createElement('span');
  left.style.cssText = 'color: #6b7280; font-size: 12px;';
  left.textContent = noteCount > 0 ? `Notes (${noteCount})` : 'Notes (0)';
  footer.appendChild(left);

  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.textContent = 'Go to source';
  goBtn.setAttribute('aria-label', 'Scroll to highlight on page');
  goBtn.style.cssText = `
    padding: 4px 10px;
    font-size: 12px;
    color: #374151;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
  `;
  goBtn.addEventListener('click', () => {
    onGoToSource?.(ann.id);
  });
  footer.appendChild(goBtn);

  body.appendChild(footer);
  card.appendChild(body);

  return card;
}
