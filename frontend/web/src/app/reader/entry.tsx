// reader 页宿主入口（产物 dist/reader.bundle.js，由 reader.html 挂载）。
// shell-boot 副作用先注册 job-domain adapters，再注入 reader 宿主 adapters，
// 最后经公开 boot 入口显式启动（包内自带 bootTheme + 建根 + 挂载，不开 StrictMode）。
// 业务组装：入参归一化（三页统一契约）+ 一行 bootReader()。

import "../shell-boot.js";
import "./adapters/retainpdf.js";
import { bootReader } from "@retainpdf/reader/boot";
import { canonicalizeReaderSearch } from "@/platform/navigation/pages.js";
import { isMultiUser, resolveAuthGate } from "@/features/auth/index.js";
import { setReaderMultiUser } from "./adapters/retainpdf.js";

// 入参走三页统一契约：历史别名 ?page=&blockId= 由 pages 的解析真源归一成
// 运行时读取的 page_idx/block_id（replaceState，无刷新；无变化则跳过）。
try {
  const search = globalThis.location?.search || "";
  const canonical = canonicalizeReaderSearch(search);
  if (canonical !== null) {
    globalThis.history?.replaceState?.(
      null,
      "",
      `${globalThis.location.pathname}?${canonical}${globalThis.location.hash || ""}`,
    );
  }
} catch {
  /* 保持直启，解析失败不拦 boot */
}

// 多用户模式下没登录（或要先改密码）就回首页去登录；单机模式照旧直接启动。
// 多用户模式下助手终端整个关掉（后端也不开 /ai/terminal），见 adapters/retainpdf.ts 的 setReaderMultiUser。
void resolveAuthGate().then((gate) => {
  if (gate.kind === "login" || gate.kind === "change_password") {
    globalThis.location?.replace("./index.html");
    return;
  }
  if (gate.kind === "ready" && isMultiUser(gate.session)) setReaderMultiUser(true);
  bootReader();
});
