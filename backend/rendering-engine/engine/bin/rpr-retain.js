#!/usr/bin/env node
"use strict";

// rpr-retain: retain-pdf's overlay renderer.
//
//   node bin/rpr-retain.js --input in.json --out-dir DIR [--typst BIN] [--font-path DIR]...
//
// Reads rpr_retain_input_v1, writes DIR/overlay.pdf (one transparent page per
// input page), DIR/report.json (rpr_retain_report_v1), DIR/overlay.typ and
// DIR/math/ (debugging). Exit 0 on success; otherwise non-zero with one JSON
// line {"error": "..."} on stderr (2: usage or input, 1: anything else).
// Typst: --typst, else $TYPST_BIN, else `typst` on PATH. Fonts: every
// --font-path (system fonts are then ignored); none given = system fonts.

const fs = require("node:fs");
const path = require("node:path");
const { runRetain, InputError } = require("../src/retain/run");

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
  if (!options.input || !options.outDir) throw new UsageError("usage: rpr-retain.js --input <in.json> --out-dir <DIR> [--typst <bin>] [--font-path <dir>]...");
  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    let input;
    try { input = JSON.parse(fs.readFileSync(options.input, "utf8")); }
    catch (error) { throw new InputError(`cannot read input ${options.input}: ${error.message}`); }
    const { report } = runRetain(input, { outDir: options.outDir, typst: { bin: options.typst, fontPaths: options.fontPaths } });
    process.stdout.write(JSON.stringify({
      ok: true,
      overlay: path.join(options.outDir, "overlay.pdf"),
      report: path.join(options.outDir, "report.json"),
      blocks: report.blocks.length,
      overflow: report.blocks.filter(block => block.overflow).length,
      collisions: report.collisions.length,
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
