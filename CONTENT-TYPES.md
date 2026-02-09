# Annotator and different content types

The browser can show HTML pages, PDFs, plain text, and other content. What we can annotate depends on what is exposed as DOM/text.

## HTML (and text-as-HTML)

- **Standard web pages:** Full support. The annotatable root is a DOM element (e.g. `#annotatable` or `body`). We walk the DOM, build document text, and attach annotations using Range / TextPosition / TextQuote.
- **Plain text files (`.txt`):** When opened in the browser, the content is usually rendered inside an HTML document (e.g. inside a `<pre>` or a single block). If you set the annotatable root to that container, the same logic works: one “document text” and the same selectors. So **yes, we can interact with them** as long as the host page gives us a root element.

## PDFs

- **Built-in PDF viewer:** Browsers often render PDFs in a closed viewer (plugin or shadow DOM). We **cannot** access its internal structure or attach our highlights to the native PDF text.
- **To annotate PDFs in the browser**, you need a JS layer that either:
  - Renders the PDF into a **text layer** (e.g. PDF.js with a text layer), so we get real DOM nodes we can use as root and apply the same annotation flow, or
  - Renders to **canvas** and you annotate at coordinate level (different model: regions, not text ranges).

So: **HTML and text-as-HTML yes; PDFs only if we use something like PDF.js that exposes a DOM/text layer we control.**

## Other (images, etc.)

- **Images:** No selectable text; annotation would be region-based (crops, shapes), not range-based.
- **SVG:** Can contain `<text>` and other elements; our approach can work if you use the SVG (or a wrapper) as the annotatable root.

In short: the current annotator is built for **text in the DOM**. For PDFs, use a library that gives you that (e.g. PDF.js text layer); for plain text, use a root that wraps the displayed text.
