// Tab tùy chọn bổ sung (đối chiếu bảng "task" cũ trong components/dialogs/browser-credentials-dialog.js
// — dropdown Chế độ công thức; địa chỉ/tên mô hình không hiển thị trong template cũ nhưng
// dialog-values.js/dialog-sync.js (kept) vẫn đọc/ghi các trường tương ứng; tại đây thêm container ref
// uncontrolled tương ứng để đảm bảo tính toàn vẹn của hợp đồng trường mà không thay đổi layout hiển thị).

import { useCredentialsController } from "./useCredentialsController.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function TaskOptionsPanel({ hidden = false } = {}) {
  const { elementsRef } = useCredentialsController();

  return (
    <section
      className={`credential-card credential-panel${hidden ? "" : " is-active"}`}
      data-credential-panel="task"
      role="tabpanel"
      hidden={hidden}
    >
      <div className="credential-card-grid credential-card-grid-compact">
        <section className="credential-card">
          <div className="credential-card-head">
            <h3>Tùy chọn tác vụ</h3>
          </div>
          <label>
            <span className="developer-label">
              <span>Chế độ công thức</span>
            </span>
            <select
              id={BROWSER_IDS.mathMode}
              aria-label="Chế độ công thức"
              defaultValue="direct_typst"
              ref={(node) => { elementsRef.mathModeSelect = node || null; }}
            >
              <option value="placeholder">Giữ nguyên placeholder</option>
              <option value="direct_typst">Xuất trực tiếp công thức</option>
            </select>
          </label>
          {/* Địa chỉ mô hình / tên mô hình không nằm trong layout hiển thị của template cũ, nhưng dialog-values.js/
              dialog-sync.js vẫn đọc ghi hai trường này — giữ hợp đồng trường ẩn, không thêm UI hiển thị mới. */}
          <input
            id={BROWSER_IDS.modelBaseUrl}
            name="model_base_url"
            type="hidden"
            defaultValue=""
            ref={(node) => { elementsRef.modelBaseUrlInput = node || null; }}
          />
          <input
            id={BROWSER_IDS.modelName}
            name="model_name"
            type="hidden"
            defaultValue=""
            ref={(node) => { elementsRef.modelNameInput = node || null; }}
          />
        </section>
      </div>
    </section>
  );
}
