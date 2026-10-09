// 模拟模式下的同步:内存里的一份状态,开关、文件夹、立即同步都能点。
const state = {
  enabled: false,
  transport: "folder",
  webdav_url: null as string | null,
  webdav_username: null as string | null,
  webdav_has_password: false,
  folder: null as string | null,
  sync_root: null as string | null,
  device_id: "0123456789abcdef",
  device_name: "这台电脑",
  running: false,
  interval_seconds: 60,
  last_run: null as Record<string, unknown> | null,
  pending_total: 0,
  pending: [] as unknown[],
  peers: [{ device_id: "fedcba9876543210", name: "办公室的 Mac", segments_read: 12 }],
};

export async function fetchSyncStatus(apiPrefix?) {
  void apiPrefix;
  return { ...state };
}

export async function updateSyncSettings(apiPrefix, payload) {
  void apiPrefix;
  if (typeof payload?.folder === "string") {
    state.folder = payload.folder.trim() || null;
    state.sync_root = state.folder ? `${state.folder}/RetainPDF-Sync` : null;
  }
  if (typeof payload?.device_name === "string") state.device_name = payload.device_name;
  if (payload?.transport === "folder" || payload?.transport === "webdav") state.transport = payload.transport;
  if (typeof payload?.webdav_url === "string") state.webdav_url = payload.webdav_url.trim() || null;
  if (typeof payload?.webdav_username === "string") state.webdav_username = payload.webdav_username.trim() || null;
  if (typeof payload?.webdav_password === "string") state.webdav_has_password = Boolean(payload.webdav_password);
  if (state.transport === "webdav") state.sync_root = state.webdav_url;
  if (typeof payload?.enabled === "boolean") {
    if (payload.enabled && !(state.transport === "webdav" ? state.webdav_url : state.folder)) {
      throw new Error(state.transport === "webdav" ? "请先填写 WebDAV 地址" : "请先选择同步文件夹");
    }
    state.enabled = payload.enabled;
  }
  return { ...state };
}

export async function runSyncNow(apiPrefix?) {
  void apiPrefix;
  if (!state.enabled) throw new Error("同步没有开启");
  const now = new Date().toISOString();
  state.last_run = {
    started_at: now, finished_at: now, ok: true, error: null,
    exported: 0, applied: 3, deleted: 0, files_uploaded: 0, files_downloaded: 5,
    rejected: 0, folder_changed: false, device_renewed: false,
  };
  return { ...state };
}

export async function testSyncTarget(apiPrefix, payload) {
  void apiPrefix;
  const location = `${payload?.webdav_url || payload?.folder || state.webdav_url || state.folder || ""}`;
  if (!location) return { ok: false, location: "", latency_ms: null, error: "还没有填写同步位置" };
  return { ok: true, location, latency_ms: 420, error: null };
}
