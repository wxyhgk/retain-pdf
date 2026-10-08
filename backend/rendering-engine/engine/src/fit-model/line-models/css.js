// retain-pdf-rendering/fit-model/line-models/css.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The "css" line model: CSS line boxes rebuilt around the measurer's line
// breaks (fontSize * lineHeight tall, face content areas centred on the
// line box, optional Gecko pixel rounding). What the DOM fitter measures.
(function (root, factory) {
  "use strict";
  const NAME = "lineModelCss";
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

  function createCssLineModel(ctx) {
    const contentAreas = ctx.contentAreas;
    const pixelRound = ctx.pixelRound;

    function cssArea(role) {
      return (role && contentAreas[role]) || contentAreas.serif;
    }

    // One paragraph laid out by `using`, in the configured line model. Lines
    // are relative to the paragraph origin; `width` is the painted width
    // (the stretched width of a justified line).
    function layoutText(using, prepared, options, role = null) {
      const result = measureParagraph(using, prepared, options);
      const painted = paintedWidth;
      const fontSize = options.fontSize;
      // CSS: rebuild the line boxes around the measurer's baselines.
      const textAscent = Number.isFinite(using.metrics?.ascender) ? using.metrics.ascender * fontSize : null;
      const textDescent = Number.isFinite(using.metrics?.descender) ? using.metrics.descender * fontSize : null;
      const area = cssArea(role);
      const asc = pixelRound(area.ascent * fontSize);
      const desc = pixelRound(area.descent * fontSize);
      const fallback = area.fallback
        ? { pattern: area.fallback.pattern, asc: pixelRound(area.fallback.ascent * fontSize), desc: pixelRound(area.fallback.descent * fontSize) }
        : null;
      const L = fontSize * options.lineHeight;
      const halfLeading = (L - (asc + desc)) / 2;
      const strutAbove = asc + halfLeading;
      const strutBelow = desc + halfLeading;
      const text = options.text || "";
      const lines = [];
      let y = 0;
      for (const line of result.lines) {
        // What sticks out beyond the measured face's own ascender/descender
        // is an inline box; text itself sits in the CSS strut.
        const boxAbove = textAscent !== null && line.ascent > textAscent + 1e-6 ? line.ascent : 0;
        const boxBelow = textDescent !== null && line.descent > textDescent + 1e-6 ? line.descent : 0;
        const lineAbove = Math.max(strutAbove, boxAbove);
        const lineBelow = Math.max(strutBelow, boxBelow);
        const baseline = y + lineAbove;
        const lineText = text.slice(line.start, line.end);
        const hasText = lineText.replace(/[\s\u2028\uFFFC]/g, "").length > 0;
        const useFallback = fallback && fallback.pattern.test(lineText);
        const glyphAsc = useFallback ? Math.max(asc, fallback.asc) : asc;
        const glyphDesc = useFallback ? Math.max(desc, fallback.desc) : desc;
        lines.push({
          ...line,
          naturalWidth: line.width,
          width: painted(line),
          top: y,
          baseline,
          ascent: asc,
          descent: desc,
          glyphTop: baseline - (hasText ? Math.max(glyphAsc, boxAbove) : boxAbove),
          glyphBottom: baseline + (hasText ? Math.max(glyphDesc, boxBelow) : boxBelow)
        });
        y += lineAbove + lineBelow;
      }
      return { lines, height: y, maxLineWidth: result.maxLineWidth, leading: 0 };
    }

    // Vertical offset of the first line and the space between paragraphs.
    function paragraphRhythm(fontSize, lineRatio, gapEm) {
      return { top: 0, between: gapEm * fontSize };
    }

    // Content height of one monospace code line.
    function codeArea(measurer, fontSize) {
      return pixelRound(contentAreas.serif.ascent * fontSize) + pixelRound(contentAreas.serif.descent * fontSize);
    }

    return { name: "css", layoutText, paragraphRhythm, codeArea };
  }

  return { createCssLineModel };
});
