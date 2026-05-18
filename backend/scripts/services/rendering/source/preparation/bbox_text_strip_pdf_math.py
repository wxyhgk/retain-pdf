from __future__ import annotations


PdfMatrix = tuple[float, float, float, float, float, float]


IDENTITY_MATRIX: PdfMatrix = (1, 0, 0, 1, 0, 0)


def mul_matrix(left: PdfMatrix, right: PdfMatrix) -> PdfMatrix:
    a, b, c, d, e, f = left
    g, h, i, j, k, l = right
    return (
        a * g + c * h,
        b * g + d * h,
        a * i + c * j,
        b * i + d * j,
        a * k + c * l + e,
        b * k + d * l + f,
    )


def matrix_point(matrix: PdfMatrix) -> tuple[float, float]:
    return matrix[4], matrix[5]


def to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def matrix_from_operands(operands: object) -> PdfMatrix | None:
    if len(operands) < 6:
        return None
    return tuple(to_float(operands[index]) for index in range(6))  # type: ignore[return-value]


def matrix_from_object(value: object) -> PdfMatrix:
    try:
        if len(value) >= 6:
            return tuple(to_float(value[index]) for index in range(6))  # type: ignore[return-value]
    except Exception:
        pass
    return IDENTITY_MATRIX
