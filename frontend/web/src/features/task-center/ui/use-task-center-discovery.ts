// 任务中心的「发现新任务」。
//
// 面板的 3s 周期只调 refreshLive，而 refreshLive 只对**已经在列表里**的 job 逐个
// 拉详情；真正拉列表的 load 只在挂载 / 手动刷新 / 加载更多时跑。于是任务中心开着
// 的时候，在图书馆或上传弹窗里新建的任务永远不会出现，直到用户点一次刷新。
//
// 这个 hook 只做「发现」：拉第 0 页，把手上没有的前插进去。合并规则是纯函数
// discoverNewTaskCenterJobs，它的两条不变式有测试钉住（前插、游标后移）。
//
// 刻意不走 load()：那会让 generationRef 自增（作废在途的 refreshLive）、亮
// refreshing 转圈、并把 offset 重置回 0，丢掉用户已经翻过的页。

import { isPageHidden } from "@/platform/utils/page-visibility.js";
import { useCallback, useEffect, useRef } from "react";
import type { JobListItemView } from "@retainpdf/contracts/job-status";
import {
  discoverNewTaskCenterJobs,
  loadTaskCenterJobs,
} from "../domain/task-center-api.js";

export type TaskCenterDiscoveryPorts = {
  /** 当前列表（ref，读最新值，不进 deps） */
  itemsRef: { current: JobListItemView[] };
  /** 「加载更多」的下一个 offset；发现到 N 条新任务后要后移 N */
  nextOffsetRef: { current: number };
  /** 列表世代号；load() 自增它，用来作废在途请求 */
  generationRef: { current: number };
  /** load() 是否在途——它会重置列表，发现要让路 */
  listInFlightRef: { current: boolean };
  mountedRef: { current: boolean };
  setItems: (items: JobListItemView[]) => void;
  /** 有活跃任务时才逐个拉详情（终态的不必再拉） */
  hasActiveTasks: boolean;
  refreshLive: () => void | Promise<void>;
};

/** 面板只在打开时挂载，所以这个周期的存续等于「用户正在看任务中心」。 */
export const TASK_CENTER_AUTO_REFRESH_MS = 3000;

export function useTaskCenterAutoRefresh({
  itemsRef,
  nextOffsetRef,
  generationRef,
  listInFlightRef,
  mountedRef,
  setItems,
  hasActiveTasks,
  refreshLive,
}: TaskCenterDiscoveryPorts) {
  const inFlightRef = useRef(false);

  const discoverNewJobs = useCallback(async () => {
    if (listInFlightRef.current || inFlightRef.current) return;
    const generation = generationRef.current;
    inFlightRef.current = true;
    try {
      const page = await loadTaskCenterJobs(undefined, { offset: 0 });
      if (!mountedRef.current || generation !== generationRef.current) return;
      const { fresh, addedCount } = discoverNewTaskCenterJobs(itemsRef.current, page.items);
      if (!addedCount) return;
      const next = [...fresh, ...itemsRef.current];
      itemsRef.current = next;
      // 服务端列表整体右移了这么多，游标不动的话「加载更多」会重复取到已有的几条。
      nextOffsetRef.current += addedCount;
      setItems(next);
    } catch {
      // 静默：发现不到新任务不该打断已有列表，也不该弹错误条。
    } finally {
      inFlightRef.current = false;
    }
    // ref 与 setItems 引用稳定，刻意不进 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isPageHidden()) return;
      void discoverNewJobs();
      if (hasActiveTasks) void refreshLive();
    }, TASK_CENTER_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasActiveTasks, refreshLive, discoverNewJobs]);
}
