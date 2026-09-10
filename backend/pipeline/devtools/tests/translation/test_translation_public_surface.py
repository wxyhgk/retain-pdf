from __future__ import annotations

import importlib
import sys
from cold_import_test_support import run_cold_import_probe


def test_translation_public_import_is_lazy() -> None:
    run_cold_import_probe(__file__, "_probe_public_import_is_lazy")


def _probe_public_import_is_lazy() -> None:
    public = importlib.import_module("retainpdf_pipeline.translate.public")

    assert public.__all__
    assert "retainpdf_pipeline.translate.workflow" not in sys.modules
    assert not any(module_name.startswith("retainpdf_pipeline.render") for module_name in sys.modules)


def test_translation_public_resolves_exports_on_demand() -> None:
    run_cold_import_probe(__file__, "_probe_public_resolves_exports_on_demand")


def _probe_public_resolves_exports_on_demand() -> None:
    public = importlib.import_module("retainpdf_pipeline.translate.public")

    assert public.item_block_kind({"block_kind": "text"}) == "text"
    assert public.DEFAULT_MODEL


def test_cold_import_probe_preserves_parent_import_state() -> None:
    original_path = list(sys.path)
    original_modules = {
        name: module
        for name, module in sys.modules.items()
        if name.startswith("retainpdf_pipeline") or name in {"fcntl", "msvcrt", "resource"}
    }

    run_cold_import_probe(__file__, "_probe_public_import_is_lazy")

    assert sys.path == original_path
    current_modules = {
        name: module
        for name, module in sys.modules.items()
        if name.startswith("retainpdf_pipeline") or name in {"fcntl", "msvcrt", "resource"}
    }
    assert current_modules.keys() == original_modules.keys()
    assert all(current_modules[name] is module for name, module in original_modules.items())
