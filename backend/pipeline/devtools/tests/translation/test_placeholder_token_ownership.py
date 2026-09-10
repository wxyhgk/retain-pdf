import ast
from pathlib import Path

import pytest

from retainpdf_pipeline.translate.core import placeholder_tokens as core
from retainpdf_pipeline.translate.core.payload import formula_protection
from retainpdf_pipeline.translate.llm.validation import placeholder_tokens as compatibility


@pytest.mark.parametrize("prefix", list("futnvc"))
def test_all_typed_tokens_keep_historical_matching(prefix):
    token = f"<{prefix}12-a0z/>"
    text = f"before {token} after {token}"
    assert core.placeholder_sequence(text) == [token, token]
    assert core.placeholders(text) == {token}
    assert core.strip_placeholders(text) == "before   after  "
    assert core.PROTECTED_TOKEN_RE.fullmatch(token)


def test_legacy_and_alias_forms_preserve_order_duplicates_and_spacing():
    text = "[[FORMULA_2]]/@@F3@@/@@P4@@/[[FORMULA_2]]"
    assert core.placeholder_sequence(text) == ["[[FORMULA_2]]", "@@F3@@", "@@P4@@", "[[FORMULA_2]]"]
    assert core.strip_placeholders(text) == " / / / "
    assert core.PROTECTED_TOKEN_RE.findall(text) == ["[[FORMULA_2]]", "@@F3@@", "[[FORMULA_2]]"]
    assert core.FORMAL_PLACEHOLDER_RE.findall("<f1-abc/><t2-123/><u1-abc/>@@F3@@[[FORMULA_2]]") == [
        "<f1-abc/>", "<t2-123/>", "[[FORMULA_2]]",
    ]
    assert core.FORMULA_TOKEN_RE.findall("<t1-abc/><f1-abc/>@@F3@@@@P4@@") == ["<f1-abc/>", "@@P4@@"]


@pytest.mark.parametrize("text", [None, "", "plain text", "<f1-ABc/>", "<x1-abc/>", "<f1-ab/>"])
def test_empty_and_nonmatching_inputs_keep_behavior(text):
    assert core.placeholder_sequence(text) == []
    assert core.placeholders(text) == set()
    assert core.strip_placeholders(text) == (text or "")


def test_compatibility_paths_reexport_same_objects():
    for name in compatibility.__all__:
        assert getattr(compatibility, name) is getattr(core, name)
    assert compatibility.PROTECTED_TOKEN_RE is core.PROTECTED_TOKEN_RE
    assert formula_protection.PROTECTED_TOKEN_RE is core.PROTECTED_TOKEN_RE


def test_shared_syntax_has_only_standard_library_imports():
    tree = ast.parse(Path(core.__file__).read_text())
    imports = [node for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom))]
    for node in imports:
        names = [alias.name for alias in node.names] if isinstance(node, ast.Import) else [node.module]
        assert all(name in {"re", "__future__"} for name in names)


def test_policy_consumers_use_core_owner_without_frozen_debt():
    root = Path(core.__file__).parents[1]
    for name in ("special_blocks", "verdict"):
        tree = ast.parse((root / "services/policy" / f"{name}.py").read_text())
        owners = [node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)
                  and any(alias.name == "strip_placeholders" for alias in node.names)]
        assert owners == ["retainpdf_pipeline.translate.core.placeholder_tokens"]
