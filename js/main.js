/*
 * main.js — Khởi động và điều phối:
 *   1. Tạo context WebGL, pipeline, giao diện, tương tác.
 *   2. Vòng lặp khung hình: frame drop, chỉ vẽ lại khi cần.
 *   3. Nhận ảnh (chọn file / kéo thả / Ctrl+V), nút bấm, phím tắt.
 *   4. Mất và khôi phục GPU.
 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const canvas = $('#view');
  const errorEl = $('#error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    console.error(msg);
  }

  // ===========================================================================
  // 1. KHỞI TẠO
  // ===========================================================================
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl) {
    showError('Máy hoặc trình duyệt này không hỗ trợ WebGL.\nHãy thử Chrome, Edge hoặc Firefox bản mới, và bật "Tăng tốc phần cứng" trong cài đặt trình duyệt.');
    return;
  }

  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = CL.presets.build('contour');
  const settings = { resolution: 1600, stage: 6, playing: !reducedMotion };

  let pipe = null;
  let source = null;     // ảnh nguồn trên CPU (canvas/img), giữ lại để upload lại khi GPU được khôi phục
  let W = 1;
  let H = 1;
  let sampleSeed = 1;
  let lost = false;

  const ui = CL.createUI({
    panel: $('#panel'),
    stagebar: $('#stagebar'),
    toastEl: $('#toast'),
    onChange(layer, key, value) {
      state[layer][key] = value;
      $('#presetSelect').value = 'custom';        // đổi tham số → preset thành "Tuỳ chỉnh"
      if (layer === 'ascii' && key === 'ramp') applyRamp();
      if (key === 'enabled') ui.sync(state);
      dirty = true;
    },
    onStage: setStage,
  });

  // Elastic Grid (grid.js) + con trỏ điều khiển lưới (interact.js).
  // Dùng hàm () => state.grid để luôn đọc bộ tham số hiện tại, kể cả sau khi đổi preset.
  const grid = CL.createElasticGrid(() => state.grid);
  CL.createInteract({
    canvas,
    getSize: () => ({ W, H }),
    getParams: () => state.grid,
    grid,
  });

  // Tạo (hoặc tạo lại sau khi mất GPU) toàn bộ tài nguyên GPU.
  function initGPU() {
    try {
      pipe = CL.createPipeline(gl);
    } catch (err) {
      showError(err.message);
      pipe = null;
      return false;
    }
    applyRamp();
    if (source) {
      pipe.setImage(source);
      resize();
    }
    return true;
  }

  function applyRamp() {
    if (!pipe) return;
    const a = pipe.setRamp(state.ascii.ramp);
    if (a.truncated) ui.toast(`Bộ ký tự dài quá 64 ký tự, chỉ dùng 64 ký tự đầu.`, true);
  }

  // Kích thước xử lý: cạnh dài = độ phân giải đã chọn (không vượt giới hạn GPU), tỉ lệ theo ảnh.
  function resize() {
    if (!pipe || !source) return;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const long = Math.min(settings.resolution, maxTex);
    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;
    const aspect = sw / sh;
    W = Math.round(aspect >= 1 ? long : long * aspect);
    H = Math.round(aspect >= 1 ? long / aspect : long);
    canvas.width = W;
    canvas.height = H;
    pipe.setSize(W, H);
    dirty = true;
  }

  // Đặt ảnh nguồn: thu nhỏ nếu quá lớn, upload lên GPU.
  function setSource(img) {
    const maxSide = Math.min(2400, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    let src = img;
    if (Math.max(w, h) > maxSide) {
      const c = document.createElement('canvas');
      const f = maxSide / Math.max(w, h);
      c.width = Math.round(w * f);
      c.height = Math.round(h * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      src = c;
    }
    source = src;
    if (pipe) {
      pipe.setImage(src);
      resize();
    }
  }

  function setStage(n) {
    settings.stage = n;
    ui.setStage(n);
    dirty = true;
  }

  // ===========================================================================
  // 2. VÒNG LẶP KHUNG HÌNH
  // ===========================================================================
  let time = 0;
  let last = performance.now();
  let lastStep = -1;
  let dirty = true;
  let recording = false;
  let lastFoot = -1;

  // Cỡ vùng lọc chống moiré: khi ảnh hiển thị nhỏ hơn 0.8 lần kích thước thật.
  function footprint() {
    if (recording) return 0;
    const r = canvas.getBoundingClientRect();
    const ratio = Math.min(r.width / W, r.height / H) * (window.devicePixelRatio || 1);
    return ratio > 0 && ratio < 0.8 ? 1 / ratio : 0;
  }

  function currentStep() {
    let step = Math.floor(time * state.motion.fps);
    if (state.motion.loop > 0) step %= Math.max(1, Math.round(state.motion.loop * state.motion.fps));
    return step;
  }

  function renderNow(foot) {
    const step = currentStep();
    pipe.render({ state, stage: settings.stage, step, t: step / state.motion.fps, grid: grid.uniforms(), foot });
    lastStep = step;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (settings.playing) time += dt;

    if (pipe && source && !lost) {
      // Vật lý của lưới chạy mỗi khung (bước cố định 1/120 s). Vẽ lại pipeline khi:
      //  - step đổi (Frame drop, 8 hình/giây như video), hoặc tham số đổi;
      //  - "Mượt khi tương tác" bật và đang kéo / vừa thả mà lưới chưa yên → mỗi khung (~60 hình/giây).
      // Khi đang dừng (step không đổi) thì tương tác luôn vẽ mượt, nếu không kéo sẽ không thấy gì.
      const g = grid.update(dt, settings.playing);
      const smoothNow = g.smooth && state.grid.enabled && (state.grid.smooth || !settings.playing);
      const foot = footprint();
      const step = currentStep();
      if (dirty || step !== lastStep || smoothNow) {
        renderNow(foot);
        dirty = false;
      } else if (recording || Math.abs(foot - lastFoot) > 0.01) {
        pipe.display(foot);    // chỉ vẽ lại pass hiển thị, không chạy lại cả pipeline
      }
      lastFoot = foot;
      drawGridOverlay();
    }
    requestAnimationFrame(frame);
  }

  // ===========================================================================
  // 3. NHẬN ẢNH, NÚT BẤM, PHÍM TẮT
  // ===========================================================================

  // Không lọc theo file.type (nhiều file có type rỗng): để trình duyệt thử giải mã, lỗi thì báo lý do.
  function loadFile(file) {
    if (!file) return;
    const name = file.name || 'ảnh dán';
    if (/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(name)) {
      ui.toast(`"${name}" là ảnh HEIC (iPhone), trình duyệt chưa đọc được. Hãy đổi sang JPG/PNG, hoặc chụp màn hình ảnh đó rồi Ctrl+V.`, true);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setSource(img);
      ui.toast(`Đã tải: ${name} (${img.naturalWidth}×${img.naturalHeight})`);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      ui.toast(`Không đọc được "${name}". Hãy dùng ảnh JPG, PNG, WebP, GIF hoặc BMP.`, true);
    };
    img.src = url;
  }

  $$('.file-image').forEach((input) => {
    input.onchange = () => {
      loadFile(input.files[0]);
      input.value = ''; // chọn lại đúng file đó vẫn nhận
    };
  });

  // Kéo thả: thả vào đâu trong trang cũng được.
  window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
    else ui.toast('Kéo ảnh thẳng từ trang web khác thì trình duyệt chặn (bảo mật). Hãy lưu ảnh về máy rồi kéo file, hoặc chuột phải ảnh → Sao chép hình ảnh → Ctrl+V tại đây.', true);
  });

  // Dán ảnh: Ctrl+V.
  window.addEventListener('paste', (e) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      loadFile(item.getAsFile());
    }
  });

  $('#btnSample').onclick = () => {
    sampleSeed++;
    setSource(CL.textures.sampleImage(sampleSeed));
    ui.toast(`Ảnh mẫu #${sampleSeed}`);
  };

  function setPlaying(p) {
    settings.playing = p;
    $$('.btn-play').forEach((b) => {
      b.textContent = p ? '⏸' : '▶';
      b.title = p ? 'Tạm dừng (Space)' : 'Chạy (Space)';
    });
  }
  $$('.btn-play').forEach((b) => (b.onclick = () => setPlaying(!settings.playing)));

  $$('.btn-png').forEach((b) => (b.onclick = () => {
    if (!pipe || !source) return;
    CL.exporter.png(canvas, () => renderNow(0), ui.toast);
    dirty = true; // khung sau vẽ lại có lọc
  }));

  // Quay video.
  const btnVideo = $('#btnVideo');
  btnVideo.onclick = () => {
    if (recording) { CL.exporter.stop(); return; }
    if (!pipe || !source) return;
    let seconds = $('#videoLen').value;
    if (seconds === 'loop') {
      if (!(state.motion.loop > 0)) {
        ui.toast('Hãy đặt "Vòng lặp" (lớp Chuyển động) lớn hơn 0 trước khi quay 1 vòng lặp.', true);
        return;
      }
      seconds = state.motion.loop;
    }
    CL.exporter.video({
      canvas,
      seconds: Number(seconds),
      toast: ui.toast,
      onStart() {
        recording = true;
        time = 0;
        setPlaying(true);
        dirty = true;
        btnVideo.textContent = '■ Dừng quay';
        btnVideo.classList.add('recording');
        $$('.btn-png, #btnSample, #resSelect').forEach((b) => (b.disabled = true));
      },
      onEnd() {
        recording = false;
        dirty = true;
        btnVideo.textContent = 'Quay video';
        btnVideo.classList.remove('recording');
        $$('.btn-png, #btnSample, #resSelect').forEach((b) => (b.disabled = false));
      },
    });
  };

  // Preset.
  const presetSelect = $('#presetSelect');
  for (const p of CL.presets.PRESETS) presetSelect.add(new Option(p.name, p.id));
  presetSelect.add(new Option('Tuỳ chỉnh', 'custom'));
  presetSelect.onchange = () => {
    if (presetSelect.value === 'custom') return;
    state = CL.presets.build(presetSelect.value);
    ui.sync(state);
    applyRamp();
    dirty = true;
  };

  $('#btnSavePreset').onclick = () => CL.exporter.savePreset(state);
  $('#filePreset').onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    CL.exporter.readPreset(file).then(({ state: s, rejected }) => {
      state = s;
      ui.sync(state);
      applyRamp();
      presetSelect.value = 'custom';
      dirty = true;
      ui.toast(rejected ? `Đã mở preset (bỏ qua ${rejected} giá trị sai kiểu).` : 'Đã mở preset.');
    }).catch((err) => ui.toast('File preset không hợp lệ: ' + err.message, true));
  };

  // Độ phân giải xử lý (không vượt giới hạn GPU).
  const resSelect = $('#resSelect');
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  for (const r of [1080, 1600, 2400]) {
    const o = new Option(`${r} px`, r);
    if (r > maxTex) { o.disabled = true; o.text += ' (GPU không hỗ trợ)'; }
    resSelect.add(o);
  }
  resSelect.value = settings.resolution;
  resSelect.onchange = () => {
    settings.resolution = Number(resSelect.value);
    resize();
  };

  // "Hiện lưới": vẽ các đường lưới màu xanh lên một canvas 2D phủ đúng vùng ảnh.
  // Canvas này nằm chồng lên, không phải canvas WebGL, nên không lọt vào PNG hay video.
  const overlay = $('#gridOverlay');
  const octx = overlay.getContext('2d');
  let overlayShown = false;
  function drawGridOverlay() {
    const show = state.grid.enabled && state.grid.showGrid;
    if (!show) {
      if (overlayShown) { octx.clearRect(0, 0, overlay.width, overlay.height); overlayShown = false; }
      return;
    }
    overlayShown = true;
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (overlay.width !== Math.round(r.width * dpr) || overlay.height !== Math.round(r.height * dpr)) {
      overlay.width = Math.round(r.width * dpr);
      overlay.height = Math.round(r.height * dpr);
    }
    // Vùng ảnh bên trong canvas (object-fit: contain để lại viền trống).
    const scale = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * scale) / 2;
    const oy = (r.height - H * scale) / 2;
    const L = grid.lines();
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, r.width, r.height);
    octx.strokeStyle = 'rgba(40, 170, 255, 0.9)';
    octx.lineWidth = 1;
    octx.beginPath();
    for (const x of L.x) { const px = ox + x * W * scale; octx.moveTo(px, oy); octx.lineTo(px, oy + H * scale); }
    for (const y of L.y) { const py = oy + y * H * scale; octx.moveTo(ox, py); octx.lineTo(ox + W * scale, py); }
    octx.stroke();
  }

  // Chế độ xem ↔ tuỳ chỉnh.
  function toggleMode() { document.body.classList.toggle('viewer'); dirty = true; }
  $$('.btn-mode').forEach((b) => (b.onclick = toggleMode));
  $('#chkDesc').onchange = (e) => document.body.classList.toggle('hide-desc', !e.target.checked);

  // Phím tắt (không chạy khi đang gõ trong ô nhập).
  window.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!settings.playing); }
    else if (e.code === 'KeyH') toggleMode();
    else if (e.code === 'KeyG') { state.grid.showGrid = !state.grid.showGrid; ui.sync(state); }
    else if (/^Digit[0-6]$/.test(e.code)) setStage(Number(e.code.slice(5)));
  });

  // Khung xem đổi cỡ → tính lại lọc chống moiré.
  new ResizeObserver(() => { dirty = true; }).observe($('#stage'));

  // ===========================================================================
  // 4. MẤT / KHÔI PHỤC GPU
  // ===========================================================================
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // cho phép trình duyệt khôi phục
    lost = true;
    ui.toast('Mất kết nối GPU (driver lỗi hoặc máy thiếu bộ nhớ). Đang chờ khôi phục…', true);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    if (initGPU()) ui.toast('Đã khôi phục GPU.');
  });

  // ===========================================================================
  // KHỞI ĐỘNG
  // ===========================================================================
  ui.sync(state);
  ui.setStage(settings.stage);
  setPlaying(settings.playing);
  if (initGPU()) {
    setSource(CL.textures.sampleImage(sampleSeed));
    if (reducedMotion) ui.toast('Máy đang bật "giảm chuyển động" nên hiệu ứng mở ở trạng thái dừng. Nhấn Space để chạy.');
    requestAnimationFrame(frame);
  }

  // Chỉnh thử trong Console (F12): CL.app.state.ascii.cell = 20; CL.app.refresh()
  CL.app = {
    get state() { return state; },
    refresh() { ui.sync(state); dirty = true; },
    setStage,
    setSource,                  // nạp ảnh bất kỳ (img / canvas), ví dụ để thử với ảnh lưới
    grid,                       // ví dụ: CL.app.grid.tap(0.2, 0.3)
  };
})();
