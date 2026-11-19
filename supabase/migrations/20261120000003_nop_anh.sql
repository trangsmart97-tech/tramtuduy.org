-- Luyện đề, bản 3 (19/11/2026): 5 phút gửi ảnh sau giờ làm bài (QĐ-015).
-- Phần cuối của đề có "phutNopAnh": N. Hết giờ làm bài của phần ấy, trang gọi ld_khoa: phần con đã gõ được lưu
-- cố định (luot_thi.khoa_luc); con còn N phút chỉ để gửi ảnh bài làm trên giấy, rồi trang tự nộp.
-- Sau khi khoá, ld_luu không đổi phần đã gõ, ld_nop chấm phần đã lưu lúc khoá, ld_tai_anh chỉ nhận ảnh trong N phút
-- (thêm 1 phút cho mạng chậm) và không nhận sau giờ đóng đề 2 phút.
-- Thêm ld_co_nop_ho: cô nộp giúp các lượt còn dở sau giờ đóng (con sập máy, không mở lại), với phần đã lưu.
-- ld_kiem_de kiểm thêm "phutNopAnh" (1 đến 15 phút, chỉ ở phần cuối), "moDe", "dongDe" ở gốc tệp đề.

alter table public.luot_thi add column if not exists khoa_luc timestamptz;

create or replace function noi_bo.ld_phut_nop_anh(p_de text) returns numeric
language sql stable security definer set search_path = '' as $$
  select (noi_dung->'phan'->(jsonb_array_length(noi_dung->'phan') - 1)->>'phutNopAnh')::numeric from public.de_thi where ma = p_de
$$;

-- Khoá bài khi hết giờ làm bài của phần cuối có giờ gửi ảnh. Gọi lại nhiều lần không đổi gì.
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
      raise exception 'Bài làm dài quá mức cho phép. Con báo cô ngay nhé.';
    end if;
    update public.luot_thi set tra_loi = coalesce(p_tra_loi, '{}'::jsonb), su_kien = coalesce(p_su_kien, su_kien),
      phan = so_phan - 1, khoa_luc = now()
    where id = l.id returning * into l;
  end if;
  return jsonb_build_object('ok', true, 'khoaLuc', noi_bo.ld_ms(l.khoa_luc), 'nay', noi_bo.ld_ms(now()));
end $$;

create or replace function public.ld_bat_dau(p_ma text, p_de text, p_ma_phong text default null) returns jsonb
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
    'anh', noi_bo.ld_anh_cua(l.id), 'tiepTuc', l.bat_dau < nay, 'khoaLuc', noi_bo.ld_ms(l.khoa_luc));
end $$;

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

create or replace function public.ld_tai_anh(p_ma text, p_de text, p_cau text, p_du_lieu text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi; b bytea; moi uuid;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then raise exception 'Con đã nộp bài, không gửi thêm ảnh được.'; end if;
  if now() > (select dong from public.de_thi where ma = p_de) + interval '2 minutes' then
    raise exception 'Đề đã đóng, không gửi thêm ảnh được.';
  end if;
  if l.khoa_luc is not null and now() > l.khoa_luc + make_interval(secs => ((coalesce(noi_bo.ld_phut_nop_anh(p_de), 0) + 1) * 60)::double precision) then
    raise exception 'Đã hết giờ gửi ảnh.';
  end if;
  if (select count(*) from public.anh_nop where luot_thi_id = l.id) >= 40 then
    raise exception 'Con đã gửi đủ số ảnh cho phép. Con báo cô nhé.';
  end if;
  b := decode(regexp_replace(coalesce(p_du_lieu, ''), '^data:image/[a-z]+;base64,', ''), 'base64');
  if length(b) = 0 or length(b) > 3000000 then raise exception 'Ảnh chưa đúng hoặc quá lớn. Con chụp lại nhé.'; end if;
  insert into public.anh_nop (luot_thi_id, ma_cau, du_lieu) values (l.id, p_cau, b) returning id into moi;
  return jsonb_build_object('id', moi);
end $$;

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
  if da is null then raise exception 'Đề chưa có đáp án. Con báo cô ngay nhé.'; end if;

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

create or replace function noi_bo.ld_kiem_de(p_de jsonb, p_dap_an jsonb) returns setof text
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
  select 'Phần “' || coalesce(p->>'ten', '') || '”: “dongLuc” phải ghi kiểu 2026-12-09T20:15:00+07:00.' from jsonb_array_elements(p_de->'phan') p
  where p ? 'dongLuc' and coalesce(p->>'dongLuc', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\+07:00|Z)$'
  union all
  select 'Khối bài đọc “' || coalesce(m->>'tieuDe', '') || '”: “anSauThi” phải là true hoặc false.'
  from jsonb_array_elements(p_de->'phan') p, jsonb_array_elements(p->'muc') m
  where m->>'loai' = 'doan' and ((m ? 'anSauThi' and jsonb_typeof(m->'anSauThi') <> 'boolean') or (m ? 'anSauKetQua' and jsonb_typeof(m->'anSauKetQua') <> 'boolean'))
  union all
  select 'Phần “' || coalesce(p->>'ten', '') || '”: “phutNopAnh” phải là số phút từ 1 đến 15.' from jsonb_array_elements(p_de->'phan') p
  where p ? 'phutNopAnh' and (coalesce(p->>'phutNopAnh', '') !~ '^[0-9]+(\.[0-9]+)?$' or (p->>'phutNopAnh')::numeric < 1 or (p->>'phutNopAnh')::numeric > 15)
  union all
  select 'Phần “' || coalesce(p->>'ten', '') || '”: “phutNopAnh” chỉ đặt ở phần cuối của đề.'
  from jsonb_array_elements(p_de->'phan') with ordinality t(p, i)
  where p ? 'phutNopAnh' and i < jsonb_array_length(p_de->'phan')
  union all
  select 'Gốc tệp đề: “' || k || '” phải ghi kiểu 2026-12-09T21:20:00+07:00.' from unnest(array['moDe','dongDe']) k
  where p_de ? k and coalesce(p_de->>k, '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\+07:00|Z)$'
  union all
  select 'Câu ' || id || ': loại câu “' || coalesce(v->>'loai', '') || '” không hợp lệ.' from cau_da
  where coalesce(v->>'loai', '') not in ('chon','dien','viet','tuluan')
$$;

-- Cô nộp giúp mọi lượt còn dở của một đề đã đóng quá 2 phút, với phần con đã lưu.
create or replace function public.ld_co_nop_ho(p_de text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r record; n int := 0; de public.de_thi;
begin
  if not noi_bo.co_vai('cham_bai') then raise exception 'Chỉ cô phụ trách chấm bài nộp giúp được.'; end if;
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”.', p_de; end if;
  if now() <= de.dong + interval '2 minutes' then raise exception 'Đề chưa đóng. Chờ quá giờ đóng 2 phút rồi cô nộp giúp.'; end if;
  for r in select l.tra_loi, l.su_kien, m.ma from public.luot_thi l join public.ma_thi m on m.hoc_sinh_id = l.hoc_sinh_id
           where l.ma_de = p_de and l.nop is null loop
    perform public.ld_nop(r.ma, p_de, r.tra_loi, r.su_kien);
    n := n + 1;
  end loop;
  return jsonb_build_object('daNopGiup', n);
end $$;

revoke execute on function noi_bo.ld_phut_nop_anh(text), noi_bo.ld_kiem_de(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.ld_khoa(text, text, jsonb, jsonb) from public;
grant execute on function public.ld_khoa(text, text, jsonb, jsonb) to anon, authenticated;
revoke execute on function public.ld_co_nop_ho(text) from public, anon;
grant execute on function public.ld_co_nop_ho(text) to authenticated;

-- Khối bài đọc ẩn sau giờ thi ("anSauThi"): vẫn gửi tiêu đề của khối (ví dụ “MÔN ĐỌC HIỂU VÀ LÀM VĂN… 1. Đọc hiểu”)
-- để các câu phía sau còn tiêu đề trên màn hình kết quả; bỏ nội dung, hình, nguồn, bản ghi. (Tầng 5 lần 4, đề đầu vào.)
create or replace function noi_bo.ld_de_khong_doan(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ma', p->'ma', 'tieuDe', p->'tieuDe', 'xaoPhuongAn', coalesce(p->'xaoPhuongAn', 'false'::jsonb),
    'phan', coalesce((select jsonb_agg(jsonb_build_object('ten', ph->'ten',
        'muc', coalesce((select jsonb_agg(
                  case when m->>'loai' = 'doan' and (coalesce(m->'anSauThi', 'false'::jsonb) = 'true'::jsonb
                                                     or coalesce(m->'anSauKetQua', 'false'::jsonb) = 'true'::jsonb)
                         then jsonb_build_object('loai', 'doan', 'tieuDe', m->'tieuDe', 'anSauThi', true)
                       when m->>'loai' = 'doan' then m - 'audio' - 'soLanNghe'
                       else m end order by j)
                  from jsonb_array_elements(ph->'muc') with ordinality u(m, j)), '[]'::jsonb))
      order by i) from jsonb_array_elements(p->'phan') with ordinality t(ph, i)), '[]'::jsonb))
$$;
revoke execute on function noi_bo.ld_de_khong_doan(jsonb) from public, anon, authenticated;
