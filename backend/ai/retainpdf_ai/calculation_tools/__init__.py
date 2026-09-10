"""Safe deterministic calculation primitives for RetainPDF agents.

The package performs no file, shell, network, credential, or environment access.
All public functions consume in-memory JSON-like values and return bounded,
JSON-serializable payloads.
"""

from .charts import CHART_TYPES, generate_svg_chart
from .errors import CalculationError
from .expression import calculate_expression
from .statistics import STATISTIC_OPERATIONS, calculate_statistics
from .tables import analyze_table

__all__ = [
    "CHART_TYPES",
    "STATISTIC_OPERATIONS",
    "CalculationError",
    "analyze_table",
    "calculate_expression",
    "calculate_statistics",
    "generate_svg_chart",
]
