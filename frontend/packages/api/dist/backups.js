// backups — 数据库备份：列表、立即备份、恢复、删除
// （GET/POST /api/v1/backups、POST /api/v1/backups/{id}/restore、DELETE /api/v1/backups/{id}）。
import { apiFetch } from "./internal/runtime.js";
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
async function readEnvelope(resp, action) {
    if (!resp.ok) {
        let message = "";
        try {
            const body = await resp.json();
            message = `${body?.message || body?.error?.message || ""}`.trim();
        }
        catch {
            message = "";
        }
        throw new Error(message || `${action}失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchBackupStatus(apiPrefix) {
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, "backups"), { headers: buildApiHeaders() });
    return readEnvelope(resp, "读取备份");
}
/** 立即备份一份，等它存完。 */
export async function createBackup(apiPrefix) {
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, "backups"), {
        method: "POST",
        headers: buildApiHeaders(),
    });
    return readEnvelope(resp, "备份");
}
/** 用一份备份替换当前书库数据库；有任务在跑时后端拒绝（409，带原因）。 */
export async function restoreBackup(apiPrefix, backupId) {
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `backups/${encodeURIComponent(backupId)}/restore`), {
        method: "POST",
        headers: buildApiHeaders(),
    });
    return readEnvelope(resp, "恢复");
}
export async function deleteBackup(apiPrefix, backupId) {
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `backups/${encodeURIComponent(backupId)}`), {
        method: "DELETE",
        headers: buildApiHeaders(),
    });
    return readEnvelope(resp, "删除备份");
}
