import { appendResourceQuery, hasReadyManifestArtifact, resolveManifestArtifactUrl, resolveJobMarkdownContract, resolveResourceUrl, } from "./artifacts.js";
import { firstNonEmpty } from "./core.js";
const API_PREFIX = "/api/v1";
function artifactDisplayItem(job, ...keys) {
    const items = Array.isArray(job?.artifacts_display) ? job.artifacts_display : [];
    return items.find((item) => keys.includes(item?.key) || keys.includes(item?.kind)) || null;
}
function artifactDisplayReady(job, ...keys) {
    const item = artifactDisplayItem(job, ...keys);
    return Boolean(item?.ready);
}
function artifactDisplayUrl(job, ...keys) {
    const item = artifactDisplayItem(job, ...keys);
    return resolveResourceUrl(firstNonEmpty(item?.download_url, item?.url, item?.path));
}
function withIncludeJobDir(url) {
    return appendResourceQuery(url, { include_job_dir: "true" });
}
export function resolveJobActions(job) {
    const artifacts = job.artifacts || {};
    const links = job.links || {};
    const actions = job.actions || {};
    const artifactActions = artifacts.actions || {};
    const markdownContract = resolveJobMarkdownContract(job);
    const bundleEnabled = Boolean(actions.download_bundle?.enabled
        || artifactActions.download_bundle?.enabled
        || artifacts.bundle?.ready
        || artifacts.bundle_ready
        || job.bundle_ready
        || artifactDisplayReady(job, "bundle", "download_bundle", "archive"));
    const pdfEnabled = Boolean(actions.download_pdf?.enabled
        || artifactActions.download_pdf?.enabled
        || artifacts.pdf?.ready
        || artifacts.pdf_ready
        || job.pdf_ready
        || job.output_pdf_ready
        || artifactDisplayReady(job, "output_pdf", "pdf", "translated_pdf", "result_pdf"));
    const markdownJsonEnabled = Boolean(actions.open_markdown?.enabled
        || artifactActions.open_markdown?.enabled
        || markdownContract.ready
        || artifactDisplayReady(job, "markdown"));
    const markdownRawEnabled = Boolean(actions.open_markdown_raw?.enabled
        || artifactActions.open_markdown_raw?.enabled
        || markdownContract.ready
        || artifactDisplayReady(job, "markdown"));
    const rerunEnabled = Boolean(actions.rerun?.enabled ?? artifactActions.rerun?.enabled);
    return {
        cancelEnabled: Boolean(actions.cancel?.enabled ?? artifactActions.cancel?.enabled ?? (job.status === "queued" || job.status === "running")),
        rerunEnabled,
        bundleEnabled,
        pdfEnabled,
        markdownJsonEnabled,
        markdownRawEnabled,
        cancel: resolveResourceUrl(firstNonEmpty(actions.cancel?.url, artifactActions.cancel?.url, actions.cancel_url, links.cancel_url, links.cancel_path)),
        rerun: resolveResourceUrl(firstNonEmpty(actions.rerun?.url, artifactActions.rerun?.url, actions.rerun?.path, artifactActions.rerun?.path, actions.rerun_url, links.rerun_url, links.rerun_path)),
        bundle: resolveResourceUrl(firstNonEmpty(actions.download_bundle?.url, actions.download_bundle?.path, artifactActions.download_bundle?.url, artifactActions.download_bundle?.path, artifacts.bundle?.url, artifacts.bundle?.path, artifacts.bundle_url, artifacts.bundle_path, job.bundle_url, job.bundle_path, artifactDisplayUrl(job, "bundle", "download_bundle", "archive"))),
        pdf: resolveResourceUrl(firstNonEmpty(actions.download_pdf?.url, actions.download_pdf?.path, artifactActions.download_pdf?.url, artifactActions.download_pdf?.path, artifacts.pdf?.url, artifacts.pdf?.path, artifacts.pdf_url, artifacts.pdf_path, job.pdf_url, job.pdf_path, artifactDisplayUrl(job, "output_pdf", "pdf", "translated_pdf", "result_pdf"))),
        markdownJson: markdownContract.jsonUrl || artifactDisplayUrl(job, "markdown") || resolveResourceUrl(firstNonEmpty(actions.open_markdown?.url, actions.open_markdown?.path, artifactActions.open_markdown?.url, artifactActions.open_markdown?.path)),
        markdownRaw: markdownContract.rawUrl || artifactDisplayUrl(job, "markdown") || resolveResourceUrl(firstNonEmpty(actions.open_markdown_raw?.url, actions.open_markdown_raw?.path, artifactActions.open_markdown_raw?.url, artifactActions.open_markdown_raw?.path)),
    };
}
export function resolveJobMarkdownBundleAction(job, manifestPayload = null) {
    const artifacts = job?.artifacts || {};
    const actions = job?.actions || {};
    const artifactActions = artifacts.actions || {};
    const manifestUrl = resolveManifestArtifactUrl(manifestPayload, "markdown_bundle_zip", {
        includeJobDir: true,
    });
    const url = withIncludeJobDir(resolveResourceUrl(firstNonEmpty(manifestUrl, actions.download_markdown_bundle?.url, actions.download_markdown_bundle?.path, actions.download_markdown_zip?.url, actions.download_markdown_zip?.path, artifactActions.download_markdown_bundle?.url, artifactActions.download_markdown_bundle?.path, artifactActions.download_markdown_zip?.url, artifactActions.download_markdown_zip?.path, artifacts.markdown_bundle_zip?.url, artifacts.markdown_bundle_zip?.path, artifacts.markdown_bundle?.url, artifacts.markdown_bundle?.path, artifacts.markdown_zip?.url, artifacts.markdown_zip?.path, artifacts.markdown_bundle_zip_url, artifacts.markdown_bundle_zip_path, artifacts.markdown_bundle_url, artifacts.markdown_bundle_path, job?.markdown_bundle_zip_url, job?.markdown_bundle_zip_path, job?.markdown_bundle_url, job?.markdown_bundle_path, artifactDisplayUrl(job, "markdown_bundle_zip", "markdown_bundle", "markdown_zip"))));
    const ready = Boolean(hasReadyManifestArtifact(manifestPayload, "markdown_bundle_zip")
        || actions.download_markdown_bundle?.enabled
        || actions.download_markdown_zip?.enabled
        || artifactActions.download_markdown_bundle?.enabled
        || artifactActions.download_markdown_zip?.enabled
        || artifacts.markdown_bundle_zip?.ready
        || artifacts.markdown_bundle?.ready
        || artifacts.markdown_zip?.ready
        || artifacts.markdown_bundle_zip_ready
        || artifacts.markdown_bundle_ready
        || artifacts.markdown_zip_ready
        || job?.markdown_bundle_zip_ready
        || job?.markdown_bundle_ready
        || artifactDisplayReady(job, "markdown_bundle_zip", "markdown_bundle", "markdown_zip")
        || url);
    return {
        ready,
        url,
    };
}
export function resolveJobSourcePdfAction(job, manifestPayload = null) {
    const artifacts = job?.artifacts || {};
    const manifestUrl = resolveManifestArtifactUrl(manifestPayload, "source_pdf");
    const fallbackUrl = job?.job_id
        ? `${API_PREFIX}/jobs/${encodeURIComponent(job.job_id)}/artifacts/source_pdf`
        : "";
    const url = resolveResourceUrl(firstNonEmpty(manifestUrl, artifacts.source_pdf?.url, artifacts.source_pdf?.path, artifacts.source_pdf_url, artifacts.source_pdf_path, job?.source_pdf_url, job?.source_pdf_path, fallbackUrl));
    const ready = Boolean(hasReadyManifestArtifact(manifestPayload, "source_pdf")
        || artifacts.source_pdf?.ready
        || artifacts.source_pdf_ready
        || job?.source_pdf_ready);
    return {
        ready,
        url,
    };
}
