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
from retainpdf_translation_agent.agent import format_answer
from retainpdf_translation_agent.agent import parse_answer
from retainpdf_translation_agent.agent import strict_tool
from retainpdf_translation_agent.reader import READER_TOOL
from retainpdf_translation_agent.review import REVIEW_TOOL


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
    return {"content": [{"type": "text", "text": format_answer(translations)}], "usage": {"input_tokens": 10, "output_tokens": 5}}


class Scripted:
    """按顺序回放事先写好的回答，并记下每次请求。"""

    def __init__(self, *answers: dict[str, str]) -> None:
        self.answers = list(answers)
        self.payloads: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.payloads.append(json.loads(body["messages"][0]["content"]))
        return _response(self.answers.pop(0))


def test_check_block_protects_marks_and_numbers() -> None:
    source = "We use $F_1$ and cite [3]{{fn:1}} on 2 pages."
    assert check_block(source, "我们在 2 页上使用 $F_1$ 并引用 [3]{{fn:1}}。") == []
    codes = {i["code"] for i in check_block(source, "我们使用 F1 并引用。")}
    assert codes == {"citation_lost", "footnote_mark_lost", "number_lost"}
    assert {i["code"] for i in check_block(source, source)} == {"untranslated"}
    assert check_block(source, None)[0]["code"] == "missing"
    # 短标题、写成中文数字都不算错
    assert check_block("Acknowledgements", "致谢") == []
    # 正文的 z、n/2 被套上公式符号，数数字时按普通文字算
    assert check_block("the z coordinate over the n/2 occupied orbitals", "对 $n/2$ 个占据轨道的 $ z $ 坐标") == []
    # 中文里夹着没翻的英文词
    assert [i["code"] for i in check_block("It was originally above a shop.", "它最初设在商铺楼上，originally设于南街。")] == ["stray_english"]
    # 中文紧挨着的数字也认得（"图1.1""第4章"）
    assert check_block("See Figure 1.1 and Chapter 4 for details.", "详见图1.1和第4章。") == []
    # `$` 提示符在行内代码里不算公式
    assert check_block("Commands start with a `$` prompt here.", "命令以 `$` 提示符开头。") == []
    # 行内代码原样保留
    assert check_block("Run `tw backup --json` to start.", "运行 `tw backup --json` 开始备份。") == []
    assert [i["code"] for i in check_block("Run `tw backup --json` to start.", "运行 tw backup 开始备份。")] == ["code_changed"]
    assert check_block("a level-2 heading reported as level 1 is a role error", "二级标题被报告为一级，算作角色错误") == []


def test_names_codes_and_urls_returned_as_is_are_not_untranslated() -> None:
    """原文没有要翻的英文词（图里的样品名、网址）：原样交回是对的。2026-10-31 ACS 论文这两块被判"没翻"、标成失败。"""
    labels = "PBS\nBMS202\nM1 EV\nBMS@M1 EV\nC-M1 EV\nBMS@C-M1 EV"
    assert check_block(labels, labels) == []
    assert check_block("https://pubs.acs.org/10.1021/acsnano.5c12218", "https://pubs.acs.org/10.1021/acsnano.5c12218") == []
    assert [i["code"] for i in check_block("Results and discussion", "Results and discussion")] == ["untranslated"]


def test_formulas_are_not_compared_with_the_source() -> None:
    """2026-10-31 用户定：公式不判对错。论文第 12、13 页跨页那段，模型两次都把 "$ n_{\\mathrm{L}}^{\\mathrm{max}} $" 写成 "n_L^max"，
    以前判 formula_changed、两半都退回原文没翻。现在公式写成普通文字、改了、多了、少了都不算错，只查 `$` 成对。"""
    source = "Varying $ n_{\\mathrm{L}}^{\\mathrm{max}} $ and $ \\delta F_{\\mathrm{D}} $ may enhance the efficiency."
    assert check_block(source, "改变 n_L^max 和 δF_D 或许可以提高效率。") == []
    assert check_block("The value $ a $ here.", "值 $ b $ 在此。") == []
    assert check_block("A budget $b$ of 0.002.", "预算 $b$ 和 $c$ 为 0.002。") == []
    assert [i["code"] for i in check_block("The value $ a $ here.", "值 $ a 在此。")] == ["formula_unbalanced"]


def test_words_in_a_script_the_source_does_not_have_are_errors() -> None:
    """论文实跑：译文里冒出一个俄文词。原文本来就有的（希腊字母、引用的俄文）不算；公式里的不算。"""
    codes = lambda src, out: {i["code"] for i in check_block(src, out)}  # noqa: E731
    assert "foreign_script" in codes("The step should be parallel to the path.", "优化步长 должна 大致平行于路径。")
    assert "foreign_script" not in codes("The alpha helix and the beta sheet.", "α 螺旋和 β 折叠。")
    assert "foreign_script" not in codes("The energy $\\alpha$ is low.", "能量 $\\alpha$ 很低。")
    assert "foreign_script" not in codes("As Landau wrote, «Теория поля».", "正如朗道所写，«Теория поля»。")


def test_a_group_is_checked_retried_and_falls_back_as_one_block() -> None:
    """接续组合成一块：按整段查，重翻时整段一条，还不合格就整组退回原文——不会一段话前半中文、后半英文。"""
    group = lambda i: {"id": "cg-c", "index": i, "of": 2}  # noqa: E731
    page = PageInput(
        page_label="1",
        blocks=[
            BlockInput("c1", "paragraph", "The ledger recorded every loan made by the library in that year and", True, group=group(1)),
            BlockInput("c2", "paragraph", "every fine that was paid for a late return [4].", True, group=group(2)),
        ],
    )
    model = Scripted({"cg-c": "账簿记下了图书馆那一年的每一笔借阅，以及每一笔逾期归还的罚金。"}, {"cg-c": "账簿记下了那一年的每一笔借阅和每一笔逾期罚金。"})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert [r["id"] for r in model.payloads[1]["retry"]] == ["cg-c"], "the retry asks for the whole paragraph again"
    assert results["c1"].status == results["c2"].status == "fallback_source"
    assert results["c1"].translation is None and results["c2"].translation is None
    assert results["c1"].meta["unit_id"] == "cg-c" and "citation_lost" in [i["code"] for i in results["c1"].issues]


def test_a_group_is_split_back_by_the_source_ratio_not_by_the_model() -> None:
    # 原文的断点在句子中间：前一块的框只有一行。模型只交一整段，程序按原文比例切，前一块只分到一行的量
    group = lambda i: {"id": "cg-r", "index": i, "of": 2}  # noqa: E731
    head = "One reason why such a method matters is that"
    tail = (
        "it can walk from a known minimum to nearby saddle points without guessing where the path ends, as a famous surface "
        "study showed when it found that atoms swap places instead of hopping between sites. Many reactions still have unknown "
        "mechanisms. A fair comparison of these methods is what this paper offers."
    )
    page = PageInput(page_label="1", blocks=[BlockInput("r1", "paragraph", head, True, group=group(1)), BlockInput("r2", "paragraph", tail, True, group=group(2))])
    whole = (
        "这类方法之所以重要，一个原因是它能从已知的极小点走到附近的鞍点、不必猜测路径的终点，一项著名的表面研究正是这样发现原子是互换位置而不是在位点间跳跃的。"
        "许多反应的机理仍不清楚。本文给出的正是这些方法的公平比较。"
    )
    model = Scripted({"cg-r": whole})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    first, second = results["r1"].translation, results["r2"].translation
    assert first + second == whole, "nothing is lost or duplicated"
    assert len(first) < len(whole) / 4, f"the one-line box gets about its share: {first}"
    assert results["r1"].status == results["r2"].status == "ok", {k: r.issues for k, r in results.items()}
    assert len(model.payloads) == 1


def test_the_program_never_cuts_inside_a_long_formula() -> None:
    from retainpdf_translation_agent.breaks import split_by_ratio

    formula = r"$ \Delta\mathbf{g}_{l+1}=\mathbf{g}(\mathbf{x}_{l+1})-\mathbf{g}(\mathbf{x}_{l}) $"
    text = f"一种由甲提出，另一种由乙提出。甲的更新为其中 {formula}，乙的更新为"
    for weights in ([50, 50], [30, 70], [70, 30]):
        first, second = split_by_ratio(text, weights)
        assert (first + second).replace(" ", "") == text.replace(" ", ""), "nothing is lost"
        assert first.count("$") % 2 == 0 and second.count("$") % 2 == 0, (weights, first, second)


def test_a_long_formula_near_the_split_point_stays_whole() -> None:
    # 后一块带一个长公式：按总字数算比例，切点会落进公式里；按正文算，公式整个留在一块
    group = lambda i: {"id": "cg-f", "index": i, "of": 2}  # noqa: E731
    formula = r"$ \Delta\mathbf{g}_{l+1}=\mathbf{g}(\mathbf{x}_{l+1})-\mathbf{g}(\mathbf{x}_{l}) $"
    page = PageInput(
        page_label="5",
        blocks=[
            BlockInput("f1", "paragraph", "one update is due to Smith and the other to Jones. The Smith update is given by", True, group=group(1)),
            BlockInput("f2", "paragraph", f"with {formula}, and the Jones update by", True, group=group(2)),
        ],
    )
    model = Scripted({"cg-f": f"一种更新由 Smith 提出，另一种由 Jones 提出。Smith 更新为其中 {formula}，Jones 更新为"})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert sum(formula in (results[k].translation or "") for k in ("f1", "f2")) == 1, {k: r.translation for k, r in results.items()}
    assert results["f1"].status != "fallback_source" and results["f2"].status != "fallback_source", {k: r.issues for k, r in results.items()}


def test_a_group_the_model_skipped_gets_one_more_retry() -> None:
    # 页末的组第一次被整个漏掉，重翻时又漏了一句（脚注标记跟着丢了）：第一次没交不算一次，再翻一次
    group = lambda i: {"id": "cg-m", "index": i, "of": 2}  # noqa: E731
    page = PageInput(
        page_label="5",
        blocks=[
            BlockInput("p", "paragraph", "A paragraph before the group that is answered.", True),
            BlockInput("m1", "paragraph", "one due to Smith{{fn:46}} and the other to Jones. The Smith update is", True, group=group(1)),
            BlockInput("m2", "paragraph", "given below, and so is the Jones update.", True, group=group(2)),
        ],
    )
    model = Scripted(
        {"p": "组前面的一段，交了。"},
        {"cg-m": "Smith 更新为如下所示，Jones 更新也是。"},
        {"cg-m": "一种由 Smith 提出{{fn:46}}，另一种由 Jones 提出。Smith 更新如下所示，Jones 更新也是。"},
    )
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert len(model.payloads) == 3
    assert model.payloads[1]["retry"][0]["previous_translation"] is None, "nothing was answered, so there is no previous translation"
    assert results["m1"].status != "fallback_source" and "{{fn:46}}" in results["m1"].translation
    assert results["m1"].attempts == 3


def test_a_short_half_is_not_called_truncated_when_the_group_is_whole() -> None:
    # 前一块原文只有半句：切出来很短。整段查不短，切开以后不再逐块查"太短"（以前要靠补丁降成警告）
    group = lambda i: {"id": "cg-s", "index": i, "of": 2}  # noqa: E731
    page = PageInput(
        page_label="1",
        blocks=[
            BlockInput("s1", "paragraph", "For the small system there is little difference", True, group=group(1)),
            BlockInput("s2", "paragraph", "between the two update schemes, but larger systems clearly favour the first one by a wide margin in every test we ran.", True, group=group(2)),
        ],
    )
    model = Scripted({"cg-s": "对于小体系，两种更新格式之间差别不大，但体系越大，第一种的优势越明显，在我们做的每一项测试里都大幅领先。"})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert len(model.payloads) == 1
    assert results["s1"].status == "ok" and results["s1"].translation


def test_page_goes_out_once_with_groups_merged_and_comes_back_split() -> None:
    model = Scripted({"t": "1 引言", "cg-a": "我们用 $F_1$ 和每一页的召回率给框打分。", "cap": "图 1：召回率 [3]。"})
    results, info = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert len(model.payloads) == 1
    sent = model.payloads[0]
    assert sent["required_ids"] == ["t", "cg-a", "cap"]
    merged = next(b for b in sent["blocks"] if b["id"] == "cg-a")
    assert merged["members"] == ["a1", "a2"] and merged["text"] == "We score boxes with $F_1$ and the recall of every page."
    assert BREAK not in json.dumps(sent, ensure_ascii=False), "the model is not asked to place breaks"
    assert next(b for b in sent["blocks"] if b["id"] == "h")["translate"] is False
    assert results["a1"].translation + results["a2"].translation == "我们用 $F_1$ 和每一页的召回率给框打分。"
    assert results["a1"].translation and results["a2"].translation
    assert "h" not in results and info["extra_ids"] == []


def test_missing_blocks_are_retried_together_in_one_request() -> None:
    model = Scripted(
        {"cg-a": "我们用 $F_1$ 和每一页的召回率给框打分。"},
        {"t": "1 引言", "cap": "图 1：召回率 [3]。"},
    )
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert len(model.payloads) == 2
    retry = model.payloads[1]
    assert sorted(r["id"] for r in retry["retry"]) == ["cap", "t"] and sorted(retry["required_ids"]) == ["cap", "t"]
    assert results["t"].attempts == 2 and results["t"].status == "ok" and results["t"].history[0]["issues"][0]["code"] == "missing"


def test_the_translator_answers_in_plain_text_and_other_roles_use_strict_tools() -> None:
    """初译不用工具、交回纯文本（2026-10-31 用户定：公式里的反斜杠在 JSON 里要写两个）；通读、审校照旧用 strict 工具。"""
    bodies: list[dict] = []

    def model(body: dict) -> dict:
        bodies.append(body)
        return _response({"t": "1 引言", "cap": "图 1：召回率 [3]。", "cg-a": "我们用 $F_1$ 和每一页的召回率给框打分。"})

    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert "tools" not in bodies[0] and "tool_choice" not in bodies[0] and "@@" in bodies[0]["system"]
    assert results["t"].translation == "1 引言" and results["cap"].status == "ok"

    def objects(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                yield node
            for value in node.values():
                yield from objects(value)
        elif isinstance(node, list):
            for value in node:
                yield from objects(value)

    for tool in (REVIEW_TOOL, READER_TOOL):
        found = list(objects(strict_tool(tool)["input_schema"]))
        assert found and all(o["additionalProperties"] is False for o in found)


def test_the_plain_text_answer_format_round_trips_and_tolerates_noise() -> None:
    """交卷格式：`@@ 块号` 一节一块；术语、例外、备注各一节。模型先说一句话、包上代码块、标题行尾多写 @@ 都照样认。"""
    terms = [{"block_id": "b1", "source": "finite difference", "target": "有限差分", "category": "term"}, {"block_id": "b1", "source": "Lanczos", "target": "Lanczos", "category": "keep"}]
    exceptions = [{"block_id": "b2", "source": "force", "used": "力量", "reason": "这里是比喻"}]
    text = format_answer({"b1": "公式 $ \\delta F_{\\mathrm{D}} $ 照抄。\n第二行。", "__cg__:g1": "一整段。"}, terms=terms, exceptions=exceptions, notes="拿不准")
    parsed = parse_answer(text)
    assert parsed["translations"] == {"b1": "公式 $ \\delta F_{\\mathrm{D}} $ 照抄。\n第二行。", "__cg__:g1": "一整段。"}
    assert parsed["terms"] == terms and parsed["term_exceptions"] == exceptions and parsed["notes"] == "拿不准"
    noisy = parse_answer("好的，译文如下：\n```\n@@ b1 @@\n一。\n\n@@ b1\n二。\n```\n")
    assert noisy["translations"] == {"b1": "二。"} and noisy["duplicates"] == ["b1"]
    assert parse_answer("@@ b1\n一。\n\n@@ b2\n写到一半", truncated=True)["translations"] == {"b1": "一。"}, "a cut-off last block counts as missing"


def test_doubled_backslashes_copied_from_the_json_request_are_collapsed() -> None:
    """请求是 JSON，原文的 "\\delta" 在里面写成 "\\\\delta"；模型照抄成两个反斜杠的，程序并成一个（原文没有连着两个反斜杠时）。"""
    page = PageInput(page_label="1", blocks=[BlockInput("f", "paragraph", "the force $ \\delta F_{\\mathrm{D}} $ is small for every dimer here", True)])
    answer = {"f": "对这里的每个二聚体，力 $ \\\\delta F_{\\\\mathrm{D}} $ 都很小"}
    results, _ = TranslationAgent(model="fake", transport=Scripted(answer)).translate_page(page)
    assert results["f"].translation == "对这里的每个二聚体，力 $ \\delta F_{\\mathrm{D}} $ 都很小" and results["f"].status == "ok"


def test_an_answer_in_the_wrong_format_counts_as_missing_and_is_retried() -> None:
    """模型没按格式交（一个 `@@` 都没有）：整页当没交，单块合成一次、接续组一次重翻。"""
    answers = [
        {"content": [{"type": "text", "text": "1 引言\n图 1：召回率 [3]。"}], "usage": {}},
        _response({"t": "1 引言", "cap": "图 1：召回率 [3]。"}),
        _response({"cg-a": "我们用 $F_1$ 和每一页的召回率给框打分。"}),
    ]
    results, _ = TranslationAgent(model="fake", transport=lambda body: answers.pop(0)).translate_page(_page())
    assert results["t"].translation == "1 引言" and results["t"].attempts == 2
    assert results["a1"].status != "fallback_source"


def test_a_footnote_mark_moved_across_the_break_is_fine() -> None:
    """中文语序把脚注标记挪到了切点另一边：整段查标记还在，切开以后不再逐块查，不算问题。"""
    group = lambda i: {"id": "cg-m", "index": i, "of": 2}  # noqa: E731
    page = PageInput(
        page_label="1",
        blocks=[
            BlockInput("m1", "paragraph", "She borrowed the first of the eight parts in which", True, group=group(1)),
            BlockInput("m2", "paragraph", "Middlemarch{{fn:25}} had begun to appear that month.", True, group=group(2)),
        ],
    )
    model = Scripted({"cg-m": "她借了《米德尔马契》{{fn:25}}当月开始分册出版的八册中的第一册。"})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert len(model.payloads) == 1
    assert results["m1"].status == results["m2"].status == "ok", (results["m1"].issues, results["m2"].issues)


def test_breaks_the_model_still_writes_are_ignored() -> None:
    # 模型照老习惯写了 [[BREAK]]（还写多了）：删掉，按比例切，不重翻
    model = Scripted({"t": "1 引言", "cg-a": f"我们用{BREAK} $F_1$ 给{BREAK}每一页的框打分。", "cap": "图 1：召回率 [3]。"})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert len(model.payloads) == 1
    assert BREAK not in results["a1"].translation + results["a2"].translation
    assert results["a1"].translation and results["a2"].translation


def test_the_program_splits_at_punctuation() -> None:
    model = Scripted({"t": "1 引言", "cg-a": "我们用 $F_1$ 给框打分，并统计每一页的召回率。", "cap": "图 1：召回率 [3]。"})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_page())
    assert len(model.payloads) == 1
    assert results["a1"].translation == "我们用 $F_1$ 给框打分，" and results["a2"].translation == "并统计每一页的召回率。"


def test_a_slightly_changed_formula_is_restored_to_the_source() -> None:
    """模型顺手"修"了 OCR 认错的公式符号：程序换回原文写法，记一笔 info（公式不判对错，不算警告）。"""
    from retainpdf_translation_agent.checks import restore_formulas

    fixed, restored = restore_formulas("so $ S'_{rs}'=\\delta_{rs} $ holds", "所以 $S'_{rs}=\\delta_{rs}$ 成立")
    assert fixed == "所以 $ S'_{rs}'=\\delta_{rs} $ 成立" and restored == ["$ S'_{rs}'=\\delta_{rs} $"]
    assert restore_formulas("value $ a+b $", "值 $x^2$")[1] == [], "a really different formula is not swapped"
    page = PageInput(page_label="1", blocks=[BlockInput("f", "paragraph", "so $ S'_{rs}'=\\delta_{rs} $ holds for every pair of orbitals here", True)])
    results, _ = TranslationAgent(model="fake", transport=Scripted({"f": "所以对这里的每一对轨道 $S'_{rs}=\\delta_{rs}$ 都成立"})).translate_page(page)
    assert results["f"].status == "ok" and results["f"].issues[0] == dict(results["f"].issues[0], code="formula_restored", severity="info")
    assert "$ S'_{rs}'=\\delta_{rs} $" in results["f"].translation


def test_a_citation_after_a_full_stop_stays_with_its_sentence() -> None:
    """引用角标在句号后面（ACS 体例）：切在角标后面，不因为句号后面紧跟角标就跳到下一个句号。"""
    from retainpdf_translation_agent.breaks import split_by_ratio

    text = "甲乙丙丁戊己庚辛壬癸。{{fn:28-32}} 子丑寅卯辰巳午未申酉。$ ^{26,27} $ 天地玄黄宇宙洪荒日月盈昃。"
    assert split_by_ratio(text, [10, 23]) == ["甲乙丙丁戊己庚辛壬癸。{{fn:28-32}}", "子丑寅卯辰巳午未申酉。$ ^{26,27} $ 天地玄黄宇宙洪荒日月盈昃。"]
    assert split_by_ratio(text, [20, 13])[0].endswith("。$ ^{26,27} $")


def test_split_by_ratio_never_cuts_formulas_marks_or_words() -> None:
    from retainpdf_translation_agent.breaks import move_leading_punctuation
    from retainpdf_translation_agent.breaks import split_by_ratio

    text = "设预算 $b_{max} = 0.01$ 与 Tidewater 一起使用{{fn:2}}即可"
    for ratio in ([10, 10], [3, 10], [12, 3], [1, 1, 1]):
        parts = split_by_ratio(text, ratio)
        assert len(parts) == len(ratio) and "".join(parts).replace(" ", "") == text.replace(" ", "")
        for part in parts:
            assert part.count("$") % 2 == 0 and part.count("{{") == part.count("}}"), parts
            assert not part.startswith(("{{fn", "idewater", "ater", "max")), parts
    assert move_leading_punctuation(["第一段", "。第二段", "，第三段"]) == ["第一段。", "第二段，", "第三段"]


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
    answer = {"t": "1 引言", "cg-a": "我们用 $F_1$ 和每一页的召回率给框打分。", "cap": "图 1：召回率 [3]。"}
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


def _dipole_page() -> PageInput:
    """2026-10-30 量子化学-14 p003-b022 / p004-b004：一段话被独立公式隔开，两半连成接续组。"""
    group = lambda i: {"id": "cg-d", "index": i, "of": 2}  # noqa: E731
    return PageInput(
        page_label="3",
        blocks=[
            BlockInput("d1", "paragraph", "The electric dipole moment is a vector whose $ x $ component is", True, group=group(1)),
            BlockInput("eq", "display_formula", DIPOLE_FORMULA, False),
            BlockInput(
                "d2",
                "paragraph",
                "with similar expressions for the other components. For a continuous charge distribution the moment is a sum over charge elements.",
                True,
                group=group(2),
                formula_before=DIPOLE_FORMULA,
            ),
        ],
    )


DIPOLE_FORMULA = r"$$ \mu_{x,\mathrm{cl}}=\sum_{i}Q_{i}x_{i} $$"


def test_a_formula_between_group_halves_is_sent_and_the_split_falls_on_it() -> None:
    """以前两半只用空格连，模型看不到公式，自己编一个写进正文；现在公式原文放在中间，切回时在公式处切开、公式删掉。"""
    whole = f"电偶极矩是一个矢量，其 $ x $ 分量为\n{DIPOLE_FORMULA}\n，其他分量的表达式类似。对于连续电荷分布，偶极矩是对各电荷元的求和。"
    model = Scripted({"cg-d": whole})
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(_dipole_page())
    merged = next(b for b in model.payloads[0]["blocks"] if b["id"] == "cg-d")
    assert merged["text"] == (
        "The electric dipole moment is a vector whose $ x $ component is\n"
        f"{DIPOLE_FORMULA}\n"
        "with similar expressions for the other components. For a continuous charge distribution the moment is a sum over charge elements."
    )
    assert results["d1"].translation == "电偶极矩是一个矢量，其 $ x $ 分量为"
    assert results["d2"].translation == "其他分量的表达式类似。对于连续电荷分布，偶极矩是对各电荷元的求和。"
    assert results["d1"].status == results["d2"].status == "ok", {k: r.issues for k, r in results.items()}


def test_a_dropped_formula_falls_back_to_the_ratio_split() -> None:
    whole = "电偶极矩是一个矢量，其 $ x $ 分量如上，其他分量的表达式类似。对于连续电荷分布，偶极矩是对各电荷元的求和。"
    results, _ = TranslationAgent(model="fake", transport=Scripted({"cg-d": whole})).translate_page(_dipole_page())
    assert results["d1"].translation + results["d2"].translation == whole
    assert results["d1"].translation and results["d2"].translation


def test_split_at_formulas_finds_a_respaced_formula_and_leaves_ungapped_members_to_the_ratio() -> None:
    from retainpdf_translation_agent.breaks import split_at_formulas

    text = r"甲乙丙。$$\mu_{x,\mathrm{cl}} = \sum_i Q_i x_i$$ 丁戊己，庚辛。"
    assert split_at_formulas(text, ["", DIPOLE_FORMULA]) == [("甲乙丙。", 0, 1), ("丁戊己，庚辛。", 1, 2)]
    assert split_at_formulas(text, ["", "", DIPOLE_FORMULA]) == [("甲乙丙。", 0, 2), ("丁戊己，庚辛。", 2, 3)]
    assert split_at_formulas(text, ["", ""]) is None
