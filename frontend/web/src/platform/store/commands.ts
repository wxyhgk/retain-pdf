export type CommandMeta = { command: string };
/** 处理器收到的载荷形状由各命令自己约定，总线不关心。 */
export type CommandHandler = (payload: unknown, meta: CommandMeta) => unknown;

export function createCommandBus({
  onError = null,
}: {
  /** 给了就逐个隔离处理器的异常（记下、继续下一个）；不给就直接抛。 */
  onError?: ((error: unknown, info: { command: string; payload: unknown }) => void) | null;
} = {}) {
  const handlers = new Map<string, Set<CommandHandler>>();

  function on(command: string, handler: CommandHandler) {
    const commandName = `${command || ""}`.trim();
    if (!commandName || typeof handler !== "function") {
      return () => {};
    }
    let set = handlers.get(commandName);
    if (!set) {
      set = new Set();
      handlers.set(commandName, set);
    }
    set.add(handler);
    return () => handlers.get(commandName)?.delete(handler);
  }

  async function dispatch(command: string, payload: unknown = {}) {
    const commandName = `${command || ""}`.trim();
    const registered = Array.from(handlers.get(commandName) || []);
    const results: unknown[] = [];
    for (const handler of registered) {
      try {
        results.push(await handler(payload, { command: commandName }));
      } catch (error) {
        if (typeof onError === "function") {
          onError(error, { command: commandName, payload });
          continue;
        }
        throw error;
      }
    }
    return results;
  }

  function clear(command = "") {
    const commandName = `${command || ""}`.trim();
    if (commandName) {
      handlers.delete(commandName);
      return;
    }
    handlers.clear();
  }

  return Object.freeze({
    on,
    dispatch,
    clear,
  });
}
