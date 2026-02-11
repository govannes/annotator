/**
 * Notes tab: current page only. Create notes linked to page annotations; list note cards, "Go to source".
 */

import type { AnnotationStore } from '../api';
import type { NotesApi } from '../api';
import type { Note, Annotation } from '../types';
import { renderNoteCard } from './note-card';

export interface NotesTabDeps {
  getStore: () => Promise<AnnotationStore>;
  getPageUrl: () => string;
  getNotesApi: () => Promise<NotesApi>;
  onGoToSource: (note: Note) => void;
  /** Call after creating a note to refresh the list. */
  onRefresh: () => void;
}

function snippet(ann: Annotation, maxLen = 48): string {
  const exact = ann.target?.selector?.textQuote?.exact ?? '';
  const t = exact.trim();
  return t.length > maxLen ? t.slice(0, maxLen - 1) + '…' : t;
}

/**
 * Renders the Notes tab (current page only): create note + list notes linked to this page's annotations.
 */
export async function renderNotesTab(
  container: HTMLElement,
  _context: 'this-page',
  deps: NotesTabDeps
): Promise<void> {
  const { getStore, getPageUrl, getNotesApi, onGoToSource, onRefresh } = deps;
  container.innerHTML = '';
  container.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    color: #374151;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;

  const loading = document.createElement('div');
  loading.style.cssText = 'color: #6b7280; font-size: 13px;';
  loading.textContent = 'Loading…';
  container.appendChild(loading);

  try {
    const notesApi = await getNotesApi();
    const store = await getStore();
    const pageUrl = getPageUrl();

    const pageAnnotations = await store.load({ pageUrl });
    const pageAnnotationIds = new Set(pageAnnotations.map((a) => a.id));
    const allNotes = await notesApi.listNotes({});
    const list = allNotes.filter((n) => n.annotationId && pageAnnotationIds.has(n.annotationId));

    const authors = await notesApi.getAuthors();
    const defaultAuthorId = authors.length > 0 ? authors[0].id : null;

    loading.remove();

    // —— New note section (always at top) ——
    const createSection = document.createElement('section');
    createSection.className = 'annotator-notes-create';
    createSection.style.cssText = `
      flex-shrink: 0;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 14px;
    `;

    const createTitle = document.createElement('div');
    createTitle.style.cssText = 'font-weight: 600; color: #111; font-size: 13px; margin-bottom: 10px;';
    createTitle.textContent = 'New note';
    createSection.appendChild(createTitle);

    const contentLabel = document.createElement('label');
    contentLabel.style.cssText = 'display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px;';
    contentLabel.textContent = 'Content';
    createSection.appendChild(contentLabel);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write your note…';
    textarea.rows = 3;
    textarea.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      font-size: 13px;
      font-family: inherit;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      resize: vertical;
      color: #111;
    `;
    createSection.appendChild(textarea);

    let annotationSelect: HTMLSelectElement | null = null;
    if (pageAnnotations.length > 0) {
      const linkLabel = document.createElement('label');
      linkLabel.style.cssText = 'display: block; font-size: 12px; color: #6b7280; margin: 10px 0 4px;';
      linkLabel.textContent = 'Link to annotation on this page';
      createSection.appendChild(linkLabel);
      annotationSelect = document.createElement('select');
      annotationSelect.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        font-size: 13px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #374151;
        background: #fff;
      `;
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = '(None)';
      annotationSelect.appendChild(noneOpt);
      for (const ann of pageAnnotations) {
        const opt = document.createElement('option');
        opt.value = ann.id;
        opt.textContent = snippet(ann);
        annotationSelect.appendChild(opt);
      }
      createSection.appendChild(annotationSelect);
    }

    if (!defaultAuthorId) {
      const noAuthor = document.createElement('p');
      noAuthor.style.cssText = 'font-size: 12px; color: #b91c1c; margin: 8px 0 0;';
      noAuthor.textContent = 'No authors. Create one via the API to add notes.';
      createSection.appendChild(noAuthor);
    }

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.textContent = 'Create note';
    createBtn.style.cssText = `
      margin-top: 10px;
      padding: 6px 12px;
      font-size: 13px;
      color: #fff;
      background: #2563eb;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    `;
    createBtn.disabled = !defaultAuthorId;

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size: 12px; margin-top: 6px; min-height: 18px;';

    createBtn.addEventListener('click', async () => {
      const content = textarea.value.trim();
      if (!content) {
        statusEl.textContent = 'Enter some content.';
        statusEl.style.color = '#b91c1c';
        return;
      }
      if (!defaultAuthorId) return;
      createBtn.disabled = true;
      statusEl.textContent = 'Creating…';
      statusEl.style.color = '#6b7280';
      try {
        await notesApi.createNote({
          content,
          authorId: defaultAuthorId,
          annotationId: annotationSelect?.value || undefined,
        });
        textarea.value = '';
        if (annotationSelect) annotationSelect.value = '';
        statusEl.textContent = 'Note created.';
        statusEl.style.color = '#059669';
        onRefresh();
      } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : 'Failed to create note';
        statusEl.style.color = '#b91c1c';
      } finally {
        createBtn.disabled = false;
      }
    });

    createSection.appendChild(createBtn);
    createSection.appendChild(statusEl);
    container.appendChild(createSection);

    // —— Notes list ——
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; padding: 24px 16px; color: #6b7280; flex: 1;';
      empty.innerHTML = `
        <p style="margin: 0 0 8px; font-size: 14px;">No notes yet</p>
        <p style="margin: 0; font-size: 13px;">Create your first idea above</p>
      `;
      container.appendChild(empty);
    } else {
      const listEl = document.createElement('div');
      listEl.style.cssText = 'display: flex; flex-direction: column; flex: 1;';
      for (const note of list) {
        const card = renderNoteCard(note, {
          repliesCount: 0,
          onGoToSource,
        });
        listEl.appendChild(card);
      }
      container.appendChild(listEl);
    }
  } catch (err) {
    loading.remove();
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color: #b91c1c; font-size: 13px; padding: 16px;';
    errEl.textContent = err instanceof Error ? err.message : 'Failed to load notes';
    container.appendChild(errEl);
  }
}
