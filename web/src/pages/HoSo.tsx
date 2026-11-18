import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sb } from "../lib/supabase";
import {
  BLOOM, LOAI_LOI, NHOM_MON, TEN_TT, baViec, gomTheo, ngayVN, phanTram, taiHoSo, tinhChuDe, trungVi, tuanTheoNgay,
  type HoSoDayDu, type KetQuaChuDe,
} from "../lib/hoSo";
import { CotDon, DuongDiem, ThanhDich, useGoiY } from "../components/BieuDo";
import { BangXemThu } from "../components/Khung";

export function TrangHoSoMau() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => { sb.from("hoc_sinh").select("id").eq("ma_hs", "MAU-01").single().then(({ data }) => setId(data?.id ?? null)); }, []);
  return id ? <HoSoTheoId id={id} /> : <div className="dang-tai">Đang mở hồ sơ mẫu…</div>;
}

export function TrangHoSo() {
  const { id } = useParams();
  return id ? <HoSoTheoId id={id} /> : null;
}

function HoSoTheoId({ id }: { id: string }) {
  const [d, setD] = useState<HoSoDayDu | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { setD(null); taiHoSo(id).then(setD).catch((e) => setLoi(String(e.message ?? e))); }, [id]);
  if (loi) return <div className="dang-tai">Không mở được hồ sơ: {loi}. Có thể cô hoặc ba mẹ chưa đăng nhập đúng tài khoản.</div>;
  if (!d) return <div className="dang-tai">Đang tổng hợp hồ sơ…</div>;
  return <HoSoView d={d} />;
}

function TT({ tt }: { tt: KetQuaChuDe["tt"] }) {
  return <span className={`tt ${tt}`}><span aria-hidden>{TEN_TT[tt].ky}</span>{TEN_TT[tt].ten}</span>;
}

function HoSoView({ d }: { d: HoSoDayDu }) {
  const { hs, chuDe, kyNang, baiLam, cau, chamTay, chuyenCan, coach, baoCao, ngayXet } = d;
  const tuanNay = tuanTheoNgay(ngayXet);
  const [bang, setBang] = useState<Record<string, boolean>>({});
  const doi = (k: string) => setBang((b) => ({ ...b, [k]: !b[k] }));
  const goiY = useGoiY();

  const baiById = useMemo(() => new Map(baiLam.map((b) => [b.id, b])), [baiLam]);
  const cauXep = useMemo(() => cau.filter((c) => (baiById.get(c.bai_lam_id)?.do_tin_cay ?? 4) <= 2), [cau, baiById]);
  const kq = useMemo(() => tinhChuDe(chuDe, baiLam, cau, ngayXet), [chuDe, baiLam, cau, ngayXet]);
  const viec = useMemo(() => baViec(kq, cauXep, kyNang), [kq, cauXep, kyNang]);

  const theoNhom = gomTheo(cauXep, (c) => c.nhom_mon);
  const dongNhom = NHOM_MON.map((n) => { const g = theoNhom.get(n) ?? { n: 0, dung: 0, giay: [] }; return { ten: n, gt: phanTram(g.dung, g.n), n: g.n, dung: g.dung }; });
  const tongDung = cauXep.filter((c) => c.dung).length;

  const diemBai = baiLam.filter((b) => ["dau_vao", "thuc_chien", "moc", "de"].includes(b.loai) && b.diem_toi_da).map((b) => {
    const cs = cau.filter((c) => c.bai_lam_id === b.id);
    const sai = cs.filter((c) => c.dung === false).length;
    return { nhan: b.loai === "thuc_chien" ? `Thực chiến ${b.tuan}` : b.loai === "dau_vao" ? "Đầu vào" : (b.ten_bai ?? "").replace("Bài kiểm tra ", ""), ngay: ngayVN(b.ngay), gt: Math.round((100 * (b.diem ?? 0)) / (b.diem_toi_da ?? 1)), loai: b.loai, chiTiet: `${cs.length} câu, sai ${sai} câu` };
  });
  const moc = baiLam.filter((b) => b.loai === "moc");

  const daHoc = kq.filter((k) => (k.cd.tuan ?? 99) <= tuanNay);
  const demTT = (t: string) => daHoc.filter((k) => k.tt === t).length;

  const theoKN = gomTheo(cauXep, (c) => c.ma_ky_nang);
  const dongKN = kyNang.map((k) => { const g = theoKN.get(k.ma); return { k, n: g?.n ?? 0, dung: g?.dung ?? 0, giay: trungVi(g?.giay ?? []) }; }).filter((x) => x.n > 0)
    .sort((a, b) => (b.n >= 4 ? 1 : 0) - (a.n >= 4 ? 1 : 0) || b.dung / b.n - a.dung / a.n);

  const theoBloom = gomTheo(cauXep, (c) => c.bloom);
  const cotBloom = BLOOM.map((b) => { const g = theoBloom.get(b); return { ten: b, gt: g ? phanTram(g.dung, g.n) : 0, phu: g ? `Đúng ${g.dung} trên ${g.n} câu` : "Chưa có câu ở bậc này" }; });

  const coLoi = cauXep.filter((c) => c.loai_loi);
  const theoLoi = gomTheo(coLoi, (c) => c.loai_loi);
  const cotLoi = Object.entries(LOAI_LOI).map(([k, v]) => ({ ten: v.ten, gt: theoLoi.get(k)?.n ?? 0, phu: `${theoLoi.get(k)?.n ?? 0} câu. ${v.giai_thich}` }));

  const tang3 = baiLam.filter((b) => b.loai === "tang3").sort((a, b) => (b.ngay.localeCompare(a.ngay)));
  const tieuChi = (loai: string) => {
    const bais = baiLam.filter((b) => b.loai === loai).sort((a, b) => a.ngay.localeCompare(b.ngay));
    const ids = new Set(bais.map((b) => b.id));
    const ct = chamTay.filter((c) => ids.has(c.bai_lam_id));
    const ten = [...new Set(ct.map((c) => c.tieu_chi))];
    const cuoi = bais[bais.length - 1];
    return {
      bais, dong: ten.map((t) => {
        const xs = ct.filter((c) => c.tieu_chi === t);
        const tb = phanTram(xs.reduce((s, c) => s + (c.diem ?? 0), 0), xs.reduce((s, c) => s + (c.diem_toi_da ?? 0), 0));
        const moi = xs.find((c) => c.bai_lam_id === cuoi?.id);
        return { t, tb, moi, toi: xs[0]?.diem_toi_da ?? 0 };
      }),
    };
  };
  const viet = tieuChi("bai_viet"), toan = tieuChi("loi_giai");

  const coMat = chuyenCan.filter((c) => c.co_mat).length;
  const tuongTac = chuyenCan.filter((c) => c.tuong_tac);
  const ttTb = tuongTac.length ? tuongTac.reduce((s, c) => s + (c.tuong_tac ?? 0), 0) / tuongTac.length : 0;

  const tuanHien = [...new Set(chuDe.map((c) => c.tuan ?? 0))].filter((t) => t > 0).sort((a, b) => a - b);

  return (
    <main>
      {hs.la_mau && <BangXemThu noi="Đây là học sinh giả, dữ liệu sinh theo mô hình để trình diễn. Hồ sơ của các con thật chỉ ba mẹ và các cô xem được." />}
      <section className="ho-so-dau">
        <div className="khung">
          <div className="hang">
            <div>
              {hs.la_mau && <span className="co-mau">Hồ sơ mẫu</span>}
              <h1 style={{ marginBottom: 4 }}>{hs.ho_ten}</h1>
              <div className="nho">Lớp 5 · Luyện thi Trần Đại Nghĩa · Tuần {tuanNay} trên 18 · Cập nhật đến {ngayVN(ngayXet)}</div>
            </div>
            <div className="nho" style={{ textAlign: "right" }}>Đích của con: <strong style={{ color: "var(--tim)" }}>{hs.dich_diem} điểm</strong><br />Hồ sơ chỉ so con với chính con.</div>
          </div>
          <div className="chi-so">
            <div className="o"><div className="ten">Tỷ lệ đúng chung</div><div className="gt">{phanTram(tongDung, cauXep.length)}%</div><div className="them">trên {cauXep.length} câu máy chấm</div></div>
            <div className="o"><div className="ten">Bài có giám sát gần nhất</div><div className="gt">{diemBai[diemBai.length - 1]?.gt ?? "–"}</div><div className="them">{diemBai[diemBai.length - 1]?.nhan} · {diemBai[diemBai.length - 1]?.ngay}</div></div>
            <div className="o"><div className="ten">Trạm đã vững</div><div className="gt">{demTT("vung")} / {daHoc.length}</div><div className="them">chủ đề đã học đến tuần {tuanNay}</div></div>
            <div className="o"><div className="ten">Mốc 1</div><div className="gt">{moc[0] ? Math.round((100 * (moc[0].diem ?? 0)) / (moc[0].diem_toi_da ?? 1)) : "–"}</div><div className="them">thang 100 · {ngayVN(moc[0]?.ngay)}</div></div>
            <div className="o"><div className="ten">Chuyên cần</div><div className="gt">{phanTram(coMat, chuyenCan.length)}%</div><div className="them">{coMat} trên {chuyenCan.length} buổi</div></div>
          </div>
        </div>
      </section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Ba việc của tuần này</h2><span className="nguon">Rút từ những chỗ con còn vướng</span></div>
        <div className="ba-viec">{viec.map((v, i) => (<div className="the" key={i}><div className="so-tt">VIỆC {i + 1}</div><h3 style={{ fontSize: 17 }}>{v.viec}</h3><p className="nho" style={{ margin: 0 }}>{v.viSao}</p></div>))}</div>
      </div></section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Năm nhóm môn so với đích của con</h2><span className="nguon">Căn cứ: {cauXep.length} câu có giám sát và Tầng 3</span></div>
        <div className="hai-cot">
          <div>
            <ThanhDich dong={dongNhom} dich={hs.dich_diem} />
            <button className="nut-bang" onClick={() => doi("nhom")}>{bang.nhom ? "Ẩn bảng" : "Xem dạng bảng"}</button>
            {bang.nhom && <div className="bang-bao"><table><thead><tr><th>Nhóm môn</th><th className="so">Số câu</th><th className="so">Đúng</th><th className="so">Tỷ lệ</th></tr></thead><tbody>{dongNhom.map((x) => <tr key={x.ten}><td>{x.ten}</td><td className="so">{x.n}</td><td className="so">{x.dung}</td><td className="so">{x.gt}%</td></tr>)}</tbody></table></div>}
          </div>
          <div>
            <h3>Hành trình điểm các bài có giám sát</h3>
            <DuongDiem diem={diemBai} />
            <button className="nut-bang" onClick={() => doi("diem")}>{bang.diem ? "Ẩn bảng" : "Xem dạng bảng"}</button>
            {bang.diem && <div className="bang-bao"><table><thead><tr><th>Bài</th><th>Ngày</th><th className="so">Điểm (thang 100)</th></tr></thead><tbody>{diemBai.map((x, i) => <tr key={i}><td>{x.nhan}</td><td>{x.ngay}</td><td className="so">{x.gt}</td></tr>)}</tbody></table></div>}
          </div>
        </div>
      </div></section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Bản đồ hành trình: các trạm kiến thức</h2><span className="nguon">Đã học {daHoc.length} trạm: {demTT("vung")} vững · {demTT("luyen")} đang luyện · {demTT("moi")} mới học · {demTT("on")} cần ôn lại</span></div>
        <p className="gt nho">“Đã vững” nghĩa là con làm ít nhất 6 câu, ở ít nhất hai lần cách nhau một tuần, đúng từ 80%. Dưới 4 câu, hồ sơ ghi “chưa đủ dữ liệu” và chưa kết luận.</p>
        <div className="bang-chu-thich" style={{ margin: "8px 0 16px" }}>{(["vung", "luyen", "moi", "on", "chua"] as const).map((t) => <TT key={t} tt={t} />)}</div>
        <div className="ban-do">
          {tuanHien.filter((t) => t <= tuanNay + 1).map((t) => (
            <div className="tuan" key={t}>
              <div className="ten-tuan">Tuần {t}</div>
              <div className="tram-list">
                {kq.filter((k) => k.cd.tuan === t).map((k) => (
                  <div key={k.cd.ma} className={`tram ${k.tt}`} tabIndex={0}
                    onMouseMove={(e) => goiY.hien(e, <><b>{k.cd.ten_tre}</b><br />{k.cd.nhom_mon} · {k.cd.ma} · bậc cao nhất: {k.cd.bloom}<br />{k.so_cau ? `Đúng ${k.dung} trên ${k.so_cau} câu, qua ${k.so_lan} lần làm. Lần cuối: ${ngayVN(k.lan_cuoi)}` : "Chưa có câu nào"}{k.so_cau > 0 && !k.du_lieu_du ? <><br />Chưa đủ dữ liệu để kết luận.</> : null}</>)}
                    onMouseLeave={goiY.an} onFocus={(e) => goiY.hien(e, <><b>{k.cd.ten_tre}</b>: {TEN_TT[k.tt].ten}</>)} onBlur={goiY.an}>
                    <div className="ten">{k.cd.ten_tre}</div>
                    <div className="dong"><span>{k.cd.nhom_mon}</span><TT tt={k.tt} /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="nho">Còn {tuanHien.filter((t) => t > tuanNay + 1).length} tuần phía trước với {kq.filter((k) => (k.cd.tuan ?? 0) > tuanNay + 1).length} trạm chưa học.</p>
        </div>
        {goiY.lop}
      </div></section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Kỹ năng làm bài</h2><span className="nguon">Mỗi câu máy chấm gắn với một kỹ năng</span></div>
        <div className="bang-bao"><table>
          <thead><tr><th>Kỹ năng</th><th>Con làm thế nào</th><th className="so">Số câu</th><th className="so">Đúng</th><th style={{ minWidth: 140 }}>Tỷ lệ</th><th className="so">Thời gian mỗi câu</th></tr></thead>
          <tbody>{dongKN.map((x) => (
            <tr key={x.k.ma}><td><strong>{x.k.ten}</strong><div className="rat-nho">{x.k.ma}</div></td><td className="nho" style={{ maxWidth: 360 }}>{x.k.loi_cho_tre}</td><td className="so">{x.n}</td><td className="so">{x.dung}</td>
              <td>{x.n < 4 ? <span className="rat-nho">Chưa đủ dữ liệu (dưới 4 câu)</span> : <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className="thanh-nho" style={{ flex: 1 }}><span style={{ width: `${phanTram(x.dung, x.n)}%` }} /></div><strong>{phanTram(x.dung, x.n)}%</strong></div>}</td>
              <td className="so">{Math.round(x.giay)} giây</td></tr>
          ))}</tbody>
        </table></div>
        <p className="rat-nho" style={{ marginTop: 8 }}>Thời gian là trung vị. Đề thật cho 90 giây mỗi câu trắc nghiệm.</p>
      </div></section>

      <section className="phan"><div className="khung hai-cot">
        <div>
          <div className="tieu"><h2>Bậc tư duy</h2></div>
          <p className="gt nho">Tỷ lệ đúng theo sáu bậc, từ nhớ đến sáng tạo. Câu bậc cao đòi nhiều bước suy luận hơn.</p>
          <CotDon cot={cotBloom} donVi="%" moTa="Tỷ lệ đúng theo bậc tư duy" />
        </div>
        <div>
          <div className="tieu"><h2>Con sai vì sao?</h2></div>
          <p className="gt nho">{coLoi.length} câu sai, chia theo bốn loại lỗi. Mỗi loại cần một cách sửa khác nhau.</p>
          <CotDon cot={cotLoi} donVi="" moTa="Số câu sai theo loại lỗi" />
        </div>
      </div></section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Tầng 3 của từng phiếu</h2><span className="nguon">Con làm trên web, có bấm giờ · {tang3.length} lần</span></div>
        <div className="bang-bao"><table>
          <thead><tr><th>Ngày</th><th>Phiếu</th><th>Trạm</th><th className="so">Đúng</th><th className="so">Thời gian mỗi câu</th><th>Kỹ năng còn vướng</th></tr></thead>
          <tbody>{tang3.slice(0, 16).map((b) => {
            const cs = cau.filter((c) => c.bai_lam_id === b.id);
            const tram = [...new Set(cs.map((c) => chuDe.find((x) => x.ma === c.ma_chu_de)?.ten_tre).filter(Boolean))];
            const knSai = [...new Set(cs.filter((c) => !c.dung).map((c) => kyNang.find((k) => k.ma === c.ma_ky_nang)?.ten).filter(Boolean))];
            const g = trungVi(cs.map((c) => c.giay ?? 0));
            return (<tr key={b.id}><td>{ngayVN(b.ngay)}</td><td>{(b.ten_bai ?? "").replace("Tầng 3: ", "")}</td><td className="nho">{tram.join(", ")}</td><td className="so">{cs.filter((c) => c.dung).length}/{cs.length}</td><td className="so" style={{ color: g > 90 ? "var(--tt-on)" : undefined }}>{Math.round(g)} giây</td><td className="nho">{knSai.join(", ") || "Không có"}</td></tr>);
          })}</tbody>
        </table></div>
        {tang3.length > 16 && <p className="rat-nho" style={{ marginTop: 8 }}>Đang hiện 16 lần gần nhất trên {tang3.length} lần.</p>}
      </div></section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Bài viết và lời giải Toán</h2><span className="nguon">Cô Nguyên chấm theo khung barem của trạm</span></div>
        <div className="hai-cot">
          {[{ ten: "Bài viết đoạn (thang 12)", x: viet }, { ten: "Lời giải Toán (thang 8)", x: toan }].map(({ ten, x }) => (
            <div key={ten}>
              <h3>{ten}</h3>
              <div className="bang-bao"><table>
                <thead><tr><th>Tiêu chí</th><th style={{ minWidth: 110 }}>Trung bình {x.bais.length} bài</th><th>Bài gần nhất</th></tr></thead>
                <tbody>{x.dong.map((r) => (
                  <tr key={r.t}><td><strong>{r.t}</strong><div className="rat-nho">{r.toi} điểm</div></td>
                    <td><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className="thanh-nho" style={{ flex: 1 }}><span style={{ width: `${r.tb}%` }} /></div>{r.tb}%</div></td>
                    <td className="nho">{r.moi?.muc}{r.moi?.diem_hong ? <><br /><span style={{ color: "var(--dat)" }}>Điểm hỏng: {r.moi.diem_hong}</span></> : null}</td></tr>
                ))}</tbody>
              </table></div>
            </div>
          ))}
        </div>
      </div></section>

      <section className="phan"><div className="khung hai-cot">
        <div>
          <div className="tieu"><h2>Trong lớp</h2><span className="nguon">Cô Ngọc ghi nhận</span></div>
          <p>Con có mặt <strong>{coMat} trên {chuyenCan.length}</strong> buổi. Mức tương tác trung bình <strong>{ttTb.toFixed(1)} trên 3</strong>.</p>
          {chuyenCan.filter((c) => c.ghi_chu).slice(-3).map((c) => <p key={c.id} className="nho">{ngayVN(c.ngay)}: {c.ghi_chu}</p>)}
        </div>
        <div>
          <div className="tieu"><h2>Cô Yori đồng hành</h2><span className="nguon">Ghi chú coach</span></div>
          {coach.length === 0 && <p className="nho">Chưa có ghi chú. Cô Yori ghi lại khi con cần thêm sự đồng hành.</p>}
          {coach.map((c) => (<div className="the" key={c.id} style={{ marginBottom: 10 }}><div className="rat-nho">{ngayVN(c.ngay)}{c.chia_se_phu_huynh ? " · đã chia sẻ với ba mẹ" : " · ghi chú nội bộ"}</div><p style={{ margin: "4px 0" }}><strong>{c.van_de}</strong></p><p className="nho" style={{ margin: 0 }}>{c.ke_hoach}</p></div>))}
        </div>
      </div></section>

      <section className="phan"><div className="khung">
        <div className="tieu"><h2>Báo cáo tuần</h2><span className="nguon">Cô Trang duyệt trước khi gửi ba mẹ</span></div>
        <div className="luoi c4">
          {baoCao.map((b) => (
            <Link key={b.id} to={`/ho-so/${hs.id}/bao-cao/${b.tuan}`} className="the" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="rat-nho">{ngayVN(b.tu_ngay)} đến {ngayVN(b.den_ngay)}</div>
              <h3 style={{ margin: "4px 0" }}>Tuần {b.tuan}</h3>
              <span className={`tt ${b.trang_thai === "nhap" ? "luyen" : "vung"}`}>{b.trang_thai === "nhap" ? "Chờ cô duyệt" : "Đã gửi ba mẹ"}</span>
            </Link>
          ))}
        </div>
      </div></section>
    </main>
  );
}
