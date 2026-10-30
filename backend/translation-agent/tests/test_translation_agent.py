"""翻译 agent 包：校验、一页翻译、接续组断点、漏交重翻、按重排要求改稿、缓存。全部用假模型，不发网络请求。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from retainpdf_translation_agent import BREAK
from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import RevisionRequest
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent import check_block
from retainpdf_translation_agent import check_group


def _page() -> PageInput:
    group = lambda i: {"id": "cg-a", "index": i, "of": 2}  # noqa: E731
    return PageInput(
        page_label="1",
        document={"title": "T", "source_lang": "en", "target_lang": "zh-CN"},
        blocks=[
            BlockInput("h", "running_header", "Journal 3 (2026)", False, where="第 1 页，通栏上部"),
            BlockInput("t", "section_heading", "1 Introduction", True, where="第 1 页，左栏上部"),
            BlockInput("a1", "paragraph", "We score boxes with $F_1$ and the", True, group=group(1)),
            BlockInput("cap", "figure_caption", "Figure 1: Recall [3].", True, relations={"caption_of": ["fig"]}),
            BlockInput("a2", "paragraph", "recall of every page.", True, group=group(2)),
        ],
    )


def _response(translations: dict[str, str]) -> dict:
    items = [{"id": k, "translation": v} for k, v in translations.items()]
    return {"content": [{"type": "tool_use", "name": "submit_translations", "input": {"translations": items}}], "usage": {"input_tokens": 10, "output_tokens": 5}}


class Scripted:
    """按顺序回放事先写好的回答，并记下每次请求。"""

    def __init__(self, *answers: dict[str, str]) -> None:
        self.answers = list(answers)
        self.payloads: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.payloads.append(json.loads(body["messages"][0]["content"]))
        return _response(self.answers.pop(0))


def test_check_block_protects_formulas_marks_and_numbers() -> None:
    source = "We use $F_1$ and cite [3]{{fn:1}} on 2 pages."
    assert check_block(source, "我们在 2 页上使用 $F_1$ 并引用 [3]{{fn:1}}。") == []
    codes = {i["code"] for i in check_block(source, "我们使用 F1 并引用。")}
    assert {"formula_changed", "citation_lost", "footnote_mark_lost", "number_lost"} <= codes
    assert {i["code"] for i in check_block(source, source)} == {"untranslated"}
    assert check_block(source, None)[0]["code"] == "missing"
    # 短标题、写成中文数字都不算错
    assert check_block("Acknowledgements", "致谢") == []
    # 行内代码原样保留
    assert check_block("Run `tw backup --json` to start.", "运行 `tw backup --json` 开始备份。") == []
    assert [i["code"] for i in check_block("Run `tw backup --json` to start.", "运行 tw backup 开始备份。")] == ["code_changed"]
    assert check_block("a level-2 heading reported as level 1 is a role error", "二级标题被报告为一级，算作角色错误") == []


def test_check_group_flags_text_repeated_across_the_break() -> None:
    dup = "最后凡被栏或页分隔的段落都保留指针"
    issues = check_group([("a", "x" * 100, "前半段……" + dup), ("b", "y" * 30, dup)])
    assert all("group_overlap" in [i["code"] for i in issues[k]] for k in ("a", "b"))


def test_page_goes_out_once_with_groups_merged_and_comes_back_split() -> None:
    model = Scripted({"t": "1 引言", "cg-a": f"我们用 $F_1$ 和{BREAK}每一页的召回率给框打分。", "cap": "图 1：召回率 [3]。"})
    results, info = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert len(model.payloads) == 1
    sent = model.payloads[0]
    assert sent["required_ids"] == ["t", "cg-a", "cap"]
    merged = next(b for b in sent["blocks"] if b["id"] == "cg-a")
    assert merged["members"] == ["a1", "a2"] and merged["text"].count(BREAK) == 1
    assert next(b for b in sent["blocks"] if b["id"] == "h")["translate"] is False
    assert results["a1"].translation == "我们用 $F_1$ 和" and results["a2"].translation == "每一页的召回率给框打分。"
    assert all(r.status == "ok" for r in results.values()), {k: r.issues for k, r in results.items()}
    assert "h" not in results and info["extra_ids"] == []


def test_missing_blocks_are_retried_together_in_one_request() -> None:
    model = Scripted(
        {"cg-a": f"我们用 $F_1$ 和{BREAK}每一页的召回率给框打分。"},
        {"t": "1 引言", "cap": "图 1：召回率 [3]。"},
    )
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert len(model.payloads) == 2
    retry = model.payloads[1]
    assert sorted(r["id"] for r in retry["retry"]) == ["cap", "t"] and sorted(retry["required_ids"]) == ["cap", "t"]
    assert results["t"].attempts == 2 and results["t"].status == "ok" and results["t"].history[0]["issues"][0]["code"] == "missing"


def test_wrong_number_of_breaks_retries_the_whole_group() -> None:
    model = Scripted(
        {"t": "1 引言", "cg-a": "我们用 $F_1$ 给每一页的框打分。", "cap": "图 1：召回率 [3]。"},
        {"cg-a": f"我们用 $F_1$ 和{BREAK}每一页的召回率给框打分。"},
    )
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert model.payloads[1]["retry"][0]["id"] == "cg-a"
    assert results["a1"].status == "ok" and results["a2"].status == "ok" and results["a1"].attempts == 2


def test_revision_shortens_and_tries_again_when_still_too_long() -> None:
    model = Scripted({"cap": "图 1：三种服务在密集页面上的召回率 [3]。"}, {"cap": "图 1：召回率 [3]。"})
    agent = TranslationAgent(model="fake", transport=model)
    request = RevisionRequest("cap", "图 1：三种 OCR 服务在密集双栏页面上的块级召回率 [3]。", max_chars=12)
    results = agent.revise(_page(), [request])
    first, second = model.payloads
    assert first["revise"][0]["max_chars"] == 12 and first["required_ids"] == ["cap"]
    assert first["revise"][0]["current_chars"] == len(request.current_translation)
    assert first["revise"][0]["must_cut"] == len(request.current_translation) - 12
    assert second["revise"][0]["current_translation"] == "图 1：三种服务在密集页面上的召回率 [3]。", "round two starts from round one"
    assert second["revise"][0]["problems"], "the second round is told why the first one failed"
    result = results["cap"]
    assert result.translation == "图 1：召回率 [3]。" and result.status == "ok" and result.attempts == 2
    assert result.history[0]["translation"] == request.current_translation


def test_revision_that_cannot_reach_the_limit_returns_the_shortest_try_as_a_warning() -> None:
    """改稿不许删内容，缩不到是正常结果：取两次里最短的那版，超长只算警告，交给排版缩字号。"""
    model = Scripted({"cap": "图 1：三种服务在密集页面上的召回率 [3]。"}, {"cap": "图 1：三种服务在所有密集双栏页面上的召回率 [3]。"})
    request = RevisionRequest("cap", "图 1：三种 OCR 服务在密集双栏页面上的块级召回率 [3]。", max_chars=12)
    result = TranslationAgent(model="fake", transport=model).revise(_page(), [request])["cap"]
    assert result.translation == "图 1：三种服务在密集页面上的召回率 [3]。", "the shorter of the two tries wins"
    assert result.status == "warn" and [i["code"] for i in result.issues if i["severity"] == "warn"] == ["still_too_long"]


def test_revision_of_a_block_that_is_not_translated_is_rejected() -> None:
    with pytest.raises(ValueError):
        TranslationAgent(model="fake", transport=Scripted()).revise(_page(), [RevisionRequest("h", "x")])


def test_identical_requests_are_served_from_cache(tmp_path: Path) -> None:
    answer = {"t": "1 引言", "cg-a": f"我们用 $F_1$ 和{BREAK}每一页的召回率给框打分。", "cap": "图 1：召回率 [3]。"}
    first = Scripted(answer)
    TranslationAgent(model="fake", transport=first, cache_dir=tmp_path).translate_page(_page())
    second = Scripted()
    agent = TranslationAgent(model="fake", transport=second, cache_dir=tmp_path)
    results, _ = agent.translate_page(_page())
    assert second.payloads == [] and agent.usage.cached == 1 and results["t"].translation == "1 引言"


def test_package_only_imports_the_standard_library_and_itself() -> None:
    """这个包要能被翻译、重排、正式流程任何一边装上，所以不许依赖流水线、翻译包或第三方库。"""
    import ast
    import sys

    root = Path(__file__).resolve().parents[1] / "retainpdf_translation_agent"
    allowed = set(sys.stdlib_module_names) | {"retainpdf_translation_agent", "__future__"}
    offenders = []
    for path in root.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module] if isinstance(node, ast.ImportFrom) and node.module and not node.level else []
            offenders += [f"{path.name}: {n}" for n in names if n.split(".")[0] not in allowed]
    assert offenders == []


def test_requested_shortening_is_not_flagged_as_truncation() -> None:
    long_source = "Figure 1: Block-level recall of three OCR services on dense two-column pages, with the baseline dashed."
    page = PageInput(page_label="1", blocks=[BlockInput("cap", "figure_caption", long_source, True)])
    model = Scripted({"cap": "图 1：三种服务的召回率。"})
    result = TranslationAgent(model="fake", transport=model).revise(page, [RevisionRequest("cap", "很长的译文", max_chars=14)])["cap"]
    assert result.status == "ok" and result.attempts == 1, result.issues


def test_visible_length_counts_marks_and_formulas_as_displayed() -> None:
    from retainpdf_translation_agent import visible_length

    assert visible_length("阅读顺序{{fn:1}}。") == len("阅读顺序¹。")
    assert visible_length("边界框 $b_i$ 和") == len("边界框 x 和")  # b_i 三个字符按一半估
