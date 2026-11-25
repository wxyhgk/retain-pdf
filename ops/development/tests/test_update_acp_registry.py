"""ACP 官方登记表快照（ops/development/update_acp_registry.py）。

不联网：用临时目录里造的登记表；只有最后一条读仓库里真实的快照，守住「快照就是脚本写出来的样子」
（手改快照、或者换了写法没重新生成，这条会红）。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "update_acp_registry.py"
_spec = importlib.util.spec_from_file_location("update_acp_registry", SCRIPT)
registry_mod = importlib.util.module_from_spec(_spec)
sys.modules["update_acp_registry"] = registry_mod
_spec.loader.exec_module(registry_mod)

RAW = {
    "version": "1.0.0",
    "extensions": [],
    "agents": [
        {"id": "zeta", "name": "Zeta", "distribution": {"npx": {"package": "@z/zeta@1.0.0", "args": ["--acp"]}}},
        {"id": "alpha", "name": "Alpha", "distribution": {"binary": {"linux-x86_64": {"archive": "https://x", "cmd": "./alpha"}}}},
        {"id": "pyagent", "name": "Py", "distribution": {"uvx": {"package": "pyagent==0.1"}}},
        {"id": "hidden-one", "name": "H", "distribution": {"npx": {"package": "h@1"}}},
    ],
}


def run(tmp_path: Path, raw: dict, *extra: str) -> int:
    source = tmp_path / "registry.json"
    source.write_text(json.dumps(raw), encoding="utf-8")
    overrides = tmp_path / "agents.json"
    if not overrides.exists():
        overrides.write_text(json.dumps({"bins": {}, "hidden": {"hidden-one": "no"}}), encoding="utf-8")
    return registry_mod.main(
        ["--from", str(source), "--no-npm", "--snapshot", str(tmp_path / "snapshot.json"), "--overrides", str(overrides), *extra]
    )


def test_snapshot_is_sorted_and_stable(tmp_path: Path) -> None:
    assert run(tmp_path, RAW) == 0
    first = (tmp_path / "snapshot.json").read_text(encoding="utf-8")
    assert [agent["id"] for agent in json.loads(first)["agents"]] == ["alpha", "hidden-one", "pyagent", "zeta"]
    # 同一份数据换个顺序再写：一个字节都不变；--check 通过
    shuffled = {**RAW, "agents": list(reversed(RAW["agents"]))}
    assert run(tmp_path, shuffled) == 0
    assert (tmp_path / "snapshot.json").read_text(encoding="utf-8") == first
    assert run(tmp_path, RAW, "--check") == 0
    changed = {**RAW, "agents": RAW["agents"][:-1]}
    assert run(tmp_path, changed, "--check") == 1
    assert (tmp_path / "snapshot.json").read_text(encoding="utf-8") == first


def test_bad_registries_are_refused(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        registry_mod.normalize({"agents": []})
    with pytest.raises(ValueError):
        registry_mod.normalize({"agents": [RAW["agents"][0], RAW["agents"][0]]})
    with pytest.raises(ValueError):
        registry_mod.normalize({"agents": [{"id": "x", "name": "X", "distribution": {"docker": {}}}]})


def test_npx_only_agents_without_a_bin_name_are_reported(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    snapshot = registry_mod.normalize(RAW)
    assert registry_mod.missing_bins(snapshot, {"hidden": {"hidden-one": "no"}}) == [("zeta", "@z/zeta")]
    assert registry_mod.missing_bins(snapshot, {"bins": {"zeta": "zeta"}, "hidden": {"hidden-one": "no"}}) == []
    run(tmp_path, RAW)
    assert "zeta (@z/zeta) is npx-only" in capsys.readouterr().err
    assert registry_mod.package_name("@scope/name@1.2.3") == "@scope/name"
    assert registry_mod.package_name("plain") == "plain"


def test_repository_snapshot_is_normalized_and_overrides_cover_npx_agents() -> None:
    text = registry_mod.SNAPSHOT.read_text(encoding="utf-8")
    snapshot = json.loads(text)
    assert registry_mod.render(registry_mod.normalize(snapshot)) == text
    overrides = json.loads(registry_mod.OVERRIDES.read_text(encoding="utf-8"))
    assert registry_mod.missing_bins(snapshot, overrides) == []
