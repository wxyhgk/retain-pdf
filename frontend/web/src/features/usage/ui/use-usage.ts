// 读一次用量；key 变了（换了一本书）重新读。读失败给一句中文，旁边有「重试」。
import { useCallback, useEffect, useState } from "react";

import type { UsageSummaryView } from "@/platform/api/index.js";

export type UsageState = {
  data: UsageSummaryView | null;
  loading: boolean;
  error: string;
  reload: () => void;
};

export function useUsage(key: string, load: () => Promise<UsageSummaryView>): UsageState {
  const [data, setData] = useState<UsageSummaryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
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
    // load 每次渲染都是新函数；只按 key 和手动重试重新读。
  }, [key, attempt]);
  return { data, loading, error, reload };
}
