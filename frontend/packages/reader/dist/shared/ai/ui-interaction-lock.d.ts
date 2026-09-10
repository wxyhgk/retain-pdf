export declare function isReaderAiNavigationLocked(now?: number): boolean;
export declare function lockReaderAiNavigation(durationMs?: number): void;
/** 强制解除隔离（进页/异常时兜底，避免遮罩残留导致点不了） */
export declare function clearReaderAiNavigationLock(): void;
/**
 * 短时全屏吞指针 + 禁止跳页/开链。
 * 仅用于 AI 会话条切换 / 分支，时长应尽量短。
 */
export declare function armReaderAiClickShield(durationMs?: number, options?: {
    overlayDelayMs?: number;
}): void;
export declare function shouldIgnoreReaderAiNavEvent(event: Event | null | undefined): boolean;
/**
 * 仅在 AI 导航锁定期拦截 window.open / 链接默认行为。
 * 不永久 ban 同源导航，避免破坏正常打开阅读。
 */
export declare function installReaderWindowOpenGuard(): () => void;
//# sourceMappingURL=ui-interaction-lock.d.ts.map