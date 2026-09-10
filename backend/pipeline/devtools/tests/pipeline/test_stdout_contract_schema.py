"""pipeline-stdout.v1 契约锁（生产者侧）。

后端测试镜像在 backend-root/contracts/pipeline-stdout.v1.schema.json；本测试保证
python worker 的发射面与契约一致：常量文件与 schema 双向对齐、每个契约
标签在源码里有真实发射点、artifact_published 的 key 不超出契约。
消费者侧锁在 rust_api crates/retain-jobs stdout_parser/contract_lock.rs。
改协议先改 schema，两端测试同步变绿才算完成。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.services.pipeline_shared import contracts  # noqa: E402

BACKEND_ROOT = REPO_SCRIPTS_ROOT.parent
SCHEMA_ROOT = BACKEND_ROOT / "contracts"
SCHEMA = json.loads(
    (SCHEMA_ROOT / "pipeline-stdout.v1.schema.json").read_text(encoding="utf-8")
)

# 发射点扫描范围：真实 worker 代码（devtools 工具脚本不算协议生产者）
EMIT_SCAN_DIRS = [
    REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "services",
    REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "entrypoints",
    REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "ocr",
    REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "translate",
    REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "render",
]


def _iter_emit_sources():
    for base in EMIT_SCAN_DIRS:
        for path in base.rglob("*.py"):
            if "__pycache__" in path.parts:
                continue
            yield path, path.read_text(encoding="utf-8")


def _constant_names_by_value() -> dict[str, str]:
    return {
        value: name
        for name, value in vars(contracts).items()
        if name.startswith("STDOUT_LABEL_") and isinstance(value, str)
    }


def test_contract_constants_align_with_schema() -> None:
    schema_labels = set(SCHEMA["artifact_labels"]) | set(SCHEMA["emit_only_labels"])
    py_labels = set(_constant_names_by_value())

    unknown = py_labels - schema_labels
    assert not unknown, f"contracts.py 出现契约之外的标签: {sorted(unknown)}"

    # 短语标签（含空格）最易漂移，必须由 contracts.py 单源供给
    phrase_labels = {label for label in SCHEMA["artifact_labels"] if " " in label}
    missing = phrase_labels - py_labels
    assert not missing, f"契约短语标签缺常量定义: {sorted(missing)}"


def test_schema_version_value_matches_contract() -> None:
    expected = SCHEMA["artifact_labels"]["schema version"]["expected_value"]
    assert contracts.STDOUT_SCHEMA_VERSION_VALUE == expected


def test_every_artifact_label_has_emit_site() -> None:
    names_by_value = _constant_names_by_value()
    sources = list(_iter_emit_sources())

    for label in SCHEMA["artifact_labels"]:
        constant_name = names_by_value.get(label)
        found = False
        for path, text in sources:
            if path.name == "contracts.py":
                continue
            if constant_name and constant_name in text:
                found = True
                break
            if f'"{label}: ' in text or f"'{label}: " in text or f'f"{label}: ' in text:
                found = True
                break
        assert found, (
            f"契约标签 `{label}` 在 python 侧无发射点——若已改名/删除，"
            f"必须同步 schema 与 rust 侧锁"
        )


def test_artifact_event_keys_subset_of_contract() -> None:
    allowed: set[str] = set(SCHEMA["artifact_event"]["emit_only_keys"])
    for canonical, aliases in SCHEMA["artifact_event"]["artifact_keys"].items():
        allowed.add(canonical)
        allowed.update(aliases)

    key_re = re.compile(r"emit_artifact_published\((?:[^)]*?)artifact_key=\"([a-z0-9_]+)\"", re.S)
    used: set[str] = set()
    for _, text in _iter_emit_sources():
        used.update(key_re.findall(text))

    assert used, "未在源码中找到任何 emit_artifact_published 调用——扫描逻辑可能失效"
    unknown = used - allowed
    assert not unknown, f"emit_artifact_published 使用了契约之外的 artifact_key: {sorted(unknown)}"


def test_checkpoint_event_has_real_producer() -> None:
    checkpoint_contract = SCHEMA["checkpoint_event"]
    assert checkpoint_contract["event_type"] == "pipeline_checkpoint"
    session_source = (
        REPO_SCRIPTS_ROOT
        / "retainpdf_pipeline/translate/workflow/checkpoint/session.py"
    ).read_text(encoding="utf-8")
    assert '"event_type": "pipeline_checkpoint"' in session_source
    for field in checkpoint_contract["required_payload_fields"]:
        assert f'"{field}"' in session_source, f"checkpoint producer missing `{field}`"


def test_stage_observation_event_has_real_producer() -> None:
    stage_contract = SCHEMA["stage_observation_event"]
    assert stage_contract["schema"] == "pipeline_stage_observation_v1"
    events_source = (
        REPO_SCRIPTS_ROOT
        / "retainpdf_pipeline/services/pipeline_shared/events.py"
    ).read_text(encoding="utf-8")
    assert "PIPELINE_STAGE_OBSERVATION_SCHEMA" in events_source
    for event_type in stage_contract["event_types"]:
        assert f'"{event_type}"' in events_source
    for field in stage_contract["required_fields"]:
        assert f'"{field}"' in events_source, f"stage producer missing `{field}`"


def test_metric_and_state_lines_have_emit_sites() -> None:
    sources = list(_iter_emit_sources())

    for entry in SCHEMA["metric_lines"]:
        prefix = entry["example"].split(":", 1)[0]
        found = any(f'"{prefix}: ' in text or f"'{prefix}: " in text for _, text in sources)
        assert found, f"指标行 `{prefix}: ...` 在 python 侧无发射点"

    separator = SCHEMA["provider_state_lines"]["separator"]
    found = any(separator in text for _, text in sources)
    assert found, f"provider 状态行分隔符 `{separator}` 在 python 侧无发射点"

    for rule in SCHEMA["stage_prefix_rules"]:
        prefix = rule["prefix"]
        found = any(f'"{prefix}' in text for _, text in sources)
        assert found, f"阶段前缀行 `{prefix}...` 在 python 侧无发射点"
