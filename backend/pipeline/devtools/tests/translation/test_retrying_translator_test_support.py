"""Import identity and mock lifetime contracts for the shared test loader."""

import importlib
import sys
from unittest.mock import patch

import pytest

from retrying_translator_test_support import load_retrying_translator


MODULE_NAMES = (
    "retainpdf_pipeline.translate.llm.shared.orchestration.retrying_translator",
    "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks",
    "retainpdf_pipeline.translate.llm.shared.orchestration.segment_routing",
    "retainpdf_pipeline.translate.llm.providers.deepseek.client",
)


def test_loader_preserves_cached_modules_parent_bindings_and_search_path():
    modules = {name: importlib.import_module(name) for name in MODULE_NAMES}
    bindings = []
    for name, module in modules.items():
        parent_name, child_name = name.rsplit(".", 1)
        parent = importlib.import_module(parent_name)
        assert getattr(parent, child_name) is module
        bindings.append((parent, child_name, module))
    search_path = list(sys.path)

    assert load_retrying_translator() is modules[MODULE_NAMES[0]]
    assert load_retrying_translator() is modules[MODULE_NAMES[0]]

    assert sys.path == search_path
    for name, module in modules.items():
        assert sys.modules[name] is module
    for parent, child_name, module in bindings:
        assert getattr(parent, child_name) is module


def test_loader_keeps_scoped_function_mock_and_restores_after_exception():
    translator = load_retrying_translator()
    fallbacks = importlib.import_module(MODULE_NAMES[1])
    original = fallbacks.translate_single_item_plain_text
    replacement = object()

    with pytest.raises(RuntimeError, match="test failure"):
        with patch.object(fallbacks, "translate_single_item_plain_text", replacement):
            loaded = load_retrying_translator()
            assert loaded is translator
            assert loaded.fallbacks is fallbacks
            assert loaded.fallbacks.translate_single_item_plain_text is replacement
            raise RuntimeError("test failure")

    assert translator.fallbacks.translate_single_item_plain_text is original
    assert importlib.import_module(MODULE_NAMES[1]) is fallbacks
