import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import {
  LOAI_LOI, NHOM_MON, gomTheo, ngayVN, phanTram, tinhChuDe, NGAY_XET_MAU,
  type BaiLam, type BaoCao, type Cau, type ChamTay, type ChuDe, type ChuyenCan, type GhiChuCoach, type HocSinh, type NhanSu,
} from "../lib/hoSo";
import { useNguoiDung } from "../lib/nguoiDung";
import { BangXemThu } from "../components/Khung";

type DuLieuLop = { hs: HocSinh[]; bai: BaiLam[]; cau: Cau[]; cham: ChamTay[]; cc: ChuyenCan[]; coach: GhiChuCoach[]; bc: BaoCao[]; chuDe: ChuDe[]; doiNgu: NhanSu[] };

async function tatCa<T>(bang: string, chon = "*"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(bang).select(chon).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const VAI = [
  { ma: "giang_day", nhan: "Cô Trang · Giảng dạy" },
  { ma: "cham_bai", nhan: "Cô Nguyên · Chấm bài" },
  { ma: "giao_vu", nhan: "Cô Ngọc · Giáo vụ" },
  { ma: "coach", nhan: "Cô Yori · Coach" },
];

export default function NhanSuTrang() {
  const { vai } = useNguoiDung();
  const [tab, setTab] = useState<string>(vai?.vai ?? "giang_day");
  const [d, setD] = useState<DuLieuLop | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { if (vai?.vai) setTab(vai.vai); }, [vai]);
  useEffect(() => {
    Promise.all([
      tatCa<HocSinh>("hoc_sinh"), tatCa<BaiLam>("bai_lam"), tatCa<Cau>("cau_tra_loi"), tatCa<ChamTay>("cham_tay"),
      tatCa<ChuyenCan>("chuyen_can"), tatCa<GhiChuCoach>("ghi_chu_coach"), tatCa<BaoCao>("bao_cao_tuan"), tatCa<ChuDe>("chu_de"), tatCa<NhanSu>("nhan_su"),
    ]).then(([hs, bai, cau, cham, cc, coach, bc, chuDe, doiNgu]) => setD({ hs: hs.sort((a, b) => a.ma_hs.localeCompare(b.ma_hs)), bai, cau, cham, cc, coach, bc, chuDe, doiNgu })).catch((e) => setLoi(String(e.message ?? e)));
  }, []);
  if (loi) return <div className="dang-tai">Không tải được dữ liệu lớp: {loi}</div>;
  if (!d) return <div className="dang-tai">Đang tải dữ liệu lớp…</div>;
  return (
    <main>
      {!vai && <BangXemThu noi="Cô đang xem bằng 6 học sinh mẫu. Khi đăng nhập bằng thư của mình, mỗi cô thấy dữ liệu thật và làm được phần việc của mình." />}
      <section className="ho-so-dau"><div className="khung">
        <h1 style={{ marginBottom: 4 }}>Bàn làm việc của cô</h1>
        <p className="nho" style={{ margin: 0 }}>Bốn cô cùng xem toàn bộ dữ liệu. Mỗi loại dữ liệu có một cô làm chủ; mọi lần sửa đều ghi vào nhật ký.</p>
        <div className="the-vai" role="tablist">
          {VAI.map((v) => <button key={v.ma} role="tab" aria-selected={tab === v.ma} className={tab === v.ma ? "dang" : ""} onClick={() => setTab(v.ma)}>{v.nhan}</button>)}
        </div>
      </div></section>
      {tab === "giang_day" && <TongQuan d={d} />}
      {tab === "cham_bai" && <ChamBai d={d} />}
      {tab === "giao_vu" && <GiaoVu d={d} />}
      {tab === "coach" && <Coach d={d} />}
    </main>
  );
}

function useTongHop(d: DuLieuLop) {
  return useMemo(() => {
    const baiById = new Map(d.bai.map((b) => [b.id, b]));
    return d.hs.map((h) => {
      const bai = d.bai.filter((b) => b.hoc_sinh_id === h.id);
      const ids = new Set(bai.map((b) => b.id));
      const cau = d.cau.filter((c) => ids.has(c.bai_lam_id));
      const xep = cau.filter((c) => (baiById.get(c.bai_lam_id)?.do_tin_cay ?? 4) <= 2);
      const tc = bai.filter((b) => b.loai === "thuc_chien").sort((a, b) => a.ngay.localeCompare(b.ngay)).map((b) => Math.round((100 * (b.diem ?? 0)) / (b.diem_toi_da ?? 1)));
      const moc = bai.find((b) => b.loai === "moc");
      const nhom = gomTheo(xep, (c) => c.nhom_mon);
      const kq = tinhChuDe(d.chuDe, bai, cau, h.la_mau ? NGAY_XET_MAU : new Date().toISOString().slice(0, 10));
      const giam2 = tc.length >= 3 && tc[tc.length - 1] < tc[tc.length - 2] && tc[tc.length - 2] < tc[tc.length - 3];
      return { h, tc, moc: moc ? Math.round((100 * (moc.diem ?? 0)) / (moc.diem_toi_da ?? 1)) : null, nhom, vung: kq.filter((k) => k.tt === "vung").length, giam2, cau: xep };
    });
  }, [d]);
}

function TongQuan({ d }: { d: DuLieuLop }) {
  const th = useTongHop(d);
  const choDuyet = d.bc.filter((b) => b.trang_thai === "nhap");
  const tatCaCau = th.flatMap((t) => t.cau);
  const theoCD = gomTheo(tatCaCau, (c) => c.ma_chu_de);
  const yeu = [...theoCD].filter(([, g]) => g.n >= 12).sort((a, b) => a[1].dung / a[1].n - b[1].dung / b[1].n).slice(0, 6);
  return (
    <>
      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Cả lớp</h2><span className="nguon">{d.hs.length} bạn · {choDuyet.length} báo cáo tuần chờ cô duyệt</span></div>
        <div className="bang-bao"><table>
          <thead><tr><th>Học sinh</th>{NHOM_MON.map((n) => <th key={n} className="so">{n}</th>)}<th className="so">Mốc 1</th><th>Thực chiến các tuần</th><th className="so">Trạm vững</th><th>Báo cáo</th></tr></thead>
          <tbody>{th.map((t) => {
            const nhap = choDuyet.find((b) => b.hoc_sinh_id === t.h.id);
            return (
              <tr key={t.h.id}>
                <td><Link to={`/ho-so/${t.h.id}`}><strong>{t.h.ho_ten}</strong></Link>{t.giam2 && <div className="rat-nho" style={{ color: "var(--tt-on)" }}>↓ Thực chiến giảm hai lần liền</div>}</td>
                {NHOM_MON.map((n) => { const g = t.nhom.get(n); const p = g ? phanTram(g.dung, g.n) : 0; return <td key={n} className="so" style={{ color: p < 70 ? "var(--tt-on)" : undefined, fontWeight: p < 70 ? 700 : 400 }}>{p}%</td>; })}
                <td className="so">{t.moc ?? "–"}</td>
                <td className="nho">{t.tc.join(" · ")}</td>
                <td className="so">{t.vung}</td>
                <td>{nhap ? <Link to={`/ho-so/${t.h.id}/bao-cao/${nhap.tuan}`}>Duyệt tuần {nhap.tuan}</Link> : <span className="rat-nho">Đã gửi</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="rat-nho" style={{ marginTop: 8 }}>Số in đỏ: dưới 70%. Theo khung, nhóm môn cả lớp dưới 70% được tăng phần ở câu Khởi động, Thực chiến và phần ở nhà của chu kỳ sau.</p>
      </div></section>
      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Trạm cả lớp còn yếu</h2><span className="nguon">Đưa vào câu Khởi động hai tuần tới và tuần tổng ôn</span></div>
        <div className="bang-bao"><table>
          <thead><tr><th>Trạm</th><th>Nhóm môn</th><th className="so">Tuần học</th><th className="so">Số câu cả lớp</th><th className="so">Đúng</th></tr></thead>
          <tbody>{yeu.map(([ma, g]) => { const cd = d.chuDe.find((x) => x.ma === ma); return <tr key={ma}><td><strong>{cd?.ten_tre}</strong><div className="rat-nho">{ma}</div></td><td>{cd?.nhom_mon}</td><td className="so">{cd?.tuan}</td><td className="so">{g.n}</td><td className="so">{phanTram(g.dung, g.n)}%</td></tr>; })}</tbody>
        </table></div>
      </div></section>
    </>
  );
}

function ChamBai({ d }: { d: DuLieuLop }) {
  const baiById = new Map(d.bai.map((b) => [b.id, b]));
  const tieuChi = (loai: string) => {
    const ct = d.cham.filter((c) => baiById.get(c.bai_lam_id)?.loai === loai);
    return [...new Set(ct.map((c) => c.tieu_chi))].map((t) => {
      const xs = ct.filter((c) => c.tieu_chi === t);
      return { t, tb: phanTram(xs.reduce((s, c) => s + (c.diem ?? 0), 0), xs.reduce((s, c) => s + (c.diem_toi_da ?? 0), 0)), hong: xs.filter((c) => c.diem_hong).length, n: xs.length, mau: xs.find((c) => c.diem_hong)?.diem_hong };
    }).sort((a, b) => a.tb - b.tb);
  };
  const loiTheoNhom = NHOM_MON.map((n) => ({ n, g: gomTheo(d.cau.filter((c) => c.nhom_mon === n && c.loai_loi), (c) => c.loai_loi) }));
  const tuanCuoi = Math.max(...d.bai.map((b) => b.tuan ?? 0));
  const tuLuan = d.bai.filter((b) => b.loai === "bai_viet" || b.loai === "loi_giai");
  return (
    <>
      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Bài tự luận cả lớp, từ tuần 1 đến tuần {tuanCuoi}</h2><span className="nguon">{tuLuan.filter((b) => b.loai === "bai_viet").length} bài viết và {tuLuan.filter((b) => b.loai === "loi_giai").length} lời giải Toán đã chấm</span></div>
        <p className="gt nho">Cô Nguyên chấm theo từng tiêu chí của barem, chấm cả lớp một tiêu chí rồi mới sang tiêu chí sau. Mỗi điểm trừ ghi một “điểm hỏng” để tạo dữ liệu cho tuần ôn khắc phục.</p>
        <div className="hai-cot">
          {[{ ten: "Bài viết đoạn", ds: tieuChi("bai_viet") }, { ten: "Lời giải Toán", ds: tieuChi("loi_giai") }].map((x) => (
            <div key={x.ten}><h3>{x.ten}: tiêu chí cả lớp còn hụt</h3>
              <div className="bang-bao"><table><thead><tr><th>Tiêu chí</th><th className="so">Đạt</th><th className="so">Số lần có điểm hỏng</th><th>Điểm hỏng hay gặp</th></tr></thead>
                <tbody>{x.ds.map((r) => <tr key={r.t}><td><strong>{r.t}</strong></td><td className="so">{r.tb}%</td><td className="so">{r.hong} trên {r.n}</td><td className="nho">{r.mau ?? "Không có"}</td></tr>)}</tbody></table></div>
            </div>
          ))}
        </div>
      </div></section>
      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Loại lỗi theo nhóm môn, cả lớp</h2><span className="nguon">Từ mọi câu máy chấm</span></div>
        <div className="bang-bao"><table><thead><tr><th>Nhóm môn</th>{Object.values(LOAI_LOI).map((l) => <th key={l.ten} className="so">{l.ten}</th>)}</tr></thead>
          <tbody>{loiTheoNhom.map(({ n, g }) => <tr key={n}><td>{n}</td>{Object.keys(LOAI_LOI).map((k) => <td key={k} className="so">{g.get(k)?.n ?? 0}</td>)}</tr>)}</tbody></table></div>
        <p className="rat-nho" style={{ marginTop: 8 }}>Nhiều lỗi “Hiểu sai đề”: tăng bài tập gạch từ khoá. Nhiều lỗi “Tính sai hoặc ẩu”: tăng bước kiểm tra lại đáp số.</p>
      </div></section>
    </>
  );
}

function GiaoVu({ d }: { d: DuLieuLop }) {
  const cuoi = d.cc.reduce((m, c) => (c.ngay > m ? c.ngay : m), "");
  const tu = new Date(Date.parse(cuoi) - 6 * 86400000).toISOString().slice(0, 10);
  const ngay = [...new Set(d.cc.filter((c) => c.ngay >= tu).map((c) => c.ngay))].sort();
  const KY: Record<number, string> = { 1: "Ít", 2: "Vừa", 3: "Tích cực" };
  return (
    <section className="phan"><div className="khung">
      <div className="tieu"><h2>Chuyên cần và tương tác tuần gần nhất</h2><span className="nguon">Cô Ngọc ghi nhận sau mỗi buổi</span></div>
      <div className="bang-bao"><table>
        <thead><tr><th>Học sinh</th>{ngay.map((n) => <th key={n} className="so">{ngayVN(n).slice(0, 5)}</th>)}<th>Ghi chú</th></tr></thead>
        <tbody>{d.hs.map((h) => {
          const r = d.cc.filter((c) => c.hoc_sinh_id === h.id && c.ngay >= tu);
          return (<tr key={h.id}><td><strong>{h.ho_ten}</strong></td>{ngay.map((n) => { const c = r.find((x) => x.ngay === n); return <td key={n} className="so" style={{ color: !c?.co_mat ? "var(--tt-on)" : c.tuong_tac === 1 ? "var(--tt-luyen)" : undefined }}>{!c ? "" : !c.co_mat ? "Vắng" : KY[c.tuong_tac ?? 2]}</td>; })}<td className="nho">{r.filter((c) => c.ghi_chu).map((c) => c.ghi_chu).slice(-1)[0] ?? ""}</td></tr>);
        })}</tbody>
      </table></div>
      <p className="rat-nho" style={{ marginTop: 8 }}>Mức tương tác: Ít, Vừa, Tích cực. Cô Ngọc cũng quản lý danh sách lớp và thư của phụ huynh.</p>
    </div></section>
  );
}

function Coach({ d }: { d: DuLieuLop }) {
  const th = useTongHop(d);
  const cuoi = d.cc.reduce((m, c) => (c.ngay > m ? c.ngay : m), "");
  const tu = new Date(Date.parse(cuoi) - 6 * 86400000).toISOString().slice(0, 10);
  const canhBao = th.map((t) => {
    const ly: string[] = [];
    if (t.giam2) ly.push(`Điểm Thực chiến giảm hai lần liền: ${t.tc.slice(-3).join(", ")}`);
    const cc = d.cc.filter((c) => c.hoc_sinh_id === t.h.id && c.ngay >= tu);
    const it = cc.filter((c) => c.tuong_tac === 1).length; const vang = cc.filter((c) => !c.co_mat).length;
    if (it >= 2) ly.push(`Tương tác mức “Ít” ở ${it} buổi trong tuần`);
    if (vang >= 2) ly.push(`Vắng ${vang} buổi trong tuần`);
    return { t, ly };
  }).filter((x) => x.ly.length);
  return (
    <section className="phan"><div className="khung">
      <div className="tieu"><h2>Các bạn cần cô đồng hành</h2><span className="nguon">Hệ thống tự gợi ý theo số liệu; cô Yori quyết định</span></div>
      <p className="gt nho">Theo luật của dự án, người soạn có trách nhiệm báo cô khi số liệu cho thấy một bạn quá sức, như điểm giảm hai lần liền hoặc mệt trong giờ.</p>
      {canhBao.length === 0 && <p>Tuần này chưa có bạn nào cần báo.</p>}
      <div className="luoi c3">{canhBao.map(({ t, ly }) => (
        <div className="canh-bao" key={t.h.id}>
          <div className="nhan-cb">CẦN ĐỒNG HÀNH</div>
          <h3 style={{ margin: "4px 0 6px" }}><Link to={`/ho-so/${t.h.id}`}>{t.h.ho_ten}</Link></h3>
          <ul className="nho" style={{ margin: "0 0 8px", paddingLeft: 18 }}>{ly.map((l) => <li key={l}>{l}</li>)}</ul>
          {d.coach.filter((c) => c.hoc_sinh_id === t.h.id).slice(0, 1).map((c) => <p key={c.id} className="nho" style={{ margin: 0 }}><strong>Kế hoạch:</strong> {c.ke_hoach}</p>)}
        </div>
      ))}</div>
    </div></section>
  );
}
