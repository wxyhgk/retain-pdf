"""RetainPDF 自己的块分类（草案 v0，2026-10-29）。

和任何一家 OCR 服务商的标签无关：先定"一个块在文档里是什么"，各家的标签以后再映射过来。
查看器的图例、颜色、点开框看到的定义都从这里读，改分类只改这个文件。

每个块只有一个类别（`BLOCK_CLASSES` 的键）。另外两样和类别分开记：
- 区（`ZONES`）：块在文档的哪一段。同一个"章节标题"，在正文里和在参考文献里，翻不翻可能不一样，所以区单独记，不做成新类别。
- 关系（`RELATIONS`）：图注属于哪张图、脚注挂在哪个标记上、段落接到哪一段。

行内的东西（行内公式、脚注标记、引用标记）不是块，是块里的片段，见 `INLINE_CLASSES`。
"""

from __future__ import annotations

# 大类只用来分组和配色，判断时看类别。
GROUPS: dict[str, dict] = {
    "page": {"label": "版面", "color": "#7b8494", "note": "每页重复的页眉、页脚、页码，不属于正文内容"},
    "front": {"label": "前言", "color": "#9a5bd6", "note": "标题、作者、机构、摘要、关键词这些文章开头的东西"},
    "heading": {"label": "标题", "color": "#d6457a", "note": "章、节、小节的标题，带级别"},
    "body": {"label": "正文", "color": "#2f6fe0", "note": "段落、列表、目录条目"},
    "float": {"label": "图表", "color": "#14918a", "note": "图、表、代码块和它们的题注、表注"},
    "math": {"label": "公式", "color": "#c7781a", "note": "行间公式和公式编号"},
    "note": {"label": "注释", "color": "#b5562f", "note": "页脚的脚注"},
    "back": {"label": "文末", "color": "#5f8a1e", "note": "致谢、参考文献条目"},
    "unknown": {"label": "未知", "color": "#a0a0a0", "note": "认不出来的块，留着给人看"},
}

# kind：内容载体（文字、图片、表格、公式、代码），决定能不能抽文字。
# translate：默认翻不翻；None 表示还没定，`question` 里写着要定什么。
BLOCK_CLASSES: dict[str, dict] = {
    "running_header": {"label": "页眉", "group": "page", "kind": "text", "translate": False},
    "running_footer": {"label": "页脚", "group": "page", "kind": "text", "translate": False},
    "page_number": {"label": "页码", "group": "page", "kind": "text", "translate": False},
    "doc_title": {
        "label": "文档标题",
        "group": "front",
        "kind": "text",
        "translate": None,
        "question": "文档标题翻不翻？现在 MinerU、Paddle 翻，命令型 OCR 不翻",
    },
    "author": {"label": "作者", "group": "front", "kind": "text", "translate": False},
    "affiliation": {"label": "机构", "group": "front", "kind": "text", "translate": False},
    "publication_info": {
        "label": "出版信息",
        "group": "front",
        "kind": "text",
        "translate": False,
        "note": "期刊名、卷期、日期、DOI、收稿日期",
    },
    "abstract": {"label": "摘要", "group": "front", "kind": "text", "translate": True},
    "keywords": {
        "label": "关键词",
        "group": "front",
        "kind": "text",
        "translate": None,
        "question": "关键词翻不翻？翻的话按词翻，不按句子",
    },
    "section_heading": {
        "label": "章节标题",
        "group": "heading",
        "kind": "text",
        "translate": True,
        "attributes": ["level"],
        "note": "level 1 是章，2 是节，3 是小节；“摘要”“参考文献”这类标题也是它，靠区区分",
    },
    "paragraph": {"label": "段落", "group": "body", "kind": "text", "translate": True},
    "list_item": {
        "label": "列表项",
        "group": "body",
        "kind": "text",
        "translate": True,
        "note": "每一项一个块，项目符号或编号留在文字里",
    },
    "toc_entry": {"label": "目录条目", "group": "body", "kind": "text", "translate": True},
    "figure": {"label": "图", "group": "float", "kind": "image", "translate": False},
    "figure_caption": {"label": "图注", "group": "float", "kind": "text", "translate": True},
    "table": {"label": "表", "group": "float", "kind": "table", "translate": False},
    "table_caption": {"label": "表题", "group": "float", "kind": "text", "translate": True},
    "table_note": {
        "label": "表注",
        "group": "float",
        "kind": "text",
        "translate": True,
        "note": "表格下方对表格的说明，带 † * a 之类的标记",
    },
    "code_block": {"label": "代码块", "group": "float", "kind": "code", "translate": False},
    "code_caption": {"label": "代码题注", "group": "float", "kind": "text", "translate": True},
    "display_formula": {"label": "行间公式", "group": "math", "kind": "formula", "translate": False},
    "formula_number": {"label": "公式编号", "group": "math", "kind": "text", "translate": False},
    "footnote": {"label": "脚注", "group": "note", "kind": "text", "translate": True},
    "acknowledgement": {"label": "致谢", "group": "back", "kind": "text", "translate": True},
    "reference_entry": {
        "label": "参考文献条目",
        "group": "back",
        "kind": "text",
        "translate": False,
        "note": "每条一个块",
    },
    "unknown": {"label": "未知", "group": "unknown", "kind": "unknown", "translate": False},
}

ZONES: dict[str, dict] = {
    "front_matter": {"label": "前言区", "note": "从文档开头到正文第一个章节标题"},
    "body": {"label": "正文区", "note": "正文章节"},
    "back_matter": {"label": "文末区", "note": "致谢、参考文献、附录"},
    "page_furniture": {"label": "版面", "note": "页眉、页脚、页码，不属于任何区"},
}

# from：哪些类别能发出这条关系；to：能指向哪些类别。
RELATIONS: dict[str, dict] = {
    "caption_of": {
        "label": "题注属于",
        "from": ["figure_caption", "table_caption", "code_caption"],
        "to": ["figure", "table", "code_block"],
        "note": "一个题注可以属于多张子图",
    },
    "note_of": {"label": "注释属于", "from": ["table_note", "footnote"], "to": ["table", "paragraph", "list_item", "abstract", "figure_caption"]},
    "number_of": {"label": "编号属于", "from": ["formula_number"], "to": ["display_formula"]},
    "continues": {
        "label": "接续上一块",
        "from": ["paragraph", "list_item", "reference_entry", "footnote"],
        "to": ["paragraph", "list_item", "reference_entry", "footnote"],
        "note": "跨栏、跨页没写完的段落，指向它的前半段",
    },
}

INLINE_CLASSES: dict[str, dict] = {
    "inline_formula": {"label": "行内公式", "translate": False, "note": "原样保留，译文里放回原位"},
    "footnote_mark": {"label": "脚注标记", "translate": False, "note": "正文里的上标数字或符号，指向脚注"},
    "citation": {"label": "引用标记", "translate": False, "note": "[1]、(Smith, 2020) 这类"},
}

TAXONOMY_VERSION = "draft-0"


def taxonomy_payload() -> dict:
    """查看器嵌进页面的完整分类表。"""
    return {
        "version": TAXONOMY_VERSION,
        "groups": GROUPS,
        "block_classes": BLOCK_CLASSES,
        "zones": ZONES,
        "relations": RELATIONS,
        "inline_classes": INLINE_CLASSES,
    }


def check_taxonomy() -> list[str]:
    """分类表自己的一致性：大类、关系两端都要存在。"""
    errors: list[str] = []
    for name, spec in BLOCK_CLASSES.items():
        if spec["group"] not in GROUPS:
            errors.append(f"{name}: unknown group {spec['group']}")
        if spec["translate"] is None and not spec.get("question"):
            errors.append(f"{name}: translate is undecided but no question is recorded")
    for name, spec in RELATIONS.items():
        for end in ("from", "to"):
            for cls in spec[end]:
                if cls not in BLOCK_CLASSES:
                    errors.append(f"relation {name}.{end}: unknown class {cls}")
    return errors
