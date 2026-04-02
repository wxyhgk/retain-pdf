import {
  prepareWithSegments,
  layoutNextLine,
  layoutWithLines,
} from "https://esm.sh/@chenglou/pretext";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.mjs";

const SAMPLE_ID = "20260331193234-e0319e";
const SAMPLE_ROOT = `./data/${SAMPLE_ID}`;
const DEFAULT_PREVIEW_MODE = "sample";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.mjs";

const state = {
  scale: 1,
  showOverlay: true,
  showBounds: false,
  selectedItemId: "",
  selectedUnitId: "",
  pageMeta: [],
  debugUnits: new Map(),
  restoreShowBoundsAfterPrint: false,
  previewMode: DEFAULT_PREVIEW_MODE,
  previewJobId: SAMPLE_ID,
  previewDataUrl: "",
  previewPdfUrl: "",
  sampleRoot: SAMPLE_ROOT,
  pdfDocumentPromise: null,
};

const $ = (id) => document.getElementById(id);
const pretextCache = new Map();
const BOX_PADDING_X = 8;
const BOX_PADDING_Y = 4;
const CSS_PX_TO_MM = 25.4 / 96.0;

function compareByReadingOrder(a, b) {
  return (
    (a.page_idx ?? 0) - (b.page_idx ?? 0)
    || ((a.bbox?.[1] ?? 0) - (b.bbox?.[1] ?? 0))
    || ((a.bbox?.[0] ?? 0) - (b.bbox?.[0] ?? 0))
    || String(a.item_id || "").localeCompare(String(b.item_id || ""))
  );
}

function getBoundaryRoleRank(item) {
  const role = item?.layout_boundary_role || "";
  if (role === "head") {
    return 0;
  }
  if (role === "middle") {
    return 1;
  }
  if (role === "tail") {
    return 2;
  }
  return 9;
}

function getZoneRankValue(item) {
  const value = item?.layout_zone_rank;
  return Number.isFinite(value) ? value : null;
}

function linesToText(lines) {
  return (lines || []).map((line) => line.text).join("\n").trim();
}

function updatePrintPageSize(documentJson) {
  const styleNode = $("print-page-style");
  const firstPage = documentJson?.pages?.[0];
  if (!styleNode || !firstPage) {
    return;
  }
  const widthPt = Number(firstPage.width || 0);
  const heightPt = Number(firstPage.height || 0);
  if (!(widthPt > 0) || !(heightPt > 0)) {
    styleNode.textContent = "";
    return;
  }
  const widthMm = (widthPt * CSS_PX_TO_MM).toFixed(2);
  const heightMm = (heightPt * CSS_PX_TO_MM).toFixed(2);
  styleNode.textContent = `@media print { @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; } }`;
}

function fitTextToBox(text, width, height, blockType) {
  const safeWidth = Math.max(width - BOX_PADDING_X, 1);
  const safeHeight = Math.max(height - BOX_PADDING_Y, 1);
  const textLength = Math.max(text.trim().length, 1);
  const widthDriven = safeWidth / Math.max(6, Math.min(textLength, 40));
  const heightDriven = safeHeight * (blockType === "title" ? 0.58 : 0.72);
  const size = Math.max(9, Math.min(blockType === "title" ? 28 : 20, widthDriven, heightDriven));
  return Math.round(size * 10) / 10;
}

function buildFontShorthand(fontSize, blockType) {
  const weight = blockType === "title" ? "700" : "400";
  const family = blockType === "code"
    ? '"JetBrains Mono", "Iosevka", monospace'
    : '"Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
  return `${weight} ${fontSize}px ${family}`;
}

function getBaseLineHeight(fontSize, blockType, lineHint = 0) {
  if (blockType === "title") {
    return Math.max(fontSize * 1.2, fontSize + 1.5);
  }
  if (blockType === "code") {
    return Math.max(fontSize * 1.24, fontSize + 1.5);
  }
  if (lineHint <= 2) {
    return Math.max(fontSize * 1.16, fontSize + 1.2);
  }
  if (lineHint <= 4) {
    return Math.max(fontSize * 1.22, fontSize + 1.4);
  }
  return Math.max(fontSize * 1.28, fontSize + 1.6);
}

function getPreparedText(text, font) {
  const cacheKey = `${font}::${text}`;
  let prepared = pretextCache.get(cacheKey);
  if (!prepared) {
    prepared = prepareWithSegments(text, font, { whiteSpace: "pre-wrap" });
    pretextCache.set(cacheKey, prepared);
  }
  return prepared;
}

function fitTextWithPretext(text, width, height, blockType, lineHint = 0) {
  const safeWidth = Math.max(width - BOX_PADDING_X, 1);
  const safeHeight = Math.max(height - BOX_PADDING_Y, 1);
  const textLength = Math.max(text.trim().length, 1);
  const minSize = blockType === "title" ? 11.5 : 9.5;
  let maxSize = blockType === "title" ? 34 : blockType === "code" ? 19 : 22;
  if (blockType !== "title" && blockType !== "code") {
    if (lineHint <= 2 || textLength <= 36) {
      maxSize = 28;
    } else if (lineHint <= 4 || textLength <= 96) {
      maxSize = 25;
    }
  }
  let low = minSize;
  let high = maxSize;
  let best = {
    fontSize: minSize,
    lineHeight: getBaseLineHeight(minSize, blockType, lineHint),
    lines: [],
  };

  for (let i = 0; i < 10; i += 1) {
    const size = (low + high) / 2;
    const lineHeight = getBaseLineHeight(size, blockType, lineHint);
    const font = buildFontShorthand(size, blockType);
    const prepared = getPreparedText(text, font);
    const result = layoutWithLines(prepared, safeWidth, lineHeight);
    if (result.height <= safeHeight) {
      best = {
        fontSize: size,
        lineHeight,
        lines: result.lines,
      };
      low = size;
    } else {
      high = size;
    }
  }

  return {
    fontSize: Math.round(best.fontSize * 10) / 10,
    lineHeight: Math.round(best.lineHeight * 10) / 10,
    lines: best.lines,
  };
}

function getUnitOrderedMembers(members) {
  return [...members].sort((a, b) => (
    (a.page_idx ?? 0) - (b.page_idx ?? 0)
    || ((getZoneRankValue(b) ?? -1) - (getZoneRankValue(a) ?? -1))
    || getBoundaryRoleRank(b) - getBoundaryRoleRank(a)
    || ((a.bbox?.[1] ?? 0) - (b.bbox?.[1] ?? 0))
    || ((a.bbox?.[0] ?? 0) - (b.bbox?.[0] ?? 0))
    || String(a.item_id || "").localeCompare(String(b.item_id || ""))
  ));
}

function hasMathContent(item) {
  return !!((item.render_formula_map || item.translation_unit_formula_map || item.formula_map || []).length);
}

function shouldSkipOverlay(item) {
  if (!item || typeof item !== "object") {
    return true;
  }
  if (item.block_type === "title") {
    return true;
  }
  if (item.should_translate === false) {
    return true;
  }
  const label = String(item.classification_label || "").trim();
  if (label.startsWith("skip_")) {
    return true;
  }
  return false;
}

function getPreviewConfig() {
  const config = window.__PREVIEW_CONFIG__;
  if (config && typeof config === "object" && config.jobId && config.dataUrl) {
    return {
      mode: "api",
      jobId: String(config.jobId),
      dataUrl: String(config.dataUrl),
    };
  }
  return {
    mode: DEFAULT_PREVIEW_MODE,
    jobId: SAMPLE_ID,
    sampleRoot: SAMPLE_ROOT,
  };
}

function layoutTextIntoBoxes(text, boxes, blockType) {
  const minSize = blockType === "title" ? 11 : 9;
  const maxSize = blockType === "title" ? 30 : blockType === "code" ? 18 : 22;
  let low = minSize;
  let high = maxSize;
  let best = null;

  for (let i = 0; i < 8; i += 1) {
    const size = (low + high) / 2;
    const lineHeight = getBaseLineHeight(size, blockType);
    const font = buildFontShorthand(size, blockType);
    const prepared = getPreparedText(text, font);
    const assignment = new Map();
    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let overflow = false;

    boxes.forEach((box) => {
      const width = Math.max(1, box.bbox[2] - box.bbox[0] - BOX_PADDING_X);
      const height = Math.max(1, box.bbox[3] - box.bbox[1] - BOX_PADDING_Y);
      const maxLines = Math.max(1, Math.floor(height / lineHeight));
      const lines = [];

      for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
        const nextLine = layoutNextLine(prepared, cursor, width);
        if (!nextLine) {
          break;
        }
        lines.push(nextLine);
        cursor = nextLine.end;
      }

      assignment.set(box.item_id, lines);
    });

    if (layoutNextLine(prepared, cursor, Number.MAX_SAFE_INTEGER)) {
      overflow = true;
    }

    if (!overflow) {
      best = {
        fontSize: Math.round(size * 10) / 10,
        lineHeight: Math.round(lineHeight * 10) / 10,
        assignment,
      };
      low = size;
    } else {
      high = size;
    }
  }

  return best;
}

function buildCrossBlockAssignments(translationsByPage) {
  const allItems = Array.from(translationsByPage.values()).flat();
  const byUnit = new Map();
  const debugUnits = new Map();

  allItems.forEach((item) => {
    const unitId = item.translation_unit_id || item.item_id;
    if (!byUnit.has(unitId)) {
      byUnit.set(unitId, []);
    }
    byUnit.get(unitId).push(item);
  });

  const assignments = new Map();
  byUnit.forEach((members, unitId) => {
    if (members.length <= 1) {
      return;
    }
    if (members.some(shouldSkipOverlay)) {
      return;
    }
    if (members.some(hasMathContent)) {
      return;
    }

    const ordered = getUnitOrderedMembers(members);
    const fullText = (
      ordered[0].translation_unit_translated_text
      || ordered[0].group_translated_text
      || ordered[0].translated_text
      || ordered[0].source_text
      || ""
    ).trim();
    if (!fullText) {
      return;
    }

    const blockType = ordered[0].block_type || "text";
    const samePage = new Set(ordered.map((item) => item.page_idx)).size === 1;
    const laidOut = layoutTextIntoBoxes(fullText, ordered, blockType);

    debugUnits.set(unitId, {
      unitId,
      samePage,
      pageIndex: ordered[0].page_idx ?? 0,
      strategy: "flow_all_boxes",
      fitSucceeded: !!laidOut,
      fontSize: laidOut?.fontSize ?? null,
      lineHeight: laidOut?.lineHeight ?? null,
      fullText,
      members: ordered.map((item, index) => ({
        itemId: item.item_id,
        pageIdx: item.page_idx,
        bbox: item.bbox,
        layoutBoundaryRole: item.layout_boundary_role || "",
        layoutZone: item.layout_zone || "",
        layoutZoneRank: getZoneRankValue(item),
        sourceText: item.source_text || "",
        segmentText: "",
        assignedText: linesToText(laidOut?.assignment?.get(item.item_id) || []),
        lineCount: (laidOut?.assignment?.get(item.item_id) || []).length,
      })),
    });

    if (!laidOut) {
      return;
    }

    ordered.forEach((item, index) => {
      assignments.set(item.item_id, {
        unitId,
        memberIndex: index,
        memberCount: ordered.length,
        fontSize: laidOut.fontSize,
        lineHeight: laidOut.lineHeight,
        lines: laidOut.assignment.get(item.item_id) || [],
        fallbackText: "",
      });
    });
  });

  return { assignments, debugUnits };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeFormulaLatex(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\u2212/g, "-");
}

function buildDisplayHtml(item) {
  const formulaMap = item.render_formula_map || item.translation_unit_formula_map || item.formula_map || [];
  if (!formulaMap.length) {
    return escapeHtml(buildPlainDisplayText(item));
  }

  const protectedText = (
    item.render_protected_text
    || item.render_source_text
    || item.protected_translated_text
    || item.translation_unit_protected_translated_text
    || item.group_protected_translated_text
    || item.translated_text
    || item.translation_unit_translated_text
    || item.group_translated_text
    || item.source_text
    || ""
  ).trim();
  let html = escapeHtml(protectedText);
  formulaMap.forEach((entry) => {
    const placeholder = escapeHtml(entry.placeholder || "");
    const latex = normalizeFormulaLatex(entry.formula_text || "");
    if (!placeholder || !latex) {
      return;
    }
    html = html.replaceAll(placeholder, `\\(${latex}\\)`);
  });
  return html;
}

function buildPlainDisplayText(item) {
  return (
    item.render_protected_text
    || item.translated_text
    || item.translation_unit_translated_text
    || item.group_translated_text
    || item.source_text
    || ""
  ).trim();
}

function renderPretextLines(node, lines, lineHeight, fallbackText = "") {
  if (!lines.length) {
    node.textContent = fallbackText;
    return;
  }
  node.textContent = "";
  lines.forEach((line, index) => {
    const lineNode = document.createElement("span");
    lineNode.className = "overlay-line";
    lineNode.style.top = `${2 + (index * lineHeight)}px`;
    lineNode.textContent = line.text;
    node.appendChild(lineNode);
  });
}

async function typesetMath(root = document) {
  if (!window.MathJax || typeof window.MathJax.typesetPromise !== "function") {
    return;
  }
  await window.MathJax.typesetPromise([root]);
}

function setDetail(item) {
  if (!item) {
    $("detail-empty").classList.remove("hidden");
    $("detail-panel").classList.add("hidden");
    return;
  }
  $("detail-empty").classList.add("hidden");
  $("detail-panel").classList.remove("hidden");
  $("detail-item-id").textContent = item.item_id || "-";
  $("detail-block-type").textContent = item.block_type || "-";
  $("detail-bbox").textContent = Array.isArray(item.bbox) ? item.bbox.join(", ") : "-";
  $("detail-source-text").textContent = item.source_text || "-";
  $("detail-translated-text").textContent = buildPlainDisplayText(item) || "-";
}

function selectItem(itemId) {
  state.selectedItemId = itemId || "";
  document.querySelectorAll(".overlay-item").forEach((node) => {
    node.classList.toggle("selected", node.dataset.itemId === state.selectedItemId);
  });
}

function highlightSelectedUnit() {
  document.querySelectorAll(".overlay-item").forEach((node) => {
    node.classList.toggle(
      "unit-selected",
      !!state.selectedUnitId && node.dataset.unitId === state.selectedUnitId,
    );
  });
}

function renderDebugPanel() {
  const samePageUnits = Array.from(state.debugUnits.values())
    .filter((unit) => unit.samePage)
    .sort((a, b) => (
      (a.pageIndex ?? 0) - (b.pageIndex ?? 0)
      || String(a.unitId).localeCompare(String(b.unitId))
    ));

  const select = $("debug-unit-select");
  select.innerHTML = "";
  samePageUnits.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit.unitId;
    option.textContent = `p${unit.pageIndex + 1} · ${unit.unitId}`;
    select.appendChild(option);
  });

  if (!samePageUnits.length) {
    $("debug-empty").classList.remove("hidden");
    $("debug-panel").classList.add("hidden");
    state.selectedUnitId = "";
    highlightSelectedUnit();
    return;
  }

  if (!state.selectedUnitId || !state.debugUnits.has(state.selectedUnitId) || !state.debugUnits.get(state.selectedUnitId).samePage) {
    state.selectedUnitId = samePageUnits[0].unitId;
  }
  select.value = state.selectedUnitId;

  const unit = state.debugUnits.get(state.selectedUnitId);
  if (!unit) {
    $("debug-empty").classList.remove("hidden");
    $("debug-panel").classList.add("hidden");
    highlightSelectedUnit();
    return;
  }

  $("debug-empty").classList.add("hidden");
  $("debug-panel").classList.remove("hidden");
  $("debug-unit-id").textContent = unit.unitId;
  $("debug-strategy").textContent = unit.strategy;
  $("debug-fit").textContent = unit.fitSucceeded
    ? `fit ok · ${unit.fontSize}px / line-height ${unit.lineHeight}px`
    : "fit failed · 当前分段无法在这组 bbox 中稳定排回";
  $("debug-full-text").textContent = unit.fullText || "-";

  const membersRoot = $("debug-members");
  membersRoot.className = "debug-members";
  membersRoot.innerHTML = "";
  unit.members.forEach((member, index) => {
    const card = document.createElement("article");
    card.className = "debug-member";

    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${member.itemId}`;

    const meta = document.createElement("div");
    meta.className = "debug-member-meta";
    meta.textContent =
      `page=${member.pageIdx + 1} · role=${member.layoutBoundaryRole || "-"} · zone=${member.layoutZone || "-"} · zone_rank=${member.layoutZoneRank ?? "-"} · bbox=${Array.isArray(member.bbox) ? member.bbox.join(", ") : "-"}`;

    const source = document.createElement("pre");
    source.textContent = `source\n${member.sourceText || "-"}`;

    const segment = document.createElement("pre");
    segment.textContent = `segment\n${member.segmentText || "-"}`;

    const assigned = document.createElement("pre");
    assigned.textContent = `assigned\n${member.assignedText || "-"}`;

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(source);
    card.appendChild(segment);
    card.appendChild(assigned);
    membersRoot.appendChild(card);
  });

  highlightSelectedUnit();
}

function selectUnit(unitId) {
  state.selectedUnitId = unitId || "";
  renderDebugPanel();
}

function renderTranslationItem(item) {
  if (shouldSkipOverlay(item)) {
    return null;
  }
  const text = buildPlainDisplayText(item);
  if (!Array.isArray(item.bbox) || item.bbox.length !== 4 || !text) {
    return null;
  }
  const [x0, y0, x1, y1] = item.bbox;
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const node = document.createElement("div");
  node.className = "overlay-item";
  node.dataset.itemId = item.item_id || "";
  node.dataset.blockType = item.block_type || "text";
  node.dataset.unitId = item.translation_unit_id || "";
  node.style.left = `${x0}px`;
  node.style.top = `${y0}px`;
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
  node.style.zIndex = `${100000 - Math.round(y0)}`;
  const hasMath = hasMathContent(item);
  if (hasMath) {
    const fontSize = fitTextToBox(text, width, height, item.block_type);
    const lineHeight = getBaseLineHeight(fontSize, item.block_type, item.lines?.length || 0);
    node.style.fontSize = `${fontSize}px`;
    node.style.lineHeight = `${lineHeight}px`;
    node.innerHTML = buildDisplayHtml(item);
  } else {
    const fitted = fitTextWithPretext(text, width, height, item.block_type, item.lines?.length || 0);
    node.style.fontSize = `${fitted.fontSize}px`;
    node.style.lineHeight = `${fitted.lineHeight}px`;
    renderPretextLines(node, fitted.lines, fitted.lineHeight, text);
  }
  node.classList.toggle("show-bounds", state.showBounds);
  node.addEventListener("click", () => {
    selectItem(item.item_id || "");
    setDetail(item);
    if (item.translation_unit_id) {
      selectUnit(item.translation_unit_id);
    }
  });
  return node;
}

function renderTranslationItemWithAssignment(item, assignment) {
  if (shouldSkipOverlay(item)) {
    return null;
  }
  if (!Array.isArray(item.bbox) || item.bbox.length !== 4) {
    return null;
  }
  const [x0, y0, x1, y1] = item.bbox;
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const node = document.createElement("div");
  node.className = "overlay-item";
  node.dataset.itemId = item.item_id || "";
  node.dataset.blockType = item.block_type || "text";
  node.dataset.unitId = assignment.unitId || "";
  node.style.left = `${x0}px`;
  node.style.top = `${y0}px`;
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
  node.style.zIndex = `${100000 - Math.round(y0)}`;
  node.style.fontSize = `${assignment.fontSize}px`;
  node.style.lineHeight = `${assignment.lineHeight}px`;
  renderPretextLines(
    node,
    assignment.lines || [],
    assignment.lineHeight,
    assignment.fallbackText || "",
  );
  node.classList.toggle("show-bounds", state.showBounds);
  node.classList.toggle("cross-block-item", assignment.memberCount > 1);
  node.addEventListener("click", () => {
    selectItem(item.item_id || "");
    setDetail(item);
    if (item.translation_unit_id) {
      selectUnit(item.translation_unit_id);
    }
  });
  return node;
}

async function renderPdfBackground(page, stage) {
  if (!state.previewPdfUrl) {
    return;
  }
  if (!state.pdfDocumentPromise) {
    state.pdfDocumentPromise = pdfjsLib.getDocument(state.previewPdfUrl).promise;
  }
  const pdfDocument = await state.pdfDocumentPromise;
  const pdfPage = await pdfDocument.getPage(page.page_index + 1);
  const deviceScale = window.devicePixelRatio || 1;
  const viewport = pdfPage.getViewport({ scale: state.scale });
  const renderViewport = pdfPage.getViewport({ scale: state.scale * deviceScale });
  const canvas = document.createElement("canvas");
  canvas.className = "page-background page-background-canvas";
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext("2d");
  await pdfPage.render({
    canvasContext: ctx,
    viewport: renderViewport,
  }).promise;
  const oldNode = stage.querySelector(".page-background");
  if (oldNode) {
    oldNode.replaceWith(canvas);
  } else {
    stage.prepend(canvas);
  }
}

function buildPageCard(page, items, assignments) {
  const pageCard = document.createElement("article");
  pageCard.className = "page-card";

  const title = document.createElement("h2");
  title.className = "page-title";
  title.textContent = `第 ${page.page_index + 1} 页 · ${page.width.toFixed(1)} × ${page.height.toFixed(1)} pt`;

  const stage = document.createElement("div");
  stage.className = "page-stage";
  stage.style.width = `${page.width * state.scale}px`;
  stage.style.height = `${page.height * state.scale}px`;

  const overlay = document.createElement("div");
  overlay.className = "page-overlay";
  overlay.style.transform = `scale(${state.scale})`;
  overlay.style.transformOrigin = "top left";
  overlay.classList.toggle("hidden", !state.showOverlay);

  items.forEach((item) => {
    const assignment = assignments.get(item.item_id);
    const node = assignment
      ? renderTranslationItemWithAssignment(item, assignment)
      : renderTranslationItem(item);
    if (node) {
      overlay.appendChild(node);
    }
  });

  if (state.previewMode === "sample") {
    const background = document.createElement("img");
    background.className = "page-background";
    background.alt = `page ${page.page_index + 1}`;
    background.src = `${state.sampleRoot}/pages/page-${String(page.page_index + 1).padStart(3, "0")}.png`;
    stage.appendChild(background);
  }
  stage.appendChild(overlay);
  pageCard.appendChild(title);
  pageCard.appendChild(stage);
  if (state.previewMode === "api") {
    renderPdfBackground(page, stage).catch((error) => {
      console.error(`PDF background render failed for page ${page.page_index + 1}:`, error);
    });
  }
  return pageCard;
}

function renderPages(documentJson, translationsByPage) {
  const root = $("pages-root");
  root.innerHTML = "";
  state.pageMeta = documentJson.pages || [];
  const { assignments, debugUnits } = buildCrossBlockAssignments(translationsByPage);
  state.debugUnits = debugUnits;
  state.pageMeta.forEach((page) => {
    const pageItems = translationsByPage.get(page.page_index) || [];
    root.appendChild(buildPageCard(page, pageItems, assignments));
  });
  renderDebugPanel();
  typesetMath(root).catch((error) => {
    console.error("MathJax typeset failed:", error);
  });
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`读取失败: ${path} (${response.status})`);
  }
  return response.json();
}

async function loadSample() {
  state.pdfDocumentPromise = null;
  const config = getPreviewConfig();
  state.previewMode = config.mode;
  state.previewJobId = config.jobId;
  state.sampleRoot = config.sampleRoot || SAMPLE_ROOT;

  let documentJson;
  let summary;
  let translations;

  if (config.mode === "api") {
    state.previewDataUrl = config.dataUrl;
    const payload = await loadJson(config.dataUrl);
    documentJson = payload.document;
    summary = payload.summary || {};
    state.previewPdfUrl = payload.source_pdf_url || "";
    translations = new Map(
      (payload.page_translations || []).map((entry) => [entry.page_index, entry.items || []]),
    );
  } else {
    state.previewDataUrl = "";
    state.previewPdfUrl = "";
    [documentJson, summary] = await Promise.all([
      loadJson(`${state.sampleRoot}/document.v1.json`),
      loadJson(`${state.sampleRoot}/pipeline_summary.json`),
    ]);
    const translationPromises = Array.from({ length: documentJson.page_count }, (_, index) =>
      loadJson(
        `${state.sampleRoot}/translations/page-${String(index + 1).padStart(3, "0")}-deepseek.json`,
      ).then((payload) => [index, payload]),
    );
    translations = new Map(await Promise.all(translationPromises));
  }

  updatePrintPageSize(documentJson);
  $("sample-summary").textContent =
    `${config.mode === "api" ? "任务" : "样例任务"} ${state.previewJobId} · ${documentJson.page_count} 页 · render_mode=${summary.effective_render_mode || "-"}`;
  renderPages(documentJson, translations);
}

function bindToolbar() {
  $("export-pdf-button").addEventListener("click", () => {
    state.restoreShowBoundsAfterPrint = state.showBounds;
    if (state.showBounds) {
      state.showBounds = false;
      document.querySelectorAll(".overlay-item").forEach((node) => {
        node.classList.remove("show-bounds");
      });
      const toggle = $("show-bounds-toggle");
      if (toggle) {
        toggle.checked = false;
      }
    }
    window.print();
  });

  window.addEventListener("afterprint", () => {
    if (!state.restoreShowBoundsAfterPrint) {
      return;
    }
    state.showBounds = true;
    document.querySelectorAll(".overlay-item").forEach((node) => {
      node.classList.add("show-bounds");
    });
    const toggle = $("show-bounds-toggle");
    if (toggle) {
      toggle.checked = true;
    }
    state.restoreShowBoundsAfterPrint = false;
  });

  $("scale-select").addEventListener("change", (event) => {
    state.scale = Number(event.target.value || "1");
    loadSample().catch((error) => {
      $("sample-summary").textContent = error.message;
    });
  });

  $("show-overlay-toggle").addEventListener("change", (event) => {
    state.showOverlay = !!event.target.checked;
    document.querySelectorAll(".page-overlay").forEach((node) => {
      node.classList.toggle("hidden", !state.showOverlay);
    });
  });

  $("show-bounds-toggle").addEventListener("change", (event) => {
    state.showBounds = !!event.target.checked;
    document.querySelectorAll(".overlay-item").forEach((node) => {
      node.classList.toggle("show-bounds", state.showBounds);
    });
  });

  $("debug-unit-select").addEventListener("change", (event) => {
    selectUnit(event.target.value || "");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindToolbar();
  loadSample().catch((error) => {
    $("sample-summary").textContent = error.message;
  });
});
