# Devtools

`devtools/` holds local diagnostics, migration helpers, probes, and other scripts that are useful while developing RetainPDF but are not part of the production pipeline.

## Offline translation regression

From the repository root (uses the selected Python environment):

```bash
.venv/bin/python backend/pipeline/devtools/run_translation_tests.py
.venv/bin/python backend/pipeline/devtools/run_translation_tests.py --reverse
.venv/bin/python backend/pipeline/devtools/run_translation_tests.py --suite benchmarks
```

The default includes the runner's own regression tests and all translation and benchmark tests, including concurrency,
checkpoint recovery, full-message golden fixtures and production-entry fake-transport
contracts. `--reverse` reverses file order, not individual tests. `--collect-only`
lists coverage without executing tests. The runner has a 300-second timeout and
propagates pytest's exit status.

This is a curated offline test entrypoint, not a network sandbox. Tests must replace
external services; subprocess probes must install their own network guards. It does
not inherit provider keys, proxies, executor capabilities or pytest startup options.
Only OS/runtime essentials and `TYPST_BIN` are retained; the runner creates a temporary
`OUTPUT_ROOT` for default translation/domain/render caches and removes it on exit,
including test failures and timeouts. Direct `pytest` calls bypass this runner-level
isolation, so individual tests must still scope their own external dependencies.
The runner does not launch `live_smoke.py` or promptfoo. Live evaluations require separate explicit
authorization. The main `Tests` workflow runs this full suite in normal order;
the manual `Translation Offline Order Check` workflow runs reverse file order.
Neither workflow requests provider secrets or launches a live evaluation. CI
installs Typst 0.14.2 for the real formula-compilation regression; locally install
Typst or set `TYPST_BIN` to its executable.

Keep these layers separate: component tests locate individual rules; static golden
fixtures lock complete messages and identities; capture replay checks saved-input
integrity; production-entry fake transport checks routing and repair budgets.
Never refresh golden expectations automatically to make a refactor pass.

### Public translation IO contracts

`tests/performance/pipeline/tests/test_translation_io_{success,failure,recovery}.py`
exercise `translate_book_pipeline` against a two-page synthetic normalized document.
Only model transports are replaced; final files are read by the real rendering
consumer. The harness rejects unknown model protocols and never uses real provider
credentials. Success covers legacy/Rust, workers 1/8, single items, a formula, a URL
skip, and a cross-page group. Page selection uses independent pages without group
hints. Domain/glossary configuration is not part of this fixture.

`test_translation_io_batch.py` exercises the ordinary tagged multi-item protocol
on the second page with batch size 8. The page-leading continuation fragment runs
as a single item; the two independent paragraphs must share one initial request.
Replies are reversed, and separate cases inject one missing ID or a conflicting
duplicate ID into only the first batch reply. Subsequent replies are valid.
Both transports retain validated members and repair only missing or invalid IDs.
Duplicate IDs are discarded rather than resolved by first/last-write wins.
Rust repairs retain the original unit identity and primary/repair request budget.
Assertions check both consumer-visible artifacts and per-member request counts.

`test_translation_io_page_scope.py` retains provider cross-page hints while selecting
only one page, for both transports. Requests, renderer output, and unit members
must remain within the selected page; the fixture does not authorize expanding
translation to an unselected page.

`test_translation_io_exhaustion.py` verifies Rust batch exhaustion without a
success manifest, then fresh-process resume without re-requesting committed items.
Its legacy case covers all six requests, including the agent-repair and final
recovery protocols. Exhausted items remain failed and translatable, with source
and dead-letter diagnostics preserved; they block complete-manifest publication.
A fresh-process retry must translate the failed item and publish a clean result.
Intentional formula/code/URL policy skips remain distinct from failed recovery.

`test_translation_io_concurrent_failure.py` repeats the two-worker failure case
three times. Both fake model requests enter before one fails; the other returns
success only after observing the real failure latch. The test checks persisted
page hashes, absence of a success manifest, and fresh-process resume without
re-requesting the committed success. No production failure state is injected.

### Cache, flush, and publication boundaries

- Unit cache keys include normalized prompt context and an explicit cache-key
  version. Old cache entries are left on disk but are not reused under the new
  identity; existing document outputs are not rewritten.
- The concurrent result consumer checks pending writes during queue timeouts,
  not just when another result arrives. The flush interval is still subject to
  the result-queue polling interval and filesystem latency, not a hard real-time
  guarantee. Sequential execution is unchanged.
- Checkpoint-backed renderer input must represent a completed, consistent
  publication. Historical manifest-only output remains supported; this does not
  automatically migrate old completed jobs or create a second publication schema.
  If a checkpoint exists but lacks valid page hashes, reading is rejected rather
  than downgraded to unchecked manifest-only compatibility; files remain intact.

### Persistence and measurement boundaries

- Garbled reconstruction application reports `applied`, `rejected`, or
  `no_result`. Only `applied` increments the reconstructed candidate/unit count;
  this is not a count of individual cross-page members. Rejected output still
  dirties its diagnostic pages, even when the stage has zero successful repairs.
  Candidate selection, quality validation and model request budgets are unchanged.
- `save_pages` defaults to writing the supplied payload without changing unit
  metadata. Initial preparation and repair stages explicitly refresh units where
  required; the explicit `refresh_units=True` compatibility option remains.
  Garbled reconstruction unions its original dirty pages with every page actually
  changed by the subsequent unit refresh, so changed cross-page peers are saved.
  This tracking takes a deep copy only when reconstruction reports dirty pages;
  it does not change checkpoint ordering or the selected-page scope.
- Sequential and parallel `apply_elapsed_ms` measure only the applier. Model
  latency, waiting, and file flush are excluded. Failed runs record available
  apply/flush/tail statistics and close phase timing while preserving the error;
  they do not emit the successful batch-completion event.
- `applied_batches` remains a count of result batches handed to the applier,
  including empty failure mappings in the concurrent path, not a successful
  translation count. Use output item statuses to establish completed work.
- `compare_optimization.py` validates the manifest and pages through the real
  rendering consumer. Invalid baseline/candidate artifacts produce an explicit
  rejected JSON comparison; stale files outside the manifest are not compared.
  Fixed-dispatch comparisons additionally require source/config/cache-policy
  evidence, a verified private dispatch capture and matching executor profiles.
  Missing evidence rejects comparability rather than assuming equal inputs.
  Provider cache warmth and runtime scheduling are not controlled by these checks;
  a passing single-run comparison is not causal proof of a speedup.

Recovery repeats real checkpoint interruption and fresh-process resume three times,
verifying that committed translations are not requested again and the skipped URL
`p001-b002` stays completed. Policy reset preserves completed model/fast-path
keep-origin results; checkpoint regression guards remain unchanged. Rust bounded failure and
legacy repair-success are covered. The earlier legacy exhaustion timeout was
caused by an unsupported agent-repair protocol in the fake transport; this is now
recognized. Legacy exhaustion and fresh-process recovery are now covered without
changing retry counts or sleeps; the earlier timeout is not evidence that the
normal retry chain takes over 30 seconds.

### Execution ownership and refactoring guards

- Garbled reconstruction prepares cleaned text and a quality verdict without
  changing page items. Application consumes that verdict without another model
  request or quality review, and reports touched pages (including diagnostic-only
  rejections) for persistence. The legacy outcome-only entrypoint is retained;
  candidate budgets, group application and request scheduling are unchanged.
- Placeholder syntax and text helpers live in `translate/core/placeholder_tokens.py`
  with standard-library-only dependencies. Policy and formula protection use
  this owner; the previous LLM validation module remains a compatibility export
  of the same objects. The two policy-to-LLM frozen import exceptions are removed.
- The normal `execute_translation_request` entry acquires the output lease
  before plan preparation opens the request journal or infers domain context.
  Checkpoint initialization borrows that lease after the complete plan exists;
  copied-resume rejection must reuse it rather than recursively acquiring it.
  Journal cleanup runs on success and failure, and cleanup errors must not hide
  the original execution error. This is output-directory exclusion, not global
  model deduplication across different jobs or output directories.
- Prompt context snapshots the values previously read through `raw_item`.
  Existing plan/item reference identities remain unchanged; this is not a deep
  immutable rewrite of every context field or a disk schema migration.
- Parallel pool construction is a pure helper. The prepared plan selects the
  queue strategy, while executor failure checks, tail-retry policy and the
  single consumer's apply/flush/checkpoint sequence remain in their existing
  execution boundaries. No additional background page writer is introduced.
- Fine-grained layer mapping and field-writer detector regression tests belong
  to the offline translation gate. Historical cross-layer debt is frozen by
  exact file/module pairs, not blanket directory permissions. Static writer
  checks cover literal-key mutation forms; dynamic keys/aliases are not a full
  object-level proof of exclusive mutation ownership.

## Code size

Run the repository code counter from the project root:

```bash
python backend/pipeline/devtools/count_code.py
```

Useful options:

- `--json` prints the same totals as JSON.
- `--all` relaxes the default source and directory filters while still skipping `.git`, binary files, and files larger than 2 MiB.

The default scan skips obvious dependencies, caches, build outputs, temporary data, and job data such as `node_modules/`, `target/`, `dist/`, `build/`, `__pycache__/`, `.venv/`, `data/jobs/`, and `tmp/`.
