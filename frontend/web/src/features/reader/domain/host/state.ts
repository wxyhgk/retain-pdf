/** RetainPDF host bindings for Reader downloads, favorites and page state. */
import {
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
} from "@retainpdf/domain/job";
import * as readerState from "@retainpdf/reader/runtime/state";
import { createFavorite, deleteFavorite, fetchFavorites } from "@/platform/api/index.js";
import { fetchDocumentByJobId } from "@/platform/api/index.js";
import { createReaderDialogRuntimePort } from "../dialog/runtime-port.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { resolveReaderSourcePdf } from "./data.js";

export type * from "@retainpdf/reader/runtime/state";

export const READER_PROGRESS_COPY = readerState.READER_PROGRESS_COPY;
export const createReaderPageState = readerState.createReaderPageState;
export const resetReaderProgressState = readerState.resetReaderProgressState;
export const computeReaderProgressSnapshot = readerState.computeReaderProgressSnapshot;

export const READER_DOWNLOAD_ACTIONS = readerState.READER_DOWNLOAD_ACTIONS;
export const trimString = readerState.trimString;
export const readerDownloadNameState = readerState.readerDownloadNameState;
export const disabledReason = readerState.disabledReason;
const downloadResolver = readerState.createReaderDownloadResolver({
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
  createRuntimePort: createReaderDialogRuntimePort as any,
  resolveSourcePdf: resolveReaderSourcePdf as any,
});
export const resolveReaderDownloadUrls = downloadResolver.resolveReaderDownloadUrls;
export const resolveReaderDownloadName = downloadResolver.resolveReaderDownloadName;
export const createReaderDownloadResolver = readerState.createReaderDownloadResolver;

export const normalizeServerFavorite = readerState.normalizeServerFavorite;
export const dedupeServerFavorites = readerState.dedupeServerFavorites;
export const createReaderServerFavoritesPort = (options: any = {}) =>
  readerState.createReaderServerFavoritesPort({
    apiPrefix: API_PREFIX,
    documentByJobId: fetchDocumentByJobId,
    submitFavorite: createFavorite,
    loadFavorites: fetchFavorites,
    removeFavorite: deleteFavorite,
    ...options,
  });
