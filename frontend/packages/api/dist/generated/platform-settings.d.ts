import type { BackupItemView, BackupRestoreView, BackupStatusView, FontListView, SyncSettingsInput, SyncStatusView, SyncTestView } from "@retainpdf/contracts/platform-settings";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/fonts */
export declare function listFonts(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<FontListView>;
/** GET /api/v1/sync */
export declare function getSyncStatus(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<SyncStatusView>;
/** PUT /api/v1/sync */
export declare function updateSyncSettings(apiPrefix: string | undefined, args: {
    body: SyncSettingsInput;
}, options?: RequestOptions): Promise<SyncStatusView>;
/** POST /api/v1/sync/run */
export declare function runSyncNow(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<SyncStatusView>;
/** POST /api/v1/sync/test */
export declare function testSyncTarget(apiPrefix: string | undefined, args: {
    body: SyncSettingsInput;
}, options?: RequestOptions): Promise<SyncTestView>;
/** GET /api/v1/backups */
export declare function getBackupStatus(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<BackupStatusView>;
/** POST /api/v1/backups */
export declare function createBackup(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<BackupItemView>;
/** DELETE /api/v1/backups/:backup_id */
export declare function deleteBackup(apiPrefix: string | undefined, args: {
    backup_id: string;
}, options?: RequestOptions): Promise<BackupStatusView>;
/** POST /api/v1/backups/:backup_id/restore */
export declare function restoreBackup(apiPrefix: string | undefined, args: {
    backup_id: string;
}, options?: RequestOptions): Promise<BackupRestoreView>;
