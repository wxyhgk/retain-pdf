// auth — pure：单机 / 多用户的会话、登录、退出、改密码、页数额度，以及管理员的账号管理。
// 多用户模式下浏览器靠 HttpOnly Cookie（retain_session）认证，apiFetch 会带上凭据。
import { apiFetch, buildApiHeaders, buildApiUrl, setApiAuthMode, unwrapEnvelope } from "./internal/runtime.js";

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
export class AuthRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "AuthRequestError";
  }
}

async function request<T>(method: string, path: string, body?: unknown, apiPrefix?: string): Promise<T> {
  const response = await apiFetch(buildApiUrl(apiPrefix ?? "/api/v1", path), {
    method,
    headers: buildApiHeaders(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AuthRequestError(
      payload?.message || `请求失败（${response.status}）`,
      response.status,
      `${payload?.error?.code || payload?.code || ""}`,
      (payload?.error?.details && typeof payload.error.details === "object") ? payload.error.details : {},
    );
  }
  return unwrapEnvelope<T>(payload);
}

export function fetchAuthSession(apiPrefix?: string): Promise<AuthSessionView> {
  return request("GET", "auth/session", undefined, apiPrefix);
}

/**
 * 页面启动时先调它：先不带凭据问一次模式（单机模式的跨域不允许带凭据），是多用户就切到带 Cookie
 * 再问一次登录状态。之后本包所有请求都按这个模式发。
 */
export async function resolveAuthSession(apiPrefix?: string): Promise<AuthSessionView> {
  setApiAuthMode("single");
  const first = await fetchAuthSession(apiPrefix);
  if (first?.mode !== "multi") return { mode: "single", authenticated: true, user: first?.user ?? null };
  setApiAuthMode("multi");
  return fetchAuthSession(apiPrefix);
}

export function login(username: string, password: string, apiPrefix?: string): Promise<{ user: AuthUser }> {
  return request("POST", "auth/login", { username, password }, apiPrefix);
}

export function logout(apiPrefix?: string): Promise<unknown> {
  return request("POST", "auth/logout", {}, apiPrefix);
}

export function changePassword(currentPassword: string, newPassword: string, apiPrefix?: string): Promise<unknown> {
  return request("POST", "auth/password", { current_password: currentPassword, new_password: newPassword }, apiPrefix);
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, `${value}`);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** total 是符合条件的总数；老后端没有 total。 */
export function listAdminUsers(query: AdminUserQuery = {}, apiPrefix?: string): Promise<{ users: AdminUserView[]; total?: number }> {
  return request("GET", `admin/users${queryString(query)}`, undefined, apiPrefix);
}

/** 删了的账号也能看。 */
export function fetchAdminUser(userId: string, apiPrefix?: string): Promise<AdminUserDetail> {
  return request("GET", `admin/users/${encodeURIComponent(userId)}`, undefined, apiPrefix);
}

/** 新的在前；limit 默认 20、最多 200。管理员打不开别人的任务详情，列表里别给链接。 */
export function fetchAdminUserJobs(userId: string, page: { limit?: number; offset?: number } = {}, apiPrefix?: string): Promise<{ jobs: AdminUserJob[]; total: number }> {
  return request("GET", `admin/users/${encodeURIComponent(userId)}/jobs${queryString(page)}`, undefined, apiPrefix);
}

/** 不能改自己（CANNOT_CHANGE_OWN_ROLE），不能让系统没有可用管理员（LAST_ADMIN）。 */
export function setAdminUserRole(userId: string, role: AuthRole, apiPrefix?: string): Promise<{ user: AdminUserView }> {
  return request("POST", `admin/users/${encodeURIComponent(userId)}/role`, { role }, apiPrefix);
}

/** 软删除：踢下线，并取消它排队 / 在跑的任务（页数全额退回）。 */
export function deleteAdminUser(userId: string, apiPrefix?: string): Promise<{ user: AdminUserView; canceled_jobs: string[] }> {
  return request("DELETE", `admin/users/${encodeURIComponent(userId)}`, undefined, apiPrefix);
}

/** 回到删之前的启用 / 停用；被取消的任务不会自动恢复。 */
export function restoreAdminUser(userId: string, apiPrefix?: string): Promise<{ user: AdminUserView }> {
  return request("POST", `admin/users/${encodeURIComponent(userId)}/restore`, {}, apiPrefix);
}

export function createAdminUser(username: string, role: AuthRole = "user", apiPrefix?: string): Promise<{ user: AdminUserView; initial_password: string }> {
  return request("POST", "admin/users", { username, role }, apiPrefix);
}

export function resetAdminUserPassword(userId: string, apiPrefix?: string): Promise<{ initial_password: string }> {
  return request("POST", `admin/users/${encodeURIComponent(userId)}/reset-password`, {}, apiPrefix);
}

export function setAdminUserEnabled(userId: string, enabled: boolean, apiPrefix?: string): Promise<{ user: AdminUserView }> {
  return request("POST", `admin/users/${encodeURIComponent(userId)}/${enabled ? "enable" : "disable"}`, {}, apiPrefix);
}

export function fetchAccountPages(apiPrefix?: string): Promise<PageAccountView> {
  return request("GET", "account/pages", undefined, apiPrefix);
}

export function fetchAdminUserPages(userId: string, apiPrefix?: string): Promise<PageAccountView> {
  return request("GET", `admin/users/${encodeURIComponent(userId)}/pages`, undefined, apiPrefix);
}

/** delta 正数发放、负数扣减；note 选填，最多 200 字。 */
export function adjustAdminUserPages(userId: string, delta: number, note = "", apiPrefix?: string): Promise<{ balance: number }> {
  return request("POST", `admin/users/${encodeURIComponent(userId)}/pages`, { delta, note }, apiPrefix);
}
