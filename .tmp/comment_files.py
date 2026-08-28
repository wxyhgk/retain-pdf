from pathlib import Path
import sys
from collections import defaultdict

sys.path.insert(0, str(Path("backend/scripts").resolve()))
from devtools.scan_chinese_residue import EXCLUDED_PATHS, scan_chinese_residue

r = scan_chinese_residue(Path("."), exclude=tuple(EXCLUDED_PATHS) + ((".tmp",),))

# Group by file for comment category
file_matches = defaultdict(list)
for m in r.matches:
    if m.category == "comment":
        file_matches[m.path].append(m)

# Sort by match count descending for efficient batching
for path, matches in sorted(file_matches.items(), key=lambda x: -len(x[1])):
    print(f"{len(matches):4d}  {path}")
