"""Synthetic-source regression tests; no Rust build or real configuration reads."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "api_architecture_checks", Path(__file__).with_name("check_architecture.py")
)
assert spec and spec.loader
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class UploadBoundaryTests(unittest.TestCase):
    def test_persistence_only_runner_leaves_accept_only_narrow_dependencies(self):
        for name in (
            "ocr_flow/bundle_events.rs", "render_flow_artifacts.rs",
            "translation_flow_artifacts.rs", "render_flow_artifacts/prepare.rs",
        ):
            path = f"job_runner/{name}"
            self.assertEqual([], self.check_sources(
                {path: "fn prepare(deps: &JobPersistDeps) { let db = &deps.db; }"},
                checks.check_job_persist_deps_usage,
            ))
            for capability in ("ProcessRuntimeDeps", "AppState", "AppConfig", "RuntimeControl", "Semaphore"):
                with self.subTest(path=path, capability=capability):
                    self.assertTrue(self.check_sources(
                        {path: f"use crate::job_runner::{{{capability} as Runtime}};"},
                        checks.check_job_persist_deps_usage,
                    ))
        self.assertTrue(self.check_sources(
            {"services/jobs/unrelated.rs": "struct Wide { persist: JobPersistDeps }"},
            checks.check_job_persist_deps_usage,
        ))
        self.assertEqual([], self.check_sources({
            "job_runner/process_runner/io_support/events.rs": "fn emit(deps: &JobPersistDeps) {}",
            "job_runner/process_runner/startup/mod.rs": "fn start(deps: &JobPersistDeps) {}",
            "job_runner/process_runner/persistence_tests.rs": "let deps: JobPersistDeps;",
        }, checks.check_job_persist_deps_usage))

    def test_persist_leaf_guard_ignores_documentation_literals_and_local_tests(self):
        self.assertEqual([], self.check_sources({"job_runner/ocr_flow/bundle_events.rs": '''
            // Formerly ProcessRuntimeDeps; AppConfig is deliberately absent.
            const NOTE: &str = r#"RuntimeControl"#;
            fn emit(deps: &JobPersistDeps) {}
#[cfg(test)]
mod tests { fn fixture() { let runtime: ProcessRuntimeDeps; } }
        '''}, checks.check_job_persist_deps_usage))

    def test_shared_artifact_display_cannot_reintroduce_business_cycles(self):
        self.assertEqual([], self.check_sources({
            "services/jobs/presentation/detail_projection.rs": "use crate::services::artifacts::build_artifacts_display;",
            "services/book_projection.rs": "use crate::services::artifacts::build_artifacts_display; use crate::services::jobs::job_readiness;",
            "services/artifacts/presentation.rs": "use crate::models::api::{ArtifactLinksView, ArtifactDisplayItemView};",
            "services/jobs/event_feed/batch_tests.rs": "use crate::services::book_projection;",
        }, checks.check_shared_artifact_presentation))
        for path in ("services/jobs/presentation/detail_projection.rs", "services/jobs/query/nested.rs"):
            self.assertTrue(self.check_sources(
                {path: "use crate::services::{book_projection::build_artifacts_display};"},
                checks.check_shared_artifact_presentation,
            ))
        for source in (
            "use crate::services::jobs;", "use crate::services::{library};", "fn build(db: &Db) {}",
            "std::fs::read(path);", "use crate::ocr_provider;", "use crate::storage_paths;",
            "use std::{fs as files};", "tokio::process::Command::new(program);",
            'let raw = payload["layoutParsingResults"];',
        ):
            self.assertTrue(self.check_sources(
                {"services/artifacts/presentation/nested.rs": source},
                checks.check_shared_artifact_presentation,
            ))
        self.assertTrue(self.check_sources(
            {"services/book_projection/artifacts.rs": ""},
            checks.check_shared_artifact_presentation,
        ))

    def test_shared_artifact_guard_ignores_comments_and_literals(self):
        self.assertEqual([], self.check_sources({
            "services/artifacts/presentation.rs": '// no jobs or Db access\nconst LABEL: &str = "library";',
            "services/jobs/query.rs": 'const NOTE: &str = r#"book_projection"#;',
        }, checks.check_shared_artifact_presentation))

    def test_jobs_dependencies_allow_explicit_query_resources(self):
        self.assertEqual([], self.check_sources({
            "services/jobs/deps/query.rs": "use crate::db::Db; use super::ReplayDeps; struct QueryJobsDeps;",
            "services/jobs/deps/command.rs": "use crate::services::uploads::UploadService;",
        }, checks.check_jobs_dependency_boundaries))

    def test_jobs_dependencies_reject_wide_state_and_command_in_query(self):
        for source in ("AppState", "AppConfig", "env::var(\"ROOT\")", "Config::from_env()",
                       "CommandJobsDeps", "JobSubmitDeps", "JobRuntime", "RuntimeControl",
                       "JobLaunchDeps", "UploadService"):
            with self.subTest(source=source):
                self.assertTrue(self.check_sources({"services/jobs/deps/query.rs": source},
                                                   checks.check_jobs_dependency_boundaries))
        self.assertTrue(self.check_sources({"services/jobs/creation/context.rs": ""},
                                           checks.check_jobs_dependency_boundaries))

    def test_runtime_ownership_allows_assembly_and_health(self):
        self.assertEqual([], self.check_sources({
            "runtime/ai_supervisor.rs": "use crate::config::AppConfig;",
            "app/server.rs": "crate::runtime::ai_supervisor::spawn_ai_supervisor();",
            "services/health_api.rs": "crate::runtime::jobsd_supervisor::jobsd_status();",
        }, checks.check_runtime_ownership))

    def test_basic_job_queries_cannot_acquire_execution_dependencies(self):
        path = "services/jobs/query.rs"
        for source in ("AppState", "AppConfig", "Config::from_env()", 'env::var("ROOT")',
                       "JobsFacade", "CommandJobsDeps", "JobSubmitDeps", "JobRuntime",
                       "RuntimeControl", "JobLaunchDeps", "UploadService"):
            with self.subTest(source=source):
                self.assertTrue(self.check_sources({path: source},
                                                   checks.check_jobs_dependency_boundaries))
        self.assertEqual([], self.check_sources(
            {path: "struct JobQueries<'a> { db: &'a Db, data_root: &'a Path }"},
            checks.check_jobs_dependency_boundaries,
        ))

    def test_basic_job_read_routes_use_query_only_builder(self):
        path = "routes/jobs/query/read.rs"
        for builder in ("build_jobs_route_deps", "build_jobs_facade_from_state", "jobs_facade"):
            with self.subTest(builder=builder):
                self.assertTrue(self.check_sources(
                    {path: f"let deps = {builder}(&state);"}, checks.check_jobs_route_deps_dedup,
                ))
        self.assertEqual([], self.check_sources(
            {path: "let deps = build_jobs_query_route_deps(&state);"},
            checks.check_jobs_route_deps_dedup,
        ))

    def test_narrow_job_service_boundaries_follow_module_splits(self):
        for path in (
            "services/jobs/query/diagnostics.rs", "services/jobs/query/reader/metadata.rs",
            "services/jobs/deps/query/nested.rs", "services/jobs/downloads.rs",
            "services/jobs/downloads/deps.rs", "services/jobs/downloads/files/cache.rs",
        ):
            for capability in ("AppState", "AppConfig", "JobsFacade", "JobRuntimeLauncher", "UploadService"):
                with self.subTest(path=path, capability=capability):
                    self.assertTrue(self.check_sources({path: capability}, checks.check_jobs_dependency_boundaries))
        for path in ("services/jobs/query/diagnostics.rs", "services/jobs/downloads/deps.rs"):
            for capability in ("ReplayDeps", "QueryJobsDeps"):
                self.assertTrue(self.check_sources({path: capability}, checks.check_jobs_dependency_boundaries))
        self.assertEqual([], self.check_sources({
            "services/jobs/query/reader.rs": "struct ReadDeps<'a> { db: &'a Db, events: &'a JobEventFeed }",
            "services/jobs/downloads/deps.rs": "struct DownloadJobsDeps { scheduler: DownloadGenerationScheduler }",
            "services/jobs/deps/query.rs": "struct QueryJobsDeps<'a> { replay: ReplayDeps<'a> }",
        }, checks.check_jobs_dependency_boundaries))

    def test_narrow_job_route_boundaries_follow_module_splits(self):
        for path in (
            "routes/jobs/query/read/listing.rs", "routes/jobs/query/diagnostics.rs",
            "routes/jobs/query/diagnostics/resume.rs", "routes/jobs/download.rs",
            "routes/jobs/download/files.rs", "routes/download_response/files.rs",
            "routes/download_response/markdown/cache.rs",
        ):
            with self.subTest(path=path):
                self.assertTrue(self.check_sources(
                    {path: "let deps = build_jobs_route_deps(&state);"}, checks.check_jobs_route_deps_dedup,
                ))

    def test_mixed_job_routes_keep_only_explicit_commands_wide(self):
        for path, reader, command in (
            ("routes/jobs/query/reader.rs", "get_reader_regions", "reader_ai_chat"),
            ("routes/jobs/query/reader/metadata.rs", "get_reader_metadata", "reader_ai_chat"),
            ("routes/jobs/translation_debug.rs", "get_translation_item", "replay_translation_item_route"),
        ):
            source = f"""
                use crate::routes::common::{{build_jobs_route_deps, build_jobs_query_route_deps}};
                pub async fn {reader}() {{
                    if ready {{ return build_jobs_query_route_deps(&state); }}
                    build_jobs_query_route_deps(&state)
                }}
                pub async fn {command}() {{ build_jobs_route_deps(&state); }}
            """
            with self.subTest(path=path):
                self.assertEqual([], self.check_sources({path: source}, checks.check_jobs_route_deps_dedup))
                self.assertTrue(self.check_sources(
                    {path: source.replace("return build_jobs_query_route_deps", "return build_jobs_route_deps")},
                    checks.check_jobs_route_deps_dedup,
                ))
                self.assertTrue(self.check_sources(
                    {path: source + "fn local_helper() { build_jobs_route_deps(&state); }"},
                    checks.check_jobs_route_deps_dedup,
                ))

    def test_mixed_job_routes_detect_full_builder_import_aliases(self):
        self.assertTrue(self.check_sources({"routes/jobs/query/reader.rs": """
            use crate::routes::common::build_jobs_route_deps as full;
            pub async fn get_reader_regions() { full(&state); }
        """}, checks.check_jobs_route_deps_dedup))

    def test_job_boundaries_ignore_comments_and_rust_literals(self):
        notes = '''
            // migrated from build_jobs_route_deps; AppState must stay out
            /* JobsFacade /* nested UploadService */ JobRuntimeLauncher */
            const URL: &str = "https://example.com/JobsFacade";
            const NOTE: &str = r##"raw } build_jobs_route_deps /* AppState */"##;
            const BRACE: char = '}';
        '''
        self.assertEqual([], self.check_sources({
            "routes/jobs/query/read.rs": notes + "fn list_jobs() { build_jobs_query_route_deps(&state); }",
        }, checks.check_jobs_route_deps_dedup))
        self.assertEqual([], self.check_sources({
            "services/jobs/query/nested.rs": notes + "struct JobQueries<'a> { db: &'a Db }",
        }, checks.check_jobs_dependency_boundaries))
        self.assertEqual([], self.check_sources({
            "services/jobs/query/nested.rs": notes + "struct JobQueries<'a> { db: &'a Db }",
        }, checks.check_appstate_boundaries))
        self.assertEqual([], self.check_sources({
            "routes/jobs/query/read.rs": "/* use crate::services::jobs::JobsFacade; */",
        }, checks.check_route_service_imports))
        self.assertTrue(self.check_sources({
            "services/jobs/query/nested.rs": notes + "struct Bad { runtime: JobRuntime }",
        }, checks.check_jobs_dependency_boundaries))
        self.assertTrue(self.check_sources({"routes/jobs/query/reader.rs": notes + '''
            async fn get_reader_regions() {
                let ignored = r#"} fn reader_ai_chat() {"#;
                build_jobs_route_deps(&state)
            }
        '''}, checks.check_jobs_route_deps_dedup))

    def test_runtime_ownership_rejects_reverse_dependencies_and_old_locations(self):
        for path, source in (
            ("runtime/jobsd_supervisor.rs", "use crate::services::jobs;"),
            ("runtime/ai_supervisor.rs", "use crate::AppState;"),
            ("routes/health.rs", "crate::runtime::ai_supervisor::ai_service_status();"),
            ("services/jobs/facade.rs", "crate::runtime::jobsd_supervisor::jobsd_status();"),
            ("services/ai_supervisor.rs", ""),
        ):
            with self.subTest(path=path):
                self.assertTrue(self.check_sources({path: source}, checks.check_runtime_ownership))

    def test_ai_gateway_has_no_hidden_configuration_or_health_reads(self):
        for source in ("AiProxyConfig::from_env()", "std::env::var(\"BASE\")", "ai_service_status()", "Lazy<Client>"):
            with self.subTest(source=source):
                self.assertTrue(self.check_sources(
                    {"services/ai/gateway.rs": source}, checks.check_ai_gateway_dependencies,
                ))
        self.assertEqual([], self.check_sources(
            {"services/ai/gateway.rs": "fn new(config: &AiProxyConfig, status: fn() -> u8) {}"},
            checks.check_ai_gateway_dependencies,
        ))

    def test_agent_calculations_use_narrow_dependencies(self):
        for name in ("agent_calculations/service.rs", "agent_calculations/api.rs", "agent_calculations/tests.rs"):
            for dependency in ("AppConfig", "AppState", "api_tests"):
                with self.subTest(name=name, dependency=dependency):
                    errors = self.check_sources(
                        {f"services/{name}": f"use crate::{dependency};"},
                        checks.check_agent_calculation_dependencies,
                    )
                    self.assertTrue(any("narrow Db/data_root" in error for error in errors))
        self.assertEqual([], self.check_sources(
            {"services/agent_calculations/service.rs": "use crate::db::Db; fn f(data_root: &Path) {}"},
            checks.check_agent_calculation_dependencies,
        ))

    def check_sources(self, sources, check=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, source in sources.items():
                path = root / "src" / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(source, encoding="utf-8")
            with patch.object(checks, "REPO_ROOT", root), patch.object(
                checks, "SRC_ROOT", root / "src"
            ), patch.object(checks, "ALL_SRC_ROOTS", (root / "src",)):
                errors = []
                (check or checks.check_upload_boundaries)(errors)
                return errors

    def test_public_surface_and_narrow_dependencies_are_allowed(self):
        self.assertEqual([], self.check_sources({
            "services/uploads/service.rs": "use crate::db::Db; use super::capacity::UploadCapacity;",
            "services/uploads/tests.rs": "let root = std::env::temp_dir();",
            "app/state.rs": "use crate::services::uploads::{UploadService, UploadConfig};",
            "services/jobs/creation/submit.rs": "use crate::services::uploads::UploadedPdfInput;",
        }))

    def test_forbidden_dependencies_include_grouped_imports(self):
        for source in (
            "use crate::services::jobs::JobsFacade;",
            "use crate::services::{jobs::JobsFacade, runtime_gateway::JobRuntime};",
            "use crate::routes::{common::UploadRouteDeps};",
            "use crate::{routes, job_runner};",
            "fn f(state: &AppState) {}",
        ):
            with self.subTest(source=source):
                errors = self.check_sources({"services/uploads/service.rs": source})
                self.assertTrue(any("must not depend" in error for error in errors))

    def test_environment_reads_are_rejected(self):
        for source in (
            "let config = UploadProcessingConfig::from_env();",
            'let value = std::env::var("CONFIG");',
            "let values = env::vars_os();",
        ):
            with self.subTest(source=source):
                errors = self.check_sources({"services/uploads/service.rs": source})
                self.assertTrue(any("startup configuration" in error for error in errors))

    def test_http_error_mapping_stays_outside_uploads(self):
        errors = self.check_sources({
            "services/uploads/error.rs": "use crate::error::AppError;",
        })
        self.assertTrue(any("HTTP error mapping" in error for error in errors))
        self.assertEqual([], self.check_sources({
            "error.rs": "use crate::services::uploads::UploadError; impl From<UploadError> for AppError {}",
            "services/uploads/api.rs": "use crate::error::AppError;",
        }))

    def test_private_paths_are_rejected_from_callers_and_tests(self):
        for member in ("capacity", "pdf", "staging", "service", "error"):
            for source in (
                f"use crate::services::uploads::{member}::Implementation;",
                f"use crate::services::uploads::{{UploadService, {member}::Implementation}};",
                f"crate::services::uploads::{member}::run();",
            ):
                with self.subTest(source=source):
                    errors = self.check_sources({"api_tests/uploads.rs": source})
                    self.assertTrue(any("public surface" in error for error in errors))

    def test_comments_do_not_create_dependencies(self):
        self.assertEqual([], self.check_sources({
            "services/uploads/service.rs": "// AppState and jobs::X are forbidden\n/* env::var() */",
            "app/state.rs": "// uploads::capacity::X is private",
        }))

    def test_upload_models_are_in_existing_facade_guard(self):
        errors = self.check_sources(
            {"services/uploads/service.rs": "use crate::models::UploadRecord;"},
            checks.check_service_model_facade_boundaries,
        )
        self.assertTrue(any("models::api/domain/request" in error for error in errors))
        self.assertEqual([], self.check_sources(
            {"services/uploads/service.rs": "use crate::models::domain::UploadRecord;"},
            checks.check_service_model_facade_boundaries,
        ))

    def test_upload_route_deps_only_import_the_application_facade(self):
        self.assertEqual([], self.check_sources(
            {"routes/common/uploads.rs": "use crate::services::uploads::api::UploadApiDeps;"},
            checks.check_route_service_imports,
        ))
        for source in (
            "use crate::services::uploads::UploadService;",
            "use crate::services::uploads::api::UploadService;",
            "use crate::services::upload_api::UploadApiDeps;",
        ):
            with self.subTest(source=source):
                errors = self.check_sources(
                    {"routes/common/uploads.rs": source},
                    checks.check_route_service_imports,
                )
                self.assertTrue(any("must not import internal services" in error for error in errors))

    def test_library_route_dependencies_do_not_import_job_capabilities(self):
        self.assertEqual([], self.check_sources(
            {"routes/common/library.rs": "use crate::services::library::LibraryDeps;"},
            checks.check_route_service_imports,
        ))
        for source in (
            "use crate::services::jobs::JobsFacade;",
            "use crate::services::{jobs::JobsFacade, library::LibraryDeps};",
        ):
            with self.subTest(source=source):
                self.assertTrue(self.check_sources(
                    {"routes/common/library.rs": source}, checks.check_route_service_imports,
                ))

    def test_ai_private_gateway_rejects_external_and_grouped_access(self):
        for source in (
            "use crate::services::ai::gateway::AiGateway;",
            "use crate::services::ai::{gateway::AiGateway};",
            "crate::services::ai::gateway::run();",
        ):
            with self.subTest(source=source):
                self.assertTrue(self.check_sources(
                    {"api_tests/ai_proxy.rs": source}, checks.check_business_private_modules,
                ))
        self.assertEqual([], self.check_sources({
            "app/state.rs": "use crate::services::ai::AiGateway;",
            "services/ai/api.rs": "use super::gateway::AiGateway;",
        }, checks.check_business_private_modules))

    def test_ai_route_only_imports_application_entry(self):
        self.assertEqual([], self.check_sources(
            {"routes/ai_proxy.rs": "use crate::services::ai::api as ai_api;"},
            checks.check_route_service_imports,
        ))
        for source in (
            "use crate::services::ai::AiGateway;",
            "use crate::services::ai_proxy_api;",
            "use crate::services::ai::api_internal;",
        ):
            self.assertTrue(self.check_sources(
                {"routes/ai_proxy.rs": source}, checks.check_route_service_imports,
            ))

    def test_ai_models_remain_in_facade_guard(self):
        self.assertTrue(self.check_sources(
            {"services/ai/gateway.rs": "use crate::models::UploadRecord;"},
            checks.check_service_model_facade_boundaries,
        ))
        self.assertEqual([], self.check_sources(
            {"services/ai/gateway.rs": "use crate::models::domain::UploadRecord;"},
            checks.check_service_model_facade_boundaries,
        ))

    def test_small_module_routes_use_api_not_implementation(self):
        for domain, route in (
            ("fonts", "fonts"), ("credentials", "credentials"),
            ("agent_calculations", "agent_calculations"), ("glossaries", "glossaries"),
        ):
            with self.subTest(domain=domain):
                self.assertEqual([], self.check_sources(
                    {f"routes/{route}.rs": f"use crate::services::{domain}::api::Entry;"},
                    checks.check_route_service_imports,
                ))
                self.assertTrue(self.check_sources(
                    {f"routes/{route}.rs": f"use crate::services::{domain}::Entry;"},
                    checks.check_route_service_imports,
                ))

    def test_small_module_private_paths_are_guarded(self):
        for domain, member in (
            ("fonts", "service"), ("credentials", "service"),
            ("agent_calculations", "service"), ("glossaries", "csv"),
            ("glossaries", "entries"), ("glossaries", "records"),
        ):
            with self.subTest(domain=domain, member=member):
                for suffix in (f"{member}::Entry", f"{{{member}::Entry}}"):
                    self.assertTrue(self.check_sources(
                        {"api_tests/consumer.rs": f"use crate::services::{domain}::{suffix};"},
                        checks.check_business_private_modules,
                    ))
                self.assertEqual([], self.check_sources(
                    {"services/jobs/consumer.rs": f"use crate::services::{domain}::Entry;"},
                    checks.check_business_private_modules,
                ))

    def test_small_module_model_facades_are_scanned(self):
        for domain in ("fonts", "credentials", "agent_calculations", "glossaries"):
            with self.subTest(domain=domain):
                self.assertTrue(self.check_sources(
                    {f"services/{domain}/api.rs": "use crate::models::UploadRecord;"},
                    checks.check_service_model_facade_boundaries,
                ))
                self.assertEqual([], self.check_sources(
                    {f"services/{domain}/api.rs": "use crate::models::domain::UploadRecord;"},
                    checks.check_service_model_facade_boundaries,
                ))


class FailureCatalogueCoverageTests(unittest.TestCase):
    """恢复目录必须登记 Python 侧发出的每一个 failure code。

    漏登记不会报错、不会崩，只会让用户看到「未识别的失败类型，重试会从头开始」——
    而这句话通常是假的：恢复按钮并不看分类，照样只重跑渲染。这条门禁存在的意义
    就是把一个静默的谎言变成一次构建失败。
    """

    CATALOGUE = (
        "const CATALOGUE: &[(&str, FailureRecovery)] = &[\n"
        '    ("render_failed", FailureRecovery {\n'
        "        resume_from: Some(ResumeFrom::Render),\n"
        '        hint: "...",\n'
        "    }),\n"
        '    ("auth_failed", FailureRecovery {\n'
        "        resume_from: None,\n"
        '        hint: "...",\n'
        "    }),\n"
        "];\n"
    )

    PYTHON = (
        "def classify(exc):\n"
        "    if a:\n"
        '        error_type = "render_failed"\n'
        "    elif b:\n"
        '        error_type = "auth_failed"\n'
    )

    def run_check(self, catalogue, python):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalogue_path = root / "job_failure_catalogue.rs"
            python_path = root / "structured_errors.py"
            catalogue_path.write_text(catalogue, encoding="utf-8")
            python_path.write_text(python, encoding="utf-8")
            with patch.object(checks, "FAILURE_CATALOGUE_PATH", catalogue_path), patch.object(
                checks, "PYTHON_STRUCTURED_ERRORS", python_path
            ):
                errors = []
                checks.check_failure_catalogue_covers_python_codes(errors)
                return errors

    def test_full_coverage_passes(self):
        self.assertEqual([], self.run_check(self.CATALOGUE, self.PYTHON))

    def test_unregistered_python_code_is_reported(self):
        python = self.PYTHON + "    elif c:\n" + '        error_type = "typst_runtime_failed"\n'
        errors = self.run_check(self.CATALOGUE, python)
        self.assertEqual(1, len(errors))
        self.assertIn("typst_runtime_failed", errors[0])

    def test_every_missing_code_is_reported_not_just_the_first(self):
        python = (
            self.PYTHON
            + "    elif c:\n"
            + '        error_type = "json_decode_failed"\n'
            + "    elif d:\n"
            + '        error_type = "upstream_bad_request"\n'
        )
        self.assertEqual(2, len(self.run_check(self.CATALOGUE, python)))

    def test_catalogue_only_codes_are_not_reported(self):
        """Rust 侧也会产生分类（结构化 JSON 缺失时兜底），目录里多出来是正常的。"""
        extra = (
            '    ("process_timeout", FailureRecovery {\n'
            "        resume_from: None,\n"
            '        hint: "...",\n'
            "    }),\n];"
        )
        self.assertEqual([], self.run_check(self.CATALOGUE.replace("];", extra), self.PYTHON))

    def test_gate_reports_when_it_can_no_longer_parse_the_catalogue(self):
        """写法变了而门禁没跟上时必须叫出来，而不是静默变成空操作。"""
        errors = self.run_check("const CATALOGUE: &[Foo] = &[];\n", self.PYTHON)
        self.assertEqual(1, len(errors))
        self.assertIn("一条目录项都没解析出来", errors[0])

    def test_gate_reports_when_it_can_no_longer_parse_the_python_source(self):
        errors = self.run_check(self.CATALOGUE, "FAILURE_CODES = {'a': 1}\n")
        self.assertEqual(1, len(errors))
        self.assertIn("一个 error_type", errors[0])

    def test_missing_catalogue_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            python_path = root / "structured_errors.py"
            python_path.write_text(self.PYTHON, encoding="utf-8")
            with patch.object(checks, "FAILURE_CATALOGUE_PATH", root / "gone.rs"), patch.object(
                checks, "PYTHON_STRUCTURED_ERRORS", python_path
            ):
                errors = []
                checks.check_failure_catalogue_covers_python_codes(errors)
        self.assertEqual(1, len(errors))
        self.assertIn("恢复目录不见了", errors[0])


if __name__ == "__main__":
    unittest.main()
