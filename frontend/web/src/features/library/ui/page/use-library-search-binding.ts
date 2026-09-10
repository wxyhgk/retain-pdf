// 书架搜索绑定 hook —— 从同目录 RecentJobsLibrary.tsx 抽出。
//
// 曾经历过一次「放到 app/home/features/shared/ 当共享叶子」的中转（为了让
// app-shell 的 AppBottomBar 不直连 library 的内部文件）。B4 撤销了那个中转：
// 数据源本来就是 services.library.viewPort，hook 属于 library 功能，
// 跨功能消费方改走 @/features/library/index.js 这个唯一出口即可。
//
// RecentJobsLibrary 仍原样再导出本 hook 保持向后兼容；运行时来源不变。

import { useHomeServices } from "@/app/home/home-services-context.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";

export function useLibrarySearchBinding() {
  const services = useHomeServices();
  const { viewPort } = services.library;
  const view = useStoreSnapshot(viewPort.store);

  function onSearchChange(event: { target: { value: string } }) {
    const value = event.target.value;
    viewPort.store.actions.setQuery(value);
    viewPort.handlersRef.current.onSearch?.(value);
  }

  return { query: view.query as string, onSearchChange };
}
