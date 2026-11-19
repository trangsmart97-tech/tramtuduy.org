// Đưa một đề từ "08 CHỜ ĐĂNG WEB/" lên luyende (Supabase).
//
//   node dang_de.mjs --de "<thư mục dự án>/08 CHỜ ĐĂNG WEB/de-dau-vao.json" \
//     --mo 2026-12-09T19:45+07:00 --dong 2026-12-09T21:15+07:00 [--ma-phong 1234] [--loai dau_vao] [--tuan 0] [--do-tin-cay 1]
//
// Tệp đáp án là tệp cùng tên đuôi .dapan.json đặt cạnh (đổi bằng --dap-an). Hình và bản ghi đọc theo đường dẫn
// ghi trong đề (ví dụ "hinh/dau-vao-tn03.svg"), tính từ thư mục của tệp đề.
//
// Công cụ làm bốn việc, chưa đưa gì lên mạng:
//   1. Chỉ nhận tệp nằm trong "08 CHỜ ĐĂNG WEB/" (luật 5 của bản chốt). Muốn thử tệp nháp thì thêm --thu.
//   2. Kiểm đề bằng đúng hàm noi_bo.ld_kiem_de trên Postgres cục bộ (lược đồ và danh mục của kho này). Có lỗi thì dừng.
//   3. Kiểm đủ tệp hình và bản ghi.
//   4. Viết một tệp SQL vào supabase/.temp/ (thư mục không vào git, vì tệp chứa đáp án). Tệp SQL tự kiểm đề lần nữa
//      trên máy chủ và huỷ cả lần đăng nếu có lỗi; đề đã có lượt thi thì không cho ghi đè.
// Đưa lên thật: chạy lệnh in ra ở cuối (supabase db query), chỉ khi cô Trang đã cho phép.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "fs"; import path from "path"; import crypto from "crypto"; import { fileURLToPath } from "url";

const KHO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const thamSo = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (!k.startsWith("--")) continue;
  const v = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
  thamSo[k.slice(2)] = v;
}
const dung = (chu) => { console.error("DỪNG: " + chu); process.exit(1); };
if (!thamSo.de || !thamSo.mo || !thamSo.dong) dung("cần --de, --mo, --dong. Xem đầu tệp này.");

const tepDe = path.resolve(thamSo.de);
const tepDa = path.resolve(thamSo["dap-an"] || tepDe.replace(/\.json$/, ".dapan.json"));
if (!thamSo.thu && !tepDe.split(path.sep).includes("08 CHỜ ĐĂNG WEB")) dung("tệp đề không nằm trong “08 CHỜ ĐĂNG WEB/”. Chỉ đề đã duyệt mới được đăng (thêm --thu nếu chỉ thử).");
for (const t of [tepDe, tepDa]) if (!fs.existsSync(t)) dung("không thấy " + t);
const de = JSON.parse(fs.readFileSync(tepDe, "utf8"));
const da = JSON.parse(fs.readFileSync(tepDa, "utf8"));
const ma = de.ma;
if (!/^[a-z0-9-]+$/.test(ma || "")) dung("tệp đề thiếu “ma” hoặc mã có chữ ngoài a-z, 0-9, gạch nối.");
if (da.ma && da.ma !== ma) dung(`mã đề trong tệp đáp án (${da.ma}) khác tệp đề (${ma}).`);

const moc = (s, ten) => { const t = Date.parse(s); if (isNaN(t) || !/[+-]\d\d:?\d\d$|Z$/.test(s)) dung(`--${ten} phải ghi kèm múi giờ, ví dụ 2026-12-09T19:45+07:00`); return new Date(t).toISOString(); };
const mo = moc(thamSo.mo, "mo"), dong = moc(thamSo.dong, "dong");
if (dong <= mo) dung("--dong phải sau --mo.");
const tongPhut = (de.phan || []).reduce((s, p) => s + Number(p.phut || 0), 0);
if ((Date.parse(dong) - Date.parse(mo)) / 60000 < tongPhut) console.warn(`LƯU Ý: khoảng mở đề ngắn hơn tổng thời gian các phần (${tongPhut} phút).`);
const loai = thamSo.loai || (ma === "dau-vao" ? "dau_vao" : /^moc-/.test(ma) ? "moc" : /^thuc-chien/.test(ma) ? "thuc_chien" : /^tang3-/.test(ma) ? "tang3" : "de");
// Đề có giám sát (đầu vào, Mốc, Thực chiến) không xáo phương án: cô chữa bài theo chữ cái, bản giấy phải khớp bản web
// (tầng 5 lần 2, đề đầu vào, việc 12). Công cụ không bao giờ tự bật xáo; tệp đề tự bật thì dừng, trừ khi cô đã cho phép.
if (de.xaoPhuongAn && ["dau_vao", "moc", "thuc_chien"].includes(loai) && !thamSo["co-cho-xao"])
  dung(`đề ${ma} (loại ${loai}) đang bật xaoPhuongAn. Đề có giám sát giữ nguyên thứ tự phương án. Chỉ thêm --co-cho-xao khi cô Trang đã quyết khác.`);
const doTinCay = Number(thamSo["do-tin-cay"] || (loai === "tang3" ? 2 : 1));
const tuan = thamSo.tuan !== undefined ? Number(thamSo.tuan) : (Number((ma.match(/tuan-(\d+)/) || [])[1]) || null);

// 2. Kiểm đề trên Postgres cục bộ
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
create function auth.jwt() returns jsonb language sql stable as 'select ''{}''::jsonb';`);
const mig = path.join(KHO, "supabase/migrations");
for (const f of fs.readdirSync(mig).sort()) await db.exec(fs.readFileSync(path.join(mig, f), "utf8"));
await db.exec(fs.readFileSync(path.join(KHO, "supabase/seed/01_danh_muc.sql"), "utf8"));
const loi = (await db.query(`select noi_bo.ld_kiem_de($1,$2) l`, [de, da])).rows.map((r) => r.l);
if (loi.length) { console.error(`Đề ${ma} có ${loi.length} lỗi:`); loi.forEach((l) => console.error("  - " + l)); dung("sửa tệp đề rồi chạy lại."); }

// 3. Tệp hình và bản ghi
const LOAI_TEP = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg" };
const tenTep = new Set();
for (const p of de.phan) for (const m of p.muc) for (const k of ["hinh", "audio"]) if (m[k]) tenTep.add(m[k]);
const tep = [...tenTep].map((ten) => {
  const duongDan = path.resolve(path.dirname(tepDe), ten);
  if (!duongDan.startsWith(path.dirname(tepDe))) dung(`đường dẫn tệp “${ten}” ra ngoài thư mục đề.`);
  if (!fs.existsSync(duongDan)) dung(`thiếu tệp “${ten}” (tìm ở ${duongDan}).`);
  const kieu = LOAI_TEP[path.extname(ten).toLowerCase()];
  if (!kieu) dung(`không nhận loại tệp “${ten}”.`);
  const b = fs.readFileSync(duongDan);
  if (b.length > 15_000_000) dung(`tệp “${ten}” lớn quá 15 MB.`);
  return { ten, kieu, b64: b.toString("base64"), co: b.length };
});

// 4. Viết tệp SQL
const the = "$j" + crypto.randomBytes(6).toString("hex") + "$";
const chuoi = (s) => (s === null || s === undefined ? "null" : "'" + String(s).replace(/'/g, "''") + "'");
const json = (o) => { const s = JSON.stringify(o); if (s.includes(the)) dung("nội dung trùng thẻ trích dẫn, chạy lại."); return `${the}${s}${the}::jsonb`; };
const sql = `-- Đăng đề ${ma}, sinh bởi cong-cu/luyen-de/dang_de.mjs lúc ${new Date().toISOString()}.
-- TỆP NÀY CHỨA ĐÁP ÁN. Không đưa vào git, không gửi đi. Xoá sau khi đăng.
begin;
do $kiem$ begin
  if exists (select 1 from public.luot_thi where ma_de = ${chuoi(ma)}) then
    raise exception 'Đề ${ma} đã có lượt thi. Không ghi đè; muốn sửa thì làm tay sau khi cô quyết.';
  end if;
end $kiem$;
insert into public.de_thi (ma, tieu_de, loai, do_tin_cay, tuan, mo, dong, ma_phong, noi_dung)
values (${chuoi(ma)}, ${chuoi(de.tieuDe || ma)}, ${chuoi(loai)}, ${doTinCay}, ${tuan ?? "null"}, ${chuoi(mo)}, ${chuoi(dong)}, ${chuoi(thamSo["ma-phong"] && thamSo["ma-phong"] !== true ? thamSo["ma-phong"] : null)}, ${json(de)})
on conflict (ma) do update set tieu_de = excluded.tieu_de, loai = excluded.loai, do_tin_cay = excluded.do_tin_cay, tuan = excluded.tuan,
  mo = excluded.mo, dong = excluded.dong, ma_phong = excluded.ma_phong, noi_dung = excluded.noi_dung;
insert into public.dap_an_de (ma_de, noi_dung) values (${chuoi(ma)}, ${json(da)})
on conflict (ma_de) do update set noi_dung = excluded.noi_dung;
delete from public.tep_de where ma_de = ${chuoi(ma)};
${tep.map((t) => `insert into public.tep_de (ma_de, ten, loai, du_lieu) values (${chuoi(ma)}, ${chuoi(t.ten)}, ${chuoi(t.kieu)}, decode('${t.b64}', 'base64'));`).join("\n")}
do $kiem$ declare n int; begin
  select count(*) into n from noi_bo.ld_kiem_de((select noi_dung from public.de_thi where ma = ${chuoi(ma)}), (select noi_dung from public.dap_an_de where ma_de = ${chuoi(ma)}));
  if n > 0 then raise exception 'Máy chủ kiểm đề ${ma} thấy % lỗi. Huỷ lần đăng.', n; end if;
end $kiem$;
commit;
`;
const thuMucRa = path.join(KHO, "supabase/.temp");
fs.mkdirSync(thuMucRa, { recursive: true });
const tepRa = path.join(thuMucRa, `dang-de-${ma}.sql`);
fs.writeFileSync(tepRa, sql, { mode: 0o600 });

// Thử chạy tệp SQL trên Postgres cục bộ để chắc chắn nó chạy được.
await db.exec(sql);
const daDang = (await db.query(`select (select count(*) from public.tep_de where ma_de=$1)::int tep, (select tieu_de from public.de_thi where ma=$1) ten`, [ma])).rows[0];

const soCau = de.phan.reduce((s, p) => s + p.muc.filter((m) => m.loai !== "doan").length, 0);
console.log(`Đề “${daDang.ten}” (mã ${ma}) đạt kiểm.`);
console.log(`  ${de.phan.length} phần, ${soCau} câu, ${tongPhut} phút; loại ${loai}, độ tin cậy ${doTinCay}${tuan !== null ? ", tuần " + tuan : ""}.`);
console.log(`  Mở ${mo}, đóng ${dong}${thamSo["ma-phong"] && thamSo["ma-phong"] !== true ? ", có mã phòng thi" : ", không mã phòng thi"}.`);
console.log(`  ${daDang.tep} tệp hình và bản ghi, tổng ${Math.round(tep.reduce((s, t) => s + t.co, 0) / 1024)} KB.`);
console.log(`  Đã chạy thử tệp SQL trên Postgres cục bộ: được.`);
console.log(`\nTệp SQL: ${tepRa}`);
console.log(`Đưa lên thật (chỉ khi cô Trang đã cho phép), từ thư mục cong-tramtuduy:`);
console.log(`  supabase db query --remote=pqildzyhzpudfkjinhyx -f "supabase/.temp/dang-de-${ma}.sql" && rm "supabase/.temp/dang-de-${ma}.sql"`);
