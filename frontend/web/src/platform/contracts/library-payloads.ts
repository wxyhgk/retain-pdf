// 书架卡片与任务提交的纯载荷型别。
//
// 原先定义在 `features/library/domain/types.ts`，但 `platform/mock/*` 与
// `platform/api/legacy/documents.ts` 都要 `import type` 它们——那是
// `platform → features`，方向反了（C3 的四层门禁会拦）。
//
// 这两个型别是后端返回值的形状描述，不含任何行为，本就属于跨功能契约。
// 下沉到这里，`features/library` 侧改为 re-export，消费方无需改动。
// 型别擦除，运行时零影响。

/** job 进度条（top-level progress 或 runtime_status.progress） */
export type LibraryProgress = {
  current?: number | null;
  total?: number | null;
  percent?: number | null;
  unit?: string | null;
  [key: string]: unknown;
};
/** 运行时状态快照（轮询 / stage adapter 写入） */
export type LibraryRuntimeStatus = {
  stageKey?: string;
  publicStage?: string;
  source?: string;
  lane?: string;
  substage?: string;
  detail?: string;
  progress?: LibraryProgress;
  [key: string]: unknown;
};
/** background lane 合并时附带的阶段片段 */
export type LibraryBackgroundStage = {
  display_stage?: string;
  stage?: string;
  substage?: string;
  lane?: string;
  progress?: LibraryProgress;
  stage_detail?: string;
  [key: string]: unknown;
};

/** book 载荷上的摘要（merge 时回填 source_file_name / page_count） */
export type LibraryBookSummary = {
  source_file_name?: string;
  page_count?: number | null;
  title?: string;
  [key: string]: unknown;
};

export type LibraryCardItem = {
  // 身份
  job_id?: string;
  id?: string;
  document_id?: string;
  active_job_id?: string;
  library_only?: boolean;
  /** 打开详情时优先落在「翻译」Tab（进度在 Tab 内，不弹工作流窗） */
  prefer_translate_tab?: boolean;

  // 展示
  title?: string;
  display_name?: string;
  source_file_name?: string;
  page_count?: number | null;
  cover_url?: string;
  thumbnail_url?: string;
  updated_at?: string;
  created_at?: string;
  added_at?: string;
  last_opened_at?: string | null;

  // 文档元数据
  reading_status?: string;
  tags?: string[];
  source_pdf_url?: string;
  bytes?: number | null;

  // job 状态 / stage
  status?: string;
  stage?: string;
  display_stage?: string;
  substage?: string;
  lane?: string;
  stage_detail?: string;
  progress?: LibraryProgress;
  runtime_status?: LibraryRuntimeStatus;
  background_stages?: LibraryBackgroundStage[];
  stage_snapshot?: LibraryRuntimeStatus;
  book_summary?: LibraryBookSummary;
  workflow?: string;
  job_type?: string;

  // runtime merge / API 可能附带额外字段
  [key: string]: unknown;
};

export type JobSubmissionView = {
  job_id?: string;
  id?: string;
  document_id?: string;
  status?: string;
  workflow?: string;
  ocr_reused?: boolean;
  source_artifact_job_id?: string;
  stages?: {
    ocr?: { state?: string; [key: string]: unknown };
    translation?: { state?: string; [key: string]: unknown };
    render?: { state?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
