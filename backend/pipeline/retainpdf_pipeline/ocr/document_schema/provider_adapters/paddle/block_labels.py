from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.legacy_projection import (
    LegacyBlockKind,
    project_legacy_block_kind,
)


def map_block_kind(raw_label: str, *, text: str = "") -> LegacyBlockKind:
    """Return the current document.v1 projection for compatibility callers.

    Provider taxonomy facts now live in ``label_catalog``. Contextual caption
    and footnote resolution remains in ``relations``. The unused ``text``
    parameter is retained so existing callers keep the same interface.
    """

    del text
    return project_legacy_block_kind(raw_label)


__all__ = ["map_block_kind"]
