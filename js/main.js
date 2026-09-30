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
  // Khi không tạo được context, trình duyệt bắn sự kiện này kèm lý do cụ thể
  // (GPU bị chặn, tăng tốc phần cứng đang tắt, tiện ích mở rộng chặn WebGL...).
  let creationError = '';
  canvas.addEventListener('webglcontextcreationerror', (e) => {
    if (e.statusMessage) creationError = e.statusMessage;
  });

  // Một số máy chỉ nhận được tên context khác: bản cũ dùng 'experimental-webgl',
  // vài driver lại chỉ mở được WebGL2 (WebGL2 vẫn chạy shader GLSL ES 1.00 của dự án).
  const glOptions = { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false };
  let gl = null;
  for (const name of ['webgl', 'experimental-webgl', 'webgl2']) {
    try {
      gl = canvas.getContext(name, glOptions);
    } catch (e) {
      gl = null;
    }
    if (gl) break;
  }
  if (!gl) {
    showError(
      CL.t('Trình duyệt không cấp được WebGL cho trang này.') +
      (creationError ? CL.t('\nTrình duyệt báo: ') + creationError : '') +
      CL.t('\n\nCách xử lý:') +
      CL.t('\n 1. Chrome/Edge: mở chrome://settings/system → bật "Sử dụng tính năng tăng tốc đồ hoạ khi có" → khởi động lại trình duyệt.') +
      CL.t('\n 2. Mở chrome://gpu và xem dòng "WebGL": nếu ghi Disabled / Software only thì GPU đang bị chặn.') +
      CL.t('\n 3. Tắt thử các tiện ích mở rộng chống theo dõi (nhiều tiện ích chặn WebGL để chống fingerprint).') +
      CL.t('\n 4. Thử Safari hoặc Firefox để biết lỗi ở trình duyệt hay ở máy.')
    );
    return;
  }

  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Điện thoại: màn cảm ứng và cạnh ngắn của màn hình dưới 700 px (iPhone ~390–440, iPad ≥ 744).
  // Điện thoại có ít bộ nhớ GPU hơn: 9 render target ở 1600 px ≈ 140 MB dễ làm iOS "mất GPU",
  // nên mặc định xử lý ở 1080 px (≈ 60 MB). Vẫn đổi được trong ô Xử lý trên máy tính.
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  const isPhone = isTouch && Math.min(screen.width, screen.height) < 700;
  document.documentElement.classList.toggle('is-touch', isTouch);
  let state = CL.presets.build('contour');
  const settings = { resolution: isPhone ? 1080 : 1600, stage: 6, playing: !reducedMotion, ratio: 'auto' };

  // Khung hình: tỉ lệ rộng/cao. 'auto' = giữ nguyên tỉ lệ ảnh gốc.
  const RATIOS = {
    '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '2:3': 2 / 3, '9:16': 9 / 16,
    '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9,
  };
  const RATIO_OPTIONS = [
    ['auto', 'Theo ảnh gốc'],
    ['1:1', '1:1 · vuông'],
    ['4:5', '4:5 · dọc, Instagram'],
    ['3:4', '3:4 · dọc'],
    ['2:3', '2:3 · dọc, in ảnh'],
    ['9:16', '9:16 · dọc, story / reel'],
    ['4:3', '4:3 · ngang'],
    ['3:2', '3:2 · ngang, máy ảnh'],
    ['16:9', '16:9 · ngang, màn hình'],
  ];

  let pipe = null;
  let sourceRaw = null;  // ảnh người dùng đưa vào, chưa cắt — giữ nguyên để đổi khung hình lúc nào cũng được
  let source = null;     // ảnh ĐÃ cắt theo khung đang chọn; đây mới là thứ upload lên GPU
  let W = 1;
  let H = 1;
  let sampleSeed = 1;
  let lost = false;

  const ui = CL.createUI({
    collapsed: isPhone,          // điện thoại: các lớp gập lại, chạm vào tên lớp mới mở ra
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
  const grid = CL.createElasticGrid(() => state.grid, () => H / W);
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
    if (a.truncated) ui.toast(CL.t('Bộ ký tự dài quá 64 ký tự, chỉ dùng 64 ký tự đầu.'), true);
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
    sourceRaw = src;
    applyRatio();
  }

  // Cắt ảnh gốc về đúng khung đang chọn, kiểu "cover": phủ kín khung rồi bỏ phần thừa,
  // cắt cân từ giữa. Không dùng "contain" vì sẽ chừa viền trống, mà hiệu ứng này cần tràn viền.
  // Cắt trên CPU rồi mới upload, nên pipeline và shader không phải biết gì về khung hình.
  function frameSource() {
    const r = RATIOS[settings.ratio];
    if (!sourceRaw || !r) return sourceRaw;          // 'auto' → dùng nguyên ảnh
    const sw = sourceRaw.naturalWidth || sourceRaw.width;
    const sh = sourceRaw.naturalHeight || sourceRaw.height;
    // Giữ trọn một chiều, cắt chiều còn lại — mất ít điểm ảnh nhất có thể.
    let cw;
    let ch;
    if (sw / sh > r) { ch = sh; cw = Math.round(sh * r); }   // ảnh rộng hơn khung → xén hai bên
    else { cw = sw; ch = Math.round(sw / r); }               // ảnh cao hơn khung → xén trên dưới
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    c.getContext('2d').drawImage(sourceRaw, Math.round((sw - cw) / 2), Math.round((sh - ch) / 2), cw, ch, 0, 0, cw, ch);
    return c;
  }

  function applyRatio() {
    source = frameSource();
    if (pipe && source) {
      pipe.setImage(source);
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
    pipe.render({ state, stage: settings.stage, step, t: step / state.motion.fps, warp: grid.field(), foot });
    lastStep = step;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (settings.playing) time += dt;

    if (pipe && source && !lost) {
      // Vật lý của lưới chạy mỗi khung (bước cố định 1/120 s). Vẽ lại pipeline khi:
      //  - step đổi (Frame drop), hoặc tham số đổi;
      //  - "Mượt khi tương tác" bật và lưới chưa yên → mỗi khung (~60 hình/giây).
      // Đang tạm dừng thì grid.update() tự đóng băng và trả smooth = false, nên không vẽ lại:
      // ảnh đứng im hoàn toàn, kể cả khi rê chuột.
      const g = grid.update(dt, settings.playing);
      const smoothNow = g.smooth && state.grid.enabled && state.grid.smooth;
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
  // Ảnh HEIC (iPhone) cũng cứ thử: chọn từ Thư viện ảnh thì iOS thường tự đổi sang JPEG, và
  // Safari 17 trở lên đọc được HEIC. Chỉ khi giải mã hỏng mới báo lỗi riêng cho HEIC.
  function loadFile(file) {
    if (!file) return;
    const name = file.name || CL.t('ảnh dán');
    const heic = /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setSource(img);
      ui.toast(CL.t('Đã tải: %1 (%2×%3)', name, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (heic) ui.toast(CL.t('"%1" là ảnh HEIC (iPhone), trình duyệt chưa đọc được. Hãy đổi sang JPG/PNG, hoặc chụp màn hình ảnh đó rồi Ctrl+V.', name), true);
      else ui.toast(CL.t('Không đọc được "%1". Hãy dùng ảnh JPG, PNG, WebP, GIF hoặc BMP.', name), true);
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
    else ui.toast(CL.t('Kéo ảnh thẳng từ trang web khác thì trình duyệt chặn (bảo mật). Hãy lưu ảnh về máy rồi kéo file, hoặc chuột phải ảnh → Sao chép hình ảnh → Ctrl+V tại đây.'), true);
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
    ui.toast(CL.t('Ảnh mẫu #%1', sampleSeed));
  };

  function setPlaying(p) {
    settings.playing = p;
    $$('.btn-play').forEach((b) => {
      b.textContent = p ? '⏸' : '▶';
      b.title = p ? CL.t('Tạm dừng (Space)') : CL.t('Chạy (Space)');
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
        ui.toast(CL.t('Hãy đặt "Vòng lặp" (lớp Chuyển động) lớn hơn 0 trước khi quay 1 vòng lặp.'), true);
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
        btnVideo.textContent = CL.t('■ Dừng quay');
        btnVideo.classList.add('recording');
        $$('.btn-png, #btnSample, #resSelect').forEach((b) => (b.disabled = true));
      },
      onEnd() {
        recording = false;
        dirty = true;
        btnVideo.textContent = CL.t('Quay video');
        btnVideo.classList.remove('recording');
        $$('.btn-png, #btnSample, #resSelect').forEach((b) => (b.disabled = false));
      },
    });
  };

  // Preset.
  const presetSelect = $('#presetSelect');
  function fillPresetSelect() {
    const keep = presetSelect.value;
    presetSelect.innerHTML = '';
    for (const p of CL.presets.PRESETS) presetSelect.add(new Option(CL.t(p.name), p.id));
    presetSelect.add(new Option(CL.t('Tuỳ chỉnh'), 'custom'));
    if (keep) presetSelect.value = keep;
  }
  fillPresetSelect();
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
      ui.toast(rejected ? CL.t('Đã mở preset (bỏ qua %1 giá trị sai kiểu).', rejected) : CL.t('Đã mở preset.'));
    }).catch((err) => ui.toast(CL.t('File preset không hợp lệ: %1', err.message), true));
  };

  // Độ phân giải xử lý (không vượt giới hạn GPU).
  const ratioSelect = $('#ratioSelect');
  function fillRatioSelect() {
    ratioSelect.innerHTML = '';
    for (const [v, label] of RATIO_OPTIONS) ratioSelect.add(new Option(CL.t(label), v));
    ratioSelect.value = settings.ratio;
  }
  fillRatioSelect();
  ratioSelect.onchange = () => {
    settings.ratio = ratioSelect.value;
    applyRatio();                 // cắt lại từ ảnh GỐC, nên đổi qua lại không mất dần chất lượng
  };

  const resSelect = $('#resSelect');
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  function fillResSelect() {
    resSelect.innerHTML = '';
    for (const r of [1080, 1600, 2400]) {
      const o = new Option(`${r} px`, r);
      if (r > maxTex) { o.disabled = true; o.text += CL.t(' (GPU không hỗ trợ)'); }
      resSelect.add(o);
    }
    resSelect.value = settings.resolution;
  }
  fillResSelect();
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
    // Lưới thạch cong theo cả hai chiều nên mỗi đường là một chuỗi điểm, không phải đoạn thẳng.
    for (const poly of L.x.concat(L.y)) {
      poly.forEach((pt, i) => {
        const px = ox + pt.x * W * scale;
        const py = oy + pt.y * H * scale;
        if (i === 0) octx.moveTo(px, py);
        else octx.lineTo(px, py);
      });
    }
    octx.stroke();
  }

  // Chế độ xem ↔ tuỳ chỉnh.
  function toggleMode() { document.body.classList.toggle('viewer'); dirty = true; }
  $$('.btn-mode').forEach((b) => (b.onclick = toggleMode));

  // Điện thoại: kéo thanh nắm trên đầu bảng Tuỳ chỉnh xuống để đóng bảng (về chế độ xem).
  // Bảng đi theo ngón tay; thả khi đã kéo quá 70 px thì đóng, chưa đủ thì trượt về chỗ cũ.
  const sheet = $('#sheet');
  const grab = $('#sheetGrab');
  let grabY = null;
  grab.addEventListener('pointerdown', (e) => {
    grabY = e.clientY;
    try { grab.setPointerCapture(e.pointerId); } catch (err) { /* không quan trọng */ }
    sheet.style.transition = 'none';
  });
  grab.addEventListener('pointermove', (e) => {
    if (grabY === null) return;
    sheet.style.transform = `translateY(${Math.max(0, e.clientY - grabY)}px)`;
  });
  function grabEnd(e) {
    if (grabY === null) return;
    const dy = e.clientY - grabY;
    grabY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 70) toggleMode();
  }
  grab.addEventListener('pointerup', grabEnd);
  grab.addEventListener('pointercancel', grabEnd);
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
    ui.toast(CL.t('Mất kết nối GPU (driver lỗi hoặc máy thiếu bộ nhớ). Đang chờ khôi phục…'), true);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    if (initGPU()) ui.toast(CL.t('Đã khôi phục GPU.'));
  });

  // ===========================================================================
  // NGÔN NGỮ
  // ===========================================================================
  // Chữ tĩnh viết sẵn trong index.html: ghi lại BẢN GỐC tiếng Việt ngay lúc nạp, rồi mỗi
  // lần đổi ngôn ngữ đều dịch lại từ bản gốc đó. Dịch chồng lên bản đã dịch sẽ hỏng.
  // Bỏ qua #panel và #stagebar vì ui.js tự dựng lại hai chỗ đó.
  const staticText = [];
  const staticAttr = [];
  (function captureStatic() {
    const skip = (el) => !el || el.closest('#panel, #stagebar');
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.nodeValue.trim() && !skip(n.parentElement)) staticText.push([n, n.nodeValue]);
    }
    document.querySelectorAll('[title]').forEach((el) => {
      if (!skip(el)) staticAttr.push([el, el.getAttribute('title')]);
    });
  })();

  function applyLang() {
    document.documentElement.lang = CL.lang;
    // replace() trên phần đã cắt khoảng trắng: giữ nguyên thụt lề và xuống dòng của HTML.
    for (const [node, vi] of staticText) node.nodeValue = vi.replace(vi.trim(), CL.t(vi.trim()));
    for (const [el, vi] of staticAttr) el.setAttribute('title', CL.t(vi));
    ui.rebuild();
    ui.sync(state);              // dựng lại làm mất giá trị trên các ô, phải đẩy lại
    ui.setStage(settings.stage);
    fillPresetSelect();
    fillResSelect();
    fillRatioSelect();
    setPlaying(settings.playing); // cập nhật tooltip nút chạy/dừng
    $$('.btn-lang').forEach((b) => b.classList.toggle('primary', b.dataset.lang === CL.lang));
    dirty = true;
  }

  $$('.btn-lang').forEach((b) => (b.onclick = () => {
    if (CL.lang === b.dataset.lang) return;
    CL.lang = b.dataset.lang;
    try { localStorage.setItem('cl-lang', CL.lang); } catch (e) { /* chế độ riêng tư: không nhớ được, kệ */ }
    applyLang();
  }));

  // ===========================================================================
  // KHỞI ĐỘNG
  // ===========================================================================
  applyLang();                  // đã bao gồm ui.sync(), ui.setStage() và setPlaying()
  // Ảnh mở sẵn nằm trong js/sample-image.js dưới dạng data URI, KHÔNG phải <img src="assets/...">:
  // mở trang bằng file:// thì ảnh cục bộ bị coi là khác nguồn, canvas nhiễm bẩn và
  // gl.texImage2D ném SECURITY_ERR. data URI cùng nguồn nên nạp texture được, và bản gộp
  // một file (build.py) cũng chạy. Thiếu file đó thì rơi về ảnh sinh bằng code.
  function loadStartImage() {
    if (!CL.sampleImageData) { setSource(CL.textures.sampleImage(sampleSeed)); return; }
    const img = new Image();
    img.onload = () => setSource(img);
    img.onerror = () => setSource(CL.textures.sampleImage(sampleSeed));
    img.src = CL.sampleImageData;
  }

  if (initGPU()) {
    loadStartImage();        // nạp không đồng bộ; vòng lặp khung tự chờ tới khi có ảnh
    if (reducedMotion) ui.toast(CL.t('Máy đang bật "giảm chuyển động" nên hiệu ứng mở ở trạng thái dừng. Nhấn Space để chạy.'));
    requestAnimationFrame(frame);
  }

  // Chỉnh thử trong Console (F12): CL.app.state.ascii.cell = 20; CL.app.refresh()
  CL.app = {
    get state() { return state; },
    refresh() { ui.sync(state); dirty = true; },
    setStage,
    setSource,                  // nạp ảnh bất kỳ (img / canvas), ví dụ để thử với ảnh lưới
    grid,                       // ví dụ: CL.app.grid.pointer(0.2, 0.3)
  };
})();
