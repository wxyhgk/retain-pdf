// sync — 多设备同步：状态、设置、立即同步（GET/PUT /api/v1/sync、POST /api/v1/sync/run）。
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

export type SyncPendingItem = { kind: string; key: string; reason: string; attempts: number };
export type SyncPeer = { device_id: string; name: string; segments_read: number };

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

async function readSyncResponse(resp: Response, action: string): Promise<SyncStatus> {
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
  return unwrapEnvelope(await resp.json()) as SyncStatus;
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
