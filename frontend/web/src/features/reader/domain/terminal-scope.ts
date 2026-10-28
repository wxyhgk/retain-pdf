/** 终端开在哪个作用域：这本书，还是它所在的那个文件夹。
 *
 * ## 为什么需要选择
 *
 * agent 的工作区此前只有一种 —— 单本书（`jobs/<job_id>/ai/`）。于是「这几篇
 * 里哪些互相矛盾」这类问题**在结构上问不出来**，不是模型不行，是它看不见第二
 * 本书。后端已经能物化一个文件夹的工作区（`collections/<id>/ai/`，里面
 * `books/` 是每本书的符号链接），差的只是让人能切过去。
 *
 * ## 为什么不是「这本书所在的文件夹」
 *
 * 那需要「文档 → 文件夹」的反查,而前端现有做法是 N+1（见 book-detail 的
 * `useDocumentCollections`,专门做了限流和缓存）。在阅读页再来一遍不划算。
 *
 * 而且「一个文件夹」本来就不是这本书的属性 —— 它是一组书。列出全部文件夹让
 * 人挑,语义反而更直。
 *
 * ## 切之前必须先物化
 *
 * `books/` 和清单是 Rust 侧按数据库现状生成的,而成员和 active_job 都会变。
 * 不先打一次 `agent-workspace`,终端会落进一个**过期或根本不存在**的工作区 ——
 * 而 Python 那侧发现清单不在会退回私有目录,表现是「终端开起来了,但 books/
 * 是空的」,没有任何报错。
 */

export type TerminalScope =
  /** 单本书。session 键就是 jobId,和这个功能上线以来一样。 */
  | { kind: "job"; jobId: string }
  /** 一个文件夹。 */
  | { kind: "collection"; collectionId: string; name: string; documentCount: number };

export type CollectionOption = {
  collectionId: string;
  name: string;
  documentCount: number;
};

/** 后端的会话键格式。Python 侧按 `collection:` 前缀分发，两边必须一致 ——
 * 有跨语言门禁对账。 */
export const COLLECTION_SESSION_PREFIX = "collection:";

export function sessionKeyForScope(scope: TerminalScope): string {
  return scope.kind === "job"
    ? scope.jobId
    : `${COLLECTION_SESSION_PREFIX}${scope.collectionId}`;
}

/** 列出可选的文件夹。
 *
 * **空文件夹不列出来**：切过去只会得到一个 `books/` 为空的工作区，而 agent
 * 无从判断这是「文件夹是空的」还是「出错了」。
 *
 * 取不到就返回空数组，不抛 —— 这只是个可选的切换入口，拿不到就少一个选项，
 * 不该让终端面板整个坏掉。
 */
export async function loadCollectionOptions(
  listCollections: () => Promise<{ collections?: unknown } | null>,
): Promise<CollectionOption[]> {
  try {
    const raw = (await listCollections())?.collections;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const row = item as Record<string, unknown>;
      const collectionId = typeof row.collection_id === "string" ? row.collection_id : "";
      const documentCount =
        typeof row.document_count === "number" ? Math.max(0, row.document_count) : 0;
      if (!collectionId || documentCount === 0) return [];
      return [{
        collectionId,
        name: typeof row.name === "string" && row.name ? row.name : collectionId,
        documentCount,
      }];
    });
  } catch {
    return [];
  }
}

/** 物化一个文件夹的 agent 工作区。切过去之前必须成功，见文件头。
 *
 * **成功返回 null，失败返回原因**。不用 `{ok, reason}` 判别联合：调用方只关心
 * "能不能切"和"不能的话怎么说"，一个可空字符串就够，少一层解构。
 */
export async function ensureCollectionWorkspace(
  materialize: (collectionId: string) => Promise<{ books?: unknown } | null>,
  collectionId: string,
): Promise<string | null> {
  try {
    const data = await materialize(collectionId);
    const books = Array.isArray(data?.books) ? data.books : null;
    if (!books) return "工作区清单格式不对";
    // 一本都没物化出来（全都还没翻译完）。切过去 agent 什么也看不到，
    // 而它会把这当成"这个文件夹是空的"。
    if (books.length === 0) return "这个文件夹里还没有翻译好的书";
    return null;
  } catch (error) {
    // 文件夹在列表拿到之后被删了：后端 404（以前是 200 + 空清单）。
    if ((error as { status?: unknown } | null)?.status === 404) return "这个文件夹已经不存在了";
    return String(error).slice(0, 80);
  }
}

/** 作用域的显示文字。文件夹要带本数 —— 「化学」看不出范围，「化学 · 4 本」能。 */
export function scopeLabel(scope: TerminalScope): string {
  return scope.kind === "job" ? "这本书" : `${scope.name} · ${scope.documentCount} 本`;
}
