Chrome MV3 extension for text annotation with fuzzy anchoring. TypeScript + Vite + Tailwind CSS.

## Philosophy

Keep it barebone. No premature abstraction — only abstract with 3+ real use cases. Delete, don't disable.

## Code style

- Classes for domain models; strategy and builder patterns only
- Plain functions for utilities
- Descriptive names: verbs for functions (`buildSelector`), `is/has` for booleans
- JSDoc on exported functions
- Comments explain WHY, not WHAT
- Named imports, no default exports
- `unknown` over `any`; narrow with type guards

## Architecture layers

Extension (extension-content.ts) → Main (main.ts) → Core (anchoring) + API (storage)

- Never import upward — Core must not import from Main or Extension
- Core is pure logic (no storage, no globals except DOM for highlighting)
- API is pure data (no DOM, no anchoring)

## Extension content script

- Runs in arbitrary web pages — be defensive, always check elements exist
- MutationObserver for SPA navigation and dynamic content
- All injected styling must be scoped to avoid leaking into host page
- Debounce DOM re-attachment (800ms) to avoid thrashing

## UI

- Tailwind CSS for all styling
- CSS custom properties / JS config for user-customizable values (e.g., highlight color)
- No framework — vanilla DOM manipulation, keep bundle small

## Error handling

- Anchoring: try each strategy, warn on individual failure, error on total failure
- Fail gracefully — never crash the host page
