"""Test modules consume shared support, never other collected test modules."""
import ast

import pytest

from support.paths import HERE


def _test_module_imports(source):
    """Return static imports of test modules without importing their contents."""
    violations = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            prefix = node.module or ""
            names = [prefix, *(f"{prefix}.{alias.name}" for alias in node.names)]
        else:
            continue
        if any(part.startswith("test_") for name in names for part in name.split(".")):
            violations.append(node.lineno)
    return violations


@pytest.mark.parametrize("source", [
    "import test_translation_io_success",
    "import tests.integration.test_translation_io_success as success",
    "from test_translation_io_failure import assert_unpublished",
    "from .test_translation_io_failure import assert_unpublished",
    "from . import test_translation_io_failure",
    "from tests.integration import test_translation_io_success as success",
    "if True:\n    from test_new_module import helper",
])
def test_detector_rejects_test_module_imports(source):
    assert _test_module_imports(source)


@pytest.mark.parametrize("source", [
    "from support.translation_io_assertions import assert_complete_artifacts",
    "from support.translation_io_support import run",
    "import pytest",
    "# import test_translation_io_success\nmessage = 'from test_old import helper'",
])
def test_detector_accepts_support_and_ignores_comments_and_strings(source):
    assert _test_module_imports(source) == []


def test_collected_modules_do_not_import_other_tests():
    violations = [
        f"{path.relative_to(HERE)}:{line}"
        for path in sorted((HERE / "tests").rglob("test_*.py"))
        for line in _test_module_imports(path.read_text(encoding="utf-8"))
    ]
    assert not violations, "Move shared helpers to support/:\n" + "\n".join(violations)
