// Hợp nhất snapshot statusCard + live item thư viện.
//
// Vấn đề: attachJobProgress → startPolling khung đầu đẩy placeholder
// (status=queued, stage_detail=đang đọc...), sách đã hoàn thành bị đè thành đang xếp hàng.
// Hàm này bù trạng thái cuối/tiến trình từ item thư viện về snapshot, chi tiết và luồng
// chính dùng chung một chỗ.

import type { StatusCardJobRecord, StatusCardSnapshot } from "./status-card-store.js";

/** Trường liên quan tiến trình trên dòng live thư viện (library item) */
export type StatusCardFallbackItem = {
  job_id?: string;
  status?: string;
  stage_detail?: string;
  detail?: string;
  output_pdf_ready?: boolean;
  created_at?: string;
  updated_at?: string;
  progress?: {
    percent?: number;
    current?: number;
    total?: number;
    unit?: string;
  } | null;
  [key: string]: unknown;
};

/**
 * @param snapshot statusCardStore.snapshot
 * @param fallbackItem item thư viện
 */
export function mergeSnapshotWithFallback(
  snapshot: StatusCardSnapshot | null | undefined,
  fallbackItem: StatusCardFallbackItem | null = null,
): StatusCardSnapshot | null | undefined {
  if (!fallbackItem || typeof fallbackItem !== "object") {
    return snapshot;
  }
  const snapJob = `${snapshot?.jobId || ""}`.trim();
  const itemJob = `${fallbackItem.job_id || ""}`.trim().replace(/^doc:/, "");
  if (!itemJob) {
    return snapshot;
  }
  if (snapJob && snapJob !== itemJob && !snapJob.startsWith("doc:")) {
    const snapStatus = `${snapshot?.status || ""}`.trim();
    if (snapStatus && snapStatus !== "queued") {
      return snapshot;
    }
  }

  const itemStatus = `${fallbackItem.status || ""}`.trim().toLowerCase();
  const snapStatus = `${snapshot?.status || ""}`.trim().toLowerCase();
  const snapIsWeak =
    !snapStatus
    || snapStatus === "queued"
    || !snapJob
    || `${snapshot?.detail || ""}`.includes("đang đọc")
    || `${snapshot?.value || ""}`.includes("chuẩn bị");

  const progress = fallbackItem.progress && typeof fallbackItem.progress === "object"
    ? fallbackItem.progress
    : {};
  const itemPercent = Number(progress.percent);
  const itemCurrent = Number(progress.current);
  const itemTotal = Number(progress.total);

  if (itemStatus === "succeeded" && (snapIsWeak || snapStatus !== "succeeded")) {
    const snapJobRecord = snapshot?.job as StatusCardJobRecord | null | undefined;
    const jobMatches = snapJobRecord
      && `${snapJobRecord.job_id || snapshot?.jobId || ""}`.trim() === itemJob;
    const succeededJob: StatusCardJobRecord = jobMatches && snapJobRecord
      ? snapJobRecord
      : {
          job_id: itemJob,
          status: "succeeded",
          stage: "finished",
          stage_detail: (fallbackItem.stage_detail as string) || "Tác vụ hoàn thành",
          progress: {
            percent: 100,
            current: itemCurrent || 100,
            total: itemTotal || 100,
            unit: "percent",
          },
          timestamps: {
            started_at: (fallbackItem.created_at as string) || "",
            finished_at: (fallbackItem.updated_at as string) || "",
          },
        };
    return {
      ...snapshot!,
      jobId: itemJob,
      status: "succeeded",
      stageKey: "done",
      label: "Hoàn thành",
      value: "Đã tạo xong PDF dịch",
      detail: `${fallbackItem.stage_detail || "Tác vụ hoàn thành"}`.trim(),
      displayPercent: 100,
      progressPercent: 100,
      progressCurrent: Number.isFinite(itemCurrent) ? itemCurrent : 100,
      progressTotal: Number.isFinite(itemTotal) && itemTotal > 0 ? itemTotal : 100,
      progressFallbackText: "Hoàn thành",
      progressText: "Đã hoàn tất render",
      progressUnit: "percent",
      progressIndeterminate: false,
      visualStageKey: "done",
      cancelEnabled: false,
      readerReady: true,
      pdfReady: Boolean(fallbackItem.output_pdf_ready ?? true),
      job: succeededJob,
    };
  }

  if (itemStatus === "failed" && snapIsWeak) {
    return {
      ...snapshot!,
      jobId: itemJob,
      status: "failed",
      label: "Thất bại",
      value: "Tác vụ thất bại",
      detail: `${fallbackItem.stage_detail || ""}`.trim(),
      cancelEnabled: false,
    };
  }

  if ((itemStatus === "running" || itemStatus === "queued") && snapIsWeak) {
    return {
      ...snapshot!,
      jobId: itemJob,
      status: itemStatus,
      stageKey: snapshot?.stageKey || "ocr",
      label: snapshot?.label || (itemStatus === "queued" ? "Đang xếp hàng" : "Đang xử lý"),
      detail: `${fallbackItem.stage_detail || snapshot?.detail || ""}`.trim(),
      displayPercent: Number.isFinite(itemPercent) ? itemPercent : snapshot?.displayPercent ?? null,
      progressPercent: Number.isFinite(itemPercent) ? itemPercent : (snapshot?.progressPercent ?? NaN),
      progressCurrent: Number.isFinite(itemCurrent) ? itemCurrent : (snapshot?.progressCurrent ?? NaN),
      progressTotal: Number.isFinite(itemTotal) ? itemTotal : (snapshot?.progressTotal ?? NaN),
    };
  }

  return snapshot;
}

/** Dòng live thư viện có phải placeholder khung đầu của startPolling không (Dialog và
 *  tầng snapshot dùng chung) */
export function isPollingBootstrapPlaceholder(item: StatusCardFallbackItem = {}): boolean {
  const status = `${item.status || ""}`.trim();
  const detail = `${item.stage_detail || item.detail || ""}`;
  return status === "queued" && detail.includes("đang đọc trạng thái tác vụ");
}
