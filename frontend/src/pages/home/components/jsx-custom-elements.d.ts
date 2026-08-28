// home Nhãn phần tử tùy chỉnh mà trang vẫn sử dụng(legacy islands / Chứng thư Xếp lớp)。
// Một số nhãn vẫn được viết class= mà không phải là className，Do đó, trong HTMLAttributes Bổ sung hàng đầu class。

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
      "recent-jobs-dialog": HomeCustomElementProps;
      "developer-auth-dialog": HomeCustomElementProps;
      "developer-settings-dialog": HomeCustomElementProps;
      "page-range-dialog": HomeCustomElementProps;
      "app-shell-header": HomeCustomElementProps;
    }
  }
}

export {};
