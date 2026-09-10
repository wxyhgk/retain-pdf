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


if __name__ == "__main__":
    unittest.main()
