export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;
export interface RequestOptions {
    signal?: AbortSignal;
    /** 换掉发请求的函数（测试或调用方自带的 fetch）；默认 apiFetch。 */
    fetchImpl?: typeof fetch;
    /** 把失败的响应变成错误对象；不传时用后端的 message 加状态码，并挂上 errorCode、reason。 */
    onError?: (status: number, payload: any) => Error;
    /** 建任务类请求带的 Idempotency-Key（见 idempotency.ts）；不传就不带这个头。 */
    idempotencyKey?: string;
}
export interface RequestSpec {
    apiPrefix: string | undefined;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    /** 相对 /api/v1 的路径，路径参数已经编码。 */
    path: string;
    query?: object;
    body?: unknown;
    options?: RequestOptions;
}
/** 查询参数按传入顺序编码：undefined、null、空串不发；数组按后端约定用逗号连接（job_ids=a,b）。 */
export declare function encodeQuery(query: object | undefined): string;
export declare function encodePathParam(value: string): string;
export declare function request<T>({ apiPrefix, method, path, query, body, options }: RequestSpec): Promise<T>;
/** 只用固定文案加状态码，例如「读取文档库失败，请稍后重试。(500)」。 */
export declare function failWith(message: string): NonNullable<RequestOptions["onError"]>;
/** 优先用后端回的 message，没有时用固定文案，都加状态码。 */
export declare function failWithServerMessage(fallback: string): NonNullable<RequestOptions["onError"]>;
/** 有后端的 message 就原样用（不加状态码），没有时用固定文案加状态码。 */
export declare function serverMessageOr(fallback: string): NonNullable<RequestOptions["onError"]>;
/** 同 failWithServerMessage，再挂上后端错误里的 errorCode、reason（409 靠 reason 说明为什么不允许）。 */
export declare function failWithDetails(fallback: string): NonNullable<RequestOptions["onError"]>;
/**
 * 和 submitJson 一样的提交报错：页数额度不够、磁盘空间不够给一句中文（refusedSubmissionError），
 * 其余是「提交失败: 状态码 后端 message」加 context，挂上 errorCode、reason。
 */
export declare function submitFailure(context?: string): NonNullable<RequestOptions["onError"]>;
/** 失败的状态码是 status 时返回 fallback（例如 404 当作「还没有」），别的错误照抛。 */
export declare function orOnStatus<T, F>(pending: Promise<T>, status: number, fallback: F): Promise<T | F>;
