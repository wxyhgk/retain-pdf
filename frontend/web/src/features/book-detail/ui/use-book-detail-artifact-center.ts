import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildJobDetailEndpoint,
  fetchJobArtifacts,
  fetchJobArtifactsManifest,
  fetchProtected,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
} from "@/platform/utils/downloads.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import {
  buildArtifactCenterSections,
  mergeArtifactLinksIntoManifest,
  type ArtifactCenterItem,
  type ArtifactLinks,
  type ArtifactManifest,
} from "../domain/artifact-center-model.js";

export function readerCompatibleArtifactLinks(
  job: DocumentJobSummary,
  links: ArtifactLinks | null,
): ArtifactLinks | null {
  const jobId = `${job.job_id || ""}`.trim();
  const workflow = `${job.workflow || job.job_type || ""}`.trim().toLowerCase();
  const succeeded = `${job.status || ""}`.trim().toLowerCase() === "succeeded";
  if (!jobId || !succeeded) return links;

  // Download routes are published under /jobs for every workflow. The OCR
  // artifact descriptor in older backends can advertise /ocr/jobs/.../markdown,
  // while the working raw Markdown endpoint remains /jobs/.../markdown.
  const baseJobUrl = buildJobDetailEndpoint(jobId, API_PREFIX);
  // Reader treats a succeeded render retry as a valid translated-PDF source.
  const isTranslation = ["book", "translate", "translation", "render"].includes(workflow);
  const hasMarkdownReadiness = links != null
    && (links.markdown?.ready != null || links.markdown_ready != null);
  const hasPdfReadiness = links != null
    && (links.pdf?.ready != null || links.pdf_ready != null);
  const markdownReady = hasMarkdownReadiness
    ? Boolean(links?.markdown?.ready ?? links?.markdown_ready)
    : succeeded;
  const pdfReady = hasPdfReadiness
    ? Boolean(links?.pdf?.ready ?? links?.pdf_ready)
    : isTranslation;

  return {
    ...(links || {}),
    markdown_ready: markdownReady,
    pdf_ready: pdfReady,
    markdown_url: links?.markdown_url || `${baseJobUrl}/markdown`,
    pdf_url: links?.pdf_url || (isTranslation ? `${baseJobUrl}/pdf` : ""),
    markdown: {
      ...(links?.markdown || {}),
      ready: markdownReady,
      raw_url: workflow === "ocr"
        ? `${baseJobUrl}/markdown?raw=true`
        : links?.markdown?.raw_url || `${baseJobUrl}/markdown?raw=true`,
    },
    pdf: isTranslation ? {
      ...(links?.pdf || {}),
      ready: pdfReady,
      url: links?.pdf?.url || `${baseJobUrl}/pdf`,
    } : links?.pdf,
  };
}

export function useBookDetailArtifactCenter({
  active,
  documentId,
  refreshRevision = 0,
  source,
  jobs,
}: {
  active: boolean;
  documentId: string;
  refreshRevision?: number;
  source: {
    filename?: string;
    url?: string;
    sizeBytes?: number | null;
    generatedAt?: string;
  };
  jobs: DocumentJobSummary[];
}) {
  const [manifests, setManifests] = useState<Record<string, ArtifactManifest>>({});
  const [loadingJobIds, setLoadingJobIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const generationRef = useRef(0);
  const loadedTokensRef = useRef(new Set<string>());

  useEffect(() => {
    generationRef.current += 1;
    setManifests({});
    setLoadingJobIds([]);
    setError("");
    loadedTokensRef.current.clear();
  }, [documentId]);

  // succeeded 可能先由 runtime 到达，再由 document-scoped 列表补齐产物。
  // 完成修订只清除加载令牌、不清空现有 UI，让当前产物入口原位重拉。
  useEffect(() => {
    if (!active || !documentId || !refreshRevision) return;
    generationRef.current += 1;
    loadedTokensRef.current.clear();
    setError("");
  }, [active, documentId, refreshRevision]);

  const manifestJobs = useMemo(() => jobs
    .map((job) => ({
      job,
      jobId: `${job.job_id || ""}`.trim(),
      workflow: `${job.workflow || job.job_type || ""}`.trim().toLowerCase(),
      status: `${job.status || ""}`.trim().toLowerCase(),
      // The card's first paint may only know id/status. Re-fetch once the
      // document-scoped API supplies workflow, otherwise a translate job can
      // be permanently cached as an unknown job with no PDF projection.
      token: `${job.job_id || ""}:${job.workflow || job.job_type || ""}:${job.status || ""}:${job.updated_at || job.created_at || ""}`,
    }))
    .filter(({ jobId, status }) => (
      jobId
      && !jobId.startsWith("doc:")
      && !["queued", "pending", "running", "validating"].includes(status)
    )), [jobs]);
  const manifestJobsKey = manifestJobs.map(({ token }) => token).join("\u0000");

  useEffect(() => {
    if (!active || !documentId) return undefined;
    const missing = manifestJobs.filter(({ token }) => !loadedTokensRef.current.has(token));
    if (!missing.length) return undefined;
    const generation = ++generationRef.current;
    let cancelled = false;
    const finishedTokens = new Set<string>();
    missing.forEach(({ token }) => loadedTokensRef.current.add(token));
    setLoadingJobIds((current) => Array.from(new Set([
      ...current,
      ...missing.map(({ jobId }) => jobId),
    ])));
    void (async () => {
      for (const { job, jobId, token } of missing) {
        try {
          const [manifestResult, linksResult] = await Promise.allSettled([
            fetchJobArtifactsManifest(jobId),
            fetchJobArtifacts(jobId),
          ]);
          if (manifestResult.status === "rejected" && linksResult.status === "rejected") {
            throw linksResult.reason || manifestResult.reason;
          }
          const manifest = manifestResult.status === "fulfilled"
            ? manifestResult.value
            : { items: [] };
          const links = readerCompatibleArtifactLinks(
            job,
            linksResult.status === "fulfilled" ? linksResult.value : null,
          );
          if (cancelled || generation !== generationRef.current) return;
          setManifests((current) => ({
            ...current,
            [jobId]: mergeArtifactLinksIntoManifest(job, manifest, links),
          }));
          finishedTokens.add(token);
        } catch (cause) {
          if (cancelled || generation !== generationRef.current) return;
          setError(`${(cause as Error)?.message || "读取任务产物失败"}`);
          setManifests((current) => ({ ...current, [jobId]: { items: [] } }));
          finishedTokens.add(token);
        } finally {
          if (!cancelled && generation === generationRef.current) {
            setLoadingJobIds((current) => current.filter((id) => id !== jobId));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      const unfinished = missing.filter(({ token }) => !finishedTokens.has(token));
      unfinished.forEach(({ token }) => loadedTokensRef.current.delete(token));
      if (unfinished.length) {
        const unfinishedIds = new Set(unfinished.map(({ jobId }) => jobId));
        setLoadingJobIds((current) => current.filter((id) => !unfinishedIds.has(id)));
      }
    };
  }, [active, documentId, manifestJobsKey, refreshRevision]);

  const sections = useMemo(() => buildArtifactCenterSections({
    documentId,
    source,
    jobs,
    manifests,
  }), [documentId, jobs, manifests, source]);

  const download = useCallback(async (item: ArtifactCenterItem) => {
    if (!item.url || downloadingId) return;
    setDownloadingId(item.id);
    setError("");
    try {
      const target = await prepareDownloadTarget(item.filename || item.label);
      if (target.kind === "aborted") return;
      const response = await fetchProtected(item.url);
      if (!response.ok) throw new Error(`下载失败，请稍后重试。(${response.status})`);
      const filename = fileNameFromDisposition(
        response.headers.get("content-disposition") || "",
        item.filename || item.label,
      );
      await saveResponseDownload(response, { target, filename, onProgress: undefined });
    } catch (cause) {
      setError(`${(cause as Error)?.message || "下载失败，请稍后重试。"}`);
    } finally {
      setDownloadingId("");
    }
  }, [downloadingId]);

  return {
    sections,
    loading: loadingJobIds.length > 0,
    error,
    downloadingId,
    download,
  };
}
