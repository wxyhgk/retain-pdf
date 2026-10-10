// 改密码：账户页里用，首次登录强制改密码也用它。新密码至少 8 位；成功后其它设备的登录全部作废。
import { useState, type FormEvent } from "react";
import { changePassword } from "@retainpdf/api/auth";
import { authErrorText, MIN_PASSWORD_LENGTH, passwordProblem } from "../domain/auth-errors.js";

export function ChangePasswordForm({
  submit = changePassword,
  onDone,
  submitLabel = "修改密码",
  currentLabel = "当前密码",
}: {
  submit?: (current: string, next: string) => Promise<unknown>;
  onDone?: () => void;
  submitLabel?: string;
  currentLabel?: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    const problem = !current ? `请填${currentLabel}。` : passwordProblem(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(authErrorText(err, "改密码失败，请确认当前密码是否正确。"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} data-auth-form="change-password">
      <label className="auth-field">
        <span>{currentLabel}</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="auth-field">
        <span>新密码（至少 {MIN_PASSWORD_LENGTH} 位）</span>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="auth-field">
        <span>再输一次新密码</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {done ? <p className="auth-ok">密码已修改，其它设备上的登录已全部退出。</p> : null}
      <button type="submit" className="auth-primary" disabled={busy}>{busy ? "正在提交…" : submitLabel}</button>
    </form>
  );
}
