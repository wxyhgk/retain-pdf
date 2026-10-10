// 精修进行中轮询任务事件流的尾部，交给 editorialFlowModel 还原编辑部走到了哪一步。
// 只在 enabled（翻译任务在渲染阶段）时拉；读失败保留上一次的结果，不打断界面。
import { useEffect, useState } from "react";

import { fetchJobEvents } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { editorialFlowModel, type EditorialFlow } from "../domain/editorial-flow-model.js";

export const EDITORIAL_FLOW_POLL_MS = 3_000;
// 事件接口单页上限 500。编辑部一次精修几十到一两百条事件，尾部 500 条够看到这次精修的开头。
const TAIL_LIMIT = 500;

type FetchEvents = (jobId: string) => Promise<{ items?: unknown[] } | null | undefined>;

const defaultFetchEvents: FetchEvents = (jobId) =>
  fetchJobEvents(jobId, API_PREFIX, { start: "tail", limit: TAIL_LIMIT });

export function useEditorialFlow(
  jobId: string,
  enabled: boolean,
  { fetchEvents = defaultFetchEvents, intervalMs = EDITORIAL_FLOW_POLL_MS }: {
    fetchEvents?: FetchEvents;
    intervalMs?: number;
  } = {},
): EditorialFlow | null {
  const [flow, setFlow] = useState<EditorialFlow | null>(null);
  useEffect(() => {
    setFlow(null);
    if (!enabled || !jobId) return undefined;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const page = await fetchEvents(jobId);
        if (!disposed) setFlow(editorialFlowModel(page?.items, { jobActive: true }));
      } catch {
        // 保留上一次的流程图；下一轮再试。
      }
      if (!disposed) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, enabled, fetchEvents, intervalMs]);
  return flow;
}
