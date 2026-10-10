// 设置 ·「账号管理」（多用户模式、管理员）：建账号、重置密码、停用 / 启用。
// 不开放注册：初始密码由系统生成，只在这里显示一次，管理员复制下来交给用户；用户首次登录要改密码。
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  setAdminUserEnabled,
  type AdminUserView,
  type AuthRole,
} from "@retainpdf/api/auth";
import { formatZhDateTime } from "@/platform/utils/datetime.js";
import { authErrorText, USERNAME_PATTERN } from "../domain/auth-errors.js";

export type AdminUsersApi = {
  list: () => Promise<{ users: AdminUserView[] }>;
  create: (username: string, role: AuthRole) => Promise<{ user: AdminUserView; initial_password: string }>;
  reset: (userId: string) => Promise<{ initial_password: string }>;
  setEnabled: (userId: string, enabled: boolean) => Promise<{ user: AdminUserView }>;
};

const defaultApi: AdminUsersApi = {
  list: () => listAdminUsers(),
  create: (username, role) => createAdminUser(username, role),
  reset: (userId) => resetAdminUserPassword(userId),
  setEnabled: (userId, enabled) => setAdminUserEnabled(userId, enabled),
};

function when(value: string | null | undefined): string {
  if (!value) return "从未登录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatZhDateTime(date);
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AdminUsersPanel({ api = defaultApi, currentUserId = "" }: { api?: AdminUsersApi; currentUserId?: string }) {
  const [users, setUsers] = useState<AdminUserView[] | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<AuthRole>("user");
  const [busy, setBusy] = useState("");
  const [issued, setIssued] = useState<{ username: string; password: string; copied: boolean } | null>(null);

  const reload = useCallback(async () => {
    try {
      const view = await api.list();
      setUsers(view.users || []);
      setError("");
    } catch (err) {
      setError(authErrorText(err, "读取账号列表失败。"));
    }
  }, [api]);

  useEffect(() => { void reload(); }, [reload]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy("");
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const name = username.trim();
    if (!USERNAME_PATTERN.test(name)) {
      setError("用户名 3～32 位，只能用字母、数字、点、下划线、连字符。");
      return;
    }
    await run("create", async () => {
      const result = await api.create(name, role);
      setIssued({ username: result.user?.username || name, password: result.initial_password, copied: false });
      setUsername("");
      setRole("user");
      await reload();
    });
  }

  return (
    <div className="auth-admin" data-auth-admin="true">
      {issued ? (
        <div className="auth-issued" role="status" data-auth-issued="true">
          <p><strong>{issued.username}</strong> 的初始密码（只显示这一次，请复制下来交给他）：</p>
          <div className="auth-issued-row">
            <code className="auth-issued-password">{issued.password}</code>
            <button
              type="button"
              className="auth-secondary"
              onClick={async () => setIssued({ ...issued, copied: await copy(issued.password) })}
            >
              {issued.copied ? "已复制" : "复制"}
            </button>
            <button type="button" className="auth-link" onClick={() => setIssued(null)}>我已记下</button>
          </div>
          <p className="auth-sub">他第一次登录时会被要求改成自己的密码。</p>
        </div>
      ) : null}

      <form className="auth-admin-create" onSubmit={onCreate} data-auth-form="create-user">
        <input
          aria-label="新账号的用户名"
          placeholder="新账号的用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <select aria-label="身份" value={role} onChange={(e) => setRole(e.target.value as AuthRole)}>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <button type="submit" className="auth-primary" disabled={busy === "create"}>{busy === "create" ? "正在创建…" : "创建账号"}</button>
      </form>

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {users === null ? <p className="auth-sub">正在读取账号…</p> : null}
      {users?.length ? (
        <table className="auth-admin-table">
          <thead>
            <tr><th>用户名</th><th>身份</th><th>状态</th><th>最近登录</th><th aria-label="操作" /></tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const self = user.user_id === currentUserId;
              const disabled = user.status === "disabled";
              return (
                <tr key={user.user_id} data-auth-user={user.username} data-status={user.status}>
                  <td>{user.username}{self ? "（我）" : ""}</td>
                  <td>{user.role === "admin" ? "管理员" : "普通用户"}</td>
                  <td>{disabled ? "已停用" : user.must_change_password ? "待改密码" : "正常"}</td>
                  <td>{when(user.last_login_at)}</td>
                  <td className="auth-admin-actions">
                    <button
                      type="button"
                      className="auth-link"
                      disabled={Boolean(busy)}
                      onClick={() => run(`reset:${user.user_id}`, async () => {
                        const result = await api.reset(user.user_id);
                        setIssued({ username: user.username, password: result.initial_password, copied: false });
                        await reload();
                      })}
                    >
                      重置密码
                    </button>
                    {self ? null : (
                      <button
                        type="button"
                        className="auth-link"
                        disabled={Boolean(busy)}
                        onClick={() => run(`toggle:${user.user_id}`, async () => {
                          await api.setEnabled(user.user_id, disabled);
                          await reload();
                        })}
                      >
                        {disabled ? "启用" : "停用"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
