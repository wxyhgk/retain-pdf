---
name: kilo-plan-writer
description: Inspect a software repository and write an implementation-ready Markdown plan for Kilo Code, including scoped tasks, file guidance, constraints, verification, documentation updates, and completion criteria.
---

# Kilo Plan Writer

Create a plan Kilo Code can execute without rediscovering the repository or guessing important decisions. Write the plan only; do not implement it unless the user separately asks.

## Inspect Before Planning

Read repository instructions first. If `AGENTS.md`, a Wiki, architecture docs, component docs, or `.kilo` configuration exists, read the relevant material. Inspect current source and tests in the affected area. Treat code as current implementation when documentation is stale and include the documentation correction in the plan.

Resolve facts from the repository whenever possible. Ask only about choices that materially change scope, behavior, compatibility, or risk and cannot be inferred safely.

## Make The Plan Executable

Write Markdown at the user's requested path. If no path is supplied and the repository uses Kilo, default to `.kilo/plans/<short-kebab-case-topic>.md`.

Cover, where relevant:

- objective and observable end state;
- confirmed baseline and architecture;
- explicit scope, exclusions, and protected behavior;
- ordered implementation batches or tasks;
- likely files or ownership boundaries;
- data, API, UI, prompt, migration, and compatibility rules;
- tests and verification commands appropriate to risk;
- Wiki/documentation updates required by repository policy;
- completion criteria and intentional residual work.

For large repetitive work, specify batch size, prioritization, progress tracking, resumability, and a deterministic final audit. For bug fixes, include reproduction, root-cause validation, regression coverage, and affected contracts. For UI work, include states, responsive behavior, accessibility, and visual verification when relevant.

## Plan Writing Rules

- Use imperative, implementation-oriented language.
- Separate confirmed facts from assumptions.
- Preserve existing frameworks and ownership boundaries.
- Name files and commands only when verified; otherwise include a discovery step.
- Avoid unrelated refactors and dependencies.
- Include stopping conditions for destructive, external, expensive, or ambiguous operations.
- Do not claim tests pass or files exist unless verified.
- Keep checklist items independently completable for incremental progress updates.

## Final Check

Verify the plan file exists, links and paths are valid, requested decisions are represented, and the sequence works from a clean context. If the plan changes the project's documented workflow, update the relevant Wiki page in the same change.