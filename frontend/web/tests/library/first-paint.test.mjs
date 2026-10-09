import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentLibraryResource } from '../../src/features/library/domain/documents/document-library-resource.js';
import { createRecentJobsLoader } from '../../src/features/library/domain/recent-jobs/loader.js';
import { createRecentJobsStatePort } from '../../src/features/library/domain/recent-jobs/state.js';
import { libraryCardBadge } from '../../src/features/library/domain/card/library-card-badge.js';
import { cardSignatureOf } from '../../src/features/library/ui/shell/book-card/format.js';
import { deferred } from "../helpers/async.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
globalThis.window = { setTimeout, clearTimeout };
const document = (id = 'one') => ({ document_id: id, active_job_id: `job-${id}`, title: `${id}.pdf`, page_count: 8 });

function fixture(dependencies) {
  const state = createRecentJobsStatePort();
  const loading = [];
  const loader = createRecentJobsLoader({
    libraryBooksResource: createDocumentLibraryResource(dependencies),
    recentJobsStatePort: state,
    runtimePatches: { apply: (items) => items, applyExisting: (items) => items },
    homeStatePort: { setRecentJobsLoadingState: (value) => loading.push(value) },
    recentJobActions: {}, activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    viewPort: { renderLoading() {}, setLoadMoreLoading() {} },
  });
  return { state, loading, loader };
}

test('first paint: documents render before unresolved live/OCR requests', async () => {
  const books = deferred();
  const { state, loading, loader } = fixture({
    fetchDocumentList: async () => ({ documents: [document()], total: 1 }),
    fetchLibraryBookList: () => books.promise,
  });
  const pending = loader.load({ reset: true });
  await tick();
  assert.equal(state.getSnapshot().items[0].title, 'one.pdf');
  assert.equal(state.getSnapshot().items[0].runtime_pending, true);
  assert.equal(libraryCardBadge(state.getSnapshot().items[0]).label, '读取状态…');
  assert.equal(loading.at(-1), 'ready');
  assert.equal(state.getSnapshot().offset, 0, 'preview must not advance pagination');
  books.resolve({ items: [{ job_id: 'job-one', status: 'succeeded', output_pdf_ready: true }] });
  await pending;
  assert.equal(state.getSnapshot().items[0].status, 'succeeded');
  assert.equal(state.getSnapshot().items[0].runtime_pending, false);
  assert.equal(state.getSnapshot().offset, 1);
  loader.dispose();
});

test('first paint: enrichment failure preserves documents and usable pagination', async () => {
  const { state, loader } = fixture({
    fetchDocumentList: async () => ({ documents: [document()], total: 2 }),
    fetchLibraryBookList: async () => { throw new Error('unavailable'); },
  });
  await loader.load({ reset: true });
  assert.equal(state.getSnapshot().items.length, 1);
  assert.equal(state.getSnapshot().offset, 1);
  assert.equal(state.getSnapshot().hasMore, true);
  assert.equal(libraryCardBadge(state.getSnapshot().items[0]).label, '状态待刷新');
  loader.dispose();
});

test('first paint: disposed loader ignores late enrichment', async () => {
  const books = deferred();
  const { state, loader } = fixture({
    fetchDocumentList: async () => ({ documents: [document()], total: 1 }),
    fetchLibraryBookList: () => books.promise,
  });
  const pending = loader.load({ reset: true });
  await tick();
  loader.dispose();
  const before = state.getSnapshot();
  books.resolve({ items: [{ job_id: 'job-one', status: 'succeeded' }] });
  await pending;
  assert.deepEqual(state.getSnapshot(), before);
});

test('first paint: superseded document response cannot flash an old search', { timeout: 2000 }, async () => {
  const old = deferred();
  const newRendered = deferred();
  const shown = [];
  const { state, loader } = fixture({
    fetchDocumentList: async (_, { q }) => q === 'old' ? old.promise : { documents: [document('new')], total: 1 },
    fetchLibraryBookList: async (_, { jobIds }) => ({ items: jobIds.map((job_id) => ({ job_id, status: 'succeeded' })) }),
  });
  state.subscribe(({ items }) => {
    shown.push(items.map((item) => item.document_id).join(','));
    if (items[0]?.document_id === 'new' && items[0].status === 'succeeded') newRendered.resolve();
  });
  const first = loader.load({ reset: true, query: 'old' });
  await tick();
  await loader.load({ reset: true, query: 'new' });
  old.resolve({ documents: [document('old')], total: 1 });
  await first;
  await newRendered.promise;
  assert.equal(shown.includes('old'), false);
  assert.equal(state.getSnapshot().items[0].document_id, 'new');
  loader.dispose();
});

test('first paint: changing pending/error flags invalidates card memo', () => {
  const item = { job_id: 'job-one', status: '' };
  assert.notEqual(cardSignatureOf({ ...item, runtime_pending: true }), cardSignatureOf({ ...item, runtime_unavailable: true }));
});
