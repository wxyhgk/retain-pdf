// retain-pdf-rendering/fit-model/passes/retain-smoothing.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Typography profile "retain": the body stages of retain-pdf's
// render/layout/payload/body_pipeline.py that keep neighbouring paragraphs
// consistent, run by passes/retain-body.js's fitBody at their place in the
// FONT_UNIFY_MODE "role_min" order:
//
//   block fit → inheritShort → unify → grow → harmonize → recover
//     → pageAnchor → harmonizeLong → smoothAdjacent → unify → recover
//
// - inheritShort    body_font_inheritance_policy.inherit_short_body_fonts
// - pageAnchor      body_page_anchor_policy.apply_page_body_font_anchor
// - harmonizeLong   body_font_harmonize_policy.harmonize_long_body_payloads
// - smoothAdjacent  body_smoothing_policy.smooth_adjacent_body_payloads
//                   (body_context.smooth_adjacent_body_pair)
//
// Decreases are applied as retain-pdf applies them; every increase goes
// through retain-body's safety net (raiseFontSafely / passesAt), which may
// grant less than retain-pdf would. Not ported: inherit_low_height_body_fonts
// (it only sets a reference size), relax_short_body_context_heights,
// restore_comfort_body_leading and refit_body_leading_after_font_unify.
(function (root, factory) {
  "use strict";
  const NAME = "retainSmoothingPass";
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

  function median(values) {
    const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function createRetainSmoothingPass(ctx, run, deps) {
    const body = deps.retainBody && deps.retainBody.helpers;
    if (!body) throw new Error("retain-smoothing needs the retain body pass");
    const { factsOf, density, lineCount, leadingOf, ratioFor, setStyle, raiseFontSafely, passesAt, contextAnchors, readingOrder, trace } = body;

    const isAnnotation = node => /caption|footnote/.test(String(node.type || node.blockKind || "").toLowerCase());
    // body_common.is_body_context_text_payload: body, or plain text (not a
    // caption, footnote or title).
    const isContextText = node => body.isBodyNode(node) ||
      (body.isNonBodyText(node) && !isAnnotation(node) && (isStream(node) || node.type === "text"));
    const dense = node => Boolean(node.retainDense && node.retainDense.small);
    const heavyDense = node => Boolean(node.retainDense && node.retainDense.heavy);
    const width = node => factsOf(node).width;
    const height = node => factsOf(node).height;
    const sameColumn = (node, anchor, widthMed) => T.sameColumn(nodeBox(node), nodeBox(anchor), widthMed);

    // A size change for any context node: body nodes through the safety net
    // when growing, non-body text through its scheduled size (it is repaired
    // after the body pass).
    function applyFont(node, font, stage) {
      const current = layoutControlFontSize(node);
      if (Math.abs(font - current) < 0.005) return current;
      let applied;
      if (body.isNonBodyScheduled(node)) {
        body.setNonBodyFont(node, font);
        applied = font;
      }
      else applied = raiseFontSafely(node, font);
      trace(node, stage, { from: current, to: applied, wanted: font });
      return applied;
    }

    function groupNodes(group) {
      // retain-pdf's all_payloads of the page: body plus plain non-body text.
      const others = run.scopedNodes(node => node.page === group.page && body.isNonBodyText(node) && isContextText(node));
      return readingOrder(group.nodes.concat(others));
    }

    // ----- inherit_short_body_fonts -----

    function inheritShort(groups) {
      for (const group of groups) {
        const anchors = contextAnchors(group.nodes, group.widthMed);
        if (anchors.length < R.SHORT_BODY_INHERIT_MIN_ANCHORS) continue;
        const pageAnchorFont = median(anchors.map(node => layoutControlFontSize(node)));
        for (const node of groupNodes(group)) {
          if (!isContextText(node)) continue;
          if (lineCount(node) > R.SHORT_BODY_INHERIT_MAX_LINES) continue;
          const h = height(node);
          if (h <= 0 || h > R.SHORT_BODY_INHERIT_MAX_HEIGHT_PT) continue;
          if (!(group.widthMed > 0) || width(node) >= group.widthMed * R.SHORT_BODY_INHERIT_MAX_WIDTH_RATIO) continue;
          const local = anchors.filter(anchor => anchor !== node && sameColumn(node, anchor, group.widthMed)).map(anchor => layoutControlFontSize(anchor));
          if (local.length < 2) continue;
          const target = Math.min(Math.round(median(local) * 100) / 100, pageAnchorFont + R.SHORT_BODY_INHERIT_PAGE_ANCHOR_BONUS_PT);
          const inherited = T.shortBodyTargetFont(layoutControlFontSize(node), target);
          if (inherited <= 0) continue;
          applyFont(node, inherited, "inherit-short");
          node.retainShortInherited = true;
        }
      }
    }

    // ----- apply_page_body_font_anchor -----

    function pageAnchors(group) {
      const candidates = group.nodes.filter(node => !dense(node) && !heavyDense(node) &&
        layoutControlFontSize(node) > 0 &&
        width(node) >= Math.max(1, group.widthMed * R.PAGE_BODY_FONT_ANCHOR_MIN_WIDTH_RATIO) &&
        height(node) >= R.PAGE_BODY_FONT_ANCHOR_MIN_HEIGHT_PT &&
        factsOf(node).sourceLines >= R.PAGE_BODY_FONT_ANCHOR_MIN_LINES);
      const text = node => (node.content?.paragraphs || []).map(paragraph => paragraph.text || "").join("").trim();
      const score = node => height(node) * 2.0 + width(node) * 0.25 + Math.min(160, text(node).length);
      return candidates.sort((a, b) => score(b) - score(a)).slice(0, R.PAGE_BODY_FONT_ANCHOR_COUNT);
    }

    function pageAnchor(groups) {
      for (const group of groups) {
        const anchors = pageAnchors(group);
        if (anchors.length < R.PAGE_BODY_FONT_ANCHOR_COUNT) continue;
        const target = Math.round(Math.min(...anchors.map(node => layoutControlFontSize(node))) * 100) / 100;
        for (const node of groupNodes(group)) {
          if (!isContextText(node) || dense(node) || heavyDense(node)) continue;
          if (width(node) < Math.max(1, group.widthMed * R.PAGE_BODY_FONT_ANCHOR_CANDIDATE_MIN_WIDTH_RATIO)) continue;
          if (!anchors.some(anchor => sameColumn(node, anchor, group.widthMed))) continue;
          if (layoutControlFontSize(node) <= target + R.PAGE_BODY_FONT_ANCHOR_APPLY_TOLERANCE_PT) continue;
          applyFont(node, target, "page-anchor");
        }
      }
    }

    // ----- harmonize_long_body_payloads -----

    function setLeading(node, leadingEm) {
      const font = layoutControlFontSize(node);
      const current = leadingOf(node);
      if (Math.abs(leadingEm - current) < 0.005) return;
      if (leadingEm < current || passesAt(node, font, ratioFor(leadingEm))) setStyle(node, font, ratioFor(leadingEm));
    }

    function harmonizeLong(groups) {
      for (const group of groups) {
        const long = group.nodes.filter(node => height(node) >= R.LONG_BODY_MIN_HEIGHT_PT &&
          width(node) >= group.widthMed * R.LONG_BODY_MIN_WIDTH_RATIO && density(node) <= R.LONG_BODY_MAX_DENSITY);
        if (long.length < 2) continue;
        const fontMedian = median(long.map(node => layoutControlFontSize(node)));
        const leadingMedian = median(long.map(node => leadingOf(node)));
        for (const node of long) {
          applyFont(node, T.harmonizeBand(layoutControlFontSize(node), fontMedian, R.LONG_BODY_FONT_BAND_PT), "harmonize-long");
          setLeading(node, T.harmonizeBand(leadingOf(node), leadingMedian, R.LONG_BODY_LEADING_BAND_EM));
        }
      }
    }

    // ----- smooth_adjacent_body_payloads -----

    function sourceWords(node) {
      const items = (node.source && node.source.items) || [];
      const text = items.map(item => item.text || "").join(" ") || String(node.source?.text || "");
      return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
    }

    function translatedZhChars(node) {
      const text = (node.content?.paragraphs || []).map(paragraph => paragraph.text || "").join("");
      return (text.match(/[一-鿿]/g) || []).length;
    }

    // _is_adjacent_body_smoothing_candidate
    function smoothingCandidate(node, widthMed) {
      if (!body.isBodyNode(node) || heavyDense(node)) return false;
      if (height(node) < R.ADJACENT_BODY_SMOOTH_MIN_BOX_HEIGHT_PT) return false;
      const minWidth = widthMed > 0 ? Math.max(R.ADJACENT_BODY_SMOOTH_MIN_WIDTH_PT, widthMed * R.ADJACENT_BODY_SMOOTH_MIN_PAGE_WIDTH_RATIO) : R.ADJACENT_BODY_SMOOTH_MIN_WIDTH_PT;
      if (width(node) < minWidth) return false;
      return sourceWords(node) >= R.ADJACENT_BODY_SMOOTH_MIN_SOURCE_WORDS || translatedZhChars(node) >= R.ADJACENT_BODY_SMOOTH_MIN_TRANSLATED_ZH_CHARS;
    }

    // is_same_column_adjacent_body_pair
    function adjacentPair(current, next, widthMed) {
      if (!smoothingCandidate(current, widthMed) || !smoothingCandidate(next, widthMed)) return false;
      const a = nodeBox(current);
      const b = nodeBox(next);
      if (b.top < a.top) return false;
      const ratio = Math.min(width(current), width(next)) / Math.max(width(current), width(next));
      if (ratio < R.ADJACENT_BODY_SMOOTH_MIN_WIDTH_RATIO) return false;
      const gap = b.top - a.bottom;
      const maxGap = Math.max(R.ADJACENT_BODY_SMOOTH_MAX_GAP_PT, Math.min(height(current), height(next)) * 0.45);
      if (gap < -4.0 || gap > maxGap) return false;
      return T.sameColumn(a, b, widthMed);
    }

    // body_context._source_vertical_pressure
    function sourcePressure(node) {
      const fact = factsOf(node);
      const font = Math.max(0.1, layoutControlFontSize(node));
      const pitchPressure = fact.sourceLines >= 2 && fact.sourcePitch > 0 ? Math.max(0, fact.sourcePitch / font - 1) : 0;
      const countPressure = fact.sourceLines > 0 ? Math.min(4, fact.sourceLines / 4) : 0;
      return Math.max(pitchPressure, countPressure);
    }

    // cap_font_growth_by_density: 8 bisections below the density limit.
    function densityCappedFont(node, wanted, limit) {
      const current = layoutControlFontSize(node);
      if (wanted <= current) return wanted;
      let low = current;
      let high = wanted;
      let best = current;
      for (let i = 0; i < 8; i++) {
        const middle = (low + high) / 2;
        if (density(node, middle) <= limit) { best = middle; low = middle; }
        else high = middle;
      }
      return Math.round(best * 100) / 100;
    }

    function densityCappedLeading(node, wanted, limit) {
      const current = leadingOf(node);
      if (wanted <= current) return wanted;
      let low = current;
      let high = wanted;
      let best = current;
      for (let i = 0; i < 8; i++) {
        const middle = (low + high) / 2;
        if (density(node, layoutControlFontSize(node), middle) <= limit) { best = middle; low = middle; }
        else high = middle;
      }
      return Math.round(best * 100) / 100;
    }

    function smoothPair(current, next) {
      const relaxed = Math.max(density(current), density(next)) > R.ADJACENT_BODY_SMOOTH_RELAXED_DENSITY_TRIGGER || dense(current) || dense(next);
      const densityLimit = relaxed ? R.ADJACENT_BODY_SMOOTH_RELAXED_GROW_DENSITY_MAX : R.ADJACENT_BODY_SMOOTH_GROW_DENSITY_MAX;
      // font
      const [smaller, larger] = layoutControlFontSize(current) <= layoutControlFontSize(next) ? [current, next] : [next, current];
      const smallerFont = layoutControlFontSize(smaller);
      const largerFont = layoutControlFontSize(larger);
      const maxDelta = relaxed ? R.ADJACENT_BODY_SMOOTH_RELAXED_FONT_DELTA_PT : R.ADJACENT_BODY_SMOOTH_MAX_FONT_DELTA_PT;
      if (largerFont - smallerFont > maxDelta) {
        const growAllowed = !dense(smaller) && !heavyDense(smaller) && density(smaller) <= densityLimit;
        let grownTo = smallerFont;
        if (growAllowed) {
          const excess = largerFont - smallerFont - maxDelta;
          const capped = densityCappedFont(smaller, smallerFont + excess * R.ADJACENT_BODY_SMOOTH_FONT_GROW_SHARE, densityLimit);
          grownTo = applyFont(smaller, capped, "smooth-grow");
        }
        const decided = T.smoothFontPair({ smallerFont, largerFont, relaxed, growCap: grownTo });
        applyFont(larger, decided.larger, "smooth-shrink");
      }
      // leading
      const [tighter, looser] = leadingOf(current) <= leadingOf(next) ? [current, next] : [next, current];
      const leadingDelta = leadingOf(looser) - leadingOf(tighter);
      const maxLeadingDelta = relaxed ? R.ADJACENT_BODY_SMOOTH_RELAXED_LEADING_DELTA_EM : R.ADJACENT_BODY_SMOOTH_MAX_LEADING_DELTA_EM;
      if (leadingDelta > maxLeadingDelta && Math.abs(sourcePressure(current) - sourcePressure(next)) <= R.ADJACENT_BODY_SMOOTH_MAX_PRESSURE_DELTA) {
        const excess = leadingDelta - maxLeadingDelta;
        const leadingLimit = Math.max(R.BODY_DENSITY_TARGET_MAX, densityLimit - 0.02);
        let grown = 0;
        if (!dense(tighter) && !heavyDense(tighter) && density(tighter) <= leadingLimit) {
          const before = leadingOf(tighter);
          setLeading(tighter, densityCappedLeading(tighter, before + excess * R.ADJACENT_BODY_SMOOTH_LEADING_GROW_SHARE, leadingLimit));
          grown = Math.max(0, leadingOf(tighter) - before);
        }
        setLeading(looser, Math.round(Math.max(R.ADJACENT_BODY_SMOOTH_MIN_LEADING_EM, leadingOf(looser) - Math.max(0, excess - grown)) * 100) / 100);
      }
      // normalize_body_payload_leading: clamp to the body leading range.
      for (const node of [current, next]) {
        const clamped = T.normalizeLeadingEm(leadingOf(node), R.BODY_LEADING_MIN, R.BODY_LEADING_MAX, R.BODY_LEADING_FLOOR_MIN ?? R.BODY_LEADING_MIN);
        setLeading(node, clamped);
      }
    }

    function smoothAdjacent(groups) {
      for (const group of groups) {
        const ordered = readingOrder(group.nodes);
        const smoothedPairs = new Set();
        ordered.forEach((current, index) => {
          let best = null;
          let bestKey = null;
          for (const next of ordered.slice(index + 1)) {
            if (!adjacentPair(current, next, group.widthMed)) continue;
            const gap = Math.max(-4.0, nodeBox(next).top - nodeBox(current).bottom);
            const centerDelta = Math.abs((nodeBox(current).left + nodeBox(current).right) / 2 - (nodeBox(next).left + nodeBox(next).right) / 2);
            if (!bestKey || gap < bestKey[0] || (gap === bestKey[0] && centerDelta < bestKey[1])) { best = next; bestKey = [gap, centerDelta]; }
          }
          if (!best) return;
          const key = `${current.id}|${best.id}`;
          if (smoothedPairs.has(key)) return;
          smoothPair(current, best);
          smoothedPairs.add(key);
        });
      }
    }

    return { inheritShort, pageAnchor, harmonizeLong, smoothAdjacent };
  }

  return { createRetainSmoothingPass };
});
