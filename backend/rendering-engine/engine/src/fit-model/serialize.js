// retain-pdf-rendering/fit-model/serialize.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The fit result as plain data: per node size, line height, absolute lines,
// glyph rects and formula/code details, for a Typst emitter or a DOM painter.
(function (root, factory) {
  "use strict";
  const NAME = "serialize";
  const DEPENDENCIES = [["document", "./document"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, document) {
  "use strict";
  const { isStream, layoutControlFontSize, effectiveLineRatio, textAlign, measurerForNode } = document;

  function createSerializer(ctx, geo) {
    const { geometry, renderedContentRectsInPage } = geo;

    // ----- output -----

    function serialize(doc, mode) {
      return {
        mode,
        pages: doc.pages.map(page => ({
          index: page.index,
          width: page.width,
          height: page.height,
          nodes: page.nodes.map(node => {
            const value = geometry(node);
            const box = value.box;
            const out = {
              id: node.id,
              label: nodeLabel(node),
              kind: node.kind,
              type: node.type || "",
              styleKind: node.styleKind || "",
              flowKind: node.flowKind || "",
              bbox: [box.left, box.top, box.right, box.bottom],
              fontSize: layoutControlFontSize(node),
              lineHeight: effectiveLineRatio(node),
              styleLineHeight: node.style.lineRatio,
              align: textAlign(node),
              lines: value.lines,
              textRects: value.text,
              // Rendered content (text plus opaque media; the box when empty):
              // the geometry body text is tested against.
              contentRects: renderedContentRectsInPage(node),
              fit: node.fit,
              fitLabel: node.fitLabel || ""
            };
            if (node.content.paragraphs) out.paragraphs = node.content.paragraphs.map(paragraph => ({ runs: paragraph.runs, indent: paragraph.indent }));
            if (node.toc) out.tocRows = node.content.raw.tocRows;
            if (node.formula) {
              out.formula = {
                scale: node.formula.scale,
                numberRight: node.formula.numberRight,
                runs: node.content.formulaRuns || [],
                number: node.content.numberText || "",
                rect: value.formulaRect || null,
                numberRect: value.numberRect || null
              };
            }
            if (typeof node.content.code === "string") out.code = { text: node.content.code, fit: node.codeFit || "" };
            if (node.shortTitleNoWrap) out.nowrap = true;
            if (node.userBodyFontPt) out.userBodyFontPt = node.userBodyFontPt;
            // Measured with the host's bold measurer (measurers.bold): paint bold.
            if (ctx.roleMeasurers.bold && measurerForNode(ctx, node) === ctx.roleMeasurers.bold) out.fontWeight = "bold";
            return out;
          })
        }))
      };
    }

    function nodeLabel(node) {
      const kind = isStream(node) ? `stream:${node.styleKind || ""}/${node.flowKind || ""}` : `block:${node.blockKind || ""}`;
      return `${kind}#${node.id || "?"}`;
    }

    return { serialize, nodeLabel };
  }

  return { createSerializer };
});
