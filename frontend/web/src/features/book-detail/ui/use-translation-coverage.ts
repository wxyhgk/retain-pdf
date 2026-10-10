import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDocumentTranslationCoverage, type TranslationCoverageView } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

type FetchCoverage = (documentId: string) => Promise<TranslationCoverageView>;

const fetchFromApi: FetchCoverage = (documentId) => fetchDocumentTranslationCoverage(API_PREFIX, documentId);
import type { BookDetailCaches } from "../domain/book-detail-caches.js";

/**
 * 这本书的翻译覆盖和任务记录。
 *
 * 等这本书的任务列表读回来（ready）再取；之后任务的状态一变（某次翻译完成、失败、新提交）就重取
 * —— 键是「每个任务的 id:状态」。以前打开详情时任务列表先是卡片上的一条、再变成完整列表，键变了
 * 一次，同一份覆盖要拉两遍。轮询本身由 useDocumentJobs 负责，这里不另起定时器。
 * 失败只是不显示这两块，不影响「进度」分区的其余部分。
 */
export function useTranslationCoverage({
  open,
  documentId,
  jobs,
  ready = true,
  cache,
  fetchCoverage = fetchFromApi,
}: {
  open: boolean;
  documentId: string;
  jobs: Array<{ job_id?: string; id?: string; status?: string }>;
  /** 任务列表已经从后端读回来。没读回来之前只显示缓存，不发请求。 */
  ready?: boolean;
  /** 按书记下最近一次的结果和当时的任务状态（BookDetailDialog 传入，跨关闭/打开）：再打开同一本书先
   * 显示它；任务状态没变就不再请求。不传就只在这个组件里记。 */
  cache?: BookDetailCaches["coverage"];
  fetchCoverage?: FetchCoverage;
}) {
  const ownCache = useRef<BookDetailCaches["coverage"]>(new Map());
  const coverageCache = cache ?? ownCache.current;
  // 连同书的 id 一起存：换到另一本书时，新数据回来之前不能显示上一本的覆盖。
  const [loaded, setLoaded] = useState<{ documentId: string; view: TranslationCoverageView } | null>(() => {
    const id = `${documentId || ""}`.trim();
    const cached = id ? coverageCache.get(id) : undefined;
    return cached ? { documentId: id, view: cached.view } : null;
  });
  const jobsKey = useMemo(
    () => jobs.map((job) => `${job.job_id || job.id || ""}:${job.status || ""}`).sort().join("|"),
    [jobs],
  );

  useEffect(() => {
    const id = `${documentId || ""}`.trim();
    if (!open || !id) {
      setLoaded(null);
      return undefined;
    }
    const cached = coverageCache.get(id);
    if (cached) setLoaded((current) => (current?.documentId === id ? current : { documentId: id, view: cached.view }));
    if (!ready || cached?.jobsKey === jobsKey) return undefined;
    let cancelled = false;
    fetchCoverage(id)
      .then((view) => {
        coverageCache.set(id, { jobsKey, view });
        if (!cancelled) setLoaded({ documentId: id, view });
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId, jobsKey, ready, fetchCoverage]);

  return loaded && loaded.documentId === `${documentId || ""}`.trim() ? loaded.view : null;
}
