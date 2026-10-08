"use strict";

// retain-pdf-rendering/output/math-stamps
// Host-agnostic: never reference the host application or plugin globals here.
//
// Formula glyphs as reusable PDF stamps.
//
// Typst draws an SVG image by copying its paths into the page content on
// every use, so a book with 3,000 formula glyph draws carries 3,000 copies of
// ~150 outlines. A PDF image, however, is embedded once per page of the image
// file as a Form XObject and referenced on every use. So every distinct glyph
// outline becomes one page of stamps.pdf, and a formula becomes "draw stamp n
// here at this size" plus its rules (fraction bars, radical vinculums) as
// rectangles. The visible result is the same outline at the same place; only
// the PDF stores each outline once.
//
// flattenFormulaSVG() turns a MathJax SVG (fontCache "none": every glyph is an
// inline <path data-c> under translate/scale groups) into placements in the
// SVG's viewBox coordinates. Anything outside the handled subset (text,
// rotation/shear, mirrored glyphs, relative or arc path commands, nested
// <svg>) returns null and the caller keeps the whole-formula SVG.

const fs = require("node:fs");
const path = require("node:path");

const IDENTITY = [1, 0, 0, 1, 0, 0];
// Typst's minimum page side is 3pt; keep every stamp page above it.
const MIN_STAMP_PAGE_PT = 4;

// [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f.
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}

// SVG transform list -> matrix, or null for anything but translate/scale/matrix.
function parseTransform(value) {
  let m = IDENTITY;
  const text = String(value || "").trim();
  if (!text) return m;
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let consumed = "";
  for (const match of text.matchAll(pattern)) {
    consumed += match[0];
    const args = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (args.some(value => !Number.isFinite(value))) return null;
    let t;
    if (match[1] === "translate") t = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
    else if (match[1] === "scale") t = [args[0], 0, 0, args.length > 1 ? args[1] : args[0], 0, 0];
    else if (match[1] === "matrix" && args.length === 6) t = args;
    else return null;
    m = multiply(m, t);
  }
  if (consumed.replace(/\s+/g, "") !== text.replace(/\s+/g, "")) return null;
  return m;
}

// Control-point bounding box of an absolute M/L/H/V/Q/T/Z path (a superset of
// the ink box, which is all a stamp needs: the same box is used to draw the
// stamp and to place it). null for any other command.
function pathBBox(d) {
  const tokens = String(d || "").match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  let i = 0, cx = 0, cy = 0, qx = null, qy = null, command = null;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++];
    switch (command) {
      case "M": case "L": cx = num(); cy = num(); add(cx, cy); qx = qy = null; if (command === "M") command = "L"; break;
      case "H": cx = num(); add(cx, cy); qx = qy = null; break;
      case "V": cy = num(); add(cx, cy); qx = qy = null; break;
      case "Q": qx = num(); qy = num(); add(qx, qy); cx = num(); cy = num(); add(cx, cy); break;
      case "T": {
        qx = qx === null ? cx : 2 * cx - qx;
        qy = qy === null ? cy : 2 * cy - qy;
        add(qx, qy); cx = num(); cy = num(); add(cx, cy); break;
      }
      case "Z": qx = qy = null; break;
      default: return null;
    }
    if (tokens.length && i > tokens.length) return null;
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

function attributes(source) {
  const out = {};
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) out[match[1]] = match[2];
  return out;
}

// -> { viewBox: [x, y, w, h], shapes: [{ d, m }], rects: [{ x, y, w, h }] }
// in viewBox coordinates, or null when the formula needs the whole SVG.
function flattenFormulaSVG(svg) {
  const stack = [];
  let current = IDENTITY;
  let viewBox = null;
  const shapes = [];
  const rects = [];
  for (const match of String(svg).matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, rest, selfClosing] = match;
    if (closing) {
      if (tag === "g") current = stack.pop();
      continue;
    }
    const attrs = attributes(rest);
    if (tag === "svg") {
      if (viewBox) return null; // nested <svg>
      viewBox = String(attrs.viewBox || "").split(/[\s,]+/).map(Number);
      if (viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value))) return null;
      continue;
    }
    if (tag === "g") {
      const t = parseTransform(attrs.transform);
      if (!t) return null;
      stack.push(current);
      current = multiply(current, t);
      if (selfClosing) current = stack.pop();
      continue;
    }
    if (tag === "path") {
      // MathJax draws spaces and invisible operators as <path d="">.
      if (!String(attrs.d || "").trim()) continue;
      const t = parseTransform(attrs.transform);
      if (!t) return null;
      shapes.push({ d: attrs.d, m: multiply(current, t) });
      continue;
    }
    if (tag === "rect") {
      const [x, y, w, h] = ["x", "y", "width", "height"].map(key => Number(attrs[key] || 0));
      if (![x, y, w, h].every(Number.isFinite)) return null;
      const m = current;
      if (Math.abs(m[1]) > 1e-9 || Math.abs(m[2]) > 1e-9) return null;
      const xs = [m[0] * x + m[4], m[0] * (x + w) + m[4]];
      const ys = [m[3] * y + m[5], m[3] * (y + h) + m[5]];
      rects.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]), h: Math.abs(ys[1] - ys[0]) });
      continue;
    }
    return null; // text, use, line, defs, ...
  }
  if (!viewBox || stack.length) return null;
  return { viewBox, shapes, rects };
}

// One page per distinct outline. Placement items are fractions of the
// formula box, so the same list serves any box size.
class StampStore {
  constructor(outDir, { file = "math/stamps.pdf", unit = 0.01 } = {}) {
    this.outDir = outDir;
    this.file = file;
    this.unit = unit; // pt per glyph unit on a stamp page
    this.pages = new Map(); // d -> { page, bbox }
    this.list = [];
    // Typst draws an SVG's currentColor as black and cannot recolour a PDF
    // image, so every text colour other than black gets its own copy of the
    // stamps (same pages, same numbering, filled in that colour).
    this.colors = new Set();
    this.stats = { formulas: 0, fallbacks: [], draws: 0, rects: 0 };
  }

  // -> [[page, x, y, w, h], ...] (page 0 = filled rectangle), or null.
  formulaItems(svg, tex = "") {
    const flat = flattenFormulaSVG(svg);
    const fail = reason => { this.stats.fallbacks.push({ tex, reason }); return null; };
    if (!flat) return fail("unsupported svg");
    const [vx, vy, vw, vh] = flat.viewBox;
    if (!(vw > 0 && vh > 0)) return fail("empty viewBox");
    const items = [];
    for (const shape of flat.shapes) {
      const [a, b, c, d, e, f] = shape.m;
      // Upright glyphs only: no rotation/shear, x not mirrored, y flipped
      // exactly once (MathJax's root scale(1,-1)).
      if (Math.abs(b) > 1e-9 || Math.abs(c) > 1e-9 || !(a > 0) || !(d < 0)) return fail("transformed glyph");
      let entry = this.pages.get(shape.d);
      if (!entry) {
        const bbox = pathBBox(shape.d);
        if (!bbox || !(bbox.x1 > bbox.x0) || !(bbox.y1 > bbox.y0)) return fail("path");
        entry = { page: this.list.length + 1, bbox, d: shape.d };
        this.pages.set(shape.d, entry);
        this.list.push(entry);
      }
      const { x0, y0, x1, y1 } = entry.bbox;
      const left = a * x0 + e;
      const top = d * y1 + f;
      items.push([entry.page, (left - vx) / vw, (top - vy) / vh, (a * (x1 - x0)) / vw, (-d * (y1 - y0)) / vh]);
    }
    for (const rect of flat.rects) items.push([0, (rect.x - vx) / vw, (rect.y - vy) / vh, rect.w / vw, rect.h / vh]);
    this.stats.formulas += 1;
    this.stats.draws += flat.shapes.length;
    this.stats.rects += flat.rects.length;
    return items;
  }

  // The stamps file for a text colour ("rrggbb"; "" / "000000" = black,
  // the default file). Registers the colour so writeSources builds it.
  fileFor(hex) {
    const color = normalizeHex(hex);
    if (!color || color === "000000") return this.file;
    this.colors.add(color);
    return colorFile(this.file, color);
  }

  // Every stamps file to build: [{ hex, file }] (black first).
  targets() {
    return [{ hex: "", file: this.file }, ...[...this.colors].sort().map(hex => ({ hex, file: colorFile(this.file, hex) }))];
  }

  // Writes one SVG per outline and the Typst source that stacks them into
  // stamps.pdf (or, given a colour, its coloured copy); returns the .typ path
  // (relative to outDir) to compile, or "" when no formula used a stamp.
  writeSources(hex = "") {
    if (!this.list.length) return "";
    const color = normalizeHex(hex);
    const fill = color && color !== "000000" ? `#${color}` : "currentColor";
    const suffix = color && color !== "000000" ? `-${color}` : "";
    const dir = path.join(this.outDir, path.dirname(this.file), `stamps${suffix}`);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [];
    this.list.forEach((entry, index) => {
      const { x0, y0, x1, y1 } = entry.bbox;
      const w = x1 - x0, h = y1 - y0;
      const name = `s${entry.page}.svg`;
      fs.writeFileSync(path.join(dir, name),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${-y1} ${w} ${h}" width="${w}" height="${h}">` +
        `<path fill="${fill}" stroke="none" transform="scale(1,-1)" d="${entry.d}"/></svg>`);
      // Typst pads any page smaller than 3pt to 3pt (the outline would sit
      // in a corner of a larger page and shrink when stretched), so small
      // outlines get a larger scale. Placement uses fractions of the formula
      // box, so the page scale itself never shows.
      const unit = Math.max(this.unit, MIN_STAMP_PAGE_PT / Math.min(w, h));
      const pw = fmt(w * unit), ph = fmt(h * unit);
      if (index) lines.push("#pagebreak()");
      lines.push(`#set page(width: ${pw}pt, height: ${ph}pt, margin: 0pt)`);
      lines.push(`#image("stamps${suffix}/${name}", width: ${pw}pt, height: ${ph}pt)`);
    });
    const typ = path.join(path.dirname(this.file), `stamps${suffix}.typ`);
    fs.writeFileSync(path.join(this.outDir, typ), lines.join("\n") + "\n");
    return typ;
  }
}

function fmt(value) {
  return Number(value).toFixed(6).replace(/\.?0+$/, "") || "0";
}

function normalizeHex(hex) {
  const value = String(hex || "").replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(value) ? value : "";
}

// math/stamps.pdf -> math/stamps-1a2b3c.pdf
function colorFile(file, hex) {
  const ext = path.extname(file);
  return `${file.slice(0, file.length - ext.length)}-${hex}${ext}`;
}

// [r, g, b] in 0..1 -> "rrggbb".
function hexOf(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3) return "";
  return rgb.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 255).toString(16).padStart(2, "0")).join("");
}

// The rpr-math visual for a stamped formula: (stamps: file, items: (...)).
function stampsValue(file, items) {
  const array = items.map(item => `(${item[0]}, ${item.slice(1).map(fmt).join(", ")})`).join(", ");
  return `(stamps: ${JSON.stringify(file)}, items: (${array}${items.length === 1 ? "," : ""}))`;
}

module.exports = { flattenFormulaSVG, parseTransform, pathBBox, multiply, StampStore, stampsValue, hexOf };
