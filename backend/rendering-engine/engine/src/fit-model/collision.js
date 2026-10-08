// retain-pdf-rendering/fit-model/collision.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Glyph-level collision tests (textCollisionDetails), the group overflow
// measure and the block-overlap probe. One scan, two policies: strict (ink
// rects, zero tolerances; lineModel "measurer") and tolerant (the DOM rules'
// tolerances for CSS content areas).
(function (root, factory) {
  "use strict";
  const NAME = "collision";
  const DEPENDENCIES = [["rects", "./rects"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, rects) {
  "use strict";
  const { rectsOverlap, rectUnion, horizontalBoxesOverlap } = rects;

  function createCollision(ctx, geo) {
    const strict = ctx.strict;
    const { geometry, strictBarrier, renderedContentRectsInPage, textRectsInPage, elementBoxInPage, measureTextBand, blockDebugName } = geo;
    // Ink policy: how deep a line's band may run into another text node's box
    // once it has left its own box (pt).
    const BAND_INTRUSION_TOLERANCE = 1.0;

    // Strict collisions (lineModel "measurer"): every source rect is tested and
    // the page boundary always, with zero tolerances. Inside its own box a line
    // may not touch the ink another node keeps inside that node's box; outside
    // its own box it may touch neither that ink nor the box.
    const strictPolicy = {
      testsEveryRect: true,
      checksPageAlways: true,
      pageTolerance: 0,
      barrier(element, box) {
        return strictBarrier(element, box);
      },
      findHit(rect, { node, own, barriers, options, bodyColumnIndependentFit }) {
        const insideOwn = rect.left >= own.left - 1e-6 && rect.right <= own.right + 1e-6 &&
          rect.top >= own.top - 1e-6 && rect.bottom <= own.bottom + 1e-6;
        return barriers.find((barrier) => {
          if (bodyColumnIndependentFit && node.styleKind === "body_text" &&
              !horizontalBoxesOverlap(own, barrier.box, 1.5) && insideOwn) {
            return false;
          }
          const rects = options.fullInkBarriers ? barrier.allInk : (insideOwn ? barrier.ink : barrier.withBox);
          const bounds = options.fullInkBarriers ? barrier.allInkBounds : (insideOwn ? barrier.inkBounds : barrier.withBoxBounds);
          if (!bounds || !rectsOverlap(rect, bounds, 0)) return false;
          return rects.some((other) => rectsOverlap(rect, other, 0));
        });
      }
    };

    // Tolerant collisions (lineModel "css"): the DOM rules, whose tolerances
    // absorb the slack of CSS content areas.
    const tolerantPolicy = {
      testsEveryRect: false,
      checksPageAlways: false,
      pageTolerance: 1.5,
      barrier(element, box, barrierUsesTextGeometry) {
        if (!barrierUsesTextGeometry) return { element, box, contentRects: [box], contentBounds: box };
        const rects = renderedContentRectsInPage(element);
        return { element, box, contentRects: rects, contentBounds: rectUnion(rects) || box };
      },
      findHit(rect, { node, own, barriers, bodyColumnIndependentFit, ignoreNodeTopOverflow, sharedEdgeTolerance, sharedHorizontalEdgeTolerance }) {
        return barriers.find((barrier) => {
          // 正文的字号填充只受同列（或原始框已相互侵入）的块约束。
          // 并列栏即使处于同一高度，也不应互相压低字号；页面左右越界仍由
          // avoidPageOverflow 单独保护。这里按源框投影而非文字墨迹判断，故仍能
          // 捕获错误扩宽的正文框和向下增长压到同列块的情形。
          if (bodyColumnIndependentFit && node.styleKind === "body_text" &&
              !horizontalBoxesOverlap(own, barrier.box, 1.5)) {
            return false;
          }
          if (!rectsOverlap(rect, barrier.contentBounds, 1.5)) return false;
          const contentHit = barrier.contentRects.some((contentRect) => rectsOverlap(rect, contentRect, 1.5));
          if (!contentHit) return false;
          // Adjacent source bboxes can overlap by a rounding pixel. Ignore only
          // that upper shared edge for body text; horizontal and lower-edge
          // collisions from the same first line are still enforced.
          if (ignoreNodeTopOverflow && rect.top < own.top && barrier.box.bottom <= own.top + 1.5) {
            return false;
          }
          // Inline math and justified CJK glyphs can overhang a column edge by
          // a few pixels even though the line box itself remains in-column.
          // Treat only a shallow overhang across an exactly shared vertical
          // edge as optical ink; any deeper intrusion remains a collision.
          const sharesRightEdge = Math.abs(own.right - barrier.box.left) <= 1.5;
          const sharesLeftEdge = Math.abs(own.left - barrier.box.right) <= 1.5;
          if (sharedEdgeTolerance > 0 && (
            (sharesRightEdge && rect.right <= own.right + sharedEdgeTolerance) ||
            (sharesLeftEdge && rect.left >= own.left - sharedEdgeTolerance)
          )) {
            return false;
          }
          const sharesBottomEdge = Math.abs(own.bottom - barrier.box.top) <= 1.5;
          const sharesTopEdge = Math.abs(own.top - barrier.box.bottom) <= 1.5;
          if (sharedHorizontalEdgeTolerance > 0 && (
            (sharesBottomEdge && rect.bottom <= own.bottom + sharedHorizontalEdgeTolerance) ||
            (sharesTopEdge && rect.top >= own.top - sharedHorizontalEdgeTolerance)
          )) {
            return false;
          }
          return true;
        });
      }
    };

    // Ink collisions (typography profile "retain"): retain-pdf lets glyphs
    // overhang a block's box (CJK ink above cap height, descenders), so a line
    // may reach into the empty part of a neighbour's box. What it may never
    // touch is the neighbour's ink — all of it, spilled or not — or, for nodes
    // without text (figures, tables, preserved formulas), their box, which
    // renderedContentRectsInPage already returns as their ink. The page
    // boundary is checked with zero tolerance as in the strict policy.
    const inkPolicy = {
      testsEveryRect: true,
      checksPageAlways: true,
      pageTolerance: 0,
      barrier(element, box) {
        return strictBarrier(element, box);
      },
      // No column exemption: an ink-on-ink hit is a real overlap wherever it is.
      // A node whose size is scheduled but not settled yet (retainUnsettled,
      // passes/retain-body.js) blocks only with the ink inside its own box: its
      // spill is resolved when it is settled itself.
      findHit(rect, { barriers }) {
        return barriers.find((barrier) => {
          const unsettled = Boolean(barrier.element.retainUnsettled);
          const bounds = unsettled ? barrier.inkBounds : barrier.allInkBounds;
          const rects = unsettled ? barrier.ink : barrier.allInk;
          if (!bounds || !rectsOverlap(rect, bounds, 0)) return false;
          return rects.some((other) => rectsOverlap(rect, other, 0));
        });
      },
      // Text may run past its box into free space, not into another
      // paragraph: a line band (cap height..baseline, so descenders may still
      // overhang) outside its own box must stay out of the vertical extent of
      // every other text box in the same column (measured with the source
      // box's width, so a short last line cannot slip in beside an indent).
      findBandHit(node, { own, barriers }) {
        const band = geometry(node).band || [];
        for (const line of band) {
          if (line.bottom <= own.bottom + 1e-6 && line.top >= own.top - 1e-6) continue;
          const hit = barriers.find((barrier) => {
            if (!textRectsInPage(barrier.element).length) return false;
            const box = barrier.box;
            const depth = Math.min(line.bottom, box.bottom) - Math.max(line.top, box.top);
            const width = Math.min(own.right, box.right) - Math.max(own.left, box.left);
            return depth > BAND_INTRUSION_TOLERANCE && width > BAND_INTRUSION_TOLERANCE;
          });
          if (hit) return { hit, rect: line };
        }
        return null;
      }
    };

    const policy = ctx.collisionPolicy === "ink" ? inkPolicy : (strict ? strictPolicy : tolerantPolicy);

    function textCollisionDetails(nodes, options = {}) {
      const nodeSet = new Set(nodes);
      const includeGroupPeers = Boolean(options.includeGroupPeers);
      const ignoreTopOverflow = Boolean(options.ignoreTopOverflow);
      const checkAllTextForCollisions = Boolean(options.checkAllTextForCollisions);
      const avoidPageOverflow = Boolean(options.avoidPageOverflow);
      const bodyColumnIndependentFit = Boolean(options.bodyColumnIndependentFit);
      for (const node of nodes) {
        const page = node.page;
        const own = elementBoxInPage(node);
        const sharedEdgeTolerance = Number.isFinite(options.sharedEdgeTolerance)
          ? options.sharedEdgeTolerance
          : 0;
        const sharedHorizontalEdgeTolerance = Number.isFinite(options.sharedHorizontalEdgeTolerance)
          ? options.sharedHorizontalEdgeTolerance
          : 0;
        const ignoreNodeTopOverflow = ignoreTopOverflow || (
          Boolean(options.ignoreBodyTopOverflow) && node.styleKind === "body_text"
        );
        const sourceIsBodyText = node.styleKind === "body_text";
        // 每个文本源都逐行检测自身实际文字。区别仅在障碍物：正文迭代以实际
        // 内容为障碍；其它文本迭代以布局边框为障碍。
        const sourceRects = textRectsInPage(node).filter((rect) => {
          return policy.testsEveryRect || checkAllTextForCollisions || rect.bottom > own.bottom + 1 ||
            (!ignoreNodeTopOverflow && rect.top < own.top - 1) ||
            rect.left < own.left - 1 ||
            rect.right > own.right + 1;
        });
        if (!sourceRects.length) continue;
        // 正文迭代：正文实际文字对所有块的实际内容；其它文本迭代：自己的
        // 实际文字对所有块的边框。这样正文不受空白边框的保守限制，而题注、
        // 标题等仍以稳定的布局边框作为外部约束。
        const barrierUsesTextGeometry = Boolean(options.bodyTextCollisionGeometry) && sourceIsBodyText;
        const barriers = page.nodes
          .filter((candidate) => candidate !== node && (includeGroupPeers || !nodeSet.has(candidate)))
          .map((element) => policy.barrier(element, elementBoxInPage(element), barrierUsesTextGeometry));
        const scan = {
          node, own, barriers, options, bodyColumnIndependentFit, ignoreNodeTopOverflow,
          sharedEdgeTolerance, sharedHorizontalEdgeTolerance
        };
        if (policy.findBandHit) {
          const band = policy.findBandHit(node, scan);
          if (band) {
            return { source: node, blocker: band.hit.element, rect: band.rect, sourceName: blockDebugName(node), blockerName: blockDebugName(band.hit.element) };
          }
        }
        for (const rect of sourceRects) {
          const pageTolerance = policy.pageTolerance;
          if ((avoidPageOverflow || policy.checksPageAlways) && (
            rect.left < -pageTolerance || rect.top < -pageTolerance ||
            rect.right > page.width + pageTolerance || rect.bottom > page.height + pageTolerance
          )) {
            return { source: node, blocker: null, rect, sourceName: blockDebugName(node), blockerName: "page-boundary" };
          }
          const hit = policy.findHit(rect, scan);
          if (hit) {
            return { source: node, blocker: hit.element, rect, sourceName: blockDebugName(node), blockerName: blockDebugName(hit.element) };
          }
        }
      }
      return null;
    }

    function measureGroup(nodes) {
      let overflow = false;
      let allReachedBand = true;
      let maxBottomGap = 0;
      const details = [];
      for (const node of nodes) {
        if (!node) continue;
        const value = geometry(node);
        const clientHeight = value.clientHeight;
        const pageHeight = node.pageHeight || 792;
        const band = Number.isFinite(node.fitBandRatio)
          ? Math.max(1.0, clientHeight * node.fitBandRatio)
          : pageHeight * 0.02;
        const metrics = measureTextBand(node);
        const overflowTolerance = 1.5;
        const bottomGap = Math.max(0, clientHeight - metrics.lastBottom);
        const overflowAmount = Math.max(
          0,
          metrics.lastBottom - clientHeight - overflowTolerance,
          node.styleKind === "body_text" ? 0 : -metrics.firstTop - overflowTolerance
        );
        maxBottomGap = Math.max(maxBottomGap, bottomGap);
        if (overflowAmount > 0.5) overflow = true;
        if (!metrics.hasText || bottomGap > band) allReachedBand = false;
        details.push({ node, hasText: metrics.hasText, bottomGap, band, overflowAmount, reachedBand: metrics.hasText && bottomGap <= band });
      }
      return { overflow, allReachedBand, maxBottomGap, details };
    }

    function wouldCollideWithBlocks(nodes, options) {
      if (!options.avoidBlockOverlap) return false;
      return Boolean(textCollisionDetails(nodes, options));
    }


    return { textCollisionDetails, measureGroup, wouldCollideWithBlocks };
  }

  return { createCollision };
});
