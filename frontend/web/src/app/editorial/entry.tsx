// 编辑部演示页 React 入口（产物 dist/editorial.bundle.js，由 editorial.html 挂载）。
// 只用模拟事件回放，不调后端接口；?scenario=quota 直接打开「额度用完停下」的场景。

import { EditorialRoomDemo } from "@/features/editorial-room/index.js";
import { mountShellPage } from "../shell-boot.js";

const scenario = new URLSearchParams(globalThis.location?.search || "").get("scenario") === "quota" ? "quota" : "full";

mountShellPage("editorial-root", <EditorialRoomDemo initialScenario={scenario} />);
