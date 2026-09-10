import { ArtifactCenterView } from "./artifact-center/ArtifactCenterView.jsx";
import type { ArtifactCenterItem, ArtifactCenterSection } from "../../domain/artifact-center-model.js";

export type BookDetailArtifactsTabProps = {
  onOpenSource: () => void;
  onOpenOcr?: (jobId: string) => void;
  onOpenJob?: (jobId: string) => void;
  artifactCenter: {
    sections: ArtifactCenterSection[];
    loading: boolean;
    error: string;
    downloadingId: string;
    download: (item: ArtifactCenterItem) => Promise<void>;
  };
};

export function BookDetailArtifactsTab({
  onOpenSource,
  onOpenOcr,
  onOpenJob,
  artifactCenter,
}: BookDetailArtifactsTabProps) {
  const openJob = onOpenJob || onOpenOcr || (() => {});
  return (
    <div
      className="book-detail-tab-artifacts"
      data-book-detail-tab="artifacts"
    >
      <ArtifactCenterView
        sections={artifactCenter.sections}
        loading={artifactCenter.loading}
        error={artifactCenter.error}
        downloadingId={artifactCenter.downloadingId}
        onOpenSource={onOpenSource}
        onOpenJob={openJob}
        onDownload={(item) => void artifactCenter.download(item)}
      />
    </div>
  );
}
