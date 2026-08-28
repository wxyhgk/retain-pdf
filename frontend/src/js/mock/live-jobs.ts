// Nhiệm vụ dịch mock có thể tiến triển: sau khi gửi, các giai đoạn sẽ hoàn thành theo thời gian.
// Hỗ trợ fromStage: khi nhấn "OCR lại/Dịch lại/Render lại", bắt đầu từ giai đoạn đó, các giai đoạn trước được coi là đã hoàn thành.

import type { JobLike } from "../job/types.js";

export type LiveMockFromStage = "upload" | "ocr" | "translate" | "render" | "translation";

export type LiveMockJobMeta = {
  jobId: string;
  documentId?: string;
  title?: string;
  pageCount?: number;
  startedAtMs: number;
  /** Tỷ lệ thời lượng tổng (1 = mặc định khoảng 16s chạy toàn bộ; khi fromStage chỉ chạy đoạn còn lại) */
  speed?: number;
  /**
   * Bắt đầu tiến triển từ giai đoạn nào.
   * - Bỏ trống / upload: toàn bộ dây chuyền
   * - ocr: bỏ qua hàng đợi, bắt đầu từ OCR
   * - translate: bỏ qua hàng đợi+OCR, bắt đầu từ dịch
   * - render: chỉ chạy render
   */
  fromStage?: LiveMockFromStage;
};

type PhaseKey = "upload" | "ocr" | "translate" | "render" | "done";

type PhaseDef = {
  key: PhaseKey;
  status: string;
  stage: string;
  displayStage: string;
  currentStage: string;
  detail: (p: { current: number; total: number; percent: number }) => string;
  durationMs: number;
  unit: string;
  total: number;
};

const PHASES: PhaseDef[] = [
  {
    key: "upload",
    status: "queued",
    stage: "queued",
    displayStage: "ocr",
    currentStage: "queued",
    durationMs: 1_500,
    unit: "none",
    total: 1,
    detail: () => "Đang đọc tài liệu và xếp hàng…",
  },
  {
    key: "ocr",
    status: "running",
    stage: "ocr_processing",
    displayStage: "ocr",
    currentStage: "ocr_processing",
    durationMs: 4_000,
    unit: "page",
    total: 12,
    detail: ({ current, total }) => `Đang thực hiện OCR, trang ${current}/${total}`,
  },
  {
    key: "translate",
    status: "running",
    stage: "translating",
    displayStage: "translation",
    currentStage: "translating",
    durationMs: 7_000,
    unit: "batch",
    total: 40,
    detail: ({ current, total }) => `Đang dịch nội dung chính, lô ${current}/${total}`,
  },
  {
    key: "render",
    status: "running",
    stage: "rendering",
    displayStage: "render",
    currentStage: "rendering",
    durationMs: 3_000,
    unit: "page",
    total: 12,
    detail: ({ current, total }) => `Đang render trang ${current}/${total}`,
  },
  {
    key: "done",
    status: "succeeded",
    stage: "finished",
    displayStage: "done",
    currentStage: "finished",
    durationMs: 0,
    unit: "none",
    total: 1,
    detail: () => "Xử lý hoàn thành, có thể đọc đối chiếu",
  },
];

const liveJobs = new Map<string, LiveMockJobMeta>();

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Tên API stage → phase của dây chuyền (done không phải điểm bắt đầu) */
export function normalizeLiveMockFromStage(stage?: string | null): PhaseKey {
  const value = `${stage || ""}`.trim().toLowerCase();
  if (!value || value === "upload" || value === "queued") return "upload";
  if (value === "ocr" || value === "ocr_processing") return "ocr";
  if (
    value === "translate"
    || value === "translation"
    || value === "translating"
  ) {
    return "translate";
  }
  if (value === "render" || value === "rendering") return "render";
  return "upload";
}

function phaseStartIndex(fromStage?: LiveMockFromStage | PhaseKey | string): number {
  const key = normalizeLiveMockFromStage(fromStage);
  const idx = PHASES.findIndex((p) => p.key === key);
  return idx >= 0 ? idx : 0;
}

/**
 * Tạo timeline: các phase trước fromStage có duration=0 (hoàn thành tức thời),
 * Bắt đầu tiến triển từ fromStage theo thời lượng bình thường.
 */
function phaseTimeline(speed = 1, fromStage?: LiveMockFromStage | PhaseKey | string) {
  const scale = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const startIdx = phaseStartIndex(fromStage);
  let cursor = 0;
  return PHASES.map((phase, index) => {
    // done luôn ở cuối; các phase không phải done trước from sẽ bỏ qua thời lượng
    const skip = index < startIdx && phase.key !== "done";
    const durationMs = skip ? 0 : Math.round(phase.durationMs / scale);
    const startMs = cursor;
    const endMs = cursor + durationMs;
    cursor = endMs;
    return {
      phase,
      startMs,
      endMs,
      durationMs,
      skipped: skip,
    };
  });
}

export function isLiveMockJobId(jobId?: string | null): boolean {
  const id = `${jobId || ""}`.trim();
  return Boolean(id && liveJobs.has(id));
}

export function getLiveMockJobMeta(jobId?: string | null): LiveMockJobMeta | null {
  const id = `${jobId || ""}`.trim();
  return id ? liveJobs.get(id) || null : null;
}

export function isLiveMockJobActive(jobId?: string | null, nowMs = Date.now()): boolean {
  const payload = buildLiveMockJobPayload(jobId, nowMs);
  if (!payload) return false;
  const status = `${payload.status || ""}`.trim();
  return status !== "succeeded" && status !== "failed" && status !== "canceled" && status !== "cancelled";
}

/* *
 * Đăng ký một nhiệm vụ có thể tiến triển. Trả về job_id.
 * fromStage: điểm vào lại, bắt đầu từ ocr / translate / render.
 */
export function registerLiveMockJob(meta: {
  jobId?: string;
  documentId?: string;
  title?: string;
  pageCount?: number;
  speed?: number;
  startedAtMs?: number;
  fromStage?: LiveMockFromStage | string;
} = {}): LiveMockJobMeta {
  const documentId = `${meta.documentId || ""}`.trim();
  const jobId = `${meta.jobId || ""}`.trim()
    || `mock-live-${documentId || "job"}-${Date.now().toString(36)}`;
  const fromStage = meta.fromStage
    ? (normalizeLiveMockFromStage(meta.fromStage) as LiveMockFromStage)
    : undefined;
  const record: LiveMockJobMeta = {
    jobId,
    documentId: documentId || undefined,
    title: meta.title,
    pageCount: meta.pageCount,
    startedAtMs: meta.startedAtMs ?? Date.now(),
    speed: meta.speed,
    fromStage,
  };
  liveJobs.set(jobId, record);
  return record;
}

export function resetLiveMockJobs() {
  liveJobs.clear();
}

export function listLiveMockJobIds(): string[] {
  return Array.from(liveJobs.keys());
}

export function buildLiveMockJobPayload(
  jobId?: string | null,
  nowMs = Date.now(),
): JobLike | null {
  const meta = getLiveMockJobMeta(jobId);
  if (!meta) return null;

  const elapsed = Math.max(0, nowMs - meta.startedAtMs);
  const timeline = phaseTimeline(meta.speed, meta.fromStage);
  const totalSpan = timeline[timeline.length - 1]?.endMs || 1;

  let active = timeline.find((slot) => elapsed < slot.endMs)
    || timeline[timeline.length - 1];

  if (elapsed >= totalSpan) {
    active = timeline[timeline.length - 1];
  }

  const phase = active.phase;
  const localElapsed = Math.max(0, elapsed - active.startMs);
  const localRatio = phase.key === "done"
    ? 1
    : active.durationMs > 0
      ? clamp01(localElapsed / active.durationMs)
      : 1;

  const total = Math.max(1, phase.total);
  const current = phase.key === "done"
    ? total
    : Math.max(1, Math.min(total, Math.ceil(localRatio * total) || 1));
  const percent = phase.key === "done"
    ? 100
    : Math.round(localRatio * 1000) / 10;

  const detail = phase.detail({ current, total, percent });
  const pageCount = Number(meta.pageCount) || 12;
  const title = `${meta.title || "Nhiệm vụ dịch mock"}`.trim() || "Nhiệm vụ dịch mock";

  // Lịch sử: các phase trước fromStage được đánh dấu là đã hoàn thành; hiện tại và sau đó theo thời gian
  const history = timeline
    .filter((slot) => slot.skipped || slot.startMs <= elapsed || slot.phase.key === phase.key)
    .map((slot) => {
      const finished = slot.skipped
        || slot.phase.key === "done"
        ? elapsed >= totalSpan
        : elapsed >= slot.endMs;
      const doneForHistory = slot.skipped || (slot.phase.key !== "done" && elapsed >= slot.endMs)
        || (slot.phase.key === "done" && elapsed >= totalSpan);
      return {
        stage: slot.phase.stage,
        detail: slot.phase.detail({
          current: doneForHistory ? slot.phase.total : current,
          total: slot.phase.total,
          percent: doneForHistory ? 100 : percent,
        }),
        enter_at: new Date(meta.startedAtMs + slot.startMs).toISOString(),
        exit_at: doneForHistory
          ? new Date(meta.startedAtMs + (slot.phase.key === "done" ? totalSpan : Math.max(slot.endMs, slot.startMs))).toISOString()
          : "",
        duration_ms: doneForHistory
          ? (slot.skipped ? 0 : (slot.phase.key === "done" ? 500 : slot.durationMs))
          : null,
        terminal_status: doneForHistory ? "completed" : "",
      };
    });

  const isDone = phase.key === "done" || elapsed >= totalSpan;

  return {
    job_id: meta.jobId,
    document_id: meta.documentId,
    workflow: "book",
    job_type: "book",
    title,
    display_name: title,
    source_file_name: `${title.replace(/\s+/g, "-").toLowerCase()}.pdf`,
    page_count: pageCount,
    status: isDone ? "succeeded" : phase.status,
    stage: isDone ? "finished" : phase.stage,
    display_stage: isDone ? "done" : phase.displayStage,
    substage: !isDone && phase.key === "translate" ? "translation_batches" : undefined,
    lane: "main",
    stage_detail: isDone ? "Xử lý hoàn thành, có thể đọc đối chiếu" : detail,
    progress: {
      unit: isDone || phase.unit === "none" ? undefined : phase.unit,
      current: isDone ? pageCount : current,
      total: isDone ? pageCount : total,
      percent: isDone ? 100 : percent,
    },
    background_stages: [],
    rerun_from_stage: meta.fromStage
      ? (meta.fromStage === "translate" ? "translation" : meta.fromStage)
      : undefined,
    timestamps: {
      created_at: new Date(meta.startedAtMs).toISOString(),
      updated_at: new Date(nowMs).toISOString(),
      started_at: new Date(meta.startedAtMs).toISOString(),
      finished_at: isDone ? new Date(meta.startedAtMs + totalSpan).toISOString() : "",
      duration_seconds: isDone ? Math.round(totalSpan / 1000) : null,
    },
    runtime: {
      current_stage: isDone ? "finished" : phase.currentStage,
      active_stage_elapsed_ms: Math.round(localElapsed),
      total_elapsed_ms: Math.round(elapsed),
      retry_count: meta.fromStage ? 1 : 0,
      terminal_reason: isDone ? "completed" : "",
      stage_history: history,
    },
    invocation: {
      input_protocol: "stage_spec",
      stage_spec_schema_version: "v1",
    },
    request_payload: {
      source: { upload_id: "mock-upload-id" },
      ocr: { provider: "paddle" },
      translation: { mode: "sci" },
      render: { render_mode: "auto" },
      rerun_from_stage: meta.fromStage
        ? (meta.fromStage === "translate" ? "translation" : meta.fromStage)
        : undefined,
    },
    actions: {
      cancel: {
        enabled: !isDone,
        url: "mock://cancel",
      },
      rerun: {
        enabled: false,
        method: "POST",
        url: "mock://rerun",
      },
      open_markdown: {
        enabled: isDone,
        url: "mock://markdown.json",
      },
      open_markdown_raw: {
        enabled: isDone,
        url: "mock://markdown.raw",
      },
      download_pdf: {
        enabled: isDone,
        url: "mock://translated.pdf",
      },
      download_bundle: {
        enabled: isDone,
        url: "mock://bundle.zip",
      },
    },
    artifacts: {
      pdf_ready: isDone,
      markdown_ready: isDone,
      bundle_ready: isDone,
      markdown: {
        ready: isDone,
        json_url: "mock://markdown.json",
        raw_url: "mock://markdown.raw",
        images_base_url: "mock://markdown/images/",
        file_name: "full.md",
        size_bytes: 1024,
      },
    },
    failure: null,
  } as JobLike;
}

export function buildLiveMockJobEvents(jobId?: string | null, nowMs = Date.now()) {
  const payload = buildLiveMockJobPayload(jobId, nowMs);
  if (!payload) return { items: [] as unknown[] };

  const progress = (payload.progress || {}) as {
    current?: number;
    total?: number;
    unit?: string;
  };
  const items = [
    {
      seq: 1,
      ts: payload.timestamps?.created_at || new Date(nowMs).toISOString(),
      level: "info",
      stage: payload.stage,
      stage_detail: payload.stage_detail,
      event_type: "stage_progress",
      event: "stage_progress",
      message: payload.stage_detail,
      progress_current: progress.current,
      progress_total: progress.total,
      progress_unit: progress.unit,
      display_stage: payload.display_stage,
      lane: "main",
      payload: {
        origin: "mock-live",
        job_id: payload.job_id,
        rerun_from_stage: (payload as { rerun_from_stage?: string }).rerun_from_stage,
      },
    },
  ];
  return { items };
}
