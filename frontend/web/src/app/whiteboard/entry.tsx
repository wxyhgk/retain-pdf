// 白板讲解板演示页 React 入口（产物 dist/whiteboard.bundle.js，由 whiteboard.html 挂载）。
// 只用写死的讲解脚本，不调后端接口。

import { WhiteboardDemo } from "./WhiteboardDemo.js";
import { mountShellPage } from "../shell-boot.js";

mountShellPage("whiteboard-root", <WhiteboardDemo />);
