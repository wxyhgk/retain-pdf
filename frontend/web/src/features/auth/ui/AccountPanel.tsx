// 设置 ·「账户」（多用户模式）：我是谁、剩余页数和最近的账目、改密码、退出。
import { fetchAccountPages, logout, type PageAccountView } from "@retainpdf/api/auth";
import { useEffect, useState } from "react";
import { authErrorText } from "../domain/auth-errors.js";
import { ChangePasswordForm } from "./ChangePasswordForm.jsx";
import { PageLedger } from "./PageLedger.jsx";
import { useAuthSession } from "./auth-session-context.jsx";

const ROLE_LABELS = { admin: "管理员", user: "普通用户" } as const;
// 放在模块里：默认值每次渲染都新建的话，useEffect 会反复重新请求。
const defaultLoadPages = () => fetchAccountPages();

function balanceText(pages: PageAccountView | null, error: string): string {
  if (pages?.unlimited) return "不限额";
  if (pages && pages.balance !== null) return `${pages.balance} 页`;
  return error ? "读取失败" : "…";
}

export function AccountPanel({
  doLogout = logout,
  afterLogout = () => globalThis.location?.reload(),
  loadPages = defaultLoadPages,
}: {
  doLogout?: () => Promise<unknown>;
  afterLogout?: () => void;
  loadPages?: () => Promise<PageAccountView>;
}) {
  const session = useAuthSession();
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<PageAccountView | null>(null);
  const [pagesError, setPagesError] = useState("");
  const user = session.user;

  useEffect(() => {
    let alive = true;
    loadPages().then(
      (view) => { if (alive) setPages(view); },
      (err) => { if (alive) setPagesError(authErrorText(err, "读取页数额度失败。")); },
    );
    return () => { alive = false; };
  }, [loadPages]);

  return (
    <div className="auth-account" data-auth-account="true">
      <dl className="auth-account-facts">
        <div><dt>用户名</dt><dd>{user?.username || "—"}</dd></div>
        <div><dt>身份</dt><dd>{user ? ROLE_LABELS[user.role] || user.role : "—"}</dd></div>
        <div><dt>剩余页数</dt><dd data-page-balance="true">{balanceText(pages, pagesError)}</dd></div>
      </dl>
      {pagesError ? <p className="auth-error" role="alert">{pagesError}</p> : null}
      {pages && !pages.unlimited ? (
        <section className="auth-account-section" data-page-account="true">
          <h4>页数账目</h4>
          <p className="auth-sub">每次提交按选中的页数扣；任务失败、取消或删除会全额退回，重新排版不扣页。页数由管理员发放。</p>
          <PageLedger entries={pages.entries || []} emptyText="还没有账目。新账号是 0 页，需要管理员发放后才能提交任务。" />
        </section>
      ) : null}
      <section className="auth-account-section">
        <h4>修改密码</h4>
        <ChangePasswordForm />
      </section>
      <section className="auth-account-section">
        <button
          type="button"
          className="auth-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await doLogout();
            } finally {
              afterLogout();
            }
          }}
        >
          {busy ? "正在退出…" : "退出登录"}
        </button>
      </section>
    </div>
  );
}
