import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.workflow.batching.plan import _allocate_translation_queue_workers
from retainpdf_pipeline.translate.workflow.batching.plan import _build_translation_batches
from retainpdf_pipeline.translate.workflow.batching.plan import _classify_translation_batches
from retainpdf_pipeline.translate.workflow.batching.plan import _effective_translation_batch_size
from retainpdf_pipeline.translate.workflow.batching.plan import _adaptive_initial_limit
from retainpdf_pipeline.translate.workflow.batching.plan import _provider_adaptive_initial_limit
from retainpdf_pipeline.translate.workflow.batching.plan import TranslationBatchRunStats
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.llm.shared.control_context import resolve_engine_profile


def _item(item_id: str, text: str, **overrides):
    item = {
        "item_id": item_id,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_default_profile_uses_single_item_requests() -> None:
    # 多条目 tagged 批处理已退役(输出协议是不可消除的失败面,模型会
    # 损坏 <<<END>>> 闭合标签导致整批作废),默认全部单条请求。
    context = build_translation_control_context()
    assert (
        _effective_translation_batch_size(
            batch_size=1,
            model="gpt-4.1-mini",
            base_url="https://api.openai.com/v1",
            translation_context=context,
        )
        == 1
    )


def test_deepseek_profile_uses_single_item_requests_for_stability() -> None:
    context = build_translation_control_context(
        engine_profile=resolve_engine_profile(
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
        )
    )
    assert (
        _effective_translation_batch_size(
            batch_size=1,
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            translation_context=context,
        )
        == 1
    )
    assert context.batch_policy.plain_batch_size == 1
    assert context.segmentation_policy.prefer_plain_when_segment_count_leq == 6
    assert context.fallback_policy.formula_segment_attempts == 2
    assert context.fallback_policy.main_http_retry_attempts == 1
    assert context.fallback_policy.tail_http_retry_attempts == 2
    assert context.timeout_policy.plain_text_seconds == 20
    assert context.timeout_policy.batch_plain_text_seconds == 25
    assert context.timeout_policy.long_plain_text_seconds == 30
    assert context.timeout_policy.transport_tail_retry_seconds == 40


def test_adaptive_initial_limit_ramps_up_high_worker_counts() -> None:
    assert _adaptive_initial_limit(1) == 1
    assert _adaptive_initial_limit(32) == 32
    assert _adaptive_initial_limit(64) == 32
    assert _adaptive_initial_limit(1000) == 32


def test_deepseek_adaptive_initial_limit_uses_configured_workers_by_default(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_TRANSLATION_DEEPSEEK_INITIAL_CONCURRENCY_LIMIT", raising=False)

    assert _provider_adaptive_initial_limit(workers=32, provider_family="deepseek_official") == 32
    assert _provider_adaptive_initial_limit(workers=100, provider_family="deepseek_official") == 100
    assert _provider_adaptive_initial_limit(workers=1000, provider_family="deepseek_official") == 1000
    assert _provider_adaptive_initial_limit(workers=1000, provider_family="openai") == 32


def test_deepseek_adaptive_initial_limit_can_be_capped_by_env(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_DEEPSEEK_INITIAL_CONCURRENCY_LIMIT", "250")

    assert _provider_adaptive_initial_limit(workers=1000, provider_family="deepseek_official") == 250
    assert _provider_adaptive_initial_limit(workers=100, provider_family="deepseek_official") == 100


def test_smarter_batches_group_low_risk_items_and_keep_complex_items_single() -> None:
    context = build_translation_control_context()
    batchable_text = "This sentence describes antibacterial activity and provides enough body text for translation."
    pending = [
        _item("a", batchable_text),
        _item("b", batchable_text),
        _item(
            "c",
            "After <f1-a7c/> hours, activity increased while the catalyst remained active in the reaction system.",
            formula_map=[{"placeholder": "<f1-a7c/>"}],
            metadata={"structure_role": "body"},
        ),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["a", "b"], ["c"]]
    assert all(item.get("_batched_plain_candidate") for item in batches[0])
    assert not batches[1][0].get("_batched_plain_candidate")


def test_deepseek_builds_single_item_batches_for_stability() -> None:
    context = build_translation_control_context(
        engine_profile=resolve_engine_profile(
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
        )
    )
    effective_batch_size = _effective_translation_batch_size(
        batch_size=1,
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        translation_context=context,
    )
    plain_text = "This paragraph describes catalyst stability and contains enough body text for translation."
    placeholder_heavy = " ".join(
        f"body segment {idx} <t{idx}-abc/>" for idx in range(context.batch_policy.batch_low_risk_max_placeholders + 1)
    )
    pending = [
        _item(f"plain-{idx}", plain_text)
        for idx in range(5)
    ] + [
        _item(
            "formula",
            "After <f1-a7c/> hours, activity increased while the catalyst remained active in solution.",
            formula_map=[{"placeholder": "<f1-a7c/>"}],
            metadata={"structure_role": "body"},
        ),
        _item("continuation", plain_text, continuation_group="cg-1"),
        _item("group", plain_text, translation_unit_id="__cg__:cg-1"),
        _item("placeholder-heavy", placeholder_heavy),
    ]

    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=effective_batch_size,
        translation_context=context,
    )

    assert effective_batch_size == 1
    assert immediate == []
    # 批处理退役后每个条目独立成批,单条 plain-text 请求没有输出协议,
    # 不存在条目丢失的可能。
    assert [[item["item_id"] for item in batch] for batch in batches] == [
        ["plain-0"],
        ["plain-1"],
        ["plain-2"],
        ["plain-3"],
        ["plain-4"],
        ["formula"],
        ["continuation"],
        ["group"],
        ["placeholder-heavy"],
    ]
    # 所有批都是单条,不存在会走多条目 tagged 协议的 batched_fast 批
    assert all(len(batch) == 1 for batch in batches)
    assert all(not batch[0].get("_batched_plain_candidate") for batch in batches[1:])


def test_smarter_batches_keep_continuation_group_out_of_batched_plain_path_even_without_placeholders() -> None:
    context = build_translation_control_context()
    pending = [
        _item(
            "a",
            "This continuation block still contains enough body text to remain batchable after policy relaxation.",
            continuation_group="cg-1",
        ),
        _item(
            "b",
            "This companion block stays in the same continuation group and should join the batched plain path.",
            continuation_group="cg-1",
        ),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["a"], ["b"]]
    assert all(not batch[0].get("_batched_plain_candidate") for batch in batches)


def test_smarter_batches_keep_continuation_group_with_placeholders_out_of_batched_plain_path() -> None:
    context = build_translation_control_context()
    pending = [
        _item(
            "__cg__:cg-1",
            "This continuation block mentions <f1-a7c/> and keeps enough body text for translation while preserving placeholders.",
            continuation_group="cg-1",
            translation_unit_id="__cg__:cg-1",
            formula_map=[{"placeholder": "<f1-a7c/>"}],
            translation_unit_formula_map=[{"placeholder": "<f1-a7c/>"}],
            metadata={"structure_role": "body"},
        ),
        _item(
            "body",
            "This sentence describes antibacterial activity and provides enough body text for translation.",
        ),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"], ["__cg__:cg-1"]]
    assert batches[0][0].get("_batched_plain_candidate")
    assert not batches[1][0].get("_batched_plain_candidate")


def test_queue_classification_routes_only_true_slow_blocks_to_single_slow() -> None:
    batched_fast_batches, single_fast_batches, single_slow_batches = _classify_translation_batches(
        [
            [
                _item(
                    "body-a",
                    "This sentence describes antibacterial activity and provides enough body text for translation.",
                    _batched_plain_candidate=True,
                )
            ],
            [
                _item(
                    "__cg__:cg-1",
                    "Continuation with <f1-a7c/> placeholder.",
                    continuation_group="cg-1",
                    translation_unit_id="__cg__:cg-1",
                )
            ],
            [
                _item(
                    "formula-1",
                    "Text with <f1-a7c/> formula marker.",
                    formula_map=[{"placeholder": "<f1-a7c/>"}],
                    math_mode="direct_typst",
                )
            ],
            [
                _item(
                    "formula-heavy",
                    "Heavy split chunk with <f1-a7c/> and <f2-b2d/> markers.",
                    formula_map=[{"placeholder": "<f1-a7c/>"}, {"placeholder": "<f2-b2d/>"}],
                    _heavy_formula_split_applied=True,
                )
            ],
            [
                _item(
                    "body-b",
                    "This sentence describes antibacterial activity and provides enough body text for translation.",
                    _batched_plain_candidate=True,
                ),
                _item(
                    "body-c",
                    "This sentence describes antibacterial activity and provides enough body text for translation.",
                    _batched_plain_candidate=True,
                ),
            ],
        ]
    )
    assert [[item["item_id"] for item in batch] for batch in batched_fast_batches] == [["body-b", "body-c"]]
    assert [[item["item_id"] for item in batch] for batch in single_fast_batches] == [["body-a"], ["__cg__:cg-1"], ["formula-1"]]
    assert [[item["item_id"] for item in batch] for batch in single_slow_batches] == [["formula-heavy"]]


def test_queue_worker_allocation_reserves_small_tail_pool() -> None:
    assert _allocate_translation_queue_workers(
        1,
        batched_fast_count=0,
        single_fast_count=3,
        single_slow_count=1,
    ) == {"batched_fast": 0, "single_fast": 1, "single_slow": 0}
    assert _allocate_translation_queue_workers(
        8,
        batched_fast_count=4,
        single_fast_count=6,
        single_slow_count=2,
    ) == {"batched_fast": 2, "single_fast": 4, "single_slow": 2}
    assert _allocate_translation_queue_workers(
        24,
        batched_fast_count=2,
        single_fast_count=10,
        single_slow_count=3,
    ) == {"batched_fast": 4, "single_fast": 17, "single_slow": 3}
    assert _allocate_translation_queue_workers(
        12,
        batched_fast_count=0,
        single_fast_count=0,
        single_slow_count=5,
    ) == {"batched_fast": 0, "single_fast": 0, "single_slow": 12}
    assert _allocate_translation_queue_workers(
        32,
        batched_fast_count=10,
        single_fast_count=10,
        single_slow_count=20,
    ) == {"batched_fast": 12, "single_fast": 12, "single_slow": 8}


def test_queue_worker_allocation_balances_fast_queues_by_workload() -> None:
    assert _allocate_translation_queue_workers(
        16,
        batched_fast_count=12,
        single_fast_count=12,
        single_slow_count=0,
    ) == {"batched_fast": 8, "single_fast": 8, "single_slow": 0}
    assert _allocate_translation_queue_workers(
        100,
        batched_fast_count=138,
        single_fast_count=51,
        single_slow_count=0,
    ) == {"batched_fast": 72, "single_fast": 28, "single_slow": 0}


def test_translation_batch_run_stats_reports_queue_worker_split() -> None:
    stats = TranslationBatchRunStats(
        pending_items=12,
        total_batches=7,
        effective_batch_size=4,
        flush_interval=2,
        effective_workers=16,
        batched_fast_batches=3,
        single_fast_batches=2,
        single_slow_batches=2,
        batched_fast_workers=9,
        single_fast_workers=5,
        single_slow_workers=2,
        slow_worker_limit=2,
    ).as_dict()

    assert stats["fast_queue_batches"] == 5
    assert stats["slow_queue_batches"] == 2
    assert stats["batched_fast_workers"] == 9
    assert stats["single_fast_workers"] == 5
    assert stats["single_slow_workers"] == 2
    assert stats["slow_worker_limit"] == 2


def test_direct_typst_singleton_uses_single_fast_even_when_marked_batchable() -> None:
    batched_fast_batches, single_fast_batches, single_slow_batches = _classify_translation_batches(
        [
            [
                _item(
                    "dt-1",
                    "Observe $x_{i}$ under the boundary condition and translate directly.",
                    math_mode="direct_typst",
                    _batched_plain_candidate=True,
                )
            ]
        ]
    )
    assert batched_fast_batches == []
    assert [[item["item_id"] for item in batch] for batch in single_fast_batches] == [["dt-1"]]
    assert single_slow_batches == []


def test_direct_typst_low_risk_body_items_can_enter_batched_plain_path() -> None:
    context = build_translation_control_context()
    body_text = "This direct Typst paragraph discusses density functional theory with enough text for translation."
    batches, immediate = _build_translation_batches(
        [
            _item("dt-a", body_text, math_mode="direct_typst"),
            _item("dt-b", body_text, math_mode="direct_typst"),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["dt-a", "dt-b"]]
    assert all(item.get("_batched_plain_candidate") for item in batches[0])


def test_smarter_batches_leave_reference_like_text_as_single_batch_without_fast_skip() -> None:
    context = build_translation_control_context()
    body_text = "This sentence describes antibacterial activity and provides enough body text for translation."
    reference_text = "[1] Antimicrobial Resistance Collaborators, Lancet. 2022, 399, 629."
    pending = [
        _item("body-a", body_text),
        _item("body-b", body_text),
        _item("ref", reference_text),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body-a", "body-b"], ["ref"]]
    assert immediate == []
    assert all(item.get("_batched_plain_candidate") for item in batches[0])
    assert not batches[1][0].get("_batched_plain_candidate")
