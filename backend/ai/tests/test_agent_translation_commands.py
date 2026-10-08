"""`retainpdf-agent translation ...`：语法、授权闸门、以及每个子命令发出去的请求。

HTTP 一律 mock：runner 只通过注入的 `call(action, cli_argv, body)` 发请求，
这里记录下来逐条断言 —— capability 动作名、CLI argv、请求体三样都要对。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from retainpdf_ai.agent_broker_commands import parse_broker_argv, parse_broker_command
from retainpdf_ai.agent_broker_contracts import BrokerScope, BrokerUsageError
from retainpdf_ai.agent_translation_runner import CliResult, TranslationCommandRunner

JOB = "20261006023250-703433"


def _scope(*, job_id: str = JOB, confirmed: bool = False, green_light: bool = False) -> BrokerScope:
    return BrokerScope(
        conversation_id="",
        document_id="",
        request_message_id="",
        intent_summary="",
        job_id=job_id,
        confirmed=confirmed,
        green_light=green_light,
    )


def _parse(command: str, **scope: Any):
    return parse_broker_command(command, _scope(**scope))


# ------------------------------------------------------------------ 语法


def test_each_subcommand_parses_into_a_translation_action():
    cases = {
        "retainpdf-agent translation issues": ("translation.issues", {"pages": None, "min_severity": None, "limit": 50}),
        "retainpdf-agent translation issues --pages 3-5 --severity major --limit 20": (
            "translation.issues",
            {"pages": (3, 5), "min_severity": "major", "limit": 20},
        ),
        "retainpdf-agent translation show --item-id p003-b004": ("translation.show", {"item_id": "p003-b004"}),
        'retainpdf-agent translation revise --item-id p003-b004 --text "其中 $k$ 为劲度系数" --reason "术语统一"': (
            "translation.revise",
            {"item_id": "p003-b004", "text": "其中 $k$ 为劲度系数", "reason": "术语统一"},
        ),
        "retainpdf-agent translation refine --pages 7": ("translation.refine", {"pages": (7, 7), "review_only": False}),
        "retainpdf-agent translation refine --review-only": ("translation.refine", {"pages": None, "review_only": True}),
        "retainpdf-agent translation rerender": ("translation.rerender", {}),
        'retainpdf-agent translation term-set --source "force constant" --target "劲度系数"': (
            "translation.term-set",
            {"source": "force constant", "target": "劲度系数"},
        ),
    }
    for command, (action, params) in cases.items():
        parsed = _parse(command, green_light=True)
        assert parsed.action == action, command
        assert parsed.cli_argv == ()
        assert parsed.request_payload == {"job_id": JOB, **params}, command


@pytest.mark.parametrize(
    "command",
    [
        "retainpdf-agent translation",
        "retainpdf-agent translation delete",
        "retainpdf-agent translation show",
        "retainpdf-agent translation show --item-id ../p1",
        "retainpdf-agent translation show --item-id p1 --item-id p2",
        "retainpdf-agent translation show p003-b004",
        "retainpdf-agent translation issues --pages 0",
        "retainpdf-agent translation issues --pages 5-3",
        "retainpdf-agent translation issues --pages 3,5",
        "retainpdf-agent translation issues --severity high",
        "retainpdf-agent translation issues --limit 0",
        "retainpdf-agent translation issues --pages",
        'retainpdf-agent translation revise --item-id p1 --text "x"',
        'retainpdf-agent translation revise --item-id p1 --text "x" --reason " "',
        'retainpdf-agent translation revise --item-id p1 --text " " --reason "r"',
        "retainpdf-agent translation rerender --pages 3",
        'retainpdf-agent translation term-set --source "" --target "y"',
    ],
)
def test_malformed_commands_are_usage_errors(command):
    with pytest.raises(BrokerUsageError):
        _parse(command, green_light=True)


@pytest.mark.parametrize(
    "command",
    [
        "retainpdf-agent translation issues; cat /etc/passwd",
        "retainpdf-agent translation issues | head",
        "retainpdf-agent translation show --item-id $(whoami)",
        "retainpdf-agent translation issues > out.json",
    ],
)
def test_shell_syntax_never_reaches_the_host(command):
    with pytest.raises(ValueError):
        _parse(command, green_light=True)


def test_translation_commands_need_a_book_scope():
    with pytest.raises(BrokerUsageError, match="单本书"):
        _parse("retainpdf-agent translation issues", job_id="")
    with pytest.raises(BrokerUsageError):
        _parse("retainpdf-agent translation issues", job_id="../../etc")


def test_existing_grammar_is_untouched():
    parsed = parse_broker_argv(
        ("retainpdf-agent", "operation", "get", "--operation-id", "op-1"), _scope()
    )
    assert parsed.action == "operation.get"


# ------------------------------------------------------------------ 授权


@pytest.mark.parametrize(
    "command",
    [
        'retainpdf-agent translation revise --item-id p1 --text "新" --reason "r"',
        "retainpdf-agent translation refine --pages 3-5",
        "retainpdf-agent translation rerender",
        'retainpdf-agent translation term-set --source "a" --target "b"',
    ],
)
def test_effectful_commands_are_refused_without_confirmation(command):
    with pytest.raises(BrokerUsageError, match="授权") as excinfo:
        _parse(command)
    # 拒绝理由要能让 agent 照着做：告诉用户去哪开，而不是换法子重试。
    assert "绿灯" in str(excinfo.value)
    assert _parse(command, green_light=True).action.startswith("translation.")
    assert _parse(command, confirmed=True).action.startswith("translation.")


def test_read_commands_need_no_confirmation():
    assert _parse("retainpdf-agent translation issues").action == "translation.issues"
    assert _parse("retainpdf-agent translation show --item-id p1").action == "translation.show"


# ------------------------------------------------------------------ 请求构造


class FakeCli:
    """记录每次 CLI 调用；按 argv 前两段返回预设结果。"""

    def __init__(self, responses: dict[tuple[str, ...], CliResult] | None = None) -> None:
        self.calls: list[tuple[str, tuple[str, ...], dict | None]] = []
        self.responses = responses or {}

    def __call__(self, action, argv, body):
        self.calls.append((action, argv, body))
        for key in (tuple(argv), tuple(argv[:2])):
            if key in self.responses:
                return self.responses[key]
        return CliResult(False, 404, {"code": 404, "message": "not found"}, "not found")


def _ok(data: Any) -> CliResult:
    return CliResult(True, 200, {"code": 0, "message": "ok", "data": data})


def _run(fake: FakeCli, command: str, *, job_dir: Path | None = None) -> dict:
    runner = TranslationCommandRunner(job_id=JOB, job_dir=job_dir, call=fake)
    return runner.run(_parse(command, green_light=True))


def _stdout(response: dict) -> dict:
    assert response["exit_code"] == 0, response["stderr"]
    return json.loads(response["stdout"])


QA_REPORT = {
    "schema": "translation_qa.v1",
    "violations": [
        {
            "id": "qa-00001",
            "check": "omission",
            "type": "sentence_missing",
            "severity": "critical",
            "scope": "item",
            "message": "整句漏译",
            "location": {"item_id": "p043-b006", "item_ids": ["p043-b006"], "unit_id": "u", "page_number": 43, "block_idx": 6},
            "evidence": {"source": "x" * 1000},
        },
        {
            "id": "qa-00002",
            "check": "punctuation",
            "type": "halfwidth",
            "severity": "minor",
            "scope": "item",
            "message": "半角标点",
            "location": {"item_id": "p003-b004", "item_ids": [], "unit_id": "", "page_number": 3, "block_idx": 4},
            "evidence": {},
        },
        {
            "id": "qa-00003",
            "check": "terms",
            "type": "locked_term_mismatch",
            "severity": "major",
            "scope": "document",
            "message": "术语不一致",
            "location": {"item_id": "", "item_ids": [], "unit_id": "", "page_number": 0, "block_idx": 0},
            "evidence": {},
        },
    ],
}

REFINE_REPORT = {
    "schema": "refine_report_v1",
    "mode": "review_and_fix",
    "trigger": "manual",
    "scope": {"start_page": 3, "end_page": 5},
    "stopped_reason": None,
    "review": {
        "findings": [
            {
                "item_id": "p004-b001",
                "page_number": 4,
                "category": "number_unit",
                "severity": "major",
                "target_span": "5 毫米",
                "source_span": "5 cm",
                "explanation": "单位错",
                "suggestion": "5 厘米",
                "origin": "review",
            },
            {"item_id": "p043-b006", "page_number": 43, "category": "omission", "severity": "critical", "origin": "qa"},
        ]
    },
    "fixes": [
        {"item_id": "p004-b001", "status": "rejected", "reject_reason": "qa_regression", "revision_id": ""},
    ],
}


def test_issues_reads_both_reports_and_merges_without_duplicates():
    fake = FakeCli(
        {
            ("translation", "qa"): _ok({"job_id": JOB, "report": QA_REPORT}),
            ("translation", "refine-report"): _ok({"job_id": JOB, "report": REFINE_REPORT}),
        }
    )
    payload = _stdout(_run(fake, "retainpdf-agent translation issues"))
    assert fake.calls == [
        ("translation.read", ("translation", "qa", "--job-id", JOB), None),
        ("translation.read", ("translation", "refine-report", "--job-id", JOB), None),
    ]
    assert payload["sources"] == {"translation_qa": "ok", "refine_report": "ok"}
    ids = [(issue["origin"], issue["item_id"]) for issue in payload["issues"]]
    # QA 已经列过的 p043-b006 不再从精修报告里重复列。
    assert ids.count(("qa", "p043-b006")) == 1
    assert ("refine_qa", "p043-b006") not in ids
    review = next(issue for issue in payload["issues"] if issue["origin"] == "refine_review")
    assert review["fix"] == {"status": "rejected", "reject_reason": "qa_regression", "revision_id": None}
    assert payload["refine"]["fixes_by_status"] == {"rejected": 1}
    assert payload["refine"]["rejected_by_reason"] == {"qa_regression": 1}
    # 证据被截短，输出要能直接读。
    omission = next(issue for issue in payload["issues"] if issue["item_id"] == "p043-b006")
    assert len(json.dumps(omission["evidence"], ensure_ascii=False)) < 400
    # 按页排序，没有页码的文档级问题排最后。
    pages = [issue["page"] for issue in payload["issues"]]
    assert pages == [3, 4, 43, None]


def test_issues_filters_by_pages_and_minimum_severity():
    fake = FakeCli(
        {
            ("translation", "qa"): _ok({"job_id": JOB, "report": QA_REPORT}),
            ("translation", "refine-report"): _ok({"job_id": JOB, "report": REFINE_REPORT}),
        }
    )
    payload = _stdout(_run(fake, "retainpdf-agent translation issues --pages 3-5 --severity major"))
    assert [issue["item_id"] for issue in payload["issues"]] == ["p004-b001"]
    assert payload["filter"] == {"pages": [3, 5], "min_severity": "major"}
    limited = _stdout(_run(fake, "retainpdf-agent translation issues --limit 1"))
    assert limited["total"] == 4 and limited["shown"] == 1 and "note" in limited


def test_issues_reports_missing_sources_instead_of_failing():
    payload = _stdout(_run(FakeCli(), "retainpdf-agent translation issues"))
    assert payload["sources"] == {"translation_qa": "missing", "refine_report": "missing"}
    assert payload["issues"] == []
    assert "refine --review-only" in payload["note"]


def test_qa_origin_findings_are_kept_when_the_qa_report_is_missing():
    fake = FakeCli({("translation", "refine-report"): _ok({"job_id": JOB, "report": REFINE_REPORT})})
    payload = _stdout(_run(fake, "retainpdf-agent translation issues"))
    assert ("refine_qa", "p043-b006") in [(i["origin"], i["item_id"]) for i in payload["issues"]]


def test_show_reads_the_item_and_its_history():
    item = {
        "item_id": "p003-b004",
        "source_text": "where $x$ is",
        "translated_text": "其中 x 为",
        "protected_translated_text": "其中 <f1-e32/> 为",
        "final_status": "translated",
        "block_type": "text",
        "math_mode": "placeholder",
        "translation_unit_id": "__cg__:p003",
    }
    revisions = [{"revision_id": f"rev-{i}", "source": "user", "reason": "r", "previous_text": "a", "new_text": "b", "ts": "t", "page_hashes": {}} for i in range(12)]
    fake = FakeCli(
        {
            ("translation", "item", "--job-id", JOB, "--item-id", "p003-b004"): _ok(
                {"job_id": JOB, "item_id": "p003-b004", "page_number": 3, "item": item}
            ),
            ("translation", "revisions", "--job-id", JOB, "--item-id", "p003-b004"): _ok(
                {"job_id": JOB, "item_id": "p003-b004", "revisions": revisions, "total": 12}
            ),
        }
    )
    payload = _stdout(_run(fake, "retainpdf-agent translation show --item-id p003-b004"))
    assert [call[0] for call in fake.calls] == ["translation.read", "translation.read"]
    assert payload["source_text"] == "where $x$ is"
    assert payload["protected_translated_text"] == "其中 <f1-e32/> 为"
    assert "note_group" in payload
    assert payload["revision_total"] == 12
    assert [rev["revision_id"] for rev in payload["revisions"]][-1] == "rev-11"
    assert len(payload["revisions"]) == 10
    assert "page_hashes" not in payload["revisions"][0]


def test_revise_patches_with_source_agent_and_no_rerender():
    fake = FakeCli(
        {
            ("translation", "revise"): _ok(
                {
                    "job_id": JOB,
                    "item_id": "p003-b004",
                    "changed": True,
                    "generation": 8,
                    "validation": {"passed": True, "error_count": 0, "warning_count": 0, "issues": []},
                    "revision": {"revision_id": "rev-" + "a" * 32},
                    "live_publication": {"status": "published", "pages": [], "error": None},
                    "rerender": None,
                    "rerender_error": None,
                }
            )
        }
    )
    payload = _stdout(
        _run(fake, 'retainpdf-agent translation revise --item-id p003-b004 --text "其中 $k$ 为劲度系数" --reason "术语统一"')
    )
    assert fake.calls == [
        (
            "translation.revise",
            ("translation", "revise", "--job-id", JOB, "--item-id", "p003-b004"),
            {"translated_text": "其中 $k$ 为劲度系数", "source": "agent", "reason": "术语统一", "rerender": False},
        )
    ]
    assert payload["revision_id"] == "rev-" + "a" * 32
    assert payload["live_publication"] == "published"
    assert "rerender" in payload["next"]


def test_revise_rejection_surfaces_the_validation_details():
    details = {"reason": "validation_failed", "validation": {"issues": [{"kind": "placeholder_inventory_mismatch"}]}}
    fake = FakeCli(
        {
            ("translation", "revise"): CliResult(
                False,
                422,
                {"code": "TRANSLATION_REVISION_REJECTED", "message": "rejected", "error": {"details": details}},
                "rejected",
            )
        }
    )
    response = _run(fake, 'retainpdf-agent translation revise --item-id p1 --text "x" --reason "r"')
    assert response["exit_code"] == 1
    error = json.loads(response["stderr"])
    assert "占位符" in error["error"]
    assert error["http_status"] == 422
    assert error["details"] == details


def test_refine_posts_an_in_place_retry_stage_with_page_range():
    submission = {"job_id": JOB, "status": "queued", "workflow": "render", "rerun_stages": ["refine", "render"], "reused_artifacts": []}
    fake = FakeCli({("translation", "retry-stage"): _ok(submission)})
    payload = _stdout(_run(fake, "retainpdf-agent translation refine --pages 3-5"))
    assert fake.calls == [
        (
            "translation.retry",
            ("translation", "retry-stage", "--job-id", JOB),
            {
                "stage": "refine",
                "create_new_job": False,
                "refine": {"mode": "review_and_fix", "start_page": 3, "end_page": 5},
            },
        )
    ]
    assert payload["status"] == "queued"
    _run(fake, "retainpdf-agent translation refine --review-only")
    assert fake.calls[-1][2] == {"stage": "refine", "create_new_job": False, "refine": {"mode": "review_only"}}


def test_rerender_is_an_in_place_render_retry():
    fake = FakeCli({("translation", "retry-stage"): _ok({"job_id": JOB, "status": "queued"})})
    _stdout(_run(fake, "retainpdf-agent translation rerender"))
    assert fake.calls == [
        (
            "translation.retry",
            ("translation", "retry-stage", "--job-id", JOB),
            {"stage": "render", "create_new_job": False},
        )
    ]


def test_retry_conflict_says_the_job_is_running():
    fake = FakeCli({("translation", "retry-stage"): CliResult(False, 409, {"code": 409, "message": "running"}, "running")})
    response = _run(fake, "retainpdf-agent translation rerender")
    assert response["exit_code"] == 1
    assert "正在运行" in json.loads(response["stderr"])["error"]


def _job_dir(tmp_path: Path, *, glossary_id: str = "") -> Path:
    job_dir = tmp_path / "jobs" / JOB
    translated = job_dir / "translated"
    translated.mkdir(parents=True)
    pages = [
        [
            {"item_id": "p001-b001", "page_idx": 0, "source_text": "The Force Constant k is large.", "translated_text": "力常数 k 很大。"},
            {"item_id": "p001-b002", "page_idx": 0, "source_text": "force constant again", "translated_text": "又是劲度系数"},
            {"item_id": "p001-b003", "page_idx": 0, "source_text": "forceconstantly", "translated_text": "无关"},
            {"item_id": "p001-b004", "page_idx": 0, "source_text": "force constant", "translated_text": "", "should_translate": False},
        ],
        [
            {"item_id": "p002-b001", "page_idx": 1, "source_text": "unrelated", "translated_text": "无关"},
            {"item_id": "p002-b002", "page_idx": 1, "source_text": "with a force constant of 5 N/m", "translated_text": "力常数为 5 N/m"},
        ],
    ]
    for index, items in enumerate(pages, start=1):
        (translated / f"page-{index:03d}-deepseek.json").write_text(json.dumps(items), encoding="utf-8")
    manifest = {
        "pages": [{"page_index": i, "page_number": i + 1, "path": f"page-{i + 1:03d}-deepseek.json"} for i in range(2)],
        "glossary": {"glossary_id": glossary_id} if glossary_id else {},
    }
    (translated / "translation-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return job_dir


def test_term_set_updates_the_job_glossary_and_lists_affected_blocks(tmp_path):
    job_dir = _job_dir(tmp_path, glossary_id="glossary-1")
    detail = {
        "glossary_id": "glossary-1",
        "name": "力学",
        "description": "d",
        "source_lang": "en",
        "target_lang": "zh",
        "enabled": True,
        "entry_count": 2,
        "entries": [
            {"source": "Force Constant", "target": "力常数", "note": "旧", "level": "preferred", "match_mode": "exact", "context": ""},
            {"source": "mass", "target": "质量", "note": "", "level": "canonical", "match_mode": "exact", "context": ""},
        ],
        "created_at": "x",
        "updated_at": "y",
    }
    fake = FakeCli(
        {
            ("glossary", "get", "--glossary-id", "glossary-1"): _ok(detail),
            ("glossary", "update"): _ok({**detail, "entry_count": 2}),
        }
    )
    payload = _stdout(
        _run(fake, 'retainpdf-agent translation term-set --source "force constant" --target "劲度系数"', job_dir=job_dir)
    )
    assert [call[0] for call in fake.calls] == ["glossary.read", "glossary.write"]
    action, argv, body = fake.calls[1]
    assert argv == ("glossary", "update", "--glossary-id", "glossary-1")
    assert body["name"] == "力学" and body["source_lang"] == "en"
    assert body["entries"][0] == {
        "source": "force constant",
        "target": "劲度系数",
        "note": "旧",
        "level": "canonical",
        "match_mode": "exact",
        "context": "",
    }
    assert body["entries"][1]["source"] == "mass"
    assert set(body) == {"name", "description", "source_lang", "target_lang", "enabled", "entries"}
    assert payload["glossary"]["previous_target"] == "力常数"
    assert payload["glossary"]["created"] is False
    # 原文有这个词、译文没用新译法：p001-b001 和 p002-b002。词边界外的、不翻译的块不算。
    assert [block["item_id"] for block in payload["affected"]] == ["p001-b001", "p002-b002"]
    assert payload["affected"][1]["page"] == 2
    assert payload["scan"] == {
        "blocks_containing_source": 3,
        "already_using_target": 1,
        "affected": 2,
        "pages_scanned": 2,
    }
    assert "没有" in payload["next"]


def test_term_set_creates_a_book_glossary_when_the_job_has_none(tmp_path):
    job_dir = _job_dir(tmp_path)
    fake = FakeCli(
        {
            ("glossary", "list"): _ok({"items": [{"glossary_id": "g-other", "name": "别的"}]}),
            ("glossary", "create"): _ok({"glossary_id": "glossary-new", "name": f"本书术语 {JOB}"}),
        }
    )
    payload = _stdout(
        _run(fake, 'retainpdf-agent translation term-set --source "force constant" --target "劲度系数"', job_dir=job_dir)
    )
    assert [(call[0], call[1]) for call in fake.calls] == [
        ("glossary.read", ("glossary", "list")),
        ("glossary.write", ("glossary", "create")),
    ]
    body = fake.calls[1][2]
    assert body["name"] == f"本书术语 {JOB}"
    assert body["entries"] == [
        {
            "source": "force constant",
            "target": "劲度系数",
            "note": "终端 agent 用 term-set 写入",
            "level": "canonical",
            "match_mode": "case_insensitive",
            "context": "",
        }
    ]
    assert payload["glossary"]["created"] is True
    assert payload["glossary"]["glossary_id"] == "glossary-new"


def test_term_set_reuses_the_book_glossary_created_earlier(tmp_path):
    job_dir = _job_dir(tmp_path)
    existing = {"glossary_id": "glossary-book", "name": f"本书术语 {JOB}", "enabled": True, "entries": []}
    fake = FakeCli(
        {
            ("glossary", "list"): _ok({"items": [{"glossary_id": "glossary-book", "name": f"本书术语 {JOB}"}]}),
            ("glossary", "get", "--glossary-id", "glossary-book"): _ok(existing),
            ("glossary", "update"): _ok(existing),
        }
    )
    _stdout(_run(fake, 'retainpdf-agent translation term-set --source "mass" --target "质量"', job_dir=job_dir))
    assert fake.calls[-1][1] == ("glossary", "update", "--glossary-id", "glossary-book")


def test_term_set_stops_when_the_glossary_write_fails(tmp_path):
    job_dir = _job_dir(tmp_path)
    fake = FakeCli(
        {
            ("glossary", "list"): _ok({"items": []}),
            ("glossary", "create"): CliResult(False, 400, {"code": 400, "message": "bad"}, "bad"),
        }
    )
    response = _run(fake, 'retainpdf-agent translation term-set --source "a" --target "b"', job_dir=job_dir)
    assert response["exit_code"] == 1
    assert "术语表" in json.loads(response["stderr"])["error"]


def test_rust_client_requests_a_job_scoped_capability_without_document_scope():
    import httpx

    from retainpdf_ai.config import Settings
    from retainpdf_ai.rust_client import RustApiClient

    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"code": 0, "message": "ok", "data": {"capability": "c"}})

    client = RustApiClient(Settings(), client=httpx.Client(transport=httpx.MockTransport(handler)))
    client.issue_agent_capability(
        conversation_id="", document_id="", actions=["translation.read"], ttl_seconds=60, job_id=JOB
    )
    client.issue_agent_capability(
        conversation_id="conv-a", document_id="doc-a", actions=["document.inspect"], ttl_seconds=60
    )
    assert seen[0] == {
        "schema": "agent_capability_issue_v1",
        "job_id": JOB,
        "actions": ["translation.read"],
        "ttl_seconds": 60,
    }
    # 老路径的请求体一个字节都不变。
    assert seen[1] == {
        "schema": "agent_capability_issue_v1",
        "conversation_id": "conv-a",
        "document_id": "doc-a",
        "actions": ["document.inspect"],
        "ttl_seconds": 60,
    }
