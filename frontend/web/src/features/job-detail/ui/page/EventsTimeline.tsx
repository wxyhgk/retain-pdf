// 阶段时间线 / 事件流:两张触发卡片 + 两个模态框。
// 视图为 src/js/job-detail/events.js 字符串模板的 JSX 重写(类名/结构照搬);
// 事件条目视图模型复用保留的纯逻辑 status-view-model.js 与 job/ 层格式化函数。
//
// 两个模态统一走共享 AppDialog 的 wide 尺寸与标准视觉骨架，不再维持
// detail 页独立的 .detail-modal/.detail-modal-panel/
// .detail-modal-head 结构(这三个类的 CSS 已随之从
// src/styles/pages/detail/modal.css 删除)。detail-modal-title/-subtitle/
// -close/-status 这几个纯排版类名原样保留(挂载点从旧结构的子级换成
// 共享 header/body 的子级；detail-timeline-dialog 仅保留时间线内容区的高度与
// 滚动覆盖，定义见 pages/detail/modal.css。
//
// open 状态仍然是 DetailApp.jsx 的 stageHistoryOpen/eventsOpen 两个 useState
// (铁律:不改状态管理本身,只换渲染层),onOpenChange(false) 统一路由到
// onClose 回调回写 state。
//
// 焦点归还:两个模态的触发按钮(StageHistoryTriggerCard/EventsTriggerCard)
// 虽然和模态本身在同一个 DetailApp 组件树内,但既没有用
// DialogPrimitive.Trigger 包裹触发按钮,Radix 默认的 triggerRef 也就永远是
// null——这个根因和"是否跨子树"无关(参见 use-dialog-return-focus.js 头
// 注释),所以这里同样接入 useDialogReturnFocus,和 home 页 7 个对话框保持
// 一致,不因为"看起来在同一棵树里"就假设可以省略。
//
// body 滚动锁定:DetailApp.jsx 原有的手写 document.body.style.overflow 锁定
// 已删除(见该文件对应注释)——Radix Dialog modal 模式自带等价锁定
// (react-remove-scroll,随 Content 挂载/卸载自动加锁/解锁),两个模态互斥
// (只要一个打开,遮罩 + focus trap 就会让另一个的触发卡片不可达),不会出现
// 两套机制同时争抢 body 样式的场景。

import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  stageHistoryDisplay,
  isJobTerminal,
} from "@retainpdf/domain/job";
import { buildJobDetailEventViewModel } from "@retainpdf/domain/job-status";

// —— 以下三个私有函数照搬旧 events.js,保证耗时/载荷文案逐字节一致 ——

function parseIsoTime(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveStageHistoryDuration(entry, job) {
  const explicit = Number(entry?.duration_ms);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const enterAt = parseIsoTime(entry?.enter_at);
  const exitAt = parseIsoTime(entry?.exit_at);
  if (enterAt && exitAt) {
    return Math.max(0, exitAt.getTime() - enterAt.getTime());
  }
  if (enterAt && !exitAt) {
    const endAt = isJobTerminal(job)
      ? parseIsoTime(job.finished_at || job.updated_at)
      : new Date();
    if (endAt) {
      return Math.max(0, endAt.getTime() - enterAt.getTime());
    }
  }
  return NaN;
}

function formatEventPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch (_err) {
    return "";
  }
}

export function StageHistoryTriggerCard({ onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
          <h2>阶段时间线</h2>
          <button id="detail-open-stage-history-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>查看</button>
        </div>
        <p className="detail-trigger-copy">默认收起，不再把整页拉长。需要时再打开查看完整阶段切换记录。</p>
      </div>
    </article>
  );
}

export function EventsTriggerCard({ buttonText, onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
          <h2>事件流</h2>
          <button id="detail-open-events-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>{buttonText}</button>
        </div>
        <p className="detail-trigger-copy">默认不请求事件流。只有点击查看时才加载，避免分享页初次打开就消耗过多流量。</p>
      </div>
    </article>
  );
}

function DetailModal({ modalId, titleId, title, subtitle, closeButtonId, open, onClose, children }) {
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Esc / 背板点击 / 关闭按钮都经这一个回调回写 DetailApp.jsx 的 useState。
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          id={modalId}
          className="detail-timeline-dialog"
          aria-labelledby={titleId}
          onCloseAutoFocus={onCloseAutoFocus}
          showCloseButton={false}
          size="wide"
        >
          <DialogShell className="desktop-shell">
            <DialogHeader className="desktop-head">
              <div>
                <DialogTitle asChild>
                  <h2 id={titleId} className="detail-modal-title">{title}</h2>
                </DialogTitle>
                <p className="detail-modal-subtitle">{subtitle}</p>
              </div>
              <DialogCloseButton id={closeButtonId} />
            </DialogHeader>
            <DialogBody className="desktop-body">
              {children}
            </DialogBody>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}

function StageHistoryItem({ entry, index, job }) {
  const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "进行中");
  const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
  const display = stageHistoryDisplay(entry);
  return (
    <article className="detail-stage-item">
      <div className="detail-stage-top">
        <div className="detail-stage-title">{`${index + 1}. ${display.title}`}</div>
        <div className="detail-stage-title">{formatRuntimeDuration(resolveStageHistoryDuration(entry, job))}</div>
      </div>
      <div className="detail-stage-meta">{`${enterAt} → ${exitAt}${terminalText}`}</div>
    </article>
  );
}

export function StageHistoryModal({ open, job, onClose }) {
  const history = Array.isArray(job?.stage_history) ? job.stage_history : [];
  const hasItems = history.length > 0;
  return (
    <DetailModal
      modalId="detail-stage-history-modal"
      titleId="detail-stage-history-modal-title"
      title="阶段时间线"
      subtitle="按阶段展示进入、退出与耗时。"
      closeButtonId="detail-close-stage-history-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-stage-history-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>暂无阶段记录</div>
      <div id="detail-stage-history-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {history.map((entry, index) => (
          <StageHistoryItem key={index} entry={entry} index={index} job={job} />
        ))}
      </div>
    </DetailModal>
  );
}

function EventItem({ item }) {
  const viewModel = buildJobDetailEventViewModel(item);
  const payloadText = formatEventPayload(viewModel.payload);
  const metaBits = [
    `#${viewModel.seq}`,
    formatEventTimestamp(viewModel.timestamp),
    viewModel.stageText,
  ];
  const contextBits = [
    viewModel.lane && viewModel.lane !== "main" ? `lane:${viewModel.lane}` : "",
    viewModel.displayStage ? `stage:${viewModel.displayStage}` : "",
    viewModel.substage ? `substage:${viewModel.substage}` : "",
    viewModel.provider,
    viewModel.providerStage,
    viewModel.eventType,
    viewModel.rawEventType,
  ].filter(Boolean);
  const statsBits = [];
  const progressCurrent = viewModel.progressCurrent;
  const progressTotal = viewModel.progressTotal;
  if (progressCurrent !== null || progressTotal !== null) {
    const progressUnit = viewModel.progressUnit;
    const suffix = progressUnit ? ` ${progressUnit}` : "";
    const text = viewModel.progressText ? `${viewModel.progressText} · ` : "";
    statsBits.push(`${text}progress ${progressCurrent ?? "-"} / ${progressTotal ?? "-"}${suffix}`);
  }
  const retryCount = viewModel.retryCount;
  if (retryCount !== null) {
    statsBits.push(`retry ${retryCount}`);
  }
  const elapsedMs = viewModel.elapsedMs;
  if (elapsedMs !== null) {
    statsBits.push(`elapsed ${formatRuntimeDuration(elapsedMs)}`);
  }
  return (
    <article className="detail-event-item">
      <div className="detail-event-top">
        <div className="detail-event-title">{viewModel.event}</div>
        <div className="detail-event-title">{viewModel.level}</div>
      </div>
      <div className="detail-event-meta">{metaBits.join(" · ")}</div>
      {contextBits.length ? <div className="detail-event-meta">{contextBits.join(" · ")}</div> : null}
      <div className="detail-event-meta">{viewModel.message}</div>
      {statsBits.length ? <div className="detail-event-meta">{statsBits.join(" · ")}</div> : null}
      {payloadText ? <pre className="detail-event-payload">{payloadText}</pre> : null}
    </article>
  );
}

export function EventsModal({ open, eventsPayload, status, onClose }) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const hasItems = items.length > 0;
  return (
    <DetailModal
      modalId="detail-events-modal"
      titleId="detail-events-modal-title"
      title="事件流"
      subtitle="只有打开时才会请求完整事件流，首次加载后会在当前页面缓存。"
      closeButtonId="detail-close-events-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-events-status" className="detail-modal-status">{status}</div>
      <div id="detail-events-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>暂无事件</div>
      <div id="detail-events-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {items.map((item, index) => (
          <EventItem key={item?.seq ?? index} item={item} />
        ))}
      </div>
    </DetailModal>
  );
}
