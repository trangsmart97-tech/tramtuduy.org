-- Luyện nghe vào hồ sơ học sinh (QĐ-032, 23/11/2026).
-- Nguyên tắc:
--   1. Trang luyennghe.tramtuduy.org chỉ giữ phần công khai của bài (bản ghi, câu hỏi, phương án). Đáp án, lời giải và
--      bản chép lời nằm ở bảng dap_an_nghe; trang chỉ nhận về sau khi nộp bài.
--   2. Học sinh dùng đúng mã riêng của luyện đề (bảng ma_thi) trong đường dẫn cá nhân. Không có mã thì vẫn luyện được
--      (ln_cham), nhưng kết quả không vào hồ sơ.
--   3. Mỗi lần nộp là một dòng bai_lam (loai 'nghe', độ tin cậy 2) và mỗi câu một dòng cau_tra_loi đủ bốn nhãn,
--      chấm bằng đúng hàm noi_bo.ld_cham của luyện đề.

-- noi_dung: { tieuDe, tuan, banChepLoi, cau: { id: {loai 'dien'|'chon', diem, nhom, chuDe, kyNang, bloom,
--             dapAn (dien) | dung (chon), toiDaTu, giaiThich, meo, kyNangNghe, doan} } }
create table public.dap_an_nghe (
  ma_bai text primary key check (ma_bai ~ '^[a-z0-9-]+$'),
  noi_dung jsonb not null,
  tao_luc timestamptz not null default now()
);
alter table public.dap_an_nghe enable row level security;
create policy doc_dap_an_nghe on public.dap_an_nghe for select using (noi_bo.la_nhan_su());
create policy them_dap_an_nghe on public.dap_an_nghe for insert with check (noi_bo.co_vai('cham_bai'));
create policy sua_dap_an_nghe on public.dap_an_nghe for update using (noi_bo.co_vai('cham_bai')) with check (noi_bo.co_vai('cham_bai'));
create policy xoa_dap_an_nghe on public.dap_an_nghe for delete using (noi_bo.co_vai('cham_bai'));
create trigger nhat_ky_dap_an_nghe after insert or update or delete on public.dap_an_nghe
  for each row execute function noi_bo.ghi_nhat_ky();

-- Kiểm một tệp đáp án bài nghe trước khi đăng: dùng lại ld_kiem_de (bốn nhãn, điểm, đáp án) và thêm luật riêng.
create function noi_bo.ln_kiem_bai(p_da jsonb) returns setof text
language sql stable security definer set search_path = '' as $$
  select l from noi_bo.ld_kiem_de(
    jsonb_build_object('phan', jsonb_build_array(jsonb_build_object('ten', 'Bài nghe', 'phut', 1, 'muc',
      coalesce((select jsonb_agg(jsonb_build_object('id', key, 'loai', value->>'loai')) from jsonb_each(coalesce(p_da->'cau', '{}'::jsonb))), '[]'::jsonb)))),
    p_da) l
  union all
  select 'Bài nghe chưa có câu nào.' where coalesce(p_da->'cau', '{}'::jsonb) = '{}'::jsonb
  union all
  select 'Bài nghe thiếu bản chép lời.' where coalesce(btrim(p_da->>'banChepLoi'), '') = ''
  union all
  select 'Bài nghe thiếu tiêu đề.' where coalesce(btrim(p_da->>'tieuDe'), '') = ''
  union all
  select 'Câu ' || key || ': bài nghe chỉ có câu điền hoặc câu chọn.' from jsonb_each(coalesce(p_da->'cau', '{}'::jsonb))
  where value->>'loai' not in ('dien', 'chon')
  union all
  select 'Câu ' || key || ': câu điền của bài nghe phải ghi "toiDaTu": 4.' from jsonb_each(coalesce(p_da->'cau', '{}'::jsonb))
  where value->>'loai' = 'dien' and coalesce(value->>'toiDaTu', '') <> '4'
  union all
  select 'Câu ' || key || ': nhóm môn của bài nghe là Tiếng Anh.' from jsonb_each(coalesce(p_da->'cau', '{}'::jsonb))
  where coalesce(value->>'nhom', '') <> 'Tiếng Anh'
$$;

-- Phần trả về sau khi nộp: điểm, từng câu (đáp án, mọi cách viết được nhận, lời giải, đoạn bản ghi), bản chép lời.
create function noi_bo.ln_tra_ve(p_da jsonb, p_kq jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('diem', p_kq->'diemMay', 'toiDa', p_kq->'toiDaMay', 'banChepLoi', p_da->'banChepLoi',
    'chiTiet', coalesce((select jsonb_object_agg(key, (p_kq->'chiTiet'->key) || jsonb_build_object(
        'chapNhan', case when value->>'loai' = 'dien' then noi_bo.ld_mang(value->'dapAn') end,
        'kyNangNghe', coalesce(value->>'kyNangNghe', ''), 'doan', value->'doan'))
      from jsonb_each(p_da->'cau')), '{}'::jsonb))
$$;

create function noi_bo.ln_dap_an(p_bai text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare da jsonb;
begin
  select noi_dung into da from public.dap_an_nghe where ma_bai = p_bai;
  if da is null then raise exception 'Chưa có bài nghe “%”. Bạn báo cô giúp nhé.', p_bai; end if;
  return da;
end $$;

-- Trang nghe mở bằng đường dẫn riêng: chào đúng tên, báo các bài đã làm (số lần, điểm cao nhất).
create function public.ln_vao(p_ma text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  return jsonb_build_object('ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten),
    'daLam', coalesce((select jsonb_object_agg(ma_bai, jsonb_build_object('lan', n, 'diemCao', cao, 'toiDa', toi_da))
      from (select ma_bai, count(*)::int n, max(diem) cao, max(diem_toi_da) toi_da from public.bai_lam
            where hoc_sinh_id = hs.id and loai = 'nghe' group by ma_bai) t), '{}'::jsonb));
end $$;

-- Không có mã riêng: chấm để luyện, không ghi gì.
create function public.ln_cham(p_bai text, p_tra_loi jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare da jsonb;
begin
  if length(coalesce(p_tra_loi, '{}'::jsonb)::text) > 5000 then raise exception 'Bài làm dài quá mức cho phép.'; end if;
  da := noi_bo.ln_dap_an(p_bai);
  return noi_bo.ln_tra_ve(da, noi_bo.ld_cham(da, coalesce(p_tra_loi, '{}'::jsonb))) || jsonb_build_object('vaoHoSo', false);
end $$;

-- Có mã riêng: chấm và ghi vào hồ sơ. Mỗi bài nộp tối đa 10 lần trong 24 giờ.
create function public.ln_nop(p_ma text, p_bai text, p_tra_loi jsonb, p_lan_nghe int default 0) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare hs public.hoc_sinh; da jsonb; kq jsonb; bai uuid; lan int; nay timestamptz := now(); r record;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  if length(coalesce(p_tra_loi, '{}'::jsonb)::text) > 5000 then raise exception 'Bài làm dài quá mức cho phép. Bạn báo cô nhé.'; end if;
  da := noi_bo.ln_dap_an(p_bai);
  perform pg_advisory_xact_lock(hashtext(hs.id::text || p_bai));  -- hai lần bấm nộp cùng lúc không đếm sai số lần
  if (select count(*) from public.bai_lam where hoc_sinh_id = hs.id and loai = 'nghe' and ma_bai = p_bai
      and tao_luc > nay - interval '24 hours') >= 10 then
    raise exception 'Bạn đã nộp bài này 10 lần trong hôm nay. Ngày mai bạn làm lại nhé.';
  end if;
  select count(*) + 1 into lan from public.bai_lam where hoc_sinh_id = hs.id and loai = 'nghe' and ma_bai = p_bai;
  kq := noi_bo.ld_cham(da, coalesce(p_tra_loi, '{}'::jsonb));

  insert into public.bai_lam (hoc_sinh_id, loai, ma_bai, ten_bai, ngay, tuan, do_tin_cay, diem, diem_toi_da, ghi_chu)
  values (hs.id, 'nghe', p_bai, (da->>'tieuDe') || ' (lần ' || lan || ')', (nay at time zone 'Asia/Ho_Chi_Minh')::date,
    nullif(da->>'tuan', '')::int, 2, (kq->>'diemMay')::numeric, (kq->>'toiDaMay')::numeric,
    'Nghe ' || greatest(coalesce(p_lan_nghe, 0), 0) || ' lần trước khi nộp.')
  returning id into bai;

  for r in select key, value from jsonb_each(da->'cau') loop
    insert into public.cau_tra_loi (bai_lam_id, ma_cau, nhom_mon, ma_chu_de, ma_ky_nang, bloom, dung, diem, diem_toi_da)
    values (bai, r.key, coalesce(nullif(r.value->>'nhom', ''), 'Khác'),
      (select c.ma from public.chu_de c where c.ma = r.value->>'chuDe'),
      (select k.ma from public.ky_nang k where k.ma = r.value->>'kyNang'),
      case when r.value->>'bloom' in ('Nhớ','Hiểu','Vận dụng','Phân tích','Đánh giá','Sáng tạo') then r.value->>'bloom' end,
      (kq->'chiTiet'->r.key->>'dung')::boolean,
      (kq->'chiTiet'->r.key->>'diem')::numeric,
      coalesce((r.value->>'diem')::numeric, 0));
  end loop;

  return noi_bo.ln_tra_ve(da, kq) || jsonb_build_object('vaoHoSo', true, 'lan', lan,
    'ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten));
end $$;

revoke execute on function noi_bo.ln_kiem_bai(jsonb), noi_bo.ln_tra_ve(jsonb, jsonb), noi_bo.ln_dap_an(text)
  from public, anon, authenticated;
revoke execute on function public.ln_vao(text), public.ln_cham(text, jsonb), public.ln_nop(text, text, jsonb, int) from public;
grant execute on function public.ln_vao(text), public.ln_cham(text, jsonb), public.ln_nop(text, text, jsonb, int)
  to anon, authenticated;
