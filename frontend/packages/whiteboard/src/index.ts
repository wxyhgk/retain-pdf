// @retainpdf/whiteboard —— 学习系统的白板讲解板（docs/ops/planning/learning-system/20261125-白板讲解板.md）。
// 只渲染讲解脚本，不认识阅读器、不认识后端。

export type {
  ArrowOp,
  BoardOp,
  BoardScript,
  BoardStep,
  EraseOp,
  FocusOp,
  KnownOp,
  LevelsOp,
  MarkOp,
  NoteOp,
  Placement,
  Tone,
  UnknownOp,
  WriteOp,
} from "./script/types.js";
export { KNOWN_OPS } from "./script/types.js";
export { SCRIPT_LIMITS, validateScript, type ValidatedScript } from "./script/validate.js";
export { layoutScript, LAYOUT, type Box, type BoardLayout, type MathSizer } from "./layout/layout.js";
export { FONT_SIZE, textWidth, wrapText, type RenderedMath, type Size } from "./layout/measure.js";
export { frameAt, opDuration, stepTimeline, TIMING, type Frame, type FrameItem } from "./render/frame.js";
export {
  cachedMath,
  prepareMath,
  sanitizeMathSvg,
  loadMathEngine,
  mathEngineReady,
  mathHtmlNow,
  setWhiteboardMathEngine,
  type MathHtml,
  type WhiteboardMathEngine,
  type WhiteboardMathEngineLoader,
} from "./math/engine.js";
export { BoardSvg, type MathLookup } from "./react/BoardSvg.js";
export { Whiteboard, type WhiteboardProps } from "./react/Whiteboard.js";
export {
  applyCompletion,
  backslashesBefore,
  completeLatex,
  completionQuery,
  deleteBracePair,
  latexCommands,
  nextSlot,
  typeBrace,
  type LatexCommand,
  type LatexEdit,
} from "./math/latex-assist.js";
export { findMath, mathAtCaret, renderMathMarkdown, type MathSegment } from "./markdown/math-markdown.js";
export {
  BOARD_ZOOM,
  NOTE_WIDTH,
  addNote,
  bringToFront,
  clampZoom,
  emptyBoard,
  fitView,
  panBy,
  parseBoard,
  removeItem,
  screenToWorld,
  updateItem,
  zoomAt,
  type BoardDoc,
  type BoardItem,
  type BoardNote,
  type BoardView,
} from "./board/board-state.js";
export { applyTextEdit, planBackspace, planBrace, planDollar, planTab, type TextEdit } from "./board/math-typing.js";
export { MathMarkdownEditor, type MathMarkdownEditorProps } from "./board/MathMarkdownEditor.js";
export { Board, type BoardProps } from "./board/Board.js";
export { loadBoard, saveBoard, useBoardStorage } from "./board/storage.js";
