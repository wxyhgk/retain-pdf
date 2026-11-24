// 生成文件，不要手改。来源：contracts/platform-settings.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  BackupItemView,
  BackupRestoreView,
  BackupStatusView,
  FontListView,
  SyncSettingsInput,
  SyncStatusView,
  SyncTestView,
} from "@retainpdf/contracts/platform-settings";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/fonts */
export function listFonts(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<FontListView> {
  return request<FontListView>({ apiPrefix, method: "GET", path: `fonts`, options });
}

/** GET /api/v1/sync */
export function getSyncStatus(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<SyncStatusView> {
  return request<SyncStatusView>({ apiPrefix, method: "GET", path: `sync`, options });
}

/** PUT /api/v1/sync */
export function updateSyncSettings(
  apiPrefix: string | undefined,
  args: { body: SyncSettingsInput },
  options?: RequestOptions,
): Promise<SyncStatusView> {
  return request<SyncStatusView>({ apiPrefix, method: "PUT", path: `sync`, body: args.body, options });
}

/** POST /api/v1/sync/run */
export function runSyncNow(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<SyncStatusView> {
  return request<SyncStatusView>({ apiPrefix, method: "POST", path: `sync/run`, options });
}

/** POST /api/v1/sync/test */
export function testSyncTarget(
  apiPrefix: string | undefined,
  args: { body: SyncSettingsInput },
  options?: RequestOptions,
): Promise<SyncTestView> {
  return request<SyncTestView>({ apiPrefix, method: "POST", path: `sync/test`, body: args.body, options });
}

/** GET /api/v1/backups */
export function getBackupStatus(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<BackupStatusView> {
  return request<BackupStatusView>({ apiPrefix, method: "GET", path: `backups`, options });
}

/** POST /api/v1/backups */
export function createBackup(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<BackupItemView> {
  return request<BackupItemView>({ apiPrefix, method: "POST", path: `backups`, options });
}

/** DELETE /api/v1/backups/:backup_id */
export function deleteBackup(
  apiPrefix: string | undefined,
  args: { backup_id: string },
  options?: RequestOptions,
): Promise<BackupStatusView> {
  return request<BackupStatusView>({ apiPrefix, method: "DELETE", path: `backups/${encodePathParam(args.backup_id)}`, options });
}

/** POST /api/v1/backups/:backup_id/restore */
export function restoreBackup(
  apiPrefix: string | undefined,
  args: { backup_id: string },
  options?: RequestOptions,
): Promise<BackupRestoreView> {
  return request<BackupRestoreView>({ apiPrefix, method: "POST", path: `backups/${encodePathParam(args.backup_id)}/restore`, options });
}
