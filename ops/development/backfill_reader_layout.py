#!/usr/bin/env python3
"""把本机旧书的「HTML 页版面」一次补完（2026-11-28 用户定：打开时自动补 + 批量命令）。

阅读页的 HTML 页照排版引擎的版面画（``GET /api/v1/jobs/{id}/reader/layout``）。2026-11-28 以前排的书版面都没留下；
补一本就是拿现在的引擎原地重新渲染一次，不调模型、不花钱，译文 PDF 换成现在的引擎排的。

这个脚本只走后端接口，一本一本来：问清单 → 后端自动登记补排（``backfill_queued``）或给出补排请求（``generate``）
→ 等这本跑完再下一本。Typst 排的书默认跳过（换引擎会让译文 PDF 明显变样），加 ``--include-typst`` 才补。

    python3 ops/development/backfill_reader_layout.py                    # 本机开发栈（127.0.0.1:41000）
    python3 ops/development/backfill_reader_layout.py --limit 3          # 先补 3 本看看
    python3 ops/development/backfill_reader_layout.py --include-typst    # Typst 排的也换引擎补

API key 从环境变量 ``RETAINPDF_API_KEY`` 读，没设用开发栈默认的 ``dev-local-key``；不打印 key。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

WAIT_REASONS = {"backfill_queued", "job_active"}


class Api:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def call(self, method: str, url: str, body: dict | None = None) -> dict:
        if not url.startswith("http"):
            url = self.base_url + url
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("X-API-Key", self.api_key)
        if data is not None:
            request.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8")).get("data") or {}


def jobs_with_pdf(api: Api) -> list[dict]:
    jobs: list[dict] = []
    offset = 0
    while True:
        page = api.call("GET", f"/api/v1/jobs?limit=100&offset={offset}")
        jobs.extend(item for item in page.get("items") or [] if item.get("output_pdf_ready"))
        if not page.get("has_more"):
            return jobs
        offset += 100


def layout(api: Api, job_id: str) -> dict:
    return api.call("GET", f"/api/v1/jobs/{job_id}/reader/layout")


def wait_for(api: Api, job_id: str, timeout: float, poll: float) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        view = layout(api, job_id)
        if view.get("available") or view.get("reason") not in WAIT_REASONS:
            return view
        if time.monotonic() > deadline:
            return {**view, "reason": "timeout"}
        time.sleep(poll)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("--base-url", default=os.environ.get("RETAINPDF_API_URL", "http://127.0.0.1:41000"))
    parser.add_argument("--include-typst", action="store_true", help="Typst 排的书也换成引擎重排")
    parser.add_argument("--limit", type=int, default=0, help="最多补几本（0 = 全部）")
    parser.add_argument("--timeout", type=float, default=1800, help="一本最多等几秒")
    parser.add_argument("--poll", type=float, default=5, help="几秒问一次")
    args = parser.parse_args()
    api = Api(args.base_url, os.environ.get("RETAINPDF_API_KEY", "dev-local-key"))

    try:
        jobs = jobs_with_pdf(api)
    except urllib.error.URLError as error:
        print(f"连不上后端 {args.base_url}：{error}", file=sys.stderr)
        return 2
    print(f"有译文 PDF 的任务 {len(jobs)} 个")
    tally: dict[str, int] = {}
    started = 0
    for job in jobs:
        job_id = str(job["job_id"])
        name = str(job.get("display_name") or job.get("source_file_name") or "")
        try:
            view = layout(api, job_id)
            reason = "available" if view.get("available") else str(view.get("reason") or "")
            if reason == "available":
                tally["已有"] = tally.get("已有", 0) + 1
                continue
            if args.limit and started >= args.limit:
                tally["没轮到（--limit）"] = tally.get("没轮到（--limit）", 0) + 1
                continue
            generate = view.get("generate")
            if reason in WAIT_REASONS:
                pass  # 后端已经登记了补排（或这本正在跑），等它
            elif generate and (reason == "not_kept" or (reason == "not_engine_route" and args.include_typst)):
                api.call(generate["method"], generate["url"], generate["body"])
            else:
                key = f"跳过：{reason}"
                tally[key] = tally.get(key, 0) + 1
                print(f"  跳过 {job_id} {name}（{reason}）")
                continue
            started += 1
            print(f"  补 {job_id} {name} …", flush=True)
            done = wait_for(api, job_id, args.timeout, args.poll)
            result = "补好" if done.get("available") else f"没补成：{done.get('reason')}"
            tally[result] = tally.get(result, 0) + 1
            print(f"    {result}", flush=True)
        except urllib.error.HTTPError as error:
            key = f"出错：HTTP {error.code}"
            tally[key] = tally.get(key, 0) + 1
            print(f"  {job_id} {name}：HTTP {error.code} {error.read()[:300]!r}")
    print("结果：" + "，".join(f"{key} {count}" for key, count in sorted(tally.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
