import json
import os
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from retainpdf_ai.api_contracts import AskInput
from retainpdf_ai.app import build_app
from retainpdf_ai.ask_orchestration import AskOrchestrator
from retainpdf_ai.config import (
    Settings,
    apply_runtime_credentials,
    fx_gateway_chat_url,
    load_settings,
    normalize_agent_confirmation_mode,
    normalize_fx_gateway_base_url,
)
from retainpdf_ai.runtime_credentials import (
    RuntimeCredentialConflict,
    RuntimeCredentialError,
    load_runtime_credentials,
    runtime_credential_path,
    save_runtime_credentials,
)
from retainpdf_ai.runtimes.contracts import RuntimeCapabilities


class UnusedAgent:
    def ask(self, *_args, **_kwargs):  # pragma: no cover - settings routes only
        raise AssertionError("agent should not run")


class HostChatRuntime:
    runtime_id = "test-host-chat"
    capabilities = RuntimeCapabilities(
        document_reading=True,
        document_operations=False,
        streaming=True,
        durable_sessions=False,
        model_transport="host_chat",
    )


def _write_shared_credential_vault(tmp_path, credentials):
    directory = tmp_path / "secrets"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / "credentials.json"
    path.write_text(
        json.dumps(
            {
                "schema": "retainpdf_credential_vault_v1",
                "revision": 1,
                "credentials": credentials,
            }
        ),
        encoding="utf-8",
    )
    if os.name == "posix":
        directory.chmod(0o700)
        path.chmod(0o600)


def test_runtime_credentials_are_private_and_overlay_environment(tmp_path, monkeypatch):
    save_runtime_credentials(
        tmp_path,
        {
            "agent_runtime": "python",
            "agent_confirmation_mode": "green_light",
            "llm_base_url": "https://models.example/v1",
            "llm_model": "model-a",
            "llm_api_key": "sk-private-value",
            "fx_gateway_base_url": "http://127.0.0.1:43231/gateway",
            "fx_gateway_api_key": "gateway-private-value",
            "fx_model": "fx-model-a",
        },
    )
    path = runtime_credential_path(tmp_path)
    if os.name == "posix":
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700

    monkeypatch.setenv("RETAIN_AI_DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("RETAIN_API_KEYS", "test-key")
    monkeypatch.setenv("RETAIN_AI_RUST_API_KEY", "rust-key")
    loaded = load_settings()
    assert loaded.agent_runtime == "python"
    assert loaded.agent_confirmation_mode == "green_light"
    assert loaded.llm_base_url == "https://models.example/v1"
    assert loaded.llm_model == "model-a"
    assert loaded.llm_api_key == "sk-private-value"
    assert loaded.fx_gateway_base_url == "http://127.0.0.1:43231/gateway"
    assert loaded.fx_gateway_api_key == "gateway-private-value"
    assert loaded.fx_model == "fx-model-a"


def test_environment_credential_refs_are_resolved_without_runtime_config(
    tmp_path, monkeypatch
):
    _write_shared_credential_vault(
        tmp_path,
        {
            "cred_agent_from_env": {
                "kind": "agent_llm_api_key",
                "provider": "deepseek",
                "label": "Environment reference",
                "secret": "sk-resolved-from-env-ref",
                "created_at": "2026-09-02T00:00:00Z",
                "updated_at": "2026-09-02T00:00:00Z",
            }
        },
    )
    monkeypatch.setenv("RETAIN_AI_DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("RETAIN_AI_LLM_CREDENTIAL_REF", "cred_agent_from_env")
    monkeypatch.delenv("RETAIN_AI_LLM_API_KEY", raising=False)

    loaded = load_settings()

    assert loaded.llm_credential_ref == "cred_agent_from_env"
    assert loaded.llm_api_key == "sk-resolved-from-env-ref"


def test_runtime_credentials_reject_group_readable_file(tmp_path):
    path = runtime_credential_path(tmp_path)
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"schema": "retainpdf_ai_runtime_credentials_v1"}))
    if os.name != "posix":
        pytest.skip("POSIX permission contract")
    path.chmod(0o640)
    with pytest.raises(RuntimeCredentialError, match="0600"):
        load_runtime_credentials(tmp_path)


def test_runtime_config_endpoint_never_returns_raw_secrets(tmp_path):
    restarts: list[str] = []
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="old-model-key",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(
            settings,
            agent=UnusedAgent(),
            restart_callback=lambda: restarts.append("restart"),
        )
    )
    denied = client.get("/v1/runtime-config")
    assert denied.status_code == 401

    response = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={
            "agent_runtime": "python",
            "llm_base_url": "https://models.example/v1",
            "llm_model": "model-b",
            "llm_api_key": "sk-new-private-value",
            "fx_gateway_base_url": "http://localhost:43231/gateway/",
        },
    )
    assert response.status_code == 200
    encoded = response.text
    assert "sk-new-private-value" not in encoded
    view = response.json()["data"]
    assert view["llm_api_key_configured"] is True
    assert view["llm_api_key_masked"].endswith("alue")
    assert view["fx_gateway_base_url"] == "http://localhost:43231/gateway"
    assert view["restart_required"] is True
    assert view["configured_revision"] == 1
    assert view["active_revision"] == 0
    assert view["restart_state"] == "pending"
    assert restarts == ["restart"]

    stored = load_runtime_credentials(tmp_path)
    assert stored["llm_api_key"] == "sk-new-private-value"
    assert stored["llm_base_url"] == "https://models.example/v1"
    assert stored["fx_gateway_base_url"] == "http://localhost:43231/gateway"


def test_runtime_config_uses_shared_credential_refs_without_copying_secrets(tmp_path):
    llm_ref = "cred_agent_llm"
    fx_ref = "cred_fx_gateway"
    _write_shared_credential_vault(
        tmp_path,
        {
            llm_ref: {
                "kind": "agent_llm_api_key",
                "provider": "deepseek",
                "label": "Agent model",
                "secret": "sk-shared-agent-secret",
                "created_at": "2026-09-02T00:00:00Z",
                "updated_at": "2026-09-02T00:00:00Z",
            },
            fx_ref: {
                "kind": "fx_gateway_api_key",
                "provider": "vercel",
                "label": "FX Gateway",
                "secret": "fx-shared-gateway-secret",
                "created_at": "2026-09-02T00:00:00Z",
                "updated_at": "2026-09-02T00:00:00Z",
            },
        },
    )
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="legacy-startup-key",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(settings, agent=UnusedAgent(), restart_callback=lambda: None)
    )

    response = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={
            "llm_credential_ref": llm_ref,
            "fx_gateway_credential_ref": fx_ref,
        },
    )

    assert response.status_code == 200, response.text
    view = response.json()["data"]
    assert view["llm_credential_ref"] == llm_ref
    assert view["fx_gateway_credential_ref"] == fx_ref
    assert view["llm_api_key_masked"] == "••••"
    assert view["fx_gateway_api_key_masked"] == "••••"
    assert "sk-shared-agent-secret" not in response.text
    assert "fx-shared-gateway-secret" not in response.text
    stored = load_runtime_credentials(tmp_path)
    assert stored["llm_credential_ref"] == llm_ref
    assert stored["fx_gateway_credential_ref"] == fx_ref
    assert stored["llm_api_key"] == ""
    assert stored["fx_gateway_api_key"] == ""
    loaded = apply_runtime_credentials(settings, stored)
    assert loaded.llm_api_key == "sk-shared-agent-secret"
    assert loaded.fx_gateway_api_key == "fx-shared-gateway-secret"


def test_runtime_config_rejects_wrong_kind_and_ambiguous_credential_sources(tmp_path):
    _write_shared_credential_vault(
        tmp_path,
        {
            "cred_translation_only": {
                "kind": "translation_api_key",
                "provider": "deepseek",
                "label": "Translation only",
                "secret": "sk-wrong-kind",
                "created_at": "2026-09-02T00:00:00Z",
                "updated_at": "2026-09-02T00:00:00Z",
            }
        },
    )
    client = TestClient(
        build_app(
            Settings(
                api_keys=frozenset({"test-key"}),
                llm_api_key="startup-key",
                data_root=tmp_path,
            ),
            agent=UnusedAgent(),
            restart_callback=lambda: None,
        )
    )
    headers = {"X-API-Key": "test-key"}

    wrong_kind = client.put(
        "/v1/runtime-config",
        headers=headers,
        json={"llm_credential_ref": "cred_translation_only"},
    )
    ambiguous = client.put(
        "/v1/runtime-config",
        headers=headers,
        json={
            "llm_api_key": "sk-inline",
            "llm_credential_ref": "cred_translation_only",
        },
    )

    assert wrong_kind.status_code == 400
    assert wrong_kind.json()["detail"] == "credential kind does not match runtime field"
    assert ambiguous.status_code == 400
    assert "不能同时设置" in ambiguous.json()["detail"]
    assert not runtime_credential_path(tmp_path).exists()


def test_each_host_chat_turn_resolves_the_latest_referenced_secret(tmp_path):
    credential_ref = "cred_rotating_agent"

    def write_secret(secret):
        _write_shared_credential_vault(
            tmp_path,
            {
                credential_ref: {
                    "kind": "agent_llm_api_key",
                    "provider": "deepseek",
                    "label": "Rotating Agent key",
                    "secret": secret,
                    "created_at": "2026-09-02T00:00:00Z",
                    "updated_at": "2026-09-02T00:00:00Z",
                }
            },
        )

    write_secret("sk-before-rotation")
    runtime = HostChatRuntime()
    orchestrator = AskOrchestrator(
        settings=Settings(
            llm_api_key="sk-stale-in-memory",
            llm_credential_ref=credential_ref,
            data_root=tmp_path,
        ),
        runtime=runtime,  # type: ignore[arg-type]
        reading_runtime=None,
        conversation_state=None,  # type: ignore[arg-type]
        chat_fn_builder=lambda _settings: None,
        confirmation_projector=lambda _result, _conversation_id: [],
    )
    write_secret("sk-after-rotation")

    prepared = orchestrator.prepare(AskInput(question="use latest key"))

    assert prepared.settings.llm_api_key == "sk-after-rotation"


def test_missing_referenced_credential_has_diagnostic_readiness_and_config_errors(
    tmp_path,
):
    save_runtime_credentials(
        tmp_path,
        {
            "agent_runtime": "python",
            "llm_credential_ref": "cred_force_deleted",
        },
    )
    client = TestClient(
        build_app(
            Settings(
                api_keys=frozenset({"test-key"}),
                llm_api_key="startup-key",
                data_root=tmp_path,
            ),
            agent=UnusedAgent(),
            restart_callback=lambda: None,
        ),
        raise_server_exceptions=False,
    )

    ready = client.get("/readyz")
    configured = client.get(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
    )
    updated = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"llm_model": "must-not-save"},
    )

    assert ready.status_code == 503
    assert ready.json()["reason"] == "credential_reference_unavailable"
    assert configured.status_code == 503
    assert configured.json()["detail"] == (
        "AI runtime credential reference is unavailable."
    )
    assert updated.status_code == 503
    assert load_runtime_credentials(tmp_path)["revision"] == 1


def test_runtime_config_partial_updates_preserve_latest_persisted_values(tmp_path):
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="startup-key",
        llm_model="startup-model",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(settings, agent=UnusedAgent(), restart_callback=lambda: None)
    )

    first = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"llm_model": "first-model"},
    )
    second = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"fx_model": "second-fx-model"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["data"]["configured_revision"] == 1
    assert second.json()["data"]["configured_revision"] == 2
    stored = load_runtime_credentials(tmp_path)
    assert stored["llm_model"] == "first-model"
    assert stored["fx_model"] == "second-fx-model"
    assert stored["revision"] == 2


def test_runtime_config_persists_green_light_mode_and_rejects_unknown_mode(tmp_path):
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="startup-key",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(settings, agent=UnusedAgent(), restart_callback=lambda: None)
    )

    enabled = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"agent_confirmation_mode": "green_light"},
    )
    rejected = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"agent_confirmation_mode": "unrestricted"},
    )

    assert enabled.status_code == 200
    assert enabled.json()["data"]["agent_confirmation_mode"] == "green_light"
    assert load_runtime_credentials(tmp_path)["agent_confirmation_mode"] == "green_light"
    assert rejected.status_code == 400
    assert "explicit" in rejected.json()["detail"]
    assert normalize_agent_confirmation_mode(" EXPLICIT ") == "explicit"


def test_runtime_config_expected_revision_rejects_stale_writer(tmp_path):
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="startup-key",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(settings, agent=UnusedAgent(), restart_callback=lambda: None)
    )
    first = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"expected_revision": 0, "llm_model": "newer-model"},
    )

    stale = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"expected_revision": 0, "fx_model": "must-not-save"},
    )

    assert first.status_code == 200
    assert stale.status_code == 409
    assert "newer-model" == load_runtime_credentials(tmp_path)["llm_model"]
    assert load_runtime_credentials(tmp_path)["fx_model"] == ""


def test_runtime_config_store_has_compare_and_swap(tmp_path):
    save_runtime_credentials(tmp_path, {"llm_model": "revision-one"})

    with pytest.raises(RuntimeCredentialConflict):
        save_runtime_credentials(
            tmp_path,
            {"llm_model": "stale-write"},
            expected_revision=0,
        )

    stored = load_runtime_credentials(tmp_path)
    assert stored["revision"] == 1
    assert stored["llm_model"] == "revision-one"


def test_empty_saved_fx_url_uses_official_default_instead_of_environment(
    tmp_path, monkeypatch
):
    save_runtime_credentials(
        tmp_path,
        {
            "agent_runtime": "python",
            "fx_gateway_base_url": "",
            "fx_gateway_base_url_mode": "official_default",
        },
    )
    monkeypatch.setenv("RETAIN_AI_DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("RETAIN_API_KEYS", "test-key")
    monkeypatch.setenv("RETAIN_AI_RUST_API_KEY", "rust-key")
    monkeypatch.setenv(
        "RETAIN_AI_FX_GATEWAY_BASE_URL", "http://127.0.0.1:43231/from-env"
    )

    loaded = load_settings()

    assert loaded.fx_gateway_base_url == ""
    assert loaded.fx_gateway_base_url_mode == "official_default"


def test_empty_saved_keys_do_not_fall_back_to_environment(tmp_path, monkeypatch):
    save_runtime_credentials(
        tmp_path,
        {
            "agent_runtime": "python",
            "llm_api_key": "",
            "fx_gateway_api_key": "",
        },
    )
    monkeypatch.setenv("RETAIN_AI_DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("RETAIN_API_KEYS", "test-key")
    monkeypatch.setenv("RETAIN_AI_RUST_API_KEY", "rust-key")
    monkeypatch.setenv("RETAIN_AI_LLM_API_KEY", "environment-llm-key")
    monkeypatch.setenv("RETAIN_AI_FX_GATEWAY_API_KEY", "environment-fx-key")

    loaded = load_settings()

    assert loaded.llm_api_key == ""
    assert loaded.fx_gateway_api_key == ""


def test_readyz_reports_persisted_config_waiting_for_restart(tmp_path):
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="startup-key",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(settings, agent=UnusedAgent(), restart_callback=lambda: None)
    )
    assert client.get("/readyz").status_code == 200

    updated = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"llm_model": "restart-me"},
    )
    waiting = client.get("/readyz")

    assert updated.status_code == 200
    assert waiting.status_code == 503
    assert waiting.json() == {
        "ok": False,
        "reason": "runtime_config_restart_pending",
        "active_revision": 0,
        "configured_revision": 1,
    }


@pytest.mark.parametrize(
    "value",
    [
        "https://gateway.example",
        "http://192.168.1.2:43231",
        "http://127.0.0.1",
        "http://user:secret@127.0.0.1:43231",
        "http://localhost:43231?token=secret",
    ],
)
def test_fx_gateway_url_rejects_values_fx_005_would_ignore(value):
    with pytest.raises(ValueError, match="FX 0.0.5"):
        normalize_fx_gateway_base_url(value)


def test_fx_gateway_url_derives_the_actual_chat_endpoint():
    assert normalize_fx_gateway_base_url(" http://[::1]:43231/gateway/ ") == (
        "http://[::1]:43231/gateway"
    )
    assert fx_gateway_chat_url("http://127.0.0.1:43231/gateway/") == (
        "http://127.0.0.1:43231/gateway/v3/ai/language-model"
    )
    assert fx_gateway_chat_url("") == ""


def test_runtime_config_rejects_remote_fx_gateway_without_persisting(tmp_path):
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="old-model-key",
        data_root=tmp_path,
    )
    client = TestClient(build_app(settings, agent=UnusedAgent()))

    response = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={"fx_gateway_base_url": "https://gateway.example"},
    )

    assert response.status_code == 400
    assert "FX 0.0.5" in response.json()["detail"]
    assert not runtime_credential_path(tmp_path).exists()


def test_runtime_config_accepts_openai_document_agent_with_custom_url(tmp_path):
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="old-model-key",
        data_root=tmp_path,
    )
    client = TestClient(
        build_app(
            settings,
            agent=UnusedAgent(),
            rust=object(),  # type: ignore[arg-type]
            restart_callback=lambda: None,
        )
    )

    response = client.put(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
        json={
            "agent_runtime": "openai",
            "llm_base_url": "http://127.0.0.1:1561/v1",
            "llm_model": "custom-tool-model",
            "llm_api_key": "custom-private-key",
        },
    )

    assert response.status_code == 200
    view = response.json()["data"]
    assert view["configured_runtime"] == "openai"
    assert view["llm_base_url"] == "http://127.0.0.1:1561/v1"
    assert "custom-private-key" not in response.text
    stored = load_runtime_credentials(tmp_path)
    assert stored["agent_runtime"] == "openai"
