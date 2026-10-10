// admin 页 React 入口（产物 dist/admin.bundle.js，由 admin.html 挂载）。
// 只给多用户模式下的管理员：没登录 / 要先改密码 / 不是管理员 / 单机模式，都回首页。

import { AdminApp } from "@/features/admin/index.js";
import { isAdmin, isMultiUser, resolveAuthGate } from "@/features/auth/index.js";
import { buildHomeUrl } from "@/platform/navigation/pages.js";
import { mountShellPage } from "../shell-boot.js";

void resolveAuthGate().then((gate) => {
  if (gate.kind !== "ready" || !isMultiUser(gate.session) || !isAdmin(gate.session)) {
    globalThis.location?.replace(buildHomeUrl());
    return;
  }
  mountShellPage("admin-root", <AdminApp session={gate.session} />);
});
