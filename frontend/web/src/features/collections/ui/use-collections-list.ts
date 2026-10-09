// 合集列表加载：请求序号防竞态 + 版本信号触发软/硬刷新 + 失败静默自动重试一次。
import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionsController } from "./types.js";
import type { CollectionRecord } from "../domain/controller.js";

type UseCollectionsListArgs = {
  controller: CollectionsController;
  version: number;
  setOpenFolder: (updater: (current: CollectionRecord | null) => CollectionRecord | null) => void;
};

export function useCollectionsList({ controller, version, setOpenFolder }: UseCollectionsListArgs) {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const listRequestSeqRef = useRef(0);
  const listLoadedRef = useRef(false);

  // 桌面端启动早期 rust_api 未就绪(日志里见过 90s 端口等待超时)、或后端
  // 被大任务短暂拖住时,一次失败不该直接把用户拍在错误态——列表与文件夹
  // 内容各自动重试一次(1.5s),仍失败才亮错误 + 手动重试入口。
  const listAutoRetriedRef = useRef(false);
  const reloadRef = useRef<(() => Promise<void> | void) | null>(null);

  const reload = useCallback((options: { soft?: boolean } = {}) => {
    // soft：version bump / 二次拉取时保留旧列表，不整表切成 loading（分类 tab 闪一下）
    // 首次挂载不能由全局 version 判断：该 store 会跨 tab 挂载保留版本号，
    // version > 0 并不表示当前 CollectionsView 已经完成过首屏请求。
    const soft = Boolean(options.soft) && listLoadedRef.current;
    const requestSeq = ++listRequestSeqRef.current;
    if (!soft) {
      setListLoading(true);
    }
    setListError("");
    return controller
      .listCollections()
      .then(({ collections: items = [] }: { collections?: CollectionRecord[] } = {}) => {
        if (requestSeq !== listRequestSeqRef.current) return;
        listAutoRetriedRef.current = false;
        listLoadedRef.current = true;
        setCollections(items);
        // 正在查看的文件夹如果被删了(管理弹窗里点了删除),退回文件夹网格。
        setOpenFolder((current) => {
          if (!current) {
            return current;
          }
          return items.find((item) => item.collection_id === current.collection_id) ?? null;
        });
        setListLoading(false);
      })
      .catch((err) => {
        if (requestSeq !== listRequestSeqRef.current) return;
        if (!listAutoRetriedRef.current) {
          // 瞬时故障:静默自动重试一次,保持 loading 不闪错误
          listAutoRetriedRef.current = true;
          window.setTimeout(() => {
            void reloadRef.current?.();
          }, 1500);
          return;
        }
        listLoadedRef.current = true;
        setListError(err?.message || "读取合集失败，请稍后重试。");
        setListLoading(false);
      });
  }, [controller, setOpenFolder]);
  reloadRef.current = reload;

  useEffect(() => {
    // 首屏 hard loading；管理弹窗 bump version 后 soft 刷新
    reload({ soft: listLoadedRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, version]);

  // 手动重试前重置自动重试标志,允许新的一轮"自动一次 + 手动兑底"。
  const resetAutoRetry = useCallback(() => {
    listAutoRetriedRef.current = false;
  }, []);

  return { collections, listLoading, listError, reload, resetAutoRetry };
}
