from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import sqlite3
import threading
import time

from retainpdf_pipeline.foundation.config import RENDER_TYPOGRAPHY_MEMORY_DIR


TYPOGRAPHY_MEMORY_SCHEMA_VERSION = "typography_memory_v1"
TYPOGRAPHY_MEMORY_ALGORITHM_VERSION = "font_leading_stats_v1"
MIN_OBSERVATIONS = 3
MAX_FONT_STD_PT = 0.45
MAX_LEADING_STD_EM = 0.12


@dataclass(frozen=True)
class TypographyMemoryDecision:
    font_size_pt: float
    leading_em: float
    observations: int
    confidence: float


class TypographyMemory:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or (RENDER_TYPOGRAPHY_MEMORY_DIR / "typography_memory.sqlite3")
        self._lock = threading.Lock()
        self._ready = False

    @property
    def enabled(self) -> bool:
        value = os.environ.get("RETAIN_RENDER_TYPOGRAPHY_MEMORY", "1").strip().lower()
        return value not in {"0", "false", "no", "off"}

    def lookup(self, feature_key: str) -> TypographyMemoryDecision | None:
        if not self.enabled or not feature_key:
            return None
        try:
            self._ensure_schema()
            with self._connect() as conn:
                row = conn.execute(
                    """
                    select observations, font_mean, leading_mean, font_m2, leading_m2
                    from typography_stats
                    where feature_key = ? and algorithm_version = ?
                    """,
                    (feature_key, TYPOGRAPHY_MEMORY_ALGORITHM_VERSION),
                ).fetchone()
        except Exception:
            return None
        if row is None:
            return None
        observations = int(row[0] or 0)
        if observations < _min_observations():
            return None
        font_std = _stddev(float(row[3] or 0.0), observations)
        leading_std = _stddev(float(row[4] or 0.0), observations)
        if font_std > MAX_FONT_STD_PT or leading_std > MAX_LEADING_STD_EM:
            return None
        confidence = min(0.98, 0.55 + observations / 40.0)
        return TypographyMemoryDecision(
            font_size_pt=round(float(row[1]), 2),
            leading_em=round(float(row[2]), 3),
            observations=observations,
            confidence=round(confidence, 3),
        )

    def observe(
        self,
        *,
        feature_key: str,
        font_size_pt: float,
        leading_em: float,
    ) -> None:
        if not self.enabled or not feature_key or font_size_pt <= 0 or leading_em <= 0:
            return
        try:
            self._ensure_schema()
            now = int(time.time())
            with self._lock:
                with self._connect() as conn:
                    row = conn.execute(
                        """
                        select observations, font_mean, leading_mean, font_m2, leading_m2
                        from typography_stats
                        where feature_key = ? and algorithm_version = ?
                        """,
                        (feature_key, TYPOGRAPHY_MEMORY_ALGORITHM_VERSION),
                    ).fetchone()
                    if row is None:
                        conn.execute(
                            """
                            insert into typography_stats (
                                feature_key, algorithm_version, schema_version,
                                observations, font_mean, leading_mean,
                                font_m2, leading_m2, created_at, updated_at
                            )
                            values (?, ?, ?, 1, ?, ?, 0.0, 0.0, ?, ?)
                            """,
                            (
                                feature_key,
                                TYPOGRAPHY_MEMORY_ALGORITHM_VERSION,
                                TYPOGRAPHY_MEMORY_SCHEMA_VERSION,
                                float(font_size_pt),
                                float(leading_em),
                                now,
                                now,
                            ),
                        )
                    else:
                        observations, font_mean, leading_mean, font_m2, leading_m2 = row
                        next_font, next_font_m2 = _update_stats(
                            int(observations),
                            float(font_mean),
                            float(font_m2 or 0.0),
                            float(font_size_pt),
                        )
                        next_leading, next_leading_m2 = _update_stats(
                            int(observations),
                            float(leading_mean),
                            float(leading_m2 or 0.0),
                            float(leading_em),
                        )
                        conn.execute(
                            """
                            update typography_stats
                            set observations = observations + 1,
                                font_mean = ?,
                                leading_mean = ?,
                                font_m2 = ?,
                                leading_m2 = ?,
                                updated_at = ?
                            where feature_key = ? and algorithm_version = ?
                            """,
                            (
                                next_font,
                                next_leading,
                                next_font_m2,
                                next_leading_m2,
                                now,
                                feature_key,
                                TYPOGRAPHY_MEMORY_ALGORITHM_VERSION,
                            ),
                        )
        except Exception:
            return

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=3.0)
        conn.execute("pragma journal_mode=wal")
        conn.execute("pragma synchronous=normal")
        return conn

    def _ensure_schema(self) -> None:
        if self._ready:
            return
        with self._lock:
            if self._ready:
                return
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as conn:
                conn.execute(
                    """
                    create table if not exists typography_stats (
                        feature_key text not null,
                        algorithm_version text not null,
                        schema_version text not null,
                        observations integer not null,
                        font_mean real not null,
                        leading_mean real not null,
                        font_m2 real not null,
                        leading_m2 real not null,
                        created_at integer not null,
                        updated_at integer not null,
                        primary key (feature_key, algorithm_version)
                    )
                    """
                )
            self._ready = True


def _update_stats(count: int, mean: float, m2: float, value: float) -> tuple[float, float]:
    next_count = count + 1
    delta = value - mean
    next_mean = mean + delta / next_count
    delta2 = value - next_mean
    return next_mean, m2 + delta * delta2


def _stddev(m2: float, observations: int) -> float:
    if observations <= 1:
        return 0.0
    return (m2 / (observations - 1)) ** 0.5


def _min_observations() -> int:
    raw = os.environ.get("RETAIN_RENDER_TYPOGRAPHY_MEMORY_MIN_OBS", "").strip()
    try:
        return max(1, int(raw)) if raw else MIN_OBSERVATIONS
    except Exception:
        return MIN_OBSERVATIONS


typography_memory = TypographyMemory()


__all__ = [
    "TypographyMemory",
    "TypographyMemoryDecision",
    "typography_memory",
]
