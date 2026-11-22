#!/usr/bin/env python3
"""接口用量报表：删旧地址之前，看这些地址这段时间到底有没有人调；也拿登记表里写的“谁在用”（`by(…)`，
2026-11-22 起）和实际调用对账。

rust_api 按路由模板给每个接口计数（`backend/api/src/app/route_usage.rs`），落在
`<data_root>/diagnostics/route-usage.json`。这个脚本把计数和接口登记表（路由文件里的
`crate::endpoints!` 表）对起来，列出每个旧地址（行尾写了 `old "<新地址>"` 的那些）的调用次数：

    python3 ops/development/route_usage_report.py                    # 自动找 data/**/diagnostics/route-usage.json
    python3 ops/development/route_usage_report.py data/diagnostics/route-usage.json
    python3 ops/development/route_usage_report.py --json             # 机器可读
    python3 ops/development/route_usage_report.py --reset data/diagnostics/route-usage.json          # 只打印会做什么
    python3 ops/development/route_usage_report.py --reset data/diagnostics/route-usage.json --yes    # 真的清零

只读登记表的源码（正则解析），不依赖 cargo，也不连运行中的应用。

清零（--reset）的注意事项，先看 route_usage.rs 是怎么写这个文件的：
- 应用启动时读一次这个文件，之后计数一直在内存里累加；
- 每 60 秒把内存里的整份计数写回文件（临时文件 + rename），关机时不再补写一次；
- 所以应用在跑的时候清零没用：下一次落盘会用内存里的旧计数把新文件盖掉。
**必须先停应用，再清零，再启动**；启动时读到的就是新文件，从零开始。
脚本会检查文件的 `updated_at`：不到 120 秒前还在更新，说明应用多半还开着，拒绝清零
（确实停了也想清零，加 `--even-if-running`）。
清零 = 把原文件改名存档为同目录的 `route-usage.<UTC 时间戳>.json`，再写一个 `since` 为现在、
`routes` 为空的新文件。不加 `--yes` 只打印计划。

对账（“谁在用”和调用次数）：
- 写了 `by(none)`（没有调用方）却有调用的：多半是登记错了，或者是开发时手动调的；
- 写了有调用方、各个用量文件里却一次都没调过的：调用方可能在别的环境（桌面安装包的数据目录不在这里）、
  可能已经不用了。只是提示，不一定是错。

HEAD 请求：axum 对 GET 路由自动接 HEAD，用量里记成 `HEAD /路径`。报表把它并入同路径的 GET 计数，
不当作"不在登记表里"。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ROUTER_DIR_REL = Path("backend") / "api" / "src" / "app" / "router"
USAGE_FILE_NAME = "route-usage.json"
RUNNING_WINDOW_SECONDS = 120

METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")

# 登记表的一条：  GET "/路径" => 模块::处理函数, signed by(web, cli) [unlimited_body] owner(jobs) old "/新路径";
# 说明写在 `///` 里，解析前先把注释整行去掉。
ENDPOINT_RE = re.compile(
    r"\b(?P<method>" + "|".join(METHODS) + r")\s+"
    r'"(?P<path>[^"]*)"\s*=>\s*'
    r"(?P<handler>[\w:]+)\s*,\s*"
    r"(?P<access>\w+)\s*"
    r"(?:by\((?P<users>[^)]*)\))?\s*"
    r"(?:\[(?P<flags>[^\]]*)\])?\s*"
    r"(?:owner\((?P<owner>\w+)\))?\s*"
    r'(?:old\s+"(?P<old>[^"]*)")?\s*;'
)
# 表头：    owner: jobs;
TABLE_OWNER_RE = re.compile(r"^\s*owner:\s*(?P<owner>\w+)\s*;", re.MULTILINE)


class Endpoint:
    def __init__(self, method: str, path: str, handler: str, access: str,
                 flags: list[str], replaced_by: str | None, router_file: str,
                 users: list[str] | None = None, owner: str = "") -> None:
        self.method = method
        self.path = path
        self.handler = handler
        self.access = access
        self.flags = flags
        self.replaced_by = replaced_by
        self.router_file = router_file
        self.users = users or []
        self.owner = owner

    @property
    def key(self) -> str:
        return f"{self.method} {self.path}"


# ---------------------------------------------------------------- 登记表

def strip_comments(text: str) -> str:
    """去掉 `//`、`///`、`//!` 注释。登记表里的地址不含 `//`，按行截断就够。"""
    return "\n".join(line.split("//", 1)[0] for line in text.splitlines())


def parse_endpoint_file(path: Path, rel: str) -> list[Endpoint]:
    text = strip_comments(path.read_text(encoding="utf-8"))
    table_owner = TABLE_OWNER_RE.search(text)
    found = []
    for match in ENDPOINT_RE.finditer(text):
        flags = [flag.strip() for flag in (match.group("flags") or "").split(",") if flag.strip()]
        users = [user.strip() for user in (match.group("users") or "").split(",") if user.strip()]
        found.append(Endpoint(
            method=match.group("method"),
            path=match.group("path"),
            handler=match.group("handler"),
            access=match.group("access"),
            flags=flags,
            replaced_by=match.group("old"),
            router_file=rel,
            users=users,
            owner=match.group("owner") or (table_owner.group("owner") if table_owner else ""),
        ))
    return found


def load_registry(router_dir: Path, repo_root: Path) -> list[Endpoint]:
    endpoints: list[Endpoint] = []
    for source in sorted(router_dir.rglob("*.rs")):
        try:
            rel = source.relative_to(repo_root).as_posix()
        except ValueError:
            rel = source.as_posix()
        endpoints.extend(parse_endpoint_file(source, rel))
    return endpoints


# ---------------------------------------------------------------- 用量文件

def discover_usage_files(repo_root: Path) -> list[Path]:
    return sorted((repo_root / "data").glob(f"**/diagnostics/{USAGE_FILE_NAME}"))


def load_usage(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    routes = data.get("routes") or {}
    return {
        "path": path,
        "since": data.get("since", ""),
        "updated_at": data.get("updated_at", ""),
        "routes": {str(key): int(value) for key, value in routes.items()},
    }


def label_for(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root).as_posix()
    except ValueError:
        return path.as_posix()


# ---------------------------------------------------------------- 报表

def build_report(usages: list[dict], labels: list[str], registry: list[Endpoint]) -> dict:
    registered = {endpoint.key for endpoint in registry}
    paths_by_method: dict[str, set[str]] = {}
    for endpoint in registry:
        paths_by_method.setdefault(endpoint.path, set()).add(endpoint.method)

    def effective_counts(usage: dict) -> dict[str, int]:
        """HEAD 并入同路径的 GET；其余原样。"""
        counts: dict[str, int] = {}
        for key, value in usage["routes"].items():
            method, _, path = key.partition(" ")
            if method == "HEAD" and "GET" in paths_by_method.get(path, set()):
                key = f"GET {path}"
            counts[key] = counts.get(key, 0) + value
        return counts

    per_file = [effective_counts(usage) for usage in usages]

    def counts_of(key: str) -> list[int]:
        return [counts.get(key, 0) for counts in per_file]

    def replacement_info(endpoint: Endpoint) -> dict:
        new_path = endpoint.replaced_by or ""
        same_method = f"{endpoint.method} {new_path}"
        if same_method in registered:
            key, counts = same_method, counts_of(same_method)
        else:
            # 新地址换了方法（或写错了）：把这个路径上所有登记过的方法加起来
            methods = sorted(paths_by_method.get(new_path, set()))
            keys = [f"{method} {new_path}" for method in methods]
            counts = [sum(per_file[i].get(k, 0) for k in keys) for i in range(len(per_file))]
            key = " / ".join(keys) if keys else same_method
        return {"key": key, "path": new_path, "counts": counts, "total": sum(counts),
                "registered": key in registered or bool(paths_by_method.get(new_path))}

    old_entries = []
    for endpoint in registry:
        if endpoint.replaced_by is None:
            continue
        counts = counts_of(endpoint.key)
        old_entries.append({
            "method": endpoint.method,
            "path": endpoint.path,
            "key": endpoint.key,
            "router_file": endpoint.router_file,
            "counts": counts,
            "total": sum(counts),
            "replacement": replacement_info(endpoint),
        })

    unknown: dict[str, list[int]] = {}
    for counts in per_file:
        for key in counts:
            if key not in registered and key not in unknown:
                unknown[key] = counts_of(key)
    unknown_entries = [
        {"key": key, "counts": counts, "total": sum(counts)}
        for key, counts in sorted(unknown.items())
    ]

    # 对账：登记的“谁在用”和调用次数
    declared_none_but_called = []
    declared_used_but_silent = []
    for endpoint in registry:
        if not endpoint.users:
            continue
        counts = counts_of(endpoint.key)
        entry = {"key": endpoint.key, "users": endpoint.users, "owner": endpoint.owner,
                 "router_file": endpoint.router_file, "counts": counts, "total": sum(counts)}
        if endpoint.users == ["none"] and entry["total"] > 0:
            declared_none_but_called.append(entry)
        elif endpoint.users not in (["none"], ["multiuser"]) and entry["total"] == 0 and usages:
            declared_used_but_silent.append(entry)

    with_calls = sorted((e for e in old_entries if e["total"] > 0),
                        key=lambda e: (-e["total"], e["key"]))
    zero_calls = sorted((e for e in old_entries if e["total"] == 0), key=lambda e: e["key"])

    return {
        "files": [
            {
                "path": label,
                "since": usage["since"],
                "updated_at": usage["updated_at"],
                "route_count": len(usage["routes"]),
                "total_calls": sum(usage["routes"].values()),
            }
            for usage, label in zip(usages, labels)
        ],
        "registry": {
            "endpoints": len(registry),
            "old_endpoints": len(old_entries),
        },
        "with_calls": with_calls,
        "zero_calls": zero_calls,
        "unknown_routes": unknown_entries,
        "declared_none_but_called": sorted(declared_none_but_called, key=lambda e: (-e["total"], e["key"])),
        "declared_used_but_silent": sorted(declared_used_but_silent, key=lambda e: e["key"]),
    }


def format_counts(counts: list[int]) -> str:
    if len(counts) == 1:
        return str(counts[0])
    return " ".join(f"#{i + 1}={n}" for i, n in enumerate(counts))


def render_text(report: dict) -> str:
    out: list[str] = []
    files = report["files"]
    out.append("== 用量文件 ==")
    if not files:
        out.append("  （没有用量文件）")
    for index, info in enumerate(files, start=1):
        out.append(f"  [#{index}] {info['path']}")
        out.append(f"      since {info['since'] or '-'}   updated_at {info['updated_at'] or '-'}"
                   f"   路由 {info['route_count']} 条   总调用 {info['total_calls']}")
    registry = report["registry"]
    out.append("")
    out.append(f"登记表：{registry['endpoints']} 个接口，其中旧地址 {registry['old_endpoints']} 个")

    out.append("")
    out.append(f"== 还有调用（{len(report['with_calls'])} 个，按合计从多到少）==")
    if not report["with_calls"]:
        out.append("  （无）")
    for entry in report["with_calls"]:
        out.extend(_render_old_entry(entry, with_counts=True))

    out.append("")
    out.append(f"== 零调用（{len(report['zero_calls'])} 个）==")
    if not report["zero_calls"]:
        out.append("  （无）")
    for entry in report["zero_calls"]:
        out.extend(_render_old_entry(entry, with_counts=False))

    out.append("")
    out.append(f"== 用量里有、登记表里没有的路由（{len(report['unknown_routes'])} 个，已删除、改名或旧数据）==")
    if not report["unknown_routes"]:
        out.append("  （无）")
    for entry in report["unknown_routes"]:
        out.append(f"  {entry['total']:>7}  {format_counts(entry['counts'])}  {entry['key']}")

    out.append("")
    out.append(f"== 登记 by(none) 却有调用（{len(report['declared_none_but_called'])} 个：登记错了，或是开发时手动调的）==")
    if not report["declared_none_but_called"]:
        out.append("  （无）")
    for entry in report["declared_none_but_called"]:
        out.append(f"  {entry['total']:>7}  {format_counts(entry['counts'])}  {entry['key']}  [{entry['owner']}]")

    out.append("")
    out.append(f"== 登记有调用方、这些用量文件里却零调用（{len(report['declared_used_but_silent'])} 个：调用方可能在别的环境，或已经不用了）==")
    if not report["declared_used_but_silent"]:
        out.append("  （无）")
    for entry in report["declared_used_but_silent"]:
        out.append(f"  {entry['key']}  by({', '.join(entry['users'])})  [{entry['owner']}]")
    return "\n".join(out) + "\n"


def _render_old_entry(entry: dict, *, with_counts: bool) -> list[str]:
    replacement = entry["replacement"]
    lines = []
    if with_counts:
        lines.append(f"  {entry['total']:>7}  {format_counts(entry['counts'])}  {entry['key']}")
    else:
        lines.append(f"  {entry['key']}")
    note = "" if replacement["registered"] else "（登记表里没有这个新地址）"
    lines.append(f"           新地址 {replacement['key']}  新地址调用 合计 {replacement['total']}"
                 f" ({format_counts(replacement['counts'])}){note}")
    lines.append(f"           路由文件 {entry['router_file']}")
    return lines


# ---------------------------------------------------------------- 清零

def parse_iso(text: str) -> datetime | None:
    try:
        return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def reset_usage_file(path: Path, *, yes: bool, even_if_running: bool,
                     now: datetime | None = None, out=None) -> int:
    out = out or sys.stdout
    now = now or datetime.now(timezone.utc)
    if not path.is_file():
        print(f"错误：找不到用量文件 {path}", file=sys.stderr)
        return 2
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"错误：读不了 {path}：{error}", file=sys.stderr)
        return 2

    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    archive = path.with_name(f"{path.stem}.{stamp}{path.suffix}")
    routes = data.get("routes") or {}
    since = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    updated = parse_iso(data.get("updated_at", ""))
    age = (now - updated).total_seconds() if updated else None
    looks_running = age is not None and age < RUNNING_WINDOW_SECONDS

    print(f"清零 {path}", file=out)
    print(f"  现有：since {data.get('since', '-')}，updated_at {data.get('updated_at', '-')}，"
          f"路由 {len(routes)} 条，总调用 {sum(int(v) for v in routes.values())}", file=out)
    print(f"  存档为：{archive}", file=out)
    print(f"  新文件：since {since}，routes 为空", file=out)
    print("  前提：rust_api 必须已经停掉——它每 60 秒用内存里的计数整份重写这个文件，"
          "开着清零会被盖回去。", file=out)

    if looks_running and not even_if_running:
        print(f"拒绝：updated_at 只有 {int(age)} 秒前，应用多半还在跑。"
              "先停应用再清零；确实停了加 --even-if-running。", file=sys.stderr)
        return 2
    if archive.exists():
        print(f"拒绝：存档文件 {archive} 已存在", file=sys.stderr)
        return 2
    if not yes:
        print("（没有加 --yes，什么都没改。确认无误后加 --yes 真的执行。）", file=out)
        return 0

    shutil.copy2(path, archive)
    if archive.read_bytes() != path.read_bytes():
        print("错误：存档内容和原文件不一致，没有清零", file=sys.stderr)
        archive.unlink(missing_ok=True)
        return 2
    fresh = {"since": since, "updated_at": since, "routes": {}}
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)
    print("已清零。启动应用后从零开始计数。", file=out)
    return 0


# ---------------------------------------------------------------- 入口

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="接口用量报表：把 route-usage.json 和接口登记表对起来（旧地址还有没有人调；登记的“谁在用”和实际调用对账）。",
        epilog="清零前必须先停 rust_api，详见脚本开头的说明。",
    )
    parser.add_argument("usage", nargs="*", type=Path,
                        help="用量文件，可多个；不给就找 <仓库根>/data/**/diagnostics/route-usage.json")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT,
                        help="仓库根（找 data/ 和路由文件用），默认是脚本所在仓库")
    parser.add_argument("--router-dir", type=Path, default=None,
                        help=f"登记表所在目录，默认 <仓库根>/{ROUTER_DIR_REL.as_posix()}")
    parser.add_argument("--reset", type=Path, metavar="FILE",
                        help="把这个用量文件存档并清零（只打印计划，加 --yes 才执行）；应用必须已停")
    parser.add_argument("--yes", action="store_true", help="--reset 时真的执行")
    parser.add_argument("--even-if-running", action="store_true",
                        help="--reset 时，即使 updated_at 很新也继续（确认应用已停时用）")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    repo_root = args.repo_root.resolve()

    if args.reset:
        return reset_usage_file(args.reset, yes=args.yes, even_if_running=args.even_if_running)
    if args.yes or args.even_if_running:
        print("错误：--yes、--even-if-running 只和 --reset 一起用", file=sys.stderr)
        return 2

    router_dir = (args.router_dir or repo_root / ROUTER_DIR_REL)
    if not router_dir.is_dir():
        print(f"错误：找不到登记表目录 {router_dir}", file=sys.stderr)
        return 2
    registry = load_registry(router_dir, repo_root)
    if not registry:
        print(f"错误：{router_dir} 下没解析出任何接口，登记表写法可能变了", file=sys.stderr)
        return 2

    paths = args.usage or discover_usage_files(repo_root)
    usages, labels = [], []
    for path in paths:
        try:
            usages.append(load_usage(path))
        except (OSError, ValueError, AttributeError) as error:
            print(f"错误：读不了 {path}：{error}", file=sys.stderr)
            return 2
        labels.append(label_for(path, repo_root))

    report = build_report(usages, labels, registry)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        sys.stdout.write(render_text(report))
        if not paths:
            print(f"\n提示：{repo_root / 'data'} 下没找到 diagnostics/{USAGE_FILE_NAME}，"
                  "可以直接把用量文件路径写在命令后面。", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
