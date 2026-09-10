"""OCR provider package public surface.

`provider_pipeline` is the stable provider-backed workflow entrypoint.
Provider-specific transport helpers stay in sibling modules, while normalized
schema adaptation remains under `services.document_schema`.
"""

from . import provider_pipeline

__all__ = ["provider_pipeline"]
