type AppActionsRuntimeEnvAdapter = {
  isDesktopConfigured: (targetState: unknown) => boolean;
  isDesktopMode: (targetState: unknown) => boolean;
};

const defaultRuntimeEnvAdapter: AppActionsRuntimeEnvAdapter = Object.freeze({
  // targetState 是宿主态（unknown），这里只读取对应的布尔字段。
  isDesktopConfigured: (targetState: unknown) => Boolean(
    (targetState as { desktopConfigured?: boolean } | null | undefined)?.desktopConfigured,
  ),
  isDesktopMode: (targetState: unknown) => Boolean(
    (targetState as { desktopMode?: boolean } | null | undefined)?.desktopMode,
  ),
});

export function createAppActionsRuntimeEnvPort(
  targetState: unknown,
  adapter: AppActionsRuntimeEnvAdapter = defaultRuntimeEnvAdapter,
) {
  return Object.freeze({
    isDesktopConfigured: () => adapter.isDesktopConfigured(targetState),
    isDesktopMode: () => adapter.isDesktopMode(targetState),
  });
}
