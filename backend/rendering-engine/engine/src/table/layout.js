"use strict";

// retain-pdf-rendering/table/layout
// Host-agnostic: never reference the host application or plugin globals here.
//
// Table layout without a browser: a translated table set into the box of the
// original one, the way an HTML <table> lays out (auto column widths from
// min-/max-content, rowspan / colspan, wrapping inside cells), measured with
// the Text measurer (the Typst-compatible line breaker the body text uses).
//
//   const laid = layoutTable(table, { measurers: { regular, bold }, contentFor });
//
// table (pt, origin at the page's top-left, y down):
//   { id, rect: [x0, y0, x1, y1],          the original table's box
//     fontSize, minFontSize, step,          largest size tried, smallest, ladder step
//     lineHeight,                           CSS-style ratio inside a cell (1.2)
//     padding: { x, y },                    cell padding, pt
//     color: [r, g, b],                     text and rules
//     rules: { kind: "booktabs" | "grid" | "none", top, mid, bottom },  rule widths, pt
//     headerRows,                           rows above the mid rule (booktabs)
//     valign: "top" | "middle",
//     nRows, nCols,
//     cells: [{ row, col, rowspan, colspan, text, bold, align: "left" | "center" | "right" }] }
// contentFor(text): runs for the measurer (Text.contentFromText with a math
// renderer), so "$...$" in a cell is a formula.
//
// -> { id, fits, fontSize, width, height, blocks, covers }
//   blocks / covers: as in a layout page (output/pdf/layout.js, rpr_layout_v1),
//   placed in page coordinates; rules are covers (thin filled rectangles).
// The largest size on the ladder whose table fits the box (height within
// `heightTolerance`, every column at least its min-content width) is used;
// when none does, the smallest, with fits: false.

const { OBJECT, LINE_SEPARATOR } = require("../text/linebreak");
const { STRONG_SCRIPT } = require("../output/pdf/shaping");

const DEFAULTS = { lineHeight: 1.2, step: 0.25, heightTolerance: 1, valign: "top" };

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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

// Spread `extra` over `items` in proportion to `weights` (equally when they are all zero).
function spread(widths, indexes, extra, weights) {
  const total = indexes.reduce((sum, i) => sum + Math.max(0, weights[i]), 0);
  for (const i of indexes) widths[i] += total > 0 ? extra * Math.max(0, weights[i]) / total : extra / indexes.length;
}

function normalizeTable(table) {
  const rect = (table.rect || []).map(Number);
  if (rect.length !== 4 || !(rect[2] > rect[0]) || !(rect[3] > rect[1])) throw new Error(`table ${table.id}: rect must be [x0, y0, x1, y1]`);
  const cells = (table.cells || []).map(cell => ({
    row: Math.max(0, Math.trunc(num(cell.row, 0))),
    col: Math.max(0, Math.trunc(num(cell.col, 0))),
    rowspan: Math.max(1, Math.trunc(num(cell.rowspan, 1))),
    colspan: Math.max(1, Math.trunc(num(cell.colspan, 1))),
    text: String(cell.text ?? ""),
    bold: Boolean(cell.bold),
    align: ["left", "center", "right"].includes(cell.align) ? cell.align : "left"
  }));
  const nRows = Math.max(num(table.nRows, 0), ...cells.map(c => c.row + c.rowspan));
  const nCols = Math.max(num(table.nCols, 0), ...cells.map(c => c.col + c.colspan));
  const fontSize = num(table.fontSize, 10);
  const rules = table.rules || {};
  return {
    id: String(table.id ?? ""),
    rect,
    cells,
    nRows,
    nCols,
    fontSize,
    minFontSize: Math.min(fontSize, num(table.minFontSize, fontSize * 0.7)),
    step: num(table.step, DEFAULTS.step) > 0 ? num(table.step, DEFAULTS.step) : DEFAULTS.step,
    lineHeight: num(table.lineHeight, DEFAULTS.lineHeight),
    padding: { x: num((table.padding || {}).x, 2), y: num((table.padding || {}).y, 1) },
    color: Array.isArray(table.color) && table.color.length === 3 ? table.color.map(Number) : [0, 0, 0],
    rules: {
      kind: ["booktabs", "grid", "none"].includes(rules.kind) ? rules.kind : "booktabs",
      top: num(rules.top, 0.9),
      mid: num(rules.mid, 0.5),
      bottom: num(rules.bottom, 0.9)
    },
    headerRows: Math.max(0, Math.trunc(num(table.headerRows, 1))),
    valign: table.valign === "middle" ? "middle" : DEFAULTS.valign,
    heightTolerance: num(table.heightTolerance, DEFAULTS.heightTolerance)
  };
}

// Column widths at one font size, as HTML's automatic table layout: every
// column gets its min-content width, the room left is shared in proportion to
// what each column would still take to reach its max-content width; when all
// columns reach it, the rest goes in proportion to max-content. Spanning cells
// widen the columns they span when they need more than those columns give.
function columnWidths(t, prepared, fontSize) {
  const minW = new Array(t.nCols).fill(0);
  const maxW = new Array(t.nCols).fill(0);
  const pad = 2 * t.padding.x;
  const measure = (cell, p) => {
    const m = p.measurer;
    const min = m.layout(p.prepared, { fontSize, width: 0.001, align: "left" }).maxLineWidth;
    const max = m.naturalWidth(p.prepared, { fontSize });
    return { min: min + pad, max: Math.max(min, max) + pad };
  };
  const sizes = t.cells.map((cell, i) => measure(cell, prepared[i]));
  t.cells.forEach((cell, i) => {
    if (cell.colspan !== 1) return;
    minW[cell.col] = Math.max(minW[cell.col], sizes[i].min);
    maxW[cell.col] = Math.max(maxW[cell.col], sizes[i].max);
  });
  t.cells.forEach((cell, i) => {
    if (cell.colspan === 1) return;
    const cols = Array.from({ length: cell.colspan }, (_, k) => cell.col + k);
    const haveMin = cols.reduce((s, c) => s + minW[c], 0);
    const haveMax = cols.reduce((s, c) => s + maxW[c], 0);
    if (sizes[i].min > haveMin) spread(minW, cols, sizes[i].min - haveMin, maxW);
    if (sizes[i].max > haveMax) spread(maxW, cols, sizes[i].max - haveMax, maxW);
  });
  for (let c = 0; c < t.nCols; c++) maxW[c] = Math.max(maxW[c], minW[c]);
  const width = t.rect[2] - t.rect[0];
  const sumMin = minW.reduce((a, b) => a + b, 0);
  const sumMax = maxW.reduce((a, b) => a + b, 0);
  const all = Array.from({ length: t.nCols }, (_, c) => c);
  let widths;
  if (sumMax <= width) {
    widths = maxW.slice();
    spread(widths, all, width - sumMax, maxW);
  }
  else if (sumMin <= width) {
    widths = minW.slice();
    spread(widths, all, width - sumMin, maxW.map((m, c) => m - minW[c]));
  }
  else widths = minW.slice();
  return { widths, minFits: sumMin <= width + 0.01 };
}

function layoutAt(t, prepared, fontSize) {
  const { widths, minFits } = columnWidths(t, prepared, fontSize);
  const colX = [0];
  for (const w of widths) colX.push(colX[colX.length - 1] + w);
  const laid = t.cells.map((cell, i) => {
    const inner = Math.max(0.001, colX[cell.col + cell.colspan] - colX[cell.col] - 2 * t.padding.x);
    const result = prepared[i].measurer.layout(prepared[i].prepared, { fontSize, width: inner, lineHeight: t.lineHeight, align: cell.align });
    return { inner, result, height: (result.lines.length ? result.height : 0) + 2 * t.padding.y };
  });
  const rowH = new Array(t.nRows).fill(0);
  t.cells.forEach((cell, i) => { if (cell.rowspan === 1) rowH[cell.row] = Math.max(rowH[cell.row], laid[i].height); });
  for (let r = 0; r < t.nRows; r++) if (!rowH[r]) rowH[r] = fontSize + 2 * t.padding.y;
  t.cells.forEach((cell, i) => {
    if (cell.rowspan === 1) return;
    const rows = Array.from({ length: cell.rowspan }, (_, k) => cell.row + k).filter(r => r < t.nRows);
    const have = rows.reduce((s, r) => s + rowH[r], 0);
    if (laid[i].height > have) rowH[rows[rows.length - 1]] += laid[i].height - have;
  });
  const rowY = [0];
  for (const h of rowH) rowY.push(rowY[rowY.length - 1] + h);
  return { fontSize, widths, colX, rowH, rowY, laid, height: rowY[rowY.length - 1], minFits };
}

function emit(t, prepared, at) {
  const [x0, y0] = t.rect;
  const blocks = [];
  t.cells.forEach((cell, i) => {
    const { measurer, prepared: p, bold } = prepared[i];
    const { result } = at.laid[i];
    if (!result.lines.length) return;
    const cellTop = y0 + at.rowY[cell.row];
    const cellH = at.rowY[Math.min(t.nRows, cell.row + cell.rowspan)] - at.rowY[cell.row];
    const contentH = result.height;
    const top = cellTop + t.padding.y + (t.valign === "middle" ? Math.max(0, (cellH - 2 * t.padding.y - contentH) / 2) : 0);
    const left = x0 + at.colX[cell.col] + t.padding.x;
    const modes = unitModes(p);
    const lines = [];
    for (const line of result.lines) {
      if (line.end <= line.start) continue;
      const placed = measurer.placeLine(p, line, { fontSize: at.fontSize });
      const items = [];
      for (const glyph of placed.glyphs) {
        const x = left + line.x + glyph.x;
        const unit = p.text[glyph.index];
        if (unit === OBJECT) {
          const run = p.boxes.get(glyph.index).run;
          items.push({ x, tex: String(run.tex || ""), display: Boolean(run.display), w: Number(run.widthEm), h: Number(run.heightEm), d: Number(run.depthEm) });
          continue;
        }
        if (unit === LINE_SEPARATOR) continue;
        let end = glyph.index + 1;
        while (end < p.n && !p.glyph[end] && p.text[end] !== OBJECT && p.text[end] !== LINE_SEPARATOR) end += 1;
        const item = { x, t: p.text.slice(glyph.index, end) };
        if (modes[glyph.index] === "dflt") item.mode = "dflt";
        items.push(item);
      }
      const text = items.map(item => (item.tex !== undefined ? `$${item.tex}$` : item.t)).join("");
      lines.push({ text, x: left + line.x, baseline: top + line.baseline, width: placed.width, justified: false, items });
    }
    blocks.push({ id: `${t.id}:r${cell.row}c${cell.col}`, fontSize: at.fontSize, weight: bold ? "bold" : "regular", color: t.color.slice(), lines });
  });
  return { blocks, covers: rules(t, at) };
}

function rules(t, at) {
  const [x0, y0] = t.rect;
  const x1 = x0 + at.colX[at.colX.length - 1];
  const covers = [];
  const hline = (y, width, from = x0, to = x1) => {
    if (width > 0) covers.push({ block: `${t.id}:rule`, rect: [from, y - width / 2, to, y + width / 2], fill: t.color.slice() });
  };
  const vline = (x, width, from, to) => {
    if (width > 0) covers.push({ block: `${t.id}:rule`, rect: [x - width / 2, from, x + width / 2, to], fill: t.color.slice() });
  };
  const bottom = y0 + at.height;
  if (t.rules.kind === "booktabs") {
    hline(y0, t.rules.top);
    if (t.headerRows > 0 && t.headerRows < t.nRows) hline(y0 + at.rowY[t.headerRows], t.rules.mid);
    hline(bottom, t.rules.bottom);
  }
  else if (t.rules.kind === "grid") {
    const w = t.rules.mid;
    // Every cell's four edges; shared edges are drawn once.
    const seen = new Set();
    for (const cell of t.cells) {
      const cx0 = x0 + at.colX[cell.col];
      const cx1 = x0 + at.colX[Math.min(at.colX.length - 1, cell.col + cell.colspan)];
      const cy0 = y0 + at.rowY[cell.row];
      const cy1 = y0 + at.rowY[Math.min(t.nRows, cell.row + cell.rowspan)];
      for (const [key, draw] of [
        [`h${cy0.toFixed(2)}:${cx0.toFixed(2)}`, () => hline(cy0, w, cx0, cx1)],
        [`h${cy1.toFixed(2)}:${cx0.toFixed(2)}`, () => hline(cy1, w, cx0, cx1)],
        [`v${cx0.toFixed(2)}:${cy0.toFixed(2)}`, () => vline(cx0, w, cy0, cy1)],
        [`v${cx1.toFixed(2)}:${cy0.toFixed(2)}`, () => vline(cx1, w, cy0, cy1)]
      ]) {
        if (seen.has(key)) continue;
        seen.add(key);
        draw();
      }
    }
  }
  return covers;
}

function layoutTable(table, { measurers, contentFor }) {
  if (!measurers || !measurers.regular) throw new Error("layoutTable needs measurers.regular");
  const t = normalizeTable(table);
  const content = typeof contentFor === "function" ? contentFor : text => [{ type: "text", text }];
  const prepared = t.cells.map(cell => {
    const measurer = (cell.bold && measurers.bold) || measurers.regular;
    return { measurer, bold: cell.bold && Boolean(measurers.bold), prepared: measurer.prepare(content(cell.text)) };
  });
  const boxH = t.rect[3] - t.rect[1];
  let chosen = null;
  for (let size = t.fontSize; size >= t.minFontSize - 1e-6; size = Math.round((size - t.step) * 1000) / 1000) {
    const at = layoutAt(t, prepared, size);
    if (at.minFits && at.height <= boxH + t.heightTolerance) { chosen = { at, fits: true }; break; }
    chosen = { at, fits: false };
  }
  if (!chosen) chosen = { at: layoutAt(t, prepared, t.minFontSize), fits: false };
  const { blocks, covers } = emit(t, prepared, chosen.at);
  return {
    id: t.id,
    fits: chosen.fits,
    fontSize: chosen.at.fontSize,
    width: chosen.at.colX[chosen.at.colX.length - 1],
    height: chosen.at.height,
    columns: chosen.at.widths,
    blocks,
    covers
  };
}

module.exports = { layoutTable, normalizeTable };
