---
name: project-wiki-writer
description: Create, update, or audit a software project's technical Wiki from repository evidence, covering architecture, components, interfaces, operations, development workflows, source links, and documentation drift.
---

# Project Wiki Writer

Build and maintain a technical Wiki that helps developers navigate and change the actual system. Document verified behavior rather than intended behavior that is not implemented.

## Select The Mode

- **Bootstrap:** Create a Wiki when none exists or the user requests a full rebuild. Read [references/wiki-blueprint.md](references/wiki-blueprint.md) before choosing the information architecture.
- **Update:** Refresh only the pages affected by a code, API, contract, configuration, deployment, or workflow change.
- **Audit:** Compare existing Wiki claims and links with source, report stale or missing coverage, and fix findings when the user authorizes edits.

Use the user's requested language. Otherwise follow the dominant language of existing project documentation; for a new Wiki with no convention, default to English.

## Establish Evidence

Read repository instructions first, including `AGENTS.md`, `CONTRIBUTING.md`, existing Wiki indexes, and local agent rules. Inspect the relevant source, configuration, schemas, migrations, tests, deployment files, and package manifests before writing.

Treat executable source and checked-in contracts as the current implementation when they conflict with prose. State meaningful uncertainty instead of inventing details. Distinguish current behavior, supported extension points, known limitations, and future plans.

## Write For Navigation And Change

Each page should answer the questions relevant to its subject:

- What responsibility does this area own, and what does it not own?
- Where are its entry points, important symbols, and configuration?
- How does data or control flow through it?
- Which APIs, schemas, artifacts, environment variables, or cross-runtime contracts must remain compatible?
- How is it built, tested, operated, debugged, and extended?
- Which source files support the claims?

Prefer concise prose, tables for stable mappings, and Mermaid only when relationships or sequences become clearer. Use repository-relative links and link to concrete files or symbols. Keep the root Wiki page useful as an index with reading paths, component ownership, and high-value workflows.

Do not copy large code blocks, restate obvious source line by line, expose secrets, or document generated/vendor files as owned architecture. Avoid claims such as "fully secure," "always," or "production-ready" unless verified by enforceable controls and tests.

## Update Discipline

For a focused implementation change:

1. Identify affected ownership boundaries and contracts.
2. Update the smallest set of canonical Wiki pages in the same change.
3. Update navigation when pages are added, moved, or removed.
4. Check that links, paths, commands, ports, env vars, and examples still match the repository.
5. Record important gaps as limitations or coverage work rather than filling them with assumptions.

Preserve useful existing content and local structure. Do not rewrite unrelated pages merely for tone or formatting.

## Verify

Before completion, verify new files are linked from an index, local links resolve, referenced source paths exist, and commands or configuration names are exact. Search changed source identifiers against the Wiki to find stale references. If the project tracks Wiki coverage or a documentation plan, update those records too.

Summarize pages created or updated, evidence checked, and any remaining uncertainty. If no Wiki change is needed after an implementation task, state the concrete reason.
