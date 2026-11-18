import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { sb } from "../lib/supabase";
import { useNguoiDung } from "../lib/nguoiDung";

export function DangNhap() {
  const { email } = useNguoiDung();
  const [thu, setThu] = useState("");
  const [tt, setTt] = useState<"nhap" | "dang-gui" | "da-gui" | "loi">("nhap");
  const [loi, setLoi] = useState("");
  if (email) return <Navigate to="/tai-khoan" replace />;
  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = thu.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) { setTt("loi"); setLoi("Thư điện tử chưa đúng dạng. Cô hoặc ba mẹ kiểm tra lại giúp."); return; }
    setTt("dang-gui");
    const { error } = await sb.auth.signInWithOtp({ email: t, options: { emailRedirectTo: `${location.origin}/` } });
    if (error) { setTt("loi"); setLoi(`Chưa gửi được thư: ${error.message}`); } else setTt("da-gui");
  };
  return (
    <main><div className="khung"><div className="hop-dang-nhap the">
      <h1 style={{ fontSize: 28 }}>Đăng nhập</h1>
      {tt === "da-gui" ? (
        <>
          <p>Trạm đã gửi một liên kết đăng nhập tới <strong>{thu}</strong>.</p>
          <p className="nho">Ba mẹ hoặc cô mở thư và bấm vào liên kết trên chính thiết bị này. Không thấy thư sau vài phút thì xem trong mục Thư rác.</p>
        </>
      ) : (
        <form onSubmit={gui} noValidate>
          <p className="nho">Nhập thư điện tử đã đăng ký với trạm. Trạm gửi một liên kết để đăng nhập, không cần mật khẩu.</p>
          <label htmlFor="thu" className="nho" style={{ fontWeight: 600, color: "var(--chu)" }}>Thư điện tử</label>
          <input id="thu" className="o-nhap" type="email" autoComplete="email" value={thu} onChange={(e) => { setThu(e.target.value); if (tt === "loi") setTt("nhap"); }} placeholder="tenban@gmail.com" style={{ margin: "6px 0 4px" }} />
          {tt === "loi" && <p role="alert" style={{ color: "var(--tt-on)", fontSize: 13, margin: "0 0 8px" }}>{loi}</p>}
          <button className="nut" type="submit" disabled={tt === "dang-gui"} style={{ marginTop: 10 }}>{tt === "dang-gui" ? "Đang gửi…" : "Gửi liên kết đăng nhập"}</button>
        </form>
      )}
      <p className="rat-nho" style={{ marginTop: 18 }}>Chưa có tài khoản? Cô và ba mẹ vẫn xem được <Link to="/ho-so-mau">hồ sơ mẫu</Link>.</p>
    </div></div></main>
  );
}

export function TaiKhoan() {
  const { sanSang, email, vai, con } = useNguoiDung();
  if (!sanSang) return <div className="dang-tai">Đang kiểm tra tài khoản…</div>;
  if (!email) return <Navigate to="/dang-nhap" replace />;
  return (
    <main><div className="khung" style={{ padding: "40px 20px 60px" }}>
      <h1 style={{ fontSize: 30 }}>Xin chào</h1>
      <p className="nho">Đang đăng nhập bằng {email}.</p>
      {vai && (<div className="the" style={{ marginBottom: 16 }}><h3>{vai.ho_ten}</h3><p className="nho">{vai.mo_ta_vai}{vai.quan_tri ? " · Quản trị toàn quyền" : ""}</p><Link className="nut" to="/nhan-su">Mở bàn làm việc</Link></div>)}
      {con.length > 0 && (<div className="the"><h3>Hồ sơ của con</h3>{con.map((c) => <p key={c.id}><Link to={`/ho-so/${c.id}`}>{c.ho_ten}</Link></p>)}</div>)}
      {!vai && con.length === 0 && <div className="the"><p>Thư này chưa được khai báo với trạm. Ba mẹ nhắn cô Ngọc để cô thêm thư vào danh sách lớp.</p><Link to="/ho-so-mau">Xem hồ sơ mẫu</Link></div>}
    </div></main>
  );
}
