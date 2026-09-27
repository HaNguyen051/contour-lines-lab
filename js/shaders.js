/*
 * shaders.js — Toàn bộ mã GLSL (WebGL 1 / GLSL ES 1.00).
 *
 * Cách đọc một fragment shader:
 *   main() chạy MỘT LẦN CHO MỖI PIXEL, song song trên GPU.
 *   vUv = toạ độ pixel (0,0 góc dưới trái → 1,1 góc trên phải). Nhân với uRes ra toạ độ px.
 *   gl_FragColor = màu của pixel.
 *   uniform = thông số JS gửi xuống, giống nhau cho mọi pixel (chính là các thanh trượt).
 *
 * Quy ước: ảnh xám lưu ở kênh r, 0 = MỰC đen, 1 = GIẤY trắng.
 * Mọi thông số px đã được JS nhân với k = cạnh dài / 1600 trước khi gửi xuống.
 */
window.CL = window.CL || {};

CL.shaders = (() => {
  'use strict';

  // Vertex shader dùng chung: đổi toạ độ đỉnh (-1..1) thành vUv (0..1).
  const vert = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  // Phần đầu dùng chung: độ chính xác + hàm tiện ích.
  const common = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;    // toạ độ px tới 2400 cần độ chính xác cao
#else
precision mediump float;
#endif
varying vec2 vUv;

// Độ sáng cảm nhận: mắt nhạy với xanh lá nhất.
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// "Hash without Sine" (Dave Hoskins): số giả ngẫu nhiên 0..1, cùng đầu vào → cùng kết quả.
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise 2D: số ngẫu nhiên ở 4 góc ô lưới, nội suy smoothstep ở giữa → nhiễu mượt 0..1.
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

  // ---------------------------------------------------------------------------
  // Tiện ích: chép, trộn, làm mờ
  // ---------------------------------------------------------------------------

  // Chép texture. Vẽ vào target nhỏ bằng nửa → lọc LINEAR tự lấy trung bình 2×2 (thu nhỏ ảnh).
  const copy = common + `
uniform sampler2D uTex;
void main() { gl_FragColor = texture2D(uTex, vUv); }`;

  // Trộn hai ảnh: kết quả = mix(uBase, uTex, uAmount).
  const mixer = common + `
uniform sampler2D uTex;
uniform sampler2D uBase;
uniform float uAmount;
void main() { gl_FragColor = mix(texture2D(uBase, vUv), texture2D(uTex, vUv), uAmount); }`;

  // Gaussian blur một chiều: 17 mẫu, offset i·radius/8 (i = −8..8), trọng số exp(−i²/18).
  // Chạy 2 lần (ngang rồi dọc) = blur 2 chiều, nhưng chỉ tốn 34 lần đọc thay vì 289.
  const blur = common + `
uniform sampler2D uTex;
uniform vec2  uDir;      // (1/rộng, 0) = ngang, (0, 1/cao) = dọc
uniform float uRadius;   // bán kính (px của texture đang đọc)
void main() {
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 18.0);
    sum += texture2D(uTex, vUv + uDir * fi * uRadius / 8.0) * w;
    wsum += w;
  }
  gl_FragColor = sum / wsum;
}`;

  // ---------------------------------------------------------------------------
  // BƯỚC 0 — Ảnh nguồn: thu phóng về độ phân giải xử lý, lót nền trắng dưới phần trong suốt.
  // ---------------------------------------------------------------------------
  const source = common + `
uniform sampler2D uImage;
void main() {
  vec4 c = texture2D(uImage, vUv);
  gl_FragColor = vec4(mix(vec3(1.0), c.rgb, c.a), 1.0);
}`;

  // ---------------------------------------------------------------------------
  // BƯỚC 1 — Chuyển động: camera shake → Elastic Grid (lưới hàng/cột đàn hồi) → rung nét → luma → Levels.
  // Chỉ đổi CHỖ ĐỌC ảnh. Chạy trước bước tách viền nên nét, ASCII, MacPaint, texture đều bám theo lưới.
  //
  // Elastic Grid: ảnh chia N cột × M hàng. JS (grid.js) tính vị trí từng đường lưới trên màn hình
  // (uGX, uGY, từ 0 đến 1). Mỗi ô phóng to/thu nhỏ đều theo kích thước ô, hai trục độc lập,
  // nên đường thẳng trong ô vẫn thẳng và không có chỗ nào bị xoắn.
  // ---------------------------------------------------------------------------
  const motion = common + `
uniform sampler2D uTex;       // ảnh bước 0
uniform vec2  uRes;           // kích thước ảnh (px)
uniform float uStep;          // số khung (đã qua frame drop), step % 4096
uniform float uT;             // thời gian đã làm tròn theo khung (giây), t % 1000
uniform float uAmp;           // rung nét: độ lệch tối đa (px), 0 = tắt
uniform float uFreq;          // rung nét: số ô nhiễu trên cạnh ngắn
uniform float uSpeed;         // rung nét: tốc độ trôi của nhiễu
uniform float uShake;         // camera shake: độ dịch tối đa (px)
uniform float uRot;           // camera shake: góc xoay tối đa (radian)
uniform float uZoom;          // phóng to quanh tâm (0.04 = 4%)
uniform float uBlack;         // Levels: điểm đen
uniform float uWhite;         // Levels: điểm trắng
// Elastic Grid: vị trí đường lưới trên màn hình, 0..1. Trục Y tính từ TRÊN xuống (như màn hình).
uniform float uGX[17];        // đường dọc thứ 0..uNX (0 = mép trái, uNX = mép phải)
uniform float uGY[17];        // đường ngang thứ 0..uNY (0 = mép trên, uNY = mép dưới)
uniform float uNX;            // số cột
uniform float uNY;            // số hàng

// Tra ngược trục X: điểm màn hình s nằm trong ô thứ i (giữa đường i và i+1)
// → toạ độ ảnh gốc = (i + vị trí tương đối trong ô) / số ô.
// WebGL1 không cho truyền mảng vào hàm, nên viết riêng invX và invY đọc thẳng uniform.
float invX(float s) {
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uNX) break;
    if (s <= uGX[i + 1]) return (float(i) + (s - uGX[i]) / max(uGX[i + 1] - uGX[i], 1e-5)) / uNX;
  }
  return 1.0;
}
float invY(float s) {
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uNY) break;
    if (s <= uGY[i + 1]) return (float(i) + (s - uGY[i]) / max(uGY[i + 1] - uGY[i], 1e-5)) / uNY;
  }
  return 1.0;
}

void main() {
  vec2 p = vUv * uRes;

  // 1. Camera shake: mỗi khung bốc ngẫu nhiên góc xoay + độ dịch, phóng to (1 + zoom) quanh tâm.
  vec2 c = 0.5 * uRes;
  float ang = (hash11(uStep + 3.31) * 2.0 - 1.0) * uRot;
  vec2 off = (vec2(hash11(uStep + 0.13), hash11(uStep + 7.77)) * 2.0 - 1.0) * uShake;
  vec2 d = (p - c) / (1.0 + uZoom);
  float cs = cos(ang), sn = sin(ang);
  p = c + vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y) + off;

  // 2. Elastic Grid: đổi sang toạ độ màn hình 0..1 (Y từ trên xuống), tra ngược từng trục.
  float sx = clamp(p.x / uRes.x, 0.0, 1.0);
  float sy = clamp(1.0 - p.y / uRes.y, 0.0, 1.0);
  vec2 uv = vec2(invX(sx), 1.0 - invY(sy));        // đổi Y về lại kiểu vUv (từ dưới lên)
  p = uv * uRes;

  // 3. Rung nét (tuỳ chọn, mặc định 0): dời điểm đọc theo 2 lớp nhiễu trôi theo thời gian.
  if (uAmp > 0.0) {
    float cell = min(uRes.x, uRes.y) / uFreq;
    vec2 q = p / cell;
    float tt = uT * uSpeed;
    vec2 dn = vec2(vnoise(q + vec2(tt, 1.7 * tt)),
                   vnoise(q + vec2(19.3 - 1.3 * tt, 7.1 + tt))) - 0.5;
    p += dn * 2.0 * uAmp;
  }

  // 4. Đọc ảnh, đổi sang xám, áp Levels.
  float l = luma(texture2D(uTex, clamp(p / uRes, 0.0, 1.0)).rgb);
  l = clamp((l - uBlack) / max(uWhite - uBlack, 0.001), 0.0, 1.0);
  gl_FragColor = vec4(vec3(l), 1.0);
}`;

  // ---------------------------------------------------------------------------
  // BƯỚC 2 — Threshold.
  // Edge: vẽ đường đồng mức tại "level" với độ dày đúng width px, nhờ công thức
  //   khoảng cách tới đường ≈ |v| / |gradient của v|.
  // Fill: mảng đen trắng.
  // ---------------------------------------------------------------------------
  const threshold = common + `
uniform sampler2D uTex;       // ảnh bước 1 đã làm mềm
uniform vec2  uRes;
uniform float uStep;
uniform float uK;             // hệ số độ phân giải (cạnh dài / 1600)
uniform float uLevel;         // ngưỡng sáng
uniform float uWidth;         // độ dày nét (px)
uniform float uRough;         // độ nhám: nhiễu cộng vào trước khi so ngưỡng → mép nét lởm chởm, sôi
uniform float uMode;          // 0 = edge, 1 = fill

// v > 0: phía sáng, v < 0: phía tối, v = 0: đúng đường viền.
float val(vec2 p) {
  float l = texture2D(uTex, p / uRes).r;
  return l + (vnoise(p / (3.0 * uK) + uStep * 17.0) - 0.5) * uRough - uLevel;
}

void main() {
  vec2 p = vUv * uRes;
  float v = val(p);
  if (uMode > 0.5) {
    gl_FragColor = vec4(vec3(smoothstep(-0.02, 0.02, v)), 1.0);
    return;
  }
  // Gradient bằng sai phân trung tâm ±1 px.
  vec2 g = vec2(val(p + vec2(1.0, 0.0)) - val(p - vec2(1.0, 0.0)),
                val(p + vec2(0.0, 1.0)) - val(p - vec2(0.0, 1.0))) * 0.5;
  float dist = abs(v) / max(length(g), 1e-4);                 // khoảng cách (px) tới đường viền
  float ink = 1.0 - smoothstep(uWidth * 0.5 - 0.5, uWidth * 0.5 + 0.5, dist);
  gl_FragColor = vec4(vec3(1.0 - ink), 1.0);
}`;

  // ---------------------------------------------------------------------------
  // BƯỚC 4 — ASCII: mỗi ô đo độ phủ mực, chọn ký tự trong atlas 8×8.
  // ---------------------------------------------------------------------------
  const ascii = common + `
uniform sampler2D uTex;       // ảnh bước 3
uniform sampler2D uAtlas;     // atlas 512×512, 8×8 ô 64 px, chữ trắng trên nền đen
uniform vec2  uRes;
uniform float uCell;          // cỡ ô (px)
uniform float uCount;         // số ký tự
uniform float uDensity;       // tỉ lệ ô được bật
uniform float uGain;          // khuếch đại độ phủ trước khi chọn ký tự
uniform float uMinCov;        // độ phủ tối thiểu để ô được xét
uniform float uJitter;        // độ lệch ngẫu nhiên khi chọn ký tự
uniform float uOpacity;       // độ đậm của ký tự
uniform float uKeep;          // 1 = giữ ảnh bước trước bên dưới ký tự, 0 = nền trắng
uniform float uF;             // hạt giống nhấp nháy: = step nếu flicker bật, 0 nếu tắt

void main() {
  vec2 px = vUv * uRes;
  vec2 cid = floor(px / uCell);         // ô thứ mấy
  vec2 local = fract(px / uCell);       // vị trí trong ô, 0..1

  // Độ phủ mực trung bình trên 4×4 mẫu.
  float cov = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0;
      cov += 1.0 - texture2D(uTex, (cid + o) * uCell / uRes).r;
    }
  }
  cov /= 16.0;

  float on = (cov >= uMinCov && hash21(cid + uF * 13.1) < uDensity) ? 1.0 : 0.0;
  float level = cov * uGain + (hash21(cid * 1.7 + uF * 3.3) - 0.5) * uJitter;
  float idx = floor(clamp(level, 0.0, 0.999) * uCount);

  // Vị trí ký tự idx trong atlas. Atlas đã lật dọc khi upload nên hàng 0 nằm ở trên cùng (v gần 1).
  float col = mod(idx, 8.0);
  float row = floor(idx / 8.0);
  vec2 lc = clamp(local, 0.06, 0.94);                         // chừa mép ô để không dính ký tự bên cạnh
  vec2 auv = vec2(col + lc.x, 7.0 - row + lc.y) / 8.0;
  float a = texture2D(uAtlas, auv, -0.5).r;                   // bias −0.5: bớt nhoè do mipmap ở mép ô
  float glyph = smoothstep(0.3, 0.7, a) * on * uOpacity;

  float base = mix(1.0, texture2D(uTex, vUv).r, uKeep);
  gl_FragColor = vec4(vec3(min(base, 1.0 - glyph)), 1.0);
}`;

  // ---------------------------------------------------------------------------
  // BƯỚC 5 — MacPaint: ô nào gần nét thì tô hoa văn 1-bit 8×8.
  // ---------------------------------------------------------------------------
  const macpaint = common + `
uniform sampler2D uTex;       // ảnh bước 4
uniform sampler2D uDensity;   // bản đồ mật độ = ảnh bước 3 đã blur rộng
uniform sampler2D uPatterns;  // 12 hoa văn 8×8 xếp ngang (96×8), trắng = mực
uniform vec2  uRes;
uniform float uStep;
uniform float uCell;          // cỡ ô (px, đã làm tròn)
uniform float uNorm;          // hệ số bù: nét mảnh bị blur nhạt đi, nhân lại cho về khoảng 0..1
uniform float uJitter;        // lệch ngẫu nhiên theo khung
uniform float uThreshold;     // ngưỡng bật ô
uniform float uPattern;       // 0..11 = hoa văn cố định, −1 = tự chọn theo mật độ
uniform float uScale;         // mỗi điểm hoa văn rộng bao nhiêu px
uniform float uBlend;         // độ trộn hoa văn
uniform float uKeep;          // 1 = giữ ảnh bước 4 bên dưới

void main() {
  vec2 px = vUv * uRes;
  vec2 cid = floor(px / uCell);
  vec2 c = (cid + 0.5) * uCell;          // tâm ô
  float o = 0.3 * uCell;

  // Mật độ trung bình tại tâm ô và 4 điểm lệch chéo.
  float m = texture2D(uDensity, c / uRes).r
          + texture2D(uDensity, (c + vec2( o,  o)) / uRes).r
          + texture2D(uDensity, (c + vec2(-o,  o)) / uRes).r
          + texture2D(uDensity, (c + vec2( o, -o)) / uRes).r
          + texture2D(uDensity, (c + vec2(-o, -o)) / uRes).r;
  m /= 5.0;

  float d = (1.0 - m) * uNorm + (hash21(cid + uStep * 0.37) - 0.5) * uJitter;
  float on = step(uThreshold, d);

  float idx = uPattern >= 0.0 ? uPattern : floor(clamp(d, 0.0, 0.999) * 12.0);
  vec2 pp = mod(floor(px / uScale), 8.0);                    // vị trí trong hoa văn 8×8
  float ink = texture2D(uPatterns, vec2((idx * 8.0 + pp.x + 0.5) / 96.0, (pp.y + 0.5) / 8.0)).r * on;

  float base = mix(1.0, texture2D(uTex, vUv).r, uKeep);
  gl_FragColor = vec4(vec3(mix(base, base * (1.0 - ink), uBlend)), 1.0);
}`;

  // ---------------------------------------------------------------------------
  // BƯỚC 6 — Texture: giấy (multiply) + nền tối photocopy + mép tờ giấy + tông ấm.
  // ---------------------------------------------------------------------------
  const texture = common + `
uniform sampler2D uTex;       // ảnh bước 5
uniform vec2  uRes;
uniform float uStep;
uniform float uS;             // = min(W, H) / 1000, giữ kích thước texture ổn định khi đổi độ phân giải
uniform float uDot;           // cỡ điểm hoa văn MacPaint (px), dùng làm khoảng lấy mẫu khi khoá nền
uniform float uDark;          // 1 = nền tối, 0 = giấy sáng
uniform float uKey;           // ngưỡng coi là "nền trắng"
uniform float uGrain;         // độ hạt
uniform float uStreaks;       // vệt quét ngang
uniform float uPaperEdge;     // mép tờ giấy sáng loang
uniform float uTone;          // tông ấm như giấy cũ

void main() {
  vec2 px = vUv * uRes;
  float s = uS;

  // Lớp giấy (multiply): hạt ngẫu nhiên + thớ ngang.
  float paper = 1.0 - uGrain * (0.16 * hash21(px + uStep * 7.13)
                             + 0.10 * vnoise(vec2(px.x * 0.02, px.y * 0.25) / s + uStep * 0.1));
  float img = texture2D(uTex, vUv).r;
  float bright = img * paper;

  // Khoá nền theo TRUNG BÌNH 3×3 điểm (bàn cờ MacPaint có pixel trắng tinh,
  // xét từng pixel thì khối xám bị thủng lỗ chỗ).
  float avg = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      avg += texture2D(uTex, (px + vec2(float(i), float(j)) * uDot) / uRes).r;
    }
  }
  avg /= 9.0;
  float bg = smoothstep(uKey - 0.03, uKey + 0.02, avg);

  // Nền tối: đen + vệt quét ngang (2 lớp) + hạt.
  float darkv = 0.055
    + 0.06 * uStreaks * vnoise(vec2(px.x * 0.003 / s, px.y * 0.8 / s + uStep * 5.0))
    + 0.035 * uStreaks * vnoise(vec2(3.7, px.y * 0.01 / s + uStep * 0.7))
    + 0.07 * uGrain * (hash21(px * 1.37 + uStep) - 0.5);

  // Mép tờ giấy: gần mép ảnh thì sáng loang, như tờ giấy đặt lệch trên máy scan.
  if (uPaperEdge > 0.0) {
    float m = min(uRes.x, uRes.y);
    float kc = min(min(px.x, uRes.x - px.x), min(px.y, uRes.y - px.y)) / m
             + (vnoise(px * 0.03 / s + uStep) - 0.5) * 0.012;
    float e = 1.0 - smoothstep(0.002, 0.002 + 0.016 * uPaperEdge, kc);
    darkv = mix(darkv, 0.62 + 0.2 * hash21(px + uStep * 3.1), e);
  }

  vec3 col = vec3(mix(bright, darkv, bg * uDark));
  col *= mix(vec3(1.0), vec3(1.0, 0.975, 0.93), uTone);
  gl_FragColor = vec4(col, 1.0);
}`;

  // ---------------------------------------------------------------------------
  // Hiển thị: chép bước đang xem ra canvas. Khi khung xem nhỏ hơn ảnh nhiều,
  // lấy trung bình 4×4 mẫu trong vùng uFoot px để hoa văn 1 px không bị vằn (moiré).
  // ---------------------------------------------------------------------------
  const display = common + `
uniform sampler2D uTex;
uniform vec2  uRes;
uniform float uFoot;          // cỡ vùng lấy trung bình (px); ≤ 1 = không lọc
void main() {
  if (uFoot <= 1.0) {
    gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0);
    return;
  }
  vec3 s = vec3(0.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0 - 0.5;
      s += texture2D(uTex, vUv + o * uFoot / uRes).rgb;
    }
  }
  gl_FragColor = vec4(s / 16.0, 1.0);
}`;

  return { vert, copy, mixer, blur, source, motion, threshold, ascii, macpaint, texture, display };
})();
