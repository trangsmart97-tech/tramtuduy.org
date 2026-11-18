import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import type { NhanSu } from "../lib/hoSo";

const NHOM = [
  { nhan: "LỚP 3", ten: "Toán tư duy", mo: "Các con làm quen với cách nghĩ có hệ thống: vẽ ra để thấy, chia trường hợp không sót, tìm quy luật trong cái đang đổi." },
  { nhan: "LỚP 4", ten: "Toán tư duy và ngữ pháp tiếng Anh", mo: "Toán tư duy đi tiếp một bậc, cùng nền ngữ pháp tiếng Anh vững để các con đọc và viết câu đúng." },
  { nhan: "LỚP 5", ten: "Luyện thi vào lớp 6 Trần Đại Nghĩa", mo: "Lộ trình từ 14/12/2026 đến 30/06/2027: 18 tuần học, 5 bài kiểm tra mốc, rồi 24 đề thi thử như thật." },
];
const WEB = [
  { ten: "Luyện đề", url: "https://luyende.tramtuduy.org", mo: "Thi thử trên máy, đúng cấu trúc và thời gian của đề thật. Máy chấm phần trắc nghiệm ngay khi con nộp bài." },
  { ten: "Luyện nghe", url: "https://luyennghe.tramtuduy.org", mo: "Bản ghi tiếng Anh thật, do người thật nói. Con nghe, điền và nhận nhận xét theo từng loại lỗi." },
  { ten: "Phòng thí nghiệm", url: "https://lab.tramtuduy.org", mo: "Phòng thí nghiệm tổng hợp cho nhiều môn, trước mắt là Toán và Khoa học. Con tự tay thử, dự đoán, kiểm tra và rút ra kết luận. Kết quả được ghi vào hồ sơ học tập." },
];

export default function TrangChu() {
  const [doiNgu, setDoiNgu] = useState<NhanSu[]>([]);
  useEffect(() => { sb.from("nhan_su").select("*").order("thu_tu").then(({ data }) => setDoiNgu((data as NhanSu[]) ?? [])); }, []);
  return (
    <main>
      <section className="anh-hung">
        <div className="khung">
          <div>
            <div className="khau-hieu">XÂY NỀN TRÍ TUỆ</div>
            <h1>Mỗi bước nhỏ hôm nay là nền cho một hành trình dài.</h1>
            <p className="loi">Trạm Tư Duy giúp các con tiểu học xây nền kiến thức, dựng khung tư duy và tự tin bay cao. Mỗi bài con làm đều để lại dấu vết, để ba mẹ thấy rõ con đã rèn được gì và còn vướng ở đâu.</p>
            <div className="nhom-nut">
              <Link to="/ho-so-mau" className="nut">Xem hồ sơ học tập mẫu</Link>
              <Link to="/dang-nhap" className="nut phu">Phụ huynh đăng nhập</Link>
            </div>
          </div>
          <img className="hinh" src="/logo-doc.svg" alt="Biểu tượng Trạm Tư Duy: bộ não là tán cây, mọc lên từ quyển vở mở, rễ bám sâu" />
        </div>
      </section>

      <section className="muc">
        <div className="khung">
          <h2>Ba việc trạm làm cùng các con</h2>
          <p className="dan">Tư duy là hành trình của cả một đời. Việc của trạm là giúp các con đặt những bước chân đầu tiên thật vững.</p>
          <div className="buoc">
            <div className="the"><span className="nhan">XÂY NỀN</span><h3>Từng viên gạch kiến thức</h3><p className="nho">Mỗi bài học là một viên gạch: hiểu vì sao, không học thuộc. Kiến thức trở lại nhiều lần cách quãng để nhớ lâu.</p></div>
            <div className="the"><span className="nhan">DỰNG KHUNG</span><h3>Cách nghĩ có hệ thống</h3><p className="nho">Mỗi bài mở bằng một câu hỏi con chưa trả lời được, rồi đi qua quan sát, dự đoán, kiểm tra, rút ra quy tắc.</p></div>
            <div className="the"><span className="nhan">BAY CAO</span><h3>Dùng được ở tình huống lạ</h3><p className="nho">Cuối mỗi bài là một tình huống mới. Con mang điều vừa học đi giải điều chưa gặp bao giờ.</p></div>
          </div>
        </div>
      </section>

      <section className="muc bac-ha">
        <div className="khung">
          <h2>Ba nhóm lớp</h2>
          <div className="luoi c3">
            {NHOM.map((n) => (<div className="the" key={n.nhan}><span className="nhan">{n.nhan}</span><h3>{n.ten}</h3><p className="nho">{n.mo}</p></div>))}
          </div>
        </div>
      </section>

      <section className="muc">
        <div className="khung">
          <h2>Hồ sơ học tập khách quan</h2>
          <p className="dan">Hồ sơ của con lấy số liệu từ chính bài con làm trên web, xếp theo độ tin cậy: bài có giám sát trên lớp tính nặng nhất, phần con tự đánh giá hiện riêng. Hồ sơ chỉ so con với chính con, không xếp hạng với bạn khác.</p>
          <div className="luoi c4">
            <div className="the"><div className="so">148</div><p className="nho">chủ đề kiến thức, mỗi chủ đề là một “trạm” sáng dần theo mức con nắm được</p></div>
            <div className="the"><div className="so">10</div><p className="nho">kỹ năng làm bài được theo dõi riêng, như đọc kỹ đề, đọc biểu đồ, kiểm tra lại đáp số</p></div>
            <div className="the"><div className="so">6</div><p className="nho">bậc tư duy, từ nhớ, hiểu, vận dụng đến phân tích, đánh giá, sáng tạo</p></div>
            <div className="the"><div className="so">4</div><p className="nho">loại lỗi để biết con sai vì chưa hiểu, đọc nhầm đề, tính ẩu hay hết giờ</p></div>
          </div>
          <p style={{ marginTop: 22 }}><Link to="/ho-so-mau" className="nut">Xem một hồ sơ mẫu đầy đủ</Link></p>
        </div>
      </section>

      <section className="muc kem">
        <div className="khung">
          <h2>Đội ngũ đồng hành</h2>
          <p className="dan">Bốn cô cùng nhìn thấy toàn bộ hành trình của con. Mỗi cô giữ một phần việc rõ ràng, để không chỗ nào bị bỏ sót.</p>
          <div className="luoi c4 co">
            {doiNgu.map((c) => (
              <div className="the" key={c.email}>
                <div className="vong">{c.ho_ten.replace("Cô ", "").slice(0, 1)}</div>
                <h3>{c.ho_ten}</h3>
                <p className="nho">{c.mo_ta_vai}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="muc web-con">
        <div className="khung">
          <h2>Nơi các con luyện tập</h2>
          <div className="luoi c3">
            {WEB.map((w) => (
              <a className="the" key={w.ten} href={w.url}><h3>{w.ten}</h3><p className="nho">{w.mo}</p><div className="duong-dan">{w.url.replace("https://", "")}</div></a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
