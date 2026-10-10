// auth — pure：单机 / 多用户的会话、登录、退出、改密码，以及管理员的账号管理。
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
export function listAdminUsers(apiPrefix) {
    return request("GET", "admin/users", undefined, apiPrefix);
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
