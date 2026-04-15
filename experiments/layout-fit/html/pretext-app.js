import {
  fitSampleWithPretext as fitSample,
  flowTextForSamples,
  measurePretext,
  targetHeightForSamples,
} from "./pretext-fit.js";
import { setMathText, typesetMath } from "./pretext-math.js";
import { renderPdfOverlay as renderPdfOverlayLayer } from "./pretext-pdf.js";

// App state and DOM bindings.
const state = { payload: null, sample: null, pdfPageIndex: 0, pdfRenderState: "idle", pdfPixelsPerPt: 2 };
const DEFAULT_PDF_PIXELS_PER_PT = 2;
const els = {
  loadDefault: document.getElementById("load-default"),
  fileInput: document.getElementById("file-input"),
  sampleSelect: document.getElementById("sample-select"),
  fontFamily: document.getElementById("font-family"),
  fontSize: document.getElementById("font-size"),
  lineHeight: document.getElementById("line-height"),
  targetWidth: document.getElementById("target-width"),
  fitHeight: document.getElementById("fit-height"),
  fitText: document.getElementById("fit-text"),
  applyTypst: document.getElementById("apply-typst"),
  measureBoth: document.getElementById("measure-both"),
  autoFit: document.getElementById("auto-fit"),
  status: document.getElementById("status"),
  sampleMeta: document.getElementById("sample-meta"),
  targetHeight: document.getElementById("target-height"),
  domHeight: document.getElementById("dom-height"),
  pretextHeight: document.getElementById("pretext-height"),
  heightDiff: document.getElementById("height-diff"),
  domLines: document.getElementById("dom-lines"),
  pretextLines: document.getElementById("pretext-lines"),
  domWidth: document.getElementById("dom-width"),
  pretextWidth: document.getElementById("pretext-width"),
  domPreview: document.getElementById("dom-preview"),
  pretextPreview: document.getElementById("pretext-preview"),
  domLinesText: document.getElementById("dom-lines-text"),
  pretextLinesText: document.getElementById("pretext-lines-text"),
  pdfTitle: document.getElementById("pdf-title"),
  pdfPrev: document.getElementById("pdf-prev"),
  pdfNext: document.getElementById("pdf-next"),
  pdfPageLabel: document.getElementById("pdf-page-label"),
  pdfStage: document.getElementById("pdf-stage"),
  pdfStack: document.getElementById("pdf-stack"),
  pdfImage: document.getElementById("pdf-image"),
  pdfOverlay: document.getElementById("pdf-overlay"),
  sandbox: document.getElementById("measure-sandbox"),
};

// Generic utilities.
function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function parseNum(el) {
  return Number.parseFloat(el.value || "0");
}

function cssFont(fontSizePt, fontFamily) {
  return `${fontSizePt}pt ${fontFamily}`;
}

function pdfPixelsPerPtFor(sample) {
  if (state.pdfPixelsPerPt && Number.isFinite(state.pdfPixelsPerPt)) {
    return state.pdfPixelsPerPt;
  }
  if (els.pdfImage?.naturalWidth && sample?.page?.width) {
    return els.pdfImage.naturalWidth / sample.page.width;
  }
  return DEFAULT_PDF_PIXELS_PER_PT;
}

function setPdfRenderState(value) {
  state.pdfRenderState = value;
  document.body.dataset.pdfRenderState = value;
}

// Sample/flow helpers.
function samplesForCurrentPdfPage() {
  if (!state.payload) return [];
  return state.payload.samples.filter((sample) => sample.page_index === state.pdfPageIndex);
}

function flowSamplesFor(sample) {
  if (!sample?.flow || !state.payload) return [sample];
  const byId = new Map(state.payload.samples.map((item) => [item.block_id, item]));
  return sample.flow.block_ids.map((blockId) => byId.get(blockId)).filter(Boolean);
}

function targetHeightForSample(sample) {
  return targetHeightForSamples(flowSamplesFor(sample));
}

function typstSeed(sample) {
  const typst = sample?.typst;
  if (!typst) return null;
  return {
    targetWidthPt: typst.width_pt ?? sample.target_box.width,
    targetHeightPt: typst.fit_height_pt ?? targetHeightForSample(sample),
    fontSizePt: typst.text_size_pt ?? typst.max_size_pt ?? null,
    lineHeightRatio: typst.leading_em ?? typst.max_leading_em ?? null,
  };
}

// PDF rendering.
function renderPdfOverlay(pageWidth, pageHeight, viewportWidth, viewportHeight) {
  renderPdfOverlayLayer({
    pageWidth,
    pageHeight,
    viewportWidth,
    viewportHeight,
    samples: samplesForCurrentPdfPage(),
    currentSample: state.sample,
    currentText: els.fitText.value,
    currentTargetWidthPt: parseNum(els.targetWidth) || state.sample.target_box.width,
    currentTargetHeightPt: parseNum(els.fitHeight) || state.sample.target_box.height,
    fontFamily: els.fontFamily.value.trim(),
    pdfPixelsPerPt: pdfPixelsPerPtFor(state.sample),
    overlayEl: els.pdfOverlay,
    fitSample: (sample, options) =>
      fitSample(sample, {
        ...options,
        flowSamples: flowSamplesFor(sample),
        round,
      }),
  });
}

async function renderPdfPage() {
  if (!state.sample || !state.payload) {
    return;
  }
  setPdfRenderState("loading");
  const pageCount = state.payload.source_pdf_page_count || 1;
  state.pdfPageIndex = Math.min(Math.max(state.pdfPageIndex, 0), pageCount - 1);
  const src = `../fixtures/pdf-pages/${state.sample.job_id}/page-${String(state.pdfPageIndex + 1).padStart(3, "0")}.png`;
  await new Promise((resolve, reject) => {
    els.pdfImage.onload = () => resolve();
    els.pdfImage.onerror = () => reject(new Error(`无法加载 PDF 页图片: ${src}`));
    els.pdfImage.src = src;
  });
  const pageSample = state.payload.samples.find((sample) => sample.page_index === state.pdfPageIndex) || state.sample;
  const pageWidth = pageSample.page.width;
  const pageHeight = pageSample.page.height;
  const viewportWidth = els.pdfImage.clientWidth || els.pdfImage.naturalWidth;
  const viewportHeight = els.pdfImage.clientHeight || els.pdfImage.naturalHeight;
  state.pdfPixelsPerPt = els.pdfImage.naturalWidth / pageWidth;
  els.pdfStack.style.width = `${viewportWidth}px`;
  els.pdfStack.style.height = `${viewportHeight}px`;
  els.pdfOverlay.style.width = `${viewportWidth}px`;
  els.pdfOverlay.style.height = `${viewportHeight}px`;
  els.pdfPageLabel.textContent = `第 ${state.pdfPageIndex + 1} / ${pageCount} 页`;
  els.pdfPrev.disabled = state.pdfPageIndex <= 0;
  els.pdfNext.disabled = state.pdfPageIndex >= pageCount - 1;
  renderPdfOverlay(pageWidth, pageHeight, viewportWidth, viewportHeight);
  typesetMath(els.pdfOverlay).catch(() => {});
  setPdfRenderState("ready");
}

// Data loading and sample selection.
function loadPayload(payload) {
  if (!payload || !Array.isArray(payload.samples) || payload.samples.length === 0) {
    setStatus("样本 JSON 不合法。", true);
    return;
  }
  state.payload = payload;
  els.sampleSelect.innerHTML = "";
  for (const sample of payload.samples) {
    const option = document.createElement("option");
    option.value = sample.sample_id;
    option.textContent = `${sample.block_id} · ${sample.target_box.width}×${sample.target_box.height}pt`;
    els.sampleSelect.append(option);
  }
  applySample(payload.samples[0].sample_id);
  setStatus(`已载入 ${payload.samples.length} 个样本。`);
}

function applySample(sampleId) {
  const sample = state.payload?.samples.find((item) => item.sample_id === sampleId);
  if (!sample) return;
  state.sample = sample;
  state.pdfPageIndex = sample.page_index;
  els.fitText.value = flowTextForSamples(flowSamplesFor(sample));
  const typst = typstSeed(sample);
  els.targetWidth.value = typst?.targetWidthPt ?? sample.target_box.width;
  els.fitHeight.value = typst?.targetHeightPt ?? targetHeightForSample(sample);
  els.targetHeight.textContent = `${parseNum(els.fitHeight)}pt`;
  const flowInfo = sample.flow
    ? ` | flow=${sample.flow.group_id} ${sample.flow.index + 1}/${sample.flow.count} | prev=${sample.flow.prev_block_id ?? "-"} | next=${sample.flow.next_block_id ?? "-"}`
    : "";
  els.sampleMeta.textContent =
    `job=${sample.job_id} | page=${sample.page_index} | block=${sample.block_id} | target=${sample.target_box.width}×${sample.target_box.height}pt | text_source=${sample.text_source ?? "unknown"} | typst_width=${sample.typst?.width_pt ?? "-"}pt | typst_leading=${sample.typst?.leading_em ?? sample.typst?.max_leading_em ?? "-"}em${flowInfo}`;
  const best = fitCurrentSample();
  if (typst?.fontSizePt && typst?.lineHeightRatio) {
    els.fontSize.value = typst.fontSizePt;
    els.lineHeight.value = typst.lineHeightRatio;
  } else if (best) {
    els.fontSize.value = best.fontSizePt;
    els.lineHeight.value = best.lineHeightRatio;
  } else {
    els.fontSize.value = 11;
    els.lineHeight.value = 1.2;
  }
  compareNow();
  if (typst?.fontSizePt && typst?.lineHeightRatio) {
    setStatus(
      `已加载 ${sample.block_id}，默认采用 Typst 参数种子：字号 ${typst.fontSizePt}pt，行高倍率 ${typst.lineHeightRatio}；文本仍来自翻译 JSON。`
    );
  } else if (best) {
    setStatus(
      `已加载 ${sample.block_id}，默认采用 Pretext 自动拟合：字号 ${best.fontSizePt}pt，行高倍率 ${best.lineHeightRatio}，Pretext 高度 ${best.height}pt。`
    );
  }
}

// Measurement and comparison UI.
function measureDom(text, widthPt, fontSizePt, lineHeightPt, fontFamily) {
  const node = els.sandbox;
  node.style.width = `${widthPt}pt`;
  node.style.font = cssFont(fontSizePt, fontFamily);
  node.style.lineHeight = `${lineHeightPt}pt`;
  node.textContent = text;

  const height = node.getBoundingClientRect().height;
  const lineCount = Math.max(1, Math.round(height / lineHeightPt));
  const maxLineWidth = node.scrollWidth;
  return {
    height: round(height),
    lineCount,
    maxLineWidth: round(maxLineWidth),
  };
}

function renderPreview(node, text, widthPt, fontSizePt, lineHeightPt, fontFamily) {
  node.style.width = `${widthPt}pt`;
  node.style.font = cssFont(fontSizePt, fontFamily);
  node.style.lineHeight = `${lineHeightPt}pt`;
  setMathText(node, text);
}

function fitCurrentSample() {
  if (!state.sample) {
    return null;
  }
  const text = els.fitText.value;
  const widthPt = parseNum(els.targetWidth);
  const targetHeightPt = targetHeightForSample(state.sample);
  const fontFamily = els.fontFamily.value.trim();
  return fitSample(state.sample, {
    flowSamples: flowSamplesFor(state.sample),
    text,
    currentText: text,
    currentSample: state.sample,
    targetWidthPt: widthPt,
    targetHeightPt,
    fontFamily,
    pdfPixelsPerPt: pdfPixelsPerPtFor(state.sample),
    round,
  });
}

function compareNow() {
  if (!state.sample) {
    setStatus("先加载样本。", true);
    return;
  }
  try {
    const text = els.fitText.value;
    const widthPt = parseNum(els.targetWidth);
    const fontSizePt = parseNum(els.fontSize);
    const lineHeightEm = parseNum(els.lineHeight);
    const lineHeightPt = fontSizePt * lineHeightEm;
    const fontFamily = els.fontFamily.value.trim();

    const dom = measureDom(text, widthPt, fontSizePt, lineHeightPt, fontFamily);
    const targetHeightPt = targetHeightForSample(state.sample);
    const pretext = fitSample(state.sample, {
      flowSamples: flowSamplesFor(state.sample),
      text,
      currentText: text,
      currentSample: state.sample,
      targetWidthPt: widthPt,
      targetHeightPt,
      fontFamily,
      pdfPixelsPerPt: pdfPixelsPerPtFor(state.sample),
      round,
      fontSizePt,
      minFontSizePt: fontSizePt,
      maxFontSizePt: fontSizePt,
      minLineHeightRatio: lineHeightEm,
      maxLineHeightRatio: lineHeightEm,
    }) || measurePretext({
      text,
      widthPt,
      fontSizePt,
      lineHeightPt,
      fontFamily,
      pdfPixelsPerPt: pdfPixelsPerPtFor(state.sample),
      round,
    });

    els.targetHeight.textContent = `${targetHeightPt}pt`;
    els.domHeight.textContent = `${dom.height}pt`;
    els.pretextHeight.textContent = `${pretext.height}pt`;
    els.heightDiff.textContent = `${round(Math.abs(dom.height - pretext.height))}pt`;
    els.domLines.textContent = String(dom.lineCount);
    els.pretextLines.textContent = String(pretext.lineCount);
    els.domWidth.textContent = `${dom.maxLineWidth}pt`;
    els.pretextWidth.textContent = `${pretext.maxLineWidth}pt`;

    renderPreview(els.domPreview, text, widthPt, fontSizePt, lineHeightPt, fontFamily);
    renderPreview(
      els.pretextPreview,
      pretext.lines.map((line) => line.text).join("\n"),
      widthPt,
      fontSizePt,
      lineHeightPt,
      fontFamily
    );

    els.domLinesText.textContent =
      `DOM 说明:\nheight=${dom.height}pt\nlineCount=${dom.lineCount}\nmaxLineWidth=${dom.maxLineWidth}pt\nlineHeight=${round(lineHeightPt)}pt (${lineHeightEm}x)`;
    els.pretextLinesText.textContent = [
      `Pretext 说明:`,
      `height=${pretext.height}pt`,
      `lineCount=${pretext.lineCount}`,
      `maxLineWidth=${pretext.maxLineWidth}pt`,
      `lastLineWidth=${pretext.lastLineWidth}pt`,
      `lineHeight=${round(lineHeightPt)}pt (${lineHeightEm}x)`,
      ``,
      ...pretext.lines.map((line) => `${round(line.width)}pt | ${line.text}`),
    ].join("\n");

    setStatus(`已完成 ${state.sample.block_id} 的 DOM / Pretext 对照。`);
    if (state.payload) {
      renderPdfPage().catch(() => {});
    }
    Promise.all([
      typesetMath(els.domPreview),
      typesetMath(els.pretextPreview),
    ]).catch(() => {});
  } catch (error) {
    setStatus(`Pretext 对照失败：${error.message}`, true);
  }
}

function autoFit() {
  if (!state.sample) {
    setStatus("先加载样本。", true);
    return;
  }
  try {
    const best = fitCurrentSample();
    const targetHeightPt = targetHeightForSample(state.sample);

    if (!best) {
      setStatus("自动拟合失败。", true);
      return;
    }

    els.fontSize.value = best.fontSizePt;
    els.lineHeight.value = best.lineHeightRatio;
    compareNow();
    setStatus(
      `自动拟合完成：字号 ${best.fontSizePt}pt，行高倍率 ${best.lineHeightRatio}，Pretext 高度 ${best.height}pt，目标 ${targetHeightPt}pt，行数 ${best.lineCount}，评分 ${round(best.score)}。`
    );
  } catch (error) {
    setStatus(`自动拟合失败：${error.message}`, true);
  }
}

async function loadDefaultSamples() {
  return loadSamplesForJob();
}

function jobIdFromSampleId(sampleId) {
  if (!sampleId || !sampleId.includes(":")) return null;
  return sampleId.split(":", 1)[0];
}

async function loadSamplesForJob(jobId = null) {
  const refs = jobId
    ? [
        `../fixtures/jobs/${jobId}/sample-blocks.v1.json`,
        "../fixtures/sample-blocks.v1.json",
      ]
    : ["../fixtures/sample-blocks.v1.json"];
  try {
    let lastError = null;
    for (const ref of refs) {
      const response = await fetch(ref);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json();
      if (jobId && payload.source_job_id !== jobId) {
        lastError = new Error(`fixture job mismatch: expected ${jobId}, got ${payload.source_job_id}`);
        continue;
      }
      loadPayload(payload);
      return;
    }
    throw lastError || new Error("no fixture found");
  } catch (error) {
    setStatus(`样本加载失败：${error.message}`, true);
  }
}

async function runFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("autoload")) {
    return;
  }
  const sampleId = params.get("sample");
  const jobId = params.get("job") || jobIdFromSampleId(sampleId);
  await loadSamplesForJob(jobId);
  if (params.get("sample")) {
    applySample(params.get("sample"));
  }
  if (params.get("autorun")) {
    compareNow();
  }
  if (params.get("autofit")) {
    autoFit();
  }
}

// Startup and event wiring.
function bindEvents() {
  els.loadDefault.addEventListener("click", loadDefaultSamples);
  els.sampleSelect.addEventListener("change", (event) => applySample(event.target.value));
  els.measureBoth.addEventListener("click", compareNow);
  els.autoFit.addEventListener("click", autoFit);
  els.pdfPrev.addEventListener("click", () => {
    state.pdfPageIndex -= 1;
    renderPdfPage().catch((error) => {
      setPdfRenderState(`error:${error.message}`);
      setStatus(`PDF 渲染失败：${error.message}`, true);
    });
  });
  els.pdfNext.addEventListener("click", () => {
    state.pdfPageIndex += 1;
    renderPdfPage().catch((error) => {
      setPdfRenderState(`error:${error.message}`);
      setStatus(`PDF 渲染失败：${error.message}`, true);
    });
  });
  window.addEventListener("resize", () => {
    if (state.sample && state.payload) {
      renderPdfPage().catch(() => {});
    }
  });
  els.applyTypst.addEventListener("click", () => {
    if (!state.sample?.typst) {
      setStatus("当前样本没有 Typst 参数。", true);
      return;
    }
    const typst = state.sample.typst;
    els.targetWidth.value = typst.width_pt ?? state.sample.target_box.width;
    els.fitHeight.value = typst.fit_height_pt ?? state.sample.target_box.height;
    els.fontSize.value = typst.text_size_pt ?? typst.max_size_pt ?? parseNum(els.fontSize);
    els.lineHeight.value = typst.leading_em ?? typst.max_leading_em ?? 1;
    compareNow();
    renderPdfPage().catch(() => {});
  });
  els.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      loadPayload(JSON.parse(await file.text()));
    } catch (error) {
      setStatus("读取样本 JSON 失败。", true);
    }
  });
}

function init() {
  bindEvents();
  runFromQuery();
}

init();
