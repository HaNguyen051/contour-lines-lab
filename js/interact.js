/*
 * interact.js — Con trỏ (chuột, bút, cảm ứng) điều khiển Elastic Grid (grid.js).
 *
 *  - Nhấn rồi kéo: điểm ảnh dưới ngón tay đi theo tay, hàng và cột trên cả khung co giãn theo.
 *  - Thả: lưới nảy về rồi đứng yên; 1.5 giây sau tự chạy tiếp.
 *  - Chạm nhanh (nhả trong 250 ms, di chuyển dưới 6 px): phía có điểm chạm to ra.
 * Chỉ theo con trỏ đầu tiên; ngón thứ hai bị bỏ qua.
 */
window.CL = window.CL || {};

CL.createInteract = function ({ canvas, getSize, getParams, grid }) {
  let active = null;   // { id, downT, downX, downY, sx0, sy0, moved }

  // Toạ độ màn hình → toạ độ khung 0..1 (X trái → phải, Y trên → dưới),
  // có trừ phần viền trống của object-fit: contain.
  function toUnit(e) {
    const r = canvas.getBoundingClientRect();
    const { W, H } = getSize();
    const scale = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * scale) / 2;
    const oy = (r.height - H * scale) / 2;
    const sx = (e.clientX - r.left - ox) / (W * scale);
    const sy = (e.clientY - r.top - oy) / (H * scale);
    return { sx, sy, inside: sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1 };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!getParams().enabled || active) return;
    const p = toUnit(e);
    if (!p.inside) return;                         // bỏ qua điểm nhấn ngoài vùng ảnh
    active = { id: e.pointerId, downT: performance.now(), downX: e.clientX, downY: e.clientY, sx0: p.sx, sy0: p.sy, moved: false };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
    grid.grab(p.sx, p.sy);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== active.id) return;
    if (Math.hypot(e.clientX - active.downX, e.clientY - active.downY) > 6) active.moved = true;
    const p = toUnit(e);
    grid.move(p.sx, p.sy);
  });

  function end(e) {
    if (!active || e.pointerId !== active.id) return;
    const isTap = e.type === 'pointerup' && performance.now() - active.downT < 250 && !active.moved;
    if (isTap) grid.tap(active.sx0, active.sy0);
    else grid.release();
    active = null;
    canvas.classList.remove('grabbing');
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return { isActive: () => !!active };
};
