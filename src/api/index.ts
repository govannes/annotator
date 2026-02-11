/**
 * API layer: storage interface and backend implementation.
 */

export type { AnnotationStore, SaveOptions, LoadOptions } from './storage';
export { createMemoryStore } from './storage';
export { createBackendStore, type BackendStoreConfig } from './backend-store';
export { createNotesApi, type NotesApi, type ListNotesOptions, type CreateNotePayload } from './notes';

