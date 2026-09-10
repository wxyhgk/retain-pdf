from retainpdf_pipeline.translate.core.terms.abbreviations import AbbreviationEntry
from retainpdf_pipeline.translate.core.terms.glossary import GlossaryEntry
from retainpdf_pipeline.translate.core.terms.glossary import glossary_hard_entries
from retainpdf_pipeline.translate.core.terms.glossary import matched_glossary_entries
from retainpdf_pipeline.translate.core.terms.glossary import normalize_glossary_entries
from retainpdf_pipeline.translate.core.terms.glossary import parse_glossary_json
from retainpdf_pipeline.translate.core.terms.injection import build_terms_guidance
from .preserve import auto_preserve_glossary_entries_from_texts
from .preserve import merge_auto_preserve_glossary_entries
from .usage import summarize_glossary_usage

__all__ = [
    "AbbreviationEntry",
    "GlossaryEntry",
    "auto_preserve_glossary_entries_from_texts",
    "build_terms_guidance",
    "glossary_hard_entries",
    "matched_glossary_entries",
    "merge_auto_preserve_glossary_entries",
    "normalize_glossary_entries",
    "parse_glossary_json",
    "summarize_glossary_usage",
]
