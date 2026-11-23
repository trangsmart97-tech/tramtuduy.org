-- Lời trang thi gọi học sinh là “bạn” (QĐ-029, 23/11/2026). Chỉ đổi chữ trong lời báo; thân hàm giữ nguyên bản mới nhất.

-- noi_bo.ld_hoc_sinh (bản mới nhất ở 20261120000001_luyen_de.sql)
create or replace function noi_bo.ld_hoc_sinh(p_ma text) returns public.hoc_sinh
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh;
begin
  select h.* into hs from public.ma_thi m join public.hoc_sinh h on h.id = m.hoc_sinh_id
  where m.ma = p_ma and h.dang_hoc;
  if not found then
    raise exception 'Đường dẫn chưa đúng. Bạn xin cô đường dẫn riêng của bạn nhé.';
  end if;
  return hs;
end $$;

-- noi_bo.ld_luot (bản mới nhất ở 20261120000001_luyen_de.sql)
create or replace function noi_bo.ld_luot(p_ma text, p_de text) returns public.luot_thi
language plpgsql volatile security definer set search_path = '' as $$
declare hs public.hoc_sinh; l public.luot_thi;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de for update;
  if not found then raise exception 'Không tìm thấy lượt thi. Bạn tải lại trang giúp cô.'; end if;
  return l;
end $$;

-- public.ld_vao (bản mới nhất ở 20261120000004_gio_rieng.sql)
create or replace function public.ld_vao(p_ma text, p_de text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; de public.de_thi; l public.luot_thi;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”. Bạn xin cô đường dẫn đúng nhé.', p_de; end if;
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de;
  return jsonb_build_object('ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten), 'hoTen', hs.ho_ten,
    'tieuDe', de.tieu_de, 'mo', noi_bo.ld_ms(de.mo), 'dong', noi_bo.ld_ms(de.dong), 'nay', noi_bo.ld_ms(now()),
    'coMaPhong', coalesce(de.ma_phong, '') <> '',
    'batDauMuonNhat', noi_bo.ld_ms(noi_bo.ld_bat_dau_muon_nhat(de.noi_dung)), 'daBatDau', l.id is not null, 'daNop', l.nop is not null);
end $$;

-- public.ld_bat_dau (bản mới nhất ở 20261120000004_gio_rieng.sql)
create or replace function public.ld_bat_dau(p_ma text, p_de text, p_ma_phong text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare hs public.hoc_sinh; de public.de_thi; l public.luot_thi; nay timestamptz := now();
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”. Bạn xin cô đường dẫn đúng nhé.', p_de; end if;
  if coalesce(de.ma_phong, '') <> '' and trim(coalesce(p_ma_phong, '')) <> trim(de.ma_phong) then
    raise exception 'Mã phòng thi chưa đúng. Bạn nghe lại cô đọc mã nhé.';
  end if;
  if nay < de.mo then
    raise exception 'Chưa đến giờ thi. Đề mở lúc %.', to_char(de.mo at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI "ngày" DD/MM');
  end if;

  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de for update;
  if found and l.nop is not null then raise exception 'Bạn đã nộp bài của đề này rồi.'; end if;
  -- Quá giờ đóng 2 phút mà lượt chưa nộp: máy nộp bài với phần đã lưu, trả kết quả, không phát lại đề.
  if found and nay > de.dong + interval '2 minutes' then
    return public.ld_nop(p_ma, p_de, l.tra_loi, l.su_kien) || jsonb_build_object('hetGio', true);
  end if;
  if not found then
    -- Lượt đã bắt đầu thì vẫn vào lại được trong 2 phút sau giờ đóng để trang tự nộp; lượt mới thì không.
    if nay > de.dong then raise exception 'Đã hết giờ thi của đề này.'; end if;
    -- Giờ riêng cho từng lượt (QĐ-018): mỗi con đủ giờ tính từ lúc bắt đầu, nên chỉ nhận lượt mới tới "batDauMuonNhat".
    if noi_bo.ld_bat_dau_muon_nhat(de.noi_dung) is not null and nay > noi_bo.ld_bat_dau_muon_nhat(de.noi_dung) then
      raise exception 'Đã quá giờ vào thi (%). Bạn báo cô ngay nhé.', to_char(noi_bo.ld_bat_dau_muon_nhat(de.noi_dung) at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI');
    end if;
    insert into public.luot_thi (hoc_sinh_id, ma_de, bat_dau, bat_dau_phan) values (hs.id, p_de, nay, nay)
    on conflict (hoc_sinh_id, ma_de) do nothing;
    select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de for update;
    if l.nop is not null then raise exception 'Bạn đã nộp bài của đề này rồi.'; end if;
  end if;

  return jsonb_build_object('ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten), 'de', de.noi_dung,
    'batDau', noi_bo.ld_ms(l.bat_dau), 'nay', noi_bo.ld_ms(nay), 'dong', noi_bo.ld_ms(de.dong),
    'phan', l.phan, 'batDauPhan', noi_bo.ld_ms(l.bat_dau_phan), 'traLoi', l.tra_loi,
    'anh', noi_bo.ld_anh_cua(l.id), 'tiepTuc', l.bat_dau < nay, 'khoaLuc', noi_bo.ld_ms(l.khoa_luc));
end $$;

-- public.ld_luu (bản mới nhất ở 20261120000003_nop_anh.sql)
create or replace function public.ld_luu(p_ma text, p_de text, p_tra_loi jsonb, p_su_kien jsonb default '[]'::jsonb, p_phan int default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then return jsonb_build_object('daNop', true); end if;
  -- Đã khoá bài (đang trong giờ gửi ảnh): không đổi phần đã gõ, chỉ ghi thêm lần rời trang.
  if l.khoa_luc is not null then
    update public.luot_thi set su_kien = coalesce(p_su_kien, su_kien) where id = l.id;
    return jsonb_build_object('ok', true, 'khoa', true, 'nay', noi_bo.ld_ms(now()));
  end if;
  if pg_column_size(p_tra_loi) + pg_column_size(p_su_kien) > 500000 then
    raise exception 'Bài làm dài quá mức cho phép. Bạn báo cô ngay nhé.';
  end if;
  update public.luot_thi set
    tra_loi = coalesce(p_tra_loi, '{}'::jsonb),
    su_kien = coalesce(p_su_kien, '[]'::jsonb),
    phan = greatest(phan, coalesce(p_phan, phan)),
    bat_dau_phan = case when coalesce(p_phan, phan) > phan then now() else bat_dau_phan end
  where id = l.id;
  return jsonb_build_object('ok', true, 'nay', noi_bo.ld_ms(now()));
end $$;

-- public.ld_tep (bản mới nhất ở 20261120000001_luyen_de.sql)
create or replace function public.ld_tep(p_ma text, p_de text, p_ten text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; t public.tep_de;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  if not exists (select 1 from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de) then
    raise exception 'Không tìm thấy lượt thi. Bạn tải lại trang giúp cô.';
  end if;
  select * into t from public.tep_de where ma_de = p_de and ten = p_ten;
  if not found then raise exception 'Thiếu tệp %.', p_ten; end if;
  return jsonb_build_object('loai', t.loai, 'duLieu', translate(encode(t.du_lieu, 'base64'), E'\n', ''));
end $$;

-- public.ld_tai_anh (bản mới nhất ở 20261120000003_nop_anh.sql)
create or replace function public.ld_tai_anh(p_ma text, p_de text, p_cau text, p_du_lieu text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi; b bytea; moi uuid;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then raise exception 'Bạn đã nộp bài, không gửi thêm ảnh được.'; end if;
  if now() > (select dong from public.de_thi where ma = p_de) + interval '2 minutes' then
    raise exception 'Đề đã đóng, không gửi thêm ảnh được.';
  end if;
  if l.khoa_luc is not null and now() > l.khoa_luc + make_interval(secs => ((coalesce(noi_bo.ld_phut_nop_anh(p_de), 0) + 1) * 60)::double precision) then
    raise exception 'Đã hết giờ gửi ảnh.';
  end if;
  if (select count(*) from public.anh_nop where luot_thi_id = l.id) >= 40 then
    raise exception 'Bạn đã gửi đủ số ảnh cho phép. Bạn báo cô nhé.';
  end if;
  b := decode(regexp_replace(coalesce(p_du_lieu, ''), '^data:image/[a-z]+;base64,', ''), 'base64');
  if length(b) = 0 or length(b) > 3000000 then raise exception 'Ảnh chưa đúng hoặc quá lớn. Bạn chụp lại nhé.'; end if;
  insert into public.anh_nop (luot_thi_id, ma_cau, du_lieu) values (l.id, p_cau, b) returning id into moi;
  return jsonb_build_object('id', moi);
end $$;

-- public.ld_ket_qua (bản mới nhất ở 20261120000001_luyen_de.sql)
create or replace function public.ld_ket_qua(p_ma text, p_de text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; l public.luot_thi; de public.de_thi; kq jsonb;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de;
  if not found or l.nop is null then raise exception 'Bạn chưa nộp bài.'; end if;
  select * into de from public.de_thi where ma = p_de;
  kq := noi_bo.ld_cham((select noi_dung from public.dap_an_de where ma_de = p_de), l.tra_loi);
  return jsonb_build_object('daNop', true, 'ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten),
    'diemMay', kq->'diemMay', 'toiDaMay', kq->'toiDaMay', 'toiDaCoCham', kq->'toiDaCoCham',
    'theoNhom', kq->'theoNhom', 'soCauChoCham', jsonb_array_length(kq->'choCham'),
    'moChiTiet', noi_bo.ld_ms(de.dong),
    'chiTiet', case when now() >= de.dong then kq->'chiTiet' else null end,
    'de', case when now() >= de.dong then noi_bo.ld_de_khong_doan(de.noi_dung) else null end);
end $$;

-- public.ld_nop (bản mới nhất ở 20261120000003_nop_anh.sql)
create or replace function public.ld_nop(p_ma text, p_de text, p_tra_loi jsonb, p_su_kien jsonb default '[]'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.luot_thi; de public.de_thi; da jsonb; kq jsonb; bai uuid; nay timestamptz := now();
  tong_phut numeric; muon boolean; r record; v_tra jsonb;
begin
  l := noi_bo.ld_luot(p_ma, p_de);  -- khoá dòng: hai lần bấm nộp cùng lúc chỉ ghi một lần
  if l.nop is not null then return public.ld_ket_qua(p_ma, p_de); end if;
  select * into de from public.de_thi where ma = p_de;
  select noi_dung into da from public.dap_an_de where ma_de = p_de;
  if da is null then raise exception 'Đề chưa có đáp án. Bạn báo cô ngay nhé.'; end if;

  select coalesce(sum((p->>'phut')::numeric + coalesce((p->>'phutNopAnh')::numeric, 0)), 0) into tong_phut from jsonb_array_elements(de.noi_dung->'phan') p;
  -- Đề có phần mở theo giờ chung ("moLuc") thì thời gian chờ không tính vào tổng phút, nên chỉ xét giờ đóng.
  muon := nay > de.dong + interval '2 minutes'
       or (not jsonb_path_exists(de.noi_dung, '$.phan[*].moLuc')
           and nay > l.bat_dau + make_interval(secs => ((tong_phut + 2) * 60)::double precision));
  -- Bài đã khoá khi hết giờ làm (giờ gửi ảnh): chấm phần đã lưu lúc khoá, bỏ qua phần trang gửi lên.
  v_tra := case when l.khoa_luc is not null then l.tra_loi else coalesce(p_tra_loi, '{}'::jsonb) end;
  kq := noi_bo.ld_cham(da, v_tra);

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
    tra_loi = v_tra, su_kien = coalesce(p_su_kien, su_kien)
  where id = l.id;
  return public.ld_ket_qua(p_ma, p_de);
end $$;

-- public.ld_khoa (bản mới nhất ở 20261120000003_nop_anh.sql)
create or replace function public.ld_khoa(p_ma text, p_de text, p_tra_loi jsonb, p_su_kien jsonb default '[]'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi; so_phan int;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then return jsonb_build_object('daNop', true); end if;
  if coalesce(noi_bo.ld_phut_nop_anh(p_de), 0) <= 0 then raise exception 'Đề này không có giờ gửi ảnh.'; end if;
  select jsonb_array_length(noi_dung->'phan') into so_phan from public.de_thi where ma = p_de;
  if l.khoa_luc is null then
    if pg_column_size(p_tra_loi) + pg_column_size(p_su_kien) > 500000 then
      raise exception 'Bài làm dài quá mức cho phép. Bạn báo cô ngay nhé.';
    end if;
    update public.luot_thi set tra_loi = coalesce(p_tra_loi, '{}'::jsonb), su_kien = coalesce(p_su_kien, su_kien),
      phan = so_phan - 1, khoa_luc = now()
    where id = l.id returning * into l;
  end if;
  return jsonb_build_object('ok', true, 'khoaLuc', noi_bo.ld_ms(l.khoa_luc), 'nay', noi_bo.ld_ms(now()));
end $$;
