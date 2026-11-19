-- Luyện đề, bản 4 (19/11/2026): giờ riêng cho từng lượt (QĐ-018, đề đầu vào).
-- Mỗi con có đủ giờ của từng phần và giờ gửi ảnh, tính từ lúc con bắt đầu (trang thi đã tính theo từng lượt).
-- Thêm "batDauMuonNhat" ở gốc tệp đề: sau giờ này không mở lượt mới. Giờ đóng đề (dong) nên bằng
-- batDauMuonNhat + tổng phút các phần + phút gửi ảnh + vài phút dự phòng; dang_de.mjs đối chiếu.

create or replace function noi_bo.ld_bat_dau_muon_nhat(p jsonb) returns timestamptz
language sql stable set search_path = '' as $$
  select case when coalesce(p->>'batDauMuonNhat', '') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\+07:00|Z)$'
              then (p->>'batDauMuonNhat')::timestamptz end
$$;
revoke execute on function noi_bo.ld_bat_dau_muon_nhat(jsonb) from public, anon, authenticated;

create or replace function public.ld_vao(p_ma text, p_de text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hs public.hoc_sinh; de public.de_thi; l public.luot_thi;
begin
  hs := noi_bo.ld_hoc_sinh(p_ma);
  select * into de from public.de_thi where ma = p_de;
  if not found then raise exception 'Chưa có đề “%”. Con xin cô đường dẫn đúng nhé.', p_de; end if;
  select * into l from public.luot_thi where hoc_sinh_id = hs.id and ma_de = p_de;
  return jsonb_build_object('ten', coalesce(nullif(hs.ten_goi, ''), hs.ho_ten), 'hoTen', hs.ho_ten,
    'tieuDe', de.tieu_de, 'mo', noi_bo.ld_ms(de.mo), 'dong', noi_bo.ld_ms(de.dong), 'nay', noi_bo.ld_ms(now()),
    'coMaPhong', coalesce(de.ma_phong, '') <> '',
    'batDauMuonNhat', noi_bo.ld_ms(noi_bo.ld_bat_dau_muon_nhat(de.noi_dung)), 'daBatDau', l.id is not null, 'daNop', l.nop is not null);
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
    -- Giờ riêng cho từng lượt (QĐ-018): mỗi con đủ giờ tính từ lúc bắt đầu, nên chỉ nhận lượt mới tới "batDauMuonNhat".
    if noi_bo.ld_bat_dau_muon_nhat(de.noi_dung) is not null and nay > noi_bo.ld_bat_dau_muon_nhat(de.noi_dung) then
      raise exception 'Đã quá giờ vào thi (%). Con báo cô ngay nhé.', to_char(noi_bo.ld_bat_dau_muon_nhat(de.noi_dung) at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI');
    end if;
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
  select 'Gốc tệp đề: “' || k || '” phải ghi kiểu 2026-12-09T21:20:00+07:00.' from unnest(array['moDe','dongDe','batDauMuonNhat']) k
  where p_de ? k and coalesce(p_de->>k, '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\+07:00|Z)$'
  union all
  select 'Câu ' || id || ': loại câu “' || coalesce(v->>'loai', '') || '” không hợp lệ.' from cau_da
  where coalesce(v->>'loai', '') not in ('chon','dien','viet','tuluan')
$$;

revoke execute on function noi_bo.ld_kiem_de(jsonb, jsonb) from public, anon, authenticated;
