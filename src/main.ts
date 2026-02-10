/**
 * Annotator – in-browser annotation with fuzzy anchoring.
 * Works as a standalone page (index.html) or inside a browser extension (content script).
 * See START.md, NEXT-STEPS.md, HIGHLIGHT-ALGORITHM.md.
 *
 * Uses the fluent Annotation API (core + api): Annotation.annotate().saveFullPage().done(), Annotation.load(page).into(root).
 */

import { Annotation } from './annotation';
import { Anchorer, build, getContentRoots } from './core';
import type { AnnotationStore } from './api';
import type { Annotation as AnnotationType, RangeSelector } from './types';

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

  Annotation.configure({ getStore, getPageUrl });
  store = await getStore();
  if (typeof window !== 'undefined') {
    (window as unknown as { __annotatorStore: AnnotationStore }).__annotatorStore = store;
  }

  const pageUrl = getPageUrl();
  const loadResult = await Annotation.load(pageUrl).into(ROOT);
  const { anchored, total: totalForUi } = loadResult;
  console.log('[Annotator] Mapper built; annotations:', loadResult.annotations.length, `highlights: ${anchored}/${totalForUi}`);

  if (typeof window !== 'undefined') {
    const { mapper } = build(ROOT);
    (window as unknown as { __annotatorMapper: typeof mapper }).__annotatorMapper = mapper;
  }
  if (totalForUi > 0) {
    console.log(`Annotations: ${anchored}/${totalForUi} re-attached for this page.`);
  }

  let currentMapper = build(ROOT).mapper;
  let currentText = build(ROOT).text;

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
        const selector = Anchorer.buildSelectorsFromRange(range, ROOT, currentMapper, currentText);
        lastRangeSel = selector.range ?? null;
        lastQuoteExact = selector.textQuote?.exact ?? null;
        const out = [
          'RangeSelector (Step 3):',
          JSON.stringify(selector.range, null, 2),
          '',
          'TextPositionSelector:',
          JSON.stringify(selector.textPosition, null, 2),
          '',
          'TextQuoteSelector:',
          JSON.stringify(selector.textQuote, null, 2),
        ].join('\n');
        outputEl.textContent = out;
        console.log('Selection selectors:', selector);
      } catch (e) {
        outputEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(e);
      }
    });
  }

  const addBtn = document.getElementById('add-annotation');
  const addResult = document.getElementById('add-annotation-result');
  if (addBtn && addResult) {
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
        const annotation = await Annotation.annotate({
          range,
          root: ROOT,
          highlightType: 'highlight',
          highlightColor: 'rgba(255, 220, 0, 0.35)',
        })
          .saveFullPage(true)
          .done();
        currentMapper = build(ROOT).mapper;
        currentText = build(ROOT).text;
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
      const { text, mapper } = build(ROOT);
      const minimalAnn: { id: string; target: { source: string; selector: { range: RangeSelector; textQuote?: { exact: string; prefix: string; suffix: string } } } } = {
        id: '',
        target: {
          source: '',
          selector: {
            range: lastRangeSel,
            ...(lastQuoteExact != null && { textQuote: { exact: lastQuoteExact, prefix: '', suffix: '' } }),
          },
        },
      };
      const result = Anchorer.anchor(minimalAnn as AnnotationType, ROOT, { text, mapper });
      if (result.ok) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(result.range);
        }
        reattachResult.textContent = 'OK — selection restored.';
      } else {
        reattachResult.textContent = 'Failed (null).';
      }
    });
  }

  const showDbBtn = document.getElementById('show-db');
  const dbOutputEl = document.getElementById('annotator-db-output') ?? document.getElementById('test-output');
  const storeForDb = store;
  if (showDbBtn && dbOutputEl && storeForDb) {
    showDbBtn.addEventListener('click', async () => {
      try {
        const all = await storeForDb.load();
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
  Annotation.configure({ getStore, getPageUrl });
  const pageUrl = getPageUrl();
  const result = await Annotation.load(pageUrl).into(ROOT);
  const statusEl = document.getElementById('annotator-status');
  if (statusEl) {
    statusEl.textContent =
      result.total === 0
        ? 'No annotations for this page yet.'
        : `${result.anchored} of ${result.total} highlights shown on this page.`;
  }
  if (result.total > 0) {
    console.log(`[Annotator] Re-attach (retry): ${result.anchored}/${result.total} highlights.`);
  }
}

