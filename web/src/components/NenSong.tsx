import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/* “Khu vườn tri thức”: nền động của Trạm Tư Duy.
   Bốn lớp, rất chậm và rất mờ, để không bao giờ giành chú ý khỏi chữ:
     1. quả cầu ánh sáng (bạc hà, oải hương, cát ấm) trôi chậm;
     2. hạt giống: đom đóm vàng, hạt tím, chiếc lá xanh bay lên chầm chậm, nhiều dần khi cuộn xuống;
     3. rê chuột gần, các hạt khẽ né ra;
     4. chạm vào chỗ trống, một nắm lá và sao bay lên.
   Giảm chuyển động: vẽ một khung tĩnh, không chạy vòng lặp.
   Cảm hứng từ cách xếp lớp nền của kientran.ca/bitcoin, chuyển sang bảng màu sáng của trạm. */

type Hat = { x: number; y: number; r: number; vy: number; lac: number; pha: number; loai: 0 | 1 | 2; xoay: number; vx?: number; tuoi?: number; song?: number };

const MAU_CAU = ["#c6ead8", "#ddd2f4", "#f5dfbd", "#d2efe2", "#e7defa"];
const CAU = [
  { m: 0, x: 0.12, y: 0.22, r: 0.36, ax: 0.06, ay: 0.05, sx: 0.031, sy: 0.023, p: 0.0 },
  { m: 1, x: 0.86, y: 0.18, r: 0.32, ax: 0.05, ay: 0.06, sx: 0.022, sy: 0.029, p: 1.7 },
  { m: 2, x: 0.78, y: 0.82, r: 0.34, ax: 0.06, ay: 0.04, sx: 0.027, sy: 0.019, p: 3.1 },
  { m: 3, x: 0.2, y: 0.86, r: 0.3, ax: 0.05, ay: 0.05, sx: 0.019, sy: 0.026, p: 4.4 },
  { m: 4, x: 0.5, y: 0.5, r: 0.26, ax: 0.08, ay: 0.07, sx: 0.016, sy: 0.021, p: 2.2 },
];

function anhCau(mau: string, kt: number) {
  const c = document.createElement("canvas");
  c.width = c.height = kt;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(kt / 2, kt / 2, 0, kt / 2, kt / 2, kt / 2);
  gr.addColorStop(0, mau); gr.addColorStop(0.55, mau + "aa"); gr.addColorStop(1, mau + "00");
  g.fillStyle = gr; g.fillRect(0, 0, kt, kt);
  return c;
}
function anhSang(mau: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, mau); gr.addColorStop(0.35, mau + "cc"); gr.addColorStop(1, mau + "00");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return c;
}

export default function NenSong() {
  const ref = useRef<HTMLCanvasElement>(null);
  const refTruoc = useRef<HTMLCanvasElement>(null);
  const loc = useLocation();
  const cuongDo = useRef(1);
  useEffect(() => { cuongDo.current = loc.pathname === "/" ? 1 : 0.45; }, [loc.pathname]);

  useEffect(() => {
    const cv = ref.current, cvT = refTruoc.current; if (!cv || !cvT) return;
    const ctx = cv.getContext("2d"), ctxT = cvT.getContext("2d"); if (!ctx || !ctxT) return;
    const giam = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1, dt = false, khung = 0, chet = false;
    const nhoMan = () => innerWidth < 760;
    const cau = MAU_CAU.map((m) => anhCau(m, 256));
    const sang = [anhSang("#E3A92B"), anhSang("#8B77C2")];
    const hat: Hat[] = []; const no: Hat[] = [];
    const chuot = { x: -9999, y: -9999 };

    const taoHat = (dau: boolean): Hat => ({
      x: Math.random() * W, y: dau ? Math.random() * H : H + 20,
      r: 2.2 + Math.random() * 2.8, vy: 7 + Math.random() * 13, lac: 8 + Math.random() * 20,
      pha: Math.random() * Math.PI * 2, loai: (Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 2 : 1) as 0 | 1 | 2,
      xoay: Math.random() * Math.PI,
    });
    const coGian = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cvT.width = cv.width; cvT.height = cv.height; ctxT.setTransform(dpr, 0, 0, dpr, 0, 0);
      const can = nhoMan() ? 22 : 44;
      while (hat.length < can) hat.push(taoHat(true));
      hat.length = can;
    };

    const veLa = (c: CanvasRenderingContext2D, x: number, y: number, r: number, goc: number, a: number) => {
      c.save(); c.translate(x, y); c.rotate(goc); c.globalAlpha = a;
      c.fillStyle = "#6CBF84"; c.beginPath();
      c.ellipse(0, 0, r * 2.2, r * 1.05, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#4f9e6a"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-r * 2, 0); c.lineTo(r * 2, 0); c.stroke();
      c.restore();
    };
    const veSao = (c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) => {
      c.save(); c.globalAlpha = a; c.fillStyle = "#E3A92B"; c.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const g = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(g) * rr, y + Math.sin(g) * rr); }
      c.closePath(); c.fill(); c.restore();
    };

    let truoc = performance.now();
    const ve = (t: number) => {
      const s = Math.min(0.05, (t - truoc) / 1000); truoc = t;
      const k = cuongDo.current;
      ctx.clearRect(0, 0, W, H);
      // 1. Quả cầu ánh sáng
      const lon = Math.max(W, H);
      for (const c of CAU) {
        const x = (c.x + Math.sin(t / 1000 * c.sx * 6.283 + c.p) * c.ax) * W;
        const y = (c.y + Math.cos(t / 1000 * c.sy * 6.283 + c.p) * c.ay) * H;
        const r = c.r * lon;
        ctx.globalAlpha = 0.5 * k;
        ctx.drawImage(cau[c.m], x - r, y - r, r * 2, r * 2);
      }
      if (giam) { ctx.globalAlpha = 1; return; }
      // 2. Hạt giống bay lên, nhiều dần theo quãng đã cuộn
      const cuon = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - H));
      const hien = Math.round(hat.length * (0.55 + 0.45 * cuon) * (k < 1 ? 0.6 : 1));
      for (let i = 0; i < hat.length; i++) {
        const h = hat[i];
        h.y -= h.vy * s; h.pha += s * 0.9; h.xoay += s * 0.4;
        let x = h.x + Math.sin(h.pha) * h.lac;
        const dx = x - chuot.x, dy = h.y - chuot.y, d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1; h.x += (dx / d) * 40 * s; h.y += (dy / d) * 40 * s; x = h.x + Math.sin(h.pha) * h.lac; }
        if (h.y < -30) Object.assign(h, taoHat(false));
        if (i >= hien) continue;
        const nhapNhay = 0.55 + 0.45 * Math.sin(h.pha * 2.3);
        const a = Math.min(1, (H - h.y) / 120) * nhapNhay * (k < 1 ? 0.55 : 0.85);
        if (h.loai === 2) veLa(ctx, x, h.y, h.r, h.xoay, a * 0.85);
        else { ctx.globalAlpha = a; const d = h.r * 6; ctx.drawImage(sang[h.loai], x - d / 2, h.y - d / 2, d, d); }
      }
      // 4. Nắm lá và sao vừa gieo: vẽ trên lớp phía trước nội dung
      ctxT.clearRect(0, 0, W, H);
      for (let i = no.length - 1; i >= 0; i--) {
        const p = no[i]; p.tuoi! += s;
        const song = p.song!; if (p.tuoi! > song) { no.splice(i, 1); continue; }
        p.x += p.vx! * s; p.y -= p.vy * s; p.vy -= 18 * s; p.xoay += s * 2;
        const a = 1 - p.tuoi! / song;
        if (p.loai === 2) veLa(ctxT, p.x, p.y, p.r, p.xoay, a); else veSao(ctxT, p.x, p.y, p.r * 1.6, a);
      }
      ctx.globalAlpha = 1;
      if (!chet && !dt) khung = requestAnimationFrame(ve);
    };

    const diChuot = (e: PointerEvent) => { if (e.pointerType === "mouse") { chuot.x = e.clientX; chuot.y = e.clientY; } };
    const roiChuot = () => { chuot.x = chuot.y = -9999; };
    const gieo = (e: PointerEvent) => {
      if (giam) return;
      const el = e.target as Element | null;
      if (el?.closest("a, button, input, textarea, select, label, [role=tab], table, figure, img")) return;
      for (let i = 0; i < 12; i++) {
        const g = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const v = 60 + Math.random() * 90;
        no.push({ x: e.clientX, y: e.clientY, r: 3 + Math.random() * 2.4, vy: -Math.sin(g) * v, vx: Math.cos(g) * v, lac: 0, pha: 0, loai: Math.random() < 0.5 ? 2 : 0, xoay: Math.random() * 6, tuoi: 0, song: 1.2 + Math.random() * 0.8 });
      }
    };
    const anHien = () => {
      dt = document.hidden;
      if (!dt && !giam && !chet) { truoc = performance.now(); cancelAnimationFrame(khung); khung = requestAnimationFrame(ve); }
    };

    coGian();
    addEventListener("resize", coGian);
    addEventListener("pointermove", diChuot, { passive: true });
    addEventListener("pointerleave", roiChuot);
    addEventListener("pointerdown", gieo, { passive: true });
    document.addEventListener("visibilitychange", anHien);
    if (giam) ve(0); else khung = requestAnimationFrame(ve);
    return () => {
      chet = true; cancelAnimationFrame(khung);
      removeEventListener("resize", coGian);
      removeEventListener("pointermove", diChuot);
      removeEventListener("pointerleave", roiChuot);
      removeEventListener("pointerdown", gieo);
      document.removeEventListener("visibilitychange", anHien);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="nen-song" aria-hidden="true" />
      <canvas ref={refTruoc} className="nen-song nen-song--truoc" aria-hidden="true" />
    </>
  );
}
