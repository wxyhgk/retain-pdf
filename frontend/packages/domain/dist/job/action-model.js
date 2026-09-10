import { hasReadyManifestArtifact } from "./artifacts.js";
import { resolveJobActions, resolveJobSourcePdfAction, } from "./actions.js";
function currentWindowHref() {
    return typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : "http://127.0.0.1/";
}
export function buildReaderPageUrl(jobId, anchor = null) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
        return "";
    }
    const url = new URL("./reader.html", currentWindowHref());
    url.searchParams.set("job_id", normalizedJobId);
    if (Number.isFinite(Number(anchor?.pageIdx)) && anchor?.pageIdx !== null && `${anchor?.pageIdx}` !== "") {
        url.searchParams.set("page_idx", `${Number(anchor.pageIdx)}`);
    }
    if (`${anchor?.blockId || ""}`.trim()) {
        url.searchParams.set("block_id", `${anchor.blockId}`.trim());
    }
    // iframe 是独立文档,mock 场景需要显式透传,否则嵌入式阅读器会请求真实后端
    const mock = `${new URL(currentWindowHref()).searchParams.get("mock") || ""}`.trim();
    if (mock) {
        url.searchParams.set("mock", mock);
    }
    return url.toString();
}
export function isReaderActionEnabled(job, manifestPayload = null) {
    const actions = resolveJobActions(job);
    const sourcePdfAction = resolveJobSourcePdfAction(job, manifestPayload);
    return Boolean(job?.job_id
        && sourcePdfAction.ready
        && (hasReadyManifestArtifact(manifestPayload, "pdf")
            || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
            || hasReadyManifestArtifact(manifestPayload, "result_pdf")
            || actions.pdfEnabled));
}
