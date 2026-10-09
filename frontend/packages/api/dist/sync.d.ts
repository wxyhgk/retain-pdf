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
export type SyncStatus = {
    enabled: boolean;
    folder: string | null;
    sync_root: string | null;
    device_id: string | null;
    device_name: string;
    running: boolean;
    interval_seconds: number;
    last_run: SyncRun | null;
    pending_total: number;
    pending: SyncPendingItem[];
    peers: SyncPeer[];
};
export type SyncSettingsInput = {
    enabled?: boolean;
    folder?: string;
    device_name?: string;
};
export declare function fetchSyncStatus(apiPrefix?: string): Promise<SyncStatus>;
export declare function updateSyncSettings(apiPrefix: string | undefined, payload: SyncSettingsInput): Promise<SyncStatus>;
export declare function runSyncNow(apiPrefix?: string): Promise<SyncStatus>;
