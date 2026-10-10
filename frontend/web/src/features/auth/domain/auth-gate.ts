// 每个页面启动前先过这一道：单机模式和以前完全一样；多用户模式没登录就显示登录界面，
// 管理员刚建的号 / 刚重置过密码的号先强制改密码。演示模式直接放行。
import { resolveAuthSession, type AuthSessionView } from "@retainpdf/api/auth";
import { setApiUnauthorizedHandler } from "@retainpdf/api/http";
import { isMockMode } from "@/platform/config/runtime.js";

export type AuthGate =
  | { kind: "ready"; session: AuthSessionView }
  | { kind: "login"; session: AuthSessionView }
  | { kind: "change_password"; session: AuthSessionView }
  | { kind: "error"; message: string };

const SINGLE_SESSION: AuthSessionView = { mode: "single", authenticated: true, user: null };

export async function resolveAuthGate({
  resolve = resolveAuthSession,
  mock = isMockMode,
  onUnauthorized = () => globalThis.location?.reload(),
}: {
  resolve?: () => Promise<AuthSessionView>;
  mock?: () => boolean;
  onUnauthorized?: () => void;
} = {}): Promise<AuthGate> {
  if (mock()) return { kind: "ready", session: SINGLE_SESSION };
  let session: AuthSessionView;
  try {
    session = await resolve();
  } catch (error) {
    // 老后端没有 /auth/session（404）就是单机：照旧启动。其它错误（连不上）给一句话，不白屏。
    const status = Number((error as { status?: number } | null)?.status);
    if (status === 404) return { kind: "ready", session: SINGLE_SESSION };
    return { kind: "error", message: "连不上服务器，请稍后刷新重试。" };
  }
  if (session.mode !== "multi") return { kind: "ready", session };
  // 多用户：登录过期 / 被管理员踢下线时任何请求回 401，回到登录界面（刷新后这一道会拦住）。
  setApiUnauthorizedHandler(onUnauthorized);
  if (!session.authenticated || !session.user) return { kind: "login", session };
  if (session.user.must_change_password) return { kind: "change_password", session };
  return { kind: "ready", session };
}

export function isMultiUser(session: AuthSessionView | null | undefined): boolean {
  return session?.mode === "multi";
}

export function isAdmin(session: AuthSessionView | null | undefined): boolean {
  return session?.mode !== "multi" || session?.user?.role === "admin";
}

// 多用户模式下藏掉单机才有的设置分栏：普通用户看不到接口设置（凭证由服务器统一管）、同步、备份；
// 「更新」（检查桌面版更新、装命令行）对服务器部署没有意义，管理员也藏。单机模式什么都不藏。
const MULTI_USER_HIDDEN_TABS: readonly string[] = ["update"];
const MULTI_USER_NON_ADMIN_HIDDEN_TABS: readonly string[] = ["api", "sync", "backup", "update"];

export function hiddenSettingsTabs(session: AuthSessionView | null | undefined): readonly string[] {
  if (!isMultiUser(session)) return [];
  return isAdmin(session) ? MULTI_USER_HIDDEN_TABS : MULTI_USER_NON_ADMIN_HIDDEN_TABS;
}
