const defaultRuntimeEnvAdapter = Object.freeze({
  isDesktopConfigured: (targetState) => Boolean(targetState?.desktopConfigured),
  isDesktopMode: (targetState) => Boolean(targetState?.desktopMode),
});

export function createAppActionsRuntimeEnvPort(
  targetState,
  adapter = defaultRuntimeEnvAdapter,
) {
  return Object.freeze({
    isDesktopConfigured: () => adapter.isDesktopConfigured(targetState),
    isDesktopMode: () => adapter.isDesktopMode(targetState),
  });
}
