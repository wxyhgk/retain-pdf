export type SyncRun = {
    started_at: string;
    finished_at: string;
    ok: boolean;
    error: string | null;
    exported: number;
    applied: number;
    deleted: number;
    files_uploaded: number;
    files_downloaded: number;
    rejected: number;
    folder_changed: boolean;
    device_renewed: boolean;
};
/** 最近一次整理同步文件夹（默认每天最多一次）。 */
export type SyncMaintenance = {
    at: string;
    segments_compacted: number;
    packs_retired: number;
    packs_deleted: number;
    bytes_freed: number;
    bytes_repacked: number;
    error: string | null;
};
export type SyncPendingItem = {
    kind: string;
    key: string;
    reason: string;
    attempts: number;
};
export type SyncPeer = {
    device_id: string;
    name: string;
    segments_read: number;
};
export type SyncTransport = "folder" | "webdav";
export type SyncStatus = {
    enabled: boolean;
    transport: SyncTransport;
    webdav_url: string | null;
    webdav_username: string | null;
    /** 密码只写不读：这里只告诉有没有保存过。 */
    webdav_has_password: boolean;
    folder: string | null;
    sync_root: string | null;
    device_id: string | null;
    device_name: string;
    running: boolean;
    interval_seconds: number;
    last_run: SyncRun | null;
    last_maintenance: SyncMaintenance | null;
    pending_total: number;
    pending: SyncPendingItem[];
    peers: SyncPeer[];
};
export type SyncSettingsInput = {
    enabled?: boolean;
    transport?: SyncTransport;
    folder?: string;
    device_name?: string;
    webdav_url?: string;
    webdav_username?: string;
    /** 给了就保存（空串清除）；不给保持原样。 */
    webdav_password?: string;
};
export type SyncTestResult = {
    ok: boolean;
    location: string;
    latency_ms: number | null;
    error: string | null;
};
export declare function fetchSyncStatus(apiPrefix?: string): Promise<SyncStatus>;
export declare function updateSyncSettings(apiPrefix: string | undefined, payload: SyncSettingsInput): Promise<SyncStatus>;
export declare function runSyncNow(apiPrefix?: string): Promise<SyncStatus>;
/** 用填的设置（没给的用已保存的）测一次能不能读写；不保存设置。 */
export declare function testSyncTarget(apiPrefix: string | undefined, payload: SyncSettingsInput): Promise<SyncTestResult>;
