from __future__ import annotations

import ast

from devtools.architecture_checks.common import PACKAGE_ROOT
from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel


# OCR 归一化的分层（docs/ops/planning/ocr-normalization/20261029-归一化拆分方案.md，第 1 步 2026-10-29）。
#
# 这几个模块是各家服务商共用的"几何"和"收尾"：缩放到原文 PDF、补行、夹回页内、归一化的最后几步。它们以前放在
# ocr_provider/paddle_normalize.py 里（Paddle 专用的调用服务那一层），于是 MinerU 的数据被 Paddle 的补行改过、
# 核心包反过来导入调用服务的层、连着好几条导入环。现在它们只许依赖文档模型和各家共用的小工具（common/normalize.py），
# 不许导入任何一家的适配器，也不许导入调用服务的层。
OCR_SHARED_GEOMETRY_MODULES = (
    PACKAGE_ROOT / "ocr" / "document_schema" / "pdf_geometry.py",
    PACKAGE_ROOT / "ocr" / "document_schema" / "estimated_lines.py",
    PACKAGE_ROOT / "ocr" / "document_schema" / "page_bounds.py",
    PACKAGE_ROOT / "ocr" / "document_schema" / "finalize.py",
)
FORBIDDEN_IMPORT_PREFIXES = (
    "retainpdf_pipeline.ocr.ocr_provider",
    "retainpdf_pipeline.ocr.mineru_provider",
    "retainpdf_pipeline.ocr.document_schema.provider_adapters",
)
ALLOWED_IMPORTS = ("retainpdf_pipeline.ocr.document_schema.provider_adapters.common.normalize",)


def _imported_modules(tree: ast.AST) -> list[str]:
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and not node.level:
            modules.append(node.module)
        elif isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
    return modules


def check_ocr_normalization_layers(errors: list[str]) -> None:
    for path in OCR_SHARED_GEOMETRY_MODULES:
        if not path.is_file():
            errors.append(f"{rel(path)}: shared OCR geometry module is missing (update OCR_SHARED_GEOMETRY_MODULES)")
            continue
        for module in _imported_modules(parse_python_file(path)):
            if module in ALLOWED_IMPORTS:
                continue
            if any(module == prefix or module.startswith(prefix + ".") for prefix in FORBIDDEN_IMPORT_PREFIXES):
                errors.append(
                    f"{rel(path)}: shared OCR geometry must not import {module} "
                    "(no provider adapter, no provider transport; see devtools/architecture_checks/ocr_layers.py)"
                )
