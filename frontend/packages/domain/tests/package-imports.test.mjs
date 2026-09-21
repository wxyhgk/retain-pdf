import assert from 'node:assert/strict'
import test from 'node:test'

test('all public bare-package entry points load their JavaScript artifacts', async () => {
  const [domain, job, jobStatus, ai, session] = await Promise.all([
    import('@retainpdf/domain'),
    import('@retainpdf/domain/job'),
    import('@retainpdf/domain/job-status'),
    import('@retainpdf/domain/ai'),
    import('@retainpdf/domain/session'),
  ])

  assert.equal(typeof domain.buildElapsedViewModel, 'function')
  assert.equal(typeof job.normalizeJobPayload, 'function')
  assert.equal(typeof jobStatus.buildJobStatusViewModel, 'function')
  assert.equal(typeof ai.describeToolEvent, 'function')
  assert.equal(typeof session.toSessionSummary, 'function')
  assert.equal(typeof session.makeId, 'function')
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

// 删除的 ./library 入口装的是 frontend/web 的过期快照（见 src/index.ts 的说明）。
// 断言它没被顺手加回来：本包不再声明这四个名字，它们归 frontend/web 所有。
test('the stale library entry stays deleted', async () => {
  await assert.rejects(
    import('@retainpdf/domain/library'),
    ({ code }) => code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  )
  const domain = await import('@retainpdf/domain')
  for (const name of [
    'assembleTranslatePayload',
    'friendlyTranslateError',
    'friendlyDocumentDeleteError',
    'shouldPreferTranslateTab',
  ]) {
    assert.equal(
      name in domain,
      false,
      `${name} 属于 frontend/web/src/features/library/domain/documents/，不要在本包再放一份`,
    )
  }
})
