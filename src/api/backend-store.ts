/**
 * Annotation storage using the backend API (see BACKEND-STORAGE.md).
 * All load/save/delete go to the backend API.
 */

import { Anchorer, type BackendAnnotationResponse } from '../core';
import type { Annotation } from '../types';
import type { AnnotationStore, LoadOptions, SaveOptions } from './storage';

const DEFAULT_BASE_URL = 'http://localhost:3000';

/** API request body for POST /full-page (link snapshot to annotation). */
interface ApiFullPageBody {
  html: string;
  baseUrl: string;
  fullPath: string;
  annotationId: string;
}

/** API response for POST /full-page. */
interface ApiFullPageResponse {
  id: string;
  contentHash: string;
}

export interface BackendStoreConfig {
  /** Base URL of the annotations API (e.g. http://localhost:3000). */
  baseUrl: string;
}

/**
 * Create an AnnotationStore that uses the backend API.
 * load() → GET /annotations; save() → POST /annotations then optionally POST /full-page; delete() → DELETE /annotations/:id.
 */
export function createBackendStore(config: BackendStoreConfig): AnnotationStore {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

  return {
    async load(options?: LoadOptions): Promise<Annotation[]> {
      const params = new URLSearchParams();
      if (options?.pageUrl) params.set('pageUrl', options.pageUrl);
      if (options?.baseUrl) params.set('baseUrl', options.baseUrl);
      const qs = params.toString();
      const url = qs ? `${baseUrl}/annotations?${qs}` : `${baseUrl}/annotations`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Annotations API load failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as BackendAnnotationResponse[];
      if (!Array.isArray(data)) return [];
      let list = data.map((api) => Anchorer.fromBackendPayload(api));
      if (options?.projectId) list = list.filter((a) => a.projectId === options.projectId);
      return list;
    },

    async save(annotation: Annotation, options?: SaveOptions): Promise<Annotation> {
      const body = Anchorer.toBackendPayload(annotation);
      const res = await fetch(`${baseUrl}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Annotations API save failed: ${res.status} ${res.statusText} — ${text}`);
      }
      const api = (await res.json()) as BackendAnnotationResponse;
      let result = Anchorer.fromBackendPayload(api);

      if (options?.fullPage && result.id) {
        const fpBody: ApiFullPageBody = {
          html: options.fullPage.html,
          baseUrl: options.fullPage.baseUrl,
          fullPath: options.fullPage.fullPath,
          annotationId: result.id,
        };
        const fpRes = await fetch(`${baseUrl}/full-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fpBody),
        });
        if (fpRes.ok) {
          const fp = (await fpRes.json()) as ApiFullPageResponse;
          result = { ...result, fullPageId: fp.id };
        }
      }

      return result;
    },

    async delete(id: string): Promise<void> {
      const res = await fetch(`${baseUrl}/annotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Annotations API delete failed: ${res.status} ${res.statusText}`);
      }
    },
  };
}
