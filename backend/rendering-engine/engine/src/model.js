// retain-pdf-rendering/model
// Host-agnostic: never reference Zotero, LitMTrans or plugin globals here.
// Host services (preferences, hashing, abort signals, asset lookup, markdown
// rendering) are passed in by the caller.
//
// Structure restoration: MinerU layout geometry -> positioned flow streams,
// absolute blocks and a document-wide uniform body/reference style. Pure
// functions; no DOM, runs in plain Node.
//
// Entry points
//   restoreLayoutDocument({ pages, modelPages, resolveAsset, translations,
//       formulaMap, translatableTypes, singleColumnBodyPromotion, checkpoint })
//     -> Promise<{ styles, pages: [{ index, width, height, blocks,
//                  restoration: { streams, absoluteBlocks, ocrBoxes } }] }>
//     pages       MinerU layout.json `pdf_info` pages. They are annotated in
//                 place (page_idx, list flow markers), as the plugin always did.
//     modelPages  MinerU model.json pages (OCR boxes, fallback furniture).
//     resolveAsset(target) -> URL string for an image path ("" if unknown).
//     translations { blockID: translatedText }, formulaMap { formulaID: tex }.
//     translatableTypes  Set of block types that receive translation IDs
//                 (defaults to TRANSLATABLE_LAYOUT_TYPES).
//     singleColumnBodyPromotion  geometry-only single-column body recovery
//                 (default true).
//     checkpoint(index)  optional, awaited at the start of every per-page
//                 pass iteration; hosts use it to honour abort signals and
//                 yield to their event loop. The package never sleeps itself.
//   flattenLayoutPage(page, pageIndex, resolveAsset, translatableTypes)
//     -> { index, width, height, blocks } with stable block/formula IDs.
//   configure({ renderTeX, escapeHTML })
//     Installs host renderers used when source spans become HTML.
//     renderTeX(tex, display) defaults to escaped \(..\) / \[..\] text;
//     escapeHTML defaults to the standard five-entity escape. Configuration
//     is per loaded copy of this module.
// Everything else exported is a pure building block of the same pipeline
// (bbox helpers, text/TOC/code/glossary parsing, column detection, stream
// merging, style solving, absolute visuals).
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    namespace.Model = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (root) {
  "use strict";

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fallbackRenderTeX(source, display = false) {
    const tex = String(source || "");
    return escapeHTML(display ? `\\[${tex}\\]` : `\\(${tex}\\)`);
  }

  // Host renderers. The plugin installs its KaTeX-backed Markdown.renderTeX
  // and Utils.escapeHTML through configure() before building a model.
  const host = { renderTeX: fallbackRenderTeX, escapeHTML };

  function configure(overrides = {}) {
    for (const key of ["renderTeX", "escapeHTML"]) {
      if (typeof overrides?.[key] === "function") host[key] = overrides[key];
    }
  }

  const TRANSLATABLE_LAYOUT_TYPES = new Set([
    "title", "text", "table_caption", "table_footnote", "chart_caption", "image_caption", "image_footnote"
  ]);

  // Isolated, geometry-only recovery for stable single-column papers. Keep
  // this preference separate from the established body classifier so it can
  // be disabled without changing the normal multi-column path.
  const SINGLE_COLUMN_MIN_WIDTH_RATIO = .72;
  const SINGLE_COLUMN_MIN_HEIGHT_RATIO = .025;
  const SINGLE_COLUMN_MIN_SOURCE_LINES = 3;
  const SINGLE_COLUMN_LEFT_TOLERANCE_RATIO = .045;
  const SINGLE_COLUMN_RIGHT_TOLERANCE_RATIO = .055;
  const SINGLE_COLUMN_MIN_SUPPORTING_PAGES = 2;
  const SINGLE_COLUMN_MIN_SUPPORTING_BLOCKS = 3;
  const SINGLE_COLUMN_MIN_SHORT_WIDTH_TO_LANE_RATIO = .20;

  // Treat model output as untrusted transport data. A JSON string containing
  // `\boldsymbol` instead of `\\boldsymbol` is valid JSON, but `\b` becomes
  // U+0008 and must never be handed to the DOM renderer.
  function hasUnsafeControlCharacters(value) {
    for (const character of String(value || "")) {
      const code = character.codePointAt(0);
      if (code === 9 || code === 10 || code === 13) continue;
      if (code < 32 || (code >= 0xD800 && code <= 0xDFFF)) return true;
    }
    return false;
  }

  function sanitizeModelText(value) {
    let output = "";
    for (const character of String(value || "")) {
      const code = character.codePointAt(0);
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && !(code >= 0xD800 && code <= 0xDFFF))) {
        output += character;
      }
    }
    return output;
  }

  function validBBox(value) {
    if (!Array.isArray(value) || value.length < 4) return null;
    const numbers = value.slice(0, 4).map(Number);
    if (numbers.some(number => !Number.isFinite(number))) return null;
    if (numbers[2] <= numbers[0] || numbers[3] <= numbers[1]) return null;
    return numbers;
  }

  function spanText(span) {
    if (!span || typeof span !== "object") return "";
    return String(span.content ?? span.text ?? span.value ?? "");
  }

  function lineText(line) {
    const spans = Array.isArray(line?.spans) ? line.spans : [];
    return spans.map(spanText).join("").trim();
  }

  function blockText(block) {
    const lines = Array.isArray(block?.lines) ? block.lines : [];
    return lines.map(lineText).filter(Boolean).join("\n").trim();
  }


  // MinerU can emit an entire contents page inside one text span, so preserve
  // embedded newlines instead of treating the parser line as one visual row.
  function layoutLogicalLines(lines) {
    if (!Array.isArray(lines)) return [];
    const output = [];
    for (const line of lines) {
      if (!line || typeof line !== "object") continue;
      const fragments = (Array.isArray(line.spans) ? line.spans : [])
        .filter(span => span && typeof span === "object" && spanText(span))
        .map(spanText);
      if (!fragments.length) continue;
      output.push(...fragments.join("").replace(/\r\n?/g, "\n").split("\n"));
    }
    return output;
  }

  function layoutVisualLineCount(lines) {
    const parserLineCount = Array.isArray(lines) ? lines.filter(Boolean).length : 0;
    const logicalLineCount = layoutLogicalLines(lines)
      .filter(line => String(line || "").trim()).length;
    return Math.max(1, parserLineCount, logicalLineCount);
  }

  const TOC_ENTRY_RE = /^\s*(\d+(?:\.\d+)*\.?)\s+(.+?)\s*(?:\.{2,}|…{2,}|·{2,}|-{3,})\s*(\d+|[ivxlcdm]+)\s*$/i;

  function parseTocLogicalLines(logicalLines) {
    const entries = [];
    let nonblank = 0;
    for (const rawLine of logicalLines || []) {
      const text = String(rawLine || "").replace(/\s+/g, " ").trim();
      if (!text) {
        entries.push({ gap: true });
        continue;
      }
      nonblank++;
      const match = text.match(TOC_ENTRY_RE);
      if (!match) {
        entries.push({ text });
        continue;
      }
      const number = match[1];
      entries.push({
        number,
        title: match[2].trim(),
        page: match[3],
        level: Math.max(0, number.replace(/\.$/, "").split(".").filter(Boolean).length - 1)
      });
    }
    const matched = entries.filter(entry => entry.page).length;
    return matched >= 6 && matched / Math.max(1, nonblank) >= .70 ? entries : null;
  }

  function parseTocRows(lines) {
    return parseTocLogicalLines(layoutLogicalLines(lines));
  }

  function parseTocTextRows(text) {
    return parseTocLogicalLines(String(text || "").replace(/\r\n?/g, "\n").split("\n"));
  }


  // trim() on individual lines: leading whitespace is semantic in source code.
  function codeTextFromBlock(block) {
    const codeLines = [];
    const visit = value => {
      if (!value || typeof value !== "object") return;
      for (const line of Array.isArray(value.lines) ? value.lines : []) {
        if (!line || typeof line !== "object") continue;
        codeLines.push((Array.isArray(line.spans) ? line.spans : []).map(spanText).join(""));
      }
      for (const child of Array.isArray(value.blocks) ? value.blocks : []) visit(child);
    };
    visit(block);
    return codeLines.join("\n").replace(/^\n+|\n+$/g, "");
  }

  function delimitedLayoutTeX(content, display = false) {
    let raw = String(content || "").trim();
    if (!raw) return "";
    const wrapped = raw.match(/^\\\[([\s\S]*?)\\\]$|^\\\(([\s\S]*?)\\\)$|^\$\$([\s\S]*?)\$\$$|^\$([\s\S]*?)\$$/);
    if (wrapped) raw = String(wrapped[1] ?? wrapped[2] ?? wrapped[3] ?? wrapped[4] ?? "").trim();
    return display ? `\\[${raw}\\]` : `\\(${raw}\\)`;
  }

  function layoutSpansToTranslationText(spans) {
    if (!Array.isArray(spans)) return "";
    return spans.map(fragment => {
      if (!fragment || typeof fragment !== "object") return "";
      const type = String(fragment.type || "").toLowerCase();
      const content = spanText(fragment);
      if (!content) return "";
      if (["equation_inline", "inline_equation"].includes(type)) return delimitedLayoutTeX(content, false);
      if (["equation_block", "block_equation"].includes(type)) return delimitedLayoutTeX(content, true);
      return safeLayoutTextToHTML(content);
    }).join("");
  }

  function isSymbolGlossaryBlock(block) {
    if (!block || String(block.type || "").toLowerCase() !== "text") return false;
    if (block._layout_symbol_glossary === true) return true;
    const lines = Array.isArray(block.lines) ? block.lines.filter(line => line && typeof line === "object") : [];
    if (lines.length < 8) return false;
    const matched = [];
    let nonempty = 0;
    for (const line of lines) {
      const spans = (Array.isArray(line.spans) ? line.spans : []).filter(span => span && typeof span === "object" && spanText(span).trim());
      if (!spans.length) continue;
      nonempty++;
      const first = spans[0];
      const type = String(first.type || "").toLowerCase();
      const symbolBox = validBBox(first.bbox);
      if (!/(?:equation|formula)/.test(type) || !symbolBox || spanText(first).trim().length > 64) continue;
      const definition = spans.slice(1).find(span => String(span.type || "").toLowerCase() === "text" && validBBox(span.bbox));
      const definitionBox = validBBox(definition?.bbox);
      if (!definitionBox || definitionBox[0] - symbolBox[0] < 16) continue;
      matched.push([symbolBox[0], definitionBox[0]]);
    }
    if (nonempty < 8 || matched.length * 5 < nonempty * 4) return false;
    const symbolLeft = matched.map(row => row[0]);
    const definitionLeft = matched.map(row => row[1]);
    return Math.max(...symbolLeft) - Math.min(...symbolLeft) <= 14
      && Math.max(...definitionLeft) - Math.min(...definitionLeft) <= 20;
  }

  function symbolGlossaryMarkers(block) {
    const markers = [];
    for (const line of Array.isArray(block?.lines) ? block.lines : []) {
      const spans = (Array.isArray(line?.spans) ? line.spans : []).filter(span => span && typeof span === "object" && spanText(span).trim());
      const first = spans[0];
      if (!first || !/(?:equation|formula)/.test(String(first.type || "").toLowerCase())) continue;
      const formula = spanText(first).trim();
      if (formula) markers.push(`\\(${formula}\\)`);
    }
    return markers;
  }

  // Preserve TeX delimiters in formula spans while removing renderer-only HTML
  // before sending text to the model. This differs from the display path,
  // which turns TeX into KaTeX markup immediately.
  function plainBlockText(block) {
    const html = (Array.isArray(block?.lines) ? block.lines : [])
      .map(line => layoutSpansToTranslationText(line?.spans))
      .filter(Boolean)
      .join(isSymbolGlossaryBlock(block) ? "\n\n" : "\n");
    const preserved = html.replace(/<\/?(?:sup|sub)\b[^>]*>/gi, match => match);
    return sanitizeModelText(preserved.replace(/<(?!\/?(?:sup|sub)\b)[^>]+>/gi, "").trim());
  }

  function restoreSymbolGlossaryRowBreaks(record, translatedText) {
    let output = String(translatedText || "");
    if (!record?.symbolGlossary || /\r|\n/.test(output)) return output;
    const markers = Array.isArray(record.symbolMarkers) ? record.symbolMarkers : [];
    if (markers.length < 8) return output;
    const positions = [];
    let cursor = 0;
    for (const marker of markers) {
      const position = output.indexOf(marker, cursor);
      if (position < 0) continue;
      positions.push(position);
      cursor = position + marker.length;
    }
    if (positions.length * 5 < markers.length * 4) return output;
    for (let index = positions.length - 1; index >= 1; index--) {
      output = `${output.slice(0, positions[index])}\n\n${output.slice(positions[index])}`;
    }
    return output;
  }

  function symbolGlossaryParagraphs(item) {
    if (!item?.symbolGlossary || !String(item.translatedText || "").trim()) return [];
    const translatedRows = String(item.translatedText).split(/\r?\n\s*\r?\n+/).map(row => row.trim()).filter(Boolean);
    if (translatedRows.length < 2) return [];
    const sourceHTMLRows = String(item.html || "").split(/<br\s*\/?\s*>/i).map(row => row.trim()).filter(Boolean);
    const sourceTextRows = String(item.text || "").split(/\r?\n/).map(row => row.trim()).filter(Boolean);
    return translatedRows.map((translatedText, index) => ({
      parts: [{
        ...item,
        html: sourceHTMLRows[index] || "",
        text: sourceTextRows[index] || "",
        translatedText
      }],
      indent: 0
    }));
  }

  function formulaSpans(block) {
    const output = [];
    for (const line of Array.isArray(block?.lines) ? block.lines : []) {
      for (const span of Array.isArray(line?.spans) ? line.spans : []) {
        const type = String(span?.type || "").toLowerCase();
        const content = spanText(span).trim();
        if (content && (type.includes("equation") || type.includes("formula") || type.includes("latex"))) {
          output.push(content);
        }
      }
    }
    return output;
  }

  function looksLikeDisplayFormula(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    return /^\\begin\{(?:array|[pbvBV]?matrix)\}/.test(value)
      || /\\(?:frac|dfrac|tfrac|left|right|theta|rho|tag|sum|prod|int|times|quad|mathrm|mathbf)\b/.test(value);
  }

  function imagePathFromBlock(block) {
    const direct = block?.image_path || block?.img_path || block?.image || block?.src;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    for (const line of Array.isArray(block?.lines) ? block.lines : []) {
      for (const span of Array.isArray(line?.spans) ? line.spans : []) {
        const path = span?.image_path || span?.img_path || span?.src;
        if (typeof path === "string" && path.trim()) return path.trim();
      }
    }
    return "";
  }

  function inferFontSize(block, bbox, text, lineCount) {
    const height = Math.max(1, bbox[3] - bbox[1]);
    const width = Math.max(1, bbox[2] - bbox[0]);
    const type = String(block?.type || "").toLowerCase();
    let size = height / Math.max(1, lineCount || 1) * 0.72;
    const estimatedLineChars = Math.max(8, width / Math.max(4, size * 0.52));
    const estimatedLines = Math.max(1, Math.ceil(String(text || "").length / estimatedLineChars));
    if (estimatedLines > Math.max(1, lineCount || 1)) size *= Math.sqrt(Math.max(1, lineCount || 1) / estimatedLines);
    if (type === "title") size *= 1.12;
    if (type.includes("caption") || type.includes("footnote")) size *= 0.9;
    return Math.max(5.5, Math.min(type === "title" ? 28 : 18, size));
  }

  function normalizePageSize(page, blocks) {
    const size = page?.page_size;
    if (Array.isArray(size) && Number(size[0]) > 0 && Number(size[1]) > 0) return [Number(size[0]), Number(size[1])];
    const width = Number(page?.width || page?.page_width || 0);
    const height = Number(page?.height || page?.page_height || 0);
    if (width > 0 && height > 0) return [width, height];
    let maxX = 595;
    let maxY = 842;
    for (const block of blocks) {
      const bbox = validBBox(block?.bbox);
      if (bbox) {
        maxX = Math.max(maxX, bbox[2]);
        maxY = Math.max(maxY, bbox[3]);
      }
    }
    return [maxX, maxY];
  }

  function safeLayoutTextToHTML(text) {
    return host.escapeHTML(String(text || ""))
      // The workbench document is XHTML.  A bare HTML <br> makes assigning
      // this snippet to innerHTML throw NS_ERROR_DOM_SYNTAX_ERR in Gecko.
      .replace(/\n/g, "<br />")
      .replace(/&amp;lt;(\/?)(sup|sub|br)&amp;gt;/gi, "&lt;$1$2&gt;")
      .replace(/&amp;lt;br\s*\/&amp;gt;/gi, "&lt;br/&gt;")
      .replace(/&lt;(sup|sub|br)&gt;/gi, "<$1>")
      .replace(/&lt;\/(sup|sub|br)&gt;/gi, "</$1>")
      .replace(/&lt;(br)\s*\/&gt;/gi, "<$1 />");
  }

  function layoutSpansToHTML(spans) {
    if (!Array.isArray(spans)) return "";
    return spans.map(fragment => {
      if (!fragment || typeof fragment !== "object") return "";
      const type = String(fragment.type || "").toLowerCase();
      const content = spanText(fragment);
      if (!content) return "";
      if (["equation_inline", "inline_equation"].includes(type)) return host.renderTeX(content, false);
      if (["equation_block", "block_equation"].includes(type)) return host.renderTeX(content, true);
      return safeLayoutTextToHTML(content);
    }).join("");
  }

  function layoutLinesToHTML(lines, reflow = false) {
    if (!Array.isArray(lines)) return "";
    const rendered = [];
    const plain = [];
    for (const line of lines) {
      if (!line || typeof line !== "object") continue;
      const html = layoutSpansToHTML(line.spans).trim();
      if (!html) continue;
      rendered.push(html);
      plain.push(String(lineText(line) || "").trim());
    }
    if (!reflow) return rendered.join("<br />");
    if (!rendered.length) return "";
    const parts = [rendered[0]];
    for (let index = 1; index < rendered.length; index++) {
      const previous = plain[index - 1].trimEnd();
      const current = plain[index].trimStart();
      if (/[-−–]$/.test(previous)) {
        if (/^[a-z]/.test(current)) {
          parts[parts.length - 1] = parts[parts.length - 1]
            .replace(/[-−–](\s*(?:<\/(?:span|sup|sub|em|strong|i|b)>)*\s*)$/i, "$1");
        }
      }
      else {
        parts.push(" ");
      }
      parts.push(rendered[index]);
    }
    return parts.join("");
  }

  function normalizeLayoutHTMLSnippet(value) {
    return String(value || "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "")
      .replace(/<eq>([\s\S]*?)<\/eq>/gi, (_match, tex) => host.renderTeX(tex, false));
  }

  function bboxWidth(bbox) {
    return Math.max(0, Number(bbox?.[2] || 0) - Number(bbox?.[0] || 0));
  }

  function bboxHeight(bbox) {
    return Math.max(0, Number(bbox?.[3] || 0) - Number(bbox?.[1] || 0));
  }

  function bboxCenter(bbox) {
    return [
      (Number(bbox?.[0] || 0) + Number(bbox?.[2] || 0)) / 2,
      (Number(bbox?.[1] || 0) + Number(bbox?.[3] || 0)) / 2
    ];
  }

  function bboxUnion(boxes) {
    const valid = (boxes || []).map(validBBox).filter(Boolean);
    if (!valid.length) return [0, 0, 0, 0];
    return [
      Math.min(...valid.map(box => box[0])),
      Math.min(...valid.map(box => box[1])),
      Math.max(...valid.map(box => box[2])),
      Math.max(...valid.map(box => box[3]))
    ];
  }

  function bboxArea(bbox) {
    return bboxWidth(bbox) * bboxHeight(bbox);
  }

  function bboxContainedOverlapRatio(inner, outer) {
    const left = Math.max(Number(inner?.[0] || 0), Number(outer?.[0] || 0));
    const top = Math.max(Number(inner?.[1] || 0), Number(outer?.[1] || 0));
    const right = Math.min(Number(inner?.[2] || 0), Number(outer?.[2] || 0));
    const bottom = Math.min(Number(inner?.[3] || 0), Number(outer?.[3] || 0));
    return Math.max(0, right - left) * Math.max(0, bottom - top) / Math.max(1, bboxArea(inner));
  }

  function medianValue(values, fallback) {
    const numbers = (values || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!numbers.length) return fallback;
    const middle = Math.floor(numbers.length / 2);
    return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
  }

  function streamSideForBBox(bbox, pageWidth) {
    const width = bboxWidth(bbox);
    const center = (Number(bbox[0]) + Number(bbox[2])) / 2;
    if (width > pageWidth * 0.55) return "full";
    return center < pageWidth / 2 ? "left" : "right";
  }

  function estimateLayoutFontSize(blockType, bbox, text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    const width = Math.max(18, bboxWidth(bbox));
    const height = Math.max(10, bboxHeight(bbox));
    const base = Math.sqrt(width * height / Math.max(1, normalized.length * 0.62));
    const type = String(blockType || "").toLowerCase();
    const multiplier = {
      title: .9, abstract: .94, abstract_title: .94, text: .94, header: .92, page_header: .92,
      author: .92, affiliation: .90, footer: .9, page_footer: .9, page_number: .88, ref_text: .98,
      table_caption: .95, chart_caption: .95, image_caption: .95, image_footnote: .92
    }[type] ?? .92;
    const limits = {
      title: [9.5, 13], abstract_title: [9.0, 12.0], abstract: [7.8, 11.5], text: [7.2, 11],
      author: [7.4, 10.5], affiliation: [7.0, 9.8], header: [7.8, 11], page_header: [7.8, 11],
      footer: [7.2, 10], page_footer: [7.2, 10], page_number: [7.2, 10],
      ref_text: [7, 9.4], table_caption: [7, 10], chart_caption: [7, 10], image_caption: [7, 10], image_footnote: [6.4, 8.8]
    }[type] || [7.2, 11];
    return Math.max(limits[0], Math.min(limits[1], base * multiplier));
  }

  function fixedLayoutFontSize(blockType) {
    return ({
      table_caption: 7.6,
      table_footnote: 7.2,
      chart_caption: 7.6,
      image_caption: 7.6,
      image_footnote: 7.2,
      text: 7.6,
    })[String(blockType || "").toLowerCase()] ?? null;
  }

  function modelBBoxToPageBBox(bbox, pageWidth, pageHeight) {
    return [
      Number(bbox[0]) * pageWidth,
      Number(bbox[1]) * pageHeight,
      Number(bbox[2]) * pageWidth,
      Number(bbox[3]) * pageHeight
    ];
  }

  function collectModelOCRBoxes(modelPage, pageWidth, pageHeight) {
    if (!Array.isArray(modelPage)) return [];
    const output = [];
    const visit = value => {
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
        return;
      }
      if (!value || typeof value !== "object") return;
      if (String(value.type || "").toLowerCase() === "ocr_text") {
        const bbox = validBBox(value.bbox);
        if (bbox) {
          output.push(Math.max(...bbox.map(Math.abs)) <= 1.5 ? modelBBoxToPageBBox(bbox, pageWidth, pageHeight) : bbox);
        }
      }
      for (const key of ["blocks", "lines", "spans", "children"]) {
        if (value[key]) visit(value[key]);
      }
    };
    visit(modelPage);
    return output;
  }

  function ocrBoxesInRegion(ocrBoxes, bbox, padding = 2) {
    const [x0, y0, x1, y1] = [
      bbox[0] - padding, bbox[1] - padding, bbox[2] + padding, bbox[3] + padding
    ];
    return (ocrBoxes || []).filter(box => {
      const [cx, cy] = bboxCenter(box);
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    });
  }

  function estimateFirstLineIndent(bbox, ocrBoxes) {
    const hits = ocrBoxesInRegion(ocrBoxes, bbox, 1.5)
      .sort((a, b) => bboxCenter(a)[1] - bboxCenter(b)[1] || a[0] - b[0]);
    if (hits.length < 3) return 0;
    const firstCenter = bboxCenter(hits[0])[1];
    const typicalHeight = medianValue(hits.map(bboxHeight), 8);
    const tolerance = Math.max(2.5, Math.min(6, typicalHeight * .55));
    const firstLine = hits.filter(box => Math.abs(bboxCenter(box)[1] - firstCenter) <= tolerance);
    const later = hits.filter(box => !firstLine.includes(box));
    if (!later.length) return 0;
    const indent = Math.min(...firstLine.map(box => box[0])) - medianValue(later.map(box => box[0]), bbox[0]);
    if (indent < 5) return 0;
    return Math.round(Math.min(indent, Math.max(10, bboxWidth(bbox) * .18)) * 100) / 100;
  }

  function refinedTextBBoxFromOCR(bbox, ocrBoxes) {
    const hits = ocrBoxesInRegion(ocrBoxes, bbox, 1.5);
    if (!hits.length) return [...bbox];
    const content = bboxUnion(hits);
    return [
      Math.min(bbox[0], content[0] - 1),
      bbox[1],
      Math.max(bbox[2], content[2] + 1),
      Math.min(bbox[3], content[3] + 2)
    ];
  }

  function collectMediaCarrierBoxes(blocks) {
    const output = [];
    const visit = value => {
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
        return;
      }
      if (!value || typeof value !== "object") return;
      const type = String(value.type || "").toLowerCase();
      const children = Array.isArray(value.blocks) ? value.blocks.filter(Boolean) : [];
      const bbox = validBBox(value.bbox);
      if (bbox && (
        ["table_body", "chart_body", "image_body", "interline_equation", "equation"].includes(type)
        || (["table", "chart", "image"].includes(type) && !children.length)
      )) output.push(bbox);
      for (const child of children) visit(child);
    };
    visit(blocks);
    return output;
  }

  function isLayoutMetadataText(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    return Boolean(
      /^(pacs|keywords?|doi)\s*[:：]/i.test(text)
      || /^pacs\s*(编号|号|分类号|代码|编码)?\s*[:：]/i.test(text)
      || /^(关键词|关键字|数字对象标识符)\s*[:：]/.test(text)
      || lower.startsWith("pacs numbers")
      || lower.startsWith("published under an exclusive license")
      || ["cite as:", "citation:", "submitted:", "accepted:", "published online:", "online publication:"].some(token => lower.startsWith(token))
      || lower.startsWith("authors to whom correspondence")
      || lower.startsWith("author to whom correspondence")
      || lower.includes("all rights reserved")
      || lower.includes("elsevier")
      || lower.includes("copyright")
      || /^(?:©|\(c\)|Ⓒ)/i.test(text)
    );
  }

  function looksLikeBodyProseEvidence(text, item, pageWidth, pageHeight) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const lower = normalized.toLowerCase();
    if (!normalized || isLayoutMetadataText(normalized)) return false;
    if ([
      "articles you may be interested in", "citation:", "view online:",
      "view table of contents:", "published by "
    ].some(token => lower.startsWith(token))) return false;
    if (/https?:\/\/|www\./i.test(lower)) return false;
    const bbox = item.bbox || [0, 0, 0, 0];
    if (!["left", "right"].includes(streamSideForBBox(bbox, pageWidth))) return false;
    if (bbox[1] < pageHeight * .25) return false;
    if (Number(item.originalLineCount || 0) < 2 && bboxHeight(bbox) <= pageHeight * .025) return false;
    const words = normalized.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
    const cjk = normalized.match(/[\u3400-\u9fff]/g) || [];
    const sentences = (normalized.match(/[.!?。！？]/g) || []).length;
    return (words.length >= 32 && normalized.length >= 180 && sentences >= 2)
      || (cjk.length >= 80 && sentences >= 2);
  }

  function isBodyTextCandidate(text, bbox, pageWidth, pageHeight) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const lower = normalized.toLowerCase();
    if (!normalized || isLayoutMetadataText(normalized)) return false;
    if (lower.startsWith("received ") || lower.startsWith("(received ")) return false;
    if (streamSideForBBox(bbox, pageWidth) === "full") return false;
    return bbox[1] >= pageHeight * .33;
  }

  function looksLikeContinuation(previousText, currentText) {
    const previous = String(previousText || "").trim();
    const current = String(currentText || "").trim();
    if (!previous || !current || /[.!?:;]$/.test(previous)) return false;
    return /^[a-z(\[]/.test(current)
      || /^(and|or|but|with|which|that|where|when|while|whose|who|of|to)\b/i.test(current)
      || /^[,.)\]}]/.test(current);
  }

  function assignLayoutColumnKeys(items, pageWidth) {
    const candidates = items
      .map(item => [Number(item.bbox?.[0]), bboxWidth(item.bbox)])
      .filter(([left, width]) => Number.isFinite(left) && width >= pageWidth * .12 && width <= pageWidth * .82);
    if (!candidates.length) {
      for (const item of items) item.columnKey = item.side || "full";
      return;
    }
    const tolerance = Math.max(8, Math.min(20, medianValue(candidates.map(row => row[1]), pageWidth * .3) * .08));
    const anchors = [];
    for (const [left] of candidates.sort((a, b) => a[0] - b[0])) {
      if (!anchors.length || Math.abs(left - anchors[anchors.length - 1]) > tolerance) anchors.push(left);
      else anchors[anchors.length - 1] = (anchors[anchors.length - 1] + left) / 2;
    }
    for (const item of items) {
      if (!validBBox(item.bbox) || bboxWidth(item.bbox) > pageWidth * .82) {
        item.columnKey = "full";
        continue;
      }
      let nearest = 0;
      for (let index = 1; index < anchors.length; index++) {
        if (Math.abs(item.bbox[0] - anchors[index]) < Math.abs(item.bbox[0] - anchors[nearest])) nearest = index;
      }
      item.columnKey = `column-${nearest}`;
    }
  }

  function bodyColumnProfiles(items, pageWidth, pageHeight) {
    const profiles = {};
    for (const item of items) {
      if (item.kind !== "text" || item.symbolGlossary || item.fromList) continue;
      if (!looksLikeBodyProseEvidence(item.roleText || item.text, item, pageWidth, pageHeight)) continue;
      if (item.columnKey === "full") continue;
      (profiles[item.columnKey] ||= []).push([item.bbox[0] / pageWidth, item.bbox[2] / pageWidth]);
    }
    return profiles;
  }

  function matchesBodyColumnProfile(item, pageWidth, profiles) {
    const candidates = profiles?.[item.columnKey] || [];
    const left = item.bbox[0] / pageWidth;
    const right = item.bbox[2] / pageWidth;
    const width = Math.max(.001, right - left);
    return candidates.some(([refLeft, refRight]) => {
      const refWidth = Math.max(.001, refRight - refLeft);
      return Math.abs(left - refLeft) <= .10 && right <= refRight + .10 && width >= refWidth * .42;
    });
  }

  function bboxMatchesColumn(anchor, bbox) {
    const tolerance = Math.max(18, bboxWidth(anchor) * .08);
    const leftDelta = Math.abs(bbox[0] - anchor[0]);
    const rightDelta = Math.abs(bbox[2] - anchor[2]);
    if (leftDelta <= tolerance && rightDelta <= tolerance) return true;
    return leftDelta <= tolerance && bbox[2] <= anchor[2] + tolerance && bboxWidth(bbox) >= bboxWidth(anchor) * .45;
  }

  function isEarlyFrontMatterItem(item, pageHeight, hasPreviousBody) {
    return !hasPreviousBody && item.bbox[1] <= pageHeight * .55 && Number(item.originalLineCount || 0) <= 1;
  }

  function promoteTextItemsToBody(items, pageWidth, pageHeight, context = {}) {
    const hasPreviousBody = Boolean(context.hasPreviousBody);
    const pageHasBodyProse = items.some(item => item.kind === "text" && !item.symbolGlossary && !item.fromList
      && looksLikeBodyProseEvidence(item.roleText || item.text, item, pageWidth, pageHeight));
    if (!pageHasBodyProse && !hasPreviousBody) return items;
    const seeds = {};
    const bodyCandidate = item => {
      if (isBodyTextCandidate(item.roleText || item.text, item.bbox, pageWidth, pageHeight)) return true;
      return Number(item.pageIndex || 0) >= 2 && item.columnKey !== "full" && !isLayoutMetadataText(item.roleText || item.text);
    };
    const seedEligible = item => Number(item.originalLineCount || 0) > 1
      || bboxHeight(item.bbox) > pageHeight * .035
      || bboxWidth(item.bbox) > pageWidth * .48;
    for (const item of items) {
      if (item.kind !== "text" || item.symbolGlossary || item.debugRole === "toc" || item.fromList || isLayoutMetadataText(item.roleText || item.text)
        || isEarlyFrontMatterItem(item, pageHeight, hasPreviousBody)) continue;
      if (bodyCandidate(item) && seedEligible(item) && item.columnKey !== "full") {
        (seeds[item.columnKey] ||= []).push(item.bbox);
      }
    }
    return items.map(original => {
      if (original.kind !== "text" || original.symbolGlossary || original.debugRole === "toc" || original.fromList || isLayoutMetadataText(original.roleText || original.text)
        || isEarlyFrontMatterItem(original, pageHeight, hasPreviousBody)) return original;
      const item = { ...original };
      if (bodyCandidate(item) && seedEligible(item)) item.debugRole = "body_candidate";
      else if ((seeds[item.columnKey] || []).some(anchor => bboxMatchesColumn(anchor, item.bbox))) item.debugRole = "body_candidate";
      else if (hasPreviousBody && bodyCandidate(item)
        && matchesBodyColumnProfile(item, pageWidth, context.neighborColumnProfiles || {})) item.debugRole = "body_candidate";
      return item;
    });
  }

  function inferSingleColumnProfile(pages) {
    const candidates = [];
    for (const [pageIndex, page] of (pages || []).entries()) {
      if (!page || typeof page !== "object") continue;
      const [pageWidth, pageHeight] = normalizePageSize(page, page.preproc_blocks || []);
      for (const block of Array.isArray(page.preproc_blocks) ? page.preproc_blocks : []) {
        if (String(block?.type || "").toLowerCase() !== "text") continue;
        const bbox = validBBox(block.bbox);
        const sourceLines = Array.isArray(block.lines) ? block.lines.length : 0;
        if (!bbox || sourceLines < SINGLE_COLUMN_MIN_SOURCE_LINES) continue;
        if (bboxWidth(bbox) / pageWidth < SINGLE_COLUMN_MIN_WIDTH_RATIO
          || bboxHeight(bbox) / pageHeight < SINGLE_COLUMN_MIN_HEIGHT_RATIO) continue;
        candidates.push({ pageIndex, left: bbox[0] / pageWidth, right: bbox[2] / pageWidth });
      }
    }
    let best = [];
    for (const candidate of candidates) {
      const cluster = candidates.filter(other =>
        Math.abs(other.left - candidate.left) <= SINGLE_COLUMN_LEFT_TOLERANCE_RATIO
        && Math.abs(other.right - candidate.right) <= SINGLE_COLUMN_RIGHT_TOLERANCE_RATIO);
      if (cluster.length > best.length) best = cluster;
    }
    const supportingPages = new Set(best.map(candidate => candidate.pageIndex));
    if (best.length < SINGLE_COLUMN_MIN_SUPPORTING_BLOCKS
      || supportingPages.size < SINGLE_COLUMN_MIN_SUPPORTING_PAGES) return null;
    return {
      leftRatio: best.reduce((sum, candidate) => sum + candidate.left, 0) / best.length,
      rightRatio: best.reduce((sum, candidate) => sum + candidate.right, 0) / best.length,
      supportingPages,
      supportingBlocks: best.length
    };
  }

  function singleColumnProfileMatches(profile, bbox, pageWidth, pageHeight, sourceLines) {
    const box = validBBox(bbox);
    if (!profile || !box || pageWidth <= 0 || pageHeight <= 0
      || Number(sourceLines || 0) < SINGLE_COLUMN_MIN_SOURCE_LINES
      || bboxHeight(box) / pageHeight < SINGLE_COLUMN_MIN_HEIGHT_RATIO
      || bboxWidth(box) / pageWidth < SINGLE_COLUMN_MIN_WIDTH_RATIO) return false;
    return Math.abs(box[0] / pageWidth - profile.leftRatio) <= SINGLE_COLUMN_LEFT_TOLERANCE_RATIO
      && Math.abs(box[2] / pageWidth - profile.rightRatio) <= SINGLE_COLUMN_RIGHT_TOLERANCE_RATIO;
  }

  function promoteStableSingleColumnItems(items, pageWidth, pageHeight, profile) {
    if (!profile) return items;
    return items.map(original => {
      if (original.kind !== "text" || original.fromList || original.symbolGlossary || original.debugRole === "toc"
        || !singleColumnProfileMatches(profile, original.bbox, pageWidth, pageHeight, original.originalLineCount)) return original;
      return { ...original, debugRole: "body_candidate", columnKey: "single-column" };
    });
  }

  function pageHasParallelReadingLanes(items, pageWidth, pageHeight) {
    const lanes = items.filter(item => item.kind === "text" && !item.fromList
      && Number(item.originalLineCount || 0) >= SINGLE_COLUMN_MIN_SOURCE_LINES
      && validBBox(item.bbox)
      && bboxWidth(item.bbox) / pageWidth >= .18
      && bboxWidth(item.bbox) / pageWidth <= .72
      && bboxHeight(item.bbox) / pageHeight >= SINGLE_COLUMN_MIN_HEIGHT_RATIO);
    for (let index = 0; index < lanes.length; index++) {
      for (const other of lanes.slice(index + 1)) {
        const first = lanes[index].bbox;
        const second = other.bbox;
        const verticalOverlap = Math.min(first[3], second[3]) - Math.max(first[1], second[1]);
        const minimumHeight = Math.min(bboxHeight(first), bboxHeight(second));
        const horizontalGap = Math.max(first[0], second[0]) - Math.min(first[2], second[2]);
        if (minimumHeight > 0 && verticalOverlap >= minimumHeight * .20 && horizontalGap >= pageWidth * .035) return true;
      }
    }
    return false;
  }

  function pageHasSingleColumnAnchor(items, pageWidth, pageHeight, profile) {
    return items.some(item => item.kind === "text" && singleColumnProfileMatches(
      profile, item.bbox, pageWidth, pageHeight, item.originalLineCount));
  }

  function inheritStableSingleColumnShortItems(items, pageWidth, pageHeight, profile) {
    if (!profile || !pageHasSingleColumnAnchor(items, pageWidth, pageHeight, profile)
      || pageHasParallelReadingLanes(items, pageWidth, pageHeight)) return items;
    const laneWidth = Math.max(1, (profile.rightRatio - profile.leftRatio) * pageWidth);
    return items.map(original => {
      if (original.kind !== "text" || original.fromList || original.symbolGlossary || original.debugRole !== "text"
        || Number(original.pageIndex || 0) <= 0 || !validBBox(original.bbox)
        || ![1, 2].includes(Number(original.originalLineCount || 0))) return original;
      const [left, , right] = original.bbox;
      const leftMatches = Math.abs(left / pageWidth - profile.leftRatio) <= SINGLE_COLUMN_LEFT_TOLERANCE_RATIO;
      const staysInside = right / pageWidth <= profile.rightRatio + SINGLE_COLUMN_RIGHT_TOLERANCE_RATIO;
      if (!leftMatches || !staysInside || bboxWidth(original.bbox) < laneWidth * SINGLE_COLUMN_MIN_SHORT_WIDTH_TO_LANE_RATIO) {
        return original;
      }
      // This role inherits the body baseline but never participates in the
      // baseline solver, so a narrow derivation transition cannot shrink the
      // entire document. The first page remains on the legacy path to protect
      // author, affiliation, and address panels.
      return { ...original, debugRole: "body_inherited", columnKey: "single-column" };
    });
  }

  function layoutBarrierBoxes(blocks) {
    const output = [];
    const queue = [...(blocks || [])];
    while (queue.length) {
      const block = queue.shift();
      if (!block || typeof block !== "object") continue;
      const bbox = validBBox(block.bbox);
      if (bbox) output.push(bbox);
      for (const child of Array.isArray(block.blocks) ? block.blocks : []) queue.push(child);
    }
    return output;
  }

  function horizontalOverlapRatio(a, b) {
    const overlap = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
    return overlap / Math.max(1, Math.min(bboxWidth(a), bboxWidth(b)));
  }

  function bodyMergeBlockedByBarrier(merged, next, barriers, blockingItems) {
    if (next[1] <= merged[3]) return false;
    const column = [Math.min(merged[0], next[0]), merged[1], Math.max(merged[2], next[2]), next[3]];
    const boxes = [...(barriers || []), ...(blockingItems || []).map(item => item.bbox).filter(validBBox)];
    return boxes.some(box => horizontalOverlapRatio(column, box) >= .18 && box[1] < next[1] && box[3] > merged[3]);
  }

  function bodyMergeCreatesBarrierIntrusion(parts, next, barriers) {
    const sourceBoxes = [...parts.map(part => part.bbox).filter(validBBox), next];
    const merged = bboxUnion(sourceBoxes);
    return (barriers || []).some(barrier => {
      const hx = Math.min(merged[2], barrier[2]) - Math.max(merged[0], barrier[0]);
      const vy = Math.min(merged[3], barrier[3]) - Math.max(merged[1], barrier[1]);
      if (hx < 8 || vy < 3) return false;
      return !sourceBoxes.some(box =>
        Math.min(box[2], barrier[2]) - Math.max(box[0], barrier[0]) >= 8
        && Math.min(box[3], barrier[3]) - Math.max(box[1], barrier[1]) >= 3);
    });
  }

  function singleLineBodyItemsAreAdjacent(previous, current) {
    if (Number(previous.originalLineCount || 0) !== 1 && Number(current.originalLineCount || 0) !== 1) return false;
    const gap = current.bbox[1] - previous.bbox[3];
    if (gap > Math.max(14, Math.min(bboxHeight(previous.bbox), bboxHeight(current.bbox)) * 1.5)) return false;
    const tolerance = Math.max(18, bboxWidth(previous.bbox) * .08, bboxWidth(current.bbox) * .08);
    return (Math.abs(previous.bbox[0] - current.bbox[0]) <= tolerance
      || Math.abs(previous.bbox[2] - current.bbox[2]) <= tolerance)
      && horizontalOverlapRatio(previous.bbox, current.bbox) >= .45;
  }

  function mergedPartIndent(part, mergedBBox) {
    const explicit = Number(part.indent || 0);
    if (explicit > 0) return explicit;
    const debugLines = (part.debugLines || []).filter(validBBox);
    let firstLineLeft = null;
    if (debugLines.length) {
      const firstTop = Math.min(...debugLines.map(line => line[1]));
      const firstLine = debugLines.filter(line => Math.abs(line[1] - firstTop) <= 3);
      firstLineLeft = Math.min(...firstLine.map(line => line[0]));
    }
    else if (validBBox(part.bbox)) firstLineLeft = part.bbox[0];
    if (firstLineLeft == null) return 0;
    const indent = firstLineLeft - mergedBBox[0];
    if (indent < 5) return 0;
    return Math.round(Math.min(indent, Math.max(10, bboxWidth(mergedBBox) * .18)) * 100) / 100;
  }

  function mergedBodyParagraphs(parts, mergedBBox = null) {
    const box = validBBox(mergedBBox) || bboxUnion(parts.map(part => part.bbox));
    const paragraphs = [];
    let current = null;
    for (const part of parts) {
      if (!current) current = { parts: [part], indent: mergedPartIndent(part, box) };
      else {
        // Use translated wording for paragraph boundaries because punctuation
        // can change and alter whether adjacent parsed fragments belong to one
        // paragraph.
        const previousText = current.parts.map(translatedFlowPlainText).join(" ").trim();
        const currentText = translatedFlowPlainText(part);
        if (/[-−–]$/.test(previousText) || looksLikeContinuation(previousText, currentText)) current.parts.push(part);
        else {
          paragraphs.push(current);
          current = { parts: [part], indent: mergedPartIndent(part, box) };
        }
      }
    }
    if (current) paragraphs.push(current);
    return paragraphs;
  }

  function mergeVerticalBodyItems(items, absoluteBlocks) {
    const body = items.filter(item => item.kind === "text" && item.debugRole === "body_candidate");
    const other = items.filter(item => !(item.kind === "text" && item.debugRole === "body_candidate"));
    const barriers = layoutBarrierBoxes(absoluteBlocks);
    const blockers = other.filter(item => item.kind === "text");
    const result = body.filter(item => item.columnKey === "full");
    const emitMerged = parts => {
      const box = bboxUnion(parts.map(part => part.bbox));
      result.push({
        kind: "text",
        side: parts[0].side,
        columnKey: parts[0].columnKey,
        bbox: box,
        text: parts.map(part => part.text).join("\n\n"),
        roleText: parts.map(part => part.roleText || part.text).join("\n\n"),
        originalLineCount: parts.reduce((sum, part) => sum + Number(part.originalLineCount || 0), 0),
        pageIndex: parts[0].pageIndex,
        debugRole: "merged_body",
        parts,
        paragraphs: mergedBodyParagraphs(parts, box),
        debugLines: parts.flatMap(part => part.debugLines || [])
      });
    };
    const keys = [...new Set(body.filter(item => item.columnKey !== "full").map(item => item.columnKey))].sort();
    for (const key of keys) {
      const sorted = body.filter(item => item.columnKey === key)
        .sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
      if (!sorted.length) continue;
      let current = [sorted[0]];
      for (const item of sorted.slice(1)) {
        const currentBox = bboxUnion(current.map(part => part.bbox));
        const gap = item.bbox[1] - currentBox[3];
        const tolerance = Math.max(18, bboxWidth(currentBox) * .10);
        const normal = gap <= Math.max(18, Math.min(bboxHeight(currentBox), bboxHeight(item.bbox)) * 2)
          && (Math.abs(item.bbox[0] - currentBox[0]) <= tolerance
            || Math.abs(item.bbox[2] - currentBox[2]) <= tolerance
            || horizontalOverlapRatio(currentBox, item.bbox) >= .55);
        const adjacent = singleLineBodyItemsAreAdjacent(current[current.length - 1], item);
        if ((normal || adjacent)
          && !bodyMergeBlockedByBarrier(currentBox, item.bbox, barriers, blockers)
          && !bodyMergeCreatesBarrierIntrusion(current, item.bbox, barriers)) current.push(item);
        else {
          emitMerged(current);
          current = [item];
        }
      }
      emitMerged(current);
    }
    return [...result, ...other];
  }

  function markEquationDenseBodyItems(items, absoluteBlocks, pageHeight) {
    const equations = [];
    const queue = [...absoluteBlocks];
    while (queue.length) {
      const block = queue.shift();
      if (!block || typeof block !== "object") continue;
      if (["interline_equation", "equation"].includes(String(block.type || "").toLowerCase()) && validBBox(block.bbox)) {
        equations.push(block.bbox);
      }
      queue.push(...(Array.isArray(block.blocks) ? block.blocks : []));
    }
    for (const item of items) {
      if (!["body_candidate", "merged_body"].includes(item.debugRole)) continue;
      if (Number(item.originalLineCount || 0) > 4 || bboxHeight(item.bbox) > Math.max(54, pageHeight * .07)) continue;
      const related = equations.filter(eq => horizontalOverlapRatio(item.bbox, eq) >= .35);
      const upper = related.some(eq => item.bbox[1] - eq[3] >= 0 && item.bbox[1] - eq[3] <= 28);
      const lower = related.some(eq => eq[1] - item.bbox[3] >= 0 && eq[1] - item.bbox[3] <= 28);
      if (upper && lower) item.equationDense = true;
    }
    return items;
  }

  function mergeReferenceItems(items) {
    const references = items.filter(item => item.kind === "ref_text");
    const other = items.filter(item => item.kind !== "ref_text");
    const merged = [];
    for (const key of [...new Set(references.map(item => item.columnKey || item.side || "full"))].sort()) {
      const parts = references.filter(item => (item.columnKey || item.side || "full") === key)
        .sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
      if (!parts.length) continue;
      merged.push({
        kind: "ref_text",
        side: parts[0].side,
        columnKey: key,
        bbox: bboxUnion(parts.map(part => part.bbox)),
        text: parts.map(part => part.text).join("\n"),
        roleText: parts.map(part => part.roleText || part.text).join("\n"),
        pageIndex: parts[0].pageIndex,
        debugRole: "merged_reference",
        parts,
        paragraphs: parts.map(part => ({ parts: [part], indent: 0 })),
        debugLines: parts.flatMap(part => part.debugLines || [])
      });
    }

    // Merge reference flows only when their left edges match and their vertical
    // spans overlap. This excludes ordinary multi-column bibliographies.
    const repaired = [];
    const pending = [...merged].sort((a, b) => a.bbox[1] - b.bbox[1]);
    while (pending.length) {
      const current = pending.shift();
      const compatibleIndex = pending.findIndex(candidate => {
        if (Number(candidate.pageIndex || 0) !== Number(current.pageIndex || 0)) return false;
        if (Math.abs(candidate.bbox[0] - current.bbox[0]) > 8) return false;
        const overlap = Math.max(0, Math.min(current.bbox[3], candidate.bbox[3]) - Math.max(current.bbox[1], candidate.bbox[1]));
        const shorterHeight = Math.min(bboxHeight(current.bbox), bboxHeight(candidate.bbox));
        return shorterHeight > 0 && overlap / shorterHeight >= .75;
      });
      if (compatibleIndex < 0) {
        repaired.push(current);
        continue;
      }

      const candidate = pending.splice(compatibleIndex, 1)[0];
      const parts = [...(current.parts || []), ...(candidate.parts || [])]
        .sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
      pending.unshift({
        ...current,
        bbox: bboxUnion(parts.map(part => part.bbox)),
        text: parts.map(part => part.text).join("\n"),
        roleText: parts.map(part => part.roleText || part.text).join("\n"),
        parts,
        paragraphs: parts.map(part => ({ parts: [part], indent: 0 })),
        debugLines: parts.flatMap(part => part.debugLines || [])
      });
    }
    return [...repaired, ...other];
  }

  function lineDebugData(lines) {
    return (Array.isArray(lines) ? lines : []).map(line => {
      let bbox = validBBox(line?.bbox);
      if (!bbox) bbox = bboxUnion((line?.spans || []).map(span => span?.bbox));
      return bboxWidth(bbox) && bboxHeight(bbox) ? bbox : null;
    }).filter(Boolean);
  }

  function prepareFlowItems(page, flatBlocks, ocrBoxes) {
    const pageWidth = normalizePageSize(page, page.preproc_blocks || [])[0];
    const pageHeight = normalizePageSize(page, page.preproc_blocks || [])[1];
    const recordByObject = new Map(flatBlocks.map(record => [record.original, record]));
    const mediaBoxes = collectMediaCarrierBoxes(page.preproc_blocks || []);
    const output = [];
    const add = (block, kind, fromList = false) => {
      const bbox = validBBox(block.bbox);
      const record = recordByObject.get(block);
      const symbolGlossary = kind === "text" && isSymbolGlossaryBlock(block);
      const html = layoutLinesToHTML(block.lines, !symbolGlossary);
      const text = String(record?.text || blockText(block) || "").trim();
      const tocRows = kind === "text" ? parseTocRows(block.lines) : null;
      if (!bbox || !html || mediaBoxes.some(box => bboxContainedOverlapRatio(bbox, box) >= .72)) return;
      output.push({
        id: record?.id || "",
        kind,
        type: String(block.type || kind).toLowerCase(),
        bbox,
        html,
        text,
        translatedText: String(record?.translatedText || ""),
        roleText: String(block._layout_original_plain_text || text),
        originalLineCount: tocRows
          ? layoutLogicalLines(block.lines).length
          : Math.max(
            Number(block._layout_original_line_count || 0),
            layoutVisualLineCount(block.lines)
          ),
        debugLines: lineDebugData(block._layout_debug_lines || block._layout_original_lines || block.lines),
        fontEstimate: estimateLayoutFontSize(kind, bbox, text) || (kind === "ref_text" ? 8.2 : 8.5),
        side: streamSideForBBox(bbox, pageWidth),
        indent: estimateFirstLineIndent(bbox, ocrBoxes),
        pageIndex: Number(page.page_idx || 0),
        debugRole: kind === "ref_text" ? "reference" : (tocRows ? "toc" : "text"),
        tocRows,
        symbolGlossary,
        paragraphs: symbolGlossaryParagraphs({
          symbolGlossary,
          html,
          text,
          translatedText: String(record?.translatedText || "")
        }),
        fromList
      });
    };
    for (const block of Array.isArray(page.preproc_blocks) ? page.preproc_blocks : []) {
      const type = String(block?.type || "").toLowerCase();
      if (type === "text" || type === "ref_text") add(block, type);
      else if (type === "list") {
        let added = false;
        for (const child of Array.isArray(block.blocks) ? block.blocks : []) {
          const childType = String(child?.type || "").toLowerCase();
          if (["text", "ref_text"].includes(childType)) {
            add(child, childType, true);
            added = true;
          }
        }
        if (added) block._litmtransFlowList = true;
      }
    }
    assignLayoutColumnKeys(output, pageWidth);
    return { items: output, recordByObject, pageWidth, pageHeight };
  }

  function columnRightEdgesFromStreams(streams) {
    // Body boxes remain the authority for text fitting.  Formula-number
    // gutters also need ordinary (non-reference) text geometry: a valid
    // single-column paragraph can intentionally stay outside body fitting
    // while still identifying the physical reading lane on this page.
    const edges = { bodyBoxes: [], textBoxes: [] };
    for (const stream of streams) {
      if (!validBBox(stream.bbox)) continue;
      const items = stream.items || [];
      if (!items.length || items.every(item => item.kind === "ref_text")) continue;
      const key = stream.columnKey || stream.items?.[0]?.columnKey || "full";
      const box = {
        columnKey: key, left: stream.bbox[0], right: stream.bbox[2],
        top: stream.bbox[1], bottom: stream.bbox[3], role: stream.debugRole
      };
      edges.textBoxes.push(box);
      if (!["body_candidate", "merged_body", "body_inherited"].includes(stream.debugRole)) continue;
      edges.bodyBoxes.push(box);
      edges[`${key}Left`] = Math.min(edges[`${key}Left`] ?? box.left, box.left);
      edges[key] = Math.max(edges[key] ?? 0, box.right);
    }
    return edges;
  }

  // MinerU's bbox is formula ink geometry. Column evidence is used only as a
  // right-edge anchor for a TeX \tag, never to change formula sizing or its
  // collision frame.
  function equationNumberRightForBBox(bbox, pageWidth, columnRights) {
    const source = validBBox(bbox) ? [...bbox] : null;
    if (!source) return null;
    const [, top, originalRight, bottom] = source;
    if (!columnRights) return originalRight;
    const geometryBoxes = [...(columnRights.bodyBoxes || []), ...(columnRights.textBoxes || [])];
    if (!geometryBoxes.length) return originalRight;

    const left = source[0];
    const width = Math.max(1, originalRight - left);
    const centerX = (left + originalRight) / 2;
    const centerY = (top + bottom) / 2;
    const band = Math.max(40, Math.min(112, (bottom - top) * 1.5));
    const byColumn = new Map();
    const seen = new Set();
    for (const box of geometryBoxes) {
      const boxLeft = Number(box.left);
      const boxRight = Number(box.right);
      const boxTop = Number(box.top);
      const boxBottom = Number(box.bottom);
      const key = String(box.columnKey || "");
      if (![boxLeft, boxRight, boxTop, boxBottom].every(Number.isFinite) || !key) continue;
      const identity = `${key}:${boxLeft}:${boxRight}:${boxTop}:${boxBottom}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const boxCenterY = (boxTop + boxBottom) / 2;
      const verticallyNear = boxBottom >= top - 10 && boxTop <= bottom + 10;
      if (!verticallyNear && Math.abs(boxCenterY - centerY) > band) continue;
      const overlap = Math.max(0, Math.min(originalRight, boxRight) - Math.max(left, boxLeft));
      const containsCenter = boxLeft - 8 <= centerX && centerX <= boxRight + 8;
      if (!containsCenter && overlap < Math.max(14, width * .15)) continue;
      if (!byColumn.has(key)) byColumn.set(key, []);
      byColumn.get(key).push({ box: { ...box, left: boxLeft, right: boxRight }, overlap, containsCenter });
    }
    if (!byColumn.size) return originalRight;

    const ranked = [...byColumn.entries()].sort(([, entriesA], [, entriesB]) => {
      const score = entries => Math.max(...entries.map(({ overlap, containsCenter }) => overlap + (containsCenter ? pageWidth : 0)));
      return score(entriesB) - score(entriesA);
    });
    const [chosenKey, chosenEntries] = ranked[0];
    let chosenRight = Math.max(...chosenEntries.map(entry => entry.box.right));
    const chosenLeft = Math.min(...chosenEntries.map(entry => entry.box.left));
    const overlappingColumns = [...byColumn.values()].filter(entries =>
      Math.max(...entries.map(entry => entry.overlap)) >= Math.max(14, width * .15));
    const chosenColumnWidth = Math.max(1, chosenRight - chosenLeft);
    // A genuinely cross-column formula gets its number at the outside edge of
    // its span, rather than inside an arbitrary middle column.
    if (overlappingColumns.length >= 2 && width >= chosenColumnWidth * 1.25) {
      chosenRight = Math.max(...overlappingColumns.flatMap(entries => entries.map(entry => entry.box.right)));
      for (const [colKey] of byColumn.entries()) {
        const colAuth = Number(columnRights?.[colKey] ?? 0);
        if (colAuth > chosenRight) chosenRight = colAuth;
      }
    } else {
      const columnAuthorityRight = Number(columnRights?.[chosenKey] ?? 0);
      const maxColumnBoxRight = Math.max(
        0,
        ...geometryBoxes.filter(b => b.columnKey === chosenKey).map(b => Number(b.right) || 0)
      );
      const targetColumnRight = Math.max(columnAuthorityRight, maxColumnBoxRight);
      if (targetColumnRight > chosenRight) {
        chosenRight = targetColumnRight;
      }
    }
    return Math.max(originalRight, chosenRight);
  }

  function numberedFormula(block) {
    return block?.kind === "formula"
      && (block.formulas || []).some(tex => /\\tag\s*\{[^}]*\}/.test(String(tex || "")));
  }

  function localColumnRight(stream, edges) {
    const bbox = stream.bbox;
    const key = stream.columnKey || stream.items?.[0]?.columnKey || "full";
    const center = (bbox[1] + bbox[3]) / 2;
    const band = Math.max(36, Math.min(96, bboxHeight(bbox) * .5));
    const near = box => {
      const boxCenter = (box.top + box.bottom) / 2;
      return (box.bottom >= bbox[1] - 8 && box.top <= bbox[3] + 8) || Math.abs(boxCenter - center) <= band;
    };
    const notSelf = box => Math.abs(box.left - bbox[0]) >= 1 || Math.abs(box.right - bbox[2]) >= 1
      || Math.abs(box.top - bbox[1]) >= 1 || Math.abs(box.bottom - bbox[3]) >= 1;
    const same = (edges.bodyBoxes || []).filter(box => box.columnKey === key && near(box) && notSelf(box));
    if (same.length) return Math.max(...same.map(box => box.right));
    const full = (edges.bodyBoxes || []).filter(box => box.columnKey === "full" && near(box) && notSelf(box));
    return full.length ? Math.max(...full.map(box => box.right)) : null;
  }

  function expandNarrowStream(stream, edges, barriers) {
    if (!["body_candidate", "merged_body"].includes(stream.debugRole) || stream.columnKey === "full") return;
    const target = localColumnRight(stream, edges);
    if (target == null) return;
    const leftEdge = edges[`${stream.columnKey}Left`] ?? stream.bbox[0];
    const columnWidth = Math.max(1, target - leftEdge);
    if (bboxWidth(stream.bbox) >= columnWidth * .94 || stream.bbox[0] > target) return;
    const prospective = [stream.bbox[0], stream.bbox[1], target, stream.bbox[3]];
    if ((barriers || []).some(box =>
      Math.min(prospective[2], box[2]) - Math.max(prospective[0], box[0]) >= 8
      && Math.min(prospective[3], box[3]) - Math.max(prospective[1], box[1]) >= 3
      && box[0] > stream.bbox[0] + 24)) return;
    stream.bbox[2] = Math.max(stream.bbox[2], target);
  }

  function retreatIntrudingColumnBoundaries(streams) {
    const candidates = streams.filter(stream => stream.columnKey && stream.columnKey !== "full" && validBBox(stream.bbox));
    for (let index = 0; index < candidates.length; index++) {
      for (let next = index + 1; next < candidates.length; next++) {
        if (candidates[index].columnKey === candidates[next].columnKey) continue;
        let left = candidates[index];
        let right = candidates[next];
        if (left.bbox[0] > right.bbox[0]) [left, right] = [right, left];
        if (Math.min(left.bbox[3], right.bbox[3]) - Math.max(left.bbox[1], right.bbox[1]) <= 2) continue;
        if (left.bbox[2] <= right.bbox[0]) continue;
        const boundary = (left.bbox[2] + right.bbox[0]) / 2;
        if (boundary - left.bbox[0] < 20 || right.bbox[2] - boundary < 20) continue;
        left.bbox[2] = boundary;
        right.bbox[0] = boundary;
      }
    }
  }

  function streamParagraphs(stream) {
    return (stream.items || []).flatMap(item =>
      Array.isArray(item.paragraphs) && item.paragraphs.length ? item.paragraphs : [{ parts: item.parts || [item], indent: item.indent || 0 }]);
  }

  function translatedFlowPlainText(part) {
    // Capacity must be measured from the translated text because that is what
    // the reader lays out. Replace markup with separators and preserve the
    // encoded form used by the renderer so citations and formula-bearing text
    // do not change the fitted body font unexpectedly.
    return String(part?.translatedText || part?.text || "")
      // Only sup/sub survive the translation protocol as real markup. A raw
      // comparison such as "<8.3%" is text, not an unterminated HTML tag.
      .replace(/<\/?(?:sup|sub)\b[^>]*>/gi, " ")
      .replace(/&(?:amp;)?lt;/gi, "<")
      .replace(/&(?:amp;)?gt;/gi, ">")
      // Match the renderer's escaped-text representation before measuring.
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\s+/g, " ")
      .trim();
  }

  function streamInnerBBox(bbox, refsOnly) {
    const leftPad = 2;
    const rightPad = refsOnly ? 2 : 4;
    const topPad = refsOnly ? 1 : 0;
    const bottomPad = refsOnly ? 1 : 0;
    return [
      bbox[0] + leftPad,
      bbox[1] + topPad,
      Math.max(bbox[0] + leftPad + 4, bbox[2] - rightPad),
      Math.max(bbox[1] + topPad + 4, bbox[3] - bottomPad)
    ];
  }

  function estimateStreamUsedHeight(stream, fontSize, lineRatio, paragraphGap, refsOnly) {
    const width = Math.max(12, bboxWidth(streamInnerBBox(stream.bbox, refsOnly)));
    const factor = refsOnly ? .47 : .45;
    let lines = 0;
    const paragraphs = streamParagraphs(stream);
    for (const paragraph of paragraphs) {
      const text = (paragraph.parts || []).map(translatedFlowPlainText).join(" ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const indent = refsOnly ? 0 : Number(paragraph.indent || 0);
      const full = Math.max(6, width / Math.max(1, fontSize * factor));
      const first = Math.max(4, (width - indent) / Math.max(1, fontSize * factor));

      // integer-ceiling idiom to floating-point character capacities:
      // int((remaining + full_chars - 1) // full_chars). Math.ceil(remaining /
      // full) is only equivalent for integer divisors and changes the winning
      // document-wide font/line-height candidate near a wrap boundary.
      lines += text.length <= first
        ? 1
        : 1 + Math.floor((text.length - first + full - 1) / full);
    }
    const nonEmpty = paragraphs.filter(paragraph =>
      (paragraph.parts || []).some(part => translatedFlowPlainText(part).trim())).length;
    return lines * fontSize * lineRatio + Math.max(0, nonEmpty - 1) * paragraphGap * fontSize;
  }

  function streamLineMetrics(stream, ocrBoxes) {
    const items = stream.items || [];
    if (!items.length) return [8.5, 1.14];
    const refsOnly = items.every(item => item.kind === "ref_text");
    const box = bboxUnion(items.map(item => item.bbox));
    const boxes = ocrBoxesInRegion(ocrBoxes || [], box, 4);
    const heights = boxes.map(bboxHeight);
    const centers = boxes.map(box => bboxCenter(box)[1]).sort((a, b) => a - b);
    const gaps = [];
    for (let index = 0; index + 1 < centers.length; index++) {
      const gap = centers[index + 1] - centers[index];
      if (gap > 1) gaps.push(gap);
    }
    const medianHeight = medianValue(heights, refsOnly ? 10 : 10.8);
    const medianGap = medianValue(gaps, medianHeight * (refsOnly ? 1.14 : 1.18));
    const font = Math.max(refsOnly ? 7.1 : 7.6, Math.min(refsOnly ? 9 : 10.4, medianHeight * (refsOnly ? .92 : .94)));
    const ratio = Math.max(refsOnly ? 1.02 : 1.05, Math.min(refsOnly ? 1.24 : 1.28, medianGap / Math.max(1, font)));
    return [Math.round(font * 100) / 100, Math.round(ratio * 1000) / 1000];
  }

  function streamBottomGap(stream, font, ratio, gap, refsOnly) {
    return Math.max(0, bboxHeight(stream.bbox) - estimateStreamUsedHeight(stream, font, ratio, gap, refsOnly));
  }

  function solveUniformStreamStyle(streams, refsOnly, ocrBoxesByPage = {}) {
    if (!streams.length) return refsOnly ? [7.8, 1.12] : [8.4, 1.16];
    const minFont = refsOnly ? 6.9 : 7.2;
    const maxFont = refsOnly ? 8.8 : 10.6;
    const metrics = streams.map(stream =>
      streamLineMetrics(stream, ocrBoxesByPage[Number(stream.pageIndex || 0)] || []));
    const base = medianValue(metrics.map(value => value[0]), refsOnly ? 7.8 : 8.4);
    const baseRatio = medianValue(metrics.map(value => value[1]), refsOnly ? 1.10 : 1.16);
    const ratios = refsOnly
      ? [baseRatio, Math.max(1, baseRatio * .96), Math.min(1.18, baseRatio * 1.02)]
      : [baseRatio, Math.max(1.03, baseRatio * .95), Math.min(1.18, baseRatio * 1.02), Math.max(1.02, baseRatio * .98)];
    const gaps = refsOnly ? [.10] : [.12, .16, .20];
    let best = [Math.max(minFont, Math.min(maxFont, base)), baseRatio, gaps[0]];
    let bestScore = -Infinity;
    for (const ratio of [...new Set(ratios.map(value => Math.round(value * 1000) / 1000))].sort((a, b) => a - b)) {
      for (const gap of gaps) {
        let low = minFont;
        let high = Math.max(base, Math.min(maxFont, base * (refsOnly ? 1.4 : 1.5)));
        let font = Math.max(minFont, Math.min(maxFont, base));
        for (let count = 0; count < 22; count++) {
          const candidate = (low + high) / 2;
          const fits = streams.every(stream => estimateStreamUsedHeight(stream, candidate, ratio, gap, refsOnly) <= bboxHeight(stream.bbox));
          if (fits) {
            font = candidate;
            low = candidate;
          }
          else high = candidate;
        }
        if (streams.length) {
          const samplePage = Number(streams[0].pageIndex || 0);
          const sampleBoxes = ocrBoxesByPage[samplePage] || [];
          const pageHeight = sampleBoxes.length ? Math.max(...sampleBoxes.map(box => box[3])) / .92 : 792;
          const band = Math.max(6, pageHeight * .02);
          while (font < maxFont) {
            const bottomGaps = streams.map(stream => streamBottomGap(stream, font, ratio, gap, refsOnly));
            if (!bottomGaps.length || Math.min(...bottomGaps) <= band) break;
            const next = Math.min(maxFont, font + .2);
            if (next <= font || streams.some(stream =>
              estimateStreamUsedHeight(stream, next, ratio, gap, refsOnly) > bboxHeight(stream.bbox))) break;
            font = next;
          }
        }
        const fills = streams.map(stream => Math.min(1, estimateStreamUsedHeight(stream, font, ratio, gap, refsOnly) / Math.max(1, bboxHeight(stream.bbox))));
        const score = Math.min(...fills) * 2000 + fills.reduce((sum, value) => sum + value, 0) / fills.length * 260
          + font * 20 - ratio * 4 - gap * 3;
        if (score > bestScore) {
          bestScore = score;
          best = [font, ratio, gap];
        }
      }
    }
    return [Math.round(best[0] * 100) / 100, Math.round(best[1] * 1000) / 1000];
  }

  function absoluteVisuals(blocks, recordByObject, resolveAsset) {
    const output = [];
    const equationTypes = new Set(["interline_equation", "equation", "inline_equation", "block_equation"]);
    const codeTypes = new Set(["code", "code_body"]);
    const containerTypes = new Set(["table", "chart", "image"]);
    const mediaBodyTypes = new Set(["table_body", "chart_body", "image_body"]);
    const pushBlock = (block, type, record, bbox, kind, imagePath, formulas, htmlSpan, textOverride = null) => {
      const text = textOverride == null
        ? String(record?.text || blockText(block) || "")
        : String(textOverride);
      output.push({
        id: record?.id || "",
        type,
        kind,
        bbox,
        text,
        translatedText: String(record?.translatedText || ""),
        sourceHTML: layoutLinesToHTML(block.lines),
        tableHTML: htmlSpan?.html ? normalizeLayoutHTMLSnippet(htmlSpan.html) : "",

        // retained only for the no-TeX fallback, never alongside the TeX node.
        imagePath: kind === "image" ? imagePath : "",
        imageURL: kind === "image" ? resolveAsset(imagePath) : "",
        formulaItems: kind === "formula" ? formulas : [],
        formulas: kind === "formula" ? formulas.map(item => item.tex) : [],
        codeLanguage: kind === "code" ? String(block.guess_lang || block.guessLang || "text") : "",
        // The positioned renderer uses this metadata to include multi-line
        // absolute text in collision iteration.
        lineCount: Math.max(1, Number(block._layout_original_line_count ?? (block.lines || []).length) || 1),
        // Measure the translated absolute text while retaining source text for
        // the source-pane rendering.
        fontSize: fixedLayoutFontSize(type)
          || estimateLayoutFontSize(type, bbox, String(record?.translatedText || text))
          || inferFontSize(block, bbox, String(record?.translatedText || text), (block.lines || []).length),
        lineHeight: ["table_caption", "table_footnote", "chart_caption", "image_caption", "image_footnote"].includes(type)
          ? 1.2
          : (type === "text" ? 1.28 : 1.12),
        debugLines: lineDebugData(block.lines)
      });
    };
    const visit = block => {
      if (!block || typeof block !== "object" || block._litmtransFlowList) return;
      const type = String(block.type || "unknown").toLowerCase();
      const children = Array.isArray(block.blocks) ? block.blocks : [];
      const record = recordByObject.get(block);
      const bbox = validBBox(block.bbox);
      const imagePath = imagePathFromBlock(block);
      const isEquation = equationTypes.has(type);
      const formulas = record?.formulaItems || formulaSpans(block).map((tex, index) => ({
        id: `${record?.id || "formula"}-${index + 1}`, tex
      }));
      // A display-equation span can contain TeX even when its type label is
      // incomplete; use that content before considering an image crop.
      if (isEquation && !formulas.length && blockText(block).trim()) {
        formulas.push({ id: `${record?.id || "formula"}-1`, tex: blockText(block).trim() });
      }
      const htmlSpan = (block.lines || []).flatMap(line => line?.spans || []).find(span => span?.html);
      // Containers do not occupy page coordinates; only their visual children
      // are rendered. Rendering both would duplicate content.
      if (containerTypes.has(type)) {
        for (const child of children) visit(child);
        return;
      }
      if (!bbox) {
        for (const child of children) visit(child);
        return;
      }
      if (codeTypes.has(type)) {
        const codeText = codeTextFromBlock(block);
        if (codeText) pushBlock(block, type, record, bbox, "code", "", [], htmlSpan, codeText);
        else for (const child of children) visit(child);
        return;
      }
      if (isEquation) {
        // A real TeX item wins over an accompanying raster crop. If TeX is
        // unavailable, use the crop as the visual fallback.
        if (formulas.length) pushBlock(block, type, record, bbox, "formula", imagePath, formulas, htmlSpan);
        else if (imagePath) pushBlock(block, type, record, bbox, "image", imagePath, [], htmlSpan);
        else if (blockText(block)) pushBlock(block, type, record, bbox, "text", "", [], htmlSpan);
        return;
      }
      if (mediaBodyTypes.has(type)) {
        const kind = imagePath ? "image" : (type === "table_body" && htmlSpan?.html ? "table" : "text");
        if (imagePath || htmlSpan?.html || blockText(block)) pushBlock(block, type, record, bbox, kind, imagePath, [], htmlSpan);
        else for (const child of children) visit(child);
        return;
      }
      // title/text use their own text renderer. All other types use the
      // generic fallback, which only descends when the current block is empty.
      if (blockText(block) || imagePath || htmlSpan?.html) {
        pushBlock(block, type, record, bbox, imagePath ? "image" : "text", imagePath, [], htmlSpan);
      } else {
        for (const child of children) visit(child);
      }
    };
    for (const block of blocks || []) visit(block);
    return output;
  }

  function discardedPageVisuals(page, resolveAsset) {
    const pageFurnitureTypes = new Set([
      "header", "page_header", "footer", "page_footer", "page_number"
    ]);
    const pageHeight = Number(page?.page_size?.[1] || 0);
    const blocks = (Array.isArray(page?.discarded_blocks) ? page.discarded_blocks : [])
      .filter(block => pageFurnitureTypes.has(String(block?.type || "").toLowerCase()));
    return absoluteVisuals(blocks, new Map(), resolveAsset).map(block => ({
      ...block,
      type: ({ header: "page_header", footer: "page_footer", footnote: "page_footnote" })[block.type] || block.type,
      sourceOnly: true
    })).filter(block => isPageFurniture(block, pageHeight));
  }

  function isPageFurniture(block, pageHeight) {
    const bbox = validBBox(block?.bbox);
    if (!bbox || !(pageHeight > 0) || !String(block?.text || "").trim()) return false;
    const [left, top, right, bottom] = bbox;
    if (right - left <= (bottom - top) * 1.2) return false;
    if (block.type === "page_header") return bottom <= pageHeight * .16;
    return top >= pageHeight * .84;
  }

  function modelItemTextHTML(item) {
    const direct = item?.content ?? item?.text;
    if (direct != null && String(direct).trim()) return safeLayoutTextToHTML(String(direct).trim());
    const lineHTML = layoutLinesToHTML(item?.lines);
    if (lineHTML) return lineHTML;
    return Array.isArray(item?.spans) ? layoutSpansToHTML(item.spans) : "";
  }

  function modelFallbackVisuals(modelPage, pageWidth, pageHeight, occupiedBoxes) {
    if (!Array.isArray(modelPage) && (!modelPage || typeof modelPage !== "object")) return [];
    const candidates = [];
    const visit = value => {
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
        return;
      }
      if (!value || typeof value !== "object") return;
      if (validBBox(value.bbox) && modelItemTextHTML(value)) candidates.push(value);
      for (const key of ["blocks", "lines", "spans", "children"]) {
        if (value[key]) visit(value[key]);
      }
    };
    visit(modelPage);
    const output = [];
    const seen = new Set();
    for (const item of candidates) {
      const rawBBox = validBBox(item.bbox);
      const bbox = Math.max(...rawBBox.map(Math.abs)) <= 1.5
        ? modelBBoxToPageBBox(rawBBox, pageWidth, pageHeight)
        : rawBBox;
      const originalType = String(item.type || item.category || "model_item").toLowerCase().replace(/[\s-]+/g, "_");
      if (originalType === "ocr_text" || originalType === "aside_text") continue;
      const type = originalType === "footer" ? "page_footer"
        : (originalType === "header" ? "page_header" : (originalType === "footnote" ? "page_footnote" : originalType));
      const html = modelItemTextHTML(item);
      const plain = String(item.content ?? item.text ?? blockText(item) ?? "").replace(/\s+/g, " ").trim();
      const nearTop = bbox[1] <= pageHeight * .07;
      const nearBottom = bbox[3] >= pageHeight * .93;
      const metadata = ["page_header", "page_footer", "page_footnote", "page_number", "header", "footer", "footnote"].includes(type)
        || ((nearTop || nearBottom) && /^(?:[-–—]?\s*)?\d{1,4}(?:\s*[-–—])?$/.test(plain));
      if (!metadata && occupiedBoxes.some(box => bboxContainedOverlapRatio(bbox, box) >= .72)) continue;
      const key = `${type}\u001f${plain}\u001f${bbox.map(value => Math.round(value)).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({
        id: `model-${output.length + 1}`,
        type,
        kind: "text",
        bbox,
        text: plain,
        translatedText: "",
        sourceHTML: html,
        tableHTML: "",
        imagePath: "",
        imageURL: "",
        formulaItems: [],
        formulas: [],
        lineCount: Math.max(1, String(plain || "").split(/\r?\n/).filter(Boolean).length),
        fontSize: fixedLayoutFontSize(type) || estimateLayoutFontSize(type, bbox, plain) || 8,
        lineHeight: ["table_caption", "table_footnote", "chart_caption", "image_caption", "image_footnote"].includes(type)
          ? 1.2
          : 1.12,
        debugLines: []
      });
    }
    return output;
  }

  function expandSpecialAbsoluteBlocks(blocks, streams, pageWidth, pageHeight, mainTitleAllowed) {
    let mainTitleUsed = false;
    for (const block of blocks) {
      if (!validBBox(block.bbox)) continue;
      const geometryTitle = block.type === "title"
        && block.bbox[1] <= pageHeight * .35
        && bboxWidth(block.bbox) >= pageWidth * .45
        && bboxHeight(block.bbox) >= Math.max(24, pageHeight * .035);
      // Every title with article-title geometry is independent, including a
      // later paper title in a combined PDF.  The first encountered title is
      // still a safe fallback when the parser omitted the expected geometry.
      const isMainTitle = geometryTitle || (mainTitleAllowed && !mainTitleUsed && block.type === "title");
      if (isMainTitle) {
        // A title remains the article's main title even when this page has no
        // recovered body stream. Keep its source bbox and title role.
        block.mainTitle = true;
        if (mainTitleAllowed) mainTitleUsed = true;
        continue;
      }
      // Keep caption boxes at their source width. Widening them changes the
      // limiting block for the caption group and therefore its fitted font.
    }
    return mainTitleUsed;
  }

  function prepareRestoredPage(page, flatPage, modelPage, resolveAsset, context, singleColumnProfile = null) {
    const ocrBoxes = collectModelOCRBoxes(modelPage, flatPage.width, flatPage.height);
    const prepared = prepareFlowItems(page, flatPage.blocks, ocrBoxes);
    let items = promoteTextItemsToBody(prepared.items, flatPage.width, flatPage.height, context);
    items = promoteStableSingleColumnItems(items, flatPage.width, flatPage.height, singleColumnProfile);
    items = inheritStableSingleColumnShortItems(items, flatPage.width, flatPage.height, singleColumnProfile);
    const absoluteRaw = (page.preproc_blocks || []).filter(block => {
      const type = String(block?.type || "").toLowerCase();
      if (["text", "ref_text"].includes(type)) return false;
      if (type === "list" && block._litmtransFlowList) return false;
      return true;
    });
    items = mergeVerticalBodyItems(items, absoluteRaw);
    items = markEquationDenseBodyItems(items, absoluteRaw, flatPage.height);
    items = mergeReferenceItems(items);

    // Do not re-merge here: mergeVerticalBodyItems() is the single authority
    // for whether two body fragments may share a positioned text box.
    const streams = items
      .sort((a, b) => String(a.side).localeCompare(String(b.side)) || a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
      .map(item => ({
        side: item.side,
        columnKey: item.columnKey,
        items: [item],
        bbox: [...item.bbox],
        pageIndex: Number(page.page_idx || 0),
        debugRole: item.debugRole
      }));
    const barriers = layoutBarrierBoxes(absoluteRaw);
    const columnRights = columnRightEdgesFromStreams(streams);
    const absoluteBlocks = absoluteVisuals(absoluteRaw, prepared.recordByObject, resolveAsset);
    for (const block of absoluteBlocks) {
      if (numberedFormula(block)) block.numberRight = equationNumberRightForBBox(block.bbox, flatPage.width, columnRights);
    }
    return {
      streams,
      absoluteBlocks,
      profiles: bodyColumnProfiles(prepared.items, flatPage.width, flatPage.height),
      ocrBoxes,
      barriers,
      columnRights,
      modelPage,
      pageWidth: flatPage.width,
      pageHeight: flatPage.height,
    };
  }

  function flattenLayoutPage(page, pageIndex, resolveAsset, translatableTypes = TRANSLATABLE_LAYOUT_TYPES) {
    const rawBlocks = Array.isArray(page?.preproc_blocks) ? page.preproc_blocks : Array.isArray(page?.blocks) ? page.blocks : [];
    const pageSize = normalizePageSize(page, rawBlocks);
    const output = [];
    let viewSequence = 0;
    let translationSequence = 0;
    let formulaSequence = 0;

    const visit = (block, depth = 0) => {
      if (!block || typeof block !== "object") return;
      const bbox = validBBox(block.bbox);
      const type = String(block.type || "unknown").toLowerCase();
      if (bbox) {
        viewSequence++;
        // Use formula-preserving text for translation. `blockText()` remains
        // the visual fallback, but it flattens
        // an inline equation span into bare TeX and would make both model
        // preservation and post-translation formula validation impossible.
        const tocRows = type === "text" ? parseTocRows(block.lines) : null;
        const text = tocRows
          ? layoutLogicalLines(block.lines).join("\n").trim()
          : (plainBlockText(block) || blockText(block));
        const formulas = formulaSpans(block);
        if (!formulas.length && looksLikeDisplayFormula(text)) formulas.push(text);
        const imagePath = imagePathFromBlock(block);
        const isEquation = ["interline_equation", "equation", "inline_equation", "block_equation"].includes(type);
        // Use span content directly when the parser omitted a specialised
        // formula label.
        if (isEquation && !formulas.length && text.trim()) formulas.push(text.trim());
        let kind = "text";
        // TeX is authoritative when available; otherwise use the equation
        // crop instead of creating an empty math node.
        if (isEquation && formulas.length) kind = "formula";
        else if (isEquation && imagePath) kind = "image";
        else if (imagePath || ["image", "image_body", "chart", "table"].includes(type)) kind = imagePath ? "image" : "text";
        // Text and caption blocks remain translatable when they contain
        // inline formulas. Only standalone equation blocks become formula
        // visuals; otherwise a prose block could be left untranslated.
        const lines = Array.isArray(block.lines) ? block.lines.length : 1;
        const translatable = kind !== "formula" && translatableTypes.has(type) && Boolean(text);
        if (translatable) translationSequence++;
        const id = translatable
          ? `p${String(pageIndex + 1).padStart(3, "0")}_${depth ? "c" : "b"}${String(translationSequence).padStart(4, "0")}`
          : `p${String(pageIndex + 1).padStart(3, "0")}_v${String(viewSequence).padStart(4, "0")}`;
        const formulaItems = formulas.map(tex => {
          formulaSequence++;
          return {
            id: `p${String(pageIndex + 1).padStart(3, "0")}_f${String(formulaSequence).padStart(4, "0")}`,
            page: pageIndex + 1,
            type,
            tex
          };
        });
        output.push({
          id,
          page: pageIndex + 1,
          type,
          kind,
          bbox,
          text,
          formulas,
          formulaItems,
          imagePath,
          imageURL: imagePath ? resolveAsset(imagePath) : "",
          lineCount: Math.max(1, lines),
          fontSize: inferFontSize(block, bbox, text, lines),
          depth,
          translatable,
          original: block
        });
      }
      for (const child of Array.isArray(block.blocks) ? block.blocks : []) visit(child, depth + 1);
    };
    for (const block of rawBlocks) visit(block, 0);
    output.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0] || a.id.localeCompare(b.id));
    return { index: pageIndex + 1, width: pageSize[0], height: pageSize[1], blocks: output };
  }

  async function restoreLayoutDocument({
    pages,
    modelPages = [],
    resolveAsset = () => "",
    translations = {},
    formulaMap = {},
    translatableTypes = TRANSLATABLE_LAYOUT_TYPES,
    singleColumnBodyPromotion = true,
    checkpoint = null
  } = {}) {
    const map = translations || {};
    formulaMap = formulaMap || {};
    modelPages = Array.isArray(modelPages) ? modelPages : [];
    const pass = async index => {
      if (checkpoint) await checkpoint(index);
    };
    const flatPages = [];
    for (let index = 0; index < pages.length; index++) {
      await pass(index);
      const page = pages[index];
      const model = flattenLayoutPage(page, index, resolveAsset, translatableTypes);
      model.blocks = model.blocks.map(block => {
        const formulaItems = (block.formulaItems || []).map(item => ({
          ...item,
          tex: String(formulaMap[item.id] || item.tex || "")
        }));
        const symbolGlossary = block.type === "text" && isSymbolGlossaryBlock(block.original);
        const translatedText = restoreSymbolGlossaryRowBreaks(
          {
            symbolGlossary,
            symbolMarkers: symbolGlossary ? symbolGlossaryMarkers(block.original) : []
          },
          map[block.id] || ""
        );
        return {
          ...block,
          // A legacy cache may predate transport validation. Keep it
          // renderable while classifyRetryRecords schedules a safe retry.
          translatedText: sanitizeModelText(translatedText),
          formulas: formulaItems.map(item => item.tex),
          formulaItems
        };
      });
      flatPages.push(model);
    }

    // Body-column evidence is established across the document. A page with
    // mostly figures or equations may then borrow only the
    // geometry of its nearest proven neighbour, never its wording.
    const provisional = [];
    for (let index = 0; index < pages.length; index++) {
      await pass(index);
      const page = pages[index];
      page.page_idx = Number(page.page_idx ?? index);
      const flat = flatPages[index];
      const ocr = collectModelOCRBoxes(modelPages[index] || [], flat.width, flat.height);
      const prepared = prepareFlowItems(page, flat.blocks, ocr);
      provisional.push({ profiles: bodyColumnProfiles(prepared.items, flat.width, flat.height) });
    }
    const contexts = [];
    for (let index = 0; index < pages.length; index++) {
      await pass(index);
      const previous = [];
      const following = [];
      for (let cursor = index - 1; cursor >= 0; cursor--) {
        if (Object.keys(provisional[cursor].profiles || {}).length) {
          previous.push(cursor);
          break;
        }
      }
      for (let cursor = index + 1; cursor < pages.length; cursor++) {
        if (Object.keys(provisional[cursor].profiles || {}).length) {
          following.push(cursor);
          break;
        }
      }
      const neighborColumnProfiles = {};
      for (const neighbor of [...previous, ...following]) {
        for (const [column, profiles] of Object.entries(provisional[neighbor].profiles || {})) {
          (neighborColumnProfiles[column] ||= []).push(...profiles);
        }
      }
      contexts.push({ hasPreviousBody: Boolean(previous.length), neighborColumnProfiles });
    }
    const singleColumnProfile = singleColumnBodyPromotion
      ? inferSingleColumnProfile(pages)
      : null;
    const restored = [];
    for (let index = 0; index < pages.length; index++) {
      await pass(index);
      restored.push(prepareRestoredPage(
        pages[index],
        flatPages[index],
        modelPages[index] || [],
        resolveAsset,
        contexts[index],
        singleColumnProfile
      ));
    }
    let mainTitleSeen = false;
    for (let index = 0; index < restored.length; index++) {
      await pass(index);
      const used = expandSpecialAbsoluteBlocks(
        restored[index].absoluteBlocks,
        restored[index].streams,
        flatPages[index].width,
        flatPages[index].height,
        !mainTitleSeen
      );
      if (used) mainTitleSeen = true;
    }
    const bodyStreams = restored.flatMap(page => page.streams.filter(stream =>
      ["body_candidate", "merged_body"].includes(stream.debugRole)));
    const referenceStreams = restored.flatMap(page => page.streams.filter(stream =>
      (stream.items || []).every(item => item.kind === "ref_text")));
    const ocrBoxesByPage = Object.fromEntries(restored.map((page, index) => {
      const pageIndex = Number(page?.streams?.[0]?.pageIndex);
      return [Number.isFinite(pageIndex) ? pageIndex : index, page.ocrBoxes || []];
    }));
    const inferredBodyStyle = solveUniformStreamStyle(bodyStreams, false, ocrBoxesByPage);
    // Keep translated CJK text within a readable leading range before the
    // browser fitter tightens crowded blocks.
    const bodyStyle = [
      inferredBodyStyle[0],
      Math.min(1.28, Math.max(1.22, inferredBodyStyle[1] + .06))
    ];
    const referenceStyle = solveUniformStreamStyle(referenceStreams, true, ocrBoxesByPage);
    for (let index = 0; index < restored.length; index++) {
      const page = restored[index];
      // Solve the document-wide body/reference baseline from the restored
      // boxes before widening narrow columns. Expanding first increases
      // capacity and changes the shared starting font.
      for (const stream of page.streams) {
        expandNarrowStream(stream, page.columnRights, page.barriers);
      }
      retreatIntrudingColumnBoundaries(page.streams);
      const discardedVisuals = discardedPageVisuals(pages[index], resolveAsset);
      page.absoluteBlocks.push(...discardedVisuals.filter(block => !page.absoluteBlocks.some(existing =>
        existing.type === block.type && existing.text === block.text
        && bboxContainedOverlapRatio(existing.bbox, block.bbox) >= .72
      )));
      const occupied = [
        ...page.streams.map(stream => stream.bbox),
        ...page.absoluteBlocks.map(block => block.bbox),
      ].filter(validBBox);
      const modelVisuals = modelFallbackVisuals(
        page.modelPage,
        page.pageWidth,
        page.pageHeight,
        occupied,
      );
      page.absoluteBlocks.push(...modelVisuals.filter(block =>
        ["page_header", "page_footer", "page_number"].includes(block.type)
        && isPageFurniture(block, page.pageHeight)
        && !page.absoluteBlocks.some(existing => existing.text === block.text
          && bboxContainedOverlapRatio(existing.bbox, block.bbox) >= .72)
      ).map(block => ({ ...block, sourceOnly: true })));
      page.absoluteBlocks.push(...modelVisuals.filter(block =>
        !["page_header", "page_footer", "page_number"].includes(block.type)
        && !page.absoluteBlocks.some(existing =>
        existing.type === block.type && existing.text === block.text
        && bboxContainedOverlapRatio(existing.bbox, block.bbox) >= .72
        )));
      for (const stream of page.streams) {
        const refsOnly = (stream.items || []).every(item => item.kind === "ref_text");
        const body = !refsOnly && ["body_candidate", "merged_body", "body_inherited"].includes(stream.debugRole);
        const bodyInherited = stream.debugRole === "body_inherited";
        const toc = stream.debugRole === "toc";
        const style = toc ? [8.2, 1.22] : (refsOnly ? referenceStyle : (body ? bodyStyle : [7.6, 1.28]));
        stream.fontSize = style[0];
        stream.lineHeight = style[1];
        stream.paragraphGap = toc ? 0 : (refsOnly ? .10 : .16);
        stream.styleKind = toc ? "toc" : (refsOnly ? "ref_text" : (body ? "body_text" : "text"));
        stream.bodyInherited = bodyInherited;
        stream.refsOnly = refsOnly;
        stream.equationDense = body && (stream.items || []).some(item => item.equationDense);
      }
    }
    const model = {
      styles: {
        bodyText: { fontSize: bodyStyle[0], lineHeight: bodyStyle[1] },
        referenceText: { fontSize: referenceStyle[0], lineHeight: referenceStyle[1] }
      },
      pages: flatPages.map((page, index) => ({
        index: page.index,
        width: page.width,
        height: page.height,
        blocks: page.blocks.map(block => ({
          id: block.id,
          page: block.page,
          type: block.type,
          kind: block.kind,
          bbox: block.bbox,
          text: block.text,
          translatedText: block.translatedText,
          formulas: block.formulas,
          formulaItems: block.formulaItems,
          imagePath: block.imagePath,
          imageURL: block.imageURL,
          lineCount: block.lineCount,
          fontSize: block.fontSize,
          translatable: block.translatable
        })),
        restoration: {
          streams: restored[index].streams,
          absoluteBlocks: restored[index].absoluteBlocks,
          ocrBoxes: restored[index].ocrBoxes
        }
      }))
    };
    return model;
  }

  return {
    configure,
    restoreLayoutDocument,
    flattenLayoutPage,
    TRANSLATABLE_LAYOUT_TYPES,
    hasUnsafeControlCharacters,
    sanitizeModelText,
    validBBox,
    spanText,
    lineText,
    blockText,
    layoutLogicalLines,
    layoutVisualLineCount,
    parseTocLogicalLines,
    parseTocRows,
    parseTocTextRows,
    codeTextFromBlock,
    delimitedLayoutTeX,
    layoutSpansToTranslationText,
    isSymbolGlossaryBlock,
    symbolGlossaryMarkers,
    plainBlockText,
    restoreSymbolGlossaryRowBreaks,
    symbolGlossaryParagraphs,
    formulaSpans,
    looksLikeDisplayFormula,
    imagePathFromBlock,
    inferFontSize,
    normalizePageSize,
    safeLayoutTextToHTML,
    layoutSpansToHTML,
    layoutLinesToHTML,
    normalizeLayoutHTMLSnippet,
    bboxWidth,
    bboxHeight,
    bboxCenter,
    bboxUnion,
    bboxArea,
    bboxContainedOverlapRatio,
    medianValue,
    streamSideForBBox,
    estimateLayoutFontSize,
    fixedLayoutFontSize,
    modelBBoxToPageBBox,
    collectModelOCRBoxes,
    ocrBoxesInRegion,
    estimateFirstLineIndent,
    refinedTextBBoxFromOCR,
    collectMediaCarrierBoxes,
    isLayoutMetadataText,
    looksLikeBodyProseEvidence,
    isBodyTextCandidate,
    looksLikeContinuation,
    assignLayoutColumnKeys,
    bodyColumnProfiles,
    matchesBodyColumnProfile,
    bboxMatchesColumn,
    isEarlyFrontMatterItem,
    promoteTextItemsToBody,
    inferSingleColumnProfile,
    singleColumnProfileMatches,
    promoteStableSingleColumnItems,
    pageHasParallelReadingLanes,
    pageHasSingleColumnAnchor,
    inheritStableSingleColumnShortItems,
    layoutBarrierBoxes,
    horizontalOverlapRatio,
    bodyMergeBlockedByBarrier,
    bodyMergeCreatesBarrierIntrusion,
    singleLineBodyItemsAreAdjacent,
    mergedPartIndent,
    mergedBodyParagraphs,
    mergeVerticalBodyItems,
    markEquationDenseBodyItems,
    mergeReferenceItems,
    lineDebugData,
    prepareFlowItems,
    columnRightEdgesFromStreams,
    equationNumberRightForBBox,
    numberedFormula,
    localColumnRight,
    expandNarrowStream,
    retreatIntrudingColumnBoundaries,
    streamParagraphs,
    translatedFlowPlainText,
    streamInnerBBox,
    estimateStreamUsedHeight,
    streamLineMetrics,
    streamBottomGap,
    solveUniformStreamStyle,
    absoluteVisuals,
    discardedPageVisuals,
    isPageFurniture,
    modelItemTextHTML,
    modelFallbackVisuals,
    expandSpecialAbsoluteBlocks,
    prepareRestoredPage
  };
});
