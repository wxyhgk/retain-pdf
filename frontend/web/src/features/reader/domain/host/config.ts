/** RetainPDF host bindings for Reader URL and PDF configuration. */
import * as readerConfig from "@retainpdf/reader/runtime/config";
import { buildApiHeaders, isMockMode, readerMessageTargetOrigin } from "@/platform/config/runtime.js";
import { getMockJobId } from "@/platform/mock/index.js";

// 入口参数类型取自 reader 包公开签名，保持注入字段不变。
type ResolveReaderJobIdOptions = NonNullable<
  Parameters<typeof readerConfig.resolveReaderJobId>[0]
>;
type ReaderPageConfigPortOptions = NonNullable<
  Parameters<typeof readerConfig.createReaderPageConfigPort>[0]
>;
type ReaderPdfDocumentConfigPortOptions = NonNullable<
  Parameters<typeof readerConfig.createReaderPdfDocumentConfigPort>[0]
>;

export const resolveReaderJobId = (options: ResolveReaderJobIdOptions = {}) =>
  readerConfig.resolveReaderJobId({
    isMock: isMockMode,
    mockJobId: getMockJobId,
    ...options,
  });
export const resolveReaderDocumentId = readerConfig.resolveReaderDocumentId;
export const resolveReaderAnchor = readerConfig.resolveReaderAnchor;
export const createReaderPageConfigPort = (options: ReaderPageConfigPortOptions = {}) =>
  readerConfig.createReaderPageConfigPort({
    messageTargetOrigin: readerMessageTargetOrigin,
    isMock: isMockMode,
    mockJobId: getMockJobId,
    ...options,
  });
// 用上面带 readerMessageTargetOrigin（本页 origin）的那个：包里的默认是 '*'，阅读页的加载进度会发给任何把它放进
// iframe 的页面（放在笔记 Studio 里时就发到了 Studio）。软阅读层和阅读页同源，照样收得到。
export const defaultReaderPageConfigPort = createReaderPageConfigPort();

export const createReaderPdfDocumentConfigPort = (
  options: ReaderPdfDocumentConfigPortOptions = {},
) =>
  readerConfig.createReaderPdfDocumentConfigPort({
    buildHeaders: buildApiHeaders,
    ...options,
  });
export const defaultReaderPdfDocumentConfigPort =
  readerConfig.defaultReaderPdfDocumentConfigPort;
