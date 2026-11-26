export class PermissionStore {
    pending = new Map();
    listeners = new Set();
    version = 0;
    add(request) {
        return new Promise((resolve) => {
            const key = request.toolCall.toolCallId;
            this.pending.set(key, {
                request,
                resolve: (response) => {
                    this.pending.delete(key);
                    this.bump();
                    resolve(response);
                },
            });
            this.bump();
        });
    }
    get(toolCallId) {
        return this.pending.get(toolCallId);
    }
    all() {
        return [...this.pending.values()];
    }
    /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
    cancelAll() {
        for (const item of [...this.pending.values()])
            item.resolve({ outcome: { outcome: "cancelled" } });
    }
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    snapshot = () => this.version;
    bump() {
        this.version += 1;
        for (const listener of this.listeners)
            listener();
    }
}
