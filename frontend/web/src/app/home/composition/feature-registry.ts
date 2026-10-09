// features 注册表的取用：各功能按装配顺序逐个挂到 features 上，类型只能写成可选；
// 但回调真正执行时（用户操作、轮询、事件）对应功能早已挂好。这里取出来并收窄类型，
// 万一取的时候还没挂，说明装配顺序写错了——直接报出是哪个功能，而不是一个看不出
// 来源的「undefined 上没有某某方法」。
//
// 能容忍「还没挂」的调用点（比如 `features.workflowFeature?.isOcrOnly?.()`）照旧用可选链。
import type { HomeFeatures } from "./types.js";

export function mountedFeature<K extends keyof HomeFeatures>(
  features: HomeFeatures,
  key: K,
): NonNullable<HomeFeatures[K]> {
  const feature = features[key];
  if (!feature) {
    throw new Error(`${String(key)} 还没有挂载（create-home-composition 的装配顺序有误）`);
  }
  return feature as NonNullable<HomeFeatures[K]>;
}
