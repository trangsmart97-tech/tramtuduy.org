// Làm thử các đề Tầng 3 một tuần bằng học sinh thử, trên Postgres cục bộ, với đúng tệp SQL dang_de.mjs đã viết.
//   node thu_tang3_tuan.mjs <thư mục đề> <tuần>
// Mỗi đề: đáp án không lộ (anon không đọc được dap_an_de; ld_vao/ld_bat_dau không trả đáp án); trước giờ mở bị chặn;
// làm đúng hết được điểm tối đa; cau_tra_loi đủ bốn nhãn; lời giải từng câu chỉ hiện sau giờ đóng; làm sai có điểm 0 câu ấy.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const KHO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [, , THU_MUC, TUAN] = process.argv;
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
create function auth.jwt() returns jsonb language sql stable as 'select ''{}''::jsonb';
grant usage on schema auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;`);
const mig = path.join(KHO, "supabase/migrations");
for (const f of fs.readdirSync(mig).sort()) await db.exec(fs.readFileSync(path.join(mig, f), "utf8"));
for (const f of ["01_danh_muc.sql", "02_hoc_sinh_mau.sql"]) await db.exec(fs.readFileSync(path.join(KHO, "supabase/seed", f), "utf8"));
const de = fs.readdirSync(THU_MUC).filter((f) => new RegExp(`^tang3-tuan-${TUAN}-.*[^n]\\.json$`).test(f)).sort();
const mr = "thu0an0000000000000000000001", ms = "thu0binh00000000000000000002";
await db.query(`insert into public.ma_thi (hoc_sinh_id, ma) select id, $1 from public.hoc_sinh where ma_hs='MAU-02'`, [mr]);
await db.query(`insert into public.ma_thi (hoc_sinh_id, ma) select id, $1 from public.hoc_sinh where ma_hs='MAU-03'`, [ms]);
let hong = 0; const ok = (dk, chu) => { if (!dk) { hong++; console.log("   HỎNG: " + chu); } };
const anon = async (sql, ts = []) => { await db.exec("set role anon"); try { return (await db.query(sql, ts)).rows; } finally { await db.exec("reset role"); } };
const thu = async (sql, ts) => { try { await anon(sql, ts); return null; } catch (e) { return e.message; } };
for (const [i, f] of de.entries()) {
  const ma = f.replace(/\.json$/, ""), d = JSON.parse(fs.readFileSync(path.join(THU_MUC, f), "utf8"));
  const da = JSON.parse(fs.readFileSync(path.join(THU_MUC, ma + ".dapan.json"), "utf8"));
  await db.exec(fs.readFileSync(path.join(KHO, `supabase/.temp/dang-de-${ma}.sql`), "utf8"));
  const goc = (await db.query(`select loai, do_tin_cay, tuan, mo, dong from public.de_thi where ma=$1`, [ma])).rows[0];
  console.log(`${ma}: loại ${goc.loai}, độ tin cậy ${goc.do_tin_cay}, tuần ${goc.tuan}, mở ${goc.mo.toISOString()}, đóng ${goc.dong.toISOString()}`);
  ok(goc.loai === "tang3" && goc.do_tin_cay === 2 && goc.tuan === Number(TUAN), "loại/độ tin cậy/tuần sai");
  // Trước giờ mở
  const e0 = await thu(`select public.ld_bat_dau($1,$2)`, [mr, ma]); ok(e0 && /Chưa đến giờ/.test(e0), "vào được trước giờ mở: " + e0);
  // Đáp án khoá: anon không đọc bảng
  const e1 = await thu(`select * from public.dap_an_de where ma_de=$1`, [ma]); ok(e1, "anon đọc được dap_an_de");
  const e2 = await thu(`select noi_dung from public.de_thi where ma=$1`, [ma]); ok(e2, "anon đọc thẳng được de_thi");
  // Mở đề ngay bây giờ (chỉ trên máy), giữ độ dài như thật
  await db.query(`update public.de_thi set dong = now() + (dong - mo), mo = now() - interval '1 min' where ma=$1`, [ma]);
  const vao = (await anon(`select public.ld_bat_dau($1,$2) r`, [mr, ma]))[0].r, chuVao = JSON.stringify(vao);
  for (const [k, c] of Object.entries(da.cau)) {
    for (const x of c.dapAn || []) if (x.length > 3) ok(!chuVao.includes(JSON.stringify(x)), `đáp án ${k} lộ khi vào đề`);
    ok(!/"dung"\s*:|"giaiThich"|"chapNhan"/.test(chuVao), "đề gửi về có trường đáp án");
    const goc = d.phan.flatMap((p) => p.muc).find((m) => m.id === k); ok(goc && goc.loai === c.loai, `câu ${k} lệch loại hoặc thiếu trong đề`);
  }
  // Học sinh An làm đúng hết; Bình làm sai hết
  const dung = {}, sai = {};
  for (const [k, c] of Object.entries(da.cau)) {
    if (c.loai === "chon") { dung[k] = String(c.dung); sai[k] = String((c.dung + 1) % 4); }
    else if (c.loai === "dien") { dung[k] = c.dapAn[0]; sai[k] = ""; }
    else if (c.loai === "viet") { dung[k] = c.chapNhan[0]; sai[k] = ""; }
  }
  const kq = (await anon(`select public.ld_nop($1,$2,$3::jsonb) r`, [mr, ma, JSON.stringify(dung)]))[0].r;
  await anon(`select public.ld_bat_dau($1,$2)`, [ms, ma]);
  const kqS = (await anon(`select public.ld_nop($1,$2,$3::jsonb) r`, [ms, ma, JSON.stringify(sai)]))[0].r;
  const toiDa = Object.values(da.cau).reduce((s, c) => s + c.diem, 0);
  ok(Number(kq.diemMay) === toiDa && Number(kq.toiDaMay) === toiDa, `làm đúng hết chỉ được ${kq.diemMay}/${kq.toiDaMay} (tối đa ${toiDa})`);
  ok(Number(kqS.diemMay) === 0, `làm sai hết vẫn được ${kqS.diemMay}`);
  ok(kq.chiTiet === null && kq.de === null, "lời giải hiện trước giờ đóng");
  const nhan = (await db.query(`select c.ma_cau, c.nhom_mon, c.ma_chu_de, c.ma_ky_nang, c.bloom, c.dung, b.loai, b.do_tin_cay, b.tuan
    from public.cau_tra_loi c join public.bai_lam b on b.id=c.bai_lam_id join public.hoc_sinh h on h.id=b.hoc_sinh_id where b.ma_bai=$1 and h.ma_hs='MAU-02'`, [ma])).rows;
  ok(nhan.length === Object.keys(da.cau).length, `hồ sơ có ${nhan.length} câu, đề có ${Object.keys(da.cau).length}`);
  for (const n of nhan) ok(n.nhom_mon && n.ma_chu_de && n.ma_ky_nang && n.bloom && n.dung === true && n.loai === "tang3" && n.do_tin_cay === 2, `câu ${n.ma_cau} thiếu nhãn: ${JSON.stringify(n)}`);
  // Sau giờ đóng: lời giải hiện
  await db.query(`update public.de_thi set dong = now() - interval '1 second' where ma=$1`, [ma]);
  const sau = (await anon(`select public.ld_ket_qua($1,$2) r`, [mr, ma]))[0].r;
  ok(sau.chiTiet && Object.keys(sau.chiTiet).length === Object.keys(da.cau).length, "sau giờ đóng chưa hiện lời giải từng câu");
  const e3 = await thu(`select public.ld_bat_dau($1,$2)`, ["thu99zzzzzzzzzzzzzzzzzzzzzz", ma]); ok(e3, "mã lạ vào được đề");
  console.log(`   An ${kq.diemMay}/${toiDa}, Bình ${kqS.diemMay}/${toiDa}; hồ sơ An: ${nhan.length} câu, nhãn ${[...new Set(nhan.map((n) => n.ma_chu_de))].join("/")} · ${[...new Set(nhan.map((n) => n.ma_ky_nang))].join("/")} · ${[...new Set(nhan.map((n) => n.bloom))].join("/")}`);
}
console.log(hong ? `\n${hong} chỗ HỎNG.` : `\n${de.length} đề: đạt hết.`);
process.exit(hong ? 1 : 0);
