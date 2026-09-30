/*
 * pipeline.js — Chuỗi xử lý: chạy lần lượt các pass shader, mỗi bước ghi vào render target riêng.
 *
 *   Ảnh ─[0 source]→ S0 ─[1 motion]→ S1 ─[soften + 2 threshold]→ S2 ─[3 blur + trộn]→ S3
 *       ─[4 ascii]→ S4 ─[bản đồ mật độ + 5 macpaint]→ S5 ─[6 texture]→ S6 ─[display]→ canvas
 *
 * Bước bị tắt thì "đi thẳng": kết quả của nó chính là kết quả bước trước, không chạy pass nào.
 * Vì mỗi bước có target riêng nên xem bước nào cũng được, và bước 0 chỉ chạy lại khi đổi ảnh.
 */
window.CL = window.CL || {};

CL.createPipeline = function (gl) {
  'use strict';
  const G = CL.gl;
  const S = CL.shaders;

  // --- Biên dịch mọi program (lỗi GLSL sẽ ném ra ở đây, kèm số dòng) ---
  const P = {};
  for (const name of ['copy', 'mixer', 'blur', 'source', 'motion', 'threshold', 'ascii', 'macpaint', 'texture', 'display']) {
    P[name] = G.program(gl, S[name], name);
  }
  G.fullscreenTriangle(gl);

  // --- Texture cố định ---
  const imageTex = G.texture(gl);                                   // ảnh người dùng / ảnh mẫu
  const patternTex = G.texture(gl, { source: CL.textures.patternAtlas(), filter: gl.NEAREST });
  const atlasTex = G.texture(gl, { width: 512, height: 512, filter: gl.LINEAR, mipmap: true });
  const warpTex = G.texture(gl, { filter: gl.NEAREST });            // bảng tra Elastic Grid (grid.js)
  let glyphCount = 1;

  // --- Render target (tạo lại khi đổi kích thước) ---
  let W = 1;
  let H = 1;
  const T = {};          // S0..S6 + tmpA, tmpB (blur ở độ phân giải đầy đủ)
  let pools = {};        // target nhỏ cho blur đã thu nhỏ, theo kích thước
  let sourceDirty = true;

  function setSize(w, h) {
    W = w;
    H = h;
    for (const k in T) G.deleteTarget(gl, T[k]);
    for (const k in pools) ['d', 'a', 'b'].forEach((n) => G.deleteTarget(gl, pools[k][n]));
    pools = {};
    for (const k of ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 'tmpA', 'tmpB']) T[k] = G.target(gl, W, H);
    sourceDirty = true;
  }

  function setImage(img) {
    G.upload(gl, imageTex, img);
    sourceDirty = true;
  }

  // Dựng lại atlas ký tự. Trả về thông tin (có bị cắt bớt không...).
  function setRamp(ramp) {
    const a = CL.textures.glyphAtlas(ramp);
    G.upload(gl, atlasTex, a.canvas, { mipmap: true });
    glyphCount = a.count;
    return a;
  }

  // Vẽ một pass: program + uniform → target (null = canvas).
  function draw(prog, target, uniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.width : W, target ? target.height : H);
    gl.useProgram(prog.program);
    G.setUniforms(gl, prog, uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function pool(w, h) {
    const key = w + 'x' + h;
    if (!pools[key]) pools[key] = { d: G.target(gl, w, h), a: G.target(gl, w, h), b: G.target(gl, w, h) };
    return pools[key];
  }

  // Gaussian blur bán kính radius (px). Nếu khoảng cách giữa 2 mẫu (radius/8) lớn hơn 1.5 px,
  // mẫu có thể nhảy qua nét mảnh và tạo sọc → thu nhỏ ảnh 2× (mỗi lần lấy trung bình 2×2 nhờ
  // lọc LINEAR) cho tới khi đủ dày mẫu, blur ở ảnh nhỏ, rồi đọc lại bằng LINEAR.
  function blurTex(src, radius) {
    let tex = src;
    let w = W;
    let h = H;
    let r = radius;
    while (r / 8 > 1.5 && w > 32 && h > 32) {
      w = Math.ceil(w / 2);
      h = Math.ceil(h / 2);
      r /= 2;
      const p = pool(w, h);
      draw(P.copy, p.d, { uTex: tex });
      tex = p.d.tex;
    }
    const t = w === W && h === H ? { a: T.tmpA, b: T.tmpB } : pool(w, h);
    draw(P.blur, t.a, { uTex: tex, uDir: [1 / w, 0], uRadius: r });
    draw(P.blur, t.b, { uTex: t.a.tex, uDir: [0, 1 / h], uRadius: r });
    return t.b.tex;
  }

  // JS bản sao của hash11 trong shader (dùng cho cỡ ô MacPaint nhảy theo khung).
  function hash11(p) {
    p = (p * 0.1031) % 1;
    p *= p + 33.33;
    p *= p + p;
    return p % 1;
  }

  // Bitmap width của MacPaint trong video mẫu, đo từng khung (px ở cạnh dài 1600), lặp mỗi 6 giây.
  const BITMAP_T = [0.0, 0.9, 1.4, 2.2, 3.0, 3.5, 4.2, 5.4, 6.0];
  const BITMAP_PX = [18, 9, 10, 40, 10, 12, 45, 18, 18];
  function videoBitmap(t) {
    for (let i = 0; i < BITMAP_T.length - 1; i++) {
      if (t <= BITMAP_T[i + 1]) {
        let u = (t - BITMAP_T[i]) / (BITMAP_T[i + 1] - BITMAP_T[i]);
        u = u * u * (3 - 2 * u);                       // smoothstep: chậm ở hai đầu, nhanh ở giữa
        return BITMAP_PX[i] + (BITMAP_PX[i + 1] - BITMAP_PX[i]) * u;
      }
    }
    return BITMAP_PX[BITMAP_PX.length - 1];
  }

  /*
   * Chạy pipeline tới bước ctx.stage rồi hiển thị.
   * ctx = { state, stage, step, t, grid, foot }
   *   step  : số khung (đã qua frame drop)
   *   t     : thời gian đã làm tròn theo khung
   *   warp  : bảng tra Elastic Grid từ grid.js ({ data, size, on })
   *   foot  : cỡ vùng lọc chống moiré (0 = không lọc)
   */
  function render(ctx) {
    const st = ctx.state;
    const stage = ctx.stage;
    const k = Math.max(W, H) / 1600;
    const m = Math.min(W, H);
    const step = ctx.step % 4096;
    const out = [];
    const info = {};

    // Bước 0: chỉ chạy lại khi đổi ảnh hoặc đổi độ phân giải.
    if (sourceDirty) {
      draw(P.source, T.s0, { uImage: imageTex });
      sourceDirty = false;
    }
    out[0] = T.s0.tex;

    // Bước 1: luôn chạy (Levels và tấm cao su nằm ở đây); tắt chuyển động thì các độ lệch = 0.
    if (stage >= 1) {
      const mo = st.motion;
      const on = mo.enabled;
      const warp = ctx.warp;
      const warpOn = !!(warp && warp.on);
      if (warpOn) G.uploadData(gl, warpTex, warp.size, warp.size, warp.data);
      draw(P.motion, T.s1, {
        uTex: T.s0.tex,
        uRes: [W, H],
        uStep: step,
        uT: ctx.t % 1000,
        uAmp: on ? mo.amp * k : 0,
        uFreq: mo.freq,
        uSpeed: mo.speed,
        uShake: on ? mo.shake * k : 0,
        uRot: on ? mo.rot * Math.PI / 180 : 0,
        uZoom: on ? mo.zoom / 100 : 0,
        uBlack: st.source.black,
        uWhite: st.source.white,
        uWarp: warpTex,
        uWarpN: warpOn ? warp.size : 1,
        uWarpOn: warpOn ? 1 : 0,
      });
      out[1] = T.s1.tex;
    }

    // Bước 2: làm mềm rồi threshold.
    if (stage >= 2) {
      const th = st.threshold;
      if (th.enabled) {
        const soft = th.soften > 0 ? blurTex(out[1], th.soften * k) : out[1];
        draw(P.threshold, T.s2, {
          uTex: soft,
          uRes: [W, H],
          uStep: step,
          uK: k,
          uLevel: th.level,
          uWidth: th.width * k,
          uRough: th.rough,
          uMode: th.mode === 'fill' ? 1 : 0,
        });
        out[2] = T.s2.tex;
      } else out[2] = out[1];
    }

    // Bước 3: blur nét rồi trộn lại theo opacity.
    if (stage >= 3) {
      const b = st.blur;
      if (b.enabled && b.radius > 0 && b.opacity > 0) {
        const blurred = blurTex(out[2], b.radius * k);
        draw(P.mixer, T.s3, { uTex: blurred, uBase: out[2], uAmount: b.opacity });
        out[3] = T.s3.tex;
      } else out[3] = out[2];
    }

    // Bước 4: ASCII.
    if (stage >= 4) {
      const a = st.ascii;
      if (a.enabled) {
        draw(P.ascii, T.s4, {
          uTex: out[3],
          uAtlas: atlasTex,
          uRes: [W, H],
          uCell: Math.max(2, Math.round(a.cell * k)),
          uCount: glyphCount,
          uDensity: a.density,
          uGain: a.gain,
          uMinCov: a.minCov,
          uJitter: a.jitter,
          uOpacity: a.opacity,
          uKeep: a.keep,
          uF: a.flicker ? step : 0,
        });
        out[4] = T.s4.tex;
      } else out[4] = out[3];
    }

    // Bước 5: MacPaint.
    let dotPx = 1;
    if (stage >= 5) {
      const mp = st.macpaint;
      if (mp.enabled) {
        let cellPx = mp.cell * k;
        if (mp.track === 'video') cellPx *= videoBitmap(ctx.t % 6) / 18;   // to nhỏ theo vòng 6 giây của video
        else if (st.motion.enabled) cellPx *= 1 + (hash11(step) - 0.5) * 2 * mp.animate;
        cellPx = Math.max(2, Math.round(cellPx));
        info.cellPx = cellPx;

        // Bản đồ mật độ = ảnh bước 3 blur rộng. Chuẩn hoá theo độ dày nét nếu đang ở chế độ edge.
        const rcov = cellPx * (0.75 + mp.spread);
        const density = blurTex(out[3], rcov);
        const edgeMode = st.threshold.enabled && st.threshold.mode === 'edge';
        const norm = edgeMode ? (0.375 * rcov * 2.5066) / Math.max(st.threshold.width * k, 0.75) : 1;

        dotPx = Math.max(1, Math.round(mp.scale * k));
        draw(P.macpaint, T.s5, Object.assign({
          uTex: out[4],
          uDensity: density,
          uPatterns: patternTex,
          uRes: [W, H],
          uStep: step,
          uCell: cellPx,
          uNorm: norm,
          uJitter: mp.jitter,
          uThreshold: mp.threshold,
          uPattern: mp.pattern,
          uScale: dotPx,
          uBlend: mp.blend,
          uKeep: mp.keep,
        }));
        out[5] = T.s5.tex;
      } else out[5] = out[4];
    }

    // Bước 6: Texture.
    if (stage >= 6) {
      const tx = st.texture;
      if (tx.enabled) {
        draw(P.texture, T.s6, {
          uTex: out[5],
          uRes: [W, H],
          uStep: step,
          uS: m / 1000,
          uDot: dotPx,
          uDark: tx.dark,
          uKey: tx.key,
          uGrain: tx.grain,
          uStreaks: tx.streaks,
          uPaperEdge: tx.paperEdge,
          uTone: tx.tone,
        });
        out[6] = T.s6.tex;
      } else out[6] = out[5];
    }

    lastOut = out[stage];
    display(ctx.foot);
    return info;
  }

  // Chép kết quả bước đang xem ra canvas (có hoặc không có lọc chống moiré).
  let lastOut = null;
  function display(foot) {
    if (!lastOut) return;
    draw(P.display, null, { uTex: lastOut, uRes: [W, H], uFoot: foot || 0 });
  }

  return { setSize, setImage, setRamp, render, display };
};
