"""核心只用标准库；提示词改了要连同 PROMPT_VERSION 一起改（缓存键里有它）。"""
from __future__ import annotations

import ast
import hashlib
import sys
from importlib import resources
from pathlib import Path

import retainpdf_toc_agent
from retainpdf_toc_agent import PROMPT_VERSION

CORE = Path(retainpdf_toc_agent.__file__).resolve().parent
PROMPT_SHA256 = "609184f585de941b72f4b9ebd28b308d41bae78ee378324b00bb529f5da20c15"


def test_core_imports_only_the_standard_library() -> None:
    allowed = set(sys.stdlib_module_names) | {"retainpdf_toc_agent", "__future__"}
    offenders = []
    for path in CORE.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
                names = [node.module]
            else:
                names = []
            offenders += [f"{path.name}: {name}" for name in names if name.split(".")[0] not in allowed]
    assert offenders == []


def test_prompt_is_pinned_to_its_version() -> None:
    raw = resources.files("retainpdf_toc_agent.prompts").joinpath("toc_translate_system.txt").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PROMPT_SHA256
    assert PROMPT_VERSION == "toc_translate.v1"
