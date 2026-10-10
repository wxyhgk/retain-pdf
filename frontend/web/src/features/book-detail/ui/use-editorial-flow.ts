// 拉任务事件流的尾部，交给 editorialFlowModel 还原编辑部走到了哪一步。
// - poll（翻译任务在跑、进入渲染阶段，精修就在这里跑）：每 3 秒刷新；
// - 否则只读一次：任务跑完 / 停下后照样画出最后一次精修的最终状态，不能一结束就消失。
// 读失败保留上一次的结果，不打断界面。
import { useEffect, useState } from "react";

import { fetchJobEvents } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { editorialFlowModel, type EditorialFlow } from "../domain/editorial-flow-model.js";

export const EDITORIAL_FLOW_POLL_MS = 3_000;
// 事件接口单页上限 500。一次编辑部精修一两百条事件，之后的排版事件几十到上百条（实测一本书 89 条），
// 尾部 500 条装得下最后一次精修。
const TAIL_LIMIT = 500;

type FetchEvents = (jobId: string) => Promise<{ items?: unknown[] } | null | undefined>;

const defaultFetchEvents: FetchEvents = (jobId) =>
  fetchJobEvents(jobId, API_PREFIX, { start: "tail", limit: TAIL_LIMIT });

export function useEditorialFlow(
  jobId: string,
  {
    enabled = true,
    poll = false,
    jobActive = false,
    fetchEvents = defaultFetchEvents,
    intervalMs = EDITORIAL_FLOW_POLL_MS,
  }: {
    enabled?: boolean;
    poll?: boolean;
    jobActive?: boolean;
    fetchEvents?: FetchEvents;
    intervalMs?: number;
  } = {},
): EditorialFlow | null {
  const [flow, setFlow] = useState<EditorialFlow | null>(null);
  useEffect(() => {
    if (!enabled || !jobId) {
      setFlow(null);
      return undefined;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const page = await fetchEvents(jobId);
        if (!disposed) setFlow(editorialFlowModel(page?.items, { jobActive }));
      } catch {
        // 保留上一次的流程图；轮询时下一轮再试。
      }
      if (!disposed && poll) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, enabled, poll, jobActive, fetchEvents, intervalMs]);
  return flow;
}
