"""译前术语预扫：按批并发调用模型抽术语，逐批落 checkpoint。

一批的结果只要成功就立即持久化（见 PrescanBatchStore 协议），中断后续跑只补
没完成的批。批的复用条件是「请求内容的指纹」完全一致：切批、提示词、锁定术语、
领域标签任何一项变了，旧结果都不再算数。

模型给出的候选在这里先过一遍确定性过滤（数学符号/变量、泛学术词、原文里不存在
的词、明显不是名词短语的译法），过滤后的结果才写进 checkpoint；多数票在
term_base.py 里做。
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import hashlib
import json
import re
import threading
import time
from typing import Any
from typing import Callable
from typing import Protocol

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import matched_glossary_entries
from retainpdf_pipeline.translate.llm.shared.executor_context import unit_scope
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.shared.structured_output import parse_structured_json
from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.memory.filters import looks_like_useful_term_key
from retainpdf_pipeline.translate.services.memory.filters import term_key_matches_source
from retainpdf_pipeline.translate.services.memory.text import clean_term_key
from retainpdf_pipeline.translate.services.memory.text import clean_term_value
from retainpdf_pipeline.translate.services.preparation.segments import PrescanBatch

PRESCAN_PROMPT_VERSION = "term-prescan-v1"
PRESCAN_REQUEST_TIMEOUT_SECS = 60
PRESCAN_MAX_WORKERS = 8
PRESCAN_MAX_TERM_WORDS = 6

TERM_PRESCAN_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "term_prescan_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "terms": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "source": {"type": "string"},
                            "target": {"type": "string"},
                            "kind": {"type": "string"},
                        },
                        "required": ["source", "target", "kind"],
                    },
                },
            },
            "required": ["terms"],
        },
    },
}

# 泛学术词：单独出现时不算术语。只拦「整个候选就是这个词」（去掉冠词之后），
# 不拦含有它的短语——"harmonic oscillator model" 仍然可以是术语。
GENERIC_ACADEMIC_WORDS = frozenset(
    {
        "analysis", "answer", "appendix", "approach", "approaches", "article", "aspect",
        "assumption", "case", "cases", "chapter", "conclusion", "conclusions", "condition",
        "conditions", "data", "definition", "discussion", "effect", "effects", "equation",
        "equations", "example", "examples", "experiment", "experiments", "expression", "fact",
        "factor", "figure", "figures", "form", "formula", "function", "functions", "introduction",
        "literature", "method", "methods", "model", "models", "number", "numbers", "order",
        "paper", "parameter", "parameters", "part", "point", "problem", "problems", "process",
        "property", "properties", "quantity", "question", "reference", "references", "relation",
        "research", "result", "results", "section", "sections", "set", "solution", "solutions",
        "study", "studies", "summary", "system", "systems", "table", "tables", "term", "terms",
        "theory", "type", "types", "value", "values", "variable", "variables", "way", "work",
    }
)
_GREEK_LETTER_NAMES = frozenset(
    {
        "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa",
        "lambda", "mu", "nu", "xi", "omicron", "pi", "rho", "sigma", "tau", "upsilon", "phi",
        "chi", "psi", "omega",
    }
)
_LEADING_ARTICLE_RE = re.compile(r"^(?:the|a|an)\s+", re.I)
_MATH_CHAR_RE = re.compile(r"[$\\^_{}=<>|~∑∫√±×÷∂∇≈≠≤≥]")
_SHORT_VARIABLE_RE = re.compile(r"^[a-z][A-Za-z0-9]?$")
_FUNCTION_CALL_RE = re.compile(r"^[A-Za-z]{1,3}\s*\(.*\)$")
_CROSS_REF_RE = re.compile(
    r"^(?:fig(?:ure)?s?|eqs?|equations?|tables?|sections?|sec|chapters?|ch|refs?|appendix)\.?\s*[\d(\[]",
    re.I,
)
_SENTENCE_PUNCT_RE = re.compile(r"[，。；！？!?;]")
_CJK_RE = re.compile(r"[㐀-鿿豈-﫿]")


@dataclass(frozen=True)
class PrescanTerm:
    source: str
    target: str
    kind: str

    def as_dict(self) -> dict[str, str]:
        return {"source": self.source, "target": self.target, "kind": self.kind}


@dataclass(frozen=True)
class PrescanBatchResult:
    batch_id: str
    terms: tuple[PrescanTerm, ...]
    reused: bool = False
    error: str = ""

    @property
    def ok(self) -> bool:
        return not self.error


class PrescanBatchStore(Protocol):
    """逐批结果的持久化（实现见 workflow/checkpoint/preparation.py）。"""

    def load_batch(self, batch_id: str, *, request_sha256: str) -> list[dict[str, Any]] | None: ...

    def save_batch(self, batch_id: str, *, request_sha256: str, terms: list[dict[str, Any]]) -> None: ...


RequestFn = Callable[..., str]


def is_rejected_term_source(source: str) -> bool:
    """确定性的「这不是术语」判定：数学符号、变量、交叉引用编号、泛学术词。"""
    raw = " ".join(str(source or "").split())
    # 先看清洗前的原样：clean_term_key 会剥掉首尾括号，"f(x)" 洗完是 "f(x"。
    if _FUNCTION_CALL_RE.match(raw) or _MATH_CHAR_RE.search(raw):
        return True
    cleaned = clean_term_key(source)
    if not looks_like_useful_term_key(cleaned):
        return True
    if cleaned.count("(") != cleaned.count(")"):
        return True
    if "[math]" in cleaned.lower() or _MATH_CHAR_RE.search(cleaned):
        return True
    if _SHORT_VARIABLE_RE.match(cleaned) or _FUNCTION_CALL_RE.match(cleaned):
        return True
    if _CROSS_REF_RE.match(cleaned):
        return True
    non_space = [ch for ch in cleaned if not ch.isspace()]
    letters = [ch for ch in non_space if ch.isalpha()]
    if not non_space or len(letters) * 2 < len(non_space):
        return True
    bare = _LEADING_ARTICLE_RE.sub("", cleaned).strip()
    folded = bare.casefold()
    if folded in GENERIC_ACADEMIC_WORDS or folded in _GREEK_LETTER_NAMES:
        return True
    if len(bare.split()) > PRESCAN_MAX_TERM_WORDS:
        return True
    return False


def is_acceptable_term_target(source: str, target: str, *, target_lang: str) -> bool:
    cleaned = clean_term_value(target)
    if not cleaned or len(cleaned) > 40 or _SENTENCE_PUNCT_RE.search(cleaned):
        return False
    if cleaned.casefold() == clean_term_key(source).casefold():
        # 原文照录（软件名、数据集名、没有通行译名的人名）是合法译法。
        return True
    if str(target_lang or "").strip().lower().startswith("zh"):
        return bool(_CJK_RE.search(cleaned))
    return True


def filter_prescan_terms(
    raw_terms: list[dict[str, Any]],
    *,
    batch_text: str,
    target_lang: str,
) -> list[PrescanTerm]:
    accepted: list[PrescanTerm] = []
    seen: set[str] = set()
    for raw in raw_terms:
        if not isinstance(raw, dict):
            continue
        source = clean_term_key(str(raw.get("source", "") or ""))
        target = clean_term_value(str(raw.get("target", "") or ""))
        if not source or is_rejected_term_source(source):
            continue
        if not term_key_matches_source(source, batch_text):
            continue
        if not is_acceptable_term_target(source, target, target_lang=target_lang):
            continue
        key = source.casefold()
        if key in seen:
            continue
        seen.add(key)
        kind = str(raw.get("kind", "") or "").strip().lower()
        accepted.append(
            PrescanTerm(
                source=source,
                target=target,
                kind=kind if kind in {"proper_noun", "domain_term"} else "domain_term",
            )
        )
    return accepted


def locked_terms_for_batch(user_entries: list[GlossaryEntry], batch_text: str) -> list[dict[str, str]]:
    locked = []
    for entry in matched_glossary_entries(user_entries, batch_text):
        target = entry.source if entry.level == "preserve" else entry.target
        locked.append({"source": entry.source, "target": target})
    return locked


def build_prescan_messages(
    batch: PrescanBatch,
    *,
    target_language_name: str,
    domain: str,
    locked_terms: list[dict[str, str]],
) -> list[dict[str, str]]:
    system = load_prompt("term_prescan_system.txt").replace("<<TARGET_LANGUAGE>>", target_language_name)
    user_payload: dict[str, Any] = {
        "task": load_prompt("term_prescan_task.txt"),
        "domain": domain,
        "locked_terms": locked_terms,
        "segments": [{"id": segment.segment_id, "text": segment.text} for segment in batch.segments],
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def request_sha256(messages: list[dict[str, str]], *, model: str) -> str:
    canonical = json.dumps(
        {"prompt_version": PRESCAN_PROMPT_VERSION, "model": model, "messages": messages},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def parse_prescan_response(content: str) -> list[dict[str, Any]]:
    payload = parse_structured_json(content)
    terms = payload.get("terms", []) if isinstance(payload, dict) else []
    return [item for item in terms if isinstance(item, dict)] if isinstance(terms, list) else []


def run_term_prescan(
    batches: list[PrescanBatch],
    *,
    store: PrescanBatchStore,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    target_lang: str,
    target_language_name: str,
    domain: str,
    user_entries: list[GlossaryEntry],
    request_fn: RequestFn | None = None,
) -> list[PrescanBatchResult]:
    """跑完全部批（已在 checkpoint 里的直接复用），按 batch 顺序返回结果。

    单批失败不会中断其余批，也不会写进 checkpoint——下次续跑会重新请求它。
    """
    request = request_fn or request_chat_content
    total = len(batches)
    started = time.perf_counter()
    lock = threading.Lock()
    finished = 0

    def report(done: int, reused: int) -> None:
        emit_stage_progress(
            stage="translation_prepare",
            substage="translation_prepare",
            message=f"译前术语预扫 {done}/{total} 批",
            progress_current=done,
            progress_total=total,
            elapsed_ms=int(round((time.perf_counter() - started) * 1000)),
            payload={
                "user_stage": "translation",
                "progress_unit": "step",
                "preparation_phase": "term_prescan",
                "reused_batch_count": reused,
            },
        )

    plans = []
    for batch in batches:
        batch_text = "\n".join(segment.text for segment in batch.segments)
        messages = build_prescan_messages(
            batch,
            target_language_name=target_language_name,
            domain=domain,
            locked_terms=locked_terms_for_batch(user_entries, batch_text),
        )
        plans.append((batch, batch_text, messages, request_sha256(messages, model=model)))

    results: dict[str, PrescanBatchResult] = {}
    pending = []
    for batch, batch_text, messages, digest in plans:
        stored = store.load_batch(batch.batch_id, request_sha256=digest)
        if stored is None:
            pending.append((batch, batch_text, messages, digest))
            continue
        results[batch.batch_id] = PrescanBatchResult(
            batch_id=batch.batch_id,
            terms=tuple(
                PrescanTerm(
                    source=str(item.get("source", "")),
                    target=str(item.get("target", "")),
                    kind=str(item.get("kind", "") or "domain_term"),
                )
                for item in stored
                if isinstance(item, dict)
            ),
            reused=True,
        )
    reused_count = len(results)
    finished = reused_count
    if pending:
        print(
            f"term-prescan: batches={total} reused={reused_count} pending={len(pending)}",
            flush=True,
        )

    def run_one(plan) -> PrescanBatchResult:
        nonlocal finished
        batch, batch_text, messages, digest = plan
        try:
            # 稳定的单元身份 = 请求内容指纹。Rust 执行器按它做幂等，续跑时同一批
            # 不会被当成新请求重复计费。
            with unit_scope("term_prescan", [digest]):
                content = request(
                    messages,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    temperature=0.0,
                    response_format=TERM_PRESCAN_RESPONSE_SCHEMA,
                    timeout=PRESCAN_REQUEST_TIMEOUT_SECS,
                    request_label=f"term-prescan {batch.batch_id}",
                    max_attempts=2,
                )
            terms = filter_prescan_terms(
                parse_prescan_response(content),
                batch_text=batch_text,
                target_lang=target_lang,
            )
        except Exception as exc:  # noqa: BLE001 - 单批失败只记录，续跑时重试
            print(f"term-prescan: {batch.batch_id} failed: {type(exc).__name__}: {exc}", flush=True)
            result = PrescanBatchResult(batch_id=batch.batch_id, terms=(), error=type(exc).__name__)
        else:
            with lock:
                store.save_batch(
                    batch.batch_id,
                    request_sha256=digest,
                    terms=[term.as_dict() for term in terms],
                )
            result = PrescanBatchResult(batch_id=batch.batch_id, terms=tuple(terms))
        with lock:
            finished += 1
            report(finished, reused_count)
        return result

    if pending:
        max_workers = max(1, min(int(workers or 1), PRESCAN_MAX_WORKERS, len(pending)))
        if max_workers == 1:
            computed = [run_one(plan) for plan in pending]
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                computed = list(executor.map(run_one, pending))
        for result in computed:
            results[result.batch_id] = result
    else:
        report(finished, reused_count)
    return [results[batch.batch_id] for batch in batches]


__all__ = [
    "GENERIC_ACADEMIC_WORDS",
    "PRESCAN_PROMPT_VERSION",
    "PrescanBatchResult",
    "PrescanBatchStore",
    "PrescanTerm",
    "TERM_PRESCAN_RESPONSE_SCHEMA",
    "build_prescan_messages",
    "filter_prescan_terms",
    "is_acceptable_term_target",
    "is_rejected_term_source",
    "locked_terms_for_batch",
    "parse_prescan_response",
    "request_sha256",
    "run_term_prescan",
]
