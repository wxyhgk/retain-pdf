"""Translation stage process entry: ``python -m retainpdf_pipeline.translate``.

Thin wrapper over the existing translate-only worker. Production invokes
one stage per process with ``--spec``.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.translate.entrypoints.translate_only_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="translation", provider="translation")
