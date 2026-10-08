"use strict";

// retain-pdf-rendering/output/overlay
// Host-agnostic: never reference the host application or plugin globals here.
//
// Overlay Typst for a typeset document: one transparent page per input page
// (same size, every page present even when nothing is painted on it); each
// painted node gets an optional filled cover rectangle and its lines placed
// at the computed baselines. Obstacles (formulas, figures, headers ...) are
// never painted: the base PDF keeps them.
//
//   overlayDocument(result, paint, maths, { fontFamily, lang })
//   result: Typeset.typeset() output (pages[].nodes[]).
//   paint:  { [nodeId]: { cover: [x0, y0, x1, y1] | null,
//                         fill: [r, g, b] | null,   // 0..1; null = no cover
//                         text: [r, g, b] } }
//   Nodes without a paint entry are not drawn.

const { PREAMBLE, DEFAULT_FONT_FAMILY, fmt, rgb, typstString } = require("./typst-source");
const { emitTextNode } = require("./lines");

function overlayDocument(result, paint, maths, options = {}) {
  const fontFamily = options.fontFamily || DEFAULT_FONT_FAMILY;
  const lang = options.lang || "zh";
  const out = [
    `#set text(font: ${typstString(fontFamily)}, lang: ${typstString(lang)})`,
    PREAMBLE
  ];
  let painted = 0;
  result.pages.forEach((page, index) => {
    if (index) out.push("#pagebreak()");
    out.push(`#set page(width: ${fmt(page.width)}pt, height: ${fmt(page.height)}pt, margin: 0pt, fill: none)`);
    const nodes = (page.nodes || []).filter(node => paint[node.id]);
    // Covers first, then text, so no cover hides another node's overflow.
    for (const node of nodes) {
      const { cover, fill } = paint[node.id];
      if (!cover || !fill || !(cover[2] > cover[0]) || !(cover[3] > cover[1])) continue;
      out.push(`#place(top + left, dx: ${fmt(cover[0])}pt, dy: ${fmt(cover[1])}pt, rect(width: ${fmt(cover[2] - cover[0])}pt, height: ${fmt(cover[3] - cover[1])}pt, fill: ${rgb(fill)}, stroke: none))`);
    }
    for (const node of nodes) {
      if (!node.lines || !node.lines.length) continue;
      out.push(`#[`, `#set text(fill: ${rgb(paint[node.id].text || [0, 0, 0])})`, ...emitTextNode(node, maths), `]`);
      painted += 1;
    }
    // An empty page still has to exist (and keep its size).
    out.push("#box()");
  });
  return { source: out.join("\n") + "\n", painted };
}

module.exports = { overlayDocument };
