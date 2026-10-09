// sync — 多设备同步：状态、设置、立即同步、测试连接
// （GET/PUT /api/v1/sync、POST /api/v1/sync/run、POST /api/v1/sync/test）。
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
async function readSyncResponse(resp, action) {
    return readEnvelope(resp, action);
}
export async function fetchSyncStatus(apiPrefix) {
    const resp = await fetch(buildApiEndpoint(apiPrefix, "sync"), { headers: buildApiHeaders() });
    return readSyncResponse(resp, "读取同步状态");
}
export async function updateSyncSettings(apiPrefix, payload) {
    const resp = await fetch(buildApiEndpoint(apiPrefix, "sync"), {
        method: "PUT",
        headers: buildApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    return readSyncResponse(resp, "保存同步设置");
}
export async function runSyncNow(apiPrefix) {
    const resp = await fetch(buildApiEndpoint(apiPrefix, "sync/run"), {
        method: "POST",
        headers: buildApiHeaders(),
    });
    return readSyncResponse(resp, "同步");
}
/** 用填的设置（没给的用已保存的）测一次能不能读写；不保存设置。 */
export async function testSyncTarget(apiPrefix, payload) {
    const resp = await fetch(buildApiEndpoint(apiPrefix, "sync/test"), {
        method: "POST",
        headers: buildApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    return readEnvelope(resp, "测试连接");
}
