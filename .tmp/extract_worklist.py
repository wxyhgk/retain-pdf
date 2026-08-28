import re
from pathlib import Path

report_path = Path('docs/wiki/translation/chinese-residue-report.md')
report = report_path.read_text(encoding='utf-8')

sections = re.split(r'^## ', report, flags=re.MULTILINE)
noncomment = []
for sec in sections:
    m = re.match(r'(UI -> Vietnamese|Docs -> Vietnamese|Review manually)', sec)
    if m:
        category = m.group(1)
        lines = sec.splitlines()
        in_table = False
        for line in lines:
            if line.startswith('| ---'):
                in_table = True
                continue
            if in_table and line.startswith('|'):
                parts = line.split('|')
                if len(parts) >= 4:
                    pathline = parts[1].strip()
                    snippet = parts[3].strip()
                    match = re.search(r'\[([^]]+):(\d+)\]', pathline)
                    if match:
                        path = match.group(1)
                        line_num = int(match.group(2))
                        noncomment.append((path, line_num, category, snippet))

out = Path('.tmp/worklist-noncomment.md')
out.parent.mkdir(exist_ok=True)
out.write_text('# Non-comment Chinese Residue Worklist\n\n| Path | Line | Category | Snippet | Label | Action |\n| --- | --- | --- | --- | --- | --- |\n' + '\n'.join(f'| {p} | {l} | {c} | {s} | | |' for p,l,c,s in noncomment), encoding='utf-8')
print(f'Extracted {len(noncomment)} non-comment items to {out}')