"""Lock the Python runtime-config producer to the shared v1 contract."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from pydantic import ValidationError
from retainpdf_ai.api_contracts import RuntimeConfigUpdate
from retainpdf_ai.app import build_app
from retainpdf_ai.config import Settings

CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "contracts" / "runtime-config.v1.schema.json"
)


class _UnusedAgent:
    def ask(self, *_args, **_kwargs):  # pragma: no cover - config route only
        raise AssertionError("agent should not run")


def _contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_runtime_config_update_fields_and_extra_policy_match_contract():
    schema = _contract()["definitions"]["RuntimeConfigUpdate"]

    assert set(schema["properties"]) == set(RuntimeConfigUpdate.model_fields)
    assert "required" not in schema
    assert schema["additionalProperties"] is False
    try:
        RuntimeConfigUpdate.model_validate({"future_field": "rejected"})
    except ValidationError as error:
        assert error.errors()[0]["type"] == "extra_forbidden"
    else:  # pragma: no cover - protects the public no-silent-noop contract
        raise AssertionError("unknown runtime config fields must be rejected")


def test_runtime_config_view_matches_redacted_contract(tmp_path):
    client = TestClient(
        build_app(
            Settings(
                api_keys=frozenset({"test-key"}),
                llm_api_key="private-model-key",
                fx_gateway_api_key="private-gateway-key",
                data_root=tmp_path,
            ),
            agent=_UnusedAgent(),
            restart_callback=lambda: None,
        )
    )

    response = client.get(
        "/v1/runtime-config",
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 200
    view = response.json()["data"]
    schema = _contract()["definitions"]["RuntimeConfigView"]

    assert set(view) == set(schema["properties"]) == set(schema["required"])
    assert (
        view["configured_runtime"]
        in _contract()["definitions"]["ConfiguredRuntime"]["enum"]
    )
    assert view["active_runtime"] in _contract()["definitions"]["ActiveRuntime"]["enum"]
    assert "llm_api_key" not in view
    assert "fx_gateway_api_key" not in view
    assert "private-model-key" not in response.text
    assert "private-gateway-key" not in response.text


def test_runtime_config_http_rejects_unknown_fields_without_persisting(tmp_path):
    client = TestClient(
        build_app(
            Settings(api_keys=frozenset({"test-key"}), data_root=tmp_path),
            agent=_UnusedAgent(),
            restart_callback=lambda: None,
        )
    )
    headers = {"X-API-Key": "test-key"}
    before = client.get("/v1/runtime-config", headers=headers).json()["data"]

    response = client.put(
        "/v1/runtime-config",
        headers=headers,
        json={
            "expected_revision": before["configured_revision"],
            "llm_modle": "typo-must-not-be-ignored",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "extra_forbidden"
    after = client.get("/v1/runtime-config", headers=headers).json()["data"]
    assert after["configured_revision"] == before["configured_revision"]
