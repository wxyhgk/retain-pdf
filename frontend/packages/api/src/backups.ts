// backups — 数据库备份：列表、立即备份、恢复、删除
// （GET/POST /api/v1/backups、POST /api/v1/backups/{id}/restore、DELETE /api/v1/backups/{id}）。
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

/** auto：每天自动；manual：手动；before-restore：恢复前自动存的；before-upgrade：升级前自动存的。 */
export type BackupKind = "auto" | "manual" | "before-restore" | "before-upgrade";

export type BackupItem = {
  id: string;
  kind: BackupKind;
  created_at: string;
  schema_version: number;
  /** 压缩后的大小。 */
  bytes: number;
};

export type BackupStatus = {
  dir: string;
  /** 0 表示关掉了自动备份。 */
  auto_interval_hours: number;
  last_auto_at: string | null;
  running: boolean;
  /** 现在恢复的话要先等什么；空表示可以恢复。 */
  restore_blockers: string[];
  /** 新的在前。 */
  items: BackupItem[];
};

export type BackupRestoreResult = {
  restored: string;
  /** 恢复前自动存的那份（恢复错了用它退回）。 */
  safety_backup: string;
  status: BackupStatus;
};

async function readEnvelope<T>(resp: Response, action: string): Promise<T> {
  if (!resp.ok) {
    let message = "";
    try {
      const body = await resp.json();
      message = `${body?.message || body?.error?.message || ""}`.trim();
    } catch {
      message = "";
    }
    throw new Error(message || `${action}失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json()) as T;
}

export async function fetchBackupStatus(apiPrefix?: string): Promise<BackupStatus> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "backups"), { headers: buildApiHeaders() });
  return readEnvelope<BackupStatus>(resp, "读取备份");
}

/** 立即备份一份，等它存完。 */
export async function createBackup(apiPrefix?: string): Promise<BackupItem> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "backups"), {
    method: "POST",
    headers: buildApiHeaders(),
  });
  return readEnvelope<BackupItem>(resp, "备份");
}

/** 用一份备份替换当前书库数据库；有任务在跑时后端拒绝（409，带原因）。 */
export async function restoreBackup(apiPrefix: string | undefined, backupId: string): Promise<BackupRestoreResult> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, `backups/${encodeURIComponent(backupId)}/restore`), {
    method: "POST",
    headers: buildApiHeaders(),
  });
  return readEnvelope<BackupRestoreResult>(resp, "恢复");
}

export async function deleteBackup(apiPrefix: string | undefined, backupId: string): Promise<BackupStatus> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, `backups/${encodeURIComponent(backupId)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  return readEnvelope<BackupStatus>(resp, "删除备份");
}
