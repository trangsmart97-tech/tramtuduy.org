-- Luyện đề, bản 6 (25/11/2026, QĐ-048): bài viết ở nhà môn Tiếng Việt nộp bằng ảnh bài viết tay.
-- 1. Đề loại 'bai_viet' (mã bắt đầu "bai-viet-"): một hay vài câu "tuluan"; bạn gõ bài hoặc chụp ảnh bài viết tay.
--    Khi nộp, ld_nop ghi bai_lam loại 'bai_viet' (đúng loại hồ sơ đang dùng cho "Bài viết đoạn"), câu tự luận
--    vào cham_tay chờ cô chấm, ảnh ở anh_nop gắn với lượt: giống hệt bài gõ.
-- 2. Giới hạn ảnh: mỗi ảnh tối đa 3 MB sau khi trang thu nhỏ (như cũ); mỗi lượt tối đa 40 ảnh và 25 MB;
--    câu có "soAnhToiDa": N thì tối đa N ảnh cho câu ấy. Ảnh chỉ nhận cho câu "tuluan" có trong đề.
-- 3. ld_xoa_anh: bạn xoá ảnh chụp hỏng của mình trước khi nộp.

alter table public.de_thi drop constraint if exists de_thi_loai_check;
alter table public.de_thi add constraint de_thi_loai_check
  check (loai in ('dau_vao','moc','thuc_chien','de','tang3','bai_viet'));

create or replace function public.ld_tai_anh(p_ma text, p_de text, p_cau text, p_du_lieu text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi; b bytea; moi uuid; cau jsonb; toi_da int;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then raise exception 'Bạn đã nộp bài, không gửi thêm ảnh được.'; end if;
  if now() > (select dong from public.de_thi where ma = p_de) + interval '2 minutes' then
    raise exception 'Đề đã đóng, không gửi thêm ảnh được.';
  end if;
  if l.khoa_luc is not null and now() > l.khoa_luc + make_interval(secs => ((coalesce(noi_bo.ld_phut_nop_anh(p_de), 0) + 1) * 60)::double precision) then
    raise exception 'Đã hết giờ gửi ảnh.';
  end if;
  select jsonb_path_query_first(noi_dung, '$.phan[*].muc[*] ? (@.id == $c)', jsonb_build_object('c', p_cau)) into cau
  from public.de_thi where ma = p_de;
  if cau is null or cau->>'loai' <> 'tuluan' then raise exception 'Câu này không nhận ảnh. Bạn tải lại trang giúp cô.'; end if;
  if (select count(*) from public.anh_nop where luot_thi_id = l.id) >= 40 then
    raise exception 'Bạn đã gửi đủ số ảnh cho phép. Bạn báo cô nhé.';
  end if;
  toi_da := case when cau->>'soAnhToiDa' ~ '^[0-9]+$' then (cau->>'soAnhToiDa')::int end;
  if toi_da is not null and (select count(*) from public.anh_nop where luot_thi_id = l.id and ma_cau = p_cau) >= toi_da then
    raise exception 'Câu này nhận tối đa % ảnh. Bạn xoá ảnh chưa rõ rồi gửi lại nhé.', toi_da;
  end if;
  b := decode(regexp_replace(coalesce(p_du_lieu, ''), '^data:image/[a-z]+;base64,', ''), 'base64');
  if length(b) = 0 or length(b) > 3000000 then raise exception 'Ảnh chưa đúng hoặc quá lớn. Bạn chụp lại nhé.'; end if;
  if (select coalesce(sum(length(du_lieu)), 0) from public.anh_nop where luot_thi_id = l.id) + length(b) > 25000000 then
    raise exception 'Ảnh của bài này đã quá 25 MB. Bạn xoá bớt ảnh rồi gửi lại nhé.';
  end if;
  insert into public.anh_nop (luot_thi_id, ma_cau, du_lieu) values (l.id, p_cau, b) returning id into moi;
  return jsonb_build_object('id', moi);
end $$;

create or replace function public.ld_xoa_anh(p_ma text, p_de text, p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare l public.luot_thi;
begin
  l := noi_bo.ld_luot(p_ma, p_de);
  if l.nop is not null then raise exception 'Bạn đã nộp bài, không xoá ảnh được.'; end if;
  if now() > (select dong from public.de_thi where ma = p_de) + interval '2 minutes' then
    raise exception 'Đề đã đóng, không xoá ảnh được.';
  end if;
  delete from public.anh_nop where id = p_id and luot_thi_id = l.id;
  if not found then raise exception 'Không tìm thấy ảnh này trong bài của bạn.'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.ld_xoa_anh(text, text, uuid) from public;
grant execute on function public.ld_xoa_anh(text, text, uuid) to anon, authenticated;
