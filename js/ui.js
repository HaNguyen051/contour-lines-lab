/*
 * ui.js — Giao diện: tự sinh bảng điều khiển từ CL.presets.SCHEMA, thanh 7 bước, thông báo (toast).
 * File này không biết gì về WebGL; mọi thay đổi được báo lên main.js qua các hàm callback.
 */
window.CL = window.CL || {};

// collapsed = true (điện thoại): các lớp mở ra ở trạng thái gập, chỉ thấy tên lớp và công tắc;
// chạm vào tên lớp mới hiện các thanh trượt. Bảng ngắn hẳn, dễ tìm đúng lớp cần chỉnh.
CL.createUI = function ({ panel, stagebar, toastEl, onChange, onStage, collapsed = false }) {
  const inputs = {}; // inputs['lớp.khoá'] = { el, valueEl, field, extra }
  const t = (s) => CL.t(s);

  // Tên hoa văn MacPaint có tiền tố số ("7 · Bàn cờ 50%"). Giữ số, chỉ dịch phần chữ,
  // để từ điển chứa tên sạch thay vì 12 khoá dính số.
  function optText(s) {
    const m = /^(\d+ · )(.+)$/.exec(s);
    return m ? m[1] + t(m[2]) : t(s);
  }

  function fmt(f, v) {
    if (f.type !== 'range') return '';
    const d = String(f.step).includes('.') ? String(f.step).split('.')[1].length : 0;
    return Number(v).toFixed(d) + (f.unit ? ' ' + CL.t(f.unit) : '');
  }

  // Đọc giá trị từ ô nhập, đổi về đúng kiểu dữ liệu của mặc định (số / chuỗi / true-false).
  function read(f, el) {
    if (f.type === 'toggle' || f.type === 'toggle-field') return el.checked;
    if (f.type === 'range') return Number(el.value);
    if (f.type === 'select') return typeof f.value === 'number' ? Number(el.value) : el.value;
    return el.value;
  }

  // ---------- Bảng điều khiển ----------
  function build() {
    panel.innerHTML = '';
    for (const layer of CL.presets.SCHEMA) {
      const sec = document.createElement('details');
      sec.className = 'layer';
      sec.open = !collapsed;
      sec.dataset.layer = layer.id;
      const badge = layer.step === null ? '✦' : layer.step;
      sec.innerHTML = `<summary><span class="badge">${badge}</span><span class="layer-title">${t(layer.title)}</span></summary>` +
        `<p class="layer-desc">${t(layer.desc)}</p><div class="fields"></div>`;
      const summary = sec.querySelector('summary');
      const box = sec.querySelector('.fields');

      // Thanh có cờ adv nằm trong mục "Nâng cao" gập lại, để bảng chính chỉ còn vài thanh chính.
      let advBox = null;
      const boxFor = (f) => {
        if (!f.adv) return box;
        if (!advBox) {
          const d = document.createElement('details');
          d.className = 'adv';
          d.innerHTML = '<summary>' + t('Nâng cao') + '</summary><div class="fields"></div>';
          sec.appendChild(d);
          advBox = d.querySelector('.fields');
        }
        return advBox;
      };

      for (const f of layer.fields) {
        const id = `f-${layer.id}-${f.key}`;
        let el;
        let extra = null;

        // Công tắc bật/tắt cả lớp: nằm trên tiêu đề.
        if (f.type === 'toggle') {
          el = document.createElement('input');
          el.type = 'checkbox';
          el.className = 'switch';
          el.id = id;
          el.title = t('Bật/tắt lớp này');
          el.addEventListener('click', (e) => e.stopPropagation()); // bấm công tắc không đóng/mở nhóm
          summary.appendChild(el);
        } else {
          const row = document.createElement('div');
          row.className = 'field';
          row.innerHTML = `<div class="field-head"><label for="${id}">${t(f.label)}</label><span class="value"></span></div>`;
          const head = row.firstChild;

          if (f.type === 'range') {
            el = document.createElement('input');
            el.type = 'range';
            el.min = f.min;
            el.max = f.max;
            el.step = f.step;
            row.appendChild(el);
          } else if (f.type === 'toggle-field') {
            el = document.createElement('input');
            el.type = 'checkbox';
            head.insertBefore(el, head.firstChild);
            head.classList.add('check');
          } else if (f.type === 'select') {
            el = document.createElement('select');
            for (const [v, txt] of f.options) el.add(new Option(optText(txt), v));
            row.appendChild(el);
          } else if (f.type === 'ramp') {
            // Ô chọn bộ ký tự dựng sẵn + ô nhập tự do.
            extra = document.createElement('select');
            for (const [v, txt] of f.options) extra.add(new Option(optText(txt), v));
            extra.add(new Option(t('Tự nhập…'), '__custom'));
            row.appendChild(extra);
            el = document.createElement('input');
            el.type = 'text';
            el.spellcheck = false;
            row.appendChild(el);
            extra.addEventListener('change', () => {
              if (extra.value === '__custom') { el.focus(); return; }
              el.value = extra.value;
              el.dispatchEvent(new Event('change'));
            });
          }
          el.id = id;
          if (f.desc) {
            const d = document.createElement('div');
            d.className = 'desc';
            d.textContent = t(f.desc);
            row.appendChild(d);
          }
          boxFor(f).appendChild(row);
        }

        const handler = () => {
          const v = read(f, el);
          const valueEl = inputs[layer.id + '.' + f.key].valueEl;
          if (valueEl) valueEl.textContent = fmt(f, v);
          onChange(layer.id, f.key, v);
        };
        el.addEventListener(f.type === 'range' ? 'input' : 'change', handler);
        inputs[layer.id + '.' + f.key] = {
          el, extra, field: f, layer: layer.id,
          valueEl: el.closest('.field') ? el.closest('.field').querySelector('.value') : null,
        };
      }
      panel.appendChild(sec);
    }
  }

  // Đẩy toàn bộ state lên giao diện (sau khi đổi preset / mở file preset).
  function sync(state) {
    for (const key in inputs) {
      const { el, extra, field, layer, valueEl } = inputs[key];
      const v = state[layer][field.key];
      if (field.type === 'toggle' || field.type === 'toggle-field') el.checked = v;
      else el.value = v;
      if (extra) extra.value = field.options.some(([o]) => o === v) ? v : '__custom';
      if (valueEl) valueEl.textContent = fmt(field, v);
    }
    // Lớp đang tắt thì làm mờ.
    panel.querySelectorAll('.layer').forEach((sec) => {
      const s = state[sec.dataset.layer];
      sec.classList.toggle('off', s && s.enabled === false);
    });
  }

  // ---------- Thanh 7 bước ----------
  const STAGES = ['Ảnh gốc', 'Chuyển động', 'Threshold', 'Gaussian blur', 'ASCII', 'MacPaint', 'Texture'];
  function buildStages() {
    stagebar.innerHTML = '';
    STAGES.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'stage-btn';
      b.innerHTML = `<b>${i}</b> ${t(name)}`;
      b.title = CL.t('Xem kết quả tới bước %1 (phím %1)', i);
      b.onclick = () => onStage(i);
      stagebar.appendChild(b);
    });
  }
  function setStage(n) {
    stagebar.querySelectorAll('.stage-btn').forEach((b, i) => b.classList.toggle('active', i === n));
  }

  // ---------- Thông báo ----------
  let timer = 0;
  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toastEl.classList.remove('show'), isError ? 7000 : 2800);
  }

  // Đổi ngôn ngữ: dựng lại cả bảng và thanh bước. main.js gọi sync() + setStage() ngay sau,
  // vì dựng lại làm mất giá trị đang hiển thị trên các ô.
  function rebuild() {
    build();
    buildStages();
  }

  build();
  buildStages();
  return { sync, setStage, toast, inputs, rebuild };
};
