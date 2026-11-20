"""Tách biểu tượng logo bản 3 (QĐ-024) thành các lớp cho trang chủ. KHÔNG đồ lại nét.

Vào: THUONG HIEU/bieu-tuong-tram-tu-duy.png (nền trong suốt) và bản -nen-trang (để nhận màu mực).
Cách tách:
  1. Điểm "đặc" (độ đục >= 200) nhận màu mực gần nhất trong ba màu A: tím #2B1C47, nâu đất #6E4422, cát đậm #9A6435.
  2. Điểm mép (khử răng cưa) nhận màu của điểm đặc gần nhất, nên mép giữ nguyên độ mịn của ảnh gốc.
  3. Mảng cát lẻ nhỏ (đốm do màu ảnh gốc dao động) gộp vào nâu đất.
  4. Nâu đất chia hai: rễ là các mảng nâu (từ hàng 1105 trở xuống) nối xuống vùng rễ; còn lại là bìa sách.
Mỗi lớp chép nguyên điểm ảnh của bộ logo đã chốt (QĐ-026); xếp chồng các lớp ra đúng ảnh gốc.
Ra (web/public/hinh/, cạnh CANH điểm ảnh): lop-bia.png (sách: trang và bìa), lop-re.png, lop-tim.png,
  lop-bong.png (bóng trắng của cả cây: mặt nạ cho lớp vàng của cảnh ong),
và web/public/bieu-tuong-160.png cho đầu trang. In ra các mốc phần trăm cho CSS và cảnh ong.
Chạy: python3 cong-cu/tach_lop_logo.py
"""
from pathlib import Path
import numpy as np, cv2
from PIL import Image

GOC = Path(__file__).resolve().parents[1]
TH = GOC.parent / "THUONG HIEU"
RA = GOC / "web/public/hinh"
CANH = 1024

T = np.array(Image.open(TH / "bieu-tuong-tram-tu-duy.png").convert("RGBA"))
NT = np.array(Image.open(TH / "bieu-tuong-tram-tu-duy-nen-trang.png").convert("RGB")).astype(float)
H, W = T.shape[:2]
a = T[..., 3].astype(int)
MAU = np.array([(43, 28, 71), (110, 68, 34), (154, 100, 53)], float)   # tím, nâu đất, cát đậm
dac = a >= 200
gan = ((NT[..., None, :] - MAU[None, None]) ** 2).sum(-1).argmin(-1)
XA, nhan = cv2.distanceTransformWithLabels(np.where(dac, 0, 255).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
ys, xs = np.where(dac)
lop_cua = np.full(nhan.max() + 1, -1); lop_cua[nhan[ys, xs]] = gan[ys, xs]
lop = np.where(a > 0, lop_cua[nhan], -1)

# Đốm cát lẻ trên dải bìa (màu ảnh gốc dao động): mảng cát nhỏ hơn NHO điểm ảnh gộp vào nâu đất.
NHO = 600
n_c, mang_c, tk_c, _ = cv2.connectedComponentsWithStats((lop == 2).astype(np.uint8), connectivity=8)
lop = np.where((lop == 2) & (tk_c[mang_c, cv2.CC_STAT_AREA] < NHO), 1, lop)
# Nâu đất và cát đậm lẫn đốm vào nhau (ảnh nguồn lốm đốm): mỗi điểm nâu theo màu chiếm đa số trong ô 15 x 15 quanh nó.
nau = (lop == 1) | (lop == 2)
ti_cat = cv2.blur((lop == 2).astype(np.float32), (15, 15)) / np.maximum(cv2.blur(nau.astype(np.float32), (15, 15)), 1e-6)
lop = np.where(nau, np.where(ti_cat > 0.5, 2, 1), lop)
Y_CAT = 1105
hang = np.arange(H)[:, None]
lop = np.where((lop == 2) & (hang >= Y_CAT), 1, lop)          # vài điểm sáng trong rễ: thuộc rễ
nau_duoi = ((lop == 1) & (hang >= Y_CAT)).astype(np.uint8)
n, mang, tk, _ = cv2.connectedComponentsWithStats(nau_duoi, connectivity=8)
day_mang = tk[:, cv2.CC_STAT_TOP] + tk[:, cv2.CC_STAT_HEIGHT]
la_re = np.zeros(n, bool); la_re[1:] = day_mang[1:] > 1180      # mảng nào chạm vùng rễ là rễ
re = la_re[mang] & (nau_duoi > 0)
bia = (lop == 1) & ~re

# Bộ logo đã chốt (QĐ-026) tự đã tô sạch màu và phủ kín lòng nét: chép nguyên điểm ảnh, KHÔNG làm sạch thêm,
# để màu trên web khớp đúng slide và phiếu.
def anh_lop(mat_na):
    im = np.zeros_like(T); im[mat_na] = T[mat_na]
    return im
def luu(mat_na, ten):
    Image.fromarray(anh_lop(mat_na)).resize((CANH, CANH), Image.LANCZOS).save(RA / ten, optimize=True)
# Lớp rễ chồng lên bìa 6 hàng ngay trên đường cắt (cùng điểm ảnh nên không lộ), để chỗ nối không có vạch sáng.
noi = bia & (hang >= Y_CAT - 6)
# Trang vở (cát) và bìa (nâu đất) chung một lớp sách: bộ chốt tô nâu chuyển mịn liền nét, tách hai lớp sẽ lộ vạch ở chỗ giáp.
luu((lop == 2) | bia, "lop-bia.png"); luu(re | noi, "lop-re.png"); luu(lop == 0, "lop-tim.png")
# Cả cây (não, thân, trang sách, bìa, rễ) đều hoá vàng khi mật dâng.
bong = anh_lop(lop >= 0); bong[..., :3] = np.where(bong[..., 3:] > 0, 255, 0)
Image.fromarray(bong).resize((CANH, CANH), Image.LANCZOS).save(RA / "lop-bong.png", optimize=True)
# Biểu tượng: đầu trang thu nhỏ từ biểu tượng gốc; thẻ trình duyệt và 192 chép thẳng tệp của bộ chốt.
Image.open(TH / "bieu-tuong-tram-tu-duy.png").convert("RGBA").resize((160, 160), Image.LANCZOS).save(GOC / "web/public/bieu-tuong-160.png", optimize=True)
import shutil
shutil.copyfile(TH / "bieu-tuong-32.png", GOC / "web/public/favicon.png")
shutil.copyfile(TH / "bieu-tuong-192.png", GOC / "web/public/bieu-tuong-192.png")

def pt(v, tong): return round(100 * v / tong, 2)
yt = np.where((lop == 0) & (a > 120))[0]; yr = np.where(re & (a > 120))[0]; yb = np.where(bia & (a > 120))[0]
print("cao rong", H, W)
print("tim (than, nao): y", yt.min(), yt.max(), "->", pt(yt.min(), H), "%", pt(yt.max(), H), "%")
print("bia sach: y", yb.min(), yb.max(), "->", pt(yb.max(), H), "%")
print("re: y", yr.min(), yr.max(), "->", pt(yr.min(), H), "%", pt(yr.max(), H), "%")
kiem = np.zeros_like(T)
for mm in (lop == 2, bia, re, lop == 0):
    kiem[mm] = T[mm]
print("xep chong lai = anh goc (moi diem co hinh):", bool((kiem[a > 0] == T[a > 0]).all()), "| diem chua vao lop nao:", int(((a > 0) & (lop < 0)).sum()))
