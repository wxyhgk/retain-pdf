// jobs-submit — pure
import { buildUploadsEndpoint, submitUploadRequest, summarizeJobRequestContext } from "./http.js";
import * as generated from "./generated/create-job.js";
import { submitFailure } from "./request.js";
function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
// Upload 表单组参（纯）:仅拼 file 字段,与 frontend/web 旧实现逐字节一致。
export function collectUploadFormData(file) {
    const form = new FormData();
    form.append("file", file);
    return form;
}
function assertGroupedJobPayload(payload) {
    if (!isObject(payload))
        throw new Error("提交失败: /api/v1/jobs 需要 JSON object 请求体。");
    const p = payload;
    if (!p.workflow || !isObject(p.source))
        throw new Error("提交失败: /api/v1/jobs 必须使用 grouped JSON，至少包含 workflow 和 source。");
    const legacyTopLevelFields = ["upload_id", "artifact_job_id", "mode", "model", "base_url", "api_key", "mineru_token", "paddle_token", "model_version", "language", "render_mode", "skip_title_translation", "batch_size", "workers", "classify_batch_size", "compile_workers", "rule_profile_name", "custom_rules_text", "timeout_seconds", "no_output_timeout_seconds"];
    const leaked = legacyTopLevelFields.filter((f) => f in p);
    if (leaked.length > 0)
        throw new Error(`提交失败: /api/v1/jobs 不再接受旧扁平字段，发现 ${leaked.join(", ")}。请改为 source/ocr/translation/render/runtime 分组结构。`);
}
function isOcrWorkflowPayload(payload) {
    return isObject(payload) && `${payload.workflow || ""}`.trim() === "ocr";
}
/** 只做 OCR 的任务和别的任务一样走 POST /jobs（JSON，带已上传文件的 upload_id）；旧入口 /ocr/jobs（multipart）不再用。
 * 去掉只在浏览器里有意义的文件对象字段，后端拒收未知字段。 */
function ocrJobJson(payload, uploadId) {
    const { file: _file, __file: _rawFile, ...rest } = payload;
    const { file: _sourceFile, ...source } = (isObject(rest.source) ? rest.source : {});
    return { ...rest, workflow: "ocr", source: { ...source, upload_id: uploadId } };
}
/** 调用方直接给了文件、还没上传：先 POST /uploads 拿 upload_id。界面上的提交都是先上传的，走不到这里。 */
async function uploadDirectFile(apiPrefix, payload) {
    const source = (isObject(payload.source) ? payload.source : {});
    const file = payload.file || payload.__file || source.file;
    if (!(file instanceof Blob))
        return "";
    const uploaded = await submitUploadRequest(buildUploadsEndpoint(apiPrefix), collectUploadFormData(file));
    return `${uploaded?.upload_id || ""}`.trim();
}
export async function submitJobRequest(apiPrefix, payload) {
    if (isOcrWorkflowPayload(payload)) {
        const p = payload;
        const source = (isObject(p.source) ? p.source : {});
        const uploadId = `${source.upload_id || ""}`.trim() || await uploadDirectFile(apiPrefix, p);
        if (!uploadId)
            throw new Error("提交失败: 请先上传文件再开始 OCR。");
        return createJob(apiPrefix, ocrJobJson(p, uploadId));
    }
    assertGroupedJobPayload(payload);
    return createJob(apiPrefix, payload);
}
// 报错和以前 submitJson 一样：页数额度不够给 PageQuotaError，其余带上 workflow、OCR 服务商、上传编号。
function createJob(apiPrefix, body) {
    return generated.createJob(apiPrefix, { body: body }, {
        onError: submitFailure(summarizeJobRequestContext(body)),
    });
}
