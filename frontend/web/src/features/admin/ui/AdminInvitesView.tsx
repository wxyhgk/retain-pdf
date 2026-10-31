// 管理后台 · 邀请码：生成（可用次数、赠送页数、有效天数、备注）→ 显眼地给出邀请码和注册链接；
// 列表（状态、已用 / 总次数、赠送页数、过期时间）、点开看谁用它注册了、作废。
// 对方拿到邀请码，在登录页点「用邀请码注册」自己设用户名和密码。
import { Fragment, useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  createInvite,
  fetchInvite,
  listInvites,
  revokeInvite,
  type CreateInviteInput,
  type InviteDetail,
  type InviteView,
} from "@retainpdf/api/auth";
import { authErrorText, buildInviteLink } from "@/features/auth/index.js";
import { ConfirmDialog } from "@retainpdf/ui";
import {
  EMPTY_INVITE_FORM,
  canRevokeInvite,
  inviteErrorField,
  inviteFormProblem,
  inviteInput,
  inviteStatusLabel,
  type InviteField,
  type InviteForm,
} from "../domain/invites.js";
import { copyText, formatWhen } from "./admin-shared.jsx";

export type InvitesApi = {
  list: () => Promise<{ invites: InviteView[] }>;
  create: (input: CreateInviteInput) => Promise<InviteView>;
  detail: (inviteId: string) => Promise<InviteDetail>;
  revoke: (inviteId: string) => Promise<InviteView>;
};

const defaultInvitesApi: InvitesApi = {
  list: () => listInvites(),
  create: (input) => createInvite(input),
  detail: (inviteId) => fetchInvite(inviteId),
  revoke: (inviteId) => revokeInvite(inviteId),
};

function CopyButton({ text, label, copiedLabel = "已复制", className = "auth-link" }: { text: string; label: string; copiedLabel?: string; className?: string }) {
  const [state, setState] = useState<"" | "ok" | "fail">("");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        setState((await copyText(text)) ? "ok" : "fail");
        globalThis.setTimeout?.(() => setState(""), 1600);
      }}
    >
      {state === "ok" ? copiedLabel : state === "fail" ? "复制失败，请手动选中" : label}
    </button>
  );
}

function IssuedInvite({ invite, onDismiss }: { invite: InviteView; onDismiss: () => void }) {
  const link = buildInviteLink(invite.code);
  return (
    <div className="auth-issued" role="status" data-admin-issued-invite="true">
      <p>新邀请码{invite.note ? `（${invite.note}）` : ""}：把邀请码或注册链接发给对方，对方在登录页点「用邀请码注册」。</p>
      <div className="auth-issued-row">
        <code className="auth-issued-password">{invite.code}</code>
        <CopyButton text={invite.code} label="复制邀请码" className="auth-secondary" />
        <CopyButton text={link} label="复制注册链接" copiedLabel="链接已复制" className="auth-secondary" />
        <button type="button" className="auth-link" onClick={onDismiss}>收起</button>
      </div>
      <p className="auth-sub">
        可用 {invite.max_uses} 次{invite.initial_pages ? `，每个注册的账号送 ${invite.initial_pages} 页` : "，注册后是 0 页"}
        {invite.expires_at ? `，${formatWhen(invite.expires_at)} 过期` : "，不过期"}。这个邀请码之后在下面的列表里也能看到、复制。
      </p>
    </div>
  );
}

const FIELD_LABELS: Record<InviteField, string> = {
  max_uses: "可用次数",
  initial_pages: "注册赠送页数",
  expires_in_days: "有效天数（留空不过期）",
  note: "备注（选填）",
};

export function AdminInvitesView({ api = defaultInvitesApi, onOpenUser }: { api?: InvitesApi; onOpenUser: (userId: string) => void }) {
  const [invites, setInvites] = useState<InviteView[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<InviteForm>(EMPTY_INVITE_FORM);
  const [formError, setFormError] = useState<{ field: InviteField | ""; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<InviteView | null>(null);
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<InviteDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [revoking, setRevoking] = useState<InviteView | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    try {
      const view = await api.list();
      setInvites(view.invites || []);
      setLoadError("");
    } catch (err) {
      setLoadError(authErrorText(err, "读取邀请码失败。"));
    }
  }, [api]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!openId) return;
    let alive = true;
    setDetail(null);
    setDetailError("");
    api.detail(openId).then(
      (next) => { if (alive) setDetail(next); },
      (err) => { if (alive) setDetailError(authErrorText(err, "读取邀请码详情失败。")); },
    );
    return () => { alive = false; };
  }, [api, openId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    const problem = inviteFormProblem(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const invite = await api.create(inviteInput(form));
      setIssued(invite);
      setForm({ ...EMPTY_INVITE_FORM });
      await reload();
    } catch (err) {
      setFormError({ field: inviteErrorField(err), message: authErrorText(err, "生成邀请码失败。") });
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke() {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      const updated = await api.revoke(revoking.invite_id);
      setNotice(`邀请码 ${updated.code} 已作废。`);
      setRevoking(null);
      await reload();
      if (openId === updated.invite_id) setDetail((prev) => (prev ? { ...prev, invite: updated } : prev));
    } catch (err) {
      setNotice(authErrorText(err, "作废失败。"));
      setRevoking(null);
    } finally {
      setRevokeBusy(false);
    }
  }

  const field = (key: InviteField, input: ReactNode) => (
    <label className={`admin-field${key === "note" ? " admin-field-wide" : ""}`} data-invite-field={key}>
      <span>{FIELD_LABELS[key]}</span>
      {input}
      {formError?.field === key ? <span className="auth-error" role="alert">{formError.message}</span> : null}
    </label>
  );

  return (
    <section className="admin-section" data-admin-invites="true">
      <header className="admin-section-head">
        <div>
          <h1>邀请码</h1>
          <p className="admin-sub">把邀请码或注册链接发给对方，对方在登录页点「用邀请码注册」，自己设用户名和密码。新账号默认 0 页，可以给邀请码设赠送页数。</p>
        </div>
      </header>

      {issued ? <IssuedInvite invite={issued} onDismiss={() => setIssued(null)} /> : null}

      <form className="admin-card" data-admin-form="create-invite" onSubmit={onCreate}>
        <h2>生成邀请码</h2>
        <div className="admin-fields admin-fields-4">
          {field("max_uses", <input inputMode="numeric" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />)}
          {field("initial_pages", <input inputMode="numeric" value={form.initialPages} onChange={(e) => setForm({ ...form, initialPages: e.target.value })} />)}
          {field("expires_in_days", <input inputMode="numeric" placeholder="不过期" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })} />)}
          {field("note", <input maxLength={200} placeholder="比如「张老师课题组」，方便以后认" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />)}
        </div>
        {formError && !formError.field ? <p className="auth-error" role="alert">{formError.message}</p> : null}
        <div className="admin-card-foot">
          <button type="submit" className="auth-primary" disabled={creating}>{creating ? "正在生成…" : "生成邀请码"}</button>
        </div>
      </form>

      {notice ? <p className="auth-ok" role="status">{notice}</p> : null}
      {loadError ? <p className="auth-error" role="alert">{loadError}</p> : null}
      {invites === null && !loadError ? <p className="admin-sub">正在读取邀请码…</p> : null}
      {invites && invites.length === 0 ? <p className="admin-empty">还没有邀请码。</p> : null}

      {invites?.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>邀请码</th><th>状态</th><th className="admin-num">已用 / 总次数</th><th className="admin-num">赠送页数</th>
                <th>过期时间</th><th>备注</th><th>创建时间</th><th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const open = openId === invite.invite_id;
                return (
                  <Fragment key={invite.invite_id}>
                    <tr data-admin-invite={invite.code} data-status={invite.status}>
                      <td>
                        <code className="admin-invite-code">{invite.code}</code>
                        <span className="admin-invite-copy">
                          <CopyButton text={invite.code} label="复制" />
                          <CopyButton text={buildInviteLink(invite.code)} label="复制链接" copiedLabel="链接已复制" />
                        </span>
                      </td>
                      <td><span className="admin-status" data-status={invite.status}>{inviteStatusLabel(invite.status)}</span></td>
                      <td className="admin-num">{invite.used_count} / {invite.max_uses}</td>
                      <td className="admin-num">{invite.initial_pages ? `${invite.initial_pages} 页` : "—"}</td>
                      <td>{formatWhen(invite.expires_at, "不过期")}</td>
                      <td className="admin-invite-note" title={invite.note}>{invite.note || "—"}</td>
                      <td>{formatWhen(invite.created_at)}</td>
                      <td className="admin-row-actions">
                        <button type="button" className="auth-link" aria-expanded={open} data-admin-action="invite-detail" onClick={() => setOpenId(open ? "" : invite.invite_id)}>
                          {open ? "收起" : "详情"}
                        </button>
                        {canRevokeInvite(invite) ? (
                          <button type="button" className="auth-link admin-danger-link" data-admin-action="revoke-invite" onClick={() => setRevoking(invite)}>作废</button>
                        ) : null}
                      </td>
                    </tr>
                    {open ? (
                      <tr className="admin-detail-row">
                        <td colSpan={8} data-admin-invite-detail={invite.code}>
                          {detailError ? <p className="auth-error" role="alert">{detailError}</p> : null}
                          {!detail && !detailError ? <p className="admin-sub">正在读取…</p> : null}
                          {detail ? (
                            detail.users.length ? (
                              <div>
                                <p className="admin-sub">用这个邀请码注册的账号（{detail.users.length} 个）：</p>
                                <ul className="admin-invite-users">
                                  {detail.users.map((u) => (
                                    <li key={u.user_id}>
                                      <button type="button" className="admin-user-link" onClick={() => onOpenUser(u.user_id)}>{u.username}</button>
                                      {u.deleted ? <span className="admin-muted">（已删除）</span> : null}
                                      <span className="admin-muted"> · {formatWhen(u.created_at)} 注册</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : <p className="admin-sub">还没有人用这个邀请码注册。</p>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        id="admin-revoke-invite"
        open={Boolean(revoking)}
        onOpenChange={(next) => { if (!next) setRevoking(null); }}
        pending={revokeBusy}
        tone="danger"
        title={revoking ? `作废邀请码 ${revoking.code}？` : "作废邀请码"}
        confirmLabel="作废"
        onConfirm={onRevoke}
        description={<p>作废后不能再用来注册，已经注册的账号不受影响。</p>}
      />
    </section>
  );
}
