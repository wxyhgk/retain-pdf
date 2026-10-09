type CredentialRuntimeEnvAdapter = {
  isDesktopMode: (targetState: unknown) => boolean;
};

const defaultRuntimeEnvAdapter: CredentialRuntimeEnvAdapter = Object.freeze({
  // targetState 是宿主态（unknown），这里只读取 desktopMode 字段。
  isDesktopMode: (targetState: unknown) => Boolean(
    (targetState as { desktopMode?: boolean } | null | undefined)?.desktopMode,
  ),
});

export function createCredentialRuntimeEnvPort(
  targetState: unknown,
  adapter: CredentialRuntimeEnvAdapter = defaultRuntimeEnvAdapter,
) {
  return Object.freeze({
    isDesktopMode: () => adapter.isDesktopMode(targetState),
  });
}
