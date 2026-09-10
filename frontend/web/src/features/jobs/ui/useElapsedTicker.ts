// 秒表 hook(蓝图 §2 features/status/,§3.5)。
//
// 独立于 statusCardStore 驱动(store 里故意不放 elapsed——见
// status-card-store.js 顶部注释)。1s tick,终态(succeeded/failed/canceled)
// 即停,直接复用 @retainpdf/domain/job 的纯函数。

import { useEffect, useState } from "react";
import {
  buildElapsedViewModel,
  isTerminalStatus,
} from "@retainpdf/domain/job";

export function useElapsedTicker(job, { finishedAtFallback = "" } = {}) {
  const [tick, setTick] = useState(0);

  const status = `${job?.status || ""}`.trim();
  const terminal = isTerminalStatus(status);

  useEffect(() => {
    if (terminal || !job) {
      return undefined;
    }
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [terminal, job?.job_id, status]);

  void tick; // 仅用于每秒触发重渲,值本身不参与计算
  return buildElapsedViewModel(job, { finishedAtFallback });
}
