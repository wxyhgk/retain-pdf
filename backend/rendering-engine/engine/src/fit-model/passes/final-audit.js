// retain-pdf-rendering/fit-model/passes/final-audit.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The final glyph-level collision audit after every style mutation.
(function (root, factory) {
  "use strict";
  const NAME = "finalAuditPass";
  const DEPENDENCIES = [["constants", "../constants"], ["document", "../document"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, constants, document) {
  "use strict";
  const { FINAL_AUDIT_OPTIONS, ALLOW_INHERITED_BODY_FONT_BACKOFF } = constants;
  const { isBlock, Select, nodeBox, applyGroup, layoutControlFontSize, controlLineRatio } = document;

  function createFinalAuditPass(ctx, run, { geometry: geo, collision }) {
    const strict = ctx.strict;
    const { scopedNodes } = run;
    const { textRectsInPage, elementBoxInPage } = geo;
    const { textCollisionDetails } = collision;

    // All groups are tuned independently, so perform one final glyph-level
    // audit after every style mutation. Unlike the iteration probes, this checks
    // every visible glyph against every layout box, including cross-group cases
    // such as body text beside references. Only a detected source is backed off.
    function enforceFinalTextCollisionSafety() {
      // Strict collisions never treat ink outside a node's own box as a
      // barrier while fitting, so a block's first line may optically rise
      // into the stream above it unseen by either pass. Audit every text
      // block as well (formulas keep their own pass; obstacles have no text).
      const nodes = scopedNodes(strict
        ? node => Select.finalAudit(node) || (isBlock(node) && !Select.formula(node) && textRectsInPage(node).length > 0)
        : Select.finalAudit);
      const exhausted = new Set();
      const repairCounts = new Map();
      // Covers the full 42px-to-4.8px backoff range with a small margin.
      const MAX_FINAL_COLLISION_REPAIRS_PER_NODE = 192;
      const options = strict ? { ...FINAL_AUDIT_OPTIONS, fullInkBarriers: true } : FINAL_AUDIT_OPTIONS;
      // The legacy loop restarted from node zero after every backoff.  That is
      // quadratic. Recheck the changed source, then continue in source order.
      let scanIndex = 0;
      while (scanIndex < nodes.length) {
        const candidate = nodes[scanIndex];
        if (!candidate || exhausted.has(candidate)) {
          scanIndex += 1;
          continue;
        }
        const collision = textCollisionDetails([candidate], options);
        if (!collision) {
          scanIndex += 1;
          continue;
        }
        // A collision on the source's first line with a text node above it
        // cannot be repaired by the source: a tighter line ratio or a smaller
        // size barely moves its first line (source boxes often overlap by a
        // fraction of a point). Repair the node above instead.
        let source = collision.source;
        const blocker = collision.blocker;
        if (strict && blocker && blocker !== source && collision.rect && !exhausted.has(blocker) &&
            nodeBox(blocker).top < nodeBox(source).top && nodes.includes(blocker)) {
          const firstTop = Math.min(...textRectsInPage(source).map(rect => rect.top));
          if (collision.rect.top <= firstTop + 1e-6) source = blocker;
        }
        const repairs = (repairCounts.get(source) || 0) + 1;
        repairCounts.set(source, repairs);
        if (repairs > MAX_FINAL_COLLISION_REPAIRS_PER_NODE) {
          // The fallback is deliberately local. The rest of the paper still
          // receives an exact audit, and an exceptional source cannot freeze
          // the host by repeatedly restarting the entire document scan.
          exhausted.add(source);
          source.fitLabel = "FINAL collision guard";
          scanIndex += 1;
          continue;
        }
        let fontSize = layoutControlFontSize(source);
        let lineRatio = controlLineRatio(source, 1.1);
        const minFont = source.flowKind === "ref_text" ? 4.8 : 4.8;
        // Short single-column transitions inherit the body baseline but must
        // never constrain its document-wide fit. They can still back off here
        // if a translated sentence genuinely cannot fit its source band.
        const isInheritedBodyText = source.styleKind === "body_text" && source.bodyInherited;
        const isBodyText = source.styleKind === "body_text"
          && (!isInheritedBodyText || !ALLOW_INHERITED_BODY_FONT_BACKOFF);
        const minLineRatio = isBodyText ? 1.02 : 0.98;
        const ownBox = elementBoxInPage(source);
        // collision.rect belongs to collision.source, so only judge it when
        // the repair was not handed to the node above.
        const firstLineTopCollision = !isBodyText
          && source === collision.source
          && collision.rect
          && collision.rect.top < ownBox.top - 1;
        // Increase leading when first-line ink crosses the source box's top edge.
        if (ALLOW_INHERITED_BODY_FONT_BACKOFF && isInheritedBodyText && fontSize > minFont + 0.001) {
          // The shared body font is restored first. If this one narrow
          // transition cannot fit, only this source may give back font size.
          fontSize = Math.max(minFont, fontSize - 0.25);
        } else if (firstLineTopCollision && lineRatio < 1.85 - 0.001) {
          lineRatio = Math.min(1.85, lineRatio + 0.025);
        } else if (lineRatio > minLineRatio + 0.001) {
          lineRatio = Math.max(minLineRatio, lineRatio - 0.025);
        } else if (isBodyText) {
          // 最终安全检查同样禁止单独缩小正文。行距到底仍冲突时放弃处理该正文块，
          // 避免最后一道检查重新破坏二次迭代已经保证的统一字号。
          exhausted.add(source);
          scanIndex += 1;
          continue;
        } else if (fontSize > minFont + 0.001) {
          fontSize = Math.max(minFont, fontSize - 0.25);
        } else {
          exhausted.add(source);
          scanIndex += 1;
          continue;
        }
        applyGroup([source], fontSize, lineRatio);
        source.fitLabel = "FINAL collision backoff";
      }
    }

    return { enforceFinalTextCollisionSafety };
  }

  return { createFinalAuditPass };
});
