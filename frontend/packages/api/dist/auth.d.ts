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
export type AdminUserStatus = "active" | "disabled" | "deleted";
export type AdminUserView = AuthUser & {
    /** deleted 是软删除：不能登录，数据和账目都在，可以恢复。 */
    status: AdminUserStatus;
    created_at: string;
    last_login_at: string | null;
    /** 软删除的时间；没删为空串。老后端没有这个字段。 */
    deleted_at?: string;
    /** 剩余页数；管理员不限额时为 null。老后端没有这个字段。 */
    page_balance?: number | null;
};
export type AdminUserSort = "created_at" | "username" | "last_login_at" | "page_balance";
/** 都可选；不传 status 时只返回没删的（启用 + 停用），不传 limit 时不分页。 */
export type AdminUserQuery = {
    q?: string;
    status?: AdminUserStatus;
    role?: AuthRole;
    sort?: AdminUserSort;
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
};
export type AdminUserStats = {
    jobs_total: number;
    /** queued / running / succeeded / failed / canceled，数量为 0 的不出现。含书籍任务派生的 OCR 子任务。 */
    jobs_by_status: Partial<Record<string, number>>;
    documents: number;
    uploads: number;
    /** 上传的原始 PDF 合计字节数（不含任务产物）。 */
    upload_bytes: number;
    /** 实际扣掉的页数：已确认 + 预扣中（退回的不算）。 */
    pages_charged: number;
    /** pages_charged 里还在预扣中、任务没跑完的。 */
    pages_reserved: number;
    last_submitted_at: string | null;
};
export type AdminUserDetail = {
    user: AdminUserView;
    page_balance: number | null;
    stats: AdminUserStats;
};
export type AdminUserJob = {
    job_id: string;
    workflow: string;
    status: string;
    /** 书名，没有就是上传的文件名。 */
    title: string;
    /** 源 PDF 总页数。 */
    document_pages: number | null;
    /** 不计费的任务为 null。 */
    charged_pages: number | null;
    charge_status: "reserved" | "settled" | "refunded" | null;
    created_at: string;
    finished_at: string | null;
};
/**
 * 页数账目：grant 管理员发放（正）/ 扣减（负）；charge 任务扣页（负）；refund 退回（正，
 * note 是 failed / canceled / deleted / submit_failed）。
 */
export type PageLedgerKind = "grant" | "charge" | "refund";
export type PageLedgerEntry = {
    entry_id: number;
    delta: number;
    kind: PageLedgerKind | string;
    job_id: string;
    note: string;
    actor_user_id: string;
    created_at: string;
};
/** 单机模式、管理员：unlimited 为 true，balance 为 null，entries 为空。entries 新的在前，最多 50 条。 */
export type PageAccountView = {
    unlimited: boolean;
    balance: number | null;
    entries: PageLedgerEntry[];
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
/** total 是符合条件的总数；老后端没有 total。 */
export declare function listAdminUsers(query?: AdminUserQuery, apiPrefix?: string): Promise<{
    users: AdminUserView[];
    total?: number;
}>;
/** 删了的账号也能看。 */
export declare function fetchAdminUser(userId: string, apiPrefix?: string): Promise<AdminUserDetail>;
/** 新的在前；limit 默认 20、最多 200。管理员打不开别人的任务详情，列表里别给链接。 */
export declare function fetchAdminUserJobs(userId: string, page?: {
    limit?: number;
    offset?: number;
}, apiPrefix?: string): Promise<{
    jobs: AdminUserJob[];
    total: number;
}>;
/** 不能改自己（CANNOT_CHANGE_OWN_ROLE），不能让系统没有可用管理员（LAST_ADMIN）。 */
export declare function setAdminUserRole(userId: string, role: AuthRole, apiPrefix?: string): Promise<{
    user: AdminUserView;
}>;
/** 软删除：踢下线，并取消它排队 / 在跑的任务（页数全额退回）。 */
export declare function deleteAdminUser(userId: string, apiPrefix?: string): Promise<{
    user: AdminUserView;
    canceled_jobs: string[];
}>;
/** 回到删之前的启用 / 停用；被取消的任务不会自动恢复。 */
export declare function restoreAdminUser(userId: string, apiPrefix?: string): Promise<{
    user: AdminUserView;
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
export declare function fetchAccountPages(apiPrefix?: string): Promise<PageAccountView>;
export declare function fetchAdminUserPages(userId: string, apiPrefix?: string): Promise<PageAccountView>;
/** delta 正数发放、负数扣减；note 选填，最多 200 字。 */
export declare function adjustAdminUserPages(userId: string, delta: number, note?: string, apiPrefix?: string): Promise<{
    balance: number;
}>;
