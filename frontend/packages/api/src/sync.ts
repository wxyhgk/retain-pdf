// sync — 多设备同步：状态、设置、立即同步、测试连接
// （GET/PUT /api/v1/sync、POST /api/v1/sync/run、POST /api/v1/sync/test）。
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

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

export type SyncPendingItem = { kind: string; key: string; reason: string; attempts: number };
export type SyncPeer = { device_id: string; name: string; segments_read: number };

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

async function readSyncResponse(resp: Response, action: string): Promise<SyncStatus> {
  return readEnvelope<SyncStatus>(resp, action);
}

export async function fetchSyncStatus(apiPrefix?: string): Promise<SyncStatus> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "sync"), { headers: buildApiHeaders() });
  return readSyncResponse(resp, "读取同步状态");
}

export async function updateSyncSettings(apiPrefix: string | undefined, payload: SyncSettingsInput): Promise<SyncStatus> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "sync"), {
    method: "PUT",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readSyncResponse(resp, "保存同步设置");
}

export async function runSyncNow(apiPrefix?: string): Promise<SyncStatus> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "sync/run"), {
    method: "POST",
    headers: buildApiHeaders(),
  });
  return readSyncResponse(resp, "同步");
}

/** 用填的设置（没给的用已保存的）测一次能不能读写；不保存设置。 */
export async function testSyncTarget(apiPrefix: string | undefined, payload: SyncSettingsInput): Promise<SyncTestResult> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "sync/test"), {
    method: "POST",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readEnvelope<SyncTestResult>(resp, "测试连接");
}
