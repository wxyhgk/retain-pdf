// retain-pdf-rendering/fit-model/line-models/retain.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The "retain" line model (typography profile "retain"): the geometry
// retain-pdf's Typst overlay fits with. Text uses Typst's default edges,
// top-edge "cap-height" and bottom-edge "baseline", so a plain text line is
// capHeight tall and consecutive lines sit capHeight + leading apart; an
// inline formula box taller than cap height (or reaching below the baseline)
// enlarges its line. The node's lineRatio is that pitch over the font size:
//     lineRatio = capHeight + leading_em      (leading = (lineRatio - capHeight) * fontSize)
// Each line reports two extents:
//   fitTop..fitBottom     the Typst line box, what retain-pdf's measure()
//                         compares with the block height (the "fit band");
//   glyphTop..glyphBottom real ink, which may overhang the band (CJK ink above
//                         cap height, descenders) and is what collisions test.
// Like the measurer model, a baseline never comes closer to the previous one
// than (ink below it + ink above this line), so lines of one node cannot
// overlap in ink even at the tightest leading.
(function (root, factory) {
  "use strict";
  const NAME = "lineModelRetain";
  const DEPENDENCIES = [["lineModelBase", "./base"], ["typographyRetain", "../typography-retain"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, base, typography) {
  "use strict";
  const { measureParagraph, paintedWidth } = base;

  // Source Han Serif SC cap height (OS/2 sCapHeight 729 / 1000) when the
  // measurer's metrics do not carry one.
  const DEFAULT_CAP_HEIGHT = 0.729;

  function capHeightOf(using) {
    const value = Number(using?.metrics?.capHeight);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CAP_HEIGHT;
  }

  // Typst puts all of a justified line's slack into its justifiable gaps:
  // after every space and CJK character except the last glyph (Latin letters
  // and formula boxes are not stretched).
  const CJK_JUSTIFIABLE = /[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/;
  function justifiableGaps(lineText) {
    const body = String(lineText).replace(/[\s\u2028]+$/, "");
    let gaps = 0;
    for (let i = 0; i < body.length - 1; i++) if (/\s/.test(body[i]) || CJK_JUSTIFIABLE.test(body[i])) gaps += 1;
    return gaps;
  }

  function createRetainLineModel(ctx) {
    const inkExtents = ctx.inkExtents;
    // Justification cap (em per justifiable gap, ctx.justifyCap): a justified
    // line is painted at most natural + gaps * cap wide, the rest stays as
    // ragged-right space; a line with no justifiable gap is not justified.
    // It only narrows the painted width, so it can never add ink anywhere.
    const justifyCap = Number.isFinite(ctx.justifyCap) && ctx.justifyCap >= 0 ? ctx.justifyCap : null;
    function capJustification(line, lineText, fontSize) {
      const painted = paintedWidth(line);
      if (justifyCap === null || !line.justified) return { width: painted, justified: line.justified };
      const gaps = justifiableGaps(lineText);
      if (!gaps) return { width: line.width, justified: false };
      return { width: Math.min(painted, line.width + gaps * justifyCap * fontSize), justified: true };
    }

    function layoutText(using, prepared, options, role = null) {
      const result = measureParagraph(using, prepared, options);
      const fontSize = options.fontSize;
      const capHeight = capHeightOf(using) * fontSize;
      const leading = Math.max(0, (Number(options.lineHeight) - capHeightOf(using)) * fontSize);
      const text = options.text || "";
      const textAscent = Number.isFinite(using.metrics?.ascender) ? using.metrics.ascender * fontSize : null;
      const textDescent = Number.isFinite(using.metrics?.descender) ? using.metrics.descender * fontSize : null;
      const lines = [];
      let previous = null;
      for (const line of result.lines) {
        // Inline boxes that stick out beyond the face's ascender/descender.
        const boxAbove = textAscent !== null && line.ascent > textAscent + 1e-6 ? line.ascent : 0;
        const boxBelow = textDescent !== null && line.descent > textDescent + 1e-6 ? line.descent : 0;
        const edgeTop = Math.max(capHeight, boxAbove);
        const edgeBottom = Math.max(0, boxBelow);
        const lineText = text.slice(line.start, line.end);
        const hasText = lineText.replace(/[\s\u2028\uFFFC]/g, "").length > 0;
        const ink = hasText ? inkExtents(lineText) : { ascent: 0, descent: 0 };
        const above = Math.max(ink.ascent * fontSize, boxAbove);
        const below = Math.max(ink.descent * fontSize, boxBelow);
        let baseline = previous ? previous.baseline + previous.edgeBottom + leading + edgeTop : edgeTop;
        if (previous) baseline = Math.max(baseline, previous.baseline + previous.below + above);
        const justification = capJustification(line, lineText, fontSize);
        lines.push({
          ...line,
          naturalWidth: line.width,
          width: justification.width,
          justified: justification.justified,
          top: baseline - edgeTop,
          baseline,
          glyphTop: baseline - above,
          glyphBottom: baseline + below,
          fitTop: baseline - edgeTop,
          fitBottom: baseline + edgeBottom
        });
        previous = { baseline, edgeBottom, below };
      }
      const last = lines[lines.length - 1];
      return { lines, height: last ? last.fitBottom : 0, maxLineWidth: result.maxLineWidth, leading };
    }

    // A Typst block starts with its first line's top edge: no half leading
    // above the first line or below the last; paragraphs are `leading` apart.
    function paragraphRhythm(fontSize, lineRatio, gapEm) {
      const leading = Math.max(0, (lineRatio - DEFAULT_CAP_HEIGHT) * fontSize);
      return { top: 0, between: leading + gapEm * fontSize };
    }

    // Content height of one monospace code line (as the measurer model).
    function codeArea(measurer, fontSize) {
      return ((measurer.metrics?.ascender ?? .88) + (measurer.metrics?.descender ?? .12)) * fontSize;
    }

    // retain-pdf pads a block whose text holds formulas (formula_safety):
    // the content starts `top` lower and must end `bottom` higher. A node may
    // also carry `retainInkFloor` (set by passes/retain-body.js): the lowest
    // point, relative to its box top, that something above it reaches (an
    // overlapping box, or another node's ink) plus a small clearance. The
    // first line then starts low enough for its own ink, which rises above
    // cap height by the ink table's ascent, to stay below that point.
    function contentInsets(fontSize, boxHeight, paragraphs, node = null) {
      const formulas = [];
      for (const paragraph of paragraphs || []) {
        for (const run of paragraph?.prepared?.content || []) {
          if (run && run.type === "math" && run.tex) formulas.push(String(run.tex));
        }
      }
      let insets = typography.formulaInsets(fontSize, boxHeight, formulas);
      // retainLift (passes/retain-body.js): the first line may start up to
      // this many points above where it would, into free space above the box.
      const lift = node ? Number(node.retainLift) : NaN;
      if (Number.isFinite(lift) && lift > 0) insets = { top: insets.top - lift, bottom: insets.bottom };
      const floor = node ? Number(node.retainInkFloor) : NaN;
      if (!Number.isFinite(floor)) return insets;
      const text = (paragraphs || []).map(paragraph => paragraph?.text || "").join("");
      const ascent = text ? inkExtents(text).ascent : 0;
      const needed = floor + (ascent - DEFAULT_CAP_HEIGHT) * fontSize;
      const extra = Math.min(Math.max(0, needed), Math.max(0, boxHeight) * 0.4);
      return extra > insets.top + 0.005 ? { top: extra, bottom: insets.bottom } : insets;
    }

    return { name: "retain", layoutText, paragraphRhythm, codeArea, contentInsets };
  }

  return { createRetainLineModel, DEFAULT_CAP_HEIGHT, justifiableGaps };
});
