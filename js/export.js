/*
 * export.js — Lưu PNG, quay video, lưu/mở preset JSON.
 */
window.CL = window.CL || {};

CL.exporter = (() => {
  'use strict';

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Đổi data URI thành File, làm ĐỒNG BỘ (không await). navigator.share() chỉ được gọi ngay
  // trong cú bấm của người dùng; nếu chờ canvas.toBlob() (bất đồng bộ) thì Safari có thể từ chối.
  function dataUrlToFile(url, name) {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: 'image/png' });
  }

  // Máy cảm ứng có bảng Chia sẻ nhận được file ảnh (iPhone, iPad, Android).
  const touchShare = () => !!(navigator.canShare && navigator.share &&
    window.matchMedia && matchMedia('(pointer: coarse)').matches);

  // PNG: renderNoFilter() vẽ lại khung hiện tại KHÔNG lọc chống moiré, rồi lấy nội dung canvas.
  //  - Máy tính: tải file về như thường.
  //  - Điện thoại: <a download> trên iPhone chỉ cất vào app Tệp, khó tìm. Nên mở bảng Chia sẻ,
  //    ở đó có "Lưu hình ảnh" để cất thẳng vào app Ảnh. Người dùng bấm Huỷ thì thôi, không báo lỗi.
  function png(canvas, renderNoFilter, toast) {
    renderNoFilter();
    const name = `contour-lines-${stamp()}.png`;
    if (touchShare()) {
      const file = dataUrlToFile(canvas.toDataURL('image/png'), name);
      if (navigator.canShare({ files: [file] })) {
        toast(CL.t('Chọn "Lưu hình ảnh" để cất vào app Ảnh.'));
        navigator.share({ files: [file] }).catch((err) => {
          if (err && err.name === 'AbortError') return;      // người dùng đóng bảng Chia sẻ
          download(file, name);                              // trình duyệt từ chối chia sẻ: tải về như cũ
          toast(CL.t('Đã lưu PNG.'));
        });
        return;
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return toast(CL.t('Không tạo được PNG.'), true);
      download(blob, `contour-lines-${stamp()}.png`);
      toast(CL.t('Đã lưu PNG.'));
    }, 'image/png');
  }

  // Danh sách định dạng video theo thứ tự ưu tiên: Safari chuộng MP4, còn lại chuộng WebM.
  function videoTypes() {
    if (!window.MediaRecorder) return [];
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mp4 = ['video/mp4;codecs=avc1', 'video/mp4'];
    return (isSafari ? mp4.concat(webm) : webm.concat(mp4)).filter((t) => MediaRecorder.isTypeSupported(t));
  }

  let current = null; // MediaRecorder đang quay

  /*
   * Quay video từ canvas.
   *  seconds : độ dài
   *  onStart : gọi khi bắt đầu mỗi lần quay (main.js tua thời gian về 0, tắt lọc)
   *  onEnd   : gọi khi kết thúc (thành công hay thất bại)
   * captureStream(30) chỉ lấy khung khi canvas thay đổi, nên main.js vẽ lại mỗi requestAnimationFrame.
   * Nếu file ra 0 byte (lỗi codec), thử lại với định dạng kế tiếp.
   */
  function video({ canvas, seconds, onStart, onEnd, toast }) {
    const types = videoTypes();
    if (!types.length || !canvas.captureStream) {
      toast(CL.t('Trình duyệt này không hỗ trợ quay video từ canvas. Hãy thử Chrome, Edge, Firefox hoặc Safari bản mới.'), true);
      onEnd();
      return;
    }
    const stream = canvas.captureStream(30);

    function attempt(i) {
      const type = types[i];
      let rec;
      try {
        rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
      } catch (err) {
        if (i + 1 < types.length) return attempt(i + 1);
        toast(CL.t('Không khởi tạo được bộ quay video: %1', err.message), true);
        return onEnd();
      }
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        current = null;
        const blob = new Blob(chunks, { type: type.split(';')[0] });
        if (blob.size > 0) {
          download(blob, `contour-lines-${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
          toast(CL.t('Đã lưu video (%1 MB, %2).', (blob.size / 1e6).toFixed(1), type.split(';')[0]));
          onEnd();
        } else if (i + 1 < types.length) {
          toast(CL.t('File %1 bị rỗng, đang quay lại với %2…', type, types[i + 1]), true);
          attempt(i + 1);
        } else {
          toast(CL.t('Quay video thất bại: mọi định dạng đều cho file rỗng.'), true);
          onEnd();
        }
      };
      onStart();
      current = rec;
      rec.start(250);
      setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, seconds * 1000 + 100);
    }
    attempt(0);
  }

  function stop() {
    if (current && current.state === 'recording') current.stop();
  }

  // Preset JSON: { app, version, state }
  const APP = 'contour-lines-lab';
  function savePreset(state) {
    const blob = new Blob([JSON.stringify({ app: APP, version: 1, state }, null, 2)], { type: 'application/json' });
    download(blob, `contour-lines-preset-${stamp()}.json`);
  }

  // Đọc file preset → { state, rejected } đã làm sạch (chỉ nhận khoá hợp lệ, đúng kiểu).
  function readPreset(file) {
    return file.text().then((text) => {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || !data.state) throw new Error(CL.t('thiếu trường "state"'));
      if (data.app && data.app !== APP) throw new Error(CL.t('file của ứng dụng khác ("%1")', data.app));
      return CL.presets.sanitize(data.state);
    });
  }

  return { png, video, stop, savePreset, readPreset, download };
})();
