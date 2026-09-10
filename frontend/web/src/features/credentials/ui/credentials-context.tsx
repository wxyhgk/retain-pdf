// 凭据功能自带的 React 上下文。
//
// 本功能的组件树有四层（Workbench / Dialog / ProviderPanels / HiddenInputs），
// 逐层传 prop 过于侵入，故由功能自己持有 context；页面只负责在挂载点提供值
// （见 HomeApp 的 CredentialsProviderSlot）。这样功能不 import 任何页面模块，
// 也能被 detail/reader 或测试独立挂载。

import { createContext, useContext, type ReactNode } from "react";

export type CredentialsServices = {
  /** browser.ts 的 mount 返回值（保存/校验/打开弹窗等能力）。 */
  feature: any;
  /** credentials-view-store 的视图态与 handlersRef/ref 集合。 */
  view: any;
  /** 弹窗开合。 */
  dialogStore: any;
  /** 凭据状态 store，组件按切片订阅。 */
  credentialsStatePort: any;
  /** 从弹窗跳到「设置 → API 设置」。 */
  openSettingsHubApiTab?: () => void;
};

const CredentialsServicesContext = createContext<CredentialsServices | null>(null);

export function CredentialsProvider({
  value,
  children,
}: {
  value: CredentialsServices;
  children?: ReactNode;
}) {
  return (
    <CredentialsServicesContext.Provider value={value}>
      {children}
    </CredentialsServicesContext.Provider>
  );
}

export function useCredentialsServices(): CredentialsServices {
  const value = useContext(CredentialsServicesContext);
  if (!value) {
    throw new Error("credentials 功能的组件必须挂在 <CredentialsProvider> 之内");
  }
  return value;
}
