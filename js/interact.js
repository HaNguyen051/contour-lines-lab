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
 *  - Rê chuột qua ảnh, KHÔNG cần bấm: nửa khung có con trỏ giãn ra, nửa kia dồn lại.
 *  - Ngừng rê, hoặc đưa chuột ra ngoài: ảnh từ từ trở về phẳng.
 * Bấm chuột không có tác dụng riêng; kéo thả ảnh vào trang vẫn do main.js lo.
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

  window.addEventListener('pointermove', (e) => {
    if (!getParams().enabled) { grid.pointerOut(); return; }
    const p = toUnit(e);
    if (p.sx < -MARGIN || p.sx > 1 + MARGIN || p.sy < -MARGIN || p.sy > 1 + MARGIN) {
      grid.pointerOut();
      return;
    }
    grid.pointer(p.sx, p.sy);
  }, { passive: true });

  // Chuột rời cửa sổ hoặc đổi tab: ngừng nạp, ảnh tự về phẳng.
  document.addEventListener('pointerleave', () => grid.pointerOut());
  window.addEventListener('blur', () => grid.pointerOut());

  return { isActive: () => false };
};
