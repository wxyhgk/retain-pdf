"""旧地址用量报表（ops/development/route_usage_report.py）。

登记表和用量文件都用临时目录里造的假数据；只有第一条会读仓库里真实的路由文件，
守住"解析出来的接口和接口清单快照 routes.txt 一一对应"——登记表的写法变了，
报表就会静悄悄地少报，这条会先红。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = Path(__file__).resolve().parents[1] / "route_usage_report.py"
_spec = importlib.util.spec_from_file_location("route_usage_report", SCRIPT)
report_mod = importlib.util.module_from_spec(_spec)
sys.modules["route_usage_report"] = report_mod
_spec.loader.exec_module(report_mod)

ROUTER_SOURCE = '''\
//! 假的路由文件。

use crate::app::AppState;

crate::endpoints! {
    state: AppState;
    /// 任务详情
    GET "/api/v1/jobs/:job_id" => lifecycle::get_job, signed;
    /// 建任务（// 说明里的注释不能被当成接口：GET "/api/v1/ghost" => x::y, signed;）
    POST "/api/v1/jobs" => lifecycle::create_job, signed [unlimited_body];
    /// 译文 PDF
    GET "/api/v1/jobs/:job_id/pdf" => files::download_pdf, signed old "/api/v1/jobs/:job_id/files/output/*name";
    GET "/api/v1/jobs/:job_id/files/output/*name" => files::job_output_file, signed;
    /// 老的 OCR 建任务
    POST "/api/v1/ocr/jobs" => ocr::create, closed [unlimited_body, other_flag]
        old "/api/v1/jobs";
    DELETE "/api/v1/jobs/:job_id/cache" => lifecycle::clear, admin
        old "/api/v1/jobs/:job_id/clear";
}
'''

SECOND_SOURCE = '''\
pub(super) mod worker {
    crate::endpoints! {
        state: AppState;
        GET "/api/v1/jobs/:job_id/events" => progress::events, signed old "/api/v1/jobs/:job_id/progress/events";
        GET "/api/v1/jobs/:job_id/progress/events" => progress::events, signed;
        GET "/api/v1/jobs/:job_id/live" => progress::live, signed old "/api/v1/jobs/:job_id/gone";
    }
}
'''


def make_repo(tmp_path: Path) -> Path:
    router = tmp_path / "backend" / "api" / "src" / "app" / "router"
    (router / "jobs").mkdir(parents=True)
    (router / "jobs" / "files.rs").write_text(ROUTER_SOURCE, encoding="utf-8")
    (router / "progress.rs").write_text(SECOND_SOURCE, encoding="utf-8")
    return tmp_path


def write_usage(path: Path, routes: dict[str, int], *, since="2026-10-10T00:00:00Z",
                updated_at="2026-10-12T00:00:00Z") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"since": since, "updated_at": updated_at, "routes": routes},
                               ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def run_json(repo: Path, *usage: Path, capsys) -> dict:
    code = report_mod.main(["--repo-root", str(repo), "--json", *map(str, usage)])
    assert code == 0
    return json.loads(capsys.readouterr().out)


# ------------------------------------------------------------ 解析

def test_the_real_router_sources_match_the_route_manifest() -> None:
    registry = report_mod.load_registry(REPO_ROOT / report_mod.ROUTER_DIR_REL, REPO_ROOT)
    parsed = {(e.method, e.path) for e in registry}
    manifest = set()
    for line in (REPO_ROOT / "backend/api/docs/routes.txt").read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            method, path, *_ = line.split()
            manifest.add((method, path))
    assert parsed == manifest


def test_parses_flags_old_and_multiple_methods(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    registry = report_mod.load_registry(repo / report_mod.ROUTER_DIR_REL, repo)
    by_key = {e.key: e for e in registry}

    assert by_key["GET /api/v1/jobs/:job_id"].replaced_by is None
    assert by_key["POST /api/v1/jobs"].flags == ["unlimited_body"]
    assert by_key["POST /api/v1/jobs"].access == "signed"

    old = by_key["GET /api/v1/jobs/:job_id/pdf"]
    assert old.replaced_by == "/api/v1/jobs/:job_id/files/output/*name"
    assert old.handler == "files::download_pdf"
    assert old.router_file == "backend/api/src/app/router/jobs/files.rs"

    # 多个选项、old 换行写在下一行
    ocr = by_key["POST /api/v1/ocr/jobs"]
    assert ocr.flags == ["unlimited_body", "other_flag"]
    assert ocr.replaced_by == "/api/v1/jobs"
    assert by_key["DELETE /api/v1/jobs/:job_id/cache"].replaced_by == "/api/v1/jobs/:job_id/clear"

    # 同一路径多个方法分别登记；注释里的"接口"不算；嵌套 mod 里的表也要解析
    assert "GET /api/v1/ghost" not in by_key
    assert "GET /api/v1/jobs/:job_id/events" in by_key
    assert len(registry) == 9


# ------------------------------------------------------------ 报表分组

def test_report_groups_old_endpoints_by_usage(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    first = write_usage(tmp_path / "data" / "diagnostics" / "route-usage.json", {
        "GET /api/v1/jobs/:job_id/pdf": 3,
        "GET /api/v1/jobs/:job_id/files/output/*name": 10,
        "GET /api/v1/jobs/:job_id/events": 1,
        "POST /api/v1/jobs": 4,
    })
    second = write_usage(tmp_path / "data" / "multi-user" / "diagnostics" / "route-usage.json", {
        "GET /api/v1/jobs/:job_id/pdf": 5,
        "GET /api/v1/jobs/:job_id/events": 20,
    }, since="2026-10-11T00:00:00Z")

    report = run_json(repo, first, second, capsys=capsys)

    assert [f["since"] for f in report["files"]] == ["2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z"]
    assert [f["route_count"] for f in report["files"]] == [4, 2]
    assert [f["total_calls"] for f in report["files"]] == [18, 25]
    assert report["registry"] == {"endpoints": 9, "old_endpoints": 5}

    with_calls = report["with_calls"]
    assert [e["key"] for e in with_calls] == [
        "GET /api/v1/jobs/:job_id/events",   # 21
        "GET /api/v1/jobs/:job_id/pdf",      # 8
    ]
    pdf = with_calls[1]
    assert pdf["counts"] == [3, 5]
    assert pdf["total"] == 8
    assert pdf["replacement"]["key"] == "GET /api/v1/jobs/:job_id/files/output/*name"
    assert pdf["replacement"]["counts"] == [10, 0]
    assert pdf["replacement"]["total"] == 10

    zero = [e["key"] for e in report["zero_calls"]]
    assert zero == [
        "DELETE /api/v1/jobs/:job_id/cache",
        "GET /api/v1/jobs/:job_id/live",
        "POST /api/v1/ocr/jobs",
    ]


def test_replacement_with_a_different_method_sums_the_methods_of_that_path(tmp_path: Path, capsys) -> None:
    """POST /ocr/jobs 的新地址写的是 /jobs，没有写方法：按这个路径上登记过的方法合起来算。"""
    repo = make_repo(tmp_path)
    usage = write_usage(tmp_path / "u.json", {
        "POST /api/v1/jobs": 6,
        "GET /api/v1/jobs": 0,
    })
    report = run_json(repo, usage, capsys=capsys)
    ocr = next(e for e in report["zero_calls"] if e["key"] == "POST /api/v1/ocr/jobs")
    assert ocr["replacement"]["key"] == "POST /api/v1/jobs"
    assert ocr["replacement"]["total"] == 6


def test_missing_replacement_is_flagged(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    usage = write_usage(tmp_path / "u.json", {})
    report = run_json(repo, usage, capsys=capsys)
    live = next(e for e in report["zero_calls"] if e["key"] == "GET /api/v1/jobs/:job_id/live")
    assert live["replacement"]["registered"] is False


def test_head_requests_count_toward_the_get_route(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    usage = write_usage(tmp_path / "u.json", {
        "GET /api/v1/jobs/:job_id/pdf": 2,
        "HEAD /api/v1/jobs/:job_id/pdf": 3,
    })
    report = run_json(repo, usage, capsys=capsys)
    assert report["with_calls"][0]["total"] == 5
    assert report["unknown_routes"] == []


def test_unknown_routes_are_listed_separately(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    first = write_usage(tmp_path / "a.json", {
        "GET /api/v1/removed": 7,
        "GET /api/v1/jobs/:job_id": 1,
        "PUT /api/v1/jobs/:job_id": 2,       # 地址登记过，方法没登记：也算不在登记表
    })
    second = write_usage(tmp_path / "b.json", {"GET /api/v1/removed": 1, "GET /api/v1/other": 2})
    report = run_json(repo, first, second, capsys=capsys)

    unknown = {e["key"]: e for e in report["unknown_routes"]}
    assert set(unknown) == {"GET /api/v1/removed", "GET /api/v1/other", "PUT /api/v1/jobs/:job_id"}
    assert unknown["GET /api/v1/removed"]["counts"] == [7, 1]
    assert unknown["GET /api/v1/removed"]["total"] == 8
    # 没有混进旧地址的分组
    assert all(not e["key"].startswith("GET /api/v1/removed") for e in report["with_calls"])
    assert all(not e["key"].startswith("GET /api/v1/removed") for e in report["zero_calls"])


def test_route_stats_list_errors_and_slow_routes(tmp_path: Path, capsys) -> None:
    """2026-11-24 起用量文件多了 route_stats；以前的文件（没有这一项）照样能读。"""
    repo = make_repo(tmp_path)
    usage = tmp_path / "u.json"
    usage.write_text(json.dumps({
        "since": "2026-11-24T00:00:00Z",
        "updated_at": "2026-11-24T01:00:00Z",
        "routes": {"GET /api/v1/jobs/:job_id": 10, "HEAD /api/v1/jobs/:job_id": 2, "POST /api/v1/jobs": 3},
        "route_stats": {
            "GET /api/v1/jobs/:job_id": {"status": {"2xx": 8, "5xx": 2}, "latency_ms": {"le_50": 9, "gt_5000": 1},
                                          "latency_us_sum": 6000000},
            "HEAD /api/v1/jobs/:job_id": {"status": {"2xx": 2}, "latency_ms": {"le_5000": 1, "le_50": 1}},
            "POST /api/v1/jobs": {"status": {"2xx": 3}, "latency_ms": {"le_200": 3}},
        },
    }), encoding="utf-8")
    old = write_usage(tmp_path / "old.json", {"GET /api/v1/jobs/:job_id": 5})
    report = run_json(repo, usage, old, capsys=capsys)
    assert report["errors_and_slow"] == [
        {"key": "GET /api/v1/jobs/:job_id", "requests": 12, "4xx": 0, "5xx": 2, "slow": 2},
    ]
    assert report["files"][0]["total_calls"] == 15

    assert report_mod.main(["--repo-root", str(repo), str(usage)]) == 0
    text = capsys.readouterr().out
    assert "== 有 5xx 或超过 1 秒的接口（1 个" in text


def test_text_output_has_chinese_sections(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    usage = write_usage(tmp_path / "u.json", {"GET /api/v1/jobs/:job_id/pdf": 3, "GET /api/v1/gone": 1})
    assert report_mod.main(["--repo-root", str(repo), str(usage)]) == 0
    text = capsys.readouterr().out
    for heading in ("== 用量文件 ==", "== 还有调用（1 个", "== 零调用（4 个）==", "登记表里没有的路由（1 个"):
        assert heading in text
    assert "GET /api/v1/jobs/:job_id/pdf" in text
    assert "GET /api/v1/gone" in text


def test_usage_files_are_discovered_under_data(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    write_usage(tmp_path / "data" / "diagnostics" / "route-usage.json", {"GET /api/v1/jobs/:job_id/pdf": 1})
    write_usage(tmp_path / "data" / "multi-user" / "diagnostics" / "route-usage.json", {})
    # 存档文件不能被当成用量文件
    write_usage(tmp_path / "data" / "diagnostics" / "route-usage.20261001T000000Z.json", {"GET /x": 9})
    report = run_json(repo, capsys=capsys)
    assert [f["path"] for f in report["files"]] == [
        "data/diagnostics/route-usage.json",
        "data/multi-user/diagnostics/route-usage.json",
    ]


def test_broken_usage_file_is_an_error(tmp_path: Path, capsys) -> None:
    repo = make_repo(tmp_path)
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    assert report_mod.main(["--repo-root", str(repo), str(bad)]) == 2
    assert "读不了" in capsys.readouterr().err


# ------------------------------------------------------------ 清零

NOW = datetime(2026, 10, 17, 12, 0, 0, tzinfo=timezone.utc)


def reset(path: Path, *, yes: bool, even_if_running: bool = False) -> int:
    return report_mod.reset_usage_file(path, yes=yes, even_if_running=even_if_running, now=NOW)


def test_reset_without_yes_changes_nothing(tmp_path: Path, capsys) -> None:
    path = write_usage(tmp_path / "diagnostics" / "route-usage.json", {"GET /a": 5})
    before = path.read_bytes()
    assert reset(path, yes=False) == 0
    out = capsys.readouterr().out
    assert "route-usage.20261017T120000Z.json" in out
    assert "没有加 --yes" in out
    assert path.read_bytes() == before
    assert sorted(p.name for p in path.parent.iterdir()) == ["route-usage.json"]


def test_reset_with_yes_archives_and_writes_a_fresh_file(tmp_path: Path) -> None:
    path = write_usage(tmp_path / "diagnostics" / "route-usage.json", {"GET /a": 5, "POST /b": 2})
    original = path.read_bytes()

    assert reset(path, yes=True) == 0

    archive = path.parent / "route-usage.20261017T120000Z.json"
    assert archive.read_bytes() == original
    fresh = json.loads(path.read_text(encoding="utf-8"))
    assert fresh == {"since": "2026-10-17T12:00:00Z", "updated_at": "2026-10-17T12:00:00Z", "routes": {}}
    assert sorted(p.name for p in path.parent.iterdir()) == [
        "route-usage.20261017T120000Z.json", "route-usage.json",
    ]


def test_reset_refuses_a_file_that_was_just_updated(tmp_path: Path, capsys) -> None:
    """应用开着时每 60 秒重写一次文件：updated_at 很新就说明还在跑，清零会被盖回去。"""
    path = write_usage(tmp_path / "route-usage.json", {"GET /a": 5}, updated_at="2026-10-17T11:59:30Z")
    before = path.read_bytes()

    assert reset(path, yes=True) == 2
    assert "多半还在跑" in capsys.readouterr().err
    assert path.read_bytes() == before
    assert [p.name for p in tmp_path.iterdir()] == ["route-usage.json"]

    assert reset(path, yes=True, even_if_running=True) == 0
    assert json.loads(path.read_text(encoding="utf-8"))["routes"] == {}


def test_reset_missing_file_and_existing_archive(tmp_path: Path, capsys) -> None:
    assert reset(tmp_path / "nope.json", yes=True) == 2
    path = write_usage(tmp_path / "route-usage.json", {"GET /a": 1})
    (tmp_path / "route-usage.20261017T120000Z.json").write_text("{}", encoding="utf-8")
    assert reset(path, yes=True) == 2
    assert json.loads(path.read_text(encoding="utf-8"))["routes"] == {"GET /a": 1}


def test_reset_via_command_line_needs_yes(tmp_path: Path, capsys) -> None:
    path = write_usage(tmp_path / "route-usage.json", {"GET /a": 1})
    assert report_mod.main(["--reset", str(path)]) == 0
    assert json.loads(path.read_text(encoding="utf-8"))["routes"] == {"GET /a": 1}
    assert report_mod.main(["--yes"]) == 2


# ------------------------------------------------------------ 谁在用（by(…)、owner，2026-11-22）

OWNED_SOURCE = '''\
crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 任务详情
    GET "/api/v1/jobs/:job_id" => lifecycle::get_job, signed by(web, cli);
    /// 上传
    POST "/api/v1/uploads" => uploads::upload, signed by(web) [unlimited_body] owner(ingest);
    /// 后端先加的
    POST "/api/v1/jobs/:job_id/ask" => lifecycle::ask, admin by(none) [large_body];
    /// 多用户版
    POST "/api/v1/auth/login" => accounts::login, public by(multiuser) owner(accounts);
    GET "/api/v1/jobs/:job_id/old" => lifecycle::get_job, signed by(none)
        old "/api/v1/jobs/:job_id";
}
'''


def make_owned_repo(tmp_path: Path) -> Path:
    router = tmp_path / "backend" / "api" / "src" / "app" / "router"
    router.mkdir(parents=True)
    (router / "jobs.rs").write_text(OWNED_SOURCE, encoding="utf-8")
    return tmp_path


def test_parses_users_and_owner(tmp_path: Path) -> None:
    repo = make_owned_repo(tmp_path)
    by_key = {e.key: e for e in report_mod.load_registry(repo / report_mod.ROUTER_DIR_REL, repo)}
    assert len(by_key) == 5
    assert (by_key["GET /api/v1/jobs/:job_id"].users, by_key["GET /api/v1/jobs/:job_id"].owner) == (["web", "cli"], "jobs")
    upload = by_key["POST /api/v1/uploads"]
    assert (upload.users, upload.owner, upload.flags) == (["web"], "ingest", ["unlimited_body"])
    assert by_key["POST /api/v1/jobs/:job_id/ask"].flags == ["large_body"]
    assert by_key["GET /api/v1/jobs/:job_id/old"].replaced_by == "/api/v1/jobs/:job_id"


def test_declared_users_are_checked_against_calls(tmp_path: Path, capsys) -> None:
    repo = make_owned_repo(tmp_path)
    usage = write_usage(repo / "data" / "diagnostics" / "route-usage.json",
                        {"GET /api/v1/jobs/:job_id": 9, "POST /api/v1/jobs/:job_id/ask": 2})
    report = run_json(repo, usage, capsys=capsys)
    assert [e["key"] for e in report["declared_none_but_called"]] == ["POST /api/v1/jobs/:job_id/ask"]
    # 有调用方却零调用：只提示写了真实调用方的；none、multiuser 不算
    assert [e["key"] for e in report["declared_used_but_silent"]] == ["POST /api/v1/uploads"]
    code = report_mod.main(["--repo-root", str(repo), str(usage)])
    assert code == 0
    text = capsys.readouterr().out
    assert "登记 by(none) 却有调用（1 个" in text and "POST /api/v1/uploads  by(web)  [ingest]" in text
