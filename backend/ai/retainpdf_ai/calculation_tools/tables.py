"""Structural analysis for bounded, rectangular, in-memory tables."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypeAlias

from ._validation import (
    bounded_payload,
    require_number,
    require_sequence,
    require_text,
)
from .errors import fail
from .limits import (
    MAX_CELL_TEXT_CHARS,
    MAX_TABLE_CELLS,
    MAX_TABLE_COLUMNS,
    MAX_TABLE_ROWS,
    MAX_TOTAL_TABLE_TEXT_CHARS,
)
from .statistics import statistics_summary

Cell: TypeAlias = None | str | int | float


def _checked_headers(headers: object, column_count: int) -> list[str]:
    if headers is None:
        return [f"column_{index + 1}" for index in range(column_count)]
    sequence = require_sequence(headers, what="Headers")
    if len(sequence) != column_count:
        fail("invalid_table", "Header count must match the table column count.")
    checked = [
        require_text(header, what="A header", max_chars=MAX_CELL_TEXT_CHARS)
        for header in sequence
    ]
    if any(not header.strip() for header in checked):
        fail("invalid_table", "Headers must not be empty.")
    if len(set(checked)) != len(checked):
        fail("invalid_table", "Headers must be unique.")
    return checked


def analyze_table(
    rows: object,
    *,
    headers: Sequence[str] | None = None,
) -> dict[str, object]:
    """Describe a rectangular two-dimensional table without echoing its rows.

    Rows contain only ``null``, text, or finite JSON numbers.  Explicit headers
    are metadata and are not removed from ``rows``.  Pure numeric columns receive
    a complete deterministic statistics summary; mixed columns do not silently
    coerce text into numbers.
    """
    row_sequence = require_sequence(rows, what="Rows")
    if len(row_sequence) > MAX_TABLE_ROWS:
        fail("table_limit_exceeded", "The table has too many rows.")

    checked_rows: list[list[Cell]] = []
    column_count: int | None = None
    total_text_chars = 0
    for row in row_sequence:
        row_values = require_sequence(row, what="Each row")
        if column_count is None:
            column_count = len(row_values)
            if column_count == 0:
                fail("invalid_table", "Table rows must contain at least one column.")
            if column_count > MAX_TABLE_COLUMNS:
                fail("table_limit_exceeded", "The table has too many columns.")
        elif len(row_values) != column_count:
            fail("invalid_table", "Table rows must all have the same length.")
        if (len(checked_rows) + 1) * column_count > MAX_TABLE_CELLS:
            fail("table_limit_exceeded", "The table has too many cells.")

        checked_row: list[Cell] = []
        for value in row_values:
            if value is None:
                checked_row.append(None)
            elif type(value) is str:
                text = require_text(
                    value,
                    what="A table cell",
                    max_chars=MAX_CELL_TEXT_CHARS,
                )
                total_text_chars += len(text)
                if total_text_chars > MAX_TOTAL_TABLE_TEXT_CHARS:
                    fail("table_limit_exceeded", "The table contains too much text.")
                checked_row.append(text)
            elif type(value) in (int, float):
                checked_row.append(require_number(value))
            else:
                fail(
                    "invalid_table",
                    "Table cells must be null, text, or finite numbers.",
                )
        checked_rows.append(checked_row)

    if column_count is None:
        if headers is None:
            column_count = 0
        else:
            header_sequence = require_sequence(headers, what="Headers")
            column_count = len(header_sequence)
            if column_count > MAX_TABLE_COLUMNS:
                fail("table_limit_exceeded", "The table has too many columns.")
    checked_headers = _checked_headers(headers, column_count)
    total_text_chars += sum(len(header) for header in checked_headers)
    if total_text_chars > MAX_TOTAL_TABLE_TEXT_CHARS:
        fail("table_limit_exceeded", "The table contains too much text.")

    columns: list[dict[str, object]] = []
    for index, name in enumerate(checked_headers):
        values = [row[index] for row in checked_rows]
        numeric = [value for value in values if type(value) in (int, float)]
        text = [value for value in values if type(value) is str]
        missing_count = sum(value is None for value in values)
        if numeric and text:
            kind = "mixed"
        elif numeric:
            kind = "number"
        elif text:
            kind = "text"
        else:
            kind = "empty"
        column: dict[str, object] = {
            "index": index,
            "name": name,
            "kind": kind,
            "count": len(values) - missing_count,
            "missing_count": missing_count,
            "numeric_count": len(numeric),
            "text_count": len(text),
        }
        if kind == "number":
            column["statistics"] = statistics_summary(numeric)
        elif text:
            column["distinct_text_count"] = len(set(text))
        columns.append(column)

    return bounded_payload(
        {
            "schema": "retainpdf.table-analysis.v1",
            "row_count": len(checked_rows),
            "column_count": column_count,
            "cell_count": len(checked_rows) * column_count,
            "columns": columns,
        }
    )
