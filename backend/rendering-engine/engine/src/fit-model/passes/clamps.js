// retain-pdf-rendering/fit-model/passes/clamps.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Overflow clamps for translated references and code frames.
(function (root, factory) {
  "use strict";
  const NAME = "clampPasses";
  const DEPENDENCIES = [["document", "../document"]];
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
  const { applyGroup, layoutControlFontSize, controlLineRatio, Select, isBlock } = document;

  function createClampPasses(ctx, run, { geometry: geo }) {
    const { scopedNodes, doc } = run;
    const { geometry } = geo;

    function clampTranslatedOverflow() {
      for (const node of scopedNodes(Select.refs)) {
        let fontSize = layoutControlFontSize(node);
        let lineRatio = controlLineRatio(node, 1.1);
        const isRef = node.flowKind === "ref_text";
        const minFont = isRef ? 4.8 : 5.0;
        const minLineRatio = isRef ? 0.98 : 1.0;
        applyGroup([node], fontSize, lineRatio);
        const overflowing = () => geometry(node).scrollHeight > geometry(node).clientHeight + 1;
        for (let i = 0; i < 120 && overflowing() && (fontSize > minFont || lineRatio > minLineRatio); i += 1) {
          if (lineRatio > minLineRatio) lineRatio = Math.max(minLineRatio, lineRatio - 0.025);
          else fontSize = Math.max(minFont, fontSize - 0.25);
          applyGroup([node], fontSize, lineRatio);
        }
        node.baseFont = Number(fontSize.toFixed(2));
        node.lineRatio = Number(lineRatio.toFixed(3));
      }
    }

    // A translated code block owns a fixed source frame. Let its text become
    // denser before exposing an internal scrollbar; never let the pre silently
    // clip the tail of the translation while the following blocks keep their
    // original positions.
    function clampTranslatedCodeOverflow() {
      if (doc.mode !== "translation") return false;
      let changed = false;
      for (const node of scopedNodes(Select.code)) {
        if (typeof node.content.code !== "string") continue;
        const minFont = 7.0;
        const minLineRatio = 1.10;
        const requestedFont = layoutControlFontSize(node, 10);
        const requestedLineRatio = controlLineRatio(node, 1.18);
        let fontSize = Math.max(minFont, requestedFont);
        let lineRatio = Math.max(minLineRatio, requestedLineRatio);
        if (fontSize !== requestedFont || lineRatio !== requestedLineRatio) changed = true;
        applyGroup([node], fontSize, lineRatio);
        const overflowing = () => geometry(node).codeScrollHeight > geometry(node).codeClientHeight + 1;
        for (let i = 0; i < 160 && overflowing()
          && (lineRatio > minLineRatio + 0.001 || fontSize > minFont + 0.001); i += 1) {
          if (lineRatio > minLineRatio + 0.001) lineRatio = Math.max(minLineRatio, lineRatio - 0.025);
          else fontSize = Math.max(minFont, fontSize - 0.25);
          applyGroup([node], fontSize, lineRatio);
          changed = true;
        }
        // The fallback is explicit and local to the code frame, so it cannot
        // cover or push any content below the positioned block.
        node.codeFit = overflowing() ? "scroll" : "fit";
        node.baseFont = Number(fontSize.toFixed(2));
        node.lineRatio = Number(lineRatio.toFixed(3));
      }
      return changed;
    }

    // Keep final translated ink inside its source frame, including body text.
    // Collision-free overflow can still cover empty margins or the page footer.
    function clampTranslatedTextFrames() {
      if (doc.mode !== "translation" || ctx.typography !== "retain") return;
      for (const node of scopedNodes(node => Select.finalAudit(node) || (isBlock(node) && !Select.formula(node) && !Select.code(node)))) {
        const box = geo.elementBoxInPage(node);
        const fits = () => geo.textRectsInPage(node).every(rect =>
          rect.bottom <= box.bottom + 0.4 && rect.right <= box.right + 0.4);
        if (fits()) continue;
        let font = layoutControlFontSize(node);
        const initialFont = font;
        let ratio = controlLineRatio(node, 1.1);
        const initialRatio = ratio;
        const minRatio = Math.min(ratio, 0.98);
        applyGroup([node], font, minRatio);
        if (fits()) {
          let lo = minRatio, hi = ratio;
          while (hi - lo > 0.001) {
            const mid = (lo + hi) / 2;
            applyGroup([node], font, mid);
            if (fits()) lo = mid; else hi = mid;
          }
          ratio = lo;
        } else {
          ratio = minRatio;
          let lo = Math.min(font, Math.max(4.8, font * 0.55)), hi = font;
          applyGroup([node], lo, ratio);
          if (!fits()) { applyGroup([node], initialFont, initialRatio); continue; }
          while (hi - lo > 0.01) {
            const mid = (lo + hi) / 2;
            applyGroup([node], mid, ratio);
            if (fits()) lo = mid; else hi = mid;
          }
          font = lo;
        }
        applyGroup([node], font, ratio);
        node.fitLabel = "FINAL frame fit";
      }
    }

    return { clampTranslatedOverflow, clampTranslatedCodeOverflow, clampTranslatedTextFrames };
  }

  return { createClampPasses };
});
