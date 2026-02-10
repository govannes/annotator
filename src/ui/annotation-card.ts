/**
 * Single annotation card for the sidebar list (white card style).
 * Quote + body + date; we may extend with author/replies later.
 */

import type { Annotation } from '../types';

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function renderAnnotationCard(ann: Annotation): HTMLElement {
  const quote = ann.target?.selector?.textQuote?.exact ?? '';
  const body = ann.body?.value ?? '';
  const created = formatDate(ann.created);

  const card = document.createElement('article');
  card.className = 'annotator-annotation-card';
  card.dataset.annotationId = ann.id;
  card.style.cssText = `
    background: #fff;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    border: 1px solid #e5e7eb;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    line-height: 1.45;
  `;

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;';
  header.innerHTML = `
    <span style="font-weight: 600; color: #111;">Note</span>
    <span style="color: #6b7280; font-size: 12px;">${created}</span>
  `;
  card.appendChild(header);

  if (quote.trim()) {
    const quoteBlock = document.createElement('div');
    quoteBlock.style.cssText = `
      border-left: 3px solid #3b82f6;
      padding-left: 10px;
      margin-bottom: 8px;
      color: #4b5563;
      font-style: italic;
    `;
    quoteBlock.textContent = quote;
    card.appendChild(quoteBlock);
  }

  if (body.trim()) {
    const bodyEl = document.createElement('div');
    bodyEl.style.cssText = 'color: #111; white-space: pre-wrap; word-break: break-word;';
    bodyEl.textContent = body;
    card.appendChild(bodyEl);
  }

  if (!quote.trim() && !body.trim()) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: #9ca3af; font-style: italic;';
    empty.textContent = 'No text';
    card.appendChild(empty);
  }

  return card;
}
