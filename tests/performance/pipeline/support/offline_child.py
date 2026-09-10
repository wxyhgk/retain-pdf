"""Run a Python CLI under the offline test barrier, before importing the CLI."""
from pathlib import Path
import runpy
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from support.offline import network_guard, forbid_private_data

if __name__ == "__main__":
    script = str(Path(sys.argv[1]).resolve())
    sys.argv = [script, *sys.argv[2:]]
    sys.path.insert(0, str(Path(script).parent))
    forbid_private_data()
    with network_guard():
        runpy.run_path(script, run_name="__main__")
