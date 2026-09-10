"""启动入口:python -m retainpdf_ai"""

from __future__ import annotations

import uvicorn

from .app import build_app
from .config import load_settings


def main() -> None:
    settings = load_settings()
    uvicorn.run(build_app(settings), host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
