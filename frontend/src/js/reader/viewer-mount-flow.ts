import { mountPdfViewer } from "./pdf-controller.js";

function fulfilledValue(result) {
  return result?.status === "fulfilled" ? result.value : null;
}

export async function mountReaderPdfPair({
  fetchProtected,
  mountViewer = mountPdfViewer,
  onSourceSettled = null,
  onTranslatedSettled = null,
  sourcePdf,
  translatedPdfUrl,
}: any = {}) {
  const [sourceResult, translatedResult] = await Promise.allSettled([
    mountViewer({
      key: "reader-pdf",
      itemOrUrl: sourcePdf,
      label: "PDF gốc",
      emptyId: "reader-pdf-empty",
      fetchProtected,
    }).finally(() => {
      onSourceSettled?.();
    }),
    mountViewer({
      key: "reader-translated-pdf",
      itemOrUrl: translatedPdfUrl,
      label: "PDF dịch",
      emptyId: "reader-translation-empty",
      fetchProtected,
    }).finally(() => {
      onTranslatedSettled?.();
    }),
  ]);

  return {
    sourceReady: fulfilledValue(sourceResult),
    translatedReady: fulfilledValue(translatedResult),
  };
}
