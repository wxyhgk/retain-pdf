"use strict";

// retain-pdf-rendering/retain/fit
//
// retain-pdf's font-size policy, measured with src/text instead of Typst.
// This is a host-specific policy layer (it encodes retain-pdf's rules); the
// engine core (src/typeset) still never changes a size — this module decides
// the size and leading of every block first and hands them to the engine.
//
// What it reproduces (retain-pdf, backend/pipeline/retainpdf_pipeline/
// render/output/typst/, page-spec route):
//   - fit_helpers.py _page_spec_markdown_fit_helper (pdftr_fit_markdown):
//     set at the maximum size and leading; if that is taller than the allowed
//     height, bisect the size between the minimum and the maximum at the
//     minimum leading (pdftr_fit_size, eps 0.08 pt). No emergency tier.
//   - fit_helpers.py _single_line_fit_helper
//     (pdftr_fit_single_line_markdown): the unwrapped line must fit the
//     allowed width and height; bisect between min and max, and below the
//     minimum (emergency) between max(4.2, 0.55 min) and min. Leading 1 em.
//   - block_renderer.py build_typst_block: the fixed branch (no fit), the
//     8 pt minimum block size, fit_dimensions() (block_fit.py) and
//     single_line_fit_config() (block_config.py) clamps, the formula safety
//     insets (as given: inset_top_pt / inset_bottom_pt), fit_shift_up_pt.
//   - Typst's vertical model: text top-edge "cap-height", bottom-edge
//     "baseline" (the defaults retain-pdf keeps), par(leading) = the gap
//     between line boxes. So a block of n plain lines is
//     n * capHeight * size + (n - 1) * leading * size tall, consecutive
//     baselines are (capHeight + leading) * size apart and the first
//     baseline sits capHeight * size below the content top (box top + top
//     inset). An inline formula taller than the cap height (or reaching
//     below the baseline) makes its line box taller, as in Typst.
//   - Typst's linebreaks: auto — Knuth–Plass ("optimized") for justified
//     text, greedy ("simple") otherwise.
//
// Known differences from the Typst original: see README, "retain-pdf
// integration (CLI)".

const Typeset = require("../typeset");

// Typst lets an inline equation reach this share of the paragraph leading
// beyond the text's top / bottom edge before it makes the line taller
// (math/equation.rs, layout_equation_inline: slack = leading * 0.7).
const FORMULA_SLACK_RATIO = 0.7;
// Typst's default par(spacing): the gap between paragraphs, replacing leading.
const PARAGRAPH_SPACING_EM = 1.2;

const RETAIN = Object.freeze({
  MIN_BLOCK_SIZE_PT: 8,
  MIN_FIT_FONT_SIZE_PT: 1,
  MIN_FIT_LEADING_EM: 0.1,
  MIN_FONT_SIZE_PT: 1,
  FIT_SIZE_EPS_PT: 0.08,
  SINGLE_LINE_LEADING_EM: 1,
  SINGLE_LINE_EMERGENCY_MIN_PT: 4.2,
  SINGLE_LINE_EMERGENCY_RATIO: 0.55,
  // box_overlay (retain-pdf's overlay route, _render_block_markdown_fit_helper):
  // below the minimum size an emergency range, and the leading is bisected
  // back up as far as the chosen size still fits.
  OVERLAY_EMERGENCY_MIN_PT: 4.2,
  OVERLAY_EMERGENCY_RATIO: 0.65,
  OVERLAY_EMERGENCY_LEADING_FLOOR_EM: 0.2,
  OVERLAY_EMERGENCY_LEADING_RATIO: 0.75,
  OVERLAY_LEADING_EPS_EM: 0.01,
  OVERFLOW_TOLERANCE_PT: 0.5
});

// Unwrapped layouts use this as their width (the measurer needs a finite one).
const UNWRAPPED = 1e9;

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : fallback);
// Python's `value or default`: 0 / None / missing fall back.
const orDefault = (value, fallback) => (Number(value) ? Number(value) : fallback);

// pdftr_fit_size: bisect [lo, hi] until it is at most eps wide, keeping the
// lower end; fits(lo) is never checked (lo is returned even if it does not fit).
function fitSize(lo, hi, eps, fits) {
  while (hi - lo > eps) {
    const mid = lo + (hi - lo) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// retain-pdf's fit report "visible characters": LaTeX command names and
// Markdown / formula markup are not counted.
function visibleChars(text) {
  const stripped = String(text || "").replace(/\\[A-Za-z]+|\\./g, "");
  let count = 0;
  for (const char of stripped) if (!/\s/u.test(char) && !"${}^_*`".includes(char)) count += 1;
  return count;
}

// fit_report.py estimate_overflow_chars, on the same inputs.
function estimateOverflowChars({ textChars, naturalWidth, lineHeight, regionWidth, regionHeight, neededHeight, leadingPt }) {
  if (textChars <= 0) return 0;
  if (naturalWidth > 0 && lineHeight > 0 && regionWidth > 0) {
    const gap = Math.max(0, leadingPt);
    const fitLines = Math.max(0, Math.floor((regionHeight + gap + RETAIN.OVERFLOW_TOLERANCE_PT) / (lineHeight + gap)));
    const overflowWidth = naturalWidth - fitLines * regionWidth;
    if (overflowWidth > 0) return Math.max(1, Math.min(textChars, Math.ceil(textChars * overflowWidth / naturalWidth)));
    return 1;
  }
  if (neededHeight > 0) return Math.max(1, Math.ceil(textChars * (neededHeight - regionHeight) / neededHeight));
  return 1;
}

// Block text -> paragraphs: a blank line ("\n\n", spaces allowed between)
// separates paragraphs; a single "\n" stays a forced line break inside one.
function splitParagraphs(text) {
  return String(text ?? "").split(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/).filter(paragraph => paragraph.trim().length > 0);
}

function createRetainFitter(config = {}) {
  const measurer = config.measurer;
  if (!measurer || typeof measurer.layout !== "function") throw new TypeError("createRetainFitter needs a Text measurer");
  const measurers = config.measurers || {};
  const measurerFor = weight => (weight === "bold" && measurers.bold) || measurer;

  // Height of the content as Typst lays it out in a block `width` wide:
  // line boxes from cap height to baseline (an inline formula widens its
  // line only where it reaches more than 0.7 x leading beyond them, as in
  // Typst), separated by leading; paragraphs separated by par spacing
  // (spacingEm) instead. The first-line indent applies to the first
  // paragraph only (retain-pdf's h() before the content).
  function measure(using, paragraphs, { fontSize, leadingEm, width, align, linebreaks, indentPt = 0, spacingEm = PARAGRAPH_SPACING_EM }) {
    const list = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
    const edges = { topEdge: using.metrics.capHeight * fontSize, bottomEdge: 0, slack: FORMULA_SLACK_RATIO * leadingEm * fontSize };
    let height = 0;
    let lines = 0;
    let started = false;
    list.forEach((prepared, index) => {
      const laid = using.layout(prepared, { fontSize, lineHeight: 1, width, align, linebreaks, firstLineIndent: index === 0 ? indentPt : 0 });
      if (!laid.lines.length) return;
      if (started) height += spacingEm * fontSize;
      started = true;
      laid.lines.forEach((line, n) => {
        const { frameAbove, frameBelow } = Typeset.lineFrame(prepared, line.start, line.end, fontSize, edges);
        height += frameAbove + frameBelow;
        if (n) height += leadingEm * fontSize;
      });
      lines += laid.lines.length;
    });
    return { height, lines };
  }

  // Widest unwrapped paragraph (Typst box(body)); the indent on the first.
  function naturalWidth(using, paragraphs, fontSize, indentPt = 0) {
    return paragraphs.reduce((widest, prepared, index) =>
      Math.max(widest, using.naturalWidth(prepared, { fontSize, firstLineIndent: index === 0 ? indentPt : 0 })), 0);
  }

  function normalize(block) {
    const box = (block.content_box || []).map(Number);
    if (box.length !== 4 || box.some(value => !Number.isFinite(value))) throw new RangeError(`block ${block.id}: content_box must be [x0, y0, x1, y1]`);
    const fit = block.fit || {};
    const mode = fit.mode || "fixed";
    if (!["box", "box_overlay", "single_line", "fixed"].includes(mode)) throw new RangeError(`block ${block.id}: unknown fit.mode ${JSON.stringify(mode)}`);
    const weight = block.font_weight === "bold" ? "bold" : "regular";
    const align = ["justify", "left", "center", "right"].includes(block.align) ? block.align : "left";
    return {
      id: String(block.id),
      mode,
      fit,
      x0: box[0],
      y0: box[1],
      // block_fields.py: blocks are at least 8 pt wide and tall.
      width: Math.max(RETAIN.MIN_BLOCK_SIZE_PT, box[2] - box[0]),
      height: Math.max(RETAIN.MIN_BLOCK_SIZE_PT, box[3] - box[1]),
      fontSize: Math.max(RETAIN.MIN_FONT_SIZE_PT, num(block.font_size_pt, 10)),
      leadingEm: Math.max(RETAIN.MIN_FIT_LEADING_EM, num(block.leading_em, 0.65)),
      weight,
      align,
      justify: align === "justify",
      indentPt: Math.max(0, num(block.first_line_indent_pt)),
      insetTop: Math.max(0, num(block.inset_top_pt)),
      insetBottom: Math.max(0, num(block.inset_bottom_pt)),
      shiftUp: Math.max(0, num(block.shift_up_pt)),
      spacingEm: Math.max(0, num(block.paragraph_spacing_em, PARAGRAPH_SPACING_EM))
    };
  }

  // block: one rpr_retain_input_v1 block; content: its paragraphs as Text
  // content runs ([[run, ...], ...]), or one paragraph's runs.
  // Returns the engine block (sizes decided) and the fit record.
  function planBlock(block, content) {
    const b = normalize(block);
    const using = measurerFor(b.weight);
    const capHeight = using.metrics.capHeight;
    // An empty paragraph has no line at all (Typst: an empty block is 0 pt tall).
    const paragraphRuns = (Array.isArray(content) && content.length && Array.isArray(content[0]) ? content : [content || []])
      .filter(runs => runs.length > 0);
    const prepared = paragraphRuns.map(runs => using.prepare(runs));
    const spacingEm = b.spacingEm;
    const linebreaks = b.justify ? "optimized" : "simple";
    const insets = b.insetTop + b.insetBottom;
    // The pad() inside the block: what layout(size => ..) sees.
    const regionHeight = Math.max(0, b.height - insets);
    const contentFitHeight = Math.max(RETAIN.MIN_BLOCK_SIZE_PT, b.height - insets);
    const textChars = visibleChars(block.text);
    const fitRecord = { textChars };

    let fontSize = b.fontSize;
    let leadingEm = b.leadingEm;
    let width = b.width;
    let indentPt = b.indentPt;
    let tier;
    let shrinkTier = "base";
    let base = b.fontSize;
    let min = b.fontSize;
    let needed;
    let available;
    let regionWidth = b.width;

    if (b.mode === "box" || b.mode === "box_overlay") {
      tier = "fit";
      // block_fit.py fit_dimensions()
      const minFont = Math.max(RETAIN.MIN_FIT_FONT_SIZE_PT, Math.min(orDefault(b.fit.min_font_size_pt, b.fontSize), b.fontSize));
      const minLeading = Math.max(RETAIN.MIN_FIT_LEADING_EM, Math.min(orDefault(b.fit.min_leading_em, b.leadingEm), b.leadingEm));
      const maxHeight = Math.min(contentFitHeight, orDefault(b.fit.max_height_pt, contentFitHeight));
      const target = Math.max(RETAIN.MIN_BLOCK_SIZE_PT, Math.min(contentFitHeight, maxHeight));
      const allowed = Math.min(regionHeight, target);
      const heightAt = (size, leading) => measure(using, prepared, { fontSize: size, leadingEm: leading, width, align: b.align, linebreaks, indentPt, spacingEm }).height;
      min = minFont;
      const fits = (size, leading) => heightAt(size, leading) <= allowed;
      if (fits(b.fontSize, b.leadingEm)) {
        fontSize = b.fontSize;
        leadingEm = b.leadingEm;
      }
      else if (b.mode === "box") {
        // _page_spec_markdown_fit_helper (typst / typst_visual routes).
        fontSize = fitSize(minFont, b.fontSize, RETAIN.FIT_SIZE_EPS_PT, size => fits(size, minLeading));
        leadingEm = minLeading;
        shrinkTier = "shrink";
      }
      else {
        // _render_block_markdown_fit_helper (overlay route), line for line.
        const maxLeading = b.leadingEm;
        const emergencySize = Math.max(RETAIN.OVERLAY_EMERGENCY_MIN_PT, minFont * RETAIN.OVERLAY_EMERGENCY_RATIO);
        const emergencyLeading = Math.max(RETAIN.OVERLAY_EMERGENCY_LEADING_FLOOR_EM, minLeading * RETAIN.OVERLAY_EMERGENCY_LEADING_RATIO);
        const chosenLeading = fits(minFont, maxLeading) ? maxLeading : minLeading;
        if (!fits(minFont, chosenLeading)) {
          // The helper's fallback bisection runs over [min, min] (it returns
          // min); only when min at the minimum leading fails does it go below.
          if (!fits(minFont, minLeading)) {
            fontSize = fitSize(emergencySize, minFont, RETAIN.FIT_SIZE_EPS_PT, size => fits(size, emergencyLeading));
            shrinkTier = "emergency";
          }
          else {
            fontSize = minFont;
            shrinkTier = "shrink";
          }
        }
        else {
          fontSize = fitSize(minFont, b.fontSize, RETAIN.FIT_SIZE_EPS_PT, size => fits(size, chosenLeading));
          shrinkTier = "shrink";
        }
        const leadingFloor = fits(fontSize, minLeading) ? minLeading : emergencyLeading;
        const leadingCap = fits(fontSize, maxLeading) ? maxLeading : chosenLeading;
        leadingEm = fits(fontSize, leadingCap)
          ? leadingCap
          : fitSize(leadingFloor, leadingCap, RETAIN.OVERLAY_LEADING_EPS_EM, leading => fits(fontSize, leading));
      }
      needed = heightAt(fontSize, leadingEm);
      available = regionHeight;
    }
    else if (b.mode === "single_line") {
      tier = "single_line";
      indentPt = 0; // the single-line helper has no first-line indent
      // block_config.py single_line_fit_config(), with the arguments
      // build_typst_block passes (max / target height already capped by the
      // content height).
      const minFont = Math.max(RETAIN.MIN_FIT_FONT_SIZE_PT, Math.min(orDefault(b.fit.min_font_size_pt, b.fontSize), b.fontSize));
      const maxFont = Math.max(b.fontSize, orDefault(b.fit.max_font_size_pt, b.fontSize));
      const fitMaxHeight = Math.min(contentFitHeight, orDefault(b.fit.max_height_pt, contentFitHeight));
      const fitTargetHeight = Math.min(contentFitHeight, orDefault(b.fit.target_height_pt, contentFitHeight));
      width = Math.max(b.width, orDefault(b.fit.target_width_pt, 0));
      const fitHeight = Math.max(RETAIN.MIN_BLOCK_SIZE_PT, Math.max(Math.min(contentFitHeight, fitMaxHeight), fitTargetHeight));
      const allowedWidth = width;
      const allowedHeight = Math.min(regionHeight, fitHeight);
      const single = { leadingEm: RETAIN.SINGLE_LINE_LEADING_EM, align: "left", linebreaks: "simple" };
      const fits = size => {
        if (naturalWidth(using, prepared, size) > allowedWidth) return false;
        return measure(using, prepared, { ...single, fontSize: size, width: UNWRAPPED, spacingEm }).height <= allowedHeight;
      };
      base = maxFont;
      min = minFont;
      if (fits(maxFont)) fontSize = maxFont;
      else if (!fits(minFont)) {
        const floor = Math.max(RETAIN.SINGLE_LINE_EMERGENCY_MIN_PT, minFont * RETAIN.SINGLE_LINE_EMERGENCY_RATIO);
        fontSize = fitSize(floor, minFont, RETAIN.FIT_SIZE_EPS_PT, fits);
        shrinkTier = "emergency";
      }
      else {
        fontSize = fitSize(minFont, maxFont, RETAIN.FIT_SIZE_EPS_PT, fits);
        shrinkTier = "shrink";
      }
      leadingEm = RETAIN.SINGLE_LINE_LEADING_EM;
      width = allowedWidth;
      regionWidth = allowedWidth;
      // Drawn in a box as wide as the allowed width: what does not fit wraps.
      needed = measure(using, prepared, { fontSize, leadingEm, width, align: b.align, linebreaks, indentPt: 0, spacingEm }).height;
      available = allowedHeight;
    }
    else {
      tier = "fixed";
      // The fixed-size probe measures the padded block against the full box.
      needed = measure(using, prepared, { fontSize, leadingEm, width, align: b.align, linebreaks, indentPt, spacingEm }).height + insets;
      available = b.height;
    }

    const overflowPt = Math.max(0, needed - available);
    const natural = naturalWidth(using, prepared, fontSize, indentPt);
    Object.assign(fitRecord, {
      tier,
      shrinkTier,
      base,
      min,
      final: fontSize,
      finalLeadingEm: leadingEm,
      scale: base > 0 ? fontSize / base : 1,
      atMin: tier !== "fixed" && fontSize <= min + RETAIN.FIT_SIZE_EPS_PT,
      neededHeight: needed,
      availableHeight: available,
      overflowPt,
      overflow: overflowPt > RETAIN.OVERFLOW_TOLERANCE_PT,
      overflowCharsEstimate: overflowPt > RETAIN.OVERFLOW_TOLERANCE_PT
        ? estimateOverflowChars({
          textChars, naturalWidth: natural, lineHeight: capHeight * fontSize, regionWidth, regionHeight: available,
          neededHeight: needed, leadingPt: leadingEm * fontSize
        })
        : 0
    });

    const top = b.y0 - b.shiftUp;
    const engineBlock = {
      id: b.id,
      box: [b.x0, top, b.x0 + width, top + b.height],
      // Only the first paragraph carries retain-pdf's indent.
      paragraphs: paragraphRuns.map((runs, index) => ({ runs, firstLineIndent: index === 0 && indentPt > 0 ? indentPt / fontSize : 0 })),
      fontSize,
      lineHeight: capHeight + leadingEm,
      // Typst replaces the leading by par spacing between paragraphs; the
      // engine adds paragraphSpacing on top of its line pitch.
      paragraphSpacing: spacingEm - leadingEm,
      formulaSlack: FORMULA_SLACK_RATIO * leadingEm,
      firstBaseline: b.insetTop + capHeight * fontSize,
      topEdge: capHeight,
      bottomEdge: 0,
      align: b.align,
      linebreaks,
      fontWeight: b.weight
    };
    return { block: engineBlock, fit: fitRecord, frame: engineBlock.box.slice() };
  }

  return { planBlock, measure: (prepared, options, weight) => measure(measurerFor(weight), prepared, options) };
}

module.exports = { createRetainFitter, fitSize, visibleChars, estimateOverflowChars, splitParagraphs, RETAIN, FORMULA_SLACK_RATIO, PARAGRAPH_SPACING_EM };
