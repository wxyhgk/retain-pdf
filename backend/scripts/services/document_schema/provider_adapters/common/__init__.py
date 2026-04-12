from services.document_schema.provider_adapters.common.block_builder import build_block_record
from services.document_schema.provider_adapters.common.continuation import assign_provider_group_continuation_hints
from services.document_schema.provider_adapters.common.continuation import build_provider_continuation_hint
from services.document_schema.provider_adapters.common.continuation import continuation_role_for
from services.document_schema.provider_adapters.common.continuation import continuation_scope_for_blocks
from services.document_schema.provider_adapters.common.document_builder import build_document_record
from services.document_schema.provider_adapters.common.normalize import build_line_records
from services.document_schema.provider_adapters.common.normalize import build_text_segments
from services.document_schema.provider_adapters.common.normalize import normalize_bbox
from services.document_schema.provider_adapters.common.normalize import normalize_polygon
from services.document_schema.provider_adapters.common.page_builder import build_page_record
from services.document_schema.provider_adapters.common.relations import classify_with_previous_anchor
from services.document_schema.provider_adapters.common.specs import NormalizedBlockSpec
from services.document_schema.provider_adapters.common.specs import NormalizedPageSpec

__all__ = [
    "NormalizedBlockSpec",
    "NormalizedPageSpec",
    "assign_provider_group_continuation_hints",
    "build_block_record",
    "build_provider_continuation_hint",
    "build_document_record",
    "build_line_records",
    "build_page_record",
    "build_text_segments",
    "classify_with_previous_anchor",
    "continuation_role_for",
    "continuation_scope_for_blocks",
    "normalize_bbox",
    "normalize_polygon",
]
