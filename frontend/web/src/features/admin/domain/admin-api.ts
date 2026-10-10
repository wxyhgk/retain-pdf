// 管理后台用到的接口收成一个端口：默认走 @retainpdf/api/auth，测试里整个换掉。
import {
  adjustAdminUserPages,
  createAdminUser,
  deleteAdminUser,
  fetchAdminUser,
  fetchAdminUserJobs,
  fetchAdminUserPages,
  listAdminUsers,
  resetAdminUserPassword,
  restoreAdminUser,
  setAdminUserEnabled,
  setAdminUserRole,
  type AdminUserDetail,
  type AdminUserJob,
  type AdminUserQuery,
  type AdminUserView,
  type AuthRole,
  type PageAccountView,
} from "@retainpdf/api/auth";

export type AdminApi = {
  list: (query: AdminUserQuery) => Promise<{ users: AdminUserView[]; total?: number }>;
  detail: (userId: string) => Promise<AdminUserDetail>;
  jobs: (userId: string, page: { limit: number; offset: number }) => Promise<{ jobs: AdminUserJob[]; total: number }>;
  create: (username: string, role: AuthRole) => Promise<{ user: AdminUserView; initial_password: string }>;
  reset: (userId: string) => Promise<{ initial_password: string }>;
  setEnabled: (userId: string, enabled: boolean) => Promise<{ user: AdminUserView }>;
  setRole: (userId: string, role: AuthRole) => Promise<{ user: AdminUserView }>;
  remove: (userId: string) => Promise<{ user: AdminUserView; canceled_jobs: string[] }>;
  restore: (userId: string) => Promise<{ user: AdminUserView }>;
  pages: (userId: string) => Promise<PageAccountView>;
  adjustPages: (userId: string, delta: number, note: string) => Promise<{ balance: number }>;
};

export const defaultAdminApi: AdminApi = {
  list: (query) => listAdminUsers(query),
  detail: (userId) => fetchAdminUser(userId),
  jobs: (userId, page) => fetchAdminUserJobs(userId, page),
  create: (username, role) => createAdminUser(username, role),
  reset: (userId) => resetAdminUserPassword(userId),
  setEnabled: (userId, enabled) => setAdminUserEnabled(userId, enabled),
  setRole: (userId, role) => setAdminUserRole(userId, role),
  remove: (userId) => deleteAdminUser(userId),
  restore: (userId) => restoreAdminUser(userId),
  pages: (userId) => fetchAdminUserPages(userId),
  adjustPages: (userId, delta, note) => adjustAdminUserPages(userId, delta, note),
};
