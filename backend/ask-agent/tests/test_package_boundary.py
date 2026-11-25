"""核心只用标准库（入口 __main__.py 例外：它是接线的入口）；系统提示词钉住，改了要看一眼。"""
from __future__ import annotations

import ast
import hashlib
import sys
from importlib import resources
from pathlib import Path

import retainpdf_ask_agent

CORE = Path(retainpdf_ask_agent.__file__).resolve().parent
PROMPT_SHA256 = "fc97332342d2791d46bc08955ed5da2087db6ad8fc2c97beb3e597abeb1613ad"


def test_core_imports_only_the_standard_library() -> None:
    allowed = set(sys.stdlib_module_names) | {"retainpdf_ask_agent", "__future__"}
    offenders = []
    for path in CORE.rglob("*.py"):
        if path.name == "__main__.py":
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
                names = [node.module]
            else:
                names = []
            offenders += [f"{path.name}: {name}" for name in names if name.split(".")[0] not in allowed]
    assert offenders == []


def test_system_prompt_is_pinned() -> None:
    raw = resources.files("retainpdf_ask_agent.prompts").joinpath("ask_system.txt").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PROMPT_SHA256
