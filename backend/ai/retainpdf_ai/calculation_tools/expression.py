"""A small arithmetic interpreter built from an explicit Python AST whitelist."""

from __future__ import annotations

import ast
import math
import re
from collections.abc import Mapping

from ._validation import Number, bounded_payload, require_number
from .errors import CalculationError, fail
from .limits import (
    MAX_ABS_EXPRESSION_RESULT,
    MAX_EXPRESSION_CHARS,
    MAX_EXPRESSION_DEPTH,
    MAX_EXPRESSION_NODES,
    MAX_IDENTIFIER_CHARS,
    MAX_POWER_EXPONENT,
    MAX_VARIABLES,
)

_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")


def _depth(node: ast.AST) -> int:
    children = list(ast.iter_child_nodes(node))
    if not children:
        return 1
    return 1 + max(_depth(child) for child in children)


def _checked_result(value: object) -> Number:
    if type(value) not in (int, float):
        fail("invalid_result", "The expression produced an unsupported result.")
    if isinstance(value, float) and not math.isfinite(value):
        fail("numeric_limit_exceeded", "The expression exceeds the safe numeric limit.")
    if abs(value) > MAX_ABS_EXPRESSION_RESULT:
        fail("numeric_limit_exceeded", "The expression exceeds the safe numeric limit.")
    if isinstance(value, float) and value == 0:
        return 0.0
    return value


def _evaluate(node: ast.AST, variables: Mapping[str, Number]) -> Number:
    if isinstance(node, ast.Expression):
        return _evaluate(node.body, variables)

    if isinstance(node, ast.Constant):
        if type(node.value) not in (int, float):
            fail(
                "unsupported_expression",
                "The expression contains unsupported syntax.",
            )
        return _checked_result(require_number(node.value))

    if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
        if node.id not in variables:
            fail("unknown_variable", "The expression uses an unknown variable.")
        return variables[node.id]

    if isinstance(node, ast.UnaryOp) and type(node.op) in (ast.UAdd, ast.USub):
        operand = _evaluate(node.operand, variables)
        return _checked_result(operand if isinstance(node.op, ast.UAdd) else -operand)

    if not isinstance(node, ast.BinOp):
        fail("unsupported_expression", "The expression contains unsupported syntax.")

    left = _evaluate(node.left, variables)
    right = _evaluate(node.right, variables)
    operator = type(node.op)

    if operator in (ast.Div, ast.FloorDiv, ast.Mod) and right == 0:
        fail("division_by_zero", "Division by zero is not allowed.")
    if operator is ast.Pow:
        if not isinstance(right, int) and not (
            isinstance(right, float) and right.is_integer()
        ):
            fail("unsupported_expression", "Powers require an integer exponent.")
        if abs(right) > MAX_POWER_EXPONENT:
            fail("numeric_limit_exceeded", "The exponent exceeds the safe limit.")
        if left == 0 and right < 0:
            fail("division_by_zero", "Division by zero is not allowed.")

    try:
        if operator is ast.Add:
            result = left + right
        elif operator is ast.Sub:
            result = left - right
        elif operator is ast.Mult:
            result = left * right
        elif operator is ast.Div:
            result = left / right
        elif operator is ast.FloorDiv:
            result = left // right
        elif operator is ast.Mod:
            result = left % right
        elif operator is ast.Pow:
            result = left**right
        else:
            fail(
                "unsupported_expression",
                "The expression contains unsupported syntax.",
            )
    except CalculationError:
        raise
    except (ArithmeticError, OverflowError):
        fail("numeric_limit_exceeded", "The expression exceeds the safe numeric limit.")
    return _checked_result(result)


def calculate_expression(
    expression: str,
    variables: Mapping[str, int | float] | None = None,
) -> dict[str, object]:
    """Calculate bounded arithmetic without evaluating executable Python code.

    Supported syntax is numeric constants, named numeric variables, parentheses,
    unary ``+``/``-`` and ``+ - * / // % **``.  Calls, attributes, indexing,
    comparisons, strings, containers, comprehensions, and assignments are never
    interpreted.
    """
    if type(expression) is not str or not expression.strip():
        fail("invalid_expression", "Expression must be non-empty text.")
    if len(expression) > MAX_EXPRESSION_CHARS:
        fail("expression_limit_exceeded", "Expression exceeds the length limit.")
    if variables is None:
        checked_variables: dict[str, Number] = {}
    elif not isinstance(variables, Mapping):
        fail("invalid_variables", "Variables must be an object of numeric values.")
    else:
        if len(variables) > MAX_VARIABLES:
            fail("variable_limit_exceeded", "Too many variables were provided.")
        checked_variables = {}
        for name, value in variables.items():
            if (
                type(name) is not str
                or len(name) > MAX_IDENTIFIER_CHARS
                or _IDENTIFIER.fullmatch(name) is None
            ):
                fail("invalid_variable_name", "A variable name is invalid.")
            checked_variables[name] = require_number(value)

    try:
        tree = ast.parse(expression, mode="eval")
    except (SyntaxError, ValueError, TypeError, MemoryError, RecursionError):
        fail("invalid_expression", "Expression syntax is invalid.")

    try:
        nodes = list(ast.walk(tree))
        depth = _depth(tree)
    except (MemoryError, RecursionError):
        fail("expression_limit_exceeded", "Expression is too complex.")
    if len(nodes) > MAX_EXPRESSION_NODES or depth > MAX_EXPRESSION_DEPTH:
        fail("expression_limit_exceeded", "Expression is too complex.")

    value = _evaluate(tree, checked_variables)
    return bounded_payload(
        {
            "schema": "retainpdf.calculation-result.v1",
            "operation": "expression",
            "value": value,
        }
    )
