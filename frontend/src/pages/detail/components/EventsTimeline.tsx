// Timeline giai đoạn / event stream: hai thẻ trigger + hai modal.
// View là bản viết lại JSX của string template trong src/js/job-detail/events.js (giữ nguyên class/structure);
// view model của event item tái sử dụng logic thuần status-view-model.js và hàm format tầng job/.
//
// Tầng render Dialog (batch kết thúc phase C, shadcn migration): hai modal chuyển từ bespoke
// <section className="detail-modal"><div role="dialog" aria-modal="true">
// sang Radix Dialog (DialogPrimitive.Root/Portal/Overlay/Content), thống nhất với skeleton thị giác
// desktop-dialog/desktop-shell/desktop-head/desktop-body của trang home, không duy trì cấu trúc riêng
// .detail-modal/.detail-modal-panel/.detail-modal-head của detail nữa (CSS của ba class này đã bị xóa khỏi
// src/styles/pages/detail/modal.css). Các class chỉ định typography detail-modal-title/-subtitle/-close/-status
// được giữ nguyên (mount point chuyển từ con của cấu trúc cũ sang con của desktop-head/desktop-body, visual không đổi,
// nội dung cũng không dùng chung, chưa đáng gom thành dialog-close-btn dùng chung; đặc biệt màu stroke của
// detail-modal-close là #d5d7dd còn dialog-close-btn là #d2d2d7, merge vội có thể tạo khác biệt mắt thường khó thấy
// nhưng pixelmatch bắt được). Các override detail-timeline-dialog/detail-timeline-overlay mới tái tạo visual pixel-level
// của .detail-modal/.detail-modal-panel cũ (max-width 920px / max-height 82vh / radius 28px / border #e5e7eb /
// shadow sâu hơn), định nghĩa trong pages/detail/modal.css.
//
// State open vẫn là hai useState stageHistoryOpen/eventsOpen trong DetailApp.jsx
// (luật cứng: không đổi state management, chỉ đổi tầng render), onOpenChange(false) route chung về
// callback onClose để ghi state lại.
//
// Trả focus: dù hai nút trigger modal (StageHistoryTriggerCard/EventsTriggerCard) nằm cùng cây component DetailApp
// với modal, chúng không được bọc bằng DialogPrimitive.Trigger nên triggerRef mặc định của Radix luôn là null.
// Gốc này không liên quan tới chuyện "có vượt qua subtree không" (xem comment đầu use-dialog-return-focus.js), vì vậy
// ở đây cũng dùng useDialogReturnFocus để nhất quán với 7 dialog ở trang home, không giả định có thể bỏ qua chỉ vì
// "trông như cùng một cây".
//
// Body scroll lock: lock thủ công document.body.style.overflow trước đây trong DetailApp.jsx đã bị xóa
// (xem comment tương ứng trong file đó). Radix Dialog modal mode tự có lock tương đương
// (react-remove-scroll, tự lock/unlock theo mount/unmount của Content), hai modal loại trừ nhau
// (chỉ cần một cái mở, overlay + focus trap khiến thẻ trigger của cái còn lại không thể tới được), nên không có
// tình huống hai cơ chế cùng tranh body style.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../shared/react/use-dialog-return-focus.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  stageHistoryDisplay,
  isJobTerminal,
  buildJobDetailEventViewModel,
} from "../external.js";

// -- Ba hàm private dưới đây bê nguyên từ events.js cũ để giữ text duration/payload khớp từng byte. --

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
          <h2>Timeline giai đoạn</h2>
          <button id="detail-open-stage-history-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>Xem</button>
        </div>
        <p className="detail-trigger-copy">Mặc định thu gọn để không kéo dài cả trang. Mở khi cần xem đầy đủ lịch sử chuyển giai đoạn.</p>
      </div>
    </article>
  );
}

export function EventsTriggerCard({ buttonText, onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
          <h2>Event stream</h2>
          <button id="detail-open-events-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>{buttonText}</button>
        </div>
        <p className="detail-trigger-copy">Mặc định không request event stream. Chỉ tải khi bấm xem để tránh lần mở đầu của trang chia sẻ tiêu tốn quá nhiều lưu lượng.</p>
      </div>
    </article>
  );
}

function DetailModal({ modalId, titleId, title, subtitle, closeButtonId, open, onClose, children }) {
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Esc / click nền / nút đóng đều đi qua callback này để ghi lại useState của DetailApp.jsx.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="detail-timeline-overlay" />
        <DialogPrimitive.Content
          id={modalId}
          className="desktop-dialog detail-timeline-dialog"
          aria-labelledby={titleId}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <div>
                <DialogPrimitive.Title asChild>
                  <h2 id={titleId} className="detail-modal-title">{title}</h2>
                </DialogPrimitive.Title>
                <p className="detail-modal-subtitle">{subtitle}</p>
              </div>
              <DialogPrimitive.Close asChild>
                <button id={closeButtonId} type="button" className="detail-modal-close" aria-label="Đóng">×</button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body">
              {children}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function StageHistoryItem({ entry, index, job }) {
  const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "Đang chạy");
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
      title="Timeline giai đoạn"
      subtitle="Hiển thị thời điểm vào, thoát và thời lượng theo từng giai đoạn."
      closeButtonId="detail-close-stage-history-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-stage-history-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>Chưa có bản ghi giai đoạn</div>
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
      title="Event stream"
      subtitle="Chỉ request event stream đầy đủ khi mở; sau lần tải đầu sẽ cache trong trang hiện tại."
      closeButtonId="detail-close-events-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-events-status" className="detail-modal-status">{status}</div>
      <div id="detail-events-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>Chưa có sự kiện</div>
      <div id="detail-events-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {items.map((item, index) => (
          <EventItem key={item?.seq ?? index} item={item} />
        ))}
      </div>
    </DetailModal>
  );
}
