"""Sinh dữ liệu cho cổng Trạm Tư Duy.

Chạy:  python tao_du_lieu_mau.py <đường dẫn KHUNG CHƯƠNG TRÌNH 18 TUẦN v2.xlsx> <thư mục ra>
Ra hai tệp:
  01_danh_muc.sql  : nhóm lớp, kỹ năng, chủ đề (lấy từ khung v2), đội ngũ (email tạm)
  02_hoc_sinh_mau.sql : 6 học sinh mẫu lớp 5, dữ liệu giả từ 09/12/2026 đến hết tuần 6 (24/01/2027)

Mọi học sinh ở đây là học sinh giả (la_mau = true), dùng để trình diễn. Kết quả sinh theo một
mô hình xác suất cố định (hạt giống 2026), nên chạy lại ra đúng dữ liệu cũ.
"""
import sys, re, math, random, json, uuid, datetime as dt
from pathlib import Path
import openpyxl

KHUNG, RA = sys.argv[1], Path(sys.argv[2])
RA.mkdir(parents=True, exist_ok=True)
rng = random.Random(2026)
NS = uuid.UUID("6f1c1b8e-2b6a-4c55-9a1e-7a3d2d0b2026")
def uid(*parts): return str(uuid.uuid5(NS, "|".join(map(str, parts))))
def q(s):
    if s is None: return "null"
    if isinstance(s, bool): return "true" if s else "false"
    if isinstance(s, (int, float)): return repr(round(s, 2)) if isinstance(s, float) else str(s)
    return "'" + str(s).replace("'", "''") + "'"

wb = openpyxl.load_workbook(KHUNG, read_only=True)
ky_nang = [r for r in list(wb["Danh mục kỹ năng"].iter_rows(values_only=True))[1:] if r[0]]
chu_de = [r for r in list(wb["Danh mục chủ đề"].iter_rows(values_only=True))[1:] if r[0]]
phieu = [r for r in list(wb["Khung theo phiếu"].iter_rows(values_only=True))[1:] if r[0]]
CD = {r[0]: r for r in chu_de}

# ---------- 01 danh mục ----------
out = ["-- Danh mục, sinh tự động từ khung v2. Không sửa tay.", "begin;"]
out.append("insert into public.nhom_lop (ma, ten, mo_ta) values "
           "('lop3','Lớp 3','Toán tư duy'),"
           "('lop4','Lớp 4','Toán tư duy và ngữ pháp tiếng Anh'),"
           "('lop5','Lớp 5','Luyện thi vào lớp 6 Trần Đại Nghĩa') on conflict (ma) do update set ten=excluded.ten, mo_ta=excluded.mo_ta;")
for r in ky_nang:
    out.append("insert into public.ky_nang (ma, ten, loi_cho_tre) values (%s,%s,%s) on conflict (ma) do update set ten=excluded.ten, loi_cho_tre=excluded.loi_cho_tre;" % (q(r[0]), q(r[1]), q(r[2])))
for r in chu_de:
    kn = (r[6] or "").split(",")[0].strip() or None
    out.append("insert into public.chu_de (ma, ten_tre, nhom_mon, tuan, ten_day_du, bloom, ky_nang_chinh, y_tuong_lon) values (%s,%s,%s,%s,%s,%s,%s,%s) on conflict (ma) do update set ten_tre=excluded.ten_tre, nhom_mon=excluded.nhom_mon, tuan=excluded.tuan, ten_day_du=excluded.ten_day_du, bloom=excluded.bloom, ky_nang_chinh=excluded.ky_nang_chinh, y_tuong_lon=excluded.y_tuong_lon;"
               % (q(r[0]), q(r[1]), q(r[2]), int(r[3]) if r[3] else "null", q(r[4]), q(r[5]), q(kn), q((r[7] or "")[:3] or None)))
DOI_NGU = [
    ("co-trang@chua-cap-nhat.invalid", "Cô Trang", "giang_day", "Giảng dạy, thiết kế chương trình, duyệt báo cáo tuần", True, 1),
    ("co-ngoc@chua-cap-nhat.invalid", "Cô Ngọc", "giao_vu", "Giáo vụ học tập: tương tác, chỉ dẫn và đồng hành cùng các con trong lớp", False, 2),
    ("co-nguyen@chua-cap-nhat.invalid", "Cô Nguyên", "cham_bai", "Chấm bài, phát hiện điểm hỏng, tạo dữ liệu cho tuần ôn khắc phục", False, 3),
    ("co-yori@chua-cap-nhat.invalid", "Cô Yori", "coach", "Coach của học sinh và phụ huynh khi có tiến bộ hay hạn chế cần đồng hành", False, 4),
]
for e, t, v, m, qt, tt in DOI_NGU:
    out.append("insert into public.nhan_su (email, ho_ten, vai, mo_ta_vai, quan_tri, thu_tu) values (%s,%s,%s,%s,%s,%s) on conflict (email) do update set ho_ten=excluded.ho_ten, vai=excluded.vai, mo_ta_vai=excluded.mo_ta_vai, quan_tri=excluded.quan_tri, thu_tu=excluded.thu_tu;" % (q(e), q(t), q(v), q(m), q(qt), tt))
out.append("commit;")
(RA / "01_danh_muc.sql").write_text("\n".join(out), encoding="utf-8")

# ---------- 02 học sinh mẫu ----------
BLOOM = ["Nhớ", "Hiểu", "Vận dụng", "Phân tích", "Đánh giá", "Sáng tạo"]
KHO = {"Nhớ": -1.0, "Hiểu": -0.5, "Vận dụng": 0.0, "Phân tích": 0.6, "Đánh giá": 0.9, "Sáng tạo": 1.1}
NHOM = ["Toán", "Tiếng Anh", "Tiếng Việt", "Khoa học", "Lịch sử và Địa lý"]
LOI = ["kien_thuc", "hieu_sai_de", "tinh_sai", "het_gio"]

HS = [
    dict(ma="MAU-01", ten="Bạn Mẫu", goi="Mẫu", nl={"Toán": 1.0, "Tiếng Anh": 1.6, "Tiếng Việt": 1.2, "Khoa học": 0.6, "Lịch sử và Địa lý": 1.0},
         kn={"KN02": -0.8, "KN04": -0.5}, tang=0.10, loi={"Toán": [0.2, 0.15, 0.55, 0.1]}, nhanh=1.0, dich=88, sut=False),
    dict(ma="MAU-02", ten="Học sinh mẫu An", goi="An", nl={"Toán": 1.8, "Tiếng Anh": 1.0, "Tiếng Việt": 0.9, "Khoa học": 1.3, "Lịch sử và Địa lý": 0.8},
         kn={"KN10": -0.6}, tang=0.08, loi={}, nhanh=0.9, dich=90, sut=False),
    dict(ma="MAU-03", ten="Học sinh mẫu Bình", goi="Bình", nl={"Toán": 0.4, "Tiếng Anh": 0.7, "Tiếng Việt": 1.1, "Khoa học": 0.5, "Lịch sử và Địa lý": 0.6},
         kn={"KN01": -0.7}, tang=0.12, loi={"Tiếng Anh": [0.2, 0.6, 0.1, 0.1]}, nhanh=1.15, dich=82, sut=False),
    dict(ma="MAU-04", ten="Học sinh mẫu Chi", goi="Chi", nl={"Toán": 1.2, "Tiếng Anh": 1.3, "Tiếng Việt": 1.5, "Khoa học": 1.0, "Lịch sử và Địa lý": 1.2},
         kn={}, tang=0.06, loi={}, nhanh=1.0, dich=92, sut=True),
    dict(ma="MAU-05", ten="Học sinh mẫu Dũng", goi="Dũng", nl={"Toán": 0.9, "Tiếng Anh": 0.5, "Tiếng Việt": 0.6, "Khoa học": 0.9, "Lịch sử và Địa lý": 0.7},
         kn={"KN03": -0.5}, tang=0.14, loi={"Toán": [0.15, 0.15, 0.3, 0.4]}, nhanh=1.3, dich=82, sut=False),
    dict(ma="MAU-06", ten="Học sinh mẫu Giang", goi="Giang", nl={"Toán": 1.4, "Tiếng Anh": 1.8, "Tiếng Việt": 1.3, "Khoa học": 1.4, "Lịch sử và Địa lý": 1.5},
         kn={}, tang=0.05, loi={}, nhanh=0.85, dich=93, sut=False),
]

def ngay_tu(s):
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", s or "")
    return dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else None

TUAN_DEN = 6
DEMO_NGAY = dt.date(2027, 1, 24)
lich = []  # (tuan, ngay, ten_tep, nhom, [chu de], [ky nang], bloom)
for r in phieu:
    try: w = int(r[0])
    except Exception: continue
    if w > TUAN_DEN: continue
    ten = r[5] or ""
    cds = [c.strip() for c in (r[7] or "").split(",") if c.strip() in CD]
    kns = [k.strip() for k in (r[15] or "").split(",") if k.strip().startswith("KN")]
    lich.append(dict(tuan=w, ngay=ngay_tu(r[3]), ten=ten, nhom=r[6], cd=cds, kn=kns or ["KN01"], bloom=r[14] or "Vận dụng"))

def p_dung(h, nhom, kn, bloom, tuan, gap):
    x = h["nl"].get(nhom, 1.0) + h["kn"].get(kn, 0.0) - KHO.get(bloom, 0) + h["tang"] * tuan + 0.15 * min(gap, 3)
    if h["sut"] and tuan >= 5: x -= 0.9 * (tuan - 4)
    return 1 / (1 + math.exp(-x))

def chon_loi(h, nhom, giay):
    if giay > 125: return "het_gio"
    w = h["loi"].get(nhom, [0.4, 0.3, 0.2, 0.1])
    return rng.choices(LOI, weights=w)[0]

def bloom_toi(bmax):
    i = BLOOM.index(bmax) if bmax in BLOOM else 2
    return BLOOM[rng.randint(max(0, i - 2), i)]

da_gap = {}  # (hs, chu de) -> so lan
sql = ["-- Học sinh mẫu, sinh tự động. Dữ liệu giả để trình diễn.", "begin;",
       "delete from public.hoc_sinh where la_mau;"]
cau_rows, bai_rows, cham_rows, cc_rows, coach_rows, bc_rows = [], [], [], [], [], []

def them_bai(h, hid, loai, ma, ten, ngay, tuan, dtc, cau_list, phut=None):
    bid = uid(hid, loai, ma)
    diem = sum(c["diem"] for c in cau_list); toi_da = sum(c["toi_da"] for c in cau_list)
    bai_rows.append((bid, hid, loai, ma, ten, ngay, tuan, dtc, diem, toi_da, phut))
    for i, c in enumerate(cau_list):
        cau_rows.append((uid(bid, i), bid, c["ma"], c["nhom"], c["cd"], c["kn"], c["bloom"], c["dung"], c["diem"], c["toi_da"], c["loi"], c["giay"]))
    return bid, diem, toi_da

def sinh_cau(h, hid, nhom, cd, kn, bloom, tuan, ma, diem_moi=1):
    gap = da_gap.get((hid, cd), 0)
    p = p_dung(h, nhom, kn, bloom, tuan, gap)
    dung = rng.random() < p
    giay = max(25, rng.gauss(72 * h["nhanh"], 22))
    da_gap[(hid, cd)] = gap + 1
    return dict(ma=ma, nhom=nhom, cd=cd, kn=kn, bloom=bloom, dung=dung, diem=diem_moi if dung else 0, toi_da=diem_moi,
                loi=None if dung else chon_loi(h, nhom, giay), giay=round(giay))

hoc_trong = {w: [cd for l in lich if l["tuan"] <= w for cd in l["cd"]] for w in range(0, TUAN_DEN + 1)}
TI_LE_TC = {"Khoa học": 5, "Lịch sử và Địa lý": 3, "Toán": 3, "Tiếng Anh": 2, "Tiếng Việt": 2}
TI_LE_DE = {"Khoa học": 6, "Lịch sử và Địa lý": 4, "Toán": 4, "Tiếng Anh": 3, "Tiếng Việt": 3}
ALL_BY_NHOM = {n: [r[0] for r in chu_de if r[2] == n and not r[0].startswith("MO")] for n in NHOM}

def bo_trac_nghiem(h, hid, ti_le, pool_w, tuan, prefix, diem_moi):
    cl = []; k = 0
    for n, sl in ti_le.items():
        pool = [c for c in pool_w if CD[c][2] == n] or ALL_BY_NHOM[n]
        for _ in range(sl):
            k += 1; cd = rng.choice(pool)
            kn = (CD[cd][6] or "KN01").split(",")[0].strip()
            cl.append(sinh_cau(h, hid, n, cd, kn, bloom_toi(CD[cd][5] or "Phân tích"), tuan, "%s%d" % (prefix, k), diem_moi))
    return cl

TIEU_CHI_VIET = [("Đúng yêu cầu của đề", 1.5), ("Nội dung", 4), ("Tổ chức đoạn", 1.5), ("Diễn đạt", 2.5), ("Sáng tạo", 2.5)]
TIEU_CHI_TOAN = [("Hiểu đề", 1), ("Cách làm", 3), ("Tính đúng", 2), ("Lời giải, đơn vị, đáp số", 1), ("Lập luận chặt", 1)]
MUC = [(1.0, "Đạt trọn"), (0.75, "Đạt phần lớn"), (0.5, "Đạt một phần"), (0.0, "Chưa đạt")]
HONG_VIET = {"Nội dung": "Mới có một lý do, chưa có ví dụ cụ thể", "Tổ chức đoạn": "Thiếu câu kết, các câu chưa nối bằng từ nối",
             "Diễn đạt": "Lặp từ “rất” nhiều lần; có 3 lỗi chính tả", "Sáng tạo": "Chi tiết còn quen thuộc, chưa có hình ảnh riêng"}
HONG_TOAN = {"Cách làm": "Chọn đúng hướng nhưng bỏ sót bước kiểm tra điều kiện", "Tính đúng": "Sai phép nhân ở bước 2, mang lỗi sang bước sau",
             "Lời giải, đơn vị, đáp số": "Thiếu đơn vị ở đáp số", "Lập luận chặt": "Chưa nêu lý do chọn cách chia trường hợp"}

def cham_bai_tu_luan(h, hid, loai, ma, ten, ngay, tuan, nhom, tieu_chi, hong):
    bid = uid(hid, loai, ma)
    base = h["nl"].get(nhom, 1.0) + h["tang"] * tuan - (0.9 * (tuan - 4) if h["sut"] and tuan >= 5 else 0)
    tong = 0; td = 0
    for tc, toi in tieu_chi:
        p = 1 / (1 + math.exp(-(base + rng.gauss(0, 0.6) - 0.3)))
        he, muc = min(MUC, key=lambda m: abs(m[0] - p))
        d = round(toi * he * 2) / 2
        tong += d; td += toi
        cham_rows.append((uid(bid, tc), bid, "tl1", tc, muc, d, toi, None, hong.get(tc) if he < 1 else None, "co-nguyen@chua-cap-nhat.invalid"))
    bai_rows.append((bid, hid, loai, ma, ten, ngay, tuan, 3, tong, td, None))
    return tong, td

for h in HS:
    hid = uid("hs", h["ma"])
    sql.append("insert into public.hoc_sinh (id, ma_hs, ho_ten, ten_goi, nhom_lop, dich_diem, la_mau) values (%s,%s,%s,%s,'lop5',%d,true);" % (q(hid), q(h["ma"]), q(h["ten"]), q(h["goi"]), h["dich"]))
    # Bài thi đầu vào 09/12/2026
    cl = bo_trac_nghiem(h, hid, TI_LE_DE, [c for n in NHOM for c in ALL_BY_NHOM[n]], 0, "tn", 2)
    them_bai(h, hid, "dau_vao", "dau-vao", "Bài thi thử đầu vào", dt.date(2026, 12, 9), 0, 1, cl, 90)
    tc_diem = []
    for w in range(1, TUAN_DEN + 1):
        for l in [x for x in lich if x["tuan"] == w]:
            t = l["ten"].upper()
            if "PHIẾU" in t or "TRẠM KIẾN THỨC" in t:
                if not l["cd"]: continue
                cl = []
                for i in range(rng.randint(5, 8)):
                    cd = l["cd"][i % len(l["cd"])]
                    kn = l["kn"][i % len(l["kn"])]
                    cl.append(sinh_cau(h, hid, CD[cd][2], cd, kn, bloom_toi(l["bloom"]), w, "c%d" % (i + 1)))
                ma = "tang3-" + re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
                them_bai(h, hid, "tang3", ma, "Tầng 3: " + l["ten"].title(), l["ngay"] or dt.date(2026, 12, 14) + dt.timedelta(days=7 * (w - 1)), w, 2, cl)
            elif t.startswith("THỰC CHIẾN"):
                cl = bo_trac_nghiem(h, hid, TI_LE_TC, hoc_trong[w], w, "tc", 1)
                _, d, td = them_bai(h, hid, "thuc_chien", "thuc-chien-tuan-%d" % w, "Thực chiến Chủ nhật tuần %d" % w, l["ngay"], w, 1, cl, 25)
                tc_diem.append((w, d / td))
        if w == 4:
            cl = bo_trac_nghiem(h, hid, TI_LE_DE, hoc_trong[3], 4, "tn", 2)
            them_bai(h, hid, "moc", "moc-1", "Bài kiểm tra Mốc 1", dt.date(2027, 1, 9), 4, 1, cl, 90)
        thu7 = dt.date(2026, 12, 19) + dt.timedelta(days=7 * (w - 1))
        cham_bai_tu_luan(h, hid, "bai_viet", "bai-viet-tuan-%d" % w, "Bài viết đoạn tuần %d" % w, thu7 - dt.timedelta(days=2), w, "Tiếng Việt", TIEU_CHI_VIET, HONG_VIET)
        cham_bai_tu_luan(h, hid, "loi_giai", "loi-giai-tuan-%d" % w, "Lời giải Toán tuần %d" % w, thu7 + dt.timedelta(days=1), w, "Toán", TIEU_CHI_TOAN, HONG_TOAN)
        # Chuyên cần: 6 buổi mỗi tuần
        mon = dt.date(2026, 12, 14) + dt.timedelta(days=7 * (w - 1))
        for off, buoi in [(0, "Tiếng Anh 1, Lịch sử và Địa lý 1"), (1, "Tiếng Việt 1"), (2, "Tiếng Anh 2, Lịch sử và Địa lý 2"), (3, "Tiếng Việt 2"), (5, "Toán 1, Khoa học 1"), (6, "Toán 2, Khoa học 2")]:
            co = rng.random() > 0.04
            tt = (1 if h["sut"] and w >= 5 and rng.random() < 0.6 else rng.choices([1, 2, 3], weights=[1, 4, 5])[0]) if co else None
            gc = None
            if h["sut"] and w >= 5 and tt == 1: gc = "Con ít phát biểu, có lúc mất tập trung cuối buổi"
            cc_rows.append((uid(hid, "cc", mon + dt.timedelta(days=off)), hid, mon + dt.timedelta(days=off), buoi, co, tt, gc))
    h["_tc"] = tc_diem
    # Ghi chú coach
    if h["sut"]:
        coach_rows.append((uid(hid, "coach", 1), hid, dt.date(2027, 1, 24), "Điểm Thực chiến giảm hai tuần liền; cô Ngọc ghi nhận con mệt cuối buổi tối.",
                           "Gọi phụ huynh trao đổi giờ ngủ; tạm giảm phần ở nhà còn 25 phút trong một tuần; theo dõi lại sau Thực chiến tuần 7.", True))
    if h["ma"] == "MAU-01":
        coach_rows.append((uid(hid, "coach", 2), hid, dt.date(2027, 1, 10), "Sau Mốc 1: con mất điểm Toán chủ yếu vì tính sai, không phải vì chưa hiểu.",
                           "Tập thói quen soát bài ba phút cuối; mỗi bài Toán ghi một dòng “Con kiểm tra lại bằng cách…”.", True))
        coach_rows.append((uid(hid, "coach", 3), hid, dt.date(2027, 1, 22), "Câu đọc biểu đồ Khoa học còn sai nhiều.",
                           "Cô Nguyên soạn 3 câu đọc biểu đồ trong phiếu bổ trợ tuần 7; phụ huynh nhắc con đọc tên trục trước khi trả lời.", False))

# Báo cáo tuần: tính từ dữ liệu đã sinh
from collections import defaultdict
cau_by_bai = defaultdict(list)
for c in cau_rows: cau_by_bai[c[1]].append(c)
bai_by_hs = defaultdict(list)
for b in bai_rows: bai_by_hs[b[1]].append(b)
for h in HS:
    hid = uid("hs", h["ma"])
    for w in range(1, TUAN_DEN + 1):
        bais = [b for b in bai_by_hs[hid] if b[6] == w]
        nhom = {}
        for b in bais:
            for c in cau_by_bai[b[0]]:
                d = nhom.setdefault(c[3], [0, 0]); d[0] += 1; d[1] += 1 if c[7] else 0
        ty = {k: round(100 * v[1] / v[0]) for k, v in nhom.items() if v[0]}
        tot = sorted(ty.items(), key=lambda x: -x[1])
        loi = defaultdict(int)
        for b in bais:
            for c in cau_by_bai[b[0]]:
                if c[10]: loi[c[10]] += 1
        noi = dict(nhom=ty, manh=tot[0][0] if tot else None, can_luyen=tot[-1][0] if tot else None, loi=dict(loi),
                   loi_nhan="Tuần %d con làm đều tay, mạnh nhất ở %s. Tuần tới con tập trung thêm cho %s." % (w, tot[0][0].lower() if tot else "", tot[-1][0].lower() if tot else ""))
        tt = "da_gui" if w < TUAN_DEN else "nhap"
        mon = dt.date(2026, 12, 14) + dt.timedelta(days=7 * (w - 1))
        bc_rows.append((uid(hid, "bc", w), hid, w, mon, mon + dt.timedelta(days=6), json.dumps(noi, ensure_ascii=False), tt))

def ins(table, cols, rows, n=200):
    for i in range(0, len(rows), n):
        vals = ",\n".join("(" + ",".join(q(v.isoformat() if isinstance(v, dt.date) else v) for v in r) + ")" for r in rows[i:i + n])
        sql.append("insert into public.%s (%s) values\n%s;" % (table, ",".join(cols), vals))
ins("bai_lam", ["id", "hoc_sinh_id", "loai", "ma_bai", "ten_bai", "ngay", "tuan", "do_tin_cay", "diem", "diem_toi_da", "thoi_gian_phut"], bai_rows)
ins("cau_tra_loi", ["id", "bai_lam_id", "ma_cau", "nhom_mon", "ma_chu_de", "ma_ky_nang", "bloom", "dung", "diem", "diem_toi_da", "loai_loi", "giay"], cau_rows)
ins("cham_tay", ["id", "bai_lam_id", "ma_cau", "tieu_chi", "muc", "diem", "diem_toi_da", "nhan_xet", "diem_hong", "nguoi_cham"], cham_rows)
ins("chuyen_can", ["id", "hoc_sinh_id", "ngay", "buoi", "co_mat", "tuong_tac", "ghi_chu"], cc_rows)
ins("ghi_chu_coach", ["id", "hoc_sinh_id", "ngay", "van_de", "ke_hoach", "chia_se_phu_huynh"], coach_rows)
bc_sql = []
for r in bc_rows:
    bc_sql.append("(%s,%s,%d,%s,%s,%s::jsonb,%s)" % (q(r[0]), q(r[1]), r[2], q(r[3].isoformat()), q(r[4].isoformat()), q(r[5]), q(r[6])))
sql.append("insert into public.bao_cao_tuan (id, hoc_sinh_id, tuan, tu_ngay, den_ngay, noi_dung, trang_thai) values\n" + ",\n".join(bc_sql) + ";")
sql.append("commit;")
(RA / "02_hoc_sinh_mau.sql").write_text("\n".join(sql), encoding="utf-8")
print("hoc sinh", len(HS), "bai", len(bai_rows), "cau", len(cau_rows), "cham tay", len(cham_rows), "chuyen can", len(cc_rows), "coach", len(coach_rows), "bao cao", len(bc_rows))
for h in HS: print(h["ma"], [round(x[1] * 100) for x in h["_tc"]])
