"""受保护 token 的还原,以及「公式边界不归我们管」这条决定。

曾经试过按 OCR 标注锁住行内公式:MinerU 把每个行内公式标成独立 span
（`type: "inline_equation"`）,762 个 span 全部能在 source_text 里逐字命中。
动机是一个测出来的数字:「236 个含公式条目里 132 个（55%）丢了 LaTeX 命令」。

那个数字是错的,机制也是错的,三处都值得记下来。

一、100% 可定位只证明找得到,不证明边界对。真实一句里 MinerU 给的是:

    text            'so that \\'
    inline_equation 'E { \\bf q } . \\quad ( 2 . 4 { \\bf b } )'
    inline_equation 'gives \\tilde { \\Psi } _ { I }'

反斜杠留在 text span、命令名划进公式;还原补 `$` 后拼出 `\\E`,mitex 报
`unknown command: \\E`,整页渲染失败。英文单词 `gives` 被框进公式。同一个
`A_I({\\bf R})` 被切成 text/equation/text 三段。锁住只会把坏边界固化。

二、提示词本来就要求模型自己包 `$`,于是模型包一遍、还原补一遍,拼出
`$A _ { I } ( { $\\bf R$ } )` 这种嵌套 `$`。

三、模型会把 token 当成数学符号改写尖括号,还原对不上,那段内容整个消失。

而那 55% 本身是度量假象——见
test_equivalent_rewrites_are_not_counted_as_dropped_commands。
"""

from __future__ import annotations


from retainpdf_translation_classic.llm.placeholder_transform import (  # noqa: E402
    item_with_runtime_hard_glossary,
)
from retainpdf_translation_classic.llm.shared.cache import (  # noqa: E402
    has_unrestored_protected_tokens,
)
from retainpdf_translation_classic.llm.shared.orchestration.metadata import (  # noqa: E402
    restore_runtime_term_tokens,
)
from retainpdf_math.checks import (  # noqa: E402
    dropped_latex_commands,
)


def test_ocr_formula_spans_are_left_alone() -> None:
    """标着 inline_equation 的 span 不得被换成 token。

    没有术语要保护时,送给模型的文本必须和原文逐字相同,公式原样暴露给模型。
    一旦有人再把公式保护接回来,这条会红。
    """
    source = r"so that \ E { \bf q } . \quad ( 2 . 4 { \bf b } ) gives \tilde { \Psi } _ { I }"
    item = {
        "source_text": source,
        "lines": [
            {"spans": [
                {"type": "text", "content": r"so that \ "},
                {"type": "inline_equation", "content": r"E { \bf q } . \quad ( 2 . 4 { \bf b } )"},
                {"type": "inline_equation", "content": r"gives \tilde { \Psi } _ { I }"},
            ]}
        ],
    }
    result = item_with_runtime_hard_glossary(item, [])

    assert result.get("protected_source_text", source) == source
    assert not result.get("protected_map"), f"公式被保护了:{result.get('protected_map')}"


def test_restore_covers_formula_tokens_not_only_terms() -> None:
    """保护了就必须还原,加一类就要同时改还原那头。

    真实事故:给 protected_map 加了 formula 类型的 token,但统一还原点只处理
    {"term"}。一次翻译 262 个条目里 79 个（30%）译文带着未还原的 token 落盘,
    渲染出来是 `< 𝑓1 − 𝑒32/ >` 这种东西。

    生产里现在只有 term 进 map,但还原点必须继续覆盖 formula——正是收窄成单一
    类型的那个写法造成了事故。
    """
    item = {
        "protected_map": [
            {"token_tag": "<f1-e32/>", "token_type": "formula", "restore_text": r"\mathrm{D}"},
            {"token_tag": "<t1-abc/>", "token_type": "term", "restore_text": "势能面"},
        ]
    }
    result = restore_runtime_term_tokens(
        {"p001-b008": {"translated_text": "交换反应 <f1-e32/> 在 <t1-abc/> 上"}},
        item=item,
    )
    text = result["p001-b008"]["translated_text"]

    assert "<f1-" not in text and "<t1-" not in text, f"仍有未还原的 token:{text}"
    assert text == r"交换反应 $\mathrm{D}$ 在 势能面 上"


def test_translation_with_leaked_tokens_never_reaches_the_cache() -> None:
    """带未还原 token 的译文既不能写进缓存,也不能从缓存里读出来。

    上面那次事故的第二幕:还原修好之后重翻,结果一模一样——262 条目、79 条泄漏,
    两次数字逐位相同。原因是缓存命中:坏译文在修复前已经写进去了,而缓存键只包含
    提示词和源文,不包含「还原逻辑的版本」,所以键没变、照旧命中。一次写入污染此后
    每一次运行,而且表现成「修复没生效」。
    """
    assert has_unrestored_protected_tokens("项 <f1-2d4/> 是奇异绝热修正")
    assert has_unrestored_protected_tokens("术语 <t2-abc/> 保留")
    assert not has_unrestored_protected_tokens("项 $\\mathrm{D}$ 是修正")
    assert not has_unrestored_protected_tokens("普通译文,没有任何占位符")
    # 形近但不是 token 的写法不能误伤
    assert not has_unrestored_protected_tokens("区间 <f1> 与 a<b 比较")


def test_guard_also_catches_tokens_whose_brackets_the_model_rewrote() -> None:
    """token 被改写成数学写法,同样算泄漏。

    实测译文里出现过 `$\\langle f5-4bb\\rangle / \\langle f6-ec4\\rangle$`,原文是
    `<f5-4bb/>`——模型在公式里把尖括号当成了 `\\langle`/`\\rangle`。还原按原样匹配,
    对不上,`\\partial \\pmb{H}(\\mathbf{R}_r)` 整段内容就这么消失了,而只认原样的
    护栏放它进了缓存。
    """
    assert has_unrestored_protected_tokens(r"$\langle f5-4bb\rangle / \langle f6-ec4\rangle$")
    assert has_unrestored_protected_tokens(r"$\langle t1-abc\rangle$")
    # 真正的 \langle 数学写法不能误伤
    assert not has_unrestored_protected_tokens(r"内积 $\langle \psi | \phi \rangle$ 与 $\langle n \rangle$")


def test_equivalent_rewrites_are_not_counted_as_dropped_commands() -> None:
    """公式命令丢失的检测只数语义损失,不数等价改写。

    第一版把两者混在一起,虚报得离谱:一个真实任务报「158 条含公式、79 条丢命令
    （50%）」,其中 140 次是 `A ^ { \\prime }` 写成 `A'`——同一个数学对象;`\\bf` 写成
    `\\mathbf` 同理。正是这个数字支撑了「必须锁住公式」的判断,而那套机制把整页渲染
    搞崩了。虚高的指标不只是没用,它会指错方向。

    同时不能把真信号一起放过:`\\overset{\\cdot}{k}` 变成 `k` 是另一个量。
    """
    assert dropped_latex_commands(r"$A ^ { \prime }$", "$A'$") == {}
    assert dropped_latex_commands(r"$\bf R$", r"$\mathbf{R}$") == {}
    assert dropped_latex_commands(r"$\scriptstyle x$", "$x$") == {}

    assert dropped_latex_commands(r"$\overset { \cdot } { k }$", "$k$") == {"overset": 1, "cdot": 1}
    assert dropped_latex_commands(r"$\bar { x }$", "$x$") == {"bar": 1}
    # 整个字体命令消失仍要报——折叠的是拼法,不是存在与否
    assert dropped_latex_commands(r"$\bf R$", "$R$") == {"mathbf": 1}

    # 只折叠老拼法。粗体三兄弟不等价:`\mathbf` 正体粗、`\boldsymbol` 斜体粗
    # （希腊字母和矢量靠它区分）、`\pmb` 叠印粗,而 translation_typst_repair.txt
    # 明令禁止模型做这种替换。折叠它们等于对提示词认定的损坏视而不见。
    assert dropped_latex_commands(r"$\pmb { H }$", r"$\mathbf{H}$") == {"pmb": 1}
    assert dropped_latex_commands(r"$\boldsymbol { \xi }$", r"$\mathbf{\xi}$") == {"boldsymbol": 1}
