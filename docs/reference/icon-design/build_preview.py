#!/usr/bin/env python3
"""Build a contact-sheet HTML (light + dark, sizes 16/24/48) for all SVGs in deliverables/svg."""
import pathlib

ROOT = pathlib.Path(__file__).parent
SVG_DIR = ROOT / "deliverables" / "svg"
OUT = ROOT / "deliverables" / "preview" / "index.html"

CELL = """<div class="cell">
  <div class="row">{svgs}</div>
  <div class="name">{name}</div>
</div>"""


def cells(color: str) -> str:
    out = []
    for p in sorted(SVG_DIR.glob("*.svg")):
        body = p.read_text().replace('width="24" height="24" ', "")
        sized = "".join(
            f'<span class="sz s{s}" style="color:{color}">{body}</span>' for s in (16, 24, 48)
        )
        out.append(CELL.format(svgs=sized, name=p.stem))
    return "\n".join(out)


HTML = """<!doctype html>
<meta charset="utf-8">
<title>RetainPDF icons preview</title>
<style>
  body {{ font: 12px/1.4 -apple-system, "PingFang SC", sans-serif; margin: 0; }}
  section {{ padding: 24px 28px 32px; }}
  .light {{ background: #ffffff; color: #22252b; }}
  .dark  {{ background: #1e2230; color: #e8eaf0; }}
  h2 {{ font-size: 13px; font-weight: 600; opacity: .55; margin: 0 0 14px; }}
  .grid {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px 12px; }}
  .cell {{ text-align: center; }}
  .row {{ display: flex; align-items: flex-end; justify-content: center; gap: 14px; height: 56px; }}
  .sz svg {{ display: block; }}
  .s16 svg {{ width: 16px; height: 16px; }}
  .s24 svg {{ width: 24px; height: 24px; }}
  .s48 svg {{ width: 48px; height: 48px; }}
  .name {{ margin-top: 8px; font-size: 10px; opacity: .55; font-family: ui-monospace, monospace; }}
</style>
<section class="light"><h2>LIGHT · 16 / 24 / 48</h2><div class="grid">{light}</div></section>
<section class="dark"><h2>DARK · 16 / 24 / 48</h2><div class="grid">{dark}</div></section>
"""


def main():
    html = HTML.format(light=cells("#22252b"), dark=cells("#e8eaf0"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html)
    print(f"wrote {OUT} ({len(list(SVG_DIR.glob('*.svg')))} icons)")


if __name__ == "__main__":
    main()
