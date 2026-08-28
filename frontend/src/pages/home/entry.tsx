// Lối vào trang home React (Phase 3a, phần khung).
//
// Hiện index.html vẫn trỏ tới dist/app.bundle.js của bản cũ; lối vào này chỉ
// được tải qua home-react-dev.html (dist/home-react-dev.bundle.js) trong giai
// đoạn phát triển tạm thời. Khi cutover (3b) hoàn tất, index.html sẽ trỏ tới
// dist/home.bundle.js của tệp này.
//
// Giữ đúng thứ tự (kế hoạch xây dựng §4): dựng composition trước, gắn cầu nối
// sự kiện, đọc store ở trạng thái idle, rồi createRoot().render — useSyncExternalStore
// có giá trị ngay ở lần đọc đầu nên vỏ không bị nhấp nháy.
// Giống detail/reader: không mở StrictMode (composition gắn handler một lần,
// gọi kép sẽ lặp dispatch); tách command multiplex khỏi StrictMode là quy ước
// chung cho cả ba trang.

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DecorStage } from "../../shared/decor/DecorStage.jsx";
import { createHomeComposition } from "./composition.js";
import { HomeApp } from "./HomeApp.jsx";

// Đọc data-theme sớm để giảm nhấp nháy FOUC (xem docs/theme-system/THEME_SYSTEM.md).
bootTheme();

// appUpdateAutoCheckEnabled: true — composition.js tắt kiểm tra GitHub nền theo
// mặc định (để cô lập test, xem chú thích đầu composition.js); lối vào sản xuất
// bật rõ ràng tại đây, tương đương cổng isAppUpdateEnabled của
// bootstrap/core-app-update-runtime-port.js bản cũ.
const services = createHomeComposition({ appUpdateAutoCheckEnabled: true });
services.initialize();

function resolveHomeRoot(body = document.body) {
  let host = document.getElementById("home-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "home-root";
    body.appendChild(host);
  }
  return host;
}

createRoot(resolveHomeRoot()).render(
  <>
    {/* Sân khấu trang trí: chủ đề không có decorPack sẽ render null, không phát sinh
        chi phí (docs/theme-system/DECOR_PACKS.md). */}
    <DecorStage />
    <HomeApp services={services} />
  </>,
);
