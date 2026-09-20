#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"

# 2026-07 workspace 拆分：以下模块移入 crates/*，内部相对结构不变。
# 本脚本沿用旧 "src/<module>/..." 字面量作为逻辑路径：abs_src() 负责映射到
# 新家，rel() 负责逆映射回逻辑路径——检查逻辑与 allowlist 全部不用改。
_CRATE_OF_MODULE = {
    "job_runner": "../packages/retain-jobs",
    "db": "../../database/retain-db",
    "job_events": "../packages/retain-data",
    "worker_command": "../packages/retain-data",
    "ocr_provider": "../packages/retain-data",
    "models": "../packages/retain-core",
    "storage_paths": "../packages/retain-core",
    "config": "../packages/retain-core",
    "job_failure": "../packages/retain-core",
    "job_failure_structured": "../packages/retain-core",
    "job_failure_support": "../packages/retain-core",
}

# 失败分类由两个地方产生：Python 流水线的 structured_errors.py（worker 打出
# `structured failure json:`，Rust 解析到就直接返回，本地检测分支一行都不跑）
# 和 Rust 的 job_failure.rs（结构化 JSON 缺失时才兜底）。恢复目录当初只照着
# 后者写，于是前者的 7 个取值全在吃「未识别的失败类型，重试会从头开始」——
# 一句假话：恢复按钮根本不看分类，照样只重跑渲染。这条门禁把两份清单钉在一起。
FAILURE_CATALOGUE_LABEL = "src/job_failure_catalogue.rs"
FAILURE_CATALOGUE_PATH = (
    REPO_ROOT.parent / "packages" / "retain-core" / "src" / "job_failure_catalogue.rs"
)
PYTHON_STRUCTURED_ERRORS = (
    REPO_ROOT.parent / "pipeline" / "retainpdf_pipeline" / "foundation" / "shared" / "structured_errors.py"
)
PYTHON_FAILURE_CODE_PATTERN = re.compile(r'^\s*error_type = "([a-z0-9_]+)"', re.MULTILINE)
CATALOGUE_KEY_PATTERN = re.compile(r'^\s*\("([a-z0-9_]+)", FailureRecovery \{', re.MULTILINE)

ALL_SRC_ROOTS = (
    SRC_ROOT,
    REPO_ROOT.parent.parent / "database" / "retain-db" / "src",
    REPO_ROOT.parent / "packages" / "retain-core" / "src",
    REPO_ROOT.parent / "packages" / "retain-data" / "src",
    REPO_ROOT.parent / "packages" / "retain-jobs" / "src",
)


def abs_src(rel_path: Path) -> Path:
    parts = rel_path.parts
    key = parts[1].removesuffix(".rs") if len(parts) > 1 else ""
    crate = _CRATE_OF_MODULE.get(key)
    return (REPO_ROOT / crate / rel_path) if crate else (REPO_ROOT / rel_path)


def scan_all_rs_files() -> list:
    out = []
    for root in ALL_SRC_ROOTS:
        out.extend(scan_rs_files(root))
    return out


ALLOWED_APPSTATE_FILES = {
    Path("src/app/mod.rs"),
    Path("src/app/jobs.rs"),
    Path("src/app/router.rs"),
    Path("src/app/state.rs"),
    Path("src/auth.rs"),
    Path("src/lib.rs"),
    Path("src/routes/glossaries.rs"),
    Path("src/routes/health.rs"),
    Path("src/routes/common.rs"),
    Path("src/routes/jobs/control.rs"),
    Path("src/routes/jobs/create.rs"),
    Path("src/routes/jobs/download.rs"),
    Path("src/routes/jobs/query.rs"),
    Path("src/routes/jobs/translation_debug.rs"),
    Path("src/routes/providers.rs"),
    Path("src/routes/uploads.rs"),
    Path("src/services/glossaries/tests.rs"),
    Path("src/services/jobs/creation/tests.rs"),
    Path("src/services/jobs/support.rs"),
}

# ADR-002 Phase 2：壳只能经接缝碰任务运行时。job_runner 是 jobsd 的地盘，
# 壳里唯二可以引用它的地方是 InProcess 落点的装配处与接缝本身——多一个
# 文件引用，就意味着"换落点不影响上层"这条保证被悄悄打破了。
# （纯 OS 进程工具已迁往 retain-proc，用 crate::process::，不算越界。）
JOB_RUNNER_IMPORT_ALLOWLIST = {
    Path("src/app/jobs.rs"),
    Path("src/services/runtime_gateway.rs"),
}

APPSTATE_GUARDED_DIRS = [
    Path("src/services"),
    Path("src/job_runner"),
    Path("src/ocr_provider"),
]

ROUTE_RUNNER_IMPORT_ALLOWLIST = {
    Path("src/routes/health.rs"),
    Path("src/routes/providers.rs"),
    Path("src/routes/common.rs"),
}

ROUTE_RAW_EXTRACTOR_ALLOWLIST = {
    Path("src/routes/common/extractors.rs"),
    # Job multipart parsers consume the already-authorized inner Multipart.
    Path("src/routes/job_requests/multipart.rs"),
}

ROUTE_STATE_RESOURCE_ALLOWLIST = {
    Path("src/routes/common/agent_calculations.rs"),
    Path("src/routes/common/agent_capabilities.rs"),
    Path("src/routes/common/agent_runtime_sessions.rs"),
    Path("src/routes/common/auth.rs"),
    Path("src/routes/common/credentials.rs"),
    Path("src/routes/common/document_operations.rs"),
    Path("src/routes/common/fonts.rs"),
    Path("src/routes/common/glossaries.rs"),
    Path("src/routes/common/health.rs"),
    Path("src/routes/common/jobs.rs"),
    Path("src/routes/common/library.rs"),
    Path("src/routes/common/providers.rs"),
    Path("src/routes/common/uploads.rs"),
}

ROUTE_SERVICE_IMPORT_ALLOWLIST = {
    Path("src/routes/model_requests.rs"): (
        "crate::services::model_requests_api::",
    ),
    Path("src/routes/agent_calculations.rs"): (
        "crate::services::agent_calculations::api::",
    ),
    Path("src/routes/glossaries.rs"): (
        "crate::services::glossaries::api::",
    ),
    Path("src/routes/health.rs"): (
        "crate::services::health_api::",
    ),
    Path("src/routes/credentials.rs"): (
        "crate::services::credentials::api::",
    ),
    Path("src/routes/document_operations.rs"): (
        "crate::services::document_operation_api::",
    ),
    Path("src/routes/agent_runtime_sessions.rs"): (
        "crate::services::agent_runtime_session_api::",
    ),
    Path("src/routes/agent_capabilities.rs"): (
        "crate::services::agent_capability_api::",
    ),
    Path("src/routes/public_document_operations.rs"): (
        "crate::services::public_document_operations_api::",
    ),
    Path("src/routes/library.rs"): (
        "crate::services::library::api::",
    ),
    # Library thick routes migrate to library_api in PR2–PR5; allowlist is
    # ready so partial moves do not require revisiting this file each PR.
    Path("src/routes/library_data.rs"): (
        "crate::services::library::api::",
    ),
    Path("src/routes/library_extras.rs"): (
        "crate::services::library::api::",
    ),
    Path("src/routes/collections.rs"): (
        "crate::services::library::api::",
    ),
    Path("src/routes/uploads.rs"): (
        "crate::services::uploads::api::",
    ),
    Path("src/routes/common/uploads.rs"): (
        "crate::services::uploads::api::UploadApiDeps",
    ),
    Path("src/routes/common/agent_capabilities.rs"): (
        "crate::services::agent_capabilities::AgentCapabilityAuthority",
    ),
    Path("src/routes/common/agent_runtime_sessions.rs"): (
        "crate::services::agent_runtime_session_api::AgentRuntimeSessionApiDeps",
    ),
    Path("src/routes/common/agent_calculations.rs"): (
        "crate::services::agent_calculations::api::AgentCalculationApiDeps",
    ),
    Path("src/routes/common/glossaries.rs"): (
        "crate::services::glossaries::api::GlossaryApiDeps",
    ),
    Path("src/routes/common/health.rs"): (
        "crate::services::health_api::HealthApiDeps",
    ),
    Path("src/routes/common/jobs.rs"): (
        "crate::app::{build_jobs_facade_from_state, AppState}",
        "crate::services::jobs::{JobDownloads, JobQueries, JobsFacade}",
    ),
    Path("src/routes/common/library.rs"): (
        "crate::services::library::LibraryDeps",
    ),
    Path("src/routes/download_response/files.rs"): (
        "crate::services::jobs::FileDownload",
        "crate::services::jobs::{DocumentDownloadKind, FileDownload}",
    ),
    Path("src/routes/jobs/download.rs"): (
        "crate::services::jobs::DocumentDownloadKind",
    ),
    Path("src/routes/download_response/markdown.rs"): (
        "crate::services::jobs::MarkdownDownload",
    ),
    Path("src/routes/download_response.rs"): (
        "crate::services::jobs::{FileDownload, MarkdownDownload}",
    ),
    Path("src/routes/providers.rs"): (
        "crate::services::provider_api::",
    ),
    Path("src/routes/ai_proxy.rs"): (
        "crate::services::ai::api",
    ),
    Path("src/routes/fonts.rs"): (
        "crate::services::fonts::api::",
    ),
    Path("src/routes/common/providers.rs"): (
        "crate::services::provider_api::ProviderApiDeps",
    ),
    Path("src/routes/common/fonts.rs"): (
        "crate::services::fonts::api::FontApiDeps",
    ),
}

ROUTE_QUALIFIED_SERVICE_ACCESS_ALLOWLIST: set[Path] = set()

ARTIFACT_BOUNDARY_FILES = {
    Path("src/storage_paths.rs"),
    Path("src/services/artifacts/mod.rs"),
    Path("src/services/artifacts/bundle.rs"),
    Path("src/services/artifacts/registry.rs"),
    Path("src/services/artifacts/response.rs"),
    Path("src/services/artifacts/presentation.rs"),
    Path("src/routes/jobs/download.rs"),
}

PROVIDER_RAW_INTERNAL_TOKENS = (
    "layoutParsingResults",
    "prunedResult",
    "block_label",
)
OCR_FLOW_ROOT = abs_src(Path("src/job_runner/ocr_flow"))
OCR_FLOW_ORCHESTRATOR_FILE = Path("src/job_runner/ocr_flow/mod.rs")
OCR_FLOW_ALLOWED_RAW_TOKEN_FILES = {
    Path("src/job_runner/ocr_flow/paddle_markdown.rs"),
}
DOWNLOADS_ROOT = SRC_ROOT / "services" / "jobs" / "downloads"
STAGE_VIEW_CONSUMER_ROOTS = (
    SRC_ROOT / "services" / "jobs" / "presentation",
    SRC_ROOT / "services" / "book_projection",
)
WORKER_COMMAND_FACADE = abs_src(Path("src/worker_command.rs"))

# These leaves need persistence only, even if they are split into submodules.
PERSIST_ONLY_RUNNER_MODULES = (
    Path("src/job_runner/ocr_flow/bundle_events"),
    Path("src/job_runner/render_flow_artifacts"),
    Path("src/job_runner/translation_flow_artifacts"),
)

def rel(path: Path) -> Path:
    for root in ALL_SRC_ROOTS[1:]:
        if path.resolve().is_relative_to(root.resolve()):
            return Path("src") / path.resolve().relative_to(root.resolve())
    relative = path.relative_to(REPO_ROOT)
    parts = relative.parts
    if len(parts) > 2 and parts[0] == "crates":
        # crates/<name>/src/... → src/...（逻辑路径，与 allowlist 对齐）
        return Path(*parts[2:])
    return relative


def scan_rs_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*.rs")
        if path.is_file() and ".ipynb_checkpoints" not in path.parts
    )


def check_appstate_boundaries(errors: list[str]) -> None:
    for guarded_dir in APPSTATE_GUARDED_DIRS:
        for path in scan_rs_files(abs_src(guarded_dir)):
            rel_path = rel(path)
            if rel_path in ALLOWED_APPSTATE_FILES:
                continue
            text = rust_boundary_source(path)
            if "AppState" in text:
                errors.append(
                    f"{rel_path}: forbidden AppState usage outside route/app assembly or test whitelist"
                )


def check_route_runner_dependency(errors: list[str]) -> None:
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        if rel_path in ROUTE_RUNNER_IMPORT_ALLOWLIST:
            continue
        text = path.read_text(encoding="utf-8")
        if "crate::job_runner::" in text:
            errors.append(f"{rel_path}: routes must not depend directly on crate::job_runner")


def check_route_input_extractors(errors: list[str]) -> None:
    raw_extractors = ("Json", "Query", "Path", "Multipart")
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        if rel_path in ROUTE_RAW_EXTRACTOR_ALLOWLIST:
            continue
        text = route_source_without_tests(path)
        direct = set(
            re.findall(
                r"axum::extract::(?:rejection::)?(Json|Query|Path|Multipart)\b",
                text,
            )
        )
        for import_body in re.findall(r"use\s+axum::extract::\{(.*?)\};", text, re.DOTALL):
            for extractor in raw_extractors:
                if re.search(rf"\b{extractor}\b", import_body):
                    direct.add(extractor)
        if direct:
            names = ", ".join(sorted(direct))
            errors.append(
                f"{rel_path}: raw Axum input extractor(s) {names} bypass the JSON error contract; use ApiJson/ApiQuery/ApiPath/ApiMultipart"
            )


def check_multipart_field_buffering(errors: list[str]) -> None:
    """Keep multipart payload limits at the stream boundary, before allocation."""
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        if rel_path == Path("src/routes/common/extractors.rs"):
            continue
        text = route_source_without_tests(path)
        if re.search(r"\bfield\s*\.\s*(?:bytes|text)\s*\(", text):
            errors.append(
                f"{rel_path}: multipart fields must use the bounded helpers in routes/common/extractors.rs; direct field.bytes()/field.text() buffering is forbidden"
            )


def check_jobs_route_deps_dedup(errors: list[str]) -> None:
    narrow_modules = (
        Path("src/routes/jobs/query/read"),
        Path("src/routes/jobs/query/diagnostics"),
        Path("src/routes/jobs/download"),
        Path("src/routes/download_response"),
    )
    mixed_modules = {
        Path("src/routes/jobs/query/reader"): {"reader_ai_chat"},
        Path("src/routes/jobs/translation_debug"): {"replay_translation_item_route"},
    }
    full_capabilities = r"build_jobs_route_deps|build_jobs_facade_from_state|jobs_facade|JobsFacade|JobsRouteDeps"
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        text = rust_boundary_source(path)
        if path.is_relative_to(SRC_ROOT / "routes" / "jobs") and re.search(r"\bfn\s+route_deps\s*\(", text):
            errors.append(
                f"{rel_path}: local jobs route_deps helper is forbidden; use build_jobs_route_deps"
            )
        if any(is_rust_module_path(rel_path, module) for module in narrow_modules):
            if re.search(rf"\b(?:{full_capabilities})\b", text):
                errors.append(f"{rel_path}: read/download routes must use narrow dependencies")
        elif commands := next((commands for module, commands in mixed_modules.items()
                               if is_rust_module_path(rel_path, module)), None):
            # Imports are shared with the explicit command handlers. Inspect
            # function bodies, including local helpers, rather than the file.
            aliases = re.findall(rf"\b(?:{full_capabilities})\s+as\s+(\w+)", text)
            forbidden = "|".join([full_capabilities, *aliases])
            for name, body in rust_function_bodies(text):
                if name not in commands and re.search(rf"\b(?:{forbidden})\b", body):
                    errors.append(f"{rel_path}:{name}: query handlers must use query-only dependencies")


def route_source_without_tests(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    return text.split("\n#[cfg(test)]", 1)[0]


def is_rust_module_path(path: Path, module: Path) -> bool:
    """Cover both foo.rs and foo/{mod,child,...}.rs after module splits."""
    return path == module.with_suffix(".rs") or path.is_relative_to(module)


def rust_code_only(text: str) -> str:
    """Mask comments and literals, preserving offsets and nested block comments.

    These guards inspect Rust identifiers and braces, not strings or comments.
    Masking literals also keeps URLs and raw strings from confusing // or {}.
    """
    token = re.compile(r'''//|/\*|(?:br|cr|r)\#*"|(?:b|c)?"|b?'(?:\\(?:u\{[^}]*\}|x[0-9a-fA-F]{2}|.)|[^'\\\n])' ''', re.VERBOSE)
    result = list(text)
    cursor = 0
    while match := token.search(text, cursor):
        start, end = match.span()
        value = match.group()
        if value == "//":
            end = text.find("\n", end)
            end = len(text) if end < 0 else end
        elif value == "/*":
            depth = 1
            while depth and end < len(text):
                next_token = re.search(r"/\*|\*/", text[end:])
                if next_token is None:
                    end = len(text)
                    break
                depth += 1 if next_token.group() == "/*" else -1
                end += next_token.end()
        elif value.endswith('"'):
            if "r" in value:
                closing = '"' + "#" * value.count("#")
                closing_at = text.find(closing, end)
                end = len(text) if closing_at < 0 else closing_at + len(closing)
            else:
                closing = re.search(r'(?s)(?:\\.|[^"\\])*"', text[end:])
                end = len(text) if closing is None else end + closing.end()
        result[start:end] = ["\n" if char == "\n" else " " for char in text[start:end]]
        cursor = end
    return "".join(result)


def rust_boundary_source(path: Path) -> str:
    return rust_code_only(path.read_text(encoding="utf-8")).split("\n#[cfg(test)]", 1)[0]


def rust_function_bodies(code: str):
    """Read named function bodies from literal/comment-masked route source."""
    for match in re.finditer(r"\bfn\s+(\w+)\b[^;{]*\{", code):
        depth = 1
        end = match.end()
        while depth and end < len(code):
            depth += (code[end] == "{") - (code[end] == "}")
            end += 1
        yield match.group(1), code[match.end():end - 1]


def check_route_state_resource_access(errors: list[str]) -> None:
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        if rel_path in ROUTE_STATE_RESOURCE_ALLOWLIST:
            continue
        text = route_source_without_tests(path)
        if (
            "state.db" in text
            or "state.config" in text
            or re.search(r"\bdeps\.[A-Za-z_][A-Za-z0-9_]*\.db\b", text)
        ):
            errors.append(
                f"{rel_path}: routes must not access database/config resources directly; use route deps builders and application facades"
            )


def check_route_service_imports(errors: list[str]) -> None:
    pattern = re.compile(r"^use crate::services::[^\n;]+", re.MULTILINE)
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        text = rust_boundary_source(path)
        imports = pattern.findall(text)
        allowed_prefixes = ROUTE_SERVICE_IMPORT_ALLOWLIST.get(rel_path, ())
        for item in imports:
            service_path = item.removeprefix("use ").strip()
            if any(
                service_path.startswith(prefix)
                and (prefix.endswith("::") or re.match(r"(?:$|::|\s)", service_path[len(prefix):]))
                for prefix in allowed_prefixes
            ):
                continue
            errors.append(
                f"{rel_path}: routes must not import internal services directly ({service_path})"
            )

        if rel_path in ROUTE_QUALIFIED_SERVICE_ACCESS_ALLOWLIST:
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            if "crate::services::" not in line or line.lstrip().startswith("use "):
                continue
            errors.append(
                f"{rel_path}:{line_number}: fully-qualified service access bypasses the route facade allowlist; import an approved application facade"
            )


def check_route_model_boundary(errors: list[str]) -> None:
    internal_model_tokens = (
        "JobSnapshot",
        "JobRuntimeState",
        "JobRecord",
        "ResolvedJobSpec",
        "JobArtifacts",
        "JobFailureInfo",
    )
    model_import_pattern = re.compile(r"^use crate::models::([^\n;]+)", re.MULTILINE)
    for path in scan_rs_files(SRC_ROOT / "routes"):
        rel_path = rel(path)
        text = route_source_without_tests(path)
        for line in re.findall(r"^use crate::models(?:::|::\{)[^\n;]+", text, re.MULTILINE):
            if not any(
                allowed in line
                for allowed in (
                    "crate::models::api",
                    "crate::models::domain",
                    "crate::models::request",
                )
            ):
                errors.append(
                    f"{rel_path}: routes must import models through models::api/domain/request facades ({line})"
                )
        for imported in model_import_pattern.findall(text):
            for token in internal_model_tokens:
                if re.search(rf"\b{re.escape(token)}\b", imported):
                    errors.append(
                        f"{rel_path}: routes must not import internal job model {token}; use API view DTOs or services facade"
                    )
        if "crate::storage_paths::resolve_" in text:
            errors.append(
                f"{rel_path}: routes must not choose storage path resolvers directly; use service download kinds/facades"
            )


def check_service_model_facade_boundaries(errors: list[str]) -> None:
    scoped_roots = (
        SRC_ROOT / "services" / "artifacts",
        SRC_ROOT / "services" / "derived_artifacts",
        SRC_ROOT / "services" / "derived_artifacts.rs",
        abs_src(Path("src/job_events")),
        abs_src(Path("src/job_events.rs")),
        abs_src(Path("src/db")),
        abs_src(Path("src/db.rs")),
        abs_src(Path("src/storage_paths")),
        abs_src(Path("src/storage_paths.rs")),
        abs_src(Path("src/worker_command")),
        abs_src(Path("src/worker_command.rs")),
        SRC_ROOT / "app" / "state.rs",
        SRC_ROOT / "app" / "state_recovery.rs",
        abs_src(Path("src/ocr_provider")),
        abs_src(Path("src/job_runner")) / "mod.rs",
        abs_src(Path("src/job_runner")) / "lifecycle.rs",
        abs_src(Path("src/job_runner")) / "process_runner",
        abs_src(Path("src/job_runner")) / "process_runner.rs",
        abs_src(Path("src/job_runner")) / "stdout_parser",
        abs_src(Path("src/job_runner")) / "process_contract.rs",
        abs_src(Path("src/job_runner")) / "stage_contract.rs",
        abs_src(Path("src/job_runner")) / "runtime_state.rs",
        abs_src(Path("src/job_runner")) / "worker_process.rs",
        abs_src(Path("src/job_runner")) / "execution_queue.rs",
        abs_src(Path("src/job_runner")) / "translation_flow.rs",
        abs_src(Path("src/job_runner")) / "translation_flow_artifacts.rs",
        abs_src(Path("src/job_runner")) / "translation_flow_child.rs",
        abs_src(Path("src/job_runner")) / "translation_flow_executor.rs",
        abs_src(Path("src/job_runner")) / "translation_flow_stage.rs",
        abs_src(Path("src/job_runner")) / "translation_flow_support.rs",
        abs_src(Path("src/job_runner")) / "render_flow.rs",
        abs_src(Path("src/job_runner")) / "render_flow_artifacts.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "mod.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "bundle_download.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "bundle_download_retry.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "bundle_events.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "bundle_ready_wait.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "mineru.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "mineru_polling.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "mineru_retry.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "mineru_status_handlers.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "paddle.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "paddle_errors.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "provider_result.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "provider_transport.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "status.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "support.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "transport.rs",
        abs_src(Path("src/job_runner")) / "ocr_flow" / "workspace.rs",
        abs_src(Path("src/job_failure.rs")),
        abs_src(Path("src/job_failure_support.rs")),
        abs_src(Path("src/job_failure_structured.rs")),
        SRC_ROOT / "services" / "glossaries",
        SRC_ROOT / "services" / "fonts",
        SRC_ROOT / "services" / "credentials",
        SRC_ROOT / "services" / "agent_calculations",
        SRC_ROOT / "services" / "job_snapshot_factory.rs",
        SRC_ROOT / "services" / "job_validation.rs",
        SRC_ROOT / "services" / "job_launcher.rs",
        SRC_ROOT / "services" / "jobs" / "downloads",
        SRC_ROOT / "services" / "jobs" / "creation",
        SRC_ROOT / "services" / "jobs" / "presentation",
        SRC_ROOT / "services" / "jobs" / "control.rs",
        SRC_ROOT / "services" / "jobs" / "debug",
        SRC_ROOT / "services" / "jobs" / "facade" / "mod.rs",
        SRC_ROOT / "services" / "jobs" / "deps",
        SRC_ROOT / "services" / "jobs" / "facade" / "query",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "creation.rs",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "control.rs",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "rerun.rs",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "stage_retry.rs",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "stage_retry_overrides.rs",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "stage_retry_request.rs",
        SRC_ROOT / "services" / "jobs" / "facade" / "command" / "stage_retry_view.rs",
        SRC_ROOT / "services" / "jobs" / "live_stage",
        SRC_ROOT / "services" / "jobs" / "live_stage.rs",
        SRC_ROOT / "services" / "jobs" / "reader_regions",
        SRC_ROOT / "services" / "jobs" / "reader_regions.rs",
        SRC_ROOT / "services" / "jobs" / "query.rs",
        SRC_ROOT / "services" / "jobs" / "stage_plan.rs",
        SRC_ROOT / "services" / "jobs" / "stage_view.rs",
        SRC_ROOT / "services" / "jobs" / "summary_loaders",
        SRC_ROOT / "services" / "jobs" / "summary_loaders.rs",
        SRC_ROOT / "services" / "jobs" / "support.rs",
        SRC_ROOT / "services" / "library",
        SRC_ROOT / "services" / "library" / "api.rs",
        SRC_ROOT / "services" / "provider_probe.rs",
        SRC_ROOT / "services" / "ai",
        SRC_ROOT / "services" / "uploads",
        SRC_ROOT / "services" / "book_projection",
        SRC_ROOT / "services" / "book_projection.rs",
    )
    for root in scoped_roots:
        paths = [root] if root.is_file() else scan_rs_files(root)
        for path in paths:
            rel_path = rel(path)
            if path.name == "tests.rs":
                continue
            text = route_source_without_tests(path)
            for line in re.findall(r"^use crate::models(?:::|::\{)[^\n;]+", text, re.MULTILINE):
                if not any(
                    allowed in line
                    for allowed in (
                        "crate::models::api",
                        "crate::models::domain",
                        "crate::models::request",
                    )
                ):
                    errors.append(
                        f"{rel_path}: migrated service modules must import models through models::api/domain/request facades ({line})"
                    )


def check_jobs_dependency_boundaries(errors: list[str]) -> None:
    root = SRC_ROOT / "services" / "jobs" / "deps"
    paths = scan_rs_files(root)
    narrow_modules = (
        SRC_ROOT / "services" / "jobs" / "query",
        SRC_ROOT / "services" / "jobs" / "downloads",
    )
    for module in narrow_modules:
        paths.extend(scan_rs_files(module))
        if module.with_suffix(".rs").is_file():
            paths.append(module.with_suffix(".rs"))
    for path in paths:
        text = rust_boundary_source(path)
        if re.search(r"\b(?:AppState|AppConfig|from_env)\b|\benv\s*::\s*var\s*\(", text):
            errors.append(f"{rel(path)}: jobs dependencies must be explicitly assembled from narrow capabilities")
        if (is_rust_module_path(path, root / "query") or any(
            is_rust_module_path(path, module) for module in narrow_modules
        )) and re.search(
            r"\b(?:JobsFacade|CommandJobsDeps|JobSubmitDeps|JobRuntime|RuntimeControl|JobLaunchDeps|JobRuntimeLauncher|UploadService)\b", text
        ):
            errors.append(f"{rel(path)}: query dependencies must not acquire submission or runtime control capabilities")
        if any(is_rust_module_path(path, module) for module in narrow_modules) and re.search(r"\b(?:ReplayDeps|QueryJobsDeps)\b", text):
            errors.append(f"{rel(path)}: read/download dependencies must not acquire replay capabilities")
    if (SRC_ROOT / "services" / "jobs" / "creation" / "context.rs").exists():
        errors.append("jobs/creation/context.rs: shared dependencies belong in jobs/deps")


def check_runtime_ownership(errors: list[str]) -> None:
    allowed = {Path("src/app/server.rs"), Path("src/app/state.rs"),
               Path("src/services/health_api.rs"), Path("src/services/ai/gateway.rs")}
    for path in scan_rs_files(SRC_ROOT):
        relative = rel(path)
        text = route_source_without_tests(path)
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        if path.is_relative_to(SRC_ROOT / "runtime"):
            if re.search(r"\b(?:services|routes|AppState)\b", text):
                errors.append(f"{relative}: runtime must not depend on business services or HTTP assembly state")
        elif relative not in allowed and not path.is_relative_to(SRC_ROOT / "api_tests"):
            if re.search(r"\b(?:ai_supervisor|jobsd_supervisor)\b", text):
                errors.append(f"{relative}: supervisor access belongs to app assembly and explicit health consumers")
    for name in ("ai_supervisor", "jobsd_supervisor"):
        if (SRC_ROOT / "services" / f"{name}.rs").exists():
            errors.append(f"services/{name}.rs: supervisor implementation belongs in runtime")


def check_ai_gateway_dependencies(errors: list[str]) -> None:
    for path in scan_rs_files(SRC_ROOT / "services" / "ai"):
        text = route_source_without_tests(path)
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        if re.search(r"\b(?:from_env|ai_service_status)\s*\(|\benv\s*::\s*var\s*\(|\bLazy\b", text):
            errors.append(f"{rel(path)}: AI gateway must receive configuration and health source from app assembly")


def check_business_private_modules(errors: list[str]) -> None:
    """Public capability reexports are valid; implementation-path imports are not."""
    private = {
        "ai": {"gateway"},
        "fonts": {"service"},
        "credentials": {"service"},
        "agent_calculations": {"service"},
        "glossaries": {"csv", "entries", "records"},
    }
    for path in scan_rs_files(SRC_ROOT):
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        for domain, members in private.items():
            if path.is_relative_to(SRC_ROOT / "services" / domain):
                continue
            for suffix in re.findall(rf"\b{domain}\s*::\s*([^;]+)", text):
                first = re.match(r"(\w+)", suffix)
                grouped = set(re.findall(r"\b\w+\b", suffix)) if suffix.startswith("{") else set()
                if (first and first.group(1) in members) or grouped & members:
                    errors.append(f"{rel(path)}: external callers must use the {domain} public surface, not its internal modules")
                    break


def check_agent_calculation_dependencies(errors: list[str]) -> None:
    """Calculation storage needs Db and data_root, not application configuration."""
    for path in scan_rs_files(SRC_ROOT / "services" / "agent_calculations"):
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        if re.search(r"\b(?:AppConfig|AppState|api_tests)\b", text):
            errors.append(
                f"{rel(path)}: agent calculations must use narrow Db/data_root dependencies, including test fixtures"
            )


def check_upload_boundaries(errors: list[str]) -> None:
    """Uploads is an app-owned capability, not a jobs/runtime implementation."""
    upload_root = SRC_ROOT / "services" / "uploads"
    private_modules = {"capacity", "pdf", "staging", "service", "error"}
    forbidden_dependencies = {"jobs", "routes", "runtime_gateway", "job_runner"}
    for path in scan_rs_files(SRC_ROOT):
        # Include standalone test modules: their wiring must also use the facade.
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        inside = path.is_relative_to(upload_root)
        imports = re.findall(r"\buse\s+([^;]+);", text)
        if inside:
            dependencies = set(re.findall(r"\b(\w+)\s*::", text))
            for imported in imports:
                dependencies.update(re.findall(r"\b\w+\b", imported))
            forbidden = dependencies & forbidden_dependencies
            if forbidden or re.search(r"\b(?:AppState|JobRuntime)\b", text):
                errors.append(
                    f"{rel(path)}: uploads must not depend on jobs/routes/AppState/job runtime"
                )
            if path != upload_root / "api.rs" and re.search(r"\bAppError\b", text):
                errors.append(
                    f"{rel(path)}: uploads must return UploadError; HTTP error mapping belongs outside the domain"
                )
            if re.search(r"\bfrom_env\s*\(|\benv\s*::\s*(?:var|var_os|vars|vars_os)\s*\(", text):
                errors.append(
                    f"{rel(path)}: uploads must receive startup configuration explicitly, not read environment"
                )
        else:
            # Match both uploads::capacity::X and uploads::{capacity::X, ...}.
            for suffix in re.findall(r"\buploads\s*::\s*([^;]+)", text):
                first = re.match(r"(\w+)", suffix)
                members = set(re.findall(r"\b\w+\b", suffix)) if suffix.startswith("{") else set()
                if (first and first.group(1) in private_modules) or members & private_modules:
                    errors.append(
                        f"{rel(path)}: external callers must use the uploads public surface, not its internal modules"
                    )
                    break


def check_process_runtime_deps_usage(errors: list[str]) -> None:
    legacy_pattern = "ProcessRuntimeDeps::from_state("
    new_pattern = "ProcessRuntimeDeps::new("
    allowed_new_callers = {
        Path("src/app/jobs.rs"),
        Path("src/job_runner/process_runner.rs"),
        Path("src/services/jobs/creation/tests.rs"),
    }
    for path in scan_all_rs_files():
        rel_path = rel(path)
        text = path.read_text(encoding="utf-8")
        if legacy_pattern in text:
            errors.append(
                f"{rel_path}: ProcessRuntimeDeps::from_state is reserved for job_runner internals; use build_process_runtime_deps or narrower deps builders"
            )
        if new_pattern in text and rel_path not in allowed_new_callers:
            errors.append(
                f"{rel_path}: ProcessRuntimeDeps::new must stay in app assembly or explicit tests; do not assemble runtime deps in random modules"
            )


def check_job_persist_deps_usage(errors: list[str]) -> None:
    allowed = {
        Path("src/job_runner/mod.rs"),
        Path("src/job_runner/runtime_deps.rs"),
        Path("src/job_runner/process_runner/execution.rs"),
        Path("src/job_runner/process_runner/io_support.rs"),
        Path("src/job_runner/process_runner/startup.rs"),
        Path("src/job_runner/process_runner/timeout_support.rs"),
    }
    for path in scan_all_rs_files():
        rel_path = rel(path)
        if path.stem == "tests" or path.stem.endswith("_tests"):
            continue
        text = rust_boundary_source(path)
        if any(is_rust_module_path(rel_path, module) for module in PERSIST_ONLY_RUNNER_MODULES):
            if re.search(
                r"\b(?:ProcessRuntimeDeps|AppState|AppConfig|JobRuntime|JobRuntimeLauncher|RuntimeControl|JobDriverRegistry|Semaphore)\b",
                text,
            ):
                errors.append(
                    f"{rel_path}: persistence-only runner leaves must use JobPersistDeps, not full runtime or execution capabilities"
                )
            continue
        if any(is_rust_module_path(rel_path, module.with_suffix("")) for module in allowed):
            continue
        if re.search(r"\bJobPersistDeps\b", text):
            errors.append(
                f"{rel_path}: JobPersistDeps is a leaf helper boundary; keep it out of unrelated modules"
            )


def check_shared_artifact_presentation(errors: list[str]) -> None:
    for path in scan_rs_files(SRC_ROOT / "services"):
        if path.stem == "tests" or path.stem.endswith("_tests"):
            continue
        relative = rel(path)
        text = rust_boundary_source(path)
        if is_rust_module_path(relative, Path("src/services/jobs")):
            if re.search(r"\bbook_projection\b", text):
                errors.append(
                    f"{relative}: jobs must not depend on book_projection; shared display belongs in services::artifacts"
                )
        if is_rust_module_path(relative, Path("src/services/artifacts/presentation")):
            if re.search(
                r"\b(?:jobs|book_projection|library|AppState|AppConfig|JobSnapshot|Db|storage_paths|ocr_provider|fs|File|OpenOptions|Command|process|reqwest)\b",
                text,
            ):
                errors.append(
                    f"{relative}: shared artifact presentation must consume artifact view data, not business services or runtime/storage dependencies"
                )
            for token in PROVIDER_RAW_INTERNAL_TOKENS:
                if token in route_source_without_tests(path):
                    errors.append(f"{relative}: shared artifact presentation must not interpret provider raw token '{token}'")
    if (SRC_ROOT / "services" / "book_projection" / "artifacts.rs").exists():
        errors.append("services/book_projection/artifacts.rs: shared artifact display belongs in services/artifacts/presentation.rs")


def check_runtime_deps_module_boundary(errors: list[str]) -> None:
    for path in scan_rs_files(abs_src(Path("src/job_runner"))):
        rel_path = rel(path)
        if rel_path in {
            Path("src/job_runner/mod.rs"),
            Path("src/job_runner/runtime_deps.rs"),
        }:
            continue
        text = path.read_text(encoding="utf-8")
        if "struct ProcessRuntimeDeps" in text or "struct JobPersistDeps" in text:
            errors.append(
                f"{rel_path}: runtime deps structs must live in src/job_runner/runtime_deps.rs"
            )


def check_state_recovery_boundary(errors: list[str]) -> None:
    state_path = REPO_ROOT / "src/app/state.rs"
    text = state_path.read_text(encoding="utf-8")
    if "fn reconcile_stale_running_jobs(" in text:
        errors.append(
            "src/app/state.rs: stale running job recovery must stay in src/app/state_recovery.rs"
        )

    recovery_path = REPO_ROOT / "src/app/state_recovery.rs"
    if recovery_path.exists():
        recovery_text = recovery_path.read_text(encoding="utf-8")
        if "reconcile_stale_running_jobs" not in recovery_text:
            errors.append(
                "src/app/state_recovery.rs: expected reconcile_stale_running_jobs(...) helper is missing"
            )


def check_lifecycle_helper_boundaries(errors: list[str]) -> None:
    path = abs_src(Path("src/job_runner/lifecycle.rs"))
    text = path.read_text(encoding="utf-8")
    required_helpers = (
        "should_skip_job_execution",
        "persist_queued_job",
        "dispatch_workflow",
        "persist_failed_job",
        "clear_job_cancel_request",
    )
    for helper in required_helpers:
        if helper not in text:
            errors.append(
                f"src/job_runner/lifecycle.rs: expected lifecycle helper '{helper}' is missing"
            )


def check_provider_markdown_fallback(errors: list[str]) -> None:
    allowed = {
        Path("src/storage_paths.rs"),
        Path("src/job_runner/ocr_flow/markdown_bundle.rs"),
        Path("src/job_runner/ocr_flow/bundle_download.rs"),
    }
    for path in scan_all_rs_files():
        rel_path = rel(path)
        if rel_path in allowed:
            continue
        text = path.read_text(encoding="utf-8")
        if "provider_raw_dir" not in text:
            continue
        if '.join("full.md")' in text or '.join("images")' in text:
            errors.append(
                f"{rel_path}: published markdown artifacts must not be reconstructed from provider_raw_dir"
            )


def check_artifact_boundary_layer(errors: list[str]) -> None:
    for rel_path in ARTIFACT_BOUNDARY_FILES:
        path = abs_src(rel_path)
        text = path.read_text(encoding="utf-8")
        if "crate::ocr_provider::" in text:
            errors.append(
                f"{rel_path}: artifact/download boundary must not depend directly on crate::ocr_provider"
            )
        for token in PROVIDER_RAW_INTERNAL_TOKENS:
            if token in text:
                errors.append(
                    f"{rel_path}: artifact/download boundary must not understand provider raw internal token '{token}'"
                )


def check_downloads_do_not_generate_artifacts(errors: list[str]) -> None:
    for path in scan_rs_files(DOWNLOADS_ROOT):
        rel_path = rel(path)
        text = path.read_text(encoding="utf-8")
        if "std::process::Command" in text or "Command::new(" in text:
            errors.append(
                f"{rel_path}: downloads layer must not spawn artifact generators; use services::derived_artifacts"
            )
        if "import fitz" in text or "qpdf" in text:
            errors.append(
                f"{rel_path}: downloads layer must not embed PDF generation scripts; use services::derived_artifacts"
            )

    downloads_facade = SRC_ROOT / "services" / "jobs" / "downloads.rs"
    text = route_source_without_tests(downloads_facade)
    for token in (
        "crate::storage_paths::",
        "crate::services::derived_artifacts",
        "load_supported_job",
        "resolve_source_pdf",
        "resolve_output_pdf",
    ):
        if token in text:
            errors.append(
                f"{rel(downloads_facade)}: downloads facade must stay thin; move concrete download behavior into services/jobs/downloads/* ({token})"
            )


def check_stage_view_projection_boundary(errors: list[str]) -> None:
    allowed = {
        Path("src/services/jobs/presentation/detail_projection.rs"),
        Path("src/services/jobs/presentation/listing.rs"),
        Path("src/services/book_projection/live.rs"),
    }
    forbidden_tokens = (
        "public_stage_for_raw_stage(",
        "build_progress_view(",
        "progress_current",
        "progress_total",
        "background_stages.iter()",
    )
    for root in STAGE_VIEW_CONSUMER_ROOTS:
        for path in scan_rs_files(root):
            rel_path = rel(path)
            text = route_source_without_tests(path)
            if "JobDetailView" not in text and "JobListItemView" not in text and "BookLiveProjection" not in text:
                continue
            if rel_path not in allowed:
                continue
            if "build_job_stage_view(" not in text:
                errors.append(
                    f"{rel_path}: stage/progress presentation must use services::jobs::stage_view::build_job_stage_view"
                )
            for token in forbidden_tokens:
                if token in text:
                    errors.append(
                        f"{rel_path}: stage/progress fallback belongs in services::jobs::stage_view, found '{token}'"
                    )


def check_job_readiness_boundary(errors: list[str]) -> None:
    scoped_roots = (
        SRC_ROOT / "services" / "jobs" / "presentation",
        SRC_ROOT / "services" / "book_projection",
    )
    for root in scoped_roots:
        for path in scan_rs_files(root):
            rel_path = rel(path)
            text = route_source_without_tests(path)
            if re.search(
                r"\breadiness\s*\([^;]*resolve_output_pdf\s*,\s*resolve_markdown_path",
                text,
                re.DOTALL,
            ):
                errors.append(
                    f"{rel_path}: presentation must use services::jobs::job_readiness instead of wiring storage resolvers"
                )


def check_translation_debug_boundary(errors: list[str]) -> None:
    debug_root = SRC_ROOT / "services" / "jobs" / "debug"
    query_translation_debug = SRC_ROOT / "services" / "jobs" / "facade" / "query" / "translation_debug.rs"
    command_translation_debug = SRC_ROOT / "services" / "jobs" / "facade" / "command" / "translation_debug.rs"
    artifact_module = debug_root / "artifacts.rs"
    if not artifact_module.exists():
        errors.append(
            "src/services/jobs/debug/artifacts.rs: expected translation debug artifact reader boundary is missing"
        )
    if not command_translation_debug.exists():
        errors.append(
            "src/services/jobs/facade/command/translation_debug.rs: expected translation debug command facade is missing"
        )

    projection_files = (
        debug_root / "index.rs",
        debug_root / "item.rs",
        debug_root / "diagnostics.rs",
    )
    for path in projection_files:
        rel_path = rel(path)
        text = route_source_without_tests(path)
        if "super::index::load_manifest_pages" in text:
            errors.append(
                f"{rel_path}: debug projection must read manifest pages through debug::artifacts, not debug::index"
            )
        if path.name in {"index.rs", "item.rs"} and "resolve_translation_manifest" in text:
            errors.append(
                f"{rel_path}: translation manifest path resolution belongs in debug/artifacts.rs"
            )
        if path.name == "index.rs" and "resolve_translation_debug_index" in text:
            errors.append(
                f"{rel_path}: translation debug index file resolution belongs in debug/artifacts.rs"
            )

    if query_translation_debug.exists():
        text = route_source_without_tests(query_translation_debug)
        for token in (
            "replay_translation_item",
            "TranslationReplayView",
            "Command::new(",
            "tokio::process::Command",
        ):
            if token in text:
                errors.append(
                    f"{rel(query_translation_debug)}: query facade must not execute replay actions ({token}); use facade/command/translation_debug.rs"
                )


def check_reader_regions_boundary(errors: list[str]) -> None:
    reader_projection = SRC_ROOT / "services" / "jobs" / "reader_regions.rs"
    reader_artifacts = SRC_ROOT / "services" / "jobs" / "reader_regions" / "artifacts.rs"
    if not reader_artifacts.exists():
        errors.append(
            "src/services/jobs/reader_regions/artifacts.rs: expected reader artifact reader boundary is missing"
        )
        return
    text = route_source_without_tests(reader_projection)
    for token in (
        "resolve_translation_manifest",
        "resolve_normalized_document",
        "std::fs::read_to_string",
        "serde_json::from_str",
    ):
        if token in text:
            errors.append(
                f"{rel(reader_projection)}: reader projection must not read/parse source artifacts directly ({token}); use reader_regions/artifacts.rs"
            )


def check_summary_loaders_boundary(errors: list[str]) -> None:
    summary_root = SRC_ROOT / "services" / "jobs" / "summary_loaders"
    shared = summary_root / "shared.rs"
    if not shared.exists():
        errors.append(
            "src/services/jobs/summary_loaders/shared.rs: expected summary artifact reader boundary is missing"
        )
        return
    for name in ("glossary.rs", "invocation.rs"):
        path = summary_root / name
        text = route_source_without_tests(path)
        for token in ("resolve_translation_manifest", "resolve_data_path", "read_json_value("):
            if token in text:
                errors.append(
                    f"{rel(path)}: summary loaders must read shared summary artifacts through summary_loaders/shared.rs ({token})"
                )


# 任务行有两个并发写入者：driver（推进阶段）和用户（取消）。`cas_persist_job_*`
# 是这个仓库的正确原语——"只在当前状态还是我以为的那个时才写"。而
# `persist_runtime_job_with_resources` 是无条件全行覆盖：driver 拿着几分钟前的
# 内存快照把整行盖掉，静默抹掉用户刚写的 canceled。这是一个 lost update，
# 症状是"点了取消却显示失败"，见 PR #100–#103。
#
# 合法的例外只有"建新行"：那时 DB 里还没有这一行，CAS 没有可防的东西，反而会在
# 重试时因为残留的终态行而拒绝写入、把重试卡死。例外必须在调用点上方用下面这个
# 标记显式声明，写清楚为什么，让它在 review 里可见。
UNCONDITIONAL_JOB_WRITE = "persist_runtime_job_with_resources("
UNCONDITIONAL_JOB_WRITE_MARKER = "ALLOW-UNCONDITIONAL-JOB-WRITE:"


def check_failure_catalogue_covers_python_codes(errors: list[str]) -> None:
    if not FAILURE_CATALOGUE_PATH.exists():
        errors.append(f"{FAILURE_CATALOGUE_LABEL}: 恢复目录不见了，失败分类将全部走兜底文案")
        return
    if not PYTHON_STRUCTURED_ERRORS.exists():
        errors.append(
            f"{FAILURE_CATALOGUE_LABEL}: 找不到 Python 侧的失败分类来源"
            f"（{PYTHON_STRUCTURED_ERRORS.name}），无法校验恢复目录覆盖率"
        )
        return

    catalogue_keys = set(
        CATALOGUE_KEY_PATTERN.findall(FAILURE_CATALOGUE_PATH.read_text(encoding="utf-8"))
    )
    if not catalogue_keys:
        errors.append(
            f"{FAILURE_CATALOGUE_LABEL}: 一条目录项都没解析出来——"
            f"CATALOGUE 的写法变了而这条门禁没跟上，它现在什么都挡不住"
        )
        return

    python_codes = set(
        PYTHON_FAILURE_CODE_PATTERN.findall(PYTHON_STRUCTURED_ERRORS.read_text(encoding="utf-8"))
    )
    if not python_codes:
        errors.append(
            f"{FAILURE_CATALOGUE_LABEL}: 从 {PYTHON_STRUCTURED_ERRORS.name} 里一个 error_type "
            f"都没解析出来——赋值写法变了而这条门禁没跟上"
        )
        return

    for code in sorted(python_codes - catalogue_keys):
        errors.append(
            f'{FAILURE_CATALOGUE_LABEL}: structured_errors.py 会发出 "{code}"，但恢复目录里没有登记。'
            f"用户会看到「未识别的失败类型，重试会从头开始」——而这句话通常是假的，"
            f"恢复按钮并不看分类。在 CATALOGUE 里加一行。"
        )


def check_unconditional_job_writes(errors: list[str]) -> None:
    for path in scan_rs_files(abs_src(Path("src/job_runner"))):
        rel_path = rel(path)
        if path.name.endswith("_tests.rs"):
            continue
        text = route_source_without_tests(path)
        lines = text.split("\n")
        for index, line in enumerate(lines):
            if UNCONDITIONAL_JOB_WRITE not in line:
                continue
            if line.lstrip().startswith(("//", "///", "//!")):
                continue
            window = "\n".join(lines[max(0, index - 8) : index])
            if UNCONDITIONAL_JOB_WRITE_MARKER in window:
                continue
            errors.append(
                f"{rel_path}:{index + 1}: driver 推进任务行必须用 cas_persist_job_with_resources，"
                f"否则会把用户的取消覆盖回 running（lost update）。"
                f"确属建新行的话，在调用点上方加注释 `{UNCONDITIONAL_JOB_WRITE_MARKER} <理由>`"
            )


def check_ocr_flow_boundaries(errors: list[str]) -> None:
    for path in scan_rs_files(OCR_FLOW_ROOT):
        rel_path = rel(path)
        text = path.read_text(encoding="utf-8")

        if rel_path != OCR_FLOW_ORCHESTRATOR_FILE:
            if "build_normalize_ocr_command(" in text:
                errors.append(
                    f"{rel_path}: only src/job_runner/ocr_flow/mod.rs may assemble normalize stage command"
                )
            if "execute_process_job(" in text:
                errors.append(
                    f"{rel_path}: only src/job_runner/ocr_flow/mod.rs may hand OCR child flow back to process runner"
                )
            if "MineruClient::new(" in text or "PaddleClient::new(" in text:
                errors.append(
                    f"{rel_path}: only src/job_runner/ocr_flow/mod.rs may assemble provider clients for OCR flow dispatch"
                )

        if "crate::routes::" in text:
            errors.append(
                f"{rel_path}: ocr_flow must not depend on routes"
            )
        if "crate::services::jobs::presentation" in text:
            errors.append(
                f"{rel_path}: ocr_flow must not depend on jobs presentation layer"
            )
        if "crate::services::artifacts::" in text:
            errors.append(
                f"{rel_path}: ocr_flow must not depend directly on services::artifacts facade"
            )
        if "crate::job_runner::translation_flow" in text or "crate::job_runner::render_flow" in text:
            errors.append(
                f"{rel_path}: ocr_flow must not depend on translation/render runner flows"
            )

        for token in PROVIDER_RAW_INTERNAL_TOKENS:
            if token in text and rel_path not in OCR_FLOW_ALLOWED_RAW_TOKEN_FILES:
                errors.append(
                    f"{rel_path}: only dedicated provider artifact helpers may understand provider raw token '{token}'"
                )



def check_job_runner_boundary(errors: list[str]) -> None:
    # 只扫壳自己的 src/：子 crate 内部当然可以自由使用 job_runner。
    for path in scan_rs_files(SRC_ROOT):
        rel_path = rel(path)
        if rel_path in JOB_RUNNER_IMPORT_ALLOWLIST:
            continue
        if rel_path.parts[:2] == ("src", "api_tests"):
            continue
        text = path.read_text(encoding="utf-8")
        if "job_runner::" in text:
            errors.append(
                f"{rel_path}: shell code must reach the job runtime through "
                f"services/runtime_gateway.rs (ADR-002); use crate::process:: for "
                f"generic process utilities"
            )

def check_worker_command_boundary(errors: list[str]) -> None:
    text = route_source_without_tests(WORKER_COMMAND_FACADE)
    forbidden_facade_tokens = (
        "enum JobPathArg",
        "enum OcrArg",
        "const JOB_PATH_ARGS",
        "const OCR_ARGS",
        "fn push_job_path_args",
        "fn push_ocr_args",
        "write_normalize_stage_spec(",
        "write_translate_stage_spec(",
        "write_render_stage_spec(",
    )
    for token in forbidden_facade_tokens:
        if token in text:
            errors.append(
                f"src/worker_command.rs: worker command facade must not own OCR args or stage spec assembly ({token})"
            )

    required_modules = (
        abs_src(Path("src/worker_command/legacy_ocr.rs")),
        abs_src(Path("src/worker_command/stage_commands.rs")),
        abs_src(Path("src/worker_command/stage_specs.rs")),
    )
    for path in required_modules:
        if not path.exists():
            errors.append(f"{rel(path)}: expected worker command boundary module is missing")

    job_runner_forbidden_tokens = (
        "build_normalize_ocr_command",
        "build_translate_only_command",
        "build_render_only_command",
    )
    for path in scan_rs_files(SRC_ROOT / "job_runner"):
        rel_path = rel(path)
        text = route_source_without_tests(path)
        for token in job_runner_forbidden_tokens:
            if token in text:
                errors.append(
                    f"{rel_path}: job_runner must request WorkerStageCommand instead of direct {token}"
                )

    snapshot_factory_path = SRC_ROOT / "services" / "job_snapshot_factory.rs"
    snapshot_factory_text = route_source_without_tests(snapshot_factory_path)
    if "crate::worker_command" in snapshot_factory_text or "build_ocr_command" in snapshot_factory_text:
        errors.append(
            "src/services/job_snapshot_factory.rs: snapshot creation must not build worker commands"
        )

    child_creation_path = abs_src(Path("src/job_runner/translation_flow_child.rs"))
    child_creation_text = route_source_without_tests(child_creation_path)
    if "build_ocr_command" in child_creation_text:
        errors.append(
            "src/job_runner/translation_flow_child.rs: OCR child creation must keep a placeholder command; execute_ocr_job builds provider command"
        )


def check_protocol_docs(errors: list[str]) -> None:
    path = REPO_ROOT / "API_SPEC.md"
    text = path.read_text(encoding="utf-8")
    forbidden_tokens = (
        "logs/events.jsonl",
        "- `mineru_upload`",
        "- `mineru_processing`",
    )
    for token in forbidden_tokens:
        if token in text:
            errors.append(
                f"API_SPEC.md: stale protocol token '{token}' must not appear in the external API spec"
            )


def main() -> int:
    errors: list[str] = []
    check_appstate_boundaries(errors)
    check_route_runner_dependency(errors)
    check_route_input_extractors(errors)
    check_multipart_field_buffering(errors)
    check_jobs_route_deps_dedup(errors)
    check_route_state_resource_access(errors)
    check_route_service_imports(errors)
    check_route_model_boundary(errors)
    check_service_model_facade_boundaries(errors)
    check_upload_boundaries(errors)
    check_business_private_modules(errors)
    check_agent_calculation_dependencies(errors)
    check_ai_gateway_dependencies(errors)
    check_runtime_ownership(errors)
    check_jobs_dependency_boundaries(errors)
    check_process_runtime_deps_usage(errors)
    check_job_persist_deps_usage(errors)
    check_shared_artifact_presentation(errors)
    check_runtime_deps_module_boundary(errors)
    check_state_recovery_boundary(errors)
    check_lifecycle_helper_boundaries(errors)
    check_provider_markdown_fallback(errors)
    check_artifact_boundary_layer(errors)
    check_downloads_do_not_generate_artifacts(errors)
    check_stage_view_projection_boundary(errors)
    check_job_readiness_boundary(errors)
    check_translation_debug_boundary(errors)
    check_reader_regions_boundary(errors)
    check_summary_loaders_boundary(errors)
    check_ocr_flow_boundaries(errors)
    check_unconditional_job_writes(errors)
    check_failure_catalogue_covers_python_codes(errors)
    check_job_runner_boundary(errors)
    check_worker_command_boundary(errors)
    check_protocol_docs(errors)

    if errors:
        print("rust_api architecture check failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("rust_api architecture check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
