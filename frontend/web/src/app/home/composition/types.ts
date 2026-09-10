// composition 层公共类型（拆分后 re-export 垫片，行为不变）。
// 实体已移至 ./types-split/*；本文件仅 re-export，保持旧 import 路径可用。
// CT: HomeFeatures=10, HomeServices=29( core6+domains13+ports/视图10 )。
// 拆分表: library→library/bookDetail/collections/libraryPort;
// status→statusArea/statusCard/statusDetail/jobRuntime/artifactDownloads;
// workflow→workflow/upload/text/uploadPort/workflowPort/uploadDomRefs/actions/dialog;
// credentials→credentials/settingsHub/glossaries/appUpdate;
// reader→reader.
export * from "./types-split/common.js";
export * from "./types-split/features.js";
export * from "./types-split/credentials.js";
export * from "./types-split/library.js";
export * from "./types-split/status.js";
export * from "./types-split/workflow.js";
export * from "./types-split/reader.js";
export * from "./types-split/services.js";
