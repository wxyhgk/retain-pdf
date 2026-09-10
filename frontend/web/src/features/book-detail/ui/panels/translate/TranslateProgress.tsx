// 处理 Tab 的翻译进度区：attachJobProgress（library domain）+ StatusCardEmbedded。
//
// 运行中挂载完整 StatusCard；终态由 WorkflowPanel 的紧凑过程条保留阶段历史，
// 失败态在过程条下继续给出诊断入口。

import { useEffect } from "react";
import { ArrowUpRight, Radio } from "lucide-react";
import { useHomeServices } from "@/app/home/home-services-context.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { StatusCard } from "@/features/jobs/index.js";
import type { LibraryCardItem } from "@/features/library/domain.js";
import {
  isLibraryOnlyItem,
} from "@/features/library/domain.js";

const PROGRESS_STATUSES = new Set(["queued", "pending", "running", "validating"]);

function resolveJobId(item: LibraryCardItem = {}) {
  const raw = `${item.job_id || item.active_job_id || ""}`.trim();
  if (!raw || raw.startsWith("doc:")) return "";
  return raw;
}

/**
 * 是否应展示任务进度卡。
 * 只要有真实 job_id 就展示——不要用 library_only 挡掉已完成书
 * （个别投影 library_only 可能不准，但 job_id 在）。
 */
function shouldShowJobProgress(item: LibraryCardItem = {}) {
  const jobId = resolveJobId(item);
  if (!jobId) return false;
  // 明确馆藏且 job 是合成 id 已在 resolveJobId 过滤
  // 有真实 job 即展示（succeeded / running / failed / 甚至 status 空）
  return true;
}

export interface BookTranslateProgressPanelProps {
  item?: LibraryCardItem;
  active?: boolean;
  dialogOpen?: boolean;
  onOpenLiveReader?: (jobId: string) => void;
}

export function BookTranslateProgressPanel({
  item = {},
  active = true,
  dialogOpen = true,
  onOpenLiveReader,
}: BookTranslateProgressPanelProps) {
  const services = useHomeServices();
  const actions = services.library?.actions;
  const statusCardState = useStoreSnapshot(services.statusCard.store);
  const cardJobId = `${statusCardState?.snapshot?.jobId || ""}`.trim();

  const jobId = resolveJobId(item);
  const showProgress = shouldShowJobProgress(item);
  const libraryOnly = isLibraryOnlyItem(item);
  const itemStatus = `${item.status || ""}`.trim().toLowerCase();

  const cardStatus = `${statusCardState?.snapshot?.status || ""}`.trim().toLowerCase();
  const cardPollingActive = PROGRESS_STATUSES.has(cardStatus);
  const showDetailedProgress = showProgress && PROGRESS_STATUSES.has(itemStatus);
  const showFailure = showProgress && itemStatus === "failed";
  const shouldAttach = showDetailedProgress || showFailure;

  // 静默拉 job：只喂 statusCardStore。
  // 详情当前文档拥有展示优先级；job_id 不同就切换，禁止复用上一本书的全局快照。
  useEffect(() => {
    if (!active || !dialogOpen || !shouldAttach || !jobId) return undefined;
    if (cardJobId === jobId) return undefined;
    // retry 回执已把全局 runtime 切到新 job B 时，document-scoped 列表可能
    // 暂时仍给出旧 job A。禁止 A 在这里重新 attach 并夺回轮询所有权。
    if (cardJobId && cardPollingActive && !showDetailedProgress) return undefined;
    actions?.attachJobProgress?.(jobId);
    return undefined;
    // 刻意不把 actions 放进 deps（services 引用稳定，避免无意义重跑）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dialogOpen, shouldAttach, jobId, cardJobId, cardPollingActive, showDetailedProgress]);

  // 进度主场在详情：仅当主状态区当前可见时才关掉（避免 setVisible 每帧通知死循环）
  useEffect(() => {
    if (!active || !dialogOpen || !shouldAttach) return undefined;
    if (services.statusArea?.isVisible?.()) {
      services.statusArea.setVisible(false);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dialogOpen, shouldAttach]);

  // 空闲态由任务卡标题和启动表单表达，不渲染静态路线图。
  if (!showProgress) {
    return <span id="book-detail-translate-progress" className="sr-only" data-state="idle" />;
  }

  // 终态不挂完整大卡；WorkflowPanel 会展示紧凑四阶段过程条。
  if (!showDetailedProgress) {
    if (showFailure) {
      const snapshot: any = item.stage_snapshot || {};
      const detail = `${snapshot.stage_detail || item.stage_detail || ""}`.trim();
      return (
        <div
          id="book-detail-translate-progress"
          className="flex items-center justify-between gap-3 rounded-lg border border-foreground/20 bg-muted/30 px-3 py-2.5"
          data-job-id={jobId}
          data-state="failed"
          data-item-status={itemStatus}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">本次翻译失败</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {detail && detail !== "任务失败" ? detail : "查看失败原因后可重新提交"}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            onClick={() => services.statusDetail.controller.openStatusDetailDialog("failure")}
          >
            查看日志
          </button>
        </div>
      );
    }
    return <span id="book-detail-translate-progress" className="sr-only" data-state="succeeded" />;
  }

  // fallback：优先跟 statusCard 正在播的 job（含重试新 id），避免用旧 item 盖回完成态
  const liveFallback = cardJobId && cardJobId !== jobId
    ? {
        document_id: item.document_id,
        title: item.title,
        display_name: item.display_name,
        source_filename: item.source_filename,
        page_count: item.page_count,
        cover_url: item.cover_url,
        thumbnail_url: item.thumbnail_url,
        job_id: cardJobId,
        active_job_id: cardJobId,
        library_only: false,
        status: cardStatus || item.status,
      }
    : item;

  // 只有运行中任务挂载完整 StatusCard。
  // 父级 Tabs.Content 用 data-[state=inactive]:hidden 藏面板，节点仍在 DOM
  // （开发者工具可搜 #book-detail-job-status-card）。
  return (
    <div
      id="book-detail-translate-progress"
      className="book-translate-progress"
      data-job-id={cardJobId || jobId}
      data-state={itemStatus === "succeeded" && !cardPollingActive ? "succeeded" : "ready"}
      data-item-status={itemStatus || ""}
      data-library-only={libraryOnly ? "true" : "false"}
      data-tab-active={active ? "true" : "false"}
    >
      {onOpenLiveReader ? (
        <button
          type="button"
          className="home-book-live-translation-entry w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90"
          onClick={() => onOpenLiveReader(cardJobId || jobId)}
          aria-label="在阅读器中查看实时译文"
        >
          <span className="home-book-live-translation-entry-icon" aria-hidden="true">
            <Radio />
          </span>
          <span>
            <strong>查看实时译文 →</strong>
            <small>在原 PDF 上逐页显示</small>
          </span>
          <ArrowUpRight aria-hidden="true" />
        </button>
      ) : null}
      <div className="book-detail-status-card-host">
        <StatusCard
          visible={active}
          embedded
          idPrefix="book-detail-"
          rootId="book-detail-job-status-card"
          fallbackItem={liveFallback}
          showHiddenContract={false}
          showResultActions={false}
        />
      </div>
    </div>
  );
}
