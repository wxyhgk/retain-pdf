"""人文社科、通俗读物的译法规则，一条只写在这里一处（2026-11-20）。

以前同一条规则在按节翻（`section.SECTION_NARRATIVE_PROMPT`）、逐页翻的人文附加段（`agent.NARRATIVE_PROMPT`）、审校
（`review.ACCURACY_NOTE`）里各写一遍，措辞各不相同，改一处容易漏；例子多半出自同一本书（《The Interloper》的
"so many doors had been slammed""no access materialized"），别的书也一律带着。现在各角色从这里拼：

- 译者（按节、逐页）用 `TRANSLATOR_RULES`；
- 审校用 `REVIEW_KEEP_EXAMPLE`（意译不要改回字面）和 `REVIEW_TERM_OF_ART`。

例子一律用不出自任何一本在译的书的通用说法。改规则的时候跑一遍固定评测样例（`docs/ops/planning/translation-agent/`）。
"""

from __future__ import annotations

REWRITE = (
    "译文要读起来像中文作者写的：先读懂一整段在讲什么，再按中文习惯组织句子，可以拆长句、并短句、调语序"
    "（时间、地点、原因放前面），不必一句对一句，也不必和原文一样长。"
)
MEANING = (
    "意思不增不减：不添原文没有的信息、评价、渲染，不堆成语，不删内容；作者的语气和保留（seemed、perhaps、I can only guess）"
    "照样传达，说得含糊的地方不要说死，自嘲、反讽照样留着；作者当时还不知道的结果，不要提前说出来。"
)
IDIOM = (
    "英文的比喻、习语换成中文里意思相同的惯用说法，没有对应说法就意译，不要照字面写出中文里不说的话"
    "（the elephant in the room → 大家心照不宣、避而不谈的事）。"
)
TERM_OF_ART = (
    "习语和术语分清：作者引用的别的学科的固定说法（效应、定律、某某技术、某某悖论，常带引号，或后面跟着 strategy、effect、theory），"
    "用中文学界通行的译名，不要按字面译，第一次出现写\"译名（原文）\"（the tragedy of the commons → 公地悲剧（the tragedy of the commons），"
    "learned helplessness → 习得性无助（learned helplessness））；没有把握的不要硬套中文俗语（俗语的意思常和术语对不上），"
    "按它在那个学科里的意思译，同样带上原文。"
)
NOMINAL = (
    "英文爱用抽象名词，中文多用动词和具体说法（her refusal to cooperate → 她不肯配合；the implementation of the policy → 推行这项政策），"
    "不要写\"……的处理\"\"进行……\"这种名词腔。术语表里的词也一样：概念照用，词形变了（形容词、动词、分词）按中文习惯说成动作或状态，"
    "不要把术语名词硬塞进去。"
)
NAMES = (
    "人名、机构、术语按给出的译法。标着\"前文已出现\"的只写中文；没标的、清单里没有的，在这一节第一次出现时写\"中文译名（原文）\"，"
    "之后只写中文。没给译法的人名音译，机构名能译就译。书名、报刊名用书名号。"
)
NO_ENGLISH = "不要在中文句子里夹没翻的英文单词；第一次出现时括号里注的原文不算。"

# 译者（按节翻、逐页翻的人文附加段）共用的那几条，按这个顺序列
TRANSLATOR_RULES = (REWRITE, MEANING, IDIOM, TERM_OF_ART, NOMINAL, NAMES, NO_ENGLISH)


def bullets(rules: tuple[str, ...]) -> str:
    """规则排成"- "开头的条目，一条一行。"""
    return "\n".join(f"- {rule}" for rule in rules)


# 审校：意译不是错
REVIEW_KEEP_EXAMPLE = (
    "意译、成语、调过语序的句子，只要意思、语气、信息量对得上原文，就不是错，不要改回字面"
    "（the elephant in the room 译成\"大家心照不宣、避而不谈的事\"是对的，不要改成\"房间里的大象\"）。"
)
REVIEW_TERM_OF_ART = "但别的学科的固定说法（效应、定律、某某技术）按字面直译成中文里不这么叫的，是 number_term，要开单子改成通行译名。"

__all__ = [
    "IDIOM",
    "MEANING",
    "NAMES",
    "NOMINAL",
    "NO_ENGLISH",
    "REVIEW_KEEP_EXAMPLE",
    "REVIEW_TERM_OF_ART",
    "REWRITE",
    "TERM_OF_ART",
    "TRANSLATOR_RULES",
    "bullets",
]
