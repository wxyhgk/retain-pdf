// retain-pdf-rendering/fit-model/constants.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Shared constants of the data fitter: CSS paddings and line ratios the DOM
// rules rely on, face content areas, ink extents and the final-audit options.
(function (root, factory) {
  "use strict";
  const NAME = "constants";
  const DEPENDENCIES = [];
  const isNode = typeof module === "object" && module && module.exports;
  const parts = isNode ? null : ((root.RetainPdfRendering || {}).FitModelParts || {});
  const resolved = DEPENDENCIES.map(([key, file]) => {
    const value = isNode ? require(file) : parts[key];
    if (!value) throw new Error(`retain-pdf-rendering/fit-model: load ${file.replace(/^(\.\.?\/)+/, "fit-model/")}.js before ${NAME}`);
    return value;
  });
  const api = factory(root, ...resolved);
  if (isNode) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    (namespace.FitModelParts = namespace.FitModelParts || {})[NAME] = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (root) {
  "use strict";
  const OBJECT = "￼";
  const LINE_SEPARATOR = " ";
  const STREAM_PADDING_LEFT = 2;  // .layout-flow-stream { padding: 0 4px 0 2px }
  const STREAM_PADDING_RIGHT = 4;
  const CODE_PADDING_X = 7;       // .layout-code { padding: 5px 7px }
  const CODE_PADDING_Y = 5;
  const CAPTION_TYPES = ["table_caption", "table_footnote", "chart_caption", "image_caption", "image_footnote"];
  // A narrow transition may back off without changing the shared body font.
  const ALLOW_INHERITED_BODY_FONT_BACKOFF = true;
  // Content areas (hhea ascent/descent, em) of the faces layout.css names for
  // nodes the measurer's own face does not render: Arial for titles, page
  // furniture and table/chart/image captions; Times New Roman for equation
  // numbers and plain-text formulas (.layout-equation-text). Glyph rectangles
  // and therefore collisions depend on them; advances stay the measurer's.
  // Arial has no CJK, so Chinese in a sans node is drawn by the platform
  // fallback (measured in Firefox on macOS: ascent 1.06 em, descent .34 em,
  // baseline still from the Arial strut).
  const DEFAULT_CONTENT_AREAS = Object.freeze({
    // Source Han Serif (CN TTF and SC OTF share the ratio): hhea 1151/-286.
    serif: Object.freeze({ ascent: 1.151, descent: .286 }),
    sans: Object.freeze({
      ascent: 1854 / 2048,
      descent: 434 / 2048,
      fallback: Object.freeze({ ascent: 1.06, descent: .34, pattern: /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/ })
    }),
    math: Object.freeze({ ascent: 1825 / 2048, descent: 443 / 2048 })
  });
  // Ink extents (em above / below the baseline) of what a line contains, for
  // the "measurer" line model. Typst's own line box is the face's typo
  // ascender/descender (.88/.12 for Source Han Serif) but ink goes further:
  // measured on SourceHanSerifSC-Regular, Latin lowercase reaches .816/-.271,
  // parentheses and slashes -.272, CJK punctuation -.195, accented capitals
  // .973; CJK ideographs stay within .851/-.084.
  function sourceHanSerifInk(text) {
    let ascent = .88;
    let descent = .12;
    if (/[\u00C0-\u00DE\u0100-\u017F\u1E00-\u1EFF]/.test(text)) ascent = .98;
    if (/[A-Za-z0-9()[\]{}\/\\|,;_@$§µßþ\u0370-\u03FF\u0400-\u04FF]/.test(text)) descent = .28;
    else if (/[，。、；：？！（）《》〈〉「」『』【】〖〗〔〕“”‘’…—]/.test(text)) descent = .2;
    return { ascent, descent };
  }

  const SANS_TYPES = new Set(["title", "header", "page_header", "footer", "page_footer", "page_number",
    "table_caption", "table_footnote", "chart_caption", "image_caption"]);

  const FINAL_AUDIT_OPTIONS = Object.freeze({
    avoidBlockOverlap: true,
    avoidPageOverflow: true,
    includeGroupPeers: true,
    checkAllTextForCollisions: true,
    ignoreTopOverflow: false,
    ignoreBodyTopOverflow: true,
    bodyColumnIndependentFit: true,
    bodyTextCollisionGeometry: true,
    sharedEdgeTolerance: 4.0,
    sharedHorizontalEdgeTolerance: 3.0
  });

  return {
    OBJECT, LINE_SEPARATOR, STREAM_PADDING_LEFT, STREAM_PADDING_RIGHT, CODE_PADDING_X, CODE_PADDING_Y,
    CAPTION_TYPES, ALLOW_INHERITED_BODY_FONT_BACKOFF, DEFAULT_CONTENT_AREAS, sourceHanSerifInk, SANS_TYPES,
    FINAL_AUDIT_OPTIONS
  };
});
