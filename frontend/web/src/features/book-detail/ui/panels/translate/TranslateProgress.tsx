// 处理 Tab 的翻译进度区：attachJobProgress（library domain）+ StatusCardEmbedded。
//
// 运行中挂载完整 StatusCard；终态由 WorkflowPanel 的紧凑过程条保留阶段历史，
// 失败态在过程条下继续给出诊断入口。

import { useEffect } from "react";
import { ArrowUpRight, Radio } from "lucide-react";
import { useHomeStatusCard } from "@/ui/context/home-services-context.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { StatusCard } from "@/features/jobs/index.js";
import type { LibraryCardItem } from "@/features/library/domain.js";
import {
  isLibraryOnlyItem,
} from "@/features/library/domain.js";
import { isActiveJobStatus } from "@retainpdf/domain/job";
import { useLibraryServices } from "@/features/library/index.js";


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
  /** 本书的任务 id（documentJobs.jobs）。全局卡片的 jobId 不在里面就不用它。 */
  documentJobIds?: string[];
}

export function BookTranslateProgressPanel({
  item = {},
  active = true,
  dialogOpen = true,
  onOpenLiveReader,
  documentJobIds = [],
}: BookTranslateProgressPanelProps) {
  const library = useLibraryServices();
  const actions = library?.actions;
  const { store: statusCardStore } = useHomeStatusCard();
  const statusCardState = useStoreSnapshot(statusCardStore);
  const cardJobId = `${statusCardState?.snapshot?.jobId || ""}`.trim();

  const jobId = resolveJobId(item);
  const showProgress = shouldShowJobProgress(item);
  const libraryOnly = isLibraryOnlyItem(item);
  const itemStatus = `${item.status || ""}`.trim().toLowerCase();

  const cardStatus = `${statusCardState?.snapshot?.status || ""}`.trim().toLowerCase();
  const cardPollingActive = isActiveJobStatus(cardStatus);
  const showDetailedProgress = showProgress && isActiveJobStatus(itemStatus);
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
    // 刻意不把 actions 放进 deps（窄口引用稳定，避免无意义重跑）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dialogOpen, shouldAttach, jobId, cardJobId, cardPollingActive, showDetailedProgress]);

  // 「压住主页那张状态卡」这件事已经不存在了：主页那张页面级状态卡整个下线，
  // 抑制闸（statusArea.setSuppressed）随之删除。进度只有书籍详情一个主场。

  // 空闲态由任务卡标题和启动表单表达，不渲染静态路线图。
  if (!showProgress) {
    return <span id="book-detail-translate-progress" className="sr-only" data-state="idle" />;
  }

  // 终态不挂完整大卡；WorkflowPanel 会展示紧凑四阶段过程条。
  if (!showDetailedProgress) {
    // 失败的说法、「查看日志」和「从断点继续」都在失败卡片上（TranslationStoppedCard）。
    // 这里曾经再画一条「本次翻译失败 · 查看日志」，和卡片说同一件事。只留契约节点。
    if (showFailure) {
      return (
        <span
          id="book-detail-translate-progress"
          className="sr-only"
          data-job-id={jobId}
          data-state="failed"
          data-item-status={itemStatus}
        />
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
          // 全局卡片可能在播另一本书的任务；只有它属于本书（如刚提交的重试）才跟它。
          onClick={() => onOpenLiveReader(cardJobId && documentJobIds.includes(cardJobId) ? cardJobId : jobId)}
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
        {/* StatusCard 现在只有嵌入这一套形态（主页那张页面级卡已下线），
            所以不再需要 embedded / showHiddenContract / showResultActions 这些
            用来区分两套形态的开关。 */}
        <StatusCard
          visible={active}
          idPrefix="book-detail-"
          rootId="book-detail-job-status-card"
          fallbackItem={liveFallback}
        />
      </div>
    </div>
  );
}
