/** 真实进度：从 GET /jobs/:job_id/progress/editorial 按条数续读编辑部事件。纯逻辑，取一页的函数由调用方给。
 *
 * 规矩（docs/api/02-进度事件/03-编辑部事件.md）：
 * - after 带上次的 next_after；has_more 为真就马上再取；
 * - next_after 比带去的 after 还小，说明事件文件重开了（换了文档或引擎版本重跑），从 0 重取，之前叠的状态作废；
 * - 正在写的最后一行不完整时后端先不给，下次再给，所以这里不用管半行。
 */

import { parseEditorialEvents, type EditorialEvent } from "./events.js";
import { initialRoomState, reduceEditorialEvent, type RoomState } from "./room-state.js";

export type EditorialEventPage = { events: readonly unknown[]; next_after: number; has_more: boolean };
export type FetchEditorialPage = (after: number) => Promise<EditorialEventPage>;

/** 一次最多连取几页：防后端游标出错时原地打转。一页最多 500 条，够一本书。 */
const MAX_PAGES_PER_PULL = 40;

export type EditorialPull = { raws: unknown[]; nextAfter: number; reset: boolean };

/** 从 after 一直取到没有更多。reset 为真时 raws 是从头开始的全量。 */
export async function pullEditorialEvents(fetchPage: FetchEditorialPage, after: number): Promise<EditorialPull> {
  let cursor = Math.max(0, after);
  let reset = false;
  const raws: unknown[] = [];
  for (let i = 0; i < MAX_PAGES_PER_PULL; i += 1) {
    const page = await fetchPage(cursor);
    if (page.next_after < cursor) {
      reset = true;
      raws.length = 0;
      cursor = 0;
      continue;
    }
    raws.push(...page.events);
    const moved = page.next_after > cursor;
    cursor = page.next_after;
    if (!page.has_more || !moved) break;
  }
  return { raws, nextAfter: cursor, reset };
}

export type EditorialLive = { events: EditorialEvent[]; state: RoomState; after: number };

export const emptyEditorialLive = (): EditorialLive => ({ events: [], state: initialRoomState(), after: 0 });

/** 把这次取到的叠到已有的上面；重开了就从头叠。 */
export function mergeEditorialPull(live: EditorialLive, pull: EditorialPull): EditorialLive {
  const base = pull.reset ? emptyEditorialLive() : live;
  const fresh = parseEditorialEvents(pull.raws);
  if (!fresh.length && !pull.reset) return { ...live, after: pull.nextAfter };
  return {
    events: [...base.events, ...fresh],
    state: fresh.reduce(reduceEditorialEvent, base.state),
    after: pull.nextAfter,
  };
}
