// auth —— 商业版多用户：启动时的登录检查、登录 / 强制改密码界面、设置里的「账户」与「账号管理」。
// 单机模式下这些都不出现，行为和以前完全一样。
//
// domain/ 启动检查（auth-gate）与错误文案
// ui/     登录界面、改密码、账户页、账号管理、会话 context

export { hiddenSettingsTabs, resolveAuthGate, isAdmin, isMultiUser, type AuthGate } from "./domain/auth-gate.js";
export { AuthErrorScreen, ForcedPasswordScreen, LoginScreen } from "./ui/LoginScreen.jsx";
export { AccountPanel } from "./ui/AccountPanel.jsx";
export { AdminUsersPanel } from "./ui/AdminUsersPanel.jsx";
export { AuthSessionProvider, useAuthSession, useHomeTabVisible, useVisibleHomeTab } from "./ui/auth-session-context.jsx";
