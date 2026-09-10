"""Security and deterministic-result contract for in-memory calculation tools."""

from __future__ import annotations

import hashlib
import json
import math

import pytest
from retainpdf_ai.calculation_tools import (
    CalculationError,
    analyze_table,
    calculate_expression,
    calculate_statistics,
    generate_svg_chart,
)
from retainpdf_ai.calculation_tools.limits import (
    MAX_CHART_POINTS,
    MAX_EXPRESSION_CHARS,
    MAX_STATISTIC_VALUES,
    MAX_TABLE_CELLS,
)


def assert_error(code: str, callback) -> CalculationError:
    with pytest.raises(CalculationError) as raised:
        callback()
    assert raised.value.code == code
    assert raised.value.to_payload() == {
        "error": {"code": code, "message": raised.value.message}
    }
    return raised.value


def test_calculate_expression_supports_only_bounded_arithmetic_and_variables():
    result = calculate_expression(
        "-(subtotal + tax) * 2 // 3",
        {"subtotal": 10, "tax": 2.5},
    )

    assert result == {
        "schema": "retainpdf.calculation-result.v1",
        "operation": "expression",
        "value": -9.0,
    }
    assert calculate_expression("2 ** 8 + 7 % 3")["value"] == 257


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os').system('id')",
        "(1).__class__",
        "values[0]",
        "sum([1, 2])",
        "lambda: 1",
        "[item for item in values]",
        "(x := 1)",
        "1 < 2",
        "'not a number'",
        "True",
    ],
)
def test_calculate_expression_rejects_executable_or_non_arithmetic_syntax(expression):
    error = assert_error(
        "unsupported_expression",
        lambda: calculate_expression(expression, {"values": 1}),
    )

    assert expression not in error.message


def test_calculate_expression_has_stable_safe_failures_and_resource_limits():
    assert_error("invalid_expression", lambda: calculate_expression("1 +"))
    assert_error("division_by_zero", lambda: calculate_expression("10 / 0"))
    assert_error("unknown_variable", lambda: calculate_expression("secret + 1"))
    assert_error("invalid_number", lambda: calculate_expression("x", {"x": math.nan}))
    assert_error("invalid_number", lambda: calculate_expression("x", {"x": True}))
    assert_error("numeric_limit_exceeded", lambda: calculate_expression("2 ** 101"))
    assert_error(
        "expression_limit_exceeded",
        lambda: calculate_expression("1" * (MAX_EXPRESSION_CHARS + 1)),
    )
    assert_error(
        "expression_limit_exceeded",
        lambda: calculate_expression("+" * 30 + "1"),
    )


@pytest.mark.parametrize(
    ("operation", "expected"),
    [
        ("mean", 2.5),
        ("median", 2.5),
        ("min", 1),
        ("max", 4),
        ("sum", 10),
        ("count", 4),
        ("stddev", math.sqrt(1.25)),
    ],
)
def test_calculate_statistics_has_a_finite_explicit_operation_set(operation, expected):
    result = calculate_statistics([1, 2, 3, 4], operation)

    assert result["schema"] == "retainpdf.calculation-result.v1"
    assert result["operation"] == operation
    assert result["count"] == 4
    assert result["value"] == pytest.approx(expected)
    json.dumps(result, allow_nan=False)


def test_calculate_statistics_empty_and_invalid_input_contract():
    assert calculate_statistics([], "count")["value"] == 0
    assert calculate_statistics([], "sum")["value"] == 0
    assert_error("empty_values", lambda: calculate_statistics([], "mean"))
    assert_error("unsupported_operation", lambda: calculate_statistics([1], "variance"))
    assert_error("invalid_number", lambda: calculate_statistics([True], "sum"))
    assert_error("invalid_number", lambda: calculate_statistics([math.inf], "sum"))
    assert_error("invalid_input", lambda: calculate_statistics("1,2", "sum"))
    assert_error(
        "value_limit_exceeded",
        lambda: calculate_statistics([0] * (MAX_STATISTIC_VALUES + 1), "count"),
    )


def test_analyze_table_returns_structure_and_statistics_without_echoing_rows():
    result = analyze_table(
        [[1, "alpha", None], [2, "beta", 3], [None, "alpha", "unknown"]],
        headers=["score", "name", "mixed"],
    )

    assert result["schema"] == "retainpdf.table-analysis.v1"
    assert (result["row_count"], result["column_count"], result["cell_count"]) == (
        3,
        3,
        9,
    )
    score, name, mixed = result["columns"]
    assert score == {
        "index": 0,
        "name": "score",
        "kind": "number",
        "count": 2,
        "missing_count": 1,
        "numeric_count": 2,
        "text_count": 0,
        "statistics": {
            "count": 2,
            "sum": 3,
            "mean": 1.5,
            "median": 1.5,
            "min": 1,
            "max": 2,
            "stddev": 0.5,
        },
    }
    assert name["kind"] == "text"
    assert name["distinct_text_count"] == 2
    assert mixed["kind"] == "mixed"
    assert "statistics" not in mixed
    assert "alpha" not in json.dumps(result)


def test_analyze_table_handles_empty_data_with_explicit_or_generated_headers():
    assert analyze_table([]) == {
        "schema": "retainpdf.table-analysis.v1",
        "row_count": 0,
        "column_count": 0,
        "cell_count": 0,
        "columns": [],
    }
    result = analyze_table([], headers=["amount"])
    assert result["columns"][0]["kind"] == "empty"
    assert result["columns"][0]["name"] == "amount"
    assert analyze_table([[1, 2]])["columns"][1]["name"] == "column_2"


def test_analyze_table_rejects_ambiguous_unsafe_or_excessive_tables():
    assert_error("invalid_table", lambda: analyze_table([[1], [1, 2]]))
    assert_error("invalid_table", lambda: analyze_table([[1, 2]], headers=["only-one"]))
    assert_error("invalid_table", lambda: analyze_table([[1, 2]], headers=["x", "x"]))
    assert_error("invalid_table", lambda: analyze_table([[True]]))
    assert_error("invalid_number", lambda: analyze_table([[math.nan]]))
    assert_error("invalid_text", lambda: analyze_table([["bad\x00text"]]))
    rows = [[0] * 21 for _ in range(MAX_TABLE_CELLS // 21 + 1)]
    assert_error("table_limit_exceeded", lambda: analyze_table(rows))


def test_generate_svg_chart_is_deterministic_bounded_and_self_contained():
    first = generate_svg_chart(
        ["A", "B", "C"],
        [-2, 0, 4],
        chart_type="line",
        title="Revenue < forecast & plan",
        series_name="USD",
    )
    second = generate_svg_chart(
        ["A", "B", "C"],
        [-2, 0, 4],
        chart_type="line",
        title="Revenue < forecast & plan",
        series_name="USD",
    )

    assert first == second
    assert first["schema"] == "retainpdf.calculation-artifact.v1"
    assert first["chart"] == {
        "type": "line",
        "point_count": 3,
        "width": 640,
        "height": 360,
    }
    artifact = first["artifact"]
    svg = artifact["content"]
    encoded = svg.encode("utf-8")
    assert artifact["kind"] == "svg_chart"
    assert artifact["media_type"] == "image/svg+xml"
    assert artifact["filename"] == "chart.svg"
    assert artifact["size_bytes"] == len(encoded)
    assert artifact["sha256"] == hashlib.sha256(encoded).hexdigest()
    assert "&lt; forecast &amp; plan" in svg
    assert "<script" not in svg
    assert "href=" not in svg
    assert "http" not in svg.removeprefix('<svg xmlns="http://www.w3.org/2000/svg"')
    json.dumps(first, allow_nan=False)


def test_generate_svg_chart_escapes_labels_and_rejects_invalid_requests():
    result = generate_svg_chart(["<script>alert(1)</script>"], [1])
    svg = result["artifact"]["content"]
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in svg
    assert "<script>" not in svg

    assert_error(
        "unsupported_chart",
        lambda: generate_svg_chart(["a"], [1], chart_type="pie"),
    )
    assert_error("invalid_chart", lambda: generate_svg_chart([], []))
    assert_error("invalid_chart", lambda: generate_svg_chart(["a"], [1, 2]))
    assert_error("invalid_chart", lambda: generate_svg_chart(["a"], [1], width=10))
    assert_error("invalid_number", lambda: generate_svg_chart(["a"], [math.inf]))
    assert_error("invalid_text", lambda: generate_svg_chart(["bad\nlabel"], [1]))
    assert_error(
        "chart_limit_exceeded",
        lambda: generate_svg_chart(
            [str(index) for index in range(MAX_CHART_POINTS + 1)],
            [1] * (MAX_CHART_POINTS + 1),
        ),
    )
