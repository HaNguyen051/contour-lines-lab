# Spec: Contour Lines Lab

> Bản này mô tả **đúng code hiện tại** (đối chiếu ngày 2026-09-30). Các giá trị mặc định lấy từ `js/presets.js`; khi sửa code nhớ sửa lại spec. Lịch sử các lần đổi hướng nằm ở mục cuối.

## 1. Nhiệm vụ

Web app "Contour Lines Lab" tái hiện hiệu ứng Contour Lines của Effect.app. Ảnh chụp đi qua chuỗi xử lý và ra:
- nét viền "sôi" (line boil);
- ký tự ASCII;
- khối xám kiểu MacPaint;
- nền photocopy tối;
- hoạt hình giật khoảng 7 hình/giây (đo từ video mẫu: 6,97);
- biến dạng "tấm thạch" do **con trỏ chuột** điều khiển: chỉ cần rê, không cần bấm; không đụng chuột thì ảnh đứng phẳng.

App chạy hoàn toàn trong trình duyệt. Giao diện có tiếng Việt và tiếng Anh. Chú thích code bằng tiếng Việt.

## 2. Ràng buộc kỹ thuật

- HTML + CSS + JavaScript thuần, WebGL 1 (GLSL ES 1.00). Không framework, không bundler, không thư viện JS ngoài.
- Script thường (không ES module), gắn mọi thứ vào `window.CL`. `index.html` chạy được cả khi nhấp đúp (`file://`) lẫn khi mở bằng Live Server.
- Khi mở bằng `file://`, WebGL không được đọc file ảnh nằm cạnh trang (SecurityError). Vì vậy ảnh dùng sẵn phải **sinh bằng code** hoặc **nhúng dạng data URI**. Ảnh người dùng đưa vào (chọn file, kéo thả, dán) thì không bị chặn.
- Shader viết thành chuỗi trong file JS, không fetch file `.glsl`.
- Fragment shader dùng `highp` nếu có `GL_FRAGMENT_PRECISION_HIGH`, ngược lại `mediump`. Đầu vào hash/noise giữ nhỏ (`step % 4096`, `t % 1000`).
- Context: thử lần lượt `webgl`, `experimental-webgl`, `webgl2` với `preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false`. Ghi lại `webglcontextcreationerror` để báo lý do khi không tạo được.
- Render target RGBA8, LINEAR, CLAMP_TO_EDGE. Ảnh nguồn upload với `UNPACK_FLIP_Y_WEBGL = true`.
- Ảnh xám lưu ở kênh r: 0 = mực đen, 1 = giấy trắng.
- Tham số đơn vị px tính cho ảnh cạnh dài 1600 px; nhân `k = cạnh dài thực / 1600`. Riêng sai phân tính gradient giữ đúng 1 px thật.
- Texture, hoa văn, atlas ký tự và ảnh mẫu cành gai đều sinh bằng code; không dùng texture của Effect.app.
- **Ngoại lệ hiện có, cần người dùng quyết định:** ảnh mở sẵn `assets/xuong-rong.jpg` (nhúng trong `js/sample-image.js`) chính là ảnh cành gai trong bài đăng mẫu. Quy tắc cũ của spec là *không* nhúng ảnh đó vào app. Dùng để học thì được; nếu phát hành rộng rãi thì nên thay bằng ảnh có quyền dùng (`make-sample.py`).
- Font Be Vietnam Pro nạp từ Google Fonts là tài nguyên mạng duy nhất; có font dự phòng `system-ui, "Segoe UI", sans-serif`.
- Công cụ phụ viết bằng Python 3 (`build.py`, `make-i18n.py`, `make-sample.py`) chỉ dùng khi sửa bản dịch, đổi ảnh mở sẵn hoặc đóng gói. App chạy không cần chúng.

## 3. Cấu trúc file

```
index.html            khung trang
css/style.css         giao diện
js/i18n.js            từ điển Việt → Anh + CL.t()        (sinh bởi make-i18n.py)
js/gl.js              tiện ích WebGL (program, texture, uploadData, target, setUniforms)
js/shaders.js         toàn bộ GLSL
js/textures.js        atlas ký tự, 12 hoa văn MacPaint, ảnh mẫu cành gai
js/presets.js         schema tham số + preset
js/pipeline.js        chạy chuỗi pass
js/ui.js              tự sinh bảng điều khiển (có mục "Nâng cao"), thanh 7 bước, toast
js/grid.js            Elastic Grid: tấm thạch 2D do con trỏ điều khiển
js/interact.js        ghi lại vị trí con trỏ, giao cho grid.js
js/export.js          PNG, video, preset JSON
js/sample-image.js    ảnh mở sẵn dạng data URI               (sinh bởi make-sample.py)
js/main.js            khởi động, vòng lặp, khung hình, ngôn ngữ, nhận ảnh, phím tắt, mất GPU
assets/xuong-rong.jpg ảnh mở sẵn (nguồn của sample-image.js)
assets/thorns.jpg     cùng ảnh, bản nhỏ; không dùng
build.py              gộp mọi thứ thành contour-lines-lab.html
make-i18n.py          bảng dịch (≈196 cặp) → js/i18n.js
make-sample.py        ảnh mới → assets/xuong-rong.jpg + js/sample-image.js
contour-lines-lab.html bản gộp một file                      (sinh bởi build.py)
manifest.webmanifest  thông tin web app ("Thêm vào màn hình chính")
icons/                apple-touch-icon.png (180), icon-192.png, icon-512.png — vẽ bằng code
.nojekyll             file rỗng cho GitHub Pages
README.md, HUONG_DAN.md, HUONG_DAN_DIEN_THOAI.md, SPEC_ContourLinesLab.md
```

Thứ tự nạp trong `index.html`: `i18n.js` → `gl.js` → `shaders.js` → `textures.js` → `presets.js` → `pipeline.js` → `ui.js` → `grid.js` → `interact.js` → `export.js` → `sample-image.js` → `main.js`.

## 4. Hàm dùng chung

- `hash11` / `hash21` theo "Hash without Sine" (Dave Hoskins).
- Value noise 2D nội suy smoothstep.
- `luma = 0.299R + 0.587G + 0.114B`.
- Gaussian blur tách đôi: lượt ngang rồi dọc, 17 mẫu, offset `i·radius/8` (i = −8..8), trọng số `exp(−i²/18)` (sigma = 0.375·radius).
- Blur bán kính lớn: khi `radius/8 > 1.5` px thì thu nhỏ ảnh 2× (lấy trung bình 2×2 nhờ lọc LINEAR), lặp tới khi đủ dày mẫu, blur ở ảnh nhỏ rồi đọc lại bằng LINEAR. Bắt buộc với bản đồ mật độ bước 5 để không ra sọc.

## 5. Pipeline

Mỗi bước gồm một hoặc nhiều pass, ghi kết quả cuối vào render target riêng (`s0`…`s6`, cộng `tmpA`, `tmpB` và các target nhỏ cho blur). Bước bị tắt thì đi thẳng: kết quả của nó là kết quả bước trước. Bước 0 chỉ chạy lại khi đổi ảnh hoặc đổi kích thước.

### Trước bước 0: khung hình (CPU)

`main.js` cắt ảnh gốc theo khung đang chọn (mục 9) rồi mới upload. Pipeline không biết gì về khung hình.

### Bước 0: Ảnh nguồn

Thu phóng sao cho cạnh dài = độ phân giải đang chọn (1080 / 1600 / 2400, không vượt `MAX_TEXTURE_SIZE`), lót nền trắng dưới phần trong suốt: `mix(1, màu, alpha)`.

### Bước 1: Chuyển động

- Frame drop: `step = floor(time·fps)`; nếu `loop > 0` thì `step %= round(loop·fps)`. `t = step/fps`. Truyền `step % 4096`, `t % 1000`.
- Thứ tự cho mỗi pixel:
  1. **Camera shake:** mỗi step bốc ngẫu nhiên độ lệch trong `[−shake, shake]` px và góc trong `[−rot, rot]` độ; phóng to `(1 + zoom%)` quanh tâm.
  2. **Elastic Grid:** đổi sang toạ độ màn hình 0..1 (Y từ trên xuống), tra bảng biến dạng `uWarp` (mục 6) ra chỗ đọc ảnh gốc `q`, đổi Y về kiểu vUv.
  3. **Rung nét** (tuỳ chọn, mặc định 0): `cell = min(W,H)/freq`, `disp = (noise(q + (tt, 1.7·tt)), noise(q + (19.3 − 1.3·tt, 7.1 + tt))) − 0.5`, `p += disp·2·amp`.
  4. Đọc ảnh (clamp), đổi sang luma, áp Levels: `clamp((l − black)/(white − black), 0, 1)`.

### Bước 2: Threshold

- Làm mềm trước bằng Gaussian bán kính `soften`.
- `v = l + (noise(p/(3k) + step·17) − 0.5)·rough − level`.
- Edge: `grad` bằng sai phân trung tâm ±1 px; `dist = |v| / max(|grad|, 1e−4)`; `ink = 1 − smoothstep(width·k/2 − 0.5, width·k/2 + 0.5, dist)`; xuất `1 − ink`.
- Fill: xuất `smoothstep(−0.02, 0.02, v)`.

### Bước 3: Gaussian blur

Làm mờ ảnh nét với bán kính `radius`, xuất `mix(nét, nét_mờ, opacity)`.

### Bước 4: ASCII

- Lưới ô cỡ `cell`. `cov` = trung bình `(1 − ảnh)` trên 4×4 mẫu trong ô. `f = step` nếu flicker bật, ngược lại 0.
- Bật ô nếu `cov ≥ minCov` và `hash21(ô + f·13.1) < density`.
- `level = cov·gain + (hash21(ô·1.7 + f·3.3) − 0.5)·jitter`; `idx = floor(clamp(level, 0, 0.999)·số ký tự)`.
- Atlas 512×512 = 8×8 ô 64 px (tối đa 64 ký tự; dài hơn thì cắt và báo), chữ trắng nền đen, monospace đậm 58 px, có mipmap. `█ ▌ ▮` vẽ bằng `fillRect`; `░ ▒ ▓` bằng chấm 4 px bật 25/50/75%. Đọc atlas với bias −0.5.
- Toạ độ trong ô clamp `[0.06, 0.94]`; `glyph = smoothstep(0.3, 0.7, atlas)·bật·opacity`; xuất `min(mix(1, ảnh, keep), 1 − glyph)`.

### Bước 5: MacPaint

- Cỡ ô `cellPx = cell·k`, rồi:
  - `track = "video"` (mặc định): nhân `K(t)/18`, với `t = step/fps % 6` và `K` nội suy smoothstep qua các mốc (giây; px): (0; 18), (0.9; 9), (1.4; 10), (2.2; 40), (3.0; 10), (3.5; 12), (4.2; 45), (5.4; 18), (6.0; 18).
  - `track = "off"` và Chuyển động đang bật: nhân `1 + (hash(step) − 0.5)·2·animate`.
  - Làm tròn, tối thiểu 2.
- Bản đồ mật độ: blur ảnh bước 3 với `rcov = cellPx·(0.75 + spread)` (theo quy tắc thu nhỏ ở mục 4).
- `norm = (0.375·rcov·2.5066) / max(width·k, 0.75)` nếu Threshold bật và ở chế độ edge, ngược lại 1.
- `d = (1 − trung bình 5 mẫu mật độ tại tâm ô và 4 điểm lệch (±0.3, ±0.3) ô)·norm + (hash21(ô + step·0.37) − 0.5)·jitter`. Bật ô nếu `d ≥ threshold`.
- Tô hoa văn 1-bit 8×8, mỗi điểm rộng `scale` px. `pattern` cố định hoặc −1 = tự động: `idx = floor(clamp(d, 0, 0.999)·12)`.
- `nền = mix(1, ảnh bước 4, keep)`; xuất `mix(nền, nền·(1 − ink), blend)`.
- 12 hoa văn (hex từng hàng, bit 1 = mực):

| # | Tên | Hex |
|---|---|---|
| 0 | Chấm thưa | 80 00 00 00 08 00 00 00 |
| 1 | Chấm lưới | 88 00 22 00 88 00 22 00 |
| 2 | Sọc chéo mảnh | 01 02 04 08 10 20 40 80 |
| 3 | Lưới 25% | 88 22 88 22 88 22 88 22 |
| 4 | Sọc ngang | FF 00 00 00 FF 00 00 00 |
| 5 | Đan chéo | 81 42 24 18 18 24 42 81 |
| 6 | Gạch | FF 80 80 80 FF 08 08 08 |
| 7 | Bàn cờ 50% | AA 55 AA 55 AA 55 AA 55 |
| 8 | Sọc chéo dày | 0F 1E 3C 78 F0 E1 C3 87 |
| 9 | Dày 75% | 77 DD 77 DD 77 DD 77 DD |
| 10 | Gần đặc | FF DD FF 77 FF DD FF 77 |
| 11 | Đặc | FF FF FF FF FF FF FF FF |

### Bước 6: Texture

Với `s = min(W,H)/1000`:
- **Giấy (multiply):** `paper = 1 − grain·(0.16·hash21(pixel + step·7.13) + 0.10·noise((x·0.02, y·0.25)/s + step·0.1))`; `sáng = ảnh·paper`.
- **Khoá nền** theo trung bình 3×3 điểm (khoảng cách = cỡ điểm hoa văn MacPaint, tối thiểu 1 px): `bg = smoothstep(key − 0.03, key + 0.02, trung bình)`.
- **Nền tối:** `0.055 + 0.06·streaks·noise(x·0.003/s, y·0.8/s + step·5) + 0.035·streaks·noise(3.7, y·0.01/s + step·0.7) + 0.07·grain·(hash − 0.5)`.
- **Mép tờ giấy** (khi `paperEdge > 0`): `kc` = khoảng cách tới mép (đơn vị cạnh ngắn) + `(noise(p·0.03/s + step) − 0.5)·0.012`; `e = 1 − smoothstep(0.002, 0.002 + 0.016·paperEdge, kc)`; `nền tối = mix(nền tối, 0.62 + 0.2·hash, e)`.
- Xuất `mix(sáng, nền tối, bg·dark) × mix((1,1,1), (1, 0.975, 0.93), tone)`.

### Hiển thị

- Canvas luôn có kích thước thật bằng độ phân giải xử lý; CSS `object-fit: contain` co vừa khung.
- Chống moiré: khi `kích thước CSS × devicePixelRatio / kích thước thật < 0.8`, pass hiển thị lấy trung bình 4×4 mẫu trong vùng `1/tỉ lệ` px. Tắt khi lưu PNG và khi quay video. Tính lại khi khung đổi cỡ (`ResizeObserver`).
- Khi pipeline không cần chạy lại nhưng đang quay video hoặc lọc moiré đổi, chỉ chạy lại pass hiển thị.

## 6. Elastic Grid: tấm thạch 2D do con trỏ điều khiển

Mã nguồn: `js/grid.js` (mô hình), `js/interact.js` (nhận con trỏ), đầu shader `motion` (tra bảng). Con trỏ là **nguồn chuyển động duy nhất** của lưới: không có nhịp tự chạy, không có kéo/thả, không có chạm nhanh.

### 6.1. Lưới nút

- Nút (i, j), i = 0..N (cột, mặc định N = 5), j = 0..M (hàng, mặc định M = 8), nằm cố định trên màn hình tại `s = (i/N, j/M)`, Y từ trên xuống.
- Giá trị tại nút là `q` = chỗ đọc ảnh gốc (0..1) cho điểm màn hình đó. Nghỉ thì `q = s`. Shader chỉ tra bảng, không giải ngược.
- Lúc mở trang (và khi đổi số cột/hàng) nút được đặt thẳng vào đích; năng lượng bằng 0 nên lưới phẳng.

### 6.2. Đích: bướu lẻ tại con trỏ

Mỗi trục có trạng thái `{u, K, sg}`. Vị trí đường lưới trên màn hình:

```
p(r) = r + K · bump((r − u) / sg) · sin(π r)
bump(t) = t · e^(0.5 − t²/2)
```

- `bump` là hàm lẻ: `bump(0) = 0` nên chỗ ngay dưới con trỏ đứng yên; hai bên ngược dấu nên cùng bị kéo về phía con trỏ khi `K < 0`. Quá khoảng 3·sg thì gần như hết ảnh hưởng.
- `sin(π r)` giữ hai mép đứng yên kể cả khi con trỏ sát mép.
- `p(0) = 0`, `p(n) = 1`; quét xuôi rồi ngược giữ khoảng cách tối thiểu `0.3/n` giữa hai đường.
- Tra ngược `p` ra đích của từng nút theo trục: `tqx[i] = inv(i/N)`, `tqy[j] = inv(j/M)`.

### 6.3. Con trỏ → đích (`stepCursor`, mỗi khung hình một lần)

- `interact.js` nghe `pointermove` trên `window` (không cần bấm), đổi `clientX/Y` sang toạ độ khung 0..1 có trừ viền trống của `object-fit: contain`. Kết quả `getBoundingClientRect()` được nhớ lại, chỉ bỏ khi `resize`, `scroll` hoặc canvas đổi cỡ.
- Con trỏ ra ngoài khung quá 0.15 (theo đơn vị khung), chuột rời trang (`pointerleave`) hoặc cửa sổ mất focus (`blur`) → `pointerOut()`. Lớp tắt cũng gọi `pointerOut()`.
- Vị trí đọc **thô**, không làm mượt; độ trễ đến từ vật lý.
- **Ngón tay / bút** (`pointerType !== 'mouse'`):
  - chỉ nhận ngón **đặt xuống trên vùng ảnh** (`pointerdown` trên canvas, không tính viền trống), và chỉ ngón đầu tiên (nhớ `pointerId`, `setPointerCapture`);
  - lúc đặt xuống gọi `pointerOut()` rồi `pointer()` để không tính quãng từ lần nhấc tay trước;
  - `pointermove` của đúng ngón đó → `pointer()` (ra ngoài khung vẫn theo, `grid` kẹp 0..1);
  - `pointerup` / `pointercancel` → `pointerOut()`;
  - `pointermove` của ngón khác (ví dụ đang kéo thanh trượt) bị bỏ qua.
- `document` `pointerleave` chỉ xử lý chuột; `window` `blur` huỷ cả ngón tay đang giữ.
- Mỗi khung khi đang chạy:
  - `energy = min(1, energy + quãng_con_trỏ_vừa_đi · sens)`; quãng đo bằng `hypot(dx, dy·(H/W))` để ảnh dọc không méo. Vừa vào khung thì không tính cú nhảy vào.
  - `energy *= exp(−dt / hold)`; nhỏ hơn 1e−4 thì về 0. Ngừng rê (kể cả khi con trỏ còn trong khung) thì ảnh tự về phẳng.
  - `K = amp · energy · (attract ? −1 : +1)`; trục X: `u = sx`, `sg = span`; trục Y: `u = sy`, `sg = span / (H/W)` để vùng ảnh hưởng tròn trên màn hình.
- Đang dừng (Space): không nạp, không tiêu, giữ nguyên hình; vẫn cập nhật vị trí cũ của con trỏ để khi chạy lại không bị một cú nhảy.

### 6.4. Vật lý (bước cố định 1/120 s, mỗi khung tối đa 0.1 s)

Với `e = q − đích`:

```
e'' = −ω₀²·e + c²·∇²e − 2ζω₀·e' + β·c²·∇²e'        β = 0.18 s
ω₀ = 2π · (2.5 · 0.14^soft) Hz     ζ = 1.2 − 0.9·bounce     c = 2.0 · jelly
```

- `∇²` dùng 4 hàng xóm, bước `1/N`, `1/M`; ra ngoài mép thì soi gương.
- Trần ổn định tự động: `c²/hx² + c²/hy² ≤ 0.45/dt²`; `β·(kx + ky)·dt ≤ 0.5`.
- Biên: 4 góc ghim; nút cạnh trái/phải giữ `q.x` = 0/1, `q.y` tự do; cạnh trên/dưới ngược lại. Viền ảnh không bao giờ hở.
- Sau mỗi bước: kẹp `|q − đích| ≤ 0.40`; quét giữ `q` tăng dần theo hàng và cột với khoảng hở tối thiểu `0.22/N`, `0.22/M`; nút bị chặn thì `v *= 0.5`.
- `jelly = 0` → các nút rời nhau, mỗi hàng/cột chạy riêng (không còn độ trễ lan truyền).
- `update()` trả về `moving` (có `|v| > 0.0015`) và `smooth = interactive && (moving || energy > 0)`.

### 6.5. Bảng tra và shader

- CPU nội suy Catmull-Rom lưới nút lên bảng 65×65 (hai lượt: theo X rồi theo Y), nén 16 bit mỗi trục vào RGBA8 (`R,G` = byte cao/thấp của X; `B,A` = của Y). Upload bằng `gl.uploadData` mỗi lần vẽ pipeline, lọc NEAREST, không lật dọc.
- Shader: `uniform sampler2D uWarp` (khai báo `highp` khi có), `uniform float uWarpN, uWarpOn`. `warpTexel` giải nén `(R·256 + G)/257`; `warpAt` nội suy song tuyến 4 texel. Lớp tắt → `uWarpOn = 0`, đọc thẳng.
- `lines()` trả về các đường lưới dạng chuỗi điểm (đường cong) cho lớp "Hiện lưới".

### 6.6. Vòng lặp vẽ

- Vật lý chạy mỗi `requestAnimationFrame`.
- Vẽ lại pipeline khi: `step` đổi (Frame drop), tham số đổi, hoặc (*Mượt khi tương tác* bật và `smooth` đúng) → mỗi khung.
- Đang dừng: `update()` trả `smooth = false`, không vẽ lại; rê chuột cũng không biến dạng.
- Lớp "Hiện lưới" (phím G) vẽ trên canvas 2D riêng `#gridOverlay` phủ đúng vùng ảnh, màu xanh `rgba(40,170,255,0.9)`; không lọt vào PNG hay video.

## 7. Tham số

Ghi theo dạng: giá trị mặc định (khoảng). ✦ = nằm trong mục "Nâng cao" gập lại ở cuối lớp (cờ `adv: true`).

- **source (0 Ảnh gốc):** black 0.42 (0–0.9); white 0.85 (0.1–1).
- **motion (1 Chuyển động):** bật; fps 7 (2–30); shake 10 px (0–40); zoom 3.5% (0–15); ✦ amp "Rung nét" 0 px (0–40); ✦ freq 2.4 (0.5–10); ✦ speed 2.4 (0–6); ✦ rot 0.6° (0–5); ✦ loop 0 giây (0–12).
- **grid (Elastic Grid, không có nút xem bước):** bật; amp "Độ co giãn" 0.2 (0–0.3); span "Vùng ảnh hưởng" 0.84 (0.1–1); jelly "Độ dẻo" 0.58 (0–1); soft "Độ mềm" 1 (0–1); bounce "Độ nảy" 0.73 (0–1); sens "Độ nhạy chuột" 15.5 (1–20); hold "Thời gian về phẳng" 3 giây (0.05–3); attract "Chuột hút vào" bật; ✦ cols 5 (2–16); ✦ rows 8 (2–16); ✦ smooth bật; ✦ showGrid tắt.
- **threshold (2):** bật; mode edge (edge | fill); soften 19.5 px (0–20); level 0.5 (0.05–0.95); width 1.6 px (0.5–6); ✦ rough 0.065 (0–0.3).
- **blur (3):** bật; radius 6 px (0–24); opacity 0.3 (0–1).
- **ascii (4):** bật; ramp `.'-*/|1tvouqdQ69G&$%#@RBMW▮▌█`; cell 15 px (6–40); density 0.7 (0–1); ✦ gain 5 (0.5–12); ✦ minCov 0.035 (0–0.3); ✦ jitter 0.45 (0–1); ✦ opacity 1; ✦ keep 1; ✦ flicker bật.
- **macpaint (5):** bật; pattern 7 "Bàn cờ 50%" (−1 = tự động, 0–11); cell 20 px (4–60); blend 0.4 (0–1); ✦ track "video" (video | off); ✦ animate 0.45 (0–1); ✦ spread 0.35 (0–2); ✦ threshold 0.35 (0.02–1); ✦ jitter 0.12 (0–0.6); ✦ scale 1 px (1–8); ✦ keep 1.
- **texture (6):** bật; dark 1; grain 0.5; streaks 0.6; ✦ key 0.9 (0.5–0.99); ✦ paperEdge 0.5; ✦ tone 0.25 (các khoảng còn lại 0–1).

**Bộ ký tự dựng sẵn:** Contour Lines (mặc định), Paul Bourke `" .:-=+*#%@"`, khối `"░▒▓█"`, `"MW▮█"`, chữ số `"1742356980"`, cộng một ô nhập tự do. Ký tự lặp bị bỏ, dài quá 64 thì cắt.

## 8. Preset

Preset = mặc định + phần khác biệt:

- **Contour Lines (giống video):** motion.amp 0; grid bật; macpaint.track "video".
- **Bản tĩnh:** tắt Chuyển động; tắt Elastic Grid; flicker tắt; macpaint animate 0, track "off".
- **Giấy sáng:** dark 0, grain 0.35, paperEdge 0.
- **Chỉ nét viền:** tắt ASCII, MacPaint, Texture.
- **ASCII dày:** cell 11, density 1, gain 7, jitter 0.6.
- **ASCII cổ điển:** tắt Threshold (soften 1), tắt blur, ramp Bourke, cell 12, density 1, gain 1.3, minCov 0.02, jitter 0, keep 0, flicker tắt, tắt MacPaint, dark 0, paperEdge 0.
- **Dither MacPaint:** tắt Threshold (soften 2), tắt blur và ASCII, pattern −1, cell 6, spread 0, threshold 0.08, jitter 0, scale 2, blend 1, keep 0, animate 0, track "off", dark 0, paperEdge 0.

Đổi bất kỳ tham số nào thì ô preset chuyển thành "Tuỳ chỉnh". File preset: JSON `{app: "contour-lines-lab", version: 1, state}`; khi mở chỉ nhận khoá có trong schema, đúng kiểu; số bị kẹp trong khoảng; giá trị ô chọn phải thuộc danh sách; thiếu khoá thì dùng mặc định. File của ứng dụng khác bị từ chối.

## 9. Khung hình

- Ô **Khung** trên thanh công cụ: Theo ảnh gốc (mặc định), 1:1, 4:5, 3:4, 2:3, 9:16, 4:3, 3:2, 16:9.
- Cắt kiểu *cover* trên CPU (`frameSource()`): giữ trọn một chiều, xén cân chiều còn lại từ giữa. Không dùng *contain*, vì hiệu ứng cần tràn viền.
- Luôn cắt từ ảnh gốc chưa cắt (`sourceRaw`), nên đổi qua lại không mất dần chất lượng.
- Cạnh dài vẫn theo ô *Xử lý*. Ví dụ ảnh 1200×1600: 1:1 → 1600×1600; 9:16 → 900×1600; 16:9 → 1600×900. PNG và video xuất đúng cỡ đó.

## 10. Ngôn ngữ

- Nút **VI | EN** ở thanh công cụ và ở thanh nổi chế độ xem.
- Lần đầu: `localStorage['cl-lang']` nếu có, ngược lại theo `navigator.language` (bắt đầu bằng "vi" → tiếng Việt, còn lại → tiếng Anh). Bấm đổi thì lưu vào `localStorage` (chế độ riêng tư chặn thì bỏ qua).
- `CL.t(chuỗi_tiếng_Việt, ...tham_số)`: từ điển `CL.EN` khoá bằng chính chuỗi tiếng Việt; thiếu bản dịch thì trả lại tiếng Việt; `%1`, `%2` là chỗ điền tham số.
- Chữ tĩnh trong `index.html` được chụp lại bản gốc tiếng Việt lúc nạp, mỗi lần đổi ngôn ngữ dịch lại từ bản gốc đó. Bảng điều khiển, thanh bước và các ô chọn được dựng lại rồi đẩy lại giá trị: đổi ngôn ngữ không mất thiết lập, ảnh hay biến dạng đang có.
- Bảng dịch nằm trong `make-i18n.py`; sửa chữ tiếng Việt trong mã thì phải sửa khoá tương ứng ở đó. Tài liệu `.md` chưa dịch.

## 11. Ảnh mở sẵn và ảnh mẫu

- **Ảnh mở sẵn:** `CL.sampleImageData` (data URI JPEG trong `js/sample-image.js`), nạp khi khởi động. Thiếu hoặc lỗi thì dùng ảnh mẫu vẽ bằng code.
- `make-sample.py <ảnh>`: thu ảnh về cạnh dài 1600 px, JPEG chất lượng 82, lưu `assets/xuong-rong.jpg`, sinh lại `js/sample-image.js`. Bước thu nhỏ dùng `sips` (chỉ có trên macOS). Chạy không kèm đường dẫn thì chỉ nhúng lại ảnh đang có trong `assets/`.
- **Ảnh mẫu** (nút *Ảnh mẫu mới*, đổi seed) vẽ bằng Canvas 2D, 1200×1600:
  - nền gradient `#e8e8e5` → `#cdcdc9`;
  - 3–5 cành đen `#121212` dày 70–120 px, lượn dài qua khung, thon dần 55%, ngọn thon thành gai, thường rẽ một nhánh to;
  - gai dài 1.6–3.8 lần độ dày cành, chân loe liền mạch với thân (Bézier bậc 3), mọc theo đốt cách nhau 130–280 px, mỗi đốt 1–3 gai;
  - vệt sáng mờ phía nguồn sáng (vẽ lên canvas phụ rồi blur 1 lần) và lớp hạt nhiễu nhẹ.

## 12. Giao diện

- **Chế độ xem** (mặc định khi mở): canvas toàn khung + thanh nút nổi (Tải ảnh · ⏸/▶ · Lưu PNG · VI|EN · ⚙ Tuỳ chỉnh) + dòng gợi ý thao tác, tự ẩn sau 6 giây.
- **Chế độ tuỳ chỉnh** (⚙ hoặc phím H):
  - thanh công cụ: Preset · Tải ảnh lên · Ảnh mẫu mới · ⏸/▶ · Lưu PNG · độ dài video (3/4/6/10 giây, 1 vòng lặp) · Quay video · Lưu preset · Mở preset · Khung · Xử lý (1080/1600/2400) · Chú thích · VI|EN · ✕ Chế độ xem;
  - thanh 7 nút "0 Ảnh gốc … 6 Texture" dưới canvas, mặc định bước 6;
  - bảng điều khiển 372 px bên phải, tự sinh từ schema: mỗi lớp có số bước (hoặc ✦), tên, mô tả, công tắc bật/tắt, thanh trượt hiện giá trị, chú thích từng tham số (ẩn được bằng ô "Chú thích"), mục "Nâng cao" gập lại.
- **Phím tắt** (không chạy khi đang gõ trong ô nhập, hoặc khi giữ Ctrl/Cmd/Alt): Space dừng/chạy, 0–6 đổi bước, H bật/tắt tuỳ chỉnh, G hiện/ẩn lưới, Ctrl+V dán ảnh.
- `prefers-reduced-motion` → mở ở trạng thái dừng, kèm thông báo.
- **Phong cách:** tông máy photocopy (nền `#d5d1c5`, khung xem `#2c2c29`, nút chính `#1d7f47`), font Be Vietnam Pro, có dark mode; dưới 960 px thì xếp dọc.
- Nút trong thanh nổi có icon SVG vẽ sẵn (không tải thêm gì) kèm chữ.

### 12.1. Điện thoại

- **Khi nào bật:** `@media (max-width: 760px), (max-height: 520px) and (pointer: coarse)` — điện thoại dựng dọc, hoặc xoay ngang. Máy tính và iPad giữ bố cục trên.
- **Chung:** `height: 100dvh` (dự phòng `100vh`), không cuộn trang (`overflow: hidden`, `overscroll-behavior: none`); `viewport-fit=cover` + `env(safe-area-inset-*)` để tránh tai thỏ và vạch Home; ẩn thanh công cụ; nút và vùng chạm ≥ 44 px; ô chọn / ô nhập cỡ chữ 16 px (iOS không tự phóng to); `touch-action: manipulation` cho nút; `-webkit-touch-callout: none` trên ảnh.
- **Chế độ xem:** ảnh toàn màn hình, chừa 80 px dưới cho thanh nút. Thanh nút rộng tối đa 440 px, luôn hiện rõ (không mờ như trên máy tính), 4 nút: Tải ảnh · ⏸/▶ · Lưu PNG · Tuỳ chỉnh (icon trên, chữ dưới, cao 56 px). VI|EN chuyển vào bảng Tuỳ chỉnh. Dòng gợi ý dùng bản "vuốt ngón tay" (`@media (hover: none) and (pointer: coarse)`).
- **Chế độ tuỳ chỉnh (bảng trượt):**
  - khung ảnh cao 46% màn hình, thanh 7 bước thành một hàng vuốt ngang;
  - `.sheet` bo góc trên 18 px, đổ bóng, trượt lên khi mở (0.28 s), chiếm phần còn lại;
  - đầu bảng: thanh nắm (kéo xuống quá 70 px thì đóng, chưa đủ thì trượt về) · hàng "Tuỳ chỉnh · VI|EN · Xong" · hàng "Tải ảnh · Lưu PNG · ⏸/▶";
  - các lớp mở ra ở trạng thái **gập** (`createUI({ collapsed: isPhone })`), chạm tên lớp để mở;
  - thông báo (toast) hiện ở trên cùng thay vì dưới đáy.
- **Xoay ngang:** chế độ tuỳ chỉnh thành hai cột (ảnh 55% trái, bảng 45% phải, không có thanh nắm); toast nằm trên vùng ảnh.
- **Nhận diện trong JS:** `isTouch = (pointer: coarse) || maxTouchPoints > 0`; `isPhone = isTouch && min(screen.width, screen.height) < 700`. Điện thoại: độ phân giải xử lý mặc định **1080 px**, các lớp gập sẵn. `<html>` có class `is-touch`.
- **Chưa có trên điện thoại** (chỉ có trên máy tính): preset, khung hình, độ phân giải, quay video, lưu/mở preset, ảnh mẫu mới, ô "Chú thích".

### 12.2. Web app và GitHub Pages

- `<head>`: `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style = black-translucent`, `apple-mobile-web-app-title = Contour Lines`, `theme-color = #2c2c29`.
- Thẻ `manifest`, `apple-touch-icon`, `icon` chỉ được gắn bằng script khi `location.protocol` là http(s); mở bằng `file://` thì không gắn, để không báo lỗi đỏ.
- `manifest.webmanifest`: `display: standalone`, `start_url` và `scope` là `./`, nền `#121211`, màu chủ đạo `#2c2c29`, icon 192 và 512 (512 thêm bản `maskable`).
- `.nojekyll` ở thư mục gốc. Địa chỉ Pages: `https://hanguyen051.github.io/contour-lines-lab/`. Chưa có service worker (cần mạng mỗi lần mở).
- Hướng dẫn đầy đủ: `HUONG_DAN_DIEN_THOAI.md`.

## 13. Nhận ảnh

- Ba đường vào: nút chọn file, kéo thả (vào đâu trong trang cũng được), `Ctrl+V`.
- Không lọc theo `file.type`; để trình duyệt thử giải mã, lỗi thì báo lý do.
- HEIC/HEIF (theo type hoặc đuôi file): **vẫn thử giải mã** (iOS thường tự đổi sang JPEG khi chọn từ Thư viện ảnh, Safari 17+ đọc được HEIC); chỉ khi giải mã hỏng mới báo lỗi riêng cho HEIC, gợi ý đổi JPG/PNG hoặc chụp màn hình.
- Kéo ảnh từ trang web khác (không có file): báo trình duyệt chặn vì bảo mật, gợi ý lưu ảnh hoặc dán.
- Ảnh lớn hơn `min(2400, MAX_TEXTURE_SIZE)` thì thu nhỏ bằng canvas 2D trước khi cắt khung và upload.
- Reset `input.value` sau mỗi lần chọn. Mọi thông báo là toast ở cuối màn hình, không dùng `alert`.

## 14. Báo lỗi

- Không tạo được WebGL: báo lý do trình duyệt đưa ra (nếu có) và 4 bước xử lý (bật tăng tốc đồ hoạ, xem `chrome://gpu`, tắt tiện ích chặn WebGL, thử trình duyệt khác).
- Shader lỗi: hiện log kèm mã nguồn đánh số dòng.
- Mất context GPU: `preventDefault` trong `webglcontextlost`, báo toast; khi `webglcontextrestored` thì tạo lại toàn bộ tài nguyên và upload lại ảnh đang giữ trên CPU.

## 15. Xuất file

- **PNG:** vẽ lại khung hiện tại không lọc moiré. Đang dừng thì lấy đúng khung đang nhìn thấy.
  - Máy cảm ứng có `navigator.canShare({files})`: tạo File **đồng bộ** từ `canvas.toDataURL` (để `navigator.share` vẫn nằm trong cú bấm), báo "Chọn *Lưu hình ảnh*…", mở bảng Chia sẻ. Người dùng huỷ (`AbortError`) thì im lặng; lỗi khác thì tải về như thường.
  - Còn lại: `canvas.toBlob` rồi tải về.
- **Video:** `canvas.captureStream(30)` + MediaRecorder 12 Mbps. Ưu tiên WebM (vp9 rồi vp8) trên Chrome/Firefox, MP4 trên Safari. Blob rỗng thì thử định dạng kế tiếp và báo rõ. Khi quay: tua `time = 0`, bật chạy, tắt lọc moiré, khoá nút Lưu PNG / Ảnh mẫu mới / Xử lý, nút quay thành "■ Dừng quay". Thao tác chuột trong lúc quay được ghi lại.
- **Preset:** xem mục 8.
- Tải file bằng thẻ `<a download>`.

## 16. Đóng gói để gửi

`build.py` thay thẻ `<link>` tới `css/style.css` và mọi thẻ `<script src="js/...">` bằng nội dung file, đúng thứ tự, thoát chuỗi `</script`, ghi ra `contour-lines-lab.html` (~460 KB, hơn một nửa là ảnh mở sẵn). Người nhận nhấp đúp là chạy. Phải chạy lại sau mỗi lần sửa code, bản dịch hoặc ảnh mở sẵn.

## 17. Tiêu chí hoàn thành

1. Mở bằng Live Server và bằng nhấp đúp (cả `index.html` lẫn `contour-lines-lab.html`): Console không có lỗi.
2. Bước 6 cho ra: nền đen có vệt quét ngang; khối xám sáng (~0.8) hình bậc thang ôm quanh nét đen mảnh; ký tự ASCII và khối đen nhỏ trong khối xám; mép ảnh sáng loang.
3. Hoạt hình giật khoảng 7 hình/giây: nét đổi hình từng khung, ảnh rung nhẹ; cỡ khối xám to nhỏ lặp mỗi 6 giây.
4. Elastic Grid (bật "Hiện lưới"): không đụng chuột thì lưới 5 × 8 đều, phẳng; rê chuột thì vùng quanh con trỏ dồn về phía con trỏ, đường lưới cong, chỗ xa đi sau; ngừng rê thì về phẳng trong khoảng *Thời gian về phẳng*; 4 mép không bao giờ hở. Đang dừng thì rê chuột không biến dạng.
5. Xem được cả 7 bước, 7 preset chạy được, lưu được PNG, video và preset JSON; preset JSON cũ (thiếu khoá hoặc có khoá lạ) vẫn mở được.
6. Ba cách nhận ảnh đều chạy; HEIC và ảnh kéo từ web báo lỗi đúng.
7. Đổi khung hình qua lại: ảnh luôn phủ kín, không viền trống, không mờ dần.
8. Bấm EN: không còn chữ tiếng Việt trên giao diện; bấm VI: giá trị các thanh giữ nguyên.
9. Ở 2400 px, bản đồ mật độ bước 5 không có sọc (xem bước 5 với pattern 11, blend 1).
10. Điện thoại (iPhone, Safari): không bị tai thỏ / vạch Home / thanh địa chỉ che; vuốt trên ảnh biến dạng theo tay, trang không cuộn; chạm xuống chỗ mới không giật; kéo thanh trượt không làm ảnh biến dạng; bảng Tuỳ chỉnh trượt lên, kéo thanh nắm xuống thì đóng; chạm ô chọn không tự phóng to; Lưu PNG mở bảng Chia sẻ; xoay ngang ra bố cục hai cột; "Thêm vào MH chính" mở toàn màn hình với icon riêng.

## 18. Lịch sử đổi hướng của Elastic Grid

| Ngày | Mô hình | Ghi chú |
|---|---|---|
| 2026-09-25 | Nhiễu trôi (value noise) | Nay còn lại dưới tên "Rung nét", mặc định 0 |
| 2026-09-26 | Tấm cao su + sóng khi chạm | Bỏ |
| 2026-09-26 | Lưới hàng/cột tách trục, vòm sin, tự chạy theo nhịp, kéo và chạm nhanh | Bỏ: đường lưới luôn thẳng, biến dạng nhảy giữa 4 góc |
| 2026-09-27 | Tấm thạch 2D, vẫn tự chạy và kéo tay | Bỏ phần tự chạy và kéo tay |
| Hiện tại | Tấm thạch 2D, đích là bướu lẻ tại con trỏ, chỉ cần rê chuột | Mục 6 |
