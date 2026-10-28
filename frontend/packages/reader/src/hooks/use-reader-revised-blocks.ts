// 这本书哪些块被改过（精修、手改、助手改）：通用取数接口 data/revisions 按阅读页块编号分组。
// 译文栏给这些块画个小标记，悬停时写「改过 N 次」。读失败（旧任务没有修订记录、接口不在）就当没有，
// 阅读照常。
import { useEffect, useState } from "react";
import { readerSessionDataPort } from "../external.js";

export type RevisedBlocks = ReadonlyMap<string, number>;

export function parseRevisedBlocks(payload: unknown): RevisedBlocks {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const map = new Map<string, number>();
  for (const group of groups) {
    const g = (group || {}) as Record<string, unknown>;
    const id = `${g.value ?? ""}`.trim();
    const count = Number(g.count) || 0;
    if (id && count > 0) map.set(id, count);
  }
  return map;
}

export function useReaderRevisedBlocks(jobId: string, enabled = true): RevisedBlocks {
  const [blocks, setBlocks] = useState<RevisedBlocks>(() => new Map());
  useEffect(() => {
    setBlocks((current) => (current.size ? new Map() : current));
    const id = `${jobId || ""}`.trim();
    if (!enabled || !id) return undefined;
    const fetchGroups = readerSessionDataPort().fetchRevisionGroups;
    if (!fetchGroups) return undefined;
    let disposed = false;
    fetchGroups(id)
      .then((payload) => {
        if (!disposed && payload) setBlocks(parseRevisedBlocks(payload));
      })
      .catch(() => {});
    return () => { disposed = true; };
  }, [jobId, enabled]);
  return blocks;
}
