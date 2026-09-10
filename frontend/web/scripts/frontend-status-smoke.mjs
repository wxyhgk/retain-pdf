#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  resolveDisplayedStagePresentation,
  summarizeStageDetail,
  summarizeStageLabel,
} from "@retainpdf/domain/job-status";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "../..");
const DEFAULT_API_BASE = "http://127.0.0.1:41000";
const DEFAULT_EXPECTED_LABELS = [
  "第 1/4 步 · OCR 解析",
  "第 2/4 步 · 翻译",
  "第 3/4 步 · 渲染",
  "完成",
];

function printUsage() {
  console.log(`Usage:
  node frontend/web/scripts/frontend-status-smoke.mjs --file <pdf-path> [options]

Options:
  --file <path>              PDF file path to upload
  --api-base <url>           Rust API base, default from frontend config or ${DEFAULT_API_BASE}
  --x-api-key <key>          X-API-Key header, default from frontend/web/runtime-config.local.js
  --workflow <name>          book | translate | ocr, default book
  --ocr-provider <name>      paddle | mineru | local, default paddle
  --ocr-token <token>        OCR provider token, default from env or backend/pipeline/.env
  --model-api-key <key>      Translation API key, default from env or backend/pipeline/.env/deepseek.env
  --model <name>             Default deepseek-v4-flash
  --base-url <url>           Default https://api.deepseek.com/v1
  --page-ranges <ranges>     Optional page ranges, e.g. 1-3
  --ocr-options <json>       Provider options JSON; local requires a configured command
  --timeout-seconds <n>      Job runtime timeout payload field, default 1800
  --poll-ms <n>              Detail polling interval, default 1000
  --max-wait-ms <n>          Max local wait before abort, default 1800000
  --expect-labels <csv>      Expected labels, default full flow or OCR-only stage labels
  --report-file <path>       Optional JSON report output path
  --json                     Print final JSON summary
  --help                     Show this help
`);
}

function parseArgs(argv) {
  const result = {
    workflow: "book",
    ocrProvider: "paddle",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/v1",
    timeoutSeconds: 1800,
    pollMs: 1000,
    maxWaitMs: 1800_000,
    expectedLabels: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
      continue;
    }
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;
    switch (key) {
      case "file":
        result.file = value;
        break;
      case "api-base":
        result.apiBase = value;
        break;
      case "x-api-key":
        result.xApiKey = value;
        break;
      case "workflow":
        result.workflow = value;
        break;
      case "ocr-provider":
        result.ocrProvider = value;
        break;
      case "ocr-token":
        result.ocrToken = value;
        break;
      case "model-api-key":
        result.modelApiKey = value;
        break;
      case "model":
        result.model = value;
        break;
      case "base-url":
        result.baseUrl = value;
        break;
      case "page-ranges":
        result.pageRanges = value;
        break;
      case "ocr-options":
        result.ocrOptions = value;
        break;
      case "timeout-seconds":
        result.timeoutSeconds = Number(value);
        break;
      case "poll-ms":
        result.pollMs = Number(value);
        break;
      case "max-wait-ms":
        result.maxWaitMs = Number(value);
        break;
      case "expect-labels":
        result.expectedLabels = value.split(",").map((item) => item.trim()).filter(Boolean);
        break;
      case "report-file":
        result.reportFile = value;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }
  if (!Array.isArray(result.expectedLabels)) {
    result.expectedLabels = result.workflow === "ocr"
      ? ["第 1/4 步 · OCR 解析", "完成"]
      : [...DEFAULT_EXPECTED_LABELS];
  }
  return result;
}

function normalizeApiBase(value) {
  return `${value || ""}`.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "") || DEFAULT_API_BASE;
}

function envFileCandidatesForKey(key) {
  switch (key) {
    case "xApiKey":
      return [];
    case "paddleToken":
      return [path.join(REPO_ROOT, "backend/pipeline/.env/paddle.env")];
    case "mineruToken":
      return [path.join(REPO_ROOT, "backend/pipeline/.env/mineru.env")];
    case "deepseekApiKey":
      return [path.join(REPO_ROOT, "backend/pipeline/.env/deepseek.env")];
    default:
      return [];
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (_err) {
    return "";
  }
}

function parseJsConfigValue(content, key) {
  const matches = [...content.matchAll(new RegExp(`${key}\\s*:\\s*"([^"]*)"`, "gm"))];
  if (matches.length === 0) {
    return "";
  }
  return matches[matches.length - 1]?.[1]?.trim() || "";
}

async function resolveFrontendRuntimeConfig() {
  const localText = await readTextIfExists(path.join(FRONTEND_ROOT, "runtime-config.local.js"));
  const baseText = await readTextIfExists(path.join(FRONTEND_ROOT, "runtime-config.js"));
  const merged = `${baseText}\n${localText}`;
  return {
    apiBase: parseJsConfigValue(merged, "apiBase"),
    xApiKey: parseJsConfigValue(merged, "xApiKey"),
  };
}

async function resolveBackendLocalApiKey() {
  const authText = await readTextIfExists(path.join(REPO_ROOT, "backend/api/auth.local.json"));
  if (!authText) {
    return "";
  }
  try {
    const parsed = JSON.parse(authText);
    const firstKey = Array.isArray(parsed?.api_keys) ? parsed.api_keys[0] : "";
    return typeof firstKey === "string" ? firstKey.trim() : "";
  } catch (_err) {
    return "";
  }
}

function parseEnvAssignment(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m"));
  if (!match) {
    return "";
  }
  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

function parseRawSecret(content) {
  const lines = `${content || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length !== 1) {
    return "";
  }
  if (lines[0].includes("=")) {
    return "";
  }
  return lines[0];
}

async function resolveEnvBackedSecret(key, envNames) {
  for (const envName of envNames) {
    const value = `${process.env[envName] || ""}`.trim();
    if (value) {
      return value;
    }
  }
  for (const filePath of envFileCandidatesForKey(key)) {
    const text = await readTextIfExists(filePath);
    if (!text) {
      continue;
    }
    for (const envName of envNames) {
      const value = parseEnvAssignment(text, envName);
      if (value) {
        return value;
      }
    }
    const rawSecret = parseRawSecret(text);
    if (rawSecret) {
      return rawSecret;
    }
  }
  return "";
}

function buildHeaders(xApiKey, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (xApiKey) {
    headers["X-API-Key"] = xApiKey;
  }
  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const cause = error?.cause;
    const causeText = cause
      ? `${cause.code || cause.name || "error"} ${cause.message || ""}`.trim()
      : "";
    throw new Error(`request failed for ${url}${causeText ? `: ${causeText}` : `: ${error.message || error}`}`);
  }
}

async function assertOkResponse(response, prefix) {
  if (response.ok) {
    return;
  }
  const text = await response.text();
  throw new Error(`${prefix}: ${response.status} ${text || "unknown error"}`);
}

async function readApiEnvelope(response, prefix) {
  await assertOkResponse(response, prefix);
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || payload.code !== 0 || !("data" in payload)) {
    throw new Error(`${prefix}: invalid ApiResponse envelope`);
  }
  return payload.data;
}

async function uploadPdf({ apiBase, xApiKey, filePath }) {
  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "application/pdf" }), path.basename(filePath));
  const response = await safeFetch(`${apiBase}/api/v1/uploads`, {
    method: "POST",
    headers: buildHeaders(xApiKey),
    body: form,
  });
  return readApiEnvelope(response, "upload failed");
}

async function submitJob({
  apiBase,
  xApiKey,
  workflow,
  uploadId,
  ocrProvider,
  ocrToken,
  modelApiKey,
  model,
  baseUrl,
  pageRanges,
  ocrOptions,
  timeoutSeconds,
}) {
  if (workflow === "ocr") {
    const form = new FormData();
    form.append("workflow", "ocr");
    form.append("upload_id", uploadId);
    form.append("provider", ocrProvider);
    if (ocrProvider === "paddle" && ocrToken) {
      form.append("paddle_token", ocrToken);
      form.append("paddle_model", "PaddleOCR-VL-1.6");
    } else if (ocrProvider === "mineru" && ocrToken) {
      form.append("mineru_token", ocrToken);
      form.append("model_version", "vlm");
    }
    form.append("language", "ch");
    form.append("page_ranges", pageRanges || "");
    if (ocrOptions) {
      let parsed;
      try {
        parsed = JSON.parse(ocrOptions);
      } catch {
        throw new Error("--ocr-options must be valid JSON");
      }
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("--ocr-options must be a JSON object");
      }
      form.append("ocr_options", JSON.stringify(parsed));
    }
    form.append("timeout_seconds", String(timeoutSeconds));
    const response = await safeFetch(`${apiBase}/api/v1/ocr/jobs`, {
      method: "POST",
      headers: buildHeaders(xApiKey),
      body: form,
    });
    const created = await readApiEnvelope(response, "submit OCR job failed");
    if (created?.workflow !== "ocr" || created?.status !== "queued" || !`${created?.job_id || ""}`.trim()) {
      throw new Error("submit OCR job failed: invalid queued OCR job response");
    }
    return created;
  }
  const ocrField = ocrProvider === "paddle" ? "paddle_token" : "mineru_token";
  const payload = {
    workflow,
    source: {
      upload_id: uploadId,
    },
    runtime: {
      job_id: "",
      timeout_seconds: timeoutSeconds,
    },
    ocr: {
      provider: ocrProvider,
      [ocrField]: ocrToken,
      model_version: "vlm",
      language: "ch",
      page_ranges: pageRanges || "",
    },
    translation: {
      mode: "sci",
      math_mode: "direct_typst",
      model,
      base_url: baseUrl,
      api_key: modelApiKey,
      workers: 100,
      batch_size: 1,
      classify_batch_size: 12,
      rule_profile_name: "general_sci",
      custom_rules_text: "",
      glossary_id: "",
      glossary_entries: [],
      skip_title_translation: false,
    },
    render: workflow === "book"
      ? {
          render_mode: "auto",
          compile_workers: 8,
        }
      : undefined,
  };
  const response = await safeFetch(`${apiBase}/api/v1/jobs`, {
    method: "POST",
    headers: buildHeaders(xApiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readApiEnvelope(response, "submit job failed");
}

function jobApiPath(workflow, jobId) {
  return workflow === "ocr"
    ? `/api/v1/ocr/jobs/${jobId}`
    : `/api/v1/jobs/${jobId}`;
}

async function fetchJob(apiBase, xApiKey, workflow, jobId) {
  const response = await safeFetch(`${apiBase}${jobApiPath(workflow, jobId)}`, {
    headers: buildHeaders(xApiKey),
  });
  return readApiEnvelope(response, "fetch job failed");
}

async function fetchAllEvents(apiBase, xApiKey, workflow, jobId) {
  const items = [];
  let offset = 0;
  while (true) {
    const response = await safeFetch(`${apiBase}${jobApiPath(workflow, jobId)}/events?limit=200&offset=${offset}`, {
      headers: buildHeaders(xApiKey),
    });
    const data = await readApiEnvelope(response, "fetch events failed");
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);
    if (batch.length < 200) {
      return items;
    }
    offset += batch.length;
  }
}

function expectedPageCountFromRanges(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) return null;
  const pages = new Set();
  for (const token of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error(`invalid --page-ranges token: ${token}`);
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start) throw new Error(`invalid --page-ranges token: ${token}`);
    for (let page = start; page <= end; page += 1) pages.add(page);
  }
  return pages.size;
}

async function validateOcrArtifacts(apiBase, xApiKey, jobId, pageRanges = "") {
  const headers = buildHeaders(xApiKey);
  const artifactsResponse = await safeFetch(
    `${apiBase}/api/v1/ocr/jobs/${jobId}/artifacts`,
    { headers },
  );
  const artifacts = await readApiEnvelope(artifactsResponse, "fetch OCR artifacts failed");
  if (
    !artifacts?.normalized_document?.ready
    || !artifacts?.normalization_report?.ready
    || !artifacts?.markdown?.ready
  ) {
    throw new Error("OCR artifacts incomplete: normalized document/report/Markdown not ready");
  }

  const normalizedResponse = await safeFetch(
    `${apiBase}/api/v1/ocr/jobs/${jobId}/normalized-document`,
    { headers },
  );
  await assertOkResponse(normalizedResponse, "fetch normalized document failed");
  const normalized = await normalizedResponse.json();
  if (normalized?.schema !== "normalized_document_v1" || normalized?.schema_version !== "1.1") {
    throw new Error(
      `normalized document contract mismatch: schema=${normalized?.schema || ""} version=${normalized?.schema_version || ""}`,
    );
  }
  const pages = Array.isArray(normalized.pages) ? normalized.pages : [];
  if (normalized.page_count !== pages.length) {
    throw new Error(`normalized page_count mismatch: declared=${normalized.page_count} actual=${pages.length}`);
  }
  const expectedPageCount = expectedPageCountFromRanges(pageRanges);
  if (expectedPageCount !== null && pages.length !== expectedPageCount) {
    throw new Error(`page range was not applied: expected=${expectedPageCount} actual=${pages.length}`);
  }
  const blocks = pages.flatMap((page) => Array.isArray(page?.blocks) ? page.blocks : []);
  const usableBbox = (bbox, page) => {
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) return false;
    const [x1, y1, x2, y2] = bbox;
    const width = Number(page?.width);
    const height = Number(page?.height);
    if (!(x2 > x1 && y2 > y1 && x1 >= 0 && y1 >= 0)) return false;
    if (Number.isFinite(width) && x2 > width + 1) return false;
    if (Number.isFinite(height) && y2 > height + 1) return false;
    return true;
  };
  const invalidBlocks = [];
  pages.forEach((page, pageIndex) => {
    const pageBlocks = Array.isArray(page?.blocks) ? page.blocks : [];
    pageBlocks.forEach((block, blockIndex) => {
      if (!usableBbox(block?.bbox, page)) {
        invalidBlocks.push(`${pageIndex}:${blockIndex}:bbox`);
      }
      if (JSON.stringify(block?.geometry?.bbox) !== JSON.stringify(block?.bbox)) {
        invalidBlocks.push(`${pageIndex}:${blockIndex}:geometry`);
      }
      if (block?.reading_order !== blockIndex) {
        invalidBlocks.push(`${pageIndex}:${blockIndex}:reading_order`);
      }
    });
  });
  if (pages.length === 0 || blocks.length === 0 || invalidBlocks.length > 0) {
    throw new Error(
      `normalized document incomplete: pages=${pages.length} blocks=${blocks.length} invalid=${invalidBlocks.slice(0, 8).join(",")}`,
    );
  }

  const assets = normalized.assets && typeof normalized.assets === "object" ? normalized.assets : {};
  const assetIds = new Set(Object.keys(assets));
  for (const block of blocks.filter((item) => ["image", "chart"].includes(`${item?.type || ""}`))) {
    const references = [
      block?.content?.asset_id,
      ...(Array.isArray(block?.content?.asset_ids) ? block.content.asset_ids : []),
    ].filter(Boolean);
    if (references.length === 0 || references.some((assetId) => !assetIds.has(assetId))) {
      throw new Error(`normalized asset linkage invalid for block ${block?.block_id || "unknown"}`);
    }
  }

  const reportResponse = await safeFetch(
    `${apiBase}/api/v1/ocr/jobs/${jobId}/normalization-report`,
    { headers },
  );
  await assertOkResponse(reportResponse, "fetch normalization report failed");
  const report = await reportResponse.json();
  const reportValid = report?.validation?.valid ?? report?.valid;
  if (reportValid !== true) {
    throw new Error("normalization report is not valid");
  }

  const markdownResponse = await safeFetch(
    `${apiBase}/api/v1/jobs/${jobId}/markdown?raw=true`,
    { headers },
  );
  await assertOkResponse(markdownResponse, "fetch raw Markdown failed");
  const markdown = await markdownResponse.text();
  if (!markdown.trim()) throw new Error("OCR Markdown is empty");

  const markdownDocumentResponse = await safeFetch(
    `${apiBase}/api/v1/jobs/${jobId}/markdown/document`,
    { headers },
  );
  const markdownDocument = await readApiEnvelope(
    markdownDocumentResponse,
    "fetch structured Markdown failed",
  );
  const structuredMarkdown = `${markdownDocument?.content || markdownDocument?.content_with_absolute_image_urls || ""}`;
  if (!structuredMarkdown.trim()) throw new Error("structured OCR Markdown is empty");

  const regionsResponse = await safeFetch(
    `${apiBase}/api/v1/jobs/${jobId}/reader/regions`,
    { headers },
  );
  const regions = await readApiEnvelope(regionsResponse, "fetch Reader regions failed");
  const regionItems = Array.isArray(regions?.items) ? regions.items : [];
  const blockIds = new Set(blocks.map((block) => block?.block_id).filter(Boolean));
  if (
    regionItems.length !== blocks.length
    || regionItems.some((item) => !blockIds.has(item?.item_id) || item?.status !== "source_only")
  ) {
    throw new Error(`Reader regions mismatch: blocks=${blocks.length} regions=${regionItems.length}`);
  }

  const documentsResponse = await safeFetch(
    `${apiBase}/api/v1/documents?job_id=${encodeURIComponent(jobId)}`,
    { headers },
  );
  const documentsPayload = await readApiEnvelope(documentsResponse, "fetch OCR document link failed");
  const documents = Array.isArray(documentsPayload?.documents) ? documentsPayload.documents : [];
  const activeDocument = documents.find((item) => item?.active_job_id === jobId);
  if (!activeDocument?.document_id) throw new Error("OCR job is not linked to an active document");

  return {
    schemaVersion: normalized.schema_version,
    pageCount: pages.length,
    blockCount: blocks.length,
    locatedBlockCount: blocks.length,
    assetCount: assetIds.size,
    markdownChars: markdown.length,
    regionCount: regionItems.length,
    documentId: activeDocument.document_id,
    normalizedReady: true,
    normalizationReportReady: true,
    normalizationReportValid: true,
    markdownReady: true,
  };
}

function isTerminalStatus(status) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function snapshotSummary(job, eventsPayload = null) {
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  return {
    ts: new Date().toISOString(),
    status: `${job.status || ""}`.trim(),
    stage: `${job.current_stage || job.stage || job.runtime?.current_stage || ""}`.trim(),
    label: presentation.label,
    detail: presentation.detail,
    progressCurrent: Number(presentation.progressCurrent ?? NaN),
    progressTotal: Number(presentation.progressTotal ?? NaN),
    progressText: presentation.progressText,
  };
}

function shouldRecordObservation(previous, next) {
  if (!previous) {
    return true;
  }
  return previous.status !== next.status
    || previous.stage !== next.stage
    || previous.label !== next.label
    || previous.detail !== next.detail
    || previous.progressCurrent !== next.progressCurrent
    || previous.progressTotal !== next.progressTotal;
}

function summarizeEventForStatus(event, workflow = "") {
  const current = Number(event.progress?.current ?? NaN);
  const total = Number(event.progress?.total ?? NaN);
  const terminalStatus = `${event.payload?.status || ""}`.trim().toLowerCase();
  const status = event.event === "job_terminal"
    ? (["succeeded", "failed", "canceled"].includes(terminalStatus) ? terminalStatus : "failed")
    : "running";
  const rawStage = `${event.display_stage || event.stage || ""}`.trim();
  const stage = workflow === "ocr" && status === "running" && rawStage !== "queued"
    ? "ocr"
    : rawStage;
  const terminalLabel = status === "succeeded"
    ? "完成"
    : status === "failed"
      ? "失败"
      : status === "canceled"
        ? "已取消"
        : "";
  const terminalDetail = status === "succeeded"
    ? (workflow === "ocr" ? "OCR/文档解析已完成" : "翻译 PDF 已生成")
    : status === "failed"
      ? "任务失败，请查看详情"
      : status === "canceled"
        ? "任务已取消"
        : "";
  return {
    ts: event.ts || "",
    status,
    stage,
    label: terminalLabel || summarizeStageLabel({
      status,
      display_stage: stage,
      current_stage: stage,
    }),
    detail: terminalDetail || summarizeStageDetail({
      status,
      display_stage: stage,
      current_stage: stage,
      stage_detail: event.stage_detail || event.message || "",
      progress_current: Number.isFinite(current) ? current : null,
      progress_total: Number.isFinite(total) ? total : null,
    }),
    event: event.event || "",
  };
}

function validateExpectedLabels(observations, expectedLabels) {
  const seen = observations.map((item) => item.label);
  const missing = [];
  let cursor = 0;
  for (const expected of expectedLabels) {
    let found = false;
    while (cursor < seen.length) {
      if (seen[cursor] === expected) {
        found = true;
        cursor += 1;
        break;
      }
      cursor += 1;
    }
    if (!found) {
      missing.push(expected);
    }
  }
  return {
    ok: missing.length === 0,
    missing,
    seen,
  };
}

function formatObservation(item) {
  const progressText = Number.isFinite(item.progressCurrent) && Number.isFinite(item.progressTotal) && item.progressTotal > 0
    ? ` ${item.progressCurrent}/${item.progressTotal}`
    : "";
  return `${item.ts} | ${item.status} | ${item.label} | ${item.detail}${progressText}`;
}

async function writeReportFile(reportFile, payload) {
  if (!reportFile) {
    return;
  }
  const target = path.resolve(process.cwd(), reportFile);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.file) {
    printUsage();
    throw new Error("Missing required --file");
  }

  const frontendConfig = await resolveFrontendRuntimeConfig();
  const apiBase = normalizeApiBase(args.apiBase || frontendConfig.apiBase || DEFAULT_API_BASE);
  const localApiKey = await resolveBackendLocalApiKey();
  const xApiKey = `${args.xApiKey || frontendConfig.xApiKey || process.env.RETAIN_FRONTEND_X_API_KEY || localApiKey || ""}`.trim();
  const ocrToken = args.ocrProvider === "local"
    ? ""
    : `${args.ocrToken || await resolveEnvBackedSecret(
        args.ocrProvider === "paddle" ? "paddleToken" : "mineruToken",
        args.ocrProvider === "paddle" ? ["RETAIN_PADDLE_API_TOKEN", "PADDLE_API_TOKEN"] : ["RETAIN_MINERU_API_TOKEN", "MINERU_API_TOKEN"],
      )}`.trim();
  const modelApiKey = `${args.modelApiKey || await resolveEnvBackedSecret(
    "deepseekApiKey",
    ["RETAIN_TRANSLATION_API_KEY", "DEEPSEEK_API_KEY"],
  )}`.trim();

  if (args.ocrProvider !== "local" && !ocrToken) {
    throw new Error(`Missing OCR token for provider=${args.ocrProvider}`);
  }
  if (args.workflow !== "ocr" && !modelApiKey) {
    throw new Error("Missing translation API key");
  }

  const filePath = path.resolve(process.cwd(), args.file);
  const startedAt = Date.now();
  const upload = await uploadPdf({ apiBase, xApiKey, filePath });
  const job = await submitJob({
    apiBase,
    xApiKey,
    workflow: args.workflow,
    uploadId: upload.upload_id,
    ocrProvider: args.ocrProvider,
    ocrToken,
    modelApiKey,
    model: args.model,
    baseUrl: args.baseUrl,
    pageRanges: args.pageRanges || "",
    ocrOptions: args.ocrOptions || "",
    timeoutSeconds: args.timeoutSeconds,
  });

  const observations = [];
  let latest = null;
  let latestEvents = null;
  while (true) {
    const current = await fetchJob(apiBase, xApiKey, args.workflow, job.job_id);
    latestEvents = await fetchAllEvents(apiBase, xApiKey, args.workflow, job.job_id);
    latest = snapshotSummary(current, { items: latestEvents });
    if (shouldRecordObservation(observations[observations.length - 1], latest)) {
      observations.push(latest);
      console.log(formatObservation(latest));
    }
    if (isTerminalStatus(current.status)) {
      break;
    }
    if ((Date.now() - startedAt) > args.maxWaitMs) {
      throw new Error(`Smoke timeout after ${args.maxWaitMs} ms for job ${job.job_id}`);
    }
    await sleep(args.pollMs);
  }

  const events = await fetchAllEvents(apiBase, xApiKey, args.workflow, job.job_id);
  const eventSummaries = events
    .filter((item) => item?.stage || item?.stage_detail || item?.message)
    .map((item) => summarizeEventForStatus(item, args.workflow));

  const validation = validateExpectedLabels(
    [...eventSummaries, ...observations].sort((left, right) => `${left.ts}`.localeCompare(`${right.ts}`)),
    args.expectedLabels,
  );
  const ocrArtifacts = args.workflow === "ocr" && latest?.status === "succeeded"
    ? await validateOcrArtifacts(apiBase, xApiKey, job.job_id, args.pageRanges || "")
    : null;
  const result = {
    ok: validation.ok
      && latest?.status === "succeeded"
      && (args.workflow !== "ocr" || Boolean(
        ocrArtifacts?.normalizedReady
        && ocrArtifacts?.normalizationReportReady
        && ocrArtifacts?.markdownReady
      )),
    apiBase,
    workflow: args.workflow,
    ocrProvider: args.ocrProvider,
    file: filePath,
    uploadId: upload.upload_id,
    jobId: job.job_id,
    finalStatus: latest?.status || "",
    observedLabels: validation.seen,
    missingLabels: validation.missing,
    observations,
    eventCount: events.length,
    eventSamples: eventSummaries.slice(-12),
    ocrArtifacts,
  };

  await writeReportFile(args.reportFile, result);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    console.log(`job_id=${result.jobId}`);
    console.log(`final_status=${result.finalStatus}`);
    console.log(`observed_labels=${result.observedLabels.join(" -> ")}`);
    if (result.missingLabels.length > 0) {
      console.log(`missing_labels=${result.missingLabels.join(", ")}`);
    }
    console.log(`event_count=${result.eventCount}`);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
