from __future__ import annotations

import hashlib
from importlib import resources


SOURCE_CLEANUP_HASH_INPUTS = (
    "render/source_cleanup/contracts.py",
    "render/source_cleanup/executor.py",
    "render/source_cleanup/planning/coordinate_resolver.py",
    "render/source_cleanup/planning/drawing_classifier.py",
    "render/source_cleanup/planning/evidence.py",
    "render/source_cleanup/planning/geometry.py",
    "render/source_cleanup/planning/intent_classifier.py",
    "render/source_cleanup/planning/item_classifier.py",
    "render/source_cleanup/planning/mixed_content.py",
    "render/source_cleanup/planning/items.py",
    "render/source_cleanup/planning/page_features.py",
    "render/source_cleanup/planning/page_gate.py",
    "render/source_cleanup/planning/page_probe.py",
    "render/source_cleanup/planning/planner.py",
    "render/source_cleanup/planning/rect_filter.py",
    "render/source_cleanup/planning/rects.py",
    "render/source_cleanup/planning/segments.py",
    "render/source_cleanup/protected_blocks.py",
    "render/source_cleanup/pdf/document.py",
    "render/source_cleanup/pdf/hit_test.py",
    "render/source_cleanup/pdf/stream_engine.py",
    "render/source_cleanup/pdf/text_removal.py",
    "render/source_cleanup/pdf/xobject_ops.py",
)


def source_cleanup_implementation_hash() -> str:
    package_root = resources.files("retainpdf_pipeline")
    digest = hashlib.sha256()
    for relative_path in SOURCE_CLEANUP_HASH_INPUTS:
        resource = package_root.joinpath(*relative_path.split("/"))
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(resource.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


__all__ = [
    "SOURCE_CLEANUP_HASH_INPUTS",
    "source_cleanup_implementation_hash",
]
