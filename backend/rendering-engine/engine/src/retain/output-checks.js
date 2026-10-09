"use strict";

// retain-pdf-rendering/retain/output-checks
//
// Invariants of a fitted (fit-model) result, as the output-path tests and the
// rpr_fit route check them. Moved from test/helpers/output-path.js, which
// re-exports it.

function overlap(a, b) {
  return {
    x: Math.min(a.right, b.right) - Math.max(a.left, b.left),
    y: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  };
}

// (a) no two painted lines (or formula / equation-number boxes) on a page
//     overlap in ink, within or across nodes;
// (b) nothing outside its page;
// (c) for two nodes stacked in one column whose source boxes do not
//     overlap, the upper node's ink ends above the lower node's ink (or box,
//     for images and tables).
function outputViolations(fitted, { epsilon = 0.01 } = {}) {
  const lineOverlaps = [];
  const outside = [];
  const order = [];
  for (const page of fitted.pages) {
    const rects = [];
    page.nodes.forEach((node, nodeIndex) => {
      node.textRects.forEach((rect, rectIndex) => rects.push({ ...rect, node: node.label, nodeIndex, rectIndex }));
    });
    for (const rect of rects) {
      if (rect.left < -epsilon || rect.top < -epsilon || rect.right > page.width + epsilon || rect.bottom > page.height + epsilon) {
        outside.push({ page: page.index, node: rect.node, rect: round(rect) });
      }
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const o = overlap(rects[i], rects[j]);
        if (o.x > epsilon && o.y > epsilon) {
          lineOverlaps.push({ page: page.index, a: rects[i].node, b: rects[j].node, sameNode: rects[i].nodeIndex === rects[j].nodeIndex, overlapY: Number(o.y.toFixed(3)), a_rect: round(rects[i]), b_rect: round(rects[j]) });
        }
      }
    }
    const ink = node => {
      const content = node.textRects.length ? node.textRects : node.contentRects;
      return {
        top: Math.min(...content.map(rect => rect.top)),
        bottom: Math.max(...content.map(rect => rect.bottom))
      };
    };
    for (const upper of page.nodes) {
      for (const lower of page.nodes) {
        if (upper === lower) continue;
        const [ux0, uy0, ux1, uy1] = upper.bbox;
        const [lx0, ly0, lx1, ly1] = lower.bbox;
        const sameColumn = Math.min(ux1, lx1) - Math.max(ux0, lx0) > 1.5;
        const stacked = uy1 <= ly0 + 1.5 && uy0 < ly0;
        if (!sameColumn || !stacked) continue;
        if (!upper.textRects.length && !upper.contentRects.length) continue;
        const a = ink(upper);
        const b = ink(lower);
        // Only text spilling over: an image/table above a text node is
        // judged by that node's ink against the image box.
        if (a.bottom > b.top + epsilon) {
          order.push({ page: page.index, upper: upper.label, lower: lower.label, upperBottom: Number(a.bottom.toFixed(2)), lowerTop: Number(b.top.toFixed(2)) });
        }
      }
    }
  }
  return { lineOverlaps, outside, order };
}

function round(rect) {
  return { left: +rect.left.toFixed(2), top: +rect.top.toFixed(2), right: +rect.right.toFixed(2), bottom: +rect.bottom.toFixed(2) };
}

module.exports = { outputViolations };
