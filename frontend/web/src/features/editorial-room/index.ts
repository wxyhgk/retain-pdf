// editorial-room —— 翻译编辑部：翻译 agent 各角色分工合作、一页稿子怎么流转的可视化。
//
// 数据只认 editorial.v1 事件（后端翻译 agent 以后按这个推进度，现在用模拟数据回放）。
//
// domain/ 事件解析、事件叠成状态、旁白文案、模拟进度、回放节奏（纯逻辑，不碰 React）
// ui/     给用户看的简洁画面 EditorialStage、完整信息的调试视图 EditorialRoom、
//         回放 EditorialRoomReplay（默认简洁、debug 时完整 + 按钮）、演示页 EditorialRoomDemo

export {
  EDITORIAL_EVENT_VERSION,
  parseEditorialEvent,
  parseEditorialEvents,
} from "./domain/events.js";
export type { EditorialEvent, EditorialEventType } from "./domain/events.js";
export {
  initialRoomState,
  reduceEditorialEvent,
  roomStateAt,
  roomTotals,
} from "./domain/room-state.js";
export type { RoomState, RoomTotals, PageCard, PageStage } from "./domain/room-state.js";
export { buildDemoEditorialRun } from "./domain/demo-run.js";
export { EditorialStage } from "./ui/EditorialStage.jsx";
export { EditorialRoom } from "./ui/EditorialRoom.jsx";
export type { EditorialRoomProps } from "./ui/EditorialRoom.jsx";
export { EditorialRoomReplay } from "./ui/EditorialRoomReplay.jsx";
export { EditorialRoomDemo } from "./ui/EditorialRoomDemo.jsx";
