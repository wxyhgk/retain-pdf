import { buildJobsEndpoint, submitJson, submitUploadRequest } from "./http.js";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function assertGroupedJobPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("提交失败: /api/v1/jobs 需要 JSON object 请求体。");
  }
  if (!payload.workflow || !isObject(payload.source)) {
    throw new Error("提交失败: /api/v1/jobs 必须使用 grouped JSON，至少包含 workflow 和 source。");
  }
  const legacyTopLevelFields = [
    "upload_id",
    "artifact_job_id",
    "mode",
    "model",
    "base_url",
    "api_key",
    "mineru_token",
    "paddle_token",
    "model_version",
    "language",
    "render_mode",
    "skip_title_translation",
    "batch_size",
    "workers",
    "classify_batch_size",
    "compile_workers",
    "rule_profile_name",
    "custom_rules_text",
    "timeout_seconds",
  ];
  const leakedLegacyFields = legacyTopLevelFields.filter((field) => field in payload);
  if (leakedLegacyFields.length > 0) {
    throw new Error(
      `提交失败: /api/v1/jobs 不再接受旧扁平字段，发现 ${leakedLegacyFields.join(", ")}。请改为 source/ocr/translation/render/runtime 分组结构。`,
    );
  }
}

function isOcrWorkflowPayload(payload) {
  return isObject(payload) && `${payload.workflow || ""}`.trim() === "ocr";
}

function appendFormField(form, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === "string") {
    // keep empty string as explicit clear? for OCR we skip empty except page_ranges? keep minimal: skip empty trim
    if (!value.trim() && key !== "page_ranges") return;
    form.append(key, value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
    return;
  }
  if (typeof value === "object") {
    form.append(key, JSON.stringify(value));
  }
}

function buildOcrFormData(payload) {
  const form = new FormData();
  const source = isObject(payload.source) ? payload.source : {};
  const ocr = isObject(payload.ocr) ? payload.ocr : {};
  const runtime = isObject(payload.runtime) ? payload.runtime : {};
  // file: allow payload.file or payload.__file or source.file (File/Blob)
  const directFile = payload.file || payload.__file || source.file;
  if (directFile instanceof File || directFile instanceof Blob) {
    const filename = (directFile instanceof File ? directFile.name : "") || source.filename || "upload.pdf";
    form.append("file", directFile, filename);
  }
  // 后端吸怪：显式透传 workflow，便于日志与校验
  appendFormField(form, "workflow", payload.workflow);
  appendFormField(form, "upload_id", source.upload_id);
  appendFormField(form, "source_url", source.source_url);
  appendFormField(form, "provider", ocr.provider);
  appendFormField(form, "ocr_credential_ref", ocr.credential_ref);
  appendFormField(form, "mineru_token", ocr.mineru_token);
  appendFormField(form, "paddle_token", ocr.paddle_token);
  appendFormField(form, "paddle_api_url", ocr.paddle_api_url);
  appendFormField(form, "paddle_model", ocr.paddle_model);
  appendFormField(form, "model_version", ocr.model_version);
  appendFormField(form, "language", ocr.language);
  appendFormField(form, "page_ranges", ocr.page_ranges);
  appendFormField(form, "is_ocr", ocr.is_ocr);
  appendFormField(form, "disable_formula", ocr.disable_formula);
  appendFormField(form, "disable_table", ocr.disable_table);
  appendFormField(form, "data_id", ocr.data_id);
  appendFormField(form, "no_cache", ocr.no_cache);
  appendFormField(form, "cache_tolerance", ocr.cache_tolerance);
  appendFormField(form, "extra_formats", ocr.extra_formats);
  appendFormField(form, "poll_interval", ocr.poll_interval);
  appendFormField(form, "poll_timeout", ocr.poll_timeout);
  if (ocr.ocr_options !== undefined || ocr.options !== undefined) {
    const options = ocr.ocr_options ?? ocr.options;
    appendFormField(form, "ocr_options", typeof options === "string" ? options : JSON.stringify(options));
  }
  appendFormField(form, "timeout_seconds", runtime.timeout_seconds);
  appendFormField(form, "job_id", runtime.job_id);
  // fallback: if no provider token fields yet, copy generic tokenField handling (ocr token already mapped)
  return form;
}

export async function submitJobRequest(apiPrefix, payload) {
  if (isOcrWorkflowPayload(payload)) {
    if (!isObject(payload) || !isObject(payload.source)) {
      throw new Error("提交失败: /api/v1/ocr/jobs 需要 grouped JSON，至少包含 workflow=ocr 和 source。");
    }
    const form = buildOcrFormData(payload);
    return submitUploadRequest(buildJobsEndpoint(apiPrefix, "ocr"), form, undefined);
  }
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}
