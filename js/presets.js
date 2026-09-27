/*
 * presets.js — ★ CHỖ SỬA THÔNG SỐ ★
 *
 * SCHEMA liệt kê mọi lớp (layer) và mọi tham số. Bảng điều khiển được sinh tự động từ đây,
 * nên muốn thêm/bớt/đổi mặc định một tham số chỉ cần sửa ở file này.
 *
 * Mỗi tham số:
 *   key   : tên trong code (state.lớp.key)
 *   label : tên hiện trên giao diện
 *   type  : 'range' | 'toggle' | 'select' | 'ramp'
 *   value : giá trị mặc định = preset "Contour Lines (giống video)"
 *   min, max, step, unit : cho thanh trượt
 *   options : [[giá trị, nhãn], ...] cho ô chọn
 *   desc  : chú thích tiếng Việt
 *
 * Đơn vị "px" tính cho ảnh có cạnh dài 1600 px. Ảnh xử lý ở 2400 px thì nhân 1.5,
 * nên đổi độ phân giải không làm hiệu ứng trông khác đi.
 */
window.CL = window.CL || {};

CL.presets = (() => {
  'use strict';

  // Các bộ ký tự dựng sẵn cho ASCII (nhạt → đậm).
  const RAMPS = [
    ['.\'-*/|1tvouqdQ69G&$%#@RBMW▮▌█', 'Contour Lines (mặc định)'],
    [' .:-=+*#%@', 'Paul Bourke (cổ điển)'],
    ['░▒▓█', 'Khối'],
    ['MW▮█', 'Chữ đậm + khối'],
    ['1742356980', 'Chữ số'],
  ];

  const PATTERN_OPTIONS = [[-1, 'Tự động theo mật độ']].concat(
    CL.textures.PATTERNS.map(([name], i) => [i, `${i} · ${name}`]),
  );

  const SCHEMA = [
    {
      id: 'source', step: 0, title: 'Ảnh gốc',
      desc: 'Levels: kéo điểm đen và điểm trắng để tăng tương phản trước khi tách nét.',
      fields: [
        { key: 'black', label: 'Điểm đen', type: 'range', value: 0.05, min: 0, max: 0.9, step: 0.01,
          desc: 'Mọi chỗ tối hơn mức này thành đen hẳn.' },
        { key: 'white', label: 'Điểm trắng', type: 'range', value: 0.95, min: 0.1, max: 1, step: 0.01,
          desc: 'Mọi chỗ sáng hơn mức này thành trắng hẳn. Ảnh nền xám thì kéo xuống để nền thành trắng.' },
      ],
    },
    {
      id: 'motion', step: 1, title: 'Chuyển động',
      desc: 'Frame drop + Camera shake: ảnh giật và rung theo từng khung. Lưới đàn hồi nằm ở lớp Elastic Grid ngay dưới.',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'fps', label: 'Frame drop', type: 'range', value: 8, min: 2, max: 30, step: 1, unit: 'hình/giây',
          desc: 'Thời gian được làm tròn xuống thành từng bước 1/fps giây. 7–8 giật như stop-motion; 24–30 thì mượt.' },
        { key: 'amp', label: 'Rung nét', type: 'range', value: 0, min: 0, max: 40, step: 0.5, unit: 'px',
          desc: 'Uốn ảnh theo nhiễu trôi, làm nét "sôi" kiểu chất lỏng. Video mẫu không có kiểu này nên mặc định 0.' },
        { key: 'freq', label: 'Rung nét: mật độ', type: 'range', value: 2.4, min: 0.5, max: 10, step: 0.1,
          desc: 'Số ô lưới trên cạnh ngắn. Ít = sóng to và mềm, nhiều = gợn nhỏ.' },
        { key: 'speed', label: 'Rung nét: tốc độ', type: 'range', value: 2.4, min: 0, max: 6, step: 0.1,
          desc: 'Lưới nhiễu trôi nhanh hay chậm. 0 = lưới đứng yên.' },
        { key: 'shake', label: 'Shake: độ dịch', type: 'range', value: 10, min: 0, max: 40, step: 0.5, unit: 'px',
          desc: 'Mỗi khung dịch cả ảnh đi ngẫu nhiên tối đa bao nhiêu px.' },
        { key: 'rot', label: 'Shake: độ xoay', type: 'range', value: 0.6, min: 0, max: 5, step: 0.1, unit: '°',
          desc: 'Góc xoay ngẫu nhiên tối đa mỗi khung.' },
        { key: 'zoom', label: 'Phóng to', type: 'range', value: 4, min: 0, max: 15, step: 0.5, unit: '%',
          desc: 'Phóng ảnh quanh tâm để khi rung không lộ mép.' },
        { key: 'loop', label: 'Vòng lặp', type: 'range', value: 0, min: 0, max: 12, step: 0.5, unit: 'giây',
          desc: '0 = không lặp. Lớn hơn 0 thì sau khoảng này mọi chuyển động lặp lại, hợp để quay video lặp.' },
      ],
    },
    {
      id: 'grid', step: null, title: 'Elastic Grid',
      desc: 'Lưới hàng/cột đàn hồi như video: từng hàng, từng cột to nhỏ luân phiên; kéo thì cả lưới co giãn theo tay rồi nảy về.',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'cols', label: 'Số cột', type: 'range', value: 8, min: 2, max: 16, step: 1, desc: '' },
        { key: 'rows', label: 'Số hàng', type: 'range', value: 10, min: 2, max: 16, step: 1, desc: '' },
        { key: 'amp', label: 'Biên độ tự chạy', type: 'range', value: 0.15, min: 0, max: 0.3, step: 0.005,
          desc: 'Đường lưới dịch tối đa bao nhiêu (tính theo cạnh khung). 0.15 cho ô to nhất ~1.7×, nhỏ nhất ~0.6× như video.' },
        { key: 'dragMax', label: 'Biên độ tối đa khi kéo', type: 'range', value: 0.22, min: 0.05, max: 0.3, step: 0.005,
          desc: 'Kéo quá mức này thì bị ghì lại mềm.' },
        { key: 'freq', label: 'Tần số lò xo', type: 'range', value: 0.95, min: 0.2, max: 4, step: 0.05, unit: 'Hz',
          desc: 'Cao = đường lưới về đích nhanh, cứng; thấp = chậm, mềm.' },
        { key: 'damping', label: 'Độ tắt dần ζ', type: 'range', value: 0.73, min: 0.3, max: 1.5, step: 0.01,
          desc: 'Dưới 1 = vượt đích nhẹ rồi dội lại (0.73 vượt khoảng 3%); từ 1 trở lên = về đích không vượt.' },
        { key: 'sweep', label: 'Thời gian lan', type: 'range', value: 0.6, min: 0, max: 2, step: 0.05, unit: 'giây',
          desc: 'Các đường lưới không chạy cùng lúc: chuyển động lan từ mép này (hoặc từ chỗ tay) sang phía kia trong khoảng này.' },
        { key: 'auto', label: 'Tự chạy như video', type: 'toggle-field', value: true,
          desc: 'Để yên thì lưới tự đổi trạng thái theo nhịp, luân phiên trục dọc rồi trục ngang.' },
        { key: 'beat', label: 'Nhịp', type: 'range', value: 1.3, min: 0.5, max: 4, step: 0.05, unit: 'giây',
          desc: 'Khoảng cách trung bình giữa hai lần đổi (mỗi nhịp lệch ngẫu nhiên 0.6–1.4 lần).' },
        { key: 'slow', label: 'Tỉ lệ nhịp chậm', type: 'range', value: 0.25, min: 0, max: 1, step: 0.01,
          desc: 'Bấy nhiêu phần nhịp là nhịp chậm: lò xo 0.45 Hz, lan trong 1.4 giây.' },
        { key: 'smooth', label: 'Mượt khi tương tác', type: 'toggle-field', value: true,
          desc: 'Bật: đang kéo, hoặc vừa thả mà lưới chưa yên, thì vẽ mỗi khung (~60 hình/giây). Còn lại vẽ theo Frame drop như video.' },
        { key: 'showGrid', label: 'Hiện lưới (phím G)', type: 'toggle-field', value: false,
          desc: 'Vẽ các đường lưới màu xanh lên trên ảnh để so với video. Không có trong PNG hay video xuất ra.' },
      ],
    },
    {
      id: 'threshold', step: 2, title: 'Threshold',
      desc: 'Tách nét: vẽ đường viền mảnh tại ranh giới sáng/tối (edge) hoặc tô mảng đen trắng (fill).',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'mode', label: 'Chế độ', type: 'select', value: 'edge', options: [['edge', 'Edge: chỉ nét viền'], ['fill', 'Fill: mảng đen trắng']],
          desc: 'Edge cho ra đường bao quanh vật; Fill cho ra hình bóng đen đặc.' },
        { key: 'soften', label: 'Làm mềm trước', type: 'range', value: 4, min: 0, max: 20, step: 0.5, unit: 'px',
          desc: 'Blur ảnh trước khi tách nét, để nét cong mượt và bỏ qua chi tiết vụn.' },
        { key: 'level', label: 'Ngưỡng sáng', type: 'range', value: 0.5, min: 0.05, max: 0.95, step: 0.01,
          desc: 'Nét nằm ở chỗ độ sáng bằng đúng mức này. Tăng thì nét dịch về phía vùng sáng.' },
        { key: 'width', label: 'Độ dày nét', type: 'range', value: 1.8, min: 0.5, max: 6, step: 0.1, unit: 'px', desc: '' },
        { key: 'rough', label: 'Độ nhám', type: 'range', value: 0.05, min: 0, max: 0.3, step: 0.005,
          desc: 'Cộng nhiễu trước khi so ngưỡng: mép nét lởm chởm và đổi theo từng khung.' },
      ],
    },
    {
      id: 'blur', step: 3, title: 'Gaussian blur',
      desc: 'Làm mờ nét rồi trộn lại một phần (30%) để nét mềm, bớt răng cưa.',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'radius', label: 'Bán kính', type: 'range', value: 6, min: 0, max: 24, step: 0.5, unit: 'px', desc: '' },
        { key: 'opacity', label: 'Độ trộn', type: 'range', value: 0.3, min: 0, max: 1, step: 0.01,
          desc: '0.3 = "Gaussian blur 30%" trong preset gốc.' },
      ],
    },
    {
      id: 'ascii', step: 4, title: 'ASCII',
      desc: 'Chia ảnh thành ô, đo độ phủ mực từng ô, rắc ký tự có độ đậm tương ứng.',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'ramp', label: 'Bộ ký tự', type: 'ramp', value: RAMPS[0][0], options: RAMPS,
          desc: 'Xếp từ nhạt đến đậm. Tối đa 64 ký tự; ký tự lặp bị bỏ.' },
        { key: 'cell', label: 'Cỡ ô', type: 'range', value: 15, min: 6, max: 40, step: 1, unit: 'px', desc: '' },
        { key: 'density', label: 'Mật độ', type: 'range', value: 0.7, min: 0, max: 1, step: 0.01,
          desc: 'Tỉ lệ ô có nét được hiện ký tự. Thấp = rắc thưa.' },
        { key: 'gain', label: 'Khuếch đại', type: 'range', value: 5, min: 0.5, max: 12, step: 0.1, unit: '×',
          desc: 'Nét mảnh chỉ phủ một phần nhỏ ô; khuếch đại để chọn được ký tự đậm hơn.' },
        { key: 'minCov', label: 'Độ phủ tối thiểu', type: 'range', value: 0.035, min: 0, max: 0.3, step: 0.005,
          desc: 'Ô có ít mực hơn mức này thì bỏ trống, giữ nền sạch.' },
        { key: 'jitter', label: 'Ngẫu nhiên', type: 'range', value: 0.45, min: 0, max: 1, step: 0.01,
          desc: 'Làm lệch lựa chọn ký tự để các ô cạnh nhau không giống hệt nhau.' },
        { key: 'opacity', label: 'Độ đậm ký tự', type: 'range', value: 1, min: 0, max: 1, step: 0.01, desc: '' },
        { key: 'keep', label: 'Giữ ảnh bên dưới', type: 'range', value: 1, min: 0, max: 1, step: 0.01,
          desc: '1 = ký tự chồng lên nét; 0 = chỉ còn ký tự (tranh ASCII thuần).' },
        { key: 'flicker', label: 'Nhấp nháy theo khung', type: 'toggle-field', value: true,
          desc: 'Mỗi khung chọn lại ô và ký tự, nên ký tự "nhảy" liên tục.' },
      ],
    },
    {
      id: 'macpaint', step: 5, title: 'MacPaint',
      desc: 'Ô nào nằm gần nét thì tô hoa văn 1-bit 8×8 kiểu MacPaint; trộn 40% nên thành khối xám bậc thang.',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'pattern', label: 'Hoa văn', type: 'select', value: 7, options: PATTERN_OPTIONS,
          desc: 'Một hoa văn cố định, hoặc "Tự động" chọn hoa văn đậm hơn cho ô nhiều mực hơn (ra dither).' },
        { key: 'cell', label: 'Cỡ ô', type: 'range', value: 20, min: 4, max: 60, step: 1, unit: 'px', desc: '' },
        { key: 'track', label: 'Cỡ ô theo thời gian', type: 'select', value: 'video',
          options: [['video', 'Theo video (vòng 6 giây)'], ['off', 'Tắt (dùng Nhảy cỡ ô)']],
          desc: 'Theo video: cỡ ô to nhỏ theo đúng nhịp đo từ video mẫu (9–45 px, lặp mỗi 6 giây); khi đó Nhảy cỡ ô bị bỏ qua.' },
        { key: 'animate', label: 'Nhảy cỡ ô', type: 'range', value: 0.45, min: 0, max: 1, step: 0.01,
          desc: 'Mỗi khung, cỡ ô đổi ngẫu nhiên trong khoảng ±(animate × 100)% (chỉ khi Chuyển động đang bật).' },
        { key: 'spread', label: 'Độ lan', type: 'range', value: 0.35, min: 0, max: 2, step: 0.01,
          desc: 'Khối xám ôm rộng bao xa quanh nét.' },
        { key: 'threshold', label: 'Ngưỡng bật ô', type: 'range', value: 0.35, min: 0.02, max: 1, step: 0.01,
          desc: 'Thấp = nhiều ô được tô hơn.' },
        { key: 'jitter', label: 'Ngẫu nhiên', type: 'range', value: 0.12, min: 0, max: 0.6, step: 0.01,
          desc: 'Làm mép khối lởm chởm và đổi theo khung.' },
        { key: 'scale', label: 'Cỡ điểm hoa văn', type: 'range', value: 1, min: 1, max: 8, step: 1, unit: 'px', desc: '' },
        { key: 'blend', label: 'Độ trộn', type: 'range', value: 0.4, min: 0, max: 1, step: 0.01,
          desc: '0.4 = "MacPaint 40%". Bàn cờ trộn 40% ra màu xám khoảng 0.8.' },
        { key: 'keep', label: 'Giữ ảnh bên dưới', type: 'range', value: 1, min: 0, max: 1, step: 0.01, desc: '' },
      ],
    },
    {
      id: 'texture', step: 6, title: 'Texture',
      desc: 'Giấy nhám (multiply) + nền đen photocopy có vệt quét ngang + mép tờ giấy sáng loang.',
      fields: [
        { key: 'enabled', type: 'toggle', value: true },
        { key: 'dark', label: 'Nền tối', type: 'range', value: 1, min: 0, max: 1, step: 0.01,
          desc: 'Thay phần nền trắng bằng mặt giấy đen. 0 = giữ giấy sáng.' },
        { key: 'key', label: 'Ngưỡng nền', type: 'range', value: 0.9, min: 0.5, max: 0.99, step: 0.01,
          desc: 'Vùng sáng hơn mức này (tính trung bình 3×3) bị coi là nền. Khối xám ~0.8 nên được giữ lại.' },
        { key: 'grain', label: 'Hạt', type: 'range', value: 0.5, min: 0, max: 1, step: 0.01, desc: '' },
        { key: 'streaks', label: 'Vệt quét', type: 'range', value: 0.6, min: 0, max: 1, step: 0.01,
          desc: 'Vệt ngang như trục máy scan.' },
        { key: 'paperEdge', label: 'Mép tờ giấy', type: 'range', value: 0.5, min: 0, max: 1, step: 0.01,
          desc: 'Mép ảnh sáng loang như tờ giấy đặt lệch trên máy scan.' },
        { key: 'tone', label: 'Tông ấm', type: 'range', value: 0.25, min: 0, max: 1, step: 0.01, desc: '' },
      ],
    },
  ];

  // Tìm định nghĩa của một tham số.
  function field(layerId, key) {
    const layer = SCHEMA.find((l) => l.id === layerId);
    return layer && layer.fields.find((f) => f.key === key);
  }

  // Bộ giá trị mặc định: { motion: { enabled: true, fps: 8, ... }, ... }
  function defaults() {
    const s = {};
    for (const layer of SCHEMA) {
      s[layer.id] = {};
      for (const f of layer.fields) s[layer.id][f.key] = f.value;
    }
    return s;
  }

  const BOURKE = RAMPS[1][0];
  const PRESETS = [
    { id: 'contour', name: 'Contour Lines (giống video)', patch: { motion: { amp: 0 }, grid: { enabled: true, auto: true }, macpaint: { track: 'video' } } },
    { id: 'static', name: 'Bản tĩnh', patch: { motion: { enabled: false }, grid: { auto: false }, ascii: { flicker: false }, macpaint: { animate: 0, track: 'off' } } },
    { id: 'light', name: 'Giấy sáng', patch: { texture: { dark: 0, grain: 0.35, paperEdge: 0 } } },
    { id: 'lines', name: 'Chỉ nét viền', patch: { ascii: { enabled: false }, macpaint: { enabled: false }, texture: { enabled: false } } },
    { id: 'dense', name: 'ASCII dày', patch: { ascii: { cell: 11, density: 1, gain: 7, jitter: 0.6 } } },
    { id: 'classic', name: 'ASCII cổ điển', patch: {
      threshold: { enabled: false, soften: 1 }, blur: { enabled: false },
      ascii: { ramp: BOURKE, cell: 12, density: 1, gain: 1.3, minCov: 0.02, jitter: 0, keep: 0, flicker: false },
      macpaint: { enabled: false }, texture: { dark: 0, paperEdge: 0 },
    } },
    { id: 'dither', name: 'Dither MacPaint', patch: {
      threshold: { enabled: false, soften: 2 }, blur: { enabled: false }, ascii: { enabled: false },
      macpaint: { pattern: -1, cell: 6, spread: 0, threshold: 0.08, jitter: 0, scale: 2, blend: 1, keep: 0, animate: 0, track: 'off' },
      texture: { dark: 0, paperEdge: 0 },
    } },
  ];

  // Preset = mặc định + phần khác biệt (patch).
  function build(presetId) {
    const s = defaults();
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) for (const l in p.patch) Object.assign(s[l], p.patch[l]);
    return s;
  }

  // Làm sạch state đọc từ file JSON: chỉ nhận khoá có trong schema và đúng kiểu dữ liệu;
  // số bị kẹp trong khoảng min–max; giá trị ô chọn phải nằm trong danh sách. Sai thì dùng mặc định.
  function sanitize(input) {
    const s = defaults();
    let rejected = 0;
    for (const layer of SCHEMA) {
      const src = input && typeof input === 'object' ? input[layer.id] : null;
      if (!src || typeof src !== 'object') continue;
      for (const f of layer.fields) {
        if (!(f.key in src)) continue;
        let v = src[f.key];
        if (typeof v !== typeof f.value) { rejected++; continue; }
        if (f.type === 'range') {
          if (!Number.isFinite(v)) { rejected++; continue; }
          v = Math.min(f.max, Math.max(f.min, v));
        }
        if (f.type === 'select' && !f.options.some(([o]) => o === v)) { rejected++; continue; }
        s[layer.id][f.key] = v;
      }
    }
    return { state: s, rejected };
  }

  return { SCHEMA, RAMPS, PRESETS, field, defaults, build, sanitize };
})();
