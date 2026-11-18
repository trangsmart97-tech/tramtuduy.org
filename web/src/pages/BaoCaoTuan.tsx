import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sb } from "../lib/supabase";
import { LOAI_LOI, NHOM_MON, gomTheo, ngayVN, phanTram, taiHoSo, trungVi, type HoSoDayDu } from "../lib/hoSo";
import { useNguoiDung } from "../lib/nguoiDung";
import { BangXemThu } from "../components/Khung";

export default function BaoCaoTuan() {
  const { id, tuan } = useParams();
  const w = Number(tuan);
  const [d, setD] = useState<HoSoDayDu | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const { vai } = useNguoiDung();
  useEffect(() => { if (id) taiHoSo(id).then(setD); }, [id]);
  if (!d) return <div className="dang-tai">Đang mở báo cáo…</div>;
  const { hs, baiLam, cau, chamTay, chuyenCan, coach, chuDe, kyNang } = d;
  const bc = d.baoCao.find((b) => b.tuan === w);
  const bais = baiLam.filter((b) => b.tuan === w);
  const ids = new Set(bais.map((b) => b.id));
  const cs = cau.filter((c) => ids.has(c.bai_lam_id));
  const nhom = gomTheo(cs, (c) => c.nhom_mon);
  const dongNhom = NHOM_MON.map((n) => ({ n, g: nhom.get(n) })).filter((x) => x.g);
  const xep = [...dongNhom].sort((a, b) => b.g!.dung / b.g!.n - a.g!.dung / a.g!.n);
  const tc = bais.find((b) => b.loai === "thuc_chien");
  const loi = gomTheo(cs.filter((c) => c.loai_loi), (c) => c.loai_loi);
  const loiNhieu = [...loi].sort((a, b) => b[1].n - a[1].n)[0];
  const ct = chamTay.filter((c) => ids.has(c.bai_lam_id));
  const hong = ct.filter((c) => c.diem_hong);
  const cc = chuyenCan.filter((c) => bais.length && c.ngay >= (bc?.tu_ngay ?? "") && c.ngay <= (bc?.den_ngay ?? ""));
  const coachTuan = coach.filter((c) => c.chia_se_phu_huynh && c.ngay >= (bc?.tu_ngay ?? "") && c.ngay <= (bc?.den_ngay ?? ""));
  const knSai = gomTheo(cs.filter((c) => c.dung === false), (c) => c.ma_ky_nang);
  const knTop = [...knSai].sort((a, b) => b[1].n - a[1].n)[0];
  const nhomYeu = xep.length ? xep[xep.length - 1].n : null;
  const cdSai = gomTheo(cs.filter((c) => c.dung === false && c.nhom_mon === nhomYeu), (c) => c.ma_chu_de);
  const cdTop = [...cdSai].sort((a, b) => b[1].n - a[1].n).slice(0, 2).map(([m]) => chuDe.find((x) => x.ma === m)?.ten_tre).filter(Boolean).map((t) => `“${t}”`);
  const coTheDuyet = !!vai && (vai.vai === "giang_day" || vai.quan_tri) && bc?.trang_thai === "nhap";

  const duyet = async () => {
    if (!bc) return;
    const { error } = await sb.from("bao_cao_tuan").update({ trang_thai: "da_duyet", duyet_boi: vai?.email, duyet_luc: new Date().toISOString() }).eq("id", bc.id).select();
    setThongBao(error ? `Chưa duyệt được: ${error.message}` : "Đã duyệt. Báo cáo sẵn sàng gửi ba mẹ.");
  };

  return (
    <main>
      {hs.la_mau && <BangXemThu noi="Báo cáo của học sinh giả. Báo cáo thật chỉ ba mẹ của con và các cô xem được." />}
      <section className="ho-so-dau"><div className="khung">
        <Link to={hs.la_mau ? "/ho-so-mau" : `/ho-so/${hs.id}`} className="nho">← Về hồ sơ của {hs.ten_goi ?? hs.ho_ten}</Link>
        <h1 style={{ margin: "10px 0 4px" }}>Báo cáo tuần {w}</h1>
        <div className="nho">{hs.ho_ten} · {ngayVN(bc?.tu_ngay)} đến {ngayVN(bc?.den_ngay)} · {bc?.trang_thai === "nhap" ? "Bản nháp, chờ cô Trang duyệt" : "Đã gửi ba mẹ"}</div>
        {coTheDuyet && <p style={{ marginTop: 14 }}><button className="nut" onClick={duyet}>Duyệt báo cáo này</button></p>}
        {thongBao && <p className="nho" role="status">{thongBao}</p>}
      </div></section>

      <section className="phan"><div className="khung hai-cot">
        <div className="the" style={{ borderLeft: "4px solid var(--tt-vung)", borderRadius: "0 14px 14px 0" }}>
          <div className="so-tt rat-nho" style={{ fontWeight: 700, color: "var(--tt-vung)" }}>ĐIỀU CON LÀM TỐT</div>
          <p style={{ margin: "6px 0 0" }}>{xep[0] ? <>Tuần này con mạnh nhất ở <strong>{xep[0].n}</strong>: đúng {xep[0].g!.dung} trên {xep[0].g!.n} câu ({phanTram(xep[0].g!.dung, xep[0].g!.n)}%).</> : "Tuần này chưa có bài máy chấm."}{tc ? <> Bài Thực chiến Chủ nhật con đạt <strong>{Math.round(100 * (tc.diem ?? 0) / (tc.diem_toi_da ?? 1))} trên 100</strong>.</> : null}</p>
        </div>
        <div className="the" style={{ borderLeft: "4px solid var(--dat)", borderRadius: "0 14px 14px 0" }}>
          <div className="rat-nho" style={{ fontWeight: 700, color: "var(--dat)" }}>VIỆC CON LÀM TIẾP</div>
          <p style={{ margin: "6px 0 0" }}>{xep.length ? <>Dành thêm thời gian cho <strong>{xep[xep.length - 1].n}</strong>{cdTop.length ? <>, nhất là {cdTop.length > 1 ? "hai trạm" : "trạm"} {cdTop.join(" và ")}</> : null}.</> : null}{knTop ? <> Kỹ năng cần rèn: <strong>{kyNang.find((k) => k.ma === knTop[0])?.ten}</strong>.</> : null}</p>
        </div>
      </div></section>

      <section className="phan"><div className="khung">
        <h2>Kết quả trong tuần</h2>
        <div className="bang-bao"><table>
          <thead><tr><th>Nhóm môn</th><th className="so">Số câu</th><th className="so">Đúng</th><th style={{ minWidth: 160 }}>Tỷ lệ</th><th className="so">Thời gian mỗi câu</th></tr></thead>
          <tbody>{dongNhom.map(({ n, g }) => (
            <tr key={n}><td>{n}</td><td className="so">{g!.n}</td><td className="so">{g!.dung}</td><td><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className="thanh-nho" style={{ flex: 1 }}><span style={{ width: `${phanTram(g!.dung, g!.n)}%` }} /></div>{phanTram(g!.dung, g!.n)}%</div></td><td className="so">{Math.round(trungVi(g!.giay))} giây</td></tr>
          ))}</tbody>
        </table></div>
        {loiNhieu && <p className="nho" style={{ marginTop: 10 }}>Loại lỗi gặp nhiều nhất tuần này: <strong>{LOAI_LOI[loiNhieu[0]].ten}</strong> ({loiNhieu[1].n} câu). {LOAI_LOI[loiNhieu[0]].giai_thich}</p>}
      </div></section>

      <section className="phan"><div className="khung hai-cot">
        <div>
          <h2>Bài cô chấm</h2>
          {hong.length === 0 && <p className="nho">Tuần này các tiêu chí đều đạt trọn.</p>}
          {hong.map((h) => <p key={h.id} className="nho"><strong>{h.tieu_chi}</strong> ({h.muc}): {h.diem_hong}</p>)}
        </div>
        <div>
          <h2>Trong lớp và đồng hành</h2>
          <p className="nho">Có mặt {cc.filter((c) => c.co_mat).length} trên {cc.length} buổi.</p>
          {coachTuan.map((c) => <div key={c.id} className="the" style={{ marginBottom: 8 }}><strong>{c.van_de}</strong><p className="nho" style={{ margin: "4px 0 0" }}>{c.ke_hoach}</p></div>)}
          <p className="rat-nho">Ba mẹ cần trao đổi thêm, cô Yori luôn sẵn sàng đồng hành.</p>
        </div>
      </div></section>
    </main>
  );
}
