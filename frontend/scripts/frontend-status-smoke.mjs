#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveDisplayedStagePresentation } from "../src/js/job-stage-presentation.js";
import { summarizeStageDetail, summarizeStageLabel } from "../src/js/job-status-summary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const DEFAULT_API_BASE = "http://127.0.0.1:41000";
const DEFAULT_EXPECTED_LABELS = [
  "第 1/4 步 · OCR 解析",
  "第 2/4 步 · 翻译",
  "第 3/4 步 · 渲染",
  "完成",
];

function printUsage() {
  console.log(`Usage:
  node frontend/scripts/frontend-status-smoke.mjs --file <pdf-path> [options]

Options:
  --file <path>              PDF file path to upload
  --api-base <url>           Rust API base, default from frontend config or ${DEFAULT_API_BASE}
  --x-api-key <key>          X-API-Key header, default from frontend/runtime-config.local.js
  --workflow <name>          book | translate, default book
  --ocr-provider <name>      paddle | mineru, default paddle
  --ocr-token <token>        OCR provider token, default from env or backend/scripts/.env
  --model-api-key <key>      Translation API key, default from env or backend/scripts/.env/deepseek.env
  --model <name>             Default deepseek-v4-flash
  --base-url <url>           Default https://api.deepseek.com/v1
  --page-ranges <ranges>     Optional page ranges, e.g. 1-3
  --timeout-seconds <n>      Job runtime timeout payload field, default 1800
  --poll-ms <n>              Detail polling interval, default 1000
  --max-wait-ms <n>          Max local wait before abort, default 1800000
  --expect-labels <csv>      Expected labels, default current 4-stage labels
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
    expectedLabels: [...DEFAULT_EXPECTED_LABELS],
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
      return [path.join(REPO_ROOT, "backend/scripts/.env/paddle.env")];
    case "mineruToken":
      return [path.join(REPO_ROOT, "backend/scripts/.env/mineru.env")];
    case "deepseekApiKey":
      return [path.join(REPO_ROOT, "backend/scripts/.env/deepseek.env")];
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
  const authText = await readTextIfExists(path.join(REPO_ROOT, "backend/rust_api/auth.local.json"));
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

async function uploadPdf({ apiBase, xApiKey, filePath }) {
  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "application/pdf" }), path.basename(filePath));
  const response = await safeFetch(`${apiBase}/api/v1/uploads`, {
    method: "POST",
    headers: buildHeaders(xApiKey),
    body: form,
  });
  await assertOkResponse(response, "upload failed");
  const payload = await response.json();
  return payload?.data || payload;
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
  timeoutSeconds,
}) {
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
  await assertOkResponse(response, "submit job failed");
  const body = await response.json();
  return body?.data || body;
}

async function fetchJob(apiBase, xApiKey, jobId) {
  const response = await safeFetch(`${apiBase}/api/v1/jobs/${jobId}`, {
    headers: buildHeaders(xApiKey),
  });
  await assertOkResponse(response, "fetch job failed");
  const payload = await response.json();
  return payload?.data || payload;
}

async function fetchAllEvents(apiBase, xApiKey, jobId) {
  const items = [];
  let offset = 0;
  while (true) {
    const response = await safeFetch(`${apiBase}/api/v1/jobs/${jobId}/events?limit=200&offset=${offset}`, {
      headers: buildHeaders(xApiKey),
    });
    await assertOkResponse(response, "fetch events failed");
    const payload = await response.json();
    const data = payload?.data || payload || {};
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);
    if (batch.length < 200) {
      return items;
    }
    offset += batch.length;
  }
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

function summarizeEventForStatus(event) {
  const current = Number(event.progress_current ?? NaN);
  const total = Number(event.progress_total ?? NaN);
  return {
    ts: event.ts || "",
    status: event.event === "job_terminal" ? "succeeded" : "running",
    stage: `${event.stage || ""}`.trim(),
    label: summarizeStageLabel({
      status: event.event === "job_terminal" ? "succeeded" : "running",
      current_stage: event.stage || "",
    }),
    detail: summarizeStageDetail({
      status: event.event === "job_terminal" ? "succeeded" : "running",
      current_stage: event.stage || "",
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
  const ocrToken = `${args.ocrToken || await resolveEnvBackedSecret(
    args.ocrProvider === "paddle" ? "paddleToken" : "mineruToken",
    args.ocrProvider === "paddle" ? ["RETAIN_PADDLE_API_TOKEN", "PADDLE_API_TOKEN"] : ["RETAIN_MINERU_API_TOKEN", "MINERU_API_TOKEN"],
  )}`.trim();
  const modelApiKey = `${args.modelApiKey || await resolveEnvBackedSecret(
    "deepseekApiKey",
    ["RETAIN_TRANSLATION_API_KEY", "DEEPSEEK_API_KEY"],
  )}`.trim();

  if (!ocrToken) {
    throw new Error(`Missing OCR token for provider=${args.ocrProvider}`);
  }
  if (!modelApiKey) {
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
    timeoutSeconds: args.timeoutSeconds,
  });

  const observations = [];
  let latest = null;
  let latestEvents = null;
  while (true) {
    const current = await fetchJob(apiBase, xApiKey, job.job_id);
    latestEvents = await fetchAllEvents(apiBase, xApiKey, job.job_id);
    latest = snapshotSummary(current, latestEvents);
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

  const events = await fetchAllEvents(apiBase, xApiKey, job.job_id);
  const eventSummaries = events
    .filter((item) => item?.stage || item?.stage_detail || item?.message)
    .map(summarizeEventForStatus);

  const validation = validateExpectedLabels(observations, args.expectedLabels);
  const result = {
    ok: validation.ok && latest?.status === "succeeded",
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
