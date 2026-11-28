"""目录原位替换（2026-11-28 用户定）：目录页不重排，只把每条标题的字换成译文。见 README.md。"""

from retainpdf_pipeline.render.output.toc_replace.apply import apply_toc_replace
from retainpdf_pipeline.render.output.toc_replace.plan import TOC_MODE_REFLOW
from retainpdf_pipeline.render.output.toc_replace.plan import TOC_MODE_REPLACE
from retainpdf_pipeline.render.output.toc_replace.plan import TocReplacePlan
from retainpdf_pipeline.render.output.toc_replace.plan import plan_toc_replace
from retainpdf_pipeline.render.output.toc_replace.text import resolve_font_file

__all__ = [
    "TOC_MODE_REFLOW",
    "TOC_MODE_REPLACE",
    "TocReplacePlan",
    "apply_toc_replace",
    "plan_toc_replace",
    "resolve_font_file",
]
