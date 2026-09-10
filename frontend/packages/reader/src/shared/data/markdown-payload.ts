export type NormalizedMarkdownPayload = {
  payload: any;
  content: string;
  imagesBaseUrl: string;
  ready: boolean;
};

function unwrapPayload(payload: any): any {
  if (
    payload
    && typeof payload === "object"
    && payload.data
    && typeof payload.data === "object"
    && !Array.isArray(payload.data)
  ) {
    return payload.data;
  }
  return payload;
}

function nonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Translation jobs can reuse OCR artifacts owned by an earlier job. In that
 * case the translation job has PDFs and translations, while Markdown remains
 * under the source OCR job. Resolve that ownership link from the public job
 * detail without coupling the Reader to a particular API envelope version.
 */
export function resolveLinkedMarkdownJobId(payload: any, currentJobId = ""): string {
  const value = unwrapPayload(payload) || {};
  const candidates = [
    value.source_artifact_job_id,
    value.request_payload?.source?.artifact_job_id,
    value.request?.source?.artifact_job_id,
    value.source?.artifact_job_id,
  ];
  const current = nonEmptyString(currentJobId);
  for (const candidate of candidates) {
    const jobId = nonEmptyString(candidate);
    if (jobId && jobId !== current) return jobId;
  }
  return "";
}

export function normalizeMarkdownPayload(payload: any): NormalizedMarkdownPayload {
  const value = unwrapPayload(payload) || {};
  const content = `${
    value.content_with_absolute_image_urls
    || value.content
    || value.markdown
    || ""
  }`;
  return {
    payload: value,
    content,
    imagesBaseUrl: `${value.images_base_url || value.images_base_path || ""}`.trim(),
    ready: value.ready !== false && Boolean(content.trim()),
  };
}

export function hasMarkdownContent(payload: any): boolean {
  return Boolean(normalizeMarkdownPayload(payload).content.trim());
}

export async function loadMarkdownPayloadWithFallback(
  loadDocument: () => Promise<any>,
  loadLegacy: () => Promise<any>,
): Promise<any> {
  let documentPayload: any = null;
  try {
    documentPayload = await loadDocument();
    if (hasMarkdownContent(documentPayload)) {
      return documentPayload;
    }
  } catch {
    // Older APIs may not expose /markdown/document; use the legacy payload.
  }
  const legacyPayload = await loadLegacy();
  if (hasMarkdownContent(legacyPayload)) {
    return legacyPayload;
  }
  return documentPayload ?? legacyPayload;
}
