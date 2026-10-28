// jobs-submit — pure
import { buildUploadsEndpoint, submitUploadRequest, summarizeJobRequestContext } from "./http.js";
import * as generated from "./generated/create-job.js";
import { submitFailure } from "./request.js";
import type { CreateJobInput } from "@retainpdf/contracts/create-job";

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
  const legacyTopLevelFields = ["upload_id","artifact_job_id","mode","model","base_url","api_key","mineru_token","paddle_token","model_version","language","render_mode","skip_title_translation","batch_size","workers","classify_batch_size","compile_workers","rule_profile_name","custom_rules_text","timeout_seconds","no_output_timeout_seconds"];
  const leaked = legacyTopLevelFields.filter((f) => f in p);
  if (leaked.length > 0) throw new Error(`提交失败: /api/v1/jobs 不再接受旧扁平字段，发现 ${leaked.join(", ")}。请改为 source/ocr/translation/render/runtime 分组结构。`);
}

function isOcrWorkflowPayload(payload: unknown): boolean {
  return isObject(payload) && `${(payload as Record<string, unknown>).workflow || ""}`.trim() === "ocr";
}

/** 只做 OCR 的任务和别的任务一样走 POST /jobs（JSON，带已上传文件的 upload_id）；旧入口 /ocr/jobs（multipart）不再用。
 * 去掉只在浏览器里有意义的文件对象字段，后端拒收未知字段。 */
function ocrJobJson(payload: Record<string, unknown>, uploadId: string): Record<string, unknown> {
  const { file: _file, __file: _rawFile, ...rest } = payload as Record<string, unknown> & { file?: unknown; __file?: unknown };
  const { file: _sourceFile, ...source } = (isObject(rest.source) ? rest.source : {}) as Record<string, unknown> & { file?: unknown };
  return { ...rest, workflow: "ocr", source: { ...source, upload_id: uploadId } };
}

/** 调用方直接给了文件、还没上传：先 POST /uploads 拿 upload_id。界面上的提交都是先上传的，走不到这里。 */
async function uploadDirectFile(apiPrefix: string, payload: Record<string, unknown>): Promise<string> {
  const source = (isObject(payload.source) ? payload.source : {}) as Record<string, unknown>;
  const file = (payload as any).file || (payload as any).__file || (source as any).file;
  if (!(file instanceof Blob)) return "";
  const uploaded = await submitUploadRequest(buildUploadsEndpoint(apiPrefix), collectUploadFormData(file));
  return `${uploaded?.upload_id || ""}`.trim();
}

export async function submitJobRequest(apiPrefix: string, payload: unknown): Promise<any> {
  if (isOcrWorkflowPayload(payload)) {
    const p = payload as Record<string, unknown>;
    const source = (isObject(p.source) ? p.source : {}) as Record<string, unknown>;
    const uploadId = `${source.upload_id || ""}`.trim() || await uploadDirectFile(apiPrefix, p);
    if (!uploadId) throw new Error("提交失败: 请先上传文件再开始 OCR。");
    return createJob(apiPrefix, ocrJobJson(p, uploadId));
  }
  assertGroupedJobPayload(payload);
  return createJob(apiPrefix, payload as Record<string, unknown>);
}

// 报错和以前 submitJson 一样：页数额度不够给 PageQuotaError，其余带上 workflow、OCR 服务商、上传编号。
function createJob(apiPrefix: string, body: Record<string, unknown>): Promise<any> {
  return generated.createJob(apiPrefix, { body: body as unknown as CreateJobInput }, {
    onError: submitFailure(summarizeJobRequestContext(body)),
  });
}
