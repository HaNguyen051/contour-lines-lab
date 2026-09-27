/*
 * grid.js — Elastic Grid: lưới hàng/cột đàn hồi (mô phỏng chuyển động trong video Contour Lines).
 *
 * Ý tưởng:
 *  - Ảnh chia N cột × M hàng. Mỗi TRỤC (X và Y) xử lý riêng, giống hệt nhau.
 *  - Trên một trục, đường lưới i (i = 0..N) có vị trí nghỉ r_i = i/N và vị trí thật p_i (0..1).
 *    Hai đường mép p_0 = 0, p_N = 1 luôn đứng yên → 4 mép ảnh không bao giờ di chuyển.
 *  - Vị trí đích của đường i = r_i + Σ A·w(r_i; c), với w là "vòm sin": 1 tại c, về 0 ở hai mép.
 *    A > 0: phần trước c giãn ra (ô to), phần sau co lại. A < 0: ngược lại.
 *  - Mỗi đường chạy tới đích như một lò xo tắt dần (vượt đích nhẹ rồi dội lại).
 *  - Độ trễ: mỗi đường nhìn đích của một thời điểm hơi cũ hơn (t − d_i), nên các đường chạy
 *    lần lượt như một làn sóng lan từ mép này sang mép kia.
 *
 * Toạ độ trục theo thứ tự màn hình: X từ trái sang phải, Y từ TRÊN xuống (shader tự đổi).
 */
window.CL = window.CL || {};

CL.createElasticGrid = function (getParams) {
  'use strict';
  const DT = 1 / 120;              // bước vật lý cố định (giây)
  const HIST = 360;                // lưu lịch sử đích 3 giây gần nhất (360 bước × 1/120 s)
  const SLOW_F = 0.45;             // nhịp chậm: tần số lò xo (Hz)
  const SLOW_SWEEP = 1.4;          // nhịp chậm: thời gian lan (giây)
  const S_PLUS = [0.33, 0.45];     // khoảng c của trạng thái S+ (phần đầu to ra)
  const S_MINUS = [0.60, 0.66];    // khoảng c của trạng thái S− (phần cuối to ra)

  // ---------- Toán ----------
  const clampC = (c) => Math.min(0.95, Math.max(0.05, c));
  // Vòm sin: tăng từ 0 lên 1 trên [0, c], giảm từ 1 về 0 trên [c, 1].
  function arch(u, c) {
    c = clampC(c);
    return u <= c ? Math.sin(Math.PI / 2 * u / c) : Math.sin(Math.PI / 2 * (1 - u) / (1 - c));
  }
  // Giới hạn biên độ một vòm để ô nhỏ nhất không dưới 0.35× cỡ gốc.
  function limitA(A, c) {
    c = clampC(c);
    return Math.min(0.65 * 2 * (1 - c) / Math.PI, Math.max(-0.65 * 2 * c / Math.PI, A));
  }
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  // ---------- Một trục ----------
  // state = trạng thái đích: vòm tự chạy (aA, aC) + vòm kéo (pA, pC) + tần số lò xo f.
  // Trạng thái không bao giờ bị sửa tại chỗ, chỉ thay bằng object mới → lịch sử giữ đúng giá trị cũ.
  function makeAxis(N, aA, aC) {
    const ax = { N, r: [], p: [], v: [], d: [], hist: [], state: { aA, aC, pA: 0, pC: 0.5, f: getParams().freq } };
    for (let i = 0; i <= N; i++) {
      ax.r.push(i / N);
      ax.d.push(0);
      ax.v.push(0);
    }
    for (let i = 0; i <= N; i++) ax.p.push(target(ax, ax.state, i)); // đặt thẳng vào đích, không animate
    return ax;
  }

  function target(ax, st, i) {
    const r = ax.r[i];
    let T = r + limitA(st.aA, st.aC) * arch(r, st.aC);
    if (st.pA) T += st.pA * arch(r, st.pC);
    return T;
  }

  function setState(ax, patch, delays) {
    ax.state = Object.assign({}, ax.state, patch);
    if (delays) ax.d = delays;
  }

  // Trạng thái đích ở thời điểm d giây trước.
  function delayed(ax, d) {
    const idx = ax.hist.length - 1 - Math.round(d / DT);
    return ax.hist[Math.max(0, idx)] || ax.state;
  }

  function stepAxis(ax) {
    ax.hist.push(ax.state);
    if (ax.hist.length > HIST) ax.hist.shift();
    const z = getParams().damping;
    const N = ax.N;
    for (let i = 1; i < N; i++) {
      const st = delayed(ax, ax.d[i]);
      const w = 2 * Math.PI * st.f;
      const a = w * w * (target(ax, st, i) - ax.p[i]) - 2 * z * w * ax.v[i];   // lò xo tắt dần
      ax.v[i] += a * DT;
      ax.p[i] += ax.v[i] * DT;
    }
    // Giữ thứ tự: mỗi ô rộng ít nhất 0.3 cỡ gốc. Quét xuôi rồi quét ngược; đường bị chặn thì hãm vận tốc.
    const gap = 0.3 / N;
    ax.p[0] = 0;
    ax.p[N] = 1;
    for (let i = 1; i < N; i++) {
      if (ax.p[i] < ax.p[i - 1] + gap) { ax.p[i] = ax.p[i - 1] + gap; ax.v[i] *= 0.5; }
    }
    for (let i = N - 1; i >= 1; i--) {
      if (ax.p[i] > ax.p[i + 1] - gap) { ax.p[i] = ax.p[i + 1] - gap; ax.v[i] *= 0.5; }
    }
  }

  // Tra ngược: điểm màn hình s (0..1) ứng với toạ độ ảnh gốc nào (0..1). Giống invX/invY trong shader.
  function inv(ax, s) {
    for (let i = 0; i < ax.N; i++) {
      if (s <= ax.p[i + 1]) return (i + (s - ax.p[i]) / Math.max(ax.p[i + 1] - ax.p[i], 1e-5)) / ax.N;
    }
    return 1;
  }

  // ---------- Khởi tạo: trục X ở S+, trục Y ở S− ----------
  const P0 = getParams();
  const axes = {
    x: makeAxis(P0.cols, P0.amp, rand(...S_PLUS)),
    y: makeAxis(P0.rows, -P0.amp, rand(...S_MINUS)),
  };

  let time = 0;            // thời gian mô phỏng (giây)
  let acc = 0;             // phần dư chưa đủ một bước DT
  let turn = 'y';          // trục của nhịp kế tiếp: Y, X, Y, X...
  let nextBeat = P0.beat;
  let resumeAt = 0;        // sau khi thả tay, chờ tới lúc này mới tự chạy tiếp
  let dragging = false;
  let interactive = false; // true từ lúc chạm cho tới khi lưới đứng yên hẳn
  let drag = null;         // { sx0, sy0, cx, cy }

  // Đổi số cột / số hàng: dựng lại trục, giữ nguyên vòm tự chạy hiện tại.
  function syncSize() {
    const P = getParams();
    if (axes.x.N !== P.cols) axes.x = makeAxis(P.cols, axes.x.state.aA, axes.x.state.aC);
    if (axes.y.N !== P.rows) axes.y = makeAxis(P.rows, axes.y.state.aA, axes.y.state.aC);
  }

  // ---------- Tự chạy như video ----------
  function beat() {
    const P = getParams();
    const ax = axes[turn];
    const toPlus = ax.state.aA < 0;                      // đang S− → sang S+, và ngược lại
    const slow = Math.random() < P.slow;
    const sweep = slow ? SLOW_SWEEP : P.sweep;
    // S− → S+: nội dung dồn về u = 1, làn sóng bắt đầu từ mép cuối. S+ → S−: bắt đầu từ mép đầu.
    const delays = ax.r.map((r) => (toPlus ? sweep * (1 - r) : sweep * r));
    setState(ax, {
      aA: toPlus ? P.amp : -P.amp,
      aC: toPlus ? rand(...S_PLUS) : rand(...S_MINUS),
      f: slow ? SLOW_F : P.freq,
    }, delays);
    turn = turn === 'y' ? 'x' : 'y';
    // Nhịp chậm phải chờ lan xong (≈1.8 s). Nhịp thường được rút ngắn cho bù lại, để trung bình
    // của cả hai loại đúng bằng "beat": beat = slow·slowGap + (1 − slow)·normalMean.
    const slowGap = Math.max(P.beat, SLOW_SWEEP + 0.4);
    const normalMean = P.slow < 1 ? Math.max(0.5, (P.beat - P.slow * slowGap) / (1 - P.slow)) : P.beat;
    nextBeat = time + (slow ? slowGap : normalMean * rand(0.7, 1.3));
  }

  // ---------- Tương tác ----------
  function sweepFrom(ax, c) {
    const s = getParams().sweep;
    return ax.r.map((r) => s * Math.abs(r - c));          // gần chỗ tay phản ứng trước, xa thì sau
  }

  // Giới hạn mềm: kéo càng quá thì càng bị ghì lại (tanh), không bao giờ vượt L.
  function softPull(A, c) {
    const P = getParams();
    const hard = A >= 0 ? 0.65 * 2 * (1 - c) / Math.PI : 0.65 * 2 * c / Math.PI;
    const L = Math.min(P.dragMax, hard);
    return L * Math.tanh(A / L);
  }

  // Nhấn: ghi lại điểm ảnh gốc đang nằm dưới ngón tay. Vòm tự chạy giữ nguyên làm nền.
  function grab(sx, sy) {
    const P = getParams();
    dragging = true;
    interactive = true;
    drag = { sx0: sx, sy0: sy, cx: inv(axes.x, sx), cy: inv(axes.y, sy) };
    setState(axes.x, { pA: 0, pC: drag.cx, f: P.freq }, sweepFrom(axes.x, drag.cx));
    setState(axes.y, { pA: 0, pC: drag.cy, f: P.freq }, sweepFrom(axes.y, drag.cy));
  }

  // Kéo: vòm kéo có tâm tại điểm đã nắm. Vì w(c; c) = 1 nên điểm đó đi đúng theo ngón tay.
  function move(sx, sy) {
    if (!drag) return;
    setState(axes.x, { pA: softPull(sx - drag.sx0, drag.cx) });
    setState(axes.y, { pA: softPull(sy - drag.sy0, drag.cy) });
  }

  // Thả: vòm kéo về 0 (vẫn trễ tính từ chỗ nắm) → lưới nảy về. 1.5 giây sau mới tự chạy tiếp.
  function release() {
    if (!drag) return;
    setState(axes.x, { pA: 0 });
    setState(axes.y, { pA: 0 });
    dragging = false;
    drag = null;
    resumeAt = time + 1.5;
    nextBeat = Math.max(nextBeat, resumeAt);
  }

  // Chạm nhanh: mỗi trục đổi vòm tự chạy để phía có điểm chạm to ra; chuyển động lan từ điểm chạm.
  function tap(sx, sy) {
    const P = getParams();
    release();
    interactive = true;
    [[axes.x, sx], [axes.y, sy]].forEach(([ax, s]) => {
      const delays = sweepFrom(ax, inv(ax, s));
      if (s < 0.5) setState(ax, { aA: P.amp, aC: Math.min(0.5, Math.max(0.33, s + 0.15)), f: P.freq }, delays);
      else setState(ax, { aA: -P.amp, aC: Math.min(0.67, Math.max(0.5, s - 0.15)), f: P.freq }, delays);
    });
  }

  // ---------- Mỗi khung hình ----------
  // playing = false thì không tự chạy (nhưng vẫn kéo được).
  // Trả về { moving, smooth }: smooth = nên vẽ lại mỗi khung (đang chạm hoặc vừa thả mà lưới chưa yên).
  function update(dtReal, playing) {
    const P = getParams();
    syncSize();
    acc += Math.min(dtReal, 0.1);
    while (acc >= DT) {
      acc -= DT;
      time += DT;
      if (P.enabled && P.auto && playing && !dragging && time >= resumeAt && time >= nextBeat) beat();
      stepAxis(axes.x);
      stepAxis(axes.y);
    }
    let moving = false;
    for (const ax of [axes.x, axes.y]) for (const v of ax.v) if (Math.abs(v) > 0.001) moving = true;
    if (!dragging && !moving) interactive = false;
    return { moving, smooth: dragging || (interactive && moving) };
  }

  // Uniform cho shader bước 1. Tắt lớp thì trả về lưới 1×1 (không biến dạng).
  const gx = new Float32Array(17);
  const gy = new Float32Array(17);
  function uniforms() {
    const on = getParams().enabled;
    gx.fill(1);
    gy.fill(1);
    if (on) {
      axes.x.p.forEach((v, i) => (gx[i] = v));
      axes.y.p.forEach((v, i) => (gy[i] = v));
    } else {
      gx[0] = 0;
      gy[0] = 0;
    }
    return { 'uGX[0]': gx, 'uGY[0]': gy, uNX: on ? axes.x.N : 1, uNY: on ? axes.y.N : 1 };
  }

  // Vị trí các đường lưới (để vẽ lớp "Hiện lưới").
  function lines() {
    return { x: axes.x.p.slice(), y: axes.y.p.slice() };
  }

  return { update, uniforms, lines, grab, move, release, tap, isDragging: () => dragging, _axes: axes };
};
