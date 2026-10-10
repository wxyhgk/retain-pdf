// 多用户模式的登录界面（没有注册、没有找回密码：账号由管理员建，忘了密码找管理员重置）。
// 首次登录 / 密码被重置过的账号，登录后接着强制改密码（forcePassword）。
import { useState, type FormEvent } from "react";
import { changePassword, login, logout } from "@retainpdf/api/auth";
import { authErrorText } from "../domain/auth-errors.js";
import { ChangePasswordForm } from "./ChangePasswordForm.jsx";

const reload = () => globalThis.location?.reload();

export function LoginScreen({
  submit = login,
  onSuccess = reload,
}: {
  submit?: (username: string, password: string) => Promise<unknown>;
  onSuccess?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("请填用户名和密码。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(authErrorText(err, "登录失败，请稍后再试。"));
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen" data-auth-screen="login">
      <section className="auth-card" aria-label="登录">
        <h1>RetainPDF</h1>
        <p className="auth-sub">请用管理员给你的账号登录。</p>
        <form className="auth-form" onSubmit={onSubmit} data-auth-form="login">
          <label className="auth-field">
            <span>用户名</span>
            <input autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>密码</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? "正在登录…" : "登录"}</button>
        </form>
        <p className="auth-foot">忘了密码请联系管理员重置。</p>
      </section>
    </main>
  );
}

export function ForcedPasswordScreen({
  username = "",
  submit = changePassword,
  onDone = reload,
  onLogout = () => { void logout().finally(reload); },
}: {
  username?: string;
  submit?: (current: string, next: string) => Promise<unknown>;
  onDone?: () => void;
  onLogout?: () => void;
}) {
  return (
    <main className="auth-screen" data-auth-screen="change-password">
      <section className="auth-card" aria-label="设置新密码">
        <h1>设置新密码</h1>
        <p className="auth-sub">{username ? `${username}，` : ""}管理员给的是初始密码，请先换成你自己的密码再开始使用。</p>
        <ChangePasswordForm submit={submit} onDone={onDone} submitLabel="保存并进入" currentLabel="初始密码" />
        <button type="button" className="auth-link" onClick={onLogout}>换一个账号登录</button>
      </section>
    </main>
  );
}

export function AuthErrorScreen({ message }: { message: string }) {
  return (
    <main className="auth-screen" data-auth-screen="error">
      <section className="auth-card" aria-label="出错了">
        <h1>RetainPDF</h1>
        <p className="auth-error" role="alert">{message}</p>
        <button type="button" className="auth-primary" onClick={reload}>重试</button>
      </section>
    </main>
  );
}
