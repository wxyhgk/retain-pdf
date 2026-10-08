"use strict";

// retain-pdf-rendering/retain/job-model
//
// A retain-pdf job (document.v1 + translation payload items + prewarm visual
// profile, already loaded: { document, translations: Map("<page>:<block>"),
// profile }) -> the layout model src/fit-model.js consumes, plus the paint
// (cover / colours) per translated block. Pure: the host reads the files.
//
// Mapping (see README.md for the reasoning):
//   text/body (translated)            -> stream, styleKind body_text (shared body font)
//   text/title (translated)           -> block type "title", mainTitle
//   text/heading (translated)         -> block type "title"
//   text/figure_caption (translated)  -> block type "image_caption"
//   text/table_caption (translated)   -> block type "table_caption"
//   text/image_footnote, table_footnote (translated) -> caption block of that type
//   any other translated text         -> block type "text" (multi/single by source lines)
//   everything else (display formulas, formula numbers, images, tables,
//   headers, page numbers, untranslated text) -> opaque obstacle ("image"
//   kind): never painted, kept from the source PDF, blocks collisions.


const CAPTION_TYPES = {
  figure_caption: "image_caption",
  image_caption: "image_caption",
  table_caption: "table_caption",
  image_footnote: "image_footnote",
  table_footnote: "table_footnote",
  chart_caption: "chart_caption"
};

const VectorObstacles = require("./vector-obstacles");

function blockNumber(id) {
  const match = String(id || "").match(/-b0*(\d+)$/);
  return match ? Number(match[1]) : NaN;
}

function median(values, fallback) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return fallback;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Source line pitch of a block: synthetic/real line boxes when there are
// several, else the block height (single-line titles, captions).
function linePitch(block) {
  const lines = Array.isArray(block.lines) ? block.lines : [];
  const heights = lines.map(line => Array.isArray(line.bbox) ? line.bbox[3] - line.bbox[1] : NaN);
  const pitch = median(heights, NaN);
  if (Number.isFinite(pitch) && pitch > 0) return pitch;
  return Math.max(1, block.bbox[3] - block.bbox[1]);
}


function translationOf(item) {
  if (!item || !item.policy_translate) return "";
  return String(item.translated_text || "").trim();
}

// Font size the source PDF uses inside bbox: median span size of the text
// layer (sourceSizes from run.js), else an estimate from the OCR lines.
function seedFontSize(block, bbox, sizes, lineCount) {
  const inside = (sizes || []).filter(span => {
    const cx = (span.bbox[0] + span.bbox[2]) / 2;
    const cy = (span.bbox[1] + span.bbox[3]) / 2;
    return cx >= bbox[0] && cx <= bbox[2] && cy >= bbox[1] && cy <= bbox[3];
  }).map(span => span.size);
  const size = median(inside, NaN);
  if (Number.isFinite(size) && size > 0) return { size: Number(size.toFixed(2)), from: "pdf" };
  const pitch = linePitch(block);
  return { size: Number(Math.min(lineCount > 1 ? pitch / 1.2 : pitch / 1.25, 12).toFixed(2)), from: "ocr" };
}

// Source line pitch inside bbox from the PDF text layer: span centres grouped
// into lines (2 pt), median distance between consecutive lines. 0 when the
// block has fewer than two text-layer lines.
function sourceLinePitch(bbox, spans) {
  const ys = (spans || []).filter(span => {
    const cx = (span.bbox[0] + span.bbox[2]) / 2;
    const cy = (span.bbox[1] + span.bbox[3]) / 2;
    return cx >= bbox[0] && cx <= bbox[2] && cy >= bbox[1] && cy <= bbox[3];
  }).map(span => span.bbox[3]).sort((a, b) => a - b);
  const lines = [];
  for (const y of ys) if (!lines.length || y - lines[lines.length - 1] > 2) lines.push(y);
  if (lines.length < 2) return 0;
  return median(lines.slice(1).map((y, i) => y - lines[i]), 0);
}

// retain-pdf's geometry-only size estimate (typography/line_metrics.py,
// baseline.py, font_size_fit.py), the fallback for PDFs without a text layer.
// Like retain-pdf it reads the translation payload item's line boxes (else
// the document.v1 block's): glyph height = median line height, pitch =
// median distance between consecutive line centres.
function ocrLineGeometry(block, item = null) {
  const source = item && Array.isArray(item.lines) && item.lines.length ? item.lines : (Array.isArray(block.lines) ? block.lines : []);
  const lines = source.filter(line => Array.isArray(line.bbox) && line.bbox[3] > line.bbox[1]);
  const heights = lines.map(line => line.bbox[3] - line.bbox[1]);
  const centers = lines.map(line => (line.bbox[1] + line.bbox[3]) / 2);
  const diffs = centers.slice(1).map((y, i) => y - centers[i]).filter(diff => diff > 0);
  return { glyphHeight: median(heights, 0), pitch: diffs.length ? median(diffs, 0) : 0, lines: lines.length };
}

// typography/baseline.candidate_text_items: page-baseline candidates.
function isBaselineCandidate(block, item, widthMed) {
  if (block.type !== "text" || /caption|footnote/.test(String(block.sub_type || ""))) return false;
  const geometry = ocrLineGeometry(block, item);
  const text = String(item?.source_text || block.text || "").replace(/\s+/g, "");
  const width = block.bbox[2] - block.bbox[0];
  return geometry.lines >= 3 && text.length >= 40 && !(widthMed > 0 && width < widthMed * 0.6);
}

// Returns { model, paint } where paint[nodeId] = { cover, fill, text } for
// the emitter (cover = rectangle to fill, colours as 0..1 rgb arrays).
function buildModel(job, options = {}) {
  const pages = [];
  const paint = {};
  const stats = { streams: 0, individualBody: 0, titles: 0, captions: 0, otherText: 0, obstacles: 0, untranslatedText: 0, seedsFromPdf: 0, seedsFromOcr: 0, vectorObstacles: 0, vectorCounts: {} };
  const vectors = new Map();
  const sourceSizes = options.sourceSizes || {};
  const bodyStreams = [];
  const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : Infinity;
  const retain = options.typography === "retain";
  // seed "calibrated": text-layer sizes scaled by the document's median ratio
  // of retain-pdf's geometry estimate to the text-layer size (body blocks).
  const calibrationPairs = [];
  const Retain = retain ? require("../fit-model/typography-retain.js") : null;
  for (const page of job.document.pages.slice(0, maxPages)) {
    const pageIndex = Number(page.page_index);
    const pageSpans = options.seed === "geometry" ? [] : sourceSizes[String(pageIndex)];
    const calibrated = options.seed === "calibrated";
    let pageGeometry = null;
    if (retain && (options.seed === "geometry" || calibrated)) {
      const itemOf = block => job.translations.get(`${pageIndex}:${blockNumber(String(block.block_id))}`);
      const textBlocks = (page.blocks || []).filter(block => block.type === "text" && !/caption|footnote/.test(String(block.sub_type || "")));
      const widthMed = median(textBlocks.map(block => block.bbox[2] - block.bbox[0]), 0);
      const candidates = textBlocks.filter(block => isBaselineCandidate(block, itemOf(block), widthMed)).map(block => ocrLineGeometry(block, itemOf(block)));
      // percentile_value(..., 0.42) of pitches; the font metric per candidate
      // is its glyph height (local_font_metric).
      const pitches = candidates.map(entry => entry.pitch).filter(value => value > 0).sort((a, b) => a - b);
      const pagePitch = pitches.length ? pitches[Math.floor((pitches.length - 1) * 0.42)] : 0;
      pageGeometry = { pagePitch, pageFont: Retain.pageBaselineFontSize(candidates.map(entry => entry.glyphHeight), candidates.map(entry => entry.pitch)) };
    }
    const profilePage = job.profile.pages?.[String(pageIndex)] || {};
    // font_roles.is_body_text_candidate (retainBodyClassify): narrow or short
    // body blocks are not body paragraphs in retain-pdf.
    const pageTextWidthMed = median((page.blocks || []).filter(block => block.type === "text" && !/caption|footnote/.test(String(block.sub_type || ""))).map(block => block.bbox[2] - block.bbox[0]), 0);
    const retainIsBody = (block, sourceText, lineCount) => {
      const textLen = String(sourceText || "").replace(/\s+/g, "").length;
      const width = block.bbox[2] - block.bbox[0];
      if (pageTextWidthMed > 0 && width < pageTextWidthMed * 0.75 && !(textLen >= 36 && lineCount >= 2)) return false;
      return textLen >= 40;
    };
    const streams = [];
    const absoluteBlocks = [];
    const blocks = [];
    for (const block of page.blocks || []) {
      const bbox = (block.bbox || []).map(Number);
      if (bbox.length !== 4 || bbox.some(value => !Number.isFinite(value))) continue;
      const id = String(block.block_id);
      const item = job.translations.get(`${pageIndex}:${blockNumber(id)}`);
      const translated = block.type === "text" ? translationOf(item) : "";
      const subType = String(block.sub_type || "");
      const lineCount = Math.max(1, Array.isArray(block.lines) ? block.lines.length : 1);
      let seed = seedFontSize(block, bbox, pageSpans, lineCount);
      if (pageGeometry && pageGeometry.pageFont > 0) {
        const local = ocrLineGeometry(block, item);
        // Body candidates blend with the page estimate; titles, headings,
        // captions and footnotes use their own glyph height (retain-pdf's
        // estimate_font_size_pt returns local_font_size_pt for non-body).
        const role = /footnote/.test(subType) ? "footnote" : /caption/.test(subType) ? "caption" : "text";
        const size = subType === "body"
          ? Retain.geometryBodyFontSize({ ...local, pagePitch: pageGeometry.pagePitch, pageFont: pageGeometry.pageFont })
          : Retain.geometryLocalFontSize({ ...local, role });
        // seed "calibrated": keep the text-layer size, collect body ratios.
        if (calibrated) { if (size > 0 && seed.from === "pdf" && subType === "body") calibrationPairs.push(size / seed.size); }
        else if (size > 0) seed = { size, from: "geometry" };
      }
      const pitchFromPdf = retain ? sourceLinePitch(bbox, pageSpans) : 0;
      const pitchFromOcr = retain && !(pitchFromPdf > 0) ? ocrLineGeometry(block, item).pitch : 0;
      if (!translated) {
        if (block.type === "text" && item && item.policy_translate) stats.untranslatedText += 1;
        absoluteBlocks.push({ id, type: "image", kind: "image", bbox, sourceOnly: true });
        stats.obstacles += 1;
        continue;
      }
      const visual = profilePage.items?.[item.item_id] || null;
      paint[id] = {
        cover: visual && Array.isArray(visual.bbox) ? visual.bbox : bbox,
        fill: visual?.background_rgb || profilePage.background_rgb || [1, 1, 1],
        text: visual?.text_rgb || [0.07, 0.07, 0.07]
      };
      blocks.push({ id, translatable: true, translatedText: translated });
      if (seed.from === "pdf") stats.seedsFromPdf += 1;
      else if (seed.from === "geometry") stats.seedsFromGeometry = (stats.seedsFromGeometry || 0) + 1;
      else stats.seedsFromOcr += 1;
      const sourceText = String(item.source_text || block.text || "");
      if (subType === "body" && !(retain && options.retainBodyClassify && !retainIsBody(block, sourceText, lineCount))) {
        // Source body text: the line pitch is ~1.2 x the font size.
        const stream = {
          pageIndex,
          bbox,
          fontSize: seed.size,
          lineHeight: options.bodyLineHeight ?? 1.25,
          paragraphGap: 0.16,
          styleKind: "body_text",
          debugRole: "body_candidate",
          columnKey: String(block.metadata?.provider_column_index_guess || ""),
          items: [{ id, text: sourceText, translatedText: translated, originalLineCount: lineCount }]
        };
        if (retain) stream.sourceLinePitch = pitchFromPdf || pitchFromOcr || 0;
        streams.push(stream);
        bodyStreams.push(stream);
        stats.streams += 1;
        continue;
      }
      const type = subType === "title" || subType === "heading"
        ? "title"
        : (CAPTION_TYPES[subType] || "text");
      if (type === "title") stats.titles += 1;
      else if (type !== "text") stats.captions += 1;
      else stats.otherText += 1;
      absoluteBlocks.push({
        id,
        type,
        kind: "text",
        bbox,
        text: sourceText,
        translatedText: translated,
        translatable: true,
        mainTitle: subType === "title",
        fontSize: seed.size,
        lineCount,
        ...(retain ? { sourceLinePitch: pitchFromPdf || pitchFromOcr || 0 } : {})
      });
    }
    // Vector graphics without an OCR block (see vector-obstacles.js).
    const drawings = options.drawings && options.drawings[String(pageIndex)];
    if (drawings) {
      const textBoxes = [];
      for (const stream of streams) textBoxes.push(stream.bbox);
      for (const block of absoluteBlocks) if (!block.sourceOnly) textBoxes.push(block.bbox);
      for (const [id, entry] of Object.entries(paint)) {
        if (blocks.some(block => block.id === id) && Array.isArray(entry.cover)) textBoxes.push(entry.cover.map(Number));
      }
      const ocrObstacles = absoluteBlocks.filter(block => block.sourceOnly);
      // Vector geometry inside an OCR obstacle's box belongs to it; decided on
      // the OCR boxes before they are tightened below.
      const obstacleBoxes = ocrObstacles.map(block => block.bbox);
      const { obstacles, counts } = VectorObstacles.vectorObstacles(drawings, textBoxes, obstacleBoxes);
      // OCR obstacle boxes often reach far past their ink (a figure box
      // covering the paragraphs above it); the fitter would then shrink text
      // that never touched the figure. Tighten each to its ink in the source.
      if (options.tightenObstacles) {
        VectorObstacles.obstacleInkBoxes(drawings, obstacleBoxes, textBoxes).forEach((result, index) => {
          if (!result.tightened) return;
          stats.obstaclesTightened = (stats.obstaclesTightened || 0) + 1;
          ocrObstacles[index].ocrBbox = ocrObstacles[index].bbox;
          ocrObstacles[index].bbox = result.bbox;
        });
      }
      vectors.set(pageIndex, obstacles);
      for (const [key, value] of Object.entries(counts)) stats.vectorCounts[key] = (stats.vectorCounts[key] || 0) + value;
      stats.vectorObstacles += obstacles.length;
      if (options.vectorObstacles) {
        obstacles.forEach((obstacle, index) => absoluteBlocks.push({
          id: `vec-p${String(pageIndex + 1).padStart(3, "0")}-${index}`, type: "image", kind: "image",
          bbox: obstacle.bbox, sourceOnly: true, vectorKind: obstacle.kind
        }));
      }
    }
    pages.push({
      index: pageIndex,
      width: Number(page.width),
      height: Number(page.height),
      blocks,
      restoration: { streams, absoluteBlocks }
    });
  }
  // Source body size (median of the body paragraphs' PDF span sizes): the
  // overlay's ceiling for the shared body font. Seeds above it are clamped so
  // the group does not start over the ceiling.
  const sourceBodyFont = median(bodyStreams.map(stream => stream.fontSize), NaN);
  if (Number.isFinite(sourceBodyFont)) {
    stats.sourceBodyFont = Number(sourceBodyFont.toFixed(2));
    // The retain profile keeps every paragraph's own seed (retain-pdf has no
    // source-size ceiling; its unify and underfill rules decide).
    if (!retain) for (const stream of bodyStreams) stream.fontSize = Math.min(stream.fontSize, stats.sourceBodyFont);
  }
  // The fitter shares one body font across the document and never lets a
  // body paragraph shrink on its own. OCR boxes that are much tighter than
  // the rest (a one-line box holding a translation with tall inline
  // formulas) would drag every page down, so they leave the shared group and
  // become individually fitted text blocks (see detachBody).
  const model = { pages };
  if (!retain && typeof options.standaloneFit === "function" && bodyStreams.length) {
    const fits = bodyStreams.map(stream => options.standaloneFit(stream));
    const typical = median(fits, NaN);
    const floor = typical * (options.inheritBelow ?? 0.85);
    bodyStreams.forEach((stream, index) => {
      if (Number.isFinite(floor) && fits[index] < floor) {
        detachBody(model, stream.items[0].id);
        stats.individualBody = (stats.individualBody || 0) + 1;
      }
    });
    stats.bodyStandaloneMedian = Number(typical.toFixed(2));
  }
  if (calibrationPairs.length) {
    const k = median(calibrationPairs, 1);
    stats.seedCalibration = Math.round(k * 1000) / 1000;
    for (const page of pages) {
      for (const stream of page.restoration.streams) stream.fontSize = Math.round(stream.fontSize * k * 100) / 100;
      for (const block of page.restoration.absoluteBlocks) if (block.kind === "text" && block.fontSize) block.fontSize = Math.round(block.fontSize * k * 100) / 100;
    }
  }
  return { model, paint, stats, vectors };
}

// Moves a body paragraph out of the shared body group: it becomes a
// multi-line text block, which the fitter sizes on its own (shrinks until it
// fits its box under strictSourceFit). lineCount is at least 2 so the fitter
// treats it as multi-line (single-line text blocks are never resized).
function detachBody(model, id) {
  for (const page of model.pages) {
    const index = page.restoration.streams.findIndex(stream => stream.items[0].id === id);
    if (index < 0) continue;
    const [stream] = page.restoration.streams.splice(index, 1);
    const item = stream.items[0];
    page.restoration.absoluteBlocks.push({
      id, type: "text", kind: "text", bbox: stream.bbox, text: item.text, translatedText: item.translatedText,
      translatable: true, mainTitle: false, fontSize: stream.fontSize, lineCount: Math.max(2, item.originalLineCount)
    });
    return true;
  }
  return false;
}

module.exports = { buildModel, detachBody, blockNumber };
