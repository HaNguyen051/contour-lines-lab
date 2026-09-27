# Contour Lines Lab: hướng dẫn học từ A đến Z

Cách chạy, phím tắt, cấu trúc file và yêu cầu với ảnh nằm trong **[README.md](README.md)**. File này để **học**: mỗi bước làm gì với ảnh, vì sao công thức viết như vậy, học ở đâu, và tự làm lại theo thứ tự nào.

Mọi tham số đều có chú thích tiếng Việt ngay trên giao diện và trong `js/presets.js`. Tài liệu này không chép lại bảng tham số, để khỏi bị lệch khi code đổi.

---

## Mục lục

1. [Tóm tắt trong 30 giây](#1-tóm-tắt-trong-30-giây)
2. [Ý tưởng cốt lõi: shader và chuỗi xử lý](#2-ý-tưởng-cốt-lõi-shader-và-chuỗi-xử-lý)
3. [Từng bước hoạt động thế nào](#3-từng-bước-hoạt-động-thế-nào)
4. [Chuyển động và tương tác chuột](#4-chuyển-động-và-tương-tác-chuột)
5. [Mấy mẹo kỹ thuật đáng học](#5-mấy-mẹo-kỹ-thuật-đáng-học)
6. [Quy trình tự làm lại từ A đến Z](#6-quy-trình-tự-làm-lại-từ-a-đến-z)
7. [Chưa biết gì về mảng này thì có làm được không?](#7-chưa-biết-gì-về-mảng-này-thì-có-làm-được-không)
8. [Tài liệu tham khảo](#8-tài-liệu-tham-khảo)
9. [Lỗi thường gặp](#9-lỗi-thường-gặp)
10. [Bài tập mở rộng](#10-bài-tập-mở-rộng)

---

## 1. Tóm tắt trong 30 giây

- **Hiệu ứng là gì:** ảnh đi qua 7 bước nối tiếp, giống chồng layer trong Photoshop: ảnh gốc → rung, uốn → tách nét viền → làm mờ → rắc ký tự ASCII → phủ khối MacPaint → phủ texture photocopy.
- **Công nghệ:** HTML + JavaScript + **WebGL**. Mỗi bước là một hoặc vài **shader** viết bằng **GLSL**, chạy trên card đồ hoạ (GPU). Không dùng AI, không có server.
- **Chuyển động:** máy tự sinh. Thời gian bị làm tròn thành 8 bước mỗi giây, và mọi giá trị ngẫu nhiên đều lấy theo số bước, nên hình giật như stop-motion.
- **Lĩnh vực:** xử lý ảnh thời gian thực và hoạt hình sinh bằng code, thuộc mảng *creative coding*.

---

## 2. Ý tưởng cốt lõi: shader và chuỗi xử lý

### 2.1. Viết code cho MỘT pixel

JavaScript thường xử lý ảnh bằng vòng lặp: `for (mỗi pixel) { tính màu }`. CPU làm lần lượt nên chậm.

Shader chỉ viết **phần thân vòng lặp**:

```glsl
void main() {
  // "Tôi là một pixel ở toạ độ vUv. Màu của tôi là gì?"
  gl_FragColor = ...;
}
```

GPU có hàng nghìn lõi và chạy đoạn này **cho mọi pixel cùng lúc**. Hệ quả: một pixel không biết pixel bên cạnh vừa tính ra gì. Muốn biết hàng xóm, nó phải tự đọc ảnh đầu vào tại toạ độ hàng xóm (`texture2D`).

| Từ khoá | Nghĩa | Trong dự án |
|---|---|---|
| `uniform` | Thông số JS gửi xuống, giống nhau cho mọi pixel | Các thanh trượt |
| `varying vUv` | Toạ độ pixel, (0,0) góc dưới trái → (1,1) góc trên phải | Nhân `uRes` ra toạ độ px |
| `texture2D(ảnh, toạ độ)` | Đọc màu ảnh tại một điểm | Đọc kết quả bước trước |

### 2.2. Chuỗi xử lý và render target

Kết quả bước trước phải thành đầu vào bước sau. Vì vậy mỗi bước không vẽ ra màn hình mà **vẽ vào một texture** (render target = texture + framebuffer). Dự án có 7 target cho 7 bước, cộng vài target tạm cho blur. Nhờ vậy:
- xem được kết quả bất kỳ bước nào;
- bước 0 chỉ chạy lại khi đổi ảnh.

Code: hàm `render()` trong `js/pipeline.js`. Đọc từ trên xuống là thấy đúng thứ tự 7 bước.

### 2.3. Quy ước

- Ảnh xám lưu ở kênh `r`: **0 = mực, 1 = giấy**.
- Kích thước tính bằng px quy về ảnh 1600 px, nhân `k = cạnh dài / 1600`.

---

## 3. Từng bước hoạt động thế nào

Mẹo học: bấm lần lượt các nút **0 → 6** dưới ảnh (hoặc phím 0–6) và nhìn ảnh đổi thế nào ở mỗi bước.

### Bước 0: Ảnh gốc (shader `source`)

Thu phóng ảnh về độ phân giải xử lý. Ảnh PNG có nền trong suốt được lót trắng: `mix(trắng, màu, alpha)`.

### Bước 1: Chuyển động (shader `motion`)

Bước này **không đổi màu, chỉ đổi chỗ đọc ảnh**. Pixel ở `p` lấy màu tại một điểm `p'` hơi lệch:

1. **Camera shake:** mỗi khung bốc ngẫu nhiên một góc xoay và một độ dịch, cộng phóng to nhẹ để khỏi lộ mép.
2. **Elastic Grid:** ảnh chia lưới hàng/cột; mỗi cột, mỗi hàng to nhỏ riêng, nội dung trong ô co giãn đều theo ô (xem mục 4). Còn "Rung nét" (nhiễu trôi, mặc định 0) là phần Elastic kiểu cũ, để lại làm tuỳ chọn.
3. Đọc ảnh tại `p'`, đổi sang xám bằng `luma = 0.299R + 0.587G + 0.114B`, rồi áp **Levels** để kéo giãn tương phản.

Vì biến dạng xảy ra **trước** khi tách nét, mỗi khung (ảnh rung, lưới dịch) ra một bộ nét hơi khác. Dân hoạt hình gọi hiện tượng này là *line boil*.

### Bước 2: Threshold (shader `threshold`)

1. **Làm mềm** bằng Gaussian blur để nét cong mượt.
2. Tính `v = độ sáng + nhiễu nhỏ − ngưỡng`. Đường viền nằm ở chỗ `v = 0`.
3. **Mẹo vẽ nét dày đúng N px:** khoảng cách từ pixel tới đường `v = 0` xấp xỉ bằng `|v| / |gradient của v|`. Gradient tính bằng hiệu giá trị hai pixel hai bên. Pixel nào có khoảng cách nhỏ hơn nửa độ dày thì tô mực. Kết quả: nét luôn mảnh và đều, dù ảnh gốc chuyển sáng tối gắt hay mềm.
4. Nhiễu cộng vào `v` (tham số *Độ nhám*) đổi theo khung, làm mép nét lởm chởm và "sôi".

Chế độ **Fill** thì đơn giản hơn: sáng hơn ngưỡng thành trắng, tối hơn thành đen.

### Bước 3: Gaussian blur (shader `blur` + `mixer`)

Làm mờ nét rồi trộn lại 30% với nét gốc, để nét mềm và bớt răng cưa. Blur dùng hình chuông Gauss: 17 mẫu, trọng số `exp(−i²/18)`, chạy 2 lượt (ngang rồi dọc). Hai lượt 1 chiều cho kết quả y hệt blur 2 chiều nhưng chỉ tốn 34 lần đọc thay vì 289.

### Bước 4: ASCII (shader `ascii`)

1. Chia ảnh thành ô. Với mỗi pixel: `floor(px / cỡ ô)` = thuộc ô nào, `fract(px / cỡ ô)` = nằm đâu trong ô.
2. Lấy 4×4 = 16 mẫu trong ô → **độ phủ mực**.
3. Ô chỉ được bật nếu đủ mực, và nếu "tung xúc xắc" `hash(ô) < mật độ`. Nhờ vậy ký tự rắc thưa.
4. Chọn ký tự thứ `độ phủ × khuếch đại × số ký tự` (có cộng chút ngẫu nhiên) trong **atlas 8×8**: một ảnh 512×512 chứa sẵn 64 ký tự, sinh bằng Canvas 2D trong `textures.js`.
5. Bật *Nhấp nháy* thì hạt giống ngẫu nhiên là số khung, nên ký tự đổi mỗi khung.

### Bước 5: MacPaint (shader `macpaint`)

1. **Bản đồ mật độ:** blur rộng ảnh bước 3. Chỗ gần nét thành xám, xa nét thành trắng.
2. **Chuẩn hoá:** nét chỉ dày khoảng 2 px, blur rộng làm nó nhạt đi rất nhiều. Hệ số `norm = σ·√(2π) / độ dày nét` nhân ngược lại, đúng bằng lượng nét bị pha loãng khi blur một đường thẳng.
3. Chia ảnh thành ô to. Ô nào có mật độ vượt ngưỡng thì tô **hoa văn 1-bit 8×8** (12 mẫu kiểu MacPaint, mỗi hàng là 1 byte, bit 1 = chấm mực).
4. Trộn 40% nên bàn cờ 50% ra màu xám khoảng 0.8, thành các **khối xám bậc thang ôm quanh nét**.
5. Khi Chuyển động bật, cỡ ô nhảy ngẫu nhiên theo khung.

### Bước 6: Texture (shader `texture`)

1. **Giấy (multiply):** nhân với hạt ngẫu nhiên và thớ ngang. Phép nhân chỉ làm tối, giống mực in lên giấy thô.
2. **Khoá nền:** chỗ nào sáng hơn ngưỡng *key* (lấy trung bình 3×3 điểm, không xét từng pixel) thì là nền. Phải lấy trung bình vì bàn cờ có pixel trắng tinh; xét từng pixel thì khối xám bị thủng lỗ chỗ.
3. **Nền tối:** đen + 2 lớp vệt quét ngang (nhiễu kéo dài theo chiều ngang) + hạt.
4. **Mép tờ giấy:** gần mép ảnh thì sáng loang, như tờ giấy đặt lệch trên máy scan.
5. **Tông ấm:** nhân nhẹ với màu vàng giấy cũ.

### Hiển thị (shader `display`)

Canvas luôn có kích thước thật bằng độ phân giải xử lý; CSS co nó cho vừa khung. Khi ảnh bị co nhỏ hơn 0.8 lần, hoa văn 1 px sẽ bị vằn (moiré), nên shader lấy trung bình 4×4 mẫu trước. Lọc này tắt khi lưu PNG và khi quay video.

---

## 4. Chuyển động và tương tác chuột

**Frame drop** (`main.js`, hàm `currentStep`):

```js
step = Math.floor(time * fps);          // 8 fps → step đổi 8 lần mỗi giây
if (loop > 0) step %= loop * fps;       // vòng lặp: số khung quay về 0
```

Mọi giá trị ngẫu nhiên (độ rung, nhiễu nét, ô ASCII, cỡ khối) đều tính từ `step`, nên giữa hai lần đổi, hình đứng yên. Trang **chỉ chạy lại pipeline khi `step` đổi** hoặc khi tham số đổi. Ở 8 fps, GPU chỉ làm việc 8 lần mỗi giây.

### Elastic Grid: lưới hàng/cột đàn hồi (`grid.js` + đầu shader `motion`)

Chuyển động trong video mẫu **không phải** ảnh bị uốn như chất lỏng. Ảnh được chia thành lưới ô, mỗi cột có bề rộng riêng, mỗi hàng có chiều cao riêng, và nội dung trong mỗi ô phóng to/thu nhỏ đều theo ô. Vì hai trục độc lập (x hiển thị chỉ phụ thuộc x gốc), đường thẳng trong ô vẫn thẳng.

**1. Vòm sin.** Trên một trục (0 → 1), đường lưới thứ i có vị trí nghỉ `r_i = i/N`. Vị trí đích của nó:

```
T_i = r_i + A · w(r_i; c)
w(u; c) = sin(π/2 · u/c)              nếu u ≤ c
        = sin(π/2 · (1 − u)/(1 − c))  nếu u > c
```

`w` bằng 0 ở hai mép và bằng 1 tại `c`, nên mép đứng yên còn đường ở `c` dịch nhiều nhất. Với `A > 0`, các đường trước `c` bị đẩy dãn ra (ô to), sau `c` bị dồn lại (ô nhỏ). Độ dốc của `A·w` ở mép là `A·π/(2c)`. Với A = 0.15, c = 0.4 thì dốc 0.59, nên ô ở mép to 1.59 lần. Đó là lý do video có ô to nhất khoảng 1.7× và nhỏ nhất khoảng 0.6×.

**2. Tra ngược trong shader.** Shader hỏi: "pixel ở vị trí s trên màn hình thuộc ô nào?". Nó dò tới ô i có `p_i ≤ s ≤ p_(i+1)`, rồi trả về toạ độ ảnh gốc `(i + vị trí tương đối trong ô) / N`. Làm riêng cho X (`invX`) và Y (`invY`). Vì WebGL1 không cho truyền mảng vào hàm, mỗi hàm đọc thẳng uniform mảng `uGX[17]` / `uGY[17]`.

**3. Lò xo.** Mỗi đường là một lò xo tắt dần, bước cố định 1/120 giây:

```
a = ω²·(T − p) − 2·ζ·ω·v     (ω = 2π·tần số)
v += a·dt;  p += v·dt
```

Với ζ = 0.73, đường vượt đích khoảng 3% rồi dội lại và đứng yên sau khoảng 1 giây. Sau mỗi bước, hai lượt quét giữ cho các đường không đè lên nhau (mỗi ô rộng ít nhất 0.3 cỡ gốc).

**4. Độ trễ = làn sóng.** Mỗi trục lưu lại đích của 3 giây gần nhất. Đường i không nhìn đích hiện tại mà nhìn đích của `d_i` giây trước. Đặt `d_i = sweep × (1 − r_i)` thì các đường ở mép cuối chạy trước, mép đầu chạy sau, thành một làn sóng quét qua khung trong `sweep` giây.

**5. Tự chạy.** Mỗi nhịp đổi một trục giữa hai trạng thái S+ (A = +0.15, c ≈ 0.33–0.45) và S− (A = −0.15, c ≈ 0.60–0.66), luân phiên Y rồi X. Một phần tư số nhịp là nhịp chậm (lò xo 0.45 Hz, lan 1.4 giây).

**6. Kéo.** Lúc nhấn, tra ngược để biết điểm ảnh gốc `c` đang nằm dưới ngón tay. Khi kéo, thêm một vòm thứ hai có tâm đúng tại `c`, biên độ = quãng tay đã đi. Vì `w(c; c) = 1`, điểm đó đi đúng theo ngón tay. Độ trễ tính từ `c` (`d_i = sweep × |r_i − c|`), nên chỗ gần tay phản ứng trước. Biên độ đi qua `L·tanh(A/L)`: kéo nhẹ thì gần như theo tay, kéo xa thì bị ghì lại mềm.

**7. Vẽ lại.** Lưới được vẽ theo Frame drop (8 hình/giây) như video. Riêng lúc đang kéo, hoặc vừa thả mà lưới chưa yên, nếu *Mượt khi tương tác* bật thì vẽ mỗi khung (~60 hình/giây) để tay thấy mượt.

**8. MacPaint theo vòng 6 giây.** Cỡ ô MacPaint trong video to nhỏ theo một nhịp đo được (9 → 45 px, lặp mỗi 6 giây). `pipeline.js` nội suy smoothstep giữa các mốc đó (hàm `videoBitmap`).

**Toạ độ con trỏ.** Canvas dùng `object-fit: contain` nên có viền trống quanh ảnh. Phải trừ viền và chia cho kích thước vùng ảnh để ra toạ độ 0..1 (xem `toUnit()` trong `interact.js`).

---

## 5. Mấy mẹo kỹ thuật đáng học

| Vấn đề | Cách giải trong dự án | Ở đâu |
|---|---|---|
| Blur bán kính lớn thì mẫu nhảy qua nét mảnh, ra sọc | Thu nhỏ ảnh 2× (mỗi lần lấy trung bình 2×2 nhờ lọc LINEAR) cho tới khi các mẫu đủ dày, blur ở ảnh nhỏ, rồi đọc lại | `blurTex()` trong `pipeline.js` |
| Nét phải dày đúng N px | Khoảng cách tới đường đồng mức ≈ `|v| / |∇v|` | shader `threshold` |
| Hàm ngẫu nhiên dùng `sin` bị sọc trên GPU yếu | "Hash without Sine" của Dave Hoskins | phần `common` của `shaders.js` |
| Đọc ảnh cạnh trang bị chặn khi mở bằng `file://` | Mọi ảnh dùng sẵn đều sinh bằng Canvas 2D | `textures.js` |
| Vẽ nhiều nét với `ctx.filter = blur()` rất chậm | Vẽ hết lên canvas phụ, blur đúng 1 lần | ảnh mẫu trong `textures.js` |
| Mép ô ASCII bị kẻ vạch do mipmap | Đọc atlas với bias −0.5 | shader `ascii` |
| Mất GPU giữa chừng | Nghe `webglcontextlost` / `restored`, giữ ảnh gốc trên CPU để dựng lại | `main.js` mục 4 |

---

## 6. Quy trình tự làm lại từ A đến Z

Cách học tốt nhất là tự viết lại. Mỗi mốc dưới đây **chạy được và nhìn thấy kết quả** rồi mới sang mốc sau.

| Mốc | Mục tiêu | Kiểm tra | Đối chiếu |
|---|---|---|---|
| A | Tô cả canvas một màu bằng shader | Canvas đỏ | `gl.js`, `vert` |
| B | Gradient theo toạ độ `vec4(vUv, 0, 1)` | Góc dưới trái đen, trên phải vàng | — |
| C | Hiện ảnh, nhớ lật trục Y | Ảnh không lộn ngược | `upload()`, shader `source` |
| D | Thanh trượt điều khiển uniform | Kéo là đổi ngay | `setUniforms()` |
| E | Frame drop + camera shake | Ảnh giật 8 lần/giây | shader `motion`, `currentStep` |
| F | Threshold fill, rồi edge | Ra nét viền mảnh | shader `threshold` |
| G | Render target + nối 2 bước | Threshold chạy trên ảnh đã rung | `draw()`, `render()` |
| H | Blur 2 lượt | Nét mềm | shader `blur`, `blurTex()` |
| I | Atlas ký tự + ASCII | Ký tự theo nét | `glyphAtlas()`, shader `ascii` |
| J | Hoa văn + MacPaint + bản đồ mật độ | Khối xám bậc thang | `patternAtlas()`, shader `macpaint` |
| K | Texture, nền tối | Giống bản photocopy | shader `texture` |
| L | Elastic Grid: vòm sin + lò xo + độ trễ, rồi kéo/chạm | Hàng, cột to nhỏ như video; kéo thì co giãn theo tay | `grid.js`, `interact.js`, đầu shader `motion` |
| M | Xuất PNG, video, preset | Có file | `export.js` |
| N | Schema tự sinh giao diện | Thêm 1 dòng ra 1 thanh trượt | `presets.js`, `ui.js` |

Mẹo:
- **Luôn có cách xem kết quả trung gian** (như thanh 0–6). Shader sai thường chỉ ra màn hình đen.
- **Debug shader bằng màu:** GLSL không có `console.log`. Gán `gl_FragColor = vec4(vec3(giá_trị), 1.0)` rồi nhìn độ sáng.
- **Sửa một chỗ, lưu, xem.** Dùng Live Server để vòng lặp này chỉ mất vài giây.

---

## 7. Chưa biết gì về mảng này thì có làm được không?

**Được**, nếu bạn đã viết được HTML/JS cơ bản (biến, hàm, vòng lặp, sự kiện). Mình hỗ trợ được mọi bước: giải thích từng dòng, sửa lỗi shader, review code bạn tự viết.

| Mức khó | Nội dung |
|---|---|
| Dễ | Đổi mặc định, thêm preset, thêm bộ ký tự: chỉ sửa `presets.js` |
| Vừa | Đọc hiểu và sửa shader: GLSL giống C/JS, chỉ cần quen `vec2`, `mix`, `step`, `smoothstep`, `fract`, `floor` |
| Khó nhất | Cách nghĩ "một pixel": không có vòng lặp qua ảnh, không biết pixel bên cạnh ra gì. Cần 1–2 tuần luyện |
| Khó nhưng ít đụng | Phần WebGL rườm rà (buffer, framebuffer): `gl.js` đã làm sẵn |

**Lộ trình (mỗi ngày khoảng 1 giờ):**
- **Tuần 1:** The Book of Shaders, các chương *Getting started* → *Shaping functions* → *Colors*. Song song, đọc shader `motion` và `threshold`.
- **Tuần 2:** các chương *Patterns*, *Random*, *Noise*. Đọc lại shader `ascii`, `macpaint`, `texture`.
- **Tuần 3:** WebGL Fundamentals, các bài *Image Processing* (chính là chuỗi render target). Tự làm mốc A → G.
- **Tuần 4 trở đi:** làm tiếp mốc H → N, hoặc thử các bài ở mục 10.

Cách nhờ mình hiệu quả nhất: gửi đoạn code + ảnh chụp kết quả + điều bạn muốn. Nếu là lỗi shader, gửi nguyên thông báo lỗi; trang đã in sẵn lỗi kèm số dòng.

---

## 8. Tài liệu tham khảo

**Nguồn của đoạn giới thiệu ban đầu:** Effect.app (<https://effect.app>) và bài đăng của họ (@effect_app). Các chi tiết "chạy bằng WebGL, WebCodecs", "38 mẫu MacPaint" là Effect.app tự giới thiệu, mình chưa kiểm chứng. Dự án này viết độc lập, không dùng mã nguồn hay texture của họ.

| Tài liệu | Link | Dùng để |
|---|---|---|
| The Book of Shaders | <https://thebookofshaders.com> | Nhập môn cách nghĩ "một pixel", noise, pattern |
| WebGL Fundamentals | <https://webglfundamentals.org> | WebGL, image processing, framebuffer |
| MDN: WebGL API | <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API> | Tra hàm `gl.*` |
| Shadertoy | <https://www.shadertoy.com> | Shader mẫu, sửa và xem ngay |
| Inigo Quilez: Articles | <https://iquilezles.org/articles/> | Noise, hàm khoảng cách (nâng cao) |
| Hash without Sine | <https://www.shadertoy.com/view/4djSRW> | Hàm ngẫu nhiên dùng trong dự án |
| Thresholding | <https://en.wikipedia.org/wiki/Thresholding_(image_processing)> | |
| Sobel / edge detection | <https://en.wikipedia.org/wiki/Sobel_operator> | |
| Gaussian blur | <https://en.wikipedia.org/wiki/Gaussian_blur> | |
| ASCII art | <https://en.wikipedia.org/wiki/ASCII_art> | Bộ ký tự Paul Bourke |
| MacPaint | <https://en.wikipedia.org/wiki/MacPaint> | |
| Blend modes | <https://en.wikipedia.org/wiki/Blend_modes> | Multiply, Overlay |
| captureStream | <https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream> | Quay video từ canvas |
| MediaRecorder | <https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder> | |
| WebCodecs | <https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API> | Bước tiếp theo nếu cần MP4 chất lượng cao |
| Pointer Events | <https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events> | Chuột + cảm ứng |

---

## 9. Lỗi thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Khung ảnh hiện chữ đỏ "Lỗi biên dịch shader" | Sai cú pháp GLSL | Đọc số dòng trong thông báo. Lỗi hay gặp: viết `1` thay vì `1.0`, thiếu `;` |
| Màn hình đen | Uniform sai tên hoặc chưa gán | Xem từng bước bằng nút 0–6; gán `gl_FragColor` bằng giá trị cần kiểm tra |
| Console báo `Illegal 'use strict'` | Đặt `'use strict'` trong hàm có tham số dạng `{...}` | Bỏ dòng đó hoặc đưa ra ngoài hàm |
| Trang mở rất chậm | Vẽ Canvas 2D với `ctx.filter` lặp lại nhiều lần | Vẽ lên canvas phụ, lọc 1 lần |
| Không thấy nét | Ngưỡng không hợp với ảnh | Bước 2, đổi sang Fill, chỉnh *Ngưỡng sáng* tới khi vật đen rõ, rồi đổi lại Edge |
| Không có khối xám | Ngưỡng bật ô quá cao hoặc độ lan quá thấp | Lớp MacPaint: giảm *Ngưỡng bật ô*, tăng *Độ lan* |
| Tải ảnh không được | HEIC, hoặc kéo ảnh từ web khác | Đọc thông báo cuối màn hình; xem README mục "Đưa ảnh vào" |
| Video bị vỡ khối | Nhiều hạt nhiễu | Giảm *Hạt* ở lớp Texture, hoặc quay ở 1080 px |
| Máy nóng, giật | 2400 px quá nặng với GPU | Chọn Xử lý 1080 hoặc 1600 px |

---

## 10. Bài tập mở rộng

Từ dễ đến khó:

1. **Thêm hoa văn MacPaint** vào `PATTERNS` (vẽ ra giấy ô 8×8, đổi từng hàng thành số nhị phân rồi sang hex). Nhớ sửa số `12` trong shader `macpaint`.
2. **Bộ ký tự riêng:** thêm vào `RAMPS`, ví dụ chữ tiếng Việt có dấu.
3. **Màu:** thêm tham số màu mực, màu khối xám (uniform `vec3`).
4. **Dithering Bayer 4×4:** thêm một bước mới so độ sáng với ma trận ngưỡng.
5. **Halftone:** thay hoa văn bằng chấm tròn to nhỏ theo độ đậm.
6. **Video đầu vào:** dùng thẻ `<video>` làm ảnh nguồn, upload lại mỗi khung.
7. **Xuất MP4 bằng WebCodecs:** render từng khung theo thời gian giả lập, không phụ thuộc tốc độ máy.
8. **Kéo thả để đổi thứ tự các bước** trong bảng điều khiển. Đây là bước đầu để thành một "effect engine" như Effect.app.
