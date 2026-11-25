// Thử migration luyện đề trên Postgres cục bộ (PGlite). Đối số: thư mục cong-tramtuduy, thư mục dự án.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "fs"; import path from "path"; import vm from "vm";
const [, , REPO, DA] = process.argv;
const db = new PGlite({ extensions: { pgcrypto } });
let soLoi = 0, soDat = 0;
const kiem = (dk, ten, chi) => { if (dk) { soDat++; } else { soLoi++; console.log("  SAI:", ten, chi === undefined ? "" : JSON.stringify(chi).slice(0, 400)); } };
const mot = async (sql, p) => (await db.query(sql, p)).rows;
const goi = async (ham, ...args) => {
  const ph = args.map((_, i) => "$" + (i + 1)).join(",");
  try { return { kq: (await mot(`select public.${ham}(${ph}) as r`, args))[0].r }; }
  catch (e) { return { loi: e.message }; }
};
const vaiKhach = () => db.exec(`set role anon; select set_config('request.jwt.claims','{}',false);`);
const vaiGoc = () => db.exec(`reset role;`);

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public to anon, authenticated;`);
const mig = path.join(REPO, "supabase/migrations");
for (const f of fs.readdirSync(mig).sort()) { await db.exec(fs.readFileSync(path.join(mig, f), "utf8")); console.log("nạp", f); }
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
for (const f of ["01_danh_muc.sql", "02_hoc_sinh_mau.sql"]) await db.exec(fs.readFileSync(path.join(REPO, "supabase/seed", f), "utf8"));

// Đề mẫu, đáp án mẫu gắn thêm ba nhãn để thử
const de = JSON.parse(fs.readFileSync(path.join(DA, "de-mau (1).json"), "utf8"));
const daGoc = JSON.parse(fs.readFileSync(path.join(DA, "de-mau.dapan.json"), "utf8"));
const nhan = { "Toán": ["TO04", "Vận dụng"], "Tiếng Anh": ["TA03", "Hiểu"], "Tiếng Việt": ["TV02", "Hiểu"], "Khoa học": ["KH01", "Nhớ"] };
const da = JSON.parse(JSON.stringify(daGoc));
for (const k of Object.values(da.cau)) { k.chuDe = nhan[k.nhom][0]; k.kyNang = "KN01"; k.bloom = nhan[k.nhom][1]; }

console.log("\n1. Kiểm đề trước khi đăng");
const loiGoc = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [de, daGoc])).map(r => r.l);
kiem(loiGoc.length === 3 * Object.keys(daGoc.cau).length, "đề mẫu gốc thiếu ba nhãn ở mọi câu", loiGoc);
const loiMoi = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [de, da])).map(r => r.l);
kiem(loiMoi.length === 0, "đề mẫu đủ nhãn thì không lỗi", loiMoi);
const daHong = JSON.parse(JSON.stringify(da)); delete daHong.cau.tn1; daHong.cau.tn2.chuDe = "XX99"; daHong.cau.tn3.dung = undefined;
const loiHong = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [de, daHong])).map(r => r.l);
kiem(loiHong.length === 3, "bắt được thiếu đáp án, sai mã, thiếu dung", loiHong);

await mot(`insert into public.de_thi (ma, tieu_de, loai, mo, dong, ma_phong, noi_dung) values ('de-mau', $1, 'dau_vao', now() - interval '1 hour', now() + interval '1 hour', '1234', $2)`, [de.tieuDe, de]);
await mot(`insert into public.dap_an_de (ma_de, noi_dung) values ('de-mau', $1)`, [da]);
await mot(`insert into public.tep_de values ('de-mau','hinh.png','image/png', decode('89504e470d0a1a0a','hex'))`);
const hsAn = (await mot(`select id from public.hoc_sinh where ma_hs='MAU-02'`))[0].id;
const hsBinh = (await mot(`select id from public.hoc_sinh where ma_hs='MAU-03'`))[0].id;
await mot(`insert into public.ma_thi (hoc_sinh_id, ma) values ($1, 'thu0an0000000000000000000001'), ($2, default)`, [hsAn, hsBinh]);
const maBinh = (await mot(`select ma from public.ma_thi where hoc_sinh_id=$1`, [hsBinh]))[0].ma;
kiem(/^[0-9a-f]{32}$/.test(maBinh), "mã riêng tự sinh dài 32 ký tự", maBinh);
const MA = "thu0an0000000000000000000001";

console.log("2. Khách không đọc thẳng được bảng kín");
await vaiKhach();
for (const b of ["ma_thi", "de_thi", "dap_an_de", "tep_de", "luot_thi", "anh_nop"]) {
  const n = (await mot(`select count(*)::int n from public.${b}`))[0].n; kiem(n === 0, "khách đọc " + b, n);
}
let r = await goi("ld_vao", "sai-ma", "de-mau"); kiem(/Đường dẫn chưa đúng/.test(r.loi), "mã sai bị chặn", r);
r = await goi("ld_vao", MA, "de-mau"); kiem(r.kq && r.kq.ten === "An" && r.kq.coMaPhong === true && !r.kq.daBatDau, "chào đúng tên", r);
kiem(r.kq && !("de" in r.kq), "màn hình vào chưa phát đề");
r = await goi("ld_bat_dau", MA, "de-mau", "9999"); kiem(/Mã phòng thi chưa đúng/.test(r.loi), "sai mã phòng", r);
r = await goi("ld_tep", MA, "de-mau", "hinh.png"); kiem(/Không tìm thấy lượt thi/.test(r.loi), "chưa bắt đầu thì chưa phát hình", r);
r = await goi("ld_bat_dau", MA, "de-mau", "1234");
kiem(r.kq && r.kq.de.phan.length === 2 && r.kq.tiepTuc === false && r.kq.phan === 0, "bắt đầu được", r);
kiem(r.kq && !JSON.stringify(r.kq).includes("giaiThich"), "đề phát ra không lộ đáp án");
r = await goi("ld_tep", MA, "de-mau", "hinh.png"); kiem(r.kq && r.kq.duLieu === "iVBORw0KGgo=", "phát hình", r);
r = await goi("ld_luu", MA, "de-mau", { tn1: 1, tn2: 0 }, [{ loai: "roi", luc: 1 }], 1); kiem(r.kq && r.kq.ok, "lưu bài", r);
r = await goi("ld_bat_dau", MA, "de-mau", "1234");
kiem(r.kq && r.kq.tiepTuc === true && r.kq.traLoi.tn2 === 0 && r.kq.phan === 1, "vào lại thì làm tiếp", r.kq && { t: r.kq.tiepTuc, tl: r.kq.traLoi, p: r.kq.phan });
r = await goi("ld_tai_anh", MA, "de-mau", "tl4", "data:image/jpeg;base64,/9j/4AAQSkZJRg==");
kiem(r.kq && r.kq.id, "nộp ảnh", r);
r = await goi("ld_ket_qua", MA, "de-mau"); kiem(/chưa nộp/.test(r.loi), "chưa nộp thì chưa có kết quả", r);

const traLoi = { tn1: 1, tn2: 0, tn3: 1, tn4: 2, tl1: "Two  books.", tl2: "she visited her grandparents last weekend", tl3: " 29 ", tl4: "Bài viết của con." };
r = await goi("ld_nop", MA, "de-mau", traLoi, []);
const kqNop = r.kq;
kiem(kqNop && kqNop.diemMay === 15 && kqNop.toiDaMay === 17 && kqNop.soCauChoCham === 1 && kqNop.chiTiet === null, "nộp và chấm", r);
r = await goi("ld_nop", MA, "de-mau", traLoi, []); kiem(r.kq && r.kq.diemMay === 15, "bấm nộp lần hai không hỏng", r);
r = await goi("ld_luu", MA, "de-mau", {}, [], 0); kiem(r.kq && r.kq.daNop === true, "lưu sau khi nộp bị bỏ qua", r);
r = await goi("ld_tai_anh", MA, "de-mau", "tl4", "/9j/4AAQ"); kiem(/đã nộp bài/.test(r.loi), "nộp ảnh sau khi nộp bị chặn", r);
r = await goi("ld_bat_dau", MA, "de-mau", "1234"); kiem(/đã nộp/.test(r.loi), "không vào lại sau khi nộp", r);

console.log("3. Kết quả về hồ sơ");
await vaiGoc();
const bai = await mot(`select * from public.bai_lam where hoc_sinh_id=$1 and ma_bai='de-mau'`, [hsAn]);
kiem(bai.length === 1 && Number(bai[0].diem) === 15 && Number(bai[0].diem_toi_da) === 25 && bai[0].do_tin_cay === 1 && bai[0].loai === "dau_vao", "một dòng bai_lam đúng điểm", bai);
const cau = await mot(`select * from public.cau_tra_loi where bai_lam_id=$1 order by ma_cau`, [bai[0].id]);
kiem(cau.length === 8 && cau.every(c => c.nhom_mon && c.ma_chu_de && c.ma_ky_nang && c.bloom), "tám câu đủ bốn nhãn", cau);
kiem(cau.find(c => c.ma_cau === "tn2").dung === false && cau.find(c => c.ma_cau === "tl1").dung === true && cau.find(c => c.ma_cau === "tl4").dung === null, "đúng sai từng câu");
const ct = await mot(`select * from public.cham_tay where bai_lam_id=$1`, [bai[0].id]);
kiem(ct.length === 1 && ct[0].ma_cau === "tl4" && Number(ct[0].diem_toi_da) === 8, "câu tự luận vào cham_tay", ct);
const lt = (await mot(`select * from public.luot_thi where hoc_sinh_id=$1`, [hsAn]))[0];
kiem(lt.nop && lt.nop_muon === false && lt.bai_lam_id === bai[0].id, "lượt thi đóng đúng", lt);

console.log("4. Phụ huynh không xem được bài của con nhà khác");
await mot(`update public.hoc_sinh set la_mau=false where id=$1`, [hsAn]);
await mot(`insert into public.gia_dinh (email, hoc_sinh_id) values ('ba.binh@vi-du.test', $1)`, [hsBinh]);
await db.exec(`set role authenticated; select set_config('request.jwt.claims','{"email":"ba.binh@vi-du.test"}',false);`);
kiem((await mot(`select count(*)::int n from public.bai_lam where hoc_sinh_id=$1`, [hsAn]))[0].n === 0, "ba của Bình không thấy bài của An");
kiem((await mot(`select count(*)::int n from public.cau_tra_loi`))[0].n >= 0, "đọc được bảng câu (bằng luật)");
await vaiGoc();
await mot(`insert into public.gia_dinh (email, hoc_sinh_id) values ('me.an@vi-du.test', $1)`, [hsAn]);
await db.exec(`set role authenticated; select set_config('request.jwt.claims','{"email":"me.an@vi-du.test"}',false);`);
kiem((await mot(`select count(*)::int n from public.cau_tra_loi where bai_lam_id=$1`, [bai[0].id]))[0].n === 8, "mẹ của An thấy tám câu");
kiem((await mot(`select count(*)::int n from public.dap_an_de`))[0].n === 0, "phụ huynh không đọc được đáp án");
await vaiGoc();

console.log("5. Hết giờ");
await vaiKhach();
r = await goi("ld_bat_dau", maBinh, "de-mau", "1234"); kiem(r.kq && r.kq.de, "Bình bắt đầu khi đề còn mở", r.loi);
await goi("ld_luu", maBinh, "de-mau", { tn1: 1, tn3: 1 }, [], 0);
await vaiGoc();
const hsChi = (await mot(`select id from public.hoc_sinh where ma_hs='MAU-04'`))[0].id;
await mot(`insert into public.ma_thi (hoc_sinh_id, ma) values ($1, 'thu0chi000000000000000000004')`, [hsChi]);
await mot(`update public.de_thi set dong = now() - interval '3 minute', mo = now() - interval '2 hour'`);
await vaiKhach();
r = await goi("ld_ket_qua", MA, "de-mau"); kiem(r.kq && r.kq.chiTiet && r.kq.chiTiet.tn2.dung === false && r.kq.chiTiet.tn2.dapAn === 2, "hết giờ thì mở đáp án", r);
const deKq = r.kq && r.kq.de;
kiem(deKq && deKq.phan.length === 2 && deKq.phan[1].muc.length === 5 && deKq.phan[1].muc[0].loai === "doan" && JSON.stringify(deKq).includes("school library opens"),
  "đề gửi kèm kết quả còn bài đọc không đánh dấu (để con đọc lại khi xem lời giải)", deKq && deKq.phan.map(p => p.muc.map(m => m.loai)));
{
  const deAn = { ma: "x", tieuDe: "x", phan: [{ ten: "P", phut: 5, muc: [
    { loai: "doan", tieuDe: "Rùa biển", noiDung: "Bài đọc rùa biển", audio: "nghe.mp3", soLanNghe: 2 },
    { loai: "doan", tieuDe: "Trên gác xép", noiDung: "BÀI THƠ KÍN", anSauThi: true },
    { loai: "doan", tieuDe: "Thơ hai", noiDung: "BÀI THƠ KÍN HAI", anSauKetQua: true },
    { loai: "chon", id: "c1", cau: "?", luaChon: ["a", "b"] }] }] };
  await vaiGoc();
  const k = (await mot(`select noi_bo.ld_de_khong_doan($1) k`, [deAn]))[0].k;
  const s = JSON.stringify(k);
  const an2 = k.phan[0].muc.filter(m => m.anSauThi);
  kiem(k.phan[0].muc.length === 4 && s.includes("Bài đọc rùa biển") && !s.includes("BÀI THƠ KÍN") && !s.includes("nghe.mp3") && !s.includes("soLanNghe")
       && an2.length === 2 && an2.every(m => Object.keys(m).sort().join() === "anSauThi,loai,tieuDe") && an2[0].tieuDe === "Trên gác xép",
    "khối anSauThi/anSauKetQua chỉ còn tiêu đề (không nội dung); khối còn lại không kèm bản ghi nghe", k.phan[0].muc);
  const loiMoi2 = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [{ phan: [{ ten: "P1", phut: 5, dongLuc: "20:15", muc: [{ loai: "doan", tieuDe: "T", anSauThi: "co" }] }] }, { cau: {} }])).map(r => r.l);
  kiem(loiMoi2.length === 2 && loiMoi2.some(l => l.includes("dongLuc")) && loiMoi2.some(l => l.includes("anSauThi")), "kiểm đề bắt dongLuc sai dạng và anSauThi không phải true/false", loiMoi2);
  const loiDung = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [{ phan: [{ ten: "P1", phut: 5, dongLuc: "2026-12-09T20:15:00+07:00", muc: [{ loai: "doan", tieuDe: "T", anSauThi: true }] }] }, { cau: {} }])).map(r => r.l);
  kiem(loiDung.length === 0, "dongLuc và anSauThi đúng dạng thì không lỗi", loiDung);
  await vaiKhach();
}
r = await goi("ld_bat_dau", "thu0chi000000000000000000004", "de-mau", "1234"); kiem(/hết giờ/.test(r.loi || ""), "lượt mới sau giờ đóng bị chặn", r);
r = await goi("ld_bat_dau", maBinh, "de-mau", "1234");
kiem(r.kq && r.kq.hetGio === true && r.kq.daNop === true && r.kq.diemMay === 4 && !("batDauPhan" in r.kq) && !("traLoi" in r.kq) && !JSON.stringify(r.kq).includes("audio"), "Bình mở lại sau giờ đóng: máy nộp với phần đã lưu (4 điểm), không phát lại đề", r.kq && { hetGio: r.kq.hetGio, diem: r.kq.diemMay });
await vaiGoc();
kiem((await mot(`select nop_muon from public.luot_thi where hoc_sinh_id=$1`, [hsBinh]))[0].nop_muon === true, "bài của Bình ghi nộp muộn");

console.log("6. Hàm chấm SQL khớp hàm chấm cũ (chamBai) trên 500 bộ trả lời ngẫu nhiên");
const ctx = {}; vm.createContext(ctx);
// Mã chấm cũ (Apps Script) để so khớp; cô đã chuyển thư mục cũ vào "KỶ NIỆM GIẢNG DẠY".
const codeGs = [process.env.CODE_GS, "Desktop/KỶ NIỆM GIẢNG DẠY/luyende/kho-kin/Code.gs", "Desktop/luyende.tramtuduy.org/kho-kin/Code.gs", "Desktop/luyende/kho-kin/Code.gs"]
  .filter(Boolean).map((x) => path.isAbsolute(x) ? x : path.join(process.env.HOME, x)).find((x) => fs.existsSync(x));
if (!codeGs) throw new Error("Không tìm thấy kho-kin/Code.gs (đặt CODE_GS=đường dẫn)");
vm.runInContext(fs.readFileSync(codeGs, "utf8"), ctx);
const mau = { tn1: [0, 1, 2, 3, "", null], tn2: [0, 1, 2, 3], tn3: [1, "1", 3], tn4: [2, 0, ""], tl1: ["two books", "Two books!", "two  books ", "three books", "", "two books is the answer here"],
  tl2: ["She visited her grandparents last weekend.", "she visit her grandparents", "", "  "], tl3: ["29", " 29.", "28", "", "29 "], tl4: ["", "abc"] };
let lech = 0;
for (let i = 0; i < 500; i++) {
  const t = {}; for (const [k, ds] of Object.entries(mau)) { const v = ds[Math.floor(Math.random() * ds.length)]; if (v !== null) t[k] = v; }
  const js = ctx.chamBai(da, t), sq = (await mot(`select noi_bo.ld_cham($1,$2) k`, [da, t]))[0].k;
  const a = JSON.stringify([js.diemMay, js.toiDaMay, js.toiDaCoCham, Object.keys(js.theoNhom).sort().map(n => [n, js.theoNhom[n]])]);
  const b = JSON.stringify([sq.diemMay, sq.toiDaMay, sq.toiDaCoCham, Object.keys(sq.theoNhom).sort().map(n => [n, sq.theoNhom[n]])]);
  if (a !== b) { lech++; if (lech < 4) console.log("  lệch:", JSON.stringify(t), a, b); }
}
kiem(lech === 0, "500 bộ trả lời khớp", lech);

console.log("7. Chuẩn hoá chữ");
const chuan = async s => (await mot(`select noi_bo.ld_chuan($1) c`, [s]))[0].c;
kiem(await chuan("  “Hai QUYỂN sách”. ") === "hai quyển sách", "chữ hoa tiếng Việt, ngoặc kép, dấu chấm", await chuan("  “Hai QUYỂN sách”. "));
kiem(await chuan("7,5") === "7.5" && await chuan("7.5") === "7.5", "7,5 bằng 7.5");
kiem(await chuan("1 234,5 m") === "1 234,5 m", "không đụng chuỗi có chữ");
kiem(await chuan("It’s") === "it's", "nháy cong");
kiem(await chuan("(A)") === "a" && await chuan("A)") === "a" && await chuan(" (B). ") === "b", "ngoặc đơn ở hai đầu: (A), A) khớp A", [await chuan("(A)"), await chuan("A)")]);
{
  const kN = (await mot(`select noi_bo.ld_cham($1,$2) k`, [{ cau: { a9: { loai: "dien", dapAn: ["A", "a"], diem: 1, nhom: "Tiếng Anh" }, a10: { loai: "dien", dapAn: ["C"], diem: 1, nhom: "Tiếng Anh" } } }, { a9: "(A)", a10: "c)" }]))[0].k;
  kiem(kN.diemMay === 2, "câu điền chữ cái: con gõ “(A)” và “c)” đều được điểm", kN.chiTiet);
  kiem(await chuan("f(x)") === await chuan("f(x"), "ngoặc giữa chuỗi không đổi, hai phía chuẩn hoá như nhau");
}

console.log("5b. Bàn làm việc của cô: xem lượt thi, chấm câu tự luận, đường dẫn riêng");
await mot(`insert into public.nhan_su (email, ho_ten, vai, quan_tri) values ('co.cham@vi-du.test','Cô chấm thử','cham_bai',false), ('co.giaovu@vi-du.test','Cô giáo vụ thử','giao_vu',false)`);
const vaiCo = email => db.exec(`set role authenticated; select set_config('request.jwt.claims','{"email":"${email}"}',false);`);
await vaiKhach();
r = await goi("ld_co_de_thi"); kiem(/permission denied/.test(r.loi || ""), "khách không gọi được hàm của cô", r);
await vaiCo("me.an@vi-du.test");
r = await goi("ld_co_de_thi"); kiem(/dành cho các cô/.test(r.loi || ""), "phụ huynh không gọi được hàm của cô", r);
await vaiCo("co.cham@vi-du.test");
r = await goi("ld_co_de_thi"); kiem(r.kq && r.kq.length === 1 && r.kq[0].soNop === 2 && r.kq[0].soChoCham === 2, "cô thấy đề, số bài nộp (An, Bình), số câu chờ chấm", r);
r = await goi("ld_co_luot", "de-mau");
const dongCham = r.kq && r.kq.cham.find(c => c.hoTen === "Học sinh mẫu An");
const luotAn = r.kq && r.kq.luot.find(l => l.hoTen === "Học sinh mẫu An");
kiem(r.kq && r.kq.luot.length === 2 && luotAn && Number(luotAn.diemMay) === 15 && luotAn.choCham === 1, "cô thấy lượt thi của An", r.kq && r.kq.luot);
kiem(dongCham && dongCham.maCau === "tl4" && dongCham.baiLam === "Bài viết của con." && dongCham.anh.length === 1, "cô thấy bài gõ và ảnh của câu tự luận", dongCham);
r = await goi("ld_co_anh", dongCham.anh[0]); kiem(r.kq && r.kq.duLieu === "/9j/4AAQSkZJRg==", "cô xem được ảnh bài làm", r);
r = await goi("ld_co_cham", dongCham.id, 9, "x"); kiem(/từ 0 đến 8/.test(r.loi || ""), "điểm quá tối đa bị chặn", r);
r = await goi("ld_co_cham", dongCham.id, 6, "Con viết đủ ý."); kiem(r.kq && r.kq.ok, "cô chấm 6 trên 8", r);
await vaiGoc();
const baiSau = (await mot(`select diem, ghi_chu from public.bai_lam where id=$1`, [bai[0].id]))[0];
const cauSau = (await mot(`select diem, dung from public.cau_tra_loi where bai_lam_id=$1 and ma_cau='tl4'`, [bai[0].id]))[0];
kiem(Number(baiSau.diem) === 21 && !/còn/.test(baiSau.ghi_chu || ""), "bài làm thành 15 + 6 = 21 điểm, hết câu chờ chấm", baiSau);
kiem(Number(cauSau.diem) === 6 && cauSau.dung === null, "câu tự luận nhận 6 điểm, không tính vào tỉ lệ đúng", cauSau);
await vaiCo("co.cham@vi-du.test");
r = await goi("ld_co_tao_ma"); kiem(/giáo vụ/.test(r.loi || ""), "cô chấm bài không tạo được đường dẫn", r);
await vaiCo("co.giaovu@vi-du.test");
r = await goi("ld_co_cham", dongCham.id, 5, null); kiem(/chấm bài/.test(r.loi || ""), "cô giáo vụ không ghi được điểm", r);
r = await goi("ld_co_tao_ma");
kiem(r.kq && r.kq.length === 6 && r.kq.every(h => /^[0-9a-z]{24,}$/.test(h.ma || "")), "tạo mã cho mọi bạn chưa có mã", r.kq && r.kq.map(h => h.ma));
r = await goi("ld_co_tao_ma", hsAn, true);
const maMoiAn = r.kq && r.kq.find(h => h.id === hsAn).ma;
kiem(maMoiAn && maMoiAn !== MA, "đổi mã của An", maMoiAn);
await vaiKhach();
r = await goi("ld_vao", MA, "de-mau"); kiem(/Đường dẫn chưa đúng/.test(r.loi || ""), "mã cũ của An hết dùng được", r);
r = await goi("ld_vao", maMoiAn, "de-mau"); kiem(r.kq && r.kq.daNop === true, "mã mới của An vào được, thấy đã nộp", r);
await vaiGoc();

console.log("5c. 5 phút gửi ảnh (QĐ-015) và cô nộp giúp lượt còn dở");
{
  await vaiGoc();
  const deA = { ma: "de-anh", tieuDe: "Đề thử gửi ảnh", phan: [
    { ten: "Trắc nghiệm", phut: 1, muc: [{ loai: "chon", id: "a1", luaChon: ["1", "2"] }] },
    { ten: "Tự luận", phut: 1, phutNopAnh: 5, muc: [{ loai: "dien", id: "d1", cau: "2 + 5 = ____" }, { loai: "tuluan", id: "t1", cau: "Viết đoạn văn." }] }] };
  const gocA = { nhom: "Toán", chuDe: "TO04", kyNang: "KN01", bloom: "Hiểu" };
  const daA = { cau: { a1: { ...gocA, loai: "chon", dung: 1, diem: 1 }, d1: { ...gocA, loai: "dien", dapAn: ["7"], diem: 2 }, t1: { ...gocA, loai: "tuluan", diem: 5 } } };
  kiem((await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [deA, daA])).length === 0, "đề có phutNopAnh ở phần cuối: không lỗi");
  const deSai = JSON.parse(JSON.stringify(deA)); deSai.phan[0].phutNopAnh = 5; deSai.phan[1].phutNopAnh = 30; deSai.dongDe = "21:20";
  const loiA = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [deSai, daA])).map(r => r.l);
  kiem(loiA.length === 3, "bắt phutNopAnh ngoài phần cuối, quá 15 phút, dongDe sai dạng", loiA);
  await mot(`insert into public.de_thi (ma, tieu_de, loai, mo, dong, noi_dung) values ('de-anh', 'Đề thử gửi ảnh', 'dau_vao', now() - interval '1 hour', now() + interval '1 hour', $1)`, [deA]);
  await mot(`insert into public.dap_an_de values ('de-anh', $1)`, [daA]);
  const hsDung = (await mot(`select id from public.hoc_sinh where ma_hs='MAU-05'`))[0].id;
  await mot(`insert into public.ma_thi (hoc_sinh_id, ma) values ($1, 'thu0dung00000000000000000005') on conflict (hoc_sinh_id) do update set ma = excluded.ma`, [hsDung]);
  const MC = "thu0chi000000000000000000004", MD = "thu0dung00000000000000000005";
  await vaiKhach();
  r = await goi("ld_khoa", MC, "de-anh", {}, []); kiem(/lượt thi/.test(r.loi || ""), "chưa bắt đầu thì không khoá được", r);
  await goi("ld_bat_dau", MC, "de-anh", null); await goi("ld_bat_dau", MD, "de-anh", null);
  await goi("ld_luu", MC, "de-anh", { a1: 1, d1: "6" }, [], 1);
  r = await goi("ld_khoa", MC, "de-anh", { a1: 1, d1: "7", t1: "Con gõ một ít." }, [{ loai: "roi" }]);
  const khoa1 = r.kq && r.kq.khoaLuc;
  kiem(r.kq && r.kq.ok && khoa1 > 0, "hết giờ làm bài: khoá bài", r);
  r = await goi("ld_khoa", MC, "de-anh", { d1: "999" }, []); kiem(r.kq && r.kq.khoaLuc === khoa1, "khoá lần hai không đổi giờ khoá", r);
  r = await goi("ld_luu", MC, "de-anh", { a1: 0, d1: "999", t1: "sửa sau giờ" }, [{ loai: "roi" }, { loai: "roi" }], 1); kiem(r.kq && r.kq.khoa === true, "lưu sau khi khoá không đổi bài", r);
  r = await goi("ld_bat_dau", MC, "de-anh", null);
  kiem(r.kq && r.kq.khoaLuc === khoa1 && r.kq.traLoi.d1 === "7" && r.kq.phan === 1, "mở lại trong giờ gửi ảnh: biết đã khoá, bài giữ như lúc khoá", r.kq && { k: r.kq.khoaLuc, d1: r.kq.traLoi.d1, p: r.kq.phan });
  r = await goi("ld_tai_anh", MC, "de-anh", "t1", "/9j/4AAQSkZJRg=="); kiem(r.kq && r.kq.id, "trong 5 phút gửi ảnh được", r);
  await vaiGoc(); await mot(`update public.luot_thi set khoa_luc = now() - interval '7 minutes' where hoc_sinh_id = $1 and ma_de = 'de-anh'`, [hsChi]); await vaiKhach();
  r = await goi("ld_tai_anh", MC, "de-anh", "t1", "/9j/4AAQSkZJRg=="); kiem(/hết giờ gửi ảnh/.test(r.loi || ""), "quá 5 phút (thêm 1 phút) thì không nhận ảnh", r);
  r = await goi("ld_nop", MC, "de-anh", { a1: 0, d1: "999" }, []);
  kiem(r.kq && r.kq.diemMay === 3 && r.kq.soCauChoCham === 1, "nộp: chấm phần đã lưu lúc khoá (a1 đúng, d1 = 7), bỏ phần trang gửi sau", r.kq && { d: r.kq.diemMay, c: r.kq.soCauChoCham });
  await vaiGoc();
  const dongAnh = (await mot(`select l.tra_loi, (select count(*)::int from public.anh_nop a where a.luot_thi_id = l.id) anh from public.luot_thi l where hoc_sinh_id = $1 and ma_de = 'de-anh'`, [hsChi]))[0];
  kiem(dongAnh.tra_loi.t1 === "Con gõ một ít." && dongAnh.anh === 1, "bài gõ và ảnh còn nguyên cho cô chấm", dongAnh);
  // Dũng bỏ dở, không mở lại; cô nộp giúp sau giờ đóng
  await vaiCo("co.cham@vi-du.test");
  r = await goi("ld_co_nop_ho", "de-anh"); kiem(/chưa đóng/.test(r.loi || ""), "đề chưa đóng thì chưa nộp giúp", r);
  await vaiGoc(); await mot(`update public.de_thi set dong = now() - interval '3 minutes', mo = now() - interval '2 hours' where ma = 'de-anh'`);
  await vaiCo("co.giaovu@vi-du.test");
  r = await goi("ld_co_nop_ho", "de-anh"); kiem(/chấm bài/.test(r.loi || ""), "cô giáo vụ không nộp giúp được", r);
  await vaiCo("co.cham@vi-du.test");
  r = await goi("ld_co_nop_ho", "de-anh"); kiem(r.kq && r.kq.daNopGiup === 1, "cô chấm bài nộp giúp 1 lượt còn dở", r);
  r = await goi("ld_co_nop_ho", "de-anh"); kiem(r.kq && r.kq.daNopGiup === 0, "nộp giúp lần hai không còn gì", r);
  await vaiKhach();
  r = await goi("ld_tai_anh", MD, "de-anh", "t1", "/9j/4AAQSkZJRg=="); kiem(/đã nộp/.test(r.loi || ""), "sau khi nộp giúp, con không gửi thêm ảnh", r);
  await vaiGoc();
  kiem((await mot(`select count(*)::int n from public.bai_lam where hoc_sinh_id = $1 and ma_bai = 'de-anh'`, [hsDung]))[0].n === 1, "lượt của Dũng đã thành bài làm trong hồ sơ");
}

console.log("5d. Giờ riêng cho từng lượt (QĐ-018): giờ bắt đầu muộn nhất");
{
  await vaiGoc();
  const deM = { ma: "de-muon", tieuDe: "Đề thử giờ riêng", batDauMuonNhat: new Date(Date.now() + 60000).toISOString().replace(/\.\d+Z$/, "Z"),
    phan: [{ ten: "P", phut: 1, muc: [{ loai: "chon", id: "m1", luaChon: ["1", "2"] }] }] };
  const daM = { cau: { m1: { loai: "chon", dung: 1, diem: 1, nhom: "Toán", chuDe: "TO04", kyNang: "KN01", bloom: "Hiểu" } } };
  kiem((await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [deM, daM])).length === 0, "batDauMuonNhat đúng dạng: không lỗi");
  kiem((await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [{ ...deM, batDauMuonNhat: "20:00" }, daM])).length === 1, "batDauMuonNhat sai dạng: bắt được");
  await mot(`insert into public.de_thi (ma, tieu_de, loai, mo, dong, noi_dung) values ('de-muon', 'Đề thử giờ riêng', 'de', now() - interval '1 hour', now() + interval '1 hour', $1)`, [deM]);
  await mot(`insert into public.dap_an_de values ('de-muon', $1)`, [daM]);
  await vaiKhach();
  r = await goi("ld_vao", maMoiAn, "de-muon"); kiem(r.kq && r.kq.batDauMuonNhat === Date.parse(deM.batDauMuonNhat), "màn hình vào biết giờ bắt đầu muộn nhất", r.kq && r.kq.batDauMuonNhat);
  r = await goi("ld_bat_dau", maMoiAn, "de-muon", null); kiem(r.kq && r.kq.de, "trước giờ bắt đầu muộn nhất: vào được", r.loi);
  await vaiGoc();
  await mot(`update public.de_thi set noi_dung = jsonb_set(noi_dung, '{batDauMuonNhat}', to_jsonb(to_char((now() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) where ma = 'de-muon'`);
  await vaiKhach();
  r = await goi("ld_bat_dau", "thu0chi000000000000000000004", "de-muon", null); kiem(/quá giờ vào thi/.test(r.loi || ""), "sau giờ bắt đầu muộn nhất: lượt mới bị chặn", r);
  r = await goi("ld_bat_dau", maMoiAn, "de-muon", null); kiem(r.kq && r.kq.tiepTuc === true, "lượt đã bắt đầu vẫn vào lại được", r.loi);
  await vaiGoc();
  await mot(`update public.luot_thi set bat_dau = now() - interval '10 minutes' where ma_de = 'de-muon'`);
  await vaiKhach();
  r = await goi("ld_nop", maMoiAn, "de-muon", { m1: 1 }, []); kiem(r.kq && r.kq.diemMay === 1, "nộp được", r);
  await vaiGoc();
  kiem((await mot(`select nop_muon from public.luot_thi where ma_de = 'de-muon'`))[0].nop_muon === true, "nộp quá giờ riêng của lượt (1 phút + 2 phút): ghi nộp muộn dù đề chưa đóng");
}

console.log("8. coChamTay và mẹo");
const cham = async (dapAn, tl) => (await mot(`select noi_bo.ld_cham($1,$2) k`, [dapAn, tl]))[0].k;
const daCt = { cau: {
  d1: { loai: "dien", dapAn: ["247"], diem: 4, nhom: "Toán", coChamTay: true, meo: "Đếm theo nhóm." },
  d2: { loai: "dien", dapAn: ["247"], diem: 4, nhom: "Toán" },
  v1: { loai: "viet", chapNhan: ["I am here"], diem: 2, nhom: "Tiếng Anh", coChamTay: false },
  v2: { loai: "viet", chapNhan: ["I am here"], diem: 2, nhom: "Tiếng Anh" } } };
let k = await cham(daCt, { d1: "247 chữ số", d2: "247 chữ số", v1: "I here", v2: "I here" });
kiem(k.chiTiet.d1.choCham === true, "câu điền coChamTay, viết khác danh sách: chuyển cô", k.chiTiet.d1);
kiem(k.chiTiet.d2.dung === false, "câu điền không coChamTay: sai (chờ cô quyết việc nhận đơn vị)", k.chiTiet.d2);
kiem(k.chiTiet.v1.dung === false && k.chiTiet.v2.choCham === true, "câu viết coChamTay false thì sai; mặc định chuyển cô", k.chiTiet);
k = await cham(daCt, { d1: "", d2: "247" });
kiem(k.chiTiet.d1.dung === false && k.chiTiet.d2.dung === true, "bỏ trống thì sai, không chuyển cô", k.chiTiet.d1);
k = await cham(daCt, { d1: "247." });
kiem(k.chiTiet.d1.dung === true && k.chiTiet.d1.meo === "Đếm theo nhóm.", "mẹo đi kèm kết quả", k.chiTiet.d1);

console.log("8b. Câu dựng câu: bỏ dấu câu giữa câu");
const cc = async s => (await mot(`select noi_bo.ld_chuan_cau($1) c`, [s]))[0].c;
kiem(await cc("Look! The girls are wearing helmets.") === await cc("Look, the girls are wearing helmets") &&
     await cc("look the girls are wearing helmets") === await cc("Look, the girls are wearing helmets."), "Look! = Look, = Look", await cc("Look! The girls are wearing helmets."));
kiem(await cc("It costs 7.5 dollars, OK?") === "it costs 7.5 dollars ok", "giữ dấu chấm trong số", await cc("It costs 7.5 dollars, OK?"));
kiem(await cc("Mai’s father drives") === "mai's father drives", "giữ nháy trong từ");
const fAnh = path.join(DA, "03 TIẾNG ANH/NHÁP/tang3-tuan-1-tieng-anh-1.dapan.json");
if (fAnh && fs.existsSync(fAnh)) {
  const daAnh = JSON.parse(fs.readFileSync(fAnh, "utf8"));
  // Lấy câu được chấp nhận đầu tiên trong tệp hiện tại, rồi viết khác đi: chữ thường, bỏ dấu phẩy, “Look,” thành “LOOK!”.
  const bienThe = (c) => c.replace(/^Look,/, "LOOK!").replace(/,/g, "").replace(/\.$/, "").replace(/^[^L]/, (x) => x.toLowerCase());
  const thuCau = { t6: bienThe(daAnh.cau.t6.chapNhan[0]).toLowerCase(), t7: bienThe(daAnh.cau.t7.chapNhan[0]) };
  const kA = await cham({ cau: { t6: daAnh.cau.t6, t7: daAnh.cau.t7 } }, thuCau);
  kiem(kA.chiTiet.t6.dung === true && kA.chiTiet.t7.dung === true, "t6, t7 Tiếng Anh: viết thường, không phẩy, “Look!” vẫn đúng", kA.chiTiet);
  const kB = await cham({ cau: { t6: daAnh.cau.t6 } }, { t6: "Mai's father usually drive to work, but today he take the bus." });
  kiem(kB.chiTiet.t6.choCham === true, "t6 sai ngữ pháp: chuyển cô (coChamTay true)", kB.chiTiet);
}

console.log("8c. Xáo phương án: kiểm lời giải ghi cứng chữ cái");
{
  const deX = { phan: [{ ten: "P", phut: 5, muc: [
    { loai: "chon", id: "c1", luaChon: ["1", "2", "3", "4"] },
    { loai: "chon", id: "c2", luaChon: ["1", "2", "3", "4"] },
    { loai: "chon", id: "c3", luaChon: ["Mèo", "Chó", "Cả A và B", "Không con nào"] },
    { loai: "chon", id: "c4", luaChon: ["Mèo", "Chó", "Cả A và B", "Không con nào"], giuThuTu: true }] }] };
  const goc = { nhom: "Toán", chuDe: "TO04", kyNang: "KN01", bloom: "Hiểu", diem: 1, loai: "chon", dung: 1 };
  const daX = { cau: { c1: { ...goc, giaiThich: "Đáp án B. Vì 1 + 1 = 2. Vì sao sai: A. 1: con quên cộng." },
    c2: { ...goc, giaiThich: "Số 2 đúng vì 1 + 1 = 2. Số 1 sai vì con quên cộng." },
    c3: { ...goc, giaiThich: "Hai con đều là thú nuôi." }, c4: { ...goc, giaiThich: "Đáp án C vì cả hai." } } };
  const khongXao = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [deX, daX])).map(r => r.l);
  kiem(khongXao.length === 0, "đề không xáo thì chữ cái trong lời giải không sao", khongXao);
  const coXao = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [{ ...deX, xaoPhuongAn: true }, daX])).map(r => r.l);
  kiem(coXao.length === 2 && coXao.some(l => l.startsWith("Câu c1")) && coXao.some(l => l.startsWith("Câu c3")), "đề xáo: bắt c1 (Đáp án B) và c3 (Cả A và B); bỏ qua c2, c4", coXao);
}

console.log("9. Kiểm các tệp đề nháp thật bằng ld_kiem_de (chỉ đọc, báo số lỗi)");
for (const [w, a] of [["07 ĐỀ THI VÀ MỐC/NHÁP/ĐỀ ĐẦU VÀO/de-dau-vao.json", "07 ĐỀ THI VÀ MỐC/NHÁP/ĐỀ ĐẦU VÀO/de-dau-vao.dapan.json"],
  ["02 TOÁN/NHÁP/tang3-tuan-1-toan-1.json", "02 TOÁN/NHÁP/tang3-tuan-1-toan-1.dapan.json"],
  ["03 TIẾNG ANH/NHÁP/tang3-tuan-1-tieng-anh-1.json", "03 TIẾNG ANH/NHÁP/tang3-tuan-1-tieng-anh-1.dapan.json"],
  ["04 TIẾNG VIỆT/NHÁP/tang3-tuan-1-tieng-viet-1.json", "04 TIẾNG VIỆT/NHÁP/tang3-tuan-1-tieng-viet-1.dapan.json"]]) {
  if (!fs.existsSync(path.join(DA, w))) { console.log("  (không có)", w); continue; }
  const loi = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [JSON.parse(fs.readFileSync(path.join(DA, w), "utf8")), JSON.parse(fs.readFileSync(path.join(DA, a), "utf8"))])).map(r => r.l);
  console.log(`  ${path.basename(w)}: ${loi.length} lỗi`); loi.slice(0, 6).forEach(l => console.log("    - " + l));
}

{
  const w = path.join(DA, "02 TOÁN/NHÁP/tang3-tuan-1-toan-1.json"), a = path.join(DA, "02 TOÁN/NHÁP/tang3-tuan-1-toan-1.dapan.json");
  if (fs.existsSync(w)) {
    const loi = (await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [{ ...JSON.parse(fs.readFileSync(w, "utf8")), xaoPhuongAn: true }, JSON.parse(fs.readFileSync(a, "utf8"))])).map(r => r.l);
    console.log(`  tang3-tuan-1-toan-1.json nếu bật xáo: ${loi.length} lỗi`); loi.slice(0, 2).forEach(l => console.log("    - " + l.slice(0, 120)));
  }
}

console.log("10. Luyện nghe vào hồ sơ (QĐ-032)");
{
  await vaiGoc();
  const nhanDT = { loai: "dien", diem: 1, nhom: "Tiếng Anh", chuDe: "TA21", kyNang: "KN09", bloom: "Hiểu", toiDaTu: 4 };
  const nhanTN = { loai: "chon", diem: 1, nhom: "Tiếng Anh", chuDe: "TA22", kyNang: "KN03", bloom: "Hiểu" };
  const daN = { tieuDe: "Thông báo ở trường", tuan: 1, banChepLoi: "Good morning, everyone.\nPlease bring two bottles of water.",
    cau: { dt1: { ...nhanDT, dapAn: ["two bottles of water"], kyNangNghe: "nghe số lượng", doan: [3, 8], giaiThich: "Câu thứ hai." },
           dt2: { ...nhanDT, dapAn: ["at half past three", "at 3.30"], kyNangNghe: "nghe giờ", doan: [8, 12] },
           tn1: { ...nhanTN, dung: 2, kyNangNghe: "hiểu ý chính", giaiThich: "Cả bài nói về chuyến đi." } } };
  let l = (await mot(`select noi_bo.ln_kiem_bai($1) l`, [daN])).map(r => r.l);
  kiem(l.length === 0, "tệp đáp án bài nghe đủ nhãn thì không lỗi", l);
  const hongN = JSON.parse(JSON.stringify(daN)); hongN.banChepLoi = ""; hongN.cau.dt1.toiDaTu = 5; hongN.cau.dt2.chuDe = "XX01"; hongN.cau.tn1.nhom = "Toán";
  l = (await mot(`select noi_bo.ln_kiem_bai($1) l`, [hongN])).map(r => r.l);
  kiem(l.length === 4 && l.some(x => /chép lời/.test(x)) && l.some(x => /toiDaTu/.test(x)) && l.some(x => /XX01/.test(x)) && l.some(x => /Tiếng Anh/.test(x)),
    "bắt thiếu bản chép lời, toiDaTu khác 4, mã chủ đề sai, nhóm môn khác", l);
  await mot(`insert into public.dap_an_nghe (ma_bai, noi_dung) values ('tuan-01-bai-1', $1)`, [daN]);
  const MA = (await mot(`select m.ma from public.ma_thi m join public.hoc_sinh h on h.id=m.hoc_sinh_id where h.dang_hoc and h.id=$1`, [hsAn]))[0]?.ma;
  kiem(!!MA, "học sinh An còn mã riêng");

  await vaiKhach();
  kiem((await mot(`select count(*)::int n from public.dap_an_nghe`))[0].n === 0, "khách không đọc thẳng được đáp án bài nghe");
  r = await goi("ln_vao", "sai-ma"); kiem(/Đường dẫn chưa đúng\. Bạn/.test(r.loi || ""), "mã sai bị chặn, lời gọi “bạn”", r);
  r = await goi("ln_vao", MA); kiem(r.kq && r.kq.ten === "An" && Object.keys(r.kq.daLam).length === 0, "chào đúng tên, chưa làm bài nào", r);
  r = await goi("ln_cham", "tuan-09-bai-9", {}); kiem(/Chưa có bài nghe/.test(r.loi || ""), "bài chưa có thì báo", r);
  const truocCham = (await (async () => { await vaiGoc(); const n = (await mot(`select count(*)::int n from public.bai_lam where loai='nghe'`))[0].n; await vaiKhach(); return n; })());
  r = await goi("ln_cham", "tuan-01-bai-1", { dt1: " Two Bottles of water.", dt2: "at half past three in the afternoon", tn1: 2 });
  kiem(r.kq && r.kq.diem == 2 && r.kq.toiDa == 3 && r.kq.vaoHoSo === false, "chấm không mã: 2/3, câu quá 4 từ bị tính sai", r);
  kiem(r.kq && r.kq.chiTiet.dt2.chapNhan.length === 2 && r.kq.chiTiet.dt1.doan[0] === 3 && /bottles/.test(r.kq.banChepLoi), "trả về mọi cách viết, đoạn bản ghi, bản chép lời", r.kq && r.kq.chiTiet);
  await vaiGoc();
  kiem((await mot(`select count(*)::int n from public.bai_lam where loai='nghe'`))[0].n === truocCham, "chấm không mã thì không ghi hồ sơ");
  await vaiKhach();
  r = await goi("ln_nop", MA, "tuan-01-bai-1", { dt1: "two bottles of water", dt2: "at 3.30", tn1: "1" }, 2);
  kiem(r.kq && r.kq.diem == 2 && r.kq.lan === 1 && r.kq.vaoHoSo === true, "nộp có mã: 2/3, lần 1", r);
  await vaiGoc();
  const bl = await mot(`select b.*, (select count(*)::int from public.cau_tra_loi c where c.bai_lam_id=b.id and c.nhom_mon='Tiếng Anh' and c.ma_chu_de is not null and c.ma_ky_nang is not null and c.bloom is not null) du_nhan
    from public.bai_lam b where loai='nghe' and hoc_sinh_id=$1`, [hsAn]);
  kiem(bl.length === 1 && bl[0].do_tin_cay === 2 && bl[0].tuan === 1 && bl[0].du_nhan === 3 && /lần 1/.test(bl[0].ten_bai) && /Nghe 2 lần/.test(bl[0].ghi_chu),
    "hồ sơ có một bài nghe, độ tin cậy 2, tuần 1, ba câu đủ bốn nhãn", bl);
  kiem((await mot(`select count(*)::int n from public.cau_tra_loi c join public.bai_lam b on b.id=c.bai_lam_id where b.loai='nghe' and c.ma_cau='tn1' and c.dung=false`))[0].n === 1, "câu chọn sai ghi dung = false");
  await vaiKhach();
  for (let i = 2; i <= 10; i++) await goi("ln_nop", MA, "tuan-01-bai-1", { dt1: "two bottles of water", dt2: "at 3.30", tn1: 2 }, 3);
  r = await goi("ln_nop", MA, "tuan-01-bai-1", {}, 2); kiem(/10 lần/.test(r.loi || ""), "lần nộp thứ 11 trong 24 giờ bị chặn", r);
  r = await goi("ln_vao", MA); kiem(r.kq && r.kq.daLam["tuan-01-bai-1"].lan === 10 && r.kq.daLam["tuan-01-bai-1"].diemCao == 3, "trang chào báo 10 lần, điểm cao nhất 3", r);
  r = await goi("ln_cham", "tuan-01-bai-1", { x: "a".repeat(6000) }); kiem(/dài quá/.test(r.loi || ""), "bài làm quá dài bị chặn", r);
  let loiQuyen = ""; try { await mot(`select noi_bo.ln_tra_ve('{}'::jsonb, '{}'::jsonb)`); } catch (e) { loiQuyen = e.message; }
  kiem(/permission|quyền/i.test(loiQuyen), "khách không gọi được hàm nội bộ", loiQuyen);
  await vaiGoc();
  await mot(`delete from public.bai_lam where loai='nghe'`);
  // QĐ-029: không còn lời nào gọi học sinh là “con” trong các hàm trang thi và trang nghe.
  const conCon = (await mot(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','noi_bo') and (p.proname like 'ld\\_%' or p.proname like 'ln\\_%') and p.prosrc ~ '''[^'']*\\mCon\\M[^'']*'''`)).map(x => x.proname);
  kiem(conCon.length === 0, "lời báo trong hàm ld_*, ln_* không còn “Con”", conCon);
  r = await mot(`select public.ld_tep('x','y','z')`).then(() => "", (e) => e.message);
  kiem(/Bạn xin cô/.test(r), "lời báo của trang thi đã đổi sang “bạn”", r);
}

console.log("11. Hình câu Tầng 3 và bài viết ở nhà nộp ảnh (QĐ-048)");
{
  await vaiGoc();
  // 11a. Bài viết ở nhà: đề loại bai_viet, câu tuluan tối đa 2 ảnh; nộp vào hồ sơ như bài gõ.
  const deV = { ma: "bai-viet-tuan-3-thu", tieuDe: "Bài viết ở nhà tuần 3 (thử)", phan: [
    { ten: "Bài viết", phut: 60, muc: [{ loai: "tuluan", id: "v1", tenCau: "Đoạn văn", soAnhToiDa: 2, cau: "Viết đoạn văn." }, { loai: "chon", id: "c1", luaChon: ["a", "b"] }] }] };
  const gocV = { nhom: "Tiếng Việt", chuDe: "TV02", kyNang: "KN01", bloom: "Sáng tạo" };
  const daV = { cau: { v1: { ...gocV, loai: "tuluan", diem: 10 }, c1: { ...gocV, loai: "chon", dung: 0, diem: 1, bloom: "Hiểu" } } };
  kiem((await mot(`select noi_bo.ld_kiem_de($1,$2) l`, [deV, daV])).length === 0, "đề bài viết có soAnhToiDa: không lỗi");
  r = await mot(`insert into public.de_thi (ma, tieu_de, loai, do_tin_cay, tuan, mo, dong, noi_dung) values ($1, $2, 'bai_viet', 3, 3, now() - interval '1 hour', now() + interval '1 day', $3)`, [deV.ma, deV.tieuDe, deV]).then(() => "", (e) => e.message);
  kiem(r === "", "bảng de_thi nhận loại bai_viet", r);
  r = await mot(`insert into public.de_thi (ma, tieu_de, loai, mo, dong, noi_dung) values ('x-loai', 'x', 'loai_la', now(), now() + interval '1 hour', '{}')`).then(() => "", (e) => e.message);
  kiem(/check/i.test(r), "loại đề lạ vẫn bị chặn", r);
  await mot(`insert into public.dap_an_de values ($1, $2)`, [deV.ma, daV]);
  const MV = "thu0chi000000000000000000004", MV2 = "thu0dung00000000000000000005", ANH = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  await vaiKhach();
  await goi("ld_bat_dau", MV, deV.ma, null); await goi("ld_bat_dau", MV2, deV.ma, null);
  const a1 = await goi("ld_tai_anh", MV, deV.ma, "v1", ANH), a2 = await goi("ld_tai_anh", MV, deV.ma, "v1", ANH);
  kiem(a1.kq?.id && a2.kq?.id, "gửi được 2 ảnh bài viết tay", [a1, a2]);
  r = await goi("ld_tai_anh", MV, deV.ma, "v1", ANH); kiem(/tối đa 2 ảnh/.test(r.loi || ""), "ảnh thứ 3 bị chặn (soAnhToiDa 2)", r);
  r = await goi("ld_tai_anh", MV, deV.ma, "c1", ANH); kiem(/không nhận ảnh/.test(r.loi || ""), "câu trắc nghiệm không nhận ảnh", r);
  r = await goi("ld_tai_anh", MV, deV.ma, "khong-co", ANH); kiem(/không nhận ảnh/.test(r.loi || ""), "câu không có trong đề không nhận ảnh", r);
  r = await goi("ld_tai_anh", MV2, deV.ma, "v1", "data:image/jpeg;base64," + Buffer.alloc(3000001, 1).toString("base64"));
  kiem(/quá lớn/.test(r.loi || ""), "ảnh quá 3 MB bị chặn", r);
  r = await goi("ld_xoa_anh", MV2, deV.ma, a1.kq.id); kiem(/Không tìm thấy ảnh/.test(r.loi || ""), "không xoá được ảnh của bạn khác", r);
  r = await goi("ld_xoa_anh", MV, deV.ma, a1.kq.id); kiem(r.kq?.ok, "xoá được ảnh chụp hỏng của mình", r);
  r = await goi("ld_tai_anh", MV, deV.ma, "v1", ANH); kiem(r.kq?.id, "xoá rồi gửi lại được", r);
  r = await goi("ld_bat_dau", MV, deV.ma, null); kiem(r.kq?.anh?.v1?.length === 2, "vào lại thấy đúng 2 ảnh đã gửi", r.kq?.anh);
  // Giới hạn 25 MB một lượt: chèn sẵn 24 MB rồi gửi thêm 2 MB.
  await vaiGoc();
  const luotV2 = (await mot(`select l.id from public.luot_thi l join public.ma_thi m on m.hoc_sinh_id = l.hoc_sinh_id where m.ma=$1 and l.ma_de=$2`, [MV2, deV.ma]))[0].id;
  await mot(`insert into public.anh_nop (luot_thi_id, ma_cau, du_lieu) values ($1, 'v0', decode(repeat('00', 24000000), 'hex'))`, [luotV2]);
  await vaiKhach();
  r = await goi("ld_tai_anh", MV2, deV.ma, "v1", "data:image/jpeg;base64," + Buffer.alloc(2000000, 1).toString("base64"));
  kiem(/quá 25 MB/.test(r.loi || ""), "tổng ảnh một lượt quá 25 MB bị chặn", r);
  r = await goi("ld_nop", MV, deV.ma, { c1: 0 }, []);
  kiem(r.kq && r.kq.soCauChoCham === 1, "nộp bài viết chỉ có ảnh: câu viết chờ cô chấm", r);
  r = await goi("ld_xoa_anh", MV, deV.ma, a2.kq.id); kiem(/đã nộp/.test(r.loi || ""), "nộp rồi không xoá ảnh được", r);
  await vaiGoc();
  const bv = (await mot(`select b.loai, b.do_tin_cay, b.tuan, b.diem_toi_da::float d, (select count(*)::int from public.cham_tay t where t.bai_lam_id=b.id and t.ma_cau='v1' and t.diem is null) cho,
      (select count(*)::int from public.anh_nop a join public.luot_thi l on l.id=a.luot_thi_id where l.bai_lam_id=b.id and a.ma_cau='v1') anh
    from public.bai_lam b join public.luot_thi l on l.bai_lam_id=b.id where l.ma_de=$1`, [deV.ma]))[0];
  kiem(bv && bv.loai === "bai_viet" && bv.do_tin_cay === 3 && bv.tuan === 3 && bv.d === 11 && bv.cho === 1 && bv.anh === 2,
    "hồ sơ: bài loại bai_viet, độ tin cậy 3, tuần 3, câu viết chờ cô chấm, kèm 2 ảnh", bv);
  const quyenXoa = (await mot(`select has_function_privilege('anon', 'public.ld_xoa_anh(text,text,uuid)', 'execute') a`))[0].a;
  kiem(quyenXoa === true, "trang thi gọi được ld_xoa_anh");

  // 11b. dang_de.mjs: hình Tầng 3 phải có tệp, rõ trên điện thoại; mã bai-viet- thành loại bai_viet.
  const { execFileSync } = await import("child_process"); const os = await import("os");
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), "thu-hinh-")); fs.mkdirSync(path.join(tam, "hinh"));
  const png = (rong) => { const b = Buffer.alloc(33); Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(b); b.writeUInt32BE(rong, 16); b.writeUInt32BE(300, 20); return b; };
  fs.writeFileSync(path.join(tam, "hinh/c5.svg"), `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='300' viewBox='0 0 640 300'><rect width='640' height='300' fill='white'/></svg>`);
  fs.writeFileSync(path.join(tam, "hinh/c6.png"), png(1200));
  const deH = { ma: "tang3-tuan-3-thu-hinh", tieuDe: "Thử hình", moDe: "2026-12-14T06:00:00+07:00", dongDe: "2026-12-20T22:00:00+07:00", phan: [{ ten: "Tầng 3", phut: 20, muc: [
    { loai: "dien", id: "c5", cau: "Diện tích hình bên là ____ cm².", hinh: "hinh/c5.svg", moTaHinh: "Hình chữ nhật" },
    { loai: "dien", id: "c6", cau: "Chu vi là ____ cm.", hinh: "hinh/c6.png" }] }] };
  const gocH = { nhom: "Toán", chuDe: "TO04", kyNang: "KN01", bloom: "Vận dụng" };
  const daH = { cau: { c5: { ...gocH, loai: "dien", dapAn: ["12"], diem: 1 }, c6: { ...gocH, loai: "dien", dapAn: ["14"], diem: 1 } } };
  const chay = (d, a) => {
    fs.writeFileSync(path.join(tam, d.ma + ".json"), JSON.stringify(d)); fs.writeFileSync(path.join(tam, d.ma + ".dapan.json"), JSON.stringify(a));
    try { return { ra: execFileSync(process.execPath, [path.join(REPO, "cong-cu/luyen-de/dang_de.mjs"), "--de", path.join(tam, d.ma + ".json"), "--thu"], { encoding: "utf8", stdio: "pipe" }) }; }
    catch (e) { return { loi: String(e.stderr || e.message) }; }
  };
  r = chay(deH, daH); kiem(/đạt kiểm/.test(r.ra || "") && /2 tệp hình/.test(r.ra || ""), "đề Tầng 3 có 2 hình (SVG, PNG 1200) đăng được, nhúng đủ 2 tệp", r);
  const sqlH = path.join(REPO, "supabase/.temp/dang-de-" + deH.ma + ".sql");
  kiem(fs.existsSync(sqlH) && /insert into public\.tep_de .*'hinh\/c5\.svg'/.test(fs.readFileSync(sqlH, "utf8")), "tệp SQL có hình vào bảng tep_de");
  fs.rmSync(sqlH, { force: true });
  const thieu = JSON.parse(JSON.stringify(deH)); thieu.phan[0].muc[1].hinh = "hinh/khong-co.png";
  r = chay(thieu, daH); kiem(/thiếu tệp “hinh\/khong-co\.png”/.test(r.loi || ""), "thiếu tệp hình thì dừng", r);
  fs.writeFileSync(path.join(tam, "hinh/c6.png"), png(500));
  r = chay(deH, daH); kiem(/chỉ rộng 500 điểm ảnh/.test(r.loi || ""), "PNG hẹp dưới 800 điểm ảnh thì dừng", r);
  fs.writeFileSync(path.join(tam, "hinh/c6.png"), png(1200));
  fs.writeFileSync(path.join(tam, "hinh/c5.svg"), `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='300'><rect width='640' height='300'/></svg>`);
  r = chay(deH, daH); kiem(/thiếu viewBox/.test(r.loi || ""), "SVG thiếu viewBox thì dừng", r);
  fs.writeFileSync(path.join(tam, "hinh/c5.svg"), `<svg viewBox='0 0 10 10' onload='alert(1)'></svg>`);
  r = chay(deH, daH); kiem(/mã chạy/.test(r.loi || ""), "SVG có mã chạy thì dừng", r);
  const deV2 = { ...deV, ma: "bai-viet-tuan-3-thu-2", moDe: deH.moDe, dongDe: deH.dongDe };
  r = chay(deV2, daV); kiem(/loại bai_viet, độ tin cậy 3/.test(r.ra || ""), "mã bai-viet- đăng thành loại bai_viet, độ tin cậy 3", r);
  fs.rmSync(path.join(REPO, "supabase/.temp/dang-de-" + deV2.ma + ".sql"), { force: true });
  const deV3 = JSON.parse(JSON.stringify(deV2)); deV3.phan[0].muc[0].soAnhToiDa = 20;
  r = chay(deV3, daV); kiem(/từ 1 đến 10/.test(r.loi || ""), "soAnhToiDa ngoài 1–10 thì dừng", r);
  fs.rmSync(tam, { recursive: true, force: true });

  // 11c. Trang thi: hình rộng hết khung, chạm để phóng to; ô ảnh có xoá, giới hạn số ảnh và 25 MB ảnh gốc.
  const trang = fs.readFileSync(path.resolve(process.env.LUYENDE || path.join(DA, "..", "luyende.tramtuduy.org"), "thi.html"), "utf8");
  for (const [mau, ten] of [[/img\.hinh \{[^}]*width:100%/, "hình rộng hết khung"], [/id="phong-to"/, "lớp phóng to hình"], [/moTaHinh/, "lời tả hình"],
    [/xoaAnh: \["ld_xoa_anh", "id"\]/, "nút xoá ảnh gọi ld_xoa_anh"], [/soAnhToiDa/, "giới hạn số ảnh của câu"], [/25 \* 1024 \* 1024/, "giới hạn 25 MB ảnh gốc"],
    [/if \(m\.hinh && kq\.de\)/, "hình câu hiện lại ở màn hình kết quả"]])
    kiem(mau.test(trang), "thi.html: " + ten);
}

console.log(`\nKết quả: ${soDat} đạt, ${soLoi} sai.`);
process.exit(soLoi ? 1 : 0);
