// 轮询占位判定：startPolling 首帧占位是 jobs 领域的规则，故落在本功能 domain/。
// 同功能内（merge-snapshot-with-fallback）用相对路径引用；跨功能（book-detail）
// 经 @/features/jobs/index.js 出口，不产生 feature 间的深层耦合。

export type PollingPlaceholderItem = {
  status?: string;
  stage_detail?: string;
  detail?: string;
  [key: string]: unknown;
};

/** 书架 live 行是否为 startPolling 首帧占位（Dialog 层与 snapshot 层共用） */
export function isPollingBootstrapPlaceholder(item: PollingPlaceholderItem = {}): boolean {
  const status = `${item.status || ""}`.trim();
  const detail = `${item.stage_detail || item.detail || ""}`;
  return status === "queued" && detail.includes("正在读取任务状态");
}
