import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../lib/supabase";
import "../scrollcraft/scrollcraft.js";
import "./trangchu.css";

type ThanhVien = { vai: string; ten_goi: string; mo_ta_vai: string | null; thu_tu: number };
type ScApi = { destroy: () => void; layout: () => void };
declare global { interface Window { ScrollCraft: { mount: (root: Element) => ScApi } } }

// Ba lớp của logo, cùng một khung toạ độ nên xếp chồng khớp nhau.
function CayTriTue({ dung }: { dung?: boolean }) {
  return (
    <>
      <img className="tc-cay__trang" src="/hinh/lop-trang.svg" alt="" />
      {dung ? (
        <>
          <img className="tc-cay__sach" src="/hinh/lop-nau.svg" alt="" />
          <img className="tc-cay__re" src="/hinh/lop-nau.svg" alt="" />
        </>
      ) : (
        <img src="/hinh/lop-nau.svg" alt="" />
      )}
      <img className="tc-cay__than" src="/hinh/lop-tim.svg" alt="" />
    </>
  );
}

const THONG_DIEP = "Các cô cùng ba mẹ nắm lấy tay các con để tiếp sức trên hành trình vun bồi trí tuệ và nội lực.";

// Cảnh chú ong: chèn thẳng SVG vào trang để chữ dùng phông Be Vietnam Pro.
// Điện thoại dùng bố cục dọc; giảm chuyển động dùng bản tĩnh.
function CanhOng() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hep = matchMedia("(max-width: 760px)");
    const giam = matchMedia("(prefers-reduced-motion: reduce)");
    let huy = false;
    const nap = () => {
      const ten = "canh-ong" + (hep.matches ? "-doc" : "") + (giam.matches ? "-tinh" : "") + ".svg";
      fetch("/hinh/" + ten).then((r) => r.text()).then((svg) => {
        if (!huy && ref.current && svg.startsWith("<svg")) ref.current.innerHTML = svg;
      }).catch(() => {});
    };
    nap();
    hep.addEventListener("change", nap); giam.addEventListener("change", nap);
    return () => { huy = true; hep.removeEventListener("change", nap); giam.removeEventListener("change", nap); };
  }, []);
  return <div className="tc-mo__ong" data-sc-parallax="0.45" role="img" aria-label={"Chú ong viết lên hai trang giấy: “" + THONG_DIEP + "” Chữ hoá giọt mật nuôi rễ, dòng mật dâng lên làm bộ não trên tán cây bừng sáng."} ref={ref} />;
}

const CHANG = [
  { ngay: "09/12/2026", ten: "Đầu vào", mo: "Một đề mô phỏng đúng cấu trúc đề 2026, thi trên máy. Kết quả chia theo năm nhóm môn." },
  { ngay: "14/12 đến 31/01", ten: "Xây nền", mo: "Tuần 1 đến tuần 7. Bài kiểm tra Mốc 1 ngày 09/01, Mốc 2 ngày 30/01." },
  { ngay: "01/02 đến 14/02", ten: "Tết", mo: "Các con nghỉ Tết. Hai buổi mở lại ngày 13 và 14/02 để khởi động." },
  { ngay: "15/02 đến 11/04", ten: "Nâng cao", mo: "Tuần 8 đến tuần 15, dạng khó và chuyên đề. Mốc 3 ngày 13/03, Mốc 4 ngày 10/04." },
  { ngay: "12/04 đến 02/05", ten: "Hệ thống", mo: "Tuần 16 đến tuần 18, nối kiến thức các môn, nửa đề bấm giờ. Mốc 5 ngày 01/05." },
  { ngay: "03/05 đến 27/06", ten: "Luyện đề", mo: "24 đề thi như thật, mỗi tuần 3 đề, hôm sau có buổi giải đề." },
];

export default function TrangChu() {
  const goc = useRef<HTMLDivElement>(null);
  const api = useRef<ScApi | null>(null);
  const [doiNgu, setDoiNgu] = useState<ThanhVien[]>([]);

  useEffect(() => {
    if (!goc.current) return;
    api.current = window.ScrollCraft.mount(goc.current);
    return () => {
      api.current?.destroy();
      api.current = null;
      // Động cơ đổi màu nền bằng --sc-canvas trên thẻ gốc; trả lại nền trắng cho các trang khác.
      document.documentElement.style.removeProperty("--sc-canvas");
    };
  }, []);

  useEffect(() => {
    sb.from("doi_ngu").select("vai, ten_goi, mo_ta_vai, thu_tu").order("thu_tu").then(({ data }) => {
      setDoiNgu((data as ThanhVien[]) ?? []);
      requestAnimationFrame(() => api.current?.layout());
    });
  }, []);

  return (
    <div className="tc" ref={goc}>
      {/* 1. Mở đầu: nhiều lớp trôi ở nhịp khác nhau */}
      <section className="tc-mo" data-sc-act="flow" data-sc-drift="#FFFFFF">
        <div className="tc-mo__chu sc-wrap">
          <h1>Xây nền trí tuệ.</h1>
          <p className="sc-body">Toán tư duy, tiếng Anh và luyện thi vào lớp 6 cho các con tiểu học. Từng bước nhỏ, trên một hành trình dài.</p>
          <div className="tc-mo__nut">
            <Link to="/ho-so-mau" className="tc-nut tc-nut--chinh">Xem hồ sơ mẫu</Link>
            <Link to="/dang-nhap" className="tc-nut tc-nut--phu">Đăng nhập</Link>
          </div>
        </div>
        <div className="tc-mo__canh">
          <div className="tc-hao" data-sc-parallax="1.3" aria-hidden="true" />
          <div className="tc-bui" data-sc-parallax="0.7" aria-hidden="true">
            <i style={{ left: "31%", top: "38%" }} /><i style={{ left: "66%", top: "30%" }} /><i style={{ left: "24%", top: "62%" }} />
            <i style={{ left: "73%", top: "56%" }} /><i style={{ left: "40%", top: "22%" }} /><i style={{ left: "58%", top: "70%" }} />
          </div>
          {/* Chú ong viết thông điệp trên hai trang; chữ hoá giọt mật nuôi rễ; dòng mật dâng lên, bộ não bừng sáng (cong-cu/tao_canh_ong.py) */}
          <CanhOng />
        </div>
        <div className="tc-mo__ha" />
      </section>

      {/* 2. Đỉnh: cây lớn lên từ trang vở theo tay người cuộn */}
      <section className="tc-lon" data-sc-act="pin" data-sc-span="3.4" data-sc-drift="#EEF7F2" aria-label="Ba việc trạm làm cùng các con">
        <div data-sc-stage className="tc-lon__san">
          <div className="tc-lon__chu">
            <div data-sc-cue="0 0.34 0">
              <p className="tc-lon__buoc">Xây nền</p>
              <h2>Rễ bám sâu trước.</h2>
              <p className="sc-body">Mỗi buổi học là một viên gạch kiến thức. Con hiểu vì sao, không học thuộc, và kiến thức trở lại nhiều lần để nhớ lâu.</p>
            </div>
            <div data-sc-cue="0.3 0.66">
              <p className="tc-lon__buoc">Dựng khung</p>
              <h2>Thân dựng lên vững.</h2>
              <p className="sc-body">Mỗi bài mở bằng một câu hỏi con chưa trả lời được. Con quan sát, dự đoán, kiểm tra, rồi tự rút ra quy tắc.</p>
            </div>
            <div data-sc-cue="0.62 1">
              <p className="tc-lon__buoc">Bay cao</p>
              <h2>Trí tuệ nở ra.</h2>
              <p className="sc-body">Cuối mỗi bài là một tình huống lạ. Con mang điều vừa học đi giải điều chưa gặp bao giờ.</p>
            </div>
          </div>
          <div className="tc-cay" aria-hidden="true">
            <div className="tc-cay__nen" />
            <CayTriTue dung />
          </div>
        </div>
      </section>

      {/* 3. Ba nhóm lớp */}
      <section className="tc-muc" data-sc-act="flow" data-sc-drift="#FFFFFF">
        <div className="sc-wrap">
          <div className="tc-muc__dau" data-sc-in>
            <h2>Ba nhóm lớp. Một cách nghĩ.</h2>
            <p className="sc-body">Từ lớp 3 đến lớp 5, các con cùng học một cách: hỏi trước, hiểu sau, rồi tự dùng được.</p>
          </div>
          <div className="tc-o-luoi" data-sc-stagger="70" data-sc-in>
            <article className="tc-o tc-o--lon">
              <p className="tc-o__nhan">Lớp 5</p>
              <h3>Luyện thi vào lớp 6 Trần Đại Nghĩa.</h3>
              <p className="tc-o__mo">Lộ trình từ 14/12/2026 đến 30/06/2027, bám sát cấu trúc đề thật của ba năm gần nhất.</p>
              <div className="tc-o__so">
                <div><b>18</b><span>tuần học</span></div>
                <div><b>5</b><span>bài kiểm tra Mốc</span></div>
                <div><b>24</b><span>đề thi thử</span></div>
              </div>
              <div className="tc-o__cay" aria-hidden="true"><img src="/hinh/lop-tim.svg" alt="" /></div>
            </article>
            <article className="tc-o">
              <p className="tc-o__nhan">Lớp 4</p>
              <h3>Toán tư duy và ngữ pháp tiếng Anh.</h3>
              <p className="tc-o__mo">Toán tư duy đi tiếp một bậc, cùng nền ngữ pháp vững để con đọc và viết câu đúng.</p>
            </article>
            <article className="tc-o">
              <p className="tc-o__nhan">Lớp 3</p>
              <h3>Toán tư duy.</h3>
              <p className="tc-o__mo">Con làm quen với cách nghĩ có hệ thống: vẽ ra để thấy, chia trường hợp không sót, tìm quy luật.</p>
            </article>
          </div>
        </div>
      </section>

      {/* 4. Hồ sơ học tập: vén màn ảnh thật, số đếm thật */}
      <section className="tc-muc" data-sc-act="flow" data-sc-drift="#F7F6FB">
        <div className="sc-wrap">
          <div className="tc-muc__dau tc-hs__dau" data-sc-in>
            <h2>Ba mẹ thấy rõ con đang ở đâu.</h2>
            <p className="sc-body">Mỗi bài con làm trên web để lại dấu vết. Hồ sơ gom lại thành một bức tranh khách quan: con đã vững gì, còn vướng gì, tuần này nên làm gì.</p>
          </div>
          <figure className="tc-khung" data-sc-reveal="up" data-sc-reveal-at="0.12 0.48">
            <div className="tc-khung__thanh"><i /><i /><i /><span>tramtuduy.org · Hồ sơ mẫu</span></div>
            <img src="/hinh/chup-ho-so.png" width="2880" height="1920" alt="Ảnh chụp hồ sơ học tập mẫu: tỷ lệ đúng, trạm đã vững, ba việc của tuần, năm nhóm môn so với đích" />
          </figure>
          <div className="tc-so" data-sc-in data-sc-stagger="80">
            <div><b data-sc-count="0 148">0</b><span>trạm kiến thức, sáng dần theo mức con nắm được</span></div>
            <div><b data-sc-count="0 10">0</b><span>kỹ năng làm bài được theo dõi riêng</span></div>
            <div><b data-sc-count="0 6">0</b><span>bậc tư duy, từ nhớ đến sáng tạo</span></div>
            <div><b data-sc-count="0 4">0</b><span>loại lỗi, để biết con sai vì đâu</span></div>
          </div>
          <p style={{ textAlign: "center", marginTop: 36 }}><Link className="tc-lien-ket" to="/ho-so-mau">Xem hồ sơ mẫu ›</Link></p>
        </div>
      </section>

      {/* 5. Lộ trình trượt ngang */}
      <section className="tc-lt" data-sc-act="pan" data-sc-span="5.2" data-sc-drift="#FFFFFF">
        <div data-sc-stage className="tc-lt__san">
          <div className="tc-lt__ray" data-sc-pan="0.04">
            <div className="tc-lt__dau">
              <h2>Sáu tháng rưỡi, từng chặng một.</h2>
              <p className="sc-body">Lộ trình lớp 5, từ bài đầu vào đến ngày thi.</p>
            </div>
            {CHANG.map((c, i) => (
              <article className="tc-chang" key={c.ten} style={{ ["--i" as string]: i } as React.CSSProperties}>
                <span className="tc-chang__ngay">{c.ngay}</span>
                <h3>{c.ten}</h3>
                <p>{c.mo}</p>
              </article>
            ))}
            <article className="tc-chang tc-chang--dich" style={{ ["--i" as string]: CHANG.length } as React.CSSProperties}>
              <span className="tc-chang__ngay">01/07/2027</span>
              <h3>Ngày thi</h3>
              <p>Ngày khảo sát dự kiến, chờ Sở Giáo dục và Đào tạo công bố.</p>
            </article>
            <p className="tc-lt__cuoi">Sau mỗi bài Mốc, khung được điều chỉnh theo số liệu thật của lớp.</p>
          </div>
        </div>
      </section>

      {/* 6. Bốn cô */}
      <section className="tc-muc" data-sc-act="flow" data-sc-drift="#FFFFFF">
        <div className="sc-wrap">
          <div className="tc-muc__dau" data-sc-in>
            <h2>Bốn cô, một hành trình.</h2>
            <p className="sc-body">Bốn cô cùng nhìn thấy toàn bộ hành trình của con. Mỗi cô giữ một phần việc rõ ràng, để không chỗ nào bị bỏ sót.</p>
          </div>
          <div className="tc-co" data-sc-in data-sc-stagger="70">
            {doiNgu.map((c) => (
              <div key={c.vai}>
                <p className="tc-co__vai">{{ giang_day: "Giảng dạy", giao_vu: "Giáo vụ", cham_bai: "Chấm bài", coach: "Đồng hành" }[c.vai] ?? ""}</p>
                <h3>{c.ten_goi}</h3>
                <p>{c.mo_ta_vai}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Kết: dừng lại, một việc để làm */}
      <section className="tc-ket" data-sc-act="pin" data-sc-span="1.4" data-sc-drift="#EAF7F1">
        <div data-sc-stage className="tc-ket__san">
          <div>
            <div className="tc-ket__cay" aria-hidden="true"><CayTriTue /></div>
            <h2 data-sc-cue="0.04">Bắt đầu từ một bước nhỏ.</h2>
            <p className="sc-body" data-sc-cue="0.08">Xem cách hồ sơ theo dõi một bạn học sinh mẫu qua sáu tuần đầu.</p>
            <div className="tc-ket__nut" data-sc-cue="0.12">
              <Link to="/ho-so-mau" className="tc-nut tc-nut--chinh" data-sc-magnet="0.26" data-sc-rise="0">Xem hồ sơ mẫu</Link>
              <Link to="/dang-nhap" className="tc-lien-ket">Đăng nhập ›</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
