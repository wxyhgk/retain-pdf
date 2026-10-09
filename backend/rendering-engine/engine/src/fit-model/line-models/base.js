// retain-pdf-rendering/fit-model/line-models/base.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// What both line models share: one paragraph laid out by the measurer, and
// the painted width of a line (the stretched width of a justified line).
(function (root, factory) {
  "use strict";
  const NAME = "lineModelBase";
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
  function measureParagraph(using, prepared, options) {
    return using.layout(prepared, {
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
      width: options.nowrap ? 1e9 : options.width,
      align: options.nowrap ? "left" : (options.align || "left"),
      firstLineIndent: options.firstLineIndent || 0,
      hangingIndent: options.hangingIndent || 0,
      // Opt-in balanced breaking (ctx.balance): absent means greedy.
      ...(options.balance && !options.nowrap ? { balance: options.balance } : {})
    });
  }

  function paintedWidth(line) {
    return line.justified && Number.isFinite(line.available) ? Math.max(line.width, line.available) : line.width;
  }

  return { measureParagraph, paintedWidth };
});
