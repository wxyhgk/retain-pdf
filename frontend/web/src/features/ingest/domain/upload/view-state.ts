// upload 视图 store 的状态形状与默认态。
//
// 从 upload-store.ts 抽出：类型定义 + 初始状态工厂。动作在 view-actions.ts，
// store 组装在 view-store.ts，React 端口/派生在 view-feature.ts。

export type UploadViewState = {
  tileLocked: boolean;
  tileEnabled: boolean;
  ready: boolean;
  uploading: boolean;
  label: string;
  labelTitle: string;
  labelVisible: boolean;
  help: string;
  helpVisible: boolean;
  status: string;
  statusVisible: boolean;
  progressVisible: boolean;
  progressPercent: number;
  progressText: string;
  actionSlotVisible: boolean;
  inlinePageRangeVisible: boolean;
  pageRangeStart: string;
  pageRangeEnd: string;
  pageRangeMax: number;
  /** 传上去的 PDF 有几页（上传完写，0 = 还不知道）。上传弹窗的「页数」按钮用它判断「1 到最后一页」= 全部页。 */
  uploadedPageCount: number;
  translationOptionsOpen: boolean;
  credentialGateVisible: boolean;
};

export type UploadTileLockedOptions = {
  locked?: boolean;
  enabled?: boolean;
};

export type UploadTileTextOptions = {
  label?: string;
  labelTitle?: string;
  help?: string;
  status?: string;
  statusVisible?: boolean | null;
  labelVisible?: boolean;
  helpVisible?: boolean;
};

export type TranslationOptionsOpenOptions = {
  maxPage?: number;
};

export type UploadPageRangesWrite = {
  start?: string | number;
  end?: string | number;
};

export type UploadFileLabelSource = {
  name?: string;
} | null | undefined;

export type UploadDomRefs = {
  fileInput: HTMLInputElement | null;
};

// 初始值镜像 旧世界 HTML 骨架(已删除) 的静态骨架(水合前状态)
export function createInitialUploadViewState(): UploadViewState {
  return {
    tileLocked: false,
    tileEnabled: true,
    ready: false,
    uploading: false,
    label: "添加 PDF",
    labelTitle: "",
    labelVisible: true,
    help: "上传后会先完成文件校验，再进入任务处理。",
    helpVisible: true,
    status: "尚未选择文件",
    statusVisible: false,
    progressVisible: false,
    progressPercent: 0,
    progressText: "上传中",
    actionSlotVisible: false,
    inlinePageRangeVisible: false,
    pageRangeStart: "",
    pageRangeEnd: "",
    pageRangeMax: 0,
    uploadedPageCount: 0,
    translationOptionsOpen: false,
    credentialGateVisible: false,
  };
}
