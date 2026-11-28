#!/usr/bin/env node
"use strict";

// rpr-table: set translated tables into the boxes of the original ones and
// draw them as an overlay PDF (one transparent page per input page).
//
//   node bin/rpr-table.js --input in.json --out-dir DIR [--font-path DIR]...
//
// in.json (rpr_table_input_v1):
//   { schema: "rpr_table_input_v1",
//     pages: [{ index, width, height, tables: [ <table, see src/table/layout.js> ] }] }
// Writes DIR/overlay.pdf, DIR/layout.json (rpr_layout_v1: redraw with
// bin/rpr-layout-pdf.js; annotated like the body text's, each cluster's font,
// each formula's svg under DIR/math/, the faces used in layout.fonts, so a
// browser can draw the same table) and DIR/report.json (rpr_table_report_v1: per table
// fits / fontSize / width / height / columns / line_height / padding_y). Cells are text with "$...$"
// formulas (MathJax, like the body text). Fonts: every --font-path, then the
// bundled data/fonts. Exit 0 on success; otherwise non-zero with one JSON
// line {"error": "..."} on stderr (2: usage or input, 1: anything else).

const fs = require("node:fs");
const path = require("node:path");
const Text = require("../src/text/measurer");
const { layoutTable } = require("../src/table/layout");
const { layoutPdf } = require("../src/output/pdf/overlay-pdf");
const { formatLayout, LAYOUT_SCHEMA } = require("../src/output/pdf/layout");
const { findFamily, findFallbacks, BUNDLED_FONT_DIRS } = require("../src/output/pdf/fonts");
const { MathStore } = require("../src/output/math-store");

const INPUT_SCHEMA = "rpr_table_input_v1";
const REPORT_SCHEMA = "rpr_table_report_v1";
const FAMILY = "Source Han Serif SC";
const ENGINE_ROOT = path.resolve(__dirname, "..");

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { input: "", outDir: "", fontPaths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--input") options.input = path.resolve(value());
    else if (arg === "--out-dir") options.outDir = path.resolve(value());
    else if (arg === "--font-path") options.fontPaths.push(path.resolve(value()));
    else throw new UsageError(`unknown argument ${arg}`);
  }
  if (!options.input || !options.outDir) throw new UsageError("usage: rpr-table.js --input <in.json> --out-dir <DIR> [--font-path <dir>]...");
  return options;
}

function fontTable(weight) {
  const file = weight === "bold" ? "source-han-serif-sc-bold.json" : "source-han-serif-sc-regular.json";
  return JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, "data", "fonts", file), "utf8"));
}

function readInput(file) {
  let input;
  try { input = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new UsageError(`cannot read input ${file}: ${error.message}`); }
  if (!input || input.schema !== INPUT_SCHEMA) throw new UsageError(`input schema must be ${INPUT_SCHEMA}`);
  if (!Array.isArray(input.pages)) throw new UsageError("input.pages must be an array");
  input.pages.forEach((page, p) => {
    if (!(Number(page.width) > 0 && Number(page.height) > 0)) throw new UsageError(`page ${p}: width and height must be positive`);
    if (!Array.isArray(page.tables)) throw new UsageError(`page ${p}: tables must be an array`);
  });
  return input;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const input = readInput(options.input);
    const started = performance.now();
    const fontPaths = [...options.fontPaths, ...BUNDLED_FONT_DIRS.slice(0, 1)];
    const fonts = { ...findFamily(fontPaths, FAMILY), fallbacks: findFallbacks(fontPaths) };
    const measurers = {
      regular: Text.createMeasurer({ metrics: fontTable("regular") }),
      bold: Text.createMeasurer({ metrics: fontTable("bold") })
    };
    fs.mkdirSync(options.outDir, { recursive: true });
    const maths = new MathStore(options.outDir, { pad: false });
    const renderMathBox = (tex, display) => maths.renderMathBox(tex, display);
    // Formulas inside a cell are inline.
    const contentFor = text => Text.contentFromText(text, { renderMathBox }).map(run => (run.type === "math" ? { ...run, display: false } : run));
    const report = [];
    const pages = input.pages.map((page, p) => {
      const blocks = [];
      const covers = [];
      for (const table of page.tables) {
        let laid;
        try { laid = layoutTable(table, { measurers, contentFor }); }
        catch (error) { throw new UsageError(`page ${p} table ${table.id}: ${error.message}`); }
        blocks.push(...laid.blocks);
        covers.push(...laid.covers);
        report.push({ page: Number.isFinite(Number(page.index)) ? Number(page.index) : p, id: laid.id, fits: laid.fits, font_size: laid.fontSize, width: laid.width, height: laid.height, columns: laid.columns, line_height: laid.lineHeight, padding_y: laid.paddingY });
      }
      return { index: Number.isFinite(Number(page.index)) ? Number(page.index) : p, width: Number(page.width), height: Number(page.height), covers, blocks };
    });
    const layout = { schema: LAYOUT_SCHEMA, pages };
    const written = layoutPdf(layout, maths, { fonts });
    fs.writeFileSync(path.join(options.outDir, "layout.json"), formatLayout(layout));
    fs.writeFileSync(path.join(options.outDir, "overlay.pdf"), written.pdf);
    const summary = { schema: REPORT_SCHEMA, tables: report, formulas_failed: maths.stats.failed.length, ms: Math.round(performance.now() - started) };
    fs.writeFileSync(path.join(options.outDir, "report.json"), JSON.stringify(summary, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ ok: true, overlay: path.join(options.outDir, "overlay.pdf"), tables: report.length, ms: summary.ms }) + "\n");
    return 0;
  }
  catch (error) {
    process.stderr.write(JSON.stringify({ error: String(error && error.message || error).split("\n").filter(Boolean).join(" | ") }) + "\n");
    return error instanceof UsageError ? 2 : 1;
  }
}

process.exitCode = main();
