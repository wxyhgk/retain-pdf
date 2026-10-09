"use strict";

// retain-pdf-rendering/retain/measured
//
// Node-only. rpr_fit_input_v1 -> transparent overlay PDF + report
// (rpr_fit_report_v1), the engine side of retain-pdf's `render.engine =
// "rpr_fit"` route: the engine decides every size itself, by measurement.
//
//   const { report } = runMeasured(input, { outDir, typst: { bin, fontPaths } });
//
// Unlike runRetain (rpr: sizes and fit permissions come from retain-pdf's
// own pipeline, the engine only sets them), this runs the fit-model with the
// "retain" typography profile on the job's own data -- the configuration of
// experiments/overlay/run.js --preset retain:
//   - seeds from OCR line geometry the way retain-pdf estimates them
//     (estimate_font_size_pt / local_font_size_pt), body classification as
//     retain-pdf's is_body_text_candidate;
//   - retain-pdf's body / non-body / annotation / heading size and leading
//     rules, applied with exact measurement: one shared body size per book
//     (per-paragraph caps where a paragraph cannot reach it in its own box),
//     no Typst shrinking afterwards;
//   - an ink collision safety net: text never overlaps other text, a
//     preserved element (formula, figure, table, untranslated text) or the
//     source's vector graphics (rules, frames, panels) that have no OCR box;
//   - headings measured with the bold table and painted bold.
// What may still happen (reported, never hidden): text running below its own
// box into free space (overflow_pt), and paragraphs shrunk well below the
// body size to fit their box.
//
// Input (rpr_fit_input_v1):
//   { schema, font: { family },
//     document: <document.v1 object>,            // pages[].blocks[] with bbox, type, sub_type, lines
//     translations: [ { page_idx, block_idx, item_id, policy_translate,
//                       translated_text, source_text, lines } ],
//     visual_profile: <visual_profile.v1 object> | null,   // cover / text colours
//     drawings: { "<page index>": { width, height, drawings, images, words } } | null,
//     pages: [<page index>, ...] | null }        // pages to render, in order; null = all
// Output: <outDir>/overlay.pdf (one transparent page per rendered page),
// overlay.typ, math/, report.json.

const fs = require("node:fs");
const path = require("node:path");
const FitModel = require("../fit-model.js");
const Text = require("../text/measurer");
const { defaultFontTable } = require("../index.js");
const { MathStore } = require("../output/math-store");
const { overlayDocument } = require("../output/overlay");
const { createTypst } = require("../output/typst-runner");
const { overlayPdf } = require("../output/pdf/overlay-pdf");
const { findFamily, findFallbacks, BUNDLED_FONT_DIRS } = require("../output/pdf/fonts");
const { buildModel, blockNumber } = require("./job-model");
const VectorObstacles = require("./vector-obstacles");
const { outputViolations } = require("./output-checks");
const { engineInfo } = require("./run");

const FIT_INPUT_SCHEMA = "rpr_fit_input_v1";
const FIT_REPORT_SCHEMA = "rpr_fit_report_v1";
const SUPPORTED_FONT_FAMILY = "Source Han Serif SC";
const OVERFLOW_TOLERANCE_PT = 0.5;

// experiments/overlay/run.js --preset retain.
const PRESET = Object.freeze({
  typography: "retain",
  seed: "geometry",
  vectorObstacles: true,
  tightenObstacles: true,
  boldTitles: true,
  faithful: true,
  bodyLineHeight: 1.25,
  bodyMaxFactor: 1,
  strictSourceFit: true,
  fontCaps: true
});

class InputError extends Error {}

function validate(input) {
  if (!input || typeof input !== "object") throw new InputError("input must be a JSON object");
  if (input.schema !== FIT_INPUT_SCHEMA) throw new InputError(`input.schema must be ${FIT_INPUT_SCHEMA}`);
  const family = String(input.font?.family || SUPPORTED_FONT_FAMILY);
  if (family !== SUPPORTED_FONT_FAMILY) throw new InputError(`font family ${JSON.stringify(family)} is not supported (only ${SUPPORTED_FONT_FAMILY})`);
  if (!input.document || !Array.isArray(input.document.pages)) throw new InputError("input.document must be a document.v1 object with pages[]");
  if (!Array.isArray(input.translations)) throw new InputError("input.translations must be an array of translation items");
  if (input.pages != null && !Array.isArray(input.pages)) throw new InputError("input.pages must be an array of page indices or null");
}

// The job as experiments/overlay/adapter.js loadJob builds it, minus files.
function jobFromInput(input) {
  const wanted = Array.isArray(input.pages) ? input.pages.map(Number) : null;
  const byIndex = new Map(input.document.pages.map(page => [Number(page.page_index), page]));
  const pages = wanted ? wanted.map(index => byIndex.get(index)).filter(Boolean) : input.document.pages;
  const translations = new Map();
  for (const item of input.translations) translations.set(`${item.page_idx}:${item.block_idx}`, item);
  return {
    document: { ...input.document, pages },
    translations,
    profile: input.visual_profile && typeof input.visual_profile === "object" ? input.visual_profile : { pages: {} }
  };
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (value, digits = 3) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

// options: { outDir, output: "typst" (default) | "pdf", typst: { bin, fontPaths } }
// output "pdf" writes overlay.pdf directly (output/pdf), without Typst.
function runMeasured(input, options = {}) {
  validate(input);
  const output = options.output || "typst";
  if (output !== "typst" && output !== "pdf") throw new Error(`unknown output ${JSON.stringify(output)} (typst | pdf)`);
  const outDir = path.resolve(options.outDir || "rpr-fit-out");
  fs.mkdirSync(outDir, { recursive: true });
  const started = performance.now();
  const timings = {};
  const job = jobFromInput(input);
  const fontPaths = (options.typst && options.typst.fontPaths) || [];
  // Fail before any work when the PDF output cannot find its font files.
  const fonts = output === "pdf" ? { ...findFamily(fontPaths, "Source Han Serif SC"), fallbacks: findFallbacks(fontPaths) } : null;

  const maths = output === "pdf" ? new MathStore(outDir, { files: false }) : new MathStore(outDir, { stamps: true });
  const renderMathBox = (tex, display) => {
    const entry = maths.get(tex, display);
    // A formula MathJax cannot render stays as plain text in the body font.
    return entry.ok ? { widthEm: entry.widthEm, heightEm: entry.heightEm, depthEm: entry.depthEm } : null;
  };
  const runsForText = text => Text.contentFromText(text, { renderMathBox })
    .map(run => (run.type === "math" ? { ...run, display: false } : run));

  let mark = performance.now();
  const { model, paint, stats, vectors } = buildModel(job, {
    drawings: input.drawings || null,
    vectorObstacles: PRESET.vectorObstacles && Boolean(input.drawings),
    tightenObstacles: PRESET.tightenObstacles && Boolean(input.drawings),
    typography: PRESET.typography,
    retainBodyClassify: PRESET.faithful,
    seed: PRESET.seed,
    sourceSizes: {},
    bodyLineHeight: PRESET.bodyLineHeight
  });
  timings.modelMs = Math.round(performance.now() - mark - maths.stats.ms);
  // Seed sizes (retain-pdf's geometry estimate) before the fitter changes them.
  const seeds = new Map();
  for (const page of model.pages) {
    for (const stream of page.restoration.streams) for (const item of stream.items) seeds.set(String(item.id), Number(stream.fontSize));
    for (const block of page.restoration.absoluteBlocks) if (block.kind === "text") seeds.set(String(block.id), Number(block.fontSize));
  }

  const base = Text.createMeasurer({ metrics: defaultFontTable() });
  const bold = Text.createMeasurer({ metrics: defaultFontTable("bold") });
  const defaults = FitModel.defaultContentFor({ renderMathBox });
  const contentFor = (node, mode) => {
    if (node.kind === "stream") {
      return { paragraphs: (node.source.items || []).map(item => ({ runs: runsForText(item.translatedText || item.text), indent: 0 })) };
    }
    if (node.source.kind === "text" && node.source.translatedText) {
      return { paragraphs: [{ runs: runsForText(node.source.translatedText), indent: 0 }] };
    }
    return defaults(node, mode);
  };
  const fitter = FitModel.createModelFitter({
    measurer: base, measurers: { bold }, lineModel: "measurer", contentFor, typography: PRESET.typography
  });
  const bodyMaxFont = Number.isFinite(stats.sourceBodyFont) ? round(stats.sourceBodyFont * PRESET.bodyMaxFactor, 2) : undefined;
  mark = performance.now();
  const mathBefore = maths.stats.ms;
  const fitted = fitter.fitDocument(model, {
    mode: "translation", bodyMaxFont, strictSourceFit: PRESET.strictSourceFit, bodyNodeFontCaps: PRESET.fontCaps
  });
  timings.fitMs = Math.round(performance.now() - mark - (maths.stats.ms - mathBefore));

  mark = performance.now();
  let painted;
  let outputStats = null;
  if (output === "pdf") {
    const written = overlayPdf(fitted, paint, maths, { fonts, measurers: { regular: base, bold } });
    fs.writeFileSync(path.join(outDir, "overlay.pdf"), written.pdf);
    painted = written.painted;
    outputStats = written.stats;
    timings.stampsCompileMs = 0;
    timings.compileMs = 0;
    timings.emitMs = Math.round(performance.now() - mark);
  }
  else {
    const overlay = overlayDocument(fitted, paint, maths);
    painted = overlay.painted;
    fs.writeFileSync(path.join(outDir, "overlay.typ"), overlay.source);
    const typstOptions = options.typst || {};
    const typst = createTypst({ ...typstOptions, fontPaths: [...fontPaths, ...BUNDLED_FONT_DIRS.slice(0, 1)] });
    const stamped = maths.prepareStamps(typst);
    timings.stampsCompileMs = stamped ? Math.round(stamped.ms) : 0;
    const compiled = typst.compile("overlay.typ", "overlay.pdf", outDir);
    timings.compileMs = Math.round(compiled.ms);
    timings.emitMs = Math.round(performance.now() - mark) - timings.compileMs - timings.stampsCompileMs;
  }
  timings.mathjaxMs = Math.round(maths.stats.ms);

  const report = buildReport({ job, input, fitted, paint, stats, vectors, maths, painted, bodyMaxFont, seeds });
  timings.totalMs = Math.round(performance.now() - started);
  report.timings = timings;
  report.output = output === "pdf" ? { kind: "pdf", stats: outputStats } : { kind: "typst" };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  return { report, overlayPdf: path.join(outDir, "overlay.pdf"), outDir };
}

function buildReport({ job, input, fitted, paint, stats, vectors, maths, painted, bodyMaxFont, seeds }) {
  const itemFor = (pageIndex, id) => job.translations.get(`${pageIndex}:${blockNumber(id)}`) || null;
  const blocks = [];
  const pages = [];
  fitted.pages.forEach((page, offset) => {
    const source = job.document.pages[offset] || {};
    pages.push({ index: offset, source_page_index: Number(source.page_index ?? page.index), width: page.width, height: page.height });
    for (const node of page.nodes) {
      if (!paint[node.id]) continue;
      const item = itemFor(Number(source.page_index ?? page.index), node.id);
      const rects = node.textRects || [];
      const inkBottom = rects.length ? Math.max(...rects.map(rect => rect.bottom)) : node.bbox[1];
      const inkRight = rects.length ? Math.max(...rects.map(rect => rect.right)) : node.bbox[0];
      const overflowPt = Math.max(0, inkBottom - node.bbox[3]);
      const seed = seeds.get(String(node.id));
      blocks.push({
        id: String(node.id),
        item_id: item ? String(item.item_id || "") : "",
        page: Number(source.page_index ?? page.index),
        kind: node.styleKind === "body_text" ? "body" : (node.type === "title" ? "title" : (/caption|footnote/.test(String(node.type)) ? "caption" : "text")),
        seed_font_size: Number.isFinite(seed) ? round(seed) : null,
        final_font_size: round(node.fontSize),
        line_height: round(node.lineHeight, 4),
        font_weight: node.fontWeight || "regular",
        lines: (node.lines || []).length,
        overflow: overflowPt > OVERFLOW_TOLERANCE_PT,
        overflow_pt: round(overflowPt),
        overflow_right_pt: round(Math.max(0, inkRight - node.bbox[2])),
        outside_page: rects.some(rect => rect.left < -1e-6 || rect.top < -1e-6 || rect.right > page.width + 1e-6 || rect.bottom > page.height + 1e-6),
        stop_reason: node.fit?.stopReason || null
      });
    }
  });

  // Invariants of the fitted output: text vs text, and text vs every
  // preserved element (obstacle nodes: OCR blocks kept from the source and
  // vector graphics), as experiments/overlay/run.js reports them.
  const violations = outputViolations(fitted);
  const isObstacle = label => /^block:image#/.test(label);
  const order = violations.order.filter(entry => !isObstacle(entry.upper) && !isObstacle(entry.lower));
  const obstacleHits = [];
  for (const page of fitted.pages) {
    const obstacles = page.nodes.filter(node => !paint[node.id]);
    for (const node of page.nodes.filter(node => paint[node.id])) {
      for (const rect of node.textRects || []) {
        for (const obstacle of obstacles) {
          const [x0, y0, x1, y1] = obstacle.bbox;
          const ox = Math.min(rect.right, x1) - Math.max(rect.left, x0);
          const oy = Math.min(rect.bottom, y1) - Math.max(rect.top, y0);
          if (ox > 0.01 && oy > 0.01) obstacleHits.push({ page: page.index, a: String(node.id), b: String(obstacle.id), overlap_pt: round(oy, 2) });
        }
      }
    }
  }
  const vectorHits = VectorObstacles.vectorHits(fitted, vectors, paint);
  const body = blocks.filter(block => block.kind === "body").map(block => block.final_font_size);
  const sorted = body.slice().sort((a, b) => a - b);
  // The size the body paragraphs share: the most common one (paragraphs that
  // cannot reach it in their own box get their own, smaller cap).
  const counts = new Map();
  for (const size of body) counts.set(size, (counts.get(size) || 0) + 1);
  const shared = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
  return {
    schema: FIT_REPORT_SCHEMA,
    engine: engineInfo(),
    preset: "retain",
    font: { family: SUPPORTED_FONT_FAMILY },
    pages,
    blocks,
    painted,
    body_font: {
      ceiling: bodyMaxFont ?? null,
      shared,
      median: round(median(body)),
      min: sorted.length ? sorted[0] : null,
      paragraphs: body.length,
      // Body paragraphs set more than 0.5 pt below the shared body size.
      below_shared: shared ? body.filter(size => size < shared - 0.5).length : 0
    },
    invariants: {
      line_overlaps: violations.lineOverlaps.length,
      outside: violations.outside.length,
      order: order.length,
      obstacle_hits: obstacleHits.length,
      vector_hits: vectorHits.length,
      overflow_blocks: blocks.filter(block => block.overflow).length
    },
    collisions: [
      ...violations.lineOverlaps.slice(0, 50).map(entry => ({ kind: "text", ...entry })),
      ...obstacleHits.slice(0, 50).map(entry => ({ kind: "obstacle", ...entry }))
    ],
    adapter: stats,
    math: { formulas: maths.stats.formulas, failed: maths.stats.failed.map(entry => ({ tex: entry.tex, error: String(entry.error || "") })) }
  };
}

module.exports = { runMeasured, InputError, FIT_INPUT_SCHEMA, FIT_REPORT_SCHEMA, PRESET };
