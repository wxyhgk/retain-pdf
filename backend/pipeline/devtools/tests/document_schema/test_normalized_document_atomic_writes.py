"""规范化文档（`ocr/normalized/document.v1.json`）和它的报告一律原子写（2026-11-26，状态管理 Z5 / S33、A-N10）。

写的路有五条：normalize worker、GLM-OCR、Paddle、MinerU 直跑、命令型 OCR。以前只有 normalize worker 用
`save_json_atomic`，另外四条用 `save_json`（直接 `open("w")`），写到一半崩溃会留下截断的文件；成功后流式文档和它
硬链接共用一个 inode，以后要是有人原地重写其中一个，两个一起变。
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

from retainpdf_base.io import save_json_atomic
from retainpdf_pipeline.ocr.ocr_provider import paddle_normalize

PACKAGE_ROOT = Path(__file__).resolve().parents[3] / "retainpdf_pipeline"
WRITERS = (
    "ocr/document_schema/normalize_pipeline.py",
    "ocr/ocr_provider/glm_ocr_driver.py",
    "ocr/ocr_provider/paddle_normalize.py",
    "ocr/mineru_provider/job_flow.py",
    "ocr/ocr_provider/local_command_driver.py",
)
NORMALIZED_PATH_NAMES = {"normalized_json_path", "normalized_report_json_path"}


def _callee_name(call: ast.Call) -> str:
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return ""


def test_every_normalized_document_write_is_atomic() -> None:
    offenders: list[str] = []
    seen = 0
    for relative in WRITERS:
        tree = ast.parse((PACKAGE_ROOT / relative).read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not node.args:
                continue
            first = node.args[0]
            if not (isinstance(first, ast.Name) and first.id in NORMALIZED_PATH_NAMES):
                continue
            name = _callee_name(node)
            if not name.startswith("save_json"):
                continue
            seen += 1
            if name not in {"save_json_atomic", "save_json_file"}:
                offenders.append(f"{relative}:{node.lineno} {name}({first.id}, ...)")
    assert seen >= 2 * len(WRITERS), f"只找到 {seen} 处写规范化文档和报告，写法变了要更新这个测试"
    assert not offenders, "规范化文档、报告要用 save_json_atomic：\n" + "\n".join(offenders)


def test_paddle_writes_through_the_atomic_writer_by_default() -> None:
    default = inspect.signature(paddle_normalize.save_normalized_document_for_paddle).parameters["save_json_file"].default
    assert default is save_json_atomic
