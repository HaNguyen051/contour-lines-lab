# Contour Lines Lab

Web app tái hiện hiệu ứng **Contour Lines** của Effect.app. Ảnh đi qua 7 bước và ra:
- nét viền "sôi";
- ký tự ASCII;
- khối xám kiểu MacPaint;
- nền photocopy tối;
- hoạt hình giật khoảng 8 hình/giây;
- và tương tác được bằng chuột.

Toàn bộ chạy trong trình duyệt bằng WebGL 1. Không cần cài đặt, không có bước build, không dùng thư viện ngoài. Ảnh không rời khỏi máy.

## Cách chạy

**Cách 1: Live Server (nên dùng khi sửa code)**
1. Mở thư mục này bằng VS Code.
2. Cài extension **Live Server** (Ritwick Dey).
3. Chuột phải `index.html` → **Open with Live Server**.
4. Mỗi lần lưu file (`Ctrl+S`), trang tự tải lại.

**Cách 2: Nhấp đúp** vào `index.html`. Trang mở bằng Chrome, Edge, Firefox hoặc Safari và vẫn chạy đầy đủ, vì mọi ảnh dùng sẵn đều sinh bằng code.

Font Be Vietnam Pro cần mạng. Khi mất mạng, trang tự dùng font hệ thống.

## Dùng thế nào

Trang mở ở **chế độ xem**: chỉ có ảnh và một thanh nút nhỏ ở cuối màn hình. Bấm **⚙ Tuỳ chỉnh** hoặc phím **H** để mở bảng điều khiển.

### Elastic Grid và tương tác

Ảnh được chia thành lưới 8 cột × 10 hàng. Từng cột, từng hàng to nhỏ luân phiên như trong video, còn 4 mép khung không bao giờ di chuyển.

| Thao tác | Kết quả |
|---|---|
| Để yên | Khoảng 1,3 giây một nhịp, vùng to ra chuyển qua lại trái ↔ phải, rồi trên ↔ dưới. Các đường lưới chạy lần lượt, vượt đích nhẹ rồi đứng yên |
| Nắm và kéo | Điểm ảnh dưới con trỏ đi theo tay (hơi trễ). Hàng và cột trên cả khung co giãn theo: chỗ gần tay trước, chỗ xa sau. Kéo quá thì bị ghì lại mềm |
| Thả tay | Lưới nảy về rồi đứng yên; 1,5 giây sau tự chạy tiếp |
| Chạm nhanh (dưới 0,25 giây, không di chuyển) | Phía có điểm chạm to ra, phía kia nhỏ lại; chuyển động lan ra từ điểm chạm |
| Phím `G` | Hiện / ẩn các đường lưới màu xanh (để so với video; không có trong PNG hay video xuất ra) |

Chỉ theo con trỏ đầu tiên. Chỉnh số cột, số hàng, biên độ, độ nảy, nhịp... ở lớp **✦ Elastic Grid**, nằm ngay dưới lớp 1 Chuyển động.

### Phím tắt

| Phím | Tác dụng |
|---|---|
| `Space` | Dừng / chạy |
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
js/grid.js        Elastic Grid: lưới hàng/cột đàn hồi (lò xo, độ trễ, tự chạy, kéo, chạm)
js/interact.js    Con trỏ (chuột / cảm ứng) điều khiển lưới
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
| 1 | Chuyển động | Camera shake → Elastic Grid (tra ngược lưới hàng/cột) → đổi sang xám → Levels. Frame drop: chỉ vẽ lại khi số khung đổi |
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
4. Nhấn `G` để hiện lưới: 8 × 10 ô, mép đứng yên, đường thẳng. Kéo ảnh rồi thả: hàng/cột co giãn theo rồi nảy về.
5. Lưu PNG, quay video 3 giây, lưu preset rồi mở lại: đều ra file và mở lại được.
6. Kiểm tra chống sọc: chọn Xử lý 2400 px, bước 5, lớp MacPaint đặt Hoa văn = "11 · Đặc" và Độ trộn = 1. Các khối đen phải liền mạch theo nét, không có sọc song song.

## Ghi chú

- Cần máy có WebGL. Nếu không có, trang báo lỗi rõ và gợi ý bật tăng tốc phần cứng.
- Khi GPU bị mất (driver lỗi, thiếu bộ nhớ), trang báo và tự dựng lại mọi thứ khi GPU được khôi phục.
- Ở 2400 px, app dùng khoảng 300 MB bộ nhớ GPU (9 render target). Máy yếu nên để 1080 hoặc 1600.
- Mọi texture, hoa văn, ảnh mẫu đều sinh bằng code, không dùng ảnh hay texture của Effect.app. File `assets/thorns.jpg` (ảnh bạn gửi) không được app dùng; muốn thử thì tải nó lên bằng nút **Tải ảnh lên**.
