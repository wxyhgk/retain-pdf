/**
 * Library domain pure helpers — extractable from
 * frontend/web/src/pages/home/features/library/domain/controller.ts
 * and frontend/web-react/src/features/library/model/library-domain.ts
 *
 * Framework-agnostic, no React/DOM/fetch.
 * This package entry proves the shared logic can live in @retainpdf/domain.
 * web-react currently vendors the same file under model/library-domain.ts;
 * future refactor can alias "@retainpdf/domain/library" to this.
 */

export type TranslateDocumentPayload = {
  ocr?: { page_ranges?: string; [key: string]: unknown }
  translation?: { start_page?: number; end_page?: number; [key: string]: unknown }
  [key: string]: unknown
}

type ErrorLike = { message?: string; status?: number } | string | null | undefined

export function friendlyTranslateError(error: ErrorLike): string {
  const message = typeof error === 'string' ? error : `${(error as any)?.message || error || ''}`
  const credentialish = /(token|key|凭据|令牌|密钥|credential)/i.test(message)
  const missing = /(required|需要|缺|未配置|not configured|missing)/i.test(message)
  if (credentialish && missing) {
    return '翻译需要先在「设置」里配置 OCR / 翻译凭据后再试。'
  }
  return message || '发起翻译失败，请稍后重试。'
}

export function friendlyDocumentDeleteError(error: ErrorLike): string {
  const message = typeof error === 'string' ? error : `${(error as any)?.message || error || ''}`
  const status = typeof error === 'object' && error ? (error as any).status : undefined
  if (status === 409 || message.includes('(409)')) {
    const count = message.match(/\d+/)?.[0]
    return count
      ? `该文档有 ${count} 条收藏，请先删除收藏后再删除文档。`
      : '该文档存在收藏引用，请先删除相关收藏后再删除文档。'
  }
  return message || '删除文档失败'
}

export function assembleTranslatePayload(
  overrides: TranslateDocumentPayload = {},
  buildTranslateConfig?: (pageRanges?: string) => TranslateDocumentPayload | Record<string, unknown>,
): TranslateDocumentPayload {
  const pageRanges = `${overrides?.ocr?.page_ranges || ''}`.trim()
  const base = (buildTranslateConfig?.(pageRanges) || {}) as TranslateDocumentPayload
  return {
    ...(base.ocr ? { ocr: { ...base.ocr, ...(overrides.ocr || {}) } } : (overrides.ocr ? { ocr: overrides.ocr } : {})),
    ...(base.translation ? { translation: { ...base.translation, ...(overrides.translation || {}) } } : (overrides.translation ? { translation: overrides.translation } : {})),
  }
}

export type LibraryCardLike = {
  status?: string | null
  job_id?: string | null
  active_job_id?: string | null
  library_only?: boolean
  prefer_translate_tab?: boolean
  [key: string]: unknown
}

export function shouldPreferTranslateTab(item?: LibraryCardLike | null): boolean {
  if ((item as any)?.prefer_translate_tab) return true
  const status = `${(item as any)?.status || ''}`.trim().toLowerCase()
  if (status === 'failed' || status === 'running' || status === 'queued' || status === 'pending') {
    return true
  }
  const jobId = `${(item as any)?.job_id || (item as any)?.active_job_id || ''}`.trim()
  if (jobId && !jobId.startsWith('doc:') && !(item as any)?.library_only) {
    return true
  }
  return false
}
