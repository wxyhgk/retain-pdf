"""自带 agent 的记忆和对话上下文（只用标准库，2026-11-26）：经后端接口读写，库是正本。

方案见 docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md，接口见 docs/api/16-AI/02-主对话和记忆.md。

- **开会话时取上下文**（握手带了对话，桥给 `RETAIN_ASK_CONVERSATION_ID`）：`GET /ai/ask-conversations/{id}/context` 一次拿到
  记忆那段（后端写好的，放进系统提示词最后，见 `server.py`）和最近几轮（当真的 user / assistant 消息塞进会话历史，能走缓存）。
  取不到（后端没开、对话删了）就当没有前文，照常回答。
- **两个工具**（有后端地址和密钥就给，不要书）：
  - `remember(text, scope, category?, replaces?)`：`POST /ai/memories`（`origin: agent`，出处是这个对话、这一问的书和页）。
    成功的结果多带一份 `meta`（`{"memory": {id, scope, text, category, document_id, replaced}}`），`server.py` 把它放进
    `tool_call_update` 的 `_meta.retainpdf`，前端画成「已记住：……（撤销）」。
  - `search_memories(query, scope?, limit?)`：`GET /ai/memories?q=…`；书层默认只查当前这本书。
- 每一问的额度在 `server.py` 的 `TurnBudget`：记 `REMEMBER_PER_TURN` 次、查 `SEARCH_PER_TURN` 次。
- 「让 AI 使用记忆」总开关（`GET /ai/ask-settings` 的 `memory_enabled`，2026-11-26 用户定，默认开）：每次调这两个工具前看一眼，
  关着就不发请求、回「用户关掉了记忆」；开会话时后端的上下文本来就不带记忆。看不了（后端没开）当开着，请求自己会报错。
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

from retainpdf_ask_agent.tools import ToolResult
from retainpdf_ask_agent.tools import tool_error

DISABLED_NOTE = "用户在设置里关掉了「让 AI 使用记忆」，这次没有{}。照常回答，不用再调记忆的工具；用户要你记的话，告诉他先在设置里打开。"
REMEMBER_TOOL = "remember"
SEARCH_TOOL = "search_memories"
REMEMBER_PER_TURN = 3
SEARCH_PER_TURN = 2
MAX_MEMORY_CHARS = 500
DEFAULT_SEARCH_LIMIT = 8
MAX_SEARCH_LIMIT = 20
RECENT_TURNS = 6
TIMEOUT_SECS = 10
CONTEXT_TIMEOUT_SECS = 3
CATEGORIES = ("preference", "background", "style", "progress", "term", "conclusion", "other")
CATEGORY_LABELS = {"preference": "偏好", "background": "背景", "style": "回答风格", "progress": "进度", "term": "术语",
                   "conclusion": "结论", "other": "其他"}
ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,200}$")

# (方法, 路径, 请求体或 None, 超时) → (状态码, 内容)；连不上抛 OSError
HttpCall = Callable[[str, str, Any, float], tuple[int, bytes]]

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": REMEMBER_TOOL,
        "description": "把关于用户或这本书的一件事记下来，以后的对话都能用（用户能看到「已记住」，也能撤销）。"
                       "只记用户明说的偏好、背景、对回答的要求，和跟用户一起定下的术语译法、结论、读到哪；"
                       "不记书的内容本身，不记密钥、密码和别的隐私。一条一件事，写成「用户……」或「这本书……」。"
                       "和已有的记忆矛盾或要更新时，用 replaces 给旧记忆的编号（[mem-…]），不要再记一条重复的。",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "maxLength": MAX_MEMORY_CHARS, "description": "要记的一件事"},
                "scope": {"type": "string", "enum": ["user", "book"],
                          "description": "user：关于用户（偏好、背景、回答风格）；book：关于正在读的这本书（读到哪、术语、结论）"},
                "category": {"type": "string", "enum": list(CATEGORIES), "description": "类别，默认 other"},
                "replaces": {"type": "string", "description": "要替代的旧记忆编号（mem-…），可选"},
            },
            "required": ["text", "scope"],
            "additionalProperties": False,
        },
    },
    {
        "name": SEARCH_TOOL,
        "description": "查之前记下的记忆（关于用户的、关于这本书的），系统提示词里没列全或要找某件事时用。"
                       "空格隔开的几个词都要在同一条里；找不到换个说法再试一次。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "要找的字或词"},
                "scope": {"type": "string", "enum": ["user", "book", "all"], "description": "查哪一层，默认 all（书层只查这本书）"},
                "limit": {"type": "integer", "minimum": 1, "maximum": MAX_SEARCH_LIMIT, "description": f"最多几条，默认 {DEFAULT_SEARCH_LIMIT}"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


def default_http_call(base_url: str, api_key: str) -> HttpCall:
    """标准库的请求：带 `X-API-Key`，JSON 进 JSON 出；不走系统代理（后端在本机回环地址上）。"""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def call(method: str, path: str, body: Any, timeout: float) -> tuple[int, bytes]:
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {"X-API-Key": api_key, "Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(base_url.rstrip("/") + path, data=data, headers=headers, method=method)
        try:
            with opener.open(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read() or b""

    return call


def _payload(status: int, body: bytes) -> tuple[Any, str]:
    """(data, 出错说明)：成功是 `{code, message, data}` 里的 data。"""
    try:
        payload = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None, f"HTTP {status}"
    if 200 <= status < 300 and isinstance(payload, dict):
        return payload.get("data"), ""
    message = payload.get("message") if isinstance(payload, dict) else ""
    reason = ((payload.get("error") or {}).get("details") or {}).get("reason") if isinstance(payload, dict) else None
    return None, f"HTTP {status}：{message or ''}{f'（{reason}）' if reason else ''}"


def memory_line(memory: dict[str, Any]) -> str:
    """和后端给模型看的写法一样：`- [编号] 日期 类别：内容`，书层的另标「这本书」/「别的书」由调用方加。"""
    date = str(memory.get("updated_at") or "")[:10]
    label = CATEGORY_LABELS.get(str(memory.get("category") or ""), "其他")
    return f"- [{memory.get('memory_id')}] {date} {label}：{str(memory.get('text') or '').strip()}"


class MemoryTools:
    """记忆的两个工具和开会话的上下文。`http` 可以换成假的（测试）。"""

    def __init__(self, *, http: HttpCall, conversation_id: str = "", document_id: str = "", job_id: str = ""):
        self.http = http
        self.conversation_id = conversation_id if ID_RE.match(conversation_id or "") else ""
        self.document_id = document_id if ID_RE.match(document_id or "") else ""
        self.job_id = job_id if ID_RE.match(job_id or "") else ""
        # 这一问的出处（`set_turn`）：书层记在哪本书、出处记哪页
        self._turn: dict[str, Any] = {}

    # 工具 ---------------------------------------------------------------

    def specs(self) -> list[dict[str, Any]]:
        return TOOL_SPECS

    def handles(self, name: str) -> bool:
        return name in (REMEMBER_TOOL, SEARCH_TOOL)

    def describe(self, name: str, arguments: dict[str, Any]) -> tuple[str, str]:
        if name == REMEMBER_TOOL:
            return f"记住：{str(arguments.get('text') or '').strip()[:60]}", "other"
        return f"查记忆「{str(arguments.get('query') or '')[:40]}」", "search"

    def set_turn(self, selection: dict[str, Any] | None) -> None:
        """这一问的出处（`_meta.retainpdf.selection`）：有书、有页就记下，`remember` 用。"""
        turn: dict[str, Any] = {}
        if isinstance(selection, dict):
            for key in ("document_id", "job_id"):
                value = selection.get(key)
                if isinstance(value, str) and ID_RE.match(value):
                    turn[key] = value
            if isinstance(selection.get("page"), int) and not isinstance(selection.get("page"), bool):
                turn["page"] = selection["page"]
        self._turn = turn

    def _book(self) -> str:
        return self._turn.get("document_id") or self.document_id

    def enabled(self) -> bool:
        """「让 AI 使用记忆」开着没有；看不了当开着。"""
        try:
            status, raw = self.http("GET", "/api/v1/ai/ask-settings", None, TIMEOUT_SECS)
        except OSError:
            return True
        data, problem = _payload(status, raw)
        return problem != "" or not isinstance(data, dict) or data.get("memory_enabled") is not False

    def run(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        if self.handles(name) and not self.enabled():
            return ToolResult(text=DISABLED_NOTE.format("记" if name == REMEMBER_TOOL else "查"), is_error=True, summary="用户关掉了记忆")
        if name == REMEMBER_TOOL:
            return self._remember(arguments)
        if name == SEARCH_TOOL:
            return self._search(arguments)
        return tool_error(f"没有工具 {name}")

    def _remember(self, arguments: dict[str, Any]) -> ToolResult:
        text = str(arguments.get("text") or "").strip()
        scope = arguments.get("scope")
        if not text:
            return tool_error("text 不能是空的：写要记的那件事。")
        if len(text) > MAX_MEMORY_CHARS:
            return tool_error(f"一条最多 {MAX_MEMORY_CHARS} 字：拆成几件事分别记，或者写短一点。")
        if scope not in ("user", "book"):
            return tool_error("scope 只能是 user 或 book。")
        category = arguments.get("category") or "other"
        if category not in CATEGORIES:
            return tool_error(f"category 只能是 {', '.join(CATEGORIES)} 之一。")
        body: dict[str, Any] = {"scope": scope, "category": category, "text": text, "origin": "agent", "agent_id": "retainpdf"}
        if scope == "book":
            if not self._book():
                return tool_error("现在不知道是哪本书，记不了书层的记忆；关于用户的事用 scope=user。")
            body["document_id"] = self._book()
        if self.conversation_id:
            body["source_conversation_id"] = self.conversation_id
        job_id = self._turn.get("job_id") or self.job_id
        if job_id:
            body["source_job_id"] = job_id
        if self._turn.get("page"):
            body["source_page"] = self._turn["page"]
        replaces = arguments.get("replaces")
        if isinstance(replaces, str) and replaces.strip():
            if not ID_RE.match(replaces.strip()):
                return tool_error("replaces 要写旧记忆的编号（mem-…）。")
            body["replaces"] = replaces.strip()
        try:
            status, raw = self.http("POST", "/api/v1/ai/memories", body, TIMEOUT_SECS)
        except OSError as error:
            return tool_error(f"连不上 RetainPDF 后端，没记上：{error}")
        data, problem = _payload(status, raw)
        if "ask_memory_disabled" in problem:
            return ToolResult(text=DISABLED_NOTE.format("记"), is_error=True, summary="用户关掉了记忆")
        if problem or not isinstance(data, dict) or not isinstance(data.get("memory"), dict):
            return tool_error(f"没记上：{problem or '后端回的不对'}")
        memory = data["memory"]
        created = bool(data.get("created"))
        note = "记住了" if created else "已经记过一模一样的，没有重复记"
        replaced = data.get("replaced")
        text_for_model = f"{note}（{memory.get('memory_id')}）。" + (f"旧的 {replaced} 已标为被替代。" if replaced else "")
        meta = {"memory": {
            "id": memory.get("memory_id"),
            "scope": memory.get("scope"),
            "text": memory.get("text"),
            "category": memory.get("category"),
            "document_id": memory.get("document_id"),
            "created": created,
            "replaced": replaced,
        }}
        return ToolResult(text=text_for_model, summary=f"已记住：{memory.get('text')}"[:200], meta=meta)

    def _get(self, path: str, query: dict[str, Any]) -> tuple[Any, str]:
        query = {key: value for key, value in query.items() if value not in (None, "")}
        try:
            status, raw = self.http("GET", f"{path}?{urllib.parse.urlencode(query)}", None, TIMEOUT_SECS)
        except OSError as error:
            return None, f"连不上 RetainPDF 后端：{error}"
        return _payload(status, raw)

    def _search(self, arguments: dict[str, Any]) -> ToolResult:
        query = str(arguments.get("query") or "").strip()
        if not query:
            return tool_error("query 不能是空的。")
        scope = arguments.get("scope") or "all"
        if scope not in ("user", "book", "all"):
            return tool_error("scope 只能是 user、book 或 all。")
        limit = arguments.get("limit")
        limit = limit if isinstance(limit, int) and not isinstance(limit, bool) and 1 <= limit <= MAX_SEARCH_LIMIT else DEFAULT_SEARCH_LIMIT
        found: list[dict[str, Any]] = []
        layers = ["user", "book"] if scope == "all" else [scope]
        for layer in layers:
            document_id = self._book() if layer == "book" else ""
            if layer == "book" and scope == "all" and not document_id:
                continue
            data, problem = self._get("/api/v1/ai/memories", {"q": query, "scope": layer, "document_id": document_id, "limit": limit})
            if problem:
                return tool_error(f"没查成：{problem}")
            found.extend(memory for memory in (data or {}).get("memories") or [] if isinstance(memory, dict))
        if not found:
            return ToolResult(text=f"记忆里没有找到「{query}」。", summary="没找到")
        lines = []
        for memory in found[:limit]:
            layer = "关于用户" if memory.get("scope") == "user" else ("这本书" if memory.get("document_id") == self._book() else "别的书")
            lines.append(f"{memory_line(memory)}（{layer}）")
        return ToolResult(text="\n".join(lines), summary=f"找到 {min(len(found), limit)} 条")

    # 开会话的上下文 ------------------------------------------------------

    def context(self) -> dict[str, Any] | None:
        """这个对话的上下文（记忆那段、最近几轮）；没有对话、取不到是 None。"""
        if not self.conversation_id:
            return None
        try:
            status, raw = self.http(
                "GET",
                f"/api/v1/ai/ask-conversations/{self.conversation_id}/context?"
                + urllib.parse.urlencode({"recent_turns": RECENT_TURNS, **({"document_id": self.document_id} if self.document_id else {})}),
                None,
                CONTEXT_TIMEOUT_SECS,
            )
        except OSError:
            return None
        data, problem = _payload(status, raw)
        return data if not problem and isinstance(data, dict) else None


def _message_text(message: dict[str, Any]) -> str:
    text = str(message.get("text") or "").strip()
    if message.get("role") == "side_summary":
        return f"（副对话的结论）{text}"
    page = message.get("page")
    if message.get("role") == "user" and isinstance(page, int):
        return f"（第 {page} 页）{text}"
    return text


# 上下文里压缩摘要那一段的标题（和后端拼给本机 agent 的 `text` 同一个写法）
SUMMARY_HEADING = "【之前对话的摘要】"


def context_history(context: dict[str, Any] | None) -> list[dict[str, Any]]:
    """上下文里的最近几轮 → 会话历史（只有文字）：副对话先接主对话的前文；摘要卡片当用户那边的一条；同一边连着的并成一条；
    开头是回答的去掉（各家都要求从用户开始）。"""
    if not context:
        return []
    raw: list[dict[str, Any]] = []
    parent = context.get("parent") if isinstance(context.get("parent"), dict) else None
    for source in ((parent or {}).get("messages") or [], context.get("messages") or []):
        raw.extend(message for message in source if isinstance(message, dict))
    history: list[dict[str, Any]] = []
    for message in raw:
        text = _message_text(message)
        if not text:
            continue
        role = "assistant" if message.get("role") == "assistant" else "user"
        if history and history[-1]["role"] == role:
            history[-1] = {"role": role, "content": f"{history[-1]['content']}\n\n{text}"}
        else:
            history.append({"role": role, "content": text})
    while history and history[0]["role"] != "user":
        history.pop(0)
    # 压过的（2026-11-26 第二期）：生效的那份摘要放在最前面，替代被压掉的那些轮；最近几轮原样在后面
    summary = str(context.get("summary") or "").strip()
    if summary:
        lead = f"{SUMMARY_HEADING}\n{summary}"
        if history and history[0]["role"] == "user":
            history[0] = {"role": "user", "content": f"{lead}\n\n{history[0]['content']}"}
        else:
            history.insert(0, {"role": "user", "content": lead})
    return history


def make_memory_tools(*, base_url: str, api_key: str, conversation_id: str = "", document_id: str = "", job_id: str = "") -> MemoryTools | None:
    """按桥给的环境变量建；没有后端地址或密钥就不给（没有记忆、没有前文）。"""
    if not base_url or not api_key:
        return None
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return MemoryTools(http=default_http_call(base_url, api_key), conversation_id=conversation_id, document_id=document_id, job_id=job_id)


__all__ = ["MemoryTools", "REMEMBER_PER_TURN", "REMEMBER_TOOL", "SEARCH_PER_TURN", "SEARCH_TOOL", "TOOL_SPECS", "context_history",
           "make_memory_tools", "memory_line"]
