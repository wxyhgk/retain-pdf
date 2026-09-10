"""Translation workflow public facade.

Imports are resolved lazily so low-level modules can depend on workflow helpers
without pulling the full runtime pipeline during test/module import.
"""

__all__ = [
    "TranslationExecutionRequest",
    "default_page_translation_name",
    "execute_translation_request",
    "translate_items_to_path",
]


def __getattr__(name: str):
    if name in {"TranslationExecutionRequest", "execute_translation_request"}:
        from retainpdf_pipeline.translate.workflow import execution

        return getattr(execution, name)
    if name in {"default_page_translation_name", "translate_items_to_path"}:
        from retainpdf_pipeline.translate.workflow import translation_workflow

        return getattr(translation_workflow, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
