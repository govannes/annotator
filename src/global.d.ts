/**
 * Minimal Chrome extension API types for the content script.
 * For full types: npm i -D @types/chrome
 */
declare const chrome: {
  storage: {
    local: {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
} | undefined;
