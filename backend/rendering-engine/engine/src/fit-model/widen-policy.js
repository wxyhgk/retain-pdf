// retain-pdf-rendering/fit-model/widen-policy
// Host-agnostic: never reference the host application or plugin globals here.
//
// A one-line source item whose translation is longer than its box (an "and"
// between two paragraphs, a short label, a heading): widen the box to the
// right just enough for the translation to stay on one line, instead of
// letting it wrap into the item below or shrink. Pure functions; the retain
// pass (passes/retain-body.js prepare) measures and applies.
//
//   const P = WidenPolicy.resolve(overrides);
//   const right = WidenPolicy.widenedRight({ box, need, neighbours, others, pageWidth, params: P });
//
// box: the item's { left, top, right, bottom }; need: the translation's width
// on one line at the item's size; neighbours: boxes of the other text items
// on the page; others: boxes of everything else on the page (text, formulas,
// figures, tables). Returns the new right edge, or null when the box stays.
//
// Limits, in order: just enough (need x (1 + slack)); not past the column's
// right edge (the rightmost right edge of the text items in the same column
// -- same left edge within the tolerance, or overlapping horizontally -- above
// or below; no neighbour, no widening: the column is unknown); not into
// anything beside it (any box overlapping the item's lines vertically and
// starting right of it, less `gap`); never past the page edge less `margin`.
// (Replaces retain-pdf's fixed "up to 30% wider under two body paragraphs"
// rule, which ignored how wide the translation is.)

(function (root, factory) {
  "use strict";
  const NAME = "widenPolicy";
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
})(typeof this === "object" && this ? this : globalThis, function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    slack: 0.02,             // widen to need x (1 + slack)
    columnLeftTolerance: 18, // pt: same column when the left edges are this close
    gap: 2,                  // pt kept clear of anything beside the item
    margin: 4,               // pt kept clear of the page edge
    minGain: 0.5             // pt: smaller widenings are not worth it
  });

  function resolve(overrides) {
    const out = { ...DEFAULTS };
    for (const [key, value] of Object.entries(overrides || {})) {
      if (!(key in DEFAULTS)) throw new Error(`widen policy: unknown parameter ${key}`);
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error(`widen policy: ${key} must be a non-negative number`);
      out[key] = number;
    }
    return Object.freeze(out);
  }

  function sameColumn(a, b, params) {
    const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    return Math.abs(a.left - b.left) <= params.columnLeftTolerance || overlap > 0.5 * Math.min(a.right - a.left, b.right - b.left);
  }

  // Right edge of the item's column: the widest same-column neighbour.
  function columnRight(box, neighbours, params = DEFAULTS) {
    let right = null;
    for (const other of neighbours || []) {
      if (other === box || !sameColumn(box, other, params)) continue;
      if (right === null || other.right > right) right = other.right;
    }
    return right;
  }

  // Nearest left edge of anything beside the item (overlapping its lines).
  function besideLimit(box, others, params = DEFAULTS) {
    let limit = Infinity;
    for (const other of others || []) {
      if (other === box) continue;
      const overlapY = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
      if (overlapY <= 0.5) continue;
      if (other.left < box.right - 0.5) continue;
      limit = Math.min(limit, other.left - params.gap);
    }
    return limit;
  }

  function widenedRight({ box, need, neighbours, others, pageWidth, params = DEFAULTS }) {
    const width = box.right - box.left;
    if (!(need > width) || !(width > 0)) return null;
    const column = columnRight(box, neighbours, params);
    if (column === null) return null;
    const wanted = box.left + need * (1 + params.slack);
    const pageRight = pageWidth > 0 ? pageWidth - params.margin : Infinity;
    const right = Math.min(wanted, column, besideLimit(box, others, params), pageRight);
    return right > box.right + params.minGain ? Math.round(right * 1000) / 1000 : null;
  }

  return { DEFAULTS, resolve, sameColumn, columnRight, besideLimit, widenedRight };
});
