import assert from 'node:assert/strict';
import test from 'node:test';

import { RetainpdfReading } from './retainpdf-reading.mjs';

test('what is read in 翻译: the book, its page and pages, its notes; nothing once the reader is left', () => {
	const reading = new RetainpdfReading({ clock: () => 7 });
	assert.equal(reading.get(), null);
	reading.set({ job_id: ' job-1 ', document_id: 'doc-1', title: ' Quantum\nChemistry ', page: 12, pages: 300, notes: { slug: 'note-1', title: 'Quantum Chemistry' } });
	assert.deepEqual(reading.get(), { job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', page: 12, pages: 300, notes: { slug: 'note-1', title: 'Quantum Chemistry' }, others: [], at: 7 });
	// What is not as it should be is left out, not taken as it is.
	reading.set({ job_id: 'job-1', document_id: 3, title: '', page: 0, pages: 1.5, notes: { slug: '' } });
	assert.deepEqual(reading.get(), { job_id: 'job-1', document_id: null, title: null, page: null, pages: null, notes: null, others: [], at: 7 });
	// The other books open beside the note: each its job, id and title; not the one shown, nor one without a job.
	reading.set({ job_id: 'job-1', others: [{ job_id: 'job-2', document_id: 'doc-2', title: 'Statistical Mechanics' }, { job_id: 'job-1' }, { title: 'x' }] });
	assert.deepEqual(reading.get().others, [{ job_id: 'job-2', document_id: 'doc-2', title: 'Statistical Mechanics' }]);
	reading.set(null);
	assert.equal(reading.get(), null);
	reading.set({ job_id: 'job-1' });
	reading.set({ job_id: '' });
	assert.equal(reading.get(), null);
});
