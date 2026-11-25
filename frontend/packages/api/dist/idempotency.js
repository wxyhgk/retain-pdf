// 建任务类请求的 Idempotency-Key（后端 2026-11-24 起，见 docs/api/00-约定/06-防重复提交.md）。
// 用户点一次「翻译 / 续跑 / 重试」生成一把新 key；同一把 key 的重复请求后端只执行一次、原样回第一次的结果。
// 前端没有自动重发，一次调用就是一次点击，所以每个提交函数自己生成一把就够了。
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
function bytesToUuid(bytes) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/**
 * 一把新的 key（UUID v4）。crypto.randomUUID 只在安全上下文里有：局域网用 http://192.168.x.x 打开时没有，
 * 退回 getRandomValues（不挑上下文）；都没有（极老的环境）才用 Math.random，key 只用来去重，不涉及安全。
 */
export function newIdempotencyKey() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function")
        return cryptoApi.randomUUID();
    const bytes = new Uint8Array(16);
    if (typeof cryptoApi?.getRandomValues === "function")
        cryptoApi.getRandomValues(bytes);
    else
        for (let i = 0; i < bytes.length; i += 1)
            bytes[i] = Math.floor(Math.random() * 256);
    return bytesToUuid(bytes);
}
