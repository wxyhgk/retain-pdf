"""长样例的指标：按 `long_book.py` 里的探针，在译文里数术语、专名、缩写、语气、跨章引用对不对。

都是程序能数的硬指标，不用模型打分。输入是测试系统的结果 `blocks`（按阅读顺序，每块有 source、translation、chapter）。
"""

from __future__ import annotations

import re
from collections import Counter

from retainpdf_translation_agent.checks import HEDGE_RE
from retainpdf_translation_agent.checks import HEDGE_ZH
from retainpdf_translation_agent.checks import WE_RE
from retainpdf_translation_agent.checks import WE_ZH
from retainpdf_translation_agent.memory import term_pattern

from devtools.agent_lab import long_book

CJK = r"[一-鿿]"


def _rate(good: int, total: int) -> float | None:
    return round(good / total, 3) if total else None


def _variant(translation: str, variants: list[str]) -> str | None:
    for variant in sorted(variants, key=len, reverse=True):
        if variant in translation:
            return variant
    return None


def compute(blocks: list[dict]) -> dict:
    """`blocks`：[{id, source, translation, chapter, translate}]，按阅读顺序。chapter 是一级标题的块 id（`h-ch2`）。"""
    done = [b for b in blocks if b.get("translate") and b.get("translation")]
    out: dict = {"blocks": len(done)}

    # 跨章同一术语：认出来的译法里，最常用那种占多少
    terms = {}
    for term, variants in long_book.TERM_PROBES.items():
        pattern = term_pattern(term, "term")
        seen = [(b["chapter"], _variant(b["translation"], variants)) for b in done if pattern.search(b["source"])]
        counts = Counter(v for _, v in seen if v)
        top = counts.most_common(1)[0] if counts else (None, 0)
        terms[term] = {
            "occurrences": len(seen),
            "consistency": _rate(top[1], sum(counts.values())),
            "main": top[0],
            "variants": dict(counts),
            "unrecognized": sum(1 for _, v in seen if not v),
            "chapters": len({c for c, _ in seen}),
        }
    rates = [t["consistency"] for t in terms.values() if t["consistency"] is not None]
    out["term_consistency"] = round(sum(rates) / len(rates), 3) if rates else None
    out["terms"] = terms

    # 同词异义：每章该用的译法
    polysemy = {}
    good = total = 0
    for term, by_chapter in long_book.POLYSEMY_PROBES.items():
        pattern = term_pattern(term, "term")
        for chapter, expected in by_chapter.items():
            wrong = long_book.POLYSEMY_WRONG.get(term, {}).get(chapter, [])
            hits = [b for b in done if b["chapter"] == f"h-{chapter}" and pattern.search(b["source"])]
            ok = [b["id"] for b in hits if _variant(b["translation"], expected) and not _variant(b["translation"], wrong)]
            polysemy[f"{term}@{chapter}"] = {"occurrences": len(hits), "correct": len(ok), "wrong": sorted({b["id"] for b in hits} - set(ok))}
            good, total = good + len(ok), total + len(hits)
    out["polysemy_accuracy"] = _rate(good, total)
    out["polysemy"] = polysemy

    # 保留原文
    keep_good = keep_total = 0
    keep_missed: list[str] = []
    for name in long_book.KEEP_PROBES:
        for b in done:
            if re.search(rf"(?<![\w-]){re.escape(name)}(?![\w-])", b["source"]):
                keep_total += 1
                if name in b["translation"]:
                    keep_good += 1
                else:
                    keep_missed.append(f"{name}@{b['id']}")
    out["keep_original"] = _rate(keep_good, keep_total)
    out["keep_missed"] = keep_missed

    # 缩写：全书第一次出现译成"中文（缩写）"，之后保留缩写
    abbreviations = {}
    for abbr in long_book.ABBR_PROBES:
        pattern = term_pattern(abbr, "abbr")
        hits = [b for b in done if pattern.search(b["source"])]
        first = hits[0] if hits else None
        bracketed = bool(first and re.search(rf"{CJK}\s*[（(][^（()）]*\b{re.escape(abbr)}\b[^（()）]*[)）]", first["translation"]))
        later = hits[1:]
        abbreviations[abbr] = {
            "first_block": first["id"] if first else None,
            "first_use_bracketed": bracketed,
            "later_kept": _rate(sum(1 for b in later if abbr in b["translation"]), len(later)),
        }
    out["abbr_first_use"] = _rate(sum(1 for a in abbreviations.values() if a["first_use_bracketed"]), len(abbreviations))
    out["abbreviations"] = abbreviations

    # 语气：表示保留的词、第一人称
    hedged = [b for b in done if HEDGE_RE.search(b["source"])]
    out["hedge_retention"] = _rate(sum(1 for b in hedged if any(w in b["translation"] for w in HEDGE_ZH)), len(hedged))
    out["hedge_lost"] = [b["id"] for b in hedged if not any(w in b["translation"] for w in HEDGE_ZH)]
    personal = [b for b in done if WE_RE.search(b["source"])]
    out["person_retention"] = _rate(sum(1 for b in personal if any(w in b["translation"] for w in WE_ZH)), len(personal))

    # 跨章引用
    ref_good = ref_total = 0
    ref_missed: list[str] = []
    for source, target in long_book.CROSS_REF_PROBES.items():
        for b in done:
            if source in b["source"]:
                ref_total += 1
                if re.search(target, b["translation"]):
                    ref_good += 1
                else:
                    ref_missed.append(f"{source}@{b['id']}")
    out["cross_refs"] = _rate(ref_good, ref_total)
    out["cross_ref_missed"] = ref_missed
    return out


HEADLINE = [
    ("term_consistency", "术语一致率"),
    ("polysemy_accuracy", "同词异义按章正确率"),
    ("keep_original", "保留原文正确率"),
    ("abbr_first_use", "缩写首次括注率"),
    ("hedge_retention", "语气词保留率"),
    ("person_retention", "人称保留率"),
    ("cross_refs", "跨章引用正确率"),
]


def headline(metrics: dict) -> list[dict]:
    """报告里显示的一排数字。"""
    return [{"key": key, "label": label, "value": metrics.get(key)} for key, label in HEADLINE]
