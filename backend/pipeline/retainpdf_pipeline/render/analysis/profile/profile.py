"""Compatibility imports for the initial RenderPageProfile API.

New code should import from the focused modules:
- models.py for data structures
- kind.py for page-kind classification
- builder.py for profile assembly
"""

from retainpdf_pipeline.render.analysis.profile.builder import build_render_page_profile
from retainpdf_pipeline.render.analysis.profile.kind import classify_profile_kind
from retainpdf_pipeline.render.analysis.profile.models import RenderPageKind
from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile

__all__ = [
    "RenderPageKind",
    "RenderPageProfile",
    "build_render_page_profile",
    "classify_profile_kind",
]
