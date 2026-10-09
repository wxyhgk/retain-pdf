// retain-pdf-rendering/fit-model/rects.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Pure rectangle helpers and the galloping size search (fit.js equivalents).
(function (root, factory) {
  "use strict";
  const NAME = "rects";
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
  // ---------------------------------------------------------------------------
  // Geometry helpers (fit.js equivalents).
  // ---------------------------------------------------------------------------

  function rectsOverlap(a, b, padding) {
    return a.left < b.right - padding &&
      a.right > b.left + padding &&
      a.top < b.bottom - padding &&
      a.bottom > b.top + padding;
  }

  function layoutRectsOverlap(first, second, tolerance = 1.5) {
    return (
      Math.min(first.right, second.right) - Math.max(first.left, second.left) > tolerance
      && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > tolerance
    );
  }

  // Conservative broad-phase envelope for rendered text rectangles. All
  // candidates still reach the exact per-rectangle test below, so this can
  // only avoid unnecessary work; it cannot hide a real glyph collision.
  function rectUnion(rects) {
    if (!rects || !rects.length) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const rect of rects) {
      if (!rect) continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }
    return Number.isFinite(left) ? { left, top, right, bottom } : null;
  }

  function horizontalBoxesOverlap(a, b, padding = 0) {
    return a.left < b.right - padding && a.right > b.left + padding;
  }

  // Monotone collision-constrained growth: find the largest value in
  // [start, max] (stepped by `step`) at which `collides(value)` is still false.
  // Chromium line breaks are only weakly monotone, so recheck the tick above
  // the bisected boundary. `collides` leaves the node at the probed value.
  function gallopingGrow(start, max, step, collides) {
    if (start >= max) return { value: start, probes: 0 };
    const ticks = Math.floor((max - start) / step + 1e-6);
    if (ticks <= 0) return { value: start, probes: 0 };
    const at = (t) => Math.min(max, start + t * step);
    let probes = 0;
    let lastOk = 0;
    let firstBad = -1;
    let jump = 1;
    while (lastOk + jump <= ticks) {
      const t = lastOk + jump;
      probes += 1;
      if (collides(at(t))) { firstBad = t; break; }
      lastOk = t;
      jump *= 2;
    }
    // A doubling jump can pass the final tick (for example 1, 3, 7, 15 on a
    // 23-tick search).  Probe that endpoint before declaring max feasible;
    // otherwise a collision in the unvisited tail can be accepted as max.
    if (firstBad === -1 && lastOk < ticks) {
      probes += 1;
      if (collides(at(ticks))) firstBad = ticks;
      else lastOk = ticks;
    }
    if (firstBad === -1) {
      return { value: at(ticks), probes, lastProbed: at(ticks) };
    }
    let lo = lastOk;
    let hi = firstBad;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      probes += 1;
      if (collides(at(mid))) hi = mid; else lo = mid;
    }
    let best = lo;
    for (let t = lo + 1; t <= Math.min(ticks, lo + 1); t += 1) {
      probes += 1;
      if (collides(at(t))) break;
      best = t;
    }
    return { value: at(best), probes, lastProbed: at(Math.min(ticks, best + 1)) };
  }

  return { rectsOverlap, layoutRectsOverlap, rectUnion, horizontalBoxesOverlap, gallopingGrow };
});
