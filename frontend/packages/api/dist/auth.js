// auth — pure：单机 / 多用户的会话、登录、退出、改密码、页数额度，以及管理员的账号管理。
// 多用户模式下浏览器靠 HttpOnly Cookie（retain_session）认证，apiFetch 会带上凭据。
import { apiFetch, buildApiHeaders, buildApiUrl, setApiAuthMode, unwrapEnvelope } from "./internal/runtime.js";
/** 后端的错误码带出来，界面按码说人话（INVALID_CREDENTIALS / ACCOUNT_DISABLED / TOO_MANY_ATTEMPTS …）。 */
export class AuthRequestError extends Error {
    status;
    code;
    details;
    constructor(message, status, code, details = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = "AuthRequestError";
    }
}
async function request(method, path, body, apiPrefix) {
    const response = await apiFetch(buildApiUrl(apiPrefix ?? "/api/v1", path), {
        method,
        headers: buildApiHeaders(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new AuthRequestError(payload?.message || `请求失败（${response.status}）`, response.status, `${payload?.error?.code || payload?.code || ""}`, (payload?.error?.details && typeof payload.error.details === "object") ? payload.error.details : {});
    }
    return unwrapEnvelope(payload);
}
export function fetchAuthSession(apiPrefix) {
    return request("GET", "auth/session", undefined, apiPrefix);
}
/**
 * 页面启动时先调它：先不带凭据问一次模式（单机模式的跨域不允许带凭据），是多用户就切到带 Cookie
 * 再问一次登录状态。之后本包所有请求都按这个模式发。
 */
export async function resolveAuthSession(apiPrefix) {
    setApiAuthMode("single");
    const first = await fetchAuthSession(apiPrefix);
    if (first?.mode !== "multi")
        return { mode: "single", authenticated: true, user: first?.user ?? null };
    setApiAuthMode("multi");
    return fetchAuthSession(apiPrefix);
}
export function login(username, password, apiPrefix) {
    return request("POST", "auth/login", { username, password }, apiPrefix);
}
export function logout(apiPrefix) {
    return request("POST", "auth/logout", {}, apiPrefix);
}
export function changePassword(currentPassword, newPassword, apiPrefix) {
    return request("POST", "auth/password", { current_password: currentPassword, new_password: newPassword }, apiPrefix);
}
function queryString(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "")
            continue;
        search.set(key, `${value}`);
    }
    const text = search.toString();
    return text ? `?${text}` : "";
}
/** total 是符合条件的总数；老后端没有 total。 */
export function listAdminUsers(query = {}, apiPrefix) {
    return request("GET", `admin/users${queryString(query)}`, undefined, apiPrefix);
}
/** 删了的账号也能看。 */
export function fetchAdminUser(userId, apiPrefix) {
    return request("GET", `admin/users/${encodeURIComponent(userId)}`, undefined, apiPrefix);
}
/** 新的在前；limit 默认 20、最多 200。管理员打不开别人的任务详情，列表里别给链接。 */
export function fetchAdminUserJobs(userId, page = {}, apiPrefix) {
    return request("GET", `admin/users/${encodeURIComponent(userId)}/jobs${queryString(page)}`, undefined, apiPrefix);
}
/** 不能改自己（CANNOT_CHANGE_OWN_ROLE），不能让系统没有可用管理员（LAST_ADMIN）。 */
export function setAdminUserRole(userId, role, apiPrefix) {
    return request("POST", `admin/users/${encodeURIComponent(userId)}/role`, { role }, apiPrefix);
}
/** 软删除：踢下线，并取消它排队 / 在跑的任务（页数全额退回）。 */
export function deleteAdminUser(userId, apiPrefix) {
    return request("DELETE", `admin/users/${encodeURIComponent(userId)}`, undefined, apiPrefix);
}
/** 回到删之前的启用 / 停用；被取消的任务不会自动恢复。 */
export function restoreAdminUser(userId, apiPrefix) {
    return request("POST", `admin/users/${encodeURIComponent(userId)}/restore`, {}, apiPrefix);
}
export function createAdminUser(username, role = "user", apiPrefix) {
    return request("POST", "admin/users", { username, role }, apiPrefix);
}
export function resetAdminUserPassword(userId, apiPrefix) {
    return request("POST", `admin/users/${encodeURIComponent(userId)}/reset-password`, {}, apiPrefix);
}
export function setAdminUserEnabled(userId, enabled, apiPrefix) {
    return request("POST", `admin/users/${encodeURIComponent(userId)}/${enabled ? "enable" : "disable"}`, {}, apiPrefix);
}
export function fetchAccountPages(apiPrefix) {
    return request("GET", "account/pages", undefined, apiPrefix);
}
export function fetchAdminUserPages(userId, apiPrefix) {
    return request("GET", `admin/users/${encodeURIComponent(userId)}/pages`, undefined, apiPrefix);
}
/** delta 正数发放、负数扣减；note 选填，最多 200 字。 */
export function adjustAdminUserPages(userId, delta, note = "", apiPrefix) {
    return request("POST", `admin/users/${encodeURIComponent(userId)}/pages`, { delta, note }, apiPrefix);
}
