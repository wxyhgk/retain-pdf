// 主页上的弹窗、浮层和没有界面的盯梢组件：按表挂（功能登记表第三步，
// docs/ops/planning/frontend-migration/20261112-功能登记表.md）。以前它们一个个写在 HomeApp.tsx 里，
// 每加一个弹窗都要改那个文件（它已经贴着 380 行上限）。
//
// 加一个：要主页服务的写一个 *Slot 把服务接到功能的 props 上（照下面几个写），不要的直接用功能导出的组件；
// 再在 HOME_OVERLAYS 里加一行。顺序就是挂载顺序：Radix 弹窗按挂载先后叠，后挂的在上面。

import { Suspense, lazy, useCallback, useEffect, useState, type ComponentType } from "react";
import { useHomeBookDetail, useHomeCollections, useHomeGlossaries } from "../home-services-context.js";
import { useLibraryServices } from "@/features/library/index.js";
import { GlossariesDialog } from "@/features/glossaries/index.js";
import { StatusDetailDialog } from "@/features/job-detail/index.js";
import { ReaderNavigation, SoftReaderHost } from "@/features/reader/index.js";
import { CollectionDialog } from "@/features/collections/index.js";
import { JobFinishNotifier, type FinishedJob } from "@/features/notify/index.js";
import { DownloadToastHost } from "@/ui/download-toast/DownloadToastHost.jsx";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { EXTRA_BOOK_DETAIL_TABS } from "./book-detail-tabs.js";

// 书籍详情只在点开一本书时才下载（走 index 的动态 import，不破坏「index 是唯一出口」）。
const BookDetailDialog = lazy(() => import("@/features/book-detail/index.js").then((m) => ({ default: m.BookDetailDialog })));

function GlossariesDialogSlot() {
  const glossaries = useHomeGlossaries();
  const dialogState = useDialogState(glossaries.dialogStore);
  return (
    <GlossariesDialog
      feature={glossaries.feature}
      view={glossaries.view}
      dialogStore={glossaries.dialogStore}
      open={Boolean(dialogState.open)}
    />
  );
}

function CollectionDialogSlot() {
  const collections = useHomeCollections();
  return (
    <CollectionDialog
      controller={collections.controller}
      dialogStore={collections.dialogStore}
      reloadSignal={collections.reloadSignal}
    />
  );
}

// 书籍详情第一次打开时才下载并挂载；之后一直挂着，关闭动画、再次打开都和以前一样。
function BookDetailDialogSlot() {
  const { dialogStore } = useHomeBookDetail();
  const dialogState = useDialogState(dialogStore);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (dialogState.open) setMounted(true);
  }, [dialogState.open]);
  if (!mounted && !dialogState.open) return null;
  return (
    <Suspense fallback={null}>
      <BookDetailDialog extraTabs={EXTRA_BOOK_DETAIL_TABS} />
    </Suspense>
  );
}

// 任务跑完的提醒：点「去阅读」进阅读器，失败的点「查看」打开书籍详情（和点网格卡片同一条路）。
function JobFinishNotifierSlot() {
  const library = useLibraryServices();
  const openJob = useCallback((job: FinishedJob) => {
    if (job.status === "succeeded") {
      globalThis.document.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.openReaderRequested, {
        detail: { jobId: job.jobId, pageIdx: null, blockId: "" },
      }));
      return;
    }
    library.actions.openBookDetail({ job_id: job.jobId, status: "failed" });
  }, [library]);
  return <JobFinishNotifier onOpenJob={openJob} />;
}

/** 挂载顺序就是这张表的顺序。 */
const HOME_OVERLAYS: readonly ComponentType[] = [
  GlossariesDialogSlot,
  StatusDetailDialog,
  // 没有界面：只负责跳到阅读页。
  ReaderNavigation,
  // 软打开阅读器：全屏层，主页不卸载（关 × 不刷新）。
  SoftReaderHost,
  CollectionDialogSlot,
  BookDetailDialogSlot,
  // sonner 全局宿主：DownloadToastHost 内含 <Toaster/>，任务中心取消/重试、收藏等处的 toast 都经它渲染；
  // 只能有一个（sonner 双宿主会重影）。
  DownloadToastHost,
  JobFinishNotifierSlot,
];

export function HomeOverlays() {
  return (
    <>
      {HOME_OVERLAYS.map((Overlay, index) => (
        // eslint-disable-next-line react/no-array-index-key -- 表是常量，顺序不变
        <Overlay key={index} />
      ))}
    </>
  );
}
