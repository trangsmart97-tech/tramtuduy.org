import { useState, type ReactNode } from "react";

// Lớp gợi ý khi rê chuột: mọi biểu đồ dùng chung.
type GoiY = { x: number; y: number; noi: ReactNode } | null;
export function useGoiY() {
  const [g, setG] = useState<GoiY>(null);
  const hien = (e: React.MouseEvent | React.FocusEvent, noi: ReactNode) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const x = "clientX" in e ? e.clientX : r.left + r.width / 2;
    const y = "clientY" in e ? e.clientY : r.top;
    setG({ x, y, noi });
  };
  const an = () => setG(null);
  const lop = g ? (
    <div className="goi-y" style={{ left: Math.min(g.x + 14, window.innerWidth - 300), top: g.y + 14 }} role="tooltip">{g.noi}</div>
  ) : null;
  return { hien, an, lop };
}

// Thanh ngang so với đích (một chuỗi số liệu: không cần chú giải; vạch đích có nhãn).
export function ThanhDich({ dong, dich }: { dong: { ten: string; gt: number; n: number; dung: number }[]; dich: number }) {
  const { hien, an, lop } = useGoiY();
  const W = 640, nhan = 150, cao = 30, gap = 14, H = dong.length * (cao + gap) + 28;
  const x = (v: number) => nhan + ((W - nhan - 50) * v) / 100;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="bieu-do" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tỷ lệ đúng theo nhóm môn so với đích ${dich}%`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={H - 22} stroke="#efedf3" />
            <text x={x(t)} y={H - 6} fontSize="12" fill="#6a6478" textAnchor="middle">{t}%</text>
          </g>
        ))}
        {dong.map((d, i) => {
          const y = i * (cao + gap) + 4;
          const dat = d.gt >= dich;
          return (
            <g key={d.ten} tabIndex={0} onMouseMove={(e) => hien(e, <><b>{d.ten}</b><br />Đúng {d.dung} trên {d.n} câu: {d.gt}%<br />{dat ? "Đã chạm đích" : `Còn ${dich - d.gt} điểm phần trăm tới đích`}</>)} onMouseLeave={an} onFocus={(e) => hien(e, <><b>{d.ten}</b>: {d.gt}%</>)} onBlur={an}>
              <rect x={0} y={y - 4} width={W} height={cao + 8} fill="transparent" />
              <text x={0} y={y + cao / 2 + 5} fontSize="14" fill="#1f1b2b" fontWeight={600}>{d.ten}</text>
              <rect x={nhan} y={y} width={x(100) - nhan} height={cao} rx={4} fill="#f2f0f6" />
              <rect x={nhan} y={y} width={Math.max(4, x(d.gt) - nhan)} height={cao} rx={4} fill="#2B1C47" />
              <text x={x(d.gt) + 8} y={y + cao / 2 + 5} fontSize="14" fill="#1f1b2b" fontWeight={700}>{d.gt}%</text>
            </g>
          );
        })}
        <line x1={x(dich)} x2={x(dich)} y1={0} y2={H - 22} stroke="#7a4e32" strokeWidth={2} strokeDasharray="5 4" />
        <text x={x(dich) + 4} y={H - 24} fontSize="12" fill="#7a4e32" fontWeight={600}>Đích {dich}%</text>
      </svg>
      {lop}
    </figure>
  );
}

// Đường điểm theo thời gian (một chuỗi), điểm đánh dấu khác hình cho bài có giám sát lớn.
export function DuongDiem({ diem }: { diem: { nhan: string; ngay: string; gt: number; loai: string; chiTiet: string }[] }) {
  const { hien, an, lop } = useGoiY();
  const W = 680, H = 260, trai = 40, phai = 16, tren = 16, duoi = 46;
  if (!diem.length) return <p className="nho">Chưa có bài có giám sát.</p>;
  const x = (i: number) => trai + (diem.length === 1 ? 0.5 : i / (diem.length - 1)) * (W - trai - phai);
  const y = (v: number) => tren + (1 - v / 100) * (H - tren - duoi);
  const duong = diem.map((d, i) => `${i ? "L" : "M"}${x(i)} ${y(d.gt)}`).join(" ");
  return (
    <figure style={{ margin: 0 }}>
      <svg className="bieu-do" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Điểm các bài có giám sát theo thời gian">
        {[0, 50, 80, 100].map((t) => (
          <g key={t}>
            <line x1={trai} x2={W - phai} y1={y(t)} y2={y(t)} stroke={t === 80 ? "#d9c6b6" : "#efedf3"} strokeDasharray={t === 80 ? "4 4" : undefined} />
            <text x={trai - 8} y={y(t) + 4} fontSize="12" fill="#6a6478" textAnchor="end">{t}</text>
          </g>
        ))}
        <path d={duong} fill="none" stroke="#2B1C47" strokeWidth={2} />
        {diem.map((d, i) => (
          <g key={i} tabIndex={0} onMouseMove={(e) => hien(e, <><b>{d.nhan}</b> · {d.ngay}<br />{d.gt} điểm trên thang 100<br />{d.chiTiet}</>)} onMouseLeave={an} onFocus={(e) => hien(e, <><b>{d.nhan}</b>: {d.gt}</>)} onBlur={an}>
            <rect x={x(i) - 16} y={tren} width={32} height={H - tren - duoi} fill="transparent" />
            {d.loai === "thuc_chien" ? (
              <circle cx={x(i)} cy={y(d.gt)} r={5} fill="#2B1C47" stroke="#fff" strokeWidth={2} />
            ) : (
              <rect x={x(i) - 7} y={y(d.gt) - 7} width={14} height={14} rx={2} fill="#7a4e32" stroke="#fff" strokeWidth={2} transform={`rotate(45 ${x(i)} ${y(d.gt)})`} />
            )}
            <text x={x(i)} y={H - duoi + 18} fontSize="11.5" fill="#4a4458" textAnchor="middle">{d.nhan.replace("Thực chiến ", "TC ")}</text>
          </g>
        ))}
      </svg>
      <div className="chu-giai"><span><i style={{ background: "#2B1C47", borderRadius: 6 }} />Thực chiến Chủ nhật</span><span><i style={{ background: "#7a4e32" }} />Bài đầu vào và bài Mốc</span><span><i style={{ background: "transparent", borderTop: "2px dashed #d9c6b6", borderRadius: 0, height: 0 }} />Mốc 80 điểm</span></div>
      {lop}
    </figure>
  );
}

// Cột đơn (một chuỗi) cho Bloom và loại lỗi; mỗi cột có nhãn tên và giá trị.
export function CotDon({ cot, donVi, moTa }: { cot: { ten: string; gt: number; phu: string }[]; donVi: string; moTa: string }) {
  const { hien, an, lop } = useGoiY();
  const W = 560, H = 230, duoi = 48, tren = 22;
  const max = Math.max(...cot.map((c) => c.gt), donVi === "%" ? 100 : 1);
  const w = (W - 20) / cot.length;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="bieu-do" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={moTa}>
        <line x1={0} x2={W} y1={H - duoi} y2={H - duoi} stroke="#cbc4da" />
        {cot.map((c, i) => {
          const h = ((H - duoi - tren) * c.gt) / max;
          const cx = 10 + i * w + w / 2; const bw = Math.min(56, w * 0.56);
          return (
            <g key={c.ten} tabIndex={0} onMouseMove={(e) => hien(e, <><b>{c.ten}</b><br />{c.phu}</>)} onMouseLeave={an} onFocus={(e) => hien(e, <><b>{c.ten}</b>: {c.gt}{donVi}</>)} onBlur={an}>
              <rect x={cx - w / 2} y={tren} width={w} height={H - tren - duoi} fill="transparent" />
              <path d={`M${cx - bw / 2} ${H - duoi} V${H - duoi - h + 4} Q${cx - bw / 2} ${H - duoi - h} ${cx - bw / 2 + 4} ${H - duoi - h} H${cx + bw / 2 - 4} Q${cx + bw / 2} ${H - duoi - h} ${cx + bw / 2} ${H - duoi - h + 4} V${H - duoi} Z`} fill={c.gt ? "#2B1C47" : "#efedf3"} />
              <text x={cx} y={H - duoi - h - 6} fontSize="13" fontWeight={700} fill="#1f1b2b" textAnchor="middle">{c.gt}{donVi}</text>
              <text x={cx} y={H - duoi + 18} fontSize="12.5" fill="#4a4458" textAnchor="middle">{c.ten}</text>
            </g>
          );
        })}
      </svg>
      {lop}
    </figure>
  );
}
