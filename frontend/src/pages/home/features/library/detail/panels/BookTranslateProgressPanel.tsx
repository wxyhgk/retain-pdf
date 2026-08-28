// Khu vực tiến độ Tab Dịch: attachJobProgress (library domain) + StatusCardEmbedded.
//
// Chỉ cần có job_id thật là gắn #book-detail-job-status-card;
// Sách đã hoàn thành dùng fallbackItem để bổ sung trạng thái hoàn thành (xem status/merge-snapshot-with-fallback).

import { useEffect } from "react";
import { useHomeServices } from "../../../../home-services-context.js";
import { useStoreSnapshot } from "../../../../../../shared/react/use-store.js";
import { StatusCard } from "../../../status/StatusCard.jsx";
import { StageFlow } from "../../../status/StageFlow.jsx";
import type { LibraryCardItem } from "../../types.js";
import { isLibraryOnlyItem } from "../../../../composition/external.js";

function resolveJobId(item: LibraryCardItem = {}) {
  const raw = `${item.job_id || item.active_job_id || ""}`.trim();
  if (!raw || raw.startsWith("doc:")) return "";
  return raw;
}

/**
 * Có nên hiển thị thẻ tiến độ nhiệm vụ không.
 * Chỉ cần có job_id thật là hiển thị — đừng dùng library_only để chặn sách đã hoàn thành
 * (một số trường hợp library_only có thể không chính xác, nhưng job_id vẫn có).
 */
function shouldShowJobProgress(item: LibraryCardItem = {}) {
  const jobId = resolveJobId(item);
  if (!jobId) return false;
  // Xác định bộ sưu tập và job Là tổng hợp id lúc resolveJobId lọc
  // Có tính xác thực job tức là trưng bày（succeeded / running / failed / thậm chí status Trống）
  return true;
}

export interface BookTranslateProgressPanelProps {
  item?: LibraryCardItem;
  active?: boolean;
  dialogOpen?: boolean;
}

export function BookTranslateProgressPanel({
  item = {},
  active = true,
  dialogOpen = true,
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
  const cardPollingActive = cardStatus === "running"
    || cardStatus === "queued"
    || cardStatus === "pending";

  // Lấy job âm thầm: chỉ cung cấp cho statusCardStore.
  // Lưu ý: nhấn «Làm lại xxx» sẽ chuyển sang job_id mới; nếu statusCard đang chạy job mới, đừng dùng id cũ ghi đè.
  useEffect(() => {
    if (!dialogOpen || !showProgress || !jobId) return undefined;
    if (cardJobId === jobId) return undefined;
    if (cardJobId && cardPollingActive && cardJobId !== jobId) {
      return undefined;
    }
    actions?.attachJobProgress?.(jobId);
    return undefined;
    // Cố tình không actions bỏ vào deps（services Tham chiếu ổn định，Tránh chạy lại vô nghĩa）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress, jobId, cardJobId, cardPollingActive]);

  // Tiến độ chính ở chi tiết: chỉ tắt khi vùng trạng thái chính hiện đang hiển thị (tránh vòng lặp thông báo setVisible mỗi khung hình)
  useEffect(() => {
    if (!dialogOpen || !showProgress) return undefined;
    if (services.statusArea?.isVisible?.()) {
      services.statusArea.setVisible(false);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress]);

  // Bộ sưu tập chưa dịch：Trạng thái trống
  if (!showProgress) {
    return (
      <div
        id="book-detail-translate-progress"
        className="book-translate-progress space-y-3 rounded-xl border border-border/60 px-4 py-3.5"
        data-state="idle"
        data-library-only={libraryOnly ? "true" : "false"}
        data-item-status={itemStatus || ""}
        data-job-id=""
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quy trình dịch
        </p>
         {/* Chỉ giữ "Xem trước lộ trình" ở trạng thái rỗng (khóa hợp đồng kiểm thử), không hiển thị thanh tiến trình giả/0% —
             Nguyên nhân chính của cảm giác xám xịt khi vô hiệu hóa là do các máy chết xếp chồng lên nhau */}
        <div className="pointer-events-none">
          <StageFlow
            id="book-detail-stage-flow"
            currentStageKey=""
            selectedStageKey=""
            onSelectStage={() => {}}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Chưa bắt đầu dịch. Chọn dịch toàn bộ hoặc phạm vi trang bên dưới, tiến độ sẽ xuất hiện ở đây theo thời gian thực.
        </p>
      </div>
    );
  }

  // fallback: ưu tiên job đang chạy trên statusCard (bao gồm id mới khi thử lại), tránh dùng item cũ ghi đè trạng thái hoàn thành
  const liveFallback = cardJobId && cardJobId !== jobId
    ? {
        ...item,
        job_id: cardJobId,
        active_job_id: cardJobId,
        library_only: false,
        status: cardStatus || item.status,
      }
    : item;

  // Có job: luôn gắn StatusCard đầy đủ.
  // Tabs.Content cha dùng data-[state=inactive]:hidden để ẩn bảng, node vẫn trong DOM
  // (công cụ dành cho nhà phát triển có thể tìm #book-detail-job-status-card).
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
      <div className="book-detail-status-card-host">
        <StatusCard
          visible
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
