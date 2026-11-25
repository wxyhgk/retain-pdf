export declare const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
/**
 * 一把新的 key（UUID v4）。crypto.randomUUID 只在安全上下文里有：局域网用 http://192.168.x.x 打开时没有，
 * 退回 getRandomValues（不挑上下文）；都没有（极老的环境）才用 Math.random，key 只用来去重，不涉及安全。
 */
export declare function newIdempotencyKey(): string;
