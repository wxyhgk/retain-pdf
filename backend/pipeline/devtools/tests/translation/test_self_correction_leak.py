"""模型把「草稿 + Wait — … Correct it. + 改好的译文」一起交回来时，校验要拦下来重译。

两个正例都是真实输出（qwen3.8-flash 翻一本量子化学教材）。"""

import pytest

from retainpdf_translation.llm.result_validator import validate_batch_result
from retainpdf_translation.llm.validation.errors import TranslationProtocolError
from retainpdf_translation.llm.validation.self_correction import self_correction_leak
from retainpdf_translation.services.quality import review_translation_item

ALLENE_SOURCE = "FIGURE 12.16 Two views of allene. The C=C=C axis is perpendicular to the plane of the paper in (a)."
ALLENE_OUTPUT = (
    "图12.16 烯丙烷（allene）的两种视图。图(a)中 C=C=C 轴垂直于纸面。\n\n"
    'Wait—"allene" should not be translated as 烯丙烷; allene is 丙二烯. Correct it.\n\n'
    "图12.16 丙二烯（allene）的两种视图。图(a)中 $\\mathrm{C=C=C}$ 轴垂直于纸面。"
)
REPEAT_SOURCE = "Thus we have the following correspondence:"
REPEAT_OUTPUT = (
    "Thus we have the following correspondence:\n\n"
    "Wait — I need to correct my reply: the correct output is the translation, not the source repeated. \n\n"
    "因此我们有如下对应关系："
)


@pytest.mark.parametrize(
    ("source", "translated", "expected"),
    [
        (ALLENE_SOURCE, ALLENE_OUTPUT, "Wait—"),
        (REPEAT_SOURCE, REPEAT_OUTPUT, "Wait — I need to correct my reply"),
        ("The apparatus is shown below.", "装置如下图所示。\n\n等等，上面的译文有误，应改为：装置见下图。", "等等，上面的译文有误"),
        ("Allene is shown.", "图中是丙二烯。注意：allene 不应译为烯丙烷。", "不应译为烯丙烷"),
    ],
)
def test_self_correction_is_detected(source, translated, expected):
    assert expected in self_correction_leak(source, translated)


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        # 原文本身就有 Wait（对话、引文）：照译出来的不算
        ('"Wait — I need to correct my reply," she said.', '她说："Wait — I need to correct my reply."'),
        # 「等等」的正常用法
        ("Fruits such as apples, bananas, and so on.", "水果，如苹果、香蕉等等。"),
        ("Wait, he said, and listen.", "等等，他说，听我讲。"),
        # 正常的中文译文里提到「翻译」
        ("The paper was translated into Chinese.", "这篇论文被翻译成了中文。"),
        # 纯英文（没翻译）不归这里管，交给 english_residue
        ("Wait — correct it.", "Wait — correct it."),
    ],
)
def test_ordinary_translations_pass(source, translated):
    assert self_correction_leak(source, translated) == ""


def _caption_item(item_id: str, source: str) -> dict:
    return {
        "item_id": item_id,
        "block_type": "text",
        "metadata": {"structure_role": "caption"},
        "translation_unit_protected_source_text": source,
    }


def test_quality_review_flags_it_as_an_error():
    report = review_translation_item(
        _caption_item("p014-b008", ALLENE_SOURCE),
        {"decision": "translate", "translated_text": ALLENE_OUTPUT},
    )
    kinds = {(issue.kind, issue.severity) for issue in report.issues}
    assert ("self_correction_leak", "error") in kinds


def test_validation_raises_so_the_item_is_retranslated():
    item = _caption_item("p015-b022", REPEAT_SOURCE)
    with pytest.raises(TranslationProtocolError):
        validate_batch_result([item], {"p015-b022": {"decision": "translate", "translated_text": REPEAT_OUTPUT}})


# ---------------------------------------------------------------- 拆外壳 / 部分接受不能把自言自语收下

from retainpdf_translation.llm.shared.orchestration.direct_typst_salvage import (  # noqa: E402
    try_salvage_direct_typst_protocol_shell_error,
)
from retainpdf_translation.llm.validation.self_correction import text_after_self_correction  # noqa: E402

# 真实输出（续接段落，p005-b013）：先抄原文，再自言自语，最后才是译文。以前被「部分接受」整段收下。
ECHO_SOURCE = (
    "in adaptive mode, such that reactions are removed from further evaluation as soon as a TS is found and validated."
)
ECHO_OUTPUT = (
    ECHO_SOURCE
    + "\n\nWait — the instruction says output only the translation. Let me correct that.\n\n"
    + "以自适应模式运行，即一旦找到并验证过渡态，便将该反应移出后续评估。"
)


def test_text_after_self_correction():
    assert text_after_self_correction(ECHO_SOURCE, ECHO_OUTPUT) == "以自适应模式运行，即一旦找到并验证过渡态，便将该反应移出后续评估。"
    assert text_after_self_correction(ALLENE_SOURCE, ALLENE_OUTPUT).startswith("图12.16 丙二烯")
    assert text_after_self_correction("x", "正常译文。") == "正常译文。"
    assert text_after_self_correction("x", "草稿。\nWait — I need to correct my reply.") == ""


def _salvage(source: str, output: str):
    item = {
        "item_id": "p005-b013",
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": source,
    }
    exc = TranslationProtocolError("p005-b013", source_text=source, translated_text=output)
    return try_salvage_direct_typst_protocol_shell_error(
        item,
        exc=exc,
        context=None,
        diagnostics=None,
        route_path=["block_level", "direct_typst", "protocol_shell_unwrap"],
        output_mode_path=["plain_text"],
        allow_partial_accept=True,
    )


def test_salvage_keeps_only_the_corrected_translation():
    entry = _salvage(ECHO_SOURCE, ECHO_OUTPUT)["p005-b013"]
    assert entry["translated_text"] == "以自适应模式运行，即一旦找到并验证过渡态，便将该反应移出后续评估。"
    assert entry["translation_diagnostics"]["degradation_reason"] == "self_correction_salvaged"


def test_nothing_after_the_correction_means_retranslate_not_partial_accept():
    output = "这是一段足够长的中文草稿译文，汉字数量超过了部分接受的门槛。\n\nWait — I need to correct my reply."
    assert _salvage(ECHO_SOURCE, output) is None


# ---------------------------------------------------------------- 拿不准时的自问自答

# 真实输出（claude-haiku-5-5，没开思考，20261013090853-726861 p070-b014）：原文只是一个小标题，
# 模型把「要不要翻、怎么翻」的推敲整段写进了回答，最后一行才是它的决定。
NAK_SOURCE = "Nak Schedule 2"
NAK_OUTPUT = (
    'Translation: "Nak Schedule 2" as a heading. "Nak" is a term from PCI Express (NAK, negative acknowledgment). '
    'Keep "NAK" as-is? The source says "Nak Schedule 2" — keep original casing and proper naming, translate as a '
    'heading: "Nak 调度 2"? Better to keep "Nak Schedule 2" since it\'s an identifier-like heading; possibly '
    '"NAK 调度 2". I\'ll use "Nak Schedule 2" with the term preserved, which is conservative.\n\n'
    "Nak Schedule 2"
)


@pytest.mark.parametrize(
    "musing",
    [
        'Keep "NAK" as-is?',
        "The source says",
        'Better to keep "Nak Schedule 2"',
        "I'll use",
        "translate as a heading",
    ],
)
def test_deliberation_phrases_are_detected(musing):
    assert self_correction_leak("调度表", f"调度表 2。{musing} 调度表 2。")


def test_real_deliberation_is_detected_and_salvaged_to_the_final_line():
    assert self_correction_leak(NAK_SOURCE, NAK_OUTPUT)
    assert text_after_self_correction(NAK_SOURCE, NAK_OUTPUT) == "Nak Schedule 2"
    entry = _salvage(NAK_SOURCE, NAK_OUTPUT)["p005-b013"]
    # 模型最后的决定是保留原文：照它的决定保留，不把推敲过程排进 PDF。
    assert entry["decision"] == "keep_origin"
    assert entry["translation_diagnostics"]["degradation_reason"] == "self_correction_salvaged"


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        # 原文里本来就有这些话（引文、对话）：照译出来的不算
        ('"I\'ll use the red one," she said.', '她说："I\'ll use the red one."'),
        ("The source says nothing about it.", "来源（The source says nothing）对此只字未提。"),
        # 中文里的「保留」「采用」是正常译文
        ("We keep the notation as-is.", "我们保留原有记号不变。"),
    ],
)
def test_ordinary_text_with_similar_words_passes(source, translated):
    assert self_correction_leak(source, translated) == ""


# ---------------------------------------------------------------- 用中文讲自己怎么译

# 真实输出（claude-haiku-5-5，一本 OCR 很烂的俄文图纸，20261105025105-209e5c）
CIRCLED_SOURCE = "$\\textcircled{1}$ песок пылеваяный (м - мелкий, с - средней крупности)"
CIRCLED_OUTPUT = (
    "我需要处理这段：原文中的 $\\textcircled{1}$ 是圈号编号。按照提示，不用 \\textcircled，改用圈内字符本身，即 ①。"
    "原文是公式包裹的标号，我输出为 ①（不放进公式，因为它是纯编号符号）。\n\n"
    "① 砂，粉质（м — 细，с — 中等粒度）"
)
NUMBERED_SOURCE = (
    "1 За оптимальный объемку 0,000 приям уровень чистого пола цека Смана 5000,\n"
    "2 Двери поз. 2, 4, 8 промивопожарные, сертифцированные по пожарной"
)
NUMBERED_OUTPUT = (
    "1 За оптимальный объем... \n\n"
    "这段原文是OCR损坏严重的俄文工程说明，我需要按字面忠实翻译，并保留编号。\n\n"
    "1 按最优体积，0,000 处的净地面标高为 Смана 5000。\n"
    "2 门 поз. 2、4、8 为防火门，已按消防安全认证。"
)


@pytest.mark.parametrize(
    ("source", "translated", "expected"),
    [
        (CIRCLED_SOURCE, CIRCLED_OUTPUT, "我需要处理这段"),
        (NUMBERED_SOURCE, NUMBERED_OUTPUT, "这段原文是OCR损坏严重的俄文工程说明"),
        ("Список работ", "注意：按要求只译原文。正确译文如下：\n\n工作清单", "注意：按要求只译原文"),
        ("Экспликация помещений", "说明：这里的「Экспликация помещений」是建筑图纸中的标准栏目名，意为房间明细表。\n\n房间明细表", "说明：这里的"),
        ("set_context patterns -scan", "这是一条命令，按规则保留字面命令，不做翻译。", "这是一条命令"),
        ("Example 3", "的译文应为：\n\n示例 3", "的译文应为"),
        # 整行都是括号里的话：照样算
        ("пожарной", "（注：按要求，仅输出译文本身。）\n\n消防的", "（注：按要求"),
    ],
)
def test_chinese_meta_commentary_is_detected(source, translated, expected):
    assert expected in self_correction_leak(source, translated)


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        # 开头和自言自语一样，但只是正常译文
        ("Внимание! Согласно СП 14.13330.2018 п. 6.18а.10 в сейсмических районах …", "注意！根据 СП 14.13330.2018 第 6.18a.10 条，在地震区必须仅使用抽芯铆钉。"),
        ("Периодичность вывоза отходов, определенная по нормативам.", "按照规定标准确定的废物清运周期。"),
        # 「段」「输出」「用户指定」在技术文档里是正常的词
        (
            "When your design has unconfined scan segments, you must not use the option.",
            "当设计包含未受约束的扫描段时，不得使用该选项。对扫描段进行追踪，可使工具正确识别该段中完整的输入输出元件。",
        ),
        (
            "User-specified clocks and scan-related I/O ports are excluded.",
            "用户指定的时钟和与扫描相关的输入输出端口会被自动排除在识别范围之外。",
        ),
        # 原文本身就在讲规则 / OCR：照译出来的不算
        ("Согласно правилам, текст на исходном языке сохраняется.", "按照规则，原文保持不变。"),
        ("OCR errors in the original text are kept as-is.", "原文中的 OCR 错误保持原样。"),
        # 括号里的译者注：译文能用，不拿来重译
        (
            "2 Бетон класса B25 демона",
            "2 采用B25级混凝土（原文“демона”应为“бетона”笔误，按语义译为混凝土）。",
        ),
    ],
)
def test_ordinary_chinese_translations_pass(source, translated):
    assert self_correction_leak(source, translated) == ""


def test_text_after_chinese_meta_commentary():
    assert text_after_self_correction(CIRCLED_SOURCE, CIRCLED_OUTPUT) == "① 砂，粉质（м — 细，с — 中等粒度）"
    assert text_after_self_correction(NUMBERED_SOURCE, NUMBERED_OUTPUT).startswith("1 按最优体积")


def test_chinese_meta_commentary_is_retranslated():
    item = _caption_item("p1235-b009", CIRCLED_SOURCE)
    with pytest.raises(TranslationProtocolError):
        validate_batch_result([item], {"p1235-b009": {"decision": "translate", "translated_text": CIRCLED_OUTPUT}})
