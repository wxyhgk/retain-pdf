"""Render stage process entry: ``python -m retainpdf_pipeline.render``.

Thin wrapper over the existing render-only worker. Production invokes one
stage per process with ``--spec``.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.render.workflow.render_only import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="rendering", provider="rendering")
