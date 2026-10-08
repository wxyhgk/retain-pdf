// retain-pdf-rendering/fit-model
// Host-agnostic: never reference the host application or plugin globals here.
//
// Data-driven port of the glyph-measured fitter in fit.js. Instead of a DOM it
// fits the layout model directly: every text node is laid out by an injected
// measurer (line breaks, line boxes and glyph rectangles in source-page
// units), and the result is pure data — per node font size, line height and
// absolutely positioned lines — that a Typst emitter or a DOM renderer can
// paint without measuring again.
//
//   createModelFitter({ measurer, measurers?, contentFor?, options?, lineModel?,
//                       contentAreas?, cssPixelRounding?, trace? })
//     .fitDocument(model, { mode, strictSourceFit, userBodyFontPt, translatedClamp, bodyMaxFont })
//
// bodyMaxFont (optional, source units): ceiling for the shared body font
// instead of the DOM rule's 13. An overlay painted onto the original page
// keeps the source body size as its ceiling; omitted, nothing changes.
//
// Vertical line model (lineModel):
//   "measurer" (default) — the measurer's own geometry (RetainPdfRendering.Text:
//       Typst lines, ascender..descender tall, `leading` between lines). A node
//       starts half a leading below its top and paragraphs are separated by
//       leading + paragraph gap, the rhythm the Typst emitter paints.
//   "css" — CSS line boxes rebuilt from the measurer's line breaks: every line
//       is fontSize * lineHeight tall (taller only for an inline box that
//       leaves the strut), glyph rectangles are the face's content area
//       (contentAreas.serif/sans/math, hhea) centred on the line box, and with
//       cssPixelRounding the ascent/descent are rounded up to whole pixels as
//       Gecko does. This reproduces what the DOM fitter measures in a browser.
//
// The rule set is runLayoutParityEngine() / fitLayoutFormulas() /
// fitLayoutPages() from fit.js, ported step by step with the same option
// sets, iteration order, rounding (applyGroup's toFixed) and tolerances. Node
// classification follows the selectors fit.js uses on the DOM render.js
// builds; the predicates below name the selector they replace.
//
// Deviations from the DOM fitter (things a data model cannot reproduce):
//   1. Fonts. The measurer has one face (Source Han Serif). layout.css sets
//      titles, page headers/footers/numbers and table/chart/image captions in
//      Arial / "Microsoft YaHei UI", code in a monospace face, equation numbers
//      in Times New Roman, and level-0 TOC rows bold; all of them are measured
//      with the serif metrics (code: a fixed 0.6 em / 1 em CJK advance).
//   2. Glyph rectangles are per line (one rect from the line's start to end x,
//      font content area tall), not per DOM text node. Inline formula boxes
//      enlarge the rect/line box as CSS inline-blocks would.
//   3. Tables and images are opaque boxes: their rendered content rectangle is
//      the block box (a table's natural height is not modelled), and table
//      cell text is not a collision source.
//   4. Formula blocks: the formula is one box (measured natural width, content
//      height) scaled about its centre/left edge like the CSS transform; the
//      equation number is a text box anchored at --equation-number-right.
//   5. TOC rows: label and page number rects only (no leader, no bold), row
//      height = line height, gap rows .40 em.
//   6. Browser-only behaviour with no data equivalent is skipped: the fit
//      cache, debug overlays/labels (stop reasons are returned instead),
//      body-iteration inspection, overflow-wrap:anywhere inside long words.
//   7. clampTranslatedOverflow() only runs with `translatedClamp: true`: on
//      the DOM it is gated by body.layout-translated, which no host sets.
//   8. userBodyFontPt is converted to source units (pt * 4/3): on the DOM the
//      override is written as `${pt}pt`.
//
// The implementation lives in src/fit-model/ (see its README for the module
// map and the browser load order); this file is the public entry point.
(function (root, factory) {
  "use strict";
  const isNode = typeof module === "object" && module && module.exports;
  const fitter = isNode ? require("./fit-model/index.js") : ((root.RetainPdfRendering || {}).FitModelParts || {}).fitter;
  if (!fitter) throw new Error("retain-pdf-rendering/fit-model: load the src/fit-model/*.js parts first (see src/fit-model/README.md)");
  const api = factory(fitter);
  if (isNode) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    namespace.FitModel = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (fitter) {
  "use strict";

  return fitter;
});
