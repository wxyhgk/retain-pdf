// Registry anchor trang trí (slot): "Contract bố cục" của chủ đề trang trí.
//
// Nguyên tắc thiết kế (docs/theme-system/DECOR_PACKS.md):
// - UI chức năng luôn là DOM; lớp trang trí chỉ được treo trên các anchor định danh sau, không được tự tạo tọa độ.
// - manifest khai báo "tài sản treo ở slot nào", slot ở đâu, lớn bao nhiêu, cấp độ nào do
//   CSS sân khấu (DecorStage sau đó) triển khai thống nhất — tách biệt giữa tài sản và bố cục.
// - Thêm anchor mới = đăng ký tại đây + bổ sung định vị trong CSS sân khấu; manifest sẽ tự động cho phép.
//
// Dải phân cấp (z-index band, giá trị cụ thể do CSS sân khấu phân phối thống nhất):
//   bg  < Tấm nền UI chức năng < mid < Nội dung UI chức năng … ngoài rìa < fg
//   bg  Nền toàn cảnh (sơn thủy/vườn tược/thảo nguyên), luôn bị panel UI che khuất
//   mid Đạo cụ trung cảnh (nhân vật/đỉnh đồng/ngựa), có thể bị panel UI che khuất cục bộ
//   fg  Rìa tiền cảnh (cành hoa/điêu khắc rồng lấn vào rìa UI), pointer-events: none

export type DecorLayerBand = "bg" | "mid" | "fg";

export type DecorSlotDefinition = {
  /** id mà manifest.layers[].slot tham chiếu */
  id: string;
  band: DecorLayerBand;
  /** Khu vực đại khái (ngữ nghĩa phần trăm chỉ dùng để gợi ý tài liệu, giá trị thực nằm trong CSS sân khấu) */
  area: string;
  /** true = cho phép đè lên rìa UI chức năng (chỉ dải fg mới được true) */
  overUi: boolean;
  /** true = slot này hỗ trợ văn bản dọc/ngang (biển chữ) */
  textCapable?: boolean;
};

/**
  * Bảng giá trị anchor. Bao quanh panel thư viện trung tâm + nền toàn cảnh + vị trí đề chữ.
  * Các phần tử trang trí của 3 bản phác thảo concept (Phong cách Quốc gia/Vườn tược/Thảo nguyên) đều có thể ánh xạ vào bộ anchor này.
  */
export const DECOR_SLOTS: readonly DecorSlotDefinition[] = [
  { id: "backdrop", band: "bg", area: "Toàn màn hình 100%×100%", overUi: false },

  // Hai cánh trái phải: nhân vật, điêu khắc rồng, bình sứ, ngựa, giàn giáo trong bản concept
  { id: "left-top", band: "mid", area: "Trên trái 0~25% × 0~40%", overUi: false },
  { id: "left-bottom", band: "mid", area: "Dưới trái 0~25% × 55~100%", overUi: false },
  { id: "right-top", band: "mid", area: "Trên phải 75~100% × 0~40%", overUi: false },
  { id: "right-bottom", band: "mid", area: "Dưới phải 75~100% × 55~100%", overUi: false },

  // Trung tâm phía trên: vật trang trí hình vòm/bướm/chim phía trên điều hướng
  { id: "top-center", band: "mid", area: "Đỉnh 30~70% × 0~12%", overUi: false },

  // Vị trí nhân vật chính: nhân vật trong vùng banner phía trên (thiếu nữ/thiếu niên đọc sách trong 3 bản concept)
  { id: "hero", band: "mid", area: "Vùng banner đỉnh 40~70% × 10~30%", overUi: false },

  // Rìa tiền cảnh: cành hoa, chuỗi ngọc, tua rua lấn vào rìa panel
  { id: "edge-left", band: "fg", area: "Rìa trái 0~12% × toàn cao", overUi: true },
  { id: "edge-right", band: "fg", area: "Rìa phải 88~100% × toàn cao", overUi: true },

  // Vị trí tiền cảnh dưới phải: bản fg của right-bottom — dùng cho trường hợp cần nhân vật/đạo cụ đè lên panel
  { id: "right-bottom-fg", band: "fg", area: "Dưới phải 75~100% × 55~100%", overUi: true },

  // Banner đề chữ ("Tri kỳ sở lai Minh kỳ sở vãng"): vị trí văn bản dọc
  { id: "quote", band: "mid", area: "Trên phải 82~98% × 5~35%", overUi: false, textCapable: true },
] as const;

export type DecorSlotId = (typeof DECOR_SLOTS)[number]["id"];

const SLOT_MAP: ReadonlyMap<string, DecorSlotDefinition> = new Map(
  DECOR_SLOTS.map((s) => [s.id, s]),
);

export function getDecorSlot(id: string): DecorSlotDefinition | undefined {
  return SLOT_MAP.get(id);
}

export function isDecorSlotId(value: unknown): value is DecorSlotId {
  return typeof value === "string" && SLOT_MAP.has(value);
}
