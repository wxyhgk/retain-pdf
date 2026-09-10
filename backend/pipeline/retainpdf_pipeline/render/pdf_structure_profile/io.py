from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.manifest import pdf_structure_profile_from_manifest
from retainpdf_pipeline.render.pdf_structure_profile.manifest import pdf_structure_profile_to_manifest


PDF_STRUCTURE_PROFILE_MANIFEST_NAME = "pdf_structure_profile.v1.json"


def pdf_structure_profile_path_from_prewarm_manifest(prewarm_manifest_path: Path) -> Path:
    return Path(prewarm_manifest_path).parent / PDF_STRUCTURE_PROFILE_MANIFEST_NAME


def write_pdf_structure_profile(path: Path, profile: PdfStructureDocumentProfile) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(pdf_structure_profile_to_manifest(profile), f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    tmp_path.replace(path)


def read_pdf_structure_profile(path: Path) -> PdfStructureDocumentProfile | None:
    try:
        with Path(path).open("r", encoding="utf-8") as f:
            return pdf_structure_profile_from_manifest(json.load(f))
    except Exception:
        return None
