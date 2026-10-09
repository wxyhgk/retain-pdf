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
export declare function fetchBackupStatus(apiPrefix?: string): Promise<BackupStatus>;
/** 立即备份一份，等它存完。 */
export declare function createBackup(apiPrefix?: string): Promise<BackupItem>;
/** 用一份备份替换当前书库数据库；有任务在跑时后端拒绝（409，带原因）。 */
export declare function restoreBackup(apiPrefix: string | undefined, backupId: string): Promise<BackupRestoreResult>;
export declare function deleteBackup(apiPrefix: string | undefined, backupId: string): Promise<BackupStatus>;
