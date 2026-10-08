// retain-pdf-rendering/render
// Host-agnostic: never reference the host application or plugin globals here.
// Host services (preferences, hashing, abort signals, asset lookup, markdown
// rendering) are passed in by the caller.
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    namespace.Render = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (root) {
  "use strict";

  // Placeholder shown on a page whose translatable blocks have no translation
  // yet. Hosts may replace it through `createRenderer({ awaitingOverlayHTML })`.
  const DEFAULT_AWAITING_OVERLAY_HTML = "<strong>尚无排版译文</strong><span>切换到排版阅读后点击“翻译”，即可生成与原页布局对应的译文。</span>";

  function defaultEscapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function defaultEscapeAttribute(value) {
    return defaultEscapeHTML(value).replace(/`/g, "&#96;");
  }

  function defaultSetElementHTML(target, html) {
    if (!target) return false;
    target.innerHTML = String(html || "");
    return true;
  }

  function splitTeXEquationTag(value) {
    const raw = String(value || "").trim()
      .replace(/^\\\[|\\\]$/g, "")
      .replace(/^\$\$|\$\$$/g, "")
      .trim();
    const match = raw.match(/\\tag\s*\{([^{}]+)\}\s*,?\s*$/);
    if (!match) return { body: raw, number: "" };
    return {
      body: raw.slice(0, match.index).replace(/,\s*$/, "").trim(),
      number: String(match[1] || "").trim()
    };
  }

  /**
   * Create a DOM renderer for layout models.
   *
   * Required:
   * - document: the DOM document that owns the produced nodes.
   * - renderInline(text, { resolveImage }): inline Markdown → HTML string.
   * - renderTeX(tex, displayMode): TeX → HTML string (formula blocks).
   * Optional:
   * - resolveImage(target): image target resolver forwarded to renderInline.
   * - normalizeEscapedTeXDelimiters(text), normalizeBareTeXFragments(text):
   *   repair passes applied to translated text before inline rendering.
   * - setElementHTML(element, html): safe innerHTML assignment.
   * - escapeHTML(value), escapeAttribute(value).
   * - parseTocTextRows(text): parse translated table-of-contents text rows.
   * - debug: boolean or () => boolean; draws source line boxes when true.
   * - awaitingOverlayHTML: markup for pages still awaiting translation.
   * - onPagesBuilt(pageNodes): called by buildLayoutDocument once every page
   *   node exists (hosts attach scaling observers and schedule fitting here).
   *   A per-call `options.onPagesBuilt` takes precedence.
   */
  function createRenderer(config = {}) {
    const document = config.document;
    if (!document || typeof document.createElement !== "function") {
      throw new TypeError("createRenderer requires a DOM document");
    }
    const renderInline = config.renderInline;
    const renderTeX = config.renderTeX;
    if (typeof renderInline !== "function" || typeof renderTeX !== "function") {
      throw new TypeError("createRenderer requires renderInline and renderTeX");
    }
    const resolveImage = config.resolveImage;
    const normalizeEscapedTeXDelimiters = typeof config.normalizeEscapedTeXDelimiters === "function"
      ? config.normalizeEscapedTeXDelimiters
      : null;
    const normalizeBareTeXFragments = typeof config.normalizeBareTeXFragments === "function"
      ? config.normalizeBareTeXFragments
      : null;
    const setElementHTML = typeof config.setElementHTML === "function" ? config.setElementHTML : defaultSetElementHTML;
    const escapeHTML = typeof config.escapeHTML === "function" ? config.escapeHTML : defaultEscapeHTML;
    const escapeAttribute = typeof config.escapeAttribute === "function" ? config.escapeAttribute : defaultEscapeAttribute;
    const parseTocTextRows = typeof config.parseTocTextRows === "function" ? config.parseTocTextRows : null;
    const isDebug = typeof config.debug === "function" ? config.debug : () => Boolean(config.debug);
    const awaitingOverlayHTML = config.awaitingOverlayHTML ?? DEFAULT_AWAITING_OVERLAY_HTML;
    const onPagesBuilt = config.onPagesBuilt;

    function renderLayoutTranslatedText(text) {
      // Layout translations are stored as plain text blocks.  Models can retain
      // TeX but omit its delimiters (for example `\\sigma _ { t }`), which
      // makes the inline renderer show the source literally.  Use the same
      // deliberately narrow repair path used for rendered chat replies.
      // Never trust persisted model text to be DOM-safe. Older cache entries
      // may contain JSON escape artefacts such as U+0008 from `\boldsymbol`.
      const source = [...String(text || "")].filter(character => {
        const code = character.codePointAt(0);
        return code === 9 || code === 10 || code === 13 || (code >= 32 && !(code >= 0xD800 && code <= 0xDFFF));
      }).join("");
      const normalized = normalizeEscapedTeXDelimiters
        ? normalizeEscapedTeXDelimiters(source)
        : source;
      const repaired = normalizeBareTeXFragments
        ? normalizeBareTeXFragments(normalized)
        : normalized;
      return renderInline(repaired, { resolveImage });
    }

    function renderLayoutTocRows(rows) {
      return (rows || []).map(row => {
        if (row?.gap) return '<div class="toc-gap" aria-hidden="true"></div>';
        if (!row?.page) {
          return `<div class="toc-unparsed">${escapeHTML(String(row?.text || ""))}</div>`;
        }
        const level = Math.max(0, Math.min(8, Number(row.level || 0)));
        return (
          `<div class="toc-row toc-level-${level}" style="--toc-level:${level}">` +
          `<span class="toc-label"><span class="toc-number">${escapeHTML(String(row.number || ""))}</span> ` +
          `<span class="toc-title">${escapeHTML(String(row.title || ""))}</span></span>` +
          '<span class="toc-leader" aria-hidden="true"></span>' +
          `<span class="toc-page">${escapeHTML(String(row.page || ""))}</span></div>`
        );
      }).join("");
    }

    function layoutBlockHTML(block, translated, useTranslation = false) {
      if (block.kind === "image" && block.imageURL) {
        return `<img src="${escapeAttribute(block.imageURL)}" alt="" loading="lazy" decoding="async" />`;
      }
      if (block.kind === "table" && block.tableHTML) {
        return `<div class="layout-table-wrap">${block.tableHTML}</div>`;
      }
      if (block.kind === "code") {
        const language = String(block.codeLanguage || "text");
        return (
          `<pre class="layout-code" data-code-language="${escapeAttribute(language)}">` +
          `<code>${escapeHTML(String(block.text || ""))}</code></pre>`
        );
      }
      if (block.kind === "formula") {
        const formula = block.formulas?.[0] || block.text || "";
        const formulaID = block.formulaItems?.[0]?.id || block.id || "";
        const equation = splitTeXEquationTag(formula);
        const number = equation.number
          ? `<span class="layout-equation-number">(${escapeHTML(equation.number)})</span>`
          : "";
        const numberRight = Number(block.numberRight);
        const numberStyle = equation.number && Number.isFinite(numberRight) && Array.isArray(block.bbox)
          ? ` style="--equation-number-right:${(numberRight - Number(block.bbox[0] || 0)).toFixed(2)}px"`
          : "";
        return (
          `<div class="layout-formula-target layout-equation-text${equation.number ? " has-number" : ""}"${numberStyle} ` +
          `data-formula-id="${escapeAttribute(formulaID)}" data-formula-tex="${escapeAttribute(formula)}">` +
          `<span class="layout-equation-formula">${renderTeX(equation.body || formula, true)}</span>${number}</div>`
        );
      }
      if (!translated && block.sourceHTML) return block.sourceHTML;
      return useTranslation
        ? renderLayoutTranslatedText(translated)
        : renderInline(translated, { resolveImage });
    }

    function placeLayoutNode(node, bbox, page) {
      const [left, top, right, bottom] = bbox || [0, 0, 1, 1];
      node.style.left = `${left / page.width * 100}%`;
      node.style.top = `${top / page.height * 100}%`;
      node.style.width = `${Math.max(.1, (right - left) / page.width * 100)}%`;
      node.style.height = `${Math.max(.1, (bottom - top) / page.height * 100)}%`;
    }

    function layoutPartHTML(part, useTranslation) {
      const translated = String(part?.translatedText || "");
      if (useTranslation && translated) return renderLayoutTranslatedText(translated);
      if (!useTranslation && part?.html) return String(part.html);
      return renderInline(String(part?.text || ""), { resolveImage });
    }

    function appendLayoutDebugLines(node, lines, bbox, page) {
      if (!isDebug() || !Array.isArray(lines)) return;
      const width = Math.max(1, Number(bbox?.[2] || 0) - Number(bbox?.[0] || 0));
      const height = Math.max(1, Number(bbox?.[3] || 0) - Number(bbox?.[1] || 0));
      for (const line of lines) {
        if (!Array.isArray(line) || line.length < 4) continue;
        const overlay = document.createElement("span");
        overlay.className = "layout-line-debug-box";
        overlay.style.left = `${(line[0] - bbox[0]) / width * 100}%`;
        overlay.style.top = `${(line[1] - bbox[1]) / height * 100}%`;
        overlay.style.width = `${Math.max(.2, (line[2] - line[0]) / width * 100)}%`;
        overlay.style.height = `${Math.max(.2, (line[3] - line[1]) / height * 100)}%`;
        node.appendChild(overlay);
      }
    }

    function buildFlowStreamNode(stream, page, useTranslation) {
      const node = document.createElement("div");
      const roles = String(stream.debugRole || "text").replace(/[^a-z0-9_-]+/gi, "-");
      node.className = `layout-flow-stream debug-${roles}`;
      if (stream.refsOnly) node.classList.add("refs");
      const fromList = (stream.items || []).some(item => item.fromList || item.parts?.some(part => part.fromList));
      if (fromList) node.classList.add("from-list");
      if (stream.equationDense) node.classList.add("equation-dense");
      const sourceTocRows = (stream.items || []).flatMap(item => Array.isArray(item.tocRows) ? item.tocRows : []);
      const translatedTocText = (stream.items || [])
        .map(item => String(item.translatedText || ""))
        .filter(Boolean)
        .join("\n");
      const tocRows = useTranslation
        ? (parseTocTextRows?.(translatedTocText) || null)
        : (sourceTocRows.length ? sourceTocRows : null);
      const isToc = Boolean(sourceTocRows.length && tocRows?.length);
      if (isToc) node.classList.add("toc-stream");
      const originalLineCount = (stream.items || []).reduce((sum, item) =>
        sum + Number(item.originalLineCount || item.parts?.reduce((partSum, part) => partSum + Number(part.originalLineCount || 0), 0) || 0), 0);
      const paragraphCount = (stream.items || []).reduce((sum, item) =>
        sum + (Array.isArray(item.paragraphs) && item.paragraphs.length ? item.paragraphs.length : 1), 0);
      const originalLines = isToc || (stream.items || []).length > 1 || paragraphCount > 1 || originalLineCount > 1 ? "multi" : "single";
      const [left, , right] = stream.bbox || [0, 0, 0, 0];
      const symmetry = Math.abs(left - (page.width - right)) / Math.max(1, right - left) <= .07;
      node.dataset.flowKind = stream.refsOnly ? "ref_text" : "text";
      node.dataset.styleKind = stream.styleKind || "text";
      node.dataset.bodyInherited = stream.bodyInherited ? "1" : "0";
      node.dataset.originalLines = originalLines;
      node.dataset.singleLineAlign = originalLines === "single" && stream.debugRole === "text" && symmetry ? "center" : "left";
      node.dataset.fromList = fromList ? "1" : "0";
      node.dataset.equationDense = stream.equationDense ? "1" : "0";
      node.dataset.toc = isToc ? "1" : "0";
      node.dataset.columnKey = String(stream.columnKey || "");
      node.dataset.blockID = String(stream.items?.[0]?.id || stream.items?.[0]?.parts?.[0]?.id || "");
      placeLayoutNode(node, stream.bbox, page);
      const baseFont = Math.max(4, Number(stream.fontSize || 7.6));
      const baseLineRatio = Math.max(1, Number(stream.lineHeight || 1.16));
      node.dataset.baseFont = String(baseFont);
      node.dataset.baseLineRatio = String(baseLineRatio);
      // Store fitting values in source-page coordinates while applying styles in
      // the reader's canonical 920px page coordinate system.
      node.dataset.lineRatio = String(baseLineRatio);
      node.dataset.layoutFontScale = "1";
      node.dataset.pageHeight = String(Math.max(1, Number(page.height) || 1));
      node.style.fontSize = `calc(${baseFont}px * var(--layout-scale))`;
      node.style.lineHeight = String(baseLineRatio);
      node.style.setProperty("--para-gap", `${Math.max(0, Number(stream.paragraphGap || .16))}em`);
      if (isToc) {
        setElementHTML(node, renderLayoutTocRows(tocRows));
      }
      else {
        const paragraphs = (stream.items || []).flatMap(item =>
          Array.isArray(item.paragraphs) && item.paragraphs.length
            ? item.paragraphs
            : [{ parts: item.parts || [item], indent: item.indent || 0 }]);
        for (const paragraph of paragraphs) {
          const paragraphNode = document.createElement("div");
          paragraphNode.className = stream.refsOnly ? "flow-ref" : "flow-para";
          const parts = Array.isArray(paragraph.parts) ? paragraph.parts : [];
          if (!stream.refsOnly && Number(paragraph.indent || 0) > 0) {
            paragraphNode.style.textIndent = `calc(${Number(paragraph.indent)}px * var(--layout-scale))`;
          }
          const htmlParts = [];
          for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            const previous = parts[index - 1];
            const separator = index && !/[-−–]\s*$/.test(String(previous?.text || "")) ? " " : "";
            htmlParts.push(separator, layoutPartHTML(part, useTranslation));
          }
          setElementHTML(paragraphNode, htmlParts.join(""));
          for (const part of parts) {
            if (part.id) paragraphNode.dataset.blockID ||= part.id;
          }
          node.appendChild(paragraphNode);
        }
      }
      const debugLines = (stream.items || []).flatMap(item => item.debugLines || item.parts?.flatMap(part => part.debugLines || []) || []);
      appendLayoutDebugLines(node, debugLines, stream.bbox, page);
      return node;
    }

    function buildAbsoluteLayoutNode(block, page, useTranslation) {
      const node = document.createElement("div");
      const safeType = String(block.type || "unknown").replace(/[^a-z0-9_-]+/gi, "-");
      node.className = `layout-block type-${safeType} layout-${block.kind || "text"}`;
      if (block.type === "title") node.classList.add("layout-title");
      if (block.mainTitle) node.classList.add("main-title");
      if (/caption|footnote/.test(block.type || "")) node.classList.add("layout-caption");
      const translatedText = useTranslation ? String(block.translatedText || "") : "";
      placeLayoutNode(node, block.bbox, page);
      const baseFont = Math.max(4, Number(block.fontSize || 8));
      // The fitter uses this metadata for multi-line absolute text; without it,
      // those blocks silently bypass collision and backoff iteration.
      const originalLineCount = Math.max(1, Number(block.lineCount || 1));
      node.dataset.baseFont = String(baseFont);
      node.dataset.baseLineRatio = String(Math.max(1, Number(block.lineHeight || 1.12)));
      node.dataset.lineRatio = node.dataset.baseLineRatio;
      node.dataset.blockKind = String(block.type || "text");
      node.dataset.fitLabel = "";
      if (/^(?:table_caption|table_footnote|chart_caption|image_caption|image_footnote)$/i.test(String(block.type || ""))) {
        // Caption blocks use a tight, frame-relative fill band. Without it the
        // page-wide fallback can treat a caption as already full and skip the
        // font-size and line-height iteration.
        node.dataset.fitBandRatio = "0.120";
      }
      if (String(block.type || "").toLowerCase() === "text") {
        node.dataset.originalLines = originalLineCount > 1 ? "multi" : "single";
        const [left, , right] = block.bbox || [0, 0, 0, 0];
        const symmetric = Math.abs(left - (page.width - right)) / Math.max(1, right - left) <= .07;
        node.dataset.singleLineAlign = node.dataset.originalLines === "single" && symmetric ? "center" : "left";
      }
      node.dataset.layoutFontScale = "1";
      node.dataset.pageHeight = String(Math.max(1, Number(page.height) || 1));
      node.style.fontSize = `calc(${baseFont}px * var(--layout-scale))`;
      if (String(block.kind || "").toLowerCase() === "code") {
        // Code blocks are positioned frames, not flowing content. Keep the
        // pre/code line box tied to the parent so the translated fit pass can
        // compact the frame without changing the geometry of following blocks.
        const codeLineRatio = Math.max(.95, Number(block.lineHeight || 1.18));
        node.dataset.baseLineRatio = String(codeLineRatio);
        node.dataset.lineRatio = node.dataset.baseLineRatio;
        node.style.lineHeight = String(codeLineRatio);
      }
      node.dataset.blockID = block.id || "";
      setElementHTML(
        node,
        layoutBlockHTML(
          block,
          useTranslation
            ? (translatedText || (block.sourceOnly && block.sourceHTML ? "" : String(block.text || "")))
            : (block.sourceHTML ? "" : String(block.text || "")),
          useTranslation
        )
      );
      appendLayoutDebugLines(node, block.debugLines, block.bbox, page);
      return node;
    }

    function layoutTranslationPageState(page, useTranslation) {
      const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
      const hasTranslatableBlocks = blocks.some(block => Boolean(block?.translatable));
      const hasPageTranslation = blocks.some(block => Boolean(block?.translatable && block?.translatedText));
      // Reference-only and media-only pages have no requested translation IDs.
      // Keep rendering their source representation in the translation pane;
      // otherwise a complete bibliography becomes an unexplained blank page.
      const showAwaitingOverlay = Boolean(useTranslation && hasTranslatableBlocks && !hasPageTranslation);
      return { showAwaitingOverlay };
    }

    function buildLayoutDocument(model, useTranslation, options = {}) {
      const root = document.createDocumentFragment();
      const observers = [];
      for (const page of model?.pages || []) {

        // scales the completed page for the reader viewport.  Keeping 920px as
        // a composition width changed glyph hinting, line breaks and every
        // fixed collision tolerance.  The wrapper may still display at up to
        // 920px, but the layout page itself remains in source coordinates.
        const canonicalWidth = Math.max(1, Number(page.width) || 1);
        const wrap = document.createElement("section");
        wrap.className = "layout-page-wrap";
        wrap.dataset.page = String(page.index);
        wrap.dataset.canonicalWidth = String(canonicalWidth);
        wrap.dataset.sourceWidth = String(page.width);
        wrap.dataset.sourceHeight = String(page.height);
        wrap.style.setProperty("--layout-canonical-width", `${canonicalWidth}px`);
        const pageNode = document.createElement("div");
        pageNode.className = "layout-page";
        pageNode.style.width = `${canonicalWidth}px`;
        pageNode.style.aspectRatio = `${page.width} / ${page.height}`;
        pageNode.style.setProperty("--layout-scale", "1");
        pageNode.dataset.sourceWidth = String(page.width);
        pageNode.dataset.sourceHeight = String(page.height);
        const { showAwaitingOverlay } = layoutTranslationPageState(page, useTranslation);
        const restoration = page.restoration;
        // An untranslated page must remain a clean placeholder. Rendering the
        // source blocks with translation coordinates produces an unreadable
        // pile-up while a layout job has not started yet. Once a page has at
        // least one translated block, the normal source fallback behavior is
        // retained for individual blocks that still need retry/fallback.
        if (!showAwaitingOverlay) {
          if (restoration?.streams?.length || restoration?.absoluteBlocks?.length) {
            for (const stream of restoration.streams || []) {
              pageNode.appendChild(buildFlowStreamNode(stream, page, useTranslation));
            }
            for (const block of restoration.absoluteBlocks || []) {
              pageNode.appendChild(buildAbsoluteLayoutNode(block, page, useTranslation));
            }
          }
          else {
            for (const block of page.blocks || []) {
              pageNode.appendChild(buildAbsoluteLayoutNode(block, page, useTranslation));
            }
          }
        }
        if (showAwaitingOverlay) {
          const overlay = document.createElement("div");
          overlay.className = "layout-awaiting-overlay";
          overlay.innerHTML = awaitingOverlayHTML;
          pageNode.appendChild(overlay);
        }
        wrap.append(pageNode);
        root.appendChild(wrap);
        observers.push(pageNode);
      }
      // Observers, scaling and fitting are host concerns: hand over the page
      // nodes once the fragment is complete.
      const pagesBuilt = typeof options.onPagesBuilt === "function" ? options.onPagesBuilt : onPagesBuilt;
      if (typeof pagesBuilt === "function") pagesBuilt(observers);
      return root;
    }


    return {
      buildLayoutDocument,
      buildFlowStreamNode,
      buildAbsoluteLayoutNode,
      layoutBlockHTML,
      layoutPartHTML,
      renderLayoutTranslatedText,
      renderLayoutTocRows,
      placeLayoutNode,
      appendLayoutDebugLines,
      layoutTranslationPageState
    };
  }

  return { createRenderer, splitTeXEquationTag };
});
