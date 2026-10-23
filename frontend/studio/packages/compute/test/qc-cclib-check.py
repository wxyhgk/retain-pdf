"""
Checks the answers of the outputs in fixtures/qc/ (each `<name>.answer.json`, what our parsers must
read from `<name>.log` or `.out`) against what cclib reads from the same output: a second reader,
so an answer is not only what our own parser happened to read.

Not part of the tests (they need no Python): run it when an answer is written or changed.

    python3 -m venv .venv && .venv/bin/pip install "git+https://github.com/cclib/cclib@76df8675"
    .venv/bin/python packages/compute/test/qc-cclib-check.py

cclib 1.8.1 cannot read ORCA 6.0.1 (its SCF lines); the commit above can. What cclib does not read
(the method's name, the route, why a run stopped, <S**2> in ORCA) is checked by hand against the output.
"""

import json
import sys
import warnings
from pathlib import Path

import cclib
from cclib.parser.utils import convertor

warnings.filterwarnings("ignore")
FIXTURES = Path(__file__).parent / "fixtures" / "qc"

problems = 0


def eh(value):
    """An energy cclib keeps in eV, in Hartree, with cclib's own constant."""
    return convertor(float(value), "eV", "hartree")


def same(name, label, ours, theirs, tolerance):
    global problems
    if ours is None or theirs is None:
        if ours is not theirs:
            print(f"  {name}: {label}: ours {ours!r}, cclib {theirs!r}")
            problems += 1
        return
    if abs(ours - theirs) > tolerance:
        print(f"  {name}: {label}: ours {ours}, cclib {theirs}")
        problems += 1


for answer_path in sorted(FIXTURES.glob("*.answer.json")):
    name = answer_path.name.removesuffix(".answer.json")
    output = next(path for path in FIXTURES.glob(name + ".*") if path.suffix in (".log", ".out"))
    answer = json.loads(answer_path.read_text())
    data = cclib.io.ccread(str(output))
    print(f"{output.name}")
    if data is None:
        print("  cclib could not read it")
        problems += 1
        continue

    same(name, "charge", answer["charge"], int(data.charge), 0)
    same(name, "multiplicity", answer["multiplicity"], int(data.mult), 0)
    # cclib's last SCF energy (eV) is the ground state's, as ours.
    same(name, "energy", answer["energy"], eh(data.scfenergies[-1]), 1e-6)
    for index, step in enumerate(answer["steps"]):
        same(name, f"step {index + 1}", step, eh(data.scfenergies[index]), 1e-6)
    if answer["optimization"]:
        same(name, "optimization converged", answer["optimization"]["converged"], bool(getattr(data, "optdone", False)), 0)
    coordinates = data.atomcoords[-1]
    for index, atom in enumerate(answer["atoms"] or []):
        for axis, value in zip("xyz", coordinates[index]):
            same(name, f"atom {index + 1} {axis}", atom[axis], float(value), 2e-6)

    frequencies = list(getattr(data, "vibfreqs", []))
    intensities = list(getattr(data, "vibirs", []))
    if len(frequencies) != len(answer["vibrations"]):
        print(f"  {name}: {len(answer['vibrations'])} vibrations, cclib {len(frequencies)}")
        problems += 1
    for index, mode in enumerate(answer["vibrations"][: len(frequencies)]):
        same(name, f"vibration {index + 1}", mode["frequency"], float(frequencies[index]), 1e-3)
        if mode["intensity"] is not None and index < len(intensities):
            same(name, f"vibration {index + 1} intensity", mode["intensity"], float(intensities[index]), 1e-3)

    thermo = answer["thermo"]
    if thermo:
        same(name, "temperature", thermo["temperature"], float(data.temperature), 1e-6)
        same(name, "zero-point correction", thermo["zpe"], float(data.zpve), 1e-6)
        same(name, "enthalpy", thermo["enthalpy"], float(data.enthalpy), 1e-6)
        same(name, "free energy", thermo["freeEnergy"], float(data.freeenergy), 1e-6)

    occupied, empty = [], []
    for spin, energies in enumerate(data.moenergies):
        homo = int(data.homos[min(spin, len(data.homos) - 1)])
        occupied.append(eh(energies[homo]))
        if homo + 1 < len(energies):
            empty.append(eh(energies[homo + 1]))
    same(name, "HOMO", answer["homo"], max(occupied), 2e-5)
    same(name, "LUMO", answer["lumo"], min(empty) if empty else None, 2e-5)

    if answer["excited"]:
        energies = [convertor(float(value), "wavenumber", "eV") for value in data.etenergies]
        strengths = [float(value) for value in data.etoscs]
        for index, state in enumerate(answer["excited"]):
            same(name, f"excited state {index + 1}", state["energy"], energies[index], 2e-3)
            same(name, f"excited state {index + 1} strength", state["strength"], strengths[index], 1e-6)

print("all answers agree with cclib" if not problems else f"{problems} differences")
sys.exit(1 if problems else 0)
