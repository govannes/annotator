/**
 * API layer: storage interface and backend implementation.
 */

export type { AnnotationStore, SaveOptions } from './storage';
export { createMemoryStore } from './storage';
export { createBackendStore, type BackendStoreConfig } from './backend-store';

