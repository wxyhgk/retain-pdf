// @retainpdf/ask 的主出口：只有类型和不带 React 的小函数，宿主随便引不会拉进窗口那一大块。
// - 窗口：`@retainpdf/ask/window`（React，单独一块，宿主懒加载）。
// - ACP WebSocket 连接：`@retainpdf/ask/acp`（宿主拼好地址交给它）。
// 说明见 ../README.md。
export {};
