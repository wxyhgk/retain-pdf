// retain-pdf-rendering/fit-model/passes/justify.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Balanced line breaking for justified text, as a post-fit pass.
//
// Greedy first-fit leaves all the slack on the line before a wide unbreakable
// item (an inline formula, a URL, a number run), which justification then
// spreads as visible letter-spacing. Once every size and line ratio is final,
// each node with justified lines is re-broken with the measurer's balanced
// breaking (same number of lines, least squared stretch per gap). The result
// is kept only if the node's line count and every line's vertical extent
// (top, baseline, ink) are unchanged and it adds no collision, so nothing the
// fit decided can move. Running it once here, not inside every measurement,
// keeps fitting as fast as greedy breaking.
(function (root, factory) {
  "use strict";
  const NAME = "justifyPasses";
  const DEPENDENCIES = [["constants", "../constants"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, constants) {
  "use strict";
  const { FINAL_AUDIT_OPTIONS } = constants;
  const EPSILON = 1e-6;

  function sameVerticalExtents(before, after) {
    if (before.lines.length !== after.lines.length) return false;
    return before.lines.every((line, index) => {
      const other = after.lines[index];
      return line.paragraph === other.paragraph &&
        Math.abs(line.top - other.top) <= EPSILON &&
        Math.abs(line.baseline - other.baseline) <= EPSILON &&
        Math.abs(line.glyphTop - other.glyphTop) <= EPSILON &&
        Math.abs(line.glyphBottom - other.glyphBottom) <= EPSILON;
    });
  }

  function createJustifyPasses(ctx, run, { geometry: geo, collision }) {
    const { all } = run;
    const { geometry } = geo;
    const { textCollisionDetails } = collision;
    const auditOptions = ctx.strict ? { ...FINAL_AUDIT_OPTIONS, fullInkBarriers: true } : FINAL_AUDIT_OPTIONS;

    function balanceJustifiedLines() {
      if (!ctx.balance) return { tried: 0, accepted: 0 };
      let tried = 0;
      let accepted = 0;
      for (const node of all) {
        if (node.sourceOnly) continue;
        const before = geometry(node);
        if (!before.lines || !before.lines.some(line => line.justified)) continue;
        const collidedBefore = Boolean(textCollisionDetails([node], auditOptions));
        node.balanceLines = true;
        const after = geometry(node);
        const changed = after.lines.some((line, index) =>
          line.start !== before.lines[index]?.start || line.end !== before.lines[index]?.end);
        if (!changed) { node.balanceLines = false; continue; }
        tried += 1;
        const keep = sameVerticalExtents(before, after) &&
          (collidedBefore || !textCollisionDetails([node], auditOptions));
        if (keep) accepted += 1;
        else node.balanceLines = false;
      }
      return { tried, accepted };
    }

    return { balanceJustifiedLines };
  }

  return { createJustifyPasses, sameVerticalExtents };
});
