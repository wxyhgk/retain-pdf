// @retainpdf/whiteboard —— 学习系统的白板讲解板（docs/ops/planning/learning-system/20261125-白板讲解板.md）。
// 只渲染讲解脚本，不认识阅读器、不认识后端。
export { KNOWN_OPS } from "./script/types.js";
export { SCRIPT_LIMITS, validateScript } from "./script/validate.js";
export { layoutScript, LAYOUT } from "./layout/layout.js";
export { FONT_SIZE, textWidth, wrapText } from "./layout/measure.js";
export { frameAt, opDuration, stepTimeline, TIMING } from "./render/frame.js";
export { cachedMath, prepareMath, sanitizeMathSvg, loadMathEngine, mathEngineReady, mathHtmlNow, setWhiteboardMathEngine, } from "./math/engine.js";
export { BoardSvg } from "./react/BoardSvg.js";
export { Whiteboard } from "./react/Whiteboard.js";
export { applyCompletion, backslashesBefore, completeLatex, completionQuery, deleteBracePair, latexCommands, nextSlot, typeBrace, } from "./math/latex-assist.js";
export { findMath, mathAtCaret, renderMathMarkdown } from "./markdown/math-markdown.js";
export { BOARD_ZOOM, NOTE_WIDTH, addNote, bringToFront, clampZoom, emptyBoard, fitView, panBy, parseBoard, removeItem, screenToWorld, updateItem, zoomAt, } from "./board/board-state.js";
export { applyTextEdit, planBackspace, planBrace, planDollar, planTab } from "./board/math-typing.js";
export { MathMarkdownEditor } from "./board/MathMarkdownEditor.js";
export { Board } from "./board/Board.js";
export { loadBoard, saveBoard, useBoardStorage } from "./board/storage.js";
