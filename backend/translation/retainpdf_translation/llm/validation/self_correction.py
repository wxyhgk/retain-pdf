"""模型把「边想边改」写进了译文：先交一版草稿，再来一句「Wait — … Correct it.」，最后才是改好的译文，三段
一起回来。真实例子（qwen3.8-flash，一本教材）：

    图12.16 烯丙烷（allene）的两种视图。…
    Wait—"allene" should not be translated as 烯丙烷; allene is 丙二烯. Correct it.
    图12.16 丙二烯（allene）的两种视图。…

english_residue 只抓「照抄原文的英文」，这种是模型自己新写的话，原文里没有，所以漏过去了。

只认原文里没有的纠正话术，并且要么在段首（Wait— / 等等，），要么本身就是在说「改正 / 译成 / 输出」。

还有一种是用中文讲自己怎么译（claude-haiku-5-5，一本 OCR 很烂的俄文图纸，20261105025105-209e5c 里五六十处）：

    这段原文是OCR损坏严重的俄文工程说明，我需要按字面忠实翻译，并保留编号。
    注意：按要求只译原文。正确译文如下：
    说明：这里的「Экспликация помещений」是建筑图纸中的标准栏目名，意为房间明细表（或房间说明）。

单看开头会误伤正常译文（「注意！根据 СП 14.13330……」「按照规定标准确定的……」），所以按行看：同一行里
同时谈到两样「翻译这件事本身」的东西（原文、译文、按规则、OCR 损坏、我要、输出、意为……）才算。
"""

from __future__ import annotations

import re

# 段首的「打住」：Wait — / Hmm, / Actually, / Oops — / Correction: / 等等， / 更正： / 纠正：
_PARAGRAPH_START_RE = re.compile(
    r"(?:^|\n)\s*(?:"
    r"(?:wait|hmm+|actually|oops|correction|scratch that)\s*[—–\-,:：!！.]"
    r"|(?:等等|稍等|更正|纠正|抱歉)\s*[，,:：—!！]"
    r")",
    re.I,
)

# 不在段首也算：明说在改自己的回答、译法或输出
_CORRECTION_PHRASE_RE = re.compile(
    r"\b(?:"
    r"i\s+(?:need|have|should|must)\s+to\s+(?:correct|fix|revise|redo|re-?translate)"
    r"|let\s+me\s+(?:correct|fix|revise|redo|re-?translate)"
    r"|correct(?:ing)?\s+(?:it|this|that|my\s+(?:reply|answer|response|translation|output))\b"
    r"|(?:should|must)\s*(?:not|n't)\s+be\s+translated\s+as"
    r"|the\s+correct\s+(?:output|translation|answer|reply)\s+is"
    r"|my\s+(?:previous|earlier|last)\s+(?:reply|answer|response|translation|output)"
    r"|(?:not|instead\s+of)\s+the\s+source\s+(?:text\s+)?repeated"
    # 拿不准时的自问自答（没开思考的小模型会把犹豫写进回答）。真实例子（claude-haiku-5-5，
    # 20261013090853-726861 p070-b014，原文只是小标题 "Nak Schedule 2"）：
    #   Translation: "Nak Schedule 2" as a heading. … Keep "NAK" as-is? The source says "Nak Schedule 2" — …
    #   Better to keep "Nak Schedule 2" since it's an identifier-like heading; … I'll use "Nak Schedule 2" …
    r"|i(?:'ll|’ll|\s+will)\s+(?:use|keep|go\s+with|translate|render|output|leave)\b"
    r"|keep\s+(?:[\"“'‘][^\"”'’\n]{1,60}[\"”'’]|it|this|that|them)\s+as[- ]is\b"
    r"|(?:better|best|safer)\s+to\s+(?:keep|leave|translate|use|preserve)\b"
    r"|the\s+source\s+(?:text\s+)?says\b"
    r"|translate\s+(?:it\s+|this\s+)?as\s+an?\s+(?:heading|title|label)\b"
    r")",
    re.I,
)

# 中文的纠正话术：只在和「译 / 翻译 / 改正」连在一起时才算，避免「苹果、香蕉等等」这类正常用法
_ZH_CORRECTION_RE = re.compile(r"(?:不应|不该|不能)(?:被)?(?:译|翻译)(?:为|成)|(?:上面|上述|刚才)的?(?:译文|翻译|回答)(?:有误|错了|不对)")
_ZH_TRANSLATION_WORD_RE = re.compile(r"译|翻译|改正|纠正|更正|修正")
_CJK_RE = re.compile(r"[一-鿿]")

# 谈「翻译这件事」的几类说法（汉字），各带一个原文里的对应说法：原文里本来就在讲这件事（讲 OCR 的论文、
# 「согласно правилам」照译成「按照规则」）时这一类不算数。一行里有两类算数才认作自言自语。
_ZH_META_SIGNALS: tuple[tuple[re.Pattern[str], re.Pattern[str]], ...] = (
    (
        re.compile(r"原文|原句|原词|(?:这|该|此)段(?:文字|内容|文本)|这里的[「“\"]"),
        re.compile(r"original|source|оригинал|исходн", re.I),
    ),
    (
        re.compile(r"译文|翻译|译为|译成|译出|照译|直译|意译|音译|不译"),
        re.compile(r"translat|перев|übersetz|tradu", re.I),
    ),
    (
        re.compile(r"按(?:照)?(?:规则|要求|提示|指示|忠实原则)|根据(?:规则|要求|提示|指示)|忠实原则"),
        re.compile(r"rule|instruction|requir|правил|требован|указан", re.I),
    ),
    (
        re.compile(r"OCR|乱码|损坏|粘连|残缺|拼写错误|保持原样|保留原样|原样保留|保留原文|不补全|不修正|无法(?:可靠)?(?:还原|辨识|辨认)"),
        re.compile(r"OCR|garbl|corrupt|damag|поврежд|разруш", re.I),
    ),
    (
        re.compile(r"我(?:需要|要|将|会|只|先|来|输出|按|把)"),
        re.compile(r"\b(?:I|my|я|мне|мы)\b", re.I),
    ),
    (
        re.compile(r"(?:只|直接|原样|保持|如下)输出|输出(?:译文|为|如下|纯译文)|如下[:：]\s*$|最终译文|正确译文|(?:译文|翻译)应为|输出的译文"),
        re.compile(r"output|вывод|follow|below|ниже|следующ", re.I),
    ),
    (
        re.compile(r"意为|意思是|疑为|疑似|误写|笔误|之误"),
        re.compile(r"mean|означа|i\.e\.|т\.\s?е\.|вероятно|probabl", re.I),
    ),
)


def _present_in_source(match_text: str, source_text: str) -> bool:
    needle = re.sub(r"\s+", " ", match_text.strip().strip("—–-,:：!！.，")).lower()
    return bool(needle) and needle in re.sub(r"\s+", " ", source_text).lower()


_PARENTHESIZED_RE = re.compile(r"（[^（）]*）|\([^()]*\)")


def _zh_meta_line_start(source: str, translated: str) -> int | None:
    """第一行用中文讲自己怎么译的位置（行首），没有时 None。

    译文里夹在括号里的译者注（「采用 B25 混凝土（原文“демона”疑为“бетона”之误，按语义译出）」）不算：
    译文本身能用，重译多半还是这样，几次不过反倒退回原文。整行都是括号里的话时照样算。
    """
    offset = 0
    for line in translated.split("\n"):
        outside = _PARENTHESIZED_RE.sub("", line)
        text = outside if _CJK_RE.search(outside) else line
        if _CJK_RE.search(text):
            kinds = 0
            for word_re, source_cue_re in _ZH_META_SIGNALS:
                match = word_re.search(text)
                if match and not source_cue_re.search(source) and match.group(0) not in source:
                    kinds += 1
            if kinds >= 2:
                return offset + len(line) - len(line.lstrip())
        offset += len(line) + 1
    return None


def _leak_position(source: str, translated: str, *, require_cjk: bool = True) -> int | None:
    """自我纠正话术在译文里的位置（第一处，落在那句话的第一个字上），没有时 None。

    require_cjk：判断「这是不是一段混进了自言自语的译文」时要求有汉字（纯英文归 english_residue 管）；
    切出改好的那一版时，剩下的可能是纯英文的自言自语，不能因为没汉字就放过。
    """
    if not translated.strip() or (require_cjk and not _CJK_RE.search(translated)):
        return None
    positions = []
    for match in _CORRECTION_PHRASE_RE.finditer(translated):
        if not _present_in_source(match.group(0), source):
            positions.append(match.start())
            break
    for match in _ZH_CORRECTION_RE.finditer(translated):
        positions.append(match.start())
        break
    meta_start = _zh_meta_line_start(source, translated)
    if meta_start is not None:
        positions.append(meta_start)
    for match in _PARAGRAPH_START_RE.finditer(translated):
        # 跳过前面的换行和空白（`\n\nWait` 要落在 W 上，不然「切掉这一行」切掉的是空行）
        start = match.start() + len(match.group(0)) - len(match.group(0).lstrip())
        paragraph = translated[start:].split("\n", 1)[0]
        marker = match.group(0).strip()
        if _present_in_source(marker, source):
            continue
        # 段首的 Wait / 等等 还要看这一段在不在说「改 / 译」，单独一个「等等，」可能是正常译文
        if re.match(r"\s*(?:等等|稍等|抱歉)", paragraph) and not _ZH_TRANSLATION_WORD_RE.search(paragraph):
            continue
        positions.append(start)
        break
    return min(positions) if positions else None


def self_correction_leak(source_text: str, translated_text: str) -> str:
    """译文里混进了模型的自我纠正就返回那句话（截断），否则返回空字符串。"""
    translated = str(translated_text or "")
    position = _leak_position(str(source_text or ""), translated)
    return "" if position is None else _snippet(translated, position)


def text_after_self_correction(source_text: str, translated_text: str) -> str:
    """模型纠正之后给的那一版：最后一处自言自语所在行之后的内容；纠正之后什么都没写时返回空字符串。

    真实例子：先把原文抄一遍，再「Wait — the instruction says output only the translation. Let me correct
    that.」，最后才是译文。取出来的仍要走完整校验，过了才用——这里只负责切，不负责信。
    """
    source = str(source_text or "")
    remainder = str(translated_text or "")
    for _ in range(5):  # 偶尔纠正不止一次
        position = _leak_position(source, remainder, require_cjk=False)
        if position is None:
            return remainder.strip()
        line_end = remainder.find("\n", position)
        if line_end < 0:
            return ""
        remainder = remainder[line_end + 1 :]
    return ""


def _snippet(text: str, start: int, limit: int = 120) -> str:
    """命中位置所在的那一行（从行首起），给诊断看。"""
    line_start = text.rfind("\n", 0, start) + 1
    return text[line_start:].strip().split("\n", 1)[0][:limit]


__all__ = ["self_correction_leak", "text_after_self_correction"]
