import {
  messagesToBranchItems,
  type AiCitationLike,
  type ThreadBranchItem,
  type ThreadBranchMessage,
  type ThreadBranchSnapshot,
} from "../../../external.js";

export type ReaderAskStoreMessage = Omit<ThreadBranchMessage, "citations"> & {
  citations?: AiCitationLike[];
};

export type ReaderAskTreeItem = {
  parentId: string | null;
  message: ReaderAskStoreMessage;
};

export function snapshotFromTree(
  items: readonly ReaderAskTreeItem[],
  headId: string | null,
): ThreadBranchSnapshot {
  return {
    version: 1,
    headId,
    items: items.map((item) => ({
      parentId: item.parentId,
      message: {
        id: item.message.id,
        role: item.message.role,
        content: item.message.content,
        ...(item.message.progress ? { progress: item.message.progress } : {}),
        ...(item.message.citations?.length ? { citations: item.message.citations } : {}),
        ...(item.message.status
          ? {
              status: {
                type: item.message.status.type,
                ...(item.message.status.reason ? { reason: `${item.message.status.reason}` } : {}),
              },
            }
          : {}),
      },
    })) as ThreadBranchItem[],
  };
}

export function treeFromSnapshot(snapshot: ThreadBranchSnapshot): {
  items: ReaderAskTreeItem[];
  headId: string | null;
} {
  return {
    items: snapshot.items.map((item) => ({
      parentId: item.parentId,
      message: {
        ...item.message,
        citations: (item.message.citations || []) as AiCitationLike[],
        status: item.message.status as ReaderAskStoreMessage["status"],
      },
    })),
    headId: snapshot.headId,
  };
}

export function visibleMessages(
  items: readonly ReaderAskTreeItem[],
  headId: string | null,
): ReaderAskStoreMessage[] {
  if (!items.length) return [];
  const byId = new Map(items.map((item) => [item.message.id, item]));
  const head = (headId && byId.get(headId)) || items.at(-1);
  if (!head) return [];
  const chain: ReaderAskStoreMessage[] = [];
  let current: ReaderAskTreeItem | undefined = head;
  const visited = new Set<string>();
  while (current && !visited.has(current.message.id)) {
    visited.add(current.message.id);
    chain.push(current.message);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain.reverse();
}

export function findMessage(
  items: readonly ReaderAskTreeItem[],
  id: string | null | undefined,
): ReaderAskStoreMessage | null {
  if (!id) return null;
  return items.find((item) => item.message.id === id)?.message ?? null;
}

function pathItemsToMessage(
  items: readonly ReaderAskTreeItem[],
  targetId: string,
): ReaderAskTreeItem[] {
  const byId = new Map(items.map((item) => [item.message.id, item]));
  let current = byId.get(targetId);
  if (!current) return [];
  const chain: ReaderAskTreeItem[] = [];
  const visited = new Set<string>();
  while (current && !visited.has(current.message.id)) {
    visited.add(current.message.id);
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain.reverse();
}

export function pathForBranch(
  items: readonly ReaderAskTreeItem[],
  targetId: string,
  headId: string | null,
): ReaderAskTreeItem[] {
  const requestedId = `${targetId || ""}`.trim();
  if (!requestedId || !items.length) return [];

  let resolvedId = requestedId;
  if (!items.some((item) => item.message.id === resolvedId)) {
    if (headId && items.some((item) => item.message.id === headId)) {
      resolvedId = headId;
    } else {
      resolvedId = [...items].reverse().find((item) => item.message.role === "assistant")?.message.id || "";
    }
  }

  let path = pathItemsToMessage(items, resolvedId);
  if (path.length >= 2 && path.at(-1)?.message.role === "assistant") return path;
  if (path.length === 1 && path[0]?.message.role === "user") path = [];

  const visible = visibleMessages(items, headId || resolvedId);
  let index = visible.findIndex((message) => message.id === resolvedId);
  if (index < 0) index = visible.length - 1;
  if (index < 0) return path;
  const byId = new Map(items.map((item) => [item.message.id, item]));
  const linear = visible
    .slice(0, index + 1)
    .map((message) => byId.get(message.id))
    .filter((item): item is ReaderAskTreeItem => Boolean(item));
  while (linear.length && linear.at(-1)?.message.role !== "assistant") linear.pop();
  return linear.length ? linear : path;
}

export function treeItemsFromBranchItems(
  branchItems: ReturnType<typeof messagesToBranchItems>,
): ReaderAskTreeItem[] {
  return branchItems.map((item) => ({
    parentId: item.parentId,
    message: {
      ...item.message,
      citations: (item.message.citations || []) as AiCitationLike[],
      status: item.message.status as ReaderAskStoreMessage["status"],
    },
  }));
}
