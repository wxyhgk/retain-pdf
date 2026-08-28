import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from retainpdf_ai.agent import AskResult, Citation, RetrievalAgent
from retainpdf_ai.app import build_app
from retainpdf_ai.blocks import read_page_blocks
from retainpdf_ai.config import Settings
from retainpdf_ai.tools import build_default_registry


class FakeRust:
    def __init__(self):
        self.documents = [
            {
                "document_id": "doc-a",
                "title": "Phương pháp tính toán quang phổ",
                "page_count": 12,
                "tags": ["Hóa học"],
                "reading_status": "reading",
                "active_job_id": "job-1",
            }
        ]
        self.conversations: dict[str, dict] = {}
        self._conv_seq = 0

    def search_fulltext(self, query, limit=20, *, document_id=""):
        hits = [
            {
                "document_id": "doc-a",
                "job_id": "job-1",
                "page_idx": 2,
                "block_id": "p003-b0001",
                "source_snippet": "spectra",
                "translated_snippet": f"Đoạn văn bản về {query}",
            },
            {
                "document_id": "doc-other",
                "job_id": "job-9",
                "page_idx": 0,
                "block_id": "p001-b0001",
                "source_snippet": "other",
                "translated_snippet": "Tài liệu khác",
            },
        ]
        if document_id:
            hits = [h for h in hits if h["document_id"] == document_id]
        return hits

    def list_documents(self, *, tag="", reading_status="", limit=50):
        return self.documents

    def get_document(self, document_id):
        return self.documents[0]

    def get_document_by_job(self, job_id):
        for doc in self.documents:
            if doc.get("active_job_id") == job_id:
                return doc
        return None

    def list_favorites(self, document_id=""):
        return [
            {
                "favorite_id": "fav-1",
                "document_id": "doc-a",
                "job_id": "job-1",
                "page_idx": 4,
                "block_id": "p005-b0008",
                "kind": "sentence",
                "quote_text": "reaction rate",
                "translated_quote_text": "Trích dẫn liên quan đến tốc độ phản ứng",
                "note": "Quan trọng",
            }
        ]

    def create_conversation(self, *, title="", document_id=""):
        self._conv_seq += 1
        conversation_id = f"conv-{self._conv_seq}"
        record = {
            "conversation_id": conversation_id,
            "title": title,
            "document_id": document_id or None,
            "head_id": "",
            "messages": [],
        }
        self.conversations[conversation_id] = record
        return {
            "conversation_id": conversation_id,
            "title": title,
            "document_id": document_id or None,
            "head_id": "",
        }

    def get_conversation(self, conversation_id):
        return self.conversations.get(conversation_id)

    def append_conversation_message(
        self,
        conversation_id,
        *,
        role,
        content,
        citations_json="",
        tool_trace_json="",
        model="",
        parent_id="",
        message_id="",
        set_head=True,
    ):
        record = self.conversations.setdefault(
            conversation_id,
            {
                "conversation_id": conversation_id,
                "title": "",
                "document_id": None,
                "head_id": "",
                "messages": [],
            },
        )
        mid = (message_id or "").strip() or f"msg-{len(record['messages']) + 1}"
        msg = {
            "message_id": mid,
            "role": role,
            "content": content,
            "citations_json": citations_json,
            "tool_trace_json": tool_trace_json,
            "model": model,
            "parent_id": (parent_id or "").strip(),
            "seq": len(record["messages"]) + 1,
        }
        record["messages"].append(msg)
        if set_head:
            record["head_id"] = mid
        return msg


def _write_job_dir(root: Path):
    job_root = root / "jobs" / "job-1"
    normalized = job_root / "ocr" / "normalized"
    normalized.mkdir(parents=True)
    (normalized / "document.v1.json").write_text(
        json.dumps(
            {
                "pages": [
                    {
                        "page_index": 2,
                        "blocks": [
                            {"block_id": "p003-b0000", "text": "first block"},
                            {"block_id": "p003-b0001", "text": "second block"},
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    translated = job_root / "translated"
    translated.mkdir(parents=True)
    (translated / "page-003-deepseek.json").write_text(
        json.dumps(
            [
                {"page_idx": "2", "block_idx": "1", "translated_text": "Bản dịch của khối thứ hai"},
            ]
        ),
        encoding="utf-8",
    )
    return job_root


def test_read_page_blocks_aligns_translation_by_numeric_index(tmp_path):
    job_root = _write_job_dir(tmp_path)
    blocks = read_page_blocks(job_root, 2)
    assert [block.block_id for block in blocks] == ["p003-b0000", "p003-b0001"]
    assert blocks[1].translated_text == "Bản dịch của khối thứ hai"
    windowed = read_page_blocks(job_root, 2, around_block_id="p003-b0001", max_blocks=1)
    assert [block.block_id for block in windowed] == ["p003-b0001"]


def test_default_registry_tools_return_anchored_results(tmp_path):
    _write_job_dir(tmp_path)
    settings = Settings(data_root=tmp_path)
    registry = build_default_registry(settings, FakeRust())

    hits = registry.invoke("search_fulltext", {"query": "quang phổ"})["hits"]
    assert len(hits) == 2
    assert hits[0]["block_id"] == "p003-b0001"

    # Toàn bộ tài liệu: document_id lọc bỏ các tài liệu khác
    scoped = registry.invoke(
        "search_fulltext",
        {"query": "quang phổ", "document_id": "doc-a"},
    )
    assert len(scoped["hits"]) == 1
    assert scoped["hits"][0]["document_id"] == "doc-a"
    assert scoped["document_id"] == "doc-a"

    empty_scoped = registry.invoke(
        "search_fulltext",
        {"query": "quang phổ", "document_id": "doc-missing"},
    )
    assert empty_scoped["hits"] == []
    assert "full-text index" in empty_scoped.get("hint", "")

    documents = registry.invoke("list_documents", {})["documents"]
    assert documents[0]["document_id"] == "doc-a"
    # Khi truyền document_id, list_documents chỉ trả về tài liệu đó
    only = registry.invoke("list_documents", {"document_id": "doc-a"})["documents"]
    assert len(only) == 1

    blocks = registry.invoke("read_blocks", {"document_id": "doc-a", "page_idx": 2})
    assert blocks["job_id"] == "job-1"
    assert blocks["blocks"][1]["translated_text"] == "Bản dịch của khối thứ hai"

    favorites = registry.invoke("search_favorites", {"keyword": "tốc độ"})["favorites"]
    assert favorites[0]["favorite_id"] == "fav-1"
    assert registry.invoke("search_favorites", {"keyword": "không tồn tại"})["favorites"] == []

    assert "query must not be empty" in registry.invoke("search_fulltext", {})["error"]


class FakeAgent(RetrievalAgent):
    def __init__(self):
        self.last_history = None

    def ask(self, question, *, document_id="", job_id="", on_event=None, chat_fn=None, history=None):
        self.last_history = list(history or [])
        if on_event is not None:
            on_event({"type": "tool", "round": 1, "tool": "search_fulltext", "arguments": {"query": "q"}})
        history_note = f"(hist={len(self.last_history)})" if self.last_history else ""
        return AskResult(
            answer=f"Câu trả lời:{question}{history_note} [1]",
            citations=[
                Citation(
                    ref=1,
                    document_id="doc-a",
                    job_id="job-1",
                    page_idx=2,
                    block_id="p003-b0001",
                    snippet="Đoạn văn bản",
                )
            ],
            tool_trace=[{"round": 1, "tool": "search_fulltext", "arguments": {"query": "q"}}],
            rounds=2,
        )


def test_ask_endpoint_requires_api_key_and_returns_citations():
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")
    app = build_app(settings, agent=FakeAgent())
    client = TestClient(app)

    assert client.get("/healthz").json()["ok"] is True

    denied = client.post("/v1/ask", json={"question": "q"})
    assert denied.status_code == 401

    response = client.post(
        "/v1/ask",
        json={"question": "Nội dung trong thư viện là gì?"},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["answer"].startswith("Câu trả lời:")
    assert data["citations"][0]["block_id"] == "p003-b0001"
    assert data["rounds"] == 2


def test_ask_endpoint_streams_sse_events():
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")
    app = build_app(settings, agent=FakeAgent())
    client = TestClient(app)

    with client.stream(
        "POST",
        "/v1/ask",
        json={"question": "Dạng luồng?", "stream": True},
        headers={"X-API-Key": "test-key"},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))
    assert events[0]["type"] == "tool"
    assert events[0]["tool"] == "search_fulltext"
    assert events[-1]["type"] == "done"
    assert events[-1]["answer"].startswith("Câu trả lời:")
    assert events[-1]["citations"][0]["block_id"] == "p003-b0001"


def test_ask_endpoint_requires_llm_key_from_env_or_request():
    # Cả env và request đều không có LLM key: trả 400 sớm, không gọi upstream
    settings = Settings(api_keys=frozenset({"test-key"}))
    client = TestClient(build_app(settings, agent=FakeAgent()))
    missing = client.post(
        "/v1/ask",
        json={"question": "q"},
        headers={"X-API-Key": "test-key"},
    )
    assert missing.status_code == 400
    assert "LLM API Key" in missing.json()["detail"]

    # Request mang theo LLM key: vẫn cho qua dù env rỗng (FakeAgent bỏ qua chat_fn)
    ok = client.post(
        "/v1/ask",
        json={"question": "q", "llm_api_key": "sk-from-frontend"},
        headers={"X-API-Key": "test-key"},
    )
    assert ok.status_code == 200
    assert ok.json()["data"]["answer"].startswith("Câu trả lời:")


def test_ask_auto_creates_conversation_and_persists_history():
    """B1: tự tạo khi không có conversation_id; lượt hai nạp history và trả lại cùng id."""
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")
    rust = FakeRust()
    agent = FakeAgent()
    client = TestClient(build_app(settings, agent=agent, rust=rust))

    first = client.post(
        "/v1/ask",
        json={"question": "Câu hỏi đầu tiên", "document_id": "doc-a"},
        headers={"X-API-Key": "test-key"},
    )
    assert first.status_code == 200
    data1 = first.json()["data"]
    conversation_id = data1["conversation_id"]
    assert conversation_id.startswith("conv-")
    assert conversation_id in rust.conversations
    # Đã ghi lại user + assistant
    assert len(rust.conversations[conversation_id]["messages"]) == 2
    assert agent.last_history == []

    second = client.post(
        "/v1/ask",
        json={
            "question": "Câu hỏi tiếp theo",
            "document_id": "doc-a",
            "conversation_id": conversation_id,
        },
        headers={"X-API-Key": "test-key"},
    )
    assert second.status_code == 200
    data2 = second.json()["data"]
    assert data2["conversation_id"] == conversation_id
    assert len(agent.last_history) == 2
    assert agent.last_history[0]["role"] == "user"
    assert "Câu hỏi đầu tiên" in agent.last_history[0]["content"]
    assert "(hist=2)" in data2["answer"]
    assert len(rust.conversations[conversation_id]["messages"]) == 4


def test_ask_stream_done_includes_conversation_id():
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")
    rust = FakeRust()
    client = TestClient(build_app(settings, agent=FakeAgent(), rust=rust))

    with client.stream(
        "POST",
        "/v1/ask",
        json={"question": "Phiên luồng?", "stream": True, "document_id": "doc-a"},
        headers={"X-API-Key": "test-key"},
    ) as response:
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))
    done = events[-1]
    assert done["type"] == "done"
    assert done["conversation_id"].startswith("conv-")


def test_summary_lands_on_head_path_and_feeds_next_turn():
    """Khóa hồi quy theo kiểm toán A2: summary phải nối vào đường dẫn head —
    history của câu hỏi thứ hai phải đọc lại được 【Tóm tắt cuộc trò chuyện】, thay vì nén lại mỗi
    lượt và tích lũy summary mồ côi.

    Điểm chính: seed và cả hai lần ask đều truyền rõ chuỗi parent (mô phỏng frontend
    thực tế), nếu không phép tổng hợp tuyến tính với parent rỗng của FakeRust sẽ che
    mất nhánh chết."""
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="env-llm-key",
        memory_window_turns=2,
        memory_compress_after_turns=2,
    )
    rust = FakeRust()
    created = rust.create_conversation(title="t", document_id="doc-a")
    cid = created["conversation_id"]
    prev = ""
    for i in range(6):
        u = rust.append_conversation_message(cid, role="user", content=f"U{i}", parent_id=prev)
        a = rust.append_conversation_message(
            cid, role="assistant", content=f"A{i} Kết luận [1]", parent_id=u["message_id"],
        )
        prev = a["message_id"]

    agent = FakeAgent()
    client = TestClient(build_app(settings, agent=agent, rust=rust))

    first = client.post(
        "/v1/ask",
        json={"question": "Câu hỏi đầu tiên", "document_id": "doc-a", "conversation_id": cid, "parent_id": prev},
        headers={"X-API-Key": "test-key"},
    )
    assert first.status_code == 200

    conv = rust.conversations[cid]
    # Summary nằm trên đường dẫn head: lần theo parent từ head phải đi qua node 【Tóm tắt cuộc trò chuyện】
    by_id = {m["message_id"]: m for m in conv["messages"]}
    cur = by_id.get(conv["head_id"])
    on_path = []
    while cur is not None:
        on_path.append(cur)
        cur = by_id.get(cur.get("parent_id") or "")
    assert any(
        str(m.get("content") or "").startswith("【Tóm tắt cuộc trò chuyện】") for m in on_path
    ), "Summary không nằm trên đường dẫn head (hồi quy nhánh chết)"

    second = client.post(
        "/v1/ask",
        json={"question": "Câu hỏi thứ hai", "document_id": "doc-a", "conversation_id": cid, "parent_id": conv["head_id"]},
        headers={"X-API-Key": "test-key"},
    )
    assert second.status_code == 200
    assert agent.last_history, "Câu hỏi thứ hai phải mang theo history"
    # assemble_history bọc summary thành lượt giả "known background" (assemble.py), không giữ tiền tố gốc
    assert any(
        "summary of the earlier conversation" in str(t.get("content") or "")
        for t in agent.last_history
    ), "Lịch sử của câu hỏi thứ hai không đọc lại được summary (hồi quy summary mồ côi)"


def test_persist_failure_surfaces_in_done_payload():
    """Khóa hồi quy theo kiểm toán C2: lỗi ghi lại phải báo persisted=false cho frontend, không âm thầm mất lượt."""
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")

    class BrokenPersistRust(FakeRust):
        def append_conversation_message(self, conversation_id, **kwargs):
            raise RuntimeError("db locked")

    rust = BrokenPersistRust()
    created = rust.conversations.setdefault(
        "conv-x",
        {"conversation_id": "conv-x", "title": "t", "document_id": "doc-a", "head_id": "", "messages": []},
    )
    del created
    client = TestClient(build_app(settings, agent=FakeAgent(), rust=rust))
    response = client.post(
        "/v1/ask",
        json={"question": "Câu hỏi", "document_id": "doc-a", "conversation_id": "conv-x"},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["persisted"] is False

    # Luồng bình thường persisted=True
    ok_rust = FakeRust()
    ok_client = TestClient(build_app(settings, agent=FakeAgent(), rust=ok_rust))
    ok = ok_client.post(
        "/v1/ask",
        json={"question": "Câu hỏi", "document_id": "doc-a"},
        headers={"X-API-Key": "test-key"},
    )
    assert ok.json()["data"]["persisted"] is True


def test_ask_force_compress_emits_compress_event_and_summary():
    """B2: khi force_compress, SSE gửi compress trước rồi tool/done; summary được lưu."""
    settings = Settings(
        api_keys=frozenset({"test-key"}),
        llm_api_key="env-llm-key",
        memory_window_turns=2,
        memory_compress_after_turns=100,
    )
    rust = FakeRust()
    # Chuẩn bị sẵn hội thoại dài
    created = rust.create_conversation(title="t", document_id="doc-a")
    cid = created["conversation_id"]
    for i in range(6):
        rust.append_conversation_message(cid, role="user", content=f"U{i}")
        rust.append_conversation_message(
            cid,
            role="assistant",
            content=f"A{i} Kết luận [1]",
            citations_json='[{"ref":1,"page_idx":0,"snippet":"s"}]',
        )

    agent = FakeAgent()
    client = TestClient(build_app(settings, agent=agent, rust=rust))
    with client.stream(
        "POST",
        "/v1/ask",
        json={
            "question": "Hỏi sau khi nén",
            "stream": True,
            "document_id": "doc-a",
            "conversation_id": cid,
            "force_compress": True,
        },
        headers={"X-API-Key": "test-key"},
    ) as response:
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))

    types = [e.get("type") for e in events]
    assert "compress" in types
    compress = next(e for e in events if e["type"] == "compress")
    assert compress["policy"] == "extractive_v1"
    assert compress["dropped_turns"] >= 1
    assert events[-1]["type"] == "done"
    assert events[-1]["memory"]["had_summary"] is True
    # Summary đã được ghi
    assert any(
        str(m.get("content") or "").startswith("【Tóm tắt cuộc trò chuyện】")
        for m in rust.conversations[cid]["messages"]
    )
    # Agent nhận history có summary
    assert agent.last_history
    assert any("Tóm tắt" in m["content"] for m in agent.last_history if m["role"] == "user")


def test_ask_resolves_document_id_from_job_id():
    # Job cũ cũng định vị được tài liệu: job_id → server phân tích document_id,
    # không còn phụ thuộc frontend tra ngược active_job_id
    captured = {}

    class RecordingAgent(FakeAgent):
        def ask(self, question, *, document_id="", job_id="", on_event=None, chat_fn=None, history=None):
            captured["document_id"] = document_id
            captured["job_id"] = job_id
            return super().ask(
                question,
                document_id=document_id,
                job_id=job_id,
                on_event=on_event,
                chat_fn=chat_fn,
            )

    class JobAwareRust(FakeRust):
        def get_document_by_job(self, job_id):
            assert job_id == "job-old"
            return {"document_id": "doc-a"}

    settings = Settings(api_keys=frozenset({"test-key"}))
    app = build_app(settings, agent=RecordingAgent(), rust=JobAwareRust())
    client = TestClient(app)
    response = client.post(
        "/v1/ask",
        json={"question": "Câu hỏi về nhiệm vụ lịch sử", "job_id": "job-old", "llm_api_key": "sk-test"},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 200
    assert captured["document_id"] == "doc-a"
    assert captured["job_id"] == "job-old"


def test_ask_keeps_explicit_document_id_over_job_id():
    captured = {}

    class RecordingAgent(FakeAgent):
        def ask(self, question, *, document_id="", job_id="", on_event=None, chat_fn=None, history=None):
            captured["document_id"] = document_id
            captured["job_id"] = job_id
            return super().ask(
                question,
                document_id=document_id,
                job_id=job_id,
                on_event=on_event,
                chat_fn=chat_fn,
            )

    settings = Settings(api_keys=frozenset({"test-key"}))
    app = build_app(settings, agent=RecordingAgent(), rust=FakeRust())
    client = TestClient(app)
    client.post(
        "/v1/ask",
        json={"question": "Câu hỏi", "document_id": "doc-explicit", "job_id": "job-x", "llm_api_key": "sk-test"},
        headers={"X-API-Key": "test-key"},
    )
    assert captured["document_id"] == "doc-explicit"
    assert captured["job_id"] == "job-x"


def test_ask_injects_conversation_history_and_persists_turn():
    calls = {"history": None, "appended": []}

    class HistoryAgent(FakeAgent):
        def ask(self, question, *, document_id="", job_id="", on_event=None, chat_fn=None, history=None):
            calls["history"] = history
            return super().ask(
                question,
                document_id=document_id,
                job_id=job_id,
                on_event=on_event,
                chat_fn=chat_fn,
            )

    class ConvRust(FakeRust):
        def get_conversation(self, conversation_id):
            assert conversation_id == "conv-1"
            return {
                "conversation_id": "conv-1",
                "messages": [
                    {"role": "user", "content": "Câu hỏi trước đó", "seq": 1},
                    {"role": "assistant", "content": "Câu trả lời trước đó [1]", "seq": 2},
                ],
            }

        def append_conversation_message(self, conversation_id, *, role, content, **kwargs):
            calls["appended"].append((conversation_id, role, content[:20], kwargs.get("citations_json", "")))
            return {"message_id": f"msg-{role}"}

    settings = Settings(api_keys=frozenset({"test-key"}))
    app = build_app(settings, agent=HistoryAgent(), rust=ConvRust())
    client = TestClient(app)
    response = client.post(
        "/v1/ask",
        json={"question": "Tiếp tục câu hỏi trước", "conversation_id": "conv-1", "llm_api_key": "sk-test"},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 200
    # Nạp lịch sử
    assert calls["history"] == [
        {"role": "user", "content": "Câu hỏi trước đó"},
        {"role": "assistant", "content": "Câu trả lời trước đó [1]"},
    ]
    # Ghi lại hai bản ghi user + assistant, assistant kèm snapshot trích dẫn
    assert [(c[1], c[0]) for c in calls["appended"]] == [("user", "conv-1"), ("assistant", "conv-1")]
    assert "block_id" in calls["appended"][1][3]


def test_agent_places_history_between_system_and_current_question():
    from retainpdf_ai.agent import RetrievalAgent
    from retainpdf_ai.tools import ToolRegistry

    seen = {}

    def chat(messages, tools):
        seen["messages"] = messages
        return {"content": "Được rồi.", "tool_calls": []}

    agent = RetrievalAgent(ToolRegistry([]), chat, max_tool_rounds=2)
    agent.ask(
        "Câu hỏi hiện tại",
        history=[
            {"role": "user", "content": "Câu hỏi trước"},
            {"role": "assistant", "content": "Câu trả lời trước"},
            {"role": "tool", "content": "should be dropped"},
        ],
    )
    roles = [m["role"] for m in seen["messages"]]
    assert roles == ["system", "user", "assistant", "user"]
    assert seen["messages"][1]["content"] == "Câu hỏi trước"
    assert seen["messages"][-1]["content"] == "Câu hỏi hiện tại"
