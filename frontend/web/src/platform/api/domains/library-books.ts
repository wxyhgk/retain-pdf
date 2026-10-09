import { isMockMode } from "@/platform/config/runtime.js";
import { getMockJobList } from "@/platform/mock/index.js";
import {
  fetchLibraryBookList as _fetchLibraryBookList,
  deleteLibraryBook as _deleteLibraryBook,
} from "@retainpdf/api/library-books";
import { stripOcrSuffix } from "@retainpdf/api/utils/strip-ocr";
import type { LibraryBookListView, LibraryDeleteResultView } from "@retainpdf/contracts/library-books";

/** 书架列表 / 删除的可选参数类型，取自真实 API 签名。 */
type FetchLibraryBookListOptions = NonNullable<Parameters<typeof _fetchLibraryBookList>[1]>;
type DeleteLibraryBookOptions = NonNullable<Parameters<typeof _deleteLibraryBook>[2]>;

// 返回值暂保留 any：后端生成的 LibraryBookListItemView（interface、字段可为 null）与前端
// LibraryCardItem（带任意字段签名、字段不收 null）不兼容。要收紧得在这里加一层
// 「后端视图 → 卡片」的转换，连同模拟数据和调用方一起改，单独做。
export const fetchLibraryBookList = async (apiPrefix: string, opts: FetchLibraryBookListOptions = {}): Promise<any> => {
  if (isMockMode()) { const jobIds = Array.isArray(opts?.jobIds) ? opts.jobIds : []; return getMockJobList({ jobIds }); }
  return _fetchLibraryBookList(apiPrefix, opts);
};

export const deleteLibraryBook = async (apiPrefix: string, jobId: string, opts: DeleteLibraryBookOptions = {}): Promise<LibraryDeleteResultView> => {
  const normalizedJobId = stripOcrSuffix(`${jobId || ""}`);
  if (!normalizedJobId) throw new Error("删除失败: 缺少 job_id");
  if (isMockMode()) {

    // mock 只回 job_id，真实返回是完整的 LibraryDeleteResultView，这里保持原行为只做类型断言。
    return { job_id: normalizedJobId } as LibraryDeleteResultView;
  }
  return _deleteLibraryBook(apiPrefix, jobId, opts);
};
