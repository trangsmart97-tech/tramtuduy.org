// Đưa một bài nghe từ "08 CHỜ ĐĂNG WEB/LUYỆN NGHE/" lên luyennghe (QĐ-032).
//
//   node dang_bai_nghe.mjs --bai "<thư mục dự án>/08 CHỜ ĐĂNG WEB/LUYỆN NGHE/tuan-01-bai-1.json" \
//     --kho ~/Desktop/luyennghechatluongcao [--thu]
//
// Tệp bài đầy đủ có dạng như bai/bai-mau.json của kho luyennghe (dienTu, tracNghiem, banChepLoi, cumTu, nguon),
// mỗi câu thêm "nhan": { "chuDe": "TA21", "kyNang": "KN09", "bloom": "Hiểu" }. Thiếu nhãn thì dùng nhãn mặc định:
//   câu điền: TA21, KN09, Hiểu; câu chọn: TA22 nếu kỹ năng là “hiểu ý chính”, còn lại TA21; KN03; Hiểu.
//
// Công cụ làm bốn việc, chưa đưa gì lên mạng:
//   1. Chỉ nhận tệp nằm trong "08 CHỜ ĐĂNG WEB/" (thêm --thu để thử tệp nháp).
//   2. Kiểm đáp án bằng đúng hàm noi_bo.ln_kiem_bai trên Postgres cục bộ. Có lỗi thì dừng.
//   3. Viết phần công khai (không đáp án, không lời giải, không bản chép lời) vào <kho>/bai/<mã>.json và thêm bài vào
//      <kho>/bai/danh-sach.json. Kiểm có tệp bản ghi trong <kho>/media/.
//   4. Viết tệp SQL đáp án vào supabase/.temp/ (không vào git). Đưa lên thật: chạy lệnh in ra ở cuối, chỉ khi cô cho phép.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";

const KHO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const thamSo = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i]; if (!k.startsWith("--")) continue;
  thamSo[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
}
const dung = (chu) => { console.error("DỪNG: " + chu); process.exit(1); };
if (!thamSo.bai || !thamSo.kho) dung("cần --bai và --kho. Xem đầu tệp này.");
const tepBai = path.resolve(thamSo.bai), khoNghe = path.resolve(thamSo.kho.replace(/^~/, process.env.HOME));
if (!thamSo.thu && !tepBai.split(path.sep).includes("08 CHỜ ĐĂNG WEB")) dung("tệp bài không nằm trong “08 CHỜ ĐĂNG WEB/” (thêm --thu nếu chỉ thử).");
if (!fs.existsSync(path.join(khoNghe, "nghe.html"))) dung("--kho không phải kho luyennghe: " + khoNghe);
const bai = JSON.parse(fs.readFileSync(tepBai, "utf8"));
const ma = bai.ma;
if (!/^[a-z0-9-]+$/.test(ma || "")) dung("tệp bài thiếu “ma” hoặc mã có chữ ngoài a-z, 0-9, gạch nối.");
if (bai.laBaiMau) dung("đây là bài mẫu, không đăng lên máy chủ.");
if (!bai.nguon || !bai.nguon.ten || !bai.nguon.giayPhep) dung("tệp bài thiếu nguồn hoặc giấy phép của bản ghi.");

// Đáp án cho máy chủ: mã câu dt1, dt2… và tn1, tn2… đúng như trang nghe gửi lên.
const nhanMacDinh = (loai, c) => loai === "dien" ? { chuDe: "TA21", kyNang: "KN09", bloom: "Hiểu" }
  : { chuDe: /ý chính/.test(c.kyNang || "") ? "TA22" : "TA21", kyNang: "KN03", bloom: "Hiểu" };
const cau = {}; const dungMacDinh = [];
const themCau = (id, loai, c, rieng) => {
  if (!c.nhan) dungMacDinh.push(id);
  const n = { ...nhanMacDinh(loai, c), ...(c.nhan || {}) };
  cau[id] = { loai, diem: 1, nhom: "Tiếng Anh", chuDe: n.chuDe, kyNang: n.kyNang, bloom: n.bloom, ...rieng,
    giaiThich: c.giaiThich || "", meo: c.meo || "", kyNangNghe: c.kyNang || "", doan: c.doan || null };
};
(bai.dienTu || []).forEach((c, i) => themCau("dt" + (i + 1), "dien", c, { dapAn: [].concat(c.dapAn || []), toiDaTu: 4 }));
(bai.tracNghiem || []).forEach((c, i) => themCau("tn" + (i + 1), "chon", c, { dung: c.dung }));
const da = { tieuDe: bai.tieuDe, tuan: bai.tuan, banChepLoi: bai.banChepLoi, cau };

// 2. Kiểm trên Postgres cục bộ
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
create function auth.jwt() returns jsonb language sql stable as 'select ''{}''::jsonb';`);
const mig = path.join(KHO, "supabase/migrations");
for (const f of fs.readdirSync(mig).sort()) await db.exec(fs.readFileSync(path.join(mig, f), "utf8"));
await db.exec(fs.readFileSync(path.join(KHO, "supabase/seed/01_danh_muc.sql"), "utf8"));
const loi = (await db.query(`select noi_bo.ln_kiem_bai($1) l`, [da])).rows.map((r) => r.l);
const quaDai = Object.entries(cau).filter(([, k]) => k.loai === "dien" && k.dapAn.some((d) => d.trim().split(/\s+/).length > 4)).map(([id]) => id);
if (quaDai.length) loi.push(`Câu ${quaDai.join(", ")}: có đáp án dài quá 4 từ.`);
if (loi.length) { loi.forEach((l) => console.error("  - " + l)); dung(`bài ${ma} có ${loi.length} lỗi.`); }

// 3. Phần công khai
const media = String(bai.media || "");
if (!media || !fs.existsSync(path.join(khoNghe, media))) dung(`chưa có tệp bản ghi ${media || "(media trống)"} trong kho luyennghe.`);
const boDapAn = (c) => { const { dapAn, dung: _d, giaiThich, meo, doan, nhan, ...con } = c; return con; };
const congKhai = { ma, tieuDe: bai.tieuDe, tuan: bai.tuan, bac: bai.bac, giong: bai.giong, thoiLuong: bai.thoiLuong, media,
  nguon: bai.nguon, viDu: bai.viDu, dienTu: (bai.dienTu || []).map(boDapAn), tracNghiem: (bai.tracNghiem || []).map(boDapAn),
  cumTu: bai.cumTu || [] };
const chuoiCK = JSON.stringify({ ...congKhai, viDu: null });  // câu ví dụ được phép hiện sẵn đáp án
for (const k of Object.values(cau)) for (const d of [].concat(k.dapAn || [])) {
  // So theo từ trọn vẹn: “run” không trùng “runner”, nhưng “sensors” trong câu khác vẫn bị bắt.
  const mau = new RegExp("(^|[^a-z0-9])" + String(d).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
  if (d && congKhai.dienTu.some((c) => mau.test(String(c.cau).toLowerCase()))) dung(`đáp án “${d}” còn nằm trong câu hỏi công khai.`);
}
if (/banChepLoi|"dapAn"|"dung"|giaiThich/.test(chuoiCK)) dung("phần công khai còn dòng đáp án hoặc lời giải.");
fs.writeFileSync(path.join(khoNghe, "bai", ma + ".json"), JSON.stringify(congKhai, null, 2) + "\n");
const tepDs = path.join(khoNghe, "bai/danh-sach.json");
const ds = JSON.parse(fs.readFileSync(tepDs, "utf8")).filter((b) => b.ma !== ma && b.ma !== "bai-mau");
ds.push({ ma, tieuDe: bai.tieuDe, tuan: bai.tuan, bac: bai.bac, giong: bai.giong, thoiLuong: bai.thoiLuong });
ds.sort((a, b) => a.tuan - b.tuan || a.ma.localeCompare(b.ma));
fs.writeFileSync(tepDs, JSON.stringify(ds, null, 2) + "\n");

// 4. SQL đáp án
const chuoi = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sql = `-- Đáp án bài nghe ${ma}. Tệp chứa đáp án: không đưa vào git.
begin;
insert into public.dap_an_nghe (ma_bai, noi_dung) values (${chuoi(ma)}, ${chuoi(JSON.stringify(da))}::jsonb)
on conflict (ma_bai) do update set noi_dung = excluded.noi_dung;
do $kiem$ declare n int; begin
  select count(*) into n from noi_bo.ln_kiem_bai((select noi_dung from public.dap_an_nghe where ma_bai = ${chuoi(ma)}));
  if n > 0 then raise exception 'Máy chủ kiểm bài nghe ${ma} thấy % lỗi. Huỷ lần đăng.', n; end if;
end $kiem$;
commit;
`;
await db.exec(sql);
const thuMucRa = path.join(KHO, "supabase/.temp"); fs.mkdirSync(thuMucRa, { recursive: true });
const tepRa = path.join(thuMucRa, `dang-nghe-${ma}.sql`);
fs.writeFileSync(tepRa, sql, { mode: 0o600 });

console.log(`Bài nghe “${bai.tieuDe}” (mã ${ma}) đạt kiểm: ${bai.dienTu?.length || 0} câu điền, ${bai.tracNghiem?.length || 0} câu chọn, tuần ${bai.tuan}.`);
if (dungMacDinh.length) console.log(`  Dùng nhãn mặc định cho: ${dungMacDinh.join(", ")}.`);
console.log(`  Đã viết bai/${ma}.json (không đáp án) và cập nhật danh-sach.json trong ${khoNghe}.`);
console.log(`\nTệp SQL: ${tepRa}`);
console.log(`Đưa lên thật (chỉ khi cô Trang đã cho phép), từ thư mục cong-tramtuduy:`);
console.log(`  supabase db query --remote=pqildzyhzpudfkjinhyx -f "supabase/.temp/dang-nghe-${ma}.sql" && rm "supabase/.temp/dang-nghe-${ma}.sql"`);
