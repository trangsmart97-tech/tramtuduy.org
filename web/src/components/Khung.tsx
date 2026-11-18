import { NavLink, Link } from "react-router-dom";
import { useNguoiDung } from "../lib/nguoiDung";

export function DauTrang() {
  const { email, vai, dangXuat } = useNguoiDung();
  return (
    <header className="dau-trang">
      <div className="khung">
        <Link to="/" className="logo" aria-label="Trạm Tư Duy, trang chủ"><img src="/logo-ngang.svg" alt="Trạm Tư Duy, Xây nền trí tuệ" /></Link>
        <nav className="menu" aria-label="Điều hướng chính">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/ho-so-mau">Hồ sơ mẫu</NavLink>
          <NavLink to="/nhan-su">Bàn làm việc của cô</NavLink>
          {email ? (
            <>
              <NavLink to="/tai-khoan">{vai ? "Tài khoản của cô" : "Hồ sơ của con"}</NavLink>
              <button className="nut phu" onClick={dangXuat}>Đăng xuất</button>
            </>
          ) : (
            <Link to="/dang-nhap" className="nut">Đăng nhập</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function ChanTrang() {
  return (
    <footer className="chan-trang">
      <div className="khung">
        <div>
          <strong style={{ color: "#fff", fontSize: 16 }}>Trạm Tư Duy</strong><br />
          Xây nền trí tuệ: từng bước nhỏ, trên một hành trình dài.
        </div>
        <div>
          <a href="https://luyende.tramtuduy.org">Luyện đề</a> · <a href="https://luyennghe.tramtuduy.org">Luyện nghe</a> · <a href="https://lab.tramtuduy.org">Phòng thí nghiệm</a>
        </div>
      </div>
    </footer>
  );
}

export function BangXemThu({ noi }: { noi: string }) {
  return (
    <div className="xem-thu-bang"><div className="khung"><strong>Chế độ xem thử.</strong> {noi}</div></div>
  );
}
