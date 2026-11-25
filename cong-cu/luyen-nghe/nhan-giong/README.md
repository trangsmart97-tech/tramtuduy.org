# Nhận giọng trên máy để lấy mốc giây bài nghe

Dùng bộ nhận giọng của macOS ngay trên máy (không gửi âm thanh đi đâu). Lần chạy đầu macOS hỏi quyền “Nhận dạng giọng nói”; cô Trang đã cho phép ngày 25/11/2026.

```bash
mkdir -p NgheMoc.app/Contents/MacOS
swiftc -O nghe.swift -o NgheMoc.app/Contents/MacOS/NgheMoc
# Info.plist cần CFBundleIdentifier, CFBundleExecutable=NgheMoc, NSSpeechRecognitionUsageDescription
codesign -s - --force NgheMoc.app
open -n NgheMoc.app --args <thư mục chứa các tệp .wav 16 kHz một kênh>
```

Mỗi tệp `.wav` cho ra tệp `.tsv` cùng tên (giây bắt đầu, giây kết thúc, từ); xong thì có `trang-thai.txt` ghi `XONG n`.
