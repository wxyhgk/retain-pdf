"""`docs/core/python/*.in` 是拿来当依赖清单读的，混进一个装不上的名字就等于清单是错的。

test_request_capture.py 通过 `sys.path.insert(..., "tests/performance/pipeline")`
import 仓库里的 inspect_capture，扫描器一度把它当成第三方包写进了
pipeline_test_requirements.in。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from devtools import extract_pipeline_requirements as extractor


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


@pytest.fixture
def services_root(tmp_path: Path) -> Path:
    repo_root = tmp_path / "repo"
    _write(
        repo_root / "backend/pipeline/retainpdf_pipeline/render/thing.py",
        "import pikepdf\n",
    )
    return repo_root / "backend"


def test_module_reached_through_sys_path_is_not_a_third_party_package(services_root: Path) -> None:
    repo_root = services_root.parent
    _write(repo_root / "tests/performance/pipeline/inspect_capture.py", "def inspect():\n    ...\n")
    _write(
        services_root / "pipeline/devtools/tests/test_capture.py",
        "import sys\n"
        "from pathlib import Path\n"
        "import pytest\n"
        'sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tests/performance/pipeline"))\n'
        "from inspect_capture import inspect\n",
    )

    report = extractor._build_report(services_root)

    assert "inspect_capture" not in report["test_only_python_packages"]
    assert "inspect_capture" not in report["runtime_python_packages"]
    assert "pytest" in report["test_only_python_packages"]


def test_unresolvable_module_is_still_reported(services_root: Path) -> None:
    _write(
        services_root / "pipeline/devtools/tests/test_capture.py",
        "import sys\n"
        "from pathlib import Path\n"
        'sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tests/performance/pipeline"))\n'
        "from inspect_capture import inspect\n",
    )

    report = extractor._build_report(services_root)

    assert "inspect_capture" in report["test_only_python_packages"]


def test_requirements_never_contain_stdlib_module_names(services_root: Path) -> None:
    _write(
        services_root / "pipeline/retainpdf_pipeline/render/stdlib_user.py",
        "import json\nimport subprocess\nimport requests\n",
    )

    report = extractor._build_report(services_root)

    assert "requests" in report["runtime_python_packages"]
    assert not {"json", "subprocess", "os"} & set(report["runtime_python_packages"])
