/**
 * Annotator – in-browser annotation with fuzzy anchoring.
 * Works as a standalone page (index.html) or inside a browser extension (content script).
 * See START.md, NEXT-STEPS.md, HIGHLIGHT-ALGORITHM.md.
 */

import { anchorAnnotation, anchorFromQuoteOnly, anchorFromRangeSelector } from './anchoring';
import { getContentRoots, getContentUrlFromRange } from './content-url';
import { build } from './dom-text-mapper';
import { clearHighlights, highlightRange } from './highlighter';
import { toRangeSelector, toTextPositionSelector, toTextQuoteSelector } from './selectors';
import type { AnnotationStore } from './storage';
import type { Annotation, RangeSelector } from './types';

export interface AnnotatorConfig {
  /** Root element to annotate (e.g. document.body or #annotatable). */
  root: Element;
  /** Current page URL for storing/loading annotations. */
  getPageUrl: () => string;
  /** Store implementation (backend API). */
  getStore: () => Promise<AnnotationStore>;
}

let store: AnnotationStore | null = null;
let lastRangeSel: RangeSelector | null = null;
let lastQuoteExact: string | null = null;

/**
 * Initialize the annotator: load annotations, draw highlights, attach button handlers.
 * The page (or injected UI) should have elements with ids: annotator-status, add-annotation,
 * add-annotation-result, test-reattach, test-reattach-result. Optional: test-output, annotatable (for selection debug).
 */
export async function init(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl, getStore } = config;
  console.log('Annotator init; root:', ROOT);

  store = await getStore();
  if (typeof window !== 'undefined') {
    (window as unknown as { __annotatorStore: AnnotationStore }).__annotatorStore = store;
  }

  const { text, mapper } = build(ROOT);
  if (typeof window !== 'undefined') {
    (window as unknown as { __annotatorMapper: typeof mapper }).__annotatorMapper = mapper;
  }
  console.log('Mapper built; text length:', text.length);

  const pageUrl = getPageUrl();
  const annotations = await store.load();
  console.log('Annotations loaded:', annotations.length);
  const contentRoots = getContentRoots(ROOT);
  const contentUrlToRoot = new Map(contentRoots.map((r) => [r.contentUrl, r.blockRoot]));
  const pageLevel = annotations.filter((a) => a.target.source === pageUrl);
  const contentLevel = annotations.filter(
    (a) => a.target.source !== pageUrl && contentUrlToRoot.has(a.target.source)
  );
  let anchored = 0;
  let currentText = text;
  let currentMapper = mapper;
  for (const ann of pageLevel) {
    const range = anchorAnnotation(ann, ROOT, currentMapper, currentText);
    if (range && !range.collapsed) {
      const didHighlight = highlightRange(range, ann.id, {
        type: ann.highlightType,
        color: ann.highlightColor,
      });
      if (didHighlight) {
        anchored++;
        const next = build(ROOT);
        currentText = next.text;
        currentMapper = next.mapper;
      }
    }
  }
  for (const ann of contentLevel) {
    const blockRoot = contentUrlToRoot.get(ann.target.source);
    if (!blockRoot) continue;
    const exact = ann.target.selector?.textQuote?.exact;
    if (!exact) continue;
    const { text: blockText, mapper: blockMapper } = build(blockRoot);
    const offsets = anchorFromQuoteOnly(blockText, exact);
    if (!offsets) continue;
    const range = blockMapper.offsetsToRange(offsets.start, offsets.end);
    if (range && !range.collapsed) {
      const didHighlight = highlightRange(range, ann.id, {
        type: ann.highlightType,
        color: ann.highlightColor,
      });
      if (didHighlight) anchored++;
    }
  }
  const totalForUi = pageLevel.length + contentLevel.length;
  if (typeof window !== 'undefined') {
    (window as unknown as { __annotatorMapper: typeof mapper }).__annotatorMapper = currentMapper;
  }
  if (totalForUi > 0) {
    console.log(`Annotations: ${anchored}/${totalForUi} re-attached for this page.`);
  }

  const statusEl = document.getElementById('annotator-status');
  if (statusEl) {
    statusEl.textContent =
      totalForUi === 0
        ? 'No annotations for this page yet.'
        : `${anchored} of ${totalForUi} highlights shown on this page.`;
  }

  const outputEl = document.getElementById('test-output');
  const annotatableEl = document.getElementById('annotatable');
  const selectionRoot = annotatableEl ?? ROOT;
  if (outputEl) {
    selectionRoot.addEventListener('mouseup', () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        outputEl.textContent = '(no selection yet)';
        lastRangeSel = null;
        lastQuoteExact = null;
        return;
      }
      const range = sel.getRangeAt(0);
      if (!ROOT.contains(range.commonAncestorContainer)) {
        outputEl.textContent = '(selection outside annotatable area)';
        return;
      }
      try {
        const rangeSel = toRangeSelector(range, ROOT);
        const posSel = toTextPositionSelector(range, currentMapper);
        const quoteSel = toTextQuoteSelector(currentText, posSel.start, posSel.end);
        lastRangeSel = rangeSel;
        lastQuoteExact = quoteSel.exact;
        const out = [
          'RangeSelector (Step 3):',
          JSON.stringify(rangeSel, null, 2),
          '',
          'TextPositionSelector:',
          JSON.stringify(posSel, null, 2),
          '',
          'TextQuoteSelector:',
          JSON.stringify(quoteSel, null, 2),
        ].join('\n');
        outputEl.textContent = out;
        console.log('Selection selectors:', { rangeSel, posSel, quoteSel });
      } catch (e) {
        outputEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(e);
      }
    });
  }

  const addBtn = document.getElementById('add-annotation');
  const addResult = document.getElementById('add-annotation-result');
  const storeRef = store;
  if (addBtn && addResult && storeRef) {
    addBtn.addEventListener('click', async () => {
      addResult.textContent = '';
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        addResult.textContent = 'Select text first.';
        return;
      }
      const range = sel.getRangeAt(0).cloneRange();
      if (!ROOT.contains(range.commonAncestorContainer)) {
        addResult.textContent = 'Selection outside annotatable area.';
        return;
      }
      try {
        const { text: docText, mapper: m } = build(ROOT);
        const rangeSel = toRangeSelector(range, ROOT);
        const posSel = toTextPositionSelector(range, m);
        const quoteSel = toTextQuoteSelector(docText, posSel.start, posSel.end);
        const pageUrl = getPageUrl();
        const contentUrl = getContentUrlFromRange(range, ROOT);
        const source = contentUrl ?? pageUrl;
        const annotation: Annotation = {
          id: crypto.randomUUID(),
          target: {
            source,
            selector: { range: rangeSel, textPosition: posSel, textQuote: quoteSel },
          },
          pageUrl,
          created: new Date().toISOString(),
          highlightType: 'highlight',
          highlightColor: 'rgba(255, 220, 0, 0.35)',
        };
        const saveOptions =
          typeof document !== 'undefined' && document.documentElement
            ? {
                fullPage: {
                  html: document.documentElement.outerHTML,
                  baseUrl: (() => {
                    try {
                      return new URL(pageUrl).origin;
                    } catch {
                      return pageUrl.split('#')[0]!.split('?')[0] ?? pageUrl;
                    }
                  })(),
                  fullPath: pageUrl,
                },
              }
            : undefined;
        await storeRef.save(annotation, saveOptions);
        highlightRange(range, annotation.id, {
          type: annotation.highlightType,
          color: annotation.highlightColor,
        });
        addResult.textContent = `Saved (${annotation.id.slice(0, 8)}…).`;
        console.log('Annotation saved:', annotation);
      } catch (e) {
        addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(e);
      }
    });
  }

  const reattachBtn = document.getElementById('test-reattach');
  const reattachResult = document.getElementById('test-reattach-result');
  if (reattachBtn && reattachResult) {
    reattachBtn.addEventListener('click', () => {
      reattachResult.textContent = '';
      if (!lastRangeSel) {
        reattachResult.textContent = 'Select text first.';
        return;
      }
      const range = anchorFromRangeSelector(lastRangeSel, ROOT, lastQuoteExact ?? undefined);
      if (range) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        reattachResult.textContent = 'OK — selection restored.';
      } else {
        reattachResult.textContent = 'Failed (null).';
      }
    });
  }

  const showDbBtn = document.getElementById('show-db');
  const dbOutputEl = document.getElementById('annotator-db-output') ?? document.getElementById('test-output');
  if (showDbBtn && dbOutputEl && storeRef) {
    showDbBtn.addEventListener('click', async () => {
      try {
        const all = await storeRef.load();
        const pageUrl = getPageUrl();
        const contentRootsForDb = getContentRoots(ROOT);
        const contentUrls = new Set(contentRootsForDb.map((r) => r.contentUrl));
        const forThisPage = all.filter(
          (a) =>
            a.target.source === pageUrl ||
            contentUrls.has(a.target.source) ||
            a.pageUrl === pageUrl
        );
        const fullData = {
          pageUrl,
          totalStored: all.length,
          forThisPage: forThisPage.length,
          annotations: all,
        };
        dbOutputEl.textContent = JSON.stringify(fullData, null, 2);
        if (dbOutputEl.id === 'annotator-db-output') {
          const el = dbOutputEl as HTMLElement;
          el.style.display = el.style.display === 'block' ? 'none' : 'block';
        }
      } catch (e) {
        dbOutputEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
        if (dbOutputEl.id === 'annotator-db-output') (dbOutputEl as HTMLElement).style.display = 'block';
      }
    });
  }
}

/**
 * Re-run load-and-draw only (no button handlers). Clears existing highlights first.
 * Use from the extension after a delay or on DOM mutations so dynamic content (e.g. x.com tweets) gets highlighted.
 */
export async function reattachHighlights(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl, getStore } = config;
  clearHighlights(ROOT);
  const storeInstance = await getStore();
  const pageUrl = getPageUrl();
  const annotations = await storeInstance.load();
  const contentRoots = getContentRoots(ROOT);
  const contentUrlToRoot = new Map(contentRoots.map((r) => [r.contentUrl, r.blockRoot]));
  const pageLevel = annotations.filter((a) => a.target.source === pageUrl);
  const contentLevel = annotations.filter(
    (a) => a.target.source !== pageUrl && contentUrlToRoot.has(a.target.source)
  );
  let anchored = 0;
  let { text: currentText, mapper: currentMapper } = build(ROOT);
  for (const ann of pageLevel) {
    const range = anchorAnnotation(ann, ROOT, currentMapper, currentText);
    if (range && !range.collapsed) {
      const didHighlight = highlightRange(range, ann.id, {
        type: ann.highlightType,
        color: ann.highlightColor,
      });
      if (didHighlight) {
        anchored++;
        const next = build(ROOT);
        currentText = next.text;
        currentMapper = next.mapper;
      }
    }
  }
  for (const ann of contentLevel) {
    const blockRoot = contentUrlToRoot.get(ann.target.source);
    if (!blockRoot) continue;
    const exact = ann.target.selector?.textQuote?.exact;
    if (!exact) continue;
    const { text: blockText, mapper: blockMapper } = build(blockRoot);
    const offsets = anchorFromQuoteOnly(blockText, exact);
    if (!offsets) continue;
    const range = blockMapper.offsetsToRange(offsets.start, offsets.end);
    if (range && !range.collapsed) {
      const didHighlight = highlightRange(range, ann.id, {
        type: ann.highlightType,
        color: ann.highlightColor,
      });
      if (didHighlight) anchored++;
    }
  }
  const totalForUi = pageLevel.length + contentLevel.length;
  const statusEl = document.getElementById('annotator-status');
  if (statusEl) {
    statusEl.textContent =
      totalForUi === 0
        ? 'No annotations for this page yet.'
        : `${anchored} of ${totalForUi} highlights shown on this page.`;
  }
  if (totalForUi > 0) {
    console.log(`[Annotator] Re-attach (retry): ${anchored}/${totalForUi} highlights.`);
  }
}

