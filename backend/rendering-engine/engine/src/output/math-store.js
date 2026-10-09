"use strict";

// retain-pdf-rendering/output/math-store
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. Every formula of an output document, rendered once by MathJax
// (src/text/mathjax-node.js) into <outDir>/math/<hash>.svg, optionally
// flattened into reusable PDF stamps (math-stamps.js). The emitters ask the
// store for a formula's box and its rpr-math visual.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { typstString } = require("./typst-source");
const { StampStore, stampsValue } = require("./math-stamps");

let sharedRenderer = null;
function defaultRenderer() {
  if (!sharedRenderer) sharedRenderer = require("../text/mathjax-node").createMathRenderer();
  return sharedRenderer;
}

class MathStore {
  // stamps: draw formulas from reusable per-outline PDF stamps instead of
  // inlining each formula SVG (math-stamps.js). The caller must run
  // prepareStamps() before compiling or querying a document that uses them.
  // renderer: { texToSVG(tex, display) } (default: mathjax-node).
  // files: write each formula's SVG under math/ (the Typst output draws
  // them from there); the PDF output only needs entry.svg.
  constructor(outDir, { stamps = false, renderer = null, files = true } = {}) {
    this.outDir = outDir;
    this.dir = path.join(outDir, "math");
    this.files = files;
    if (files) fs.mkdirSync(this.dir, { recursive: true });
    this.renderer = renderer || defaultRenderer();
    this.stats = { formulas: 0, failed: [], ms: 0 };
    this.written = new Map();
    this.stamps = stamps ? new StampStore(outDir) : null;
    this.stampsCompiled = 0;
  }

  // Every rendered formula with its box metrics, SVG file and stamp items
  // (diagnostics / parity checks).
  manifest() {
    return [...this.written.values()].filter(entry => entry.ok)
      .map(({ tex, file, widthEm, heightEm, depthEm, items }) => ({ tex, file, widthEm, heightEm, depthEm, items: items || null }));
  }

  // (Re)builds math/stamps.pdf when formulas added new outlines since the
  // last call. typst: { compile(file, output, cwd) } (output/typst-runner.js).
  // Every colour copy is (re)built too: one per text colour formulas were
  // drawn in (see StampStore.fileFor).
  prepareStamps(typst) {
    if (!this.stamps) return null;
    const count = this.stamps.list.length;
    if (!this.stampsCompiledByFile) this.stampsCompiledByFile = new Map();
    let result = null;
    for (const { hex, file } of this.stamps.targets()) {
      if (this.stampsCompiledByFile.get(file) === count) continue;
      const typ = this.stamps.writeSources(hex);
      if (!typ) continue;
      result = typst.compile(typ, file, this.outDir);
      this.stampsCompiledByFile.set(file, count);
    }
    this.stampsCompiled = count;
    return result;
  }

  // Returns { ok, file (relative to outDir), widthEm, heightEm, depthEm }.
  get(tex, display) {
    const key = `${display ? "D" : "I"}:${tex}`;
    if (this.written.has(key)) return this.written.get(key);
    const started = performance.now();
    const result = this.renderer.texToSVG(tex, display);
    this.stats.ms += performance.now() - started;
    this.stats.formulas += 1;
    let entry;
    if (!result.ok) {
      this.stats.failed.push({ tex, error: result.error });
      entry = { ok: false, tex };
    }
    else {
      const name = `${crypto.createHash("sha1").update(key).digest("hex").slice(0, 16)}.svg`;
      const padded = padTextSVG(result.svg);
      if (this.files) fs.writeFileSync(path.join(this.dir, name), padded.svg);
      entry = {
        ok: true, tex, file: this.files ? `math/${name}` : null, svg: result.svg,
        widthEm: result.widthEm, heightEm: result.heightEm, depthEm: result.depthEm
      };
      if (padded.pad) entry.pad = padded.pad;
      if (this.stamps) entry.items = this.stamps.formulaItems(result.svg, tex);
    }
    this.written.set(key, entry);
    return entry;
  }

  // The formula's SVG drawn in a text colour ("rrggbb"): a copy with
  // currentColor replaced, written once per colour. Black keeps the original.
  coloredFile(entry, hex) {
    const color = String(hex || "").replace(/^#/, "").toLowerCase();
    if (!entry || !entry.file || !/^[0-9a-f]{6}$/.test(color) || color === "000000") return entry && entry.file;
    const ext = path.extname(entry.file);
    const file = `${entry.file.slice(0, entry.file.length - ext.length)}-${color}${ext}`;
    const target = path.join(this.outDir, file);
    if (!fs.existsSync(target)) {
      const svg = fs.readFileSync(path.join(this.outDir, entry.file), "utf8");
      fs.writeFileSync(target, svg.replace(/currentColor/g, `#${color}`));
    }
    return file;
  }

  // Shape expected by Text.contentFromText({ renderMathBox }).
  renderMathBox(tex, display) {
    const entry = this.get(tex, display);
    return entry.ok ? { widthEm: entry.widthEm, heightEm: entry.heightEm, depthEm: entry.depthEm } : null;
  }
}

// Characters MathJax's fonts lack (Å in \text{ Å}, accented letters) come out
// as SVG <text>, whose height MathJax can only guess (about 0.75 em); the
// viewBox ends there and Typst clips the image to it, so Å loses the top of
// its ring. Such SVGs get a viewBox padded by TEXT_PAD (in MathJax units,
// 1000 per em) on every side and are drawn that much larger, offset by the
// pad: the formula box (layout) is unchanged, only the ink may reach past it,
// as accents do in real type.
const TEXT_PAD = 250;
function padTextSVG(svg) {
  const text = String(svg);
  if (!text.includes("<text")) return { svg: text, pad: null };
  const match = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(text);
  if (!match) return { svg: text, pad: null };
  const [x, y, w, h] = match.slice(1).map(Number);
  if (!(w > 0) || !(h > 0)) return { svg: text, pad: null };
  const scaleAttr = (name, factor) => value => value.replace(new RegExp(`(\\s${name}=")([\\d.]+)(ex")`), (all, a, n, b) => `${a}${(Number(n) * factor).toFixed(3)}${b}`);
  let out = text.replace(match[0], `viewBox="${x - TEXT_PAD} ${y - TEXT_PAD} ${w + 2 * TEXT_PAD} ${h + 2 * TEXT_PAD}"`);
  out = scaleAttr("width", (w + 2 * TEXT_PAD) / w)(out);
  out = scaleAttr("height", (h + 2 * TEXT_PAD) / h)(out);
  return { svg: out, pad: { x: TEXT_PAD / w, y: TEXT_PAD / h } };
}

// The first argument of rpr-math for a rendered formula: stamp placements when
// the store builds stamps and this formula could be flattened, else its SVG.
// color: the text colour ("rrggbb") the formula is drawn in; stamps are
// picked from that colour's copy, a whole-formula SVG from a coloured copy of
// the SVG (Typst draws currentColor as black).
function mathVisual(entry, maths, color = "") {
  if (maths && maths.stamps && entry.items) return stampsValue(maths.stamps.fileFor(color), entry.items);
  const file = maths && typeof maths.coloredFile === "function" ? maths.coloredFile(entry, color) : entry.file;
  // A padded SVG (see padTextSVG): (svg: file, px, py), the pad as fractions
  // of the formula box.
  if (entry.pad) return `(svg: ${typstString(file)}, px: ${Number(entry.pad.x).toFixed(6)}, py: ${Number(entry.pad.y).toFixed(6)})`;
  return typstString(file);
}

module.exports = { MathStore, mathVisual, padTextSVG };
