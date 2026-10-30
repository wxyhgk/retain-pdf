"""LaTeX 命令登记表的三道闸门。

表本身在 backend/math/retainpdf_math/latex_commands.json，派生逻辑在同目录的 registry.py。这里负责
不让它跑偏——一张没人验证的表比没有表更危险，因为它看起来权威。

一致性闸（纯逻辑，秒级）抓的是表**内部**的自相矛盾，也就是当初把规则拆散在八个
地方时抓不到的那一类。三个真实 bug 里它能挡住两个。

真编译闸抓的是表和**现实**脱节。这是唯一能发现版本脱节的信号：mitex 0.2.6 吐旧版
Typst 符号名时，报错长得像「不支持这个命令」，于是长出一整批降级规则，其中
`\\mathscr` → `\\mathcal` 把手写体悄悄换成了花体。字符串断言永远发现不了。

等价闸把「两种拼法是同一个东西」变成可测断言：渲染成 PNG 比哈希。凭直觉判断等价
正是 `\\pmb` 被错误折叠进 `\\mathbf` 的原因——像素一比就知道是两个东西。

前端 MathJax 那一列由 frontend/web/tests/reader/latex-command-registry.test.mjs
盯着，读的是同一份 JSON。
"""

from __future__ import annotations


import pytest


from devtools.tests.rendering.mitex_probe import TYPST_BIN  # noqa: E402
from devtools.tests.rendering.mitex_probe import compile_native  # noqa: E402
from devtools.tests.rendering.mitex_probe import compile_pipeline  # noqa: E402
from devtools.tests.rendering.mitex_probe import compile_pipeline_together  # noqa: E402
from devtools.tests.rendering.mitex_probe import png_digest  # noqa: E402
from retainpdf_math.registry import command_by_name  # noqa: E402
from retainpdf_math.registry import latex_commands  # noqa: E402
from retainpdf_math.registry import supported_commands  # noqa: E402
from retainpdf_math.registry import unsupported_commands  # noqa: E402

STATES = {"supported", "unsupported"}
_skip_without_typst = pytest.mark.skipif(not TYPST_BIN, reason="没有可用的 typst 二进制")


def needs_typst(test):
    """真编译的用例：打登记过的 needs_typst marker，再叠一层 skipif。

    以前这里只有一个同名的 skipif，`-m "not needs_typst"` 根本选不中它们；marker
    让 CI 那一步能按约定挑掉，skipif 让本机没装 typst 时跳过而不是红。
    """
    return pytest.mark.needs_typst(_skip_without_typst(test))


# ---------------------------------------------------------------- 一致性闸

def test_every_entry_is_well_formed() -> None:
    assert latex_commands(), "登记表是空的"
    seen: set[str] = set()
    for command in latex_commands():
        assert command.name not in seen, f"{command.name} 重复登记"
        seen.add(command.name)
        assert command.name and not command.name.startswith("\\"), f"{command.name} 不该带反斜杠"
        assert command.sample.strip(), f"{command.name} 缺少 sample——闸门没有样本就验不了它"
        assert f"\\{command.name}" in command.sample, f"{command.name} 的 sample 里没出现这个命令"
        for field in ("mitex_native", "pipeline", "mathjax"):
            assert getattr(command, field) in STATES, f"{command.name}.{field} 取值非法"


def test_a_command_the_prompt_protects_is_never_folded_away() -> None:
    """提示词禁止替换的命令，不许在计数时被当成别人的等价拼法折叠掉。

    真实 bug:`\\pmb` 被折叠进 `\\mathbf`,于是「模型把 \\pmb 换成 \\mathbf」在检测器
    眼里是零损失——而 translation_typst_repair.txt 正好明令禁止这个替换。提示词说
    是损坏，检测器说是等价，两层对同一件事的定义相反。

    规则拆散在两个文件里时，这种矛盾没有任何东西会发现。
    """
    for command in latex_commands():
        if command.never_degrade:
            assert command.equivalent_to is None, (
                f"\\{command.name} 既标了不许降级，又被折叠成 \\{command.equivalent_to}"
            )
            assert not command.drift_expected, (
                f"\\{command.name} 既标了不许降级，又把消失算作预期漂移"
            )


def test_protected_commands_actually_render() -> None:
    """不能禁止模型替换一个根本渲染不出来的命令——那是在要求它产出坏页面。"""
    for command in latex_commands():
        if command.never_degrade:
            assert command.renders, f"\\{command.name} 标了不许降级，但 pipeline 渲染不了"


def test_unrenderable_commands_tell_the_model_what_to_do_instead() -> None:
    """渲染不了就必须给出替代写法,否则模型无从改起,页面照崩。"""
    for command in unsupported_commands():
        assert command.rewrite_hint, f"\\{command.name} 渲染不了却没有 rewrite_hint"


def test_a_rule_that_rescues_a_command_is_named() -> None:
    """原生不支持、走链路却能渲染 —— 必须写明是谁救的。

    否则下一个做清理的人会看到「pipeline: supported」，以为那条清洗规则是死代码，
    顺手删掉。删完当天不报错，因为坏写法要等真实文档里出现才触发。
    """
    for command in latex_commands():
        if command.renders and command.mitex_native == "unsupported":
            assert command.handled_by, (
                f"\\{command.name} 原生不支持但链路能渲染，却没说明是哪条规则救的"
            )


def test_a_rescued_command_still_tells_the_model_what_to_do() -> None:
    """有清洗器兜底 ≠ 不用提示模型。

    兜底是窄正则:`\\circled{R}` 能救,`\\circled{\\mathbf{R}}` 嵌套一层花括号就救
    不了,实测仍然整页编译失败。只靠兜底等于把「模型恰好写了简单形式」当成保证。
    """
    for command in latex_commands():
        if command.handled_by:
            assert command.rewrite_hint, (
                f"\\{command.name} 只有清洗器兜底、没有给模型替代写法，"
                "兜底正则覆盖不到的写法会直接让整页编译失败"
            )


def test_fold_targets_exist_and_render() -> None:
    table = command_by_name()
    for command in latex_commands():
        target = command.equivalent_to
        if not target:
            continue
        assert target in table, f"\\{command.name} 折叠到了未登记的 \\{target}"
        assert table[target].renders, f"\\{command.name} 折叠到了渲染不了的 \\{target}"
        assert table[target].equivalent_to is None, f"\\{target} 本身又被折叠，链式折叠不允许"


# ---------------------------------------------------------------- 真编译闸

@pytest.fixture(scope="module")
def supported_samples_compile_together() -> bool:
    """52 个能渲染的样本合在一个文档里编译一次（以前每个各起一次 Typst）。整批过了，每条就不用再单独编译。"""
    return compile_pipeline_together([command.sample for command in supported_commands()])


@needs_typst
@pytest.mark.parametrize("command", supported_commands(), ids=lambda c: c.name)
def test_supported_commands_really_compile(command, supported_samples_compile_together) -> None:
    if supported_samples_compile_together:
        return
    # 整批失败：逐个编译，报出是哪一个
    ok, error = compile_pipeline(command.sample)
    assert ok, (
        f"登记表说 \\{command.name} 能渲染，实际失败了：\n{command.sample}\n{error}\n\n"
        "先确认是不是版本脱节（mitex / Typst / cmarker），再考虑改表。"
    )


@needs_typst
@pytest.mark.parametrize("command", unsupported_commands(), ids=lambda c: c.name)
def test_unsupported_commands_really_fail(command) -> None:
    """反向也要钉住：表说渲染不了的，必须真的渲染不了。

    只钉一个方向，表就会越积越多——升级 mitex 之后早已支持的命令仍挂在「不支持」
    名下，提示词继续命令模型替换它们，等于在源头主动降级。这正是当年那批降级规则
    的由来。
    """
    ok, _ = compile_pipeline(command.sample)
    assert not ok, (
        f"登记表说 \\{command.name} 渲染不了，实际编译成功了。\n"
        "如果是升级带来的，把它移出 unsupported 并删掉 rewrite_hint——"
        "继续提示模型替换就是在主动降级。"
    )


@needs_typst
@pytest.mark.parametrize(
    "command",
    [c for c in latex_commands() if c.renders and c.mitex_native == "unsupported"],
    ids=lambda c: c.name,
)
def test_rescue_rules_are_still_load_bearing(command) -> None:
    """救命规则得确实在救命：原生必须真的失败，否则那条规则已经可以删了。"""
    ok, _ = compile_native(command.sample)
    assert not ok, (
        f"\\{command.name} 现在原生就能渲染了，{command.handled_by} 那条规则可以删掉，"
        "并把 mitex_native 改成 supported。"
    )


@needs_typst
@pytest.mark.parametrize(
    "command",
    [c for c in latex_commands() if c.equivalent_to],
    ids=lambda c: c.name,
)
def test_folded_spellings_render_identically(command) -> None:
    """折叠必须逐像素相同,不能靠直觉。

    `\\bf`/`\\rm`/`\\it`/`\\sf`/`\\tt`/`\\cal` 是老式字体切换,和现代拼法渲染结果
    完全一致;而 `\\pmb`（叠印粗）、`\\boldsymbol`（斜体粗）和 `\\mathbf`（正体粗）
    实测像素不同——曾经凭直觉把它们折叠进去,让检测器对真实损坏视而不见。
    """
    # 两条 sample 各自展示的是不同内容,比不了像素;fold_probe 是专门配对的
    # 同一内容的两种写法。
    assert command.fold_probe, f"\\{command.name} 声明了折叠却没有 fold_probe 配对样本"
    old_spelling, new_spelling = command.fold_probe
    left = png_digest(old_spelling)
    right = png_digest(new_spelling)
    assert left is not None and right is not None, f"样本编译失败,无法比对像素:{command.fold_probe}"
    assert left == right, (
        f"\\{command.name} 与 \\{command.equivalent_to} 渲染结果不同,不能当作等价拼法折叠。\n"
        f"{old_spelling}  vs  {new_spelling}"
    )
