// 管理后台整页（admin.html）：左边导航，右边账号列表 / 单个账号。
// 看哪个账号记在地址栏 ?user=<user_id>，刷新、前进后退都对得上；列表一直挂着，返回时搜索和翻页还在。
import { useCallback, useEffect, useState } from "react";
import { logout, type AuthSessionView } from "@retainpdf/api/auth";
import { buildHomeUrl } from "@/platform/navigation/pages.js";
import { defaultAdminApi, type AdminApi } from "../domain/admin-api.js";
import { AdminUserDetailView } from "./AdminUserDetailView.jsx";
import { AdminUsersView } from "./AdminUsersView.jsx";

function readUserParam(): string {
  try {
    return `${new URLSearchParams(globalThis.location?.search || "").get("user") || ""}`.trim();
  } catch {
    return "";
  }
}

export function AdminApp({
  session,
  api = defaultAdminApi,
  doLogout = logout,
  afterLogout = () => globalThis.location?.replace(buildHomeUrl()),
}: {
  session: AuthSessionView;
  api?: AdminApi;
  doLogout?: () => Promise<unknown>;
  afterLogout?: () => void;
}) {
  const currentUserId = session.user?.user_id || "";
  const [userId, setUserId] = useState(readUserParam);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const onPop = () => setUserId(readUserParam());
    globalThis.addEventListener?.("popstate", onPop);
    return () => globalThis.removeEventListener?.("popstate", onPop);
  }, []);

  const openUser = useCallback((next: string) => {
    setUserId(next);
    const url = next ? `?user=${encodeURIComponent(next)}` : (globalThis.location?.pathname || "./admin.html");
    globalThis.history?.pushState?.(null, "", url);
    globalThis.scrollTo?.(0, 0);
  }, []);

  return (
    <div className="admin-app" data-admin-app="true">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="./src/assets/RetainPDF-logo.svg" alt="" width={22} height={22} />
          <span>RetainPDF 管理后台</span>
        </div>
        <nav className="admin-nav" aria-label="管理后台">
          <button type="button" className="admin-nav-item" aria-current="page" onClick={() => openUser("")}>账号</button>
        </nav>
        <div className="admin-sidebar-foot">
          <p className="admin-sub">当前：{session.user?.username || "—"}</p>
          <a className="auth-link" href={buildHomeUrl()}>返回首页</a>
          <button
            type="button"
            className="auth-link"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await doLogout();
              } finally {
                afterLogout();
              }
            }}
          >
            {loggingOut ? "正在退出…" : "退出登录"}
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div hidden={Boolean(userId)}>
          <AdminUsersView api={api} currentUserId={currentUserId} onOpenUser={openUser} refreshKey={refreshKey} />
        </div>
        {userId ? (
          <AdminUserDetailView
            api={api}
            userId={userId}
            currentUserId={currentUserId}
            onBack={() => openUser("")}
            onChanged={() => setRefreshKey((n) => n + 1)}
          />
        ) : null}
      </main>
    </div>
  );
}
