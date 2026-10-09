import type { JobLike, ManifestPayload } from "@retainpdf/domain/job";
import { hasReadyManifestArtifact, resolveJobActions } from "@retainpdf/domain/job";
import { buildReaderPageUrl } from "./routing.js";

/** 详情页动作链接的输入：resolveJobActions 的结果（允许部分字段缺省） */
type JobDetailActions = Partial<ReturnType<typeof resolveJobActions>>;

export interface JobDetailActionLinkInput {
  actions?: JobDetailActions;
  job?: JobLike | null;
  manifestPayload?: ManifestPayload | null;
}

export function isReaderActionEnabled({ actions = {}, job = {}, manifestPayload = null }: JobDetailActionLinkInput = {}) {
  return Boolean(
    job?.job_id
    && hasReadyManifestArtifact(manifestPayload, "source_pdf")
    && (hasReadyManifestArtifact(manifestPayload, "pdf")
      || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
      || hasReadyManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
}

export interface JobDetailActionLinkRenderInput extends JobDetailActionLinkInput {
  setActionLink: (id: string, href: string, enabled: boolean) => void;
}

export function renderJobDetailActionLinks({
  actions = {},
  job = {},
  manifestPayload = null,
  setActionLink,
}: JobDetailActionLinkRenderInput = {} as JobDetailActionLinkRenderInput) {
  const jobId = job?.job_id || "";
  const readerEnabled = isReaderActionEnabled({ actions, job, manifestPayload });
  setActionLink("detail-reader-btn", buildReaderPageUrl(jobId), readerEnabled);
  setActionLink("detail-pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
}
