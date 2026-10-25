// 「任务跑完时通知我」的开关，以及通知上写什么（纯逻辑，不碰 React）。

import type { FinishedJob } from "./job-finish-watcher.js";

const STORAGE_KEY = "retainpdf.notify.job-finished.v1";

/** 默认开着：桌面版不用授权；网页版还要用户点一次「允许」，没允许就只在页面里提示。 */
export function readJobFinishNotifyEnabled(storage?: Pick<Storage, "getItem">): boolean {
  try {
    const store = storage ?? globalThis.localStorage;
    return store?.getItem(STORAGE_KEY) !== "0";
  } catch {
    // 隐私模式 / 禁用站点数据时读写都会抛：按默认开着算。
    return true;
  }
}

export function writeJobFinishNotifyEnabled(enabled: boolean, storage?: Pick<Storage, "setItem">): void {
  try {
    const store = storage ?? globalThis.localStorage;
    store?.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // 存不下就算了，这次打开期间照样按用户刚选的来。
  }
}

function workflowLabel(workflow: string) {
  if (workflow === "ocr") return "识别";
  if (workflow === "render") return "排版";
  return "翻译";
}

export function jobFinishedTitle(job: FinishedJob): string {
  const what = workflowLabel(job.workflow);
  return job.status === "succeeded" ? `${what}完成` : `${what}失败`;
}

export function jobFinishedBody(job: FinishedJob): string {
  return job.note ? `${job.title}\n${job.note}` : job.title;
}

/** 页面在后台时标签页标题前面加的记号；回到页面就去掉。 */
export function titleWithFinishMark(baseTitle: string, counts: { succeeded: number; failed: number }): string {
  const parts: string[] = [];
  if (counts.succeeded) parts.push(`✓${counts.succeeded > 1 ? counts.succeeded : ""}`);
  if (counts.failed) parts.push(`✗${counts.failed > 1 ? counts.failed : ""}`);
  return parts.length ? `(${parts.join(" ")}) ${baseTitle}` : baseTitle;
}
