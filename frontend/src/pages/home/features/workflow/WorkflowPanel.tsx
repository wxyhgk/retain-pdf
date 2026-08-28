// Bảng quy trình làm việc (thẻ quy trình dịch, ánh theo từng id khối .translation-workflow-card
// của partials/main-content.html).
//
// - #job-warning: view store quy trình (callback cầu nối updateJobWarning ghi vào)
// - #job-form: quy trình gửi thuộc miền app-actions (3b), onSubmit đi qua bridge.submitForm
//   (3a giữ chỗ preventDefault; input thông tin xác thực ẩn do HiddenCredentialInputs của
//   miền credentials tiếp quản, chỉ render một bản, không lặp id DOM)
// - Tile tải lên/nhóm thao tác/hộp lỗi nội tuyến lần lượt do component miền upload và
//   InlineErrorBox đảm nhiệm

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { HeroUpload } from "../upload/HeroUpload.jsx";
import { InlineErrorBox } from "../../components/InlineErrorBox.jsx";
import { HiddenCredentialInputs } from "../credentials/HiddenCredentialInputs.jsx";

export function WorkflowPanel() {
  const services = useHomeServices();
  const workflow = useStoreSnapshot(services.stores.workflowView);

  return (
    <section className="translation-workflow-card">
      <div id="job-warning" className={`job-warning${workflow.jobWarningVisible ? "" : " hidden"}`}>
        Phát hiện tác vụ trước vẫn đang xử lý. Vui lòng đợi tác vụ hiện tại hoàn tất trước khi gửi PDF mới.
      </div>

      <form
        id="job-form"
        className="form"
        noValidate
        onSubmit={(event) => services.bridge.submitForm(event)}
      >
        <HiddenCredentialInputs />

        <HeroUpload />
        <InlineErrorBox />
      </form>
    </section>
  );
}
