/**
 * API layer: storage interface and localStorage implementation.
 */

export type { AnnotationStore, SaveOptions, LoadOptions } from './storage';
export { createMemoryStore } from './storage';
export { createLocalStore } from './local-store';
