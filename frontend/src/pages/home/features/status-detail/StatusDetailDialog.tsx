// StatusDetailDialog (component chính §1 trong bản thiết kế) —— đối chiếu
// components/dialogs/status-detail-dialog-template.js theo từng id/class.
//
// Lớp render Dialog (đợt 2 giai đoạn C, cải tiến shadcn): chuyển từ <dialog> gốc + showModal/close
// sang nguyên mẫu Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content),
// không sử dụng giao diện mặc định từ src/components/ui/dialog.jsx (className tiếp tục dùng bộ CSS bespoke hiện có
// desktop-dialog/desktop-shell, cùng tồn tại với các ghi đè chuyên biệt cho status-detail-dialog).
// open được kiểm soát bởi dialogStore (open từ useStatusDetailOverview),
// onOpenChange khi next===false sẽ gọi thống nhất dialogStore.close() —— đây không phải
// là ngữ nghĩa hai trạng thái như TranslationWorkflowDialog (tải lên/trạng thái), đóng là đóng, không cần phân luồng.
// Ba đường dẫn kích hoạt (Escape, nhấp vào nền (phát hiện outside-click của DismissableLayer), nhấp vào nút đóng
// (DialogPrimitive.Close, thay thế cho việc gửi form ẩn <form method="dialog">)) đều đi qua một callback duy nhất.
//
// Không forceMount Content (quyết định giống với 4 hộp thoại đợt 1 giai đoạn C như CredentialsDialog,
// xem chú thích đầu tệp use-dialog-return-focus.js —— forceMount sẽ khiến tác dụng phụ hideOthers() bên trong
// Content của Radix modal có hiệu lực vĩnh viễn ngay khi ứng dụng khởi động).
//
// Tương tác forceMount hai lớp (điểm rủi ro của tệp này): 4 tab bên trong vẫn tiếp tục forceMount riêng lẻ
// TabsPrimitive.Content + ghi đè hidden rõ ràng (quyết định giai đoạn B, ngữ nghĩa xem chú thích hàm panel bên dưới)
// —— lớp Dialog bên ngoài không forceMount nữa đồng nghĩa với việc khi đóng hộp thoại, Content cùng với 4 Tabs bên trong sẽ bị gỡ bỏ,
// useState bên trong tab (như mục được chọn trong TranslationDebugTab) sẽ bị xóa. Điều này có thể chấp nhận được về mặt ngữ nghĩa sản phẩm:
// ngữ nghĩa gắn kết thường trú forceMount+hidden ban đầu chỉ phục vụ cho "chuyển tab trong khi hộp thoại mở mà không mất trạng thái",
// chưa bao giờ đảm bảo "giữ trạng thái khi đóng và mở lại hộp thoại", hai điều này không xung đột
// (đã kiểm tra bằng Playwright mới: chuyển đổi giữa 4 tab trong khi mở, trạng thái chọn của TranslationDebugTab được giữ nguyên khi chuyển tab, xem báo cáo giai đoạn C).
//
// Triển khai Tabs (giai đoạn B, cải tiến shadcn): giống lựa chọn của SettingsHubDialog/CredentialsDialog
// —— sử dụng trực tiếp nguyên mẫu Tabs của radix-ui (không qua giao diện mặc định src/components/ui/tabs.jsx,
// tránh xung đột với bộ CSS bespoke detail-tabs/detail-tab-panel). activeTab được điều khiển bởi controller.activateDetailTab của useStatusDetailOverview,
// Radix chạy ở chế độ controlled. Cả 4 panel đều chuyển thành TabsPrimitive.Content (forceMount + ghi đè hidden rõ ràng),
// đã xác minh rằng forceMount của Radix chỉ đảm bảo "buộc render children", khả năng hiển thị vẫn do thuộc tính hidden truyền vào rõ ràng trong contentProps quyết định
// (xảy ra sau khi Radix tính toán hidden nội bộ, sẽ ghi đè lên nó) —— useState bên trong StageHistoryList/EventsList/TranslationDebugTab
// do đó tiếp tục không bị ảnh hưởng bởi việc chuyển tab, đây là điểm rủi ro lớn nhất của việc di chuyển tệp này,
// đã được xác minh bằng kiểm thử component + Playwright mới (xem status-detail-dialog-component.test.mjs và báo cáo giai đoạn B/C).

import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { StageHistoryList } from "./StageHistoryList.jsx";
import { EventsList, eventsStatusText } from "./EventsList.jsx";
import { TranslationDebugTab } from "./TranslationDebugTab.jsx";
import { useStatusDetailOverview } from "./useStatusDetailOverview.js";
import { useRerunAction } from "./useRerunAction.js";
import { STATUS_DETAIL_DIALOG_IDS, STATUS_DETAIL_MARKDOWN_BUNDLE_ID } from "./status-detail-dom-ids.js";
import { useHomeServices } from "../../home-services-context.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useArtifactDownloadBusy } from "../../state/use-artifact-download-busy.js";
import { Button } from "../../../../components/Button.jsx";

const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "failure", label: "Thất bại" },
  { key: "events", label: "Sự kiện" },
  { key: "translation", label: "Chẩn đoán nâng cao", advanced: true },
];

function DetailItem({ id, label, value, optional = false }) {
  // Hàng optional sao chép ngữ nghĩa từ toggleOptionalRuntimeRow của thế giới cũ view.js: phần tử luôn tồn tại trong
  // DOM, chỉ thêm lớp hidden cho container khi giá trị trống/"-" (không gỡ bỏ toàn bộ hàng) —— lastTransition/
  // terminalReason là hai hàng duy nhất sử dụng ngữ nghĩa này.
  const text = `${value ?? "-"}`.trim();
  const rowHidden = optional && (!text || text === "-");
  return (
    <div className={`detail-item${rowHidden ? " hidden" : ""}`}><span className="label">{label}</span><span id={id} className="info-value">{value}</span></div>
  );
}

function OverviewMarkdownBundleLink() {
  // Lĩnh vực artifact-downloads (bản thiết kế §7) —— trạng thái tải xuống lấy từ statusCardStore (sản phẩm của cùng một điểm
  // callback renderJob với ResultActions.jsx, khi mở status-detail luôn hiển thị job đang được polling hiện tại,
  // xem chú thích khối lắp ráp "StatusDetailDialog lĩnh vực" trong composition.js;
  // đoạn fetch của overview (events/diagnostics/resumePlan) không chứa markdownBundleUrl/Ready,
  // không tạo lại logic phái sinh). Hành vi nhấp chuột được ủy quyền ở cấp document
  // (controller.js đã gắn bindEvents() trong composition.js), component này không cần xử lý onClick,
  // chỉ đăng ký store busy để điều khiển văn bản "Đang tải..."
  const services = useHomeServices();
  const cardSnapshot = useStoreSnapshot(services.statusCard.store);
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, STATUS_DETAIL_MARKDOWN_BUNDLE_ID);
  const ready = Boolean(cardSnapshot.snapshot?.markdownBundleReady);
  const url = cardSnapshot.snapshot?.markdownBundleUrl || "";
  const enabled = ready && Boolean(url) && !busyState.busy;
  const label = busyState.busy ? (busyState.label || "Đang tải...") : "Tải xuống Markdown ZIP";
  return (
    <a
      id={STATUS_DETAIL_MARKDOWN_BUNDLE_ID}
      className={`button-link secondary${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
    >
      {label}
    </a>
  );
}

function OverviewPanel({ overview, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const runtime = overview.runtime;
  return (
    <TabsPrimitive.Content
      value="overview"
      forceMount
      id={ids.panels.overview}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="overview"
      hidden={!active}
    >
      <div className="detail-download-row">
        <OverviewMarkdownBundleLink />
      </div>
      <div className="detail-grid">
        <DetailItem id={ids.runtime.currentStage} label="Giai đoạn hiện tại" value={runtime.currentStage} />
        <DetailItem id={ids.runtime.stageElapsed} label="Thời gian giai đoạn hiện tại" value={runtime.stageElapsed} />
        <DetailItem id={ids.runtime.totalElapsed} label="Tổng thời gian" value={runtime.totalElapsed} />
        <DetailItem id={ids.runtime.retryCount} label="Số lần thử lại" value={runtime.retryCount} />
        <DetailItem id={ids.runtime.lastTransition} label="Chuyển đổi gần nhất" value={runtime.lastTransition} optional />
        <DetailItem id={ids.runtime.terminalReason} label="Nguyên nhân kết thúc" value={runtime.terminalReason} optional />
        <DetailItem id={ids.runtime.inputProtocol} label="Giao thức đầu vào" value={runtime.inputProtocol} />
        <DetailItem id={ids.runtime.stageSpecVersion} label="Stage Schema" value={runtime.stageSpecVersion} />
        <DetailItem id={ids.runtime.mathMode} label="Chế độ công thức" value={runtime.mathMode} />
      </div>
      <div className="status-panel detail-stage-panel">
        <div className="status-panel-head"><h3>Tiến trình các giai đoạn</h3></div>
        <StageHistoryList job={overview.job} finishedAtFallback={overview.finishedAtFallback} />
      </div>
    </TabsPrimitive.Content>
  );
}

function FailurePanel({ overview, rerunPending, controller, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const failure = overview.failure;
  const rerun = useRerunAction({ overview, rerunPending, controller });
  return (
    <TabsPrimitive.Content
      value="failure"
      forceMount
      id={ids.panels.failure}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="failure"
      hidden={!active}
    >
      <div className="status-panel">
        <div className="status-panel-head">
          <h3>Chẩn đoán thất bại</h3>
          <span className="status-panel-note">Tóm tắt thất bại có cấu trúc và gợi ý khắc phục</span>
        </div>
        <div className="failure-action-row">
          <button id={ids.failure.rerunButton} type="button" className="button-link secondary" disabled={rerun.disabled} onClick={rerun.run}>Khôi phục từ điểm dừng/Chạy lại</button>
          <span id={ids.failure.rerunStatus} className="status-panel-note">{rerun.status || "Sau khi thất bại, nếu backend cho phép, có thể tạo nhiệm vụ khôi phục dựa trên sản phẩm hiện có."}</span>
        </div>
        <div className="failure-hero-card">
          <span className="label">Tóm tắt thất bại</span>
          <span id={ids.failure.summary} className="info-value">{failure.summary}</span>
        </div>
        <div className="info-list detail-info-list">
          <div className="info-row"><span className="label">Phân loại</span><span id={ids.failure.category} className="info-value">{failure.category}</span></div>
          <div className="info-row"><span className="label">Giai đoạn</span><span id={ids.failure.stage} className="info-value">{failure.stage}</span></div>
          <div className="info-row"><span className="label">Nguyên nhân gốc</span><span id={ids.failure.rootCause} className="info-value">{failure.rootCause}</span></div>
          <div className="info-row"><span className="label">Gợi ý</span><span id={ids.failure.suggestion} className="info-value">{failure.suggestion}</span></div>
          <div className="info-row"><span className="label">Nhật ký gần nhất</span><span id={ids.failure.lastLogLine} className="info-value">{failure.lastLogLine}</span></div>
          <div className="info-row"><span className="label">Có thể thử lại</span><span id={ids.failure.retryable} className="info-value">{failure.retryable}</span></div>
        </div>
      </div>
    </TabsPrimitive.Content>
  );
}

function EventsPanel({ overview, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  return (
    <TabsPrimitive.Content
      value="events"
      forceMount
      id={ids.panels.events}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="events"
      hidden={!active}
    >
      <div className="status-panel">
        <div className="status-panel-head">
          <h3>Luồng sự kiện</h3>
          <span id={ids.events.status} className="status-panel-note">{eventsStatusText(overview.eventsPayload)}</span>
        </div>
        <p className="events-lead">Hiển thị các sự kiện gần nhất theo thứ tự thời gian đảo ngược, phù hợp để xác định giai đoạn nhiệm vụ bị kẹt và những gì đã xảy ra trước lần thất bại cuối cùng.</p>
        <EventsList eventsPayload={overview.eventsPayload} />
      </div>
    </TabsPrimitive.Content>
  );
}

function TranslationPanel({ translation, controller, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  return (
    <TabsPrimitive.Content
      value="translation"
      forceMount
      id={ids.panels.translation}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="translation"
      hidden={!active}
    >
      <TranslationDebugTab translation={translation} controller={controller} />
    </TabsPrimitive.Content>
  );
}

export function StatusDetailDialog() {
  const { open, activeTab, overview, translation, rerunPending, controller, dialogStore } = useStatusDetailOverview();
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Escape / click nền (phát hiện outside-click của DismissableLayer) / nút đóng
  // (DialogPrimitive.Close) đều đi qua callback này để ghi lại store —— không phải
  // ngữ nghĩa hai trạng thái kiểu TranslationWorkflowDialog, next===false thì close() trực tiếp.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const headline = overview.headline;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="status-detail-dialog-overlay" />
        <DialogPrimitive.Content
          id={ids.dialog}
          className="desktop-dialog status-detail-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <div className="status-detail-headline">
                <span
                  id={ids.headline.icon}
                  className="status-detail-head-icon"
                  aria-hidden="true"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: headline.iconMarkup || "" }}
                />
                <div className="status-detail-head-copy">
                  <div className="status-detail-head-top">
                    <DialogPrimitive.Title asChild>
                      <h2>Chi tiết nhiệm vụ</h2>
                    </DialogPrimitive.Title>
                    <p className="status-detail-job-meta">Job ID <span id={ids.headline.jobId} className="status-detail-job-id mono">{headline.jobId}</span></p>
                  </div>
                  <p id={ids.headline.note} className="status-panel-note">{headline.note}</p>
                </div>
              </div>
              <DialogPrimitive.Close asChild>
                <Button size={undefined} id={ids.headline.closeButton} className="dialog-close-btn" aria-label="Đóng">×</Button>
              </DialogPrimitive.Close>
            </div>
            <TabsPrimitive.Root
              className="contents"
              value={activeTab}
              onValueChange={(tab) => controller.activateDetailTab(tab)}
            >
              <div className="desktop-body status-detail-body">
                <TabsPrimitive.List className="detail-tabs" aria-label="Chi tiết nhiệm vụ">
                  {TABS.map((tab) => (
                    <TabsPrimitive.Trigger
                      key={tab.key}
                      value={tab.key}
                      id={ids.tabs[tab.key]}
                      className={`detail-tab${tab.advanced ? " detail-tab-advanced" : ""}${activeTab === tab.key ? " is-active" : ""}`}
                      data-tab={tab.key}
                    >
                      {tab.label}
                    </TabsPrimitive.Trigger>
                  ))}
                </TabsPrimitive.List>

                <div className="detail-tab-panels">
                  <OverviewPanel overview={overview} active={activeTab === "overview"} />
                  <FailurePanel overview={overview} rerunPending={rerunPending} controller={controller} active={activeTab === "failure"} />
                  <EventsPanel overview={overview} active={activeTab === "events"} />
                  <TranslationPanel translation={translation} controller={controller} active={activeTab === "translation"} />
                </div>
              </div>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
