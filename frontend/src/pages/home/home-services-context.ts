// Kênh phát từ gốc hợp thành: một Context cấp trang (điều khoản "chiến lược trạng thái"
// mục 3 của kế hoạch tổng). entry.jsx dựng composition trước, sau đó đổ vào cây thành phần
// qua <HomeServicesProvider>; không tạo Context theo từng feature.

import { createContext, useContext } from "react";
import type { HomeServices } from "./composition/types.js";

export const HomeServicesContext = createContext<HomeServices | null>(null);
export const HomeServicesProvider = HomeServicesContext.Provider;

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext);
  if (!services) {
    throw new Error("useHomeServices phải được dùng bên trong <HomeServicesProvider> (entry.jsx tạo composition trước)");
  }
  return services;
}
