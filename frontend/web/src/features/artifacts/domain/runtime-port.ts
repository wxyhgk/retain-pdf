export type ArtifactDownloadsRuntimePort = {
  currentJobId: (state: unknown) => string;
};

export function createArtifactDownloadsRuntimePort({
  currentJobId = () => "",
}: { currentJobId?: (state?: unknown) => unknown } = {}): ArtifactDownloadsRuntimePort {
  return Object.freeze({
    currentJobId(state: unknown) {
      return `${currentJobId(state) || ""}`.trim();
    },
  });
}
