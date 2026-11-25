"""翻译前通读（通读员 + 术语专员的轻量版）：整篇看一遍，先把全书要统一的东西定下来，再逐页翻。

实测（6 份样例，3 个 Sonnet 审读）最大的问题是术语、人名全文漂移和目录、标题各译各的：逐页翻的时候，模型只报它认为是
"专业术语"的词，核心概念词（fitting、ledger、mean）和人名不报，目录页又先于正文翻。所以翻译前先做一次：

1. 程序扫全文挑候选：反复出现的词组（2–3 个词出现 3 次以上、单词出现 5 次以上，去掉常用词）和大写开头的专名，
   每个附 1–2 句原文（在两章以上出现的，附两章各一句，好看出是不是同词异义）。
2. 一次请求交给模型（全部标题 + 全书开头的样张 + 候选），交回：体裁和领域、人名规则、文风说明、概念词和专名的译法、
   全部标题（含目录条目）的译法。候选太多、标题太多时分几次。
3. 调度把结果登记进术语表（审定，全书照用；按章的只管那几章），文风说明放进每页的上下文包，标题和目录条目的译法
   成为"已定好的译文"，逐页翻时不再翻。

人名规则（用户 10-30 定）：理工论文、技术文档保留原文；人文、通俗书全书第一次写"中文译名（原文）"，之后用中文译名。
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import asdict
from dataclasses import dataclass
from dataclasses import field

from retainpdf_translation_agent.checks import _strip_protected
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.memory import quote_around

MAX_CANDIDATES = 120
MAX_HEADINGS = 200
SAMPLE_CHARS = 6000
GENRES = ["science_paper", "textbook", "technical_manual", "humanities", "popular_book", "other"]

READER_PROMPT = """你是学术翻译团队的通读员兼术语专员。正式逐页翻译（英译中）之前，你先通读整篇，把全文要统一的东西定下来。
你会收到：全部标题和目录条目（带 id）、全书开头的样张、程序从全文挑出来的候选词组（带出现次数和原文例句）。

交回：
1. genre：体裁（science_paper 理工论文、textbook 教科书、technical_manual 技术手册、humanities 人文社科、popular_book 通俗读物、other）；
   domain：领域，一句话。
2. name_policy：人名怎么处理。理工论文、技术手册用 keep（保留原文）；人文社科、通俗读物用 transliterate
   （全书第一次写"中文译名（原文）"，之后只写中文译名）。教科书看内容：历史人物、学者名字常见的用 transliterate。
3. style：给译者的文风说明，用中文写，300 字以内：人称（作者用 we / I 怎么译）、正式程度、语气（口语、严谨、幽默、措辞保留的程度）、
   称呼读者用"你"还是"您"、编号体例（章节、图表、公式的写法），再给 1–2 句最能代表作者口吻的原文和你的示范译文。
   提到原文的词时要写清楚**中文怎么译**（例如"probably、it seems 这类保留语气要译出来：大概、看起来"），不要让译者保留英文原词；
   示范译文必须是通顺的中文，写完自己读一遍。
   只写这本书特有的东西；译者已经知道的通用规则不要再写（人名第一次写"中文译名（原文）"、脚注标记原样保留、
   中文引号、不夹英文、习语意译这些），写了反而和译者的规则措辞不一、互相打架。
4. terms：候选里**全文需要统一译法的**，宁少勿滥（一般 10–40 条），定下的译法逐页翻时必须照用：
   - 概念词：在本文里反复出现、有特定含义、而且容易译得前后不一的（论文里的 budget、rewrite、overflow，人文里的 ledger）；
     译法要地道准确（例如排版里的 fitting 是"排入、适配"不是"拟合"）。
     人文社科、通俗读物里的概念多是人的行为（stalling、gatekeeping、withholding）：选词先看是谁在做、是不是有意的
     （有意拖着不办是"拖延""推诿"，不是泛泛的"延迟"），再在心里造两三个常见搭配（"一再推诿""互相推诿"）读一遍，读着不像中文就换词；
     source 写名词或动名词的原形，逐页翻译时它的形容词、动词形式按中文习惯表达，不必硬套这个词。
     人文社科、通俗读物只收本学科的行话（人类学里的 field 田野、gatekeeper 守门人）和专名；反复出现的日常词
     （access、handling、commitment、donation、support）不要收：这类书里同一个词在不同句子要换不同说法
     （access 有时是"进去"，有时是"许可""松口"），钉死一个译法会逼出"进入的事始终没有着落"这种句子。
   - 专名：
     · 软件、产品、数据集、期刊、编程接口：category=keep（原样保留）；
     · 人名、书名、机构、地名：按 name_policy——keep 就 category=keep；transliterate 就 category=name，target 写通行中文译名
       （书名写在《》里），全书第一次会自动写成"中文译名（原文）"。
   不要收：语言名和国名（German、Chinese）、普通词（block、box、point、reference、search、table……除非本文给它下了特定定义）、
   只出现一两次的、整句引文、标题本身。
   同一个词在不同章意思不同（例句能看出来），分开给，每条写 chapters（只管哪几章）。
   target 只写译法本身，**不带括号、不带原文、不带说明**；拿不准的不要收。
5. headings：每个标题、目录条目（按 id）的译文。同一个标题在目录和正文里要一字不差；编号原样保留；
   简洁、像中文书的标题；术语用你在 terms 里定的译法。
6. book_title：书名（document.title）的中文译名，不带书名号；书名就是某个标题时，那个标题的译文和它一字不差。
   封面、书名页、页眉上的书名都按它统一。document.title 是空的就交空串。
"""

READER_TOOL = {
    "name": "submit_reading",
    "description": "交回通读结果：体裁、人名规则、文风说明、全文统一的术语和专名、全部标题的译文。",
    "input_schema": {
        "type": "object",
        "properties": {
            "genre": {"type": "string", "enum": GENRES},
            "domain": {"type": "string"},
            "name_policy": {"type": "string", "enum": ["keep", "transliterate"]},
            "style": {"type": "string", "description": "给译者的文风说明，300 字以内"},
            "terms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source": {"type": "string"},
                        "target": {"type": "string"},
                        "category": {"type": "string", "enum": ["term", "keep", "name"]},
                        "chapters": {"type": "array", "items": {"type": "string"}, "description": "只管哪几章；全书统一就不写"},
                        "note": {"type": "string"},
                    },
                    "required": ["source", "target", "category"],
                },
            },
            "headings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"id": {"type": "string"}, "translation": {"type": "string"}},
                    "required": ["id", "translation"],
                },
            },
            "book_title": {"type": "string", "description": "书名的中文译名，不带书名号"},
        },
        # book_title 必填：可选时 haiku 常常不交（11-20 实测）
        "required": ["genre", "name_policy", "style", "terms", "headings", "book_title"],
    },
}

HEADING_CLASSES = {"section_heading", "toc_entry"}
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*[A-Za-z]|[A-Za-z]")
# 大写开头、连着的几个词（人名、机构、产品）；句首的单个大写词不算
CAP_RE = re.compile(r"\b[A-Z][\w'-]*(?:\s+(?:(?:of|de|von|van|der|la|le|du)\s+)?[A-Z][\w'-]*)*")
STOPWORDS = set(
    """a about above after again against all almost also although always am among an and another any are as at be because been before
    being below between both but by can could did do does doing done down during each either else enough even ever every few for from
    further had has have having he her here hers herself him himself his how however i if in into is it its itself just less like
    many may me might more most much must my myself neither never no nor not now of off often on once one only or other others our
    ours ourselves out over own per perhaps rather same she should since so some such than that the their theirs them themselves then
    there these they this those though through thus to too toward towards under until up upon us very was we were what when where
    whether which while who whom whose why will with within without would yet you your yours yourself first second third new two three
    four five six seven eight nine ten many several page pages make makes made use used uses using way ways well also still even
    figure table section chapter example see eq fig something anything nothing say says said cannot back read run start create copy
    running single get gets got take takes give gives part parts kind sort thing things time times later finally today
    instead indeed meanwhile""".split()
)


@dataclass
class Reading:
    genre: str = "other"
    domain: str = ""
    name_policy: str = "keep"
    style: str = ""
    terms: list[dict] = field(default_factory=list)
    headings: dict[str, str] = field(default_factory=dict)  # 块 id → 译文
    book_title: str = ""  # 书名的中文译名（2026-11-20）：封面、书名页、页眉上的书名统一用它
    title_source: str = ""  # 定译名时的原书名
    candidates: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Reading":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def style_text(self) -> str:
        """放进每页上下文包的文风说明：体裁、人名规则、通读员写的说明。"""
        policy = "人名全书第一次写“中文译名（原文）”，之后只写中文译名" if self.name_policy == "transliterate" else "人名保留原文"
        return f"体裁：{self.genre}（{self.domain}）。{policy}。{self.style}".strip()


def _sentences(pages: list[PageInput]):
    for page in pages:
        for block in page.to_translate():
            if block.cls in HEADING_CLASSES:
                continue
            yield page.chapter, block.text


def candidate_phrases(pages: list[PageInput], *, limit: int = MAX_CANDIDATES) -> list[dict]:
    """全文反复出现的词组和专名，按（次数 × 词数）排，每个附 1–2 句原文。"""
    counts: Counter = Counter()
    chapters: dict[str, set[str]] = {}
    proper: Counter = Counter()
    texts = list(_sentences(pages))
    # 全文里以小写出现过的词：句首大写的这种词是普通词，不是专名的一部分
    lowercase = {w for _, text in texts for w in WORD_RE.findall(text) if w.islower()}
    for chapter, text in texts:
        plain = _strip_protected(text)
        words = [w.lower() for w in WORD_RE.findall(plain)]
        for size in (1, 2, 3):
            for i in range(len(words) - size + 1):
                gram = words[i : i + size]
                if gram[0] in STOPWORDS or gram[-1] in STOPWORDS or any(len(w) < 3 for w in gram):
                    continue
                key = " ".join(gram)
                counts[key] += 1
                chapters.setdefault(key, set()).add(chapter)
        for match in CAP_RE.finditer(plain):
            words = match.group(0).split()
            at_sentence_start = match.start() == 0 or plain[: match.start()].rstrip()[-1:] in ".!?:\"'“‘"
            while words and (words[0].lower() in STOPWORDS or (at_sentence_start and words[0].lower() in lowercase)):
                words.pop(0)
            if not words or (at_sentence_start and len(words) == 1 and words[0] == match.group(0)):
                continue
            name = re.sub(r"['’]s$", "", " ".join(words))
            if len(name) > 2:
                proper[name] += 1
                chapters.setdefault(name, set()).add(chapter)
    picked: list[tuple[float, str, int]] = []
    for key, count in counts.items():
        size = key.count(" ") + 1
        if (size == 1 and count >= 5) or (size > 1 and count >= 3):
            picked.append((count * size, key, count))
    for name, count in proper.items():
        if count >= 2:
            picked.append((count * 2.5, name, count))
    picked.sort(key=lambda item: -item[0])
    # 被更长的词组盖住、次数差不多的短词组去掉（"bounding" 和 "bounding box"）
    chosen: list[tuple[str, int]] = []
    for _, key, count in picked:
        if any(key.lower() in longer.lower() and other >= count * 0.8 for longer, other in chosen if longer != key):
            continue
        chosen.append((key, count))
        if len(chosen) >= limit:
            break
    out = []
    for key, count in chosen:
        examples, seen_chapters = [], set()
        for chapter, text in texts:
            if chapter in seen_chapters:
                continue
            quote = quote_around(text, key)
            if quote:
                examples.append({"chapter": chapter, "text": quote[:200]})
                seen_chapters.add(chapter)
            if len(examples) >= 2:
                break
        if examples:
            out.append({"phrase": key, "count": count, "chapters": len(chapters.get(key, ())), "examples": examples})
    return out


def same_text_key(text: str) -> str:
    """判断「同一句原文」用：不分大小写、不计标点和空白（"THE INTERLOPER" 和 "The Interloper" 算一句）。"""
    return " ".join(re.sub(r"[^\w\s]", " ", str(text or "").casefold()).split())


def _title_keys(title: str) -> set[str]:
    """书名和冒号前的主标题（"The Interloper: Inside …" 封面上常只印 "The Interloper"）。"""
    keys = {same_text_key(title)}
    main = re.split(r"\s*[:：]\s*", str(title or ""), maxsplit=1)[0]
    keys.add(same_text_key(main))
    return {key for key in keys if key}


def heading_records(pages: list[PageInput]) -> list[dict]:
    out = []
    for page in pages:
        for block in page.blocks:
            if block.translate and block.cls in HEADING_CLASSES:
                record = {"id": block.id, "class": block.cls, "text": block.text, "chapter": page.chapter}
                if block.attributes.get("level"):
                    record["level"] = block.attributes["level"]
                out.append(record)
    return out


# 样张不取的部分：标题是这些的，到下一个标题为止（前后附属的内容，判体裁、写文风用不上）
SIDE_MATTER = {
    "contents", "table of contents", "acknowledgments", "acknowledgements", "acknowledgment", "acknowledgement", "copyright",
    "dedication", "about the author", "about the authors", "also by", "praise for", "list of figures", "list of tables",
    "list of illustrations", "abbreviations",
}
BACK_MATTER = {"notes", "endnotes", "references", "bibliography", "works cited", "index", "glossary", "appendix"}  # 遇到就跳到书尾
SIDE_LINE_RE = re.compile(r"©|\bcopyright\b|\ball rights reserved\b|\bisbn\b|library of congress|cataloging-in-publication|printed in", re.I)
# 长的书在正文里从哪几处开始取（按段数的比例），各取 limit / 3。第一处不从 0 开始：封底推荐语、作者介绍、出版说明
# 这些前面的附属内容常常没有统一的标题，按标题排不干净（11-20 看了 4 本，从 0 开始取到的都是这些）
SAMPLE_SPOTS = (0.08, 0.4, 0.7)
# 同文同译只管短块（标题、书名、页眉这种），长段落不会和标题一字不差
SAME_TEXT_MAX_WORDS = 16
LONG_PARAGRAPH_WORDS = 60


def body_paragraphs(pages: list[PageInput]) -> list[str]:
    """正文段落：跳过标题是目录、致谢、版权、注释、参考文献、索引之类的部分，和带版权声明、ISBN 的段。"""
    out: list[str] = []
    skipping = False
    for page in pages:
        for block in page.blocks:
            if block.cls in HEADING_CLASSES or block.cls in ("title", "heading"):
                name = " ".join(re.sub(r"[^a-z ]+", " ", block.text.lower()).split())
                if name in BACK_MATTER and out:
                    return out  # 注释、参考文献、索引在书后：后面都不算正文（尾注里还按章分小标题，不能遇到下一个标题就停止跳过）
                skipping = name in SIDE_MATTER
                continue
            if skipping or not block.translate or SIDE_LINE_RE.search(block.text):
                continue
            out.append(block.text)
    return out


def sample_text(pages: list[PageInput], limit: int = SAMPLE_CHARS) -> str:
    """给通读员的样张：正文开头、四成处、七成五处各取 limit / 3 字（2026-11-20）。以前从第一段起连取 limit 字，
    出版社的书常常取到的是版权页、目录、致谢，判体裁、写文风都靠这一页。正文太少（短文、论文）时就从头连取。"""
    paragraphs = body_paragraphs(pages) or [text for _, text in _sentences(pages)]
    # 书名页、作者、版次这些短行不算正文：从第一段长段落开始
    first_long = next((i for i, text in enumerate(paragraphs) if len(text.split()) >= LONG_PARAGRAPH_WORDS), 0)
    paragraphs = paragraphs[first_long:]
    total = sum(len(p) for p in paragraphs)
    spots = SAMPLE_SPOTS if total > limit * 2 else (0.0,)
    share = limit // len(spots)
    out: list[str] = []
    for spot in spots:
        used = 0
        for text in paragraphs[int(len(paragraphs) * spot):]:
            if used >= share:
                break
            out.append(text[: share - used])
            used += len(out[-1])
        if len(spots) > 1:
            out.append("……")
    return "\n\n".join(out[:-1] if out and out[-1] == "……" else out)


def read_document(agent, pages: list[PageInput], *, document: dict | None = None) -> Reading:
    """通读整篇，交回 `Reading`。候选、标题太多时分几次请求，体裁和文风取第一次的。"""
    from retainpdf_translation_agent.agent import ROLE_READER

    candidates = candidate_phrases(pages)
    # 原文相同的标题只问一次（以前按块问，分批时封面、书名页、目录里同一句可能落在不同批，译法各不相同）
    # 一组里有正文标题就拿它去问（目录条目跟着正文标题走）
    groups: dict[str, list[dict]] = {}
    for record in heading_records(pages):
        groups.setdefault(same_text_key(record["text"]), []).append(record)
    same_text = {key: [record["id"] for record in records] for key, records in groups.items()}
    headings = [next((r for r in records if r["class"] != "toc_entry"), records[0]) for records in groups.values()]
    sample = sample_text(pages)
    reading = Reading(candidates=len(candidates))
    batches = max(1, -(-len(headings) // MAX_HEADINGS))
    for index in range(batches):
        payload = {
            "document": document or (pages[0].document if pages else {}),
            "headings": headings[index * MAX_HEADINGS : (index + 1) * MAX_HEADINGS],
        }
        if index == 0:
            payload.update(sample=sample, candidates=candidates)
        else:
            payload["note"] = f"这是第 {index + 1} 批标题。体裁是 {reading.genre}，文风说明：{reading.style}；只需交回 headings，其余字段照填。"
        data = agent.call_tool(payload, system=READER_PROMPT, tool=READER_TOOL, role=ROLE_READER, label=f"read {index + 1}/{batches}")
        if index == 0:
            reading.genre = str(data.get("genre") or "other")
            reading.domain = str(data.get("domain") or "")
            reading.name_policy = "transliterate" if data.get("name_policy") == "transliterate" else "keep"
            reading.style = str(data.get("style") or "")[:600]
            reading.terms = [t for t in data.get("terms") or [] if isinstance(t, dict) and t.get("source") and t.get("target")]
            reading.book_title = str(data.get("book_title") or "").strip().strip("《》").strip()
            reading.title_source = str((payload["document"] or {}).get("title") or "").strip()
        known = {h["id"]: h["text"] for h in headings}
        for item in data.get("headings") or []:
            if isinstance(item, dict) and item.get("id") in known and str(item.get("translation") or "").strip():
                for block_id in same_text[same_text_key(known[item["id"]])]:
                    reading.headings[block_id] = str(item["translation"]).strip()
    return reading


def apply_reading(reading: Reading, glossary, pages: list[PageInput]) -> list[PageInput]:
    """把通读结果登记进术语表（审定，按章的只管那几章），标题和目录条目的译法变成"已定好的译文"，返回改过的页。

    目录条目和它指向的标题原文一样时，直接用标题的译文（一字不差）。标题译文过不了校验（丢了编号、公式）的不定，留给逐页翻。
    """
    from dataclasses import replace

    from retainpdf_translation_agent.checks import check_block
    from retainpdf_translation_agent.memory import ABBR
    from retainpdf_translation_agent.memory import KEEP
    from retainpdf_translation_agent.memory import NAME
    from retainpdf_translation_agent.memory import TERM

    chapters = {p.chapter for p in pages if p.chapter}
    for item in reading.terms:
        source = str(item["source"]).strip()
        # 译法里不许带括号说明："参考（标注）" → "参考"
        target = re.sub(r"\s*[（(][^（）()]*[)）]", "", str(item["target"])).strip()
        if not source or not target:
            continue
        category = {"keep": KEEP, "name": NAME}.get(item.get("category"), TERM)
        if category == NAME and reading.name_policy != "transliterate":
            category = KEEP
        if category == KEEP:
            target = source
        if glossary.find(source, "", category=ABBR) is not None:
            continue  # 缩写由程序登记
        scope = [c for c in item.get("chapters") or [] if c in chapters]
        glossary.add(source, target, category=category, status="approved", scope=scope, reason="翻译前通读", note=str(item.get("note") or "")[:120])

    blocks = {b.id: b for p in pages for b in p.blocks}
    title_keys = _title_keys(reading.title_source) if reading.book_title else set()
    # 书名不进术语表：术语匹配不分大小写，书名是普通词组（"The Gift"）时会把正文里的 the gift 也锁成书名译法
    fixed: dict[str, str] = {}
    for block_id, translation in reading.headings.items():
        block = blocks.get(block_id)
        if block is not None and same_text_key(block.text) in title_keys:
            translation = reading.book_title  # 书名做标题时和书名译名一字不差
        # 标题丢了编号也不行（"1 The Ledger" 译成"账簿"）
        if block is not None and not any(i["severity"] == "error" or i["code"] == "number_lost" for i in check_block(block.text, translation)):
            fixed[block_id] = translation
    for block in blocks.values():
        target = blocks.get(block.relations.get("toc_target", "")) if block.cls == "toc_entry" else None
        if target is not None and target.id in fixed and " ".join(target.text.split()) == " ".join(block.text.split()):
            fixed[block.id] = fixed[target.id]
    # 同文同译（2026-11-20）：原文和某个已定标题、或和书名一样的短块（书名页上被认成正文的大写书名 "THE INTERLOPER"、
    # 页眉上的书名、章名），直接用同一个译文。《The Interloper》以前封面、目录是「闯入者」，书名页是「不速之客」。
    by_text: dict[str, str] = {key: reading.book_title for key in title_keys}
    for block_id, translation in fixed.items():
        by_text.setdefault(same_text_key(blocks[block_id].text), translation)
    for block in blocks.values():
        if block.id in fixed or not block.translate or len(block.text.split()) > SAME_TEXT_MAX_WORDS:
            continue
        translation = by_text.get(same_text_key(block.text))
        if translation and not any(i["severity"] == "error" for i in check_block(block.text, translation)):
            fixed[block.id] = translation
    # 调用方已经定了的（目录 agent 给目录条目和对上的标题，2026-11-25）不改：目录和正文按它对齐
    return [
        replace(page, blocks=[
            replace(b, fixed_translation=fixed[b.id]) if b.id in fixed and b.translate and b.fixed_translation is None else b
            for b in page.blocks
        ])
        for page in pages
    ]
