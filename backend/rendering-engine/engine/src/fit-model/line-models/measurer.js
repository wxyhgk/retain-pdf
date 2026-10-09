// retain-pdf-rendering/fit-model/line-models/measurer.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The "measurer" line model: the measurer's own geometry (Typst lines,
// ascender..descender tall, `leading` between lines), with lines spaced so
// that their ink can never overlap. What the Typst output paints.
(function (root, factory) {
  "use strict";
  const NAME = "lineModelMeasurer";
  const DEPENDENCIES = [["lineModelBase", "./base"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, base) {
  "use strict";
  const { measureParagraph, paintedWidth } = base;

  function createMeasurerLineModel(ctx) {
    const inkExtents = ctx.inkExtents;

    // One paragraph laid out by `using`, in the configured line model. Lines
    // are relative to the paragraph origin; `width` is the painted width
    // (the stretched width of a justified line).
    function layoutText(using, prepared, options, role = null) {
      const result = measureParagraph(using, prepared, options);
      const painted = paintedWidth;
      const fontSize = options.fontSize;
      // The measurer's line pitch is the floor; on top of it a line's
      // baseline sits at least (ink below the previous baseline + ink above
      // this one) below the previous one, so Latin descenders can never
      // reach the next line even at lineHeight <= 1 (leading 0).
      const text = options.text || "";
      const textAscent = Number.isFinite(using.metrics?.ascender) ? using.metrics.ascender * fontSize : null;
      const textDescent = Number.isFinite(using.metrics?.descender) ? using.metrics.descender * fontSize : null;
      const lines = [];
      let previous = null;
      let shift = 0;
      for (const line of result.lines) {
        const boxAbove = textAscent !== null && line.ascent > textAscent + 1e-6 ? line.ascent : 0;
        const boxBelow = textDescent !== null && line.descent > textDescent + 1e-6 ? line.descent : 0;
        const lineText = text.slice(line.start, line.end);
        const hasText = lineText.replace(/[\s\u2028\uFFFC]/g, "").length > 0;
        const ink = hasText ? inkExtents(lineText) : { ascent: 0, descent: 0 };
        const above = Math.max(ink.ascent * fontSize, boxAbove);
        const below = Math.max(ink.descent * fontSize, boxBelow);
        let baseline = line.baseline + shift;
        if (previous) {
          const needed = previous.baseline + previous.below + above;
          if (baseline < needed) { shift += needed - baseline; baseline = needed; }
        }
        const out = {
          ...line,
          naturalWidth: line.width,
          width: painted(line),
          top: line.top + shift,
          baseline,
          glyphTop: baseline - above,
          glyphBottom: baseline + below
        };
        lines.push(out);
        previous = { baseline, below };
      }
      const leading = Number.isFinite(result.leading) ? result.leading : Math.max(0, (options.lineHeight - 1) * fontSize);
      const last = lines[lines.length - 1];
      const height = Math.max(result.height + shift, last ? last.glyphBottom : 0);
      return { lines, height, maxLineWidth: result.maxLineWidth, leading };
    }

    // Vertical offset of the first line and the space between paragraphs.
    function paragraphRhythm(fontSize, lineRatio, gapEm) {
      const leading = Math.max(0, (lineRatio - 1) * fontSize);
      return { top: leading / 2, between: leading + gapEm * fontSize };
    }

    // Content height of one monospace code line.
    function codeArea(measurer, fontSize) {
      return ((measurer.metrics?.ascender ?? .88) + (measurer.metrics?.descender ?? .12)) * fontSize;
    }

    return { name: "measurer", layoutText, paragraphRhythm, codeArea };
  }

  return { createMeasurerLineModel };
});
