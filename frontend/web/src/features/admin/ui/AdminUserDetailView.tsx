// 管理后台 · 单个账号：概况和统计、操作（重置密码 / 停用启用 / 改身份 / 删除恢复）、页数和账目、任务列表。
// 管理员打不开别人的任务详情（数据按账号归属），所以账目和任务都不给链接。
import { useCallback, useEffect, useState } from "react";
import type { AdminUserDetail, AdminUserJob, AuthRole, PageAccountView } from "@retainpdf/api/auth";
import { PageLedger, authErrorText, pageAdjustProblem } from "@/features/auth/index.js";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import {
  ADMIN_JOBS_PAGE_SIZE,
  JOB_STATUS_ORDER,
  ROLE_LABELS,
  chargeStatusLabel,
  formatBytes,
  jobStatusLabel,
  userStatusLabel,
  workflowLabel,
} from "../domain/admin-users.js";
import type { AdminApi } from "../domain/admin-api.js";
import { IssuedPassword, formatWhen } from "./admin-shared.jsx";

type Confirm = { kind: "role"; role: AuthRole } | { kind: "delete" } | null;

export function AdminUserDetailView({
  api,
  userId,
  currentUserId,
  onBack,
  onChanged,
}: {
  api: AdminApi;
  userId: string;
  currentUserId: string;
  onBack: () => void;
  /** 改过账号后通知列表重新读。 */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [issued, setIssued] = useState<string>("");
  const [confirm, setConfirm] = useState<Confirm>(null);

  const reload = useCallback(async () => {
    try {
      setDetail(await api.detail(userId));
      setLoadError("");
    } catch (err) {
      setLoadError(authErrorText(err, "读取账号失败。"));
    }
  }, [api, userId]);

  useEffect(() => {
    setDetail(null);
    setNotice("");
    setActionError("");
    setIssued("");
    void reload();
  }, [reload]);

  async function act(key: string, action: () => Promise<string | void>) {
    setBusy(key);
    setActionError("");
    setNotice("");
    try {
      const message = await action();
      if (message) setNotice(message);
      await reload();
      onChanged();
    } catch (err) {
      setActionError(authErrorText(err));
    } finally {
      setBusy("");
      setConfirm(null);
    }
  }

  if (loadError && !detail) {
    return (
      <section className="admin-section">
        <button type="button" className="auth-link" onClick={onBack}>← 账号列表</button>
        <p className="auth-error" role="alert">{loadError}</p>
      </section>
    );
  }
  if (!detail) {
    return (
      <section className="admin-section">
        <button type="button" className="auth-link" onClick={onBack}>← 账号列表</button>
        <p className="admin-sub">正在读取账号…</p>
      </section>
    );
  }

  const { user, stats } = detail;
  const self = user.user_id === currentUserId;
  const deleted = user.status === "deleted";
  const disabled = user.status === "disabled";
  const unlimited = user.role === "admin" || detail.page_balance === null;
  const activeJobs = (stats.jobs_by_status.queued || 0) + (stats.jobs_by_status.running || 0);
  const otherRole: AuthRole = user.role === "admin" ? "user" : "admin";

  return (
    <section className="admin-section" data-admin-user-detail={user.username}>
      <button type="button" className="auth-link" data-admin-action="back" onClick={onBack}>← 账号列表</button>
      <header className="admin-section-head">
        <div>
          <h1>
            {user.username}
            {self ? <span className="admin-self">（我）</span> : null}
          </h1>
          <p className="admin-badges">
            <span className="admin-badge">{ROLE_LABELS[user.role] || user.role}</span>
            <span className="admin-status" data-status={user.status}>{userStatusLabel(user)}</span>
          </p>
        </div>
      </header>

      <dl className="admin-facts">
        <div><dt>剩余页数</dt><dd data-page-balance="true">{unlimited ? "不限额" : `${detail.page_balance} 页`}</dd></div>
        <div>
          <dt>累计扣页</dt>
          <dd>{stats.pages_charged} 页</dd>
          {stats.pages_reserved ? <small>其中 {stats.pages_reserved} 页预扣中</small> : null}
        </div>
        <div>
          <dt>任务</dt>
          <dd>{stats.jobs_total} 个</dd>
          {stats.jobs_total ? (
            <small>
              {JOB_STATUS_ORDER.filter((s) => stats.jobs_by_status[s]).map((s) => `${jobStatusLabel(s)} ${stats.jobs_by_status[s]}`).join(" · ")}
            </small>
          ) : null}
        </div>
        <div><dt>书</dt><dd>{stats.documents} 本</dd></div>
        <div><dt>上传</dt><dd>{stats.uploads} 个</dd><small>{formatBytes(stats.upload_bytes)}（原始 PDF）</small></div>
        <div><dt>最近提交</dt><dd>{formatWhen(stats.last_submitted_at, "还没提交过")}</dd></div>
        <div><dt>最近登录</dt><dd>{formatWhen(user.last_login_at, "从未登录")}</dd></div>
        <div><dt>建号时间</dt><dd>{formatWhen(user.created_at)}</dd></div>
        {deleted ? <div><dt>删除时间</dt><dd>{formatWhen(user.deleted_at)}</dd></div> : null}
      </dl>

      <section className="admin-card">
        <h2>操作</h2>
        {issued ? <IssuedPassword username={user.username} password={issued} onDismiss={() => setIssued("")} /> : null}
        {deleted ? (
          <>
            <p className="admin-sub">账号已删除：不能登录，数据和账目都还在。要做其他操作先恢复。</p>
            <div className="admin-actions">
              <button type="button" className="auth-primary" data-admin-action="restore" disabled={Boolean(busy)} onClick={() => act("restore", async () => {
                await api.restore(user.user_id);
                return "已恢复。被删期间取消的任务不会自动恢复。";
              })}>
                {busy === "restore" ? "正在恢复…" : "恢复账号"}
              </button>
            </div>
          </>
        ) : (
          <div className="admin-actions">
            <button type="button" className="auth-secondary" data-admin-action="reset" disabled={Boolean(busy)} onClick={() => act("reset", async () => {
              const result = await api.reset(user.user_id);
              setIssued(result.initial_password);
            })}>
              重置密码
            </button>
            {self ? null : (
              <>
                <button type="button" className="auth-secondary" data-admin-action="toggle" disabled={Boolean(busy)} onClick={() => act("toggle", async () => {
                  await api.setEnabled(user.user_id, disabled);
                  return disabled ? "已启用。" : "已停用，对方已被踢下线。";
                })}>
                  {disabled ? "启用" : "停用"}
                </button>
                <button type="button" className="auth-secondary" data-admin-action="role" disabled={Boolean(busy)} onClick={() => setConfirm({ kind: "role", role: otherRole })}>
                  {otherRole === "admin" ? "设为管理员" : "改为普通用户"}
                </button>
                <button type="button" className="auth-secondary admin-danger" data-admin-action="delete" disabled={Boolean(busy)} onClick={() => setConfirm({ kind: "delete" })}>
                  删除账号
                </button>
              </>
            )}
          </div>
        )}
        {self && !deleted ? <p className="admin-sub">这是你自己的账号：不能停用、删除或改身份。</p> : null}
        {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}
        {notice ? <p className="auth-ok" role="status">{notice}</p> : null}
      </section>

      <PagesCard api={api} userId={user.user_id} username={user.username} editable={!unlimited && !deleted} onAdjusted={() => { void reload(); onChanged(); }} />
      <JobsCard api={api} userId={user.user_id} />

      <ConfirmDialog
        id="admin-user-confirm"
        open={Boolean(confirm)}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        pending={Boolean(busy)}
        tone={confirm?.kind === "delete" ? "danger" : "default"}
        title={confirm?.kind === "delete" ? `删除账号 ${user.username}？` : confirm?.kind === "role" ? `把 ${user.username} ${confirm.role === "admin" ? "设为管理员" : "改为普通用户"}？` : ""}
        confirmLabel={confirm?.kind === "delete" ? "删除" : "确认修改"}
        onConfirm={() => {
          if (confirm?.kind === "delete") {
            return act("delete", async () => {
              const result = await api.remove(user.user_id);
              const n = result.canceled_jobs?.length || 0;
              return n ? `已删除，取消了 ${n} 个排队中 / 运行中的任务，页数已退回。` : "已删除。";
            });
          }
          if (confirm?.kind === "role") {
            const role = confirm.role;
            return act("role", async () => {
              await api.setRole(user.user_id, role);
              return role === "admin" ? "已设为管理员，现在不限额。" : "已改为普通用户，余额恢复为账本里的页数。";
            });
          }
        }}
        description={confirm?.kind === "delete" ? (
          <>
            <p>对方会被立刻踢下线、不能再登录。{activeJobs ? `它还有 ${activeJobs} 个排队中 / 运行中的任务，会被取消，页数全额退回。` : ""}</p>
            <p>书、任务、账目都保留，用户名继续占用，之后可以恢复。</p>
          </>
        ) : confirm?.kind === "role" ? (
          confirm.role === "admin"
            ? <p>管理员能管理所有账号，并且不限额。立即生效，不用重新登录。</p>
            : <p>改回普通用户后按页数计费，余额是账本里原来的页数。立即生效。</p>
        ) : ""}
      />
    </section>
  );
}

function PagesCard({ api, userId, username, editable, onAdjusted }: { api: AdminApi; userId: string; username: string; editable: boolean; onAdjusted: () => void }) {
  const [pages, setPages] = useState<PageAccountView | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const reloadPages = useCallback(async () => {
    try {
      setPages(await api.pages(userId));
    } catch (err) {
      setError(authErrorText(err, "读取账目失败。"));
    }
  }, [api, userId]);

  useEffect(() => { void reloadPages(); }, [reloadPages]);

  async function submit(sign: 1 | -1) {
    setDone("");
    const problem = pageAdjustProblem(amount, note);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const n = Number(amount.trim());
      const result = await api.adjustPages(userId, sign * n, note.trim());
      setDone(`已${sign > 0 ? "发放" : "扣减"} ${n} 页，${username} 现在剩余 ${result.balance} 页。`);
      setAmount("");
      setNote("");
      await reloadPages();
      onAdjusted();
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" data-auth-pages-editor={username}>
      <h2>页数</h2>
      {editable ? (
        <form className="admin-create" data-auth-form="adjust-pages" onSubmit={(event) => { event.preventDefault(); void submit(1); }}>
          <input aria-label="页数" placeholder="页数" inputMode="numeric" className="admin-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input aria-label="备注（选填）" placeholder="备注（选填，比如「内测」）" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="auth-primary" disabled={busy}>发放</button>
          <button type="button" className="auth-secondary" disabled={busy} onClick={() => void submit(-1)}>扣减</button>
        </form>
      ) : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {done ? <p className="auth-ok" role="status">{done}</p> : null}
      {pages === null && !error ? <p className="admin-sub">正在读取账目…</p> : null}
      {pages && pages.unlimited ? <p className="admin-sub">管理员不限额，没有账目。</p> : null}
      {pages && !pages.unlimited ? <PageLedger entries={pages.entries || []} linkJobs={false} emptyText="这个账号还没有账目。" /> : null}
    </section>
  );
}

function JobsCard({ api, userId }: { api: AdminApi; userId: string }) {
  const [jobs, setJobs] = useState<AdminUserJob[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api.jobs(userId, { limit: ADMIN_JOBS_PAGE_SIZE, offset: page * ADMIN_JOBS_PAGE_SIZE }).then(
      (view) => {
        if (!alive) return;
        setJobs(view.jobs || []);
        setTotal(view.total || 0);
        setError("");
      },
      (err) => { if (alive) setError(authErrorText(err, "读取任务失败。")); },
    );
    return () => { alive = false; };
  }, [api, userId, page]);

  const pageCount = Math.max(1, Math.ceil(total / ADMIN_JOBS_PAGE_SIZE));
  return (
    <section className="admin-card" data-admin-jobs="true">
      <h2>任务 <small>共 {total} 个</small></h2>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {jobs === null && !error ? <p className="admin-sub">正在读取任务…</p> : null}
      {jobs && jobs.length === 0 ? <p className="admin-sub">还没有任务。</p> : null}
      {jobs?.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>标题</th><th>类型</th><th>状态</th><th className="admin-num">扣页</th><th>提交时间</th><th>结束时间</th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id} data-admin-job={job.job_id}>
                  <td className="admin-job-title" title={job.job_id}>{job.title || job.job_id}</td>
                  <td>{workflowLabel(job.workflow)}</td>
                  <td><span className="admin-job-status" data-status={job.status}>{jobStatusLabel(job.status)}</span></td>
                  <td className="admin-num">
                    {job.charged_pages === null ? <span className="admin-muted">不计费</span> : (
                      <>
                        {job.charged_pages} 页
                        {job.charge_status ? <small className="admin-charge" data-charge={job.charge_status}>{chargeStatusLabel(job.charge_status)}</small> : null}
                      </>
                    )}
                  </td>
                  <td>{formatWhen(job.created_at)}</td>
                  <td>{formatWhen(job.finished_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {pageCount > 1 ? (
        <nav className="admin-pager" aria-label="任务翻页">
          <button type="button" className="auth-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span>第 {page + 1} / {pageCount} 页</span>
          <button type="button" className="auth-secondary" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </nav>
      ) : null}
    </section>
  );
}
