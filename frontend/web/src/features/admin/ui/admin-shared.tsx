// 管理后台几处共用的小件：时间显示、只显示一次的初始密码。
import { useState } from "react";
import { formatZhDateTime } from "@/platform/utils/datetime.js";

export function formatWhen(value: string | null | undefined, empty = "—"): string {
  if (!value) return empty;
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

/** 新建账号、重置密码后给出的初始密码：只显示这一次，管理员复制下来交给用户。 */
export function IssuedPassword({ username, password, onDismiss }: { username: string; password: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="auth-issued" role="status" data-auth-issued="true">
      <p><strong>{username}</strong> 的初始密码（只显示这一次，请复制下来交给对方）：</p>
      <div className="auth-issued-row">
        <code className="auth-issued-password">{password}</code>
        <button type="button" className="auth-secondary" onClick={async () => setCopied(await copy(password))}>
          {copied ? "已复制" : "复制"}
        </button>
        <button type="button" className="auth-link" onClick={onDismiss}>我已记下</button>
      </div>
      <p className="auth-sub">对方第一次登录时会被要求改成自己的密码。</p>
    </div>
  );
}
