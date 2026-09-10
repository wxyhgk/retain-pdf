// detail 页 React 入口（产物 dist/detail.bundle.js，由 detail.html 挂载）。
// 启动顺序见 src/pages/shell-boot.ts：adapters → bootTheme → 找根 → 挂载（不开 StrictMode）。
// 业务组装（一行）：<DetailApp getJobId={parseDetailJobId 契约} />；缺根不挂载（旧语义）。

import { DetailApp } from "./DetailApp.jsx";
import { parseDetailJobId } from "@/platform/navigation/pages.js";
import { mountShellPage } from "../shell-boot.js";

mountShellPage("detail-root", <DetailApp getJobId={() => parseDetailJobId()} />);
