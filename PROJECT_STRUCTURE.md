# PROJECT_STRUCTURE.md — RetainPDF-VI

> Tài liệu mô tả cấu trúc dự án, luồng dữ liệu và phân loại file theo mục tiêu dịch thuật.
> Tạo từ commit 8ca495 — quét thực tế 20/08/2026.

---

## 1. Kiến trúc tổng thể

RetainPDF là hệ thống **dịch PDF giữ nguyên bố cục**, hỗ trợ PDF văn bản, ảnh quét, công thức toán và bảng biểu.

### Luồng dữ liệu

`
[Upload PDF] → Rust API (:41000) → Python Pipeline → Artifacts
                                        │
                              ┌─────────┼──────────┐
                              ▼         ▼          ▼
                           OCR      Translate    Render
                        (PaddleOCR)  (LLM+Typst) (PDF overlay)
                              └─────────┴──────────┘
                                        ▼
                              AI Service (:41100) ↔ LLM (DeepSeek)
                              (Agent + Memory + Tools)
                                        ▼
                              Frontend SPA (:40001) / Desktop (Electron)
`

### Các trụ cột

| Module | Vai trò | Ngôn ngữ | Cổng |
|--------|---------|----------|------|
| Rust API | Upload, jobs, library, events, artifacts | Rust | :41000 |
| Python Pipeline | OCR, translation, diagnostics, rendering | Python | Internal |
| AI Service | Agent orchestration, LLM, memory, tools | Python | :41100 |
| Frontend SPA | Library, Reader, Home Ask - React + esbuild | TS/TSX | :40001 |
| Desktop Shell | Electron wrapper, window mgmt, bootstrap | JS | Local |
| Foundation Prompts | System/task prompts cho dịch, phân loại | .txt | Embedded |

---

## 2. Cây thư mục rút gọn

`
retain-pdf-vi/
├── backend/ai_service/retainpdf_ai/  # AI Agent, tools, memory, config
│   ├── agent.py, app.py, tools.py    # Core logic
│   ├── config.py, rust_client.py     # Config & HTTP client
│   ├── blocks.py, __main__.py        # Utils & entry
│   └── memory/                       # B2 memory: assemble, compress
├── backend/scripts/                  # Devtools, pipeline, promptfoo
├── backend/services/                 # Pipeline shared services
├── foundation/prompts/               # Prompt templates (.txt)
├── frontend/src/
│   ├── js/                           # Core: api, config, app-framework
│   ├── pages/                        # React SPA: home, reader, detail
│   ├── components/ui/                # shadcn/ui primitives
│   └── shared/                       # Theme, icons, navigation
├── desktop/                          # Electron: main.js, preload, splash
│   └── src/main/                     # Window mgmt, backend bootstrap
├── docker/                           # Dockerfile, compose, delivery
├── experiments/                      # POC, layout-fit (không dịch)
├── data/                             # Job outputs (runtime)
├── resources/                        # Brand assets, gallery
└── docs/                             # Theme system, reference
`

---

## 3. Phân loại dịch thuật

### 3.1 Nhom A: Prompts AI -> TIENG ANH (~16 files)

| File | Mo ta |
|------|-------|
| oundation/prompts/classification_system.txt | Phan loai noi dung |
| oundation/prompts/domain_inference_system.txt | Suy luan linh vuc (system) |
| oundation/prompts/domain_inference_task.txt | Suy luan linh vuc (task) |
| oundation/prompts/translation_direct_typst_guidance.txt | Huong dan Typst |
| oundation/prompts/translation_output_json.txt | Output JSON format |
| oundation/prompts/translation_output_plain_text.txt | Output plain text |
| oundation/prompts/translation_output_single_json.txt | Single JSON output |
| oundation/prompts/translation_output_tagged.txt | Tagged output |
| oundation/prompts/translation_sci_decision.txt | SCI paper decision |
| oundation/prompts/translation_system.txt | System prompt chinh |
| oundation/prompts/translation_system_plain_text.txt | System prompt plain text |
| oundation/prompts/translation_task.txt | Task prompt dich |
| oundation/prompts/translation_task_plain_text.txt | Task prompt plain text |
| oundation/prompts/translation_typst_repair.txt | Sua loi Typst |
| ackend/.../prompt_protocols.py | Protocol xay dung prompt dong |
| ackend/.../direct_typst_math.py | Typst math guidance inline |

### 3.2 Nhom B: Comments -> TIENG VIET

**Backend AI Service (~15 files):**
- agent.py, app.py, tools.py, blocks.py, config.py (da dich)
- rust_client.py (da dich), memory/__init__.py, memory/assemble.py, memory/compress.py
- __init__.py, __main__.py

**Backend Tests (~5 files):**
- test_agent.py, test_memory.py, test_streaming.py, test_tools_and_app.py

**Frontend Core (~30+ files):**
- src/js/api/*.ts (17 files), src/js/config/*.ts (6 files)
- src/js/app-framework/*.ts (6 files), src/js/components/**/*.ts
- src/pages/home/**/*.ts, src/pages/reader/**/*.ts

**Desktop (~10 files):**
- main.js, preload.js, splash.html
- src/main/backend-*.js, desktop-*.js, python-runtime.js

### 3.3 Nhom C: UI Strings -> TIENG VIET (~10 files)

| File | Noi dung |
|------|----------|
| features/library/library-config.ts | Labels, tooltips, placeholders |
| features/status/status-config.ts | Status & progress labels |
| pages/home/components/InlineErrorBox.tsx | Error messages |
| pages/home/features/home-ask/HomeAskComposer.tsx | Composer UI |
| pages/home/composition/create-app-actions.ts | Action labels |
| pages/home/home-services-context.ts | Service descriptions |
| desktop/splash.html | Splash screen text |
| desktop/main.js | Window titles, menus |
| desktop/src/main/desktop-windows.js | Window config strings |
| desktop/src/main/python-runtime.js | Runtime status msgs |

### 3.4 Nhom D: KHONG DICH noi dung (chi comment)

Config keys, env vars, API paths la interface contract:
- config.py, runtime.ts, api-constants.ts, model-constants.ts
- storage-keys.ts, desktop-persistence.ts, persisted-config.ts, desktop-config.js

### 3.5 Nhom E: Documentation -> TIENG VIET (~11 files, **DA HOAN THANH**)

| File | Noi dung |
|------|----------|
| `README_VI.md` | Bản dịch tiếng Việt của `README.md` |
| `CONTRIBUTING_VI.md` | Bản dịch tiếng Việt của `CONTRIBUTING.md` |
| `doc/reference/README_VI.md` | Bản dịch tiếng Việt của `doc/reference/README.md` |
| `doc/ops/README_VI.md` | Bản dịch tiếng Việt của `doc/ops/README.md` |
| `doc/core/README_VI.md` | Bản dịch tiếng Việt của `doc/core/README.md` |
| `doc/api/README_VI.md` | Bản dịch tiếng Việt của `doc/api/README.md` |
| `doc/adr/README_VI.md` | Bản dịch tiếng Việt của `doc/adr/README.md` |
| `backend/scripts/README_VI.md` | Bản dịch tiếng Việt của `backend/scripts/README.md` |
| `backend/scripts/devtools/promptfoo/README_VI.md` | Bản dịch tiếng Việt của `backend/scripts/devtools/promptfoo/README.md` |
| `docs/theme-system/THEME_SYSTEM_VI.md` | Bản dịch tiếng Việt của `docs/theme-system/THEME_SYSTEM.md` |
| `docker/delivery/README_VI.md` | Bản dịch tiếng Việt của `docker/delivery/README.md` |

### 3.6 Nhom F: KHONG DICH

node_modules/, dist/, experiments/, .claude/skills/, .github/workflows/, lock files

---

## 4. Quy uoc dich thuat

**Prompts -> English:** Thuat ngu AI chuan, giu placeholder {{var}}, XML tags, JSON keys. Imperative mood.

**Comments -> Vietnamese:** Tone ky thuat ngan gon. Khong dich ten ham/class/bien. Dich giai thich logic, TODO, canh bao.

**UI Strings -> Vietnamese:** Tu nhien, ngan gon cho buttons, day du cho errors. Giu hotkey indicators.

**Tuyet doi khong dich:** Ten bien/ham/class/type, import paths, env var names, API endpoints, JSON keys, code examples.

---

## 5. Lo trinh uu tien

| Phase | Noi dung | Files | Tac dong |
|-------|----------|-------|----------|
| 1 | Prompts -> English | 16 | Cao |
| 2 | Backend comments -> VI | 20 | Trung |
| 3 | Frontend UI -> VI | 10 | Cao |
| 4 | Frontend comments -> VI | 30+ | Trung |
| 5 | Desktop -> VI | 10 | Thap |
| 6 | Docs -> VI | 11 | Thap | **Hoan thanh** |
| 7 | Tests comments -> VI | 5 | Thap |

**Tong: ~100+ files | Da xong: 41 files (PR #3) | Con lai: ~60+**

---

*Cap nhat lan cuoi: 20/08/2026 -- dua tren commit b8ca495*
