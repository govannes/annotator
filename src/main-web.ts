/**
 * Web app entry: run the annotator on the local test page (index.html) with backend API storage.
 */

import { createBackendStore } from './api';
import { init } from './main';

const meta = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string> }) : undefined;
const API_BASE_URL = meta?.env?.VITE_ANNOTATOR_API_URL ?? 'http://localhost:3000';

const root = document.getElementById('annotatable');
if (root) {
  init({
    root,
    getPageUrl: () => window.location.href,
    getStore: async () => createBackendStore({ baseUrl: API_BASE_URL }),
  });
}
