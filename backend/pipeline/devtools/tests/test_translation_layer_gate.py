"""Architecture sublayer routing must follow the actual post-migration paths."""
import pytest

from devtools.architecture_checks.common import module_allowed
from devtools.architecture_checks.translation_rules import (
    TRANSLATION_LAYER_IMPORT_RULES, TRANSLATION_LAYER_FROZEN_IMPORTS,
    TRANSLATION_ROOT, translation_layer_for,
)


@pytest.mark.parametrize("path,layer", [
    ("core/payload/parts/apply.py", "payload"),
    ("core/ocr/json_extractor.py", "ocr"),
    ("core/orchestration/units.py", "orchestration"),
    ("core/context/models.py", "core"),
    ("core/terms/glossary.py", "core"),
    ("services/context/windows.py", "context"),
    ("services/memory/store.py", "memory"),
    ("services/policy/verdict.py", "policy"),
    ("services/classification/prompting.py", "classification"),
    ("services/continuation/review.py", "continuation"),
    ("services/terms/preserve.py", "terms"),
    ("services/agents/repair_pipeline.py", "agents"),
    ("services/quality/checks.py", "quality"),
    ("services/postprocess/garbled_reconstruction.py", "postprocess"),
    ("services/results/applier.py", "services"),
    ("workflow/batching/executor.py", "workflow"),
    ("llm/shared/executor_context.py", "llm"),
    ("translation_stage.py", None),
])
def test_paths_select_specific_rule_without_conflating_core_and_services(path, layer):
    assert translation_layer_for(TRANSLATION_ROOT / path) == layer


def test_external_file_has_no_translation_layer(tmp_path):
    assert translation_layer_for(tmp_path / "services/memory/store.py") is None


@pytest.mark.parametrize("path,forbidden,allowed", [
    ("services/memory/store.py", "llm.shared.provider_runtime", "services.memory.store"),
    ("services/terms/usage.py", "services.agents.runtime", "services.terms.preserve"),
    ("services/context/windows.py", "services.agents.runtime", "services.context.windows"),
    ("core/payload/parts/apply.py", "llm.shared.provider_runtime", "core.payload.parts.policy_state"),
])
def test_resolved_sublayer_rejects_edges_previously_allowed_by_broad_parent(path, forbidden, allowed):
    rules = TRANSLATION_LAYER_IMPORT_RULES[translation_layer_for(TRANSLATION_ROOT / path)]
    assert not module_allowed("retainpdf_pipeline.translate." + forbidden, rules)
    assert module_allowed("retainpdf_pipeline.translate." + allowed, rules)


@pytest.mark.parametrize("path,module,accepted", [
    ("services/agents/repair_pipeline.py", "core.payload", True),
    ("services/agents/repair_pipeline.py", "core.payload.parts.diagnostics", True),
    ("services/agents/repair_pipeline.py", "core.payload.unlisted", False),
    ("services/agents/new_repair.py", "core.payload", False),
    ("services/memory/store.py", "llm.shared.provider_runtime", False),
])
def test_real_boundary_checker_limits_frozen_debt_to_exact_file_and_module(monkeypatch, path, module, accepted):
    from devtools.architecture_checks import translation_boundaries as checker
    source = TRANSLATION_ROOT / path
    imported = "retainpdf_pipeline.translate." + module
    monkeypatch.setattr(checker, "scan_py_files", lambda root: [source] if root == TRANSLATION_ROOT else [])
    monkeypatch.setattr(checker, "read_text", lambda path: "")
    monkeypatch.setattr(checker, "imported_modules", lambda path: [imported] if path == source else [])
    monkeypatch.setattr(checker, "imported_from_symbols", lambda path: [])
    errors = []
    checker.check_translation_internal_boundaries(errors)
    if accepted:
        assert errors == []
    else:
        assert len(errors) == 1
        assert imported in errors[0]


def test_frozen_debt_tracks_existing_edges_not_future_permissions():
    from devtools.architecture_checks.common import imported_modules
    for relative, modules in TRANSLATION_LAYER_FROZEN_IMPORTS.items():
        assert modules <= set(imported_modules(TRANSLATION_ROOT / relative)), relative


def test_current_tree_passes_active_sublayer_boundaries():
    from devtools.architecture_checks.translation_boundaries import check_translation_internal_boundaries
    errors = []
    check_translation_internal_boundaries(errors)
    assert errors == []
