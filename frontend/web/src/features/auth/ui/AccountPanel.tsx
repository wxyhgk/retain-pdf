// 设置 ·「账户」（多用户模式）：我是谁、改密码、退出。余额和每本书的花费等计费上线后再加。
import { logout } from "@retainpdf/api/auth";
import { useState } from "react";
import { ChangePasswordForm } from "./ChangePasswordForm.jsx";
import { useAuthSession } from "./auth-session-context.jsx";

const ROLE_LABELS = { admin: "管理员", user: "普通用户" } as const;

export function AccountPanel({
  doLogout = logout,
  afterLogout = () => globalThis.location?.reload(),
}: {
  doLogout?: () => Promise<unknown>;
  afterLogout?: () => void;
}) {
  const session = useAuthSession();
  const [busy, setBusy] = useState(false);
  const user = session.user;
  return (
    <div className="auth-account" data-auth-account="true">
      <dl className="auth-account-facts">
        <div><dt>用户名</dt><dd>{user?.username || "—"}</dd></div>
        <div><dt>身份</dt><dd>{user ? ROLE_LABELS[user.role] || user.role : "—"}</dd></div>
      </dl>
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
