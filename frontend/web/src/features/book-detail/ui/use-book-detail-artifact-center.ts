import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildJobDetailEndpoint,
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
import { isActiveJobStatus, jobOutputFilePath, resolveResourceUrl } from "@retainpdf/domain/job";
import type { BookDetailCaches } from "../domain/book-detail-caches.js";
import { buildMarkdownBundle } from "../domain/markdown-bundle.js";

/** 下一个产物：先把响应拿到手并确认成功，再问用户保存到哪（见 download 里的说明）。 */
async function saveArtifact(item: ArtifactCenterItem): Promise<void> {
  const response = await fetchProtected(item.url);
  if (!response.ok) throw new Error(`下载失败，请稍后重试。(${response.status})`);
  // 文件名以后端响应头为准（统一的「类型前缀_书名_后缀」），「另存为」对话框也预填它。
  const filename = fileNameFromDisposition(
    response.headers.get("content-disposition") || "",
    item.filename || item.label,
  );
  const target = await prepareDownloadTarget(filename);
  if (target.kind === "aborted") return;
  await saveResponseDownload(response, { target, filename, onProgress: undefined });
}

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
  // so OCR jobs always use the job file route for the raw Markdown
  // (/jobs/{id}/files/output/ocr.md; the JSON view is /jobs/{id}/reader/markdown).
  const baseJobUrl = buildJobDetailEndpoint(jobId, API_PREFIX);
  const translatedPdfUrl = resolveResourceUrl(jobOutputFilePath(jobId, "translated.pdf"));
  const ocrMarkdownUrl = resolveResourceUrl(jobOutputFilePath(jobId, "ocr.md"));
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
    markdown_url: links?.markdown_url || `${baseJobUrl}/reader/markdown`,
    pdf_url: links?.pdf_url || (isTranslation ? translatedPdfUrl : ""),
    markdown: {
      ...(links?.markdown || {}),
      ready: markdownReady,
      raw_url: workflow === "ocr" ? ocrMarkdownUrl : links?.markdown?.raw_url || ocrMarkdownUrl,
    },
    pdf: isTranslation ? {
      ...(links?.pdf || {}),
      ready: pdfReady,
      url: links?.pdf?.url || translatedPdfUrl,
    } : links?.pdf,
  };
}

export function useBookDetailArtifactCenter({
  active,
  ready = true,
  cache,
  documentId,
  refreshRevision = 0,
  title = "",
  source,
  jobs,
}: {
  active: boolean;
  /** 这本书的任务列表已经从后端读回来；没读回来前任务只有卡片上的简略信息，先不拉，免得拉两遍。 */
  ready?: boolean;
  /** 已结束任务的产物清单按「任务 id:流程:状态:更新时间」记下（BookDetailDialog 传入，跨关闭/打开）：
   * 再打开同一本书直接用，不再每次拉两个接口。状态或更新时间一变，键就变了，自然重拉。 */
  cache?: BookDetailCaches["manifests"];
  documentId: string;
  refreshRevision?: number;
  /** 书名：文件页列表据此写出下载文件名。 */
  title?: string;
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
  const ownCache = useRef<BookDetailCaches["manifests"]>(new Map());
  const manifestCache = cache ?? ownCache.current;

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
    // 任务刚完成时产物可能还没登记全，记下的那份不能再用。
    for (const token of loadedTokensRef.current) manifestCache.delete(token);
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
      && !isActiveJobStatus(status)
    )), [jobs]);
  const manifestJobsKey = manifestJobs.map(({ token }) => token).join("\u0000");

  useEffect(() => {
    if (!active || !documentId || !ready) return undefined;
    const pending = manifestJobs.filter(({ token }) => !loadedTokensRef.current.has(token));
    const cachedHits = pending.filter(({ token }) => manifestCache.has(token));
    if (cachedHits.length) {
      cachedHits.forEach(({ token }) => loadedTokensRef.current.add(token));
      setManifests((current) => ({
        ...current,
        ...Object.fromEntries(cachedHits.map(({ jobId, token }) => [jobId, manifestCache.get(token)!])),
      }));
    }
    const missing = pending.filter(({ token }) => !manifestCache.has(token));
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
          // /files 列出的文件（含对照 PDF、Word、打包）和就绪状态就是准的，直接用；
          // 只有它一个都没列（老任务、接口 404）时，才按任务状态补出译文 PDF、Markdown 这几个固定地址。
          const manifest = await fetchJobArtifactsManifest(jobId);
          const listed = Array.isArray(manifest?.items) && manifest.items.length > 0;
          const links = listed ? null : readerCompatibleArtifactLinks(job, null);
          if (cancelled || generation !== generationRef.current) return;
          const merged = mergeArtifactLinksIntoManifest(job, manifest, links);
          manifestCache.set(token, merged);
          setManifests((current) => ({ ...current, [jobId]: merged }));
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
  }, [active, ready, documentId, manifestJobsKey, refreshRevision]);

  const sections = useMemo(() => buildArtifactCenterSections({
    documentId,
    title,
    source,
    jobs,
    manifests,
  }), [documentId, title, jobs, manifests, source]);

  const download = useCallback(async (item: ArtifactCenterItem) => {
    if (!item.url || downloadingId) return;
    setDownloadingId(item.id);
    setError("");
    try {
      // 先把响应拿到手并确认成功，**再**问用户保存到哪。
      //
      // 反过来的话，`showSaveFilePicker` 会在用户点确定的那一刻就创建出文件（0 字节），
      // 随后请求失败抛异常，磁盘上留下一个空文件。用户看到的不是错误，而是一份
      // "打开什么都没有的文档"——Word 导出在打包环境里失败时就是这么表现的。
      await saveArtifact(item);
    } catch (cause) {
      setError(`${(cause as Error)?.message || "下载失败，请稍后重试。"}`);
    } finally {
      setDownloadingId("");
    }
  }, [downloadingId]);

  /** 「常用下载」的 Markdown：浏览器里打 zip（原文、译文、双语三份 md + images/，见 markdown-bundle.ts）；
   * 老任务拼不出块时退回原来的产物（ocr.zip，只有原文）。同样先打好包、再问保存到哪。 */
  const downloadMarkdownBundle = useCallback(async (item: ArtifactCenterItem, readingJobId = item.jobId) => {
    if (downloadingId) return;
    setDownloadingId(item.id);
    setError("");
    try {
      const bundle = readingJobId ? await buildMarkdownBundle({ jobId: readingJobId, title }) : null;
      if (!bundle) {
        if (item.url) await saveArtifact(item);
        return;
      }
      const target = await prepareDownloadTarget(bundle.filename);
      if (target.kind === "aborted") return;
      await saveResponseDownload(new Response(bundle.blob), { target, filename: bundle.filename, onProgress: undefined });
    } catch (cause) {
      setError(`${(cause as Error)?.message || "下载失败，请稍后重试。"}`);
    } finally {
      setDownloadingId("");
    }
  }, [downloadingId, title]);

  return {
    sections,
    loading: loadingJobIds.length > 0,
    error,
    downloadingId,
    download,
    downloadMarkdownBundle,
  };
}
