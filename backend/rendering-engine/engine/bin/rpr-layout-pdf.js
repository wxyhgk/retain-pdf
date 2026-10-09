#!/usr/bin/env node
"use strict";

// rpr-layout-pdf: draw the overlay PDF from a layout file (rpr_layout_v1).
//
//   node bin/rpr-layout-pdf.js --layout DIR/layout.json --out overlay.pdf [--font-path DIR]...
//
// rpr-retain / rpr-fit --output pdf write layout.json next to overlay.pdf: it
// is exactly what the PDF was drawn from (every cluster at its position, every
// formula's LaTeX and box, the covers). Read it, diff it, edit it (move a line,
// change a size or a word), then redraw here -- the debugging loop overlay.typ
// gave the Typst output, without Typst. The unedited file redraws the same
// bytes. Fonts: every --font-path, then the bundled data/fonts.
// Exit 0 on success; otherwise non-zero with one JSON line {"error": "..."}
// on stderr (2: usage or input, 1: anything else).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { layoutPdf } = require("../src/output/pdf/overlay-pdf");
const { validateLayout } = require("../src/output/pdf/layout");
const { findFamily, findFallbacks } = require("../src/output/pdf/fonts");
const { MathStore } = require("../src/output/math-store");

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { layout: "", out: "", fontPaths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--layout") options.layout = path.resolve(value());
    else if (arg === "--out") options.out = path.resolve(value());
    else if (arg === "--font-path") options.fontPaths.push(path.resolve(value()));
    else throw new UsageError(`unknown argument ${arg}`);
  }
  if (!options.layout || !options.out) throw new UsageError("usage: rpr-layout-pdf.js --layout <layout.json> --out <overlay.pdf> [--font-path <dir>]...");
  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    let layout;
    try { layout = validateLayout(JSON.parse(fs.readFileSync(options.layout, "utf8"))); }
    catch (error) { throw new UsageError(`cannot read layout ${options.layout}: ${error.message}`); }
    const started = performance.now();
    const fonts = { ...findFamily(options.fontPaths, "Source Han Serif SC"), fallbacks: findFallbacks(options.fontPaths) };
    // Formulas are drawn from MathJax again (deterministic); no files written.
    const maths = new MathStore(os.tmpdir(), { files: false });
    const written = layoutPdf(layout, maths, { fonts });
    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, written.pdf);
    process.stdout.write(JSON.stringify({
      ok: true,
      overlay: options.out,
      pages: layout.pages.length,
      lines: written.stats.lines,
      formulas: written.stats.formulas,
      formulas_failed: maths.stats.failed.length,
      ms: Math.round(performance.now() - started)
    }) + "\n");
    return 0;
  }
  catch (error) {
    process.stderr.write(JSON.stringify({ error: String(error && error.message || error).split("\n").filter(Boolean).join(" | ") }) + "\n");
    return error instanceof UsageError ? 2 : 1;
  }
}

process.exitCode = main();
