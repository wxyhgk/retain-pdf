// retain-pdf-rendering/fit-model/fill-policy
// Host-agnostic: never reference the host application or plugin globals here.
//
// How much of the room a translation leaves in its source boxes goes to the
// font size, how much to the leading, and how much stays white (pure
// functions; passes/retain-body.js stage 6 applies the plan with its ink
// safety net). Chinese from English sets in about 60% of the source width, so
// body boxes are only 67-83% full at the source style.
//
//   const P = FillPolicy.resolve(overrides);              // parameters, defaults below
//   const plan = FillPolicy.plan(paragraphs, { baseRatio, params: P });
//
// paragraphs: [{ page, rho, weight, fill }] -- one per body paragraph of two
//   or more lines: rho = translated / source set width at one size, weight =
//   source width (long paragraphs are measured best), fill = share of the box
//   height the ink takes at the current (book) size and leading.
// -> { book: { rho, fill, target, k, fontScale, lineRatio },
//      pages: { <page>: { rho, fill, target, k, lineRatio, paragraphs } } }
//
// The model, all smooth (no thresholds a book or a page could jump over):
//   1. rho per level. Book: weighted median of the paragraphs. Page: its
//      median pulled toward the book by `pageShrink` pseudo-paragraphs, so a
//      page with one or two paragraphs does not swing the leading.
//   2. Target fill F*(rho) = 1 - c * (1 - min(rho, 1)): the shorter the
//      translation, the more white is fine; a translation as long as its
//      source fills its box. Filling for its own sake looks loose.
//   3. Inflation k = max(1, F* / fill). Ink height grows about as size^2 x
//      line ratio (a larger size also breaks into more lines), so
//      ln k = 2 ln(size scale) + ln(line ratio scale).
//   4. Split. The book size takes `fontShare` of ln k (one size for the whole
//      book), the page leading takes the rest. Both through S(x, m) =
//      m tanh(x / m), which follows x while it is small and approaches the
//      cap m smoothly: size at most `fontMax`, line ratio at most
//      `lineRatioMax`, a page at most `pageSpread` away from the book leading.

(function (root, factory) {
  "use strict";
  const NAME = "fillPolicy";
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
    c: 0.3,            // white allowed per unit of length lost: F* = 1 - c (1 - rho)
    fontShare: 0.4,    // share of ln k taken by the book size
    fontMax: 1.06,     // size at most this many times the book size
    lineRatioMax: 1.5, // baseline pitch at most this many times the size
    pageSpread: 0.1,   // a page's line ratio within the book's +- this
    pageShrink: 3,     // pseudo-paragraphs pulling a page's rho / fill toward the book
    reserveEm: 0.5     // white kept under each paragraph's ink, em of its size
  });

  function resolve(overrides) {
    const out = { ...DEFAULTS };
    for (const [key, value] of Object.entries(overrides || {})) {
      if (!(key in DEFAULTS)) throw new Error(`fill policy: unknown parameter ${key}`);
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error(`fill policy: ${key} must be a non-negative number`);
      out[key] = number;
    }
    if (out.fontMax < 1) throw new Error("fill policy: fontMax must be at least 1");
    if (out.fontShare > 1) throw new Error("fill policy: fontShare must be at most 1");
    return Object.freeze(out);
  }

  // S(x, m) = m tanh(x / m): ~x for small x, never past m (m <= 0: no room).
  function saturate(x, m) {
    if (!(m > 0)) return 0;
    return m * Math.tanh(x / m);
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return NaN;
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  // Lower weighted median (weights > 0); falls back to the plain median.
  function weightedMedian(values, weights) {
    const pairs = values.map((value, i) => [value, Number(weights[i]) > 0 ? Number(weights[i]) : 0])
      .filter(([value, weight]) => Number.isFinite(value) && weight > 0)
      .sort((a, b) => a[0] - b[0]);
    if (!pairs.length) return median(values);
    const half = pairs.reduce((sum, [, weight]) => sum + weight, 0) / 2;
    let acc = 0;
    for (const [value, weight] of pairs) {
      acc += weight;
      if (acc >= half) return value;
    }
    return pairs[pairs.length - 1][0];
  }

  // A page's estimate pulled toward the book's by `shrink` pseudo-observations.
  function shrinkToward(pageValue, count, bookValue, shrink) {
    if (!Number.isFinite(pageValue) || count <= 0) return bookValue;
    return (count * pageValue + shrink * bookValue) / (count + shrink);
  }

  function targetFill(rho, params = DEFAULTS) {
    return 1 - params.c * (1 - Math.min(Math.max(rho, 0), 1));
  }

  function inflation(target, fill) {
    return fill > 0 ? Math.max(1, target / fill) : 1;
  }

  // Book size scale from the book inflation: fontShare of ln k, split over
  // the size's square, capped smoothly at fontMax.
  function fontScale(kBook, params = DEFAULTS) {
    return Math.exp(saturate((params.fontShare / 2) * Math.log(kBook), Math.log(params.fontMax)));
  }

  // Line ratio for an inflation k once the size took its part: the rest of
  // ln k, never below the base, capped smoothly at lineRatioMax.
  function lineRatioFor(k, scale, baseRatio, params = DEFAULTS) {
    const wanted = Math.max(0, Math.log(k) - 2 * Math.log(scale));
    return baseRatio * Math.exp(saturate(wanted, Math.log(params.lineRatioMax / baseRatio)));
  }

  function plan(paragraphs, { baseRatio, params = DEFAULTS } = {}) {
    const P = params;
    const usable = (paragraphs || []).filter(p => Number.isFinite(p.rho) && p.rho > 0 && Number.isFinite(p.fill) && p.fill > 0);
    if (!usable.length || !(baseRatio > 0)) return null;
    const bookRho = weightedMedian(usable.map(p => p.rho), usable.map(p => p.weight));
    const bookFill = weightedMedian(usable.map(p => p.fill), usable.map(p => p.weight));
    const bookTarget = targetFill(bookRho, P);
    const kBook = inflation(bookTarget, bookFill);
    const scale = fontScale(kBook, P);
    const bookLineRatio = lineRatioFor(kBook, scale, baseRatio, P);
    const byPage = new Map();
    for (const p of usable) {
      if (!byPage.has(p.page)) byPage.set(p.page, []);
      byPage.get(p.page).push(p);
    }
    const pages = {};
    for (const [page, list] of byPage) {
      const rho = shrinkToward(median(list.map(p => p.rho)), list.length, bookRho, P.pageShrink);
      const fill = shrinkToward(median(list.map(p => p.fill)), list.length, bookFill, P.pageShrink);
      const target = targetFill(rho, P);
      const k = inflation(target, fill);
      const free = lineRatioFor(k, scale, baseRatio, P);
      const lineRatio = Math.min(P.lineRatioMax, Math.max(baseRatio, bookLineRatio + saturate(free - bookLineRatio, P.pageSpread)));
      pages[page] = { rho, fill, target, k, lineRatio, paragraphs: list.length };
    }
    return {
      book: { rho: bookRho, fill: bookFill, target: bookTarget, k: kBook, fontScale: scale, lineRatio: bookLineRatio, paragraphs: usable.length },
      pages
    };
  }

  return { DEFAULTS, resolve, saturate, weightedMedian, shrinkToward, targetFill, inflation, fontScale, lineRatioFor, plan };
});
