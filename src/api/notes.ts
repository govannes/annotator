/**
 * Notes API client (GET /notes, POST /notes).
 * Uses same base URL for GET /authors (required for note creation).
 * See BACKEND.md — Notes, Authors.
 */

import type { Note, Author } from '../types';

export interface ListNotesOptions {
  annotationId?: string;
  fullPageId?: string;
  projectId?: string;
  authorId?: string;
  parentNoteId?: string;
}

export interface CreateNotePayload {
  content: string;
  authorId: string;
  annotationId?: string;
  fullPageId?: string;
  parentNoteId?: string;
  projectId?: string;
}

export interface NotesApi {
  listNotes(options?: ListNotesOptions): Promise<Note[]>;
  createNote(payload: CreateNotePayload): Promise<Note>;
  getAuthors(): Promise<Author[]>;
}

/**
 * Create a notes API client using the given base URL.
 */
export function createNotesApi(baseUrl: string): NotesApi {
  const base = baseUrl.replace(/\/$/, '');

  return {
    async listNotes(options?: ListNotesOptions): Promise<Note[]> {
      const params = new URLSearchParams();
      if (options?.annotationId) params.set('annotationId', options.annotationId);
      if (options?.fullPageId) params.set('fullPageId', options.fullPageId);
      if (options?.projectId) params.set('projectId', options.projectId);
      if (options?.authorId) params.set('authorId', options.authorId);
      if (options?.parentNoteId) params.set('parentNoteId', options.parentNoteId);
      const qs = params.toString();
      const url = qs ? `${base}/notes?${qs}` : `${base}/notes`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Notes API failed: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data as Note[];
    },

    async createNote(payload: CreateNotePayload): Promise<Note> {
      const res = await fetch(`${base}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Create note failed: ${res.status} ${res.statusText} — ${text}`);
      }
      return (await res.json()) as Note;
    },

    async getAuthors(): Promise<Author[]> {
      const res = await fetch(`${base}/authors`);
      if (!res.ok) throw new Error(`Authors API failed: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data as Author[];
    },
  };
}
