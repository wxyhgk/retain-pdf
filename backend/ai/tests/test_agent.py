import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent import (
    Citation,
    RetrievalAgent,
    _assign_refs,
    _public_tool_payload,
    _referenced_citations,
    _sanitize_answer_text,
)
from retainpdf_ai.tools import Tool, ToolRegistry


def _search_tool(hits):
    def handler(arguments):
        selected = [dict(hit) for hit in hits]
        doc = str(arguments.get("document_id") or "").strip()
        if doc:
            selected = [h for h in selected if h.get("document_id") == doc]
        return {"hits": selected, "document_id": doc or None, "args": dict(arguments)}

    return Tool(
        name="search_fulltext",
        description="搜索",
        parameters={"type": "object", "properties": {"query": {"type": "string"}}},
        handler=handler,
    )


HITS = [
    {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 3,
        "block_id": "p004-b0002",
        "translated_snippet": "反应速率显著提高",
    },
    {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 7,
        "block_id": "p008-b0001",
        "translated_snippet": "选择性来自共轭效应",
    },
]


def test_unscoped_chat_with_retrieval_tools_needs_only_one_model_call():
    registry = ToolRegistry([_search_tool([])])
    calls = []

    def chat(messages, tools):
        calls.append(messages)
        return {"content": "Qwen连接正常。"}

    result = RetrievalAgent(registry, chat).ask("连通性测试", content_source="unscoped")
    assert result.answer == "Qwen连接正常。"
    assert result.rounds == 1
    assert len(calls) == 1
    assert result.citations == []
    assert result.tool_trace == []


def test_scoped_chat_still_requires_search_even_if_content_source_says_unscoped():
    for scope in ({"document_id": "doc-a"}, {"job_id": "job-1"}):
        registry = ToolRegistry([_search_tool([]), Tool(
            name="search_markdown", description="Markdown搜索",
            parameters={"type": "object", "properties": {}},
            handler=lambda arguments: {"hits": []},
        )])
        result = RetrievalAgent(registry, lambda messages, tools: {"content": "无证据回答"},
                                max_tool_rounds=2).ask("概括本文", content_source="unscoped", **scope)
        assert "尚未完成文档检索" in result.answer
        assert result.rounds == 2


def test_referenced_citations_keeps_every_ref_used_by_the_answer():
    citations = {
        ref: Citation(
            ref=ref,
            document_id="doc-a",
            job_id="job-1",
            page_idx=ref - 1,
            block_id=f"p{ref:03d}-b0001",
            snippet=f"evidence {ref}",
        )
        for ref in range(1, 13)
    }
    answer = " ".join(f"结论 {ref} [{ref}]。" for ref in range(1, 13))

    selected = _referenced_citations(answer, citations)

    assert [citation.ref for citation in selected] == list(range(1, 13))


def test_public_read_blocks_payload_keeps_coordinates_assets_and_full_slice() -> None:
    raw = {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 2,
        "blocks": [
            {
                "block_id": "p003-b0002",
                "source_text": "complete source slice",
                "translated_text": "完整译文",
                "bbox": [20.0, 100.0, 220.0, 260.0],
                "bbox_unit": "pdf_point",
                "bbox_origin": "top_left",
                "block_type": "image",
                "asset_id": "imgs/figure.jpg",
                "asset_ids": ["imgs/figure.jpg", "imgs/figure-detail.jpg"],
                "image_url": "/api/v1/jobs/job-1/markdown/images/page-3/imgs/figure.jpg",
                "asset_image_urls": [
                    "/api/v1/jobs/job-1/markdown/images/page-3/imgs/figure.jpg",
                    "/api/v1/jobs/job-1/markdown/images/page-3/imgs/figure-detail.jpg",
                ],
                "char_start": 0,
                "source_text_length": 21,
                "translated_text_length": 4,
                "source_has_more": False,
                "translated_has_more": False,
            }
        ],
    }
    citations = {}
    _assign_refs(raw, citations, 1)

    block = _public_tool_payload(raw)["blocks"][0]

    assert block["bbox"] == [20.0, 100.0, 220.0, 260.0]
    assert block["block_type"] == "image"
    assert block["asset_id"] == "imgs/figure.jpg"
    assert block["asset_ids"] == ["imgs/figure.jpg", "imgs/figure-detail.jpg"]
    assert block["image_url"].endswith("page-3/imgs/figure.jpg")
    assert len(block["asset_image_urls"]) == 2
    assert block["source_text"] == "complete source slice"
    assert citations[1].image_urls == block["asset_image_urls"]


def test_public_tool_payload_exposes_structured_data_capability() -> None:
    assert _public_tool_payload(
        {"structured_data_available": True, "hits": []}
    ) == {"structured_data_available": True}
    assert _public_tool_payload(
        {
            "structured_data_available": False,
            "hits": [],
            "hint": "use markdown",
        }
    ) == {
        "structured_data_available": False,
        "hint": "use markdown",
    }


def _tool_call(name, arguments, call_id="call-1"):
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments, ensure_ascii=False)},
    }


def test_agent_runs_tools_then_answers_with_cited_anchors():
    registry = ToolRegistry([_search_tool(HITS)])
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "选择性"})]},
            {"content": "选择性来自共轭效应 [2]。", "tool_calls": []},
        ]
    )
    seen_tool_messages = []

    def fake_chat(messages, tools):
        seen_tool_messages.extend(m for m in messages if m["role"] == "tool")
        return next(script)

    agent = RetrievalAgent(registry, fake_chat, max_tool_rounds=4)
    result = agent.ask("为什么有选择性?")

    assert result.rounds == 2
    assert result.answer == "选择性来自共轭效应 [2]。"
    # 只返回被引用的锚点,且编号写进了给模型看的工具结果
    assert [citation.ref for citation in result.citations] == [2]
    assert result.citations[0].block_id == "p008-b0001"
    payload = json.loads(seen_tool_messages[0]["content"])
    assert payload["hits"][0]["ref"] == 1
    assert payload["hits"][0]["translated_snippet"] == "反应速率显著提高"
    assert result.tool_trace == [
        {"round": 1, "tool": "search_fulltext", "arguments": {"query": "选择性"}}
    ]


def test_agent_forces_document_id_into_search_tools():
    """整本问答:即便模型没传 document_id,agent 也要强制注入。"""
    seen_args = []

    def capture(arguments):
        seen_args.append(dict(arguments))
        return {"hits": [dict(HITS[0])]}

    registry = ToolRegistry(
        [
            Tool(
                name="search_fulltext",
                description="搜索",
                parameters={"type": "object", "properties": {"query": {"type": "string"}}},
                handler=capture,
            )
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "选择性"})]},
            {"content": "答案 [1]。", "tool_calls": []},
        ]
    )
    agent = RetrievalAgent(registry, lambda m, t: next(script), max_tool_rounds=4)
    result = agent.ask("为什么?", document_id="doc-a", job_id="job-1")
    assert seen_args[0]["query"] == "选择性"
    assert seen_args[0]["document_id"] == "doc-a"
    assert result.tool_trace[0]["arguments"]["document_id"] == "doc-a"


def test_default_tool_surface_prefers_structured_blocks_and_keeps_markdown_fallback():
    seen_args = []
    seen_specs = []

    def structured_search(arguments):
        seen_args.append(dict(arguments))
        return {
            "document_id": "doc-a",
            "hits": [dict(HITS[1])],
        }

    registry = ToolRegistry(
        [
                Tool(
                    name="search_markdown",
                    description="search md",
                    parameters={"type": "object", "properties": {"query": {"type": "string"}}},
                    handler=lambda arguments: {"hits": []},
            ),
            Tool(
                name="read_markdown_chunk",
                description="read md",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: {"blocks": []},
            ),
            Tool(
                name="search_fulltext",
                description="search blocks",
                parameters={"type": "object", "properties": {"query": {"type": "string"}}},
                handler=structured_search,
            ),
            Tool(
                name="read_blocks",
                description="read blocks",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: {"blocks": []},
            ),
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "选择性"})]},
            {"content": "结构化结论 [1]。", "tool_calls": []},
        ]
    )

    def fake_chat(messages, tools):
        seen_specs.append(
            [str((tool.get("function") or {}).get("name") or "") for tool in tools]
        )
        return next(script)

    result = RetrievalAgent(registry, fake_chat).ask(
        "结论?", document_id="doc-a", job_id="job-1"
    )

    assert seen_specs[0] == [
        "search_fulltext",
        "read_blocks",
        "search_markdown",
        "read_markdown_chunk",
    ]
    assert seen_args == [
        {
            "query": "选择性",
            "document_id": "doc-a",
            "job_id": "job-1",
        }
    ]
    assert result.citations[0].block_id == "p008-b0001"
    assert result.citations[0].page_idx == 7
    public = _public_tool_payload(
        {
            "document_id": "doc-a",
            "hits": [
                {
                    "ref": 1,
                    "page_idx": None,
                    "block_id": "md-0001",
                    "chunk_id": "md-0001",
                    "heading": "结论",
                    "source_snippet": "Markdown evidence",
                    "assets": [
                        {
                            "image_url": "/api/v1/jobs/job-1/markdown/images/page-3/imgs/chart.png",
                            "alt": "chart",
                        },
                        {"image_url": "https://tracker.invalid/pixel.png"},
                    ],
                    "source": "markdown",
                }
            ],
        }
    )
    assert public["hits"][0]["heading"] == "结论"
    assert public["hits"][0]["source"] == "markdown"
    assert "page" not in public["hits"][0]
    assert public["hits"][0]["assets"] == [
        {
            "image_url": "/api/v1/jobs/job-1/markdown/images/page-3/imgs/chart.png",
            "alt": "chart",
        }
    ]
    assert "page" not in public["how_to_cite"]


def test_document_registry_blocks_hallucinated_nonreading_tool():
    called = []
    registry = ToolRegistry(
        [
            Tool(
                name="search_markdown",
                description="search md",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: {"hits": []},
            ),
            Tool(
                name="search_fulltext",
                description="structured",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: {"hits": [dict(HITS[0])]},
            ),
            Tool(
                name="list_documents",
                description="not available inside a scoped reading turn",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: called.append(arguments) or {"documents": []},
            ),
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("list_documents", {})]},
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "x"})]},
            {"content": "结构化检索已完成 [1]。", "tool_calls": []},
        ]
    )
    result = RetrievalAgent(registry, lambda m, t: next(script)).ask(
        "q", document_id="doc-a", job_id="job-1"
    )
    assert called == []
    assert result.answer.startswith("结构化检索")
    assert result.tool_trace[0]["arguments"] == {"skipped": True}


def test_markdown_fallback_requires_structured_data_to_be_unavailable():
    markdown_calls = []
    registry = ToolRegistry(
        [
            Tool(
                name="search_fulltext",
                description="structured",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: {
                    "document_id": "doc-a",
                    "structured_data_available": False,
                    "hits": [],
                },
            ),
            Tool(
                name="search_markdown",
                description="legacy fallback",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: markdown_calls.append(dict(arguments))
                or {
                    "document_id": "doc-a",
                    "job_id": "job-1",
                    "hits": [
                        {
                            "document_id": "doc-a",
                            "job_id": "job-1",
                            "block_id": "md-0001",
                            "source_snippet": "legacy evidence",
                        }
                    ],
                },
            ),
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_markdown", {"query": "x"})]},
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "x"})]},
            {"content": "", "tool_calls": [_tool_call("search_markdown", {"query": "x"})]},
            {"content": "兼容证据 [1]。", "tool_calls": []},
        ]
    )

    result = RetrievalAgent(registry, lambda m, t: next(script)).ask(
        "q", document_id="doc-a", job_id="job-1"
    )

    assert markdown_calls == [
        {"query": "x", "document_id": "doc-a", "job_id": "job-1"}
    ]
    assert result.answer == "兼容证据 [1]。"
    assert result.tool_trace[0]["arguments"] == {"skipped": True}
    assert [item["tool"] for item in result.tool_trace] == [
        "search_markdown",
        "search_fulltext",
        "search_markdown",
    ]


def test_empty_structured_result_does_not_fall_back_when_data_exists():
    markdown_calls = []
    registry = ToolRegistry(
        [
            Tool(
                name="search_fulltext",
                description="structured",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: {
                    "document_id": "doc-a",
                    "structured_data_available": True,
                    "hits": [],
                },
            ),
            Tool(
                name="search_markdown",
                description="legacy fallback",
                parameters={"type": "object", "properties": {}},
                handler=lambda arguments: markdown_calls.append(dict(arguments))
                or {"hits": []},
            ),
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "x"})]},
            {"content": "", "tool_calls": [_tool_call("search_markdown", {"query": "x"})]},
            {"content": "结构化数据存在，但当前关键词没有命中。", "tool_calls": []},
        ]
    )

    result = RetrievalAgent(registry, lambda m, t: next(script)).ask(
        "q", document_id="doc-a", job_id="job-1"
    )

    assert markdown_calls == []
    assert result.answer == "结构化数据存在，但当前关键词没有命中。"
    assert result.tool_trace == [
        {
            "round": 1,
            "tool": "search_fulltext",
            "arguments": {
                "query": "x",
                "document_id": "doc-a",
                "job_id": "job-1",
            },
        },
        {"round": 2, "tool": "search_markdown", "arguments": {"skipped": True}},
    ]


def test_markdown_internal_id_is_mapped_to_public_citation() -> None:
    citations = {
        1: Citation(1, "doc", "job", None, "md-0004", "evidence"),
    }

    assert _sanitize_answer_text("结论来自 md-0004。", citations) == "结论来自 [1]。"


def test_agent_falls_back_to_all_citations_when_answer_has_no_markers():
    registry = ToolRegistry([_search_tool(HITS)])
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "速率"})]},
            {"content": "速率提高且有选择性。", "tool_calls": []},
        ]
    )
    agent = RetrievalAgent(registry, lambda m, t: next(script), max_tool_rounds=4)
    result = agent.ask("结论?")
    assert [citation.ref for citation in result.citations] == [1, 2]


def test_agent_forces_final_answer_when_rounds_exhausted():
    registry = ToolRegistry([_search_tool(HITS)])
    calls = {"n": 0}

    def looping_chat(messages, tools):
        calls["n"] += 1
        if tools:
            return {
                "content": "",
                "tool_calls": [_tool_call("search_fulltext", {"query": f"q{calls['n']}"})],
            }
        # 收尾调用不给工具
        assert messages[-1]["role"] == "user"
        return {"content": "基于已有证据的最终回答 [1]。", "tool_calls": []}

    agent = RetrievalAgent(registry, looping_chat, max_tool_rounds=3)
    result = agent.ask("一直想搜的问题")
    assert result.rounds == 3
    assert "最终回答" in result.answer
    assert len(result.tool_trace) == 3


def test_friendly_llm_error_maps_status_codes():
    """Provider failures retain useful hints but never echo upstream bodies."""
    from retainpdf_ai.agent import _friendly_llm_error

    assert "余额不足" in str(_friendly_llm_error(402))
    assert "限流" in str(_friendly_llm_error(429))
    assert "Key 无效" in str(_friendly_llm_error(401))
    assert "上游故障" in str(_friendly_llm_error(503))
    long_detail = "x" * 500
    msg = str(_friendly_llm_error(402, long_detail))
    assert len(msg) < 300
    assert "x" not in msg


def test_rounds_exhausted_final_call_uses_request_level_chat_fn():
    """审计 A1 回归锁:env 不配 key(启动期 chat=_missing_key 形态)、按请求传
    chat_fn 时,轮数耗尽的收尾轮必须继续用请求级 chat_fn,而不是 self._chat。"""
    registry = ToolRegistry([_search_tool(HITS)])

    def startup_chat_missing_key(_messages, _tools):
        raise RuntimeError("缺少 LLM API Key")

    calls = {"n": 0}

    def request_chat(messages, tools):
        calls["n"] += 1
        if tools:
            return {
                "content": "",
                "tool_calls": [_tool_call("search_fulltext", {"query": f"q{calls['n']}"})],
            }
        return {"content": "请求级 key 的收尾回答 [1]。", "tool_calls": []}

    agent = RetrievalAgent(registry, startup_chat_missing_key, max_tool_rounds=2)
    result = agent.ask("一直想搜的问题", chat_fn=request_chat)
    assert result.rounds == 2
    assert "收尾回答" in result.answer


def test_unknown_tool_and_handler_error_feed_back_to_model():
    def boom(_arguments):
        raise RuntimeError("backend down")

    registry = ToolRegistry(
        [
            Tool(
                name="broken",
                description="always fails",
                parameters={"type": "object", "properties": {}},
                handler=boom,
            )
        ]
    )
    script = iter(
        [
            {
                "content": "",
                "tool_calls": [
                    _tool_call("broken", {}, "c1"),
                    _tool_call("missing", {}, "c2"),
                ],
            },
            {"content": "工具都失败了,无法回答。", "tool_calls": []},
        ]
    )
    captured = []

    def fake_chat(messages, tools):
        captured.extend(m for m in messages if m["role"] == "tool")
        return next(script)

    agent = RetrievalAgent(registry, fake_chat, max_tool_rounds=3)
    result = agent.ask("q")
    assert result.answer.startswith("工具都失败了")
    errors = [json.loads(m["content"]) for m in captured]
    assert any("backend down" in str(e.get("error")) for e in errors)
    assert any("unknown tool" in str(e.get("error")) for e in errors)


def _sse(chunks):
    import json as _json
    lines = [f"data: {_json.dumps(c, ensure_ascii=False)}" for c in chunks]
    is_tool = any(c.get("choices", [{}])[0].get("delta", {}).get("tool_calls") for c in chunks)
    lines.append("data: " + _json.dumps({"choices": [{"delta": {}, "finish_reason": "tool_calls" if is_tool else "stop"}]}))
    lines.append("data: [DONE]")
    return lines


def _content_chunk(text):
    return {"choices": [{"delta": {"content": text}}]}


def _tool_chunk():
    return {"choices": [{"delta": {"tool_calls": [
        {"index": 0, "id": "c1", "type": "function",
         "function": {"name": "search_fulltext", "arguments": "{}"}}
    ]}}]}


def test_streaming_tool_turn_preamble_not_emitted_as_answer_delta():
    """审计 A3 回归锁:工具轮的 content 前言不得泄漏为 answer_delta。"""
    from retainpdf_ai.agent import assemble_streaming_message

    deltas = []
    message = assemble_streaming_message(
        _sse([_content_chunk("让我先"), _content_chunk("搜索一下…"), _tool_chunk()]),
        on_delta=deltas.append,
    )
    assert deltas == [], f"工具轮前言泄漏: {deltas}"
    assert message["tool_calls"][0]["function"]["name"] == "search_fulltext"
    # content 仍保留在 message 里(回给模型的上下文完整)
    assert "搜索一下" in message["content"]


def test_streaming_pure_answer_still_streams_and_short_answer_flushes():
    from retainpdf_ai.agent import assemble_streaming_message

    # 长答案:攒满 64 字符定性后转直通
    long_piece = "答" * 64
    deltas = []
    assemble_streaming_message(
        _sse([_content_chunk(long_piece), _content_chunk("尾巴")]),
        on_delta=deltas.append,
    )
    assert "".join(deltas) == long_piece + "尾巴"
    assert len(deltas) == 2, "定性后应逐 piece 直通"

    # 短答案:不足阈值,流结束一次性补发
    deltas2 = []
    assemble_streaming_message(_sse([_content_chunk("短答案")]), on_delta=deltas2.append)
    assert "".join(deltas2) == "短答案"
