#!/usr/bin/env node
"use strict";

// rpr-fit: retain-pdf's measured renderer (`render.engine = "rpr_fit"`): the
// engine decides every size by measurement (fit-model, retain profile).
//
//   node bin/rpr-fit.js --input in.json --out-dir DIR [--typst BIN] [--font-path DIR]...
//
// Reads rpr_fit_input_v1 (src/retain/measured.js). Large parts may be given
// as files instead of inline: document_path, translations_path,
// visual_profile_path, drawings_path (JSON). Writes DIR/overlay.pdf (one
// transparent page per rendered page), DIR/report.json (rpr_fit_report_v1),
// DIR/overlay.typ and DIR/math/. Exit codes and Typst / font lookup as
// rpr-retain.js: 0 ok; 2 usage or input; 1 anything else, with one JSON line
// {"error": "..."} on stderr.

const fs = require("node:fs");
const path = require("node:path");
const { runMeasured, InputError } = require("../src/retain/measured");

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { input: "", outDir: "", typst: process.env.TYPST_BIN || "typst", fontPaths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--input") options.input = path.resolve(value());
    else if (arg === "--out-dir") options.outDir = path.resolve(value());
    else if (arg === "--typst") options.typst = value();
    else if (arg === "--font-path") options.fontPaths.push(path.resolve(value()));
    else throw new UsageError(`unknown argument ${arg}`);
  }
  if (!options.input || !options.outDir) throw new UsageError("usage: rpr-fit.js --input <in.json> --out-dir <DIR> [--typst <bin>] [--font-path <dir>]...");
  return options;
}

function readJSON(file, what) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new InputError(`cannot read ${what} ${file}: ${error.message}`); }
}

// *_path fields -> inline values (relative paths resolve against the input file).
function resolveFiles(input, inputPath) {
  const base = path.dirname(inputPath);
  const resolved = { ...input };
  for (const key of ["document", "translations", "visual_profile", "drawings"]) {
    const file = input[`${key}_path`];
    if (file && resolved[key] == null) resolved[key] = readJSON(path.resolve(base, String(file)), key);
    delete resolved[`${key}_path`];
  }
  return resolved;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const input = resolveFiles(readJSON(options.input, "input"), options.input);
    const { report } = runMeasured(input, { outDir: options.outDir, typst: { bin: options.typst, fontPaths: options.fontPaths } });
    process.stdout.write(JSON.stringify({
      ok: true,
      overlay: path.join(options.outDir, "overlay.pdf"),
      report: path.join(options.outDir, "report.json"),
      blocks: report.blocks.length,
      overflow: report.invariants.overflow_blocks,
      line_overlaps: report.invariants.line_overlaps,
      obstacle_hits: report.invariants.obstacle_hits,
      formulas_failed: report.math.failed.length,
      ms: report.timings.totalMs
    }) + "\n");
    return 0;
  }
  catch (error) {
    const usage = error instanceof UsageError || error instanceof InputError;
    process.stderr.write(JSON.stringify({ error: String(error && error.message || error).split("\n").filter(Boolean).join(" | ") }) + "\n");
    return usage ? 2 : 1;
  }
}

process.exitCode = main();
