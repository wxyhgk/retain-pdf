// auth —— 商业版多用户：启动时的登录检查、登录 / 强制改密码界面、设置里的「账户」与「账号管理」。
// 单机模式下这些都不出现，行为和以前完全一样。
//
// domain/ 启动检查（auth-gate）与错误文案
// ui/     登录界面、改密码、账户页、账号管理、会话 context

export { createUnauthorizedHandler, hiddenSettingsTabs, resolveAuthGate, isAdmin, isMultiUser, type AuthGate } from "./domain/auth-gate.js";
export { AuthErrorScreen, ForcedPasswordScreen, LoginScreen } from "./ui/LoginScreen.jsx";
export { AccountPanel } from "./ui/AccountPanel.jsx";
export { PageLedger } from "./ui/PageLedger.jsx";
export { authErrorText, USERNAME_PATTERN } from "./domain/auth-errors.js";
export { formatPageDelta, pageAdjustProblem, pageLedgerLabel } from "./domain/page-ledger.js";
export { buildInviteLink } from "./domain/register.js";
export { AuthSessionProvider, useAuthSession, useHomeTabVisible, useVisibleHomeTab } from "./ui/auth-session-context.jsx";

// 设置弹窗里这一栏的登记 / 图标（20261112-功能登记表）。
export { AccountSettingsIcon } from "./ui/settings-icon.jsx";
