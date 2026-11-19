import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { NguoiDungProvider } from "./lib/nguoiDung";
import { ChanTrang, DauTrang } from "./components/Khung";
import NenSong from "./components/NenSong";
import TrangChu from "./pages/TrangChu";
import { TrangHoSo, TrangHoSoMau } from "./pages/HoSo";
import BaoCaoTuan from "./pages/BaoCaoTuan";
import NhanSuTrang from "./pages/NhanSu";
import { DangNhap, TaiKhoan } from "./pages/DangNhap";

function CuonLenDau() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <NguoiDungProvider>
      <HashRouter>
        <CuonLenDau />
        <NenSong />
        <DauTrang />
        <Routes>
          <Route path="/" element={<TrangChu />} />
          <Route path="/ho-so-mau" element={<TrangHoSoMau />} />
          <Route path="/ho-so/:id" element={<TrangHoSo />} />
          <Route path="/ho-so/:id/bao-cao/:tuan" element={<BaoCaoTuan />} />
          <Route path="/nhan-su" element={<NhanSuTrang />} />
          <Route path="/dang-nhap" element={<DangNhap />} />
          <Route path="/tai-khoan" element={<TaiKhoan />} />
          <Route path="*" element={<div className="dang-tai">Không tìm thấy trang này.</div>} />
        </Routes>
        <ChanTrang />
      </HashRouter>
    </NguoiDungProvider>
  );
}
