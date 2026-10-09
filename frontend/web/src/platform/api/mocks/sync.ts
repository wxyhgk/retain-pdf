// 模拟模式下的同步:内存里的一份状态,开关、文件夹、立即同步都能点。
const state = {
  enabled: false,
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
  if (typeof payload?.enabled === "boolean") {
    if (payload.enabled && !state.folder) throw new Error("请先选择同步文件夹");
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
