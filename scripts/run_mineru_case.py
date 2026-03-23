"""Top-level one-command MinerU entry.

This thin wrapper keeps the recommended CLI at `scripts/` while
reusing the stable implementation in `mineru/mineru_pipeline.py`.
"""

from mineru.mineru_pipeline import main


if __name__ == "__main__":
    main()
