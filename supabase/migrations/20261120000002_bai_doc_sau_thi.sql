-- Luyện đề, bản 2 (20/11/2026): bài đọc ở màn hình kết quả, giờ đóng chung của một phần.
-- Theo tầng 5 lần 3 của đề đầu vào, việc 11 và 12.
-- 1. Sau giờ thi, màn hình kết quả hiện lại các khối bài đọc ("doan") để con đọc lại khi xem lời giải.
--    Chỉ khối ghi "anSauThi": true (hoặc "anSauKetQua": true) bị bỏ, ví dụ bài thơ chưa có quyền đăng.
--    Khối hiện lại không kèm bản ghi nghe ("audio"), để không nghe lại được sau giờ thi.
-- 2. ld_kiem_de kiểm thêm "dongLuc" của phần (giờ đóng chung, trang thi xử lý) và "anSauThi".

create or replace function noi_bo.ld_de_khong_doan(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ma', p->'ma', 'tieuDe', p->'tieuDe', 'xaoPhuongAn', coalesce(p->'xaoPhuongAn', 'false'::jsonb),
    'phan', coalesce((select jsonb_agg(jsonb_build_object('ten', ph->'ten',
        'muc', coalesce((select jsonb_agg(case when m->>'loai' = 'doan' then m - 'audio' - 'soLanNghe' else m end order by j)
                         from jsonb_array_elements(ph->'muc') with ordinality u(m, j)
                         where not (m->>'loai' = 'doan' and (coalesce(m->'anSauThi', 'false'::jsonb) = 'true'::jsonb
                                                             or coalesce(m->'anSauKetQua', 'false'::jsonb) = 'true'::jsonb))), '[]'::jsonb))
      order by i) from jsonb_array_elements(p->'phan') with ordinality t(ph, i)), '[]'::jsonb))
$$;
revoke execute on function noi_bo.ld_de_khong_doan(jsonb) from public, anon, authenticated;

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
  select 'Câu ' || id || ': loại câu “' || coalesce(v->>'loai', '') || '” không hợp lệ.' from cau_da
  where coalesce(v->>'loai', '') not in ('chon','dien','viet','tuluan')
$$;
revoke execute on function noi_bo.ld_kiem_de(jsonb, jsonb) from public, anon, authenticated;
