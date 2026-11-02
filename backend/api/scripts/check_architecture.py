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
    "job_runner": "../packages/retainpdf-runner",
    "db": "../../database/retainpdf-db",
    "job_events": "../packages/retainpdf-data",
    "worker_command": "../packages/retainpdf-data",
    "ocr_provider": "../packages/retainpdf-data",
    "models": "../packages/retainpdf-core",
    "storage_paths": "../packages/retainpdf-core",
    "config": "../packages/retainpdf-core",
    "job_failure": "../packages/retainpdf-core",
    "job_failure_structured": "../packages/retainpdf-core",
    "job_failure_support": "../packages/retainpdf-core",
    # 2026-10-16 挪进 API 各领域包共用的底座。
    "error": "../packages/retainpdf-api-base",
    "job_loading": "../packages/retainpdf-api-base",
}

# 失败分类由两个地方产生：Python 流水线的 structured_errors.py（worker 打出
# `structured failure json:`，Rust 解析到就直接返回，本地检测分支一行都不跑）
# 和 Rust 的 job_failure.rs（结构化 JSON 缺失时才兜底）。恢复目录当初只照着
# 后者写，于是前者的 7 个取值全在吃「未识别的失败类型，重试会从头开始」——
# 一句假话：恢复按钮根本不看分类，照样只重跑渲染。这条门禁把两份清单钉在一起。
FAILURE_CATALOGUE_LABEL = "src/job_failure_catalogue.rs"
FAILURE_CATALOGUE_PATH = (
    REPO_ROOT.parent / "packages" / "retainpdf-core" / "src" / "job_failure_catalogue.rs"
)
PYTHON_STRUCTURED_ERRORS = (
    REPO_ROOT.parent / "pipeline" / "retainpdf_pipeline" / "foundation" / "shared" / "structured_errors.py"
)
PYTHON_FAILURE_CODE_PATTERN = re.compile(r'^\s*error_type = "([a-z0-9_]+)"', re.MULTILINE)
CATALOGUE_KEY_PATTERN = re.compile(r'^\s*\("([a-z0-9_]+)", FailureRecovery \{', re.MULTILINE)

ALL_SRC_ROOTS = (
    SRC_ROOT,
    REPO_ROOT.parent.parent / "database" / "retainpdf-db" / "src",
    REPO_ROOT.parent / "packages" / "retainpdf-core" / "src",
    REPO_ROOT.parent / "packages" / "retainpdf-data" / "src",
    REPO_ROOT.parent / "packages" / "retainpdf-runner" / "src",
    REPO_ROOT.parent / "packages" / "retainpdf-api-base" / "src",
)


# 拆任务、书库的准备（2026-10-16）：这两个领域的规则一律写逻辑路径 `src/services/<领域>/...`，
# 实际在哪个目录只登记在这里。值是 None 表示还在 rust_api 的 services/<领域>/ 下；挪进独立的包时只改这一处，例如
#     "jobs": lambda: extracted_domain_root("jobs") / "src",
# 挪进包以后门面从 mod.rs 变成 lib.rs，abs_src() 和 rel() 会对上。按目录扫文件用 scan_logical()，
# 不要直接 scan_rs_files(SRC_ROOT / ...)，否则挪走的领域扫不到，规则会静悄悄地什么都不查。
# 任务、书库 2026-10-17 分别挪进了 retainpdf-jobs、retainpdf-library。
DOMAIN_MOUNTS: dict = {
    "jobs": lambda: extracted_domain_root("jobs") / "src",
    "library": lambda: extracted_domain_root("library") / "src",
}


def mounted_domain_root(domain: str) -> Path:
    target = DOMAIN_MOUNTS[domain]
    return SRC_ROOT / "services" / domain if target is None else target()


def _mounted_facade(domain: str) -> str:
    return "mod.rs" if DOMAIN_MOUNTS[domain] is None else "lib.rs"


def abs_src(rel_path: Path) -> Path:
    parts = rel_path.parts
    if len(parts) >= 3 and parts[:2] == ("src", "services") and parts[2] in DOMAIN_MOUNTS:
        rest = Path(*parts[3:]) if len(parts) > 3 else Path()
        if rest == Path("mod.rs"):
            rest = Path(_mounted_facade(parts[2]))
        return mounted_domain_root(parts[2]) / rest
    key = parts[1].removesuffix(".rs") if len(parts) > 1 else ""
    crate = _CRATE_OF_MODULE.get(key)
    return (REPO_ROOT / crate / rel_path) if crate else (REPO_ROOT / rel_path)


def _mounted_elsewhere() -> list[Path]:
    """DOMAIN_MOUNTS 里已经挪出 rust_api 的领域的实际目录。"""
    return [
        mounted_domain_root(domain)
        for domain in sorted(DOMAIN_MOUNTS)
        if not mounted_domain_root(domain).resolve().is_relative_to(SRC_ROOT.resolve())
    ]


def scan_logical(logical_root: Path) -> list[Path]:
    """逻辑路径下的所有 .rs 文件，包括登记在 DOMAIN_MOUNTS 里、已经挪到别处的领域。"""
    root = abs_src(logical_root)
    paths = set(scan_rs_files(root)) if root.is_dir() else set()
    for domain in sorted(DOMAIN_MOUNTS):
        mounted = mounted_domain_root(domain)
        if (Path("src/services") / domain).is_relative_to(logical_root) and not mounted.resolve().is_relative_to(
            root.resolve()
        ):
            paths.update(scan_rs_files(mounted))
    return sorted(paths)


def scan_all_rs_files() -> list:
    out = []
    for root in ALL_SRC_ROOTS:
        out.extend(scan_rs_files(root))
    for root in _mounted_elsewhere():
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
    Path("src/routes/providers.rs"),
    Path("src/routes/sync.rs"),
    Path("src/routes/backups.rs"),
    Path("src/routes/uploads.rs"),
    # 建任务的测试要搭整个 AppState，任务拆成包以后挪到了 api_tests/jobs_creation（不在 APPSTATE_GUARDED_DIRS 里）。
    Path("src/services/jobs/support.rs"),
}

# ADR-002 Phase 2：壳只能经接缝碰任务运行时。job_runner 是 jobsd 的地盘，
# 壳里唯二可以引用它的地方是 InProcess 落点的装配处与接缝本身——多一个
# 文件引用，就意味着"换落点不影响上层"这条保证被悄悄打破了。
# （纯 OS 进程工具已迁往 retainpdf-proc，用 crate::process::，不算越界。）
JOB_RUNNER_IMPORT_ALLOWLIST = {
    Path("src/app/jobs.rs"),
    Path("src/services/jobs/runtime_gateway.rs"),
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
}

ROUTE_STATE_RESOURCE_ALLOWLIST = {
    Path("src/routes/common/accounts.rs"),
    Path("src/routes/common/agent_calculations.rs"),
    Path("src/routes/common/agent_capabilities.rs"),
    Path("src/routes/common/agent_runtime_sessions.rs"),
    Path("src/routes/common/auth.rs"),
    Path("src/routes/common/credentials.rs"),
    Path("src/routes/common/document_operations.rs"),
    Path("src/routes/common/fonts.rs"),
    Path("src/routes/common/platform_settings.rs"),
    Path("src/routes/common/glossaries.rs"),
    Path("src/routes/common/job_data.rs"),
    Path("src/routes/common/quality.rs"),
    Path("src/routes/common/usage.rs"),
    Path("src/routes/common/health.rs"),
    Path("src/routes/common/jobs.rs"),
    Path("src/routes/common/library.rs"),
    Path("src/routes/common/providers.rs"),
    Path("src/routes/common/sync.rs"),
    Path("src/routes/common/backups.rs"),
    Path("src/routes/common/uploads.rs"),
}

ROUTE_SERVICE_IMPORT_ALLOWLIST = {
    Path("src/routes/model_requests.rs"): (
        "crate::services::providers",
    ),
    Path("src/routes/agent_calculations.rs"): (
        "crate::services::ai",
    ),
    Path("src/routes/glossaries.rs"): (
        "crate::services::glossaries",
    ),
    Path("src/routes/sync.rs"): (
        "crate::services::platform",
    ),
    Path("src/routes/backups.rs"): (
        "crate::services::platform",
    ),
    Path("src/routes/health.rs"): (
        "crate::services::platform",
    ),
    Path("src/routes/credentials.rs"): (
        "crate::services::providers",
    ),
    Path("src/routes/document_operations.rs"): (
        "crate::services::ai",
    ),
    Path("src/routes/agent_runtime_sessions.rs"): (
        "crate::services::ai",
    ),
    Path("src/routes/agent_capabilities.rs"): (
        "crate::services::ai",
    ),
    Path("src/routes/public_document_operations.rs"): (
        "crate::services::ai",
    ),
    # Library thick routes migrate to library_api in PR2–PR5; allowlist is
    # ready so partial moves do not require revisiting this file each PR.
    Path("src/routes/library_data.rs"): (
        "crate::services::library",
    ),
    Path("src/routes/library_extras.rs"): (
        "crate::services::library",
    ),
    Path("src/routes/collections.rs"): (
        "crate::services::library",
    ),
    Path("src/routes/uploads.rs"): (
        "crate::services::ingest",
    ),
    Path("src/routes/common/uploads.rs"): (
        "crate::services::ingest::UploadApiDeps",
    ),
    Path("src/routes/common/agent_capabilities.rs"): (
        "crate::services::ai::AgentCapabilityAuthority",
    ),
    Path("src/routes/common/agent_runtime_sessions.rs"): (
        "crate::services::ai::AgentRuntimeSessionApiDeps",
    ),
    Path("src/routes/common/agent_calculations.rs"): (
        "crate::services::ai::AgentCalculationApiDeps",
    ),
    Path("src/routes/common/glossaries.rs"): (
        "crate::services::glossaries::GlossaryApiDeps",
    ),
    Path("src/routes/common/sync.rs"): (
        "crate::services::platform::SyncApiDeps",
    ),
    Path("src/routes/common/backups.rs"): (
        "crate::services::platform::BackupApiDeps",
    ),
    Path("src/routes/common/health.rs"): (
        "crate::services::platform::HealthApiDeps",
    ),
    Path("src/routes/common/jobs.rs"): (
        "crate::app::{build_jobs_facade_from_state, AppState}",
        "crate::services::jobs::{JobDeletion, JobDownloads, JobQueries, JobsFacade}",
    ),
    Path("src/routes/common/library.rs"): (
        "crate::services::library::LibraryDeps",
    ),
    # 下载类路由只把 services::jobs 给的 FileDownload 组成响应，怎么找文件都在 services::jobs 的 open 里。
    Path("src/routes/download_response/files.rs"): (
        "crate::services::jobs::FileDownload",
    ),
    # /jobs/:id/files/<组>/<文件名>：路由只说组，文件名的翻译在 services::jobs。
    Path("src/routes/jobs/files.rs"): (
        "crate::services::jobs::FileGroup",
    ),
    Path("src/routes/providers.rs"): (
        "crate::services::providers",
    ),
    Path("src/routes/ai_proxy.rs"): (
        "crate::services::ai",
    ),
    Path("src/routes/fonts.rs"): (
        "crate::services::platform",
    ),
    Path("src/routes/common/providers.rs"): (
        "crate::services::providers::ProviderApiDeps",
    ),
    Path("src/routes/common/fonts.rs"): (
        "crate::services::platform::FontApiDeps",
    ),
    # 报告：质量报告、单个任务的模型用量各有自己的服务。
    Path("src/routes/jobs/reports.rs"): (
        "crate::services::jobs",
    ),
    Path("src/routes/jobs/data.rs"): (
        "crate::services::jobs",
    ),
    Path("src/routes/common/job_data.rs"): (
        "crate::services::jobs::JobDataApiDeps",
    ),
    Path("src/routes/token_usage.rs"): (
        "crate::services::jobs",
    ),
    Path("src/routes/common/quality.rs"): (
        "crate::services::jobs::QualityApiDeps",
    ),
    Path("src/routes/common/usage.rs"): (
        "crate::services::jobs::UsageApiDeps",
    ),
    Path("src/routes/accounts.rs"): (
        "crate::services::accounts",
    ),
    Path("src/routes/admin_users.rs"): (
        "crate::services::accounts",
    ),
    Path("src/routes/admin_invites.rs"): (
        "crate::services::accounts",
    ),
    Path("src/routes/admin_platform.rs"): (
        "crate::services::accounts",
    ),
    Path("src/routes/common/platform_settings.rs"): (
        "crate::services::accounts::PlatformSettingsApiDeps",
    ),
    Path("src/routes/common/accounts.rs"): (
        "crate::services::accounts::AccountsService",
    ),
}

ROUTE_QUALIFIED_SERVICE_ACCESS_ALLOWLIST: set[Path] = set()

ARTIFACT_BOUNDARY_FILES = {
    Path("src/storage_paths.rs"),
    Path("src/routes/jobs/files.rs"),
}
# 文件包 retainpdf-files 里的产物清单和打包，路径相对包的 src/。
FILES_ARTIFACT_BOUNDARY_FILES = (
    Path("artifacts/mod.rs"),
    Path("artifacts/bundle.rs"),
    Path("artifacts/registry.rs"),
    Path("artifacts/response.rs"),
    Path("artifacts/presentation.rs"),
)

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
DOWNLOADS_ROOT = Path("src/services/jobs/files/downloads")
STAGE_VIEW_CONSUMER_ROOTS = (
    Path("src/services/jobs/presentation"),
)
WORKER_COMMAND_FACADE = abs_src(Path("src/worker_command.rs"))

# These leaves need persistence only, even if they are split into submodules.
PERSIST_ONLY_RUNNER_MODULES = (
    Path("src/job_runner/ocr_flow/bundle_events"),
    Path("src/job_runner/render_flow_artifacts"),
    Path("src/job_runner/translation_flow_artifacts"),
)

def rel(path: Path) -> Path:
    resolved = path.resolve()
    for domain in sorted(DOMAIN_MOUNTS):
        root = mounted_domain_root(domain).resolve()
        if resolved.is_relative_to(root):
            rest = resolved.relative_to(root)
            if rest == Path(_mounted_facade(domain)):
                rest = Path("mod.rs")
            return Path("src/services") / domain / rest
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
        for path in scan_logical(guarded_dir):
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
        # `use axum::extract::{Path, ..};` 和嵌在 `use axum::{extract::{Path, ..}, ..};` 里的都算
        # （模型执行器的内部接口以前就是靠嵌套写法漏过去的）。
        for import_body in re.findall(r"\bextract::\{(.*?)\}", text, re.DOTALL):
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
    # 只读的类只能用只读的依赖；混着读和写的类，只有列出来的写操作（和它们的响应 helper）
    # 可以拿完整的任务门面。
    narrow_modules = (
        Path("src/routes/jobs/files"),
        Path("src/routes/jobs/reports"),
        Path("src/routes/jobs/reader"),
        Path("src/routes/jobs/data"),
        Path("src/routes/jobs/ai"),
        Path("src/routes/download_response"),
    )
    mixed_modules = {
        # delete_job：强删前要经完整门面取消 runner（cancel_before_delete）。
        Path("src/routes/jobs/lifecycle"): {"create_job", "create_ocr_job", "delete_job"},
        Path("src/routes/jobs/actions"): {
            "get_stage_actions",
            "stage_actions_response",
            "cancel_job",
            "cancel_ocr_job",
            "cancel_job_response",
            "resume_job",
            "resume_job_response",
            "retry_stage",
            "retry_stage_response",
            "resolve_ocr_ambiguity",
            "resolve_ocr_ambiguity_response",
        },
        # 边翻边看的版面和单页读的是运行中的状态，要完整门面。
        Path("src/routes/jobs/progress"): {
            "get_live_translation_layout",
            "get_live_translation_page",
        },
        Path("src/routes/jobs/translations"): {
            "replay_translation_item_route",
            "replay_translation_item_response",
            "revise_translation_item_route",
            "revise_translation_item_response",
        },
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


RUST_LEXICAL_TOKEN = re.compile(r'''//|/\*|(?:br|cr|r)\#*"|(?:b|c)?"|b?'(?:\\(?:u\{[^}]*\}|x[0-9a-fA-F]{2}|.)|[^'\\\n])' ''', re.VERBOSE)


def rust_lexical_spans(text: str):
    """Yield (token, start, end) for each comment and literal, handling nested block comments."""
    cursor = 0
    while match := RUST_LEXICAL_TOKEN.search(text, cursor):
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
        yield value, start, end
        cursor = end


def rust_code_only(text: str) -> str:
    """Mask comments and literals, preserving offsets and nested block comments.

    These guards inspect Rust identifiers and braces, not strings or comments.
    Masking literals also keeps URLs and raw strings from confusing // or {}.
    """
    result = list(text)
    for _, start, end in rust_lexical_spans(text):
        result[start:end] = ["\n" if char == "\n" else " " for char in text[start:end]]
    return "".join(result)


def rust_string_literals(text: str) -> list[str]:
    """String literals of `text` outside comments (raw strings included, char literals not)."""
    return [text[start:end] for token, start, end in rust_lexical_spans(text) if token.endswith('"')]


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
        abs_src(Path("src/job_events")),
        abs_src(Path("src/job_events.rs")),
        abs_src(Path("src/db")),
        abs_src(Path("src/db.rs")),
        abs_src(Path("src/storage_paths")),
        abs_src(Path("src/storage_paths.rs")),
        abs_src(Path("src/worker_command")),
        abs_src(Path("src/worker_command.rs")),
        SRC_ROOT / "app" / "state.rs",
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
        abs_src(Path("src/services/jobs/lifecycle/snapshot_factory.rs")),
        abs_src(Path("src/services/jobs/lifecycle/validation.rs")),
        abs_src(Path("src/services/jobs/lifecycle/launcher.rs")),
        abs_src(Path("src/services/jobs/files/downloads")),
        abs_src(Path("src/services/jobs/files/downloads.rs")),
        abs_src(Path("src/services/jobs/lifecycle/creation")),
        abs_src(Path("src/services/jobs/lifecycle/submission.rs")),
        abs_src(Path("src/services/jobs/presentation")),
        abs_src(Path("src/services/jobs/actions/cancel.rs")),
        abs_src(Path("src/services/jobs/translations")),
        abs_src(Path("src/services/jobs/reports")),
        abs_src(Path("src/services/jobs/facade.rs")),
        abs_src(Path("src/services/jobs/deps")),
        abs_src(Path("src/services/jobs/progress/live_translation_queries.rs")),
        abs_src(Path("src/services/jobs/ai")),
        abs_src(Path("src/services/jobs/reader/markdown.rs")),
                abs_src(Path("src/services/jobs/actions/cancel_submission.rs")),
        abs_src(Path("src/services/jobs/actions/rerun.rs")),
        abs_src(Path("src/services/jobs/actions/stage_retry.rs")),
        abs_src(Path("src/services/jobs/actions/stage_retry_overrides.rs")),
        abs_src(Path("src/services/jobs/actions/stage_retry_request.rs")),
        abs_src(Path("src/services/jobs/actions/stage_retry_view.rs")),
        abs_src(Path("src/services/jobs/progress/live_stage")),
        abs_src(Path("src/services/jobs/progress/live_stage.rs")),
        abs_src(Path("src/services/jobs/reader/reader_regions")),
        abs_src(Path("src/services/jobs/reader/reader_regions.rs")),
        abs_src(Path("src/services/jobs/query.rs")),
        abs_src(Path("src/services/jobs/lifecycle/queries.rs")),
        abs_src(Path("src/services/jobs/progress/queries.rs")),
        abs_src(Path("src/services/jobs/files/queries.rs")),
        abs_src(Path("src/services/jobs/reader/queries.rs")),
        abs_src(Path("src/services/jobs/actions/resume_plan.rs")),
        abs_src(Path("src/services/jobs/actions/stage_plan.rs")),
        abs_src(Path("src/services/jobs/progress/stage_view.rs")),
        abs_src(Path("src/services/jobs/summary_loaders")),
        abs_src(Path("src/services/jobs/summary_loaders.rs")),
        abs_src(Path("src/services/jobs/support.rs")),
        abs_src(Path("src/services/library")),
        abs_src(Path("src/services/library/api.rs")),
    )
    for root in scoped_roots:
        paths = [root] if root.is_file() else scan_rs_files(root)
        for path in paths:
            rel_path = rel(path)
            if path.name == "tests.rs":
                continue
            text = route_source_without_tests(path)
            # 任务拆成包以后写的是 `retainpdf_core::models`，两种写法都查（2026-10-17）。
            for line in re.findall(r"^use (?:crate|retainpdf_core)::models(?:::|::\{)[^\n;]+", text, re.MULTILINE):
                if not any(
                    allowed in line
                    for allowed in (
                        "::models::api",
                        "::models::domain",
                        "::models::request",
                    )
                ):
                    errors.append(
                        f"{rel_path}: migrated service modules must import models through models::api/domain/request facades ({line})"
                    )


def check_jobs_dependency_boundaries(errors: list[str]) -> None:
    root = abs_src(Path("src/services/jobs/deps"))
    paths = scan_rs_files(root)
    narrow_modules = (
        abs_src(Path("src/services/jobs/query")),
        abs_src(Path("src/services/jobs/files/downloads")),
        abs_src(Path("src/services/jobs/lifecycle/queries")),
        abs_src(Path("src/services/jobs/progress/queries")),
        abs_src(Path("src/services/jobs/files/queries")),
        abs_src(Path("src/services/jobs/reader/queries")),
        abs_src(Path("src/services/jobs/reports/queries")),
        abs_src(Path("src/services/jobs/translations/queries")),
        # 原来在 query/、downloads/ 里，按类挪出去的只读部分。
        abs_src(Path("src/services/jobs/reports/failure")),
        abs_src(Path("src/services/jobs/actions/resume_plan")),
        abs_src(Path("src/services/jobs/reader/markdown")),
        abs_src(Path("src/services/jobs/ai")),
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
    if (abs_src(Path("src/services/jobs/lifecycle/creation/context.rs"))).exists():
        errors.append("jobs/creation/context.rs: shared dependencies belong in jobs/deps")


def check_runtime_ownership(errors: list[str]) -> None:
    # 健康检查（平台包）不自己读监督器：routes/common/health.rs 建依赖时读好状态传进 HealthApiDeps。
    allowed = {Path("src/app/server.rs"), Path("src/app/state.rs"),
               Path("src/routes/common/health.rs")}
    for path in scan_logical(Path("src")):
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
    """AI 网关的配置和健康状态由装配传进来，不自己读环境变量、不自己读监督器。

    网关在 AI 包 retainpdf-ai 里：碰 `crate::runtime` 的监督器、越过门面用 `gateway` 子模块，编译器已经挡住了。
    只管网关本身（`lib.rs`、`api.rs`、`gateway.rs`）；同一个包里的 agent_*、document_operations 是别的模块。
    """
    crate_root = extracted_domain_root("ai")
    for name in ("lib.rs", "api.rs", "gateway.rs"):
        path = crate_root / "src" / name
        if not path.exists():
            continue
        text = route_source_without_tests(path)
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        if re.search(r"\b(?:from_env|ai_service_status)\s*\(|\benv\s*::\s*var\s*\(|\bLazy\b", text):
            errors.append(
                f"{Path(EXTRACTED_DOMAINS['ai']) / 'src' / name}: AI gateway must receive configuration and health source from app assembly"
            )


def check_agent_calculation_dependencies(errors: list[str]) -> None:
    """Calculation storage needs Db and data_root, not application configuration.

    在 AI 包 retainpdf-ai 的 `agent_calculations/` 里。`AppState`、rust_api 的 `api_tests` 包里本来就引用不到，
    `AppConfig` 在 retainpdf-core 里、引用得到，所以这条还要查。
    """
    crate_root = extracted_domain_root("ai")
    for path in scan_rs_files(crate_root / "src" / "agent_calculations"):
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        if re.search(r"\b(?:AppConfig|AppState|api_tests)\b", text):
            errors.append(
                f"{Path(EXTRACTED_DOMAINS['ai']) / path.relative_to(crate_root)}: agent calculations must use narrow Db/data_root dependencies, including test fixtures"
            )


def check_upload_boundaries(errors: list[str]) -> None:
    """上传模块只返回自己的 UploadError、不读环境变量。

    它在入口包 retainpdf-ingest 里：越过门面、依赖任务和路由、碰 AppState，编译器已经挡住了；
    HTTP 错误的转换写在入口包的 lib.rs，`uploads/api.rs` 是上传对外的入口，也可以用 AppError。
    """
    crate_root = extracted_domain_root("ingest")
    upload_root = crate_root / "src" / "uploads"
    for path in scan_rs_files(upload_root):
        label = Path(EXTRACTED_DOMAINS["ingest"]) / path.relative_to(crate_root)
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)
        if path != upload_root / "api.rs" and re.search(r"\bAppError\b", text):
            errors.append(
                f"{label}: uploads must return UploadError; HTTP error mapping belongs outside the domain"
            )
        if re.search(r"\bfrom_env\s*\(|\benv\s*::\s*(?:var|var_os|vars|vars_os)\s*\(", text):
            errors.append(
                f"{label}: uploads must receive startup configuration explicitly, not read environment"
            )


def check_process_runtime_deps_usage(errors: list[str]) -> None:
    legacy_pattern = "ProcessRuntimeDeps::from_state("
    new_pattern = "ProcessRuntimeDeps::new("
    allowed_new_callers = {
        Path("src/app/jobs.rs"),
        Path("src/job_runner/process_runner.rs"),
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
    # 书库包的书架投影（book_projection）2026-10-22 跟书架接口一起删了，「任务不许依赖它」那两条规则也删了。
    # 产物的展示（列表里每一项叫什么、链接）在文件包 retainpdf-files 的 artifacts/presentation。
    files_root = extracted_domain_root("files")
    for path in scan_rs_files(files_root / "src"):
        if path.stem == "tests" or path.stem.endswith("_tests"):
            continue
        in_crate = path.relative_to(files_root / "src")
        relative = Path(EXTRACTED_DOMAINS["files"]) / "src" / in_crate
        text = rust_boundary_source(path)
        if is_rust_module_path(in_crate, Path("artifacts/presentation")):
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
            "src/app/state.rs: stale running job recovery must stay in src/job_runner/startup_recovery.rs"
        )

    # 原来查的 src/app/state_recovery.rs 早就不在了（这半条一直什么都没查）；恢复在 job_runner 的 startup_recovery.rs。
    recovery_path = abs_src(Path("src/job_runner/startup_recovery.rs"))
    recovery_text = recovery_path.read_text(encoding="utf-8")
    if "fn reconcile_stale_running_jobs(" not in recovery_text:
        errors.append(
            "src/job_runner/startup_recovery.rs: expected reconcile_stale_running_jobs(...) helper is missing"
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
    files_root = extracted_domain_root("files")
    targets = [(rel_path, abs_src(rel_path)) for rel_path in sorted(ARTIFACT_BOUNDARY_FILES)]
    targets += [
        (Path(EXTRACTED_DOMAINS["files"]) / "src" / rel_path, files_root / "src" / rel_path)
        for rel_path in FILES_ARTIFACT_BOUNDARY_FILES
    ]
    for rel_path, path in targets:
        text = path.read_text(encoding="utf-8")
        # 文件包里写包名：retainpdf_data::ocr_provider。
        if re.search(r"\b(?:crate|retainpdf_data)::ocr_provider::", text):
            errors.append(
                f"{rel_path}: artifact/download boundary must not depend directly on ocr_provider"
            )
        for token in PROVIDER_RAW_INTERNAL_TOKENS:
            if token in text:
                errors.append(
                    f"{rel_path}: artifact/download boundary must not understand provider raw internal token '{token}'"
                )


def check_downloads_do_not_generate_artifacts(errors: list[str]) -> None:
    for path in scan_rs_files(abs_src(DOWNLOADS_ROOT)):
        rel_path = rel(path)
        text = path.read_text(encoding="utf-8")
        if "std::process::Command" in text or "Command::new(" in text:
            errors.append(
                f"{rel_path}: downloads layer must not spawn artifact generators; use services::files::derived_artifacts"
            )
        if "import fitz" in text or "qpdf" in text:
            errors.append(
                f"{rel_path}: downloads layer must not embed PDF generation scripts; use services::files::derived_artifacts"
            )

    downloads_facade = abs_src(Path("src/services/jobs/files/downloads.rs"))
    text = route_source_without_tests(downloads_facade)
    for token in (
        # `crate::storage_paths::`，任务包里写 `retainpdf_core::storage_paths::`。
        "storage_paths::",
        "load_supported_job",
        "resolve_source_pdf",
        "resolve_output_pdf",
    ):
        if token in text:
            errors.append(
                f"{rel(downloads_facade)}: downloads facade must stay thin; move concrete download behavior into services/jobs/files/downloads/* ({token})"
            )


def check_stage_view_projection_boundary(errors: list[str]) -> None:
    allowed = {
        Path("src/services/jobs/presentation/detail_projection.rs"),
        Path("src/services/jobs/presentation/listing.rs"),
    }
    forbidden_tokens = (
        "public_stage_for_raw_stage(",
        "build_progress_view(",
        "progress_current",
        "progress_total",
        "background_stages.iter()",
    )
    for root in STAGE_VIEW_CONSUMER_ROOTS:
        for path in scan_rs_files(abs_src(root)):
            rel_path = rel(path)
            text = route_source_without_tests(path)
            if "JobDetailView" not in text and "JobListItemView" not in text:
                continue
            if rel_path not in allowed:
                continue
            if "build_job_stage_view(" not in text:
                errors.append(
                    f"{rel_path}: stage/progress presentation must use services::jobs::progress::stage_view::build_job_stage_view"
                )
            for token in forbidden_tokens:
                if token in text:
                    errors.append(
                        f"{rel_path}: stage/progress fallback belongs in services::jobs::progress::stage_view, found '{token}'"
                    )


def check_job_readiness_boundary(errors: list[str]) -> None:
    scoped_roots = (
        abs_src(Path("src/services/jobs/presentation")),
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
    debug_root = abs_src(Path("src/services/jobs/translations"))
    query_translation_debug = debug_root / "queries.rs"
    command_translation_debug = debug_root / "edits.rs"
    artifact_module = debug_root / "artifacts.rs"
    if not artifact_module.exists():
        errors.append(
            "src/services/jobs/translations/artifacts.rs: expected translation debug artifact reader boundary is missing"
        )
    if not command_translation_debug.exists():
        errors.append(
            "src/services/jobs/translations/edits.rs: expected translation debug command facade is missing"
        )

    projection_files = (
        debug_root / "index.rs",
        debug_root / "item.rs",
        abs_src(Path("src/services/jobs/reports/translation_reports.rs")),
    )
    for path in projection_files:
        rel_path = rel(path)
        text = route_source_without_tests(path)
        if "super::index::load_manifest_pages" in text:
            errors.append(
                f"{rel_path}: debug projection must read manifest pages through translations::artifacts, not translations::index"
            )
        if path.name in {"index.rs", "item.rs"} and "resolve_translation_manifest" in text:
            errors.append(
                f"{rel_path}: translation manifest path resolution belongs in translations/artifacts.rs"
            )
        if path.name == "index.rs" and "resolve_translation_debug_index" in text:
            errors.append(
                f"{rel_path}: translation debug index file resolution belongs in translations/artifacts.rs"
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
                    f"{rel(query_translation_debug)}: query facade must not execute replay actions ({token}); use translations/edits.rs"
                )


def check_reader_regions_boundary(errors: list[str]) -> None:
    reader_projection = abs_src(Path("src/services/jobs/reader/reader_regions.rs"))
    reader_artifacts = abs_src(Path("src/services/jobs/reader/reader_regions/artifacts.rs"))
    if not reader_artifacts.exists():
        errors.append(
            "src/services/jobs/reader/reader_regions/artifacts.rs: expected reader artifact reader boundary is missing"
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
    summary_root = abs_src(Path("src/services/jobs/summary_loaders"))
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
        if "crate::services::files::artifacts::" in text:
            errors.append(
                f"{rel_path}: ocr_flow must not depend directly on services::files::artifacts facade"
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
    for path in scan_logical(Path("src")):
        rel_path = rel(path)
        if rel_path in JOB_RUNNER_IMPORT_ALLOWLIST:
            continue
        if rel_path.parts[:2] == ("src", "api_tests"):
            continue
        text = path.read_text(encoding="utf-8")
        if "job_runner::" in text:
            errors.append(
                f"{rel_path}: shell code must reach the job runtime through "
                f"services/jobs/runtime_gateway.rs (ADR-002); use crate::process:: for "
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
    for path in scan_rs_files(abs_src(Path("src/job_runner"))):
        rel_path = rel(path)
        text = route_source_without_tests(path)
        for token in job_runner_forbidden_tokens:
            if token in text:
                errors.append(
                    f"{rel_path}: job_runner must request WorkerStageCommand instead of direct {token}"
                )

    snapshot_factory_path = abs_src(Path("src/services/jobs/lifecycle/snapshot_factory.rs"))
    snapshot_factory_text = route_source_without_tests(snapshot_factory_path)
    # `crate::worker_command`，任务包里写 `retainpdf_data::worker_command`。
    if re.search(r"\bworker_command::", snapshot_factory_text) or "build_ocr_command" in snapshot_factory_text:
        errors.append(
            "src/services/jobs/lifecycle/snapshot_factory.rs: snapshot creation must not build worker commands"
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


# services 之间不准成环：成了环，改其中任何一个都得连着改另外几个——「牵一发而动全身」的来源。
# 按模块对登记（不按文件路径，挪文件不用改这里）。加这条规则时已有的环在 2026-10-16 拆完
# （`refactor/api-cycles`），名单是空的，以后出现任何环都直接报错。名单只许删、不许加。
KNOWN_SERVICE_CYCLE_EDGES: set[tuple[str, str]] = set()


# services 按拆包规划分成 9 个领域，一个领域以后拆成一个包（docs/ops/planning/api-reorg/
# 20261015-模块化单体拆包规划.md 第 3 节）。新模块放进某个领域，不另开顶层目录。
SERVICE_DOMAINS = {
    "accounts", "ai", "files", "glossaries", "ingest", "jobs", "library", "platform", "providers",
}

# 领域之间允许的依赖，(谁, 用谁)。照规划第 3 节的分层图，只能往下用；要加一条先看它会不会把
# 下层拉到上层去。平台设置归账号、要调服务商测连通性，所以账号在服务商上面（规划图原来画反了）。
ALLOWED_DOMAIN_DEPENDENCIES = {
    ("accounts", "providers"),
    ("ingest", "accounts"),
    ("jobs", "accounts"),
    ("jobs", "files"),
    ("jobs", "glossaries"),
    ("jobs", "providers"),
    ("library", "files"),
    ("library", "jobs"),
}


# 已经拆成独立包的领域 → 包所在的目录（backend/packages/<目录>，目录名就是包名）。
# 这些领域的代码不在 services/ 下，services/mod.rs 里 `pub(crate) use <包> as <领域>;` 接上。
EXTRACTED_DOMAINS = {
    "accounts": "retainpdf-accounts",
    "ai": "retainpdf-ai",
    "files": "retainpdf-files",
    "glossaries": "retainpdf-glossaries",
    "ingest": "retainpdf-ingest",
    "jobs": "retainpdf-jobs",
    "library": "retainpdf-library",
    "platform": "retainpdf-platform",
    "providers": "retainpdf-providers",
}


def check_service_domains(errors: list[str]) -> None:
    services_root = SRC_ROOT / "services"
    for entry in sorted(services_root.iterdir()):
        name = entry.stem
        if entry.name == "mod.rs" or (entry.is_dir() and name in SERVICE_DOMAINS):
            continue
        errors.append(
            f"{rel(entry)}: services only holds the domains {sorted(SERVICE_DOMAINS)}; "
            "put new modules inside one of them"
        )


# 每个领域的 mod.rs 就是它的门面：子模块一律私有，领域外要用的东西在 mod.rs 里 `pub(crate) use` 出来。
# 子模块私有以后，越过门面的路径编译不过；这条规则防止有人把子模块改回 pub。
def _check_private_submodules(path: Path, label: str, errors: list[str]) -> None:
    for match in re.finditer(r"(?m)^pub(?:\([^)]*\))?\s+mod\s+(\w+)\s*;", rust_boundary_source(path)):
        errors.append(
            f"{label}: submodule `{match.group(1)}` must stay private; export what other "
            "domains need from the facade instead"
        )


def extracted_domain_root(domain: str) -> Path:
    return REPO_ROOT.parent / "packages" / EXTRACTED_DOMAINS[domain]


def check_domain_facades(errors: list[str]) -> None:
    services_mod = SRC_ROOT / "services" / "mod.rs"
    services_mod_source = rust_boundary_source(services_mod) if services_mod.exists() else ""
    for domain in sorted(SERVICE_DOMAINS):
        if domain in EXTRACTED_DOMAINS:
            # 拆成独立包的领域：门面是那个包的 lib.rs；services 里只剩一行接上它，不许留半截目录。
            crate_dir = EXTRACTED_DOMAINS[domain]
            if (SRC_ROOT / "services" / domain).exists():
                errors.append(
                    f"src/services/{domain}: {domain} lives in the {crate_dir} crate now; "
                    "do not add code back under services/"
                )
            crate_name = crate_dir.replace("-", "_")
            if not re.search(rf"\buse\s+{crate_name}\s+as\s+{domain}\s*;", services_mod_source):
                errors.append(
                    f"src/services/mod.rs: re-export the {crate_dir} crate as services::{domain} "
                    f"(`pub(crate) use {crate_name} as {domain};`)"
                )
            lib = extracted_domain_root(domain) / "src" / "lib.rs"
            if not lib.exists():
                errors.append(f"{crate_dir}/src/lib.rs: missing domain facade")
            else:
                _check_private_submodules(lib, f"{crate_dir}/src/lib.rs", errors)
            continue
        path = SRC_ROOT / "services" / domain / "mod.rs"
        if not path.exists():
            errors.append(f"{rel(path)}: missing domain facade")
            continue
        _check_private_submodules(path, str(rel(path)), errors)


def check_domain_dependency_direction(errors: list[str]) -> None:
    edges = service_dependency_edges()
    for edge, path in sorted(edges.items()):
        if edge not in ALLOWED_DOMAIN_DEPENDENCIES:
            errors.append(
                f"{path}: services::{edge[0]} -> services::{edge[1]} is not an allowed domain "
                "dependency (ALLOWED_DOMAIN_DEPENDENCIES); depend downward only"
            )
    for edge in sorted(ALLOWED_DOMAIN_DEPENDENCIES - set(edges)):
        errors.append(
            f"ALLOWED_DOMAIN_DEPENDENCIES lists services::{edge[0]} -> services::{edge[1]}, which "
            "nothing uses any more; remove it"
        )


def _rust_use_paths(tree: str) -> list[str]:
    """Expand a use tree such as `a::{b, c::{d, e}}` into flat paths."""
    tree = tree.strip()
    brace = tree.find("{")
    if brace < 0:
        return [tree]
    prefix = tree[:brace].rstrip(":").strip()
    body = tree[brace + 1 : tree.rfind("}")]
    parts, current, depth = [], "", 0
    for char in body:
        depth += (char == "{") - (char == "}")
        if char == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += char
    parts.append(current)
    paths = []
    for part in parts:
        part = part.strip()
        if part:
            paths.extend(f"{prefix}::{sub}" if prefix else sub for sub in _rust_use_paths(part))
    return paths


def service_dependency_edges() -> dict[tuple[str, str], Path]:
    """(from, to) top-level services modules -> one file that creates the edge. Tests excluded."""
    edges: dict[tuple[str, str], Path] = {}
    for path in scan_logical(Path("src/services")):
        relative = rel(path).relative_to("src")
        if "tests" in relative.parts or path.name == "tests.rs" or path.name.endswith("_tests.rs"):
            continue
        module_path = list(relative.with_suffix("").parts)
        if module_path[-1] == "mod":
            module_path = module_path[:-1]
        if len(module_path) < 2:
            continue
        source = rust_boundary_source(path)
        candidates = []
        for match in re.finditer(r"\buse\s+([^;]+);", source):
            candidates.extend(_rust_use_paths(match.group(1)))
        candidates.extend(re.findall(r"(?<![:\w])crate::services::[A-Za-z_0-9:]+", source))
        for candidate in candidates:
            segments = [segment.strip() for segment in candidate.split("::") if segment.strip()]
            if segments and segments[0] == "pub":
                segments = segments[1:]
            if not segments:
                continue
            if segments[0] == "crate":
                absolute = segments[1:]
            elif segments[0] in ("super", "self"):
                absolute = list(module_path)
                while segments and segments[0] in ("super", "self"):
                    if segments[0] == "super":
                        absolute = absolute[:-1]
                    segments = segments[1:]
                absolute += segments
            else:
                continue
            if len(absolute) >= 2 and absolute[0] == "services" and absolute[1] != module_path[1]:
                edges.setdefault((module_path[1], absolute[1]), rel(path))
    edges.update({edge: path for edge, path in extracted_domain_dependency_edges().items() if edge not in edges})
    return edges


def extracted_domain_dependency_edges() -> dict[tuple[str, str], Path]:
    """拆成独立包的领域用别的领域时写的是包名（`retainpdf_providers::…`），不是 `crate::services::…`。"""
    crate_domains = {crate.replace("-", "_"): domain for domain, crate in EXTRACTED_DOMAINS.items()}
    edges: dict[tuple[str, str], Path] = {}
    for domain in sorted(EXTRACTED_DOMAINS):
        root = extracted_domain_root(domain) / "src"
        for path in scan_rs_files(root):
            relative = path.relative_to(root)
            if "tests" in relative.parts or path.name == "tests.rs" or path.name.endswith("_tests.rs"):
                continue
            source = rust_boundary_source(path)
            for crate_name in re.findall(r"(?<![:\w])(retainpdf_\w+)", source):
                target = crate_domains.get(crate_name)
                if target and target != domain:
                    edges.setdefault((domain, target), Path(EXTRACTED_DOMAINS[domain]) / "src" / relative)
    return edges


def _strongly_connected(nodes: set[str], edges: set[tuple[str, str]]) -> list[set[str]]:
    graph: dict[str, list[str]] = {node: [] for node in nodes}
    for source, target in edges:
        graph[source].append(target)
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    groups: list[set[str]] = []

    def visit(node: str) -> None:
        index[node] = low[node] = len(index)
        stack.append(node)
        on_stack.add(node)
        for target in sorted(graph[node]):
            if target not in index:
                visit(target)
                low[node] = min(low[node], low[target])
            elif target in on_stack:
                low[node] = min(low[node], index[target])
        if low[node] == index[node]:
            group = set()
            while True:
                member = stack.pop()
                on_stack.discard(member)
                group.add(member)
                if member == node:
                    break
            if len(group) > 1:
                groups.append(group)

    for node in sorted(nodes):
        if node not in index:
            visit(node)
    return groups


def check_service_dependency_cycles(errors: list[str]) -> None:
    edges = service_dependency_edges()
    nodes = {module for edge in edges for module in edge}
    cycle_edges: set[tuple[str, str]] = set()
    for group in _strongly_connected(nodes, set(edges)):
        for edge in sorted(edge for edge in edges if edge[0] in group and edge[1] in group):
            cycle_edges.add(edge)
            if edge not in KNOWN_SERVICE_CYCLE_EDGES:
                errors.append(
                    f"{edges[edge]}: services::{edge[0]} -> services::{edge[1]} closes a dependency cycle "
                    f"among {sorted(group)}; depend in one direction only (move the shared piece down or "
                    "pass it in)"
                )
    for edge in sorted(KNOWN_SERVICE_CYCLE_EDGES - cycle_edges):
        errors.append(
            f"KNOWN_SERVICE_CYCLE_EDGES lists services::{edge[0]} -> services::{edge[1]}, which is no "
            "longer part of a cycle; remove it"
        )


# 任务产物的路径只有出口模块能拼：任务的文件走 services/jobs/files/downloads 的 `open`，书的文件走
# library/media.rs，派生产物的生成在 derived_artifacts，产物清单和打包在 artifacts（这两个在文件包 retainpdf-files 里）。其它地方直接拼路径，流水线一改输出布局就跟着坏，
# 而且每个读的人都要知道文件放在哪（"牵一发动全身"的来源之一）。
ARTIFACT_PATH_RESOLVER = re.compile(
    r"\bresolve_(?:output_pdf|source_pdf|markdown_path|markdown_images_dir|normalized_document"
    r"|normalization_report|typst_source|typst_pdf|translation_manifest|translation_request_journal"
    r"|markdown_bundle_zip)\b"
)
# 正则认不出的另一种自己拼法：任务根目录（`resolve_job_root`）后面接手写的产物相对路径。
# 2026-10-19 元数据建议里这样拼规范化文档的位置，检查没拦住（书库接口审计 C9）。出口模块以外的
# 字符串字面量里不许出现流水线产物的存放位置；名单只列现在一处都没有的，免得误伤。
ARTIFACT_LAYOUT_LITERAL = re.compile(r"ocr/normalized|\bdocument\.v1\.json\b")
ARTIFACT_PATH_OWNERS = (
    Path("src/services/jobs/files/downloads"),
    # 原文 Markdown 的出口，原来在 downloads 里，按类挪到了阅读。
    Path("src/services/jobs/reader/markdown.rs"),
    # 书的文件（原文、封面、原文页）的出口。
    Path("src/services/library/media.rs"),
)
# 文件包 retainpdf-files 里只有这两块能拼，路径相对包的 src/；下载文件名、生成去重、门面都不许。
FILES_ARTIFACT_PATH_OWNERS = (
    Path("artifacts"),
    Path("derived_artifacts"),
)
# 2026-10-15 冻结的现状：这些文件还直接拼产物路径。只许删，不许加；删掉一个之后名单里还留着
# 就报错（免得名单悄悄变宽）。2026-10-17 清空：任务包、书库包内部读产物都改走任务包
# `files/downloads/stored.rs` 的 `stored_path(任务, data_root, StoredFile::…)`。要读产物就调它，不要往这里加文件。
KNOWN_ARTIFACT_PATH_READERS: set[Path] = set()


def builds_artifact_paths(path: Path) -> bool:
    """`resolve_*` 产物解析函数，或手写的产物存放位置（只看测试代码以外的字面量）。"""
    if ARTIFACT_PATH_RESOLVER.search(rust_boundary_source(path)):
        return True
    text = path.read_text(encoding="utf-8")
    test_at = rust_code_only(text).find("\n#[cfg(test)]")
    non_test = text if test_at < 0 else text[:test_at]
    return any(ARTIFACT_LAYOUT_LITERAL.search(literal) for literal in rust_string_literals(non_test))


def check_artifact_path_ownership(errors: list[str]) -> None:
    readers = set()
    for root in (Path("src/services"), Path("src/routes")):
        for path in scan_logical(root):
            if path.stem == "tests" or path.stem.endswith("_tests"):
                continue
            relative = rel(path)
            if any(is_rust_module_path(relative, owner) for owner in ARTIFACT_PATH_OWNERS):
                continue
            if builds_artifact_paths(path):
                readers.add(relative)
    files_root = extracted_domain_root("files")
    for path in scan_rs_files(files_root / "src"):
        if path.stem == "tests" or path.stem.endswith("_tests"):
            continue
        in_crate = path.relative_to(files_root / "src")
        if any(is_rust_module_path(in_crate, owner) for owner in FILES_ARTIFACT_PATH_OWNERS):
            continue
        if builds_artifact_paths(path):
            readers.add(Path(EXTRACTED_DOMAINS["files"]) / "src" / in_crate)
    for relative in sorted(readers - KNOWN_ARTIFACT_PATH_READERS):
        errors.append(
            f"{relative}: builds artifact paths itself (storage_paths::resolve_*, or a hard-coded "
            "artifact location such as \"ocr/normalized/document.v1.json\"); "
            "find stored job files with services::jobs::stored_path(job, data_root, StoredFile::…), "
            "download them through services::jobs downloads (`open`), or use services::files::artifacts"
        )
    for relative in sorted(KNOWN_ARTIFACT_PATH_READERS - readers):
        errors.append(
            f"{relative}: no longer builds artifact paths; remove it from KNOWN_ARTIFACT_PATH_READERS"
        )


# 建任务只有一个入口：services/jobs/lifecycle/creation/submit.rs 的 `submit_job`（新任务）和
# `relaunch_in_place`（原地重跑已有任务）。补默认值、换平台模型、校验、凭据入库、预扣页额度、
# 落库、归属到书、发射，都只在那里写一次。以前五个入口各抄一遍，抄漏了就出事（例如一键翻译没先换
# 平台模型，用户自带的 key 进了服务器的凭据库）。别处要建任务，调 submit_job。
JOB_ENTRY_PRIMITIVE = re.compile(
    r"\bpersist_job_with_resources\s*\(|\bcreate_ocr_recovery_job_state\s*\(|\bruntime\s*\.\s*launch\s*\("
)
JOB_ENTRY_OWNER = Path("src/services/jobs/lifecycle/creation/submit.rs")


def check_job_entry_ownership(errors: list[str]) -> None:
    for root in (Path("src/services"), Path("src/routes"), Path("src/app")):
        for path in scan_logical(root):
            if path.stem == "tests" or path.stem.endswith("_tests"):
                continue
            relative = rel(path)
            if relative == JOB_ENTRY_OWNER:
                continue
            if JOB_ENTRY_PRIMITIVE.search(rust_boundary_source(path)):
                errors.append(
                    f"{relative}: persists or launches a new job itself; create jobs through "
                    "services::jobs::lifecycle::creation::submit_job (or relaunch_in_place for an existing job)"
                )


# 任务提交时的完整请求（`request_payload`）只许生成和改写它的模块直接动字段；别处问任务的问题，
# 用 retainpdf-core `models/job/questions.rs` 里的方法（`job.source_job_id()`、`job.uses_model_executor()`……）。
# 整份请求原样传给别的函数（脱敏、对外投影、快照）不算。这样拆包以后，别的包不依赖请求的内部结构。
REQUEST_PAYLOAD_FIELD_ACCESS = re.compile(r"\brequest_payload\s*\.\s*[a-z_]")
# 2026-10-16 冻结：建任务（凭据）、重跑、重试阶段、合并阅读的虚拟任务，都在生成或改写请求。只许删不许加；
# 删掉一个之后名单里还留着就报错。要读请求里的东西，去 questions.rs 加一个方法。
KNOWN_REQUEST_PAYLOAD_WRITERS = {
    Path("src/job_loading/merged.rs"),
    Path("src/services/jobs/actions/rerun.rs"),
    Path("src/services/jobs/actions/stage_retry.rs"),
    Path("src/services/jobs/actions/stage_retry_refine.rs"),
    Path("src/services/jobs/actions/stage_retry_request.rs"),
    Path("src/services/jobs/lifecycle/creation/ocr_credentials.rs"),
}


def check_request_payload_access(errors: list[str]) -> None:
    accessors = set()
    for path in scan_logical(Path("src")) + scan_rs_files(abs_src(Path("src/job_loading"))):
        relative = rel(path)
        if path.stem == "tests" or path.stem.endswith("_tests") or "tests" in relative.parts:
            continue
        if relative.parts[:2] in (("src", "api_tests"), ("src", "test_support")):
            continue
        if REQUEST_PAYLOAD_FIELD_ACCESS.search(rust_boundary_source(path)):
            accessors.add(relative)
    for relative in sorted(accessors - KNOWN_REQUEST_PAYLOAD_WRITERS):
        errors.append(
            f"{relative}: reaches into job.request_payload fields; ask the job instead "
            "(retainpdf-core models/job/questions.rs, e.g. job.source_job_id())"
        )
    for relative in sorted(KNOWN_REQUEST_PAYLOAD_WRITERS - accessors):
        errors.append(
            f"{relative}: no longer touches request_payload fields; remove it from KNOWN_REQUEST_PAYLOAD_WRITERS"
        )


# 规则里写的路径必须真的存在。挪目录、拆包以后，写死的旧路径不会报错，只会让那条规则什么都不查
# （平台拆包后的字体条目、早已不在的 src/app/state_recovery.rs、扫了几个月空目录的 rust_api 下的 job_runner，都是这么来的）。
# 这里登记的是规则要求"不许存在"的路径，不算。
RULE_PATHS_MUST_NOT_EXIST = {
    Path("src/services/jobs/lifecycle/creation/context.rs"),
}
RULE_SOURCE = Path(__file__).resolve()


def check_rule_paths(errors: list[str]) -> None:
    source = RULE_SOURCE.read_text(encoding="utf-8")
    meta_start = source.find("\nRULE_PATHS_MUST_NOT_EXIST")
    body = source[:meta_start] if meta_start >= 0 else source
    for literal in sorted(set(re.findall(r'Path\("(src/[^"]+)"\)', body))):
        logical = Path(literal)
        if logical in RULE_PATHS_MUST_NOT_EXIST:
            continue
        physical = abs_src(logical)
        if not (physical.exists() or physical.with_suffix(".rs").exists()):
            errors.append(
                f"check_architecture.py: rule path {literal} does not exist; update the rule (it checks nothing now)"
            )
    for literal in sorted(RULE_PATHS_MUST_NOT_EXIST):
        if literal.as_posix() not in body:
            errors.append(f"check_architecture.py: RULE_PATHS_MUST_NOT_EXIST lists {literal}, which no rule uses")
    files_root = extracted_domain_root("files") / "src"
    for relative in (*FILES_ARTIFACT_BOUNDARY_FILES, *FILES_ARTIFACT_PATH_OWNERS):
        physical = files_root / relative
        if not (physical.exists() or physical.with_suffix(".rs").exists()):
            errors.append(
                f"check_architecture.py: rule path {EXTRACTED_DOMAINS['files']}/src/{relative.as_posix()} does not exist"
            )
    # 挪走了的模块（_CRATE_OF_MODULE）和挂在别处的领域（DOMAIN_MOUNTS）不能直接写 SRC_ROOT / ...，要经 abs_src、scan_logical。
    for match in re.finditer(r'SRC_ROOT((?:\s*/\s*"[^"]+")+)', body):
        parts = re.findall(r'"([^"]+)"', match.group(1))
        moved_module = parts[0].removesuffix(".rs") in _CRATE_OF_MODULE
        mounted = parts[0] == "services" and len(parts) > 1 and parts[1] in DOMAIN_MOUNTS
        if moved_module or mounted:
            line = body[: match.start()].count("\n") + 1
            errors.append(
                f"check_architecture.py:{line}: SRC_ROOT / {' / '.join(parts)} bypasses the module map; "
                "use abs_src(Path(...)) or scan_logical(Path(...))"
            )
    for match in re.finditer(r'scan_rs_files\(SRC_ROOT(?:\s*/\s*"services")?\)', body):
        line = body[: match.start()].count("\n") + 1
        errors.append(
            f"check_architecture.py:{line}: scanning SRC_ROOT directly misses mounted domains; use scan_logical(Path(...))"
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
    check_service_dependency_cycles(errors)
    check_service_domains(errors)
    check_domain_facades(errors)
    check_domain_dependency_direction(errors)
    check_request_payload_access(errors)
    check_rule_paths(errors)
    check_artifact_path_ownership(errors)
    check_job_entry_ownership(errors)

    if errors:
        print("rust_api architecture check failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("rust_api architecture check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
