/**
 * Storage interface (START.md Step 14).
 * Swap in-memory/localStorage for fetch() to your backend later.
 */

import type { Annotation } from './types';

export interface SaveOptions {
  /** When saving an annotation, optionally store a snapshot of the full page. */
  fullPage?: { html: string; baseUrl: string; fullPath: string };
}

export interface AnnotationStore {
  load(): Promise<Annotation[]>;
  save(annotation: Annotation, options?: SaveOptions): Promise<Annotation>;
  delete(id: string): Promise<void>;
}

/** In-memory implementation for development. */
export function createMemoryStore(): AnnotationStore {
  const store = new Map<string, Annotation>();

  return {
    async load() {
      return Array.from(store.values());
    },
    async save(annotation: Annotation, _options?: SaveOptions) {
      store.set(annotation.id, annotation);
      return annotation;
    },
    async delete(id: string) {
      store.delete(id);
    },
  };
}
