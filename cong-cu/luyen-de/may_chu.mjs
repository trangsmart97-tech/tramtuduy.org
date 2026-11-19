// Máy chủ thử: phát trang luyende và đóng vai Supabase (chỉ phần /rest/v1/rpc/ld_*), dữ liệu trong PGlite.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import http from "http"; import fs from "fs"; import path from "path";
const [, , REPO, DA, WEB] = process.argv, CONG = Number(process.env.CONG || 8767);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
create function auth.jwt() returns jsonb language sql stable as 'select coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb';
grant usage on schema auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public to anon, authenticated;`);
const mig = path.join(REPO, "supabase/migrations");
for (const f of fs.readdirSync(mig).sort()) await db.exec(fs.readFileSync(path.join(mig, f), "utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
for (const f of ["01_danh_muc.sql", "02_hoc_sinh_mau.sql"]) await db.exec(fs.readFileSync(path.join(REPO, "supabase/seed", f), "utf8"));
// Đối số 6, 7 (tuỳ chọn): tệp đề và tệp đáp án khác đề mẫu, đường dẫn tính từ thư mục dự án.
// Đối số 8 (tuỳ chọn): số phút nữa thì Phần 2 mở theo giờ chung (thử "moLuc").
const tepDe = process.argv[5] || "de-mau (1).json", tepDa = process.argv[6] || "de-mau.dapan.json";
const doc = p => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(DA, p), "utf8"));
const de = doc(tepDe), da = doc(tepDa);
if (process.env.XAO || process.argv[8] === "xao") de.xaoPhuongAn = true;
const nhan = { "Toán": "TO04", "Tiếng Anh": "TA03", "Tiếng Việt": "TV02", "Khoa học": "KH01", "Lịch sử và Địa lý": "LS03" };
for (const k of Object.values(da.cau)) { k.chuDe = k.chuDe || nhan[k.nhom]; k.kyNang = k.kyNang || "KN01"; k.bloom = k.bloom || "Hiểu"; }
// Đối số 12 = "anTho": đánh dấu khối bài đọc đầu tiên "anSauThi": true (thử khối ẩn sau giờ thi).
if (process.argv[12] === "anTho") { const k = de.phan.flatMap(p => p.muc).find(m => m.loai === "doan"); if (k) k.anSauThi = true; }
// Đối số 11 = "nopAnh": thử giờ gửi ảnh với giờ rút ngắn (Phần 1: nửa phút, phần cuối: 1 phút làm + 2 phút gửi ảnh).
if (process.argv[11] === "nopAnh") { de.phan[0].phut = 0.5; de.phan[de.phan.length - 1].phut = 1; de.phan[de.phan.length - 1].phutNopAnh = 2; }
// Đối số 10 (tuỳ chọn): số phút nữa thì Phần 1 đóng chung cho mọi bạn (thử "dongLuc").
if (process.argv[10]) de.phan[0].dongLuc = new Date(Date.now() + Number(process.argv[10]) * 60000).toISOString();
if (process.argv[7] && de.phan[1]) de.phan[1].moLuc = new Date(Date.now() + Number(process.argv[7]) * 60000).toISOString();
const maDe = /^[a-z0-9-]+$/.test(de.ma || "") ? de.ma : "de-mau";
await db.query(`insert into public.de_thi (ma, tieu_de, loai, mo, dong, ma_phong, noi_dung) values ($4,$1,'dau_vao', now() - interval '5 min', now() + make_interval(mins => $3), '1234', $2)`, [de.tieuDe, de, Number(process.argv[9] || process.env.PHUT_DONG || 120), maDe]);
await db.query(`insert into public.dap_an_de values ($1, $2)`, [maDe, da]);
console.log("ma de: " + maDe);
await db.exec(`insert into public.ma_thi (hoc_sinh_id, ma) select id, 'thu0an0000000000000000000001' from public.hoc_sinh where ma_hs = 'MAU-02';
               insert into public.ma_thi (hoc_sinh_id, ma) select id, 'thu0binh00000000000000000002' from public.hoc_sinh where ma_hs = 'MAU-03';
               set role anon;`);
// Một cô thử (quản trị) để thử trang Luyện đề trên cổng: mọi lần gọi ld_co_* đóng vai cô này. Chỉ có trên máy thử.
await db.exec(`reset role; insert into public.nhan_su (email, ho_ten, vai, quan_tri) values ('co.thu@vi-du.test', 'Cô thử', 'giang_day', true); set role anon;`);
const KIEU = { p_tra_loi: "jsonb", p_su_kien: "jsonb", p_phan: "int", p_id: "uuid", p_diem: "numeric", p_hoc_sinh: "uuid", p_doi: "boolean" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
let hang = Promise.resolve();
http.createServer((q, a) => {
  const u = q.url.split("?")[0];
  if (q.method === "OPTIONS") { a.writeHead(204, CORS); return a.end(); }
  if (q.method === "POST" && u.startsWith("/rest/v1/rpc/ld_")) {
    let than = ""; q.on("data", c => than += c); q.on("end", () => { hang = hang.then(async () => {
      const ham = u.slice(13).replace(/[^a-z_]/g, ""), d = JSON.parse(than || "{}"), ts = [], gt = [];
      for (const [k, v] of Object.entries(d)) { gt.push(typeof v === "object" && v !== null ? JSON.stringify(v) : v); ts.push(`${k.replace(/[^a-z_]/g, "")} => $${gt.length}::${KIEU[k] || "text"}`); }
      const laCo = ham.startsWith("ld_co_");
      try {
        if (laCo) await db.exec(`set role authenticated; select set_config('request.jwt.claims','{"email":"co.thu@vi-du.test"}',false);`);
        const r = await db.query(`select public.${ham}(${ts.join(", ")}) as r`, gt);
        a.writeHead(200, { "Content-Type": "application/json", ...CORS }); a.end(JSON.stringify(r.rows[0].r));
      } catch (e) { a.writeHead(400, { "Content-Type": "application/json", ...CORS }); a.end(JSON.stringify({ message: e.message })); }
      finally { if (laCo) await db.exec(`set role anon; select set_config('request.jwt.claims','{}',false);`); }
    }); }); return;
  }
  if (u === "/cau-hinh.js") { a.writeHead(200, { "Content-Type": "text/javascript" }); return a.end(`var CAU_HINH = { supabase: "", khoaCongKhai: "thu" };`); }
  const tep = path.join(WEB, u === "/" ? "index.html" : u);
  if (!tep.startsWith(WEB) || !fs.existsSync(tep)) { a.writeHead(404); return a.end(); }
  a.writeHead(200, { "Content-Type": tep.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain; charset=utf-8" }); a.end(fs.readFileSync(tep));
}).listen(CONG, () => console.log("san sang " + CONG));
