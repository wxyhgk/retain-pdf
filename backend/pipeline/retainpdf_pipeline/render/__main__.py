"""Render stage process entry: ``python -m retainpdf_pipeline.render``.

Thin wrapper over the render-only worker. Production invokes one stage per
process with ``--spec``.

Must dispatch to ``runtime.pipeline.render_only_pipeline`` (the same worker as
``retainpdf-pipeline render-only``), not straight to ``render.workflow.render_only``:
the runtime layer is what runs refine before rendering and refreshes the translation
QA afterwards. Calling the bare render worker silently skips both.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.runtime.pipeline.render_only_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="rendering", provider="rendering")
