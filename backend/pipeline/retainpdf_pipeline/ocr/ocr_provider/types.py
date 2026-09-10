from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

from retainpdf_pipeline.foundation.shared.job_dirs import JobDirs


@dataclass(frozen=True)
class OcrProviderArtifactManifest:
    source_pdf_path: Path
    provider_result_json_path: Path
    normalized_json_path: Path
    normalized_report_json_path: Path | None = None
    provider_raw_dir: Path | None = None
    provider_bundle_zip_path: Path | None = None
    raw_main_payload_path: Path | None = None
    markdown_dir: Path | None = None
    image_dir: Path | None = None


@dataclass(frozen=True)
class OcrProviderResult:
    job_dirs: JobDirs
    source_pdf_path: Path
    provider_result_json_path: Path
    normalized_json_path: Path
    normalized_report_json_path: Path | None = None
    provider_raw_dir: Path | None = None
    provider_bundle_zip_path: Path | None = None
    raw_main_payload_path: Path | None = None
    markdown_dir: Path | None = None
    image_dir: Path | None = None

    @property
    def artifact_manifest(self) -> OcrProviderArtifactManifest:
        return OcrProviderArtifactManifest(
            source_pdf_path=self.source_pdf_path,
            provider_result_json_path=self.provider_result_json_path,
            normalized_json_path=self.normalized_json_path,
            normalized_report_json_path=self.normalized_report_json_path,
            provider_raw_dir=self.provider_raw_dir,
            provider_bundle_zip_path=self.provider_bundle_zip_path,
            raw_main_payload_path=self.raw_main_payload_path,
            markdown_dir=self.markdown_dir,
            image_dir=self.image_dir,
        )


OcrProviderDriver = Callable[[SimpleNamespace], OcrProviderResult]


__all__ = [
    "OcrProviderArtifactManifest",
    "OcrProviderDriver",
    "OcrProviderResult",
]
