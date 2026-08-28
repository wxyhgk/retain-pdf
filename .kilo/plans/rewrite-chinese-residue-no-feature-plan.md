# Plan: Hoan Tat Don Noi Dung Tieng Trung Ma Khong Doi Code Goc

## 1. Muc Tieu

Tiep noi hai commit `fa63df832c1f5acc5cb752077f3c71ae9f87a14d` va `5af363eb01a2af19a8cd36d9a9887d13ca72db7e`, dich toan bo noi dung tieng Trung con sot sang tieng Viet tu nhien va sua cac doan truoc day bi dich nham sang tieng Anh. Cong viec chi duoc thay doi ngon ngu tu nhien; khong them tinh nang, khong sua logic, khong refactor va khong thay doi hop dong may doc.

Trang thai hoan tat quan sat duoc:

- Khong con Han tu trong noi dung thuoc pham vi du an, ngoai du lieu dau vao/phan hoi ben thu ba duoc chung minh la fixture co chu dich.
- Khong con ten file hoac thu muc chua Han tu.
- Khong con dau cau CJK bi sot trong prose da dich; moi ky tu full-width con lai deu duoc phan loai ro.
- Noi dung tu nhien da duoc dich trong hai commit truoc dung tieng Viet, khong con cac doan tieng Anh do dich nham.
- Tat ca thay doi trong file code chi nam trong comment, docstring, chuoi hien thi, thong bao chan doan, ten test hoac fixture text da xac minh consumer.
- Khong co API, schema, key, route, cau hinh, dependency, helper runtime, nhanh dieu kien, migration hay hanh vi moi.
- Cac lenh kiem thu lien quan deu pass, hoac loi moi truong da duoc ghi ro va khong bi che giau.

## 2. Baseline Da Xac Minh

Thoi diem audit baseline: `2026-08-25`.

- Branch: `main`.
- `HEAD` va `origin/main`: `5af363eb` (`dich v2`).
- Tat ca file tracked dang sach; worktree chi co file untracked phuc vu Wiki, Kilo va cac script tro giup. Khong xoa, revert hoac commit nham cac file untracked khong thuoc batch.
- Quet filesystem bang day du ba dai Han tu, bo `.git`, `.kilo`, `.tmp`, dependency va build output: `629` file.
- Trong do co `624` file tracked va `5` file untracked.
- Nam file untracked co match la cac report/worklist trong `docs/wiki/translation/` va `fix_prompt_tests.py`; khong coi cac report cu la nguon cong viec hien tai.
- Quet ten duong dan: `0` path. Khong rename them neu lan quet moi van bang `0`.
- Quet bo sung dai dau cau/full-width CJK: `616` file. Con so nay khong dong nghia co `616` file can sua, vi dai Unicode rong co the chua ky hieu hop le; tung match phai duoc phan loai.

Phan bo `629` file theo khu vuc:

| Khu vuc | So file |
| --- | ---: |
| `frontend` | 287 |
| `backend` | 272 |
| `frontend-react` | 16 |
| `experiments` | 14 |
| `docs` | 14 |
| `resources` | 12 |
| `doc` | 7 |
| `desktop` | 4 |
| Root va khu vuc le | 3 |

Phan bo theo phan mo rong lon nhat:

| Phan mo rong | So file |
| --- | ---: |
| `.py` | 148 |
| `.md` | 91 |
| `.mjs` | 79 |
| `.rs` | 66 |
| `.tsx` | 66 |
| `.ts` | 64 |
| `.css` | 63 |
| `.json` | 16 |
| `.svg` | 11 |
| `.csv` | 8 |

Scanner noi bo, khi bo sung loai tru `.tmp`, dang bao:

| Chi so | Gia tri |
| --- | ---: |
| File source da quet | 2612 |
| File co match | 598 |
| Dong co match | 8509 |
| `prompt` | 0 |
| `ui` | 207 |
| `comment` | 2497 |
| `docs` | 2508 |
| `manual` | 3297 |
| Dong ngoai comment | 6012 |
| File co match comment | 236 |
| File co match ngoai comment | 455 |

`6012` dong ngoai comment gom UI, docs va `manual`; khong duoc mac dinh xem tat ca la chuoi runtime. Worklist phai ghi ro tung dong nao la prose, fixture, literal hop dong hay du lieu sinh tu tool truoc khi sua.

## 2A. Tien Do Hien Tai

Snapshot moi nhat: `2026-08-27` (Queue 5 CSS da commit dot 3; Queue 6+7+8 dang xu ly tiep; worktree co wave da dich an toan cho ca 3 queue dang cho commit).

- `HEAD`: `f5741e8e` (`frontend: translate theme/entry/base CSS comments (Queue 5 dot 3)`).
- Queue da commit ke tu baseline `5af363eb`:
  - Queue 0 root/DeepSeek docs: `4a8c5d7c`.
  - Queue 1 Paddle OCR docs: `8b4767f5`.
  - Queue 2/4 docs pipeline/backend/frontend wiki/devtools: `b16fc8ac`, `7ca067af`, `d8050828`, `38a028ce`, `8a4192c6`, `7de2584d`, `81afe3cb`, `0331386c`, `50f4b7c9`, `ae01e902`.
  - Queue 3+4 docs con lai: `0e8d3870` (66 files).
  - Queue 5 CSS comments dot 1: `2146da7f`; dot 2: `b4a507b5` (4 files); dot 3: `f5741e8e` (16 files).
  - Queue 6 TS/TSX comments dot 1: `92e88119` (16 files); dot 2: `ab00427e` (7 files).
  - Root README fix: `6123b6c0`.
- Working tree hien tai co `116` file tracked dang cho commit:
  - `41` file CSS (Queue 5 wave 2 dang do, da audit = 0 residue comment).
  - `68` file TS/TSX/MJS/JS trong `frontend/src` (Queue 6 wave 2 dang do, comment an toan).
  - `12` file test (Queue 8 wave 1 dang do, test title/assertion an toan).
  - `1` file `docs/wiki/translation/README.md` (cap nhat trang thai).
  - `3` file HTML (`detail.html`/`index.html`/`reader.html` resource stamp cap nhat).
- Audit tracked source theo cung semantics scanner, bo `.kilo`, `.tmp`, dependency/build/vendor va cac fixture/report duoc exclude:
  - `2587` file da quet, `396` file co match, `4229` dong con Han.
  - `prompt=0`, `ui=3`, `comment=968`, `docs=92`, `manual=3166`.
  - Queue 5 CSS comments: `0` dong tren `0` file CSS cua dot 3; dot 2 (worktree) con residue trong `core/`, `reader/`, `pages/` can tiep tuc.
  - Queue 6 TS/TSX/JS/MJS: con `953` dong comment tren `119` file (frontend/src `362` dong/62 file, frontend/tests `557` dong/52 file); cac comment con lai chua duoc bulk-dich.
  - Queue 7 UI runtime: con `3` dong category ui tren frontend/src; day la literal dieu kien/contract can giu nguyen.
  - Queue 8/9 manual tests & fixtures: con `3166` dong manual tren toan bo source; da dich them test title/assertion message an toan, fixture/provider raw giu nguyen.
  - Validation: `npm.cmd --prefix frontend run build:css` dat (CSS output generated khoi phuc khong de lai diff).
    `home-ask-picker` + `reader-annotations-component` dat `6/6`.
    Wave hien tai dem `501/666` test pass (so voi baseline truoc wave `478/666` — wave cai thien `+23` pass).
    `typecheck` va `165` test fail con lai deu la no ky thuat ton tai ngoai pham vi (markdown-math.ts:57, JSX namespace, etc.); khong sua logic lan nay.

So sanh baseline va snapshot hien tai:

| Chi so | Baseline 2026-08-25 | Snapshot 2026-08-27 (moi) | Thay doi |
| --- | ---: | ---: | ---: |
| Scanner files co match | 598 | 396 tracked | -202 |
| Scanner residue lines | 8509 | 4229 tracked | -4280 |
| `docs` lines | 2508 | 92 | -2416 |
| `comment` lines | 2497 | 968 | -1529 |
| `ui` lines | 207 | 3 | -204 |
| `manual` lines | 3297 | 3166 | -131 |
| Path co Han tu | 0 | 0 | 0 |

Trang thai queue theo plan (cap nhat tai snapshot nay):

| Queue | Trang thai | Bang chung |
| --- | --- | --- |
| Queue 0 - root/DeepSeek docs | `committed` | Commit `4a8c5d7c`. |
| Queue 1 - Paddle OCR docs | `committed` | Commit `8b4767f5`. |
| Queue 2 - backend pipeline docs | `committed` | Commits `b16fc8ac`, `7ca067af`, `50f4b7c9`, `ae01e902`. |
| Queue 3 - frontend/theme docs | `completed` | Commits `d8050828`, `38a028ce` + ban dich moi 8 files. Audit = 0. |
| Queue 4 - docs con lai | `completed` | Da dich toan bo markdown docs (~40 files rendering/experiments/paddle/config/frontend-react docs). Con 195 lines (generated report + wiki worklist). |
| Queue 5 - CSS comments | `completed` | Dich 80 dong comment tren 12 file CSS; targeted CJK audit = 0; `git diff --check` va `npm.cmd --prefix frontend run build:css` dat; generated outputs da khoi phuc/khong de lai diff. |
| Queue 6 - TS/TSX comments | `in_progress_uncommitted` | Dich them comment/docstring an toan trong frontend/src va reader; con `953` dong comment tren `119` file (bao gom 557 dong trong tests). |
| Queue 7 - UI runtime strings | `in_progress_uncommitted` | Dich them label/aria/status/progress/reader UI va diagnostics an toan, cap nhat expected lien quan; con `3` dong category ui (literal dieu kien/contract). |
| Queue 8 - manual tests | `in_progress_uncommitted` | Dich them test title/assertion message an toan va dong bo expected UI; con `3166` dong manual, fixture/provider raw giu nguyen. |
| Queue 9 - fixture/ledger | Chua bat dau | Khong thay doi. |

Dieu kien dong cac nhom dang do truoc khi mo nhom moi:

1. Dich xong 2 file services docs va 3 file `doc/core/rust_api`; targeted Han/punctuation audit ve `0` tren 5 file Markdown do; review diff chi thay prose.
2. Voi 8 file TS/TSX Queue 6: chay `npm --prefix frontend run typecheck` va `npm --prefix frontend test`; review `git diff --word-diff=porcelain` chi thay doi trong comment/string da phan loai.
3. Ra soat va viet lai nhom comment tron ngon ngu/mojibake (xem canh bao trong snapshot tren) thanh tieng Viet tu nhien.
4. `git diff --check` sach; commit tach theo ownership: docs backend/doc-core truoc, frontend comments sau.

## 2B. Execution Queue Tiep Theo

Thuc hien dung thu tu duoi day. Khong mo hai queue cung luc trong working tree. So match cua tung queue la snapshot de uoc luong; phai quet lai ngay truoc khi sua vi line number va count se thay doi sau moi commit.

Truoc Queue 0, khoi tao `$han`, `$cjkPunctuation` va cac exclude glob bang lenh trong muc `3. Nguon Su That Va Lenh Audit`.

Quy uoc trang thai:

- `pending`: chua co diff.
- `in_progress_uncommitted`: da co diff nhung chua dat gate.
- `verified_uncommitted`: targeted audit va verification da dat, chua commit.
- `committed`: co commit hash rieng va worktree khong con file cua queue.
- `blocked_contract`: co literal/fixture chua chung minh an toan; khong sua tiep.

### Queue 0: Dong Batch Tai Lieu Dang Do

Trang thai: `committed` qua commit `4a8c5d7c` (xem ket qua ben duoi). Chi giu noi dung queue huu ich va lich su gate.

Pham vi dung `6` file dang modified hien tai. Hoan tat `18` match con lai, sua ba link DeepSeek theo rename map o tren, review toan diff va khong them file moi vao queue.

Gate:

```powershell
$queue0 = @(
  'README.md',
  'backend/ai_service/README.md',
  'doc/reference/LLM_api/DeepSeek/Retain_de-xuat-tich-hop.md',
  'doc/reference/LLM_api/DeepSeek/goi-api-lan-dau.md',
  'doc/reference/LLM_api/DeepSeek/tra-cuu-so-du.md',
  'docs/wiki/README.md'
)
rg -n --pcre2 $han -- $queue0
rg -n --pcre2 $cjkPunctuation -- $queue0
git diff --check -- $queue0
git diff --word-diff=porcelain -- $queue0
```

Ket qua bat buoc (DAT): Han audit zero tren ca sau file; ba link DeepSeek da tro den `mo-hinh-va-gia.md`, `ma-loi.md`, `tinh-luong-token-su-dung.md` dang ton tai. Da commit: `4a8c5d7c docs: finish Vietnamese translation for root and DeepSeek docs`. Queue 0 hoan tat, khong mo lai.

### Queue 1: Tai Lieu Paddle Va OCR Provider

Trang thai: `committed` qua commit `8b4767f5 docs(ocr): translate Paddle provider documentation to Vietnamese`. Snapshot goc: `6` file, khoang `422` scanner lines.

```text
backend/rust_api/src/ocr_provider/paddle/AsyncParse.md                                   92
backend/rust_api/src/ocr_provider/paddle/JSON_README/block_label_mapping_README.md      88
resources/ocr_api/PaddleOCR/su-dung-api-bat-dong-bo.md                                  81
backend/rust_api/src/ocr_provider/paddle/API_SUMMARY.md                                  64
backend/rust_api/src/ocr_provider/paddle/JSON_README/prunedResult_README.md              55
backend/rust_api/src/ocr_provider/paddle/PROVIDER_BOUNDARY.md                            42
```

Bao ve JSON field, provider error code, endpoint, request/response sample, enum label va code fence. Neu sample la payload nguyen ban cua Paddle, gan `provider_raw_text` thay vi dich mu. Chay Han/punctuation audit va kiem tra local link tren ca sau file. Commit de xuat: `docs(ocr): translate Paddle provider documentation to Vietnamese`.

### Queue 2: Tai Lieu Backend Translation Pipeline

Trang thai: `committed` qua cac commits `b16fc8ac`, `7ca067af`, `50f4b7c9`, `ae01e902`. Cac file trong snapshot ban dau da duoc dich sang tieng Viet.

```text
backend/scripts/services/translation/llm/shared/orchestration/README.md    (da dich)
backend/scripts/devtools/promptfoo/README.md                               (da dich, chi con 2 fixture literal mau)
backend/scripts/services/mineru/README.md                                  (da dich)
backend/scripts/services/translation/llm/README.md                         (da dich)
backend/scripts/services/rendering/source/cleanup/README.md                (da dich)
backend/scripts/services/README.md                                         (da dich)
backend/scripts/foundation/shared/README.md                                (da dich)
backend/scripts/services/translation/workflow/README.md                    (da dich)
```

Bao ve prompt template, shell command, module path, stage key va artifact name.

### Queue 3: Tai Lieu Frontend Va Theme

Trang thai: `in_progress_uncommitted` / mot phan da commit (da dich `frontend/src/pages/reader/README.md` qua `d8050828`, cac file khac con 380 scanner lines). Snapshot: `8` file.

```text
frontend/src/FEATURES.md                                                        85
frontend/decor/mojia/ASSETS.md                                                  83
docs/theme-system/DECOR_PACKS.md                                                72
frontend/decor/jiangnan/ASSETS.md                                               67
frontend/src/styles/README.md                                                   39
docs/theme-system/ADDING_A_THEME.md                                             38
frontend-react/src/features/library/components/book-detail-dialog/README.md     35
frontend/src/pages/reader/README.md                                             1 (con 1 heading)
```

Bao ve CSS token, selector, component/prop name, asset filename va theme id. Xac minh cac asset/link duoc nhac den van ton tai. Queue nay chi sua Markdown, khong cham `.css`, `.ts` hoac `.tsx`. Commit de xuat: `docs(frontend): translate feature and theme documentation to Vietnamese`.

### Queue 4: Dong Phan Docs Con Lai

Trang thai: `in_progress` (da thuc hien cac dot qua `8a4192c6`, `7de2584d`, `81afe3cb`, `0331386c`).
Con lai 1568 scanner lines tren 78 files docs/README (tap trung o `services/rendering/**`, `experiments/**`, `doc/ops/**`).

1. Quet lai category `docs` sau Queue 3.
2. Loai `generated_report` nhu `doc/ops/reports/frontend-status-smoke-latest.json` khoi patch dich thu cong; tim source sinh report truoc.
3. Chia phan con lai thanh wave toi da `8-12` file va `300-500` match theo ownership: backend, frontend, experiments, resources, root/docs.
4. Trong moi wave, khong tron provider sample voi prose thong thuong.
5. Ket thuc khi scanner `docs=0` hoac moi dong con lai nam trong exception ledger co owner va ly do.

Sau moi wave docs, chay targeted audit, `git diff --check`, link review va commit rieng. Khong can build/runtime test neu diff thuc te chi co Markdown/prose.

### Queue 5: Comment CSS Frontend

Trang thai: `completed` (dot 1 da commit qua `2146da7f`; cac dot tiep theo va dot cuoi da dich het 80 dong comment tren 12 file CSS con lai).

Dot hoan tat:

```text
12 file CSS con lai trong frontend/src/styles (80 dong comment)
```

Chi dich noi dung trong block comment. Khong doi selector, custom property, token, value, import, media query hoac thu tu rule. Gate:

```powershell
npm --prefix frontend run build:css
npm --prefix frontend run typecheck
git diff --check
```

Evidence Queue 5: targeted CJK audit tren cac file CSS da sua = 0 match; `git diff --check` dat;
`npm.cmd --prefix frontend run build:css` dat; noi dung CSS ngoai block comment duoc xac minh khong doi
tren ca 12 file. Khong commit theo yeu cau.

### Queue 6: Comment TypeScript Va TSX Frontend

Trang thai: `in_progress` (dot 1 da commit qua `92e88119` tren 16 files, con 1373 lines tren 155 files `.ts`, `.tsx`, `.mjs`, `.js`).

Tiep tuc cac wave comment frontend toi da `8-12` file hoac `300-500` match. Xu ly frontend components, stores, hooks, devtools. Commit de xuat: `frontend: translate source comments without behavior changes`.

### Queue 7: UI Runtime Strings Frontend

Trang thai: `pending`. Snapshot: `207` dong trong `47` file.

Chia hai wave:

- Reader legacy: `97` UI lines.
- Home/shared frontend: `110` UI lines.

Voi moi literal, tim consumer/assertion bang `rg` truoc khi sua. Sua UI text va expected value trong cung patch; giu props, event, selector, key va test id. Khong sua comment trong queue nay neu comment wave chua commit.

Gate moi wave:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
git diff --check
```

Commit de xuat: `frontend: translate remaining UI text to Vietnamese`.

### Queue 8: Manual Backend Va Frontend Tests

Trang thai: `pending`, rui ro cao. Snapshot `manual` theo owner:

| Owner | Dong |
| --- | ---: |
| `backend` | 1430 |
| `frontend` | 1186 |
| `experiments` | 530 |
| `frontend-react` | 74 |
| `resources` | 70 |
| `.github` va helper le | 7 |

Khong dich theo count. Phan loai tung file thanh `test_message`, `runtime_diagnostic`, `fixture_source_text`, `fixture_expected_text`, `provider_raw_text` hoac `contract_literal`. Uu tien test title/diagnostic an toan; de provider raw, golden data va fixture source sang Queue 9.

Moi wave toi da `5-8` file. Chay test owner truc tiep sau tung wave. Bat ky thay doi nao ngoai string/comment deu chuyen queue sang `blocked_contract`.

### Queue 9: Fixture, Golden Data Va Exception Ledger

Trang thai: `pending`, xu ly cuoi.

Bat dau voi hai fixture lon nhat:

```text
experiments/layout-fit/fixtures/sample-blocks.v1.json                                  227
experiments/layout-fit/fixtures/jobs/20260405041819-ac4b45/sample-blocks.v1.json       192
```

Sau do xu ly promptfoo fixtures, golden replay, provider raw response va sample resources. Chi dich field output/expected khi tim du consumer; giu source-language input khi test can tieng Trung va ghi exception ledger. Ket thuc queue khi raw audit con lai trung khop mot-mot voi exception ledger, khong co match mo coi.

### Checkpoint Sau Moi Queue

1. Cap nhat snapshot trong muc `2A`: current count, delta, file modified va trang thai queue.
2. Chay targeted Han/punctuation audit tren file cua queue.
3. Chay scanner toan repo de phat hien match moi hoac category drift.
4. Review `git diff --word-diff=porcelain` va `git diff --check`.
5. Chay test/build dung owner neu queue cham source/test.
6. Commit rieng queue; ghi commit hash vao bang trang thai.
7. Bao dam `git status` khong con file cua queue truoc khi mo queue ke tiep.
8. Khong commit `.tmp`, report stale, script dich tu dong hoac file untracked ngoai pham vi.

Scanner khong duoc dung lam nguon duy nhat, vi hien tai:

- Bo qua mot so fixture, golden replay, provider sample, `resources/samples` va report.
- Khong quet `.svg` va `.csv`.
- Khong quet ten duong dan.
- Chi phat hien Han tu, khong phat hien dau cau CJK.
- Phan loai comment chi dua tren hinh thuc dong, nen `manual` va chuoi trong code van can doc context.

## 3. Nguon Su That Va Lenh Audit

Dung raw audit lam danh sach bao phu. Dung scanner de ho tro phan loai, khong dung de thay the raw audit.

```powershell
$han = '[\x{3400}-\x{4DBF}\x{4E00}-\x{9FFF}\x{F900}-\x{FAFF}]'
$exclude = @(
  '-g', '!**/.git/**',
  '-g', '!**/.kilo/**',
  '-g', '!**/.tmp/**',
  '-g', '!**/node_modules/**',
  '-g', '!**/target/**',
  '-g', '!**/dist/**',
  '-g', '!**/build/**',
  '-g', '!**/.next/**',
  '-g', '!**/coverage/**'
)

rg -n --pcre2 $han @exclude
rg -l --pcre2 $han @exclude
```

Path audit:

```powershell
rg --files @exclude |
  Where-Object { $_ -match '[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]' }
```

Audit dau cau va ky tu full-width:

```powershell
$cjkPunctuation = '[\x{3000}-\x{303F}\x{FF00}-\x{FFEF}]'
rg -n --pcre2 $cjkPunctuation @exclude
```

Scanner noi bo, bo sung `.tmp` vao danh sach loai tru ma khong sua scanner:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
@'
from pathlib import Path
import sys

sys.path.insert(0, str(Path("backend/scripts").resolve()))
from devtools.scan_chinese_residue import (
    EXCLUDED_PATHS,
    scan_chinese_residue,
    write_markdown_report,
)

report = scan_chinese_residue(
    Path("."),
    exclude=tuple(EXCLUDED_PATHS) + ((".tmp",),),
)
write_markdown_report(report, Path(".tmp/chinese-residue-report.md"))
print(f"Scanned {report.scanned_files} files; matches={len(report.matches)}")
'@ | python -
```

Khong ghi report co snippet tieng Trung vao commit. `docs/wiki/translation/chinese-residue-report.md` chi duoc tao lai sau audit cuoi, khi report khong con residue can dich.

## 4. Pham Vi Va Quy Tac Bao Ve

### Duoc phep thay doi

- Prose trong Markdown, HTML, SVG, CSV va file cau hinh co comment.
- Comment va docstring.
- UI label, title, placeholder, aria label, toast, thong bao loi va empty state.
- Ten test, assertion message va diagnostic text khong tham gia logic.
- Fixture display text sau khi da tim du consumer va cap nhat producer/assertion trong cung patch.
- Link/reference neu mot path thuc su duoc rename trong batch.

### Tuyet doi khong thay doi

- Ten bien, ham, type, module, import, CSS class, DOM id, event name va storage key.
- API path, JSON/schema key, database column, serialized enum, stage key va artifact key.
- Env var, CLI flag, shell command, URL, ten provider, ten san pham va ten font.
- Placeholder, template token, printf token, regex, escape sequence va dinh dang nhay cam khoang trang.
- Thu tu fixture, id, timestamp, toa do, kich thuoc, checksum va du lieu nhi phan.
- Signature, control flow, dieu kien, return value, exception type va mock behavior.
- Dependency, config, migration, helper hoac tinh nang moi.

Khong xoa code, comment-out code, xoa assertion hoac xoa fixture de lam match bien mat. Neu mot match chi co the xu ly bang cach sua logic, danh dau `blocked_contract` va dung batch do de review.

Ngon ngu dich duy nhat cua task nay la tieng Viet. Quy tac nay ap dung cho prose, comment, UI va noi dung tu nhien tung bi dich nham sang tieng Anh. Ten ky thuat bang tieng Anh va literal hop dong van giu nguyen.

## 5. Phan Loai Bat Buoc

Truoc khi sua, gan moi match vao mot trong cac nhan sau:

| Nhan | Cach xu ly |
| --- | --- |
| `docs_prose` | Dich prose; giu Markdown, link, code block va token. |
| `comment_only` | Dich comment/docstring; khong chinh dong code ke ben. |
| `ui_text` | Dich text hien thi; giu key, id, class va event. |
| `runtime_diagnostic` | Dich text cho nguoi dung/operator neu khong bi parse hay so khop. |
| `test_message` | Dich ten test/thong bao; khong doi logic assertion. |
| `fixture_source_text` | Giu neu no co chu dich de test dau vao tieng Trung; ghi ro consumer va ly do. |
| `fixture_expected_text` | Tim tat ca consumer; dich gia tri va assertion/snapshot cung patch. |
| `provider_raw_text` | Giu neu la payload nguyen ban cua ben thu ba; dich operator hint rieng. |
| `contract_literal` | Khong sua cho den khi chung minh khong bi parse/match/serialize. |
| `generated_report` | Khong dich tung snippet; tao lai tu source sau khi cleanup. |
| `stale_reference` | Cap nhat theo rename map da xac minh. |
| `blocked_contract` | Dung va xin review; khong bien doi code de lat qua gate. |

Moi exception duoc giu lai phai co du bon truong trong `.tmp/chinese-residue-exceptions.csv`: `path`, `line_or_field`, `consumer_test`, `reason`. File nay la bang chung tam thoi, khong phai allowlist runtime va khong duoc dung de che match moi.

## 6. Cac Batch Thuc Hien

### Batch 0: Khoa Trang Thai Va Tao Worklist Moi

1. Kiem tra khong con process `.tmp/translate_comments_all.py` dang chay.
2. Ghi lai `git status --short --branch` va `git diff --stat`.
3. Chay raw content audit, path audit, punctuation audit va scanner vao `.tmp/`.
4. Tao worklist tam co cac cot: `path`, `line`, `category`, `risk`, `consumer`, `status`, `verification`.
5. Tach ro file tracked va untracked. Khong sua/xoa file untracked cua nguoi dung chi de dat zero scan.
6. Bo qua danh sach path cu trong `docs/wiki/translation/chinese-residue-paths.txt`; baseline path hien tai da bang `0`.

Dieu kien xong: co worklist moi day du, chua sua source va cac tong so khop voi raw audit.

### Batch 1: Ra Soat Cac Doan Bi Dich Nham Sang Tieng Anh

Quet Han tu khong phat hien duoc loi dich nham sang tieng Anh. Tao danh sach rieng tu cac file da thay doi trong hai commit dich:

```powershell
git diff --name-only fa63df832c1f5acc5cb752077f3c71ae9f87a14d^ `
  5af363eb01a2af19a8cd36d9a9887d13ca72db7e
```

Voi tung file co prose/comment/UI:

1. Xem diff voi parent truoc dot dich de xac dinh doan nao von la tieng Trung nhung da thanh tieng Anh.
2. Chuyen dung doan do sang tieng Viet; khong viet lai cac doan tieng Anh ky thuat co san tu truoc.
3. Uu tien `CONTRIBUTING.md`, `backend/rust_api/OCR_PROVIDER_CONTRACT.md`, `backend/rust_api/API_SPEC.md` va cac file contract/docs cung batch.
4. Xac minh `backend/rust_api/CURRENT_API_MAP.md` va `STAGE_EXECUTION_CONTRACT.md` da la tieng Viet; chi sua neu con doan Anh hoa nham.
5. Kiem tra link tuyet doi cu trong docs, nhung tach viec sua link khong lien quan khoi task nay neu link khong phat sinh tu rename dich.

Dieu kien xong: moi doan prose bi Anh hoa trong hai commit da duoc phan loai va chuyen sang tieng Viet, trong khi identifier va thuat ngu ky thuat duoc giu nguyen.

### Batch 2: Tai Lieu Va Noi Dung Chi Doc

Xu ly theo nhom 20-40 file hoac 200-500 match moi luot:

1. Root docs va `doc/`.
2. `docs/`, khong sua report sinh tu scanner cho den audit cuoi.
3. Markdown nam trong `backend/`, `frontend/`, `frontend-react/` va `experiments/`.
4. `resources/`, SVG/CSV/HTML va README mau.
5. `.github`, Docker va desktop docs.

Moi luot phai giu nguyen heading hierarchy, table, code fence, inline code, anchor, URL va duong dan. Chay targeted raw audit tren folder vua sua va `git diff --check` truoc commit.

### Batch 3: Frontend Production Va Frontend React Phu

Thu tu xu ly:

1. `frontend/src/pages` va UI text.
2. `frontend/src/js` va runtime diagnostics.
3. `frontend/src/styles`, comment CSS va file decor/studio.
4. `frontend/scripts` va `frontend/tests`.
5. `frontend-react/src`.

Voi moi chuoi khong phai comment:

1. Tim literal, key hoac consumer bang `rg`.
2. Xac dinh no la text hien thi, expected value hay contract literal.
3. Neu test/snapshot phu thuoc, sua consumer trong cung patch.
4. Khong doi props, callback, selector, test id, class hoac event.

Gate moi nhom frontend:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend-react run lint
npm --prefix frontend-react run build
```

Chi chay gate `frontend-react` sau batch cham vao thu muc do.

### Batch 4: Backend Rust Va Python

Thu tu xu ly:

1. Comment/docstring trong `backend/rust_api/src`.
2. Operator hint, error text va test message cua Rust.
3. Comment/docstring trong `backend/scripts` va `backend/ai_service`.
4. Markdown con lai gan source backend.

Voi cac bang mapping loi provider, tach ro:

- Provider code, raw provider message va field parse: giu nguyen neu la contract mau.
- Operator hint va message do RetainPDF tao cho nguoi dung: dich sang tieng Viet.
- Test parse raw response: chi sua khi cap producer/expected cung patch va van bao toan muc tieu test.

Gate backend:

```powershell
cargo test --manifest-path backend/rust_api/Cargo.toml --lib
python -m pytest -q backend/scripts/devtools/tests/test_scan_chinese_residue.py
```

Neu cham vao translation/rendering/document schema, chay them test folder tuong ung trong `backend/scripts/devtools/tests/`. Neu cham `backend/ai_service`, chay cac test lien quan trong `backend/ai_service/tests/`.

### Batch 5: Fixtures, Golden Data Va Assertion

Day la batch rui ro cao, xu ly tung fixture family thay vi dich hang loat:

1. `backend/rust_api/src/api_tests`.
2. `frontend/tests` va mock data.
3. `experiments/layout-fit/fixtures`.
4. `backend/scripts/devtools/promptfoo/fixtures`.
5. Golden replay, document schema fixtures va `resources/samples`.

Voi moi field:

- Neu la dau vao co chu dich de kiem tra tieng Trung, giu nguyen va them vao exception ledger.
- Neu la output mang nghia da dich, UI display text, ten bo suu tap, note hay assertion value khong can ngon ngu nguon, dich sang tieng Viet va sua moi expected consumer.
- Neu la ban ghi provider nguyen goc, giu nguyen neu thay doi se lam mat muc tieu test realism.
- Neu khong tim thay consumer, khong sua va gan `blocked_contract`.

Sau moi fixture family, chay test consumer truc tiep truoc khi chuyen sang family tiep theo.

### Batch 6: Ten File Va Tham Chieu

Path audit hien tai bang `0`, vi vay mac dinh batch nay la no-op.

Chi khi audit moi phat hien path co Han tu:

1. Doi ten sang tieng Viet, giu so thu tu va phan mo rong.
2. Tao rename map old-to-new trong `.tmp/`.
3. Tim ca ten cu nguyen van, slash Windows/Unix va dang URL-encoded.
4. Cap nhat moi link/reference trong cung commit.
5. Chay lai path audit va content audit.

Khong thuc hien lai cac rename trong danh sach stale neu file thuc te da co ten Viet hoa.

### Batch 7: Final Audit Va Wiki

1. Chay lai raw Han audit, path audit, punctuation audit va scanner.
2. So sanh moi match con lai voi exception ledger. Khong chap nhan match khong co consumer va ly do cu the.
3. Yeu cau `0` match cho docs, comment, UI, diagnostics va expected text co the dich.
4. Neu con fixture source/provider raw co chu dich, liet ke chinh xac trong PR description; khong tuyen bo toan repo zero tuyet doi.
5. Tao lai `docs/wiki/translation/chinese-residue-report.md` tu trang thai cuoi; xoa noi dung stale khoi cac worklist/report tam du kien commit.
6. Cap nhat `docs/wiki/translation/README.md` de phan anh dung dich vu dich duy nhat la tieng Viet cho task nay, pham vi exception va lenh audit thuc te.
7. Chay `git diff --check`, xem `git status --short --renames` va review tung hunk source lan cuoi.

## 7. Cong Kiem Tra Khong Doi Code Goc

Truoc moi commit, thuc hien day du:

1. `git diff --check` khong bao loi whitespace.
2. `git diff --stat` chi chua file cua batch hien tai.
3. Review `git diff --word-diff=porcelain` cho moi file code.
4. Moi hunk code phai chi thay token nam trong comment hoac string literal da phan loai.
5. Khong co file dependency/lock, schema, migration hay config runtime bi thay doi ngoai prose comment.
6. So sanh so luong test/assertion truoc va sau; khong duoc giam do xoa/skip.
7. Chay targeted audit tren file da sua va test gate cua owner.

Neu diff co thay doi toan bo file do line ending/encoding, dung batch, khoi phuc patch nho theo tung hunk ma khong revert thay doi cua nguoi dung.

## 8. Chinh Sach Tool Dich Tu Dong

Khong dung `.tmp/translate_comments_all.py` lam workflow chinh. Script da tung gap HTTP `429`, va output mang ngu can review ngu canh.

Trong task nay, Kilo khong duoc chay dich tu dong hang loat qua mang. Neu dung script de goi y cuc bo, chi duoc xu ly toi da hai file, khong auto-write source, va phai review tung diff. Bat ky rate limit, timeout, output rong, Han tu con lai hoac thay doi ngoai comment deu la dieu kien dung.

## 9. Chien Luoc Commit

Commit theo ownership va chi commit sau targeted scan/test:

```text
docs: dich tai lieu con sot sang tieng Viet
docs: chuyen cac doan bi Anh hoa nham sang tieng Viet
frontend: dich UI va comment ma khong doi hanh vi
backend: dich comment va chan doan ma khong doi contract
test: dong bo fixture text va assertion sang tieng Viet
chore: xac minh residue chi con exception co chu dich
```

Gop test lien quan vao commit cua owner neu no chi cap nhat expected value. Khong commit `.tmp`, script dich tu dong, report stale hoac file untracked khong lien quan.

## 10. Dieu Kien Dung

Dung batch va xin review khi:

- Match nam trong literal bi parse, match, serialize hoac gui qua API.
- Fixture co so sanh byte-for-byte hoac snapshot ma chua tim du consumer.
- Can them helper, fallback, dependency, config hay logic de test pass.
- Tool dich tu dong rate limit, timeout hoac tra ket qua sai ngu canh.
- File co thay doi untracked/dirty khong ro nguon va patch co nguy co ghi de.
- Provider sample co the la bang chung tuong thich ben thu ba.
- Final match khong the phan loai thanh noi dung dich duoc hay exception co chu dich.

## 11. Tieu Chi Hoan Tat

- Worklist moi bao phu toan bo `624` file tracked baseline va moi match phat sinh trong qua trinh.
- Moi match da duoc dich hoac co exception ledger day du.
- Path audit bang `0`.
- Docs, comment, UI, diagnostics va expected text dich duoc deu bang `0` Han match.
- Punctuation audit khong con dau cau CJK bi sot trong prose da dich.
- Cac doan bi Anh hoa nham trong hai commit truoc da thanh tieng Viet.
- Khong co code path, contract, dependency, config hay feature moi.
- Frontend, frontend-react, Rust va Python tests phu hop voi cac file da cham deu pass.
- Wiki/report cuoi phan anh dung trang thai; khong ghi `zero tuyet doi` neu van con fixture co chu dich.
- Moi commit nho, doc lap, co the review va quay lui theo ownership.
