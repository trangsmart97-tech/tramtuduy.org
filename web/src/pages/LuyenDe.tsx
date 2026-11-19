// Bàn làm việc Luyện đề: các cô xem lượt thi, chấm câu tự luận, tạo đường dẫn riêng cho từng con.
// Mọi dữ liệu đi qua các hàm ld_co_* trong cơ sở dữ liệu; hàm tự kiểm danh tính và vai của cô.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";

const DIA_CHI_THI = "https://luyende.tramtuduy.org/thi.html";

type De = { ma: string; tieuDe: string; loai: string; mo: string; dong: string; maPhong: string | null; soLuot: number; soNop: number; soChoCham: number };
type Muc = { id?: string; loai: string; cau?: string; diem?: number };
type Luot = { id: string; hoTen: string; maHs: string; batDau: string; nop: string | null; nopMuon: boolean | null; phan: number; soRoiTrang: number; suKien: { loai: string; luc: number }[]; diem: number | null; diemToiDa: number | null; diemMay: number | null; choCham: number };
type DongCham = { id: string; luotId: string; hoTen: string; maHs: string; maCau: string; tieuChi: string; baiLam: string | null; diem: number | null; diemToiDa: number | null; nhanXet: string | null; nguoiCham: string | null; anh: string[] };
type ChiTietDe = { de: { ma: string; tieuDe: string; mo: string; dong: string; noiDung: { phan: { ten: string; muc: Muc[] }[] } }; luot: Luot[]; cham: DongCham[] };
type HocSinhMa = { id: string; maHs: string; hoTen: string; laMau: boolean; ma: string | null };

const gio = (s: string | null) => (s ? new Date(s).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "–");
async function goi<T>(ham: string, thamSo?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(ham, thamSo);
  if (error) throw new Error(/permission denied/i.test(error.message) ? "Trang này dành cho các cô. Cô đăng nhập bằng thư của mình nhé." : error.message);
  return data as T;
}

export default function LuyenDe() {
  const [dsDe, setDsDe] = useState<De[] | null>(null);
  const [maDe, setMaDe] = useState<string>("");
  const [tab, setTab] = useState<"luot" | "duong-dan">("luot");
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    goi<De[]>("ld_co_de_thi").then((ds) => { setDsDe(ds); if (ds[0]) setMaDe(ds[0].ma); }).catch((e) => setLoi(e.message));
  }, []);
  if (loi) return (
    <main><div className="khung" style={{ padding: "48px 20px" }}>
      <h1 style={{ fontSize: 28 }}>Luyện đề</h1>
      <p>{loi}</p>
      <p className="nho"><Link to="/dang-nhap">Đăng nhập</Link> · <Link to="/nhan-su">Bàn làm việc của cô</Link></p>
    </div></main>
  );
  if (!dsDe) return <div className="dang-tai">Đang tải các đề…</div>;
  const de = dsDe.find((d) => d.ma === maDe);
  return (
    <main>
      <section className="ho-so-dau"><div className="khung">
        <p className="nho" style={{ margin: 0 }}><Link to="/nhan-su">Bàn làm việc của cô</Link></p>
        <h1 style={{ marginBottom: 4 }}>Luyện đề</h1>
        <p className="nho" style={{ margin: 0 }}>Lượt thi của từng con, câu tự luận chờ cô chấm và đường dẫn riêng để con vào thi. Điểm cô chấm tự cộng vào hồ sơ học tập.</p>
        {dsDe.length === 0 ? <p style={{ marginTop: 16 }}>Chưa có đề nào trên luyende.</p> : (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
            <label htmlFor="chon-de" className="nho" style={{ fontWeight: 600, color: "var(--chu)" }}>Đề</label>
            <select id="chon-de" className="o-nhap" style={{ width: "auto", minWidth: 260, padding: "8px 12px" }} value={maDe} onChange={(e) => setMaDe(e.target.value)}>
              {dsDe.map((d) => <option key={d.ma} value={d.ma}>{d.tieuDe} · {gio(d.mo)}</option>)}
            </select>
            {de && <span className="rat-nho">Mở {gio(de.mo)}, đóng {gio(de.dong)}{de.maPhong ? ` · mã phòng thi ${de.maPhong}` : ""}</span>}
          </div>
        )}
        <div className="the-vai" role="tablist">
          <button role="tab" aria-selected={tab === "luot"} className={tab === "luot" ? "dang" : ""} onClick={() => setTab("luot")}>Lượt thi và chấm bài</button>
          <button role="tab" aria-selected={tab === "duong-dan"} className={tab === "duong-dan" ? "dang" : ""} onClick={() => setTab("duong-dan")}>Đường dẫn riêng</button>
        </div>
      </div></section>
      {tab === "luot" && maDe && <LuotVaCham maDe={maDe} />}
      {tab === "duong-dan" && <DuongDan maDe={maDe} />}
    </main>
  );
}

function LuotVaCham({ maDe }: { maDe: string }) {
  const [d, setD] = useState<ChiTietDe | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [chiChuaCham, setChiChuaCham] = useState(true);
  const tai = useCallback(() => { goi<ChiTietDe>("ld_co_luot", { p_de: maDe }).then(setD).catch((e) => setLoi(e.message)); }, [maDe]);
  useEffect(() => { setD(null); tai(); }, [tai]);
  const cauTheoId = useMemo(() => {
    const m = new Map<string, { so: number; phan: string; cau: string }>();
    d?.de.noiDung.phan.forEach((p) => { let so = 0; p.muc.forEach((x) => { if (x.loai === "doan") return; so++; if (x.id) m.set(x.id, { so, phan: p.ten, cau: x.cau ?? "" }); }); });
    return m;
  }, [d]);
  if (loi) return <div className="dang-tai">Không tải được lượt thi: {loi}</div>;
  if (!d) return <div className="dang-tai">Đang tải lượt thi…</div>;
  const nop = d.luot.filter((l) => l.nop).length, cho = d.cham.filter((c) => c.diem === null).length;
  const dsCham = d.cham.filter((c) => !chiChuaCham || c.diem === null);
  return (
    <>
      <section className="phan"><div className="khung">
        <div className="chi-so" style={{ marginTop: 0 }}>
          <div className="o"><div className="ten">Đã vào thi</div><div className="gt">{d.luot.length}</div></div>
          <div className="o"><div className="ten">Đã nộp</div><div className="gt">{nop}</div></div>
          <div className="o"><div className="ten">Câu chờ cô chấm</div><div className="gt">{cho}</div><div className="them">trên {d.cham.length} câu tự luận</div></div>
        </div>
      </div></section>
      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Lượt thi</h2><span className="nguon">Điểm gồm phần máy chấm và phần cô đã chấm</span></div>
        {d.luot.length === 0 ? <p className="nho">Chưa con nào vào thi đề này.</p> : (
          <div className="bang-bao"><table>
            <thead><tr><th>Học sinh</th><th>Bắt đầu</th><th>Nộp</th><th className="so">Rời trang</th><th className="so">Máy chấm</th><th className="so">Điểm hiện có</th><th className="so">Chờ chấm</th></tr></thead>
            <tbody>{d.luot.map((l) => (
              <tr key={l.id}>
                <td><strong>{l.hoTen}</strong><div className="rat-nho">{l.maHs}</div></td>
                <td className="nho">{gio(l.batDau)}</td>
                <td className="nho">{l.nop ? gio(l.nop) : `Đang làm, phần ${l.phan + 1}`}{l.nopMuon && <div style={{ color: "var(--tt-on)", fontWeight: 600 }}>Nộp muộn</div>}</td>
                <td className="so" style={{ color: l.soRoiTrang >= 3 ? "var(--tt-on)" : undefined, fontWeight: l.soRoiTrang >= 3 ? 700 : 400 }} title={l.suKien.map((s) => `${s.loai} lúc ${new Date(s.luc).toLocaleTimeString("vi-VN")}`).join("\n")}>{l.soRoiTrang}</td>
                <td className="so">{l.diemMay ?? "–"}</td>
                <td className="so">{l.diem !== null ? `${l.diem} / ${l.diemToiDa}` : "–"}</td>
                <td className="so">{l.choCham || ""}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="rat-nho" style={{ marginTop: 8 }}>Số lần rời trang in đỏ khi từ 3 lần trở lên. Đưa chuột vào số để xem giờ của từng lần.</p>
        <NopGiup maDe={maDe} dong={d.de.dong} soDangDo={d.luot.filter((l) => !l.nop).length} daXong={tai} />
      </div></section>
      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Câu tự luận</h2>
          <label className="nho" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={chiChuaCham} onChange={(e) => setChiChuaCham(e.target.checked)} /> Chỉ hiện câu chưa chấm</label>
        </div>
        <p className="gt nho">Cô đọc bài gõ hoặc xem ảnh bài làm, ghi điểm và nhận xét rồi bấm Lưu. Lưu xong, điểm cộng ngay vào bài làm trong hồ sơ của con.</p>
        {dsCham.length === 0 && <p className="nho">{d.cham.length ? "Cô đã chấm hết các câu." : "Đề này không có câu cô chấm, hoặc chưa con nào nộp."}</p>}
        <div style={{ display: "grid", gap: 14 }}>
          {dsCham.map((c) => <TheCham key={c.id} c={c} cau={cauTheoId.get(c.maCau)} daLuu={tai} />)}
        </div>
      </div></section>
    </>
  );
}

// Sau giờ đóng 2 phút, lượt nào còn dở (con sập máy, không mở lại) thì cô nộp giúp với phần con đã lưu.
function NopGiup({ maDe, dong, soDangDo, daXong }: { maDe: string; dong: string; soDangDo: number; daXong: () => void }) {
  const [tt, setTt] = useState<string>("");
  if (soDangDo === 0) return null;
  const daDong = Date.now() > Date.parse(dong) + 2 * 60000;
  if (!daDong) return <p className="nho" style={{ marginTop: 8 }}>{soDangDo} lượt đang làm. Sau giờ đóng 2 phút, lượt nào còn dở thì cô nộp giúp được ở đây.</p>;
  const nop = async () => {
    if (!window.confirm(`Nộp giúp ${soDangDo} lượt còn dở với phần các con đã lưu?`)) return;
    setTt("Đang nộp giúp…");
    try { const r = await goi<{ daNopGiup: number }>("ld_co_nop_ho", { p_de: maDe }); setTt(`Đã nộp giúp ${r.daNopGiup} lượt.`); daXong(); }
    catch (e) { setTt((e as Error).message); }
  };
  return (
    <div className="hang" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
      <button className="nut" onClick={nop}>Nộp giúp {soDangDo} lượt còn dở</button>
      {tt && <span className="nho" role="status">{tt}</span>}
    </div>
  );
}

function TheCham({ c, cau, daLuu }: { c: DongCham; cau?: { so: number; phan: string; cau: string }; daLuu: () => void }) {
  const [diem, setDiem] = useState(c.diem === null ? "" : String(c.diem));
  const [nhanXet, setNhanXet] = useState(c.nhanXet ?? "");
  const [anh, setAnh] = useState<string[]>([]);
  const [tt, setTt] = useState<"" | "dang" | "xong" | "loi">("");
  const [loi, setLoi] = useState("");
  const xemAnh = async () => {
    try { setAnh(await Promise.all(c.anh.map((id) => goi<{ loai: string; duLieu: string }>("ld_co_anh", { p_id: id }).then((a) => `data:${a.loai};base64,${a.duLieu}`)))); }
    catch (e) { setLoi((e as Error).message); setTt("loi"); }
  };
  const luu = async (e: React.FormEvent) => {
    e.preventDefault();
    const so = diem.trim() === "" ? null : Number(diem.replace(",", "."));
    if (so !== null && (isNaN(so) || so < 0 || so > (c.diemToiDa ?? so))) { setTt("loi"); setLoi(`Điểm phải từ 0 đến ${c.diemToiDa}.`); return; }
    setTt("dang");
    try { await goi("ld_co_cham", { p_id: c.id, p_diem: so, p_nhan_xet: nhanXet }); setTt("xong"); daLuu(); }
    catch (er) { setTt("loi"); setLoi((er as Error).message); }
  };
  return (
    <form className="the" onSubmit={luu} style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{c.hoTen} <span className="rat-nho">{c.maHs}</span></strong>
        <span className="nho">{cau ? `${cau.phan}, câu ${cau.so}` : c.maCau} · tối đa {c.diemToiDa} điểm</span>
      </div>
      {cau?.cau && <p className="nho" style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{cau.cau}</p>}
      <div style={{ whiteSpace: "pre-wrap", background: "var(--kem)", border: "1px solid var(--vien)", borderRadius: "var(--bo-nho)", padding: "10px 12px", margin: "8px 0" }}>
        {c.baiLam?.trim() ? c.baiLam : <span className="rat-nho">Con không gõ bài vào khung.</span>}
      </div>
      {c.anh.length > 0 && (anh.length === 0
        ? <button type="button" className="nut phu" onClick={xemAnh} style={{ marginBottom: 8 }}>Xem {c.anh.length} ảnh bài làm</button>
        : <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{anh.map((a, i) => <a key={i} href={a} target="_blank" rel="noreferrer"><img src={a} alt={`Ảnh bài làm ${i + 1} của ${c.hoTen}`} style={{ maxHeight: 220, borderRadius: 8, border: "1px solid var(--vien)" }} /></a>)}</div>)}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(90px, 120px) 1fr", gap: 10, alignItems: "start" }}>
        <div>
          <label className="rat-nho" htmlFor={`diem-${c.id}`}>Điểm</label>
          <input id={`diem-${c.id}`} className="o-nhap" inputMode="decimal" value={diem} onChange={(e) => { setDiem(e.target.value); setTt(""); }} style={{ padding: "8px 10px" }} />
        </div>
        <div>
          <label className="rat-nho" htmlFor={`nx-${c.id}`}>Nhận xét của cô (con và ba mẹ đọc được)</label>
          <textarea id={`nx-${c.id}`} className="o-nhap" rows={2} value={nhanXet} onChange={(e) => { setNhanXet(e.target.value); setTt(""); }} style={{ padding: "8px 10px", resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button className="nut" type="submit" disabled={tt === "dang"}>{tt === "dang" ? "Đang lưu…" : "Lưu"}</button>
        {tt === "xong" && <span className="nho" role="status">Đã lưu.</span>}
        {tt === "loi" && <span role="alert" style={{ color: "var(--tt-on)", fontSize: 13 }}>{loi}</span>}
        {c.nguoiCham && tt === "" && <span className="rat-nho">Đã chấm: {c.diem} điểm</span>}
      </div>
    </form>
  );
}

function DuongDan({ maDe }: { maDe: string }) {
  const [ds, setDs] = useState<HocSinhMa[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [daChep, setDaChep] = useState<string>("");
  useEffect(() => { goi<HocSinhMa[]>("ld_co_ma_thi").then(setDs).catch((e) => setLoi(e.message)); }, []);
  const duongDan = (h: HocSinhMa) => `${DIA_CHI_THI}?de=${encodeURIComponent(maDe)}&ma=${h.ma}`;
  const tao = async (hs?: string, doi = false) => {
    if (doi && !window.confirm("Đổi mã thì đường dẫn cũ của con hết dùng được. Cô chắc chắn chứ?")) return;
    try { setDs(await goi<HocSinhMa[]>("ld_co_tao_ma", { p_hoc_sinh: hs ?? null, p_doi: doi })); setLoi(null); }
    catch (e) { setLoi((e as Error).message); }
  };
  const chep = async (t: string, khoa: string) => { try { await navigator.clipboard.writeText(t); setDaChep(khoa); } catch { window.prompt("Cô chép đường dẫn này:", t); } };
  if (!ds) return <div className="dang-tai">{loi ?? "Đang tải danh sách lớp…"}</div>;
  const chuaCo = ds.filter((h) => !h.ma).length;
  const tatCa = ds.filter((h) => h.ma && !h.laMau).map((h) => `${h.hoTen}\t${duongDan(h)}`).join("\n");
  return (
    <section className="phan"><div className="khung">
      <div className="tieu"><h2>Đường dẫn riêng của từng con</h2><span className="nguon">Mỗi con một mã khó đoán, không cần mật khẩu</span></div>
      <p className="gt nho">Cô Ngọc tạo mã một lần cho cả năm. Đường dẫn dưới đây là của đề đang chọn; đổi đề ở trên thì đường dẫn đổi theo, mã của con giữ nguyên. Chỉ gửi đường dẫn cho đúng gia đình của con. Lỡ gửi nhầm thì bấm “Đổi mã”.</p>
      {loi && <p role="alert" style={{ color: "var(--tt-on)" }}>{loi}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0 14px" }}>
        {chuaCo > 0 && <button className="nut" onClick={() => tao()}>Tạo mã cho {chuaCo} bạn chưa có</button>}
        {tatCa && <button className="nut phu" onClick={() => chep(tatCa, "tat-ca")}>{daChep === "tat-ca" ? "Đã chép cả danh sách" : "Chép cả danh sách"}</button>}
      </div>
      <div className="bang-bao"><table>
        <thead><tr><th>Học sinh</th><th>Đường dẫn vào đề</th><th></th></tr></thead>
        <tbody>{ds.map((h) => (
          <tr key={h.id}>
            <td><strong>{h.hoTen}</strong><div className="rat-nho">{h.maHs}{h.laMau ? " · học sinh mẫu" : ""}</div></td>
            <td className="nho" style={{ wordBreak: "break-all" }}>{h.ma ? duongDan(h) : <span className="rat-nho">Chưa có mã</span>}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              {h.ma ? <>
                <button className="nut phu" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => chep(duongDan(h), h.id)}>{daChep === h.id ? "Đã chép" : "Chép"}</button>{" "}
                <button className="nut phu" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => tao(h.id, true)}>Đổi mã</button>
              </> : <button className="nut phu" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => tao(h.id)}>Tạo mã</button>}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
    </div></section>
  );
}
