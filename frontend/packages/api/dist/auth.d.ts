export type AuthRole = "admin" | "user";
export type AuthUser = {
    user_id: string;
    username: string;
    role: AuthRole;
    must_change_password: boolean;
};
export type AuthSessionView = {
    mode: "single" | "multi";
    authenticated: boolean;
    user: AuthUser | null;
};
export type AdminUserView = AuthUser & {
    status: "active" | "disabled";
    created_at: string;
    last_login_at: string | null;
};
/** 后端的错误码带出来，界面按码说人话（INVALID_CREDENTIALS / ACCOUNT_DISABLED / TOO_MANY_ATTEMPTS …）。 */
export declare class AuthRequestError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: Record<string, unknown>;
    constructor(message: string, status: number, code: string, details?: Record<string, unknown>);
}
export declare function fetchAuthSession(apiPrefix?: string): Promise<AuthSessionView>;
/**
 * 页面启动时先调它：先不带凭据问一次模式（单机模式的跨域不允许带凭据），是多用户就切到带 Cookie
 * 再问一次登录状态。之后本包所有请求都按这个模式发。
 */
export declare function resolveAuthSession(apiPrefix?: string): Promise<AuthSessionView>;
export declare function login(username: string, password: string, apiPrefix?: string): Promise<{
    user: AuthUser;
}>;
export declare function logout(apiPrefix?: string): Promise<unknown>;
export declare function changePassword(currentPassword: string, newPassword: string, apiPrefix?: string): Promise<unknown>;
export declare function listAdminUsers(apiPrefix?: string): Promise<{
    users: AdminUserView[];
}>;
export declare function createAdminUser(username: string, role?: AuthRole, apiPrefix?: string): Promise<{
    user: AdminUserView;
    initial_password: string;
}>;
export declare function resetAdminUserPassword(userId: string, apiPrefix?: string): Promise<{
    initial_password: string;
}>;
export declare function setAdminUserEnabled(userId: string, enabled: boolean, apiPrefix?: string): Promise<{
    user: AdminUserView;
}>;
