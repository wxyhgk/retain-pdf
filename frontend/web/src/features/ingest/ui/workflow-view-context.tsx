// 「添加 PDF」弹窗的工作流视图（术语表、翻译质量、排版引擎、仅 OCR 等用户选项）由本功能
// 自带的 context 下发，页面只在最外层提供一次值（同 credentials 的 CredentialsProvider）。
//
// 以前它走主页的窄口：同一组方法在 ui/context 的值类型、app 的两份类型、
// build-home-services 的逐个对接里各写一遍 —— ui 层不许 import 功能类型，只能手抄。
// 加一个「排版引擎」下拉要改 9 个文件。现在功能内的组件直接拿到完整、带类型的对象，
// 加选项不用碰功能外面的任何文件。

import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";

import type { createWorkflowViewFeature } from "../domain/workflow-view-store.js";
import type { UploadViewStore } from "../domain/upload-store.js";
import type { mountWorkflowFeature } from "../domain/workflow/controller.js";
import type { mountUploadFeature } from "../domain/upload/controller.js";

export type IngestWorkflowView = ReturnType<typeof createWorkflowViewFeature>;

const IngestWorkflowViewContext = createContext<IngestWorkflowView | null>(null);

export function IngestWorkflowViewProvider({ value, children }: { value: IngestWorkflowView; children: ReactNode }) {
  return createElement(IngestWorkflowViewContext.Provider, { value }, children);
}

export function useIngestWorkflowView(): IngestWorkflowView {
  const value = useContext(IngestWorkflowViewContext);
  if (!value) throw new Error("useIngestWorkflowView 需要外层 IngestWorkflowViewProvider");
  return value;
}

// ── 上传视图与两个功能对象，同样只被本功能的组件用 ──
//
// 以前走 ui/context 的窄口：上传视图的 store 在 app 层被抹成只读 store，到了这里又得
// `as unknown as UploadViewStore` 转回来才能调 actions（四处）；功能对象是 any。

/** 功能注册表里本功能的两样。注册表是组合根里的可变对象，组件在调用时才读。 */
export type IngestFeatures = {
  workflowFeature?: ReturnType<typeof mountWorkflowFeature>;
  uploadFeature?: ReturnType<typeof mountUploadFeature>;
};

export type IngestServices = {
  uploadViewStore: UploadViewStore;
  features: IngestFeatures;
};

const IngestServicesContext = createContext<IngestServices | null>(null);

export function IngestServicesProvider({ value, children }: { value: IngestServices; children: ReactNode }) {
  return createElement(IngestServicesContext.Provider, { value }, children);
}

export function useIngestServices(): IngestServices {
  const value = useContext(IngestServicesContext);
  if (!value) throw new Error("useIngestServices 需要外层 IngestServicesProvider");
  return value;
}
