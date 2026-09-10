// 「首次配置模式」查询端口。默认值原指向已删除的旧视图层，改为必传。
export function createCredentialSetupModePort({ currentSetupMode }: any) {
  return { currentSetupMode };
}
