export function createArtifactDownloadsRuntimePort({
  currentJobId = () => "",
}: any = {}) {
  return Object.freeze({
    currentJobId(state) {
      return `${currentJobId(state) || ""}`.trim();
    },
  });
}
