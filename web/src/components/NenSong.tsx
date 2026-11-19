import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/* Nền động của Trạm Tư Duy.

   Trang chủ: “Vũ trụ xoay vần”. Biên giới của tầm nhìn hệ thống là vũ trụ, nên mỗi lần cuộn,
   tầm nhìn lùi ra xa thêm một tầng, và tầng nào cũng xoay quanh một tâm:
     khu vườn (chạm đầu tiên) → bình minh → đêm: Trái Đất tự quay, Mặt Trăng quay quanh
     → Ba nhóm lớp: hệ Mặt Trời, hành tinh càng gần càng quay nhanh (Kepler)
     → Hồ sơ: vũ điệu Trái Đất và Sao Kim; cuộn tới đâu, bông hoa năm cánh hiện tới đó (8 năm, 13 vòng Sao Kim)
     → Lộ trình: thiên hà xoắn ốc → Bốn cô: mạng vũ trụ, các thiên hà nằm dọc những sợi cong
     → Kết: bình minh vàng ôm lấy khu vườn (đặc ân của vũ trụ và mẹ thiên nhiên).
   Tầng cũ thu nhỏ dần vào xa khi tầng lớn hơn hiện ra: cảm giác lùi ra để thấy toàn cảnh.
   Cuộn trang là xoay thời gian: các thiên thể quay theo tay, buông tay thì chậm dần như có quán tính.
   Bầu trời sao quay quanh một thiên cực phía trên màn hình. Không đường thẳng, không chớp, không loé.
   Mỗi lần vuốt: quỹ đạo và các sợi sáng dịu lên rồi lắng xuống; ở khu vườn, một quầng màu rất nhẹ loang ra.

   Các trang khác: khu vườn nhẹ (quả cầu ánh sáng, hạt giống, lá) như trước.
   Giảm chuyển động: không vòng lặp, không quầng màu; vẽ một khung tĩnh theo vị trí cuộn. */

type RGB = [number, number, number];
type Canh = {
  tren: RGB; giua: RGB; duoi: RGB; vuon: number; sao: number; tinhVan: number; nganHa: number; vang: number;
  traiDat: number; heMatTroi: number; hoaKim: number; thienHa: number; mangVuTru: number;
};
const KHONG = { vuon: 0, sao: 0, tinhVan: 0, nganHa: 0, vang: 0, traiDat: 0, heMatTroi: 0, hoaKim: 0, thienHa: 0, mangVuTru: 0 };
const VUON: Canh = { ...KHONG, tren: [246, 251, 248], giua: [239, 248, 243], duoi: [233, 246, 239], vuon: 1 };
const BINH_MINH: Canh = { ...KHONG, tren: [236, 230, 250], giua: [246, 233, 242], duoi: [252, 234, 216], vuon: 0.45, sao: 0.04, tinhVan: 0.05, vang: 0.3 };
const HOANG_HON: Canh = { ...KHONG, tren: [30, 23, 76], giua: [70, 46, 116], duoi: [168, 92, 126], sao: 0.6, tinhVan: 0.3, vang: 0.1, traiDat: 0.55 };
const DEM: Canh = { ...KHONG, tren: [14, 11, 42], giua: [25, 19, 68], duoi: [44, 30, 92], sao: 0.85, tinhVan: 0.45, traiDat: 1 };
const HE_MAT_TROI: Canh = { ...KHONG, tren: [10, 8, 32], giua: [21, 16, 60], duoi: [32, 23, 78], sao: 1, tinhVan: 0.7, nganHa: 0.2, heMatTroi: 1 };
const HOA_KIM: Canh = { ...KHONG, tren: [9, 9, 30], giua: [19, 17, 58], duoi: [30, 24, 76], sao: 1, tinhVan: 0.6, nganHa: 0.45, heMatTroi: 0.2, hoaKim: 1 };
const THIEN_HA: Canh = { ...KHONG, tren: [8, 10, 34], giua: [18, 18, 58], duoi: [27, 25, 72], sao: 1, tinhVan: 0.55, nganHa: 0.35, thienHa: 1 };
const MANG: Canh = { ...KHONG, tren: [12, 10, 38], giua: [24, 20, 66], duoi: [40, 30, 90], sao: 0.9, tinhVan: 0.7, thienHa: 0.12, mangVuTru: 1 };
const BINH_MINH_VANG: Canh = { ...KHONG, tren: [255, 245, 224], giua: [253, 239, 216], duoi: [234, 247, 241], vuon: 0.85, vang: 1 };

const MAU_VU_TRU: RGB[] = [[139, 119, 194], [242, 159, 197], [111, 211, 199], [246, 196, 83], [124, 156, 255]];
const MAU_CAU = ["#c6ead8", "#ddd2f4", "#f5dfbd", "#d2efe2", "#e7defa"];
const CAU = [
  { m: 0, x: 0.12, y: 0.22, r: 0.36, ax: 0.06, ay: 0.05, sx: 0.031, sy: 0.023, p: 0.0 },
  { m: 1, x: 0.86, y: 0.18, r: 0.32, ax: 0.05, ay: 0.06, sx: 0.022, sy: 0.029, p: 1.7 },
  { m: 2, x: 0.78, y: 0.82, r: 0.34, ax: 0.06, ay: 0.04, sx: 0.027, sy: 0.019, p: 3.1 },
  { m: 3, x: 0.2, y: 0.86, r: 0.3, ax: 0.05, ay: 0.05, sx: 0.019, sy: 0.026, p: 4.4 },
  { m: 4, x: 0.5, y: 0.5, r: 0.26, ax: 0.08, ay: 0.07, sx: 0.016, sy: 0.021, p: 2.2 },
];
const TINH_VAN_DS = [
  { m: 0, x: 0.22, y: 0.3, r: 0.6, p: 0.3 }, { m: 1, x: 0.8, y: 0.22, r: 0.5, p: 1.9 }, { m: 2, x: 0.62, y: 0.78, r: 0.62, p: 3.3 },
  { m: 4, x: 0.12, y: 0.82, r: 0.5, p: 4.1 }, { m: 0, x: 0.9, y: 0.62, r: 0.45, p: 5.2 },
];
// Hệ Mặt Trời: bán kính quỹ đạo tương đối, kiểu hành tinh, cỡ; chu kỳ theo định luật Kepler T ∝ a^1.5
const QUY_DAO = [
  { a: 0.2, kieu: 2, r: 4 }, { a: 0.31, kieu: 3, r: 6 }, { a: 0.43, kieu: 1, r: 7, trang: true },
  { a: 0.58, kieu: 0, r: 5 }, { a: 0.76, kieu: 2, r: 11, vanh: true }, { a: 0.95, kieu: 4, r: 8 },
];
// Mạng vũ trụ: các nút (cụm thiên hà) và sợi cong nối giữa chúng
const NUT = [[0.5, 0.48], [0.18, 0.26], [0.42, 0.14], [0.78, 0.2], [0.9, 0.55], [0.7, 0.8], [0.32, 0.78], [0.08, 0.6], [0.6, 0.36]];
const SOI: [number, number][] = [[0, 8], [8, 2], [2, 1], [1, 7], [7, 6], [6, 0], [0, 5], [5, 4], [4, 3], [3, 8], [2, 3], [6, 5], [1, 0], [0, 4]];

const hex = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const tron = (a: number, b: number, t: number) => a + (b - a) * t;
const tronMau = (a: RGB, b: RGB, t: number): RGB => [tron(a[0], b[0], t), tron(a[1], b[1], t), tron(a[2], b[2], t)];
function tronCanh(a: Canh, b: Canh, t: number): Canh {
  const o = {} as Canh;
  for (const k of Object.keys(a) as (keyof Canh)[]) (o as Record<string, unknown>)[k] = Array.isArray(a[k]) ? tronMau(a[k] as RGB, b[k] as RGB, t) : tron(a[k] as number, b[k] as number, t);
  return o;
}
const muot = (t: number) => t * t * (3 - 2 * t);
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;

function sprite(mau: RGB, kt = 64) {
  const c = document.createElement("canvas"); c.width = c.height = kt;
  const g = c.getContext("2d")!; const h = kt / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, hex(mau, 1)); gr.addColorStop(0.3, hex(mau, 0.75)); gr.addColorStop(1, hex(mau, 0));
  g.fillStyle = gr; g.fillRect(0, 0, kt, kt); return c;
}
function anhCau(mau: string, kt: number) {
  const c = document.createElement("canvas"); c.width = c.height = kt;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(kt / 2, kt / 2, 0, kt / 2, kt / 2, kt / 2);
  gr.addColorStop(0, mau); gr.addColorStop(0.55, mau + "aa"); gr.addColorStop(1, mau + "00");
  g.fillStyle = gr; g.fillRect(0, 0, kt, kt); return c;
}

// Dải Ngân Hà: một dải sáng có bụi tối và hàng nghìn ngôi sao li ti, vẽ sẵn một lần.
function veNganHa() {
  const c = document.createElement("canvas"); c.width = 1600; c.height = 440;
  const g = c.getContext("2d")!; const cy = 220;
  const mau = ["232,200,255", "200,214,255", "255,226,196", "214,240,236"];
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 1600, y = cy + gauss() * 70, r = 60 + Math.random() * 130;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${mau[i % 4]},0.16)`); gr.addColorStop(1, `rgba(${mau[i % 4]},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * 1600, y = cy + gauss() * 22, r = 30 + Math.random() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(0,0,0,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 3400; i++) {
    const x = Math.random() * 1600, y = cy + gauss() * 62, a = 0.25 + Math.random() * 0.75;
    g.fillStyle = `rgba(255,255,255,${(a * 0.75).toFixed(2)})`;
    const s = Math.random() < 0.94 ? 1 : 2; g.fillRect(x, y, s, s);
  }
  g.globalCompositeOperation = "destination-in";
  const mo = g.createLinearGradient(0, 0, 1600, 0);
  mo.addColorStop(0, "rgba(0,0,0,0)"); mo.addColorStop(0.18, "rgba(0,0,0,1)"); mo.addColorStop(0.82, "rgba(0,0,0,1)"); mo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = mo; g.fillRect(0, 0, 1600, 440);
  return c;
}

// Thiên hà xoắn ốc hai nhánh: lõi vàng ấm, nhánh tím lam.
function veThienHa() {
  const kt = 760, c = document.createElement("canvas"); c.width = c.height = kt;
  const g = c.getContext("2d")!; const h = kt / 2;
  const loi = g.createRadialGradient(h, h, 0, h, h, h * 0.42);
  loi.addColorStop(0, "rgba(255,244,214,0.95)"); loi.addColorStop(0.25, "rgba(255,214,150,0.5)"); loi.addColorStop(1, "rgba(180,150,255,0)");
  g.fillStyle = loi; g.fillRect(0, 0, kt, kt);
  for (let nhanh = 0; nhanh < 2; nhanh++) {
    for (let i = 0; i < 3400; i++) {
      const t = Math.pow(Math.random(), 0.8) * 3.1 * Math.PI;
      const r = 16 + t * 32 + gauss() * (7 + t * 3.8);
      const goc = t + nhanh * Math.PI + gauss() * 0.22;
      const x = h + Math.cos(goc) * r, y = h + Math.sin(goc) * r;
      const k = Math.min(1, r / (h * 0.95));
      const m = tronMau([255, 232, 190], [150, 160, 255], k);
      g.fillStyle = hex(m, (1 - k) * 0.7 + 0.12);
      const s = Math.random() < 0.9 ? 1.3 : 2.4; g.fillRect(x, y, s, s);
    }
  }
  return c;
}

// Một hành tinh: khối cầu có sáng tối, quầng khí quyển, dải mây nhẹ; có thể có vành đai.
const KIEU_HT: [RGB, RGB][] = [[[176, 160, 232], [52, 40, 98]], [[168, 235, 221], [34, 108, 104]], [[246, 214, 154], [150, 96, 58]],
  [[247, 195, 217], [140, 70, 110]], [[183, 200, 255], [56, 74, 150]]];
function veHanhTinh(r: number, kieu: number, vanh: boolean) {
  const le = vanh ? r * 1.1 : r * 0.6, kt = Math.ceil((r + le) * 2), h = kt / 2;
  const c = document.createElement("canvas"); c.width = c.height = kt;
  const g = c.getContext("2d")!; const [sang, toi] = KIEU_HT[kieu];
  const q = g.createRadialGradient(h, h, r * 0.9, h, h, r + le * 0.85);
  q.addColorStop(0, hex(sang, 0.3)); q.addColorStop(1, hex(sang, 0)); g.fillStyle = q; g.fillRect(0, 0, kt, kt);
  const veVanh = (tu: number, den: number, a: number) => {
    g.save(); g.translate(h, h); g.rotate(-0.35); g.scale(1, 0.3);
    g.strokeStyle = hex(sang, a); g.lineWidth = r * 0.22; g.beginPath(); g.arc(0, 0, r * 1.7, tu, den); g.stroke(); g.restore();
  };
  if (vanh) veVanh(Math.PI, Math.PI * 2, 0.45);
  const cau = g.createRadialGradient(h - r * 0.4, h - r * 0.45, r * 0.08, h, h, r * 1.05);
  cau.addColorStop(0, hex(tronMau(sang, [255, 255, 255], 0.4))); cau.addColorStop(0.45, hex(sang)); cau.addColorStop(1, hex(toi));
  g.fillStyle = cau; g.beginPath(); g.arc(h, h, r, 0, 6.283); g.fill();
  if (vanh) veVanh(0, Math.PI, 0.7);
  return c;
}

type Sao = { a: number; r: number; z: number; pha: number; nhanh: number };
type Hat = { x: number; y: number; r: number; vy: number; lac: number; pha: number; loai: 0 | 1 | 2; xoay: number; vx?: number; tuoi?: number; song?: number };
type Vong = { x: number; y: number; t: number; song: number; m: number; lon: number };

export default function NenSong() {
  const ref = useRef<HTMLCanvasElement>(null);
  const refTruoc = useRef<HTMLCanvasElement>(null);
  const loc = useLocation();
  const laTrangChu = useRef(loc.pathname === "/");
  useEffect(() => { laTrangChu.current = loc.pathname === "/"; }, [loc.pathname]);

  useEffect(() => {
    const cv = ref.current, cvT = refTruoc.current; if (!cv || !cvT) return;
    const ctx = cv.getContext("2d"), ctxT = cvT.getContext("2d"); if (!ctx || !ctxT) return;
    const giam = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1, an = false, khung = 0, soKhung = 0, chet = false;
    const nhoMan = () => innerWidth < 760;
    const cau = MAU_CAU.map((m) => anhCau(m, 256));
    const sangHat = [sprite([227, 169, 43], 32), sprite([139, 119, 194], 32)];
    const sangVt = MAU_VU_TRU.map((m) => sprite(m));
    const sangTrang = sprite([255, 252, 240]);
    const sangVang = sprite([255, 226, 150]);
    let nganHa: HTMLCanvasElement | null = null, thienHa: HTMLCanvasElement | null = null;
    let anhHt: HTMLCanvasElement[] = [];
    const hat: Hat[] = [], no: Hat[] = [], vong: Vong[] = [], sao: Sao[] = [];
    const chuot = { x: -9999, y: -9999 };
    let nhip = 0;

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
      // bầu sao quay quanh thiên cực phía trên màn hình: rải đều trên một đĩa phủ kín màn hình
      sao.length = 0;
      const RMAX = Math.hypot(W / 2, H * 1.35), n = nhoMan() ? 420 : 760;
      for (let i = 0; i < n; i++) sao.push({ a: Math.random() * 6.283, r: Math.sqrt(Math.random()) * RMAX, z: 0.25 + Math.random() * 0.75, pha: Math.random() * 6.28, nhanh: 0.5 + Math.random() * 1.8 });
      const ti = nhoMan() ? 0.7 : 1;
      anhHt = QUY_DAO.map((q) => veHanhTinh(q.r * ti, q.kieu, !!q.vanh));
      doMoc();
    };

    // ---------- hành trình theo vị trí cuộn trang chủ ----------
    let moc: [number, Canh][] = [[0, VUON]];
    let hoSo = { top: 0, h: 1 };
    const doMoc = () => {
      const s = [...document.querySelectorAll<HTMLElement>(".tc > section")];
      if (s.length < 7) { moc = [[0, VUON]]; return; }
      const v = s.map((e) => ({ top: e.getBoundingClientRect().top + scrollY, h: e.offsetHeight }));
      const [, lon, nhom, hs, loTrinh, co, ket] = v;
      hoSo = hs;
      const T = Math.max(1, lon.h - H);
      const ds: [number, Canh][] = [
        [0, VUON], [lon.top - 0.45 * H, VUON],
        [lon.top + 0.02 * T, BINH_MINH], [lon.top + 0.25 * T, BINH_MINH],
        [lon.top + 0.32 * T, HOANG_HON], [lon.top + 0.6 * T, DEM], [lon.top + 0.9 * T, DEM],
        [lon.top + T + 0.35 * H, HE_MAT_TROI], [nhom.top + Math.max(0, nhom.h - H), HE_MAT_TROI],
        [hs.top + 0.25 * H, HOA_KIM], [hs.top + Math.max(0.3 * H, hs.h - 0.6 * H), HOA_KIM],
        [loTrinh.top + 0.1 * H, THIEN_HA], [loTrinh.top + Math.max(0, loTrinh.h - H), THIEN_HA],
        [co.top + 0.05 * H, MANG], [ket.top - 0.55 * H, MANG], [ket.top - 0.08 * H, BINH_MINH_VANG],
      ];
      for (let i = 1; i < ds.length; i++) if (ds[i][0] < ds[i - 1][0]) ds[i][0] = ds[i - 1][0];
      moc = ds;
    };
    const canhTai = (y: number): Canh => {
      if (y <= moc[0][0]) return moc[0][1];
      for (let i = 1; i < moc.length; i++) {
        if (y <= moc[i][0]) {
          const [a, A] = moc[i - 1], [b, B] = moc[i];
          return b - a < 1 ? B : tronCanh(A, B, muot((y - a) / (b - a)));
        }
      }
      return moc[moc.length - 1][1];
    };

    const veLa = (c: CanvasRenderingContext2D, x: number, y: number, r: number, goc: number, a: number) => {
      c.save(); c.translate(x, y); c.rotate(goc); c.globalAlpha = a;
      c.fillStyle = "#6CBF84"; c.beginPath();
      c.ellipse(0, 0, r * 2.2, r * 1.05, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#4f9e6a"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-r * 2, 0); c.lineTo(r * 2, 0); c.stroke();
      c.restore();
    };
    const veSaoNam = (c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) => {
      c.save(); c.globalAlpha = a; c.fillStyle = "#E3A92B"; c.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const g = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(g) * rr, y + Math.sin(g) * rr); }
      c.closePath(); c.fill(); c.restore();
    };
    const quang = (x: number, y: number, r: number, mau: RGB, a: number) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hex(mau, a)); gr.addColorStop(1, hex(mau, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    };

    // ---------- mỗi lần vuốt: sáng dịu lên ----------
    let lanCuoi = 0, mauKe = 0, dem = 0;
    const voOa = (x: number, y: number) => {
      const bay = performance.now();
      if (giam || !laTrangChu.current || bay - lanCuoi < 500) return;
      lanCuoi = bay; nhip = 1;
      if (dem < 0.5) vong.push({ x, y, t: 0, song: 2.6, m: mauKe++ % 5, lon: Math.max(W, H) * 0.7 });
    };

    // ---------- vòng vẽ ----------
    let truoc = performance.now(), tCuon = scrollY / Math.max(1, innerHeight), nenCu = "";
    const ve = (t: number) => {
      const s = Math.min(0.05, Math.max(0, (t - truoc) / 1000)); truoc = t;
      const nha = laTrangChu.current;
      const k = nha ? 1 : 0.45;
      if (nha && (giam || (soKhung & 31) === 0)) doMoc();
      const C = nha ? canhTai(scrollY) : VUON;
      dem = 1 - (0.2126 * C.tren[0] + 0.7152 * C.tren[1] + 0.0722 * C.tren[2]) / 255;
      // thời gian vũ trụ: trôi đều, cộng phần do tay cuộn (đuổi theo mềm như có quán tính)
      const dich = scrollY / Math.max(1, H);
      tCuon = giam ? dich : tCuon + (dich - tCuon) * Math.min(1, s * 2.2);
      const giay = giam ? 0 : t / 1000;
      const TG = giam ? 0 : giay * 0.22 + tCuon * 0.9;
      nhip = Math.max(0, nhip - s / 2.4);
      const sang = muot(nhip);
      const lon = Math.max(W, H), nho = Math.min(W, H), hep = nhoMan();
      // tầng cũ thu nhỏ vào xa khi tầng lớn hơn hiện ra; tầng mới đến từ gần rồi lùi về vị trí
      const tang = [C.traiDat, C.heMatTroi, C.hoaKim, C.thienHa, C.mangVuTru];
      const coTang = (i: number) => {
        let truocDo = 0, sauDo = 0;
        for (let j = 0; j < i; j++) truocDo += tang[j];
        for (let j = i + 1; j < tang.length; j++) sauDo += tang[j];
        return Math.max(0.35, 1 + 0.5 * Math.min(1, truocDo) - 0.45 * Math.min(1, sauDo));
      };

      // 0. bầu trời (báo màu nền thật cho trang qua --sc-canvas)
      const nenMoi = nha ? hex(C.giua.map(Math.round) as RGB) : "";
      if (nenMoi !== nenCu) {
        if (nenMoi) document.documentElement.style.setProperty("--sc-canvas", nenMoi);
        else document.documentElement.style.removeProperty("--sc-canvas");
        nenCu = nenMoi;
      }
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      if (nha) {
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, hex(C.tren)); gr.addColorStop(0.55, hex(C.giua)); gr.addColorStop(1, hex(C.duoi));
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      } else ctx.clearRect(0, 0, W, H);

      // 1. quả cầu ánh sáng của khu vườn
      if (C.vuon > 0.01) {
        for (const c of CAU) {
          const x = (c.x + Math.sin(t / 1000 * c.sx * 6.283 + c.p) * c.ax) * W;
          const y = (c.y + Math.cos(t / 1000 * c.sy * 6.283 + c.p) * c.ay) * H;
          const r = c.r * lon;
          ctx.globalAlpha = 0.5 * k * C.vuon;
          ctx.drawImage(cau[c.m], x - r, y - r, r * 2, r * 2);
        }
      }
      // 2. ánh vàng ôm lấy khu vườn (bình minh, đặc ân)
      if (C.vang > 0.01) {
        const gr = ctx.createRadialGradient(W / 2, H * 1.08, 0, W / 2, H * 1.08, lon * 0.95);
        gr.addColorStop(0, "rgba(255,231,168,0.95)"); gr.addColorStop(0.4, "rgba(246,196,83,0.38)"); gr.addColorStop(1, "rgba(246,196,83,0)");
        ctx.globalAlpha = C.vang * (0.88 + 0.12 * Math.sin(giay * 0.6)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = dem > 0.5 ? "lighter" : "source-over";
      // 3. tinh vân
      if (C.tinhVan > 0.01) {
        for (const n of TINH_VAN_DS) {
          const x = (n.x + Math.sin(giay * 0.03 + n.p) * 0.05) * W, y = (n.y + Math.cos(giay * 0.025 + n.p) * 0.05) * H;
          const r = n.r * lon;
          ctx.globalAlpha = C.tinhVan * 0.22; ctx.drawImage(sangVt[n.m], x - r, y - r, r * 2, r * 2);
        }
      }
      // 4. bầu sao quay quanh thiên cực
      if (C.sao > 0.01 && nha) {
        const px = W / 2, py = -0.35 * H, quay = TG * 0.035;
        ctx.fillStyle = "#fffdf6";
        for (const st of sao) {
          const a = st.a + quay;
          const x = px + Math.cos(a) * st.r, y = py + Math.sin(a) * st.r;
          if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
          const lap = giam ? 0.8 : 0.55 + 0.45 * Math.sin(giay * st.nhanh + st.pha);
          const d = 0.7 + st.z * 1.5;
          ctx.globalAlpha = C.sao * lap * (0.3 + 0.7 * st.z); ctx.fillRect(x - d / 2, y - d / 2, d, d);
        }
      }
      // 5. Ngân Hà
      if (C.nganHa > 0.01) {
        nganHa ??= veNganHa();
        const dai = Math.hypot(W, H) * 1.15;
        ctx.save(); ctx.translate(W / 2, H * 0.48); ctx.rotate(-0.42 + TG * 0.004);
        ctx.globalAlpha = C.nganHa * 0.9; ctx.drawImage(nganHa, -dai / 2, -dai * 0.14, dai, dai * 0.28); ctx.restore();
      }
      // 6. thiên hà xoắn ốc, quay theo thời gian vũ trụ
      if (C.thienHa > 0.01) {
        thienHa ??= veThienHa();
        const kt = nho * (hep ? 1.25 : 1.1) * coTang(3);
        ctx.save(); ctx.translate(W * (hep ? 0.5 : 0.64), H * (hep ? 0.2 : 0.26)); ctx.rotate(-0.45); ctx.scale(1, 0.5); ctx.rotate(TG * 0.09);
        ctx.globalAlpha = C.thienHa; ctx.drawImage(thienHa, -kt / 2, -kt / 2, kt, kt); ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";

      // 7. Trái Đất tự quay, Mặt Trăng quay quanh
      if (C.traiDat > 0.01) {
        const z = coTang(0), R = (hep ? 24 : 36) * z;
        const ex = hep ? W * 0.78 : W * 0.17, ey = hep ? H * 0.12 : H * 0.24;
        const gm = TG * 0.55, mx = ex + Math.cos(gm) * R * 3.2, my = ey + Math.sin(gm) * R * 1.1, mr = R * 0.27;
        const veTrang = () => {
          const g = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
          g.addColorStop(0, "#F4F1FF"); g.addColorStop(1, "#8E89A8");
          ctx.globalAlpha = C.traiDat; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill();
        };
        ctx.globalAlpha = C.traiDat * (0.2 + 0.12 * sang); ctx.strokeStyle = "rgb(222,214,255)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(ex, ey, R * 3.2, R * 1.1, 0, 0, 6.283); ctx.stroke();
        if (Math.sin(gm) < 0) veTrang();
        ctx.globalAlpha = C.traiDat; quang(ex, ey, R * 1.7, [140, 200, 255], 0.35);
        ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, R, 0, 6.283); ctx.clip();
        const bien = ctx.createRadialGradient(ex - R * 0.35, ey - R * 0.4, R * 0.1, ex, ey, R * 1.05);
        bien.addColorStop(0, "#9FD8F0"); bien.addColorStop(0.55, "#3F8FC8"); bien.addColorStop(1, "#1C3F7A");
        ctx.fillStyle = bien; ctx.fillRect(ex - R, ey - R, R * 2, R * 2);
        // lục địa trôi ngang: Trái Đất tự quay
        ctx.fillStyle = "rgba(108,191,132,0.9)";
        const dich = ((TG * 0.12) % 1) * R * 4;
        for (const [ox, oy, rx, ry] of [[-1.2, -0.3, 0.55, 0.35], [-0.2, 0.25, 0.4, 0.5], [0.9, -0.45, 0.6, 0.28], [1.6, 0.35, 0.35, 0.3]]) {
          for (const lap of [0, -R * 4]) {
            const x = ex - R * 2 + ((ox * R + R * 2 + dich) % (R * 4)) + lap + R * 0;
            ctx.beginPath(); ctx.ellipse(x, ey + oy * R, rx * R, ry * R, 0.3, 0, 6.283); ctx.fill();
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(ex - R, ey - R * 0.62, R * 2, R * 0.1); ctx.fillRect(ex - R, ey + R * 0.4, R * 2, R * 0.08);
        const toi = ctx.createLinearGradient(ex - R, ey, ex + R, ey);
        toi.addColorStop(0, "rgba(10,8,32,0)"); toi.addColorStop(0.55, "rgba(10,8,32,0.05)"); toi.addColorStop(1, "rgba(10,8,32,0.6)");
        ctx.fillStyle = toi; ctx.fillRect(ex - R, ey - R, R * 2, R * 2);
        ctx.restore();
        if (Math.sin(gm) >= 0) veTrang();
      }

      // 8. hệ Mặt Trời: quỹ đạo lồng nhau, hành tinh gần quay nhanh hơn
      if (C.heMatTroi > 0.01) {
        const z = coTang(1), cx = W * 0.5, cy = H * 0.46, A = (hep ? 0.5 * W : Math.min(0.46 * W, 0.62 * H * 1.6)) * z, nghieng = 0.4;
        ctx.globalAlpha = C.heMatTroi; quang(cx, cy, 70 * z, [255, 214, 140], 0.75); quang(cx, cy, 16 * z, [255, 236, 190], 1);
        ctx.lineWidth = 1; ctx.strokeStyle = "rgb(222,214,255)";
        QUY_DAO.forEach((q, i) => {
          const rx = q.a * A, ry = rx * nghieng;
          ctx.globalAlpha = C.heMatTroi * (0.18 + 0.14 * sang); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.283); ctx.stroke();
          const g = (TG * 2.2) / Math.pow(q.a / QUY_DAO[0].a, 1.5) + i * 1.9;
          const x = cx + Math.cos(g) * rx, y = cy + Math.sin(g) * ry, img = anhHt[i];
          ctx.globalAlpha = C.heMatTroi; ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
          if (q.trang) {
            const m = TG * 7, R = img.width * 0.75;
            ctx.globalAlpha = C.heMatTroi * 0.9; ctx.fillStyle = "#EDE8FF";
            ctx.beginPath(); ctx.arc(x + Math.cos(m) * R, y + Math.sin(m) * R * 0.4, 1.8, 0, 6.283); ctx.fill();
          }
        });
      }

      // 9. vũ điệu Trái Đất và Sao Kim: cuộn tới đâu, bông hoa năm cánh hiện tới đó
      if (C.hoaKim > 0.01) {
        const z = coTang(2), cx = W * 0.5, cy = H * 0.5, Rk = nho * (hep ? 0.4 : 0.36) * z;
        const tienDo = giam ? 1 : Math.max(0, Math.min(1, (scrollY + H * 0.6 - hoSo.top) / Math.max(1, hoSo.h * 0.9)));
        const ngay = 2922 * tienDo, xoay = TG * 0.02;
        ctx.globalAlpha = C.hoaKim; quang(cx, cy, 40, [255, 214, 140], 0.6);
        ctx.lineWidth = 0.7;
        for (let d = 0; d <= ngay; d += 6) {
          const e = (2 * Math.PI * d) / 365.25 + xoay, v = (2 * Math.PI * d) / 224.7 + xoay;
          ctx.globalAlpha = C.hoaKim * (0.2 + 0.1 * sang);
          ctx.strokeStyle = (d / 6) % 2 ? "rgb(214,206,255)" : "rgb(255,214,150)";
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(e) * Rk, cy + Math.sin(e) * Rk); ctx.lineTo(cx + Math.cos(v) * Rk * 0.723, cy + Math.sin(v) * Rk * 0.723); ctx.stroke();
        }
        const e = (2 * Math.PI * ngay) / 365.25 + xoay, v = (2 * Math.PI * ngay) / 224.7 + xoay;
        ctx.globalAlpha = C.hoaKim * 0.25; ctx.strokeStyle = "rgb(222,214,255)";
        ctx.beginPath(); ctx.arc(cx, cy, Rk, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, Rk * 0.723, 0, 6.283); ctx.stroke();
        ctx.globalAlpha = C.hoaKim; quang(cx + Math.cos(e) * Rk, cy + Math.sin(e) * Rk, 12, [159, 225, 203], 0.9);
        quang(cx + Math.cos(v) * Rk * 0.723, cy + Math.sin(v) * Rk * 0.723, 10, [250, 199, 117], 0.9);
      }

      // 10. mạng vũ trụ: các cụm thiên hà nối bằng sợi cong, ánh sáng chảy dọc sợi về các nút
      if (C.mangVuTru > 0.01) {
        const z = coTang(4), goc = TG * 0.03, cx = W / 2, cy = H / 2, diu = hep ? 0.55 : 1;
        const P = NUT.map(([x, y]) => {
          const dx = (x - 0.5) * W * 1.05 * z, dy = (y - 0.5) * H * 1.05 * z;
          return [cx + dx * Math.cos(goc) - dy * Math.sin(goc) * 0.7, cy + dx * Math.sin(goc) * 0.7 + dy * Math.cos(goc)];
        });
        ctx.globalCompositeOperation = "lighter";
        SOI.forEach(([i, j], n) => {
          const [a, b] = [P[i], P[j]];
          const mx = (a[0] + b[0]) / 2 + Math.sin(n * 2.3) * 0.08 * nho, my = (a[1] + b[1]) / 2 + Math.cos(n * 1.7) * 0.07 * nho;
          ctx.globalAlpha = diu * C.mangVuTru * (0.1 + 0.08 * sang); ctx.strokeStyle = "rgb(200,190,255)"; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.stroke();
          ctx.globalAlpha = diu * C.mangVuTru * (0.2 + 0.1 * sang); ctx.lineWidth = 1.2; ctx.stroke();
          for (let q = 0; q < 3; q++) {
            const f = (TG * 0.05 + q / 3 + n * 0.13) % 1, u = 1 - f;
            const x = u * u * a[0] + 2 * u * f * mx + f * f * b[0], y = u * u * a[1] + 2 * u * f * my + f * f * b[1];
            ctx.globalAlpha = diu * C.mangVuTru * 0.6; ctx.drawImage(sangTrang, x - 5, y - 5, 10, 10);
          }
        });
        P.forEach(([x, y], i) => {
          const d = (i === 0 ? 62 : 34 + (i % 3) * 8) * (hep ? 0.6 : 1) * (0.9 + 0.1 * Math.sin(giay * 0.8 + i));
          ctx.globalAlpha = diu * C.mangVuTru * 0.85; ctx.drawImage(i === 0 ? sangVang : i % 2 ? sangVt[0] : sangTrang, x - d / 2, y - d / 2, d, d);
        });
        ctx.globalCompositeOperation = "source-over";
      }

      if (!giam) {
        // 11. hạt giống bay lên (đom đóm vàng ở lại cả trong đêm), lá chỉ có ở khu vườn
        const cuon = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - H));
        const hien = Math.round(hat.length * (0.55 + 0.45 * cuon) * (k < 1 ? 0.6 : 1) * (0.5 + 0.5 * (1 - dem)));
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
          if (h.loai === 2) { if (C.vuon > 0.02) veLa(ctx, x, h.y, h.r, h.xoay, a * 0.85 * C.vuon); }
          else { ctx.globalAlpha = a * (h.loai === 0 ? 0.8 : 0.4 + 0.6 * C.vuon); const d = h.r * 6; ctx.drawImage(sangHat[h.loai], x - d / 2, h.y - d / 2, d, d); }
        }
        // 12. quầng màu rất nhẹ loang ra khi vuốt (chỉ ở khu vườn sáng)
        for (let i = vong.length - 1; i >= 0; i--) {
          const v = vong[i]; v.t += s; if (v.t > v.song) { vong.splice(i, 1); continue; }
          const p = v.t / v.song, r = Math.max(1, muot(Math.min(1, p * 1.2)) * v.lon);
          const m = MAU_VU_TRU[v.m], a = 0.12 * Math.sin(Math.PI * p) * (1 - dem);
          const gr = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, r);
          gr.addColorStop(0, hex(m, a)); gr.addColorStop(0.7, hex(m, a * 0.6)); gr.addColorStop(1, hex(m, 0));
          ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, 6.283); ctx.fill();
        }
        // 13. nắm lá và sao vừa gieo khi bấm chuột: vẽ trên lớp phía trước nội dung
        ctxT.clearRect(0, 0, W, H);
        for (let i = no.length - 1; i >= 0; i--) {
          const p = no[i]; p.tuoi! += s;
          const song = p.song!; if (p.tuoi! > song) { no.splice(i, 1); continue; }
          p.x += p.vx! * s; p.y -= p.vy * s; p.vy -= 18 * s; p.xoay += s * 2;
          const a = 1 - p.tuoi! / song;
          if (p.loai === 2) veLa(ctxT, p.x, p.y, p.r, p.xoay, a); else veSaoNam(ctxT, p.x, p.y, p.r * 1.6, a);
        }
      }
      ctx.globalAlpha = 1;
      soKhung++;
      if (!chet && !an && !giam) khung = requestAnimationFrame(ve);
    };

    // ---------- tương tác ----------
    let chamY = 0, chamX = 0, chamSan = false, lanTayGan = 0, lanCuonCuoi = 0;
    const diChuot = (e: PointerEvent) => { if (e.pointerType === "mouse") { chuot.x = e.clientX; chuot.y = e.clientY; } };
    const roiChuot = () => { chuot.x = chuot.y = -9999; };
    const gieo = (e: PointerEvent) => {
      if (giam || (laTrangChu.current && e.pointerType !== "mouse")) return;
      const el = e.target as Element | null;
      if (el?.closest("a, button, input, textarea, select, label, [role=tab], table, figure, img")) return;
      for (let i = 0; i < 12; i++) {
        const g = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const v = 60 + Math.random() * 90;
        no.push({ x: e.clientX, y: e.clientY, r: 3 + Math.random() * 2.4, vy: -Math.sin(g) * v, vx: Math.cos(g) * v, lac: 0, pha: 0, loai: Math.random() < 0.5 ? 2 : 0, xoay: Math.random() * 6, tuoi: 0, song: 1.2 + Math.random() * 0.8 });
      }
    };
    const lanChuot = () => { lanTayGan = performance.now(); voOa(W / 2 + (Math.random() - 0.5) * W * 0.3, H * 0.66); };
    const batDauCham = (e: TouchEvent) => { const t = e.touches[0]; chamX = t.clientX; chamY = t.clientY; chamSan = true; lanTayGan = performance.now(); };
    const diCham = (e: TouchEvent) => {
      if (!chamSan) return; const t = e.touches[0];
      if (Math.abs(t.clientY - chamY) > 10) { chamSan = false; lanTayGan = performance.now(); voOa(chamX, chamY); }
    };
    const khiCuon = () => {
      const bay = performance.now();
      if (bay - lanTayGan > 700 && bay - lanCuonCuoi > 450) voOa(W / 2, H * 0.66);
      lanCuonCuoi = bay;
      if (giam) { cancelAnimationFrame(khung); khung = requestAnimationFrame(ve); }
    };
    const anHien = () => {
      an = document.hidden;
      if (!an && !giam && !chet) { truoc = performance.now(); cancelAnimationFrame(khung); khung = requestAnimationFrame(ve); }
    };

    coGian();
    const doLai = () => { coGian(); if (giam) ve(performance.now()); };
    addEventListener("resize", doLai);
    addEventListener("pointermove", diChuot, { passive: true });
    addEventListener("pointerleave", roiChuot);
    addEventListener("pointerdown", gieo, { passive: true });
    addEventListener("wheel", lanChuot, { passive: true });
    addEventListener("touchstart", batDauCham, { passive: true });
    addEventListener("touchmove", diCham, { passive: true });
    addEventListener("scroll", khiCuon, { passive: true });
    document.addEventListener("visibilitychange", anHien);
    const tre = setTimeout(doLai, 900);
    const theoDoi = new ResizeObserver(() => doMoc());
    theoDoi.observe(document.body);
    if (giam) ve(performance.now()); else khung = requestAnimationFrame(ve);
    return () => {
      chet = true; cancelAnimationFrame(khung); clearTimeout(tre); theoDoi.disconnect();
      removeEventListener("resize", doLai);
      removeEventListener("pointermove", diChuot);
      removeEventListener("pointerleave", roiChuot);
      removeEventListener("pointerdown", gieo);
      removeEventListener("wheel", lanChuot);
      removeEventListener("touchstart", batDauCham);
      removeEventListener("touchmove", diCham);
      removeEventListener("scroll", khiCuon);
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
