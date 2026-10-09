# src/fit-model

The data fitter: the rule set of `src/fit.js` (`runLayoutParityEngine`,
`fitLayoutFormulas`, `fitLayoutPages`) run on a layout model instead of a DOM.
`src/fit-model.js` is the public entry (`createModelFitter`,
`defaultContentFor`, …) and documents the behaviour and the deviations from the
DOM fitter; this directory holds the implementation.

## Modules

| File | Lines | Responsibility |
|---|---|---|
| `constants.js` | 88 | CSS paddings and ratios the DOM rules rely on, face content areas, ink extents, `FINAL_AUDIT_OPTIONS`. |
| `rects.js` | 113 | Pure rectangle tests and `gallopingGrow`. |
| `content.js` | 215 | Which text a node shows, as measurer runs (`defaultContentFor`). Pure. |
| `document.js` | 344 | Node building from a layout model, node accessors (`layoutControlFontSize`, `applyGroup`, `nodeBox`, …), the `Select` predicates. |
| `typography-retain.js` | 350 | Profile "retain": retain-pdf's constants (each citing its source file) and pure rules — leading blends, density estimate, book target, unify decision, underfill target and limits, formula insets, geometry seeds. |
| `line-models/base.js` | 41 | What both line models share: measuring a paragraph, painted line width. |
| `line-models/measurer.js` | 94 | Typst geometry with ink-safe line spacing (what the Typst output paints). |
| `line-models/css.js` | 102 | CSS line boxes around the measurer's breaks (what a browser measures). |
| `line-models/retain.js` | 132 | Typography profile "retain": Typst cap-height..baseline lines, leading in em, a fit band separate from the ink, retain-pdf's formula insets and the first-line ink floor. |
| `line-models/index.js` | 29 | Picks the line model from `ctx.lineModel`. |
| `geometry.js` | 357 | Per-node geometry (lines, glyph rects, formula and code boxes), strict barriers, the geometry caches. |
| `collision.js` | 213 | `textCollisionDetails` (one scan, strict or tolerant policy), `measureGroup`, `wouldCollideWithBlocks`. |
| `tuning.js` | 308 | `tuneNodes`, the body's second iteration, `capBodyNodes`, `tuneGroup` / `tuneEach`, inherited-body sync. |
| `passes/titles.js` | 178 | False single-line demotion, underfilled titles, title size clusters, short titles on one line. |
| `passes/clamps.js` | 87 | Overflow clamps for translated references and code frames. |
| `passes/final-audit.js` | 134 | The final glyph-level collision audit. |
| `passes/formulas.js` | 178 | Formula shrink/expand and equation-number alignment. |
| `passes/retain-body.js` | 843 | Profile "retain": retain-pdf's body pipeline (seed blend, leading, block fit, book-target unify, underfill grow / harmonize / recover) with the ink safety net. |
| `passes/retain-titles.js` | 102 | Profile "retain": every heading sized on its own box like retain-pdf's solve_title_fit (fill cap, 0.94 × box band, title/heading leading), backed off to 0.72 / 0.78 × after the body settles. On by default (`fitOptions.retainTitles: false` keeps the DOM title rules). |
| `passes/retain-smoothing.js` | 307 | Profile "retain": retain-pdf's neighbour-consistency stages run inside the body pass — short-body inheritance, page body anchor, long-paragraph harmonizing, adjacent smoothing. On by default (`fitOptions.retainSmoothing: false` skips them). |
| `passes/justify.js` | 82 | Post-fit balanced breaking of justified text, kept only if line count, vertical extents and collision state are unchanged (`config.balanceLines`, default on in "retain"). |
| `run.js` | 190 | The pass order with its option sets — the recipe. |
| `serialize.js` | 92 | The result as plain data. |
| `index.js` | 109 | `createModelFitter`: builds `ctx`, wires the parts. |

## Dependencies

Module-level (`DEPENDENCIES` in each file's header; `←` lists what each
module loads). Every part is a leaf except `index`, which wires them:

```
constants              (none)
rects                  (none)
content                (none)
document               ← constants
line-models/base       (none)
line-models/measurer   ← line-models/base
line-models/css        ← line-models/base
typography-retain      (none)
line-models/retain     ← line-models/base, typography-retain
line-models/index      ← line-models/measurer, line-models/css, line-models/retain
geometry               ← constants, rects, document
collision              ← rects
tuning                 ← rects, document
passes/titles          ← rects, document
passes/clamps          ← document
passes/final-audit     ← constants, document
passes/formulas        ← rects, document
passes/retain-body     ← document, typography-retain
passes/retain-titles   ← document              (+ retain-body helpers at run time)
passes/retain-smoothing ← document, typography-retain (+ retain-body helpers at run time)
passes/justify         ← constants
run                    ← document
serialize              ← document
index                  ← constants, content, rects, document, line-models/index, geometry, collision, tuning, passes/titles, passes/clamps, passes/final-audit, passes/formulas, passes/retain-body, passes/retain-titles, passes/retain-smoothing, passes/justify, run, serialize
```

Object-level (who receives what at runtime):

```
createModelFitter(config)
  ctx (frozen) ───────────────────────────────────────────────┐
  lines      = createLineModel(ctx)                           │
  geometry   = createGeometry(ctx, lines)          per fitter  │ ctx
  collision  = createCollision(ctx, geometry)                 │
  builder    = createDocumentBuilder(ctx)                     │
  serializer = createSerializer(ctx, geometry)                │
  fitDocument(model, fitOptions)                              │
    run = { doc, fitOptions, all, scopedNodes, strictSourceFit }
    tuning / titles / clamps / finalAudit / formulas = create…(ctx, run, { geometry, collision })
    retainBody = createRetainBodyPass(ctx, run, …)      (typography "retain" only)
    runFit(run, { tuning, titles, clamps, finalAudit, formulas, retainBody })   ← run.js
```

Rules (checked by `test/fit-model-modules.test.js`): a part resolves other
parts only in its header; no part except `index.js` reads `config`; only
`index.js` (and `line-models/index.js`) create parts; nothing references a
host (DOM, Zotero, LitMTrans).

## ctx and run

`ctx` is created once per fitter and frozen: `measurer`, `roleMeasurers`,
`contentFor`, `contentAreas`, `lineModel` (`"measurer"`, `"css"` or
`"retain"`), `inkExtents`, `strict` (strict collisions), `pixelRound`, `trace`,
`typography` (`"default"` or `"retain"`), `collisionPolicy` (`"strict"`,
`"tolerant"` or `"ink"`), `justifyCap` (em per justifiable gap or null),
`balance` (balanced-breaking settings or null).

`run` is created per `fitDocument` call: `doc` (pages, nodes, mode),
`fitOptions`, `all` (`doc.nodes`), `scopedNodes(predicate)`,
`strictSourceFit`.

The geometry caches live on the geometry part, so they persist for the
fitter's lifetime (as before the split).

## Node fields written during a fit

Nodes are plain objects built by `document.js`. Besides their source fields
the fit writes:

- `style.fontSize`, `style.lineRatio`, `style.width`, `style.nowrap` — the
  applied style (`applyGroup`, title passes).
- `fit` (stop reason, limiter, blocker), `fitLabel` — diagnostics.
- `fontCap`, `lineRatioCap` — per-paragraph body caps (`bodyNodeFontCaps`).
- `originalLines`, `singleLineAlign` — changed by the false single-line demotion.
- `shortTitleNoWrap`, `codeFit`, `userBodyFontPt` — pass results.
- `baseFont`, `lineRatio` — rewritten by the clamps.
- `formula.scale`, `formula.numberRight`, `formula.fitted` — formula passes.
- `_geometryLast`, `_box` — geometry fast-path caches (private to `geometry.js`
  and `document.js`'s `nodeBox`).
- `balanceLines` — balanced breaking accepted by `passes/justify.js` (part of
  the geometry cache key).
- `alignOverride` — set when the node is built (retain: left-aligned main title).
- Profile "retain" only: `retainLeadingEm`, `retainInkFloor` (first-line ink
  floor, part of the geometry cache key), `retainLift` (first line raised into
  free space above, part of the geometry cache key), `retainRegionWidened`
  (short-region expansion; the width itself is `style.width`), `retainDense`
  (dense-small-box flags from the block fit), `retainShortInherited`,
  `retainUnified`, `retainGrewFrom`,
  `retainUnsettled` (scheduled non-body text; read by the ink collision
  policy); `baseFont`, `lineRatio`, `baseLineRatio` are rewritten by its
  prepare step.

## Browser load order

Load as plain scripts (each attaches to
`RetainPdfRendering.FitModelParts`), after `src/render.js` (optional, for
equation tags) and before `src/fit-model.js`:

```
fit-model/constants.js
fit-model/rects.js
fit-model/content.js
fit-model/document.js
fit-model/typography-retain.js
fit-model/line-models/base.js
fit-model/line-models/measurer.js
fit-model/line-models/css.js
fit-model/line-models/retain.js
fit-model/line-models/index.js
fit-model/geometry.js
fit-model/collision.js
fit-model/tuning.js
fit-model/passes/titles.js
fit-model/passes/clamps.js
fit-model/passes/final-audit.js
fit-model/passes/formulas.js
fit-model/passes/retain-body.js
fit-model/passes/retain-titles.js
fit-model/passes/retain-smoothing.js
fit-model/passes/justify.js
fit-model/run.js
fit-model/serialize.js
fit-model/index.js
fit-model.js
```

A part loaded before one of its dependencies throws an error naming the file
to load first.

## Changing the fitter

Behaviour-preserving changes (refactors) should leave
`scripts/fit-model-equivalence.js` byte-identical:

```
node scripts/fit-model-equivalence.js generate /tmp/before [--large FILE] [--job DIR]...
# change code
node scripts/fit-model-equivalence.js check /tmp/before [--large FILE] [--job DIR]...
```

## Typography profile "retain"

`createModelFitter({ …, typography: "retain" })` replaces the DOM fitter's
one-shared-body-font group with retain-pdf's body rules
(`retainpdf_pipeline/render/layout`, FONT_UNIFY_MODE "role_min"); every other
option keeps its meaning. Without the switch nothing changes
(`scripts/fit-model-equivalence.js` stays at zero differences).

What the switch selects:

- **Line model `retain`** — Typst default edges (top-edge cap-height,
  bottom-edge baseline): a line is cap height tall, lines sit cap height +
  leading apart, `lineRatio = capHeight + leading_em`. Each line reports a fit
  band (the Typst line box) and its real ink. Blocks with formulas get
  retain-pdf's content insets (`formula_safety`).
- **Ink collisions** — text may run past its box (retain-pdf renders unified
  body paragraphs without a box check), but never onto another node's ink,
  a preserved element, the page edge, or into another text box of the same
  column (a line band outside its box may enter such a box by ≤ 1 pt).
- **`passes/retain-titles.js`** (before the body pass): every heading sized
  on its own box like `solve_title_fit` (fill cap, band ≤ 0.94 × box height,
  title / heading leading); after the body pass, backed off in 0.25 pt steps
  down to 0.72 × / 0.78 × where its ink still touches something. Titles are
  measured with `measurers.bold` when the host provides it and serialized
  with `fontWeight: "bold"`; the main title is left-aligned.
- **`passes/retain-body.js`**, in place of the body group and the DOM
  non-body passes of `run.js`:
  1. prepare: short-region expansion (`_apply_short_body_region_expansion`:
     a short, narrow non-body text item under two same-column body anchors is
     widened by up to 30% of its width, never past the anchors; the 5% top
     lift is not ported because box tops are fixed;
     `fitOptions.retainRegionExpansion: false` skips it), seed blend
     (`estimate_font_size_pt`: 86% page baseline, 42nd percentile,
     pitch-scaled; 14% block; clamp 8.4–14.2), body and non-body leading
     (`estimate_leading_em`), first-line ink floors;
  2. schedule non-body text (`fit_translated_block_metrics`, non-body
     branch). These nodes are *unsettled* until step 7: for others they block
     only with the ink inside their own box;
  3. body block fit — retain-pdf's own `fit_translated_block_metrics`
     (character-unit demand vs `box_capacity_units`, dense_small_box flags,
     aggressive gate before the emergency floor; `fitOptions.
     retainFaithfulSchedule: false` restores the earlier density
     approximation);
  4. short-body inheritance (`inherit_short_body_fonts`, passes/retain-smoothing.js),
     then unify to the book target (25th percentile of stable anchors);
  5. underfill grow → harmonize → recover; page body anchor → long-paragraph
     harmonizing → adjacent smoothing (passes/retain-smoothing.js); unify
     again → recover again. This is body_pipeline.py's order under
     FONT_UNIFY_MODE "role_min": the second unify raises eligible paragraphs
     back to the book target, so the page anchor and adjacent smoothing
     change little where unify applies (as in retain-pdf);
  6. annotation fonts (`unify_annotation_fonts` + the body cap: caption ≤
     0.88 ×, footnote ≤ 0.82 × the body median);
  7. non-body safety net.
  Every size or leading a rule asks for is checked against the ink collision
  test. On failure: a first line touched by ink from above gets a lower ink
  floor; ink reaching the node below first pushes that node's first line
  down, then lifts this node's first line into free space above (each at most
  0.5 em of the moved node and 40% of its box, and only if everything still
  passes; `fitOptions.retainPushLowerFirstLine: false` skips both — not
  retain-pdf rules, which would overprint here); then leading is given back
  down to `BODY_/NON_BODY_LEADING_MIN`
  (`fitOptions.retainLeadingFirstRepair: false` skips this); then the font
  shrinks to the largest size that passes.
- **Justification** (retain profile defaults): the retain line model paints a
  justified line at most `natural + gaps × justifyCap` wide (0.15 em per
  Typst-justifiable gap — spaces and CJK characters; a line without such a
  gap is not justified), and `passes/justify.js` re-breaks justified text
  with balanced breaking after the fit, keeping it only if the line count,
  every line's vertical extent and the collision state are unchanged
  (`config.justifyCap`, `config.balanceLines`).

Not ported from retain-pdf: low-height body inheritance (it only sets a
reference size), `relax_short_body_context_heights`, comfort leading, the
leading refit after unify, the body tight-gap inset of
`build_effective_inner_bboxes`, the annotation underfill growth, typography
memory. Approximated in the smoothing stages: `prefer_typst_fit` and
continuation groups are not modelled (treated as false / none).

`fitOptions.retainBandFit: true` additionally keeps each body band inside its
box (Typst `measure() <= fit_height`); retain-pdf itself does not require this.

Densities use retain-pdf's estimate (`lines × fs × max(1.02, 1 + leading) ×
formula discount / box height`) with the real line count instead of its
character-unit estimate, so its thresholds (0.60, 0.80, 0.98, 1.08, 1.18)
keep their calibration.

Dense blocks use retain-pdf's own `is_dense_small_box` /
`is_heavy_dense_small_box` (block_seed_body_policy: translation density ratio,
layout density and page box area), ported as `denseSmallBox` /
`heavyDenseSmallBox` in typography-retain.js and applied by the block-fit
schedule in passes/retain-body.js.

First-line nudges (push the paragraph below down, or lift this one into free
space above, before shrinking) move a first line by at most 0.5 em of that
paragraph's size, measured from where its ink sits without the nudge; the
`retainTrace` events `push-lower` / `lift` report the geometry-measured
movement (`moved`), which test/retain-nudge.test.js checks against the cap.

Not ported: low-height body inheritance, `relax_short_body_context_heights`,
`restore_comfort_body_leading`, `refit_body_leading_after_font_unify`,
`annotate_tall_body_density_heights`,
compactness / formula-ratio inputs of the leading blend (0 unless a host
supplies them), typography memory.

