import { Check, FileSearch, Languages, ScanText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { StageKey, SubstageKey } from './types'

export const statusStages: Array<{ key: StageKey; label: string; icon: LucideIcon }> = [
  { key: 'ocr', label: 'OCR', icon: ScanText },
  { key: 'translate', label: 'Dịch', icon: Languages },
  { key: 'render', label: 'Kết xuất', icon: FileSearch },
  { key: 'done', label: 'Hoàn tất', icon: Check },
]

export const translationSubstages: Array<{ key: SubstageKey; label: string }> = [
  { key: 'translation_batches', label: 'Các lượt dịch' },
  { key: 'continuation_review', label: 'Nối cột/trang' },
  { key: 'page_policies', label: 'Chính sách trang' },
  { key: 'garbled', label: 'Sửa lỗi ký tự' },
]

export const statusCopy = {
  actions: {
    cancel: 'Hủy',
    home: 'Trang chủ',
    detail: 'Chi tiết',
    reader: 'Đọc đối chiếu',
    downloadPdf: 'Tải PDF',
  },
  progress: {
    fallback: 'Đang xử lý',
  },
}
