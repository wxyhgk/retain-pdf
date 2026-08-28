# Wiki Blueprint

Use this blueprint only for bootstrapping or substantially reorganizing a project Wiki. Adapt it to repository size; do not create empty pages merely to match the outline.

## Minimum Useful Wiki

```text
docs/wiki/
|-- README.md
|-- overview.md
|-- architecture.md
|-- components.md
|-- interfaces.md
|-- development.md
`-- operations.md
```

Small projects may combine these topics. Split pages when a topic has distinct owners, workflows, or contracts.

## Scalable Structure

```text
docs/wiki/
|-- README.md
|-- 01-overview/
|-- 02-getting-started/
|-- 03-architecture/
|-- 04-components/
|-- 05-interfaces/
|-- 06-operations/
`-- 07-development/
```

Recommended coverage:

| Area | Evidence to inspect |
| --- | --- |
| Overview and repository map | manifests, top-level directories, entry points |
| Getting started | tool versions, install scripts, dev commands, configuration |
| Architecture and flows | runtime entry points, dependency wiring, queues/events, storage |
| Components | ownership, public boundaries, internal extension points, tests |
| Interfaces | routes, schemas, models, migrations, artifacts, external integrations |
| Operations | build, deploy, health checks, logs, security controls, troubleshooting |
| Development | change scenarios, testing strategy, contribution rules, known limitations |

## Root Index

The root `README.md` should provide:

- project purpose and system context;
- table of contents;
- reading paths by audience;
- component ownership with entry points;
- the most important end-to-end workflows;
- links to primary source anchors.

Keep detailed procedures in their owning pages. The index should route readers, not duplicate the entire Wiki.

