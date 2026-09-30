# Contour Lines Lab

Web app tái hiện hiệu ứng **Contour Lines** của Effect.app. Ảnh đi qua 7 bước và ra:
- nét viền "sôi";
- ký tự ASCII;
- khối xám kiểu MacPaint;
- nền photocopy tối;
- hoạt hình giật khoảng 7 hình/giây (đo từ video mẫu: 6,97);
- và **biến dạng do chuột điều khiển** — chỉ rê là đủ, không cần bấm. Không đụng chuột thì ảnh đứng yên.

Toàn bộ chạy trong trình duyệt bằng WebGL 1. Không cần cài đặt, không có bước build, không dùng thư viện ngoài. Ảnh không rời khỏi máy.

## Cách chạy

**Cách 1: Live Server (nên dùng khi sửa code)**
1. Mở thư mục này bằng VS Code.
2. Cài extension **Live Server** (Ritwick Dey).
3. Chuột phải `index.html` → **Open with Live Server**.
4. Mỗi lần lưu file (`Ctrl+S`), trang tự tải lại.

**Cách 2: Nhấp đúp** vào `index.html`. Trang mở bằng Chrome, Edge, Firefox hoặc Safari và vẫn chạy đầy đủ, vì mọi ảnh dùng sẵn đều sinh bằng code.

Font Be Vietnam Pro cần mạng. Khi mất mạng, trang tự dùng font hệ thống.

## Khung hình

Ô **Khung** trên thanh trên cùng, cạnh ô *Xử lý*. Chín lựa chọn:

| | |
|---|---|
| Theo ảnh gốc | giữ nguyên tỉ lệ ảnh bạn đưa vào |
| 1:1 | vuông |
| 4:5 · 3:4 · 2:3 · 9:16 | dọc — lần lượt hợp với Instagram, ảnh thường, in ảnh, story / reel |
| 4:3 · 3:2 · 16:9 | ngang — ảnh thường, máy ảnh, màn hình |

Ảnh được cắt kiểu **cover**: phủ kín khung rồi bỏ phần thừa, xén cân từ giữa. Không dùng
*contain* vì sẽ chừa viền trống, mà hiệu ứng này cần tràn viền.

Đổi khung luôn cắt lại **từ ảnh gốc** chứ không cắt chồng lên bản đã cắt, nên chuyển qua lại
bao nhiêu lần cũng không mất dần chất lượng. Việc cắt làm trên CPU trước khi upload texture,
nên pipeline và shader không phải biết gì về khung hình.

Cạnh dài vẫn theo ô *Xử lý* (mặc định 1600 px). Ví dụ với ảnh 1200×1600: chọn 1:1 ra canvas
1600×1600, chọn 9:16 ra 900×1600, chọn 16:9 ra 1600×900. PNG và video xuất ra đúng cỡ đó.

## Tiếng Việt / tiếng Anh

Nút **VI | EN** nằm cạnh nút ⚙ (có ở cả thanh trên lẫn thanh nổi chế độ xem). Lần đầu mở,
app tự chọn theo ngôn ngữ máy (`navigator.language`): máy tiếng Việt ra tiếng Việt, còn lại
ra tiếng Anh. Bấm đổi thì nhớ lựa chọn trong `localStorage`, lần sau mở vẫn đúng thứ tiếng đó.

Đổi ngôn ngữ **không làm mất thiết lập**: bảng điều khiển được dựng lại rồi đẩy nguyên giá trị
cũ vào, kể cả ảnh đang mở và biến dạng đang có.

Sửa hoặc bổ sung bản dịch:

```
python3 make-i18n.py
python3 build.py
```

Bảng dịch nằm trong `make-i18n.py` (196 cặp), sinh ra `js/i18n.js`. Từ điển **khoá bằng chính
chuỗi tiếng Việt**, nên tiếng Việt vừa là bản gốc vừa là bản dự phòng — thiếu bản dịch nào thì
chỗ đó hiện lại tiếng Việt chứ không vỡ giao diện. Hệ quả cần nhớ: **sửa chữ tiếng Việt trong
mã nguồn thì phải sửa khoá tương ứng trong `make-i18n.py`**, không thì chỗ đó thôi dịch.

Cách kiểm tra còn sót: mở trang, bấm **EN**, rồi soi xem còn chữ có dấu nào không.

Riêng hai file tài liệu này (`README.md`, `HUONG_DAN.md`) **chưa dịch** — chúng dài gấp nhiều
lần phần giao diện, và người dùng app không cần đọc.

## Đổi ảnh mở sẵn

Ảnh hiện ra lúc mở trang nằm ở `assets/xuong-rong.jpg`, và được nhúng vào
`js/sample-image.js` dưới dạng data URI base64.

```
python3 make-sample.py "đường/dẫn/ảnh-mới.jpg"
python3 build.py
```

Lệnh đầu thu ảnh về cạnh dài 1600 px (đúng độ phân giải xử lý mặc định), lưu vào `assets/`
rồi sinh lại `js/sample-image.js`. Lệnh sau cập nhật bản gộp một file.

**Vì sao phải nhúng chứ không trỏ thẳng `<img src="assets/...">`:** khi trang mở bằng
`file://` (nhấp đúp), trình duyệt coi ảnh cục bộ là **khác nguồn**, canvas bị nhiễm bẩn và
`gl.texImage2D` ném `SECURITY_ERR` — trang sẽ trắng. data URI thì cùng nguồn nên nạp
texture được, và cũng nhờ vậy bản gộp một file mới mang theo được ảnh.

Nút **Ảnh mẫu mới** vẫn sinh ảnh bằng code như cũ, không liên quan tới ảnh mở sẵn.

## Gửi cho người khác

Dự án **không có bước build** (không `package.json`, không bundler). Nhưng cũng vì thế mà
gửi mỗi `index.html` là hỏng: nó gọi tới `css/style.css` và 10 file `js/*.js` bằng đường
dẫn tương đối, thiếu là ra trang trắng.

Hai cách:

**Cách 1 — một file duy nhất (nên dùng khi gửi qua Zalo / Messenger / email):**

```
python3 build.py
```

Sinh ra `contour-lines-lab.html` (~425 KB), đã nhúng sẵn toàn bộ CSS, JS và ảnh mở sẵn. Gửi đúng file
đó, người nhận nhấp đúp là chạy, không cần cài gì. Chạy lại lệnh này mỗi khi sửa code.

**Cách 2 — nén cả thư mục:** giữ nguyên cấu trúc `index.html` + `css/` + `js/`, zip rồi gửi.
Người nhận giải nén và nhấp đúp `index.html`.

Cả hai cách đều chạy bằng `file://`, không cần server, vì code không đọc file nào lúc chạy
(ảnh mẫu sinh bằng code). Chỉ font Be Vietnam Pro là tải từ Google Fonts — mất mạng thì tự
rơi về font hệ thống, app vẫn chạy đủ.

Máy người nhận cần trình duyệt có **WebGL** (Chrome, Edge, Firefox, Safari đời mới đều có).

## Dùng thế nào

Trang mở ở **chế độ xem**: chỉ có ảnh và một thanh nút nhỏ ở cuối màn hình. Bấm **⚙ Tuỳ chỉnh** hoặc phím **H** để mở bảng điều khiển.

### Elastic Grid và tương tác

Ảnh được chia thành lưới 8 cột × 10 hàng, và cả lưới hành xử như **một tấm thạch**: các ô kéo theo nhau nên biến dạng lan ra và đường lưới cong được. Bốn mép khung không bao giờ di chuyển.

Chỉ có **một** nguồn chuyển động: con trỏ chuột. Không có nhịp tự chạy theo đồng hồ.

| Thao tác | Kết quả |
|---|---|
| Để yên, không đụng chuột | **Ảnh đứng phẳng, hoàn toàn bất động.** Không có nhịp tự chạy nào |
| Rê chuột qua ảnh (không cần bấm) | Vùng quanh con trỏ bị **hút dồn về phía con trỏ**, hai bên cùng dồn vào. Tâm biến dạng nằm **đúng chỗ con trỏ**, ở bất kỳ đâu trong khung. Rê càng nhanh biến dạng càng mạnh |
| Ngừng rê (con trỏ vẫn trong khung) | Biến dạng tiêu dần, ảnh **từ từ duỗi về phẳng** trong khoảng *Thời gian về phẳng* |
| Đưa chuột ra ngoài ảnh | Y như ngừng rê: ảnh về phẳng |
| Bấm chuột | Không có tác dụng riêng |
| Phím `G` | Hiện / ẩn các đường lưới màu xanh — thấy rõ lưới đang cong thế nào (không có trong PNG hay video xuất ra) |

Các thanh ở lớp **✦ Elastic Grid** (ngay dưới lớp 1 Chuyển động):

| Thanh | Tác dụng |
|---|---|
| *Độ co giãn* | Biên độ tối đa. 0.15 cho ô to nhất ~1.7x, nhỏ nhất ~0.6x như video |
| *Vùng ảnh hưởng* | Biến dạng toả rộng bao xa quanh con trỏ. Nhỏ = bóp một vùng hẹp; lớn = gần cả ảnh dồn về con trỏ |
| *Chuột hút vào* | Bật (mặc định): con trỏ hút ảnh về phía mình. Tắt: con trỏ đẩy ảnh ra xa |
| *Độ nhạy chuột* | Rê nhẹ đã biến dạng mạnh hay phải rê nhiều mới thấy |
| *Thời gian về phẳng* | Ngừng rê thì bao lâu ảnh duỗi hết về phẳng. Lớn = giữ hình lâu hơn |
| *Độ dẻo* | Chất thạch, **và cũng là độ trễ lan truyền**: 0 = mỗi hàng/cột chạy riêng, chỗ xa con trỏ không đi sau; cao = biến dạng lan ra, chỗ xa tới muộn hơn |
| *Độ mềm* | Lưới búng về hình mới ngay (thấp) hay trôi lừ đừ (cao) |
| *Độ nảy* | Vượt quá rồi dội lại vài nhịp (cao) hay tới nơi là dừng (0) |

Các thanh còn lại nằm trong mục *Nâng cao* gập lại ở cuối mỗi lớp.

### Phím tắt

| Phím | Tác dụng |
|---|---|
| `Space` | Dừng / chạy. Lúc dừng thì **đóng băng hoàn toàn**: hoạt hình giật đứng, và rê chuột cũng không làm ảnh biến dạng nữa. Ảnh giữ nguyên hình đang có, nên Lưu PNG lấy đúng khung đang nhìn |
| `0`–`6` | Xem kết quả tới bước 0–6 |
| `H` | Bật/tắt bảng tuỳ chỉnh |
| `G` | Hiện / ẩn đường lưới Elastic Grid |
| `Ctrl+V` | Dán ảnh |

Phím tắt không chạy khi đang gõ trong ô nhập. Nếu máy bật chế độ *giảm chuyển động* (prefers-reduced-motion), trang mở ở trạng thái dừng.

### Đưa ảnh vào

Có 3 cách:
- nút **Tải ảnh lên**;
- **kéo thả** file vào bất kỳ đâu trong trang;
- **Ctrl+V** (ảnh chụp màn hình, hoặc chuột phải ảnh trên web → *Sao chép hình ảnh*).

Yêu cầu với ảnh:

| Mục | Yêu cầu |
|---|---|
| Định dạng | JPG, PNG, WebP, GIF, BMP. **Không đọc được HEIC** (ảnh iPhone): đổi sang JPG, hoặc chụp màn hình rồi Ctrl+V |
| Kích thước | Bao nhiêu cũng được. Ảnh lớn hơn 2400 px tự thu nhỏ; PNG trong suốt được lót nền trắng |
| Nội dung đẹp nhất | Vật thể tối trên nền sáng, nền trơn, tương phản cao |
| Nền xám, nét không ra | Lớp 0: kéo **Điểm trắng** xuống. Lớp 2: chỉnh **Ngưỡng sáng** |
| Không làm được | Kéo ảnh thẳng từ trang web khác sang (trình duyệt chặn vì bảo mật). Hãy dùng Ctrl+V |

Mỗi lần tải, cuối màn hình hiện thông báo thành công hoặc lý do lỗi.

### Xuất file

- **Lưu PNG**: đúng độ phân giải xử lý (1080 / 1600 / 2400 px cạnh dài).
- **Quay video**: 3, 4, 6, 10 giây, hoặc "1 vòng lặp" (khi *Vòng lặp* ở lớp Chuyển động lớn hơn 0).
  - Chrome và Firefox ra WebM, Safari ra MP4.
  - Thao tác chuột trong lúc quay cũng được ghi lại.
  - Bấm **■ Dừng quay** để dừng sớm.
- **Lưu preset / Mở preset**: file JSON `{app, version, state}`. Khi mở, chỉ nhận khoá hợp lệ và đúng kiểu dữ liệu; số bị kẹp trong khoảng cho phép.

### Preset có sẵn

- Contour Lines (giống video)
- Bản tĩnh
- Giấy sáng
- Chỉ nét viền
- ASCII dày
- ASCII cổ điển
- Dither MacPaint

Đổi bất kỳ tham số nào thì ô preset chuyển thành "Tuỳ chỉnh".

## Chỗ sửa thông số

**`js/presets.js`**:
- `SCHEMA`: mọi tham số, gồm giá trị mặc định, khoảng thanh trượt và chú thích tiếng Việt. Bảng điều khiển sinh tự động từ đây: thêm một dòng là có thêm một thanh trượt.
- `PRESETS`: các preset, ghi dưới dạng "phần khác so với mặc định".
- `RAMPS`: các bộ ký tự ASCII.

Đơn vị px tính cho ảnh có cạnh dài 1600 px. Xử lý ở 2400 px thì mọi kích thước tự nhân 1.5, nên đổi độ phân giải không làm đổi hiệu ứng.

Chỉnh thử trong Console (F12):

```js
CL.app.state.ascii.cell = 24; CL.app.refresh();
```

## Cấu trúc file

```
index.html        Khung trang
css/style.css     Giao diện (tông máy photocopy, dark mode, chế độ xem)
js/gl.js          Tiện ích WebGL: program, texture, render target, uniform
js/shaders.js     Toàn bộ GLSL: mỗi bước một shader, chú thích từng dòng
js/textures.js    Sinh bằng code: atlas ký tự, 12 hoa văn MacPaint, ảnh mẫu cành gai
js/presets.js     ★ Schema tham số + preset
js/pipeline.js    Chạy chuỗi pass; blur có thu nhỏ trước để chống sọc
js/ui.js          Tự sinh bảng điều khiển, thanh 7 bước, thông báo
js/grid.js        Elastic Grid: tấm thạch 2D (lưới nút nối lò xo, bướu lẻ đặt tại con trỏ)
js/interact.js    Ghi lại chỗ con trỏ, giao cho grid.js xử lý
js/export.js      PNG, video, preset JSON
js/main.js        Khởi động, vòng lặp khung hình, nhận ảnh, phím tắt, mất GPU
HUONG_DAN.md      Giải thích thuật toán, lộ trình học, tài liệu tham khảo
SPEC_ContourLinesLab.md  Đặc tả đầy đủ
```

Thứ tự nạp script trong `index.html` là quan trọng. Các file dùng script thường (không phải ES module) và gắn mọi thứ vào `window.CL`.

## Pipeline

| Bước | Tên | Làm gì |
|---|---|---|
| 0 | Ảnh gốc | Thu phóng về độ phân giải xử lý, lót nền trắng |
| 1 | Chuyển động | Camera shake → Elastic Grid (tra bảng biến dạng 2D) → đổi sang xám → Levels. Frame drop: chỉ vẽ lại khi số khung đổi |
| 2 | Threshold | Làm mềm, rồi vẽ đường viền dày đúng *width* px bằng công thức `|v| / |gradient|` |
| 3 | Gaussian blur | Làm mờ nét, trộn lại 30% |
| 4 | ASCII | Đo độ phủ mực từng ô, chọn ký tự trong atlas 8×8 |
| 5 | MacPaint | Bản đồ mật độ (blur rộng quanh nét) → ô nào gần nét thì tô hoa văn 8×8, trộn 40% ra khối xám |
| 6 | Texture | Giấy nhám, nền đen có vệt quét, mép tờ giấy sáng, tông ấm |

Bước bị tắt thì đi thẳng: kết quả của nó là kết quả bước trước.

## Kiểm tra nhanh sau khi sửa code

1. Mở bằng Live Server, nhấn F12 → Console: **không có dòng đỏ**.
2. Bấm lần lượt các nút 0 → 6 dưới ảnh:

| Bước | Phải thấy |
|---|---|
| 0 | Ảnh gốc |
| 1 | Ảnh xám, rung và uốn theo khung |
| 2 | Chỉ còn nét viền mảnh; nét đổi hình từng khung |
| 3 | Nét hơi mềm |
| 4 | Ký tự rắc dọc theo nét |
| 5 | Khối xám bậc thang ôm quanh nét, cỡ khối nhảy theo khung |
| 6 | Nền đen có vệt quét ngang, mép ảnh sáng loang |

3. Đổi từng preset trong ô **Preset**: không có lỗi, hình đổi đúng tên preset.
4. Nhấn `G` để hiện lưới: 8 × 10 ô, mép đứng yên. Không đụng chuột thì lưới đều tăm tắp; rê chuột qua ảnh thì nửa có con trỏ giãn ra, ngừng rê thì lưới duỗi về đều.
5. Lưu PNG, quay video 3 giây, lưu preset rồi mở lại: đều ra file và mở lại được.
6. Kiểm tra chống sọc: chọn Xử lý 2400 px, bước 5, lớp MacPaint đặt Hoa văn = "11 · Đặc" và Độ trộn = 1. Các khối đen phải liền mạch theo nét, không có sọc song song.

## Ghi chú

- Cần máy có WebGL. Nếu không có, trang báo lỗi rõ và gợi ý bật tăng tốc phần cứng.
- Khi GPU bị mất (driver lỗi, thiếu bộ nhớ), trang báo và tự dựng lại mọi thứ khi GPU được khôi phục.
- Ở 2400 px, app dùng khoảng 300 MB bộ nhớ GPU (9 render target). Máy yếu nên để 1080 hoặc 1600.
- Mọi texture, hoa văn, ảnh mẫu đều sinh bằng code, không dùng ảnh hay texture của Effect.app. File `assets/thorns.jpg` (ảnh bạn gửi) không được app dùng; muốn thử thì tải nó lên bằng nút **Tải ảnh lên**.
