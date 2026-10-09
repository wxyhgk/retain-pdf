// retain-pdf-rendering/fit-model/typography-retain.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The "retain" typography profile: retain-pdf's body font-size and leading
// rules (backend/pipeline/retainpdf_pipeline/render/...), as pure functions.
// Constants are copied verbatim; each cites its retain-pdf source. The fitter
// keeps its own collision engine on top of them (see passes/retain-body.js).
//
// Units: font sizes and lengths in pt (== source-page px), leading in em
// (Typst `par(leading)`), line ratio = capHeight + leading (Typst line pitch
// over font size for a plain text line, top-edge cap-height, bottom-edge
// baseline).
(function (root, factory) {
  "use strict";
  const NAME = "typographyRetain";
  const DEPENDENCIES = [];
  const isNode = typeof module === "object" && module && module.exports;
  const parts = isNode ? null : ((root.RetainPdfRendering || {}).FitModelParts || {});
  const resolved = DEPENDENCIES.map(([key, file]) => {
    const value = isNode ? require(file) : parts[key];
    if (!value) throw new Error(`retain-pdf-rendering/fit-model: load ${file.replace(/^(\.\.?\/)+/, "fit-model/")}.js before ${NAME}`);
    return value;
  });
  const api = factory(root, ...resolved);
  if (isNode) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    (namespace.FitModelParts = namespace.FitModelParts || {})[NAME] = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (root) {
  "use strict";

  const C = Object.freeze({
    // render/layout/leading_fit.py
    DEFAULT_LEADING_EM: 0.48,
    BODY_LEADING_MIN: 0.44,
    BODY_LEADING_MAX: 0.68,
    NON_BODY_LEADING_MIN: 0.26,
    NON_BODY_LEADING_MAX: 0.56,
    BODY_LEADING_FLOOR_MIN: 0.44,
    NON_BODY_LEADING_FLOOR_MIN: 0.26,
    HIGH_DENSITY_LEADING_RATIO: 0.9,
    FORMULA_LEADING_RATIO: 0.92,
    BODY_ZH_TARGET_BASE: 0.56,
    BODY_ZH_TARGET_MIN: 0.50,
    BODY_NORMAL_LEADING_MIN: 0.52,
    BODY_COMPACT_LEADING_TIGHTEN_MAX: 0.015,
    WIDE_ASPECT_OCR_LEADING_WEIGHT: 0.5,
    WIDE_ASPECT_ZH_LEADING_WEIGHT: 0.5,
    WIDE_ASPECT_COMPACT_LEADING_TIGHTEN_MAX: 0.025,
    // foundation/config/layout.py
    BODY_LEADING_FACTOR: 0.988,
    BODY_FONT_SIZE_FACTOR: 0.9215,
    // render/layout/typography/constants.py, font_size_fit.py
    MIN_FONT_SIZE_PT: 8.4,
    MAX_FONT_SIZE_PT: 11.6,
    MAX_LOCAL_FONT_SIZE_PT: 14.2,
    LINE_HEIGHT_TO_FONT_SCALE: 0.98,
    LINE_PITCH_TO_FONT_SCALE: 0.82,
    PAGE_BASELINE_PERCENTILE: 0.42,
    LOCAL_BLOCK_SCALE_MIN: 0.97,
    LOCAL_BLOCK_SCALE_MAX: 1.03,
    BODY_PAGE_BLEND_BASE: 0.86,
    BODY_PAGE_BLEND_MIN: 0.74,
    // render/layout/payload/capacity.py: line step and characters per line
    LINE_STEP_MIN_EM: 1.02,
    CHAR_WIDTH_EM: 0.92,
    // render/policy/typography_policy.py: book / page body font unification
    BODY_FONT_UNIFY_ANCHOR_COUNT: 2,
    BODY_FONT_UNIFY_ANCHOR_MIN_HEIGHT_PT: 30.0,
    BODY_FONT_UNIFY_ANCHOR_MIN_WIDTH_RATIO: 0.58,
    BODY_FONT_UNIFY_ANCHOR_MAX_DENSITY: 1.18,
    BODY_FONT_UNIFY_TARGET_QUANTILE: 0.25,
    BODY_FONT_UNIFY_EXTREME_SMALL_RATIO: 0.82,
    BODY_FONT_UNIFY_EXTREME_SMALL_DELTA_PT: 1.6,
    BODY_FONT_UNIFY_MIN_FILTERED_COUNT: 2,
    BODY_FONT_UNIFY_CANDIDATE_MIN_WIDTH_RATIO: 0.30,
    BODY_FONT_UNIFY_APPLY_TOLERANCE_PT: 0.08,
    BODY_FONT_UNIFY_GROW_DENSITY_LIMIT: 1.08,
    // render/policy/typography_policy.py: underfilled body
    BODY_UNDERFILLED_DENSITY_FLOOR_TRIGGER: 0.60,
    BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET: 0.80,
    BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET_NO_SOURCE: 0.68,
    BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET_SHORT: 0.72,
    BODY_UNDERFILLED_DENSITY_SAFE_MAX: 0.98,
    BODY_UNDERFILLED_RECOVERY_MAX_ITERATIONS: 6,
    BODY_UNDERFILLED_RECOVERY_FONT_STEP_PT: 0.28,
    BODY_UNDERFILLED_RECOVERY_LEADING_STEP_EM: 0.06,
    BODY_UNDERFILLED_UNIFIED_FONT_MAX_STEP_PT: 0.0,
    BODY_UNDERFILLED_FONT_GROW_MAX_PT: 1.15,
    BODY_UNDERFILLED_FONT_GROW_CONTEXT_BONUS_PT: 0.18,
    BODY_UNDERFILLED_FONT_GROW_PAGE_BONUS_PT: 0.16,
    BODY_UNDERFILLED_FONT_GROW_EXP_RATE: 1.55,
    BODY_UNDERFILLED_FONT_GROW_MAX_LINES: 8,
    BODY_UNDERFILLED_FONT_GROW_SHORT_LINE_BONUS: 0.04,
    BODY_UNDERFILLED_FONT_GROW_TALL_SLACK_BONUS: 0.08,
    BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_BONUS_PT: 0.18,
    BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_CAP_BONUS_PT: 0.16,
    BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_DENSITY_BONUS: 0.01,
    BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_RATIO_OFFSET: 1.25,
    BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_RATIO_RANGE: 2.75,
    BODY_UNDERFILLED_FONT_HARMONIZE_MAX_RATIO: 1.16,
    BODY_UNDERFILLED_FONT_GROW_MIN_LINES: 2,
    BODY_UNDERFILLED_FONT_GROW_MIN_HEIGHT_PT: 22.0,
    BODY_UNDERFILLED_FONT_GROW_SHORT_MAX_PT: 0.0,
    BODY_UNDERFILLED_FONT_GROW_LOW_FONT_SKIP_DELTA_PT: 0.20,
    BODY_COMFORT_LOW_SOURCE_LINE_COUNT_MAX: 5,
    BODY_COMFORT_LOW_SOURCE_LINE_LEADING_MAX: 0.70,
    // render/layout/payload/body_common.py: body_context_anchors
    BODY_CONTEXT_ANCHOR_MIN_WIDTH_RATIO: 0.72,
    BODY_CONTEXT_ANCHOR_MIN_HEIGHT_PT: 18.0,
    // render/layout/payload/reading_sort.py: same_text_column
    SAME_COLUMN_OVERLAP_RATIO: 0.55,
    SAME_COLUMN_LEFT_BASE_PT: 18.0,
    SAME_COLUMN_LEFT_PAGE_RATIO: 0.035,
    // render/layout/payload/formula_safety.py
    MIN_SAFE_CONTENT_HEIGHT_PT: 8.0,
    MAX_FORMULA_INSET_HEIGHT_RATIO: 0.18,
    // render/layout/payload/geometry_adjustments.py: _apply_short_body_region_expansion
    SHORT_BODY_REGION_MIN_ANCHORS: 2,
    SHORT_BODY_REGION_X_TOLERANCE_PAGE_RATIO: 0.10,
    SHORT_BODY_REGION_MAX_HEIGHT_RATIO: 0.72,
    SHORT_BODY_REGION_MAX_WIDTH_RATIO: 0.78,
    SHORT_BODY_REGION_RIGHT_EXPAND_RATIO: 0.30,
    // geometry_adjustments._same_text_column (page width, not text width)
    REGION_SAME_COLUMN_LEFT_PAGE_RATIO: 0.035,
    // render/layout/payload/body_font_inheritance_policy.py (+ body_common
    // SHORT_BODY_INHERIT_MAX_HEIGHT_PT)
    SHORT_BODY_INHERIT_MIN_ANCHORS: 2,
    SHORT_BODY_INHERIT_MAX_WIDTH_RATIO: 1.18,
    SHORT_BODY_INHERIT_MAX_FONT_GROW_PT: 1.8,
    SHORT_BODY_INHERIT_MAX_HEIGHT_PT: 16.0,
    SHORT_BODY_INHERIT_MAX_LINES: 2,
    SHORT_BODY_INHERIT_PAGE_ANCHOR_BONUS_PT: 0.18,
    // render/policy/typography_policy.py: PAGE_BODY_FONT_ANCHOR_*
    // (body_page_anchor_policy.py; candidate width ratio 0.32 is a literal there)
    PAGE_BODY_FONT_ANCHOR_COUNT: 2,
    PAGE_BODY_FONT_ANCHOR_MIN_HEIGHT_PT: 42.0,
    PAGE_BODY_FONT_ANCHOR_MIN_LINES: 3,
    PAGE_BODY_FONT_ANCHOR_MIN_WIDTH_RATIO: 0.62,
    PAGE_BODY_FONT_ANCHOR_CANDIDATE_MIN_WIDTH_RATIO: 0.32,
    PAGE_BODY_FONT_ANCHOR_APPLY_TOLERANCE_PT: 0.04,
    // render/layout/payload/body_font_harmonize_policy.py (literals)
    LONG_BODY_MIN_HEIGHT_PT: 90,
    LONG_BODY_MIN_WIDTH_RATIO: 0.72,
    LONG_BODY_MAX_DENSITY: 0.98,
    LONG_BODY_FONT_BAND_PT: 0.14,
    LONG_BODY_LEADING_BAND_EM: 0.05,
    // render/layout/payload/body_context.py: ADJACENT_BODY_SMOOTH_* and
    // BODY_DENSITY_TARGET_MAX
    ADJACENT_BODY_SMOOTH_MAX_GAP_PT: 42.0,
    ADJACENT_BODY_SMOOTH_MIN_WIDTH_RATIO: 0.72,
    ADJACENT_BODY_SMOOTH_MIN_BOX_HEIGHT_PT: 36.0,
    ADJACENT_BODY_SMOOTH_MIN_WIDTH_PT: 64.0,
    ADJACENT_BODY_SMOOTH_MIN_PAGE_WIDTH_RATIO: 0.38,
    ADJACENT_BODY_SMOOTH_MIN_SOURCE_WORDS: 10,
    ADJACENT_BODY_SMOOTH_MIN_TRANSLATED_ZH_CHARS: 18,
    ADJACENT_BODY_SMOOTH_MAX_FONT_DELTA_PT: 0.24,
    ADJACENT_BODY_SMOOTH_RELAXED_FONT_DELTA_PT: 0.34,
    ADJACENT_BODY_SMOOTH_MAX_LEADING_DELTA_EM: 0.06,
    ADJACENT_BODY_SMOOTH_RELAXED_LEADING_DELTA_EM: 0.09,
    ADJACENT_BODY_SMOOTH_GROW_DENSITY_MAX: 0.95,
    ADJACENT_BODY_SMOOTH_RELAXED_GROW_DENSITY_MAX: 0.99,
    ADJACENT_BODY_SMOOTH_RELAXED_DENSITY_TRIGGER: 0.92,
    ADJACENT_BODY_SMOOTH_FONT_GROW_SHARE: 0.6,
    ADJACENT_BODY_SMOOTH_LEADING_GROW_SHARE: 0.35,
    ADJACENT_BODY_SMOOTH_MIN_FONT_PT: 6.4,
    ADJACENT_BODY_SMOOTH_MIN_LEADING_EM: 0.18,
    ADJACENT_BODY_SMOOTH_MAX_PRESSURE_DELTA: 0.9,
    BODY_DENSITY_TARGET_MAX: 0.92
  });

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  // leading_fit.normalize_leading_em_for_font_size: in retain-pdf this is a
  // plain clamp (its size-adjust arguments are discarded), rounded to 0.01.
  function normalizeLeadingEm(leadingEm, minLeadingEm, maxLeadingEm, floorMinLeadingEm = minLeadingEm) {
    return Math.round(clamp(leadingEm, Math.max(floorMinLeadingEm, minLeadingEm), maxLeadingEm) * 100) / 100;
  }

  // leading_fit.estimate_leading_em, body branch. sourcePitch is the source
  // block's line pitch (pt); compactness (source_compactness_score),
  // densityRatioX (occupied_ratio_x) and formulaWeight (formula_ratio) default
  // to 0 when the host cannot provide them.
  function bodyLeadingEm({ fontSize, sourcePitch = 0, compactness = 0, densityRatioX = 0, formulaWeight = 0, wideAspect = false }) {
    const zhTarget = Math.max(C.BODY_ZH_TARGET_MIN, C.BODY_ZH_TARGET_BASE - compactness * 0.07);
    let base;
    if (sourcePitch > 0 && fontSize > 0) {
      const ocrEstimated = sourcePitch / fontSize - 1.0;
      const mixed = wideAspect
        ? ocrEstimated * C.WIDE_ASPECT_OCR_LEADING_WEIGHT + zhTarget * C.WIDE_ASPECT_ZH_LEADING_WEIGHT
        : ocrEstimated * 0.35 + zhTarget * 0.65;
      base = mixed * C.BODY_LEADING_FACTOR;
    }
    else base = zhTarget * C.BODY_LEADING_FACTOR;
    if (compactness > 0) {
      const tightenMax = wideAspect ? C.WIDE_ASPECT_COMPACT_LEADING_TIGHTEN_MAX : C.BODY_COMPACT_LEADING_TIGHTEN_MAX;
      base *= 1.0 - Math.min(tightenMax, compactness * 0.07);
    }
    if (!wideAspect) base = Math.max(base, C.BODY_NORMAL_LEADING_MIN * C.BODY_LEADING_FACTOR);
    if (densityRatioX >= 0.86) base = Math.max(base, C.BODY_LEADING_MIN / C.HIGH_DENSITY_LEADING_RATIO);
    if (formulaWeight >= 0.08) base = Math.max(base, C.BODY_LEADING_MIN / C.FORMULA_LEADING_RATIO);
    return normalizeLeadingEm(base, C.BODY_LEADING_MIN, C.BODY_LEADING_MAX, C.BODY_LEADING_FLOOR_MIN);
  }

  // leading_fit.estimate_leading_em, non-body branch.
  function nonBodyLeadingEm({ fontSize, sourcePitch = 0, densityRatioX = 0, formulaWeight = 0 }) {
    let base;
    if (sourcePitch > 0 && fontSize > 0) {
      const ocrEstimated = sourcePitch / fontSize - 1.0;
      base = (ocrEstimated * 0.55 + C.DEFAULT_LEADING_EM * 0.45) * C.BODY_LEADING_FACTOR;
    }
    else base = C.DEFAULT_LEADING_EM * C.BODY_LEADING_FACTOR;
    if (densityRatioX >= 0.9) base = Math.max(base, C.NON_BODY_LEADING_MIN / C.HIGH_DENSITY_LEADING_RATIO);
    if (formulaWeight >= 0.12) base = Math.max(base, C.NON_BODY_LEADING_MIN / C.FORMULA_LEADING_RATIO);
    return normalizeLeadingEm(base, C.NON_BODY_LEADING_MIN, C.NON_BODY_LEADING_MAX, C.NON_BODY_LEADING_FLOOR_MIN);
  }

  // capacity.estimated_render_height_pt / body_common.payload_density, with
  // the line count taken from the real layout instead of retain-pdf's
  // character-unit estimate. The inflated line step (font * max(1.02,
  // 1 + leading)) is kept on purpose: every retain-pdf density threshold
  // (0.60, 0.80, 0.98, 1.08, 1.18) is calibrated against it.
  function estimatedDensity({ lines, fontSize, leadingEm, boxHeight, formulaDiscount = 1 }) {
    const lineStep = Math.max(fontSize * C.LINE_STEP_MIN_EM, fontSize * (1.0 + leadingEm));
    return Math.max(1, lines) * lineStep * formulaDiscount / Math.max(8.0, boxHeight);
  }

  // capacity._formula_estimate_discount_cached. tokens: retain-pdf's
  // tokenize_text (a CJK character, a word, a run of spaces, a formula, any
  // other character); formulas: their LaTeX bodies.
  const COMPLEX_FORMULA_COMMAND = /\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|begin|delta|Delta|partial|mathbf|overline|underline)/;
  function formulaEstimateDiscount(tokenCount, formulas) {
    if (!formulas.length) return 1.0;
    const complexCount = formulas.filter(tex => COMPLEX_FORMULA_COMMAND.test(tex)).length;
    const countRatio = formulas.length / Math.max(1.0, tokenCount);
    const uncertainty = formulas.length * 0.06 + complexCount * 0.06 + countRatio * 0.9;
    return Math.round((1.0 - 0.14 * (1.0 - Math.exp(-1.7 * Math.max(0.0, uncertainty)))) * 1000) / 1000;
  }

  // reading_sort.same_text_column (boxes as {left, top, right, bottom}).
  function sameColumn(first, second, pageTextWidthMed = 0) {
    const firstWidth = Math.max(1.0, first.right - first.left);
    const secondWidth = Math.max(1.0, second.right - second.left);
    const overlap = Math.max(0.0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    if (overlap >= Math.min(firstWidth, secondWidth) * C.SAME_COLUMN_OVERLAP_RATIO) return true;
    const tolerance = Math.max(C.SAME_COLUMN_LEFT_BASE_PT, (pageTextWidthMed > 0 ? pageTextWidthMed : 0) * C.SAME_COLUMN_LEFT_PAGE_RATIO);
    return Math.abs(first.left - second.left) <= tolerance;
  }

  // geometry_adjustments._apply_short_body_region_expansion (right edge only).
  // A short, narrow non-body text item with at least two body anchors above
  // it in the same column is widened by up to 30% of its width, never past
  // the anchors' right edge or the page edge, so a translated one-liner such
  // as an exercise heading does not wrap into the item below. retain-pdf also
  // lifts the top by up to 5% of the height; this model has fixed box tops.
  // `items` are in reading order: { id, anchor (body), box }. Returns a Map
  // id -> new right edge for the widened items.
  function shortRegionExpansion(items, pageWidth = 0) {
    const out = new Map();
    const anchors = items.filter(item => item.anchor);
    if (anchors.length < C.SHORT_BODY_REGION_MIN_ANCHORS || items.length < C.SHORT_BODY_REGION_MIN_ANCHORS + 1) return out;
    const sortedMedian = values => {
      const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
      if (!sorted.length) return 0;
      const middle = sorted.length >> 1;
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const medianHeight = sortedMedian(anchors.map(item => item.box.bottom - item.box.top));
    const medianWidth = sortedMedian(anchors.map(item => item.box.right - item.box.left));
    if (!(medianHeight > 0) || !(medianWidth > 0)) return out;
    const sameColumn = (first, second) => {
      const firstWidth = Math.max(1.0, first.right - first.left);
      const secondWidth = Math.max(1.0, second.right - second.left);
      const overlap = Math.max(0.0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
      if (overlap >= Math.min(firstWidth, secondWidth) * C.SAME_COLUMN_OVERLAP_RATIO) return true;
      return Math.abs(first.left - second.left) <= Math.max(C.SAME_COLUMN_LEFT_BASE_PT, (pageWidth || 0) * C.REGION_SAME_COLUMN_LEFT_PAGE_RATIO);
    };
    const xTolerance = Math.max(18.0, (pageWidth || 0) * C.SHORT_BODY_REGION_X_TOLERANCE_PAGE_RATIO);
    items.forEach((current, position) => {
      if (current.anchor) return;
      const box = current.box;
      const height = box.bottom - box.top;
      const width = box.right - box.left;
      if (!(height > 0) || !(width > 0)) return;
      if (height > medianHeight * C.SHORT_BODY_REGION_MAX_HEIGHT_RATIO) return;
      if (width > medianWidth * C.SHORT_BODY_REGION_MAX_WIDTH_RATIO) return;
      // _previous_region_anchors: the nearest two earlier anchors above it.
      const found = [];
      for (let index = position - 1; index >= 0 && found.length < C.SHORT_BODY_REGION_MIN_ANCHORS; index--) {
        const candidate = items[index];
        if (!candidate.anchor) continue;
        const anchorBox = candidate.box;
        if (anchorBox.bottom > box.top) continue;
        if (Math.abs(anchorBox.left - box.left) > xTolerance) continue;
        if (anchorBox.right <= box.right) continue;
        if (!sameColumn(anchorBox, box)) continue;
        found.push(anchorBox);
      }
      if (found.length < C.SHORT_BODY_REGION_MIN_ANCHORS) return;
      const anchorRight = Math.max(...found.map(anchorBox => anchorBox.right));
      const pageRight = pageWidth > 0 ? pageWidth - 4.0 : anchorRight;
      const targetRight = Math.min(anchorRight, pageRight, box.right + width * C.SHORT_BODY_REGION_RIGHT_EXPAND_RATIO);
      if (targetRight > box.right + 0.5) out.set(current.id, Math.round(targetRight * 1000) / 1000);
    });
    return out;
  }

  // body_font_inheritance_policy._short_body_target_font
  function shortBodyTargetFont(currentFont, targetFont) {
    if (!(currentFont > 0) || !(targetFont > 0)) return 0;
    if (targetFont <= currentFont) return Math.round(targetFont * 100) / 100;
    return Math.round(Math.min(targetFont, currentFont + C.SHORT_BODY_INHERIT_MAX_FONT_GROW_PT) * 100) / 100;
  }

  // body_context.smooth_adjacent_body_pair, font half: given the two sizes,
  // the relaxed flag and how far the smaller one may grow (already capped by
  // density and safety, `growCap`), returns { smaller, larger } new sizes.
  function smoothFontPair({ smallerFont, largerFont, relaxed, growCap = Infinity }) {
    const maxDelta = relaxed ? C.ADJACENT_BODY_SMOOTH_RELAXED_FONT_DELTA_PT : C.ADJACENT_BODY_SMOOTH_MAX_FONT_DELTA_PT;
    const delta = largerFont - smallerFont;
    if (!(delta > maxDelta)) return { smaller: smallerFont, larger: largerFont };
    const excess = delta - maxDelta;
    const desired = smallerFont + excess * C.ADJACENT_BODY_SMOOTH_FONT_GROW_SHARE;
    const grownTo = Math.round(Math.max(smallerFont, Math.min(desired, growCap)) * 100) / 100;
    const grown = Math.max(0, grownTo - smallerFont);
    const larger = Math.round(Math.max(C.ADJACENT_BODY_SMOOTH_MIN_FONT_PT, largerFont - Math.max(0, excess - grown)) * 100) / 100;
    return { smaller: grownTo, larger };
  }

  // body_harmonize_policy.harmonize_long_body_payloads: clamp to median ± band.
  function harmonizeBand(value, middle, band) {
    return Math.round(Math.min(Math.max(value, middle - band), middle + band) * 100) / 100;
  }

  // body_font_unify_policy._low_page_font_target (+ _without_extreme_small_fonts).
  function lowQuantileFontTarget(fonts, quantile = C.BODY_FONT_UNIFY_TARGET_QUANTILE) {
    let sorted = fonts.filter(font => font > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    if (sorted.length >= C.BODY_FONT_UNIFY_MIN_FILTERED_COUNT + 1) {
      const middle = sorted.length >> 1;
      const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      const floor = Math.max(median * C.BODY_FONT_UNIFY_EXTREME_SMALL_RATIO, median - C.BODY_FONT_UNIFY_EXTREME_SMALL_DELTA_PT);
      const filtered = sorted.filter(font => font >= floor);
      if (filtered.length >= C.BODY_FONT_UNIFY_MIN_FILTERED_COUNT) sorted = filtered;
    }
    return Math.round(sorted[Math.floor((sorted.length - 1) * quantile)] * 100) / 100;
  }

  // ----- annotation_font_policy (captions and footnotes) -----
  // render/policy/typography_policy.py ANNOTATION_* / CAPTION_* / FOOTNOTE_*.
  const ANNOTATION = Object.freeze({
    TARGET_QUANTILE: 0.25, EXTREME_SMALL_RATIO: 0.80, EXTREME_SMALL_DELTA_PT: 1.2, MIN_FILTERED_COUNT: 2,
    APPLY_TOLERANCE_PT: 0.06, MAX_SHRINK_PT: 0.9,
    caption: { BODY_CAP_RATIO: 0.88, TARGET_BONUS_PT: 0.0, MAX_GROW_PT: 0.0 },
    footnote: { BODY_CAP_RATIO: 0.82, TARGET_BONUS_PT: 0.04, MAX_GROW_PT: 0.08 }
  });

  // _without_extreme_small_fonts with the annotation thresholds.
  function annotationFonts(fonts) {
    let sorted = fonts.filter(font => font > 0).sort((a, b) => a - b);
    if (sorted.length >= ANNOTATION.MIN_FILTERED_COUNT + 1) {
      const middle = sorted.length >> 1;
      const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      const floor = Math.max(median * ANNOTATION.EXTREME_SMALL_RATIO, median - ANNOTATION.EXTREME_SMALL_DELTA_PT);
      const filtered = sorted.filter(font => font >= floor);
      if (filtered.length >= ANNOTATION.MIN_FILTERED_COUNT) sorted = filtered;
    }
    return sorted;
  }

  // unify_annotation_fonts for one role: the role's target size (25th
  // percentile, plus the role bonus but not above the median, capped at
  // bodyFontCap x the role ratio), then each font moved toward it: shrink by
  // at most MAX_SHRINK_PT, grow by at most the role's MAX_GROW_PT.
  function annotationTarget(fonts, role, bodyFontCap) {
    const sorted = annotationFonts(fonts);
    if (!sorted.length) return 0;
    const low = Math.round(sorted[Math.floor((sorted.length - 1) * ANNOTATION.TARGET_QUANTILE)] * 100) / 100;
    const middle = sorted[sorted.length >> 1];
    let target = Math.round(Math.min(middle, low + ANNOTATION[role].TARGET_BONUS_PT) * 100) / 100;
    if (bodyFontCap > 0) target = Math.min(target, bodyFontCap * ANNOTATION[role].BODY_CAP_RATIO);
    return target;
  }

  function annotationUnifiedFont(currentFont, targetFont, role) {
    if (Math.abs(currentFont - targetFont) <= ANNOTATION.APPLY_TOLERANCE_PT) return currentFont;
    if (currentFont > targetFont) return Math.round(Math.max(targetFont, currentFont - ANNOTATION.MAX_SHRINK_PT) * 100) / 100;
    return Math.round(Math.min(targetFont, currentFont + ANNOTATION[role].MAX_GROW_PT) * 100) / 100;
  }

  // _clamp_annotation_payload_font: never above bodyFontCap x the role ratio.
  function annotationCappedFont(font, role, bodyFontCap) {
    return bodyFontCap > 0 ? Math.min(font, Math.round(bodyFontCap * ANNOTATION[role].BODY_CAP_RATIO * 100) / 100) : font;
  }

  // body_font_unify_policy._apply_page_font_target, as a decision:
  // "target" (take the target), "keep" (stay at the current size).
  function unifyDecision({ currentFont, targetFont, densityAtTarget, directRender = true }) {
    if (Math.abs(currentFont - targetFont) <= C.BODY_FONT_UNIFY_APPLY_TOLERANCE_PT) return "target";
    if (currentFont > targetFont) return "target";
    if (directRender) return "target";
    if (densityAtTarget <= C.BODY_FONT_UNIFY_GROW_DENSITY_LIMIT) return "target";
    return "keep";
  }

  // body_font_underfill_policy helpers.
  function densitySlackRatio(density) {
    const trigger = C.BODY_UNDERFILLED_DENSITY_FLOOR_TRIGGER;
    return clamp((trigger - density) / Math.max(0.01, trigger), 0, 1);
  }

  function shortLineWeight(lineCount) {
    return clamp((5.0 - lineCount) / 4.0, 0, 1);
  }

  function heightSlackWeight(boxHeight, fontSize, lineCount) {
    if (fontSize <= 0 || lineCount <= 0) return 0;
    const height = Math.max(8.0, boxHeight);
    const natural = fontSize * Math.max(1, lineCount) * 1.1;
    return clamp((height - natural) / Math.max(height, 1.0), 0, 1);
  }

  function sourceLineRichWeight(sourceLines, lineCount) {
    if (sourceLines <= 0 || lineCount <= 0) return 0;
    const ratio = sourceLines / Math.max(1, lineCount);
    return clamp((ratio - C.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_RATIO_OFFSET) / C.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_RATIO_RANGE, 0, 1);
  }

  // _font_for_recovery_density
  function fontForRecoveryDensity(fontSize, density) {
    if (fontSize <= 0 || density <= 0) return fontSize;
    return fontSize * Math.sqrt(C.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET / Math.max(0.01, density));
  }

  // _target_font_for_payload
  function underfillTargetFont({ fontSize, density, pageFontTarget, pageUnderfillRatio, lineCount, boxHeight, sourceLines }) {
    const slackRatio = densitySlackRatio(density);
    const sourceWeight = sourceLineRichWeight(sourceLines, lineCount);
    if (lineCount < C.BODY_UNDERFILLED_FONT_GROW_MIN_LINES || boxHeight < C.BODY_UNDERFILLED_FONT_GROW_MIN_HEIGHT_PT) {
      const contextCap = Math.min(pageFontTarget, fontSize + C.BODY_UNDERFILLED_FONT_GROW_SHORT_MAX_PT);
      return Math.min(contextCap, fontSize + C.BODY_UNDERFILLED_FONT_GROW_SHORT_MAX_PT);
    }
    const recoveryFont = fontForRecoveryDensity(fontSize, density);
    let budget = C.BODY_UNDERFILLED_FONT_GROW_MAX_PT;
    budget += C.BODY_UNDERFILLED_FONT_GROW_SHORT_LINE_BONUS * shortLineWeight(lineCount);
    budget += C.BODY_UNDERFILLED_FONT_GROW_TALL_SLACK_BONUS * heightSlackWeight(boxHeight, fontSize, lineCount);
    budget += C.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_BONUS_PT * sourceWeight;
    const eased = budget * (1.0 - Math.exp(-C.BODY_UNDERFILLED_FONT_GROW_EXP_RATE * slackRatio));
    let contextCap = Math.max(pageFontTarget, recoveryFont);
    contextCap += C.BODY_UNDERFILLED_FONT_GROW_PAGE_BONUS_PT * pageUnderfillRatio;
    contextCap += C.BODY_UNDERFILLED_FONT_GROW_CONTEXT_BONUS_PT * slackRatio;
    contextCap += C.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_CAP_BONUS_PT * sourceWeight;
    return Math.min(contextCap, fontSize + eased);
  }

  // _density_limit_for_payload
  function underfillDensityLimit(lineCount, sourceLines) {
    const bonus = C.BODY_UNDERFILLED_FONT_GROW_SOURCE_LINE_DENSITY_BONUS * sourceLineRichWeight(sourceLines, lineCount);
    if (lineCount <= 4) return C.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET + bonus;
    return Math.min(C.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET + bonus, 1.00 + 0.01 * Math.max(0, 8 - lineCount) + bonus);
  }

  // _density_recovery_target
  function recoveryDensityTarget(lineCount, hasSourceLines) {
    if (lineCount <= 2) return C.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET_SHORT;
    if (!hasSourceLines) return C.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET_NO_SOURCE;
    return C.BODY_UNDERFILLED_DENSITY_RECOVERY_TARGET;
  }

  // _leading_cap_for_recovery
  function recoveryLeadingCap(lineCount, sourceLines) {
    if (lineCount <= 2 || sourceLines <= 0) return C.BODY_COMFORT_LOW_SOURCE_LINE_LEADING_MAX;
    if (sourceLines <= C.BODY_COMFORT_LOW_SOURCE_LINE_COUNT_MAX) return C.BODY_COMFORT_LOW_SOURCE_LINE_LEADING_MAX;
    return 0.82 + 0.20 * sourceLineRichWeight(sourceLines, lineCount);
  }

  // formula_safety.formula_safety_insets_pt: content insets (pt) for a block
  // whose text contains formulas; deep = sub/superscripts or tall operators.
  const SCRIPT_OR_TALL_MATH = /[_^]|\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|lim|underset|overset|substack)\b/;
  function formulaInsets(fontSize, boxHeight, formulas) {
    if (fontSize <= 0 || boxHeight <= C.MIN_SAFE_CONTENT_HEIGHT_PT || !formulas.length) return { top: 0, bottom: 0 };
    const deep = formulas.some(tex => SCRIPT_OR_TALL_MATH.test(tex));
    let top = Math.min(Math.max(fontSize * (deep ? 0.07 : 0.045), 0.25), 1.15);
    let bottom = Math.min(Math.max(fontSize * (deep ? 0.18 : 0.11), 0.55), 2.6);
    const available = Math.max(0, boxHeight - C.MIN_SAFE_CONTENT_HEIGHT_PT);
    const cap = Math.min(boxHeight * C.MAX_FORMULA_INSET_HEIGHT_RATIO, available);
    const total = top + bottom;
    if (cap <= 0 || total <= 0) return { top: 0, bottom: 0 };
    if (total > cap) {
      const scale = cap / total;
      top *= scale;
      bottom *= scale;
    }
    return { top: Math.round(top * 100) / 100, bottom: Math.round(bottom * 100) / 100 };
  }

  // typography/baseline.page_baseline_font_size + font_size_fit
  // .estimate_font_size_pt for a body block, from OCR line geometry only
  // (the fallback when a source PDF has no text layer). glyphHeights: median
  // OCR line heights of the page's text blocks; pitches: their line pitches.
  function percentile(values, q) {
    const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted[Math.floor((sorted.length - 1) * q)];
  }

  function pageBaselineFontSize(glyphHeights, pitches) {
    const metric = percentile(glyphHeights, C.PAGE_BASELINE_PERCENTILE) * C.LINE_HEIGHT_TO_FONT_SCALE
      || percentile(pitches, C.PAGE_BASELINE_PERCENTILE) * C.LINE_PITCH_TO_FONT_SCALE;
    if (!(metric > 0)) return 0;
    return clamp(metric * C.BODY_FONT_SIZE_FACTOR, C.MIN_FONT_SIZE_PT, C.MAX_LOCAL_FONT_SIZE_PT);
  }

  // font_size_fit.local_font_size_pt: the size of a non-body block (titles,
  // headings, captions, footnotes) from its own glyph height, without the
  // page blend estimate_font_size_pt applies to body candidates.
  function geometryLocalFontSize({ glyphHeight, pitch, role = "text" }) {
    const metric = glyphHeight > 0 ? glyphHeight * C.LINE_HEIGHT_TO_FONT_SCALE : pitch * C.LINE_PITCH_TO_FONT_SCALE;
    if (!(metric > 0)) return 0;
    const base = metric * C.BODY_FONT_SIZE_FACTOR;
    let size;
    if (role === "footnote") size = clamp(base * 0.78, 6.6, C.MAX_LOCAL_FONT_SIZE_PT);
    else if (role === "caption") size = clamp(base * 0.86, C.MIN_FONT_SIZE_PT, 10.0);
    else size = clamp(base, C.MIN_FONT_SIZE_PT, C.MAX_LOCAL_FONT_SIZE_PT);
    return Math.round(size * 100) / 100;
  }

  function geometryBodyFontSize({ glyphHeight, pitch, pagePitch, pageFont, compactness = 0 }) {
    const local = clamp((glyphHeight > 0 ? glyphHeight * C.LINE_HEIGHT_TO_FONT_SCALE : pitch * C.LINE_PITCH_TO_FONT_SCALE) * C.BODY_FONT_SIZE_FACTOR,
      C.MIN_FONT_SIZE_PT, C.MAX_LOCAL_FONT_SIZE_PT);
    const blockScale = pagePitch > 0 && pitch > 0 ? clamp(pitch / pagePitch, C.LOCAL_BLOCK_SCALE_MIN, C.LOCAL_BLOCK_SCALE_MAX) : 1;
    const pageEstimate = pageFont > 0 ? pageFont * blockScale : local;
    const pageWeight = Math.max(C.BODY_PAGE_BLEND_MIN, C.BODY_PAGE_BLEND_BASE - compactness * 0.18);
    const blended = pageEstimate * pageWeight + local * (1 - pageWeight);
    return Math.round(clamp(blended, C.MIN_FONT_SIZE_PT, C.MAX_LOCAL_FONT_SIZE_PT) * 100) / 100;
  }

  // ----- fit_translated_block_metrics (payload/fit_metrics.py), faithful -----
  // Character-unit demand vs box capacity, exactly as retain-pdf estimates it
  // (payload/capacity.py, formula_cost.token_units, text_common), plus the
  // dense_small_box / heavy_dense_small_box flags (block_seed_body_policy).
  const FIT = Object.freeze({
    LAYOUT_DENSITY_SAFE_MAX: 0.89, AGGRESSIVE_DEMAND_RATIO: 1.16, AGGRESSIVE_LAYOUT_DENSITY_MARGIN: 0.12,
    COMPACT_TRIGGER_RATIO: 0.9, LAYOUT_COMPACT_TRIGGER_RATIO: 0.9, HEAVY_COMPACT_RATIO: 1.0,
    SMALL_PAGE_BOX_RATIO: 0.06, ULTRA_SMALL_PAGE_BOX_RATIO: 0.04,
    GEOMETRY_DENSE_TRIGGER: 0.86, GEOMETRY_HEAVY_DENSE_TRIGGER: 0.98, LENGTH_DENSITY_AUX_TRIGGER: 1.18
  });
  const TOKEN = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|[一-鿿]|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|\s+|[^\s]/g;
  const WORD = /^[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*$/;
  function retainTokens(text) { return String(text || "").match(TOKEN) || []; }
  function formulaVisible(tex) {
    return String(tex || "").replace(/\\[A-Za-z]+/g, "x").replace(/[{}~]/g, "").replace(/\s+/g, "");
  }
  // formula_cost.token_units
  function tokenUnits(token) {
    if (!token) return 0;
    if (/^\s+$/.test(token)) return Math.max(0.2, token.length * 0.25);
    if (/^(\$|\\\(|\\\[)/.test(token) && token.length > 2) {
      const body = token.replace(/^\$\$|\$\$$|^\$|\$$|^\\\(|\\\)$|^\\\[|\\\]$/g, "");
      return Math.max(1.35, formulaVisible(body).length * 0.42);
    }
    if (/^[一-鿿]$/.test(token)) return 1.0;
    if (WORD.test(token)) return Math.max(1.0, token.length * 0.55);
    return 0.45;
  }
  function demandUnits(text) { return retainTokens(text).reduce((sum, token) => sum + tokenUnits(token), 0); }
  function zhCharCount(text) { return (String(text || "").match(/[一-鿿]/g) || []).length; }
  function sourceWordCount(text) { return retainTokens(text).filter(token => WORD.test(token)).length; }
  const lineStepOf = (fontSize, leadingEm) => Math.max(fontSize * 1.02, fontSize * (1.0 + leadingEm));
  // capacity.box_capacity_units
  function capacityUnits({ width, height, fontSize, leadingEm, visualLines }) {
    const w = Math.max(8.0, width), h = Math.max(8.0, height);
    let lines = Math.max(1, Math.floor(h / lineStepOf(fontSize, leadingEm)));
    if (visualLines && visualLines > 1) lines = Math.min(lines, Math.max(1, visualLines + 1));
    return lines * Math.max(4.0, w / Math.max(fontSize * 0.92, 1.0)) * 0.98;
  }
  // text_common.layout_density_ratio
  function layoutDensityRatio({ width, height, text, fontSize, lineStep }) {
    const zh = zhCharCount(text);
    if (!(fontSize > 0) || !(lineStep > 0) || zh <= 0) return 0;
    const perLine = Math.max(4.0, Math.max(8.0, width) / Math.max(fontSize * 0.92, 1.0));
    return Math.max(1.0, zh / perLine) * lineStep / Math.max(8.0, height);
  }
  // text_common.translation_density_ratio
  function translationDensityRatio(sourceText, translatedText) {
    const words = sourceWordCount(sourceText);
    const zh = zhCharCount(translatedText);
    return words > 0 && zh > 0 ? zh / words : 0;
  }
  // block_seed_body_policy.is_dense_small_box / is_heavy_dense_small_box
  function denseSmallBox({ densityRatio, layoutDensity, pageBoxAreaRatio }) {
    if (!(pageBoxAreaRatio > 0 && pageBoxAreaRatio <= FIT.SMALL_PAGE_BOX_RATIO)) return false;
    if (layoutDensity >= FIT.GEOMETRY_DENSE_TRIGGER) return true;
    return densityRatio >= FIT.LENGTH_DENSITY_AUX_TRIGGER && layoutDensity >= FIT.GEOMETRY_DENSE_TRIGGER - 0.08;
  }
  function heavyDenseSmallBox({ densityRatio, layoutDensity, pageBoxAreaRatio }) {
    if (!(pageBoxAreaRatio > 0 && pageBoxAreaRatio <= FIT.ULTRA_SMALL_PAGE_BOX_RATIO)) return false;
    if (layoutDensity >= FIT.GEOMETRY_HEAVY_DENSE_TRIGGER) return true;
    return densityRatio >= Math.max(FIT.HEAVY_COMPACT_RATIO, FIT.LENGTH_DENSITY_AUX_TRIGGER) && layoutDensity >= FIT.GEOMETRY_DENSE_TRIGGER;
  }
  // payload/fit_metrics.fit_translated_block_metrics (body and non-body).
  function fitTranslatedBlockMetrics({ isBody, fontSize, leadingEm, pageBodyFont, width, height, visualLines,
    sourceText, translatedText, denseSmall, heavyDenseSmall, wideAspect = false }) {
    const r2 = value => Math.round(value * 100) / 100;
    const demand = demandUnits(translatedText);
    const lineStep = lineStepOf(fontSize, leadingEm);
    const lengthDensity = translationDensityRatio(sourceText, translatedText);
    const layoutDensity = layoutDensityRatio({ width, height, text: translatedText, fontSize, lineStep });
    const isDenseBlock = lengthDensity >= FIT.COMPACT_TRIGGER_RATIO || layoutDensity >= FIT.LAYOUT_COMPACT_TRIGGER_RATIO;
    let font = fontSize;
    if (isBody && pageBodyFont > 0) {
      let floorGap = heavyDenseSmall ? 0.58 : (denseSmall ? 0.34 : 0.12);
      if (wideAspect) floorGap = Math.max(0, floorGap - 0.1);
      font = r2(Math.max(font, pageBodyFont - floorGap));
    }
    const out = (f, l, why) => ({ font: f, leadingEm: l, why, isDenseBlock, layoutDensity, lengthDensity, demand });
    if (demand <= 0) return out(font, leadingEm, "no-demand");
    const capacity = capacityUnits({ width, height, fontSize: font, leadingEm, visualLines });
    const safeCapacity = wideAspect ? 1.0 : 0.96;
    const safeLayout = wideAspect ? FIT.LAYOUT_DENSITY_SAFE_MAX + 0.03 : FIT.LAYOUT_DENSITY_SAFE_MAX;
    if (capacity <= 0 || (demand <= capacity * safeCapacity && layoutDensity < safeLayout)) return out(font, leadingEm, "fits");
    const aggressive = heavyDenseSmall
      || (denseSmall && capacity > 0 && demand > capacity * 1.04 && layoutDensity >= FIT.LAYOUT_DENSITY_SAFE_MAX + 0.03)
      || (capacity > 0 && demand > capacity * (FIT.AGGRESSIVE_DEMAND_RATIO + 0.1) && layoutDensity >= FIT.LAYOUT_DENSITY_SAFE_MAX + FIT.AGGRESSIVE_LAYOUT_DENSITY_MARGIN);
    let bestFont = font;
    const maxSteps = isBody ? (wideAspect ? (aggressive ? 1 : 0) : (aggressive ? 2 : (isDenseBlock ? 1 : 0))) : (aggressive ? 4 : (isDenseBlock ? 2 : 1));
    const denseAny = denseSmall || isDenseBlock;
    let minFont = Math.max(denseAny ? 8.45 : 8.75,
      pageBodyFont > 0 ? pageBodyFont - (heavyDenseSmall ? 0.62 : denseSmall ? 0.4 : 0.18) : (denseAny ? 8.45 : 8.75));
    if (wideAspect) minFont = Math.max(minFont, font - 0.06);
    for (let step = 1; step <= maxSteps; step++) {
      const candidate = r2(Math.max(minFont, font - step * 0.12));
      if (demand <= capacityUnits({ width, height, fontSize: candidate, leadingEm, visualLines }) * 0.98) return out(candidate, leadingEm, `step${step}`);
      bestFont = candidate;
    }
    if (isBody) {
      if (!aggressive) return out(bestFont, leadingEm, "not-aggressive");
      const emergencyLeading = r2(Math.max(denseAny ? 0.54 : 0.56, leadingEm - 0.01));
      const emergencyMin = Math.max(denseAny ? 7.8 : 8.2,
        pageBodyFont > 0 ? pageBodyFont - (heavyDenseSmall ? 1.25 : denseSmall ? 0.95 : 0.7) : (denseAny ? 7.8 : 8.2));
      for (let step = 1; step < (denseAny ? 8 : 5); step++) {
        const candidate = r2(Math.max(emergencyMin, bestFont - step * 0.14));
        if (demand <= capacityUnits({ width, height, fontSize: candidate, leadingEm: emergencyLeading, visualLines }) * 0.98) return out(candidate, emergencyLeading, `emergency${step}`);
        bestFont = candidate;
      }
      return out(bestFont, emergencyLeading, "emergency-floor");
    }
    return out(bestFont, leadingEm, "non-body-steps");
  }

  return {
    RETAIN: C,
    normalizeLeadingEm, bodyLeadingEm, nonBodyLeadingEm,
    estimatedDensity, formulaEstimateDiscount, sameColumn, shortRegionExpansion,
    shortBodyTargetFont, smoothFontPair, harmonizeBand,
    lowQuantileFontTarget, unifyDecision,
    densitySlackRatio, sourceLineRichWeight, fontForRecoveryDensity, underfillTargetFont,
    underfillDensityLimit, recoveryDensityTarget, recoveryLeadingCap,
    formulaInsets, pageBaselineFontSize, geometryBodyFontSize, geometryLocalFontSize,
    ANNOTATION, annotationTarget, annotationUnifiedFont, annotationCappedFont,
    FIT, demandUnits, capacityUnits, layoutDensityRatio, translationDensityRatio, denseSmallBox, heavyDenseSmallBox, fitTranslatedBlockMetrics
  };
});
