// jobs-artifacts — pure (no mock)
import { API_PREFIX } from "./internal/runtime.js";
import * as generated from "./generated/reader-data.js";
import { failWith, orOnStatus } from "./request.js";
// /files 的文件名 → 前端各处认的产物键（以前 artifacts-manifest 的 artifact_key）和分组。
// 详情页、书籍文件页、阅读器都按这个键找文件、起标签、定下载名，所以在这里一次换好，
// 下游不用知道接口换了。表外的新文件照样列出来，键用文件名。
const LEGACY_ARTIFACT_SLOTS = {
    "source.pdf": { key: "source_pdf", group: "source" },
    "translated.pdf": { key: "translated_pdf", group: "rendered" },
    "side-by-side.pdf": { key: "side_by_side_pdf", group: "rendered" },
    "translated.docx": { key: "layout_docx", group: "rendered" },
    "all.zip": { key: "artifact_bundle_zip", group: "bundle" },
    "ocr.md": { key: "markdown_raw", group: "markdown" },
    "ocr.zip": { key: "markdown_bundle_zip", group: "markdown" },
    "normalized-document.json": { key: "normalized_document_json", group: "json" },
    "normalization-report.json": { key: "normalization_report_json", group: "json" },
    "translation-manifest.json": { key: "translation_manifest_json", group: "json" },
    "translation-checkpoint.json": { key: "translation_checkpoint_json", group: "json" },
    "translation-requests.jsonl": { key: "translation_request_journal_jsonl", group: "debug" },
    "render-config.json": { key: "render_config_json", group: "debug" },
    "pipeline-summary.json": { key: "pipeline_summary", group: "debug" },
    "events.jsonl": { key: "events_jsonl", group: "debug" },
    "typst/source.typ": { key: "typst_source", group: "typst" },
    "typst/render.pdf": { key: "typst_render_pdf", group: "typst" },
    "ocr-provider/result.json": { key: "provider_result_json", group: "provider" },
    "ocr-provider/raw.zip": { key: "provider_bundle_zip", group: "provider" },
};
/** 把 /files 摊平成产物清单的形状（{ job_id, items: [{ artifact_key, resource_url, … }] }）。 */
export function jobFilesToArtifactManifest(files) {
    const attempt = typeof files?.attempt === "number" ? files.attempt : null;
    const entries = [
        ...(files?.source ? [files.source] : []),
        ...(Array.isArray(files?.output) ? files.output : []),
        ...(Array.isArray(files?.internal) ? files.internal : []),
    ];
    const items = entries
        .filter((entry) => entry && typeof entry.name === "string" && entry.name && typeof entry.url === "string")
        .map((entry) => {
        const slot = LEGACY_ARTIFACT_SLOTS[entry.name];
        return {
            artifact_key: slot?.key || entry.name,
            artifact_group: slot?.group || "",
            artifact_kind: "file",
            ready: Boolean(entry.ready),
            on_demand: Boolean(entry.on_demand),
            file_name: entry.name,
            content_type: entry.content_type ?? null,
            size_bytes: entry.size_bytes ?? null,
            updated_at: entry.updated_at ?? null,
            source_stage: entry.stage ?? null,
            attempt,
            resource_url: entry.url,
        };
    });
    return { job_id: files?.job_id, items };
}
export async function fetchJobFiles(jobId, apiPrefix = API_PREFIX) {
    return orOnStatus(generated.listJobFiles(apiPrefix, { job_id: jobId }, { onError: failWith("读取任务文件失败，请稍后重试。") }), 404, null);
}
/** 任务的产物清单：读 /jobs/:id/files，换成以前 artifacts-manifest 的形状交给下游。 */
export async function fetchJobArtifactsManifest(jobId, apiPrefix = API_PREFIX) {
    return jobFilesToArtifactManifest(await fetchJobFiles(jobId, apiPrefix));
}
// /reader/markdown 是旧 /markdown（JSON）的新地址：字段是旧的超集（job_id、content、raw_url、images_base_url…）。
// 还没有 Markdown 时后端回 404，当作 null。
function readerMarkdown(jobId, apiPrefix, message) {
    return orOnStatus(generated.getReaderMarkdown(apiPrefix, { job_id: jobId }, { onError: failWith(message) }), 404, null);
}
export async function fetchJobMarkdown(jobId, apiPrefix = API_PREFIX) {
    return readerMarkdown(jobId, apiPrefix, "读取 Markdown 失败，请稍后重试。");
}
