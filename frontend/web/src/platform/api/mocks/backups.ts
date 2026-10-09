// 模拟模式下的备份:内存里的一张备份列表,立即备份、恢复、删除都能点。
function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(".", "");
}

function item(kind: string, hoursAgo: number) {
  const at = new Date(Date.now() - hoursAgo * 3600_000);
  return { id: `${kind}-${stamp(at)}-v19`, kind, created_at: at.toISOString(), schema_version: 19, bytes: 9_600_000 };
}

const state = {
  dir: "~/Library/Application Support/RetainPDF/data/backups/db",
  auto_interval_hours: 24,
  running: false,
  restore_blockers: [] as string[],
  items: [item("auto", 3), item("auto", 27), item("manual", 50)],
};

function snapshot() {
  const lastAuto = state.items.find((b) => b.kind === "auto");
  return { ...state, last_auto_at: lastAuto ? lastAuto.created_at : null, items: [...state.items] };
}

export async function fetchBackupStatus(apiPrefix?: string) {
  void apiPrefix;
  return snapshot();
}

export async function createBackup(apiPrefix?: string) {
  void apiPrefix;
  const made = item("manual", 0);
  state.items.unshift(made);
  return made;
}

export async function restoreBackup(apiPrefix: string | undefined, backupId: string) {
  void apiPrefix;
  if (!state.items.some((b) => b.id === backupId)) throw new Error("没有这份备份");
  const safety = item("before-restore", 0);
  state.items.unshift(safety);
  return { restored: backupId, safety_backup: safety.id, status: snapshot() };
}

export async function deleteBackup(apiPrefix: string | undefined, backupId: string) {
  void apiPrefix;
  state.items = state.items.filter((b) => b.id !== backupId);
  return snapshot();
}
