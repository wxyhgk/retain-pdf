// 管理后台 · 账号列表：搜索、按状态 / 身份筛选、点表头排序、分页、勾选后批量操作、新建账号。
// 筛选和排序都交给后端（GET /admin/users?q=&status=&role=&sort=&order=&limit=&offset=）。
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminUserSort, AdminUserStatus, AdminUserView, AuthRole } from "@retainpdf/api/auth";
import { authErrorText, USERNAME_PATTERN, pageAdjustProblem } from "@/features/auth/index.js";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import {
  ADMIN_PAGE_SIZE,
  BULK_ACTION_LABELS,
  DEFAULT_SORT,
  ROLE_FILTERS,
  ROLE_LABELS,
  STATUS_FILTERS,
  nextSort,
  planBulk,
  runBulk,
  userStatusLabel,
  type BulkAction,
  type BulkPlan,
  type BulkResult,
  type SortState,
} from "../domain/admin-users.js";
import type { AdminApi } from "../domain/admin-api.js";
import { IssuedPassword, formatWhen } from "./admin-shared.jsx";

const SEARCH_DEBOUNCE_MS = 300;

function balanceText(user: AdminUserView): string {
  if (user.role === "admin" || user.page_balance === null) return "不限额";
  return typeof user.page_balance === "number" ? `${user.page_balance} 页` : "—";
}

const SORTABLE: ReadonlyArray<{ column: AdminUserSort; label: string }> = [
  { column: "username", label: "用户名" },
  { column: "page_balance", label: "剩余页数" },
  { column: "created_at", label: "建号时间" },
  { column: "last_login_at", label: "最近登录" },
];

function SortHeader({ column, label, sort, onSort }: { column: AdminUserSort; label: string; sort: SortState; onSort: (column: AdminUserSort) => void }) {
  const active = sort.sort === column;
  return (
    <th className={column === "page_balance" ? "admin-num" : undefined} aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="admin-sort" data-admin-sort={column} onClick={() => onSort(column)}>
        {label}
        <span aria-hidden="true" className="admin-sort-mark">{active ? (sort.order === "asc" ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}

/** 打开批量弹窗那一刻就把「谁做、谁跳过」算好存下来：弹窗是模态的，期间勾选不会变；关掉后内容保留到淡出结束。 */
type BulkDraft = { action: BulkAction; plan: BulkPlan; amount: string; note: string; error: string };

export function AdminUsersView({
  api,
  currentUserId,
  onOpenUser,
  refreshKey = 0,
}: {
  api: AdminApi;
  currentUserId: string;
  onOpenUser: (userId: string) => void;
  /** 详情里改过东西回来时加一，列表重新读。 */
  refreshKey?: number;
}) {
  const [searchText, setSearchText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | AdminUserStatus>("");
  const [role, setRole] = useState<"" | AuthRole>("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<AdminUserView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [reloadTick, setReloadTick] = useState(0);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AuthRole>("user");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const [bulk, setBulk] = useState<BulkDraft | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkReport, setBulkReport] = useState<{ action: BulkAction; result: BulkResult; skipped: number } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // 条件一变回到第一页、清掉勾选。
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [q, status, role, sort]);

  useEffect(() => {
    let alive = true;
    api.list({
      q: q || undefined,
      status: status || undefined,
      role: role || undefined,
      sort: sort.sort,
      order: sort.order,
      limit: ADMIN_PAGE_SIZE,
      offset: page * ADMIN_PAGE_SIZE,
    }).then(
      (view) => {
        if (!alive) return;
        const list = view.users || [];
        setUsers(list);
        setTotal(typeof view.total === "number" ? view.total : list.length);
        setError("");
      },
      (err) => {
        if (alive) setError(authErrorText(err, "读取账号列表失败。"));
      },
    );
    return () => { alive = false; };
  }, [api, q, status, role, sort, page, reloadTick, refreshKey]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const selectedUsers = useMemo(() => (users || []).filter((u) => selected.has(u.user_id)), [users, selected]);
  const allOnPageSelected = Boolean(users?.length) && users!.every((u) => selected.has(u.user_id));

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!USERNAME_PATTERN.test(name)) {
      setCreateError("用户名 3～32 位，只能用字母、数字、点、下划线、连字符。");
      return;
    }
    setCreateBusy(true);
    setCreateError("");
    try {
      const result = await api.create(name, newRole);
      setIssued({ username: result.user?.username || name, password: result.initial_password });
      setNewName("");
      setNewRole("user");
      setCreating(false);
      reload();
    } catch (err) {
      setCreateError(authErrorText(err));
    } finally {
      setCreateBusy(false);
    }
  }

  const needsAmount = bulk?.action === "grant" || bulk?.action === "deduct";

  function openBulk(action: BulkAction) {
    setBulk({ action, plan: planBulk(action, selectedUsers, currentUserId), amount: "", note: "", error: "" });
    setBulkOpen(true);
  }

  async function runBulkAction() {
    if (!bulk) return;
    const { plan } = bulk;
    if (needsAmount) {
      const problem = pageAdjustProblem(bulk.amount, bulk.note);
      if (problem) {
        setBulk({ ...bulk, error: problem });
        return;
      }
    }
    const action = bulk.action;
    const amount = Number(bulk.amount.trim());
    const note = bulk.note.trim();
    const runOne: Record<BulkAction, (user: AdminUserView) => Promise<unknown>> = {
      grant: (user) => api.adjustPages(user.user_id, amount, note),
      deduct: (user) => api.adjustPages(user.user_id, -amount, note),
      disable: (user) => api.setEnabled(user.user_id, false),
      enable: (user) => api.setEnabled(user.user_id, true),
      delete: (user) => api.remove(user.user_id),
      restore: (user) => api.restore(user.user_id),
    };
    setBulkProgress({ done: 0, total: plan.eligible.length });
    const result = await runBulk(plan.eligible, runOne[action], (err) => authErrorText(err), (done, all) => setBulkProgress({ done, total: all }));
    setBulkProgress(null);
    setBulkOpen(false);
    setBulkReport({ action, result, skipped: plan.skipped.length });
    setSelected(new Set());
    reload();
  }

  return (
    <section className="admin-section" data-admin-users="true">
      <header className="admin-section-head">
        <div>
          <h1>账号</h1>
          <p className="admin-sub">共 {total} 个{status === "deleted" ? "已删除的" : ""}账号。账号由管理员创建，初始密码只显示一次；删除是软删除，可以恢复。</p>
        </div>
        <button type="button" className="auth-primary" data-admin-action="new-user" onClick={() => { setCreating((v) => !v); setCreateError(""); }}>
          {creating ? "收起" : "新建账号"}
        </button>
      </header>

      {issued ? <IssuedPassword username={issued.username} password={issued.password} onDismiss={() => setIssued(null)} /> : null}

      {creating ? (
        <form className="admin-create" data-auth-form="create-user" onSubmit={onCreate}>
          <input aria-label="新账号的用户名" placeholder="新账号的用户名" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <select aria-label="身份" value={newRole} onChange={(e) => setNewRole(e.target.value as AuthRole)}>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <button type="submit" className="auth-primary" disabled={createBusy}>{createBusy ? "正在创建…" : "创建"}</button>
          {createError ? <p className="auth-error" role="alert">{createError}</p> : null}
        </form>
      ) : null}

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search"
          aria-label="按用户名搜索"
          placeholder="按用户名搜索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select aria-label="按状态筛选" data-admin-filter="status" value={status} onChange={(e) => setStatus(e.target.value as "" | AdminUserStatus)}>
          {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select aria-label="按身份筛选" data-admin-filter="role" value={role} onChange={(e) => setRole(e.target.value as "" | AuthRole)}>
          {ROLE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {selected.size ? (
        <div className="admin-bulkbar" role="toolbar" aria-label="批量操作" data-admin-bulkbar="true">
          <span>已选 {selected.size} 个</span>
          {(["grant", "deduct", "disable", "enable", "delete", "restore"] as BulkAction[]).map((action) => (
            <button
              key={action}
              type="button"
              className={action === "delete" ? "auth-link admin-danger-link" : "auth-link"}
              data-admin-bulk={action}
              onClick={() => openBulk(action)}
            >
              {BULK_ACTION_LABELS[action]}
            </button>
          ))}
          <button type="button" className="auth-link admin-muted-link" onClick={() => setSelected(new Set())}>取消选择</button>
        </div>
      ) : null}

      {bulkReport ? (
        <div className={bulkReport.result.failed.length ? "admin-report is-warn" : "admin-report"} role="status" data-admin-bulk-report="true">
          <p>
            {BULK_ACTION_LABELS[bulkReport.action]}：成功 {bulkReport.result.succeeded.length} 个
            {bulkReport.result.failed.length ? `，失败 ${bulkReport.result.failed.length} 个` : ""}
            {bulkReport.skipped ? `，跳过 ${bulkReport.skipped} 个` : ""}。
          </p>
          {bulkReport.result.failed.length ? (
            <ul>
              {bulkReport.result.failed.map(({ user, message }) => <li key={user.user_id}><strong>{user.username}</strong>：{message}</li>)}
            </ul>
          ) : null}
          <button type="button" className="auth-link" onClick={() => setBulkReport(null)}>知道了</button>
        </div>
      ) : null}

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {users === null && !error ? <p className="admin-sub">正在读取账号…</p> : null}
      {users && users.length === 0 ? <p className="admin-empty">没有符合条件的账号。</p> : null}

      {users?.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-check">
                  <input
                    type="checkbox"
                    aria-label="全选本页"
                    checked={allOnPageSelected}
                    onChange={() => setSelected(allOnPageSelected ? new Set() : new Set(users.map((u) => u.user_id)))}
                  />
                </th>
                <SortHeader {...SORTABLE[0]} sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                <th>身份</th>
                <th>状态</th>
                <SortHeader {...SORTABLE[1]} sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                <SortHeader {...SORTABLE[2]} sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                <SortHeader {...SORTABLE[3]} sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id} data-auth-user={user.username} data-status={user.status} aria-selected={selected.has(user.user_id)}>
                  <td className="admin-check">
                    <input type="checkbox" aria-label={`选择 ${user.username}`} checked={selected.has(user.user_id)} onChange={() => toggle(user.user_id)} />
                  </td>
                  <td>
                    <button type="button" className="admin-user-link" data-admin-open={user.user_id} onClick={() => onOpenUser(user.user_id)}>
                      {user.username}
                    </button>
                    {user.user_id === currentUserId ? <span className="admin-self">（我）</span> : null}
                  </td>
                  <td>{ROLE_LABELS[user.role] || user.role}</td>
                  <td><span className="admin-status" data-status={user.status}>{userStatusLabel(user)}</span></td>
                  <td className="admin-num" data-page-balance="true">{balanceText(user)}</td>
                  <td>{formatWhen(user.created_at, "—")}</td>
                  <td>{formatWhen(user.last_login_at, "从未登录")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageCount > 1 ? (
        <nav className="admin-pager" aria-label="翻页">
          <button type="button" className="auth-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span>第 {page + 1} / {pageCount} 页</span>
          <button type="button" className="auth-secondary" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </nav>
      ) : null}

      <ConfirmDialog
        id="admin-bulk-dialog"
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        pending={Boolean(bulkProgress)}
        tone={bulk?.action === "delete" ? "danger" : "default"}
        title={bulk ? `批量${BULK_ACTION_LABELS[bulk.action]}` : ""}
        confirmLabel={!bulk || bulk.plan.eligible.length ? `${bulk ? BULK_ACTION_LABELS[bulk.action] : ""} ${bulk?.plan.eligible.length || 0} 个账号` : "没有可操作的账号，关闭"}
        onConfirm={() => (bulk?.plan.eligible.length ? runBulkAction() : setBulkOpen(false))}
        description={bulk ? (
          <div className="admin-bulk-body" data-admin-bulk-dialog={bulk.action}>
            <p>将对 {bulk.plan.eligible.length} 个账号{BULK_ACTION_LABELS[bulk.action]}{bulk.plan.skipped.length ? `，跳过 ${bulk.plan.skipped.length} 个` : ""}。一个一个处理，某个失败不影响其他的。</p>
            {bulk.action === "delete" ? <p>删除会把对方踢下线，并取消它排队中和运行中的任务（页数全额退回）；数据都保留，可以恢复。</p> : null}
            {bulk.plan.skipped.length ? (
              <ul className="admin-skipped">
                {bulk.plan.skipped.map(({ user, reason }) => <li key={user.user_id}>{user.username}：{reason}</li>)}
              </ul>
            ) : null}
            {needsAmount ? (
              <div className="admin-create">
                <input aria-label="每个账号的页数" placeholder="每个账号的页数" inputMode="numeric" value={bulk.amount} onChange={(e) => setBulk({ ...bulk, amount: e.target.value, error: "" })} />
                <input aria-label="备注（选填）" placeholder="备注（选填）" maxLength={200} value={bulk.note} onChange={(e) => setBulk({ ...bulk, note: e.target.value, error: "" })} />
              </div>
            ) : null}
            {bulk.error ? <p className="auth-error" role="alert">{bulk.error}</p> : null}
            {bulkProgress ? <p className="admin-sub" role="status">正在处理 {bulkProgress.done}/{bulkProgress.total}…</p> : null}
          </div>
        ) : ""}
      />
    </section>
  );
}
