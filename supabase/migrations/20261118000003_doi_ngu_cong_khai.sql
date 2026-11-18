-- Tách thông tin công khai của đội ngũ khỏi email (18/11/2026)
-- Trước đây bảng nhan_su ai cũng đọc được, nên email của các cô có thể bị lấy qua API.
-- Từ bản này:
--   doi_ngu : tên gọi, vai, mô tả. Ai cũng đọc được (trang chủ).
--   nhan_su : email và quyền. Chỉ các cô đọc được; mỗi người đọc được dòng của mình.
-- Email thật của các cô KHÔNG nằm trong kho mã công khai; chúng được ghi thẳng vào cơ sở dữ liệu.

create table if not exists public.doi_ngu (
  vai text primary key check (vai in ('giang_day','giao_vu','cham_bai','coach')),
  ten_goi text not null,
  mo_ta_vai text,
  thu_tu int default 0
);
alter table public.doi_ngu enable row level security;
create policy doc_doi_ngu on public.doi_ngu for select using (true);
create policy them_doi_ngu on public.doi_ngu for insert with check (noi_bo.la_quan_tri());
create policy sua_doi_ngu on public.doi_ngu for update using (noi_bo.la_quan_tri()) with check (noi_bo.la_quan_tri());
create policy xoa_doi_ngu on public.doi_ngu for delete using (noi_bo.la_quan_tri());

insert into public.doi_ngu (vai, ten_goi, mo_ta_vai, thu_tu)
select vai, ho_ten, mo_ta_vai, thu_tu from public.nhan_su
on conflict (vai) do update set ten_goi = excluded.ten_goi, mo_ta_vai = excluded.mo_ta_vai, thu_tu = excluded.thu_tu;

alter table public.nhan_su add column if not exists ten_day_du text;

drop policy if exists doc_nhan_su on public.nhan_su;
create policy doc_nhan_su on public.nhan_su for select using (noi_bo.la_nhan_su() or email = noi_bo.toi_email());
