// retain-pdf-rendering/fit-model/passes/retain-titles.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Typography profile "retain": headings sized like retain-pdf's
// solve_title_fit (render/layout/title_fit.py, title_binary_fit.py,
// title_fit_limits.py), each on its own box instead of the DOM fitter's one
// shared size for every non-main heading.
//
// Two phases: fitTitles sizes every heading from its box alone before the
// body pass (retain-pdf never compares a heading with unfitted body text, and
// seed-sized body may still run past its box at that point); backoffTitles
// applies the safety net once the body has settled. Style and safety rules
// are retain-body's (passes/retain-body.js helpers).
(function (root, factory) {
  "use strict";
  const NAME = "retainTitlePass";
  const DEPENDENCIES = [["document", "../document"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, document) {
  "use strict";
  const { nodeBox, layoutControlFontSize } = document;

  // title_binary_fit._title_leading_em
  function titleLeadingEm(kind, fontSize, baseFont) {
    let leading = kind === "title" ? 0.28 : 0.34;
    if (fontSize < baseFont * 0.88) leading = kind === "title" ? 0.34 : 0.40;
    if (fontSize < 8.0) leading = kind === "title" ? 0.40 : 0.46;
    return leading;
  }

  // title_fit_limits.resolve_title_fill_max_font_size_pt
  function titleFillMax(baseFont, boxHeight) {
    const scaledCap = Math.max(baseFont, baseFont * 3.0);
    const heightCap = Math.max(8, boxHeight) * 0.92;
    return Math.max(baseFont, Math.min(72, scaledCap, Math.max(baseFont, Math.min(baseFont * 2.6, heightCap))));
  }

  function createRetainTitlePass(ctx, run, { geometry, collision, retainBody }) {
    const { measureTextBand } = geometry;
    const { ratioFor, setStyle, largestPassing, passes, COLLIDE, FONT_STEP } = retainBody.helpers;
    const titleState = new Map();
    const titleKind = node => (node.mainTitle ? "title" : "heading");
    const titleRatioAt = (node, size) => ratioFor(titleLeadingEm(titleKind(node), size, titleState.get(node).baseFont));

    // The largest size up to the fill cap (the source size when the host gave
    // one) whose Typst band fits 0.94 x the box height (our real measure replaces solve_title_fit's character-unit
    // estimate; its 0.92 width safety is not applied, line breaking is exact
    // here). The floor for the later back-off is fit_min_font: 0.72 x for the
    // main title, 0.78 x for other headings.
    function fitTitles(predicate) {
      for (const node of run.scopedNodes(predicate)) {
        const kind = titleKind(node);
        // The host's measured source size wins: a heading keeps its source size
        // and only shrinks to fit. The box was sized by the source's line count,
        // so filling it grew a two-line heading translated into one line to
        // nearly twice its size (retain-pdf 2026-11-09). Without it, the old
        // fill rule (titleFillMax) applies.
        const sourceFont = Number(node.source?.sourceFontSize);
        const hasSource = Number.isFinite(sourceFont) && sourceFont > 0;
        const baseFont = hasSource ? sourceFont : Math.max(1, Number(node.baseFont) || layoutControlFontSize(node));
        const box = nodeBox(node);
        const boxHeight = box.bottom - box.top;
        const maxFont = hasSource ? sourceFont : titleFillMax(baseFont, boxHeight);
        const lowFont = Math.max(1, Math.min(5.2, baseFont, maxFont));
        titleState.set(node, { baseFont });
        const bandFitsAt = size => {
          setStyle(node, size, titleRatioAt(node, size));
          const band = measureTextBand(node);
          return !band.hasText || band.lastBottom <= boxHeight * 0.94 + 1e-6;
        };
        const size = largestPassing(lowFont, maxFont, FONT_STEP, bandFitsAt);
        titleState.get(node).floor = Math.max(1, Math.min(size, baseFont, size * (kind === "title" ? 0.72 : 0.78)));
        setStyle(node, size, titleRatioAt(node, size));
      }
    }

    // After the body pass: the body is set at its shared size, usually a little above the source
    // (14e352: 9.96 -> 10.52), while headings were capped at their own source size -- so a heading
    // the source set at the body's size came out smaller than the body, one set at 1.1 x came out
    // equal. Each heading with a source size grows to source x (settled body / source body), as far
    // as it keeps its line count; the collision back-off below still applies. The scale is clamped
    // to [0.8, 1.4]. -> { body_source, body_settled, scale, grown, kept } or null (no text layer).
    function followBody(predicate, bodyPredicate, bodySource) {
      if (!(bodySource > 0)) return null;
      const bodySizes = run.scopedNodes(bodyPredicate).map(node => layoutControlFontSize(node)).filter(size => size > 0).sort((a, b) => a - b);
      if (!bodySizes.length) return null;
      const settled = bodySizes[(bodySizes.length - 1) >> 1];
      const scale = Math.min(1.4, Math.max(0.8, settled / bodySource));
      let grown = 0;
      let kept = 0;
      const lines = node => geometry.geometry(node).lines.length;
      for (const node of run.scopedNodes(predicate)) {
        const sourceFont = Number(node.source?.sourceFontSize);
        if (!(Number.isFinite(sourceFont) && sourceFont > 0) || !titleState.get(node)) continue;
        const current = layoutControlFontSize(node);
        const target = Number((sourceFont * scale).toFixed(2));
        if (!(target > current + 1e-6)) continue;
        const linesNow = lines(node);
        const keepsLines = at => {
          setStyle(node, at, titleRatioAt(node, at));
          return lines(node) <= linesNow;
        };
        const size = keepsLines(target) ? target : largestPassing(current, target, FONT_STEP, keepsLines);
        setStyle(node, size, titleRatioAt(node, size));
        if (size > current + 1e-6) grown += 1;
        else kept += 1;
      }
      const round = value => Number(value.toFixed(3));
      return { body_source: round(bodySource), body_settled: round(settled), scale: round(scale), grown, kept };
    }

    // The safety net: back off in 0.25pt steps, down to the floor, until the
    // heading's ink touches nothing.
    function backoffTitles(predicate) {
      for (const node of run.scopedNodes(predicate)) {
        const state = titleState.get(node);
        if (!state) continue;
        let size = layoutControlFontSize(node);
        while (size - 0.25 >= state.floor - 1e-9 && !passes(node)) {
          size = Number((size - 0.25).toFixed(2));
          setStyle(node, size, titleRatioAt(node, size));
        }
        const hit = collision.textCollisionDetails([node], COLLIDE);
        node.fit = { pass: titleKind(node) === "title" ? "retain-title" : "retain-heading", stopReason: hit ? "floor" : "fit", limiter: Boolean(hit), blocker: hit ? hit.blockerName : "" };
      }
    }

    return { fitTitles, followBody, backoffTitles };
  }

  return { createRetainTitlePass, titleLeadingEm, titleFillMax };
});
