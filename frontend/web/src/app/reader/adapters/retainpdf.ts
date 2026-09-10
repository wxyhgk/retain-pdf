// RetainPDF 宿主对 @retainpdf/reader 的适配实现 — 将 frontend/web 的 external 真值注入 frontend/packages/reader 的 adapters
import * as ext from "../external.js";
import { setReaderAdapters } from "@retainpdf/reader/adapters";
import type { ReaderAdapters } from "@retainpdf/reader/adapters";

// external.ts 是 MPA 宿主能力的单一出口。全量注入可确保 ReaderAdapters
// 新增 download/favorites/credentials 等宿主端口时不会因手抄字段而静默漏接。
const adapters: ReaderAdapters = {
  ...ext,
  apiPrefix: ext.API_PREFIX,
  fetchDocumentByJobId: ext.fetchDocumentByJobId,
  createFavorite: ext.createFavorite,
  fetchFavorites: ext.fetchFavorites,
  deleteFavorite: ext.deleteFavorite,
  credentialsPort: ext.defaultCredentialsStatePort,
  askDocumentAi: ext.askLibraryAi,
};
setReaderAdapters(adapters);
export { adapters as retainPdfReaderAdapters };
export { ext as retainPdfExternal };
