import type { Annotation } from '../types';
import type { AnnotationStore, LoadOptions, SaveOptions } from './storage';

const STORAGE_KEY = 'annotator_annotations';

function readAll(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(annotations: Annotation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

export function createLocalStore(): AnnotationStore {
  return {
    async load(options?: LoadOptions): Promise<Annotation[]> {
      let list = readAll();
      if (options?.pageUrl) {
        list = list.filter(
          (a) => a.pageUrl === options.pageUrl || a.target?.source === options.pageUrl
        );
      }
      if (options?.baseUrl) {
        list = list.filter((a) => a.baseUrl === options.baseUrl);
      }
      return list;
    },

    async save(annotation: Annotation, _options?: SaveOptions): Promise<Annotation> {
      const all = readAll();
      const idx = all.findIndex((a) => a.id === annotation.id);
      if (idx >= 0) {
        all[idx] = annotation;
      } else {
        all.push(annotation);
      }
      writeAll(all);
      return annotation;
    },

    async delete(id: string): Promise<void> {
      const all = readAll();
      writeAll(all.filter((a) => a.id !== id));
    },
  };
}
