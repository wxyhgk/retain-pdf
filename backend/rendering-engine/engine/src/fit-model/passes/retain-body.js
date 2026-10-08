// retain-pdf-rendering/fit-model/passes/retain-body.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Body text under the "retain" typography profile: retain-pdf's body pipeline
// (render/layout/payload/body_pipeline.py with FONT_UNIFY_MODE "role_min"),
// replacing the DOM fitter's one-shared-body-font group. Per body paragraph:
//
//   1. seed      source size, leading from leading_fit.estimate_leading_em
//   2. block fit largest size <= seed whose Typst band fits the box
//                (fit_translated_block_metrics + pdftr_fit_markdown)
//   3. unify     book body target = 25th percentile of stable anchors
//                (body_font_unify_policy, resolve_book_body_font_target)
//   4. underfill grow -> harmonize -> recover (body_font_underfill_policy)
//   5. unify again, recover again (the second half of the role_min order)
//
// Our addition, the safety net: every size or leading a rule asks for is
// accepted only if the paragraph's band still fits its box (the test
// retain-pdf's Typst measure() makes) and none of its ink touches another
// node's ink or the page edge; otherwise the largest value in between that
// passes is used. Stages of retain-pdf's pipeline that are not ported are
// listed in src/fit-model/README.md.
(function (root, factory) {
  "use strict";
  const NAME = "retainBodyPass";
  const DEPENDENCIES = [["document", "../document"], ["typographyRetain", "../typography-retain"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, document, typography) {
  "use strict";
  const { isStream, isBlock, nodeBox, layoutControlFontSize, effectiveLineRatio } = document;
  const T = typography;
  const R = T.RETAIN;
  const CAP_HEIGHT = 0.729;
  const FONT_STEP = 0.05;     // pdftr_fit_size eps 0.08pt, on a 0.05 grid
  const MIN_FONT = 4.8;
  const INK_CLEARANCE = 0.05; // pt kept between a first line's ink and what is above
  // Largest first-line nudge (lift into space above / push of the node below)
  // the safety net may use, in em of the moved node: enough for a formula's
  // depth or a descender bridging a tight gap, small enough that text stays
  // where the source put it.
  const NUDGE_MAX_EM = 0.5;

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function createRetainBodyPass(ctx, run, deps) {
    const { geometry, collision } = deps;
    const { measureTextBand } = geometry;
    const capHeight = Number(ctx.measurer?.metrics?.capHeight) > 0 ? Number(ctx.measurer.metrics.capHeight) : CAP_HEIGHT;
    const COLLIDE = Object.freeze({ includeGroupPeers: true, avoidPageOverflow: true, checkAllTextForCollisions: true });

    const isBodyNode = node => isStream(node) && node.styleKind === "body_text" && node.flowKind === "text";
    const isNonBodyText = node => (isStream(node) && !isBodyNode(node) && !node.toc) ||
      (isBlock(node) && node.type !== "title" && node.layoutKind !== "formula" && node.content && Array.isArray(node.content.paragraphs) && !node.content.opaque);

    const leadingOf = node => Math.max(0, effectiveLineRatio(node) - capHeight);
    // Optional diagnostics: fitOptions.retainTrace(nodeId, stage, data).
    const traceFn = typeof run.fitOptions.retainTrace === "function" ? run.fitOptions.retainTrace : null;
    const trace = (node, stage, data) => { if (traceFn) traceFn(node.id, stage, { font: layoutControlFontSize(node), ratio: effectiveLineRatio(node), ...data }); };
    const ratioFor = leadingEm => Number((capHeight + leadingEm).toFixed(3));

    function setStyle(node, fontSize, lineRatio) {
      node.style.fontSize = Number(fontSize.toFixed(2));
      node.style.lineRatio = Number(lineRatio.toFixed(3));
    }

    // The fit band (Typst line boxes, plus the formula bottom inset) inside
    // the box, exactly as pdftr_fit_markdown's measure() <= fit_height.
    function bandFits(node) {
      const box = nodeBox(node);
      const band = measureTextBand(node);
      return !band.hasText || band.lastBottom <= (box.bottom - box.top) + 1e-6;
    }

    // retain-pdf renders most body paragraphs at the size its estimates chose
    // without checking the box (unified bodies are not fit_to_box), so text
    // may run past its box into free space. The safety net is the ink test:
    // no contact with another node's ink, a preserved element or the page
    // edge. fitOptions.retainBandFit additionally requires the Typst band to
    // stay inside the box (pdftr_fit_markdown's measure() <= fit_height).
    const requireBand = Boolean(run.fitOptions.retainBandFit);
    function passes(node) {
      return (!requireBand || bandFits(node)) && !collision.textCollisionDetails([node], COLLIDE);
    }

    function passesAt(node, fontSize, lineRatio) {
      const saved = { fontSize: node.style.fontSize, lineRatio: node.style.lineRatio };
      setStyle(node, fontSize, lineRatio);
      const ok = passes(node);
      node.style.fontSize = saved.fontSize;
      node.style.lineRatio = saved.lineRatio;
      return ok;
    }

    // Largest value on a grid in [low, high] for which `ok` holds, assuming
    // `ok(low)`; bisects (monotonic in practice), then checks one step up.
    function largestPassing(low, high, step, ok) {
      if (high <= low + 1e-9) return low;
      let lo = 0;
      let hi = Math.floor((high - low) / step + 1e-9);
      if (ok(low + hi * step)) return low + hi * step;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ok(low + mid * step)) lo = mid;
        else hi = mid;
      }
      return low + lo * step;
    }

    // Set a node to a requested size, or to the largest size between its
    // current one and the request that passes; returns the size applied.
    function raiseFontSafely(node, target) {
      const current = layoutControlFontSize(node);
      const ratio = effectiveLineRatio(node);
      if (target <= current + 1e-9) {
        setStyle(node, target, ratio);
        return target;
      }
      const best = largestPassing(current, target, FONT_STEP, value => passesAt(node, value, ratio));
      setStyle(node, best, ratio);
      return best;
    }

    // ----- per-node facts -----

    const facts = new Map();
    function factsOf(node) {
      let entry = facts.get(node);
      if (entry) return entry;
      const box = nodeBox(node);
      const paragraphs = (node.content && node.content.paragraphs) || [];
      const formulas = [];
      let tokenCount = 0;
      for (const paragraph of paragraphs) {
        for (const runItem of paragraph?.prepared?.content || []) {
          if (runItem.type === "math") { formulas.push(String(runItem.tex || "")); tokenCount += 1; }
          else if (runItem.type === "text") {
            // retain-pdf tokenize_text: a CJK character, a word, a space run,
            // or any other character.
            tokenCount += (String(runItem.text || "").match(/[一-鿿]|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|\s+|[^\s]/g) || []).length;
          }
        }
      }
      const source = node.source || {};
      const item = (source.items || [])[0] || {};
      const sourceLines = Math.max(0, Number(item.originalLineCount || source.lineCount || node.originalLinesSeed?.originalLineCount || 0));
      const height = box.bottom - box.top;
      const seed = Number(node.baseFont) || 8;
      // Source line pitch: given by the host (sourceLinePitch on the stream or
      // block), else derived from an ink-band box: (n - 1) pitches plus about
      // 1.15 em of ink for the first and last line.
      let sourcePitch = Number(source.sourceLinePitch || item.sourceLinePitch || 0);
      if (!(sourcePitch > 0) && sourceLines >= 2) sourcePitch = Math.max(0, (height - 1.15 * seed) / (sourceLines - 1));
      entry = {
        box, width: box.right - box.left, height, sourceLines, sourcePitch, seed,
        formulaDiscount: T.formulaEstimateDiscount(tokenCount, formulas)
      };
      facts.set(node, entry);
      return entry;
    }

    function lineCount(node) {
      return Math.max(1, geometry.geometry(node).lines.length);
    }

    // retain-pdf payload_density for the node's current (or a probed) style.
    function density(node, fontSize = layoutControlFontSize(node), leadingEm = leadingOf(node)) {
      const fact = factsOf(node);
      let lines;
      if (fontSize === layoutControlFontSize(node) && Math.abs(ratioFor(leadingEm) - effectiveLineRatio(node)) < 1e-6) {
        lines = lineCount(node);
      }
      else {
        const saved = { fontSize: node.style.fontSize, lineRatio: node.style.lineRatio };
        setStyle(node, fontSize, ratioFor(leadingEm));
        lines = lineCount(node);
        node.style.fontSize = saved.fontSize;
        node.style.lineRatio = saved.lineRatio;
      }
      return T.estimatedDensity({ lines, fontSize, leadingEm, boxHeight: fact.height, formulaDiscount: fact.formulaDiscount });
    }

    // ----- page context -----

    function pageTextWidthMedian(page) {
      return median(page.nodes.filter(node => isStream(node) || (isBlock(node) && node.type === "text")).map(node => {
        const box = nodeBox(node);
        return box.right - box.left;
      }));
    }

    // body_common.body_context_anchors
    function contextAnchors(nodes, widthMed) {
      return nodes.filter(node => factsOf(node).width >= Math.max(1, widthMed * R.BODY_CONTEXT_ANCHOR_MIN_WIDTH_RATIO) &&
        factsOf(node).height >= R.BODY_CONTEXT_ANCHOR_MIN_HEIGHT_PT);
    }

    // body_font_unify_policy._is_book_target_candidate (the stable-anchor test)
    function isStableAnchor(node, widthMed) {
      const fact = factsOf(node);
      return fact.width >= Math.max(1, widthMed * R.BODY_FONT_UNIFY_ANCHOR_MIN_WIDTH_RATIO) &&
        fact.height >= R.BODY_FONT_UNIFY_ANCHOR_MIN_HEIGHT_PT &&
        density(node) <= R.BODY_FONT_UNIFY_ANCHOR_MAX_DENSITY;
    }

    function anchorScore(node) {
      const fact = factsOf(node);
      const text = (node.content?.paragraphs || []).map(paragraph => paragraph.text || "").join("").trim();
      return fact.height * 2.0 + fact.width * 0.25 + Math.min(180, text.length);
    }

    // _stable_body_font_anchors: the two best-scoring stable paragraphs, else
    // the page's context anchors.
    function stableAnchors(nodes, widthMed) {
      const candidates = nodes.filter(node => isStableAnchor(node, widthMed));
      if (candidates.length >= R.BODY_FONT_UNIFY_ANCHOR_COUNT) {
        return candidates.sort((a, b) => anchorScore(b) - anchorScore(a)).slice(0, R.BODY_FONT_UNIFY_ANCHOR_COUNT);
      }
      return contextAnchors(nodes, widthMed);
    }

    function pages(bodyNodes) {
      const byPage = new Map();
      for (const node of bodyNodes) {
        if (!byPage.has(node.page)) byPage.set(node.page, []);
        byPage.get(node.page).push(node);
      }
      return [...byPage.entries()].map(([page, nodes]) => ({ page, nodes, widthMed: pageTextWidthMedian(page) }));
    }

    // ----- 1 + 2: seed and block fit -----

    // payload/fit_metrics.fit_translated_block_metrics for body paragraphs:
    // lift the seed to page body size - 0.12; keep it while the estimate says
    // the text fits (density <= 0.96); else step down 0.12 pt (one step, two
    // for dense blocks), then emergency 0.14 pt steps at leading - 0.01 to a
    // floor of page body - 0.7 (>= 8.2). Density is the retain-pdf estimate
    // with the real line count. Afterwards the safety net may shrink further.
    function retainSchedule(node, pageBody) {
      const fact = factsOf(node);
      let font = fact.seed;
      if (pageBody > 0) font = Math.round(Math.max(font, pageBody - 0.12) * 100) / 100;
      const leadingEm = leadingOf(node);
      if (density(node, font, leadingEm) <= 0.96) return { font, leadingEm };
      const dense = density(node, font, leadingEm) >= R.BODY_FONT_UNIFY_GROW_DENSITY_LIMIT;
      const minFont = Math.max(dense ? 8.45 : 8.75, pageBody > 0 ? pageBody - 0.18 : 0);
      let best = font;
      for (let step = 1; step <= (dense ? 2 : 1); step++) {
        const candidate = Math.round(Math.max(minFont, font - step * 0.12) * 100) / 100;
        if (density(node, candidate, leadingEm) <= 0.98) return { font: candidate, leadingEm };
        best = candidate;
      }
      const emergencyLeading = Math.round(Math.max(dense ? 0.54 : 0.56, leadingEm - 0.01) * 100) / 100;
      const emergencyMin = Math.max(dense ? 7.8 : 8.2, pageBody > 0 ? pageBody - 0.7 : 0);
      for (let step = 1; step < (dense ? 8 : 5); step++) {
        const candidate = Math.round(Math.max(emergencyMin, best - step * 0.14) * 100) / 100;
        if (density(node, candidate, emergencyLeading) <= 0.98) return { font: candidate, leadingEm: emergencyLeading };
        if (step === (dense ? 7 : 4)) return { font: candidate, leadingEm: emergencyLeading };
      }
      return { font: best, leadingEm: emergencyLeading };
    }

    // fitOptions.retainFaithfulSchedule: retain-pdf's own block fit
    // (fit_metrics.fit_translated_block_metrics with character-unit demand vs
    // capacity, dense_small_box flags and the aggressive_fit gate before the
    // emergency floor), preceded by block_seed_body_policy.adjust_body_seed_font_size.
    // Body (isBody) adds the page-body seed adjustment; non-body text uses the
    // non-body branch of fit_translated_block_metrics on its own seed.
    function retainScheduleFaithful(node, pageBody, isBody = true) {
      const fact = factsOf(node);
      const source = node.source || {};
      const item = (source.items || [])[0] || source;
      const sourceText = String(item.text || "");
      const translatedText = String(item.translatedText || "");
      const leadingEm = leadingOf(node);
      const seed = fact.seed;
      const pageArea = Math.max(1, Number(node.page?.width || 0) * Number(node.page?.height || 0));
      const pageBoxAreaRatio = fact.width * fact.height / pageArea;
      const seedStep = Math.max(seed * 1.02, seed * (1 + leadingEm));
      const layoutDensity = T.layoutDensityRatio({ width: fact.width, height: fact.height, text: translatedText, fontSize: seed, lineStep: seedStep });
      const densityRatio = T.translationDensityRatio(sourceText, translatedText);
      const denseSmall = T.denseSmallBox({ densityRatio, layoutDensity, pageBoxAreaRatio });
      const heavyDenseSmall = T.heavyDenseSmallBox({ densityRatio, layoutDensity, pageBoxAreaRatio });
      let font = seed;
      if (isBody && pageBody > 0) {
        const down = heavyDenseSmall ? 0.34 : (denseSmall ? 0.2 : 0.06);
        const up = denseSmall ? 0.18 : 0.24;
        font = Math.round(Math.min(Math.max(font, pageBody - down), pageBody + up) * 100) / 100;
        if (denseSmall) font = Math.min(font, heavyDenseSmall ? 10.2 : 10.35);
      }
      const decided = T.fitTranslatedBlockMetrics({
        isBody, fontSize: font, leadingEm, pageBodyFont: isBody ? pageBody : 0, width: fact.width, height: fact.height,
        visualLines: Math.max(1, fact.sourceLines || 1), sourceText, translatedText, denseSmall, heavyDenseSmall
      });
      return { ...decided, denseSmall, heavyDenseSmall, seedAdjusted: font };
    }

    // block_seed_metrics: page body size = 46th percentile of the page's body
    // seeds, at least page font - 0.38.
    function pageBodyFonts(bodyNodes) {
      const result = new Map();
      for (const group of pages(bodyNodes)) {
        const seeds = group.nodes.map(node => factsOf(node).seed);
        const pageFont = percentile(seeds, R.PAGE_BASELINE_PERCENTILE);
        const body = Math.max(percentile(seeds, 0.46), pageFont - 0.38);
        for (const node of group.nodes) result.set(node, Math.round(body * 100) / 100);
      }
      return result;
    }

    // Safety net: when the ink of a node above (its descenders, or text it
    // ran past its box) reaches this node's first line, lower the ink floor to
    // below that ink rather than shrinking, which would barely move the first
    // line. The inset is bounded to 40% of the box height; the text may then
    // run past its box.
    function settleFirstLine(node) {
      for (let round = 0; round < 3; round++) {
        const hit = collision.textCollisionDetails([node], COLLIDE);
        if (!hit || !hit.blocker || !hit.rect) return;
        const own = nodeBox(node);
        const rects = geometry.textRectsInPage(node);
        const firstTop = Math.min(...rects.map(rect => rect.top));
        if (hit.rect.top > firstTop + 1e-6 || !(nodeBox(hit.blocker).top < own.top)) return;
        const above = geometry.renderedContentRectsInPage(hit.blocker)
          .filter(rect => Math.min(rect.right, own.right) - Math.max(rect.left, own.left) > 0 && rect.bottom > firstTop)
          .reduce((bottom, rect) => Math.max(bottom, rect.bottom), -Infinity);
        if (!Number.isFinite(above)) return;
        const floor = above - own.top + INK_CLEARANCE;
        if (floor > (own.bottom - own.top) * 0.4 || floor <= (node.retainInkFloor ?? -Infinity) + 1e-6) return;
        node.retainInkFloor = floor;
      }
    }

    // Safety net, the counterpart of settleFirstLine: when this node's ink
    // reaches the first line of a text node directly below (tight stacks such
    // as exercise lists, where an inline formula's depth or a descender bridges
    // a 1-2 pt gap), lower that node's first-line ink floor instead of
    // shrinking this one, by at most NUDGE_MAX_EM and within the same
    // 40%-of-box bound, and only if the node below still passes afterwards. Returns true when it helped.
    function pushLowerFirstLine(node) {
      let moved = false;
      for (let round = 0; round < 3; round++) {
        const hit = collision.textCollisionDetails([node], COLLIDE);
        if (!hit || !hit.blocker || !hit.rect) return moved;
        const lower = hit.blocker;
        if (lower.retainUnsettled || !(isBodyNode(lower) || isNonBodyText(lower))) return moved;
        const own = nodeBox(node);
        const below = nodeBox(lower);
        if (!(below.top > own.top)) return moved;
        const lowerRects = geometry.textRectsInPage(lower);
        if (!lowerRects.length) return moved;
        const lowerFirstTop = Math.min(...lowerRects.map(rect => rect.top));
        if (hit.rect.bottom < lowerFirstTop - 1e-6) return moved;
        const inkBottom = geometry.renderedContentRectsInPage(node)
          .filter(rect => Math.min(rect.right, below.right) - Math.max(rect.left, below.left) > 0)
          .reduce((bottom, rect) => Math.max(bottom, rect.bottom), -Infinity);
        if (!Number.isFinite(inkBottom)) return moved;
        const floor = inkBottom - below.top + INK_CLEARANCE;
        const previous = lower.retainInkFloor;
        // The cap applies to how far the first line actually moves: measure
        // from where its ink sits without any floor (CJK ink rises a little
        // above the box top, so counting from the box top would under-count).
        if (previous !== undefined) delete lower.retainInkFloor;
        const naturalOffset = Math.min(...geometry.textRectsInPage(lower).map(rect => rect.top)) - below.top;
        if (previous !== undefined) lower.retainInkFloor = previous;
        const pushBy = floor - naturalOffset;
        if (floor > (below.bottom - below.top) * 0.4 || pushBy > layoutControlFontSize(lower) * NUDGE_MAX_EM ||
            floor <= (previous ?? -Infinity) + 1e-6) return moved;
        lower.retainInkFloor = floor;
        if (!passes(lower)) {
          if (previous === undefined) delete lower.retainInkFloor;
          else lower.retainInkFloor = previous;
          return moved;
        }
        moved = true;
        if (traceFn) trace(node, "push-lower", { lower: lower.id, floor, pushBy, moved: measuredNudge(lower, "retainInkFloor"), cap: layoutControlFontSize(lower) * NUDGE_MAX_EM });
      }
      return moved;
    }

    // Diagnostics only: how far `field` (retainInkFloor / retainLift) moved the
    // node's first-line ink, measured from the geometry with and without it
    // (independent of the cap arithmetic above; positive = moved down).
    function measuredNudge(node, field) {
      const firstInkTop = () => Math.min(...geometry.textRectsInPage(node).map(rect => rect.top));
      const value = node[field];
      const after = firstInkTop();
      delete node[field];
      const natural = firstInkTop();
      if (value !== undefined) node[field] = value;
      return after - natural;
    }

    // Safety net: when this node's ink reaches the node below and there is
    // free space above it, start its first line higher (retainLift, at most
    // NUDGE_MAX_EM and 40% of the box height, never closer than INK_CLEARANCE
    // to anything above) instead of shrinking it. The smallest lift that passes is used.
    function liftIntoSpaceAbove(node) {
      if (Number.isFinite(Number(node.retainInkFloor))) return false;
      const hit = collision.textCollisionDetails([node], COLLIDE);
      if (!hit || !hit.blocker || !(nodeBox(hit.blocker).top > nodeBox(node).top)) return false;
      const own = nodeBox(node);
      const rects = geometry.textRectsInPage(node);
      if (!rects.length) return false;
      const firstTop = Math.min(...rects.map(rect => rect.top));
      let aboveBottom = 0;
      for (const other of node.page.nodes) {
        if (other === node) continue;
        for (const rect of geometry.renderedContentRectsInPage(other)) {
          if (Math.min(rect.right, own.right) - Math.max(rect.left, own.left) <= 0) continue;
          if (rect.top >= firstTop) continue;
          aboveBottom = Math.max(aboveBottom, rect.bottom);
        }
      }
      const maxLift = Math.min(firstTop - aboveBottom - INK_CLEARANCE, (own.bottom - own.top) * 0.4, layoutControlFontSize(node) * NUDGE_MAX_EM);
      if (!(maxLift > 0.05)) return false;
      const tryLift = value => {
        node.retainLift = value;
        return passes(node);
      };
      if (!tryLift(maxLift)) { delete node.retainLift; return false; }
      let low = 0;
      let high = maxLift;
      for (let i = 0; i < 8; i++) {
        const middle = (low + high) / 2;
        if (tryLift(middle)) high = middle;
        else low = middle;
      }
      node.retainLift = Math.round(high * 1000) / 1000;
      if (!passes(node)) node.retainLift = maxLift;
      if (traceFn) trace(node, "lift", { lift: node.retainLift, maxLift, moved: -measuredNudge(node, "retainLift"), cap: layoutControlFontSize(node) * NUDGE_MAX_EM });
      return true;
    }

    // Profile defaults: retain-pdf's own block fit and leading-first repair
    // (fitOptions.retainFaithfulSchedule / retainLeadingFirstRepair: false
    // restore the earlier approximations).
    const faithfulSchedule = run.fitOptions.retainFaithfulSchedule !== false;
    const leadingFirstRepair = run.fitOptions.retainLeadingFirstRepair !== false;
    const pushLowerFirst = run.fitOptions.retainPushLowerFirstLine !== false;

    // The safety net after a scheduled size failed: first the first-line ink
    // floor; then, like retain-pdf's emergency path, give back leading (down
    // to minLeadingEm) before font size, then shrink the font at that leading.
    function repairToPass(node, font, ratio, leadingEm, minLeadingEm) {
      if (passes(node)) return;
      settleFirstLine(node);
      if (passes(node)) return;
      if (pushLowerFirst && pushLowerFirstLine(node) && passes(node)) return;
      if (pushLowerFirst && liftIntoSpaceAbove(node) && passes(node)) return;
      let repairRatio = ratio;
      if (leadingFirstRepair) {
        const tight = ratioFor(Math.min(leadingEm, minLeadingEm));
        if (tight < ratio - 1e-9 && passesAt(node, font, tight)) {
          const steps = Math.round((ratio - tight) / 0.01);
          let lo = 0, hi = steps; // largest ratio = tight + k*0.01 that passes
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (passesAt(node, font, tight + mid * 0.01)) lo = mid; else hi = mid; }
          setStyle(node, font, tight + lo * 0.01);
          if (traceFn) trace(node, "leading-repair", { from: ratio, to: tight + lo * 0.01 });
          return;
        }
        repairRatio = Math.min(ratio, tight);
      }
      const floorOk = passesAt(node, MIN_FONT, repairRatio);
      const best = floorOk ? largestPassing(MIN_FONT, font, FONT_STEP, value => passesAt(node, value, repairRatio)) : MIN_FONT;
      setStyle(node, best, repairRatio);
      if (!floorOk) node.fitLabel = "RETAIN block fit at floor";
      if (traceFn) { trace(node, "safety-shrink", { from: font, to: best, floorOk, inkFloor: node.retainInkFloor ?? null, blockerAtDecided: (() => { setStyle(node, font, ratio); const h = collision.textCollisionDetails([node], COLLIDE); setStyle(node, best, repairRatio); return h ? h.blockerName : ""; })() }); }
    }

    function blockFit(bodyNodes) {
      const pageBody = pageBodyFonts(bodyNodes);
      for (const node of bodyNodes) {
        const decided = faithfulSchedule ? retainScheduleFaithful(node, pageBody.get(node) || 0) : retainSchedule(node, pageBody.get(node) || 0);
        node.retainDense = { small: Boolean(decided.denseSmall), heavy: Boolean(decided.heavyDenseSmall) };
        const ratio = ratioFor(decided.leadingEm);
        setStyle(node, decided.font, ratio);
        if (traceFn) {
          const f = factsOf(node);
          const hit = collision.textCollisionDetails([node], COLLIDE);
          trace(node, "schedule", { seed: f.seed, pageBody: pageBody.get(node) || 0, densitySeed: density(node, Math.max(f.seed, (pageBody.get(node) || 0) - 0.12), decided.leadingEm), decided: decided.font, why: decided.why || "", denseSmall: decided.denseSmall, layoutDensity: decided.layoutDensity, boxH: f.height, lines: lineCount(node), blocker: hit ? hit.blockerName : "" });
        }
        repairToPass(node, decided.font, ratio, decided.leadingEm, R.BODY_LEADING_MIN);
      }
    }

    // Non-body text (captions, footnotes, lists, short or narrow blocks that
    // retain-pdf does not treat as body): the non-body branch of
    // fit_translated_block_metrics on each block's own seed, then the same
    // safety net down to NON_BODY_LEADING_MIN. Two phases around the body
    // pass: scheduleNonBody() sets the scheduled sizes before it, so body
    // paragraphs are tested against those rather than seed-sized neighbours;
    // repairNonBody() applies the safety net after it, so non-body text is
    // not shrunk against body text that has not been fitted yet.
    const nonBodyDecisions = new Map();
    function scheduleNonBody() {
      for (const node of readingOrder(run.scopedNodes(isNonBodyText))) {
        const fact = factsOf(node);
        const decided = faithfulSchedule
          ? retainScheduleFaithful(node, 0, false)
          : { font: fact.seed, leadingEm: leadingOf(node) };
        setStyle(node, decided.font, ratioFor(decided.leadingEm));
        nonBodyDecisions.set(node, decided);
        node.retainUnsettled = true;
      }
    }

    // annotation_font_policy: captions and footnotes share a per-role size
    // (unify_annotation_fonts) and never exceed the body median x 0.88 /
    // 0.82 (the clamp of recover_underfilled_annotation_density; its
    // underfill growth is not ported). Runs on the scheduled sizes once the
    // body has settled, before the non-body safety net.
    function annotationRole(node) {
      const type = String(node.type || node.blockKind || "").toLowerCase();
      if (/footnote/.test(type)) return "footnote";
      if (/caption/.test(type)) return "caption";
      return "";
    }

    function unifyAnnotations() {
      const bodyFonts = run.scopedNodes(isBodyNode).map(node => layoutControlFontSize(node)).sort((a, b) => a - b);
      const bodyFontCap = bodyFonts.length ? bodyFonts[(bodyFonts.length - 1) >> 1] : 0;
      for (const role of ["caption", "footnote"]) {
        const nodes = [...nonBodyDecisions.keys()].filter(node => annotationRole(node) === role);
        if (nodes.length >= 2) {
          const target = T.annotationTarget(nodes.map(node => layoutControlFontSize(node)), role, bodyFontCap);
          for (const node of nodes) setStyle(node, T.annotationUnifiedFont(layoutControlFontSize(node), target, role), effectiveLineRatio(node));
        }
        for (const node of nodes) setStyle(node, T.annotationCappedFont(layoutControlFontSize(node), role, bodyFontCap), effectiveLineRatio(node));
        for (const node of nodes) {
          const decided = nonBodyDecisions.get(node);
          nonBodyDecisions.set(node, { ...decided, font: layoutControlFontSize(node) });
        }
      }
    }

    function repairNonBody() {
      unifyAnnotations();
      for (const node of nonBodyDecisions.keys()) delete node.retainUnsettled;
      for (const [node, decided] of nonBodyDecisions) {
        repairToPass(node, decided.font, ratioFor(decided.leadingEm), decided.leadingEm, R.NON_BODY_LEADING_MIN);
        node.fit = { pass: "retain-non-body", stopReason: decided.why || "", limiter: false, blocker: "" };
      }
    }

    // ----- 0: prepare (before any geometry of this document exists) -----

    const percentile = (values, q) => {
      const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
      return sorted.length ? sorted[Math.floor((sorted.length - 1) * q)] : 0;
    };

    // font_size_fit.estimate_font_size_pt for body blocks: 86% page baseline
    // (42nd percentile of the page's body sizes, scaled by the block's pitch
    // relative to the page's, 0.97..1.03) and 14% the block's own size,
    // clamped to MIN_FONT_SIZE_PT..MAX_LOCAL_FONT_SIZE_PT. retain-pdf measures
    // sizes from OCR glyph heights; here the block sizes are whatever the host
    // seeded (the source PDF's text layer in the overlay prototype).
    function blendBodySeeds(bodyNodes) {
      for (const group of pages(bodyNodes)) {
        const seeds = group.nodes.map(node => Number(node.baseFont) || 0);
        const pitches = group.nodes.map(node => factsOf(node).sourcePitch);
        const pageFont = percentile(seeds, R.PAGE_BASELINE_PERCENTILE);
        const pagePitch = percentile(pitches, R.PAGE_BASELINE_PERCENTILE);
        if (!(pageFont > 0)) continue;
        group.nodes.forEach((node, index) => {
          const local = seeds[index] || pageFont;
          const pitch = pitches[index];
          const blockScale = pagePitch > 0 && pitch > 0 ? Math.min(R.LOCAL_BLOCK_SCALE_MAX, Math.max(R.LOCAL_BLOCK_SCALE_MIN, pitch / pagePitch)) : 1;
          const blended = pageFont * blockScale * R.BODY_PAGE_BLEND_BASE + local * (1 - R.BODY_PAGE_BLEND_BASE);
          node.baseFont = Math.round(Math.min(R.MAX_LOCAL_FONT_SIZE_PT, Math.max(R.MIN_FONT_SIZE_PT, blended)) * 100) / 100;
        });
      }
      facts.clear();
    }

    function seedLeading(bodyNodes, nonBodyNodes) {
      for (const node of bodyNodes) {
        const fact = factsOf(node);
        const leadingEm = T.bodyLeadingEm({ fontSize: fact.seed, sourcePitch: fact.sourcePitch });
        node.retainLeadingEm = leadingEm;
        node.lineRatio = node.baseLineRatio = ratioFor(leadingEm);
        setStyle(node, fact.seed, node.lineRatio);
      }
      for (const node of nonBodyNodes) {
        const fact = factsOf(node);
        const leadingEm = T.nonBodyLeadingEm({ fontSize: fact.seed, sourcePitch: fact.sourcePitch });
        node.lineRatio = node.baseLineRatio = ratioFor(leadingEm);
        node.style.lineRatio = node.lineRatio;
      }
    }

    // Safety net, not a retain-pdf rule: the first-line ink floor, relative to
    // the box top, below the nearest element above that comes within 3 pt
    // (or overlaps the box). The retain line model starts the first line low
    // enough for its ink to stay below it (line-models/retain.js).
    function topGaps(textNodes) {
      for (const node of textNodes) {
        const own = nodeBox(node);
        let gap = Infinity;
        for (const other of node.page.nodes) {
          if (other === node) continue;
          const box = nodeBox(other);
          const overlapX = Math.min(own.right, box.right) - Math.max(own.left, box.left);
          if (overlapX < 1 || !(box.top < own.top)) continue;
          gap = Math.min(gap, own.top - box.bottom);
        }
        if (gap < 3) node.retainInkFloor = INK_CLEARANCE - gap;
      }
    }

    // geometry_adjustments._apply_short_body_region_expansion: widen short,
    // narrow text items (non-body text blocks and streams, not captions or
    // titles) that sit under two body paragraphs of the same column, before
    // any measurement. retain-pdf runs it in collect_page_seed_metrics.
    function expandShortRegions(bodyNodes, nonBodyNodes) {
      const isRegionText = node => isStream(node) || node.type === "text";
      const byPage = new Map();
      for (const node of bodyNodes.concat(nonBodyNodes.filter(isRegionText))) {
        if (!byPage.has(node.page)) byPage.set(node.page, []);
        byPage.get(node.page).push(node);
      }
      const bodySet = new Set(bodyNodes);
      for (const [page, nodes] of byPage) {
        const items = readingOrder(nodes).map(node => ({ id: node, anchor: bodySet.has(node), box: nodeBox(node) }));
        const widened = T.shortRegionExpansion(items, Number(page.width) || 0);
        for (const [node, right] of widened) {
          const box = nodeBox(node);
          node.style.width = Number((right - box.left).toFixed(3));
          node.retainRegionWidened = { from: box.right, to: right };
          if (traceFn) trace(node, "region-expand", { from: box.right, to: right });
        }
      }
      facts.clear();
    }

    function prepare() {
      const bodyNodes = run.scopedNodes(isBodyNode);
      const nonBodyNodes = run.scopedNodes(isNonBodyText);
      if (run.fitOptions.retainRegionExpansion !== false) expandShortRegions(bodyNodes, nonBodyNodes);
      blendBodySeeds(bodyNodes);
      seedLeading(bodyNodes, nonBodyNodes);
      topGaps(bodyNodes.concat(nonBodyNodes, run.scopedNodes(node => isBlock(node) && node.type === "title")));
    }

    // ----- 3: book target and unify -----

    function bookTarget(groups) {
      const eligible = [];
      for (const group of groups) {
        if (stableAnchors(group.nodes, group.widthMed).length < R.BODY_FONT_UNIFY_ANCHOR_COUNT) continue;
        eligible.push(...group.nodes.filter(node => isStableAnchor(node, group.widthMed)));
      }
      if (eligible.length < R.BODY_FONT_UNIFY_ANCHOR_COUNT) return 0;
      return T.lowQuantileFontTarget(eligible.map(node => layoutControlFontSize(node)));
    }

    function unify(groups, target) {
      for (const group of groups) {
        const anchors = stableAnchors(group.nodes, group.widthMed);
        if (anchors.length < R.BODY_FONT_UNIFY_ANCHOR_COUNT) continue;
        const pageTarget = target > 0 ? target : T.lowQuantileFontTarget(group.nodes.map(node => layoutControlFontSize(node)));
        if (!(pageTarget > 0)) continue;
        const eligible = group.nodes.filter(node => factsOf(node).width >= Math.max(1, group.widthMed * R.BODY_FONT_UNIFY_CANDIDATE_MIN_WIDTH_RATIO) &&
          anchors.some(anchor => T.sameColumn(nodeBox(node), nodeBox(anchor), group.widthMed)));
        if (eligible.length < 2) continue;
        for (const node of eligible) {
          const decision = T.unifyDecision({
            currentFont: layoutControlFontSize(node),
            targetFont: pageTarget,
            densityAtTarget: density(node, pageTarget)
          });
          if (traceFn) trace(node, "unify", { target: pageTarget, decision, densityAtTarget: density(node, pageTarget) });
          if (decision !== "target") continue;
          raiseFontSafely(node, pageTarget);
          node.retainUnified = true;
        }
      }
    }

    // ----- 4: underfilled body -----

    function isGrowthCandidate(node) {
      return lineCount(node) <= R.BODY_UNDERFILLED_FONT_GROW_MAX_LINES;
    }

    function growUnderfilled(group) {
      const fonts = group.nodes.map(node => layoutControlFontSize(node));
      const anchors = contextAnchors(group.nodes, group.widthMed);
      const pageFontTarget = anchors.length ? Math.max(median(fonts), median(anchors.map(node => layoutControlFontSize(node)))) : median(fonts);
      const pageUnderfillRatio = T.densitySlackRatio(median(group.nodes.map(node => density(node))));
      for (const node of group.nodes) {
        if (!isGrowthCandidate(node)) continue;
        const fact = factsOf(node);
        const current = layoutControlFontSize(node);
        const nodeDensity = density(node);
        if (nodeDensity >= R.BODY_UNDERFILLED_DENSITY_FLOOR_TRIGGER) continue;
        if (current < pageFontTarget - R.BODY_UNDERFILLED_FONT_GROW_LOW_FONT_SKIP_DELTA_PT) continue;
        const lines = lineCount(node);
        const target = T.underfillTargetFont({
          fontSize: current, density: nodeDensity, pageFontTarget, pageUnderfillRatio,
          lineCount: lines, boxHeight: fact.height, sourceLines: fact.sourceLines
        });
        if (target <= current + 0.03) continue;
        // largest_font_within_density: 9 bisections against the density limit.
        const limit = T.underfillDensityLimit(lines, fact.sourceLines);
        let low = current;
        let high = target;
        let best = current;
        for (let i = 0; i < 9; i++) {
          const mid = (low + high) / 2;
          if (density(node, mid) <= limit) { best = mid; low = mid; }
          else high = mid;
        }
        if (best <= current + 0.04) continue;
        const applied = raiseFontSafely(node, Math.round(best * 100) / 100);
        if (applied > current + 1e-9) node.retainGrewFrom = node.retainGrewFrom ?? current;
      }
    }

    function harmonizeUnderfilled(group) {
      const anchors = contextAnchors(group.nodes, group.widthMed);
      if (anchors.length < 2) return;
      const eligible = group.nodes.filter(node => isGrowthCandidate(node) &&
        anchors.filter(anchor => T.sameColumn(nodeBox(node), nodeBox(anchor), group.widthMed)).length >= 2);
      if (eligible.length < 2 || !eligible.some(node => node.retainGrewFrom !== undefined)) return;
      const fonts = eligible.map(node => layoutControlFontSize(node));
      const minFont = Math.min(...fonts);
      if (minFont <= 0 || Math.max(...fonts) / minFont > R.BODY_UNDERFILLED_FONT_HARMONIZE_MAX_RATIO) return;
      for (const node of eligible) {
        if (layoutControlFontSize(node) > minFont + 0.04) setStyle(node, minFont, effectiveLineRatio(node));
      }
    }

    function recoverUnderfilled(group) {
      for (const node of group.nodes) {
        if (!isGrowthCandidate(node)) continue;
        if (density(node) >= R.BODY_UNDERFILLED_DENSITY_FLOOR_TRIGGER) continue;
        const fact = factsOf(node);
        const targetDensity = T.recoveryDensityTarget(lineCount(node), fact.sourceLines > 0);
        for (let i = 0; i < R.BODY_UNDERFILLED_RECOVERY_MAX_ITERATIONS; i++) {
          if (density(node) >= targetDensity) break;
          let changed = false;
          // _recover_payload_font_step (no font step for unified paragraphs)
          const fontStep = node.retainUnified ? R.BODY_UNDERFILLED_UNIFIED_FONT_MAX_STEP_PT : R.BODY_UNDERFILLED_RECOVERY_FONT_STEP_PT;
          const current = layoutControlFontSize(node);
          if (fontStep > 0) {
            const wanted = Math.min(T.fontForRecoveryDensity(current, density(node)), current + fontStep);
            let low = current;
            let high = wanted;
            let best = current;
            for (let k = 0; k < 9; k++) {
              const mid = (low + high) / 2;
              if (density(node, mid) <= R.BODY_UNDERFILLED_DENSITY_SAFE_MAX) { best = mid; low = mid; }
              else high = mid;
            }
            if (best > current + 0.02) changed = raiseFontSafely(node, Math.round(best * 100) / 100) > current + 1e-9;
          }
          if (density(node) >= targetDensity) break;
          // _recover_payload_leading_step
          const leading = leadingOf(node);
          const cap = T.recoveryLeadingCap(lineCount(node), fact.sourceLines);
          const wantedLeading = Math.min(cap, leading + R.BODY_UNDERFILLED_RECOVERY_LEADING_STEP_EM);
          let lowL = leading;
          let highL = wantedLeading;
          let bestL = leading;
          for (let k = 0; k < 8; k++) {
            const mid = (lowL + highL) / 2;
            if (density(node, layoutControlFontSize(node), mid) <= R.BODY_UNDERFILLED_DENSITY_SAFE_MAX) { bestL = mid; lowL = mid; }
            else highL = mid;
          }
          bestL = Math.round(bestL * 100) / 100;
          if (bestL > leading + 0.01) {
            const fontSize = layoutControlFontSize(node);
            const safe = largestPassing(leading, bestL, 0.01, value => passesAt(node, fontSize, ratioFor(value)));
            if (safe > leading + 0.005) {
              setStyle(node, fontSize, ratioFor(safe));
              changed = true;
            }
          }
          if (!changed) break;
        }
      }
    }

    // ----- the pass -----

    // Reading order (page, then top): a paragraph that runs past its box is
    // fitted while the one below still sits at its seed, so the overflow is
    // limited by the lower paragraph's ink instead of squeezing it.
    function readingOrder(nodes) {
      return nodes.slice().sort((a, b) => (a.page.index - b.page.index) || (nodeBox(a).top - nodeBox(b).top) || (nodeBox(a).left - nodeBox(b).left));
    }

    // `smoothing` (passes/retain-smoothing.js, optional) supplies retain-pdf's
    // remaining body stages; they run where body_pipeline.py runs them under
    // FONT_UNIFY_MODE "role_min".
    function fitBody(smoothing = null) {
      const bodyNodes = readingOrder(run.scopedNodes(isBodyNode));
      if (!bodyNodes.length) return;
      blockFit(bodyNodes);
      const groups = pages(bodyNodes);
      if (smoothing) smoothing.inheritShort(groups);
      const target = bookTarget(groups);
      unify(groups, target);
      for (const group of groups) growUnderfilled(group);
      for (const group of groups) harmonizeUnderfilled(group);
      for (const group of groups) recoverUnderfilled(group);
      if (smoothing) {
        smoothing.pageAnchor(groups);
        smoothing.harmonizeLong(groups);
        smoothing.smoothAdjacent(groups);
      }
      unify(groups, target);
      for (const group of groups) recoverUnderfilled(group);
      run.retainBookBodyFont = target;
      if (traceFn) for (const node of bodyNodes) trace(node, "final", { target });
    }

    // retain-pdf caps non-body leading at NON_BODY_LEADING_MAX; the DOM
    // groups' line-ratio ranges are clamped to it under this profile.
    function nonBodyOptions(options) {
      return { ...options, maxLineRatio: Math.min(options.maxLineRatio ?? Infinity, ratioFor(R.NON_BODY_LEADING_MAX)) };
    }

    // Shared with passes/retain-titles.js (same safety net and style rules).
    // Non-body text sized before the body pass (scheduleNonBody) and repaired
    // after it: smoothing may change the size it is repaired from.
    function setNonBodyFont(node, font) {
      const decided = nonBodyDecisions.get(node);
      if (!decided) return false;
      setStyle(node, font, effectiveLineRatio(node));
      nonBodyDecisions.set(node, { ...decided, font });
      return true;
    }

    const helpers = Object.freeze({
      ratioFor, setStyle, largestPassing, passes, passesAt, raiseFontSafely, COLLIDE, FONT_STEP,
      isBodyNode, isNonBodyText, factsOf, density, lineCount, leadingOf, contextAnchors, readingOrder, trace,
      setNonBodyFont, isNonBodyScheduled: node => nonBodyDecisions.has(node)
    });

    return { prepare, fitBody, scheduleNonBody, repairNonBody, nonBodyOptions, helpers };
  }

  return { createRetainBodyPass };
});
