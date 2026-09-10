// jobs-submit — pure
import { buildJobsEndpoint, submitJson, submitUploadRequest } from "./http.js";

function isObject(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Upload 表单组参（纯）:仅拼 file 字段,与 frontend/web 旧实现逐字节一致。
export function collectUploadFormData(file: File | Blob): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

function assertGroupedJobPayload(payload: unknown): void {
  if (!isObject(payload)) throw new Error("提交失败: /api/v1/jobs 需要 JSON object 请求体。");
  const p = payload as Record<string, unknown>;
  if (!p.workflow || !isObject(p.source)) throw new Error("提交失败: /api/v1/jobs 必须使用 grouped JSON，至少包含 workflow 和 source。");
  const legacyTopLevelFields = ["upload_id","artifact_job_id","mode","model","base_url","api_key","mineru_token","paddle_token","model_version","language","render_mode","skip_title_translation","batch_size","workers","classify_batch_size","compile_workers","rule_profile_name","custom_rules_text","timeout_seconds"];
  const leaked = legacyTopLevelFields.filter((f) => f in p);
  if (leaked.length > 0) throw new Error(`提交失败: /api/v1/jobs 不再接受旧扁平字段，发现 ${leaked.join(", ")}。请改为 source/ocr/translation/render/runtime 分组结构。`);
}

function isOcrWorkflowPayload(payload: unknown): boolean {
  return isObject(payload) && `${(payload as Record<string, unknown>).workflow || ""}`.trim() === "ocr";
}

function appendFormField(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value === "string") {
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

function buildOcrFormData(payload: unknown): FormData {
  const p = payload as Record<string, unknown>;
  const source = (isObject(p.source) ? p.source : {}) as Record<string, unknown>;
  const ocr = (isObject(p.ocr) ? p.ocr : {}) as Record<string, unknown>;
  const runtime = (isObject(p.runtime) ? p.runtime : {}) as Record<string, unknown>;
  const form = new FormData();
  const directFile = (p as any).file || (p as any).__file || (source as any).file;
  if (directFile instanceof File || directFile instanceof Blob) {
    const filename = (directFile as File).name || (source.filename as string) || "upload.pdf";
    form.append("file", directFile as Blob, filename);
  }
  appendFormField(form, "workflow", (p as Record<string, unknown>).workflow);
  appendFormField(form, "upload_id", source.upload_id);
  appendFormField(form, "source_url", source.source_url);
  appendFormField(form, "provider", ocr.provider);
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
  const ocrOptions = (ocr as any).ocr_options ?? (ocr as any).options;
  if (ocrOptions !== undefined) {
    appendFormField(form, "ocr_options", typeof ocrOptions === "string" ? ocrOptions : JSON.stringify(ocrOptions));
  }
  appendFormField(form, "timeout_seconds", runtime.timeout_seconds);
  appendFormField(form, "job_id", runtime.job_id);
  return form;
}

export async function submitJobRequest(apiPrefix: string, payload: unknown): Promise<any> {
  if (isOcrWorkflowPayload(payload)) {
    if (!isObject(payload) || !isObject((payload as Record<string, unknown>).source)) {
      throw new Error("提交失败: /api/v1/ocr/jobs 需要 grouped JSON，至少包含 workflow=ocr 和 source。");
    }
    const form = buildOcrFormData(payload);
    return submitUploadRequest(buildJobsEndpoint(apiPrefix, "ocr"), form);
  }
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}
