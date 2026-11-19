#!/usr/bin/env python3
"""重新生成内置的模型价格快照（用量汇总估算花费用；断网、第一次启动、还没同步过时用它）。

    python3 ops/development/update_model_prices.py                 # 从 models.dev 拉最新的
    python3 ops/development/update_model_prices.py --from api.json # 用已经下载好的文件

服务端每天自己从 models.dev 同步一次（`retainpdf-providers` 的 `pricing`），这份快照只是兜底，
隔几个月、或者加了新的常用服务商时更新一次就行。只留官方服务商（OFFICIAL_PROVIDERS）的价格字段，
格式和 models.dev 的 api.json 相同，服务端用同一段代码读。

数据来自 models.dev（github.com/anomalyco/models.dev，MIT 许可）。
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = REPO_ROOT / "backend" / "packages" / "retainpdf-providers" / "src" / "pricing" / "models-dev-snapshot.json"
SOURCE_URL = "https://models.dev/api.json"

# 和服务端 pricing::OFFICIAL_PROVIDERS 保持一致：域名对不上时按这个顺序找模型的官方标价。
OFFICIAL_PROVIDERS = (
    "anthropic", "openai", "google", "deepseek", "alibaba-cn", "alibaba", "zhipuai", "zai",
    "moonshotai-cn", "moonshotai", "xai", "mistral", "minimax-cn", "minimax", "volcengine",
    "siliconflow-cn", "siliconflow",
)
COST_FIELDS = ("input", "output", "cache_read", "cache_write", "tiers")


def trim(raw: dict) -> dict:
    out: dict = {
        "_source": SOURCE_URL,
        "_license": "MIT (models.dev, github.com/anomalyco/models.dev)",
        "_snapshot_date": time.strftime("%Y-%m-%d", time.gmtime()),
    }
    for provider in OFFICIAL_PROVIDERS:
        entry = raw.get(provider)
        if not isinstance(entry, dict):
            print(f"warning: models.dev has no provider {provider}", file=sys.stderr)
            continue
        models = {}
        for model_id, model in sorted((entry.get("models") or {}).items()):
            cost = model.get("cost") if isinstance(model, dict) else None
            if isinstance(cost, dict) and cost.get("input") is not None and cost.get("output") is not None:
                models[model_id] = {"cost": {k: cost[k] for k in COST_FIELDS if k in cost}}
        out[provider] = {"id": provider, **({"api": entry["api"]} if entry.get("api") else {}), "models": models}
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--from", dest="source", type=Path, default=None, help="a downloaded models.dev api.json")
    args = parser.parse_args()
    if args.source:
        raw = json.loads(args.source.read_text(encoding="utf-8"))
    else:
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "retainpdf-price-sync"})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = json.loads(response.read().decode("utf-8"))
    snapshot = trim(raw)
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    models = sum(len(v["models"]) for k, v in snapshot.items() if not k.startswith("_"))
    print(f"{SNAPSHOT.relative_to(REPO_ROOT)}: {len(snapshot) - 3} providers, {models} models")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
