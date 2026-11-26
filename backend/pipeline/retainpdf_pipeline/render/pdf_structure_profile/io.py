from __future__ import annotations

import json
from pathlib import Path

from retainpdf_base.io import atomic_write
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.manifest import pdf_structure_profile_from_manifest
from retainpdf_pipeline.render.pdf_structure_profile.manifest import pdf_structure_profile_to_manifest


PDF_STRUCTURE_PROFILE_MANIFEST_NAME = "pdf_structure_profile.v1.json"


def pdf_structure_profile_path_from_prewarm_manifest(prewarm_manifest_path: Path) -> Path:
    return Path(prewarm_manifest_path).parent / PDF_STRUCTURE_PROFILE_MANIFEST_NAME


def write_pdf_structure_profile(path: Path, profile: PdfStructureDocumentProfile) -> None:
    payload = pdf_structure_profile_to_manifest(profile)
    atomic_write(
        path,
        lambda handle: (json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True), handle.write("\n")),
        durable=False,
    )


def read_pdf_structure_profile(path: Path) -> PdfStructureDocumentProfile | None:
    try:
        with Path(path).open("r", encoding="utf-8") as f:
            return pdf_structure_profile_from_manifest(json.load(f))
    except Exception:
        return None
