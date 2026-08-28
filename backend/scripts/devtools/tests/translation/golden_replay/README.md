# Translation Replay Golden Cases

This directory only contains reproducible translation regression sample lists and desensitized fixtures; real API keys are not allowed.

## Purpose

- Reproduce model return protocol shells/JSON shells.
- Reproduce empty translation degradation.
- Reproduce untranslated English residue.
- Reproduce technical block mistranslation or incorrect skipping.

## How to Run

Prioritize using existing tools:

```bash
python3 backend/scripts/devtools/replay_translation_item.py --case <case-json>
```

If the sample comes from a real job, first use the promptfoo capture tool to desensitize and save it as a case artifact, then add it to this directory's manifest. Do not commit `sk-*`, PaddleOCR tokens, complete user files, or undesensitized job data to this directory.

## File Conventions

- `manifest.json` is the sample index.
- `cases/*.json` stores desensitized single-item replay inputs.
- Each case must have `id`, `category`, `expected`, `fixture` or `source_artifact`.
