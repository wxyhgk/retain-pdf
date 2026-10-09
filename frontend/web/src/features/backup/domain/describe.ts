// 备份 -> 给人看的文字。纯函数，单测直接覆盖。

export type BackupItemLike = { kind?: string; created_at?: string; bytes?: number };

const KIND_LABELS: Record<string, string> = {
  auto: "自动",
  manual: "手动",
  "before-restore": "恢复前",
  "before-upgrade": "升级前",
};

export function kindLabel(kind: string | undefined): string {
  return KIND_LABELS[kind || ""] || kind || "";
}

/** 「10月9日 14:05」；不是今年的带上年份。 */
export function backupTime(iso: string | undefined, now: number = Date.now()): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  const date = new Date(at);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const year = date.getFullYear() === new Date(now).getFullYear() ? "" : `${date.getFullYear()}年`;
  return `${year}${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatSize(bytes: number | undefined): string {
  const value = Math.max(0, bytes || 0);
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

/** 自动备份的一句话说明。 */
export function describeAuto(intervalHours: number | undefined, lastAutoAt: string | null | undefined, now: number = Date.now()): string {
  if (!intervalHours) return "自动备份已关闭。";
  const every = intervalHours === 24 ? "每天" : intervalHours % 24 === 0 ? `每 ${intervalHours / 24} 天` : `每 ${intervalHours} 小时`;
  const last = lastAutoAt ? `上次是 ${backupTime(lastAutoAt, now)}。` : "还没有自动备份过。";
  return `${every}自动备份一次，${last}`;
}
