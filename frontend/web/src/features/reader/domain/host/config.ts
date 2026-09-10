/** RetainPDF host bindings for Reader URL and PDF configuration. */
import * as readerConfig from "@retainpdf/reader/runtime/config";
import { buildApiHeaders, isMockMode, readerMessageTargetOrigin } from "@/platform/config/runtime.js";
import { getMockJobId } from "@/platform/mock/index.js";

export const resolveReaderJobId = (options: any = {}) =>
  readerConfig.resolveReaderJobId({
    isMock: isMockMode,
    mockJobId: getMockJobId,
    ...options,
  });
export const resolveReaderDocumentId = readerConfig.resolveReaderDocumentId;
export const resolveReaderAnchor = readerConfig.resolveReaderAnchor;
export const createReaderPageConfigPort = (options: any = {}) =>
  readerConfig.createReaderPageConfigPort({
    messageTargetOrigin: readerMessageTargetOrigin,
    isMock: isMockMode,
    mockJobId: getMockJobId,
    ...options,
  });
export const defaultReaderPageConfigPort = readerConfig.defaultReaderPageConfigPort;

export const createReaderPdfDocumentConfigPort = (options: any = {}) =>
  readerConfig.createReaderPdfDocumentConfigPort({
    buildHeaders: buildApiHeaders,
    ...options,
  });
export const defaultReaderPdfDocumentConfigPort =
  readerConfig.defaultReaderPdfDocumentConfigPort;
