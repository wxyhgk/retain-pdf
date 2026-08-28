# Agent Instructions

These rules apply to Codex, Kilo, and any coding agent working in this repository.

## Wiki-First Workflow

- Before starting any task that involves code, bug fixes, configuration, tests, deployment, architecture, documentation, or implementation decisions, read `docs/wiki/README.md` and the relevant Wiki pages for the area being touched.
- After adding code, fixing a bug, changing behavior, changing API/data/contracts/config/deployment, or finding stale documentation, update the related pages under `docs/wiki` in the same change.
- If a change truly does not require a Wiki update, state the reason in the final note or PR description.
- When source code and docs disagree, treat source code as the current implementation, then update the Wiki so the next agent starts from accurate documentation.
