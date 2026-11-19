# Cổng Trạm Tư Duy · tramtuduy.org

Cổng chung của Trạm Tư Duy: giới thiệu trạm, hồ sơ học tập của học sinh, báo cáo tuần cho phụ huynh, và bàn làm việc của bốn cô.

## Gồm những gì

| Phần | Ở đâu |
| --- | --- |
| Giao diện (React, TypeScript, Vite) | `web/` |
| Lược đồ cơ sở dữ liệu và luật phân quyền | `supabase/migrations/` |
| Dữ liệu danh mục và học sinh mẫu | `supabase/seed/`, sinh bằng `cong-cu/tao_du_lieu_mau.py` từ khung chương trình v2 |
| Đăng trang tự động | `.github/workflows/dang-trang.yml` |

Dữ liệu nằm ở Supabase, dự án `tramtuduy`, vùng Singapore. Trang dùng khóa công khai. Quyền thật được khoá ở cơ sở dữ liệu:
- Bốn cô xem toàn bộ dữ liệu.
- Mỗi loại dữ liệu có một cô làm chủ, cô quản trị sửa được tất cả.
- Phụ huynh chỉ xem dữ liệu của con mình.
- Học sinh mẫu ai cũng xem được.
- Mọi lần sửa được ghi vào bảng `nhat_ky`.

## Chạy trên máy

```bash
cd web
npm install
npm run dev
```

Mở http://localhost:5173.

## Đổi dữ liệu mẫu

```bash
python cong-cu/tao_du_lieu_mau.py "../KHUNG CHƯƠNG TRÌNH 18 TUẦN v2.xlsx" supabase/seed
supabase db query --remote=pqildzyhzpudfkjinhyx -f supabase/seed/02_hoc_sinh_mau.sql
```

Không đưa dữ liệu học sinh thật vào kho này.

## Luyện đề (luyende.tramtuduy.org)

Kho kín của trang thi luyende nằm ở Supabase này (QĐ-011, 19/11/2026). Lược đồ: `supabase/migrations/20261120000001_luyen_de.sql`.
- Mỗi con vào thi bằng đường dẫn riêng `https://luyende.tramtuduy.org/thi.html?de=<mã đề>&ma=<mã riêng>`, không mật khẩu.
- Đề, đáp án, lượt thi chỉ các cô đọc được. Trang thi chỉ gọi các hàm `ld_*`; trang của cô gọi các hàm `ld_co_*`.
- Nộp bài thì máy chấm và ghi vào `bai_lam`, `cau_tra_loi` (đủ bốn nhãn); câu cô chấm vào `cham_tay`. Điểm cô chấm tự cộng vào bài làm.
- Trang của cô: Bàn làm việc của cô → Luyện đề (`#/nhan-su/luyen-de`): lượt thi, chấm câu tự luận, đường dẫn riêng.

Công cụ ở `cong-cu/luyen-de/` (cài một lần: `npm install` trong thư mục đó):

```bash
# Thử lược đồ và hàm chấm trên Postgres cục bộ, không cần Docker
node cong-cu/luyen-de/thu.mjs "$PWD" "$(dirname "$PWD")"
```

```bash
# Đưa một đề đã duyệt từ "08 CHỜ ĐĂNG WEB/" lên: kiểm đề, viết tệp SQL vào supabase/.temp/ (không vào git), in lệnh đăng
node cong-cu/luyen-de/dang_de.mjs --de "../08 CHỜ ĐĂNG WEB/de-dau-vao.json" --mo 2026-12-09T19:45+07:00 --dong 2026-12-09T21:15+07:00 --ma-phong 1234
```

Quy ước tệp đề cho người soạn: ghi chú `web-quy-uoc-tep-de.md` trong thư mục ghi chú chung của các session. Không đưa tệp đề thật hay tệp đáp án thật vào kho này.
