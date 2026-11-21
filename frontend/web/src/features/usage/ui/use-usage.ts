// 读一次用量；key 变了（换了一本书、任务跑完）重新读。读失败给一句中文，旁边有「重试」。
// enabled 为 false 时先不读（书籍详情只在「进度」页可见时才读）。
//
// keepLast（设置「总用量」用）：后端每次都要把全部任务目录读一遍、解析几十 MB 的报告，本机开发栈要等 6–17 秒
// （2026-11-21 用户：「总用量」非常卡）。所以记住上一次读到的：再打开先显示它，后台照样重读，读好了换上；
// 同一份正在读时不再发第二个请求（关了又开不会把后端压上几个十几秒的请求）。只记在这一页的内存里，不落盘。
import { useCallback, useEffect, useState } from "react";

import { fetchDocumentUsage, fetchJobUsage } from "@/platform/api/index.js";
import type { UsageSummaryView } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

export type UsageState = {
  data: UsageSummaryView | null;
  loading: boolean;
  error: string;
  reload: () => void;
};

// 唯一的模块级状态（global-singletons 白名单登记）：每份（keepLast）记上一次读到的和正在读的请求。
const remembered = new Map<string, { view?: UsageSummaryView; pending?: Promise<UsageSummaryView> }>();

/** 同一份（keepLast）正在读就跟着那一个请求；读完记下来。 */
function loadShared(keepLast: string, load: () => Promise<UsageSummaryView>): Promise<UsageSummaryView> {
  const entry = remembered.get(keepLast) || {};
  if (entry.pending) return entry.pending;
  const request = load()
    .then((view) => {
      entry.view = view;
      return view;
    })
    .finally(() => {
      entry.pending = undefined;
    });
  entry.pending = request;
  remembered.set(keepLast, entry);
  return request;
}

/** 测试用：清掉记住的用量。 */
export function resetRememberedUsage() {
  remembered.clear();
}

export function useUsage(
  key: string,
  load: () => Promise<UsageSummaryView>,
  enabled = true,
  { keepLast = "" }: { keepLast?: string } = {},
): UsageState {
  const [data, setData] = useState<UsageSummaryView | null>(() => (keepLast ? remembered.get(keepLast)?.view ?? null : null));
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return undefined;
    let disposed = false;
    setLoading(true);
    setError("");
    (keepLast ? loadShared(keepLast, load) : load())
      .then((view) => { if (!disposed) setData(view); })
      .catch((err: unknown) => {
        if (!disposed) setError((err as { message?: string } | null)?.message || "读取用量失败，请稍后重试。");
      })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
    // load 每次渲染都是新函数；只按 key、开关和手动重试重新读。
  }, [key, attempt, enabled, keepLast]);
  return { data, loading, error, reload };
}

/** 一本书的用量（书籍详情「进度」页）：可见时才读；refreshKey 变了（任务跑完、换了任务）重新读。 */
export function useDocumentUsage(
  documentId: string,
  { enabled = true, refreshKey = "" }: { enabled?: boolean; refreshKey?: string } = {},
): UsageState {
  return useUsage(`${documentId}\u0000${refreshKey}`, () => fetchDocumentUsage(documentId, API_PREFIX), Boolean(documentId) && enabled);
}

/** 单个任务的用量（书籍详情「进度」页：这一次花了多少）：可见时才读；refreshKey 变了（任务跑完）重新读。 */
export function useJobUsage(
  jobId: string,
  { enabled = true, refreshKey = "" }: { enabled?: boolean; refreshKey?: string } = {},
): UsageState {
  return useUsage(`job\u0000${jobId}\u0000${refreshKey}`, () => fetchJobUsage(jobId, API_PREFIX), Boolean(jobId) && enabled);
}
