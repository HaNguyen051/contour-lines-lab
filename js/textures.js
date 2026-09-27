/*
 * textures.js — Mọi ảnh dùng sẵn đều SINH BẰNG CODE (Canvas 2D), không có file ảnh ngoài:
 *   1. Atlas ký tự ASCII 512×512 (8×8 ô, mỗi ô 64 px).
 *   2. 12 hoa văn MacPaint 1-bit 8×8.
 *   3. Ảnh mẫu: cành gai đen trên nền xám, tỉ lệ 3:4.
 *
 * Lý do không dùng file ảnh: khi mở index.html bằng nhấp đúp (file://), trình duyệt cấm
 * WebGL đọc file ảnh nằm cạnh trang. Ảnh sinh bằng code thì không bị chặn.
 */
window.CL = window.CL || {};

CL.textures = (() => {
  'use strict';

  // Bộ sinh số ngẫu nhiên có hạt giống: cùng seed → cùng dãy số → cùng ảnh.
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Atlas ký tự
  // Ký tự xếp theo đúng thứ tự trong bộ ký tự (ramp): ký tự đầu = nhạt nhất, cuối = đậm nhất.
  // Tối đa 64 ký tự (8×8 ô). Ký tự lặp bị bỏ.
  // ---------------------------------------------------------------------------
  const ATLAS = 512;
  const CELL = 64;
  const MAX_GLYPHS = 64;

  function glyphAtlas(ramp) {
    let chars = Array.from(new Set(Array.from(ramp || '')));
    const truncated = chars.length > MAX_GLYPHS;
    chars = chars.slice(0, MAX_GLYPHS);
    if (!chars.length) chars = ['#'];

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ATLAS;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ATLAS, ATLAS);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 58px ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chars.forEach((ch, i) => {
      const x = (i % 8) * CELL;
      const y = Math.floor(i / 8) * CELL;
      // Ký tự khối vẽ bằng hình chữ nhật để không phụ thuộc font (nhiều font thiếu các ký tự này).
      if (ch === '█') ctx.fillRect(x, y, CELL, CELL);
      else if (ch === '▌') ctx.fillRect(x, y, CELL / 2, CELL);
      else if (ch === '▮') ctx.fillRect(x + 18, y + 6, 28, 52);
      else if (ch === '░' || ch === '▒' || ch === '▓') {
        // Chấm 4 px, bật 25% / 50% / 75% theo lưới đều.
        for (let j = 0; j < CELL / 4; j++) {
          for (let k = 0; k < CELL / 4; k++) {
            const on = ch === '░' ? j % 2 === 0 && k % 2 === 0
                     : ch === '▒' ? (j + k) % 2 === 0
                     : !(j % 2 === 1 && k % 2 === 1);
            if (on) ctx.fillRect(x + k * 4, y + j * 4, 4, 4);
          }
        }
      } else ctx.fillText(ch, x + CELL / 2, y + CELL / 2 + 3);
    });

    return { canvas, count: chars.length, chars: chars.join(''), truncated };
  }

  // ---------------------------------------------------------------------------
  // 2. Hoa văn MacPaint: 8 byte = 8 hàng, bit 1 = điểm mực. Ví dụ AA = 10101010.
  // ---------------------------------------------------------------------------
  const PATTERNS = [
    ['Chấm thưa',     [0x80, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00]],
    ['Chấm lưới',     [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00]],
    ['Sọc chéo mảnh', [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]],
    ['Lưới 25%',      [0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22]],
    ['Sọc ngang',     [0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00]],
    ['Đan chéo',      [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81]],
    ['Gạch',          [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08]],
    ['Bàn cờ 50%',    [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55]],
    ['Sọc chéo dày',  [0x0f, 0x1e, 0x3c, 0x78, 0xf0, 0xe1, 0xc3, 0x87]],
    ['Dày 75%',       [0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd]],
    ['Gần đặc',       [0xff, 0xdd, 0xff, 0x77, 0xff, 0xdd, 0xff, 0x77]],
    ['Đặc',           [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]],
  ];

  // Dải 96×8 px: hoa văn thứ n chiếm cột 8n..8n+7.
  function patternAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = 8 * PATTERNS.length;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, 8);
    PATTERNS.forEach(([, rows], n) => {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const on = (rows[y] >> (7 - x)) & 1;
          const i = (y * canvas.width + n * 8 + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 255 : 0;
          img.data[i + 3] = 255;
        }
      }
    });
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // ---------------------------------------------------------------------------
  // 3. Ảnh mẫu: cành gai, tỉ lệ 3:4 (1200×1600).
  //  - Nền gradient #e8e8e5 → #cdcdc9.
  //  - 3–5 cành #121212 to, dày 70–120 px, lượn dài qua khung, thon dần 55%, ngọn thon thành gai, có rẽ nhánh.
  //  - Gai dài 1.6–3.8 lần độ dày cành, chân rộng LOE RA liền mạch với thân (cạnh cong Bézier),
  //    mọc theo đốt cách nhau 130–280 px, mỗi đốt 1–3 gai.
  //  - Vệt sáng mờ ở mép cành + hạt nhiễu, để bước Threshold có chuyển độ sáng thật như ảnh chụp.
  // ---------------------------------------------------------------------------
  function sampleImage(seed = 1) {
    const W = 1200;
    const H = 1600;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const rnd = mulberry32(seed * 7919 + 13);

    const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
    bg.addColorStop(0, '#e8e8e5');
    bg.addColorStop(1, '#cdcdc9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const shapes = [];  // mọi hình (Path2D) của cành và gai
    const spines = [];  // xương sống từng cành, dùng để vẽ vệt sáng

    // Điểm trên đường cong Bézier bậc 3 kèm tiếp tuyến (tx, ty) và pháp tuyến (nx, ny).
    function bezier(p, t) {
      const u = 1 - t;
      const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
      const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
      const dx = 3 * u * u * (p[2] - p[0]) + 6 * u * t * (p[4] - p[2]) + 3 * t * t * (p[6] - p[4]);
      const dy = 3 * u * u * (p[3] - p[1]) + 6 * u * t * (p[5] - p[3]) + 3 * t * t * (p[7] - p[5]);
      const len = Math.hypot(dx, dy) || 1;
      return { x, y, tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len };
    }

    // Một cành từ (x0,y0) theo hướng angle, dài length, dày w0, còn rẽ được depth cấp.
    function branch(x0, y0, angle, length, w0, depth) {
      // Đường cong lượn dài: 2 điểm điều khiển lệch hẳn sang hai bên.
      const bend1 = (rnd() - 0.5) * length * 0.6;
      const bend2 = (rnd() - 0.5) * length * 0.6;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const p = [
        x0, y0,
        x0 + ca * length * 0.33 - sa * bend1, y0 + sa * length * 0.33 + ca * bend1,
        x0 + ca * length * 0.66 - sa * bend2, y0 + sa * length * 0.66 + ca * bend2,
        x0 + ca * length, y0 + sa * length,
      ];

      const N = 200;
      const samples = [];
      let arc = 0;
      for (let i = 0; i <= N; i++) {
        const s = bezier(p, i / N);
        if (i > 0) arc += Math.hypot(s.x - samples[i - 1].x, s.y - samples[i - 1].y);
        s.arc = arc;
        s.w = w0 * (1 - 0.55 * (i / N));      // thon dần 55%, ngọn còn to để thon tiếp thành gai
        samples.push(s);
      }

      // Thân: mép trái đi xuôi, mép phải đi ngược.
      const body = new Path2D();
      samples.forEach((s, i) => {
        const x = s.x + s.nx * s.w / 2;
        const y = s.y + s.ny * s.w / 2;
        if (i === 0) body.moveTo(x, y);
        else body.lineTo(x, y);
      });
      for (let i = N; i >= 0; i--) body.lineTo(samples[i].x - samples[i].nx * samples[i].w / 2, samples[i].y - samples[i].ny * samples[i].w / 2);
      body.closePath();
      shapes.push(body);
      spines.push(samples);

      // Ngọn cành thon lại thành một cái gai dài, chĩa theo hướng cành.
      const tip = samples[N];
      spike(tip.x, tip.y, Math.atan2(tip.ty, tip.tx), tip.w * (2.5 + rnd() * 2), tip.w / 2, tip.nx, tip.ny, tip.w / 2, 1);

      // Gai: mọc theo từng "đốt" cách nhau 130–280 px. Mỗi đốt 1 gai, đôi khi 2–3 gai toả ra.
      let next = 60 + rnd() * 120;
      let side = rnd() < 0.5 ? 1 : -1;
      for (const s of samples) {
        if (s.arc < next || s.arc > arc - s.w) continue;
        const r = rnd();
        const count = r < 0.55 ? 1 : r < 0.9 ? 2 : 3;
        for (let c = 0; c < count; c++) {
          const sd = c === 1 ? -side : side;                    // gai thứ 2 mọc phía bên kia
          const len = s.w * (1.6 + rnd() * 2.2) + 40;          // dài 1.6–3.8 lần độ dày cành
          thorn(s, sd, len, c === 2 ? 0.9 : 0);                 // gai thứ 3 nghiêng hẳn về ngọn
        }
        side = -side;
        next = s.arc + 130 + rnd() * 150;
      }

      // Rẽ nhánh: nhánh con cũng to, mọc ra như một cái gai khổng lồ có gai riêng.
      if (depth > 0 && rnd() < 0.7) {
        const s = samples[Math.floor(N * (0.3 + rnd() * 0.4))];
        const dir = Math.atan2(s.ty, s.tx) + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5);
        branch(s.x, s.y, dir, length * (0.3 + rnd() * 0.2), s.w * 0.75, depth - 1);
      }
    }

    // Gai mọc từ điểm s của cành, phía side (1 / −1), dài len.
    // lean: nghiêng thêm về phía ngọn (radian).
    function thorn(s, side, len, lean) {
      const out = Math.atan2(s.ny * side, s.nx * side);       // hướng vuông góc ra ngoài cành
      const fwd = Math.atan2(s.ty, s.tx);                     // hướng về ngọn
      let diff = fwd - out;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const dir = out + Math.sign(diff) * (0.15 + rnd() * 0.55 + lean);
      // Chân gai nằm trong thân (0.3 độ dày tính từ trục), rộng gần bằng độ dày cành.
      const bx = s.x + s.nx * side * s.w * 0.3;
      const by = s.y + s.ny * side * s.w * 0.3;
      spike(bx, by, dir, len + s.w * 0.2, s.w * (0.42 + rnd() * 0.12), s.tx, s.ty);
    }

    // Vẽ một cái gai: chân tại (bx, by), chĩa theo hướng dir, dài len, nửa bề rộng chân hb.
    // (tx, ty) = hướng để chân gai "loe" ra (dọc theo cành với gai thường, ngang cành với gai ở ngọn).
    // flare    = nửa bề rộng phần loe (thường gấp đôi hb, để chỗ nối cong mềm như mép thân).
    // follow   = 0: cạnh gai bắt đầu bằng cách chạy dọc thân (gai mọc ngang);
    //            1: cạnh gai bắt đầu bằng cách đi thẳng theo hướng gai (ngọn cành thon thành gai).
    // Mỗi cạnh là đường cong Bézier bậc 3. Điểm điều khiển thứ 2 đặt SÁT trục gai, lệch vuông góc
    // với trục về đúng phía của cạnh đó → cạnh lõm vào, mũi nhọn, và hai cạnh không bao giờ cắt chéo nhau.
    function spike(bx, by, dir, len, hb, tx, ty, flare = hb * 2, follow = 0) {
      const dx = Math.cos(dir);
      const dy = Math.sin(dir);
      const px = -dy;                                          // vuông góc với trục gai
      const py = dx;
      const bend = (rnd() - 0.5) * 0.2;                        // gai hơi cong
      const tipX = bx + dx * len + px * len * bend;
      const tipY = by + dy * len + py * len * bend;
      // Hai điểm loe, xếp sao cho A nằm phía +p của trục, C nằm phía −p.
      let ax = bx - tx * flare, ay = by - ty * flare;
      let cx = bx + tx * flare, cy = by + ty * flare;
      if ((ax - bx) * px + (ay - by) * py < 0) { [ax, cx] = [cx, ax]; [ay, cy] = [cy, ay]; }
      const mx = bx + dx * len * 0.3;                          // điểm trên trục gai, 30% chiều dài
      const my = by + dy * len * 0.3;
      const k1 = 0.75 * (1 - follow);
      const k2 = 0.35 * follow;
      const path = new Path2D();
      path.moveTo(ax, ay);
      path.bezierCurveTo(
        ax + (bx - ax) * k1 + dx * len * k2, ay + (by - ay) * k1 + dy * len * k2,
        mx + px * hb * 0.3, my + py * hb * 0.3,
        tipX, tipY);
      path.bezierCurveTo(
        mx - px * hb * 0.3, my - py * hb * 0.3,
        cx + (bx - cx) * k1 + dx * len * k2, cy + (by - cy) * k1 + dy * len * k2,
        cx, cy);
      path.closePath();
      shapes.push(path);
    }

    // 3–5 cành to mọc từ các mép, lượn dài qua khung.
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const edge = (i + Math.floor(rnd() * 2)) % 4;          // rải đều các mép
      const a = 0.1 + rnd() * 0.8;
      const start = [[a * W, -60], [W + 60, a * H], [a * W, H + 60], [-60, a * H]][edge];
      const tx = W * (0.25 + rnd() * 0.5);
      const ty = H * (0.25 + rnd() * 0.5);
      const angle = Math.atan2(ty - start[1], tx - start[0]);
      const length = Math.hypot(tx - start[0], ty - start[1]) * (1.1 + rnd() * 0.6);
      branch(start[0], start[1], angle, length, 70 + rnd() * 50, 1);
    }

    // --- Chất liệu ---
    // Mặt nạ: tô từng hình riêng (gộp chung một Path2D có thể bị thủng chỗ chồng nhau).
    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#000';
    shapes.forEach((s) => mctx.fill(s));

    // Lớp chất liệu: đen #121212 + vệt sáng mờ phía nguồn sáng (trên trái) + hạt.
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const lctx = layer.getContext('2d');
    lctx.fillStyle = '#121212';
    lctx.fillRect(0, 0, W, H);
    // Vẽ mọi vệt sáng lên canvas phụ KHÔNG blur, rồi blur cả canvas đó đúng 1 lần.
    // (Đặt ctx.filter rồi vẽ từng đoạn thì trình duyệt blur cả ảnh cho MỖI đoạn → rất chậm.)
    const hl = document.createElement('canvas');
    hl.width = W;
    hl.height = H;
    const hctx = hl.getContext('2d');
    hctx.lineCap = 'round';
    hctx.strokeStyle = 'rgba(120,120,120,0.35)';
    for (const samples of spines) {
      for (let i = 0; i < samples.length - 1; i++) {
        const s = samples[i];
        const t = samples[i + 1];
        const up = s.nx * -0.5 + s.ny * -0.85 > 0 ? 1 : -1;
        const off = s.w * 0.22 * up;
        hctx.lineWidth = s.w * 0.22;
        hctx.beginPath();
        hctx.moveTo(s.x + s.nx * off, s.y + s.ny * off);
        hctx.lineTo(t.x + t.nx * off, t.y + t.ny * off);
        hctx.stroke();
      }
    }
    lctx.filter = 'blur(10px)';
    lctx.drawImage(hl, 0, 0);
    lctx.filter = 'none';
    const noise = document.createElement('canvas');
    noise.width = noise.height = 128;
    const nctx = noise.getContext('2d');
    const nimg = nctx.createImageData(128, 128);
    for (let i = 0; i < nimg.data.length; i += 4) {
      nimg.data[i] = nimg.data[i + 1] = nimg.data[i + 2] = rnd() * 255;
      nimg.data[i + 3] = 255;
    }
    nctx.putImageData(nimg, 0, 0);
    lctx.globalCompositeOperation = 'screen';
    lctx.globalAlpha = 0.06;
    lctx.fillStyle = lctx.createPattern(noise, 'repeat');
    lctx.fillRect(0, 0, W, H);
    // Chỉ giữ phần lớp chất liệu nằm trong mặt nạ.
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(mask, 0, 0);

    ctx.drawImage(layer, 0, 0);
    return canvas;
  }

  return { glyphAtlas, patternAtlas, PATTERNS, sampleImage };
})();
