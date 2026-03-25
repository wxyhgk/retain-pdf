from __future__ import annotations

from rendering.math_casebook import MATH_NORMALIZATION_CASES
from rendering.formula_normalizer import normalize_formula_for_latex_math


def main() -> None:
    failed = 0
    for case in MATH_NORMALIZATION_CASES:
        actual = normalize_formula_for_latex_math(case["source"])
        expected = case["expected_normalized"]
        if actual != expected:
            failed += 1
            print(f"[FAIL] {case['name']}")
            print(f"  source:   {case['source']}")
            print(f"  expected: {expected}")
            print(f"  actual:   {actual}")
        else:
            print(f"[OK] {case['name']}: {actual}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
