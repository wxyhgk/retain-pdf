// @retainpdf/whiteboard —— 学习系统的白板讲解板（docs/ops/planning/learning-system/20261125-白板讲解板.md）。
// 只渲染讲解脚本，不认识阅读器、不认识后端。
export { KNOWN_OPS } from "./script/types.js";
export { SCRIPT_LIMITS, validateScript } from "./script/validate.js";
export { layoutScript, LAYOUT } from "./layout/layout.js";
export { FONT_SIZE, textWidth, wrapText } from "./layout/measure.js";
export { frameAt, opDuration, stepTimeline, TIMING } from "./render/frame.js";
export { cachedMath, prepareMath, sanitizeMathSvg, setWhiteboardMathEngine, } from "./math/engine.js";
export { BoardSvg } from "./react/BoardSvg.js";
export { Whiteboard } from "./react/Whiteboard.js";
