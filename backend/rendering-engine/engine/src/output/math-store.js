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
  constructor(outDir, { stamps = false, renderer = null } = {}) {
    this.outDir = outDir;
    this.dir = path.join(outDir, "math");
    fs.mkdirSync(this.dir, { recursive: true });
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
  prepareStamps(typst) {
    if (!this.stamps || this.stamps.list.length === this.stampsCompiled) return null;
    const typ = this.stamps.writeSources();
    const result = typst.compile(typ, this.stamps.file, this.outDir);
    this.stampsCompiled = this.stamps.list.length;
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
      fs.writeFileSync(path.join(this.dir, name), result.svg);
      entry = { ok: true, tex, file: `math/${name}`, widthEm: result.widthEm, heightEm: result.heightEm, depthEm: result.depthEm };
      if (this.stamps) entry.items = this.stamps.formulaItems(result.svg, tex);
    }
    this.written.set(key, entry);
    return entry;
  }

  // Shape expected by Text.contentFromText({ renderMathBox }).
  renderMathBox(tex, display) {
    const entry = this.get(tex, display);
    return entry.ok ? { widthEm: entry.widthEm, heightEm: entry.heightEm, depthEm: entry.depthEm } : null;
  }
}

// The first argument of rpr-math for a rendered formula: stamp placements when
// the store builds stamps and this formula could be flattened, else its SVG.
function mathVisual(entry, maths) {
  if (maths && maths.stamps && entry.items) return stampsValue(maths.stamps.file, entry.items);
  return typstString(entry.file);
}

module.exports = { MathStore, mathVisual };
