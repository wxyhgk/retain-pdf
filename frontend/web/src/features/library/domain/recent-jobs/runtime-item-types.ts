// recent-jobs 卡片运行时形状（纯类型，无逻辑）。
//
// 书架里「一本书」只有一个类型：platform/contracts/library-payloads 的 LibraryCardItem。
// 这里以前另抄了一份 LibraryJobItem（连同进度 / 运行时状态 / 阶段快照），字段几乎一样
// 却互不兼容（background_stages 一边 unknown[]、一边有类型），引擎和界面之间处处要 any。

import type { AdaptedStageSnapshot } from "@retainpdf/domain/job-status";
import type {
  LibraryCardItem,
  LibraryProgress,
  LibraryRuntimeStatus,
} from "@/platform/contracts/library-payloads.js";

export type StageProgress = LibraryProgress;
export type StageSnapshot = LibraryRuntimeStatus;
export type RuntimeStatus = LibraryRuntimeStatus;

/** 图书馆 / recent-jobs 卡片条目(运行时合并态)——就是 LibraryCardItem。 */
export type LibraryJobItem = LibraryCardItem;

export interface StageAdapterPort {
  /** 就是 @retainpdf/domain/job-status 的 adaptJobStageSnapshot。 */
  adaptJobStageSnapshot?: (job: LibraryJobItem) => AdaptedStageSnapshot | null | undefined;
}

export interface RuntimeItemOptions {
  stageAdapterPort?: StageAdapterPort;
}
