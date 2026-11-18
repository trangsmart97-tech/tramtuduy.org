-- Sửa cảnh báo của công cụ rà soát Supabase (18/11/2026)
-- 1. Đưa các hàm kiểm tra quyền sang lược đồ nội bộ "noi_bo" (không mở ra API).
-- 2. Tách luật "for all" thành ba luật insert, update, delete để không chồng luật select.

create schema if not exists noi_bo;
grant usage on schema noi_bo to anon, authenticated;

alter function public.toi_email() set schema noi_bo;
alter function public.la_nhan_su() set schema noi_bo;
alter function public.la_quan_tri() set schema noi_bo;
alter function public.co_vai(text) set schema noi_bo;
alter function public.la_hs_mau(uuid) set schema noi_bo;
alter function public.la_phu_huynh_cua(uuid) set schema noi_bo;
alter function public.xem_duoc_hs(uuid) set schema noi_bo;
alter function public.hs_cua_bai(uuid) set schema noi_bo;
alter function public.ghi_nhat_ky() set schema noi_bo;

alter function noi_bo.toi_email() set search_path = '';
create or replace function noi_bo.toi_email() returns text
language sql stable set search_path = '' as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

-- Các hàm khác gọi toi_email() theo tên public: viết lại để trỏ noi_bo
create or replace function noi_bo.la_nhan_su() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nhan_su where email = noi_bo.toi_email())
$$;
create or replace function noi_bo.la_quan_tri() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nhan_su where email = noi_bo.toi_email() and quan_tri)
$$;
create or replace function noi_bo.co_vai(v text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nhan_su where email = noi_bo.toi_email() and (vai = v or quan_tri))
$$;
create or replace function noi_bo.la_hs_mau(hs uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select la_mau from public.hoc_sinh where id = hs), false)
$$;
create or replace function noi_bo.la_phu_huynh_cua(hs uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gia_dinh where hoc_sinh_id = hs and email = noi_bo.toi_email())
$$;
create or replace function noi_bo.xem_duoc_hs(hs uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select noi_bo.la_hs_mau(hs) or noi_bo.la_nhan_su() or noi_bo.la_phu_huynh_cua(hs)
$$;
create or replace function noi_bo.hs_cua_bai(b uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select hoc_sinh_id from public.bai_lam where id = b
$$;
create or replace function noi_bo.ghi_nhat_ky() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.nhat_ky (bang, ban_ghi_id, hanh_dong, nguoi, cu, moi)
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'), (to_jsonb(new)->>'email'), (to_jsonb(old)->>'email')),
    tg_op,
    nullif(noi_bo.toi_email(), ''),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

revoke all on function noi_bo.ghi_nhat_ky() from public, anon, authenticated;
grant execute on function noi_bo.toi_email(), noi_bo.la_nhan_su(), noi_bo.la_quan_tri(), noi_bo.co_vai(text),
  noi_bo.la_hs_mau(uuid), noi_bo.la_phu_huynh_cua(uuid), noi_bo.xem_duoc_hs(uuid), noi_bo.hs_cua_bai(uuid) to anon, authenticated;

-- Tách luật sửa: (bảng, tên luật cũ, biểu thức quyền)
do $$
declare
  r record;
begin
  for r in select * from (values
    ('nhom_lop','sua_nhom_lop','noi_bo.la_quan_tri()'),
    ('ky_nang','sua_ky_nang','noi_bo.la_quan_tri()'),
    ('chu_de','sua_chu_de','noi_bo.la_quan_tri()'),
    ('nhan_su','sua_nhan_su','noi_bo.la_quan_tri()'),
    ('hoc_sinh','sua_hoc_sinh','noi_bo.co_vai(''giao_vu'')'),
    ('gia_dinh','sua_gia_dinh','noi_bo.co_vai(''giao_vu'')'),
    ('bai_lam','sua_bai_lam','noi_bo.co_vai(''cham_bai'')'),
    ('cau_tra_loi','sua_cau','noi_bo.co_vai(''cham_bai'')'),
    ('cham_tay','sua_cham_tay','noi_bo.co_vai(''cham_bai'')'),
    ('chuyen_can','sua_chuyen_can','noi_bo.co_vai(''giao_vu'')'),
    ('ghi_chu_coach','sua_coach','noi_bo.co_vai(''coach'')'),
    ('bao_cao_tuan','sua_bao_cao','noi_bo.co_vai(''giang_day'')')
  ) as t(bang, cu, quyen)
  loop
    execute format('drop policy if exists %I on public.%I', r.cu, r.bang);
    execute format('create policy %I on public.%I for insert with check (%s)', 'them_' || r.bang, r.bang, r.quyen);
    execute format('create policy %I on public.%I for update using (%s) with check (%s)', 'sua_' || r.bang, r.bang, r.quyen, r.quyen);
    execute format('create policy %I on public.%I for delete using (%s)', 'xoa_' || r.bang, r.bang, r.quyen);
  end loop;
end $$;
