// retain-pdf-rendering/fit-model/document.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The fit's node model: building nodes from a layout model (render.js
// buildLayoutDocument), node state accessors (dataset/style equivalents) and
// the selector predicates the passes use (the DOM selectors of fit.js).
(function (root, factory) {
  "use strict";
  const NAME = "document";
  const DEPENDENCIES = [["constants", "./constants"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, constants) {
  "use strict";
  const { CAPTION_TYPES, SANS_TYPES } = constants;

  // ----- node state accessors (dataset/style equivalents) -----

  function isStream(node) { return node.kind === "stream"; }
  function isBlock(node) { return node.kind === "block"; }
  function hasClassDebugText(node) { return isStream(node) && node.debugRole === "text"; }

  function cssLineRatio(node) {
    if (isStream(node)) return node.baseLineRatio;
    const type = String(node.type || "").toLowerCase();
    if (type === "ref_text") return 1.06;
    if (["table_caption", "table_footnote", "chart_caption", "image_caption"].includes(type)) return 1.2;
    return 1.12;
  }

  // .layout-flow-stream.equation-dense { line-height: 1.04 !important }
  function effectiveLineRatio(node) {
    if (node.equationDense) return 1.04;
    return node.style.lineRatio ?? cssLineRatio(node);
  }

  // layoutControlFontSize(): the applied size, else dataset.baseFont.
  function layoutControlFontSize(node, fallback = 8) {
    const rendered = node.style.fontSize;
    return Number.isFinite(rendered) && rendered > 0 ? rendered : (Number(node.baseFont) || fallback);
  }

  // parseFloat(node.style.lineHeight || node.dataset.lineRatio || fallback)
  function controlLineRatio(node, fallback = 1.1) {
    const value = node.style.lineRatio ?? node.lineRatio;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  // fontCap / lineRatioCap are only set by bodyNodeFontCaps (see
  // capBodyNodes); without them every node takes the group's style.
  function applyGroup(nodes, fontSize, lineRatio) {
    for (const node of nodes) {
      if (!node) continue;
      const font = Number.isFinite(node.fontCap) ? Math.min(fontSize, node.fontCap) : fontSize;
      const ratio = Number.isFinite(node.lineRatioCap) ? Math.min(lineRatio, node.lineRatioCap) : lineRatio;
      node.style.fontSize = Number(font.toFixed(2));
      node.style.lineRatio = Number(ratio.toFixed(3));
    }
  }

  // The source bbox never changes during a fit and only style.width can,
  // so the box is cached per width (frozen: callers only read it).
  function nodeBox(node) {
    const cached = node._box;
    if (cached && cached.width === node.style.width) return cached.box;
    const [left, top, right, bottom] = node.bbox;
    const width = node.style.width ?? Math.max(.1, right - left);
    const box = Object.freeze({ left, top, right: left + width, bottom: top + Math.max(.1, bottom - top) });
    node._box = { width: node.style.width, box };
    return box;
  }

  function runsText(runs) {
    return (runs || []).map(run => run.type === "text" ? run.text : run.type === "math" ? "\uFFFC" : "\u2028").join("");
  }

  function fontRole(node) {
    return isBlock(node) && SANS_TYPES.has(String(node.type || "").toLowerCase()) ? "sans" : null;
  }

  // layout.css: titles 700, page headers 600 (both render bold); the other
  // sans nodes are regular. Hosts that paint headings in the body face's bold
  // weight (the Typst overlay, like retain-pdf's resolve_font_weight) pass
  // measurers.bold, which then measures titles instead of sansBold.
  function measurerForNode(ctx, node) {
    if (fontRole(node) !== "sans") return ctx.measurer;
    const type = String(node.type || "").toLowerCase();
    if (type === "title" && ctx.roleMeasurers.bold) return ctx.roleMeasurers.bold;
    const bold = type === "title" || type === "header" || type === "page_header";
    return (bold ? ctx.roleMeasurers.sansBold : ctx.roleMeasurers.sans) || ctx.measurer;
  }

  function textAlign(node) {
    // Fixed when the node is built (profile "retain": left-aligned main title,
    // as retain-pdf sets it).
    if (node.alignOverride) return node.alignOverride;
    if (isStream(node)) {
      if (node.refs || node.fromList || hasClassDebugText(node) || node.toc) return "left";
      return "justify";
    }
    const type = String(node.type || "").toLowerCase();
    if (node.mainTitle) return "center";
    if (type === "title" || type === "page_number" || type === "ref_text") return "left";
    if (["page_header", "header", "footer", "page_footer", "page_footnote"].includes(type)) return "center";
    if (["table_caption", "table_footnote", "chart_caption", "image_caption"].includes(type)) return "left";
    return "justify";
  }

  // ----- selectors -----

  const Select = {
    body: node => isStream(node) && node.styleKind === "body_text" && node.flowKind === "text" && !node.bodyInherited,
    bodyInherited: node => isStream(node) && node.styleKind === "body_text" && node.flowKind === "text" && node.bodyInherited,
    mainTitle: node => isBlock(node) && node.type === "title" && node.mainTitle,
    otherTitle: node => isBlock(node) && node.type === "title" && !node.mainTitle,
    anyTitle: node => isBlock(node) && node.type === "title",
    list: node => isStream(node) && node.fromList && node.flowKind === "text",
    debugTextMulti: node => hasClassDebugText(node) && node.flowKind === "text" && node.originalLines === "multi",
    textBlockMulti: node => isBlock(node) && node.type === "text" && node.originalLines === "multi",
    captionType: type => node => isBlock(node) && node.type === type,
    refs: node => isStream(node) && node.flowKind === "ref_text",
    finalAudit: node => isStream(node) && (node.flowKind === "text" || node.flowKind === "ref_text"),
    falseSingle: node => (hasClassDebugText(node) && node.flowKind === "text" && node.originalLines === "single")
      || (isBlock(node) && node.type === "text" && node.originalLines === "single"),
    code: node => isBlock(node) && node.type === "code",
    formula: node => isBlock(node) && node.layoutKind === "formula",
    columnCandidate: node => isStream(node) || (isBlock(node) && node.type === "text")
  };

  function createDocumentBuilder(ctx) {
    const contentFor = ctx.contentFor;
    const measurerFor = node => measurerForNode(ctx, node);

    // ----- document construction (render.js buildLayoutDocument) -----

    function buildDocument(model, mode) {
      const useTranslation = mode === "translation";
      const pages = [];
      const nodes = [];
      for (const page of model?.pages || []) {
        const pageState = {
          index: page.index,
          width: Number(page.width) || 1,
          height: Number(page.height) || 1,
          nodes: []
        };
        pages.push(pageState);
        const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
        const hasTranslatableBlocks = blocks.some(block => Boolean(block?.translatable));
        const hasPageTranslation = blocks.some(block => Boolean(block?.translatable && block?.translatedText));
        // An untranslated page renders only the awaiting overlay.
        if (useTranslation && hasTranslatableBlocks && !hasPageTranslation) continue;
        const restoration = page.restoration;
        if (restoration?.streams?.length || restoration?.absoluteBlocks?.length) {
          for (const stream of restoration.streams || []) pageState.nodes.push(streamNode(stream, pageState));
          for (const block of restoration.absoluteBlocks || []) pageState.nodes.push(blockNode(block, pageState));
        }
        else {
          for (const block of page.blocks || []) pageState.nodes.push(blockNode(block, pageState));
        }
        for (const node of pageState.nodes) {
          node.order = nodes.length;
          nodes.push(node);
          node.content = prepareContent(node, contentFor(node, mode));
        }
      }
      return { pages, nodes, mode };
    }

    function streamNode(stream, page) {
      const roles = String(stream.debugRole || "text").replace(/[^a-z0-9_-]+/gi, "-");
      const fromList = (stream.items || []).some(item => item.fromList || item.parts?.some(part => part.fromList));
      const sourceTocRows = (stream.items || []).flatMap(item => Array.isArray(item.tocRows) ? item.tocRows : []);
      const originalLineCount = (stream.items || []).reduce((sum, item) =>
        sum + Number(item.originalLineCount || item.parts?.reduce((partSum, part) => partSum + Number(part.originalLineCount || 0), 0) || 0), 0);
      const paragraphCount = (stream.items || []).reduce((sum, item) =>
        sum + (Array.isArray(item.paragraphs) && item.paragraphs.length ? item.paragraphs.length : 1), 0);
      const isTocCandidate = Boolean(sourceTocRows.length);
      const [left, top, right, bottom] = stream.bbox || [0, 0, 0, 0];
      const symmetry = Math.abs(left - (page.width - right)) / Math.max(1, right - left) <= .07;
      const baseFont = Math.max(4, Number(stream.fontSize || 7.6));
      const baseLineRatio = Math.max(1, Number(stream.lineHeight || 1.16));
      const node = {
        kind: "stream",
        source: stream,
        page,
        id: String(stream.items?.[0]?.id || stream.items?.[0]?.parts?.[0]?.id || ""),
        debugRole: roles,
        refs: Boolean(stream.refsOnly),
        fromList,
        equationDense: Boolean(stream.equationDense),
        tocCandidate: isTocCandidate,
        toc: false, // decided once content is known (needs rows in this mode)
        flowKind: stream.refsOnly ? "ref_text" : "text",
        styleKind: stream.styleKind || "text",
        bodyInherited: Boolean(stream.bodyInherited),
        originalLines: "multi",
        singleLineAlign: "left",
        columnKey: String(stream.columnKey || ""),
        bbox: [left, top, right, bottom],
        baseFont,
        baseLineRatio,
        lineRatio: baseLineRatio,
        paragraphGap: Math.max(0, Number(stream.paragraphGap || .16)),
        pageHeight: Math.max(1, page.height),
        fitBandRatio: null,
        style: { fontSize: null, lineRatio: baseLineRatio, width: null, nowrap: false },
        formula: null,
        fit: null
      };
      node.originalLinesSeed = { originalLineCount, paragraphCount, items: (stream.items || []).length, symmetry };
      return node;
    }

    function blockNode(block, page) {
      const type = String(block.type || "unknown");
      const safeType = type.replace(/[^a-z0-9_-]+/gi, "-");
      const baseFont = Math.max(4, Number(block.fontSize || 8));
      const originalLineCount = Math.max(1, Number(block.lineCount || 1));
      const node = {
        kind: "block",
        source: block,
        page,
        id: String(block.id || ""),
        type: safeType,
        blockKind: type,
        layoutKind: String(block.kind || "text"),
        mainTitle: Boolean(block.mainTitle),
        alignOverride: ctx.typography === "retain" && block.mainTitle ? "left" : null,
        title: type === "title",
        caption: /caption|footnote/.test(type),
        flowKind: "",
        styleKind: "",
        bodyInherited: false,
        originalLines: null,
        singleLineAlign: null,
        columnKey: "",
        bbox: (block.bbox || [0, 0, 1, 1]).map(Number),
        baseFont,
        baseLineRatio: Math.max(1, Number(block.lineHeight || 1.12)),
        lineRatio: Math.max(1, Number(block.lineHeight || 1.12)),
        pageHeight: Math.max(1, page.height),
        fitBandRatio: CAPTION_TYPES.slice(0, 5).includes(type) && /^(?:table_caption|table_footnote|chart_caption|image_caption|image_footnote)$/i.test(type) ? 0.12 : null,
        style: { fontSize: null, lineRatio: null, width: null, nowrap: false },
        formula: null,
        fit: null
      };
      if (type.toLowerCase() === "text") {
        node.originalLines = originalLineCount > 1 ? "multi" : "single";
        const [left, , right] = node.bbox;
        const symmetric = Math.abs(left - (page.width - right)) / Math.max(1, right - left) <= .07;
        node.singleLineAlign = node.originalLines === "single" && symmetric ? "center" : "left";
      }
      if (String(block.kind || "").toLowerCase() === "code") {
        // Code blocks are positioned frames, not flowing content. Keep the
        // pre/code line box tied to the parent so the translated fit pass can
        // compact the frame without changing the geometry of following blocks.
        const codeLineRatio = Math.max(.95, Number(block.lineHeight || 1.18));
        node.baseLineRatio = codeLineRatio;
        node.lineRatio = codeLineRatio;
        node.style.lineRatio = codeLineRatio;
      }
      if (block.kind === "formula") {
        const numberRight = Number(block.numberRight);
        node.formula = {
          scale: 1,
          numberRight: Number.isFinite(numberRight) && Array.isArray(block.bbox) ? Number((numberRight - Number(block.bbox[0] || 0)).toFixed(2)) : null
        };
      }
      return node;
    }

    function prepareContent(node, content) {
      const prepared = { raw: content || {} };
      const measurer = measurerFor(node);
      if (node.kind === "stream") {
        const rows = content?.tocRows || null;
        node.toc = Boolean(node.tocCandidate && rows && rows.length);
        if (node.toc) {
          prepared.tocRows = rows.map(row => {
            if (row?.gap) return { gap: true };
            if (!row?.page) return { unparsed: true, labelText: String(row?.text || ""), label: measurer.prepare([{ type: "text", text: String(row?.text || "") }]) };
            const level = Math.max(0, Math.min(8, Number(row.level || 0)));
            const label = `${String(row.number || "")} ${String(row.title || "")}`;
            return {
              level,
              labelText: label,
              label: measurer.prepare([{ type: "text", text: label }]),
              page: measurer.prepare([{ type: "text", text: String(row.page || "") }])
            };
          });
          prepared.paragraphs = [];
        }
        else {
          prepared.paragraphs = (content?.paragraphs || []).map(paragraph => ({
            runs: paragraph.runs || [],
            text: runsText(paragraph.runs),
            indent: Number(paragraph.indent || 0),
            prepared: measurer.prepare(paragraph.runs || [])
          }));
        }
        const seed = node.originalLinesSeed;
        const paragraphCount = node.toc ? seed.paragraphCount : Math.max(seed.paragraphCount, 0);
        node.originalLines = node.toc || seed.items > 1 || paragraphCount > 1 || seed.originalLineCount > 1 ? "multi" : "single";
        node.singleLineAlign = node.originalLines === "single" && node.debugRole === "text" && seed.symmetry ? "center" : "left";
      }
      else if (content?.formula) {
        prepared.formula = measurer.prepare(content.formula);
        prepared.formulaRuns = content.formula;
        prepared.formulaIsText = !content.formula.some(run => run.type === "math");
        prepared.formulaText = runsText(content.formula);
        prepared.number = content.number ? measurer.prepare([{ type: "text", text: content.number }]) : null;
        prepared.numberText = content.number || "";
      }
      else if (typeof content?.code === "string") {
        prepared.code = content.code;
      }
      else if (content?.image || content?.table) {
        prepared.opaque = true;
      }
      else {
        prepared.paragraphs = (content?.paragraphs || []).map(paragraph => ({
          runs: paragraph.runs || [],
          text: runsText(paragraph.runs),
          indent: 0,
          prepared: measurer.prepare(paragraph.runs || [])
        }));
      }
      return prepared;
    }

    return { buildDocument };
  }

  return {
    isStream, isBlock, hasClassDebugText, cssLineRatio, effectiveLineRatio, layoutControlFontSize,
    controlLineRatio, applyGroup, nodeBox, runsText, fontRole, measurerForNode, textAlign, Select,
    createDocumentBuilder
  };
});
