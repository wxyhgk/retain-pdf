// 共享真值（原 pdf-document-config.ts），可注入 buildHeaders
export function createReaderPdfDocumentConfigPort({
  buildHeaders = () => ({} as Record<string, string>),
}: {
  buildHeaders?: () => Record<string, string>;
} = {}) {
  function apiHeaders(): Record<string, string> {
    return buildHeaders();
  }
  return Object.freeze({ apiHeaders });
}
export const defaultReaderPdfDocumentConfigPort = createReaderPdfDocumentConfigPort();
