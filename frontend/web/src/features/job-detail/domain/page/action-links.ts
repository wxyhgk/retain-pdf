import { hasReadyManifestArtifact } from "@retainpdf/domain/job";
import { buildReaderPageUrl } from "./routing.js";

export function isReaderActionEnabled({ actions = {}, job = {}, manifestPayload = null }: any = {}) {
  return Boolean(
    job?.job_id
    && hasReadyManifestArtifact(manifestPayload, "source_pdf")
    && (hasReadyManifestArtifact(manifestPayload, "pdf")
      || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
      || hasReadyManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
}

export function renderJobDetailActionLinks({
  actions = {},
  job = {},
  manifestPayload = null,
  setActionLink,
}: any = {}) {
  const jobId = job?.job_id || "";
  const readerEnabled = isReaderActionEnabled({ actions, job, manifestPayload });
  setActionLink("detail-reader-btn", buildReaderPageUrl(jobId), readerEnabled);
  setActionLink("detail-pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
}
