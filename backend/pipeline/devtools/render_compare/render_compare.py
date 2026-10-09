"""新旧渲染路线对比：render.engine = typst（旧）vs rpr（自研排版引擎）。

在任务拷贝上跑 render-only（不精修、不调 LLM、不读 key），每个变体一份 PDF，然后出：
逐页并排图、指标表（markdown + json）、行数一致率、每个任务差异最大的块与放大裁剪图。
原任务目录只读：跑前跑后对每个文件做 size / mtime_ns / sha256 对比，不一致直接报错。

用法（worktree 根目录，一条命令可重跑；已有的渲染结果会被覆盖）：

  export PATH="$HOME/.cargo/bin:$HOME/Code/retain-pdf/backend/.venv/bin:$HOME/.local/bin:$PATH" \\
         UV_PROJECT_ENVIRONMENT=$HOME/Code/retain-pdf/backend/.venv
  uv run --no-sync --project backend python backend/pipeline/devtools/render_compare/render_compare.py \\
      --workdir <scratch>/rpr/compare [--cases quantum-chem,scan-paper] [--report-only]

选项见 --help。cases.json 里定义样本、变体（engine / render_mode）与对比对（左旧右新）。
渲染一律用 worktree 自己的代码：子进程在 <worktree>/backend/pipeline 下用 runpy 跑
``retainpdf_pipeline.render``（等价于 ``python -m retainpdf_pipeline.render``），跑之前在同一进程里
断言 retainpdf_pipeline 与 rpr 引擎目录都解析到本 worktree（共享 venv 里有指向主检出的 editable 安装）。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from datetime import timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import rc_measure  # noqa: E402
import rc_prepare  # noqa: E402
import rc_report  # noqa: E402

TOOL_DIR = Path(__file__).resolve().parent
WORKTREE = TOOL_DIR.parents[3]
PIPELINE_DIR = WORKTREE / "backend" / "pipeline"
ENGINE_DIR = WORKTREE / "backend" / "rendering-engine"
DEFAULT_CASES = TOOL_DIR / "cases.json"
SENSITIVE_ENV = re.compile(r"(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|COOKIE)", re.I)

# 在渲染子进程里先断言代码来自本 worktree，再按 python -m 的方式跑 render 入口。
RUNNER = r"""
import runpy, sys
from pathlib import Path
worktree = Path(sys.argv[1]).resolve()
import retainpdf_pipeline
from retainpdf_pipeline.render.output.rpr import engine_cli
pkg = Path(retainpdf_pipeline.__file__).resolve()
assert worktree in pkg.parents, f"retainpdf_pipeline 不是 worktree 的代码: {pkg}"
assert Path(engine_cli.__file__).resolve().is_relative_to(worktree), engine_cli.__file__
print(f"render_compare: code={pkg.parent}", flush=True)
sys.argv = ["retainpdf_pipeline.render", "--spec", sys.argv[2]]
runpy.run_module("retainpdf_pipeline.render", run_name="__main__", alter_sys=True)
"""


def child_env(cache_dir: Path) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if not SENSITIVE_ENV.search(key)}
    env["PYTHONPATH"] = str(PIPELINE_DIR)
    env["OUTPUT_ROOT"] = str(cache_dir)
    env["RETAIN_RPR_ENGINE_DIR"] = str(ENGINE_DIR)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def check_environment() -> dict:
    if not (ENGINE_DIR / "node_modules" / "mathjax-full" / "package.json").is_file():
        raise SystemExit(
            f"rpr 引擎缺 node_modules：cd {ENGINE_DIR} && npm ci --omit=dev --ignore-scripts"
        )
    head = subprocess.run(["git", "-C", str(WORKTREE), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    branch = subprocess.run(["git", "-C", str(WORKTREE), "branch", "--show-current"], capture_output=True, text=True).stdout.strip()
    upstream = {}
    upstream_file = ENGINE_DIR / "UPSTREAM"
    if upstream_file.is_file():
        for line in upstream_file.read_text(encoding="utf-8").splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                upstream[key.strip()] = value.strip()
    return {"worktree": str(WORKTREE), "branch": branch, "head": head, "engine_upstream": upstream}


def resolve_job(case: dict, jobs_root: Path) -> tuple[Path | None, list[dict]]:
    attempts = []
    for job_id in [case["job_id"], *case.get("alternates", [])]:
        job_root = jobs_root / job_id
        if not job_root.is_dir():
            attempts.append({"job_id": job_id, "missing": ["任务目录不存在"]})
            continue
        missing = rc_prepare.missing_inputs(job_root)
        attempts.append({"job_id": job_id, "missing": missing})
        if not missing:
            return job_root, attempts
    return None, attempts


def run_variant(job_root: Path, case_dir: Path, variant: dict, cache_dir: Path, keep_work: bool) -> dict:
    out_dir = case_dir / variant["name"]
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    work = out_dir / "job"
    patched = rc_prepare.prepare_copy(
        job_root, work, engine=variant["engine"], render_mode=variant.get("render_mode")
    )
    spec = work / "specs" / "render.spec.json"
    cmd = ["uv", "run", "--no-sync", "python", "-c", RUNNER, str(WORKTREE), str(spec)]
    started = time.perf_counter()
    proc = subprocess.run(cmd, cwd=PIPELINE_DIR, env=child_env(cache_dir), capture_output=True, text=True, timeout=3600)
    wall = time.perf_counter() - started
    (out_dir / "render.log").write_text(proc.stdout + "\n--- stderr ---\n" + proc.stderr, encoding="utf-8")
    result = {"variant": variant, "spec_params": patched, "exit_code": proc.returncode, "wall_seconds": round(wall, 2)}
    if f"render_compare: code={PIPELINE_DIR / 'retainpdf_pipeline'}" not in proc.stdout:
        result["error"] = "未确认渲染用的是 worktree 的代码（见 render.log）"
    summary_path = work / "artifacts" / "pipeline_summary.json"
    if proc.returncode == 0 and summary_path.is_file():
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        output_pdf = Path(summary.get("output_pdf") or "")
        if output_pdf.is_file():
            shutil.copy2(output_pdf, out_dir / "output.pdf")
        shutil.copy2(summary_path, out_dir / "pipeline_summary.json")
        fit = work / "artifacts" / "fit_report.v1.json"
        if fit.is_file():
            shutil.copy2(fit, out_dir / "fit_report.v1.json")
        rpr_dir = Path(str((summary.get("render_diagnostics") or {}).get("rpr_work_dir") or ""))
        for input_name in ("rpr-fit-input.json", "translations.json"):
            if rpr_dir and (rpr_dir / input_name).is_file():
                shutil.copy2(rpr_dir / input_name, out_dir / input_name)
        if rpr_dir and (rpr_dir / "rpr-fit-input.json").is_file() and (rpr_dir / "out" / "report.json").is_file():
            shutil.copy2(rpr_dir / "out" / "report.json", out_dir / "rpr-fit-report.json")
        # 引擎直接写 PDF 时的排版结果文件（PDF 只从它画出），两次运行可以直接比对。
        if rpr_dir and (rpr_dir / "out" / "layout.json").is_file():
            shutil.copy2(rpr_dir / "out" / "layout.json", out_dir / "layout.json")
        if rpr_dir and (rpr_dir / "rpr-input.json").is_file():
            shutil.copy2(rpr_dir / "rpr-input.json", out_dir / "rpr-input.json")
            if (rpr_dir / "out" / "report.json").is_file():
                shutil.copy2(rpr_dir / "out" / "report.json", out_dir / "rpr-report.json")
    elif "error" not in result:
        result["error"] = f"render 退出码 {proc.returncode}：{proc.stderr.strip()[-400:]}"
    if not keep_work:
        shutil.rmtree(work, ignore_errors=True)
    (out_dir / "run.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--workdir", type=Path, required=True, help="输出目录（runs/、report/、cache/）")
    parser.add_argument("--cases-file", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--cases", default="", help="只跑这些 case（逗号分隔 name）")
    parser.add_argument("--jobs-root", type=Path, default=None, help="覆盖 cases.json 的 jobs_root")
    parser.add_argument("--report-only", action="store_true", help="不渲染，只用已有 runs/ 重出报告")
    parser.add_argument("--keep-work", action="store_true", help="保留每个变体的任务拷贝（默认删掉，只留 PDF / 报告）")
    parser.add_argument("--dpi", type=int, default=100, help="并排整页图 dpi（90–110）")
    parser.add_argument("--first-pages", type=int, default=4, help="并排图：前 N 页")
    parser.add_argument("--worst-pages", type=int, default=4, help="并排图：再加溢出 / 重叠 / 行数差异最多的 N 页")
    parser.add_argument("--all-pages", action="store_true", help="并排图出全部页")
    parser.add_argument("--top-diff", type=int, default=10, help="每个对比对列出差异最大的 N 块")
    parser.add_argument("--crop-dpi", type=int, default=200)
    args = parser.parse_args()

    config = json.loads(args.cases_file.read_text(encoding="utf-8"))
    jobs_root = (args.jobs_root or Path(os.path.expanduser(config["jobs_root"]))).resolve()
    wanted = {name for name in args.cases.split(",") if name}
    cases = [case for case in config["cases"] if not wanted or case["name"] in wanted]
    workdir = args.workdir.resolve()
    runs_dir = workdir / "runs"
    cache_dir = workdir / "cache"
    report_dir = workdir / "report"
    env_info = check_environment()
    print(f"worktree {env_info['worktree']} ({env_info['branch']} @ {env_info['head']})，引擎 {env_info['engine_upstream'].get('commit', '?')[:10]}", flush=True)

    resolved = []
    for case in cases:
        job_root, attempts = resolve_job(case, jobs_root)
        if job_root is None:
            print(f"[{case['name']}] 没有可用样本：{attempts}", flush=True)
        elif job_root.name != case["job_id"]:
            print(f"[{case['name']}] {case['job_id']} 跑不起来（{attempts[0]['missing']}），换成 {job_root.name}", flush=True)
        resolved.append({"case": case, "job_root": job_root, "attempts": attempts})

    integrity = {}
    if not args.report_only:
        before = {item["job_root"].name: rc_prepare.snapshot(item["job_root"]) for item in resolved if item["job_root"]}
        for item in resolved:
            if item["job_root"] is None:
                continue
            case = item["case"]
            for variant in case["variants"]:
                print(f"[{case['name']}] {item['job_root'].name} 渲染 {variant['name']} …", flush=True)
                result = run_variant(item["job_root"], runs_dir / case["name"], variant, cache_dir, args.keep_work)
                print(f"    exit={result['exit_code']} wall={result['wall_seconds']}s {result.get('error', '')}", flush=True)
        after = {item["job_root"].name: rc_prepare.snapshot(item["job_root"]) for item in resolved if item["job_root"]}
        for job_id in before:
            changed = sorted(
                rel for rel in set(before[job_id]) | set(after[job_id]) if before[job_id].get(rel) != after[job_id].get(rel)
            )
            integrity[job_id] = {"files": len(before[job_id]), "changed": changed, "unchanged": not changed}
        (workdir / "integrity.json").write_text(json.dumps(integrity, ensure_ascii=False, indent=2), encoding="utf-8")
        shutil.rmtree(cache_dir, ignore_errors=True)
        if any(not entry["unchanged"] for entry in integrity.values()):
            print(f"!! 原任务目录被改动：{integrity}", flush=True)
            return 2
        print(f"原任务目录完整性：{ {k: v['files'] for k, v in integrity.items()} } 个文件，跑前跑后 sha256 / mtime 一致", flush=True)
    elif (workdir / "integrity.json").is_file():
        integrity = json.loads((workdir / "integrity.json").read_text(encoding="utf-8"))

    report = rc_report.build_report(
        resolved,
        runs_dir=runs_dir,
        report_dir=report_dir,
        options=args,
        env_info=env_info,
        integrity=integrity,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    print(f"报告：{report['markdown']}", flush=True)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
