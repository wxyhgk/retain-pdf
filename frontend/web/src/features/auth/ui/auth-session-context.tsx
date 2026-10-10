// 当前页面的登录会话（启动时由 auth-gate 定下来），往下传给设置页等需要分单机 / 多用户、管理员 / 普通用户的地方。
import { createContext, useContext, type ReactNode } from "react";
import type { AuthSessionView } from "@retainpdf/api/auth";

const AuthSessionContext = createContext<AuthSessionView | null>(null);

export function AuthSessionProvider({ session, children }: { session: AuthSessionView | null; children: ReactNode }) {
  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

/** 没有 Provider（测试、单机老入口）时当单机处理。 */
export function useAuthSession(): AuthSessionView {
  return useContext(AuthSessionContext) ?? { mode: "single", authenticated: true, user: null };
}

// 多用户模式下首页的「AI 问答」先藏起来（所有人）：助手能在服务器上执行命令、读全部数据，
// 还没按用户隔离。等数据隔离做完、改用服务器配置再放开。
export const MULTI_USER_HIDDEN_HOME_TABS: readonly string[] = ["ask"];

/** 首页顶部页签在当前模式下看不看得到。 */
export function useHomeTabVisible(): (key: string) => boolean {
  const multi = useAuthSession().mode === "multi";
  return (key) => !(multi && MULTI_USER_HIDDEN_HOME_TABS.includes(key));
}

/** 被藏的页签（比如 ?tab=ask 深链）落回图书馆。 */
export function useVisibleHomeTab(tab: string): string {
  return useHomeTabVisible()(tab) ? tab : "library";
}
