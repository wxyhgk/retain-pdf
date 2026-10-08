"use strict";

// retain-pdf-rendering/retain/run
//
// Node-only. rpr_retain_input_v1 -> transparent overlay PDF + report
// (rpr_retain_report_v1), the engine side of retain-pdf's `render.engine =
// "rpr"` route. Formats: README, "retain-pdf integration (CLI)".
//
//   const { report } = runRetain(input, { outDir, typst: { bin, fontPaths } });
//
// Steps: each block's text -> content runs (inline $...$ formulas measured
// by MathJax, "\n" a forced break) -> retain-pdf's size policy (fit.js) ->
// src/typeset (line breaks, placement, overflow and collision report) ->
// src/output overlay Typst (formulas as PDF stamps with a transparent LaTeX
// layer) -> typst compile. Writes <outDir>/overlay.typ, overlay.pdf,
// math/ and report.json.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const Text = require("../text/measurer");
const Typeset = require("../typeset");
const { MathStore } = require("../output/math-store");
const { overlayDocument } = require("../output/overlay");
const { createTypst } = require("../output/typst-runner");
const { createRetainFitter, splitParagraphs } = require("./fit");

const INPUT_SCHEMA = "rpr_retain_input_v1";
const REPORT_SCHEMA = "rpr_retain_report_v1";
const ENGINE_ROOT = path.resolve(__dirname, "../..");
// The only face with advance tables (data/fonts/).
const SUPPORTED_FAMILY = "Source Han Serif SC";

class InputError extends Error {}

const normalizeFamily = name => String(name || "").replace(/[\s_-]+/g, "").toLowerCase();

function fontTable(weight) {
  const file = weight === "bold" ? "source-han-serif-sc-bold.json" : "source-han-serif-sc-regular.json";
  return JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, "data", "fonts", file), "utf8"));
}

function color(value, field, id) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length !== 3 || value.some(v => !Number.isFinite(Number(v)))) {
    throw new InputError(`block ${id}: ${field} must be [r, g, b] in 0..1 or null`);
  }
  return value.map(Number);
}

function boxOf(value, field, id) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length !== 4 || value.some(v => !Number.isFinite(Number(v)))) {
    throw new InputError(`${id}: ${field} must be [x0, y0, x1, y1]`);
  }
  return value.map(Number);
}

function validateInput(input) {
  if (!input || typeof input !== "object") throw new InputError("input must be a JSON object");
  if (input.schema !== INPUT_SCHEMA) throw new InputError(`input schema must be ${INPUT_SCHEMA}, got ${JSON.stringify(input.schema)}`);
  const family = input.font && input.font.family !== undefined ? input.font.family : SUPPORTED_FAMILY;
  if (normalizeFamily(family) !== normalizeFamily(SUPPORTED_FAMILY)) {
    throw new InputError(`unsupported font family ${JSON.stringify(family)}: only ${JSON.stringify(SUPPORTED_FAMILY)} has advance tables`);
  }
  if (!Array.isArray(input.pages)) throw new InputError("input.pages must be an array");
  const ids = new Set();
  input.pages.forEach((page, index) => {
    if (!(Number(page.width) > 0) || !(Number(page.height) > 0)) throw new InputError(`page ${index}: width and height must be positive`);
    for (const block of page.blocks || []) {
      if (block.id === undefined || block.id === null || block.id === "") throw new InputError(`page ${index}: a block has no id`);
      const id = String(block.id);
      if (ids.has(id)) throw new InputError(`duplicate block id ${id}`);
      ids.add(id);
      boxOf(block.content_box, "content_box", `block ${id}`);
      if (!block.content_box) throw new InputError(`block ${id}: content_box is required`);
    }
    for (const obstacle of page.obstacles || []) boxOf(obstacle.box, "box", `obstacle ${obstacle.id}`);
  });
  return family;
}

// Version from package.json; commit from RPR_ENGINE_COMMIT, a COMMIT file
// next to package.json (vendored copies), or git — only when the engine root
// is itself the repository root (a copy inside another repository must not
// report that repository's commit).
function engineInfo() {
  let version = "";
  try { version = JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, "package.json"), "utf8")).version || ""; }
  catch (_) { /* no package.json */ }
  let commit = String(process.env.RPR_ENGINE_COMMIT || "").trim();
  if (!commit) {
    try { commit = fs.readFileSync(path.join(ENGINE_ROOT, "COMMIT"), "utf8").trim(); }
    catch (_) { /* no COMMIT file */ }
  }
  if (!commit) {
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ENGINE_ROOT, encoding: "utf8" });
    if (top.status === 0 && fs.realpathSync(top.stdout.trim()) === fs.realpathSync(ENGINE_ROOT)) {
      const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ENGINE_ROOT, encoding: "utf8" });
      if (head.status === 0) commit = head.stdout.trim();
    }
  }
  return { name: "retain-pdf-rendering", version, commit };
}

const round = (value, digits = 3) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

// Paint area of a block: retain-pdf's _clipped_fill_rect_typst — the text
// frame, clipped to the cover box when there is one.
function coverRect(frame, cover) {
  if (!cover) return frame;
  if (!(cover[2] > cover[0] && cover[3] > cover[1])) return frame;
  const rect = [Math.max(frame[0], cover[0]), Math.max(frame[1], cover[1]), Math.min(frame[2], cover[2]), Math.min(frame[3], cover[3])];
  return rect[2] > rect[0] && rect[3] > rect[1] ? rect : null;
}

// options: { outDir (required), typst: { bin, fontPaths, ignoreSystemFonts } }
function runRetain(input, options = {}) {
  const started = performance.now();
  const outDir = options.outDir;
  if (!outDir) throw new InputError("runRetain needs options.outDir");
  const family = validateInput(input);
  fs.mkdirSync(outDir, { recursive: true });
  const typstOptions = options.typst || {};
  const fontPaths = typstOptions.fontPaths || [];
  const typst = createTypst({
    bin: typstOptions.bin || "typst",
    fontPaths,
    // Without font directories the system fonts have to provide the face.
    ignoreSystemFonts: typstOptions.ignoreSystemFonts ?? fontPaths.length > 0
  });

  const measurer = Text.createMeasurer({ metrics: fontTable("regular") });
  const measurers = { bold: Text.createMeasurer({ metrics: fontTable("bold") }) };
  const fitter = createRetainFitter({ measurer, measurers });
  const maths = new MathStore(outDir, { stamps: true });
  const renderMathBox = (tex, display) => maths.renderMathBox(tex, display);

  // Sizes (retain-pdf's policy), then the engine sets every line.
  let mark = performance.now();
  const document = { pages: [] };
  const paint = {};
  const plans = new Map();
  for (const [index, page] of input.pages.entries()) {
    const pageIndex = Number.isFinite(Number(page.index)) ? Number(page.index) : index;
    const blocks = [];
    for (const block of page.blocks || []) {
      const id = String(block.id);
      const paragraphs = splitParagraphs(block.text).map(text => Text.contentFromText(text, { renderMathBox })
        .map(run => (run.type === "math" ? { ...run, display: false } : run)));
      let plan;
      try { plan = fitter.planBlock(block, paragraphs); }
      catch (error) { throw new InputError(error.message); }
      plans.set(id, { plan, block, page: pageIndex });
      blocks.push(plan.block);
      const fill = color(block.cover_fill, "cover_fill", id);
      paint[id] = {
        cover: fill ? coverRect(plan.frame, boxOf(block.cover_box, "cover_box", `block ${id}`)) : null,
        fill,
        text: color(block.text_color, "text_color", id) || [0, 0, 0]
      };
    }
    document.pages.push({
      index: pageIndex,
      width: Number(page.width),
      height: Number(page.height),
      blocks,
      obstacles: (page.obstacles || []).map(obstacle => ({ id: String(obstacle.id), box: obstacle.box.map(Number), kind: obstacle.kind || "other" }))
    });
  }
  const engine = Typeset.createTypesetter({ measurer, measurers });
  const result = engine.typeset(document);
  const mathjaxAfterTypeset = maths.stats.ms;
  const typesetMs = performance.now() - mark - mathjaxAfterTypeset;

  // Overlay: one transparent page per input page.
  mark = performance.now();
  const { source } = overlayDocument(result, paint, maths, { fontFamily: SUPPORTED_FAMILY });
  fs.writeFileSync(path.join(outDir, "overlay.typ"), source);
  maths.prepareStamps(typst);
  const compiled = typst.compile("overlay.typ", "overlay.pdf", outDir);
  if (/unknown font family/i.test(compiled.stderr || "")) {
    throw new Error(`typst could not find ${JSON.stringify(family)} (pass --font-path): ${compiled.stderr.trim().split("\n")[0]}`);
  }
  const compileMs = performance.now() - mark;

  const blocks = [];
  for (const [id, { plan, block, page }] of plans) {
    const engineBlock = result.report.blocks[id] || {};
    const fit = plan.fit;
    blocks.push({
      id,
      item_id: block.item_id === undefined ? null : block.item_id,
      page,
      base_font_size: round(fit.base),
      final_font_size: round(fit.final),
      min_font_size: round(fit.min),
      final_leading_em: round(fit.finalLeadingEm, 4),
      lines: engineBlock.lines || 0,
      scale: round(fit.scale, 4),
      tier: fit.tier,
      shrink_tier: fit.shrinkTier,
      at_min: fit.atMin,
      overflow: fit.overflow,
      overflow_pt: round(fit.overflowPt),
      overflow_chars_estimate: fit.overflowCharsEstimate,
      overflow_right_pt: round(engineBlock.overflowRight || 0),
      ink_overflow_bottom_pt: round(engineBlock.overflowBottom || 0),
      outside_page: Boolean(engineBlock.outsidePage),
      needed_height_pt: round(fit.neededHeight),
      available_height_pt: round(fit.availableHeight),
      text_chars: fit.textChars
    });
  }

  const report = {
    schema: REPORT_SCHEMA,
    engine: engineInfo(),
    font: { family: SUPPORTED_FAMILY },
    pages: document.pages.map(page => ({ index: page.index, width: page.width, height: page.height, blocks: page.blocks.length, obstacles: page.obstacles.length })),
    blocks,
    collisions: result.report.collisions.map(c => ({
      page: c.page, a: c.a, b: c.b, kind: c.kind,
      overlap: { x: round(c.overlap.x), y: round(c.overlap.y) },
      ...(c.kind === "obstacle" ? { insideOwnBox: c.insideOwnBox } : {})
    })),
    math: { formulas: maths.stats.formulas, failed: maths.stats.failed.map(({ tex, error }) => ({ tex, error: String(error || "") })) },
    timings: {
      typesetMs: Math.round(typesetMs),
      mathjaxMs: Math.round(maths.stats.ms),
      compileMs: Math.round(compileMs),
      totalMs: 0
    },
    files: { overlay: "overlay.pdf", typst: "overlay.typ", math: "math" }
  };
  report.timings.totalMs = Math.round(performance.now() - started);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  return { report, overlayPdf: path.join(outDir, "overlay.pdf"), result };
}

module.exports = { runRetain, validateInput, engineInfo, InputError, INPUT_SCHEMA, REPORT_SCHEMA, SUPPORTED_FAMILY };
