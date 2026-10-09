// 调用方有时传入的是可能非 Promise 的值（Promise.race 本来就接受普通值），所以参数放宽到 T | PromiseLike<T>。
export function withTimeout<T>(promise: T | PromiseLike<T>, ms: number, message: string): Promise<Awaited<T>> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timer);
  });
}
