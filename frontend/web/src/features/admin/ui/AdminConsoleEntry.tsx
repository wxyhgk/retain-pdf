// 设置 ·「账号管理」：账号管理挪到了单独的管理后台页面，这里只给入口。
import { buildAdminUrl } from "@/platform/navigation/pages.js";

export function AdminConsoleEntry() {
  return (
    <div className="auth-account" data-admin-entry="true">
      <p className="auth-sub">建账号、重置密码、停用 / 删除、改身份、发放页数、查看每个账号的用量和任务，都在管理后台里。</p>
      <p><a className="auth-primary" href={buildAdminUrl()} target="_blank" rel="noopener">打开管理后台</a></p>
    </div>
  );
}
