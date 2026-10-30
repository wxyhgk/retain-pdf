// 编辑部演示页 React 入口（产物 dist/editorial.bundle.js，由 editorial.html 挂载）。
// 只用模拟事件回放，不调后端接口。默认是给用户看的简洁画面；
// ?debug=1 换成完整信息 + 回放按钮；?scenario=quota 直接打开「额度用完停下」的场景。

import { EditorialRoomDemo } from "@/features/editorial-room/index.js";
import { mountShellPage } from "../shell-boot.js";

const params = new URLSearchParams(globalThis.location?.search || "");
const scenario = params.get("scenario") === "quota" ? "quota" : "full";
const debug = params.get("debug") === "1";

mountShellPage("editorial-root", <EditorialRoomDemo initialScenario={scenario} debug={debug} />);
