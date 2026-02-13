/**
 * Storage interface (START.md Step 14).
 * Swap in-memory/localStorage for fetch() to your backend later.
 */

import type { Annotation } from '../types';

export interface SaveOptions {
  /** When saving an annotation, optionally store a snapshot of the full page. */
  fullPage?: { html: string; baseUrl: string; fullPath: string };
}

/** Options to filter annotations when loading. */
export interface LoadOptions {
  /** Filter by exact page URL. */
  pageUrl?: string;
  /** Filter by base URL (origin). */
  baseUrl?: string;
}

export interface AnnotationStore {
  load(options?: LoadOptions): Promise<Annotation[]>;
  save(annotation: Annotation, options?: SaveOptions): Promise<Annotation>;
  delete(id: string): Promise<void>;
}

/** In-memory implementation for development. */
export function createMemoryStore(): AnnotationStore {
  const store = new Map<string, Annotation>();

  return {
    async load(options?: LoadOptions) {
      let list = Array.from(store.values());
      if (options?.pageUrl) list = list.filter((a) => a.pageUrl === options.pageUrl || a.target?.source === options.pageUrl);
      if (options?.baseUrl) list = list.filter((a) => a.baseUrl === options.baseUrl);
      return list;
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
