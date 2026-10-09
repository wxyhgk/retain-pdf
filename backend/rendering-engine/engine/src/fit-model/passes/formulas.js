// retain-pdf-rendering/fit-model/passes/formulas.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Formula passes (fitLayoutFormulas): shrink to the block, expand toward its
// height without touching neighbouring glyphs, align equation numbers.
(function (root, factory) {
  "use strict";
  const NAME = "formulaPasses";
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
  const { layoutRectsOverlap } = rects;
  const { Select } = document;

  function createFormulaPasses(ctx, run, { geometry: geo }) {
    const strict = ctx.strict;
    const { doc } = run;
    const { geometry, textRectsInPage, elementBoxInPage } = geo;

    // ----- formulas (fitLayoutFormulas) -----

    function collectPageColumnRights(page) {
      const pageWidth = page.width || 612;
      const nodes = page.nodes.filter(Select.columnCandidate);
      if (!nodes.length) return null;
      const columns = [];
      for (const node of nodes) {
        if (node.refs || node.toc || node.caption || node.title) continue;
        const box = elementBoxInPage(node);
        const left = box.left;
        const width = box.right - box.left;
        const right = left + width;
        if (width > pageWidth * 0.82 || width < 20) continue;
        const key = String(node.columnKey || "");
        if (key === "full") continue;
        let col = key
          ? columns.find(c => c.key === key)
          : columns.find(c => Math.abs(c.anchor - left) < 28);
        if (!col) {
          col = { key: key || `col-${columns.length}`, anchor: left, minLeft: left, maxRight: right };
          columns.push(col);
        } else {
          col.minLeft = Math.min(col.minLeft, left);
          col.maxRight = Math.max(col.maxRight, right);
        }
      }
      return columns.length ? columns : null;
    }

    function calibrateEquationNumberRight(node, columns) {
      const box = elementBoxInPage(node);
      const blockLeft = box.left;
      const blockWidth = box.right - box.left;
      const blockRight = blockLeft + blockWidth;
      let bestCol = null;
      let minDist = Infinity;
      for (const col of columns) {
        const dist = Math.abs(blockLeft - col.anchor);
        if (dist < minDist) {
          minDist = dist;
          bestCol = col;
        }
      }
      if (!bestCol) return;
      let targetRight = bestCol.maxRight;
      const colWidth = Math.max(1, bestCol.maxRight - bestCol.minLeft);
      if (blockWidth >= colWidth * 1.25 || blockRight > bestCol.maxRight + 15) {
        const spanningCols = columns.filter(col => col.maxRight >= blockLeft && col.minLeft <= blockRight + 15);
        if (spanningCols.length > 1) targetRight = Math.max(...spanningCols.map(c => c.maxRight));
      }
      const desiredNumberRightPx = targetRight - blockLeft;
      if (desiredNumberRightPx > 20) {
        const currentVal = Number(node.formula.numberRight || 0);
        if (!currentVal || desiredNumberRightPx > currentVal + 4) {
          node.formula.numberRight = Number(desiredNumberRightPx.toFixed(2));
        }
      }
    }

    function formulaGrowthCollides(page, node) {
      const formulaBox = geometry(node).formulaRect;
      if (!formulaBox || formulaBox.right - formulaBox.left <= 0 || formulaBox.bottom - formulaBox.top <= 0) return false;
      for (const other of page.nodes) {
        if (other === node) continue;
        for (const rect of textRectsInPage(other)) {
          if (layoutRectsOverlap(formulaBox, rect, strict ? 0 : 1.5)) return true;
        }
      }
      return false;
    }

    // Binary-search the largest scale in (fitted, wanted] that keeps the formula
    // clear of neighbouring glyphs; the fitted scale is the safe floor.
    function largestClearFormulaScale(page, node, fitted, wanted) {
      let low = fitted;
      let high = wanted;
      for (let step = 0; step < 8 && high - low > 0.005; step += 1) {
        const middle = (low + high) / 2;
        node.formula.scale = roundScale(middle);
        if (formulaGrowthCollides(page, node)) high = middle;
        else low = middle;
      }
      node.formula.scale = roundScale(low);
      return low;
    }

    // style.transform = scale(x.toFixed(4)), or none within 0.005 of 1.
    function roundScale(scale) {
      return Math.abs(scale - 1) > 0.005 ? Number(scale.toFixed(4)) : 1;
    }

    function fitLayoutFormulas({ expand = false } = {}) {
      for (const page of doc.pages) {
        const formulas = page.nodes.filter(node => Select.formula(node) && node.content.formula);
        if (!formulas.length) continue;
        const columns = expand ? collectPageColumnRights(page) : null;
        for (const node of formulas) {
          const hasNumber = Boolean(node.content.number);
          if (expand && hasNumber && columns) calibrateEquationNumberRight(node, columns);
          node.formula.scale = 1;
          const value = geometry(node);
          const blockRect = value.box;
          const blockWidth = blockRect.right - blockRect.left;
          const blockHeight = blockRect.bottom - blockRect.top;
          const formulaRect = value.formulaRect;
          const formulaWidth = formulaRect.right - formulaRect.left;
          const formulaHeight = formulaRect.bottom - formulaRect.top;
          if (blockWidth <= 0 || formulaWidth <= 0) continue;
          const availableWidth = Math.max(1, blockWidth - 4);
          let maxFormulaWidth = availableWidth;
          if (hasNumber && value.numberRect) {
            if (value.numberRect.left > formulaRect.left) {
              const spaceBeforeNumber = value.numberRect.left - formulaRect.left - 8;
              if (spaceBeforeNumber > 10) maxFormulaWidth = Math.min(maxFormulaWidth, spaceBeforeNumber);
            }
          }
          const scaleW = maxFormulaWidth / Math.max(1, formulaWidth);
          // The shrink-only scale is what the text fitter measured against.
          const fittedScale = Math.min(1, scaleW);
          let scale = fittedScale;
          if (expand && blockHeight > 0 && formulaHeight > 0) {
            const targetHeight = blockHeight * 0.92;
            const scaleH = targetHeight / formulaHeight;
            scale = Math.min(scaleW, Math.max(0.7, scaleH), 1.35);
          }
          node.formula.scale = roundScale(scale);
          // This pass runs after text fitting, so neighbouring text cannot move
          // out of the way any more. Growth beyond the fitted scale must stay
          // clear of every other block's glyphs.
          if (expand && scale > fittedScale + 0.005 && formulaGrowthCollides(page, node)) {
            scale = largestClearFormulaScale(page, node, fittedScale, scale);
          }
          node.formula.fitted = scale < .999;
        }
      }
    }

    return {
      collectPageColumnRights, calibrateEquationNumberRight, formulaGrowthCollides, largestClearFormulaScale,
      roundScale, fitLayoutFormulas
    };
  }

  return { createFormulaPasses };
});
