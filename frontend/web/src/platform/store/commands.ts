export function createCommandBus({
  onError = null,
}: any = {}) {
  const handlers = new Map<string, Set<(payload: any, meta: any) => any>>();

  function on(command, handler) {
    const commandName = `${command || ""}`.trim();
    if (!commandName || typeof handler !== "function") {
      return () => {};
    }
    if (!handlers.has(commandName)) {
      handlers.set(commandName, new Set());
    }
    handlers.get(commandName).add(handler);
    return () => handlers.get(commandName)?.delete(handler);
  }

  async function dispatch(command, payload = {}) {
    const commandName = `${command || ""}`.trim();
    const registered = Array.from(handlers.get(commandName) || []);
    const results = [];
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
