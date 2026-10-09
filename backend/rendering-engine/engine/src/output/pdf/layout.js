"use strict";

// retain-pdf-rendering/output/pdf/layout
// Host-agnostic: never reference the host application or plugin globals here.
//
// The layout file (rpr_layout_v1): everything the PDF output draws, as data a
// person can read, diff and edit -- the role overlay.typ had for the Typst
// output. The PDF is written from this file only (overlay-pdf.js), so what
// it says is exactly what is drawn, and an edited file re-renders with
// bin/rpr-layout-pdf.js.
//
//   const layout = buildLayout(result, paint, { measurers: { regular, bold } });
//   fs.writeFileSync("layout.json", formatLayout(layout));
//
// Shape (pt; origin at the page's top-left, y down -- the coordinates of the
// OCR boxes and of the typeset result):
//   { schema: "rpr_layout_v1",
//     pages: [{ index, width, height,
//       covers: [{ block, rect: [x0, y0, x1, y1], fill: [r, g, b] }],   // drawn first
//       blocks: [{ id, fontSize, weight: "regular" | "bold", color: [r, g, b],
//         lines: [{ text, x, baseline, width, justified,
//           items: [{ x, t }                      // a cluster: its text, drawn at x
//                   | { x, t, mode: "dflt" }      // ... in a run of punctuation / digits only
//                   | { x, tex, display, w, h, d } ] }] }] }] }  // a formula: box in em of fontSize
// A line's `text` is for reading and searching only (formulas as $...$); the
// items are what is drawn. Numbers keep full precision, so a file written and
// read back draws the identical PDF.

const { OBJECT, LINE_SEPARATOR } = require("../../text/linebreak");
const { STRONG_SCRIPT } = require("./shaping");

const LAYOUT_SCHEMA = "rpr_layout_v1";

// Shaping mode per unit, as prepare() shapes: run by run between formula
// boxes and forced breaks (text/metrics.js FontMetrics.modeOf).
function unitModes(p) {
  const out = new Array(p.n);
  let start = 0;
  for (let i = 0; i <= p.n; i++) {
    if (i < p.n && p.text[i] !== OBJECT && p.text[i] !== LINE_SEPARATOR) continue;
    const mode = STRONG_SCRIPT.test(p.text.slice(start, i)) ? "zh" : "dflt";
    for (let k = start; k < i; k++) out[k] = mode;
    start = i + 1;
  }
  return out;
}

function lineText(p, start, end) {
  let text = "";
  for (let i = start; i < end; i++) {
    const c = p.text[i];
    if (c === LINE_SEPARATOR) continue;
    if (c === OBJECT) {
      const run = p.boxes.get(i).run;
      text += run.display ? `$$${run.tex}$$` : `$${run.tex}$`;
    }
    else text += c;
  }
  return text;
}

// result / paint: as for overlayDocument (output/overlay.js); measurers: the
// ones the document was typeset with. -> { layout, stats }
function buildLayout(result, paint, { measurers }) {
  if (!measurers || !measurers.regular) throw new Error("buildLayout needs measurers.regular");
  const stats = { lines: 0, justifyMismatches: 0, justifyExamples: [] };
  const pages = result.pages.map(page => {
    const nodes = (page.nodes || []).filter(node => paint[node.id]);
    const covers = [];
    for (const node of nodes) {
      const { cover, fill } = paint[node.id];
      if (!cover || !fill || !(cover[2] > cover[0]) || !(cover[3] > cover[1])) continue;
      covers.push({ block: String(node.id), rect: cover.slice(0, 4).map(Number), fill: fill.slice(0, 3).map(Number) });
    }
    const blocks = [];
    for (const node of nodes) {
      if (!node.lines || !node.lines.length) continue;
      const bold = node.fontWeight === "bold";
      const measurer = (bold && measurers.bold) || measurers.regular;
      const size = Number(node.fontSize);
      const prepared = (node.paragraphs || []).map(paragraph => measurer.prepare(paragraph.runs));
      const modes = prepared.map(unitModes);
      const lines = [];
      for (const line of node.lines) {
        if (line.toc) continue;
        const p = prepared[line.paragraph];
        if (!p || line.end <= line.start) continue;
        const placed = measurer.placeLine(p, line, {
          fontSize: size,
          target: line.justified ? line.width : undefined,
          justify: Boolean(line.justified)
        });
        if (line.justified && Math.abs(placed.width - line.width) > 0.05) {
          // A justified line that does not end at its width (nothing to
          // stretch, or a hanging final mark): diagnostics only.
          stats.justifyMismatches += 1;
          if (stats.justifyExamples.length < 5) {
            stats.justifyExamples.push({ block: String(node.id), text: lineText(p, line.start, line.end), target: line.width, placed: placed.width });
          }
        }
        const items = [];
        for (const glyph of placed.glyphs) {
          const x = line.x + glyph.x;
          const unit = p.text[glyph.index];
          if (unit === OBJECT) {
            const run = p.boxes.get(glyph.index).run;
            items.push({ x, tex: String(run.tex || ""), display: Boolean(run.display), w: Number(run.widthEm), h: Number(run.heightEm), d: Number(run.depthEm) });
            continue;
          }
          if (unit === LINE_SEPARATOR) continue;
          // The cluster: this glyph start and its zero-advance continuations.
          let end = glyph.index + 1;
          while (end < p.n && !p.glyph[end] && p.text[end] !== OBJECT && p.text[end] !== LINE_SEPARATOR) end += 1;
          const item = { x, t: p.text.slice(glyph.index, end) };
          if (modes[line.paragraph][glyph.index] === "dflt") item.mode = "dflt";
          items.push(item);
        }
        lines.push({ text: lineText(p, line.start, line.end), x: line.x, baseline: line.baseline, width: line.width, justified: Boolean(line.justified), items });
        stats.lines += 1;
      }
      blocks.push({
        id: String(node.id),
        fontSize: size,
        weight: bold ? "bold" : "regular",
        color: (paint[node.id].text || [0, 0, 0]).slice(0, 3).map(Number),
        lines
      });
    }
    return { index: page.index, width: Number(page.width), height: Number(page.height), covers, blocks };
  });
  return { layout: { schema: LAYOUT_SCHEMA, pages }, stats };
}

// JSON with one line per layout line's items (a page stays readable and a
// diff shows which line moved), everything else indented.
function formatLayout(layout) {
  const placeholders = [];
  const marked = JSON.parse(JSON.stringify(layout), (key, value) => {
    if (key === "items" && Array.isArray(value)) {
      placeholders.push(JSON.stringify(value));
      return `\u0000${placeholders.length - 1}\u0000`;
    }
    if ((key === "rect" || key === "fill" || key === "color") && Array.isArray(value)) {
      placeholders.push(JSON.stringify(value));
      return `\u0000${placeholders.length - 1}\u0000`;
    }
    return value;
  });
  return JSON.stringify(marked, null, 2).replace(/"\\u0000(\d+)\\u0000"/g, (all, index) => placeholders[Number(index)]) + "\n";
}

function validateLayout(layout) {
  if (!layout || layout.schema !== LAYOUT_SCHEMA) throw new Error(`not a layout file (schema ${JSON.stringify(layout && layout.schema)}, expected ${LAYOUT_SCHEMA})`);
  if (!Array.isArray(layout.pages)) throw new Error("layout.pages must be an array");
  layout.pages.forEach((page, p) => {
    if (!(Number(page.width) > 0 && Number(page.height) > 0)) throw new Error(`page ${p}: width and height must be positive`);
    for (const block of page.blocks || []) {
      if (!(Number(block.fontSize) > 0)) throw new Error(`page ${p} block ${block.id}: fontSize must be positive`);
      for (const line of block.lines || []) {
        if (!Number.isFinite(Number(line.baseline))) throw new Error(`page ${p} block ${block.id}: a line has no baseline`);
        for (const item of line.items || []) {
          if (!Number.isFinite(Number(item.x))) throw new Error(`page ${p} block ${block.id}: an item has no x`);
          if (item.tex === undefined && typeof item.t !== "string") throw new Error(`page ${p} block ${block.id}: an item is neither text (t) nor a formula (tex)`);
        }
      }
    }
  });
  return layout;
}

module.exports = { buildLayout, formatLayout, validateLayout, LAYOUT_SCHEMA };
