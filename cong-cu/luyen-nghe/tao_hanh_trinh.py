# Dựng bai/hanh-trinh.json cho trang luyennghe từ KHUNG CHƯƠNG TRÌNH 18 TUẦN v2.xlsx
# (trang “Nghe và xã hội”, “Lịch từng ngày”, “Lịch nghe hằng ngày”) và danh mục XH01–XH18 của seed.
#   python3 tao_hanh_trinh.py "<tệp khung .xlsx>" "<seed 01_danh_muc.sql>" "<kho luyennghe>"
import re, html, sys, json, zipfile
khung, seed, kho = sys.argv[1:4]
z = zipfile.ZipFile(khung)
ten_trang = dict(re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="rId(\d+)"', z.read('xl/workbook.xml').decode()))
def trang(ten):
    x = z.read(f'xl/worksheets/sheet{ten_trang[ten]}.xml').decode()
    for row in re.findall(r'<row[^>]*>(.*?)</row>', x, re.S):
        o = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', c, re.S)) or ''.join(re.findall(r'<v>(.*?)</v>', c)))
             for c in re.findall(r'<c [^>]*?(?:/>|>.*?</c>)', row, re.S)]
        yield [c for c in o]
ban = lambda s: re.sub(r'\bcon\b', 'bạn', re.sub(r'\bCon\b', 'Bạn', s))

ngay = {}
for r in trang('Lịch từng ngày'):
    m = re.match(r'\S+(?: \S+)? (\d\d/\d\d/\d{4})$', r[0] or '')
    if m and len(r) > 1 and (t := re.match(r'Tuần (\d+)', r[1] or '')):
        ngay.setdefault(int(t.group(1)), []).append(m.group(1))
xh = {int(t): (ma, ten) for ma, ten, t in re.findall(r"values \('(XH\d\d)','([^']*)','[^']*',(\d+),", open(seed).read())}
moc = {4: ('Mốc 1', '09/01/2027'), 7: ('Mốc 2', '30/01/2027'), 11: ('Mốc 3', '13/03/2027'), 15: ('Mốc 4', '10/04/2027'), 18: ('Mốc 5', '01/05/2027')}
GIONG = {'Mỹ': 'Mỹ', 'Anh': 'Anh', 'Úc': 'Úc'}
tuan = []
for r in trang('Nghe và xã hội'):
    r = [c for c in r if c != '']
    if not r or not r[0].isdigit(): continue
    n = int(r[0]); bac, tang, dai, ma_giong, chu_de, _xh = r[1:7]
    giong = re.findall(r'giọng (\w+)', ma_giong)
    cd = [c.strip() for c in chu_de.split(';')]
    tuan.append({'tuan': n, 'tu': ngay[n][0], 'den': ngay[n][-1], 'bac': bac, 'tang': tang, 'doDai': dai,
        'bai': [{'ma': f'tuan-{n:02d}-bai-{i + 1}', 'chuDe': cd[i], 'giong': giong[i]} for i in range(2)],
        'xh': {'ma': xh[n][0], 'ten': xh[n][1]}, 'moc': ({'ten': moc[n][0], 'ngay': moc[n][1]} if n in moc else None),
        'nghiTetSau': n == 7})
lich = []
for r in trang('Lịch nghe hằng ngày'):
    r = [c for c in r if c != '']
    if len(r) == 6 and r[0].startswith('Thứ ') or (r and r[0] == 'Chủ nhật'):
        lich.append({'thu': r[0], 'sang': r[1], 'viecSang': ban(r[2]), 'toi': r[3], 'viecToi': ban(r[4]), 'ghi': ban(r[5])})
assert len(tuan) == 18 and len(lich) == 7, (len(tuan), len(lich))
out = {'nguon': 'KHUNG CHƯƠNG TRÌNH 18 TUẦN v2 (QĐ-001), trang “Nghe và xã hội”, “Lịch nghe hằng ngày”', 'nghiTet': '01/02 đến 12/02/2027',
       'tuan': tuan, 'lichNgay': lich}
json.dump(out, open(f'{kho}/bai/hanh-trinh.json', 'w'), ensure_ascii=False, indent=1)
print('Đã viết', f'{kho}/bai/hanh-trinh.json', len(tuan), 'tuần,', len(lich), 'ngày')
