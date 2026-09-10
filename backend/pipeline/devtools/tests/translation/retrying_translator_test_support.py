"""Normal package loading shared by the translator unit tests.

Do not evict or fabricate package modules here: existing callers may hold their
references. Individual tests scope and restore any function replacements.
"""

from importlib import import_module
from types import ModuleType


def load_retrying_translator() -> ModuleType:
    return import_module(
        "retainpdf_pipeline.translate.llm.shared.orchestration.retrying_translator"
    )
