-- Lược đồ cổng Trạm Tư Duy, bản 1 (18/11/2026)
-- Nguyên tắc:
--   1. Bốn cô xem toàn bộ dữ liệu. Mỗi loại dữ liệu có một cô làm chủ, cô quản trị sửa được tất cả.
--   2. Phụ huynh chỉ xem dữ liệu của con mình.
--   3. Học sinh mẫu (la_mau = true) ai cũng xem được, để trình diễn.
--   4. Mọi lần thêm, sửa, xoá được ghi vào bảng nhat_ky.
-- Danh tính lấy từ thư điện tử đã đăng nhập (auth.jwt()->>'email').

create extension if not exists pgcrypto;

-- ===== Danh mục =====
create table public.nhom_lop (
  ma text primary key,
  ten text not null,
  mo_ta text
);

create table public.ky_nang (
  ma text primary key,
  ten text not null,
  loi_cho_tre text
);

create table public.chu_de (
  ma text primary key,
  ten_tre text not null,
  nhom_mon text not null,
  tuan int,
  ten_day_du text,
  bloom text,
  ky_nang_chinh text references public.ky_nang(ma),
  y_tuong_lon text,
  nhom_lop text not null default 'lop5' references public.nhom_lop(ma)
);

-- ===== Con người =====
create table public.nhan_su (
  email text primary key check (email = lower(email)),
  ho_ten text not null,
  vai text not null check (vai in ('giang_day','giao_vu','cham_bai','coach')),
  mo_ta_vai text,
  quan_tri boolean not null default false,
  thu_tu int default 0
);

create table public.hoc_sinh (
  id uuid primary key default gen_random_uuid(),
  ma_hs text unique not null,
  ho_ten text not null,
  ten_goi text,
  nhom_lop text not null references public.nhom_lop(ma),
  dich_diem int not null default 85,
  la_mau boolean not null default false,
  dang_hoc boolean not null default true,
  tao_luc timestamptz not null default now()
);

create table public.gia_dinh (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  hoc_sinh_id uuid not null references public.hoc_sinh(id) on delete cascade,
  quan_he text,
  unique (email, hoc_sinh_id)
);

-- ===== Bài làm và kết quả =====
create table public.bai_lam (
  id uuid primary key default gen_random_uuid(),
  hoc_sinh_id uuid not null references public.hoc_sinh(id) on delete cascade,
  loai text not null check (loai in ('dau_vao','moc','thuc_chien','de','tang3','nghe','lab','bai_viet','loi_giai','de_giay')),
  ma_bai text not null,
  ten_bai text,
  ngay date not null,
  tuan int,
  -- 1: có giám sát trên lớp; 2: Tầng 3 trên web; 3: cô chấm theo barem; 4: con tự đánh giá
  do_tin_cay smallint not null check (do_tin_cay between 1 and 4),
  diem numeric,
  diem_toi_da numeric,
  thoi_gian_phut numeric,
  ghi_chu text,
  tao_luc timestamptz not null default now()
);
create index on public.bai_lam (hoc_sinh_id, ngay);

create table public.cau_tra_loi (
  id uuid primary key default gen_random_uuid(),
  bai_lam_id uuid not null references public.bai_lam(id) on delete cascade,
  ma_cau text not null,
  nhom_mon text not null,
  ma_chu_de text references public.chu_de(ma),
  ma_ky_nang text references public.ky_nang(ma),
  bloom text check (bloom in ('Nhớ','Hiểu','Vận dụng','Phân tích','Đánh giá','Sáng tạo')),
  dung boolean,
  diem numeric,
  diem_toi_da numeric,
  loai_loi text check (loai_loi in ('kien_thuc','hieu_sai_de','tinh_sai','het_gio')),
  giay numeric
);
create index on public.cau_tra_loi (bai_lam_id);

-- Cô Nguyên làm chủ: chấm theo barem, ghi điểm hỏng
create table public.cham_tay (
  id uuid primary key default gen_random_uuid(),
  bai_lam_id uuid not null references public.bai_lam(id) on delete cascade,
  ma_cau text not null,
  tieu_chi text not null,
  muc text,
  diem numeric,
  diem_toi_da numeric,
  nhan_xet text,
  diem_hong text,
  nguoi_cham text,
  luc timestamptz not null default now()
);
create index on public.cham_tay (bai_lam_id);

-- Cô Ngọc làm chủ: chuyên cần và tương tác trong lớp
create table public.chuyen_can (
  id uuid primary key default gen_random_uuid(),
  hoc_sinh_id uuid not null references public.hoc_sinh(id) on delete cascade,
  ngay date not null,
  buoi text,
  co_mat boolean not null default true,
  tuong_tac smallint check (tuong_tac between 1 and 3),
  ghi_chu text,
  nguoi_ghi text
);
create index on public.chuyen_can (hoc_sinh_id, ngay);

-- Cô Yori làm chủ: ghi chú coach
create table public.ghi_chu_coach (
  id uuid primary key default gen_random_uuid(),
  hoc_sinh_id uuid not null references public.hoc_sinh(id) on delete cascade,
  ngay date not null,
  van_de text not null,
  ke_hoach text,
  chia_se_phu_huynh boolean not null default false,
  nguoi_ghi text
);

-- Cô Trang làm chủ: báo cáo tuần gửi phụ huynh
create table public.bao_cao_tuan (
  id uuid primary key default gen_random_uuid(),
  hoc_sinh_id uuid not null references public.hoc_sinh(id) on delete cascade,
  tuan int not null,
  tu_ngay date,
  den_ngay date,
  noi_dung jsonb not null default '{}'::jsonb,
  trang_thai text not null default 'nhap' check (trang_thai in ('nhap','da_duyet','da_gui')),
  duyet_boi text,
  duyet_luc timestamptz,
  unique (hoc_sinh_id, tuan)
);

-- Mọi cô được bình luận lên dữ liệu của cô khác, không ghi đè
create table public.binh_luan (
  id uuid primary key default gen_random_uuid(),
  bang text not null,
  ban_ghi_id uuid not null,
  noi_dung text not null,
  nguoi_viet text not null,
  luc timestamptz not null default now()
);

create table public.nhat_ky (
  id bigserial primary key,
  bang text not null,
  ban_ghi_id text,
  hanh_dong text not null,
  nguoi text,
  luc timestamptz not null default now(),
  cu jsonb,
  moi jsonb
);

-- ===== Hàm danh tính =====
create or replace function public.toi_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.la_nhan_su() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nhan_su where email = public.toi_email())
$$;

create or replace function public.la_quan_tri() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nhan_su where email = public.toi_email() and quan_tri)
$$;

create or replace function public.co_vai(v text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nhan_su where email = public.toi_email() and (vai = v or quan_tri))
$$;

create or replace function public.la_hs_mau(hs uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select la_mau from public.hoc_sinh where id = hs), false)
$$;

create or replace function public.la_phu_huynh_cua(hs uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gia_dinh where hoc_sinh_id = hs and email = public.toi_email())
$$;

create or replace function public.xem_duoc_hs(hs uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.la_hs_mau(hs) or public.la_nhan_su() or public.la_phu_huynh_cua(hs)
$$;

create or replace function public.hs_cua_bai(b uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select hoc_sinh_id from public.bai_lam where id = b
$$;

-- ===== Nhật ký tự động =====
create or replace function public.ghi_nhat_ky() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.nhat_ky (bang, ban_ghi_id, hanh_dong, nguoi, cu, moi)
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'), (to_jsonb(new)->>'email'), (to_jsonb(old)->>'email')),
    tg_op,
    nullif(public.toi_email(), ''),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['nhan_su','hoc_sinh','gia_dinh','bai_lam','cau_tra_loi','cham_tay','chuyen_can','ghi_chu_coach','bao_cao_tuan']
  loop
    execute format('create trigger nhat_ky_%1$s after insert or update or delete on public.%1$s for each row execute function public.ghi_nhat_ky()', t);
  end loop;
end $$;

-- ===== Phân quyền theo hàng =====
alter table public.nhom_lop enable row level security;
alter table public.ky_nang enable row level security;
alter table public.chu_de enable row level security;
alter table public.nhan_su enable row level security;
alter table public.hoc_sinh enable row level security;
alter table public.gia_dinh enable row level security;
alter table public.bai_lam enable row level security;
alter table public.cau_tra_loi enable row level security;
alter table public.cham_tay enable row level security;
alter table public.chuyen_can enable row level security;
alter table public.ghi_chu_coach enable row level security;
alter table public.bao_cao_tuan enable row level security;
alter table public.binh_luan enable row level security;
alter table public.nhat_ky enable row level security;

-- Danh mục: ai cũng đọc được; cô quản trị sửa
create policy doc_nhom_lop on public.nhom_lop for select using (true);
create policy doc_ky_nang on public.ky_nang for select using (true);
create policy doc_chu_de on public.chu_de for select using (true);
create policy sua_nhom_lop on public.nhom_lop for all using (public.la_quan_tri()) with check (public.la_quan_tri());
create policy sua_ky_nang on public.ky_nang for all using (public.la_quan_tri()) with check (public.la_quan_tri());
create policy sua_chu_de on public.chu_de for all using (public.la_quan_tri()) with check (public.la_quan_tri());

-- Nhân sự: ai cũng đọc tên và vai (trang giới thiệu đội ngũ); cô quản trị sửa
create policy doc_nhan_su on public.nhan_su for select using (true);
create policy sua_nhan_su on public.nhan_su for all using (public.la_quan_tri()) with check (public.la_quan_tri());

-- Học sinh và gia đình: cô Ngọc (giáo vụ) quản lý danh sách lớp
create policy doc_hoc_sinh on public.hoc_sinh for select using (public.xem_duoc_hs(id));
create policy sua_hoc_sinh on public.hoc_sinh for all using (public.co_vai('giao_vu')) with check (public.co_vai('giao_vu'));
create policy doc_gia_dinh on public.gia_dinh for select using (public.la_nhan_su() or email = public.toi_email());
create policy sua_gia_dinh on public.gia_dinh for all using (public.co_vai('giao_vu')) with check (public.co_vai('giao_vu'));

-- Bài làm, câu trả lời: hệ thống chấm và cô Nguyên ghi
create policy doc_bai_lam on public.bai_lam for select using (public.xem_duoc_hs(hoc_sinh_id));
create policy sua_bai_lam on public.bai_lam for all using (public.co_vai('cham_bai')) with check (public.co_vai('cham_bai'));
create policy doc_cau on public.cau_tra_loi for select using (public.xem_duoc_hs(public.hs_cua_bai(bai_lam_id)));
create policy sua_cau on public.cau_tra_loi for all using (public.co_vai('cham_bai')) with check (public.co_vai('cham_bai'));

-- Chấm tay: cô Nguyên
create policy doc_cham_tay on public.cham_tay for select using (public.xem_duoc_hs(public.hs_cua_bai(bai_lam_id)));
create policy sua_cham_tay on public.cham_tay for all using (public.co_vai('cham_bai')) with check (public.co_vai('cham_bai'));

-- Chuyên cần: cô Ngọc
create policy doc_chuyen_can on public.chuyen_can for select using (public.xem_duoc_hs(hoc_sinh_id));
create policy sua_chuyen_can on public.chuyen_can for all using (public.co_vai('giao_vu')) with check (public.co_vai('giao_vu'));

-- Ghi chú coach: cô Yori. Phụ huynh chỉ thấy ghi chú được đánh dấu chia sẻ.
create policy doc_coach on public.ghi_chu_coach for select using (
  public.la_hs_mau(hoc_sinh_id) or public.la_nhan_su()
  or (chia_se_phu_huynh and public.la_phu_huynh_cua(hoc_sinh_id))
);
create policy sua_coach on public.ghi_chu_coach for all using (public.co_vai('coach')) with check (public.co_vai('coach'));

-- Báo cáo tuần: cô Trang. Phụ huynh chỉ thấy báo cáo đã duyệt.
create policy doc_bao_cao on public.bao_cao_tuan for select using (
  public.la_hs_mau(hoc_sinh_id) or public.la_nhan_su()
  or (trang_thai in ('da_duyet','da_gui') and public.la_phu_huynh_cua(hoc_sinh_id))
);
create policy sua_bao_cao on public.bao_cao_tuan for all using (public.co_vai('giang_day')) with check (public.co_vai('giang_day'));

-- Bình luận: mọi cô viết dưới tên mình; mọi cô đọc
create policy doc_binh_luan on public.binh_luan for select using (public.la_nhan_su());
create policy viet_binh_luan on public.binh_luan for insert with check (public.la_nhan_su() and nguoi_viet = public.toi_email());

-- Nhật ký: mọi cô đọc; không ai sửa tay
create policy doc_nhat_ky on public.nhat_ky for select using (public.la_nhan_su());
