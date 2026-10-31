// 读一次用量；key 变了（换了一本书、任务跑完）重新读。读失败给一句中文，旁边有「重试」。
// enabled 为 false 时先不读（书籍详情只在「进度」页可见时才读）。
import { useCallback, useEffect, useState } from "react";

import { fetchDocumentUsage } from "@/platform/api/index.js";
import type { UsageSummaryView } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

export type UsageState = {
  data: UsageSummaryView | null;
  loading: boolean;
  error: string;
  reload: () => void;
};

export function useUsage(key: string, load: () => Promise<UsageSummaryView>, enabled = true): UsageState {
  const [data, setData] = useState<UsageSummaryView | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return undefined;
    let disposed = false;
    setLoading(true);
    setError("");
    load()
      .then((view) => { if (!disposed) setData(view); })
      .catch((err: unknown) => {
        if (!disposed) setError((err as { message?: string } | null)?.message || "读取用量失败，请稍后重试。");
      })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
    // load 每次渲染都是新函数；只按 key、开关和手动重试重新读。
  }, [key, attempt, enabled]);
  return { data, loading, error, reload };
}

/** 一本书的用量（书籍详情「进度」页）：可见时才读；refreshKey 变了（任务跑完、换了任务）重新读。 */
export function useDocumentUsage(
  documentId: string,
  { enabled = true, refreshKey = "" }: { enabled?: boolean; refreshKey?: string } = {},
): UsageState {
  return useUsage(`${documentId}\u0000${refreshKey}`, () => fetchDocumentUsage(documentId, API_PREFIX), Boolean(documentId) && enabled);
}
