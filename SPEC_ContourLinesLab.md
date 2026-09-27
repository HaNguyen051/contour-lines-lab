# Spec: Contour Lines Lab (bản đã gộp)

> Ký hiệu: **[bổ sung]** = phần spec gốc chưa có. **[sửa]** = spec gốc có nhưng sai hoặc mơ hồ, đã viết lại. Phần không đánh dấu giữ nguyên như spec gốc.

## Nhiệm vụ

Xây dựng web app "Contour Lines Lab" tái hiện hiệu ứng Contour Lines của Effect.app. Ảnh chụp đi qua chuỗi xử lý và ra:
- nét viền "sôi" (line boil);
- ký tự ASCII;
- khối xám kiểu MacPaint;
- nền photocopy tối;
- hoạt hình giật khoảng 8 hình/giây.

**[bổ sung]** Ảnh kết quả **tương tác được bằng chuột và cảm ứng** (xem mục Tương tác).

App chạy hoàn toàn trong trình duyệt. Trả lời và chú thích code bằng tiếng Việt.

## Ràng buộc kỹ thuật

- HTML + CSS + JavaScript thuần, WebGL 1 (GLSL ES 1.00). Không framework, không bước build, không thư viện JS ngoài.
- Dùng script thường (không ES module), gắn mọi thứ vào `window.CL`, để `index.html` chạy được cả khi nhấp đúp lẫn khi mở bằng Live Server.
- **[bổ sung]** Khi mở bằng `file://`, WebGL không được đọc file ảnh nằm cạnh trang (lỗi SecurityError). Vì vậy mọi ảnh dùng sẵn phải sinh bằng code hoặc nhúng dạng data URL. Ảnh người dùng đưa vào (chọn file, kéo thả, dán) thì không bị chặn.
- Shader viết thành chuỗi trong file JS, không fetch file `.glsl`.
- **[bổ sung]** Fragment shader dùng `highp` nếu `GL_FRAGMENT_PRECISION_HIGH` có, ngược lại `mediump`. Đầu vào của hàm hash và noise phải giữ nhỏ (xem `step % 4096`), vì `mediump` sai số rất lớn khi toạ độ vượt khoảng 2000.
- Context WebGL: `preserveDrawingBuffer: true`, `antialias: false`.
- Render target RGBA8, LINEAR, CLAMP_TO_EDGE. Ảnh nguồn upload với `UNPACK_FLIP_Y_WEBGL = true`.
- Ảnh xám lưu ở kênh r: 0 = mực đen, 1 = giấy trắng.
- Mọi tham số đơn vị px tính cho ảnh có cạnh dài 1600 px; nhân với `k = cạnh dài thực / 1600`. **[sửa]** Quy tắc này áp dụng cả cho các khoảng lấy mẫu "±1 px" trong shader khi chúng thay cho một kích thước nhìn thấy được. Riêng sai phân để tính gradient thì giữ đúng 1 px thật.
- Mọi texture, hoa văn, ảnh mẫu đều tự sinh bằng code; không dùng ảnh hay texture của Effect.app. **[bổ sung]** Điều này gồm cả ảnh cành gai trong bài đăng của Effect.app. Ảnh đó chỉ được dùng khi người dùng tự tải lên, không nhúng vào app.
- **[sửa]** Font Be Vietnam Pro nạp từ Google Fonts là ngoại lệ duy nhất được dùng tài nguyên mạng. Phải có font dự phòng `system-ui, "Segoe UI", sans-serif` để khi mất mạng app vẫn chạy.

## Cấu trúc file

```
index.html, css/style.css,
js/gl.js         tiện ích WebGL
js/shaders.js
js/textures.js   atlas ký tự, hoa văn, ảnh mẫu
js/presets.js    schema tham số + preset
js/pipeline.js
js/ui.js         tự sinh bảng điều khiển từ schema
js/grid.js       [bổ sung] Elastic Grid: lưới hàng/cột đàn hồi
js/interact.js   [bổ sung] con trỏ điều khiển lưới
js/export.js, js/main.js, README.md
```

## Hàm dùng chung

- `hash11` / `hash21` theo "Hash without Sine" (Dave Hoskins).
- Value noise 2D nội suy smoothstep.
- `luma = 0.299R + 0.587G + 0.114B`.
- Gaussian blur tách đôi: lượt ngang rồi lượt dọc, 17 mẫu, offset `i·radius/8` với `i = −8..8`, trọng số `exp(−i²/18)` (tức sigma = 0.375·radius).
  - **[sửa]** Với bán kính lớn, khoảng cách giữa hai mẫu (`radius/8`) lớn hơn nét viền rất nhiều. Khi đó mẫu có thể nhảy qua nét và tạo sọc (aliasing). Quy tắc: khi `radius/8 > 1.5·k` px, trước khi blur phải thu nhỏ ảnh đầu vào (downsample 2×, lặp lại tới khi `radius/8 ≤ 1.5` px ở độ phân giải thu nhỏ) bằng box filter 2×2, blur ở độ phân giải thấp, rồi đọc lại bằng LINEAR. Việc này bắt buộc với bản đồ mật độ ở bước 5.

## Pipeline

**[sửa]** Mỗi bước gồm **một hoặc nhiều pass** fragment shader; bước có blur cần thêm pass. Mỗi bước ghi kết quả cuối vào render target riêng, để xem được từng bước mà không phải chạy lại cả chuỗi.

**[bổ sung]** Bước bị tắt thì đi thẳng: target của bước đó trỏ tới kết quả của bước trước, không chạy pass nào.

### Bước 0: Ảnh nguồn

Thu phóng sao cho cạnh dài bằng độ phân giải đang chọn, lót nền trắng dưới ảnh trong suốt.

### Bước 1: Chuyển động (Frame drop + Camera shake + Elastic Grid + Levels)

- `step = floor(time·fps)`, `t = step/fps`. Chỉ vẽ lại pipeline khi `step` đổi hoặc tham số đổi. Truyền `step % 4096` và `t % 1000` vào shader.
- **[bổ sung] Vòng lặp liền mạch (tuỳ chọn):** tham số `loop` (giây, 0 = tắt). Khi bật, `step = floor(time·fps) % round(loop·fps)`, nên video quay đúng `loop` giây sẽ lặp lại không bị khựng.
- Camera shake: mỗi step bốc ngẫu nhiên độ lệch x, y trong `[−shake, shake]` px và góc trong `[−rot, rot]` độ; phóng to `(1 + zoom%)` quanh tâm.
- **[sửa] Elastic Grid:** lưới hàng/cột đàn hồi, tra ngược từng trục sau camera shake. Xem mục "Elastic Grid đàn hồi theo hàng và cột".
- "Rung nét" (tuỳ chọn, mặc định 0): phần Elastic nhiễu cũ, `cell = min(W,H)/freq`, `disp = (noise(q + (tt, 1.7·tt)), noise(q + (19.3 − 1.3·tt, 7.1 + tt))) − 0.5`, `p += disp·2·amp`.
- Đọc ảnh tại `p` (clamp), đổi sang luma, áp Levels: `clamp((l − black)/(white − black), 0, 1)`.

### Bước 2: Threshold, chế độ edge

- Làm mềm trước bằng Gaussian bán kính `soften` (2 pass).
- `v = l + (noise(p/3 + step·17) − 0.5)·rough − level`. **[sửa]** Toạ độ `p` trong `noise(p/3 …)` phải là px chia cho `k`, để kết cấu nhám không đổi khi đổi độ phân giải.
- `grad` bằng sai phân trung tâm ±1 px, `dist = |v| / max(|grad|, 1e−4)`.
- `ink = 1 − smoothstep(width·k/2 − 0.5, width·k/2 + 0.5, dist)`. Xuất `1 − ink`.
- Chế độ fill: xuất `smoothstep(−0.02, 0.02, v)`.

### Bước 3: Gaussian blur 30%

Làm mờ ảnh nét với bán kính `radius`, xuất `mix(nét, nét_mờ, opacity)`.

### Bước 4: ASCII

- Chia lưới ô cỡ `cell`. `cov` = trung bình `(1 − ảnh)` trên 4×4 mẫu trong ô.
- Gọi `f = step` nếu flicker bật, ngược lại `f = 0`.
- Bật ô nếu `cov ≥ minCov` và `hash21(ô + f·13.1) < density`.
- `level = cov·gain + (hash21(ô·1.7 + f·3.3) − 0.5)·jitter`; `idx = floor(clamp(level, 0, 0.999)·số ký tự)`.
- Atlas 512×512 = 8×8 ô 64 px (**tối đa 64 ký tự**; bộ ký tự dài hơn thì cắt và báo), ký tự trắng trên nền đen, font monospace đậm 58 px, có mipmap.
  - `█ ▌ ▮` vẽ bằng `fillRect`; `░ ▒ ▓` vẽ bằng chấm 4 px bật 25/50/75%.
  - **[bổ sung]** Ở mép ô, toạ độ atlas nhảy cả một ký tự nên GPU chọn mip nhỏ nhất và có thể lộ đường kẻ. Để tránh, đọc atlas với tham số bias `-0.5` (`texture2D(atlas, uv, -0.5)`), hoặc tắt mipmap khi `cell·k ≥ 24` px.
- Toạ độ trong ô clamp `[0.06, 0.94]`; `glyph = smoothstep(0.3, 0.7, atlas)·bật·opacity`.
- Xuất `min(mix(1, ảnh, keep), 1 − glyph)`.

### Bước 5: MacPaint

- `cellPx = cell·k`. Nếu chuyển động đang bật: nhân thêm `(1 + (hash(step) − 0.5)·2·animate)`. Làm tròn, tối thiểu 2.
- Bản đồ mật độ: làm mờ Gaussian ảnh đầu ra bước 3 với `rcov = cellPx·(0.75 + spread)`. **[sửa]** Bắt buộc theo quy tắc downsample ở mục Hàm dùng chung.
- `norm = (0.375·rcov·2.5066) / max(width·k, 0.75)` nếu Threshold đang ở chế độ edge, ngược lại 1. Công thức này bù cho việc nét mảnh bị blur làm nhạt đi.
- `d = (1 − trung bình 5 mẫu bản đồ mật độ tại tâm ô và 4 điểm lệch (±0.3, ±0.3) ô)·norm + (hash21(ô + step·0.37) − 0.5)·jitter`. Bật ô nếu `d ≥ threshold`.
- **[bổ sung]** Xoá khối quanh chuột: `d *= 1 − clearMac·f_chuột(tâm ô)`, dùng cùng hàm `f` như ở bước 1.
- Tô hoa văn 1-bit 8×8, mỗi điểm rộng `scale` px. `pattern` là số cố định, hoặc −1 = tự động: `idx = floor(clamp(d, 0, 0.999)·12)`.
- `nền = mix(1, ảnh bước 4, keep)`; xuất `mix(nền, nền·(1 − ink), blend)`.
- 12 hoa văn (hex từng hàng, bit 1 = mực), theo thứ tự:

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

### Bước 6: Texture (2 lớp Layer Mix)

Với `s = min(W,H)/1000`:

- **Giấy (multiply):** `paper = 1 − grain·(0.16·hash21(pixel + step·7.13) + 0.10·noise((x·0.02, y·0.25)/s + step·0.1))`; `sáng = ảnh·paper`.
- **Khoá nền:** tính theo TRUNG BÌNH 3×3 điểm (khoảng cách = cỡ điểm hoa văn MacPaint, tối thiểu 1 px), không xét từng pixel, vì bàn cờ có pixel trắng tinh. `bg = smoothstep(key − 0.03, key + 0.02, trung bình)`.
- **Nền tối:** `0.055 + 0.06·streaks·noise(x·0.003/s, y·0.8/s + step·5) + 0.035·streaks·noise(3.7, y·0.01/s + step·0.7) + 0.07·grain·(hash − 0.5)`.
- **Mép tờ giấy:**
  - `kc` = khoảng cách tới mép (đơn vị cạnh ngắn) + `(noise(p·0.03/s + step) − 0.5)·0.012`;
  - khi `paperEdge > 0`: `e = 1 − smoothstep(0.002, 0.002 + 0.016·paperEdge, kc)`;
  - `nền tối = mix(nền tối, 0.62 + 0.2·hash, e)`.
  - **[sửa]** Đổi tên tham số `edge` của Texture thành `paperEdge` để không trùng với chế độ `edge` của Threshold.
- Xuất `mix(sáng, nền tối, bg·dark)` nhân với `mix((1,1,1), (1, 0.975, 0.93), tone)`.

### Hiển thị

**[sửa]** Spec gốc chưa nói rõ kích thước canvas. Quy định như sau:
- Canvas luôn có **kích thước thật bằng độ phân giải xử lý**. CSS `object-fit: contain` co nó vừa khung xem.
- Pass hiển thị chép bước đang xem ra canvas.
- Chống moiré: khi tỉ lệ hiển thị (`kích thước CSS × devicePixelRatio / kích thước thật`) nhỏ hơn 0.8, pass hiển thị lấy trung bình 4×4 mẫu trong vùng `1/tỉ lệ` px. Như vậy khi trình duyệt thu nhỏ canvas, các hoa văn 1 px không bị vằn.
- Tắt lọc này khi lưu PNG và khi quay video.
- Tính lại tỉ lệ khi cửa sổ đổi cỡ (`ResizeObserver`).

**[bổ sung] Hiệu năng:**
- Khi chỉ có chuột di chuyển thì chạy lại từ bước 1 trở đi. Bước 0 không đổi nên không chạy lại.
- Khi đang quay video mà `step` không đổi, chỉ chạy lại pass hiển thị, không chạy lại cả pipeline.

## [sửa theo cập nhật 2026-09-26, lần 2] Elastic Grid đàn hồi theo hàng và cột

Bỏ hẳn tương tác "tấm cao su + sóng" và Elastic Grid dạng nhiễu. Thay bằng lưới ô đàn hồi, mô phỏng chuyển động đo từ video mẫu. Mã nguồn: `js/grid.js` (mô hình), `js/interact.js` (con trỏ), đầu shader `motion` (tra ngược).

**Mô hình (giống nhau cho trục X và Y)**
- Toạ độ trục u = 0..1 theo thứ tự màn hình (Y từ trên xuống; shader đổi `y_vUv = 1 − u`).
- Đường lưới i = 0..N: vị trí nghỉ `r_i = i/N`, vị trí `p_i`, vận tốc `v_i`; `p_0 = 0`, `p_N = 1` cố định.
- Vòm sin `w(u; c)` (c kẹp 0.05–0.95); đích `T_i = r_i + Σ A_k·w(r_i; c_k)`, gồm tối đa 2 vòm (tự chạy + kéo).
- Giới hạn một vòm: `−0.65·2c/π ≤ A ≤ 0.65·2(1 − c)/π`.
- Độ trễ: lưu lịch sử trạng thái đích 3 giây; đường i dùng trạng thái tại `t − d_i`.
- Lò xo: bước 1/120 s, `a = ω²(T − p) − 2ζωv`. Sau mỗi bước, quét xuôi rồi ngược, giữ khoảng cách tối thiểu 0.3/N; đường bị chặn thì `v *= 0.5`.
- Tra ngược `inv(s)` dùng chung cho shader và con trỏ.

**Tự chạy**
- Bắt đầu: X ở S+ (A = +amp, c 0.33–0.45), Y ở S− (A = −amp, c 0.60–0.66), đặt thẳng `p = T`.
- Mỗi nhịp đổi một trục (Y, X, Y, X...). Độ trễ: S− → S+ thì `d_i = sweep·(1 − r_i)`; S+ → S− thì `d_i = sweep·r_i`.
- 1/4 số nhịp là nhịp chậm (0.45 Hz, lan 1.4 s); nhịp sau chờ nhịp chậm lan xong.
- Bản cài đặt: nhịp thường được rút ngắn để trung bình cả hai loại đúng bằng `beat` (đo 10 phút: 0.80–1.81 s, trung bình 1.31 s).

**Tương tác** (chỉ theo con trỏ đầu tiên; grab / grabbing; `touch-action: none`)
- Nhấn: tạm dừng tự chạy, ghi `c = inv(s0)` (điểm ảnh gốc dưới ngón tay).
- Kéo: vòm kéo có tâm c, `A = L·tanh((s − s0)/L)`, với `L = min(dragMax, giới hạn vòm theo dấu)`; trễ `d_i = sweep·|r_i − c|`.
- Thả: A của vòm kéo về 0 (vẫn trễ từ c); 1.5 s sau tự chạy tiếp.
- Chạm nhanh (nhả < 250 ms, di chuyển < 6 px): s < 0.5 thì S+ với `c = clamp(s + 0.15, 0.33, 0.5)`; ngược lại S− với `c = clamp(s − 0.15, 0.5, 0.67)`; trễ tính từ điểm chạm.

**Shader bước 1:** `uniform float uGX[17], uGY[17]; uniform float uNX, uNY;`, hai hàm `invX` / `invY`. Thứ tự: toạ độ màn hình → camera shake → tra ngược lưới → (rung nét, mặc định 0) → đọc ảnh → Levels. `setUniforms` lấy kiểu uniform mảng từ `getActiveUniform`, rồi gọi `uniform1fv` hoặc `uniform4fv` cho đúng.

**MacPaint theo vòng 6 giây:** `macpaint.track` là "video" (mặc định) hoặc "off". Khi là "video", cỡ ô = `cell × K(t)/18`, với `t = thời gian % 6`, nội suy smoothstep qua các mốc (0; 18), (0.9; 9), (1.4; 10), (2.2; 40), (3.0; 10), (3.5; 12), (4.2; 45), (5.4; 18), (6.0; 18); kiểu nhảy cỡ ô ngẫu nhiên bị bỏ qua.

**Vòng lặp vẽ:** vật lý chạy mỗi requestAnimationFrame (tối đa 0.1 s mỗi khung). "Mượt khi tương tác" bật thì vẽ mỗi khung khi đang chạm, hoặc khi đã thả mà còn `|v_i| > 0.001`; còn lại vẽ theo Frame drop.

**Tham số** (lớp "Elastic Grid" dưới lớp Chuyển động, có công tắc):

| Tham số | Mặc định | Khoảng |
|---|---|---|
| enabled | bật | |
| cols | 8 | 2–16 |
| rows | 10 | 2–16 |
| amp | 0.15 | 0–0.3 |
| dragMax | 0.22 | 0.05–0.3 |
| freq | 0.95 Hz | 0.2–4 |
| damping ζ | 0.73 | 0.3–1.5 |
| sweep | 0.6 s | 0–2 |
| auto | bật | |
| beat | 1.3 s | 0.5–4 |
| slow | 0.25 | 0–1 |
| smooth | bật | |
| showGrid (phím G) | tắt | |

Lớp Chuyển động: "Elastic" nhiễu cũ đổi tên thành "Rung nét" (`motion.amp`), mặc định 0. Preset "Bản tĩnh" tắt tự chạy và vòng 6 giây; "Dither MacPaint" tắt vòng 6 giây.

## Preset mặc định "Contour Lines (giống video)"

Ghi theo dạng: giá trị (khoảng thanh trượt).

- **source:** black 0.05 (0–0.9), white 0.95 (0.1–1)
- **motion:** bật; fps 8 (2–30); amp ("Rung nét") 0 px (0–40); freq 2.4 (0.5–10); speed 2.4 (0–6); shake 10 px (0–40); rot 0.6° (0–5); zoom 4% (0–15); **[bổ sung]** loop 0 giây (0–12)
- **threshold:** bật; mode edge (edge | fill); soften 4 px (0–20); level 0.5 (0.05–0.95); width 1.8 px (0.5–6); rough 0.05 (0–0.3)
- **blur:** bật; radius 6 px (0–24); opacity 0.3 (0–1)
- **ascii:** bật; ramp `.'-*/|1tvouqdQ69G&$%#@RBMW▮▌█`; cell 15 px (6–40); density 0.7 (0–1); gain 5 (0.5–12); minCov 0.035 (0–0.3); jitter 0.45 (0–1); opacity 1; keep 1; flicker bật
- **macpaint:** bật; pattern 7 (Bàn cờ 50%); cell 20 px (4–60); animate 0.45 (0–1); spread 0.35 (0–2); threshold 0.35 (0.02–1); jitter 0.12 (0–0.6); scale 1 px (1–8); blend 0.4 (0–1); keep 1
- **texture:** bật; dark 1; key 0.9 (0.5–0.99); grain 0.5; streaks 0.6; paperEdge 0.5; tone 0.25 (các khoảng còn lại 0–1)
- **grid:** như mục Elastic Grid; **macpaint.track:** "video".

**Bộ ký tự khác:** Paul Bourke `" .:-=+*#%@"`, khối `"░▒▓█"`, `"MW▮█"`, chữ số `"1742356980"`.
**[bổ sung]** Giao diện có ô chọn các bộ này, cộng thêm một ô nhập tự do. Ký tự lặp thì bỏ, dài quá 64 thì cắt.

**Preset phụ:**
- **Bản tĩnh:** tắt chuyển động, flicker tắt, animate 0.
- **Giấy sáng:** dark 0, grain 0.35, paperEdge 0.
- **Chỉ nét viền:** tắt ASCII, MacPaint, Texture.
- **ASCII dày:** cell 11, density 1, gain 7, jitter 0.6.
- **ASCII cổ điển:** tắt Threshold, soften 1, tắt blur, ramp Bourke, cell 12, density 1, gain 1.3, minCov 0.02, jitter 0, keep 0, flicker tắt, tắt MacPaint, dark 0, paperEdge 0.
- **Dither MacPaint:** tắt Threshold, soften 2, tắt blur và ASCII, pattern −1, cell 6, spread 0, threshold 0.08, jitter 0, scale 2, blend 1, keep 0, animate 0, dark 0, paperEdge 0.

## Giao diện (tiếng Việt)

- **[bổ sung] Hai chế độ:**
  - **Chế độ xem** (mặc định khi mở): chỉ có canvas toàn khung, tương tác chuột, và một thanh nút nổi nhỏ (Tải ảnh · Dừng/Chạy · Lưu PNG · ⚙ Tuỳ chỉnh). Có dòng gợi ý thao tác chuột, tự ẩn sau 6 giây.
  - **Chế độ tuỳ chỉnh:** bấm ⚙ hoặc phím **H**. Hiện đầy đủ phần bên dưới.
- Canvas lớn (`object-fit: contain`) và thanh 7 nút "0 Ảnh gốc, 1 Chuyển động, 2 Threshold, 3 Gaussian blur, 4 ASCII, 5 MacPaint, 6 Texture" để xem kết quả tới từng bước; mặc định bước 6.
- Bảng điều khiển tự sinh từ schema.
  - Mỗi lớp có số bước, tên, mô tả một câu, công tắc bật/tắt, thanh trượt hiện giá trị.
  - **[bổ sung]** Mỗi tham số có một dòng chú thích tiếng Việt, bật/tắt được bằng công tắc "Hiện chú thích".
  - Đổi tham số thì ô preset chuyển thành "Tuỳ chỉnh".
- **Nút:**
  - Tải ảnh lên (hỗ trợ cả kéo thả và dán);
  - Ảnh mẫu mới (đổi seed);
  - Tạm dừng/Chạy;
  - Lưu PNG;
  - Quay video (3/4/6/10 giây, **[bổ sung]** hoặc "1 vòng lặp" khi loop > 0);
  - Lưu preset và Mở preset (JSON `{app, version, state}`; khi mở chỉ nhận khoá hợp lệ, đúng kiểu dữ liệu).
- Độ phân giải xử lý: 1080 / 1600 (mặc định) / 2400 px cạnh dài, không vượt `MAX_TEXTURE_SIZE`.
- **Phím tắt:** Space dừng/chạy, 0–6 đổi bước, **[bổ sung]** H bật/tắt tuỳ chỉnh. Phím tắt không chạy khi đang gõ trong ô nhập.
- Nếu máy bật `prefers-reduced-motion` thì mở ở trạng thái dừng.
- **Ảnh mẫu** vẽ bằng canvas 2D, tỉ lệ 3:4:
  - nền gradient `#e8e8e5` → `#cdcdc9`;
  - **[sửa theo yêu cầu người dùng]** 3–5 cành gai đen `#121212` to, dày 70–120 px, lượn dài qua khung, thon dần 55%, ngọn thon thành một gai nhọn, thường rẽ một nhánh to;
  - gai dài 1.6–3.8 lần độ dày cành; chân gai rộng và **loe ra liền mạch với thân** (mỗi cạnh là Bézier bậc 3: bắt đầu chạy dọc thân rồi lõm vào sát trục gai), hơi cong;
  - gai mọc theo đốt cách nhau 130–280 px, mỗi đốt 1–3 gai toả ra.
  - **[bổ sung]** Mép cành có vệt sáng mờ phía nguồn sáng và lớp hạt nhiễu nhẹ, để bước Threshold có chuyển độ sáng thật mà bắt nét như ảnh chụp.
- **Phong cách:** tông máy photocopy (nền `#d5d1c5`, khung xem `#2c2c29`, nút chính xanh `#1d7f47`), font Be Vietnam Pro, có dark mode. Bảng điều khiển rộng 372 px bên phải; dưới 960 px thì xếp dọc.

### [sửa] Nhận ảnh

Spec gốc chỉ ghi "báo lỗi file không phải ảnh". Viết lại cụ thể:

- **Ba đường vào:** nút chọn file, kéo thả (thả vào đâu trong trang cũng được), dán `Ctrl+V` (ảnh chụp màn hình, ảnh "Sao chép hình ảnh" từ web).
- **Không lọc theo `file.type`**, vì nhiều file có type rỗng. Cứ để trình duyệt thử giải mã, lỗi thì báo lý do.
- **HEIC/HEIF** (nhận theo type hoặc đuôi file): báo "chưa đọc được, hãy đổi sang JPG/PNG hoặc chụp màn hình rồi Ctrl+V".
- **Kéo ảnh từ trang web khác** (chỉ có URL, không có file): báo "trình duyệt chặn vì bảo mật", kèm hướng dẫn lưu ảnh hoặc dán.
- Ảnh lớn hơn `min(2400, MAX_TEXTURE_SIZE)` thì thu nhỏ bằng canvas 2D trước khi upload. Tôn trọng hướng xoay EXIF (thẻ `img` mặc định đã làm).
- Reset `input.value` sau mỗi lần chọn, để chọn lại đúng file đó vẫn nhận.
- Mọi thông báo hiện dạng toast ở cuối màn hình: "Đã tải: tên (rộng×cao)" hoặc lý do lỗi. Không dùng `alert`.

### Báo lỗi rõ ràng

- Máy không có WebGL.
- Shader lỗi: hiện log kèm mã nguồn có đánh số dòng.
- File không phải ảnh (xem mục Nhận ảnh).
- **[sửa]** Mất context GPU: gọi `preventDefault` trong `webglcontextlost` và hiện thông báo. Khi có `webglcontextrestored` thì tạo lại toàn bộ program, texture, target, atlas và upload lại ảnh nguồn (giữ một bản ảnh nguồn trên CPU để làm việc này).

## Xuất file

- **PNG:** vẽ lại khung hiện tại không lọc, rồi `canvas.toBlob`.
- **Video:** `canvas.captureStream(30)` + MediaRecorder 12 Mbps.
  - Trong lúc quay, mỗi `requestAnimationFrame` vẽ lại ít nhất pass hiển thị (xem Hiệu năng).
  - Ưu tiên WebM (vp9 rồi vp8) trên Chrome/Firefox, MP4 trên Safari.
  - Kiểm tra blob lớn hơn 0 byte; nếu rỗng thì thử lại với định dạng còn lại và báo lỗi rõ.
  - **[bổ sung]** Khi quay: tua `time = 0`, tắt lọc chống moiré, khoá nút xuất, và hiện nút "■ Dừng" để dừng sớm.
- Tải file về bằng thẻ `<a download>`.

## Tiêu chí hoàn thành

1. Mở bằng Live Server trong VS Code, Console không có lỗi. **[bổ sung]** Nhấp đúp `index.html` cũng chạy và cũng không có lỗi.
2. Bước 6 cho ra:
   - nền đen có vệt quét ngang;
   - khối xám sáng (khoảng 0.8) hình bậc thang ôm quanh nét đen mảnh;
   - ký tự ASCII và khối đen nhỏ nằm trong khối xám;
   - mép ảnh sáng loang.
3. Hoạt hình giật khoảng 8 hình/giây: nét đổi hình từng khung, ảnh rung nhẹ, cỡ khối xám nhảy theo khung.
4. Xem được cả 7 bước, 7 preset chạy được, lưu được PNG, video và preset JSON.
5. **[sửa]** Hiện lưới: 8 × 10 ô, mép không bao giờ di chuyển, đường luôn thẳng. Để yên: khoảng 1.3 s một nhịp, lan trong khoảng 0.6 s, vượt đích nhẹ, yên sau khoảng 1 s, ô 0.6×–1.7×. Kéo: hàng/cột co giãn theo tay (gần trước, xa sau), ghì mềm, thả nảy về. Chạm: phía đó to ra. MacPaint to nhỏ theo vòng 6 s.
6. **[bổ sung]** Ba cách nhận ảnh đều chạy. Ảnh HEIC và ảnh kéo từ web báo lỗi đúng.
7. **[bổ sung]** Ở 2400 px, bản đồ mật độ bước 5 không có sọc (kiểm tra bằng cách xem bước 5 với blend = 1).
8. README.md tiếng Việt gồm:
   - cách chạy bằng Live Server và bằng nhấp đúp;
   - cấu trúc file;
   - chỗ sửa thông số (`js/presets.js`);
   - **[bổ sung]** các thao tác chuột và phím tắt;
   - yêu cầu với ảnh tải lên.

Làm lần lượt: dựng khung WebGL và bước 1 trước, chạy thử, rồi thêm từng bước. Sau mỗi bước, cho tôi biết cách kiểm tra.
