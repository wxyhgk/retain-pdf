// 读这个任务的精修事件（通用取数接口的 pipeline_events），交给 editorialFlowModel 还原编辑部走到了哪一步。
// - poll（翻译任务在跑、进入渲染阶段，精修就在这里跑）：每 3 秒刷新；
// - 否则只读一次：任务跑完 / 停下后照样画出最后一次精修的最终状态，不能一结束就消失。
// 读失败保留上一次的结果，不打断界面。
import { useEffect, useRef, useState } from "react";

import { fetchJobData } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { editorialFlowModel, type EditorialFlow } from "../domain/editorial-flow-model.js";

export const EDITORIAL_FLOW_POLL_MS = 3_000;
// 通用取数接口单页上限 1000；一次编辑部精修一两百条事件，够用。
const REFINE_EVENT_LIMIT = 1000;

type FetchEvents = (jobId: string) => Promise<{ items?: unknown[] } | null | undefined>;
import type { BookDetailCaches } from "../domain/book-detail-caches.js";

type Row = Record<string, unknown>;

/** pipeline_events 的一行（payload 里的精修字段已摊平）→ 流程图模型认的事件形状。 */
export function refineEventFromDataRow(row: Row) {
  const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Row;
  const pick = (key: string) => (row[key] !== undefined && row[key] !== null ? row[key] : payload[key]);
  return {
    substage: row.substage,
    stage_detail: row.stage_detail || row.message,
    payload: {
      observation: {
        refine_phase: pick("refine_phase"),
        refine_mode: pick("refine_mode"),
        refine_round: pick("refine_round"),
        refine_max_rounds: pick("refine_max_rounds"),
        batch_done: pick("batch_done"),
        batch_total: pick("batch_total"),
        round: pick("round"),
      },
    },
  };
}

// 只取精修的事件（data/pipeline_events?substage=refining&sort=seq），不再拉事件流尾部 500 条（约 540 KB）。
const defaultFetchEvents: FetchEvents = async (jobId) => {
  const view = await fetchJobData(jobId, API_PREFIX, "pipeline_events", {
    filters: { substage: "refining" },
    sort: "seq",
    limit: REFINE_EVENT_LIMIT,
  });
  const rows: Row[] = Array.isArray(view.rows) ? (view.rows as Row[]) : [];
  return { items: rows.map((row) => refineEventFromDataRow(row)) };
};

export function useEditorialFlow(
  jobId: string,
  {
    enabled = true,
    poll = false,
    jobActive = false,
    cache,
    fetchEvents = defaultFetchEvents,
    intervalMs = EDITORIAL_FLOW_POLL_MS,
  }: {
    enabled?: boolean;
    poll?: boolean;
    jobActive?: boolean;
    /** 不在跑的任务，最后一次精修不会再变：读一次记下来（BookDetailDialog 传入，跨关闭/打开），
     * 再打开详情不用再拉一遍（尾部 500 条事件约 500 KB）。 */
    cache?: BookDetailCaches["settledFlows"];
    fetchEvents?: FetchEvents;
    intervalMs?: number;
  } = {},
): EditorialFlow | null {
  const ownCache = useRef<BookDetailCaches["settledFlows"]>(new Map());
  const settledFlows = cache ?? ownCache.current;
  const [flow, setFlow] = useState<EditorialFlow | null>(() => (!jobActive && settledFlows.get(jobId)) || null);
  useEffect(() => {
    if (!enabled || !jobId) {
      setFlow(null);
      return undefined;
    }
    if (!poll && !jobActive && settledFlows.has(jobId)) {
      setFlow(settledFlows.get(jobId) ?? null);
      return undefined;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const page = await fetchEvents(jobId);
        const next = editorialFlowModel(page?.items, { jobActive });
        if (!poll && !jobActive) settledFlows.set(jobId, next);
        if (!disposed) setFlow(next);
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
