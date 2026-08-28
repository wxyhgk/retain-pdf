import re
import csv
from pathlib import Path

report_path = Path("docs/wiki/translation/chinese-residue-report.md")
text = report_path.read_text(encoding="utf-8")

# Split by sections
sections = re.split(r'^##\s+', text, flags=re.MULTILINE)
section_names = []
section_bodies = []
for sec in sections:
    lines = sec.splitlines()
    if not lines:
        continue
    first = lines[0].strip()
    if first and not first.startswith("|") and not first.startswith("_"):
        section_names.append(first)
        section_bodies.append("\n".join(lines[1:]))
    else:
        if section_names:
            section_bodies[-1] += "\n" + sec

cat_map = {
    "Prompt -> English": "prompt",
    "UI -> Vietnamese": "ui_text",
    "Comment -> Vietnamese": "comment",
    "Docs -> Vietnamese": "doc_prose",
    "Review manually": "review_manually",
}

noncomment_rows = []
for name, body in zip(section_names, section_bodies):
    category = cat_map.get(name, "unknown")
    # Skip comment rows
    if category == "comment":
        continue
    lines = body.splitlines()
    for line in lines:
        line = line.strip()
        if line.startswith("|") and "|" in line:
            parts = line.split("|")
            if len(parts) >= 4:
                loc = parts[1].strip()
                target = parts[2].strip()
                snippet = parts[3].strip() if len(parts) > 3 else ""
                m = re.search(r'\[([^:]+):(\d+)\]', loc)
                if m:
                    filepath = m.group(1)
                    line_num = m.group(2)
                    noncomment_rows.append({
                        "filepath": filepath,
                        "line": line_num,
                        "category": category,
                        "target": target,
                        "snippet": snippet,
                        "label": "",
                        "action": ""
                    })

# Assign labels/actions
for row in noncomment_rows:
    cat = row["category"]
    if cat == "ui_text":
        row["label"] = "ui_text"
        row["action"] = "translate UI string"
    elif cat == "doc_prose":
        row["label"] = "doc_prose"
        row["action"] = "translate prose"
    elif cat == "review_manually":
        row["label"] = "review_manually"
        row["action"] = "review and classify"
    else:
        row["label"] = "unknown"
        row["action"] = "manual review"

# Write CSV
out_path = Path(".tmp/noncomment-worklist.csv")
with out_path.open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["filepath","line","category","target","snippet","label","action"])
    writer.writeheader()
    writer.writerows(noncomment_rows)

print(f"Wrote {len(noncomment_rows)} non-comment rows to {out_path}")