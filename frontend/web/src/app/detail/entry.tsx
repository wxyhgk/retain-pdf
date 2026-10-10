// detail 页 React 入口（产物 dist/detail.bundle.js，由 detail.html 挂载）。
// 启动顺序见 src/pages/shell-boot.ts：adapters → bootTheme → 找根 → 挂载（不开 StrictMode）。
// 业务组装（一行）：<DetailApp getJobId={parseDetailJobId 契约} />；缺根不挂载（旧语义）。

import { DetailApp } from "./DetailApp.jsx";
import { parseDetailJobId } from "@/platform/navigation/pages.js";
import { mountShellPage } from "../shell-boot.js";
import { resolveAuthGate } from "@/features/auth/index.js";

// 多用户模式下没登录（或要先改密码）就回首页去登录；单机模式照旧直接挂载。
void resolveAuthGate().then((gate) => {
  if (gate.kind === "login" || gate.kind === "change_password") {
    globalThis.location?.replace("./index.html");
    return;
  }
  mountShellPage("detail-root", <DetailApp getJobId={() => parseDetailJobId()} />);
});
