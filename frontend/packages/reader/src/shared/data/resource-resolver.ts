// 共享真值（原 frontend/web/src/js/reader/resource-resolver.ts），已抽离为纯函数 + 可注入依赖
// 不直接 import frontend/web 的 job/artifacts 等，改为参数注入，默认用本地最小实现

function defaultResolveResourceUrl(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function defaultFindReadyManifestArtifact(
  manifestPayload: any,
  artifactKey: string,
): any | null {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  return items.find((entry: any) => entry?.artifact_key === artifactKey && entry?.ready) || null;
}

function defaultResolveManifestArtifactUrl(
  manifestPayload: any,
  artifactKey: string,
  { resolveResourceUrl = defaultResolveResourceUrl, findReadyManifestArtifact = defaultFindReadyManifestArtifact }: {
    resolveResourceUrl?: (v: unknown) => string;
    findReadyManifestArtifact?: typeof defaultFindReadyManifestArtifact;
  } = {},
): string {
  const item = findReadyManifestArtifact(manifestPayload, artifactKey);
  const raw = `${item?.resource_url || item?.resource_path || ""}`.trim();
  if (!raw) return "";
  return resolveResourceUrl(raw);
}

function defaultResolveReaderArtifactUrl(item: any, { resolveResourceUrl = defaultResolveResourceUrl }: { resolveResourceUrl?: (v: unknown) => string } = {}): string {
  return resolveResourceUrl(item?.resource_url || item?.resource_path || "");
}

function defaultResolveJobActions(job: any): { pdfEnabled?: boolean; pdf?: string } | null {
  if (!job) return null;
  // 兼容 job.actions / artifacts 的 pdf enabled 语义，最小实现：仅看 pdfEnabled/pdf 字段
  const actions = job?.actions || {};
  const artifacts = job?.artifacts || {};
  const pdfEnabled = Boolean(
    actions.download_pdf?.enabled
    ?? artifacts.pdf?.ready
    ?? job?.pdf_ready
    ?? job?.output_pdf_ready
  );
  const pdf = `${actions.download_pdf?.url || artifacts.pdf?.url || job?.pdf_url || ""}`.trim();
  return { pdfEnabled, pdf: pdf ? defaultResolveResourceUrl(pdf) : "" };
}

export function resolveReaderJobId(configPort: any): string {
  return configPort?.readerJobId?.() || "";
}

export function resolveReaderSourcePdf(
  manifestPayload: any,
  {
    findReadyManifestArtifact = defaultFindReadyManifestArtifact,
    resolveManifestArtifactUrl: resolveUrl = (payload: any, key: string) => defaultResolveManifestArtifactUrl(payload, key, { findReadyManifestArtifact }),
  }: {
    findReadyManifestArtifact?: typeof defaultFindReadyManifestArtifact;
    resolveManifestArtifactUrl?: (payload: any, key: string) => string;
  } = {},
): string | any | null {
  const viaUrl = resolveUrl(manifestPayload, "source_pdf");
  if (viaUrl) return viaUrl;
  return findReadyManifestArtifact(manifestPayload, "source_pdf");
}

export function resolveReaderTranslatedPdfUrl(
  jobPayload: any,
  manifestPayload: any,
  {
    resolveJobActions = defaultResolveJobActions,
    findReadyManifestArtifact = defaultFindReadyManifestArtifact,
    resolveReaderArtifactUrl = defaultResolveReaderArtifactUrl,
    resolveResourceUrl = defaultResolveResourceUrl,
  }: {
    resolveJobActions?: typeof defaultResolveJobActions;
    findReadyManifestArtifact?: typeof defaultFindReadyManifestArtifact;
    resolveReaderArtifactUrl?: typeof defaultResolveReaderArtifactUrl;
    resolveResourceUrl?: (v: unknown) => string;
  } = {},
): string {
  const actions = jobPayload ? resolveJobActions(jobPayload) : null;
  if ((actions as any)?.pdfEnabled && (actions as any)?.pdf) {
    return (actions as any).pdf;
  }
  const manifestCandidates = ["pdf", "translated_pdf", "result_pdf"];
  for (const artifactKey of manifestCandidates) {
    const item = findReadyManifestArtifact(manifestPayload, artifactKey);
    const url = (resolveReaderArtifactUrl as any)(item, { resolveResourceUrl });
    // 兼容旧签名：resolveReaderArtifactUrl(item) 单参时内部已用默认 resolver
    const resolved = url || (resolveReaderArtifactUrl as any)(item);
    if (resolved) {
      return resolved;
    }
  }
  const workflow = `${jobPayload?.workflow || jobPayload?.job_type || ""}`.trim().toLowerCase();
  const canUseTranslatedPdfRoute = (actions as any)?.pdfEnabled
    || (`${jobPayload?.status || ""}`.trim().toLowerCase() === "succeeded" && workflow !== "ocr");
  if (canUseTranslatedPdfRoute && jobPayload?.job_id) {
    return resolveResourceUrl(`/api/v1/jobs/${encodeURIComponent(jobPayload.job_id)}/pdf`);
  }
  return "";
}
