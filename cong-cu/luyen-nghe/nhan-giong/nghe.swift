import Foundation
import Speech
// Nhận giọng ngay trên máy cho mọi tệp .wav trong thư mục "vao", ghi từng từ kèm giây ra tệp .tsv cùng tên.
let thuMuc = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/private/tmp/claude-501/asr/vao"
let tep = ((try? FileManager.default.contentsOfDirectory(atPath: thuMuc)) ?? []).filter { $0.hasSuffix(".wav") }.sorted()
let xong = DispatchSemaphore(value: 0)
SFSpeechRecognizer.requestAuthorization { st in
  let bao = thuMuc + "/trang-thai.txt"
  guard st == .authorized else { try? "CHUA_DUOC_PHEP \(st.rawValue)".write(toFile: bao, atomically: true, encoding: .utf8); xong.signal(); return }
  let r = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
  r.queue = OperationQueue()  // kết quả trả về luồng phụ, luồng chính đang chờ
  for t in tep {
    let s = DispatchSemaphore(value: 0)
    let q = SFSpeechURLRecognitionRequest(url: URL(fileURLWithPath: thuMuc + "/" + t))
    q.requiresOnDeviceRecognition = r.supportsOnDeviceRecognition
    q.shouldReportPartialResults = false
    q.addsPunctuation = true
    var dong = ""
    r.recognitionTask(with: q) { kq, loi in
      if let loi = loi { dong = "LOI \(loi.localizedDescription)\n"; s.signal(); return }
      guard let kq = kq else { return }
      // Bản ghi dài: máy chốt từng đoạn nói (có speechRecognitionMetadata); gom tất cả các đoạn đã chốt.
      if kq.speechRecognitionMetadata != nil || kq.isFinal {
        for g in kq.bestTranscription.segments { dong += String(format: "%.2f\t%.2f\t%@\n", g.timestamp, g.timestamp + g.duration, g.substring) }
      }
      if kq.isFinal { s.signal() }
    }
    s.wait()
    try? dong.write(toFile: thuMuc + "/" + t.replacingOccurrences(of: ".wav", with: ".tsv"), atomically: true, encoding: .utf8)
  }
  try? "XONG \(tep.count)".write(toFile: bao, atomically: true, encoding: .utf8)
  xong.signal()
}
xong.wait()
