from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT


# 「本块该用哪段源文本」的 reader 门禁 —— translation_field_writers.py 的对偶。
#
# 背景:payload item 上同时挂着四个源文本键,它们**不是彼此的备选,是四个不同的范围**:
#
#   source_text                             OCR 切出来的这一块,可能只有半句
#   protected_source_text                   同一块,公式已换成占位符
#   group_protected_source_text             整个接续组(跨块的完整段落)
#   translation_unit_protected_source_text  当前翻译单元(单块单元=块;分组单元=整组)
#
# 实测同一个 item 上,source_text 是 "equivalent of TfOH was equal to…"(半句),
# group_protected_source_text 是 "Initially, we chose the reaction of…"(整段)。
# 也就是说:取哪个键,决定了送给模型翻译的是半句还是整段。
#
# 历史上这条取值链在流水线里被**各自手写了几十遍**,顺序和项数各不相同,实测存在 6 种形态,
# 其中 31 处漏掉了 group_protected_source_text —— 漏掉的后果不会报错,只会让那一处
# 悄悄按「半句」去翻译/去匹配术语/去做判定。
#
# 正确的完整链只有一份:core/item_reader.py::item_source_text。
# 本检查把**当前的裸读取点冻成白名单**,新增的裸读取点一律报错并指回那个函数。
# 冻结粒度是「文件 -> 该文件内的裸读取点个数」:比文件集合更紧,已在白名单里的文件
# 再多写一处也会被抓到;同时不至于像行号白名单那样一改动就整体失效。
#
# 标注约定与 translation_field_writers.py 一致:
# - owner        取值链语义上的收口点,长期保留
# - frozen-debt  当前现实存在、目标是逐步收敛掉的裸读取点
# - 例外          已逐个确认过、语义上**不该**走完整链的读取点
#
# **白名单只准缩不准扩**:数字对不上就报错,方向由报错信息点明
#   —— 变多 = 新增了裸读取点(改代码);变少 = 完成了一次收敛(改这里的数字)。
#
# 范围:只扫 translate/ 域。render/ 和 ocr/ 里这几个键的**阶段契约副本**是有意的跨阶段
# 复制(阶段之间禁止互相 import),由 stage_contract_duplicates.py 单独盯防,不归本检查管。


GATED_SOURCE_TEXT_KEYS = frozenset(
    {
        "source_text",
        "protected_source_text",
        "group_protected_source_text",
        "translation_unit_protected_source_text",
    }
)

CANONICAL_READER = "retainpdf_pipeline/translate/core/item_reader.py"

SOURCE_TEXT_READER_ALLOWLIST: dict[str, int] = {
    # ---- owner:唯一的完整取值链 ----
    CANONICAL_READER: 4,  # owner: item_source_text 本体,这 4 处就是那条链
    # ---- 已确认的例外 ----
    # windows.py 的顺序看着"反了"(source_text 打头),但那是对的:上下文文本紧接着要过
    # sanitize_prompt_context_text 剥占位符,先取 protected 会把公式整个剥没;
    # 上下文要的是可读原文,不是送翻译的那段。不要"修正"成完整链。
    "retainpdf_pipeline/translate/services/context/windows.py": 3,  # 例外:上下文要可读原文
    # control_context.py 同理:其中一条链算的是术语命中统计,要的也是未被占位符替换的原文。
    "retainpdf_pipeline/translate/llm/shared/control_context.py": 12,  # frozen-debt + 例外混合
    # ---- frozen-debt:逐处判断后再收敛,不能无脑替换 ----
    "retainpdf_pipeline/translate/artifacts/debug_index.py": 1,
    "retainpdf_pipeline/translate/core/context/models.py": 3,
    "retainpdf_pipeline/translate/core/execution_policy.py": 3,
    "retainpdf_pipeline/translate/core/orchestration/abstract_groups.py": 2,
    "retainpdf_pipeline/translate/core/orchestration/zones.py": 1,
    "retainpdf_pipeline/translate/core/payload/parts/apply.py": 8,
    "retainpdf_pipeline/translate/core/payload/parts/common.py": 3,
    "retainpdf_pipeline/translate/core/payload/parts/group_split.py": 2,
    "retainpdf_pipeline/translate/core/payload/parts/policy_state.py": 2,
    "retainpdf_pipeline/translate/core/payload/parts/translation_units.py": 3,
    "retainpdf_pipeline/translate/core/payload/parts/units.py": 2,
    "retainpdf_pipeline/translate/core/payload/template_sync.py": 5,
    "retainpdf_pipeline/translate/core/text_rules.py": 1,
    "retainpdf_pipeline/translate/llm/decision_hints.py": 2,
    "retainpdf_pipeline/translate/llm/shared/cache.py": 3,
    "retainpdf_pipeline/translate/llm/shared/orchestration/common.py": 11,
    "retainpdf_pipeline/translate/llm/shared/orchestration/direct_typst_long_text.py": 4,
    "retainpdf_pipeline/translate/llm/shared/orchestration/direct_typst_repair.py": 3,
    "retainpdf_pipeline/translate/llm/shared/orchestration/heavy_formula.py": 4,
    "retainpdf_pipeline/translate/llm/shared/orchestration/metadata.py": 2,
    "retainpdf_pipeline/translate/llm/shared/orchestration/segment_parsing.py": 1,
    "retainpdf_pipeline/translate/llm/shared/orchestration/segment_plan.py": 3,
    "retainpdf_pipeline/translate/llm/shared/orchestration/segment_prompts.py": 1,
    "retainpdf_pipeline/translate/llm/shared/orchestration/segment_risk.py": 1,
    "retainpdf_pipeline/translate/llm/shared/orchestration/sentence_level.py": 2,
    "retainpdf_pipeline/translate/llm/shared/orchestration/short_text_retry.py": 3,
    "retainpdf_pipeline/translate/llm/shared/orchestration/single_item_flow.py": 2,
    "retainpdf_pipeline/translate/llm/shared/orchestration/tagged_placeholder.py": 4,
    "retainpdf_pipeline/translate/llm/validation/english_residue.py": 4,
    "retainpdf_pipeline/translate/services/agents/review_artifact.py": 3,
    "retainpdf_pipeline/translate/services/classification/prompting.py": 1,
    "retainpdf_pipeline/translate/services/classification/rule_engine.py": 2,
    "retainpdf_pipeline/translate/services/continuation/pairs.py": 4,
    "retainpdf_pipeline/translate/services/continuation/rules.py": 8,
    "retainpdf_pipeline/translate/services/continuation/state.py": 5,
    "retainpdf_pipeline/translate/services/fast_path/keep_origin.py": 4,
    "retainpdf_pipeline/translate/services/finalization/untranslated.py": 3,
    "retainpdf_pipeline/translate/services/memory/job_memory.py": 3,
    "retainpdf_pipeline/translate/services/memory/text.py": 3,
    "retainpdf_pipeline/translate/services/policy/literal_block_rules.py": 1,
    "retainpdf_pipeline/translate/services/policy/metadata_filter.py": 1,
    "retainpdf_pipeline/translate/services/policy/payload_rules/legacy_policy_checks.py": 3,
    "retainpdf_pipeline/translate/services/policy/payload_rules/legacy_policy_mutations.py": 2,
    "retainpdf_pipeline/translate/services/policy/soft_hints.py": 1,
    "retainpdf_pipeline/translate/services/policy/structured_technical_blocks.py": 1,
    "retainpdf_pipeline/translate/services/policy/verdict.py": 4,
    "retainpdf_pipeline/translate/services/postprocess/garbled_reconstruction.py": 3,
    "retainpdf_pipeline/translate/services/terms/usage.py": 4,
    "retainpdf_pipeline/translate/workflow/batching/dedupe.py": 4,
    "retainpdf_pipeline/translate/workflow/recovery.py": 2,
}


# ---- 门禁自保 ----------------------------------------------------------------
#
# 读取点的识别方式(.get / 下标)、扫描根目录、键名都可能变。一旦匹配悄悄失效,
# 这个检查就会变成「扫不到任何读取点 -> 没有 error -> 绿灯」,即静默空操作。
# 三道自保让它必须叫出来:
#
# 1) owner 点名:item_source_text 那条完整链必须能被解析出来,且四个键一个不少。
#    解析不到 = 匹配逻辑坏了。
REQUIRED_READER_KEYS: dict[str, frozenset[str]] = {
    CANONICAL_READER: GATED_SOURCE_TEXT_KEYS,
}

# 2) 规模下限:当前实测 53 个文件 / 167 个裸读取点 / 4 个键全部出现过。
#    下限给收敛留出空间,但挡住「解析崩了」这种数量级坍缩。
#    收敛到低于下限时,请在这里同步下调并在 PR 里说明。
MIN_SCANNED_FILES = 40
MIN_READ_POINTS = 120
MIN_DISTINCT_KEYS = len(GATED_SOURCE_TEXT_KEYS)


_HINT = (
    "请改用 item_reader.item_source_text()(core/item_reader.py) —— "
    "它是这四个键唯一的完整取值链;这四个键是四个不同的范围(块内 / 接续组 / 翻译单元),"
    "手写 or 链漏掉 group_protected_source_text 不会报错,只会让这一处按半句而不是整段处理"
)


def gated_source_text_reads(tree: ast.AST) -> dict[str, list[int]]:
    """返回 AST 中对受门禁源文本键的**裸读取**:key -> 行号列表。

    只认两种真正的读:
      item.get("<key>"[, default])   —— 取值
      item["<key>"]  (Load 上下文)   —— 取值

    不认写入(Store 下标交给 translation_field_writers.py)、不认 dict 字面量里的键
    (那是在造 payload,不是在读),也不做别名分析。
    """

    reads: dict[str, list[int]] = {}
    for node in ast.walk(tree):
        key = None
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            key = node.args[0].value
        elif (
            isinstance(node, ast.Subscript)
            and isinstance(node.ctx, ast.Load)
            and isinstance(node.slice, ast.Constant)
            and isinstance(node.slice.value, str)
        ):
            key = node.slice.value
        if key in GATED_SOURCE_TEXT_KEYS:
            reads.setdefault(key, []).append(getattr(node, "lineno", 0))
    return reads


def check_translation_source_text_readers(errors: list[str]) -> None:
    scanned_files = 0
    read_points = 0
    seen_keys: set[str] = set()
    seen_files: set[str] = set()

    for path in scan_py_files(TRANSLATION_ROOT):
        rel_path = Path(rel(path)).as_posix()
        tree = parse_python_file(path)
        reads = gated_source_text_reads(tree)
        required = REQUIRED_READER_KEYS.get(rel_path)
        if required is not None:
            missing = sorted(required - set(reads))
            if missing:
                errors.append(
                    f"{rel_path}: 门禁自保失败 — 完整取值链里的键 {missing} 没能被解析出来。"
                    "要么 item_source_text 被改坏了(它必须一次覆盖全部四个范围),"
                    "要么本门禁的读取点识别逻辑已失效;"
                    "请修正 translation_source_readers.py 的 gated_source_text_reads / "
                    "REQUIRED_READER_KEYS"
                )
        if not reads:
            continue
        seen_files.add(rel_path)
        scanned_files += 1
        seen_keys.update(reads)
        count = sum(len(lines) for lines in reads.values())
        read_points += count
        frozen = SOURCE_TEXT_READER_ALLOWLIST.get(rel_path)
        if frozen is None:
            lines = sorted(line for line_list in reads.values() for line in line_list)
            errors.append(
                f"{rel_path}:{lines[0]}: 新增了源文本键的裸读取点 "
                f"(共 {count} 处, 行 {lines}); {_HINT}"
            )
            continue
        if count == frozen:
            continue
        if count > frozen:
            lines = sorted(line for line_list in reads.values() for line in line_list)
            errors.append(
                f"{rel_path}: 源文本键的裸读取点从冻结的 {frozen} 处涨到了 {count} 处 "
                f"(行 {lines}); {_HINT}。"
                "白名单只准缩不准扩,确有必要时请连同理由一起改 "
                "translation_source_readers.py"
            )
        else:
            errors.append(
                f"{rel_path}: 源文本键的裸读取点已从 {frozen} 处收敛到 {count} 处 —— "
                "请把 translation_source_readers.py 的 SOURCE_TEXT_READER_ALLOWLIST "
                f"里这一条同步改成 {count}"
                + ("(收敛干净了就整条删掉)" if count == 0 else "")
                + ",否则冻结值会虚高,下次回退时抓不到"
            )

    for rel_path in sorted(set(SOURCE_TEXT_READER_ALLOWLIST) - seen_files):
        errors.append(
            f"{rel_path}: 白名单里有这条,但扫描时没在它里面找到任何源文本键的裸读取点。"
            "文件被删/改名了就删掉这条;文件还在就是本门禁的读取点识别逻辑失效了,"
            "请修 translation_source_readers.py"
        )

    if scanned_files < MIN_SCANNED_FILES:
        errors.append(
            f"门禁自保失败 — 只扫到 {scanned_files} 个含裸读取点的文件"
            f"(下限 {MIN_SCANNED_FILES});扫描根目录或读取点识别逻辑变了而门禁没跟上,"
            "门禁正在静默空转"
        )
    if read_points < MIN_READ_POINTS:
        errors.append(
            f"门禁自保失败 — 只解析出 {read_points} 个裸读取点(下限 {MIN_READ_POINTS})"
        )
    if len(seen_keys) < MIN_DISTINCT_KEYS:
        errors.append(
            f"门禁自保失败 — 四个受门禁的源文本键里只有 {sorted(seen_keys)} 被解析到; "
            "键名或匹配逻辑已与代码脱节"
        )


__all__ = [
    "GATED_SOURCE_TEXT_KEYS",
    "REQUIRED_READER_KEYS",
    "SOURCE_TEXT_READER_ALLOWLIST",
    "check_translation_source_text_readers",
    "gated_source_text_reads",
]
