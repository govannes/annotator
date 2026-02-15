import type { Annotation } from '../types';

export interface SaveOptions {
    fullPage?: { html: string; baseUrl: string; fullPath: string };
}

export interface LoadOptions {
    pageUrl?: string;
    baseUrl?: string;
}

export interface AnnotationStore {
  load(options?: LoadOptions): Promise<Annotation[]>;
  save(annotation: Annotation, options?: SaveOptions): Promise<Annotation>;
  delete(id: string): Promise<void>;
}

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
