"use strict";

// retain-pdf-rendering/output/lines
// Host-agnostic: never reference the host application or plugin globals here.
//
// Typst for typeset lines: every line is placed at the baseline the engine
// computed (absolute page coordinates), so the PDF cannot drift from the
// layout. Justified lines are stretched by Typst to the width the engine
// measured (linebreak(justify: true)); the break points are ours, never
// Typst's. Input: a node of src/typeset (or src/fit-model) output —
// { fontSize, fontWeight, paragraphs: [{ runs }], lines: [{ paragraph,
// start, end, x, baseline, width, naturalWidth, justified }] }.

const { typstString, fmt } = require("./typst-source");
const { mathVisual } = require("./math-store");

const OBJECT = "￼";
const LINE_SEPARATOR = " ";

function isSpace(c) {
  return c === " " || c === "\t" || c === " " || c === "　";
}

// The measurer's text for a paragraph: text runs as-is, a formula as one
// OBJECT unit, a forced break as LINE_SEPARATOR. Line start/end index it.
function flatten(runs) {
  let text = "";
  const boxes = new Map();
  for (const run of runs || []) {
    if (run.type === "break") text += LINE_SEPARATOR;
    else if (run.type === "math") { boxes.set(text.length, run); text += OBJECT; }
    else if (run.text) text += run.text;
  }
  return { text, boxes };
}

function mathCall(maths, tex, display, size) {
  const entry = maths.get(tex, display);
  const source = display ? `$$${tex}$$` : `$${tex}$`;
  if (!entry.ok) return `rpr-tex-fallback(${typstString(source)})`;
  return `rpr-math(${mathVisual(entry, maths)}, ${fmt(entry.widthEm * size)}pt, ${fmt(entry.heightEm * size)}pt, ${fmt(entry.depthEm * size)}pt, ${typstString(source)})`;
}

function lineBody(flat, start, end, maths, size) {
  const pieces = [];
  let text = "";
  const flush = () => { if (text) pieces.push(typstString(text)); text = ""; };
  for (let i = start; i < end; i++) {
    const c = flat.text[i];
    if (c === LINE_SEPARATOR) continue;
    if (c !== OBJECT) { text += c; continue; }
    flush();
    pieces.push(mathCall(maths, flat.boxes.get(i).tex, false, size));
  }
  flush();
  return pieces.length ? `[#${pieces.join("#")}]` : "[]";
}

// One typeset line -> a placed, baseline-anchored block.
function emitLine(node, line, flat, maths) {
  const size = node.fontSize;
  let end = line.end;
  const forced = flat.text[end - 1] === LINE_SEPARATOR || end === flat.text.length;
  if (!forced) while (end > line.start && isSpace(flat.text[end - 1])) end -= 1;
  const body = lineBody(flat, line.start, end, maths, size);
  // A line wider than its room (optimized breaking) is shrunk by Typst's own
  // justification, which "simple" breaking never does: it would break it.
  const shrink = Number(line.naturalWidth) > Number(line.width) + 1e-4;
  const content = line.justified
    ? `block(width: ${fmt(line.width)}pt, { set par(justify: true, linebreaks: "${shrink ? "optimized" : "simple"}"); [#${body}#linebreak(justify: true)] })`
    : `box(${body})`;
  // With top-edge "baseline" text adds nothing above the baseline, but an
  // inline formula box still does: the placed frame's top is the tallest
  // box's top, so lift the frame by that much to keep the baseline exact.
  let boxAscent = 0;
  for (let i = line.start; i < end; i++) {
    const box = flat.boxes.get(i);
    // The raw-LaTeX fallback is text set with the same top-edge: it adds
    // nothing above the baseline; only formula SVG boxes do.
    if (box && maths.get(box.tex, false).ok) boxAscent = Math.max(boxAscent, (Number(box.heightEm) - Number(box.depthEm)) * size);
  }
  // node.fontWeight is set by hosts that paint headings bold (and measured
  // them with the bold advance table); absent, the face's regular weight.
  const weight = node.fontWeight && node.fontWeight !== "regular" ? `, weight: "${node.fontWeight}"` : "";
  return `#place(top + left, dx: ${fmt(line.x)}pt, dy: ${fmt(line.baseline - boxAscent)}pt, { set text(size: ${fmt(size)}pt${weight}, top-edge: "baseline", bottom-edge: "baseline"); ${content} })`;
}

function emitTextNode(node, maths) {
  const out = [];
  const flats = (node.paragraphs || []).map(paragraph => flatten(paragraph.runs));
  for (const line of node.lines) {
    if (line.toc) continue;
    const flat = flats[line.paragraph];
    if (!flat || line.end <= line.start) continue;
    out.push(emitLine(node, line, flat, maths));
  }
  return out;
}

module.exports = { flatten, mathCall, emitLine, emitTextNode, OBJECT, LINE_SEPARATOR };
