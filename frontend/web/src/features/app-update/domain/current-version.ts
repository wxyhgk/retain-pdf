// app-update 功能内唯一的 APP_VERSION 出口。
//
// architecture-boundaries 门禁禁止 UI 层直接 import 生成产物(js/generated/**)。
// 功能的 domain/ 是被认可的基础设施出口:由它做这一层薄 re-export,
// ui/ 侧从 domain 拿版本号,不复制字面量、不绕过门禁,
// 版本号更新脚本(generate-app-version.mjs)改一处两边同时生效。

export { APP_VERSION } from "@/platform/generated/app-version.js";
