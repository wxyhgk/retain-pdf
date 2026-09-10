"""Payload layout internals.

Import concrete modules directly; this package intentionally avoids re-exporting
pipeline entrypoints so utility modules can depend on small helpers without
initializing the whole payload graph.
"""
