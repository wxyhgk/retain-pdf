#!/usr/bin/env python3
"""重新生成内置的 ACP 官方 agent 登记表快照（阅读页提问的本机 agent 列表从它来）。

    python3 ops/development/update_acp_registry.py                    # 从官方地址拉最新的
    python3 ops/development/update_acp_registry.py --from registry.json  # 用已经下载好的文件
    python3 ops/development/update_acp_registry.py --check            # 只比较，不写；有变化退出码 1

后端运行时不联网取登记表，只认仓库里的这份快照（`retainpdf-providers` 的 `acp/registry-snapshot.json`，
编译时 include_str!）。快照写法固定：agent 按 id 排序、键排序、两格缩进，同一份数据重跑不会有 diff。

npx / uvx 装的 agent 登记表里没写装好后的命令名：uvx 就是包名，npx 的要查 npm 的 `bin` 写进
`acp/agents.json` 的 `bins`（人工核过的名单）。这里会列出名单里还缺的，联网时顺带查出 npm 上的 `bin`
（`--no-npm` 不查），照着补进 `bins` 或 `hidden` 就行，脚本不改 `agents.json`。

方案：docs/ops/planning/reader-ask/20261126-ACP官方登记表.md。
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ACP_DIR = REPO_ROOT / "backend" / "packages" / "retainpdf-providers" / "src" / "acp"
SNAPSHOT = ACP_DIR / "registry-snapshot.json"
OVERRIDES = ACP_DIR / "agents.json"
SOURCE_URL = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json"
USER_AGENT = "retainpdf-acp-registry-sync"
DISTRIBUTIONS = ("binary", "npx", "uvx")


def normalize(raw: dict) -> dict:
    """检查形状，按 id 排序；不认识的字段原样留着（后端只读认识的）。"""
    agents = raw.get("agents")
    if not isinstance(agents, list) or not agents:
        raise ValueError("registry has no agents")
    seen: set[str] = set()
    for agent in agents:
        agent_id = agent.get("id") if isinstance(agent, dict) else None
        if not isinstance(agent_id, str) or not agent_id:
            raise ValueError(f"agent without id: {agent!r:.200}")
        if agent_id in seen:
            raise ValueError(f"duplicate agent id {agent_id}")
        seen.add(agent_id)
        distribution = agent.get("distribution")
        if not isinstance(distribution, dict) or not any(key in distribution for key in DISTRIBUTIONS):
            raise ValueError(f"agent {agent_id} has no binary / npx / uvx distribution")
    return {**raw, "agents": sorted(agents, key=lambda agent: agent["id"])}


def render(snapshot: dict) -> str:
    return json.dumps(snapshot, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def missing_bins(snapshot: dict, overrides: dict) -> list[tuple[str, str]]:
    """只能 npx 装、`bins` 和 `hidden` 里都没有的 agent：(id, npm 包名)。有 binary 的用压缩包里的命令名，不用补。"""
    bins = overrides.get("bins", {})
    hidden = overrides.get("hidden", {})
    missing = []
    for agent in snapshot["agents"]:
        distribution = agent["distribution"]
        npx = distribution.get("npx")
        if not npx or "binary" in distribution or agent["id"] in bins or agent["id"] in hidden:
            continue
        missing.append((agent["id"], package_name(npx["package"])))
    return missing


def package_name(spec: str) -> str:
    """`@scope/name@1.2.3` → `@scope/name`。"""
    at = spec.rfind("@")
    return spec[:at] if at > 0 else spec


def npm_bins(package: str) -> list[str]:
    url = "https://registry.npmjs.org/" + urllib.parse.quote(package, safe="@") + "/latest"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        meta = json.loads(response.read().decode("utf-8"))
    bins = meta.get("bin") or {}
    if isinstance(bins, str):
        return [meta["name"].split("/")[-1]]
    return sorted(bins)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--from", dest="source", type=Path, default=None, help="a downloaded registry.json")
    parser.add_argument("--check", action="store_true", help="compare only; exit 1 if the snapshot would change")
    parser.add_argument("--no-npm", action="store_true", help="do not look up npm bin names for missing entries")
    parser.add_argument("--snapshot", type=Path, default=SNAPSHOT, help=argparse.SUPPRESS)
    parser.add_argument("--overrides", type=Path, default=OVERRIDES, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.source:
        raw = json.loads(args.source.read_text(encoding="utf-8"))
    else:
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = json.loads(response.read().decode("utf-8"))
    snapshot = normalize(raw)
    text = render(snapshot)
    current = args.snapshot.read_text(encoding="utf-8") if args.snapshot.exists() else ""
    if args.check:
        if text != current:
            print(f"{args.snapshot.name}: out of date ({len(snapshot['agents'])} agents upstream)")
            return 1
        print(f"{args.snapshot.name}: up to date")
    elif text != current:
        args.snapshot.write_text(text, encoding="utf-8")
        print(f"{args.snapshot.name}: wrote {len(snapshot['agents'])} agents")
    else:
        print(f"{args.snapshot.name}: unchanged ({len(snapshot['agents'])} agents)")

    overrides = json.loads(args.overrides.read_text(encoding="utf-8"))
    for agent_id, package in missing_bins(snapshot, overrides):
        hint = ""
        if not args.no_npm:
            try:
                hint = f" npm bin: {', '.join(npm_bins(package)) or '(none)'}"
            except Exception as error:  # 查不到不影响快照
                hint = f" npm lookup failed: {error}"
        print(f"warning: {agent_id} ({package}) is npx-only and has no entry in agents.json bins/hidden;{hint}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
