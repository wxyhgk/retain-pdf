// 三页 MPA 共享启动壳：收敛 home/detail/reader 三份 entry 的重复样板。
//
// 各页业务组装仍留在自家 entry（一行）：
//   home   — createHomeComposition + <DecorStage />/<HomeApp />
//   detail — <DetailApp />
//   reader — bootReader()（包内自带 bootTheme + 建根，见 @retainpdf/reader/boot）
//
// 本文件只做三页完全相同的三件事（顺序固定）：
//   1. 副作用注册 job-domain adapters（必须在任何 composition 读包默认值之前）；
//   2. bootTheme() 尽早挂 data-theme，减少换肤 FOUC；
//   3. 按 rootId 找根（可选兜底创建）+ createRoot().render。
//
// 约定：不开 StrictMode。composition 含一次性事件绑定，双调用会重复
// dispatch；命令式复用件与 StrictMode 解耦是三页统一约定。

import "@/app/bootstrap/job-domain-adapters.js";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { bootTheme } from "@/ui/theme/theme.js";

export type ShellHostOptions = {
  // home/reader 缺根时兜底创建；detail 保持“缺根即不挂载”的旧语义，默认 false。
  createIfMissing?: boolean;
  body?: HTMLElement;
};

export function resolveShellHost(
  rootId: string,
  options: ShellHostOptions = {},
): HTMLElement | null {
  const doc = typeof document === "undefined" ? undefined : document;
  if (!doc) return null;
  const found = doc.getElementById(rootId);
  if (found) return found;
  if (!options.createIfMissing) return null;
  const host = doc.createElement("div");
  host.id = rootId;
  (options.body ?? doc.body).appendChild(host);
  return host;
}

// 不开 StrictMode：见文件头约定。
export function mountShellApp(host: HTMLElement, app: ReactNode): void {
  createRoot(host).render(app);
}

// 一行启动：bootTheme → 找根 → 挂载。缺根时静默跳过（detail 旧语义）。
export function mountShellPage(
  rootId: string,
  app: ReactNode,
  options: ShellHostOptions = {},
): void {
  bootTheme();
  const host = resolveShellHost(rootId, options);
  if (!host) return;
  mountShellApp(host, app);
}
