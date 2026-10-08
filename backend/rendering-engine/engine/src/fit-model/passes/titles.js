// retain-pdf-rendering/fit-model/passes/titles.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Title passes: false single-line demotion, underfilled title growth, title
// size clustering and keeping short titles on one line.
(function (root, factory) {
  "use strict";
  const NAME = "titlePasses";
  const DEPENDENCIES = [["rects", "../rects"], ["document", "../document"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, rects, document) {
  "use strict";
  const { rectUnion } = rects;
  const { applyGroup, layoutControlFontSize, controlLineRatio, Select } = document;

  function createTitlePasses(ctx, run, { geometry: geo, collision }) {
    const { scopedNodes } = run;
    const { textRectsInPage, elementBoxInPage } = geo;
    const { textCollisionDetails } = collision;

    function singleLineTextExceedsPage(node, tolerance = 1.5) {
      const pageWidth = node.page.width;
      if (pageWidth <= 0) return false;
      const textRects = textRectsInPage(node);
      if (!textRects.length) return false;
      return textRects.some((rect) => rect.left < -tolerance || rect.right > pageWidth + tolerance);
    }

    function demoteFalseSingleLineText() {
      for (const node of scopedNodes(Select.falseSingle)) {
        if (!singleLineTextExceedsPage(node)) continue;
        node.originalLines = "multi";
        node.singleLineAlign = "left";
        node.fitLabel = node.fitLabel || "DEMOTED single->multi";
      }
    }

    function titleFrameFill(node) {
      const own = elementBoxInPage(node);
      const ownWidth = Math.max(1, own.right - own.left);
      const ownHeight = Math.max(1, own.bottom - own.top);
      const ink = rectUnion(textRectsInPage(node));
      if (!ink) return { area: 0, width: 0, height: 0 };
      const usedWidth = Math.max(0, Math.min(own.right, ink.right) - Math.max(own.left, ink.left));
      const usedHeight = Math.max(0, Math.min(own.bottom, ink.bottom) - Math.max(own.top, ink.top));
      const width = Math.min(1, usedWidth / ownWidth);
      const height = Math.min(1, usedHeight / ownHeight);
      return { area: width * height, width, height };
    }

    function expandUnderfilledTitles(predicate, options) {
      const areaThreshold = Number.isFinite(options.titleFillAreaThreshold) ? options.titleFillAreaThreshold : 0.42;
      const dimensionThreshold = Number.isFinite(options.titleFillDimensionThreshold) ? options.titleFillDimensionThreshold : 0.72;
      for (const node of scopedNodes(predicate)) {
        const initialFill = titleFrameFill(node);
        if (initialFill.area >= areaThreshold || (
          initialFill.width >= dimensionThreshold && initialFill.height >= dimensionThreshold
        )) continue;
        let fontSize = layoutControlFontSize(node);
        const lineRatio = controlLineRatio(node, 1.12);
        for (let safety = 0; safety < 136 && fontSize + options.step <= options.maxFont; safety += 1) {
          const nextFont = fontSize + options.step;
          applyGroup([node], nextFont, lineRatio);
          if (textCollisionDetails([node], options)) {
            applyGroup([node], fontSize, lineRatio);
            break;
          }
          fontSize = nextFont;
          const fill = titleFrameFill(node);
          if (fill.area >= areaThreshold || (
            fill.width >= dimensionThreshold && fill.height >= dimensionThreshold
          )) break;
        }
      }
    }

    function clusterTitleFontSizes(predicate, maxDifference = 1.0) {
      const nodes = scopedNodes(predicate)
        .map((node) => ({ node, fontSize: layoutControlFontSize(node, 0) }))
        .filter((entry) => entry.fontSize > 0)
        .sort((left, right) => left.fontSize - right.fontSize);
      let cluster = [];
      let clusterMinimum = 0;
      const applyCluster = () => {
        if (cluster.length < 2) return;
        for (const entry of cluster) applyGroup([entry.node], clusterMinimum, controlLineRatio(entry.node, 1.12));
      };
      for (const entry of nodes) {
        if (!cluster.length || entry.fontSize - clusterMinimum <= maxDifference + 0.001) {
          cluster.push(entry);
          if (cluster.length === 1) clusterMinimum = entry.fontSize;
          continue;
        }
        applyCluster();
        cluster = [entry];
        clusterMinimum = entry.fontSize;
      }
      applyCluster();
    }

    function renderedTextLineCount(node, topTolerance = 1.5) {
      const tops = [];
      const rects = textRectsInPage(node).slice().sort((left, right) => (left.top - right.top || left.left - right.left));
      for (const rect of rects) {
        if (!tops.some((top) => Math.abs(top - rect.top) <= topTolerance)) tops.push(rect.top);
      }
      return tops.length;
    }

    function nodeText(node) {
      return (node.content.paragraphs || [])
        .map(paragraph => paragraph.runs.map(run => run.type === "text" ? run.text : run.type === "math" ? run.tex : "\n").join(""))
        .join("\n");
    }

    // Keep a short translated title on one line only when a bounded width
    // extension is collision-free. Use rendered lines, not MinerU's label.
    function keepShortTitlesOnOneLine(predicate, options = {}) {
      const maxCharacters = Number.isFinite(options.maxCharacters) ? options.maxCharacters : 12;
      const maxBorrowPx = Number.isFinite(options.maxBorrowPx) ? options.maxBorrowPx : 18;
      const maxWidthRatio = Number.isFinite(options.maxWidthRatio) ? options.maxWidthRatio : 1.35;
      for (const node of scopedNodes(predicate)) {
        const text = nodeText(node).replace(/\s+/g, " ").trim();
        if (Array.from(text).length < 2 || Array.from(text).length > maxCharacters) continue;
        if (renderedTextLineCount(node) <= 1) continue;
        const originalWidth = node.style.width;
        const originalNowrap = node.style.nowrap;
        const own = elementBoxInPage(node);
        const ownWidth = Math.max(1, own.right - own.left);
        node.style.nowrap = true;
        const ink = rectUnion(textRectsInPage(node));
        if (!ink || renderedTextLineCount(node) !== 1) {
          node.style.width = originalWidth;
          node.style.nowrap = originalNowrap;
          continue;
        }
        const requiredWidth = Math.max(ownWidth, ink.right - own.left + 0.75);
        const borrowedWidth = requiredWidth - ownWidth;
        if (ink.left < own.left - 1.5 || borrowedWidth > maxBorrowPx || requiredWidth / ownWidth > maxWidthRatio) {
          node.style.width = originalWidth;
          node.style.nowrap = originalNowrap;
          continue;
        }
        node.style.width = Number(requiredWidth.toFixed(2));
        const collision = textCollisionDetails([node], {
          avoidBlockOverlap: true,
          avoidPageOverflow: true,
          checkAllTextForCollisions: true
        });
        if (collision) {
          node.style.width = originalWidth;
          node.style.nowrap = originalNowrap;
          continue;
        }
        node.shortTitleNoWrap = true;
      }
    }

    return {
      singleLineTextExceedsPage, demoteFalseSingleLineText, titleFrameFill, expandUnderfilledTitles,
      clusterTitleFontSizes, renderedTextLineCount, nodeText, keepShortTitlesOnOneLine
    };
  }

  return { createTitlePasses };
});
