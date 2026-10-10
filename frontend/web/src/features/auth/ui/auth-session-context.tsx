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
