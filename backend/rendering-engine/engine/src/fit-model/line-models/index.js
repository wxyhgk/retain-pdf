// retain-pdf-rendering/fit-model/line-models/index.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Picks the line model named by ctx.lineModel; callers never branch on it.
(function (root, factory) {
  "use strict";
  const NAME = "lineModel";
  const DEPENDENCIES = [["lineModelMeasurer", "./measurer"], ["lineModelCss", "./css"], ["lineModelRetain", "./retain"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, Measurer, Css, Retain) {
  "use strict";
  function createLineModel(ctx) {
    if (ctx.lineModel === "css") return Css.createCssLineModel(ctx);
    if (ctx.lineModel === "retain") return Retain.createRetainLineModel(ctx);
    return Measurer.createMeasurerLineModel(ctx);
  }

  return { createLineModel };
});
