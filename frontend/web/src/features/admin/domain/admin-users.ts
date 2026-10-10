// 管理后台的纯逻辑：账号 / 任务的文案、列表排序切换、批量操作谁能做谁跳过、逐个执行。
import type { AdminUserSort, AdminUserStatus, AdminUserView, AuthRole } from "@retainpdf/api/auth";

export const ADMIN_PAGE_SIZE = 50;
export const ADMIN_JOBS_PAGE_SIZE = 20;

export const ROLE_LABELS: Record<AuthRole, string> = { admin: "管理员", user: "普通用户" };

export function userStatusLabel(user: Pick<AdminUserView, "status" | "must_change_password">): string {
  if (user.status === "deleted") return "已删除";
  if (user.status === "disabled") return "已停用";
  return user.must_change_password ? "待改密码" : "正常";
}

export const STATUS_FILTERS: ReadonlyArray<{ value: "" | AdminUserStatus; label: string }> = [
  { value: "", label: "全部（不含已删除）" },
  { value: "active", label: "正常" },
  { value: "disabled", label: "已停用" },
  { value: "deleted", label: "已删除" },
];

export const ROLE_FILTERS: ReadonlyArray<{ value: "" | AuthRole; label: string }> = [
  { value: "", label: "全部身份" },
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
];

const WORKFLOW_LABELS: Record<string, string> = { book: "整本翻译", translate: "翻译", ocr: "OCR", render: "重新排版" };
const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消",
};
const CHARGE_STATUS_LABELS: Record<string, string> = { reserved: "预扣中", settled: "已扣", refunded: "已退回" };

export const workflowLabel = (workflow: string) => WORKFLOW_LABELS[workflow] || workflow || "—";
export const jobStatusLabel = (status: string) => JOB_STATUS_LABELS[status] || status || "—";
export const chargeStatusLabel = (status: string | null) => (status ? CHARGE_STATUS_LABELS[status] || status : "");
/** 统计里按状态计数的固定顺序。 */
export const JOB_STATUS_ORDER = ["queued", "running", "succeeded", "failed", "canceled"] as const;

export function formatBytes(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export type SortState = { sort: AdminUserSort; order: "asc" | "desc" };
export const DEFAULT_SORT: SortState = { sort: "created_at", order: "asc" };

/** 点表头：同一列切换升降序；换列时用户名默认升序，时间和页数默认降序（新的、多的在前）。 */
export function nextSort(current: SortState, column: AdminUserSort): SortState {
  if (current.sort === column) return { sort: column, order: current.order === "asc" ? "desc" : "asc" };
  return { sort: column, order: column === "username" ? "asc" : "desc" };
}

export type BulkAction = "grant" | "deduct" | "disable" | "enable" | "delete" | "restore";

export const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  grant: "发放页数",
  deduct: "扣减页数",
  disable: "停用",
  enable: "启用",
  delete: "删除",
  restore: "恢复",
};

/** 这个账号做不了这件批量操作时返回原因（会被跳过），能做返回空串。 */
export function bulkSkipReason(action: BulkAction, user: AdminUserView, currentUserId: string): string {
  const self = user.user_id === currentUserId;
  const deleted = user.status === "deleted";
  switch (action) {
    case "grant":
    case "deduct":
      if (deleted) return "已删除";
      return user.role === "admin" ? "管理员不限额" : "";
    case "disable":
      if (self) return "不能停用自己";
      if (deleted) return "已删除";
      return user.status === "disabled" ? "已经是停用" : "";
    case "enable":
      if (deleted) return "已删除";
      return user.status === "active" ? "已经是正常" : "";
    case "delete":
      if (self) return "不能删除自己";
      return deleted ? "已经删除" : "";
    case "restore":
      return deleted ? "" : "没有删除";
  }
}

export type BulkPlan = { eligible: AdminUserView[]; skipped: Array<{ user: AdminUserView; reason: string }> };

export function planBulk(action: BulkAction, users: AdminUserView[], currentUserId: string): BulkPlan {
  const plan: BulkPlan = { eligible: [], skipped: [] };
  for (const user of users) {
    const reason = bulkSkipReason(action, user, currentUserId);
    if (reason) plan.skipped.push({ user, reason });
    else plan.eligible.push(user);
  }
  return plan;
}

export type BulkResult = { succeeded: AdminUserView[]; failed: Array<{ user: AdminUserView; message: string }> };

/** 一个一个来（后端没有批量接口）：每个各自成功或失败，失败的记下它自己的原因，不中断后面的。 */
export async function runBulk(
  users: AdminUserView[],
  run: (user: AdminUserView) => Promise<unknown>,
  describeError: (error: unknown) => string,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] };
  for (const [index, user] of users.entries()) {
    try {
      await run(user);
      result.succeeded.push(user);
    } catch (error) {
      result.failed.push({ user, message: describeError(error) });
    }
    onProgress?.(index + 1, users.length);
  }
  return result;
}
