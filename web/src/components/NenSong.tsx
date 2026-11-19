import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/* Nền động của Trạm Tư Duy.

   Trang chủ: “Từ khu vườn tới vũ trụ”. Biên giới của tầm nhìn hệ thống là vũ trụ,
   nên mỗi lần cuộn, bầu trời mở rộng thêm một tầng:
     khu vườn bạc hà (chạm đầu tiên) → bình minh tím hồng → hoàng hôn → đêm sao
     → tinh vân → Ngân Hà → thiên hà xoắn ốc → chòm sao bốn cô quây quanh một ngôi sao con
     → bình minh vàng ôm lấy khu vườn (đặc ân của vũ trụ và mẹ thiên nhiên).
   Các hành tinh nối với nhau thành một mạng lưới (một hệ thống); trên mỗi sợi nối có một hạt sáng chạy chậm.
   Hành tinh gần trôi nhanh hơn hành tinh xa khi cuộn, tạo chiều sâu. Các vì sao trôi toả ra từ tâm rất chậm.
   Mỗi lần vuốt hay lăn chuột: các sợi nối sáng dịu lên rồi lắng xuống; ở khu vườn, một quầng màu rất nhẹ loang ra.
   Mọi chuyển động đều mềm, không chớp, không loé.

   Các trang khác: khu vườn nhẹ (quả cầu ánh sáng, hạt giống, lá) như trước.
   Giảm chuyển động: không vòng lặp, không quầng màu; vẽ một khung tĩnh theo vị trí cuộn. */

type RGB = [number, number, number];
type Canh = { tren: RGB; giua: RGB; duoi: RGB; vuon: number; sao: number; tinhVan: number; nganHa: number; thienHa: number; chomSao: number; quat: number; vang: number; hanhTinh: number };

const VUON: Canh = { tren: [246, 251, 248], giua: [239, 248, 243], duoi: [233, 246, 239], vuon: 1, sao: 0, tinhVan: 0, nganHa: 0, thienHa: 0, chomSao: 0, quat: 0, vang: 0, hanhTinh: 0 };
const BINH_MINH: Canh = { tren: [236, 230, 250], giua: [246, 233, 242], duoi: [252, 234, 216], vuon: 0.45, sao: 0.04, tinhVan: 0.05, nganHa: 0, thienHa: 0, chomSao: 0, quat: 0.18, vang: 0.3, hanhTinh: 0 };
const HOANG_HON: Canh = { tren: [30, 23, 76], giua: [70, 46, 116], duoi: [168, 92, 126], vuon: 0, sao: 0.6, tinhVan: 0.35, nganHa: 0, thienHa: 0, chomSao: 0, quat: 0.32, vang: 0.12, hanhTinh: 0.4 };
const DEM: Canh = { tren: [14, 11, 42], giua: [25, 19, 68], duoi: [44, 30, 92], vuon: 0, sao: 0.85, tinhVan: 0.55, nganHa: 0.15, thienHa: 0, chomSao: 0, quat: 0.48, vang: 0, hanhTinh: 0.75 };
const TINH_VAN: Canh = { tren: [10, 8, 32], giua: [21, 16, 60], duoi: [32, 23, 78], vuon: 0, sao: 1, tinhVan: 1, nganHa: 0.35, thienHa: 0, chomSao: 0, quat: 0.62, vang: 0, hanhTinh: 1 };
const NGAN_HA: Canh = { tren: [9, 9, 30], giua: [19, 17, 58], duoi: [30, 24, 76], vuon: 0, sao: 1, tinhVan: 0.7, nganHa: 1, thienHa: 0.1, chomSao: 0, quat: 0.78, vang: 0, hanhTinh: 1 };
const THIEN_HA: Canh = { tren: [8, 10, 34], giua: [18, 18, 58], duoi: [27, 25, 72], vuon: 0, sao: 1, tinhVan: 0.6, nganHa: 0.55, thienHa: 1, chomSao: 0, quat: 0.9, vang: 0, hanhTinh: 0.9 };
const CHOM_SAO: Canh = { tren: [12, 10, 38], giua: [24, 20, 66], duoi: [40, 30, 90], vuon: 0, sao: 1, tinhVan: 0.75, nganHa: 0.45, thienHa: 0.2, chomSao: 1, quat: 1, vang: 0.05, hanhTinh: 0.75 };
const BINH_MINH_VANG: Canh = { tren: [255, 245, 224], giua: [253, 239, 216], duoi: [234, 247, 241], vuon: 0.85, sao: 0, tinhVan: 0, nganHa: 0, thienHa: 0, chomSao: 0, quat: 1, vang: 1, hanhTinh: 0 };

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
  { m: 4, x: 0.12, y: 0.82, r: 0.5, p: 4.1 }, { m: 0, x: 0.9, y: 0.62, r: 0.45, p: 5.2 }, { m: 3, x: 0.48, y: 0.48, r: 0.32, p: 2.6 },
];

const hex = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const tron = (a: number, b: number, t: number) => a + (b - a) * t;
const tronMau = (a: RGB, b: RGB, t: number): RGB => [tron(a[0], b[0], t), tron(a[1], b[1], t), tron(a[2], b[2], t)];
function tronCanh(a: Canh, b: Canh, t: number): Canh {
  const o = {} as Canh;
  for (const k of Object.keys(a) as (keyof Canh)[]) (o as Record<string, unknown>)[k] = Array.isArray(a[k]) ? tronMau(a[k] as RGB, b[k] as RGB, t) : tron(a[k] as number, b[k] as number, t);
  return o;
}
const muot = (t: number) => t * t * (3 - 2 * t);

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
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;

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
  const kt = 640, c = document.createElement("canvas"); c.width = c.height = kt;
  const g = c.getContext("2d")!; const h = kt / 2;
  const loi = g.createRadialGradient(h, h, 0, h, h, h * 0.42);
  loi.addColorStop(0, "rgba(255,244,214,0.95)"); loi.addColorStop(0.25, "rgba(255,214,150,0.5)"); loi.addColorStop(1, "rgba(180,150,255,0)");
  g.fillStyle = loi; g.fillRect(0, 0, kt, kt);
  for (let nhanh = 0; nhanh < 2; nhanh++) {
    for (let i = 0; i < 2600; i++) {
      const t = Math.pow(Math.random(), 0.8) * 3.1 * Math.PI;
      const r = 14 + t * 27 + gauss() * (6 + t * 3.2);
      const goc = t + nhanh * Math.PI + gauss() * 0.22;
      const x = h + Math.cos(goc) * r, y = h + Math.sin(goc) * r;
      const k = Math.min(1, r / (h * 0.95));
      const m = tronMau([255, 232, 190], [150, 160, 255], k);
      g.fillStyle = hex(m, (1 - k) * 0.7 + 0.12);
      const s = Math.random() < 0.9 ? 1.2 : 2.2; g.fillRect(x, y, s, s);
    }
  }
  return c;
}

// Một hành tinh: khối cầu có sáng tối, quầng khí quyển, dải mây nhẹ; có thể có vành đai.
const KIEU_HT: [RGB, RGB][] = [[[176, 160, 232], [52, 40, 98]], [[168, 235, 221], [34, 108, 104]], [[246, 214, 154], [150, 96, 58]],
  [[247, 195, 217], [140, 70, 110]], [[183, 200, 255], [56, 74, 150]], [[207, 243, 228], [46, 120, 84]]];
function veHanhTinh(r: number, kieu: number, vanh: boolean) {
  const le = vanh ? r * 1.1 : r * 0.55, kt = Math.ceil((r + le) * 2), h = kt / 2;
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
  g.save(); g.beginPath(); g.arc(h, h, r, 0, 6.283); g.clip(); g.globalAlpha = 0.14; g.fillStyle = "#ffffff";
  for (let i = 0; i < 3; i++) g.fillRect(h - r, h - r * 0.55 + i * r * 0.45, r * 2, r * 0.1);
  g.restore();
  if (vanh) veVanh(0, Math.PI, 0.7);
  return c;
}
type HanhTinh = { x: number; y: number; z: number; r: number; pha: number; anh: HTMLCanvasElement; trang: boolean };

type Sao = { a: number; r: number; z: number; pha: number; nhanh: number; m: number };
type Hat = { x: number; y: number; r: number; vy: number; lac: number; pha: number; loai: 0 | 1 | 2; xoay: number; vx?: number; tuoi?: number; song?: number; m?: number };
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
    const hat: Hat[] = [], no: Hat[] = [], vong: Vong[] = [];
    const sao: Sao[] = [];
    const hanhTinh: HanhTinh[] = [];
    let nhip = 0;
    const chuot = { x: -9999, y: -9999 };

    const taoHat = (dau: boolean): Hat => ({
      x: Math.random() * W, y: dau ? Math.random() * H : H + 20,
      r: 2.2 + Math.random() * 2.8, vy: 7 + Math.random() * 13, lac: 8 + Math.random() * 20,
      pha: Math.random() * Math.PI * 2, loai: (Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 2 : 1) as 0 | 1 | 2,
      xoay: Math.random() * Math.PI,
    });
    const taoSao = (dau: boolean): Sao => ({
      a: Math.random() * Math.PI * 2, r: dau ? Math.sqrt(Math.random()) * 1.25 : 0.02 + Math.random() * 0.12,
      z: 0.25 + Math.random() * 0.75, pha: Math.random() * 6.28, nhanh: 0.6 + Math.random() * 2.2,
      m: Math.random() < 0.72 ? -1 : Math.floor(Math.random() * 5),
    });
    const coGian = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cvT.width = cv.width; cvT.height = cv.height; ctxT.setTransform(dpr, 0, 0, dpr, 0, 0);
      const can = nhoMan() ? 22 : 44;
      while (hat.length < can) hat.push(taoHat(true));
      hat.length = can;
      const canSao = nhoMan() ? 190 : 360;
      while (sao.length < canSao) sao.push(taoSao(true));
      sao.length = canSao;
      const canHt = nhoMan() ? 12 : 18;
      if (hanhTinh.length !== canHt) {
        hanhTinh.length = 0;
        for (let i = 0; i < canHt; i++) {
          const z = 0.35 + 0.65 * ((i * 0.618) % 1);
          const r = (nhoMan() ? 0.72 : 1) * (6 + 24 * Math.pow(z, 1.7));
          hanhTinh.push({ x: 0.06 + 0.88 * ((i * 0.381 + 0.13) % 1), y: (i + Math.random() * 0.6) / canHt, z, r, pha: Math.random() * 6.28,
            anh: veHanhTinh(r, i % KIEU_HT.length, r > 18 && i % 3 === 0), trang: r > 14 && i % 4 === 1 });
        }
      }
      doMoc();
    };

    // ---------- hành trình màu theo vị trí cuộn trang chủ ----------
    let moc: [number, Canh][] = [[0, VUON]];
    const doMoc = () => {
      const s = [...document.querySelectorAll<HTMLElement>(".tc > section")];
      if (s.length < 7) { moc = [[0, VUON]]; return; }
      const v = s.map((e) => ({ top: e.getBoundingClientRect().top + scrollY, h: e.offsetHeight }));
      const [, lon, nhom, hoSo, loTrinh, co, ket] = v;
      const T = Math.max(1, lon.h - H);
      const ds: [number, Canh][] = [
        [0, VUON], [lon.top - 0.45 * H, VUON],
        [lon.top + 0.02 * T, BINH_MINH], [lon.top + 0.25 * T, BINH_MINH],
        [lon.top + 0.32 * T, HOANG_HON], [lon.top + 0.6 * T, DEM], [lon.top + T, DEM],
        [nhom.top + 0.15 * H, TINH_VAN], [hoSo.top + 0.2 * H, NGAN_HA],
        [loTrinh.top, THIEN_HA], [loTrinh.top + Math.max(0, loTrinh.h - H), THIEN_HA],
        [co.top, CHOM_SAO], [ket.top - 0.55 * H, CHOM_SAO], [ket.top - 0.08 * H, BINH_MINH_VANG],
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
    const veSaoNam = (c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, mau = "#E3A92B") => {
      c.save(); c.globalAlpha = a; c.fillStyle = mau; c.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const g = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(g) * rr, y + Math.sin(g) * rr); }
      c.closePath(); c.fill(); c.restore();
    };

    // ---------- vỡ oà: vòng sáng và chùm sao hình nan quạt ----------
    let lanCuoi = 0, mauKe = 0;
    const voOa = (x: number, y: number) => {
      const bay = performance.now();
      if (giam || !laTrangChu.current || bay - lanCuoi < 500) return;
      lanCuoi = bay;
      nhip = 1;                                     // các sợi nối sáng dịu lên rồi lắng xuống
      if (dem < 0.5) vong.push({ x, y, t: 0, song: 2.6, m: mauKe++ % 5, lon: Math.max(W, H) * 0.7 });   // quầng màu rất nhẹ
    };

    // ---------- vòng vẽ ----------
    let truoc = performance.now(), yTruoc = scrollY, vMuot = 0, dem = 0; let nenCu = "";
    const ve = (t: number) => {
      const s = Math.min(0.05, Math.max(0, (t - truoc) / 1000)); truoc = t;
      const nha = laTrangChu.current;
      const k = nha ? 1 : 0.45;
      if (nha && (giam || (soKhung & 31) === 0)) doMoc();
      const C = nha ? canhTai(scrollY) : VUON;
      // tốc độ cuộn, theo số màn hình mỗi giây
      if (s > 0) { const v = Math.abs(scrollY - yTruoc) / s / Math.max(1, H); vMuot += (Math.min(4, v) - vMuot) * Math.min(1, s * 6); }
      yTruoc = scrollY;
      const vn = giam ? 0 : vMuot;
      const giay = t / 1000;
      dem = 1 - (0.2126 * C.tren[0] + 0.7152 * C.tren[1] + 0.0722 * C.tren[2]) / 255;

      // 0. bầu trời (báo màu nền thật cho trang qua --sc-canvas)
      const nenMoi = nha ? hex(C.giua.map(Math.round) as RGB) : "";
      if (nenMoi !== nenCu) {
        if (nenMoi) document.documentElement.style.setProperty("--sc-canvas", nenMoi);
        else document.documentElement.style.removeProperty("--sc-canvas");
        nenCu = nenMoi;
      }
      if (nha) {
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, hex(C.tren)); gr.addColorStop(0.55, hex(C.giua)); gr.addColorStop(1, hex(C.duoi));
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      } else ctx.clearRect(0, 0, W, H);

      const lon = Math.max(W, H);
      // 1. quả cầu ánh sáng của khu vườn
      if (C.vuon > 0.01) {
        for (const c of CAU) {
          const x = (c.x + Math.sin(giay * c.sx * 6.283 + c.p) * c.ax) * W;
          const y = (c.y + Math.cos(giay * c.sy * 6.283 + c.p) * c.ay) * H;
          const r = c.r * lon;
          ctx.globalAlpha = 0.5 * k * C.vuon;
          ctx.drawImage(cau[c.m], x - r, y - r, r * 2, r * 2);
        }
      }
      // 2. ánh vàng ôm lấy khu vườn (bình minh, đặc ân)
      if (C.vang > 0.01) {
        const gr = ctx.createRadialGradient(W / 2, H * 1.08, 0, W / 2, H * 1.08, lon * 0.95);
        gr.addColorStop(0, "rgba(255,231,168,0.95)"); gr.addColorStop(0.4, "rgba(246,196,83,0.38)"); gr.addColorStop(1, "rgba(246,196,83,0)");
        ctx.globalAlpha = C.vang * (0.85 + 0.15 * Math.sin(giay * 0.6)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = dem > 0.5 ? "lighter" : "source-over";
      // 3. tinh vân
      if (C.tinhVan > 0.01) {
        for (const n of TINH_VAN_DS) {
          const x = (n.x + Math.sin(giay * 0.03 + n.p) * 0.05) * W, y = (n.y + Math.cos(giay * 0.025 + n.p) * 0.05) * H;
          const r = n.r * lon * (1 + 0.06 * Math.sin(giay * 0.2 + n.p));
          ctx.globalAlpha = C.tinhVan * 0.26; ctx.drawImage(sangVt[n.m], x - r, y - r, r * 2, r * 2);
        }
      }
      // 4. Ngân Hà
      if (C.nganHa > 0.01) {
        nganHa ??= veNganHa();
        const dai = Math.hypot(W, H) * 1.15;
        ctx.save(); ctx.translate(W / 2, H * 0.48); ctx.rotate(-0.42 + Math.sin(giay * 0.02) * 0.03);
        ctx.globalAlpha = C.nganHa * 0.95; ctx.drawImage(nganHa, -dai / 2, -dai * 0.14, dai, dai * 0.28); ctx.restore();
      }
      // 5. thiên hà xoắn ốc
      if (C.thienHa > 0.01) {
        thienHa ??= veThienHa();
        const kt = Math.min(W, H) * (nhoMan() ? 0.95 : 0.78);
        ctx.save(); ctx.translate(W * (nhoMan() ? 0.55 : 0.74), H * 0.34); ctx.rotate(-0.5); ctx.scale(1, 0.48); ctx.rotate(giay * 0.03);
        ctx.globalAlpha = C.thienHa; ctx.drawImage(thienHa, -kt / 2, -kt / 2, kt, kt); ctx.restore();
      }
      // 6. nan quạt ánh sáng: tầm nhìn mở rộng dần theo hành trình
      if (C.quat > 0.01 && C.vang > 0.3) {
        const ox = W / 2, oy = H * 1.04, nua = ((6 + 84 * C.quat) * Math.PI) / 180, dai = lon * 1.5, nTia = 13;
        const mau: RGB = tronMau([214, 204, 255], [246, 190, 80], Math.min(1, C.vang));
        const aGoc = 0.03 + 0.04 * C.vang;
        for (let i = 0; i < nTia; i++) {
          const g = -Math.PI / 2 + (i / (nTia - 1) - 0.5) * 2 * nua, w = 0.022 + 0.01 * Math.sin(i * 2.1);
          const gr = ctx.createLinearGradient(ox, oy, ox + Math.cos(g) * dai, oy + Math.sin(g) * dai);
          gr.addColorStop(0, hex(mau, aGoc)); gr.addColorStop(1, hex(mau, 0));
          ctx.globalAlpha = Math.min(1, C.quat * 1.2) * (0.6 + 0.4 * Math.sin(giay * 0.5 + i * 1.3));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(g - w) * dai, oy + Math.sin(g - w) * dai); ctx.lineTo(ox + Math.cos(g + w) * dai, oy + Math.sin(g + w) * dai);
          ctx.closePath(); ctx.fill();
        }
      }
      // 7. các vì sao toả ra từ tâm, nhanh hơn khi cuộn
      if (C.sao > 0.01 && nha) {
        const cx = W / 2, cy = H * 0.5, R = Math.hypot(W, H) / 2;
        const keo = false;
        if (keo) { ctx.strokeStyle = "rgba(235,232,255,1)"; ctx.lineCap = "round"; }
        for (const st of sao) {
          if (!giam) {
            st.r *= 1 + (0.01 + vn * 0.06) * st.z * s;
            if (st.r > 1.3) Object.assign(st, taoSao(false));
          }
          const x = cx + Math.cos(st.a) * st.r * R, y = cy + Math.sin(st.a) * st.r * R;
          if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
          const lap = 0.55 + 0.45 * Math.sin(giay * st.nhanh + st.pha);
          const a = C.sao * Math.min(1, st.r * 7) * (giam ? 0.8 : lap) * (0.35 + 0.65 * st.z);
          if (keo) {
            const L = Math.min(3, vn) * 12 * st.z;
            ctx.globalAlpha = a * 0.5; ctx.lineWidth = 0.6 + st.z * 1.2;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(st.a) * L, y - Math.sin(st.a) * L); ctx.stroke();
          } else {
            const d = 0.7 + st.z * 1.6; ctx.globalAlpha = a; ctx.fillStyle = "#fffdf6"; ctx.fillRect(x - d / 2, y - d / 2, d, d);
          }
          if (st.z > 0.86) { const d = 10 + st.z * 10; ctx.globalAlpha = a * 0.55; ctx.drawImage(st.m < 0 ? sangTrang : sangVt[st.m], x - d / 2, y - d / 2, d, d); }
        }
      }
      // 7b. các hành tinh nối với nhau thành một hệ thống
      nhip = Math.max(0, nhip - s / 2.2);
      if (C.hanhTinh > 0.01 && nha) {
        const FH = H * 3, tang = muot(nhip);
        const vao = (y: number) => Math.max(0, Math.min(1, (y + 0.3 * H) / (0.3 * H), (1.3 * H - y) / (0.3 * H)));
        const P = hanhTinh.map((p) => {
          const y0 = p.y * FH - scrollY * (0.12 + 0.3 * p.z);
          const y = (((y0 % FH) + FH) % FH) - 0.6 * H + Math.sin(giay * 0.05 + p.pha) * 10;
          return { x: p.x * W + Math.sin(giay * 0.04 + p.pha) * 0.02 * W, y, f: vao(y), p };
        });
        const DMAX = 0.42 * Math.hypot(W, H);
        ctx.lineWidth = 1.3; ctx.strokeStyle = "rgb(226,218,255)";
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const A = P[i], B = P[j]; if (A.f <= 0 || B.f <= 0) continue;
          const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy); if (d > DMAX || d < 1) continue;
          const a = C.hanhTinh * (0.42 + 0.22 * tang) * Math.pow(1 - d / DMAX, 0.9) * A.f * B.f;
          const ux = dx / d, uy = dy / d;
          const x1 = A.x + ux * A.p.r, y1 = A.y + uy * A.p.r, x2 = B.x - ux * B.p.r, y2 = B.y - uy * B.p.r;
          ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          const f = (giay * (0.04 + 0.03 * tang) + i * 0.37 + j * 0.19) % 1, kt = 10 + 4 * tang;
          ctx.globalAlpha = Math.min(1, a * 2.2); ctx.drawImage(sangTrang, tron(x1, x2, f) - kt / 2, tron(y1, y2, f) - kt / 2, kt, kt);
        }
        for (const A of P) {
          if (A.f <= 0) continue;
          const kt = A.p.anh.width;
          ctx.globalAlpha = 0.9 * C.hanhTinh * A.f; ctx.drawImage(A.p.anh, A.x - kt / 2, A.y - kt / 2);
          if (A.p.trang) {   // một mặt trăng nhỏ quay quanh
            const g = giay * 0.25 + A.p.pha, R = A.p.r * 1.9;
            const mx = A.x + Math.cos(g) * R, my = A.y + Math.sin(g) * R * 0.45, mr = Math.max(2, A.p.r * 0.18);
            ctx.globalAlpha = C.hanhTinh * A.f * (Math.sin(g) > -0.2 ? 1 : 0.5);
            ctx.fillStyle = "#EDE8FF"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill();
          }
        }
      }
      // 8. chòm sao: bốn cô quây quanh một ngôi sao con
      if (C.chomSao > 0.01) {
        const P = nhoMan()
          ? [[0.2, 0.09], [0.5, 0.05], [0.82, 0.1], [0.6, 0.2], [0.52, 0.12]]
          : [[0.62, 0.18], [0.75, 0.1], [0.9, 0.2], [0.82, 0.38], [0.76, 0.24]];
        const pt = P.map(([x, y]) => [x * W, y * H]);
        const duong: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]];
        ctx.lineWidth = 1.3; ctx.strokeStyle = "rgba(255,226,150,1)";
        duong.forEach(([a, b], i) => {
          const f = Math.max(0, Math.min(1, C.chomSao * 1.6 - i * 0.07)); if (f <= 0) return;
          ctx.globalAlpha = (nhoMan() ? 0.3 : 0.45) * C.chomSao; ctx.beginPath(); ctx.moveTo(pt[a][0], pt[a][1]);
          ctx.lineTo(tron(pt[a][0], pt[b][0], f), tron(pt[a][1], pt[b][1], f)); ctx.stroke();
        });
        pt.forEach(([x, y], i) => {
          const con = i === 4, d = (con ? 54 : 40) * (nhoMan() ? 0.6 : 1) * (0.85 + 0.15 * Math.sin(giay * 1.6 + i));
          ctx.globalAlpha = C.chomSao; ctx.drawImage(con ? sangVang : sangTrang, x - d / 2, y - d / 2, d, d);
          ctx.globalAlpha = C.chomSao; ctx.fillStyle = con ? "#FFE08A" : "#ffffff"; ctx.beginPath(); ctx.arc(x, y, con ? 3.6 : 2.6, 0, 6.283); ctx.fill();
        });
      }
      ctx.globalCompositeOperation = "source-over";

      if (!giam) {
        // 9. hạt giống bay lên (đom đóm vàng ở lại cả trong đêm), lá chỉ có ở khu vườn
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
          if (h.loai === 2) { if (C.vuon > 0.02) veLa(ctx, x, h.y, h.r, h.xoay, a * 0.85 * C.vuon); }
          else { ctx.globalAlpha = a * (h.loai === 0 ? 1 : 0.4 + 0.6 * C.vuon); const d = h.r * 6; ctx.drawImage(sangHat[h.loai], x - d / 2, h.y - d / 2, d, d); }
        }
        // 10. quầng màu rất nhẹ loang ra khi vuốt (chỉ ở khu vườn sáng)
        for (let i = vong.length - 1; i >= 0; i--) {
          const v = vong[i]; v.t += s; if (v.t > v.song) { vong.splice(i, 1); continue; }
          const p = v.t / v.song, r = muot(Math.min(1, p * 1.2)) * v.lon;
          const m = MAU_VU_TRU[v.m], a = 0.12 * Math.sin(Math.PI * p) * (1 - dem);
          const gr = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, Math.max(1, r));
          gr.addColorStop(0, hex(m, a)); gr.addColorStop(0.7, hex(m, a * 0.6)); gr.addColorStop(1, hex(m, 0));
          ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(v.x, v.y, Math.max(1, r), 0, 6.283); ctx.fill();
        }
        // 11. nắm lá và sao vừa gieo khi bấm chuột: vẽ trên lớp phía trước nội dung
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
      if (bay - lanTayGan > 700 && bay - lanCuonCuoi > 450) voOa(W / 2, H * 0.66);   // phím, thanh cuộn
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
    const tre = setTimeout(doLai, 900);   // trang chủ đo lại sau khi các chặng ghim xong
    const theoDoi = new ResizeObserver(() => doMoc());   // chiều cao trang đổi (ghim chặng, nạp đội ngũ): đo lại mốc màu
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
