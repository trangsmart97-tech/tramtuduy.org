"""Dựng cảnh “Chú ong vun trí tuệ” cho phần mở đầu trang chủ.
Cây dùng các lớp PNG của logo bản 3 (QĐ-024): chạy cong-cu/tach_lop_logo.py trước.

Chạy: python3 cong-cu/tao_canh_ong.py
Ra (web/public/hinh/):
  canh-ong.svg, canh-ong-tinh.svg          bố cục ngang (máy tính)
  canh-ong-doc.svg, canh-ong-doc-tinh.svg  bố cục dọc (điện thoại)
Các tệp được chèn thẳng vào trang (không qua <img>) để chữ dùng phông của trang: SF Pro trên iPhone, Mac; Inter trên máy khác.
Mọi lớp, mã và hoạt ảnh đều có tiền tố “o-” để không đụng CSS của trang.

Câu chuyện, một vòng:
  chú ong viết nửa đầu thông điệp trên trang trái; chữ hoá giọt mật chảy xuống rễ;
  ong bay qua ngọn cây sang trang phải, viết nửa sau; mật lại chảy xuống rễ;
  ong đáp xuống tán cây; dòng mật vàng rực dâng từ rễ lên thân, lên tới bộ não; bộ não bừng sáng;
  ong bay đi, chữ mờ dần, vòng lặp lại.
Bản tĩnh (giảm chuyển động): hai trang đầy chữ, ong đậu trên ngọn, ngọn cây sáng nhẹ.
"""
import math, re
from pathlib import Path

GOC = Path(__file__).resolve().parents[1]
LOP = GOC / "web/public/hinh"

THONG_DIEP = {
    "trai": ["Các cô cùng ba mẹ", "nắm lấy tay các con", "để tiếp sức"],
    "phai": ["trên hành trình", "vun bồi trí tuệ", "và nội lực."],
}
# Độ rộng ở cỡ 23px, nét 600, đo trên trang thật; lấy số lớn hơn giữa SF Pro (iPhone, Mac) và Inter (máy khác).
RONG_23 = {"Các cô cùng ba mẹ": 202.7, "nắm lấy tay các con": 211.4, "để tiếp sức": 114.3,
           "trên hành trình": 157.7, "vun bồi trí tuệ": 144.9, "và nội lực.": 107.1}

BO_CUC = {
    "ngang": dict(W=1200, H=660, CAY_W=380, TW=320, TH=280, CO=26, GIAN=50,
                  TRANG={"trai": (178, 392, -5), "phai": (1022, 378, 4)},
                  VAO=((-70, 120), (60, 130)), QUA=lambda W, CY: (W / 2, CY - 80),
                  RA=lambda W, N: ((W + 90, 40), (N[0] + 300, N[1] - 140)),
                  TOI_NGON=lambda N: (N[0] + 220, N[1] - 60)),
    "doc": dict(W=640, H=880, CAY_W=430, TW=292, TH=250, CO=24, GIAN=46,
                TRANG={"trai": (158, 186, -4), "phai": (482, 200, 4)},
                VAO=((-70, 30), (40, 40)), QUA=lambda W, CY: (W / 2, 20),
                RA=lambda W, N: ((W + 90, 60), (W - 20, N[1] - 180)),
                TOI_NGON=lambda N: (N[0] + 200, N[1] - 120)),
}

def f(v): return ("%.1f" % v).rstrip("0").rstrip(".")

# Logo bản 3 (QĐ-024): các lớp PNG tách bằng cong-cu/tach_lop_logo.py, khung vuông LOGO x LOGO điểm ảnh gốc.
LOGO = 1479
LOP_CAY = ("lop-bia.png", "lop-re.png", "lop-tim.png")

def xoay(cx, cy, goc, x, y):
    a = math.radians(goc)
    return cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)

def tao(ten_bo, TINH):
    B = BO_CUC[ten_bo]
    W, H, CAY_W, TW, TH, CO, GIAN, TRANG = (B[k] for k in ("W", "H", "CAY_W", "TW", "TH", "CO", "GIAN", "TRANG"))
    CAY_H = CAY_W
    CAY_X = (W - CAY_W) / 2
    CAY_Y = H - CAY_H - 6
    def cay_diem(X, Y): return CAY_X + X / LOGO * CAY_W, CAY_Y + Y / LOGO * CAY_H   # toạ độ trên ảnh logo gốc
    DONG_Y = [-GIAN, 0, GIAN]                 # đường chân chữ, tính từ tâm trang
    X0 = -TW / 2 + (TW - max(RONG_23[s] for s in THONG_DIEP["trai"] + THONG_DIEP["phai"]) * CO / 23) / 2
    # Ong viết bằng đầu đuôi: thân bay ngay phía trước nét chữ, không che chữ đã viết.
    DUOI_X, DUOI_Y = 46, -10
    NGON = (W / 2 + 8, CAY_Y + 84 / LOGO * CAY_H - 30)   # ngay trên đỉnh bộ não (hàng 84 của ảnh)

    # ---------- lịch: ong viết, bay, đậu ----------
    chang, lich_dong = [], []
    diem = [B["VAO"][0]]
    def di(loai, dich, ctrl, t0, t1):
        chang.append((loai, diem[0], dich, ctrl, t0, t1)); diem[0] = dich
    def but(trang, k, x):
        cx, cy, g = TRANG[trang]
        return xoay(cx, cy, g, x + DUOI_X, DONG_Y[k] + DUOI_Y)
    t = 0.0
    xong = {}
    for trang in ("trai", "phai"):
        for k, s in enumerate(THONG_DIEP[trang]):
            w = RONG_23[s] * CO / 23
            dau = but(trang, k, X0)
            if k == 0 and trang == "trai": di("Q", dau, B["VAO"][1], 0.0, 1.0); t = 1.0
            elif k == 0: di("Q", dau, B["QUA"](W, CAY_Y), t, t + 1.2); t += 1.2
            else: di("L", dau, None, t, t + 0.25); t += 0.25
            dt = 0.3 + w / 240 * 0.95
            di("L", but(trang, k, X0 + w), None, t, t + dt)
            lich_dong.append((trang, k, s, w, t, t + dt)); t += dt
        xong[trang] = t
    t_toi = t + 1.2
    di("Q", NGON, B["TOI_NGON"](NGON), t, t_toi)
    t_dang = t_toi + 0.2                      # dòng mật bắt đầu dâng từ rễ
    t_den = t_dang + 1.3                      # dòng mật chạm tán cây
    t_ruc = t_den + 1.5                       # bộ não rực sáng tới đây
    t_di = t_ruc + 0.3
    di("L", (NGON[0] + 0.01, NGON[1]), None, t_toi, t_di)
    ra_dich, ra_ctrl = B["RA"](W, NGON)
    di("Q", ra_dich, ra_ctrl, t_di, t_di + 1.2)
    t_mo0, t_mo1 = t_di + 0.9, t_di + 1.7     # chữ mờ dần
    CHU_KY = t_di + 2.2
    q = lambda s: f"{max(0.0, min(1.0, s / CHU_KY)):.4f}"

    # đường bay và mốc thời gian của ong
    def mau(c, n=40):
        loai, p0, p1, qq, t0, t1 = c
        if loai == "L": return [p0, p1]
        return [((1 - s) ** 2 * p0[0] + 2 * (1 - s) * s * qq[0] + s * s * p1[0], (1 - s) ** 2 * p0[1] + 2 * (1 - s) * s * qq[1] + s * s * p1[1]) for s in [i / n for i in range(n + 1)]]
    duong = "M%s %s" % (f(chang[0][1][0]), f(chang[0][1][1]))
    dai = [0.0]
    for c in chang:
        loai, p0, p1, qq, t0, t1 = c
        duong += ("L%s %s" % (f(p1[0]), f(p1[1]))) if loai == "L" else ("Q%s %s %s %s" % (f(qq[0]), f(qq[1]), f(p1[0]), f(p1[1])))
        m = mau(c); dai.append(dai[-1] + sum(math.dist(m[i], m[i + 1]) for i in range(len(m) - 1)))
    khung_ong = [(0.0, 0.0)] + [(c[5], dai[i + 1] / dai[-1]) for i, c in enumerate(chang)] + [(CHU_KY, 1.0)]

    # giọt mật: từ chân mỗi trang xuống các điểm rễ
    RE = [cay_diem(459, 1290), cay_diem(588, 1353), cay_diem(742, 1378), cay_diem(888, 1353), cay_diem(1017, 1290)]   # điểm nằm trên rễ thật
    giot = []
    for trang, dich in (("trai", RE[:3]), ("phai", RE[2:])):
        cx, cy, g = TRANG[trang]
        for j, (dx, dy) in enumerate(dich):
            sx, sy = xoay(cx, cy, g, -40 + j * 40, TH / 2 - 22)
            qx, qy = (sx + dx) / 2, max(sy, dy) + 60
            giot.append(("M%s %s Q%s %s %s %s" % (f(sx), f(sy), f(qx), f(qy), f(dx), f(dy)), xong[trang] + j * 0.22))
    T_GIOT = 1.1

    def lap(thuoc_tinh, gia_tri, moc):  # SMIL lặp theo chu kỳ, các mốc tính bằng giây
        return (f'<animate attributeName="{thuoc_tinh}" dur="{f(CHU_KY)}s" repeatCount="indefinite" calcMode="linear" '
                f'values="{";".join(str(v) for v in gia_tri)}" keyTimes="{";".join(q(s) for s in moc)}"/>')

    css = """
    .o-canh { transform-box: fill-box; transform-origin: 50% 100%; animation: o-vo 0.11s ease-in-out infinite alternate; }
    @keyframes o-vo { from { transform: scaleY(1); } to { transform: scaleY(0.45); } }
    .o-than { animation: o-nhun 0.6s ease-in-out infinite alternate; }
    @keyframes o-nhun { from { transform: translateY(0); } to { transform: translateY(-4px); } }
    .o-chu { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif; font-weight: 600; fill: #2B1C47; }
    """ + ("" if not TINH else ".o-canh, .o-than { animation: none; }")

    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" aria-hidden="true" focusable="false">',
           "<defs>",
           '<radialGradient id="o-gm"><stop offset="0" stop-color="#F6C453"/><stop offset=".45" stop-color="#E3A92B" stop-opacity=".9"/><stop offset="1" stop-color="#E3A92B" stop-opacity="0"/></radialGradient>',
           '<radialGradient id="o-gn"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".35" stop-color="#FFE08A" stop-opacity=".95"/><stop offset=".7" stop-color="#F6C453" stop-opacity=".35"/><stop offset="1" stop-color="#F6C453" stop-opacity="0"/></radialGradient>',
           '<linearGradient id="o-vang" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE28A"/><stop offset=".55" stop-color="#F6C453"/><stop offset="1" stop-color="#E3A92B"/></linearGradient>',
           '<filter id="o-bong" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#2d5a46" flood-opacity=".14"/></filter>',
           '<filter id="o-hao" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" result="m"/><feMerge><feMergeNode in="m"/><feMergeNode in="SourceGraphic"/></feMerge></filter>']
    # vùng hé chữ: mỗi dòng một khung cắt, rộng dần theo ngòi bút
    for trang, k, s, w, t0, t1 in lich_dong:
        y0 = DONG_Y[k] - CO * 1.3
        rong = w + 8
        dong = "" if TINH else lap("width", [0, 0, f(rong), f(rong)], [0, t0, t1, CHU_KY])
        svg.append(f'<clipPath id="o-k-{trang}-{k}"><rect x="{f(X0 - 4)}" y="{f(y0)}" height="{f(CO * 1.8)}" width="{f(rong)}">{dong}</rect></clipPath>')
    # vùng dòng mật dâng: từ đáy cây lên ngọn
    day, dinh = CAY_Y + CAY_H, CAY_Y - 10
    if not TINH:
        svg.append(f'<clipPath id="o-dang"><rect x="{f(CAY_X - 20)}" width="{f(CAY_W + 40)}" y="{f(day)}" height="0">'
                   + lap("y", [f(day), f(day), f(dinh), f(dinh)], [0, t_dang, t_den, CHU_KY])
                   + lap("height", [0, 0, f(day - dinh), f(day - dinh)], [0, t_dang, t_den, CHU_KY]) + "</rect></clipPath>")
    svg += ["</defs>", "<style>" + css + "</style>"]

    # ánh sáng sau ngọn cây và dưới rễ
    nx, ny = cay_diem(734, 420)     # tâm bộ não
    rx_, ry_ = cay_diem(740, 1290)  # giữa vùng rễ
    if TINH:
        svg.append(f'<ellipse cx="{f(nx)}" cy="{f(ny)}" rx="{f(CAY_W * .55)}" ry="{f(CAY_W * .5)}" fill="url(#o-gn)" opacity=".45"/>')
        svg.append(f'<ellipse cx="{f(rx_)}" cy="{f(ry_)}" rx="{f(CAY_W * .48)}" ry="46" fill="url(#o-gm)" opacity=".35"/>')
    else:
        svg.append(f'<ellipse cx="{f(nx)}" cy="{f(ny)}" rx="{f(CAY_W * .62)}" ry="{f(CAY_W * .56)}" fill="url(#o-gn)" opacity="0">'
                   + lap("opacity", [0, 0, .55, 1, .85, 1, 0, 0], [0, t_den - 0.3, t_den + 0.2, t_den + 0.8, t_den + 1.1, t_ruc, t_mo1, CHU_KY]) + "</ellipse>")
        gl = xong["trai"] + 0.44 + T_GIOT
        svg.append(f'<ellipse cx="{f(rx_)}" cy="{f(ry_)}" rx="{f(CAY_W * .48)}" ry="46" fill="url(#o-gm)" opacity=".15">'
                   + lap("opacity", [.15, .15, .8, .3, .3, 1, 1, .4, .15], [0, gl - 0.2, gl + 0.2, gl + 1.0, t_dang - 0.3, t_dang, t_den, t_ruc, CHU_KY]) + "</ellipse>")

    # hai trang giấy và câu thông điệp
    for trang, (cx, cy, g) in TRANG.items():
        svg.append(f'<g transform="translate({cx} {cy}) rotate({g})" filter="url(#o-bong)">')
        svg.append(f'<rect x="{-TW/2}" y="{-TH/2}" width="{TW}" height="{TH}" rx="16" fill="#fffaf2"/>')
        for yy in [DONG_Y[0] - GIAN] + DONG_Y + [DONG_Y[-1] + GIAN]:
            if -TH / 2 + 14 < yy + 9 < TH / 2 - 14:
                svg.append(f'<line x1="{f(-TW/2+18)}" x2="{f(TW/2-18)}" y1="{f(yy+9)}" y2="{f(yy+9)}" stroke="#eadfce" stroke-width="1.4"/>')
        mo = "" if TINH else lap("opacity", [1, 1, 0, 0], [0, t_mo0, t_mo1, CHU_KY])
        svg.append(f'<g class="o-chu" font-size="{CO}">{mo}')
        for k, s in enumerate(THONG_DIEP[trang]):
            svg.append(f'<text x="{f(X0)}" y="{DONG_Y[k]}" clip-path="url(#o-k-{trang}-{k})">{s}</text>')
        svg.append("</g></g>")

    # cây trí tuệ: các lớp PNG của logo bản 3, rồi lớp vàng rực dâng theo dòng mật
    khung = f'x="{f(CAY_X)}" y="{f(CAY_Y)}" width="{f(CAY_W)}" height="{f(CAY_H)}"'
    svg.append("".join(f'<image href="/hinh/{t}" {khung} preserveAspectRatio="xMidYMid meet"/>' for t in LOP_CAY))
    if not TINH:
        # Lớp vàng: một khối màu vàng, chỉ hiện ở chỗ có bìa, rễ, thân và não (mặt nạ là bóng trắng lop-bong.png).
        svg.insert(svg.index("</defs>"), f'<mask id="o-mv" maskUnits="userSpaceOnUse" x="{f(CAY_X)}" y="{f(CAY_Y)}" width="{f(CAY_W)}" height="{f(CAY_H)}">'
                   f'<image href="/hinh/lop-bong.png" {khung} preserveAspectRatio="xMidYMid meet"/></mask>')
        svg.append(f'<g clip-path="url(#o-dang)" opacity="0">'
                   + lap("opacity", [0, 0, 1, 1, .92, 1, 0, 0], [0, t_dang, t_dang + 0.05, t_den + 0.6, t_den + 1.0, t_ruc, t_mo1, CHU_KY])
                   + f'<g filter="url(#o-hao)"><rect {khung} fill="url(#o-vang)" mask="url(#o-mv)"/></g></g>')
        # hạt sáng dẫn đầu dòng mật, chạy dọc thân từ rễ lên tán
        x_re, y_re = cay_diem(740, 1250)
        x_ngon, y_ngon = cay_diem(737, 520)
        dmat = f"M{f(x_re)} {f(y_re)} L{f(x_ngon)} {f(y_ngon)}"
        svg.append(f'<g opacity="0"><animateMotion dur="{f(CHU_KY)}s" repeatCount="indefinite" path="{dmat}" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;{q(t_dang)};{q(t_den)};1"/>'
                   + lap("opacity", [0, 0, 1, 1, 0, 0], [0, t_dang - 0.01, t_dang + 0.1, t_den - 0.1, t_den + 0.3, CHU_KY])
                   + '<circle r="34" fill="url(#o-gn)"/><circle r="9" fill="#FFF3C4"/></g>')

    # giọt mật
    if not TINH:
        for d, t0 in giot:
            svg.append(f'<g opacity="0"><animateMotion dur="{f(CHU_KY)}s" repeatCount="indefinite" path="{d}" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;{q(t0)};{q(t0 + T_GIOT)};1"/>'
                       + lap("opacity", [0, 0, 1, 1, 0, 0], [0, t0, t0 + 0.12, t0 + T_GIOT, t0 + T_GIOT + 0.3, CHU_KY])
                       + '<circle r="13" fill="url(#o-gm)" opacity=".55"/><circle r="5.5" fill="#E3A92B"/></g>')

    # chú ong: thân vàng mật, sọc tím chàm, cánh trong vỗ nhanh
    if TINH:
        dau_ong = f'<g transform="translate({f(NGON[0])} {f(NGON[1])})">'
    else:
        kt = ";".join(q(s) for s, _ in khung_ong); kp = ";".join(f"{d:.4f}" for _, d in khung_ong)
        dau_ong = f'<g><animateMotion dur="{f(CHU_KY)}s" repeatCount="indefinite" path="{duong}" calcMode="linear" keyTimes="{kt}" keyPoints="{kp}"/>'
    svg.append(dau_ong + '<g class="o-than"><g transform="scale(1.6)">'
               '<g class="o-canh"><ellipse cx="-6" cy="-20" rx="11" ry="16" fill="#ffffff" fill-opacity=".85" stroke="#8B77C2" stroke-width="1.6" transform="rotate(-18 -6 -20)"/></g>'
               '<g class="o-canh"><ellipse cx="7" cy="-21" rx="10" ry="15" fill="#ffffff" fill-opacity=".9" stroke="#8B77C2" stroke-width="1.6" transform="rotate(16 7 -21)"/></g>'
               '<clipPath id="o-tg"><ellipse cx="0" cy="0" rx="22" ry="15.5"/></clipPath>'
               '<ellipse cx="0" cy="0" rx="22" ry="15.5" fill="#F2BD3E" stroke="#2B1C47" stroke-width="2.2"/>'
               '<g clip-path="url(#o-tg)" fill="#2B1C47"><rect x="-9" y="-20" width="6.5" height="40"/><rect x="4" y="-20" width="6.5" height="40"/></g>'
               '<path d="M-22 0 L-30 -3 L-30 3 Z" fill="#2B1C47"/>'
               '<circle cx="23" cy="-3" r="10.5" fill="#2B1C47"/>'
               '<circle cx="27" cy="-6" r="3.2" fill="#ffffff"/><circle cx="27.8" cy="-6.2" r="1.5" fill="#1f1b2b"/>'
               '<path d="M24 1.5 Q27.5 5 31 1.8" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>'
               '<path d="M21 -12 Q19 -24 13 -27" fill="none" stroke="#2B1C47" stroke-width="2" stroke-linecap="round"/><circle cx="13" cy="-27" r="2.6" fill="#2B1C47"/>'
               '<path d="M27 -11 Q29 -23 35 -26" fill="none" stroke="#2B1C47" stroke-width="2" stroke-linecap="round"/><circle cx="35" cy="-26" r="2.6" fill="#2B1C47"/>'
               "</g></g></g>")
    svg.append("</svg>")
    ten = "canh-ong" + ("-doc" if ten_bo == "doc" else "") + ("-tinh" if TINH else "") + ".svg"
    (LOP / ten).write_text("\n".join(svg), encoding="utf-8")
    print("ok", ten, len("\n".join(svg).encode()), "bytes", "chu ky", f(CHU_KY), "s", "ong toi ngon", f(t_toi), "mat cham tan", f(t_den))

for bo in ("ngang", "doc"):
    for tinh in (False, True):
        tao(bo, tinh)
