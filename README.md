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
