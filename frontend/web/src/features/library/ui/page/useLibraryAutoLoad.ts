// 图书馆网格滚动自动加载(蓝图 §2 features/library/)。
//
// 几何判定重写自 host-actions.js 的 shouldAutoLoadRecentJobs(260px / 0.35
// 阈值,不 import——旧文件属"死(cutover 删)"清单,按蓝图口径原地重写这
// ~10 行而不是复用)。触发口有两个,都汇到同一个 check():
// 1. 滚动容器的 passive scroll 监听(用户手动划到底);
// 2. refresh-scheduler.js 在每次分页提交后调用的 scheduleAutoLoadIfNeeded →
//    viewPort.scheduleAutoLoadCheck({isSuspended})——通过
//    react-view-port.js 的 registerAutoLoadChecker 接进来(内容变化后如果
//    还没填满一屏,需要接着自动加载下一页)。
//
// loadMore 调用统一走 viewPort.handlersRef.current.onLoadMore(bindings.js
// 绑定的是 () => runtime.loadRecentJobs({reset:false})),不直接调
// runtime——保持与"更多"按钮同一条口径,避免出现两条平行的加载入口。

import { useCallback, useEffect } from "react";

const THRESHOLD_PX = 260;
const THRESHOLD_RATIO = 0.35;

export function useLibraryAutoLoad({ scrollBodyRef, hasMore, loadMoreLoading, viewPort }: any) {
  const check = useCallback(({ isSuspended }: any = {}) => {
    if (isSuspended?.() ?? viewPort.handlersRef.current.isSuspended?.()) {
      return;
    }
    if (!hasMore || loadMoreLoading) {
      return;
    }
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return;
    }
    const remaining = scrollBody.scrollHeight - scrollBody.scrollTop - scrollBody.clientHeight;
    const threshold = Math.max(THRESHOLD_PX, scrollBody.clientHeight * THRESHOLD_RATIO);
    if (remaining < threshold) {
      viewPort.handlersRef.current.onLoadMore?.();
    }
  }, [hasMore, loadMoreLoading, scrollBodyRef, viewPort]);

  // 接入 refresh-scheduler.js → viewPort.scheduleAutoLoadCheck 的调用链
  useEffect(() => viewPort.registerAutoLoadChecker(check), [viewPort, check]);

  // 滚动容器自身的被动监听
  useEffect(() => {
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return undefined;
    }
    const onScroll = () => {
      if (viewPort.handlersRef.current.isSuspended?.()) {
        return;
      }
      requestAnimationFrame(() => check());
    };
    scrollBody.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollBody.removeEventListener("scroll", onScroll);
  }, [scrollBodyRef, viewPort, check]);
}
