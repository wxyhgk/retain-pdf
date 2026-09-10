from __future__ import annotations

"""Compatibility facade for older placeholder/validation imports.

New validation code should import from ``services.translation.llm.result_validator``
and ``services.translation.llm.validation.*`` directly. This module remains as a
stable shim for existing tests, tools, and older orchestration paths.
"""

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.placeholder_diagnostics import log_placeholder_failure
from retainpdf_pipeline.translate.llm.placeholder_transform import has_formula_placeholders
from retainpdf_pipeline.translate.llm.placeholder_transform import item_with_placeholder_aliases
from retainpdf_pipeline.translate.llm.placeholder_transform import item_with_runtime_hard_glossary
from retainpdf_pipeline.translate.llm.placeholder_transform import placeholder_alias_maps
from retainpdf_pipeline.translate.llm.placeholder_transform import placeholder_stability_guidance
from retainpdf_pipeline.translate.llm.placeholder_transform import replace_placeholders
from retainpdf_pipeline.translate.llm.placeholder_transform import restore_placeholder_aliases
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.result_payload import INTERNAL_PLACEHOLDER_DEGRADED_REASON
from retainpdf_pipeline.translate.llm.result_payload import KEEP_ORIGIN_LABEL
from retainpdf_pipeline.translate.llm.result_payload import internal_keep_origin_result
from retainpdf_pipeline.translate.llm.result_payload import is_internal_placeholder_degraded
from retainpdf_pipeline.translate.llm.result_payload import normalize_decision
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.result_payload import text_preview
from retainpdf_pipeline.translate.llm.result_validator import should_reject_keep_origin
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.validation.english_residue import _is_reference_like_item
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode
from retainpdf_pipeline.translate.llm.validation.english_residue import item_math_mode
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_english_prose
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_garbled_fragment
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_mixed_english_residue_output
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_predominantly_english_output
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_short_fragment
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_untranslated_english_output
from retainpdf_pipeline.translate.llm.validation.english_residue import normalize_inline_whitespace
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import EnglishResidueError
from retainpdf_pipeline.translate.llm.validation.errors import MathDelimiterError
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.errors import SuspiciousKeepOriginError
from retainpdf_pipeline.translate.llm.validation.errors import TranslationProtocolError
from retainpdf_pipeline.translate.llm.validation.errors import TruncatedTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import UnexpectedPlaceholderError
from retainpdf_pipeline.translate.llm.validation.math_safety import UNESCAPED_INLINE_DOLLAR_RE
from retainpdf_pipeline.translate.llm.validation.math_safety import has_balanced_inline_math_delimiters
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import ALIAS_PLACEHOLDER_RE
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import FORMAL_PLACEHOLDER_RE
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import PLACEHOLDER_RE
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholders
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders
from retainpdf_pipeline.translate.llm.validation.protocol_shell import MODEL_REQUEST_PROMPT_MAX_CHARS
from retainpdf_pipeline.translate.llm.validation.protocol_shell import MODEL_REQUEST_PROMPT_RE
from retainpdf_pipeline.translate.llm.validation.protocol_shell import looks_like_protocol_shell_output


__all__ = [
    "ALIAS_PLACEHOLDER_RE",
    "EmptyTranslationError",
    "EnglishResidueError",
    "FORMAL_PLACEHOLDER_RE",
    "INTERNAL_PLACEHOLDER_DEGRADED_REASON",
    "KEEP_ORIGIN_LABEL",
    "MathDelimiterError",
    "MODEL_REQUEST_PROMPT_MAX_CHARS",
    "MODEL_REQUEST_PROMPT_RE",
    "PLACEHOLDER_RE",
    "PlaceholderInventoryError",
    "SuspiciousKeepOriginError",
    "TranslationProtocolError",
    "TruncatedTranslationError",
    "TranslationDiagnosticsCollector",
    "UNESCAPED_INLINE_DOLLAR_RE",
    "UnexpectedPlaceholderError",
    "_is_reference_like_item",
    "canonicalize_batch_result",
    "has_balanced_inline_math_delimiters",
    "has_formula_placeholders",
    "internal_keep_origin_result",
    "is_direct_math_mode",
    "is_internal_placeholder_degraded",
    "item_math_mode",
    "item_with_placeholder_aliases",
    "item_with_runtime_hard_glossary",
    "log_placeholder_failure",
    "looks_like_english_prose",
    "looks_like_garbled_fragment",
    "looks_like_mixed_english_residue_output",
    "looks_like_predominantly_english_output",
    "looks_like_protocol_shell_output",
    "looks_like_short_fragment",
    "looks_like_untranslated_english_output",
    "normalize_decision",
    "normalize_inline_whitespace",
    "placeholder_alias_maps",
    "placeholder_sequence",
    "placeholder_stability_guidance",
    "placeholders",
    "replace_placeholders",
    "restore_placeholder_aliases",
    "result_entry",
    "should_force_translate_body_text",
    "should_reject_keep_origin",
    "strip_placeholders",
    "text_preview",
    "unit_source_text",
    "validate_batch_result",
]
