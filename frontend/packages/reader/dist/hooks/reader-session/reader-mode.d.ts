import type { ReaderMode } from "./types.js";
/** Keep body `reader-mode-*` in sync (legacy CSS + chrome). */
export declare function applyBodyReaderMode(mode: ReaderMode): void;
/**
 * 会话内部的无条件 mode 窄命令：同时写 state 与 body class。
 * 与 UI 入口 setMode（受 sourceViewOnly 约束）不同，会话解析/回退需要
 * 绕过该约束，因此各模块统一走这里，不再分别调用 setModeState + applyBodyReaderMode。
 */
export declare function applySessionMode(setModeState: React.Dispatch<React.SetStateAction<ReaderMode>>, mode: ReaderMode): void;
export declare function useReaderMode(sourceViewOnly: boolean): {
    mode: ReaderMode;
    setMode: (mode: ReaderMode) => void;
    setModeState: React.Dispatch<React.SetStateAction<ReaderMode>>;
    /** 窄命令：会话编排层切换 mode 的唯一入口（无条件，不受 sourceViewOnly 约束）。 */
    switchSessionMode: (mode: ReaderMode) => void;
};
//# sourceMappingURL=reader-mode.d.ts.map