"""Shared safe-tool catalog, execution, persistence, and event projection.

The model sees fixed JSON schemas.  Raw calculation inputs remain in memory;
Rust receives only a hash plus document/block provenance and a bounded result.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import io
import json
import re
from html.parser import HTMLParser
from typing import Any

from .blocks import load_job_blocks
from .calculation_tools import (
    CalculationError,
    analyze_table,
    calculate_expression,
    calculate_statistics,
    generate_svg_chart,
)
from .config import Settings
from .rust_client import RustApiClient
from .tools import Tool

CALCULATION_TOOL_NAMES = frozenset(
    {
        "calculate_expression",
        "calculate_statistics",
        "analyze_table",
        "generate_chart",
    }
)
READING_TOOL_NAMES = frozenset(
    {
        "list_documents",
        "search_fulltext",
        "read_blocks",
        "search_favorites",
        "search_markdown",
        "read_markdown_chunk",
    }
)
_CONTEXT_KEY = "__retainpdf_tool_context"
_NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?%?$")


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self.header_rows: set[int] = set()
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._header_cell = False

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "tr":
            self._row = []
        elif tag.lower() in {"td", "th"} and self._row is not None:
            self._cell = []
            self._header_cell = tag.lower() == "th"

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            if self._header_cell:
                self.header_rows.add(len(self.rows))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None


def calculation_tools(settings: Settings, rust: RustApiClient) -> list[Tool]:
    executor = _CalculationExecutor(settings, rust)
    return [
        Tool(
            name="calculate_expression",
            description=(
                "Evaluate bounded arithmetic with +, -, *, /, //, %, ** and numeric "
                "variables. This cannot call functions, access files, use shell, or use network."
            ),
            parameters={
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "expression": {"type": "string", "maxLength": 512},
                    "variables": {
                        "type": "object",
                        "additionalProperties": {"type": "number"},
                        "maxProperties": 32,
                    },
                    "precision": {"type": "integer", "minimum": 0, "maximum": 15},
                },
                "required": ["expression"],
            },
            handler=lambda arguments: executor.invoke("calculate_expression", arguments),
        ),
        Tool(
            name="calculate_statistics",
            description=(
                "Calculate deterministic statistics for a bounded numeric array supplied by "
                "the user or a previous trusted tool result."
            ),
            parameters={
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "values": {
                        "type": "array",
                        "items": {"type": "number"},
                        "maxItems": 10000,
                    },
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["mean", "median", "min", "max", "sum", "count", "stddev"],
                        },
                        "minItems": 1,
                        "maxItems": 7,
                        "uniqueItems": True,
                    },
                },
                "required": ["values", "operations"],
            },
            handler=lambda arguments: executor.invoke("calculate_statistics", arguments),
        ),
        Tool(
            name="analyze_table",
            description=(
                "Analyze a table from authoritative document blocks. Input must be document, "
                "job, page, and block references; raw model-authored table rows are not accepted."
            ),
            parameters=_table_reference_schema(
                {
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["mean", "median", "min", "max", "sum", "count", "stddev"],
                        },
                        "maxItems": 7,
                        "uniqueItems": True,
                    }
                }
            ),
            handler=lambda arguments: executor.invoke("analyze_table", arguments),
        ),
        Tool(
            name="generate_chart",
            description=(
                "Generate a controlled bar or line SVG from authoritative table blocks. "
                "No scripts, external links, paths, shell, or network are available."
            ),
            parameters=_table_reference_schema(
                {
                    "label_column": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "string"}]},
                    "value_column": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "string"}]},
                    "chart_type": {"type": "string", "enum": ["bar", "line"]},
                    "title": {"type": "string", "maxLength": 120},
                    "series_name": {"type": "string", "maxLength": 120},
                },
                required=["label_column", "value_column"],
            ),
            handler=lambda arguments: executor.invoke("generate_chart", arguments),
        ),
    ]


def with_tool_context(
    arguments: dict[str, Any],
    *,
    conversation_id: str,
    request_message_id: str,
    document_id: str,
    job_id: str,
    tool_call_id: str,
) -> dict[str, Any]:
    scoped = dict(arguments)
    scoped[_CONTEXT_KEY] = {
        "conversation_id": conversation_id.strip(),
        "request_message_id": request_message_id.strip(),
        "document_id": document_id.strip(),
        "job_id": job_id.strip(),
        "tool_call_id": tool_call_id.strip()[:256],
    }
    return scoped


def agent_tool_event(
    name: str,
    tool_call_id: str,
    status: str,
    result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    kind = (
        "calculation"
        if name in CALCULATION_TOOL_NAMES
        else "reading"
        if name in READING_TOOL_NAMES
        else "pdf_operation"
    )
    summary = ""
    if result:
        if result.get("error"):
            summary = str(result["error"])[:512]
        elif result.get("summary"):
            summary = str(result["summary"])[:512]
        elif result.get("calculation_id"):
            summary = f"Calculation {result['calculation_id']} completed"
    event = {
        "type": "agent_tool",
        "tool_call_id": tool_call_id[:256],
        "kind": kind,
        "title": _tool_title(name),
        "status": status,
    }
    if summary:
        event["summary"] = summary
    if result and result.get("calculation_id"):
        event["calculation_id"] = str(result["calculation_id"])
    return event


class _CalculationExecutor:
    def __init__(self, settings: Settings, rust: RustApiClient) -> None:
        self._settings = settings
        self._rust = rust

    def invoke(self, name: str, raw_arguments: dict[str, Any]) -> dict[str, Any]:
        arguments = dict(raw_arguments)
        context = arguments.pop(_CONTEXT_KEY, {})
        if not isinstance(context, dict):
            context = {}
        canonical = json.dumps(
            arguments, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        input_sha256 = hashlib.sha256(canonical).hexdigest()
        calculation_id = self._calculation_id(name, context, input_sha256)
        durable = bool(
            calculation_id
            and context.get("conversation_id")
            and context.get("request_message_id")
        )
        if durable:
            try:
                existing = self._rust.create_agent_calculation(
                    calculation_id=calculation_id,
                    conversation_id=str(context.get("conversation_id") or ""),
                    request_message_id=str(context.get("request_message_id") or ""),
                    document_id=str(context.get("document_id") or ""),
                    job_id=str(context.get("job_id") or ""),
                    tool_name=name,
                    tool_call_id=str(context.get("tool_call_id") or ""),
                    input_refs=_input_refs(arguments, context),
                    input_sha256=input_sha256,
                )
            except Exception:  # noqa: BLE001 - external persistence boundary
                return {
                    "error": "The durable calculation store is unavailable.",
                    "code": "calculation_store_unavailable",
                    "calculation_id": calculation_id,
                }
            if existing.get("status") == "completed":
                return _public_completed(existing)
            if existing.get("status") == "failed":
                failure = existing.get("failure") or {}
                return {
                    "error": str(failure.get("message") or "calculation previously failed"),
                    "code": str(failure.get("code") or "calculation_failed"),
                    "calculation_id": calculation_id,
                }
        try:
            result, artifacts = self._execute(name, arguments, context)
        except CalculationError as exc:
            if durable:
                self._fail(calculation_id, exc.code, exc.message)
            return {
                "error": exc.message,
                "code": exc.code,
                "calculation_id": calculation_id,
            }
        except Exception:  # noqa: BLE001 - tool implementations are isolated here
            if durable:
                self._fail(
                    calculation_id,
                    "calculation_failed",
                    "The calculation could not be completed.",
                )
            return {
                "error": "The calculation could not be completed.",
                "code": "calculation_failed",
                "calculation_id": calculation_id,
            }
        if durable:
            try:
                completed = self._rust.complete_agent_calculation(
                    calculation_id, result=result, artifacts=artifacts
                )
                return _public_completed(completed)
            except Exception:  # noqa: BLE001 - external persistence boundary
                # Keep the durable run in `running`: a retry with the same request,
                # tool and input hash can recompute and complete it after recovery.
                return {
                    "error": "The durable calculation result could not be stored.",
                    "code": "calculation_store_unavailable",
                    "calculation_id": calculation_id,
                }
        return {**result, "durable": False}

    def _execute(
        self, name: str, arguments: dict[str, Any], context: dict[str, Any]
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        if name == "calculate_expression":
            result = calculate_expression(
                str(arguments.get("expression") or ""), arguments.get("variables")
            )
            precision = arguments.get("precision")
            if isinstance(precision, int) and not isinstance(precision, bool):
                result["value"] = round(float(result["value"]), max(0, min(precision, 15)))
            return result, []
        if name == "calculate_statistics":
            operations = arguments.get("operations")
            if not isinstance(operations, list) or not operations:
                raise CalculationError("invalid_operations", "At least one statistics operation is required.")
            values = arguments.get("values")
            results = {
                str(operation): calculate_statistics(values, str(operation))["value"]
                for operation in operations
            }
            return {
                "schema": "retainpdf.calculation-result.v1",
                "operation": "statistics",
                "count": len(values) if isinstance(values, list) else 0,
                "results": results,
            }, []
        rows, headers = _referenced_table(self._settings, arguments, context)
        if name == "analyze_table":
            result = analyze_table(rows, headers=headers)
            requested = arguments.get("operations")
            if isinstance(requested, list) and requested:
                allowed = {str(item) for item in requested}
                for column in result.get("columns", []):
                    stats = column.get("statistics") if isinstance(column, dict) else None
                    if isinstance(stats, dict):
                        column["statistics"] = {
                            key: value for key, value in stats.items() if key in allowed
                        }
            return result, []
        column_count = len(rows[0])
        label_index = _column_index(arguments.get("label_column"), headers, column_count)
        value_index = _column_index(arguments.get("value_column"), headers, column_count)
        labels = [str(row[label_index]) for row in rows]
        values = [_numeric_cell(row[value_index]) for row in rows]
        generated = generate_svg_chart(
            labels,
            values,
            chart_type=str(arguments.get("chart_type") or "bar"),
            title=str(arguments.get("title") or ""),
            series_name=str(arguments.get("series_name") or ""),
        )
        artifact = dict(generated.pop("artifact"))
        content = str(artifact.pop("content"))
        artifact_id = f"chart-{artifact['sha256'][:20]}"
        return generated, [
            {
                "artifact_id": artifact_id,
                "kind": artifact["kind"],
                "mime_type": artifact["media_type"],
                "sha256": artifact["sha256"],
                "content_base64": base64.b64encode(content.encode("utf-8")).decode("ascii"),
            }
        ]

    def _calculation_id(
        self, name: str, context: dict[str, Any], input_sha256: str
    ) -> str:
        identity = "\0".join(
            [
                str(context.get("conversation_id") or ""),
                str(context.get("request_message_id") or ""),
                name,
                input_sha256,
            ]
        )
        return f"calc-{hashlib.sha256(identity.encode()).hexdigest()[:40]}"

    def _fail(self, calculation_id: str, code: str, message: str) -> None:
        try:
            self._rust.fail_agent_calculation(calculation_id, code=code, message=message)
        except Exception:  # noqa: BLE001,S110 - failure reporting is best effort
            pass


def _table_reference_schema(
    extra: dict[str, Any], required: list[str] | None = None
) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "document_id": {"type": "string"},
            "job_id": {"type": "string"},
            "page_idx": {"type": "integer", "minimum": 0},
            "block_ids": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
                "maxItems": 32,
                "uniqueItems": True,
            },
            **extra,
        },
        "required": ["document_id", "job_id", "page_idx", "block_ids", *(required or [])],
    }


def _input_refs(arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    refs: dict[str, Any] = {}
    document_id = str(arguments.get("document_id") or context.get("document_id") or "").strip()
    job_id = str(arguments.get("job_id") or context.get("job_id") or "").strip()
    if document_id:
        refs["document_id"] = document_id
    if job_id:
        refs["job_id"] = job_id
    if isinstance(arguments.get("page_idx"), int):
        refs["page_idx"] = arguments["page_idx"]
    block_ids = arguments.get("block_ids")
    if isinstance(block_ids, list):
        refs["block_ids"] = [str(value) for value in block_ids]
    source_ids = arguments.get("source_calculation_ids")
    if isinstance(source_ids, list):
        refs["source_calculation_ids"] = [str(value) for value in source_ids]
    return refs


def _referenced_table(
    settings: Settings, arguments: dict[str, Any], context: dict[str, Any]
) -> tuple[list[list[Any]], list[str] | None]:
    document_id = str(arguments.get("document_id") or "").strip()
    job_id = str(arguments.get("job_id") or "").strip()
    page_idx = arguments.get("page_idx")
    block_ids = arguments.get("block_ids")
    if (
        not document_id
        or document_id != str(context.get("document_id") or "").strip()
        or not job_id
        or job_id != str(context.get("job_id") or "").strip()
        or not isinstance(page_idx, int)
        or not isinstance(block_ids, list)
        or not block_ids
    ):
        raise CalculationError(
            "invalid_table_reference", "The table reference does not match the current document."
        )
    job_root = settings.data_root / "jobs" / job_id
    try:
        job_root.resolve().relative_to((settings.data_root / "jobs").resolve())
    except (OSError, ValueError):
        raise CalculationError("invalid_table_reference", "The table reference is invalid.") from None
    selected = {
        block.block_id: block
        for block in load_job_blocks(job_root)
        if block.page_idx == page_idx and block.block_id in set(map(str, block_ids))
    }
    if set(map(str, block_ids)) != set(selected):
        raise CalculationError("table_block_not_found", "A referenced table block was not found.")
    texts = [selected[str(block_id)].source_text for block_id in block_ids]
    return _parse_table("\n".join(texts))


def _parse_table(text: str) -> tuple[list[list[Any]], list[str] | None]:
    if "<table" in text.lower():
        parser = _TableParser()
        parser.feed(text)
        rows = parser.rows
        header = rows.pop(0) if rows and 0 in parser.header_rows else None
    else:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if lines and "|" in lines[0]:
            rows = [[cell.strip() for cell in line.strip("|").split("|")] for line in lines]
            if len(rows) > 1 and all(set(cell) <= {"-", ":"} for cell in rows[1]):
                header, rows = rows[0], rows[2:]
            else:
                header = None
        else:
            try:
                rows = list(csv.reader(io.StringIO(text)))
            except csv.Error:
                rows = []
            header = None
    if not rows or not rows[0] or any(len(row) != len(rows[0]) for row in rows):
        raise CalculationError("invalid_table", "The referenced blocks do not contain a rectangular table.")
    return [[_coerce_cell(cell) for cell in row] for row in rows], header


def _coerce_cell(value: Any) -> Any:
    text = " ".join(str(value).split())
    normalized = text.replace(",", "")
    if _NUMBER.fullmatch(normalized):
        percent = normalized.endswith("%")
        if percent:
            normalized = normalized[:-1]
        number = float(normalized)
        return number / 100 if percent else number
    return text


def _numeric_cell(value: Any) -> float:
    value = _coerce_cell(value)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise CalculationError("non_numeric_chart_column", "The chart value column is not numeric.")
    return float(value)


def _column_index(value: Any, headers: list[str] | None, column_count: int) -> int:
    if (
        isinstance(value, int)
        and not isinstance(value, bool)
        and 0 <= value < column_count
    ):
        return value
    if isinstance(value, str) and headers and value in headers:
        return headers.index(value)
    raise CalculationError("invalid_chart_column", "A chart column reference is invalid.")


def _public_completed(record: dict[str, Any]) -> dict[str, Any]:
    result = record.get("result")
    payload = dict(result) if isinstance(result, dict) else {"ok": True}
    payload["calculation_id"] = str(record.get("calculation_id") or "")
    payload["durable"] = True
    artifacts = record.get("artifacts")
    if isinstance(artifacts, list):
        payload["artifacts"] = [
            {
                "artifact_id": str(item.get("artifact_id") or ""),
                "kind": str(item.get("kind") or ""),
                "mime_type": str(item.get("mime_type") or ""),
                "url": str(item.get("url") or ""),
            }
            for item in artifacts
            if isinstance(item, dict)
        ]
    return payload


def _tool_title(name: str) -> str:
    return {
        "calculate_expression": "Calculate expression",
        "calculate_statistics": "Calculate statistics",
        "analyze_table": "Analyze document table",
        "generate_chart": "Generate chart",
        "search_fulltext": "Search document",
        "read_blocks": "Read document blocks",
        "search_markdown": "Search legacy Markdown",
        "read_markdown_chunk": "Read legacy Markdown",
    }.get(name, name.replace("_", " ").strip().title())
