/*
 * interact.js — Con trỏ (chuột, bút, cảm ứng) điều khiển Elastic Grid (grid.js).
 *
 * File này CHỈ ghi lại chỗ con trỏ, không tính toán gì. Mọi thứ còn lại — chọn tâm vòm,
 * nạp biên độ, cho biên độ tiêu dần về phẳng — nằm trong stepCursor() của grid.js và
 * chạy mỗi khung hình một lần.
 *
 * Đây là cách effect.app nhận chuột: nghe mousemove trên document, lấy clientX/clientY
 * THÔ (không làm mượt, không quán tính ở tầng JS), rồi giao cho shader tự xử lý.
 *
 *  - Rê chuột qua ảnh, KHÔNG cần bấm: vùng quanh con trỏ bị hút dồn về phía con trỏ.
 *  - Ngừng rê, hoặc đưa chuột ra ngoài: ảnh từ từ trở về phẳng.
 * Bấm chuột không có tác dụng riêng; kéo thả ảnh vào trang vẫn do main.js lo.
 *
 * Điện thoại / máy tính bảng không có "rê": ngón tay chỉ tồn tại khi đang chạm. Nên:
 *  - Đặt ngón tay lên ẢNH rồi vuốt = rê chuột. Chỉ theo ngón đầu tiên.
 *  - Nhấc tay = đưa chuột ra ngoài: ảnh từ từ về phẳng.
 *  - Lần chạm sau bắt đầu lại từ chỗ ngón tay mới đặt xuống, không bị tính như một cú
 *    rê dài từ chỗ nhấc tay lần trước (sẽ làm ảnh giật mạnh).
 *  - Ngón tay bắt đầu ở chỗ khác (thanh trượt, nút) thì bỏ qua, để kéo thanh trượt trong
 *    bảng Tuỳ chỉnh không làm ảnh biến dạng theo.
 */
window.CL = window.CL || {};

CL.createInteract = function ({ canvas, getSize, getParams, grid }) {
  // getBoundingClientRect() tốn một lượt layout, mà pointermove bắn rất dày; nên nhớ lại
  // kết quả và chỉ bỏ đi khi khung thật sự đổi chỗ hoặc đổi cỡ.
  let rect = null;
  const dropRect = () => { rect = null; };
  window.addEventListener('resize', dropRect);
  window.addEventListener('scroll', dropRect, true);
  if (window.ResizeObserver) new ResizeObserver(dropRect).observe(canvas);

  // Toạ độ màn hình → toạ độ khung 0..1 (X trái → phải, Y trên → dưới),
  // có trừ phần viền trống của object-fit: contain.
  function toUnit(e) {
    if (!rect) rect = canvas.getBoundingClientRect();
    const r = rect;
    const { W, H } = getSize();
    const scale = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * scale) / 2;
    const oy = (r.height - H * scale) / 2;
    return {
      sx: (e.clientX - r.left - ox) / (W * scale),
      sy: (e.clientY - r.top - oy) / (H * scale),
    };
  }

  // Nghe trên window để con trỏ đi sát mép, hoặc lướt qua thanh công cụ, vẫn còn tác dụng.
  // Ra ngoài khung quá ngần này phần thì thôi, để chuột ở góc màn hình không kéo ảnh.
  const MARGIN = 0.15;

  const outside = (p, m) => p.sx < -m || p.sx > 1 + m || p.sy < -m || p.sy > 1 + m;

  // ---------- Ngón tay (và bút cảm ứng) ----------
  let touchId = null;   // pointerId của ngón đang điều khiển; null = không có ngón nào

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || touchId !== null || !getParams().enabled) return;
    const p = toUnit(e);
    if (outside(p, 0)) return;                      // chạm vào viền trống quanh ảnh: bỏ qua
    touchId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* không quan trọng */ }
    grid.pointerOut();                              // quên chỗ nhấc tay lần trước…
    grid.pointer(p.sx, p.sy);                       // …và bắt đầu lại đúng chỗ ngón tay đặt xuống
  });

  function touchEnd(e) {
    if (e.pointerId !== touchId) return;
    touchId = null;
    grid.pointerOut();                              // nhấc tay: năng lượng còn lại tự tiêu, ảnh về phẳng
  }
  window.addEventListener('pointerup', touchEnd);
  window.addEventListener('pointercancel', touchEnd);

  // ---------- Chuột (rê, không cần bấm) + ngón tay đang vuốt ----------
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') {
      // Chỉ nhận ngón tay đã đặt xuống trên ảnh. Kéo ra ngoài khung vẫn theo (grid tự kẹp 0..1).
      if (e.pointerId !== touchId) return;
      if (!getParams().enabled) { grid.pointerOut(); return; }
      const p = toUnit(e);
      grid.pointer(p.sx, p.sy);
      return;
    }
    if (!getParams().enabled) { grid.pointerOut(); return; }
    const p = toUnit(e);
    if (outside(p, MARGIN)) {
      grid.pointerOut();
      return;
    }
    grid.pointer(p.sx, p.sy);
  }, { passive: true });

  // Chuột rời cửa sổ hoặc đổi tab: ngừng nạp, ảnh tự về phẳng.
  document.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') grid.pointerOut(); });
  window.addEventListener('blur', () => { touchId = null; grid.pointerOut(); });

  return { isActive: () => touchId !== null };
};
