// 生成文件，不要手改。来源：contracts/platform-settings.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/fonts */
export function listFonts(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `fonts`, options });
}
/** GET /api/v1/sync */
export function getSyncStatus(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `sync`, options });
}
/** PUT /api/v1/sync */
export function updateSyncSettings(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PUT", path: `sync`, body: args.body, options });
}
/** POST /api/v1/sync/run */
export function runSyncNow(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "POST", path: `sync/run`, options });
}
/** POST /api/v1/sync/test */
export function testSyncTarget(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `sync/test`, body: args.body, options });
}
/** GET /api/v1/backups */
export function getBackupStatus(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `backups`, options });
}
/** POST /api/v1/backups */
export function createBackup(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "POST", path: `backups`, options });
}
/** DELETE /api/v1/backups/:backup_id */
export function deleteBackup(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `backups/${encodePathParam(args.backup_id)}`, options });
}
/** POST /api/v1/backups/:backup_id/restore */
export function restoreBackup(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `backups/${encodePathParam(args.backup_id)}/restore`, options });
}
