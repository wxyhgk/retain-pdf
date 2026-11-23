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
//                       translated_text, source_text, lines,
//                       first_line_indent_pt?,       // retain-pdf's measured indent, pt
//                       source_font_size_pt? } ],    // headings: source size, pt (fit at or below it)
//     visual_profile: <visual_profile.v1 object> | null,   // cover / text colours
//     drawings: { "<page index>": { width, height, drawings, images, words } } | null,
//     pages: [<page index>, ...] | null,         // pages to render, in order; null = all
//     (translations[].flow: { group, index, count, text } -- one paragraph the source set across
//      `count` body boxes; `text` is the whole translation, cut by retain/continuation-balance.js
//      at line ends; continuation_flow: "flow" (default) | "balance" picks how)
//     fill_policy: { <FillPolicy parameter>: number } | null,    // overrides of fit-model/fill-policy.js DEFAULTS
//     widen_policy: { <WidenPolicy parameter>: number } | null } // overrides of fit-model/widen-policy.js DEFAULTS
// Output: <outDir>/overlay.pdf (one transparent page per rendered page),
// overlay.typ, math/, report.json.

const fs = require("node:fs");
const path = require("node:path");
const FitModel = require("../fit-model.js");
const FillPolicy = require("../fit-model/fill-policy");
const WidenPolicy = require("../fit-model/widen-policy");
const ContinuationBalance = require("./continuation-balance");
const { STREAM_PADDING_LEFT, STREAM_PADDING_RIGHT } = require("../fit-model/constants");
const Text = require("../text/measurer");
const { defaultFontTable } = require("../index.js");
const { MathStore } = require("../output/math-store");
const { overlayDocument } = require("../output/overlay");
const { createTypst } = require("../output/typst-runner");
const { overlayPdf } = require("../output/pdf/overlay-pdf");
const { formatLayout } = require("../output/pdf/layout");
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
  if (input.fill_policy != null) {
    if (typeof input.fill_policy !== "object" || Array.isArray(input.fill_policy)) throw new InputError("input.fill_policy must be an object or null");
    try { FillPolicy.resolve(input.fill_policy); }
    catch (error) { throw new InputError(error.message); }
  }
  if (input.continuation_flow != null && !["flow", "balance"].includes(input.continuation_flow)) {
    throw new InputError('input.continuation_flow must be "flow", "balance" or null');
  }
  if (input.widen_policy != null) {
    if (typeof input.widen_policy !== "object" || Array.isArray(input.widen_policy)) throw new InputError("input.widen_policy must be an object or null");
    try { WidenPolicy.resolve(input.widen_policy); }
    catch (error) { throw new InputError(error.message); }
  }
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
// Model + fit, without any output: what runMeasured lays out before it writes the PDF or
// Typst overlay. Tests and diagnostics call it directly (no font files, no typst binary);
// Paragraphs the source set across several body boxes (translations[].flow):
// the whole translation is laid out box by box and cut at line ends
// (retain/continuation-balance.js) instead of the host's cut by source length.
// Groups that are not all body boxes of this job, or whose text has a display
// formula or unbalanced dollars, keep the host's cut. -> report entries.
function splitContinuations(input, job, model, { measurer, contentFor }) {
  const mode = input.continuation_flow === "balance" ? "balance" : "flow";
  const blockIds = new Map();
  for (const page of job.document.pages) {
    for (const block of page.blocks || []) blockIds.set(`${page.page_index}:${blockNumber(String(block.block_id))}`, String(block.block_id));
  }
  const streams = new Map();
  const pageBlocks = new Map();
  for (const page of model.pages) {
    for (const stream of page.restoration.streams) for (const item of stream.items) streams.set(String(item.id), { stream, item });
    for (const block of page.blocks || []) pageBlocks.set(String(block.id), block);
  }
  const groups = new Map();
  for (const item of input.translations) {
    const flow = item.flow;
    if (!flow || typeof flow !== "object" || flow.group === undefined) continue;
    const key = String(flow.group);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ flow, id: blockIds.get(`${item.page_idx}:${item.block_idx}`) });
  }
  // Capacity is what fits in the box, not the source line count: those boxes are tight, and the
  // fitter sets the shared body size (about the median seed, often a little above a box's own seed)
  // with the stream's line height and keeps reserveEm under each paragraph (fill-policy.js).
  const seedsAll = [];
  for (const { stream } of streams.values()) if (Number(stream.fontSize) > 0) seedsAll.push(Number(stream.fontSize));
  // Measured 3% large: the shared size the fitter settles on can be a little above the median seed,
  // and one line more in a box cut to its capacity is an overflow (3bfb0b p041: a one-character fourth line).
  const sharedGuess = (median(seedsAll) || 0) * 1.03;
  const reserveEm = Number((input.fill_policy && input.fill_policy.reserveEm) ?? FillPolicy.DEFAULTS.reserveEm) || 0;
  const capacityOf = stream => {
    const size = Math.max(Number(stream.fontSize) * 1.03 || 0, sharedGuess);
    const lineHeight = Number(stream.lineHeight) || 1.25;
    const height = stream.bbox[3] - stream.bbox[1] - reserveEm * size;
    return Math.max(1, Math.floor((height - size) / (size * lineHeight) + 1e-6) + 1);
  };
  const report = [];
  for (const [group, entries] of groups) {
    entries.sort((a, b) => Number(a.flow.index) - Number(b.flow.index));
    const count = Number(entries[0].flow.count) || entries.length;
    const found = entries.map(entry => entry.id && streams.get(entry.id));
    const result = { group, mode, members: entries.map(entry => entry.id || null), applied: false };
    if (entries.length !== count || entries.length < 2) result.reason = "incomplete";
    else if (found.some(entry => !entry)) result.reason = "not_body";
    if (!result.reason) {
      const members = found.map(({ stream, item }, index) => ({
        width: (stream.bbox[2] - stream.bbox[0]) - STREAM_PADDING_LEFT - STREAM_PADDING_RIGHT,
        fontSize: Math.max(Number(stream.fontSize) * 1.03 || 0, sharedGuess),
        capacity: capacityOf(stream),
        indent: index === 0 ? Number(item.indent) || 0 : 0
      }));
      const out = ContinuationBalance.balanceGroup(String(entries[0].flow.text || ""), members, { measurer, contentFor, params: { ...ContinuationBalance.DEFAULTS, mode } });
      if (!out) result.reason = "formula_or_short";
      else {
        found.forEach(({ item }, index) => {
          // " ", not "": an empty translatedText would fall back to the source text
          const text = out.texts[index] || " ";
          item.translatedText = text;
          const block = pageBlocks.get(String(item.id));
          if (block) block.translatedText = text;
        });
        Object.assign(result, { applied: true, mode: out.mode, lines: out.lines, fills: out.fills, emptied: out.texts.filter(text => !text).length });
      }
    }
    report.push(result);
  }
  return report;
}

// fitOptions reaches the fitter (e.g. retainTrace).
function fitInput(input, { maths, timings = {}, fitOptions = {} } = {}) {
  validate(input);
  const job = jobFromInput(input);

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
  const base = Text.createMeasurer({ metrics: defaultFontTable() });
  // A formula MathJax cannot render stays a formula here (failedMath "box"), so it is cut as one piece
  // and written back as $tex$; the fitter then sets it as plain text as before.
  const splitContent = text => Text.contentFromText(text, { renderMathBox, failedMath: "box" })
    .map(run => (run.type === "math" ? { ...run, display: false } : run));
  const continuation = splitContinuations(input, job, model, { measurer: base, contentFor: splitContent });
  // Seed sizes (retain-pdf's geometry estimate) before the fitter changes them.
  const seeds = new Map();
  for (const page of model.pages) {
    for (const stream of page.restoration.streams) for (const item of stream.items) seeds.set(String(item.id), Number(stream.fontSize));
    for (const block of page.restoration.absoluteBlocks) if (block.kind === "text") seeds.set(String(block.id), Number(block.fontSize));
  }

  const bold = Text.createMeasurer({ metrics: defaultFontTable("bold") });
  const defaults = FitModel.defaultContentFor({ renderMathBox });
  const contentFor = (node, mode) => {
    if (node.kind === "stream") {
      return { paragraphs: (node.source.items || []).map(item => ({ runs: runsForText(item.translatedText || item.text), indent: item.indent || 0 })) };
    }
    if (node.source.kind === "text" && (node.source.items || []).length > 1) {
      return { paragraphs: node.source.items.map(item => ({ runs: runsForText(item.translatedText || item.text), indent: item.indent || 0 })) };
    }
    if (node.source.kind === "text" && node.source.translatedText) {
      return { paragraphs: [{ runs: runsForText(node.source.translatedText), indent: node.source.indent || 0 }] };
    }
    return defaults(node, mode);
  };
  const fitter = FitModel.createModelFitter({
    measurer: base, measurers: { bold }, lineModel: "measurer", contentFor, typography: PRESET.typography
  });
  const bodyMaxFont = Number.isFinite(stats.sourceBodyFont) ? round(stats.sourceBodyFont * PRESET.bodyMaxFactor, 2) : undefined;
  mark = performance.now();
  const mathBefore = maths.stats.ms;
  let fillPlan = null;
  let widened = [];
  let titleFollow = null;
  let annotationFollow = null;
  const fitted = fitter.fitDocument(model, {
    bodySourceTextFont: stats.sourceBodyTextFont || undefined,
    onTitleFollow: result => { titleFollow = result; },
    onAnnotationFollow: result => { annotationFollow = result; },
    retainFillPolicy: input.fill_policy || undefined,
    retainWidenPolicy: input.widen_policy || undefined,
    onFillPlan: planned => { fillPlan = planned; },
    onWiden: list => { widened = list; },
    ...fitOptions, mode: "translation", bodyMaxFont, strictSourceFit: PRESET.strictSourceFit, bodyNodeFontCaps: PRESET.fontCaps
  });
  timings.fitMs = Math.round(performance.now() - mark - (maths.stats.ms - mathBefore));
  return { job, model, paint, stats, vectors, fitted, bodyMaxFont, seeds, fillPlan, widened, continuation, titleFollow, annotationFollow, measurers: { regular: base, bold } };
}

function runMeasured(input, options = {}) {
  validate(input);
  const output = options.output || "typst";
  if (output !== "typst" && output !== "pdf") throw new Error(`unknown output ${JSON.stringify(output)} (typst | pdf)`);
  const outDir = path.resolve(options.outDir || "rpr-fit-out");
  fs.mkdirSync(outDir, { recursive: true });
  const started = performance.now();
  const timings = {};
  const fontPaths = (options.typst && options.typst.fontPaths) || [];
  // Fail before any work when the PDF output cannot find its font files.
  const fonts = output === "pdf" ? { ...findFamily(fontPaths, "Source Han Serif SC"), fallbacks: findFallbacks(fontPaths) } : null;
  const maths = output === "pdf" ? new MathStore(outDir, { files: false }) : new MathStore(outDir, { stamps: true });
  const { job, model, paint, stats, vectors, fitted, bodyMaxFont, seeds, fillPlan, widened, continuation, titleFollow, annotationFollow, measurers } = fitInput(input, { maths, timings });

  let mark = performance.now();
  let painted;
  let outputStats = null;
  if (output === "pdf") {
    const written = overlayPdf(fitted, paint, maths, { fonts, measurers });
    // The layout file is what the PDF was drawn from: read / diff / edit it,
    // and redraw with bin/rpr-layout-pdf.js.
    fs.writeFileSync(path.join(outDir, "layout.json"), formatLayout(written.layout));
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

  const report = buildReport({ job, model, input, fitted, paint, stats, vectors, maths, painted, bodyMaxFont, seeds, fillPlan, widened, continuation, titleFollow, annotationFollow });
  timings.totalMs = Math.round(performance.now() - started);
  report.timings = timings;
  report.output = output === "pdf" ? { kind: "pdf", layout: "layout.json", stats: outputStats } : { kind: "typst" };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  return { report, overlayPdf: path.join(outDir, "overlay.pdf"), outDir };
}

function buildReport({ job, model = null, input, fitted, paint, stats, vectors, maths, painted, bodyMaxFont, seeds, fillPlan, widened = [], continuation = [], titleFollow = null, annotationFollow = null }) {
  const itemFor = (pageIndex, id) => job.translations.get(`${pageIndex}:${blockNumber(id)}`) || null;
  // streams holding several items (lists grouped by retain/list-groups.js): first id -> all ids
  const groupMembers = new Map();
  for (const page of (model && model.pages) || []) {
    for (const entity of [...page.restoration.streams, ...page.restoration.absoluteBlocks]) {
      if ((entity.items || []).length > 1) groupMembers.set(String(entity.items[0].id), entity.items.map(item => String(item.id)));
    }
  }
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
        stop_reason: node.fit?.stopReason || null,
        // the items of a list set as one stream (retain/list-groups.js)
        ...(groupMembers.has(String(node.id)) ? { members: groupMembers.get(String(node.id)) } : {})
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
    // fit-model/fill-policy.js: parameters, the book's length ratio / fill /
    // inflation / size scale / line ratio, and each page's (null: fill off or
    // no paragraph of two or more lines).
    // fit-model/widen-policy.js: one-line items moved out to the right so the
    // translation stays on one line ({ id, page, from, to, need }, pt).
    // retain/continuation-balance.js: paragraphs across several boxes, cut at line ends
    // ({ group, mode, members, applied, lines, fills, emptied } or { ..., reason }).
    continuation,
    // fit-model/passes/retain-titles.js followBody: headings grown by the body's scale over the
    // source ({ body_source, body_settled, scale, grown, kept }) or null.
    title_follow: titleFollow,
    annotation_follow: annotationFollow,
    widened: widened.map(entry => ({ id: entry.id, page: entry.page, from: round(entry.from, 2), to: round(entry.to, 2), need: round(entry.need, 2) })),
    fill_policy: fillPlan ? {
      params: fillPlan.params,
      base_line_ratio: round(fillPlan.baseRatio, 3),
      book: Object.fromEntries(Object.entries(fillPlan.book).map(([key, value]) => [key, round(value, 3)])),
      pages: Object.entries(fillPlan.pages).map(([page, entry]) => ({
        page: Number(page), rho: round(entry.rho, 3), fill: round(entry.fill, 3), target: round(entry.target, 3),
        k: round(entry.k, 3), line_ratio: round(entry.lineRatio, 3), paragraphs: entry.paragraphs
      }))
    } : null,
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

module.exports = { runMeasured, fitInput, InputError, FIT_INPUT_SCHEMA, FIT_REPORT_SCHEMA, PRESET };
