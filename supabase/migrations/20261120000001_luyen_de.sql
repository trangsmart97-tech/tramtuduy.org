-- Luyện đề trên Supabase (19/11/2026; tiền tố 20261120 của tên tệp chỉ là số thứ tự)
-- Thay kho kín Google Apps Script của luyende.tramtuduy.org. Cô Trang chọn hướng này ngày 19/11/2026.
-- Nguyên tắc:
--   1. Học sinh không đăng nhập. Mỗi con có một mã riêng khó đoán (bảng ma_thi), nằm trong đường dẫn cá nhân.
--   2. Trang thi chỉ gọi các hàm ld_* dưới đây. Qua API, chỉ các cô đọc được đề, đáp án, lượt thi.
--   3. Đáp án nằm ở bảng riêng dap_an_de. Phụ huynh và khách không có luật đọc nào.
--   4. Nộp bài thì máy chấm và ghi thẳng vào bai_lam, cau_tra_loi (đủ bốn nhãn), cham_tay (câu cô chấm).

-- ===== Bảng =====
create table public.ma_thi (
  hoc_sinh_id uuid primary key references public.hoc_sinh(id) on delete cascade,
  ma text unique not null default replace(gen_random_uuid()::text, '-', '') check (length(ma) >= 24),
  tao_luc timestamptz not null default now()
);

create table public.de_thi (
  ma text primary key check (ma ~ '^[a-z0-9-]+$'),
  tieu_de text not null,
  loai text not null check (loai in ('dau_vao','moc','thuc_chien','de','tang3')),
  do_tin_cay smallint not null default 1 check (do_tin_cay between 1 and 4),
  tuan int,
  mo timestamptz not null,
  dong timestamptz not null check (dong > mo),
  ma_phong text,
  noi_dung jsonb not null,
  tao_luc timestamptz not null default now()
);

create table public.dap_an_de (
  ma_de text primary key references public.de_thi(ma) on delete cascade,
  noi_dung jsonb not null
);

-- Hình và bản ghi của đề; chỉ phát cho lượt thi đã bắt đầu.
create table public.tep_de (
  ma_de text not null references public.de_thi(ma) on delete cascade,
  ten text not null,
  loai text not null,
  du_lieu bytea not null,
  primary key (ma_de, ten)
);

create table public.luot_thi (
  id uuid primary key default gen_random_uuid(),
  hoc_sinh_id uuid not null references public.hoc_sinh(id) on delete cascade,
  ma_de text not null references public.de_thi(ma) on delete cascade,
  bat_dau timestamptz not null default now(),
  phan int not null default 0,
  bat_dau_phan timestamptz not null default now(),
  tra_loi jsonb not null default '{}'::jsonb,
  su_kien jsonb not null default '[]'::jsonb,
  nop timestamptz,
  nop_muon boolean,
  bai_lam_id uuid references public.bai_lam(id) on delete set null,
  unique (hoc_sinh_id, ma_de)
);

-- Ảnh bài làm trên giấy con nộp cho câu tự luận.
create table public.anh_nop (
  id uuid primary key default gen_random_uuid(),
  luot_thi_id uuid not null references public.luot_thi(id) on delete cascade,
  ma_cau text not null,
  du_lieu bytea not null,
  luc timestamptz not null default now()
);
create index on public.anh_nop (luot_thi_id);

-- ===== Phân quyền: chỉ các cô đọc; cô Ngọc giữ mã của học sinh; cô Nguyên giữ đề và lượt thi =====
alter table public.ma_thi enable row level security;
alter table public.de_thi enable row level security;
alter table public.dap_an_de enable row level security;
alter table public.tep_de enable row level security;
alter table public.luot_thi enable row level security;
alter table public.anh_nop enable row level security;

do $$
declare r record;
begin
  for r in select * from (values
    ('ma_thi',    'noi_bo.co_vai(''giao_vu'')'),
    ('de_thi',    'noi_bo.co_vai(''cham_bai'')'),
    ('dap_an_de', 'noi_bo.co_vai(''cham_bai'')'),
    ('tep_de',    'noi_bo.co_vai(''cham_bai'')'),
    ('luot_thi',  'noi_bo.co_vai(''cham_bai'')'),
    ('anh_nop',   'noi_bo.co_vai(''cham_bai'')')
  ) as t(bang, quyen)
  loop
    execute format('create policy %I on public.%I for select using (noi_bo.la_nhan_su())', 'doc_' || r.bang, r.bang);
    execute format('create policy %I on public.%I for insert with check (%s)', 'them_' || r.bang, r.bang, r.quyen);
    execute format('create policy %I on public.%I for update using (%s) with check (%s)', 'sua_' || r.bang, r.bang, r.quyen, r.quyen);
    execute format('create policy %I on public.%I for delete using (%s)', 'xoa_' || r.bang, r.bang, r.quyen);
  end loop;
end $$;

-- Nhật ký cho mã, đề, đáp án. Không ghi lượt thi vì trang lưu bài 45 giây một lần.
do $$
declare t text;
begin
  foreach t in array array['ma_thi','de_thi','dap_an_de']
  loop
    execute format('create trigger nhat_ky_%1$s after insert or update or delete on public.%1$s for each row execute function noi_bo.ghi_nhat_ky()', t);
  end loop;
end $$;

-- ===== Chấm bài (hàm thuần, chép từ chamBai của kho kín Google) =====
-- Chuẩn hoá câu trả lời: chữ thường, nháy cong thành nháy thẳng, bỏ dấu câu, ngoặc kép, ngoặc đơn và khoảng trắng ở hai đầu,
-- gộp khoảng trắng; số thập phân viết dấu phẩy hay dấu chấm đều như nhau (7,5 và 7.5).
create function noi_bo.ld_chuan(s text) returns text
language sql immutable set search_path = '' as $$
  select case when x ~ '^-?[0-9]+,[0-9]+$' then replace(x, ',', '.') else x end
  from (select regexp_replace(
                 regexp_replace(translate(lower(coalesce(s, '')), '‘’', ''''''),
                                '^[[:space:].,;:!?"''“”()]+|[[:space:].,;:!?"''“”()]+$', '', 'g'),
                 '[[:space:]]+', ' ', 'g') as x) t
$$;

create function noi_bo.ld_dem_tu(s text) returns int
language sql immutable set search_path = '' as $$
  select case when noi_bo.ld_chuan(s) = '' then 0
              else array_length(string_to_array(noi_bo.ld_chuan(s), ' '), 1) end
$$;

create function noi_bo.ld_mang(x jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case jsonb_typeof(x) when 'array' then x when 'string' then jsonb_build_array(x)
              when 'number' then jsonb_build_array(x #>> '{}') else '[]'::jsonb end
$$;

create function noi_bo.ld_khop(tra text, ds jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select noi_bo.ld_chuan(tra) <> '' and exists (
    select 1 from jsonb_array_elements_text(noi_bo.ld_mang(ds)) d
    where noi_bo.ld_chuan(d) = noi_bo.ld_chuan(tra))
$$;

-- Câu dựng câu: chuẩn hoá thêm dấu câu giữa câu. Dấu phẩy, chấm phẩy, hai chấm, chấm than, chấm hỏi,
-- ngoặc kép và dấu chấm (trừ dấu chấm trong số) đều coi như khoảng trắng: “Look! The girls…” = “Look, the girls…” = “Look the girls…”.
create function noi_bo.ld_chuan_cau(s text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
           regexp_replace(noi_bo.ld_chuan(s), '[,;:!?"“”]|(?<![0-9])\.|\.(?![0-9])', ' ', 'g'),
           ' +', ' ', 'g'))
$$;

create function noi_bo.ld_khop_cau(tra text, ds jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select noi_bo.ld_chuan_cau(tra) <> '' and exists (
    select 1 from jsonb_array_elements_text(noi_bo.ld_mang(ds)) d
    where noi_bo.ld_chuan_cau(d) = noi_bo.ld_chuan_cau(tra))
$$;

-- dap_an: { cau: { id: {loai, diem, nhom, chuDe, kyNang, bloom, dung | dapAn | chapNhan, toiDaTu, giaiThich} } }
-- tra_loi: { id: giá trị }
-- Trả về đúng dạng của chamBai: diemMay, toiDaMay, toiDaCoCham, theoNhom, chiTiet, choCham.
create function noi_bo.ld_cham(p_dap_an jsonb, p_tra_loi jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  r record; k jsonb; tra text; nhom text; dung boolean; diem numeric; g jsonb;
  diem_may numeric := 0; toi_da_may numeric := 0; toi_da_co numeric := 0;
  theo_nhom jsonb := '{}'::jsonb; chi_tiet jsonb := '{}'::jsonb; cho_cham jsonb := '[]'::jsonb;
begin
  for r in select key, value from jsonb_each(coalesce(p_dap_an->'cau', '{}'::jsonb)) loop
    k := r.value;
    tra := coalesce(p_tra_loi, '{}'::jsonb)->>r.key;
    nhom := coalesce(nullif(k->>'nhom', ''), 'Khác');
    diem := coalesce((k->>'diem')::numeric, 0);
    g := coalesce(theo_nhom->nhom, '{"diem":0,"toiDa":0,"choCham":0}'::jsonb);
    dung := null;

    if k->>'loai' = 'chon' then
      dung := case when tra ~ '^[0-9]+$' then tra::numeric = (k->>'dung')::numeric else false end;
    elsif k->>'loai' = 'dien' then
      -- Câu điền: khớp danh sách thì đúng. Không khớp: sai, trừ khi đáp án ghi "coChamTay": true
      -- và con có viết, khi ấy chuyển cho cô chấm.
      dung := case when coalesce((k->>'toiDaTu')::int, 0) > 0 and noi_bo.ld_dem_tu(tra) > (k->>'toiDaTu')::int then false
                   else noi_bo.ld_khop(tra, k->'dapAn') end;
      if not dung and noi_bo.ld_chuan(tra) <> '' and k->'coChamTay' = 'true'::jsonb then dung := null; end if;
    elsif k->>'loai' = 'viet' then
      -- Câu dựng câu: khớp một câu được chấp nhận thì máy cho điểm; bỏ trống thì sai; còn lại chuyển cho cô,
      -- trừ khi đáp án ghi "coChamTay": false (bài luyện ở nhà không có cô chấm), khi ấy là sai.
      if noi_bo.ld_khop_cau(tra, k->'chapNhan') then dung := true;
      elsif noi_bo.ld_chuan(tra) = '' or k->'coChamTay' = 'false'::jsonb then dung := false; end if;
    end if;

    if dung is null then
      cho_cham := cho_cham || to_jsonb(r.key);
      toi_da_co := toi_da_co + diem;
      g := jsonb_set(g, '{choCham}', to_jsonb((g->>'choCham')::numeric + diem));
      chi_tiet := chi_tiet || jsonb_build_object(r.key, jsonb_build_object('choCham', true, 'toiDa', diem));
    else
      toi_da_may := toi_da_may + diem;
      g := jsonb_set(g, '{toiDa}', to_jsonb((g->>'toiDa')::numeric + diem));
      if dung then
        diem_may := diem_may + diem;
        g := jsonb_set(g, '{diem}', to_jsonb((g->>'diem')::numeric + diem));
      end if;
      chi_tiet := chi_tiet || jsonb_build_object(r.key, jsonb_build_object(
        'dung', dung, 'diem', case when dung then diem else 0 end, 'toiDa', diem,
        'dapAn', case when k->>'loai' = 'chon' then k->'dung'
                      else noi_bo.ld_mang(coalesce(k->'dapAn', k->'chapNhan'))->0 end,
        'giaiThich', coalesce(k->>'giaiThich', ''), 'meo', coalesce(k->>'meo', '')));
    end if;
    theo_nhom := theo_nhom || jsonb_build_object(nhom, g);
  end loop;

  return jsonb_build_object('diemMay', diem_may, 'toiDaMay', toi_da_may, 'toiDaCoCham', toi_da_co,
    'theoNhom', theo_nhom, 'chiTiet', chi_tiet, 'choCham', cho_cham);
end $$;

-- ===== Hàm nội bộ dùng chung cho các hàm của trang thi =====
create function noi_bo.ld_ms(t timestamptz) returns bigint
language sql immutable set search_path = '' as $$ select (extract(epoch from t) * 1000)::bigint $$;

create function noi_bo.ld_hoc_sinh(p_ma text) returns public.hoc_sinh
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh;
begin
  select h.* into hs from public.ma_thi m join public.hoc_sinh h on h.id = m.hoc_sinh_id
  where m.ma = p_ma and h.dang_hoc;
  if not found then
    raise exception 'Đường dẫn chưa đúng. Con xin cô đường dẫn riêng của con nhé.';
  end if;
  return hs;
end $$;

create function noi_bo.ld_luot(p_ma text, p_de text) returns public.luot_thi
language plpgsql volatile security definer set search_path = '' as $$
declare hs public.hoc_sinh; l public.luot_thi;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de for update;
  if not found then raise exception 'Không tìm thấy lượt thi. Con tải lại trang giúp cô.'; end if;
  return l;
end $$;

create function noi_bo.ld_anh_cua(p_luot uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(ma_cau, ds), '{}'::jsonb)
  from (select ma_cau, jsonb_agg(jsonb_build_object('id', id) order by luc) ds
        from public.anh_nop where luot_thi_id = p_luot group by ma_cau) t
$$;

-- Đề gửi kèm kết quả sau giờ thi: bỏ mọi khối bài đọc ("doan"), vì bài đọc có thể là tác phẩm chưa có quyền đăng
-- (ví dụ bài thơ “Trên gác xép” của đề đầu vào). Màn hình kết quả chỉ cần câu hỏi và phương án.
create function noi_bo.ld_de_khong_doan(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ma', p->'ma', 'tieuDe', p->'tieuDe', 'xaoPhuongAn', coalesce(p->'xaoPhuongAn', 'false'::jsonb),
    'phan', coalesce((select jsonb_agg(jsonb_build_object('ten', ph->'ten',
        'muc', coalesce((select jsonb_agg(m order by j) from jsonb_array_elements(ph->'muc') with ordinality u(m, j) where m->>'loai' <> 'doan'), '[]'::jsonb))
      order by i) from jsonb_array_elements(p->'phan') with ordinality t(ph, i)), '[]'::jsonb))
$$;

-- ===== Các hàm trang thi gọi (mở cho khách) =====

-- Màn hình vào phòng thi: chào đúng tên con, báo giờ mở và đóng. Chưa phát đề.
create function public.ld_vao(p_ma text, p_de text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; de public.de_thi; l public.luot_thi;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”. Con xin cô đường dẫn đúng nhé.', p_de; end if;
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de;
  return jsonb_build_object('ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten), 'hoTen', hs.ho_ten,
    'tieuDe', de.tieu_de, 'mo', noi_bo.ld_ms(de.mo), 'dong', noi_bo.ld_ms(de.dong), 'nay', noi_bo.ld_ms(now()),
    'coMaPhong', coalesce(de.ma_phong, '') <> '', 'daBatDau', l.id is not null, 'daNop', l.nop is not null);
end $$;

create function public.ld_bat_dau(p_ma text, p_de text, p_ma_phong text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare hs public.hoc_sinh; de public.de_thi; l public.luot_thi; nay timestamptz := now();
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”. Con xin cô đường dẫn đúng nhé.', p_de; end if;
  if coalesce(de.ma_phong, '') <> '' and trim(coalesce(p_ma_phong, '')) <> trim(de.ma_phong) then
    raise exception 'Mã phòng thi chưa đúng. Con nghe lại cô đọc mã nhé.';
  end if;
  if nay < de.mo then
    raise exception 'Chưa đến giờ thi. Đề mở lúc %.', to_char(de.mo at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI "ngày" DD/MM');
  end if;

  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de for update;
  if found and l.nop is not null then raise exception 'Con đã nộp bài của đề này rồi.'; end if;
  -- Quá giờ đóng 2 phút mà lượt chưa nộp: máy nộp bài với phần đã lưu, trả kết quả, không phát lại đề.
  if found and nay > de.dong + interval '2 minutes' then
    return public.ld_nop(p_ma, p_de, l.tra_loi, l.su_kien) || jsonb_build_object('hetGio', true);
  end if;
  if not found then
    -- Lượt đã bắt đầu thì vẫn vào lại được trong 2 phút sau giờ đóng để trang tự nộp; lượt mới thì không.
    if nay > de.dong then raise exception 'Đã hết giờ thi của đề này.'; end if;
    insert into public.luot_thi (hoc_sinh_id, ma_de, bat_dau, bat_dau_phan) values (hs.id, p_de, nay, nay)
    on conflict (hoc_sinh_id, ma_de) do nothing;
    select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de for update;
    if l.nop is not null then raise exception 'Con đã nộp bài của đề này rồi.'; end if;
  end if;

  return jsonb_build_object('ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten), 'de', de.noi_dung,
    'batDau', noi_bo.ld_ms(l.bat_dau), 'nay', noi_bo.ld_ms(nay), 'dong', noi_bo.ld_ms(de.dong),
    'phan', l.phan, 'batDauPhan', noi_bo.ld_ms(l.bat_dau_phan), 'traLoi', l.tra_loi,
    'anh', noi_bo.ld_anh_cua(l.id), 'tiepTuc', l.bat_dau < nay);
end $$;

create function public.ld_luu(p_ma text, p_de text, p_tra_loi jsonb, p_su_kien jsonb default '[]'::jsonb, p_phan int default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then return jsonb_build_object('daNop', true); end if;
  if pg_column_size(p_tra_loi) + pg_column_size(p_su_kien) > 500000 then
    raise exception 'Bài làm dài quá mức cho phép. Con báo cô ngay nhé.';
  end if;
  update public.luot_thi set
    tra_loi = coalesce(p_tra_loi, '{}'::jsonb),
    su_kien = coalesce(p_su_kien, '[]'::jsonb),
    phan = greatest(phan, coalesce(p_phan, phan)),
    bat_dau_phan = case when coalesce(p_phan, phan) > phan then now() else bat_dau_phan end
  where id = l.id;
  return jsonb_build_object('ok', true, 'nay', noi_bo.ld_ms(now()));
end $$;

create function public.ld_tep(p_ma text, p_de text, p_ten text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; t public.tep_de;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  if not exists (select 1 from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de) then
    raise exception 'Không tìm thấy lượt thi. Con tải lại trang giúp cô.';
  end if;
  select * into t from public.tep_de where ma_de = p_de and ten = p_ten;
  if not found then raise exception 'Thiếu tệp %.', p_ten; end if;
  return jsonb_build_object('loai', t.loai, 'duLieu', translate(encode(t.du_lieu, 'base64'), E'\n', ''));
end $$;

create function public.ld_tai_anh(p_ma text, p_de text, p_cau text, p_du_lieu text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi; b bytea; moi uuid;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then raise exception 'Con đã nộp bài, không gửi thêm ảnh được.'; end if;
  if (select count(*) from public.anh_nop where luot_thi_id = l.id) >= 40 then
    raise exception 'Con đã gửi đủ số ảnh cho phép. Con báo cô nhé.';
  end if;
  b := decode(regexp_replace(coalesce(p_du_lieu, ''), '^data:image/[a-z]+;base64,', ''), 'base64');
  if length(b) = 0 or length(b) > 3000000 then raise exception 'Ảnh chưa đúng hoặc quá lớn. Con chụp lại nhé.'; end if;
  insert into public.anh_nop (luot_thi_id, ma_cau, du_lieu) values (l.id, p_cau, b) returning id into moi;
  return jsonb_build_object('id', moi);
end $$;

-- Điểm máy chấm trả ngay. Đáp án từng câu chỉ mở khi cả lớp đã hết giờ.
create function public.ld_ket_qua(p_ma text, p_de text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; l public.luot_thi; de public.de_thi; kq jsonb;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de;
  if not found or l.nop is null then raise exception 'Con chưa nộp bài.'; end if;
  select * into de from public.de_thi where ma = p_de;
  kq := noi_bo.ld_cham((select noi_dung from public.dap_an_de where ma_de = p_de), l.tra_loi);
  return jsonb_build_object('daNop', true, 'ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten),
    'diemMay', kq->'diemMay', 'toiDaMay', kq->'toiDaMay', 'toiDaCoCham', kq->'toiDaCoCham',
    'theoNhom', kq->'theoNhom', 'soCauChoCham', jsonb_array_length(kq->'choCham'),
    'moChiTiet', noi_bo.ld_ms(de.dong),
    'chiTiet', case when now() >= de.dong then kq->'chiTiet' else null end,
    'de', case when now() >= de.dong then noi_bo.ld_de_khong_doan(de.noi_dung) else null end);
end $$;

create function public.ld_nop(p_ma text, p_de text, p_tra_loi jsonb, p_su_kien jsonb default '[]'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.luot_thi; de public.de_thi; da jsonb; kq jsonb; bai uuid; nay timestamptz := now();
  tong_phut numeric; muon boolean; r record;
begin
  l := noi_bo.ld_luot(p_ma, p_de);  -- khoá dòng: hai lần bấm nộp cùng lúc chỉ ghi một lần
  if l.nop is not null then return public.ld_ket_qua(p_ma, p_de); end if;
  select * into de from public.de_thi where ma = p_de;
  select noi_dung into da from public.dap_an_de where ma_de = p_de;
  if da is null then raise exception 'Đề chưa có đáp án. Con báo cô ngay nhé.'; end if;

  select coalesce(sum((p->>'phut')::numeric), 0) into tong_phut from jsonb_array_elements(de.noi_dung->'phan') p;
  -- Đề có phần mở theo giờ chung ("moLuc") thì thời gian chờ không tính vào tổng phút, nên chỉ xét giờ đóng.
  muon := nay > de.dong + interval '2 minutes'
       or (not jsonb_path_exists(de.noi_dung, '$.phan[*].moLuc')
           and nay > l.bat_dau + make_interval(secs => ((tong_phut + 2) * 60)::double precision));
  kq := noi_bo.ld_cham(da, coalesce(p_tra_loi, '{}'::jsonb));

  insert into public.bai_lam (hoc_sinh_id, loai, ma_bai, ten_bai, ngay, tuan, do_tin_cay, diem, diem_toi_da, thoi_gian_phut, ghi_chu)
  values (l.hoc_sinh_id, de.loai, de.ma, de.tieu_de, (nay at time zone 'Asia/Ho_Chi_Minh')::date, de.tuan, de.do_tin_cay,
    (kq->>'diemMay')::numeric, (kq->>'toiDaMay')::numeric + (kq->>'toiDaCoCham')::numeric,
    round((extract(epoch from nay - l.bat_dau) / 60)::numeric, 1),
    concat_ws(' ',
      case when jsonb_array_length(kq->'choCham') > 0
           then 'Điểm mới gồm phần máy chấm; còn ' || jsonb_array_length(kq->'choCham') || ' câu cô chấm.' end,
      case when muon then 'Nộp sau giờ quy định.' end))
  returning id into bai;

  -- Mỗi câu một dòng, đủ bốn nhãn. Mã không có trong danh mục thì để trống thay vì làm hỏng lần nộp.
  for r in select key, value from jsonb_each(da->'cau') loop
    insert into public.cau_tra_loi (bai_lam_id, ma_cau, nhom_mon, ma_chu_de, ma_ky_nang, bloom, dung, diem, diem_toi_da)
    values (bai, r.key, coalesce(nullif(r.value->>'nhom', ''), 'Khác'),
      (select c.ma from public.chu_de c where c.ma = r.value->>'chuDe'),
      (select k.ma from public.ky_nang k where k.ma = r.value->>'kyNang'),
      case when r.value->>'bloom' in ('Nhớ','Hiểu','Vận dụng','Phân tích','Đánh giá','Sáng tạo') then r.value->>'bloom' end,
      (kq->'chiTiet'->r.key->>'dung')::boolean,
      (kq->'chiTiet'->r.key->>'diem')::numeric,
      coalesce((r.value->>'diem')::numeric, 0));
    if (kq->'chiTiet'->r.key->>'choCham')::boolean then
      insert into public.cham_tay (bai_lam_id, ma_cau, tieu_chi, diem_toi_da)
      values (bai, r.key, 'Cả câu (chưa chấm)', coalesce((r.value->>'diem')::numeric, 0));
    end if;
  end loop;

  update public.luot_thi set nop = nay, nop_muon = muon, bai_lam_id = bai,
    tra_loi = coalesce(p_tra_loi, '{}'::jsonb), su_kien = coalesce(p_su_kien, '[]'::jsonb)
  where id = l.id;
  return public.ld_ket_qua(p_ma, p_de);
end $$;

-- ===== Kiểm tra một đề trước khi đăng (công cụ đưa đề gọi) =====
-- Trả về danh sách lỗi; rỗng là đạt.
create function noi_bo.ld_kiem_de(p_de jsonb, p_dap_an jsonb) returns setof text
language sql stable security definer set search_path = '' as $$
  with cau_de as (
    select m->>'id' id, m->>'loai' loai from jsonb_array_elements(p_de->'phan') p, jsonb_array_elements(p->'muc') m
    where m->>'loai' <> 'doan'
  ), cau_da as (select key id, value v from jsonb_each(p_dap_an->'cau'))
  select 'Câu ' || d.id || ' có trong đề nhưng thiếu đáp án.' from cau_de d where not exists (select 1 from cau_da a where a.id = d.id)
  union all
  select 'Câu ' || a.id || ' có đáp án nhưng không có trong đề.' from cau_da a where not exists (select 1 from cau_de d where d.id = a.id)
  union all
  select 'Câu ' || a.id || ': loại câu trong đề và trong đáp án khác nhau.' from cau_da a join cau_de d using (id) where d.loai <> a.v->>'loai'
  union all
  select 'Câu ' || id || ': nhóm môn “' || coalesce(v->>'nhom', '') || '” không thuộc năm nhóm.' from cau_da
  where coalesce(v->>'nhom', '') not in ('Toán','Tiếng Anh','Tiếng Việt','Khoa học','Lịch sử và Địa lý')
  union all
  select 'Câu ' || id || ': mã chủ đề “' || coalesce(v->>'chuDe', '') || '” không có trong danh mục.' from cau_da
  where not exists (select 1 from public.chu_de c where c.ma = v->>'chuDe')
  union all
  select 'Câu ' || id || ': mã kỹ năng “' || coalesce(v->>'kyNang', '') || '” không có trong danh mục.' from cau_da
  where not exists (select 1 from public.ky_nang k where k.ma = v->>'kyNang')
  union all
  select 'Câu ' || id || ': bậc Bloom “' || coalesce(v->>'bloom', '') || '” không hợp lệ.' from cau_da
  where coalesce(v->>'bloom', '') not in ('Nhớ','Hiểu','Vận dụng','Phân tích','Đánh giá','Sáng tạo')
  union all
  select 'Câu ' || id || ': thiếu điểm.' from cau_da where coalesce(v->>'diem', '') !~ '^[0-9]+(\.[0-9]+)?$'
  union all
  select 'Câu ' || id || ': câu chọn thiếu “dung”.' from cau_da where v->>'loai' = 'chon' and coalesce(v->>'dung', '') !~ '^[0-9]+$'
  union all
  select 'Câu ' || id || ': câu điền thiếu “dapAn”.' from cau_da where v->>'loai' = 'dien' and jsonb_array_length(noi_bo.ld_mang(v->'dapAn')) = 0
  union all
  select 'Câu ' || id || ': câu dựng câu thiếu “chapNhan”.' from cau_da where v->>'loai' = 'viet' and jsonb_array_length(noi_bo.ld_mang(v->'chapNhan')) = 0
  union all
  -- Đề xáo phương án: lời giải không được gọi phương án bằng chữ cái, vì chữ cái mỗi con thấy một khác.
  select 'Câu ' || id || ': đề xáo phương án nhưng lời giải hoặc mẹo gọi phương án bằng chữ cái (“Đáp án C”, “A. 234: …”). Gọi bằng nội dung phương án, hoặc ghi "giuThuTu": true cho câu này.'
  from cau_da a
  where p_de->'xaoPhuongAn' = 'true'::jsonb and v->>'loai' = 'chon'
    and not exists (select 1 from jsonb_array_elements(p_de->'phan') p, jsonb_array_elements(p->'muc') m
                    where m->>'id' = a.id and m->'giuThuTu' = 'true'::jsonb)
    and concat_ws(' ', v->>'giaiThich', v->>'meo', v->>'goiMo')
        ~ '(Đáp án|đáp án|Phương án|phương án|Chọn|chọn|ý|[Oo]ption|[Aa]nswer)\s+[A-F]\M|(^|[.:;]\s+)[A-F][.:)]\s|\m[A-F]\s+(sai|đúng|is|là)\M'
  union all
  -- Phương án nhắc tới phương án khác (“Cả A và B”, “Tất cả các ý trên”) thì không xáo được.
  select 'Câu ' || (m->>'id') || ': đề xáo phương án nhưng có phương án nhắc tới phương án khác. Ghi "giuThuTu": true cho câu này.'
  from jsonb_array_elements(p_de->'phan') p, jsonb_array_elements(p->'muc') m
  where p_de->'xaoPhuongAn' = 'true'::jsonb and m->>'loai' = 'chon' and coalesce(m->'giuThuTu', 'false'::jsonb) <> 'true'::jsonb
    and exists (select 1 from jsonb_array_elements_text(m->'luaChon') lc
                where lc ~* '(tất cả|cả hai|cả [A-F] và|all of the above|none of the above|both [A-F])' or lc ~ '\m[A-F]\s+(và|and|or|hoặc)\s+[A-F]\M')
  union all
  select 'Câu ' || id || ': “coChamTay” phải là true hoặc false.' from cau_da
  where v ? 'coChamTay' and jsonb_typeof(v->'coChamTay') <> 'boolean'
  union all
  select 'Phần “' || coalesce(p->>'ten', '') || '”: “phut” phải là số dương.' from jsonb_array_elements(p_de->'phan') p
  where coalesce(p->>'phut', '') !~ '^[0-9]+(\.[0-9]+)?$' or (p->>'phut')::numeric <= 0
  union all
  select 'Phần “' || coalesce(p->>'ten', '') || '”: “moLuc” phải ghi kiểu 2026-12-09T20:15:00+07:00.' from jsonb_array_elements(p_de->'phan') p
  where p ? 'moLuc' and coalesce(p->>'moLuc', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\+07:00|Z)$'
  union all
  select 'Câu ' || id || ': loại câu “' || coalesce(v->>'loai', '') || '” không hợp lệ.' from cau_da
  where coalesce(v->>'loai', '') not in ('chon','dien','viet','tuluan')
$$;

-- ===== Điểm cô chấm cộng vào bài làm =====
-- Khi cô ghi điểm ở cham_tay của một bài luyện đề: câu đó trong cau_tra_loi nhận tổng điểm các tiêu chí,
-- bai_lam.diem thành tổng điểm máy và điểm cô. Chỉ áp dụng cho bài có lượt thi luyện đề; dữ liệu mẫu không đổi.
-- Câu tự luận giữ dung = null nên không tính vào tỉ lệ đúng của chủ đề.
create function noi_bo.ld_cong_diem() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bai uuid := coalesce(new.bai_lam_id, old.bai_lam_id); cau text := coalesce(new.ma_cau, old.ma_cau); con int;
begin
  if not exists (select 1 from public.luot_thi where bai_lam_id = bai) then return null; end if;
  update public.cau_tra_loi c set diem = (select sum(t.diem) from public.cham_tay t where t.bai_lam_id = bai and t.ma_cau = cau)
  where c.bai_lam_id = bai and c.ma_cau = cau;
  select count(*) into con from public.cham_tay where bai_lam_id = bai and diem is null;
  update public.bai_lam b set
    diem = (select coalesce(sum(c.diem), 0) from public.cau_tra_loi c where c.bai_lam_id = bai),
    ghi_chu = concat_ws(' ',
      case when con > 0 then 'Điểm mới gồm phần máy chấm và phần cô đã chấm; còn ' || con || ' câu cô chấm.' end,
      case when (select nop_muon from public.luot_thi where bai_lam_id = bai limit 1) then 'Nộp sau giờ quy định.' end)
  where b.id = bai;
  return null;
end $$;
create trigger ld_cong_diem after insert or update of diem or delete on public.cham_tay
for each row execute function noi_bo.ld_cong_diem();

-- ===== Các hàm cho bàn làm việc của cô (trang Luyện đề trên cổng) =====
-- Mọi hàm kiểm danh tính từ thư đã đăng nhập: chỉ bốn cô gọi được; việc ghi theo vai như các bảng khác.
create function noi_bo.ld_can_nhan_su() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not noi_bo.la_nhan_su() then raise exception 'Trang này dành cho các cô. Cô đăng nhập bằng thư của mình nhé.'; end if;
end $$;

create function public.ld_co_de_thi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform noi_bo.ld_can_nhan_su();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'ma', d.ma, 'tieuDe', d.tieu_de, 'loai', d.loai, 'mo', d.mo, 'dong', d.dong, 'maPhong', d.ma_phong,
      'soLuot', (select count(*) from public.luot_thi l where l.ma_de = d.ma),
      'soNop', (select count(*) from public.luot_thi l where l.ma_de = d.ma and l.nop is not null),
      'soChoCham', (select count(*) from public.cham_tay t join public.luot_thi l on l.bai_lam_id = t.bai_lam_id
                    where l.ma_de = d.ma and t.diem is null)) order by d.mo desc)
    from public.de_thi d), '[]'::jsonb);
end $$;

create function public.ld_co_luot(p_de text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare de public.de_thi;
begin
  perform noi_bo.ld_can_nhan_su();
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”.', p_de; end if;
  return jsonb_build_object(
    'de', jsonb_build_object('ma', de.ma, 'tieuDe', de.tieu_de, 'mo', de.mo, 'dong', de.dong, 'noiDung', de.noi_dung),
    'luot', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'hoTen', h.ho_ten, 'maHs', h.ma_hs, 'batDau', l.bat_dau, 'nop', l.nop, 'nopMuon', l.nop_muon,
        'phan', l.phan, 'soRoiTrang', jsonb_array_length(l.su_kien), 'suKien', l.su_kien,
        'diem', b.diem, 'diemToiDa', b.diem_toi_da,
        'diemMay', (select sum(c.diem) from public.cau_tra_loi c where c.bai_lam_id = b.id and c.dung is not null),
        'choCham', (select count(*) from public.cham_tay t where t.bai_lam_id = b.id and t.diem is null)) order by h.ma_hs)
      from public.luot_thi l join public.hoc_sinh h on h.id = l.hoc_sinh_id left join public.bai_lam b on b.id = l.bai_lam_id
      where l.ma_de = p_de), '[]'::jsonb),
    'cham', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'luotId', l.id, 'hoTen', h.ho_ten, 'maHs', h.ma_hs, 'maCau', t.ma_cau, 'tieuChi', t.tieu_chi,
        'baiLam', l.tra_loi->>t.ma_cau, 'diem', t.diem, 'diemToiDa', t.diem_toi_da, 'nhanXet', t.nhan_xet, 'nguoiCham', t.nguoi_cham,
        'anh', coalesce((select jsonb_agg(a.id order by a.luc) from public.anh_nop a where a.luot_thi_id = l.id and a.ma_cau = t.ma_cau), '[]'::jsonb))
        order by t.ma_cau, h.ma_hs)
      from public.cham_tay t join public.luot_thi l on l.bai_lam_id = t.bai_lam_id join public.hoc_sinh h on h.id = l.hoc_sinh_id
      where l.ma_de = p_de), '[]'::jsonb));
end $$;

create function public.ld_co_anh(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b bytea;
begin
  perform noi_bo.ld_can_nhan_su();
  select du_lieu into b from public.anh_nop where id = p_id;
  if b is null then raise exception 'Không tìm thấy ảnh.'; end if;
  return jsonb_build_object('loai', 'image/jpeg', 'duLieu', translate(encode(b, 'base64'), E'\n', ''));
end $$;

-- Cô Nguyên (vai chấm bài) hoặc cô quản trị ghi điểm một dòng chấm tay.
create function public.ld_co_cham(p_id uuid, p_diem numeric, p_nhan_xet text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare t public.cham_tay;
begin
  if not noi_bo.co_vai('cham_bai') then raise exception 'Chỉ cô phụ trách chấm bài ghi được điểm.'; end if;
  select * into t from public.cham_tay where id = p_id for update;
  if not found then raise exception 'Không tìm thấy câu cần chấm.'; end if;
  if p_diem is not null and (p_diem < 0 or p_diem > coalesce(t.diem_toi_da, p_diem)) then
    raise exception 'Điểm phải từ 0 đến %.', t.diem_toi_da;
  end if;
  update public.cham_tay set diem = p_diem, nhan_xet = nullif(btrim(coalesce(p_nhan_xet, '')), ''),
    nguoi_cham = noi_bo.toi_email(), luc = now(),
    tieu_chi = case when tieu_chi = 'Cả câu (chưa chấm)' and p_diem is not null then 'Cả câu' else tieu_chi end
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- Danh sách lớp kèm mã riêng (mọi cô xem); tạo hoặc đổi mã (cô Ngọc, vai giáo vụ, hoặc cô quản trị).
create function public.ld_co_ma_thi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform noi_bo.ld_can_nhan_su();
  return coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'maHs', h.ma_hs, 'hoTen', h.ho_ten, 'laMau', h.la_mau, 'ma', m.ma)
    order by h.la_mau, h.ma_hs) from public.hoc_sinh h left join public.ma_thi m on m.hoc_sinh_id = h.id where h.dang_hoc), '[]'::jsonb);
end $$;

-- p_hoc_sinh rỗng: tạo mã cho mọi bạn đang học chưa có mã. p_doi = true: đổi mã của một bạn (mã cũ hết dùng được).
create function public.ld_co_tao_ma(p_hoc_sinh uuid default null, p_doi boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not noi_bo.co_vai('giao_vu') then raise exception 'Chỉ cô phụ trách giáo vụ tạo được đường dẫn riêng.'; end if;
  if p_doi and p_hoc_sinh is not null then
    delete from public.ma_thi where hoc_sinh_id = p_hoc_sinh;
  end if;
  insert into public.ma_thi (hoc_sinh_id)
  select h.id from public.hoc_sinh h
  where h.dang_hoc and (p_hoc_sinh is null or h.id = p_hoc_sinh)
    and not exists (select 1 from public.ma_thi m where m.hoc_sinh_id = h.id);
  return public.ld_co_ma_thi();
end $$;

-- ===== Quyền gọi hàm =====
revoke execute on function noi_bo.ld_cong_diem(), noi_bo.ld_can_nhan_su(), noi_bo.ld_de_khong_doan(jsonb) from public, anon, authenticated;
revoke execute on function public.ld_co_de_thi(), public.ld_co_luot(text), public.ld_co_anh(uuid),
  public.ld_co_cham(uuid, numeric, text), public.ld_co_ma_thi(), public.ld_co_tao_ma(uuid, boolean) from public, anon;
grant execute on function public.ld_co_de_thi(), public.ld_co_luot(text), public.ld_co_anh(uuid),
  public.ld_co_cham(uuid, numeric, text), public.ld_co_ma_thi(), public.ld_co_tao_ma(uuid, boolean) to authenticated;
revoke execute on function noi_bo.ld_chuan(text), noi_bo.ld_dem_tu(text), noi_bo.ld_mang(jsonb), noi_bo.ld_khop(text, jsonb),
  noi_bo.ld_chuan_cau(text), noi_bo.ld_khop_cau(text, jsonb),
  noi_bo.ld_cham(jsonb, jsonb), noi_bo.ld_ms(timestamptz), noi_bo.ld_hoc_sinh(text), noi_bo.ld_luot(text, text),
  noi_bo.ld_anh_cua(uuid), noi_bo.ld_kiem_de(jsonb, jsonb) from public, anon, authenticated;

revoke execute on function public.ld_vao(text, text), public.ld_bat_dau(text, text, text),
  public.ld_luu(text, text, jsonb, jsonb, int), public.ld_tep(text, text, text),
  public.ld_tai_anh(text, text, text, text), public.ld_ket_qua(text, text), public.ld_nop(text, text, jsonb, jsonb) from public;
grant execute on function public.ld_vao(text, text), public.ld_bat_dau(text, text, text),
  public.ld_luu(text, text, jsonb, jsonb, int), public.ld_tep(text, text, text),
  public.ld_tai_anh(text, text, text, text), public.ld_ket_qua(text, text), public.ld_nop(text, text, jsonb, jsonb) to anon, authenticated;
