// 书籍详情里别的功能登记的页签（功能登记表第二步，docs/ops/planning/frontend-migration/20261112-功能登记表.md）。
//
// 书籍详情自己的页签（概览、进度、文件、质量、术语、历史）在它自己的 BookDetailDialog 里。别的功能要在书籍详情里
// 加一页：在自己目录写一项（格式 ui/book-detail/book-detail-tab.ts，照 features/book-detail/ui/tabs/standalone-tabs.tsx
// 写），从功能出口导出，再在下面加一行。order 和书籍详情自己的页签排在一起：概览 10、进度 20、文件 30、质量 40、
// 术语 50、历史 60。
import type { BookDetailTab } from "@/ui/book-detail/book-detail-tab.js";

export const EXTRA_BOOK_DETAIL_TABS: readonly BookDetailTab[] = [];
