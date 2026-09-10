// 仍在使用的自定义元素标签(legacy islands / 占位契约)的 JSX 全局类型声明。
// 部分标签仍写 class= 而非 className，故在 HTMLAttributes 上补充 class。
//
// 这是 ambient 全局声明，不属于任何单一功能：消费方同时横跨 src/app/
// (HomeApp、AppTopBar) 与 src/features/ (ingest 的 InlineErrorBox)，
// 所以放在中立的 src/types/ 下，由 tsconfig 的 include: src/**\/* 自动拾取。

import type { HTMLAttributes, ReactNode } from "react";

/** Shared props for home-page placeholder custom elements. */
type HomeCustomElementProps = HTMLAttributes<HTMLElement> & {
  /** Legacy HTML class attribute still used by some home tags. */
  class?: string;
  children?: ReactNode;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "inline-error-box": HomeCustomElementProps;
      "library-search-island": HomeCustomElementProps;
      "developer-auth-dialog": HomeCustomElementProps;
      "developer-settings-dialog": HomeCustomElementProps;
      "app-shell-header": HomeCustomElementProps;
    }
  }
}

export {};
