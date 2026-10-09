// retain-pdf-rendering/fit-model/index.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// createModelFitter: reads the configuration once into a frozen `ctx`,
// creates the per-fitter parts (line model, geometry + caches, collision,
// document builder, serializer) and, per fit run, the run-scoped passes.
(function (root, factory) {
  "use strict";
  const NAME = "fitter";
  const DEPENDENCIES = [["constants", "./constants"], ["content", "./content"], ["rects", "./rects"], ["document", "./document"], ["lineModel", "./line-models/index"], ["geometry", "./geometry"], ["collision", "./collision"], ["tuning", "./tuning"], ["titlePasses", "./passes/titles"], ["clampPasses", "./passes/clamps"], ["finalAuditPass", "./passes/final-audit"], ["formulaPasses", "./passes/formulas"], ["retainBodyPass", "./passes/retain-body"], ["retainTitlePass", "./passes/retain-titles"], ["retainSmoothingPass", "./passes/retain-smoothing"], ["justifyPasses", "./passes/justify"], ["run", "./run"], ["serialize", "./serialize"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, constants, content, rects, document, LineModels, Geometry, Collision, Tuning, Titles, Clamps, FinalAudit, Formulas, RetainBody, RetainTitles, RetainSmoothing, Justify, Run, Serialize) {
  "use strict";
  const { OBJECT, LINE_SEPARATOR, DEFAULT_CONTENT_AREAS, sourceHanSerifInk, FINAL_AUDIT_OPTIONS } = constants;
  const { defaultContentFor, normalizeDisplayTeX, collapseRuns, textToRuns, htmlToRuns } = content;
  const { gallopingGrow, rectsOverlap, rectUnion, layoutRectsOverlap, horizontalBoxesOverlap } = rects;

  function createModelFitter(config = {}) {
    const measurer = config.measurer;
    if (!measurer || typeof measurer.prepare !== "function" || typeof measurer.layout !== "function") {
      throw new Error("createModelFitter requires a measurer with prepare() and layout()");
    }
    const contentFor = typeof config.contentFor === "function"
      ? config.contentFor
      : defaultContentFor(config.options || {});
    const contentAreas = { ...DEFAULT_CONTENT_AREAS, ...(config.contentAreas || {}) };
    // Optional per-role measurers ({ sans, sansBold }) for faces whose
    // advances differ from the main measurer's; missing roles use `measurer`.
    const roleMeasurers = config.measurers || {};
    // Typography profile. "retain" ports retain-pdf's body font-size and
    // leading rules (typography-retain.js, passes/retain-body.js) on top of the
    // retain line model (Typst cap-height..baseline lines) and ink-on-ink
    // collisions. Anything else keeps the DOM fitter's rules unchanged.
    const typography = config.typography === "retain" ? "retain" : "default";
    const lineModel = typography === "retain" ? "retain" : (config.lineModel === "css" ? "css" : "measurer");
    // "measurer" model: ink extents per line text (em); lines of one node
    // are spaced so that they can never overlap in ink.
    const inkExtents = typeof config.inkExtents === "function" ? config.inkExtents : sourceHanSerifInk;
    // Strict collisions (default with lineModel "measurer"): the DOM rules'
    // tolerances — 1.5 px rect padding, 4.0 / 3.0 shared-edge overhang, the
    // body first-line top exemption, page tolerance 1.5 — absorb the slack of
    // CSS content areas, which are taller than ink. Measurer-model rects are
    // ink, and the Typst output must never overlap, so all of them become 0:
    // every line is tested; inside its own box a line may not touch the ink
    // another node keeps inside that node's box (source boxes can overlap);
    // outside its own box it may touch neither that ink nor the box. Ink that
    // spills out of its node's box is resolved when that node is the source.
    const strict = typography === "retain" ? true : (config.strictCollisions ?? (lineModel === "measurer"));
    const collisionPolicy = typography === "retain" ? "ink" : (strict ? "strict" : "tolerant");
    const pixelRound = config.cssPixelRounding ? (value => Math.ceil(value - 1e-9)) : (value => value);
    // Optional diagnostics: trace(event, details) at every stop decision.
    const trace = typeof config.trace === "function" ? config.trace : null;

    // Justification (passes/justify.js, line models). justifyCap: em of
    // stretch per Typst-justifiable gap a justified line may receive (retain
    // line model; null = unlimited). balanceLines: re-break justified text
    // with balanced breaking after the fit (true / { trigger }, false = off).
    // Both default on for the "retain" profile only: 0.15 em keeps CJK text
    // from reading as letter-spaced (greedy p99 is about 0.23-0.26 em on the
    // two reference jobs, so the cap touches roughly 1-3% of justified lines).
    const justifyCap = config.justifyCap === null ? null
      : Number.isFinite(config.justifyCap) ? Number(config.justifyCap)
        : (typography === "retain" ? 0.15 : null);
    const balanceSetting = config.balanceLines ?? (typography === "retain");
    const balance = balanceSetting ? { ...(typeof balanceSetting === "object" ? balanceSetting : {}) } : null;

    // Everything the parts read from the configuration. No part sees `config`.
    const ctx = Object.freeze({
      measurer, contentFor, contentAreas, roleMeasurers, lineModel, inkExtents, strict, pixelRound, trace,
      typography, collisionPolicy, justifyCap, balance
    });
    const lines = LineModels.createLineModel(ctx);
    const geometry = Geometry.createGeometry(ctx, lines);
    const collision = Collision.createCollision(ctx, geometry);
    const builder = document.createDocumentBuilder(ctx);
    const serializer = Serialize.createSerializer(ctx, geometry);

    function fitDocument(model, fitOptions = {}) {
      const mode = fitOptions.mode === "translation" ? "translation" : "source";
      const state = builder.buildDocument(model, mode);
      runFit(state, fitOptions);
      return serializer.serialize(state, mode);
    }

    // Per-run state: the document, its options and the node scope.
    function runFit(doc, fitOptions) {
      const all = doc.nodes;
      const run = {
        doc,
        fitOptions,
        all,
        scopedNodes: predicate => all.filter(predicate),
        strictSourceFit: Boolean(fitOptions.strictSourceFit)
      };
      const deps = { geometry, collision };
      // Typography profile "retain" only: retain-pdf's body pipeline, and its
      // per-heading sizing (fitOptions.retainTitles: false keeps the DOM rules).
      const retainBody = ctx.typography === "retain" ? RetainBody.createRetainBodyPass(ctx, run, deps) : null;
      const retainTitles = retainBody && fitOptions.retainTitles !== false
        ? RetainTitles.createRetainTitlePass(ctx, run, { ...deps, retainBody }) : null;
      // retain-pdf's neighbour-consistency stages (fitOptions.retainSmoothing:
      // false skips them).
      const retainSmoothing = retainBody && fitOptions.retainSmoothing !== false
        ? RetainSmoothing.createRetainSmoothingPass(ctx, run, { ...deps, retainBody }) : null;
      Run.runFit(run, {
        tuning: Tuning.createTuning(ctx, run, deps),
        titles: Titles.createTitlePasses(ctx, run, deps),
        clamps: Clamps.createClampPasses(ctx, run, deps),
        finalAudit: FinalAudit.createFinalAuditPass(ctx, run, deps),
        formulas: Formulas.createFormulaPasses(ctx, run, deps),
        retainBody,
        retainTitles,
        retainSmoothing,
        justify: ctx.balance ? Justify.createJustifyPasses(ctx, run, deps) : null
      });
    }

    return { fitDocument };
  }

  return {
    createModelFitter,
    defaultContentFor,
    FINAL_AUDIT_OPTIONS,
    OBJECT,
    LINE_SEPARATOR,
    // Pure helpers exposed for unit tests; not a stable API.
    _internal: { normalizeDisplayTeX, gallopingGrow, rectsOverlap, rectUnion, layoutRectsOverlap, horizontalBoxesOverlap, collapseRuns, textToRuns, htmlToRuns }
  };
});
