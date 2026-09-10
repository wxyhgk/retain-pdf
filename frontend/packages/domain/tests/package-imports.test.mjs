import assert from 'node:assert/strict'
import test from 'node:test'

test('all public bare-package entry points load their JavaScript artifacts', async () => {
  const [domain, job, jobStatus, library] = await Promise.all([
    import('@retainpdf/domain'),
    import('@retainpdf/domain/job'),
    import('@retainpdf/domain/job-status'),
    import('@retainpdf/domain/library'),
  ])

  assert.equal(typeof domain.buildElapsedViewModel, 'function')
  assert.equal(typeof job.normalizeJobPayload, 'function')
  assert.equal(typeof jobStatus.buildJobStatusViewModel, 'function')
  assert.equal(typeof library.assembleTranslatePayload, 'function')
})

test('source and unlisted deep imports stay private', async () => {
  await assert.rejects(
    import('@retainpdf/domain/src/index.ts'),
    ({ code }) => code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  )
  await assert.rejects(
    import('@retainpdf/domain/job/core'),
    ({ code }) => code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  )
})
