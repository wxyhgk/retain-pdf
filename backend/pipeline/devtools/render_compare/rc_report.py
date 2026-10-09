"""对比报告：指标表（markdown + json）、行数一致率、差异最大的块、并排图与裁剪图。"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import rc_measure

STAGE_KEYS = (
    ("background_source_cleanup_elapsed_seconds", "去文字层"),
    ("background_page_specs_elapsed_seconds", "page_specs"),
    ("background_first_compile_elapsed_seconds", "Typst编译"),
    ("rpr_engine_elapsed_seconds", "引擎"),
    ("rpr_merge_elapsed_seconds", "合并"),
    ("background_save_elapsed_seconds", "保存"),
)
DASH = "—"


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def _rects_for_case(case_dir: Path, variants: list[str], translated_dir_hint: Path | None) -> tuple[dict[int, dict[str, tuple]], str]:
    """每块的 content_rect：优先用 rpr 变体送进引擎的 content_box（与 page_specs 一致），
    没有就用译文条目的 bbox。按源页号（0-based）分组。"""
    rects: dict[int, dict[str, tuple]] = {}
    source = ""
    for name in variants:
        payload = _load(case_dir / name / "rpr-input.json")
        if not payload:
            continue
        for page in payload.get("pages", []):
            page_index = int(page.get("source_page_index", page.get("index", 0)))
            bucket = rects.setdefault(page_index, {})
            for block in page.get("blocks", []):
                box = block.get("content_box")
                item_id = str(block.get("item_id") or "")
                if not box or not item_id:
                    continue
                prev = bucket.get(item_id)
                bucket[item_id] = tuple(box) if prev is None else (
                    min(prev[0], box[0]), min(prev[1], box[1]), max(prev[2], box[2]), max(prev[3], box[3])
                )
        source = f"rpr-input.json（{name}）"
        break
    if translated_dir_hint and translated_dir_hint.is_dir():
        manifest = _load(translated_dir_hint / "translation-manifest.json") or {}
        for entry in manifest.get("pages", []):
            items = _load(translated_dir_hint / entry["path"]) or []
            for item in items if isinstance(items, list) else items.get("items", []):
                item_id = str(item.get("item_id") or "")
                bbox = item.get("bbox") or []
                if not item_id or len(bbox) < 4 or not str(item.get("translated_text") or "").strip():
                    continue
                bucket = rects.setdefault(int(item.get("page_idx", entry.get("page_index", 0))), {})
                if item_id not in bucket:
                    bucket[item_id] = tuple(float(v) for v in bbox[:4])
        source = source + " + 译文 bbox 补缺" if source else "译文 bbox"
    return rects, source


def _variant_row(case_dir: Path, name: str, measures, geom_overlaps) -> dict:
    run = _load(case_dir / name / "run.json") or {}
    summary = _load(case_dir / name / "pipeline_summary.json") or {}
    fit = _load(case_dir / name / "fit_report.v1.json") or {}
    diag = summary.get("render_diagnostics") or {}
    fit_summary = fit.get("summary") or {}
    engine = summary.get("render_engine") or {}
    pdf = case_dir / name / "output.pdf"
    measurement = (fit.get("source") or {}).get("measurement")
    is_rpr = measurement in ("rpr_engine", "rpr_fit_engine")
    # rpr_fit：碰撞数取引擎的不变量（collisions 只列前 50 个例子）；压住保留元素含矢量图形。
    invariants = fit.get("invariants") if measurement == "rpr_fit_engine" else None
    math = fit.get("math") if is_rpr else None
    if is_rpr:
        failed = len((math or {}).get("failed") or [])
        math_cell = f"{failed} / {(math or {}).get('formulas', 0)} 式"
    else:
        prescreen = int(diag.get("background_math_prescreen_items") or 0)
        bad_pages = int(diag.get("background_bad_page_count") or diag.get("bad_page_count") or 0)
        retried = bool(diag.get("background_compile_retried"))
        math_cell = f"预筛降级 {prescreen} 块 / 坏页 {bad_pages}" + ("（重编译）" if retried else "")
    collisions = fit.get("collisions") or []
    stages = {label: round(float(diag[key]), 2) for key, label in STAGE_KEYS if isinstance(diag.get(key), (int, float))}
    return {
        "variant": name,
        "ok": run.get("exit_code") == 0 and pdf.is_file() and not run.get("error"),
        "error": run.get("error", ""),
        "engine_requested": engine.get("requested") or run.get("variant", {}).get("engine"),
        "engine_effective": engine.get("effective", "typst"),
        "fallback_reason": engine.get("fallback_reason", ""),
        "render_mode": summary.get("render_mode"),
        "effective_render_mode": summary.get("effective_render_mode"),
        "fit_measurement": (fit.get("source") or {}).get("measurement"),
        "fit_status": fit.get("status"),
        "blocks": fit_summary.get("blocks"),
        "overflow_blocks": fit_summary.get("overflow_blocks"),
        "shrunk_blocks": fit_summary.get("shrunk_blocks"),
        "emergency_blocks": fit_summary.get("emergency_blocks"),
        "engine_text_collisions": (
            int(invariants.get("line_overlaps") or 0) if invariants is not None
            else (sum(1 for c in collisions if c.get("kind") == "text") if is_rpr else None)
        ),
        "engine_obstacle_collisions": (
            int(invariants.get("obstacle_hits") or 0) + int(invariants.get("vector_hits") or 0) if invariants is not None
            else (sum(1 for c in collisions if c.get("kind") == "obstacle") if is_rpr else None)
        ),
        "geom_text_overlaps": len(geom_overlaps),
        "math": math_cell,
        "math_failed": len((math or {}).get("failed") or []) if is_rpr else None,
        "file_size_mb": round(pdf.stat().st_size / 1e6, 2) if pdf.is_file() else None,
        "wall_seconds": run.get("wall_seconds"),
        "render_elapsed_seconds": round(float(summary.get("render_elapsed") or 0), 2) if summary else None,
        "stage_seconds": stages,
        "elapsed_detail": {k: v for k, v in diag.items() if k.endswith("_elapsed_seconds") and isinstance(v, (int, float))},
        "prewarm_payload_hit": diag.get("render_payload_prewarm_hit"),
        "page_specs_prewarm_hit": diag.get("background_page_specs_prewarm_hit"),
        "measured_blocks_in_pdf": len(measures),
    }


def _fit_blocks(case_dir: Path, name: str) -> dict[str, dict]:
    fit = _load(case_dir / name / "fit_report.v1.json") or {}
    return {str(b.get("item_id")): b for b in fit.get("blocks", []) if b.get("item_id")}


def _pair_stats(left: str, right: str, measures: dict, fits: dict) -> dict:
    ml, mr = measures[left], measures[right]
    fl, fr = fits[left], fits[right]
    common = sorted(set(ml) & set(mr))
    same = [item for item in common if ml[item].lines == mr[item].lines]
    diffs = []
    for item in sorted(set(ml) | set(mr) | set(fl) | set(fr)):
        a, b = ml.get(item), mr.get(item)
        oa = bool((fl.get(item) or {}).get("overflow")) and (fl.get(item) or {}).get("measured", True) is not False
        ob = bool((fr.get(item) or {}).get("overflow")) and (fr.get(item) or {}).get("measured", True) is not False
        la, lb = (a.lines if a else 0), (b.lines if b else 0)
        if not a and not b and oa == ob:
            continue
        line_diff = abs(la - lb) if a and b else 0
        if line_diff == 0 and oa == ob:
            continue
        page = (a or b).page + 1 if (a or b) else int((fl.get(item) or fr.get(item) or {}).get("page") or 0)
        diffs.append({
            "item_id": item,
            "page": page,
            "lines_left": la if a else None,
            "lines_right": lb if b else None,
            "overflow_left": oa,
            "overflow_right": ob,
            "font_left": round((fl.get(item) or {}).get("final_font_size") or 0, 2),
            "font_right": round((fr.get(item) or {}).get("final_font_size") or 0, 2),
            "score": line_diff + (2 if oa != ob else 0),
        })
    diffs.sort(key=lambda d: (-d["score"], d["page"], d["item_id"]))
    return {
        "left": left,
        "right": right,
        "compared_blocks": len(common),
        "same_lines": len(same),
        "line_agreement": round(len(same) / len(common), 4) if common else None,
        "right_more_lines": sum(1 for item in common if mr[item].lines > ml[item].lines),
        "right_fewer_lines": sum(1 for item in common if mr[item].lines < ml[item].lines),
        "diffs": diffs,
    }


def _label_bar(width: int, text: str, color=(40, 40, 40)):
    from PIL import Image, ImageDraw

    bar = Image.new("RGB", (width, 26), (245, 245, 245))
    ImageDraw.Draw(bar).text((6, 7), text, fill=color)
    return bar


def _side_by_side(left_img, right_img, left_label: str, right_label: str, title: str):
    from PIL import Image

    gap = 12
    width = left_img.width + right_img.width + gap
    height = max(left_img.height, right_img.height)
    canvas = Image.new("RGB", (width, height + 52), (255, 255, 255))
    canvas.paste(_label_bar(width, title), (0, 0))
    canvas.paste(_label_bar(left_img.width, left_label, (20, 60, 160)), (0, 26))
    canvas.paste(_label_bar(right_img.width, right_label, (160, 40, 20)), (left_img.width + gap, 26))
    canvas.paste(left_img, (0, 52))
    canvas.paste(right_img, (left_img.width + gap, 52))
    return canvas


def _page_scores(stats: dict, overlaps_left, overlaps_right, fits_left, fits_right) -> dict[int, float]:
    scores: dict[int, float] = {}
    for d in stats["diffs"]:
        scores[d["page"]] = scores.get(d["page"], 0) + 1
    for o in [*overlaps_left, *overlaps_right]:
        scores[o["page"]] = scores.get(o["page"], 0) + 1
    for fits in (fits_left, fits_right):
        for block in fits.values():
            if block.get("overflow"):
                page = int(block.get("page") or 0)
                scores[page] = scores.get(page, 0) + 1
    return scores


def _draw_rect(img, rect_px, color=(230, 30, 30)):
    from PIL import ImageDraw

    ImageDraw.Draw(img).rectangle(rect_px, outline=color, width=2)


def build_report(resolved, *, runs_dir: Path, report_dir: Path, options, env_info: dict, integrity: dict, generated_at: str) -> dict:
    if report_dir.exists():
        shutil.rmtree(report_dir)
    report_dir.mkdir(parents=True)
    all_ok = True
    out_cases = []
    for item in resolved:
        case, job_root = item["case"], item["job_root"]
        entry = {"name": case["name"], "label": case.get("label", ""), "job_id": job_root.name if job_root else None,
                 "requested_job_id": case["job_id"], "attempts": item["attempts"], "variants": [], "pairs": []}
        out_cases.append(entry)
        if job_root is None:
            all_ok = False
            continue
        case_dir = runs_dir / case["name"]
        names = [v["name"] for v in case["variants"]]
        rects, rect_source = _rects_for_case(case_dir, names, job_root / "translated")
        entry["rect_source"] = rect_source
        measures, overlaps, fits = {}, {}, {}
        for name in names:
            pdf = case_dir / name / "output.pdf"
            measures[name] = rc_measure.measure_pdf(pdf, rects) if pdf.is_file() else {}
            overlaps[name] = rc_measure.text_overlaps(pdf, rects) if pdf.is_file() else []
            fits[name] = _fit_blocks(case_dir, name)
            row = _variant_row(case_dir, name, measures[name], overlaps[name])
            all_ok = all_ok and row["ok"]
            if row["engine_requested"] == "rpr" and row["engine_effective"] != "rpr":
                row["error"] = (row["error"] + f" rpr 回退了 Typst：{row['fallback_reason']}").strip()
                all_ok = False
            row["geom_text_overlap_examples"] = overlaps[name][:20]
            entry["variants"].append(row)
        case_report = report_dir / case["name"]
        for left, right in case.get("pairs", []):
            if not (case_dir / left / "output.pdf").is_file() or not (case_dir / right / "output.pdf").is_file():
                continue
            stats = _pair_stats(left, right, measures, fits)
            pair_dir = case_report / f"{left}__vs__{right}"
            pair_dir.mkdir(parents=True, exist_ok=True)
            # 整页并排
            left_pdf, right_pdf = case_dir / left / "output.pdf", case_dir / right / "output.pdf"
            pages_total = min(rc_measure.page_count(left_pdf), rc_measure.page_count(right_pdf))
            scores = _page_scores(stats, overlaps[left], overlaps[right], fits[left], fits[right])
            if options.all_pages:
                pages = list(range(1, pages_total + 1))
            else:
                first = list(range(1, min(options.first_pages, pages_total) + 1))
                worst = [p for p, _ in sorted(scores.items(), key=lambda kv: (-kv[1], kv[0])) if p not in first and 1 <= p <= pages_total]
                pages = sorted(set(first) | set(worst[: options.worst_pages]))
            page_images = []
            by_page_left = {}
            for d in stats["diffs"]:
                by_page_left[d["page"]] = by_page_left.get(d["page"], 0) + 1
            for page in pages:
                li = rc_measure.render_page_png(left_pdf, page - 1, options.dpi)
                ri = rc_measure.render_page_png(right_pdf, page - 1, options.dpi)
                ovl_l = sum(1 for b in fits[left].values() if b.get("overflow") and int(b.get("page") or 0) == page)
                ovl_r = sum(1 for b in fits[right].values() if b.get("overflow") and int(b.get("page") or 0) == page)
                title = f"{job_root.name}  page {page}/{pages_total}  diff-blocks={by_page_left.get(page, 0)}"
                img = _side_by_side(
                    li, ri,
                    f"LEFT {left}  overflow={ovl_l} overlap={sum(1 for o in overlaps[left] if o['page'] == page)}",
                    f"RIGHT {right}  overflow={ovl_r} overlap={sum(1 for o in overlaps[right] if o['page'] == page)}",
                    title,
                )
                path = pair_dir / f"page-{page:03d}.png"
                img.save(path, optimize=True)
                page_images.append(str(path))
            # 差异最大的块：放大裁剪
            crops = []
            for rank, d in enumerate(stats["diffs"][: options.top_diff], start=1):
                rect = rects.get(d["page"] - 1, {}).get(d["item_id"])
                if not rect:
                    continue
                pw, ph = rc_measure.page_size(left_pdf, d["page"] - 1)
                size = max(d["font_left"], d["font_right"], 8.0)
                clip = (max(0, rect[0] - 10), max(0, rect[1] - 10), min(pw, rect[2] + 10), min(ph, rect[3] + max(18, 3.2 * size)))
                li = rc_measure.render_page_png(left_pdf, d["page"] - 1, options.crop_dpi, clip)
                ri = rc_measure.render_page_png(right_pdf, d["page"] - 1, options.crop_dpi, clip)
                scale = options.crop_dpi / 72
                box_px = ((rect[0] - clip[0]) * scale, (rect[1] - clip[1]) * scale, (rect[2] - clip[0]) * scale, (rect[3] - clip[1]) * scale)
                _draw_rect(li, box_px)
                _draw_rect(ri, box_px)
                img = _side_by_side(
                    li, ri,
                    f"{left}: lines={d['lines_left']} overflow={d['overflow_left']} font={d['font_left']}",
                    f"{right}: lines={d['lines_right']} overflow={d['overflow_right']} font={d['font_right']}",
                    f"#{rank} p{d['page']} {d['item_id']} (red = content_rect)",
                )
                path = pair_dir / f"diff-{rank:02d}-p{d['page']:03d}-{d['item_id']}.png"
                img.save(path, optimize=True)
                crops.append(str(path))
                d["crop"] = str(path)
            stats["top_diff"] = stats["diffs"][: options.top_diff]
            stats["diff_blocks_total"] = len(stats["diffs"])
            stats["page_images"] = page_images
            stats["crop_images"] = crops
            del stats["diffs"]
            entry["pairs"].append(stats)
        # 每个变体的逐块行数，方便事后再查
        (case_report).mkdir(parents=True, exist_ok=True)
        (case_report / "block_lines.json").write_text(
            json.dumps({name: [m.as_dict() for m in measures[name].values()] for name in names}, ensure_ascii=False),
            encoding="utf-8",
        )

    payload = {
        "schema": "render_compare_v1",
        "generated_at": generated_at,
        "environment": env_info,
        "integrity": integrity,
        "method": {
            "lines": "成品 PDF 上可见思源宋体 span 的基线聚类（>0.3 字号算新行），按 content_rect 归块，框底下 1.5 字号内的行算溢出行",
            "geom_text_overlap": "整页每个行片段的墨迹近似框 [基线-0.75em, 基线+0.12em]，两个行片段相交（宽高都 >0.5pt；同基线的两段须横向叠进 0.25 字号）记一处，不按块归属",
            "line_agreement": "两边都量到行的块里，行数相同的比例",
        },
        "cases": out_cases,
    }
    json_path = report_dir / "metrics.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path = report_dir / "metrics.md"
    md_path.write_text(_markdown(payload), encoding="utf-8")
    return {"ok": all_ok, "markdown": str(md_path), "json": str(json_path)}


def _cell(value, suffix=""):
    if value is None or value == "":
        return DASH
    return f"{value}{suffix}"


def _markdown(payload: dict) -> str:
    env = payload["environment"]
    lines = [
        "# 渲染路线对比：typst vs rpr",
        "",
        f"- 生成：{payload['generated_at']}；代码 {env['worktree']}（{env['branch']} @ {env['head']}）；"
        f"引擎 {env['engine_upstream'].get('ref', '?')} @ {env['engine_upstream'].get('commit', '?')[:10]}",
        f"- 原任务目录完整性：" + "；".join(
            f"{job} {info['files']} 个文件{'未改动' if info['unchanged'] else '被改动：' + ', '.join(info['changed'][:5])}"
            for job, info in (payload.get("integrity") or {}).items()
        ),
        "- 行数 / 重叠的量法：" + payload["method"]["lines"] + "；" + payload["method"]["geom_text_overlap"],
        "",
        "## 指标",
        "",
        "| 任务 | 变体 | 引擎（实际） | 模式（实际） | 块 | 溢出 | 缩字 | 应急档 | 文字重叠（引擎报告） | 文字重叠（几何） | 压住保留元素 | 公式失败 | 文件 MB | 墙钟 s | 渲染 s | 阶段 s | 行数一致率 |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for case in payload["cases"]:
        agreement_by_right: dict[str, list[str]] = {}
        for pair in case["pairs"]:
            if pair["line_agreement"] is not None:
                agreement_by_right.setdefault(pair["right"], []).append(
                    f"vs {pair['left']} {pair['line_agreement'] * 100:.1f}%（{pair['same_lines']}/{pair['compared_blocks']}）"
                )
        task = f"{case['name']}<br>{case['job_id'] or '无可用样本'}"
        if not case["variants"]:
            lines.append(f"| {task} | {DASH} |" + f" {DASH} |" * 15)
        for row in case["variants"]:
            engine = row["engine_effective"] + (f"（回退：{row['fallback_reason']}）" if row["fallback_reason"] else "")
            stages = " / ".join(f"{k} {v}" for k, v in row["stage_seconds"].items()) or DASH
            name = row["variant"] + ("" if row["ok"] else f" ⚠ {row['error']}")
            lines.append(
                "| " + " | ".join([
                    task, name, engine, f"{row['render_mode']}→{row['effective_render_mode']}",
                    _cell(row["blocks"]), _cell(row["overflow_blocks"]), _cell(row["shrunk_blocks"]),
                    _cell(row["emergency_blocks"]), _cell(row["engine_text_collisions"]), _cell(row["geom_text_overlaps"]),
                    _cell(row["engine_obstacle_collisions"]), row["math"], _cell(row["file_size_mb"]),
                    _cell(row["wall_seconds"]), _cell(row["render_elapsed_seconds"]), stages,
                    "<br>".join(agreement_by_right.get(row["variant"], [])) or DASH,
                ]) + " |"
            )
    lines += ["", "## 行数一致率（左旧右新）", "", "| 任务 | 对比 | 比较块数 | 行数相同 | 一致率 | 右边多行 | 右边少行 | 有差异的块 |", "|---|---|---|---|---|---|---|---|"]
    for case in payload["cases"]:
        for pair in case["pairs"]:
            rate = DASH if pair["line_agreement"] is None else f"{pair['line_agreement'] * 100:.1f}%"
            lines.append(f"| {case['name']} | {pair['left']} vs {pair['right']} | {pair['compared_blocks']} | {pair['same_lines']} | {rate} | {pair['right_more_lines']} | {pair['right_fewer_lines']} | {pair['diff_blocks_total']} |")
    for case in payload["cases"]:
        if case.get("attempts") and case["job_id"] != case["requested_job_id"]:
            lines += ["", f"> {case['name']}：{case['requested_job_id']} 跑不起来，原因 {case['attempts'][0]['missing']}；改用 {case['job_id']}"]
        for pair in case["pairs"]:
            lines += [
                "", f"## {case['name']}（{case['job_id']}）：{pair['left']} vs {pair['right']} 差异最大的块", "",
                "| # | 页 | item_id | 行数 左→右 | 溢出 左→右 | 字号 左→右 | 裁剪图 |", "|---|---|---|---|---|---|---|",
            ]
            for rank, d in enumerate(pair["top_diff"], start=1):
                crop = Path(d["crop"]).name if d.get("crop") else DASH
                lines.append(
                    f"| {rank} | {d['page']} | {d['item_id']} | {_cell(d['lines_left'])}→{_cell(d['lines_right'])} | "
                    f"{'是' if d['overflow_left'] else '否'}→{'是' if d['overflow_right'] else '否'} | {d['font_left']}→{d['font_right']} | {crop} |"
                )
            lines.append("")
            lines.append("并排整页图：" + "、".join(Path(p).name for p in pair["page_images"]) + f"（目录 {Path(pair['page_images'][0]).parent if pair['page_images'] else DASH}）")
    return "\n".join(lines) + "\n"
