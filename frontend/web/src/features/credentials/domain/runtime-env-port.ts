const defaultRuntimeEnvAdapter = Object.freeze({
  isDesktopMode: (targetState) => Boolean(targetState?.desktopMode),
});

export function createCredentialRuntimeEnvPort(
  targetState,
  adapter = defaultRuntimeEnvAdapter,
) {
  return Object.freeze({
    isDesktopMode: () => adapter.isDesktopMode(targetState),
  });
}
