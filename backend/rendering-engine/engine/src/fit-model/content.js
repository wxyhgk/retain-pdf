// retain-pdf-rendering/fit-model/content.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Which text each node shows, as measurer runs (mirrors render.js). Pure.
(function (root, factory) {
  "use strict";
  const NAME = "content";
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
  function renderModule() {
    if (typeof module === "object" && module && module.exports && typeof require === "function") {
      try { return require("../render.js"); } catch (_error) { /* fall through */ }
    }
    return root.RetainPdfRendering ? root.RetainPdfRendering.Render : null;
  }

  // ---------------------------------------------------------------------------
  // Content: which text each node shows (mirrors render.js).
  // ---------------------------------------------------------------------------

  function decodeEntities(text) {
    return String(text || "")
      .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  }

  function stripControl(text) {
    return [...String(text || "")].filter(character => {
      const code = character.codePointAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && !(code >= 0xD800 && code <= 0xDFFF));
    }).join("");
  }

  // Default text -> runs: TeX spans become math boxes when renderMathBox
  // returns a box, otherwise they stay as their TeX source text.
  function textToRuns(text, renderMathBox) {
    const source = String(text ?? "");
    const runs = [];
    const pattern = /\\\((.+?)\\\)|\\\[(.+?)\\\]|\$([^$\n]+?)\$/gs;
    let last = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index > last) runs.push({ type: "text", text: source.slice(last, match.index) });
      const tex = match[1] ?? match[2] ?? match[3];
      const box = renderMathBox ? renderMathBox(tex, match[2] !== undefined) : null;
      runs.push(box ? { type: "math", tex, display: false, ...box } : { type: "text", text: tex });
      last = match.index + match[0].length;
    }
    if (last < source.length) runs.push({ type: "text", text: source.slice(last) });
    return runs;
  }

  // HTML fragments (source html, stubbed TeX markup) -> runs; <br> is a
  // forced break, tags are dropped, <tex>/.katex content follows renderMathBox.
  function htmlToRuns(html, renderMathBox) {
    const source = String(html || "");
    const runs = [];
    const pattern = /<br\s*\/?>|<tex data-display="([01])">([\s\S]*?)<\/tex>/gi;
    let last = 0;
    const pushText = value => {
      const text = decodeEntities(value.replace(/<[^>]+>/g, ""));
      if (text) runs.push(...textToRuns(text, renderMathBox));
    };
    for (const match of source.matchAll(pattern)) {
      pushText(source.slice(last, match.index));
      if (match[0].toLowerCase().startsWith("<br")) runs.push({ type: "break" });
      else {
        const tex = decodeEntities(match[2]);
        const box = renderMathBox ? renderMathBox(tex, match[1] === "1") : null;
        runs.push(box ? { type: "math", tex, display: false, ...box } : { type: "text", text: tex });
      }
      last = match.index + match[0].length;
    }
    pushText(source.slice(last));
    return runs;
  }

  // CSS white-space: normal — collapse whitespace, drop it at paragraph and
  // forced-break edges.
  function collapseRuns(runs) {
    const out = [];
    let pendingSpace = false;
    let atLineStart = true;
    for (const run of runs) {
      if (run.type === "break") {
        out.push(run);
        pendingSpace = false;
        atLineStart = true;
        continue;
      }
      if (run.type === "math") {
        if (pendingSpace && !atLineStart) out.push({ type: "text", text: " " });
        pendingSpace = false;
        atLineStart = false;
        out.push(run);
        continue;
      }
      const parts = String(run.text).split(/[ \t\r\n\f]+/);
      parts.forEach((part, index) => {
        if (index > 0) pendingSpace = true;
        if (!part) return;
        out.push({ type: "text", text: (pendingSpace && !atLineStart ? " " : "") + part });
        pendingSpace = false;
        atLineStart = false;
      });
    }
    // Merge adjacent text runs.
    const merged = [];
    for (const run of out) {
      const previous = merged[merged.length - 1];
      if (run.type === "text" && previous && previous.type === "text") previous.text += run.text;
      else merged.push({ ...run });
    }
    return merged;
  }

  // OCR/JSON round trips can leave doubled backslashes and outer display
  // delimiters (`\\[a=b \\tag{1}\\]`); TeX renderers need the bare body.
  function normalizeDisplayTeX(value) {
    let tex = String(value || "").trim();
    if (/^\\\\[\[(]/.test(tex)) tex = tex.replace(/\\\\(?=[A-Za-z\[\]()])/g, "\\");
    for (const [open, close] of [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]]) {
      if (tex.startsWith(open) && tex.endsWith(close) && tex.length >= open.length + close.length) {
        tex = tex.slice(open.length, -close.length).trim();
      }
    }
    return tex;
  }

  function defaultContentFor(options = {}) {
    const renderMathBox = typeof options.renderMathBox === "function" ? options.renderMathBox : null;
    const parseTocTextRows = typeof options.parseTocTextRows === "function" ? options.parseTocTextRows : null;
    const Render = renderModule();
    const splitTag = Render && Render.splitTeXEquationTag
      ? Render.splitTeXEquationTag
      : (value => ({ body: String(value || ""), number: "" }));

    const translatedRuns = text => collapseRuns(textToRuns(stripControl(text), renderMathBox));
    const sourceTextRuns = text => collapseRuns(textToRuns(stripControl(text), renderMathBox));

    function partRuns(part, useTranslation) {
      const translated = String(part?.translatedText || "");
      if (useTranslation && translated) return textToRuns(stripControl(translated), renderMathBox);
      if (!useTranslation && part?.html) return htmlToRuns(String(part.html), renderMathBox);
      return textToRuns(String(part?.text || ""), renderMathBox);
    }

    return function contentFor(node, mode) {
      const useTranslation = mode === "translation";
      if (node.kind === "stream") {
        const stream = node.source;
        if (node.toc) {
          const sourceTocRows = (stream.items || []).flatMap(item => Array.isArray(item.tocRows) ? item.tocRows : []);
          const translatedTocText = (stream.items || []).map(item => String(item.translatedText || "")).filter(Boolean).join("\n");
          const rows = useTranslation ? (parseTocTextRows ? parseTocTextRows(translatedTocText) : null) : sourceTocRows;
          return { tocRows: rows || [] };
        }
        const paragraphs = (stream.items || []).flatMap(item =>
          Array.isArray(item.paragraphs) && item.paragraphs.length
            ? item.paragraphs
            : [{ parts: item.parts || [item], indent: item.indent || 0 }]);
        return {
          paragraphs: paragraphs.map(paragraph => {
            const parts = Array.isArray(paragraph.parts) ? paragraph.parts : [];
            const runs = [];
            parts.forEach((part, index) => {
              const previous = parts[index - 1];
              if (index && !/[-−–]\s*$/.test(String(previous?.text || ""))) runs.push({ type: "text", text: " " });
              runs.push(...partRuns(part, useTranslation));
            });
            return { runs: collapseRuns(runs), indent: Number(paragraph.indent || 0) };
          })
        };
      }
      const block = node.source;
      if (block.kind === "image") return { image: true };
      if (block.kind === "table" && block.tableHTML) return { table: true };
      if (block.kind === "code") return { code: String(block.text || "") };
      if (block.kind === "formula") {
        const raw = block.formulas?.[0] || block.text || "";
        // Only when a renderer draws the formula: the browser oracle shows the
        // stored string as text, so parity runs keep it verbatim.
        const formula = renderMathBox ? normalizeDisplayTeX(raw) : raw;
        const equation = splitTag(formula);
        const tex = equation.body || formula;
        const box = renderMathBox ? renderMathBox(tex, true) : null;
        return {
          formula: box ? [{ type: "math", tex, display: true, ...box }] : collapseRuns([{ type: "text", text: tex }]),
          number: equation.number ? `(${equation.number})` : ""
        };
      }
      const translated = useTranslation ? String(block.translatedText || "") : "";
      const text = useTranslation
        ? (translated || (block.sourceOnly && block.sourceHTML ? "" : String(block.text || "")))
        : (block.sourceHTML ? "" : String(block.text || ""));
      if (!translated && block.sourceHTML) return { paragraphs: [{ runs: collapseRuns(htmlToRuns(block.sourceHTML, renderMathBox)), indent: 0 }] };
      return { paragraphs: [{ runs: useTranslation ? translatedRuns(text) : sourceTextRuns(text), indent: 0 }] };
    };
  }

  return { renderModule, decodeEntities, stripControl, textToRuns, htmlToRuns, collapseRuns, normalizeDisplayTeX, defaultContentFor };
});
