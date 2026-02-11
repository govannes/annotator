/**
 * Note card for the sidebar (Step 5).
 * Design: title/first line, body, 🔗 Annotation / 🌐 Page / 📁 Project, author · time, Replies (n), "Go to source".
 */

import type { Note } from '../types';

function formatTimeAgo(iso: string): string {
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
    return iso;
  }
}

function firstLine(content: string): string {
  const line = content.split(/\r?\n/)[0]?.trim() ?? '';
  return line.length > 80 ? line.slice(0, 77) + '…' : line;
}

function restOfContent(content: string): string {
  const lines = content.split(/\r?\n/);
  if (lines.length <= 1) return '';
  return lines.slice(1).join('\n').trim();
}

export interface NoteCardOptions {
  /** Count of replies (notes with parentNoteId === note.id). */
  repliesCount?: number;
  /** Callback when "Go to source" is clicked. */
  onGoToSource?: (note: Note) => void;
}

export function renderNoteCard(note: Note, options: NoteCardOptions = {}): HTMLElement {
  const { repliesCount = 0, onGoToSource } = options;
  const title = firstLine(note.content);
  const body = restOfContent(note.content);
  const timeAgo = formatTimeAgo(note.createdAt);
  const authorLabel = note.authorId ? 'Author' : ''; // TODO: resolve via GET /authors/:id
  const metaParts = [authorLabel, timeAgo].filter(Boolean);

  const card = document.createElement('article');
  card.className = 'annotator-note-card';
  card.dataset.noteId = note.id;
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

  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = 'padding: 12px 14px;';

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-weight: 600;
      color: #111;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    `;
    titleEl.textContent = title;
    bodyEl.appendChild(titleEl);
  }

  if (body) {
    const bodyContent = document.createElement('div');
    bodyContent.style.cssText = `
      color: #374151;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    `;
    bodyContent.textContent = body;
    bodyEl.appendChild(bodyContent);
  }

  const icons: string[] = [];
  if (note.annotationId) icons.push('🔗 Annotation');
  if (note.fullPageId) icons.push('🌐 Page');
  if (note.projectId) icons.push('📁 Project');
  if (icons.length > 0) {
    const iconRow = document.createElement('div');
    iconRow.style.cssText = 'color: #6b7280; font-size: 12px; margin-bottom: 6px;';
    iconRow.textContent = icons.join('  ');
    bodyEl.appendChild(iconRow);
  }

  const meta = document.createElement('div');
  meta.style.cssText = 'color: #6b7280; font-size: 12px; margin-bottom: 8px;';
  meta.textContent = metaParts.join(' · ');
  bodyEl.appendChild(meta);

  const footer = document.createElement('div');
  footer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;';

  const left = document.createElement('span');
  left.style.cssText = 'color: #6b7280; font-size: 12px;';
  left.textContent = repliesCount > 0 ? `Replies (${repliesCount})` : 'Replies (0)';
  footer.appendChild(left);

  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.textContent = 'Go to source';
  goBtn.setAttribute('aria-label', 'Go to annotation or page');
  goBtn.style.cssText = `
    padding: 4px 10px;
    font-size: 12px;
    color: #374151;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
  `;
  const canGoToSource = Boolean(note.annotationId || note.fullPageId);
  if (!canGoToSource) {
    goBtn.disabled = true;
    goBtn.title = 'No linked annotation or page';
  }
  goBtn.addEventListener('click', () => {
    if (canGoToSource) onGoToSource?.(note);
  });
  footer.appendChild(goBtn);

  bodyEl.appendChild(footer);
  card.appendChild(bodyEl);

  return card;
}
