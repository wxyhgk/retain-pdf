// 同步状态 -> 给人看的文字。纯函数，单测直接覆盖。

export type SyncRunLike = {
  finished_at?: string;
  ok?: boolean;
  error?: string | null;
  exported?: number;
  applied?: number;
  deleted?: number;
  folder_changed?: boolean;
  device_renewed?: boolean;
};

export type SyncStatusLike = {
  enabled?: boolean;
  folder?: string | null;
  running?: boolean;
  last_run?: SyncRunLike | null;
  pending_total?: number;
  pending?: Array<{ reason?: string }>;
};

/** 「刚刚」「3 分钟前」「2 小时前」「10月8日 14:05」。 */
export function relativeTime(iso: string | undefined, now: number = Date.now()): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "刚刚";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const date = new Date(at);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 一句话状态与色调。 */
export function describeSyncStatus(status: SyncStatusLike | null, now: number = Date.now()): {
  tone: "off" | "ok" | "busy" | "error";
  headline: string;
  detail: string;
} {
  if (!status) return { tone: "off", headline: "正在读取同步状态…", detail: "" };
  if (!status.enabled) {
    return {
      tone: "off",
      headline: "同步未开启",
      detail: status.folder ? "已选好文件夹，开启后开始同步。" : "选一个网盘文件夹，再开启同步。",
    };
  }
  if (status.running) return { tone: "busy", headline: "正在同步…", detail: "" };
  const run = status.last_run;
  if (!run) return { tone: "busy", headline: "已开启，即将开始第一次同步", detail: "" };
  const when = relativeTime(run.finished_at, now);
  if (!run.ok) {
    return { tone: "error", headline: `同步出错${when ? `（${when}）` : ""}`, detail: `${run.error || "未知错误"}` };
  }
  const parts: string[] = [];
  if (run.applied) parts.push(`收到 ${run.applied} 项`);
  if (run.exported) parts.push(`发出 ${run.exported} 项`);
  const notes: string[] = [];
  if (run.folder_changed) notes.push("换了同步文件夹，已把本机书库重新放进去。");
  if (run.device_renewed) notes.push("检测到数据是从别的电脑复制来的，这台电脑已作为新设备加入。");
  return {
    tone: "ok",
    headline: `已同步${when ? ` · ${when}` : ""}`,
    detail: [parts.length ? parts.join("，") + "。" : "没有新的变化。", ...notes].join(""),
  };
}

/** 等待区的说明。 */
export function describePending(status: SyncStatusLike | null): string {
  const total = status?.pending_total || 0;
  if (!total) return "";
  const reasons = (status?.pending || []).map((item) => `${item.reason || ""}`);
  const waitingFiles = reasons.filter((r) => r.startsWith("waiting for") && r.includes("file")).length;
  const runningHere = reasons.filter((r) => r.includes("running on this device")).length;
  if (runningHere && runningHere === reasons.length) {
    return `有 ${total} 项要等这台电脑上正在运行的任务结束后再合并。`;
  }
  if (waitingFiles && waitingFiles === reasons.length) {
    return `有 ${total} 项在等网盘把文件下载到这台电脑，下载完会自动补上。`;
  }
  return `有 ${total} 项在等相关的文件或书同步过来，到了会自动补上。`;
}
