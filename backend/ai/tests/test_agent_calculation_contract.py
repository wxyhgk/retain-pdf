"""agent-calculation.v1 contract locks for the Python AI consumer.

The Rust API owns durable calculation state.  The Python service can mutate it
only through the three internal endpoints in this contract and can recover it
through the public read endpoints.  Raw calculation inputs never cross that
boundary: rust_client.py sends provenance plus a hash.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
UPSTREAM_SCHEMA_PATH = (
    BACKEND_ROOT.parent / "contracts" / "agent-calculation.v1.schema.json"
)
BACKEND_SCHEMA_PATH = BACKEND_ROOT / "contracts" / "agent-calculation.v1.schema.json"
SCHEMA = json.loads(BACKEND_SCHEMA_PATH.read_text(encoding="utf-8"))
CLIENT_SOURCE = (AI_SERVICE_ROOT / "retainpdf_ai" / "rust_client.py").read_text(
    encoding="utf-8"
)


def _contract_path_pattern(path: str) -> re.Pattern[str]:
    pattern = re.escape(path)
    for parameter in re.findall(r":[a-z_]+", path):
        pattern = pattern.replace(re.escape(parameter), r"\{[^}]+\}")
    return re.compile("^" + pattern + "$")


def _function_body(function_name: str) -> str:
    start = CLIENT_SOURCE.index(f"def {function_name}")
    tail = CLIENT_SOURCE[start:]
    match = re.search(r"\n    def ", tail[1:])
    return tail if match is None else tail[: match.start() + 1]


def _payload_keys(function_name: str) -> set[str]:
    body = _function_body(function_name)
    return set(re.findall(r"[\"']([a-z0-9_]+)[\"']\s*:", body))


def test_backend_and_upstream_calculation_contracts_are_byte_identical() -> None:
    assert BACKEND_SCHEMA_PATH.read_bytes() == UPSTREAM_SCHEMA_PATH.read_bytes()


def test_calculation_client_paths_are_owned_by_the_dedicated_contract() -> None:
    used_paths = re.findall(
        r"[\"'](/api/v1/(?:internal/agent|ai)/[^\"']*calculations[^\"']*)[\"']",
        CLIENT_SOURCE,
    )
    assert len(used_paths) == 5, "calculation API path scan may be stale"
    patterns = [
        _contract_path_pattern(endpoint["path"]) for endpoint in SCHEMA["endpoints"]
    ]
    for path in used_paths:
        assert any(pattern.match(path) for pattern in patterns), (
            f"rust_client.py uses a calculation path outside the contract: {path}"
        )


def test_internal_mutation_payloads_are_contract_bounded() -> None:
    cases = {
        "create_agent_calculation": "CreateAgentCalculationInput",
        "complete_agent_calculation": "CompleteAgentCalculationInput",
        "fail_agent_calculation": "FailAgentCalculationInput",
    }
    for function_name, definition_name in cases.items():
        definition = SCHEMA["definitions"][definition_name]
        used = _payload_keys(function_name)
        allowed = set(definition["properties"])
        required = set(definition["required"])
        assert used, f"{function_name} payload scan may be stale"
        assert not used - allowed, (
            f"{function_name} sends fields outside {definition_name}: "
            f"{sorted(used - allowed)}"
        )
        assert not required - used, (
            f"{function_name} omits required {definition_name} fields: "
            f"{sorted(required - used)}"
        )


def test_schema_constants_and_public_redaction_match_the_client() -> None:
    constants = {
        "CreateAgentCalculationInput": "agent_calculation_create_v1",
        "CompleteAgentCalculationInput": "agent_calculation_complete_v1",
        "FailAgentCalculationInput": "agent_calculation_fail_v1",
    }
    for definition_name, value in constants.items():
        assert SCHEMA["definitions"][definition_name]["properties"]["schema"]["const"] == value
        assert f'"schema": "{value}"' in CLIENT_SOURCE

    view_properties = SCHEMA["definitions"]["AgentCalculationView"]["properties"]
    artifact_properties = SCHEMA["definitions"]["AgentCalculationArtifactView"][
        "properties"
    ]
    assert "input_sha256" not in view_properties
    assert "content_base64" not in view_properties
    assert "content_base64" not in artifact_properties
    assert "relative_path" not in artifact_properties


def test_only_fixed_safe_tools_and_controlled_svg_artifacts_are_contractual() -> None:
    assert SCHEMA["definitions"]["AgentCalculationToolName"]["enum"] == [
        "calculate_expression",
        "calculate_statistics",
        "analyze_table",
        "generate_chart",
    ]
    artifact_input = SCHEMA["definitions"]["CompleteAgentCalculationArtifactInput"]
    assert artifact_input["additionalProperties"] is False
    assert artifact_input["properties"]["kind"]["const"] == "svg_chart"
    assert artifact_input["properties"]["mime_type"]["const"] == "image/svg+xml"
    assert SCHEMA["security_boundary"]["result_limit_bytes"] == 64 * 1024
    assert SCHEMA["security_boundary"]["artifact_limit_count"] == 10
    assert SCHEMA["security_boundary"]["artifact_limit_bytes_each"] == 512 * 1024
