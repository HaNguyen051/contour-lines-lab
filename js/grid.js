/*
 * grid.js — Elastic Grid: tấm "thạch" 2D.
 *
 * Bản cũ biến dạng TÁCH TRỤC: x mới chỉ phụ thuộc x cũ, y mới chỉ phụ thuộc y cũ.
 * Vì vậy đường dọc luôn thẳng đứng, đường ngang luôn nằm ngang — ô chỉ béo/gầy,
 * không bao giờ cong, nên nhìn cứng và "khung quanh trục x y".
 *
 * Bản này mô phỏng một tấm thạch: lưới (N+1)×(M+1) NÚT, mỗi nút có vị trí và vận
 * tốc HAI CHIỀU, các nút nối nhau bằng lò xo. Kéo một chỗ thì chỗ đó lõm vào rồi
 * sóng lan ra các nút xung quanh và dội lại — đường lưới cong, xoắn, trượt được.
 *
 * Toạ độ:
 *  - Nút thứ (i, j) nằm CỐ ĐỊNH trên màn hình tại s = (i/N, j/M), y tính từ TRÊN xuống.
 *  - Giá trị lưu tại nút là q = CHỖ ĐỌC ẢNH GỐC cho điểm màn hình đó (0..1).
 *    Nghỉ thì q = s. Biến dạng = q lệch khỏi s. Shader chỉ việc tra q rồi đọc ảnh,
 *    không phải giải ngược gì cả.
 *
 * Vật lý mỗi nút, với e = q − (đích):
 *      e'' = −ω₀²·e  +  c²·∇²e  −  2ζω₀·e'  +  β·c²·∇²e'
 *            ───┬──     ──┬──      ───┬───     ────┬────
 *          lò xo về đích  nối với  tắt dần    nhớt: dập gợn
 *                        hàng xóm             li ti, giữ sóng to
 *
 *  - "đích" = một bướu LẺ đặt đúng chỗ con trỏ, hai bên dồn về phía con trỏ. Không có
 *    nhịp tự chạy: không đụng chuột thì ảnh đứng phẳng. Xem "Con trỏ điều khiển biến dạng".
 *  - c (Độ dẻo) = tốc độ sóng lan. c = 0 → các nút rời nhau → đúng bằng bản cũ.
 *  - Mép khung: 4 góc ghim chặt; nút trên cạnh chỉ trượt DỌC THEO cạnh. Nhờ vậy
 *    viền ảnh không bao giờ hở ra ngoài, nhưng bên trong vẫn chảy tự do.
 *
 * Mỗi khung vẽ, lưới nút thưa được nội suy Catmull-Rom lên bảng 65×65 (mượt cấp 2,
 * không gãy tại nút) rồi nén vào texture 16 bit cho shader.
 */
window.CL = window.CL || {};

CL.createElasticGrid = function (getParams, getAspect) {
  'use strict';

  // ---------- Hằng số ----------
  const DT = 1 / 120;          // bước vật lý cố định (giây)
  const FIELD = 65;            // cạnh bảng tra gửi cho shader
  const BETA = 0.18;           // độ nhớt giữa các nút (giây): dập gợn li ti
  const MAX_E = 0.40;          // nút lệch khỏi đích tối đa bấy nhiêu (chống lộn ngược)

  // ---------- Toán ----------
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Khoảng cách trên MÀN HÌNH giữa hai điểm trong hệ 0..1, tính theo cạnh ngang.
  // Ảnh dọc thì 1 đơn vị y dài hơn 1 đơn vị x, nên phải nhân tỉ lệ, nếu không vùng kéo
  // sẽ méo thành hình bầu dục.
  function dist(dx, dy) {
    const a = getAspect ? getAspect() : 1;          // cao / rộng
    return Math.hypot(dx, dy * (a > 0 ? a : 1));
  }

  // Bướu LẺ quanh con trỏ (đạo hàm của Gauss), chuẩn hoá cho đỉnh bằng ±1 tại t = ±1.
  //
  //      bump(t) = t · e^(0.5 − t²/2)
  //
  //  - bump(0) = 0: chỗ ngay dưới con trỏ ĐỨNG YÊN, nó là mỏ neo.
  //  - Hai bên lệch dấu nhau, nên nội dung hai phía cùng bị kéo về phía con trỏ.
  //  - Tắt rất nhanh khi ra xa: quá ~3 lần bề rộng là coi như không còn ảnh hưởng.
  //
  // Đây là chỗ khác gốc rễ so với bản vòm sin cũ: vòm cũ trải suốt cả trục và chỉ đổi
  // được ĐỈNH nằm đâu, nên dấu biên độ phải lật khi con trỏ qua đường giữa — sinh ra
  // cảm giác biến dạng nhảy giữa 4 góc. Bướu lẻ thì tâm nằm đúng chỗ con trỏ, ở bất kỳ
  // đâu, và đổi mượt theo con trỏ.
  function bump(t) {
    return t * Math.exp(0.5 - 0.5 * t * t);
  }

  // ---------- Trạng thái ----------
  let N = 0;                   // số cột ô
  let M = 0;                   // số hàng ô
  let qx = null;               // chỗ đọc ảnh gốc tại mỗi nút (Float32Array)
  let qy = null;
  let vx = null;               // vận tốc
  let vy = null;
  let exArr = null;            // e = q − đích, tính lại mỗi bước (dùng cho ∇²)
  let eyArr = null;
  let tqx = null;              // đích theo trục X, dùng chung cho mọi hàng (dài N+1)
  let tqy = null;              // đích theo trục Y, dùng chung cho mọi cột (dài M+1)
  let fwd = null;              // vị trí đường lưới trên màn hình (tạm, khi dựng đích)

  // Vòm tự chạy của từng trục. pA/pC là vòm phụ, hiện chỉ dùng cho nhịp chậm.
  const axis = { x: { u: 0.5, K: 0, sg: 0.35 }, y: { u: 0.5, K: 0, sg: 0.35 } };

  let time = 0;
  let acc = 0;
  let interactive = false;

  // ---------- Tham số dẫn xuất (3 thanh trượt dễ hiểu → hằng số vật lý) ----------
  function tune() {
    const P = getParams();
    // Độ mềm 0 → 2.5 Hz (đanh, về đích ngay); 1 → 0.35 Hz (lừ đừ). 0.5 ≈ 0.95 Hz như bản cũ.
    const freq = 2.5 * Math.pow(0.14, clamp01(P.soft));
    return {
      P,
      w0: 2 * Math.PI * freq,
      zeta: 1.2 - 0.9 * clamp01(P.bounce),   // 1.2 = về đích không vượt, 0.3 = nảy nhiều
      wave: 2.0 * clamp01(P.jelly),          // số lần sóng chạy hết khung trong 1 giây
    };
  }

  // ---------- Dựng lưới ----------
  function build(n, m) {
    N = n;
    M = m;
    const len = (N + 1) * (M + 1);
    qx = new Float32Array(len);
    qy = new Float32Array(len);
    vx = new Float32Array(len);
    vy = new Float32Array(len);
    exArr = new Float32Array(len);
    eyArr = new Float32Array(len);
    tqx = new Float32Array(N + 1);
    tqy = new Float32Array(M + 1);
    fwd = new Float32Array(Math.max(N, M) + 1);
    buildTargets();
    for (let j = 0; j <= M; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * (N + 1) + i;
        qx[k] = tqx[i];        // đặt thẳng vào đích, không chạy animation lúc mở trang
        qy[k] = tqy[j];
      }
    }
    resampleWeights();
  }

  function syncSize() {
    const P = getParams();
    if (P.cols !== N || P.rows !== M) build(P.cols, P.rows);
  }

  // ---------- Đích: vòm sin của từng trục, rồi tra ngược ----------
  // Vị trí đường lưới trên màn hình:
  //     p(r) = r + K · bump((r − u) / sg) · sin(π r)
  // u = chỗ con trỏ trên trục này, K = độ mạnh (âm = hút), sg = bề rộng vùng ảnh hưởng.
  // Thừa số sin(π r) là cửa sổ cho hai mép khung đứng yên, kể cả khi con trỏ sát mép.
  function forward(st, n) {
    const K = st.K;
    const sg = Math.max(0.05, st.sg);
    fwd[0] = 0;
    for (let i = 1; i < n; i++) {
      const r = i / n;
      fwd[i] = r + K * bump((r - st.u) / sg) * Math.sin(Math.PI * r);
    }
    fwd[n] = 1;
    const gap = 0.3 / n;                                   // ô hẹp nhất = 0.3 cỡ gốc
    for (let i = 1; i < n; i++) if (fwd[i] < fwd[i - 1] + gap) fwd[i] = fwd[i - 1] + gap;
    for (let i = n - 1; i >= 1; i--) if (fwd[i] > fwd[i + 1] - gap) fwd[i] = fwd[i + 1] - gap;
  }

  // Tra ngược: điểm màn hình s nằm giữa hai đường lưới nào → toạ độ ảnh gốc.
  function invert(n, s) {
    for (let i = 0; i < n; i++) {
      if (s <= fwd[i + 1]) return (i + (s - fwd[i]) / Math.max(fwd[i + 1] - fwd[i], 1e-5)) / n;
    }
    return 1;
  }

  function buildTargets() {
    forward(axis.x, N);
    for (let i = 0; i <= N; i++) tqx[i] = invert(N, i / N);
    forward(axis.y, M);
    for (let j = 0; j <= M; j++) tqy[j] = invert(M, j / M);
  }

  // ---------- Một bước vật lý ----------
  function step() {
    const { w0, zeta, wave } = tune();   // w2/dmp dùng ngay bên dưới
    const row = N + 1;
    const hx = 1 / N;
    const hy = 1 / M;

    // Hệ số lan sóng, có trần để bước thời gian cố định không bao giờ làm vỡ mô phỏng.
    let kx = wave * wave / (hx * hx);
    let ky = wave * wave / (hy * hy);
    const cap = 0.45 / (DT * DT);
    if (kx + ky > cap) { const s = cap / (kx + ky); kx *= s; ky *= s; }
    let beta = BETA;
    if (beta * (kx + ky) * DT > 0.5) beta = 0.5 / ((kx + ky) * DT);

    // e = lệch khỏi đích. Sóng lan trên e, nên khi yên thì nút nằm ĐÚNG đích.
    for (let j = 0; j <= M; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * row + i;
        exArr[k] = qx[k] - tqx[i];
        eyArr[k] = qy[k] - tqy[j];
      }
    }

    const dmp = 2 * zeta * w0;
    const w2 = w0 * w0;
    for (let j = 0; j <= M; j++) {
      const edgeY = j === 0 || j === M;
      for (let i = 0; i <= N; i++) {
        const edgeX = i === 0 || i === N;
        if (edgeX && edgeY) continue;                       // 4 góc: ghim chặt
        const k = j * row + i;
        // Hàng xóm; ra ngoài mép thì soi gương (∇² vẫn đúng ở cạnh).
        const kl = i === 0 ? k + 1 : k - 1;
        const kr = i === N ? k - 1 : k + 1;
        const ku = j === 0 ? k + row : k - row;
        const kd = j === M ? k - row : k + row;
        const lapEx = kx * (exArr[kl] + exArr[kr] - 2 * exArr[k]) + ky * (exArr[ku] + exArr[kd] - 2 * exArr[k]);
        const lapEy = kx * (eyArr[kl] + eyArr[kr] - 2 * eyArr[k]) + ky * (eyArr[ku] + eyArr[kd] - 2 * eyArr[k]);
        const lapVx = kx * (vx[kl] + vx[kr] - 2 * vx[k]) + ky * (vx[ku] + vx[kd] - 2 * vx[k]);
        const lapVy = kx * (vy[kl] + vy[kr] - 2 * vy[k]) + ky * (vy[ku] + vy[kd] - 2 * vy[k]);

        if (!edgeX) {
          vx[k] += (-w2 * exArr[k] + lapEx + beta * lapVx - dmp * vx[k]) * DT;
          qx[k] += vx[k] * DT;
        }
        if (!edgeY) {
          vy[k] += (-w2 * eyArr[k] + lapEy + beta * lapVy - dmp * vy[k]) * DT;
          qy[k] += vy[k] * DT;
        }
      }
    }

    pin();
    repair();
  }

  // Mép khung: góc đứng yên, cạnh chỉ trượt dọc theo cạnh → ảnh không bao giờ hở viền.
  function pin() {
    const row = N + 1;
    for (let j = 0; j <= M; j++) {
      const a = j * row;
      const b = j * row + N;
      qx[a] = 0; vx[a] = 0;
      qx[b] = 1; vx[b] = 0;
    }
    for (let i = 0; i <= N; i++) {
      const a = i;
      const b = M * row + i;
      qy[a] = 0; vy[a] = 0;
      qy[b] = 1; vy[b] = 0;
    }
  }

  // Chống lộn ngược: giữ q tăng dần theo từng hàng / từng cột, và không lệch đích quá xa.
  function repair() {
    const row = N + 1;
    const gapX = 0.22 / N;
    const gapY = 0.22 / M;
    for (let j = 0; j <= M; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * row + i;
        const dx = qx[k] - tqx[i];
        const dy = qy[k] - tqy[j];
        if (dx > MAX_E) { qx[k] = tqx[i] + MAX_E; vx[k] *= 0.5; }
        else if (dx < -MAX_E) { qx[k] = tqx[i] - MAX_E; vx[k] *= 0.5; }
        if (dy > MAX_E) { qy[k] = tqy[j] + MAX_E; vy[k] *= 0.5; }
        else if (dy < -MAX_E) { qy[k] = tqy[j] - MAX_E; vy[k] *= 0.5; }
      }
      for (let i = 1; i <= N; i++) {
        const k = j * row + i;
        if (qx[k] < qx[k - 1] + gapX) { qx[k] = Math.min(1, qx[k - 1] + gapX); vx[k] *= 0.5; }
      }
      for (let i = N - 1; i >= 0; i--) {
        const k = j * row + i;
        if (qx[k] > qx[k + 1] - gapX) { qx[k] = Math.max(0, qx[k + 1] - gapX); vx[k] *= 0.5; }
      }
    }
    for (let i = 0; i <= N; i++) {
      for (let j = 1; j <= M; j++) {
        const k = j * row + i;
        if (qy[k] < qy[k - row] + gapY) { qy[k] = Math.min(1, qy[k - row] + gapY); vy[k] *= 0.5; }
      }
      for (let j = M - 1; j >= 0; j--) {
        const k = j * row + i;
        if (qy[k] > qy[k + row] - gapY) { qy[k] = Math.max(0, qy[k + row] - gapY); vy[k] *= 0.5; }
      }
    }
  }

  // ---------- Con trỏ điều khiển biến dạng ----------
  // Chỉ còn MỘT nguồn chuyển động: con trỏ. Không có nhịp tự chạy theo đồng hồ nữa,
  // nên không đụng chuột thì ảnh đứng phẳng.
  //
  //  - VỊ TRÍ con trỏ chọn tâm vòm c và dấu biên độ: con trỏ ở nửa nào thì nửa đó giãn
  //    ra, nửa kia dồn lại. Đúng cách "chạm nhanh" của bản cũ, nay chạy liên tục.
  //  - CHUYỂN ĐỘNG của con trỏ nạp "năng lượng" 0..1, chính là độ lớn của biên độ.
  //  - Năng lượng luôn tiêu dần. Ngừng rê — kể cả khi con trỏ vẫn nằm trong khung —
  //    thì biên độ về 0, đích thành lưới đều, lò xo đưa ảnh về phẳng.
  let cur = { on: false, sx: 0.5, sy: 0.5, psx: 0.5, psy: 0.5 };
  let energy = 0;

  function pointer(sx, sy) {
    sx = clamp01(sx);
    sy = clamp01(sy);
    if (!cur.on) { cur.psx = sx; cur.psy = sy; }   // vừa vào khung: không tính cú nhảy vào
    cur.on = true;
    cur.sx = sx;
    cur.sy = sy;
  }

  function pointerOut() {
    cur.on = false;                                 // năng lượng còn lại tự tiêu
  }

  // Mỗi KHUNG HÌNH một lần: nạp năng lượng bằng quãng con trỏ vừa đi, cho tiêu bớt, rồi
  // dựng lại đích. Đọc con trỏ mỗi khung chứ không phải mỗi sự kiện chuột, và lấy vị trí
  // thô không làm mượt — giống cách effect.app dựng iMouse.
  function stepCursor(dt, running) {
    const P = getParams();
    // Đang tạm dừng: không nạp, không tiêu, giữ nguyên hình. Vẫn kéo theo chỗ con trỏ để
    // khi chạy lại không bị một cú nhảy vì quãng đường tích luỹ trong lúc dừng.
    if (!running) { cur.psx = cur.sx; cur.psy = cur.sy; return; }
    if (cur.on && P.enabled) {
      const moved = dist(cur.sx - cur.psx, cur.sy - cur.psy);
      cur.psx = cur.sx;
      cur.psy = cur.sy;
      energy = Math.min(1, energy + moved * (P.sens != null ? P.sens : 6));
    }
    const tau = Math.max(0.05, P.hold != null ? P.hold : 0.6);
    energy *= Math.exp(-dt / tau);
    if (energy < 1e-4) energy = 0;
    else interactive = true;

    // Tâm biến dạng nằm ĐÚNG chỗ con trỏ, không còn lật dấu ở đường giữa nên không còn
    // hiện tượng nhảy giữa 4 góc. K âm = hút (hai bên dồn về con trỏ), dương = đẩy ra.
    const K = P.amp * energy * (P.attract === false ? 1 : -1);
    // Bề rộng vùng ảnh hưởng tính theo cạnh NGANG; trục dọc chia cho tỉ lệ khung để vùng
    // đó tròn trên màn hình chứ không thành bầu dục ở ảnh dọc.
    const a = getAspect ? getAspect() : 1;
    const span = P.span != null ? P.span : 0.35;
    axis.x.u = cur.sx;
    axis.x.K = K;
    axis.x.sg = span;
    axis.y.u = cur.sy;
    axis.y.K = K;
    axis.y.sg = span / (a > 0 ? a : 1);
    buildTargets();
  }

  // ---------- Mỗi khung hình ----------
  // playing = false (nút Tạm dừng, phím Space): ĐÓNG BĂNG hoàn toàn. Không chạy vật lý,
  // không nhận chuột, giữ nguyên hình đang có — nên ảnh đứng im thật, và "Lưu PNG" lúc
  // dừng lấy đúng khung đang nhìn thấy.
  function update(dtReal, playing) {
    const P = getParams();
    syncSize();
    const dt = Math.min(dtReal, 0.1);
    const running = playing !== false;
    stepCursor(dt, running);
    if (!running) {
      acc = 0;                       // bỏ phần dư, chạy lại không dồn một cục bước vật lý
      return { moving: false, smooth: false };
    }
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      time += DT;
      if (P.enabled) step();
    }
    let moving = false;
    for (let k = 0; k < vx.length; k++) {
      if (Math.abs(vx[k]) > 0.0015 || Math.abs(vy[k]) > 0.0015) { moving = true; break; }
    }
    if (!moving && energy === 0) interactive = false;
    return { moving, smooth: interactive && (moving || energy > 0) };
  }

  // ---------- Bảng tra cho shader ----------
  // Nội suy Catmull-Rom (mượt cấp 2) từ lưới nút thưa lên FIELD×FIELD, rồi nén 16 bit:
  //   R,G = byte cao, byte thấp của toạ độ X;  B,A = của toạ độ Y.
  const fieldData = new Uint8Array(FIELD * FIELD * 4);
  let wX = null;
  let wY = null;
  let tmpRow = null;

  function weights(n) {
    const idx = new Int32Array(FIELD * 4);
    const w = new Float32Array(FIELD * 4);
    for (let k = 0; k < FIELD; k++) {
      const t = (k / (FIELD - 1)) * n;
      const i0 = Math.min(n - 1, Math.floor(t));
      const f = t - i0;
      const f2 = f * f;
      const f3 = f2 * f;
      w[k * 4] = -0.5 * f3 + f2 - 0.5 * f;
      w[k * 4 + 1] = 1.5 * f3 - 2.5 * f2 + 1;
      w[k * 4 + 2] = -1.5 * f3 + 2 * f2 + 0.5 * f;
      w[k * 4 + 3] = 0.5 * f3 - 0.5 * f2;
      for (let m = 0; m < 4; m++) idx[k * 4 + m] = Math.min(n, Math.max(0, i0 - 1 + m));
    }
    return { idx, w };
  }

  function resampleWeights() {
    wX = weights(N);
    wY = weights(M);
    tmpRow = new Float32Array((M + 1) * FIELD * 2);
  }

  function field() {
    const on = getParams().enabled;
    if (on) {
      // Lượt 1: nội suy theo X cho từng hàng nút.
      for (let j = 0; j <= M; j++) {
        const base = j * (N + 1);
        for (let k = 0; k < FIELD; k++) {
          let sx = 0;
          let sy = 0;
          for (let m = 0; m < 4; m++) {
            const ww = wX.w[k * 4 + m];
            const id = base + wX.idx[k * 4 + m];
            sx += ww * qx[id];
            sy += ww * qy[id];
          }
          const o = (j * FIELD + k) * 2;
          tmpRow[o] = sx;
          tmpRow[o + 1] = sy;
        }
      }
      // Lượt 2: nội suy theo Y rồi nén.
      let o = 0;
      for (let l = 0; l < FIELD; l++) {
        for (let k = 0; k < FIELD; k++) {
          let sx = 0;
          let sy = 0;
          for (let m = 0; m < 4; m++) {
            const ww = wY.w[l * 4 + m];
            const id = (wY.idx[l * 4 + m] * FIELD + k) * 2;
            sx += ww * tmpRow[id];
            sy += ww * tmpRow[id + 1];
          }
          const nx = Math.max(0, Math.min(65535, Math.round(clamp01(sx) * 65535)));
          const ny = Math.max(0, Math.min(65535, Math.round(clamp01(sy) * 65535)));
          fieldData[o++] = nx >> 8;
          fieldData[o++] = nx & 255;
          fieldData[o++] = ny >> 8;
          fieldData[o++] = ny & 255;
        }
      }
    }
    return { data: fieldData, size: FIELD, on };
  }

  // ---------- Đường lưới cho lớp "Hiện lưới" ----------
  // Đường dọc thứ i là tập điểm màn hình có q.x = i/N → dò theo từng hàng nút.
  // Kết quả là đường CONG, khác bản cũ (luôn thẳng).
  function lines() {
    const row = N + 1;
    const out = { x: [], y: [] };
    for (let i = 0; i <= N; i++) {
      const T = i / N;
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const base = j * row;
        for (let k = 0; k < N; k++) {
          const a = qx[base + k];
          const b = qx[base + k + 1];
          if (T <= b || k === N - 1) {
            poly.push({ x: (k + (T - a) / Math.max(b - a, 1e-5)) / N, y: j / M });
            break;
          }
        }
      }
      out.x.push(poly);
    }
    for (let j = 0; j <= M; j++) {
      const T = j / M;
      const poly = [];
      for (let i = 0; i <= N; i++) {
        for (let k = 0; k < M; k++) {
          const a = qy[k * row + i];
          const b = qy[(k + 1) * row + i];
          if (T <= b || k === M - 1) {
            poly.push({ x: i / N, y: (k + (T - a) / Math.max(b - a, 1e-5)) / M });
            break;
          }
        }
      }
      out.y.push(poly);
    }
    return out;
  }

  // ---------- Khởi tạo ----------
  const P0 = getParams();
  build(P0.cols, P0.rows);      // K đang là 0 nên lưới mở ra ở trạng thái PHẲNG

  return {
    update, field, lines, pointer, pointerOut,
    _q: () => ({ qx, qy, N, M }),
    _e: () => energy,
  };
};
