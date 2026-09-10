"""Trusted executors for backend-owned document operation programs."""

from .page_program import execute_page_program, validate_page_program

__all__ = ["execute_page_program", "validate_page_program"]
