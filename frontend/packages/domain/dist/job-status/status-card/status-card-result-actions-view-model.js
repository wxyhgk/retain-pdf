import { buildReaderPageUrl, isReaderActionEnabled, } from "../../job/action-model.js";
import { isJobTerminal, } from "../../job/core.js";
import { resolveJobActions, resolveJobMarkdownBundleAction, resolveJobSourcePdfAction, } from "../../job/actions.js";
export function buildStatusCardResultActions({ job = null, manifest = null, } = {}) {
    const actions = resolveJobActions(job);
    const succeeded = isJobTerminal(job) && job?.status === "succeeded";
    const readerEnabled = isReaderActionEnabled(job, manifest);
    const sourcePdfAction = resolveJobSourcePdfAction(job, manifest);
    const markdownBundleAction = resolveJobMarkdownBundleAction(job, manifest);
    return {
        pdfReady: actions.pdfEnabled && Boolean(actions.pdf) && succeeded,
        pdfUrl: actions.pdf,
        markdownBundleReady: markdownBundleAction.ready && Boolean(markdownBundleAction.url) && succeeded,
        markdownBundleUrl: markdownBundleAction.url,
        readerReady: readerEnabled && succeeded,
        readerUrl: buildReaderPageUrl(job?.job_id),
        sourcePdfReady: sourcePdfAction.ready && Boolean(sourcePdfAction.url) && succeeded,
        sourcePdfUrl: sourcePdfAction.url,
    };
}
