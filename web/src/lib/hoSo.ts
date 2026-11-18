import { sb } from "./supabase";

export type HocSinh = { id: string; ma_hs: string; ho_ten: string; ten_goi: string | null; nhom_lop: string; dich_diem: number; la_mau: boolean };
export type ChuDe = { ma: string; ten_tre: string; nhom_mon: string; tuan: number | null; ten_day_du: string | null; bloom: string | null; ky_nang_chinh: string | null; y_tuong_lon: string | null };
export type KyNang = { ma: string; ten: string; loi_cho_tre: string | null };
export type BaiLam = { id: string; hoc_sinh_id: string; loai: string; ma_bai: string; ten_bai: string | null; ngay: string; tuan: number | null; do_tin_cay: number; diem: number | null; diem_toi_da: number | null; thoi_gian_phut: number | null };
export type Cau = { id: string; bai_lam_id: string; ma_cau: string; nhom_mon: string; ma_chu_de: string | null; ma_ky_nang: string | null; bloom: string | null; dung: boolean | null; diem: number | null; diem_toi_da: number | null; loai_loi: string | null; giay: number | null };
export type ChamTay = { id: string; bai_lam_id: string; ma_cau: string; tieu_chi: string; muc: string | null; diem: number | null; diem_toi_da: number | null; nhan_xet: string | null; diem_hong: string | null };
export type ChuyenCan = { id: string; hoc_sinh_id: string; ngay: string; buoi: string | null; co_mat: boolean; tuong_tac: number | null; ghi_chu: string | null };
export type GhiChuCoach = { id: string; hoc_sinh_id: string; ngay: string; van_de: string; ke_hoach: string | null; chia_se_phu_huynh: boolean };
export type BaoCao = { id: string; hoc_sinh_id: string; tuan: number; tu_ngay: string | null; den_ngay: string | null; noi_dung: Record<string, unknown>; trang_thai: string };
export type NhanSu = { email: string; ho_ten: string; vai: string; mo_ta_vai: string | null; quan_tri: boolean; thu_tu: number };

export const NHOM_MON = ["Toán", "Tiếng Anh", "Tiếng Việt", "Khoa học", "Lịch sử và Địa lý"] as const;
export const BLOOM = ["Nhớ", "Hiểu", "Vận dụng", "Phân tích", "Đánh giá", "Sáng tạo"] as const;
export const LOAI_LOI: Record<string, { ten: string; giai_thich: string }> = {
  kien_thuc: { ten: "Chưa nắm kiến thức", giai_thich: "Câu sai vì con chưa có công cụ để giải." },
  hieu_sai_de: { ten: "Hiểu sai đề", giai_thich: "Con biết cách làm nhưng đọc nhầm điều đề hỏi." },
  tinh_sai: { ten: "Tính sai hoặc ẩu", giai_thich: "Con đúng hướng nhưng sai một phép tính hay chép nhầm." },
  het_gio: { ten: "Hết giờ", giai_thich: "Con dừng lại quá lâu và không kịp làm." },
};
export const LOAI_BAI: Record<string, string> = {
  dau_vao: "Bài thi đầu vào", moc: "Bài kiểm tra Mốc", thuc_chien: "Thực chiến Chủ nhật", de: "Đề thi", tang3: "Tầng 3 của phiếu",
  nghe: "Bài nghe", lab: "Phòng thí nghiệm", bai_viet: "Bài viết đoạn", loi_giai: "Lời giải Toán", de_giay: "Đề giấy",
};
export const DO_TIN_CAY: Record<number, string> = { 1: "Có giám sát trên lớp", 2: "Tầng 3 làm trên web", 3: "Cô chấm theo barem", 4: "Con tự đánh giá" };

// Trạng thái chủ đề, đúng luật của dự án:
// “Đã vững”: ít nhất 6 câu, ở ít nhất 2 lần làm cách nhau từ 7 ngày, đúng từ 80%.
// “Cần ôn lại”: đã vững nhưng quá 28 ngày chưa gặp lại.
// Dưới 4 câu: “chưa đủ dữ liệu”, không kết luận.
export type TrangThai = "chua" | "moi" | "luyen" | "vung" | "on";
export const TEN_TT: Record<TrangThai, { ten: string; ky: string }> = {
  chua: { ten: "Chưa học", ky: "·" }, moi: { ten: "Mới học", ky: "○" }, luyen: { ten: "Đang luyện", ky: "◐" },
  vung: { ten: "Đã vững", ky: "●" }, on: { ten: "Cần ôn lại", ky: "↻" },
};

export type KetQuaChuDe = { cd: ChuDe; so_cau: number; dung: number; so_lan: number; lan_cuoi: string | null; tt: TrangThai; du_lieu_du: boolean };

const ngayGiua = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function tinhChuDe(chuDe: ChuDe[], baiLam: BaiLam[], cau: Cau[], ngayXet: string): KetQuaChuDe[] {
  const baiById = new Map(baiLam.map((b) => [b.id, b]));
  const gom = new Map<string, { n: number; d: number; ngay: Set<string> }>();
  for (const c of cau) {
    const b = baiById.get(c.bai_lam_id);
    if (!b || !c.ma_chu_de || b.do_tin_cay === 4 || c.dung === null) continue;
    const g = gom.get(c.ma_chu_de) ?? { n: 0, d: 0, ngay: new Set<string>() };
    g.n++; if (c.dung) g.d++; g.ngay.add(b.ngay);
    gom.set(c.ma_chu_de, g);
  }
  return chuDe.map((cd) => {
    const g = gom.get(cd.ma);
    if (!g || g.n === 0) return { cd, so_cau: 0, dung: 0, so_lan: 0, lan_cuoi: null, tt: "chua" as TrangThai, du_lieu_du: false };
    const ngay = [...g.ngay].sort();
    const lanCuoi = ngay[ngay.length - 1];
    const cachNhau = ngayGiua(ngay[0], lanCuoi) >= 7;
    let tt: TrangThai;
    if (g.n < 4) tt = "moi";
    else if (g.n >= 6 && ngay.length >= 2 && cachNhau && g.d / g.n >= 0.8) tt = ngayGiua(lanCuoi, ngayXet) > 28 ? "on" : "vung";
    else tt = "luyen";
    return { cd, so_cau: g.n, dung: g.d, so_lan: ngay.length, lan_cuoi: lanCuoi, tt, du_lieu_du: g.n >= 4 };
  });
}

export type Gom = { n: number; dung: number; giay: number[] };
export function gomTheo<K extends string>(cau: Cau[], key: (c: Cau) => K | null | undefined) {
  const m = new Map<K, Gom>();
  for (const c of cau) {
    const k = key(c); if (!k || c.dung === null) continue;
    const g = m.get(k) ?? { n: 0, dung: 0, giay: [] };
    g.n++; if (c.dung) g.dung++; if (c.giay) g.giay.push(c.giay);
    m.set(k, g);
  }
  return m;
}

export const phanTram = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
export const ngayVN = (s: string | null | undefined) => {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const trungVi = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b); const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

// Ngày xét của học sinh mẫu: hết tuần 6 (Chủ nhật 24/01/2027). Học sinh thật dùng ngày hôm nay.
export const NGAY_XET_MAU = "2027-01-24";
export const NGAY_BAT_DAU = "2026-12-14";
export const tuanTheoNgay = (ngay: string) => Math.max(0, Math.floor(ngayGiua(NGAY_BAT_DAU, ngay) / 7) + 1);

export type HoSoDayDu = {
  hs: HocSinh; chuDe: ChuDe[]; kyNang: KyNang[]; baiLam: BaiLam[]; cau: Cau[]; chamTay: ChamTay[];
  chuyenCan: ChuyenCan[]; coach: GhiChuCoach[]; baoCao: BaoCao[]; ngayXet: string;
};

async function layHet<T>(q: () => any): Promise<T[]> {
  const out: T[] = []; let from = 0; const step = 1000;
  for (;;) {
    const { data, error } = await q().range(from, from + step - 1);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < step) break;
    from += step;
  }
  return out;
}

export async function taiHoSo(hsId: string): Promise<HoSoDayDu> {
  const { data: hs, error } = await sb.from("hoc_sinh").select("*").eq("id", hsId).single();
  if (error) throw error;
  const [chuDe, kyNang, baiLam, chuyenCan, coach, baoCao] = await Promise.all([
    layHet<ChuDe>(() => sb.from("chu_de").select("*").order("tuan").order("ma")),
    layHet<KyNang>(() => sb.from("ky_nang").select("*").order("ma")),
    layHet<BaiLam>(() => sb.from("bai_lam").select("*").eq("hoc_sinh_id", hsId).order("ngay")),
    layHet<ChuyenCan>(() => sb.from("chuyen_can").select("*").eq("hoc_sinh_id", hsId).order("ngay")),
    layHet<GhiChuCoach>(() => sb.from("ghi_chu_coach").select("*").eq("hoc_sinh_id", hsId).order("ngay", { ascending: false })),
    layHet<BaoCao>(() => sb.from("bao_cao_tuan").select("*").eq("hoc_sinh_id", hsId).order("tuan", { ascending: false })),
  ]);
  const ids = baiLam.map((b) => b.id);
  const cau: Cau[] = []; const chamTay: ChamTay[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const phan = ids.slice(i, i + 150);
    const [c, t] = await Promise.all([
      layHet<Cau>(() => sb.from("cau_tra_loi").select("*").in("bai_lam_id", phan)),
      layHet<ChamTay>(() => sb.from("cham_tay").select("*").in("bai_lam_id", phan)),
    ]);
    cau.push(...c); chamTay.push(...t);
  }
  const ngayXet = (hs as HocSinh).la_mau ? NGAY_XET_MAU : new Date().toISOString().slice(0, 10);
  return { hs: hs as HocSinh, chuDe, kyNang, baiLam, cau, chamTay, chuyenCan, coach, baoCao, ngayXet };
}

// Ba việc của tuần này: rút từ dữ liệu, nói điều con làm được trước rồi mới nói việc cần làm.
export function baViec(kq: KetQuaChuDe[], cau: Cau[], kyNang: KyNang[]): { viec: string; viSao: string }[] {
  const out: { viec: string; viSao: string }[] = [];
  const on = kq.filter((k) => k.tt === "on").sort((a, b) => (a.lan_cuoi ?? "").localeCompare(b.lan_cuoi ?? ""));
  if (on[0]) out.push({ viec: `Ôn lại trạm “${on[0].cd.ten_tre}”`, viSao: `Con đã vững trạm này, nhưng hơn bốn tuần con chưa gặp lại.` });
  const luyen = kq.filter((k) => k.tt === "luyen").sort((a, b) => a.dung / a.so_cau - b.dung / b.so_cau);
  if (luyen[0]) out.push({ viec: `Luyện thêm trạm “${luyen[0].cd.ten_tre}”`, viSao: `Con làm đúng ${luyen[0].dung} trên ${luyen[0].so_cau} câu. Thêm một lần luyện nữa là con tiến gần mức vững.` });
  const kn = [...gomTheo(cau, (c) => c.ma_ky_nang)].filter(([, g]) => g.n >= 8).sort((a, b) => a[1].dung / a[1].n - b[1].dung / b[1].n);
  if (kn[0]) {
    const t = kyNang.find((k) => k.ma === kn[0][0]);
    out.push({ viec: `Rèn kỹ năng “${t?.ten ?? kn[0][0]}”`, viSao: `${t?.loi_cho_tre ?? ""} Ở kỹ năng này con đúng ${phanTram(kn[0][1].dung, kn[0][1].n)}%, thấp nhất trong các kỹ năng.` });
  }
  const loi = [...gomTheo(cau.filter((c) => c.loai_loi), (c) => c.loai_loi)].sort((a, b) => b[1].n - a[1].n);
  const VIEC_THEO_LOI: Record<string, string> = {
    kien_thuc: "Đọc lại phần Kiến thức mới của trạm còn vướng, rồi tự giải thích lại bằng lời của con",
    hieu_sai_de: "Gạch từ khoá trước khi trả lời",
    tinh_sai: "Tập soát bài ba phút cuối",
    het_gio: "Làm hai lượt: câu chắc làm trước, câu khó đánh dấu làm sau",
  };
  if (out.length < 3 && loi[0]) out.push({ viec: VIEC_THEO_LOI[loi[0][0]], viSao: `Lỗi “${LOAI_LOI[loi[0][0]].ten}” là loại lỗi con gặp nhiều nhất (${loi[0][1].n} câu). ${LOAI_LOI[loi[0][0]].giai_thich}` });
  return out.slice(0, 3);
}
