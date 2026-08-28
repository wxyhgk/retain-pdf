// 4 input thông tin xác thực ẩn (Rủi ro 1 trong kế hoạch kiến trúc) — 3a HeroUpload/WorkflowPanel
// đọc .value từ các DOM node này để gửi nhiệm vụ; 3b domain này chịu trách nhiệm tương thích với
// default-state-port.js để đồng bộ hai chiều.
//
// Chỉ render ở đây (WorkflowPanel.jsx đã thay thế 4 input placeholder tĩnh ban đầu bằng
// module này, ghi chú giải thích "input thông tin xác thực ẩn do domain 3b credentials tiếp quản") — toàn bộ codebase
// chỉ cho phép render tại đây, tránh trùng lặp DOM id.
//
// Controlled (khác với kế hoạch ban đầu "uncontrolled ref + mirrorCredentialsToHiddenInputs",
// đây là điều chỉnh cố ý, xem lý do bên dưới): đăng ký trực tiếp credentialsStatePort.store để lấy
// value — đo thực tế (jsdom + React 18/19 host diff) chứng thực, sau khi React render
// <input defaultValue> rồi bị mã bên ngoài mirrorCredentialsToHiddenInputs ghi đè
// `node.value = x`, miễn là cây con này có bất kỳ component anh em nào re-render
// (HeroUpload render lại liên tục trong quá trình tải lên), logic khôi phục form element của React
// sẽ lặng lẽ rollback .value về defaultValue (""), dẫn đến token vừa lưu bị xóa trắng âm thầm —
// đây không phải lỗi môi trường test mà tái hiện cả ở production (token bị mất giữa chừng khi tải lên).
// Cho credentialsStatePort trực tiếp điều khiển value= triệt tiêu hoàn toàn loại lỗi này từ gốc:
// store là nguồn chân thực duy nhất, DOM chỉ là hình chiếu, không còn tình trạng race condition
// giữa ghi đè bên ngoài và React render.
// Side effect mirrorToDom (mirrorCredentialsToHiddenInputs) của default-state-port.js
// vẫn kích hoạt bình thường (browser.js gọi nội bộ), nay trở thành thao tác phụ không gây hại — đường dẫn
// ghi thực tế dựa vào cập nhật store tại đây.

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { hidden: HIDDEN_IDS } = CREDENTIAL_DOM_IDS;

function selectCredentials(snapshot) {
  return snapshot.credentials;
}

export function HiddenCredentialInputs() {
  const services = useHomeServices();
  const credentials = useStoreSnapshot(services.ports.credentialsStatePort.store, selectCredentials);

  return (
    <>
      <input id={HIDDEN_IDS.ocrProvider} name="ocr_provider" type="hidden" value={credentials.ocrProvider || "paddle"} readOnly />
      <input id={HIDDEN_IDS.paddleToken} name="paddle_token" type="hidden" value={credentials.paddleToken || ""} readOnly />
      <input id={HIDDEN_IDS.modelApiKey} name="api_key" type="hidden" value={credentials.modelApiKey || ""} readOnly />
    </>
  );
}
