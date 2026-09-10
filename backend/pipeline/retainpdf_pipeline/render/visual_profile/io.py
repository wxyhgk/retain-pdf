from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from retainpdf_pipeline.render.visual_profile.contracts import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile.manifest import document_visual_profile_from_manifest
from retainpdf_pipeline.render.visual_profile.manifest import document_visual_profile_to_manifest


VISUAL_PROFILE_MANIFEST_NAME = "visual_profile.v1.json"


def visual_profile_path_from_prewarm_manifest(prewarm_manifest_path: Path) -> Path:
    return Path(prewarm_manifest_path).parent / VISUAL_PROFILE_MANIFEST_NAME


def write_document_visual_profile(path: Path, profile: DocumentVisualProfile) -> None:
    write_visual_profile_manifest(path, document_visual_profile_to_manifest(profile))


def write_visual_profile_manifest(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    tmp_path.replace(path)


def read_document_visual_profile(path: Path) -> DocumentVisualProfile | None:
    try:
        with Path(path).open("r", encoding="utf-8") as f:
            return document_visual_profile_from_manifest(json.load(f))
    except Exception:
        return None
