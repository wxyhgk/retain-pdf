import re
import csv
from pathlib import Path

report_path = Path(r'C:\docker-apps\retain-pdf-vi\retain-pdf-vi\docs\wiki\translation\chinese-residue-report.md')
output_path = Path(r'C:\docker-apps\retain-pdf-vi\retain-pdf-vi\.tmp\worklist.csv')

with open(report_path, 'r', encoding='utf-8') as f:
    text = f.read()

sections = re.split(r'^## (.*?)$', text, flags=re.MULTILINE)
rows = []
for i in range(1, len(sections), 2):
    title = sections[i].strip()
    content = sections[i+1] if i+1 < len(sections) else ''
    if not content or '_No matches._' in content:
        continue
    lines = content.splitlines()
    in_table = False
    for line in lines:
        if '| --- | --- | --- |' in line:
            in_table = True
            continue
        if not in_table:
            continue
        if not line.startswith('|'):
            in_table = False
            continue
        parts = line.split('|')
        if len(parts) < 4:
            continue
        location = parts[1].strip()
        target = parts[2].strip()
        snippet = parts[3].strip() if len(parts) > 3 else ''
        match = re.match(r'\[([^:]+):(\d+)\]', location)
        if match:
            path = match.group(1)
            line = match.group(2)
        else:
            path = location
            line = ''
        comment_flag = title.startswith('Comment')
        rows.append({
            'section': title,
            'path': path,
            'line': line,
            'target': target,
            'snippet': snippet,
            'comment_flag': comment_flag,
            'action': 'translate'
        })

with open(output_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['section', 'path', 'line', 'target', 'snippet', 'comment_flag', 'action'])
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to {output_path}")