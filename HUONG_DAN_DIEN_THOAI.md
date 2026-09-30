# Chạy Contour Lines Lab trên điện thoại

Hướng dẫn từng bước để mở app trên iPhone (và Android), thêm biểu tượng ra màn hình chính, và thử ngay trên điện thoại khi đang sửa code.

---

## Mục lục

1. [Chọn cách nào?](#1-chọn-cách-nào)
2. [Vì sao không gửi file HTML qua Zalo cho iPhone được?](#2-vì-sao-không-gửi-file-html-qua-zalo-cho-iphone-được)
3. [Cách 1: Đưa lên GitHub Pages (link cố định)](#3-cách-1-đưa-lên-github-pages-link-cố-định)
4. [Cách 2: Thêm vào màn hình chính (như một app)](#4-cách-2-thêm-vào-màn-hình-chính-như-một-app)
5. [Cách 3: Thử nhanh qua Wi-Fi khi đang sửa code](#5-cách-3-thử-nhanh-qua-wi-fi-khi-đang-sửa-code)
6. [Dùng app trên điện thoại](#6-dùng-app-trên-điện-thoại)
7. [Kiểm tra sau khi cài](#7-kiểm-tra-sau-khi-cài)
8. [Lỗi thường gặp](#8-lỗi-thường-gặp)

---

## 1. Chọn cách nào?

| Bạn muốn | Dùng cách |
|---|---|
| Có một đường link mở được ở mọi nơi, gửi cho người khác | **Cách 1** GitHub Pages |
| Có biểu tượng trên màn hình chính, mở ra toàn màn hình như app | **Cách 1**, rồi **Cách 2** |
| Đang sửa code và muốn xem ngay trên điện thoại, chưa muốn đăng lên mạng | **Cách 3** Wi-Fi |

Cách 2 không đứng một mình được: phải mở app bằng Cách 1 hoặc Cách 3 trước, rồi mới "thêm vào màn hình chính".

---

## 2. Vì sao không gửi file HTML qua Zalo cho iPhone được?

Trên máy tính, gửi file `contour-lines-lab.html` là người nhận nhấp đúp chạy được. Trên iPhone thì không. Khi bạn mở file HTML từ Zalo, Messenger hay app Tệp, iOS chỉ hiện một **bản xem trước**, không phải Safari thật. Bản xem trước này không chạy WebGL đầy đủ, nên trang trắng hoặc báo lỗi.

Muốn chạy thật trên iPhone, app phải được mở bằng Safari qua một **địa chỉ web** (`https://...` hoặc `http://...`). Đó là lý do có Cách 1 và Cách 3.

Android thì khá hơn: mở file bằng Chrome thường chạy được, nhưng vẫn nên dùng Cách 1 cho chắc.

---

## 3. Cách 1: Đưa lên GitHub Pages (link cố định)

GitHub Pages là dịch vụ **miễn phí** của GitHub: biến thư mục dự án trên GitHub thành một trang web. Dự án đã có sẵn trên GitHub ở `https://github.com/HaNguyen051/contour-lines-lab`, và đã có sẵn mọi thứ Pages cần (`index.html` ở thư mục gốc, file `.nojekyll`). Bạn chỉ cần đẩy code mới lên rồi bật Pages.

### ⚠️ Đọc trước khi đăng

- **Trang sẽ công khai.** Ai có link cũng xem được, và mọi file trong repo (kể cả tài liệu) đều tải về được.
- **Repo phải để Public.** Repo Private chỉ dùng được Pages nếu có gói GitHub trả phí.
- **Ảnh mở sẵn `assets/xuong-rong.jpg` là ảnh cành gai lấy từ bài đăng mẫu, không phải ảnh của bạn.** Đăng công khai kèm ảnh này là dùng ảnh của người khác. Nên thay bằng ảnh bạn tự chụp trước khi bật Pages (xem README, mục *Đổi ảnh mở sẵn*).

### Bước 1: Đẩy code mới lên GitHub

**Bằng VS Code (dễ nhất):**
1. Bấm biểu tượng **Source Control** ở thanh bên trái (hình ba chấm nối nhau), hoặc nhấn `Ctrl+Shift+G`.
2. Gõ một dòng mô tả vào ô *Message*, ví dụ `Thêm giao diện điện thoại`.
3. Bấm **Commit**. Nếu VS Code hỏi có muốn commit tất cả thay đổi không, chọn **Yes**.
4. Bấm **Sync Changes** (hoặc **Push**). Lần đầu VS Code có thể hỏi đăng nhập GitHub: làm theo hướng dẫn trên màn hình.

**Bằng dòng lệnh:**
```
git add -A
git commit -m "Thêm giao diện điện thoại"
git push
```

### Bước 2: Bật GitHub Pages

1. Mở `https://github.com/HaNguyen051/contour-lines-lab` bằng trình duyệt, đăng nhập đúng tài khoản sở hữu repo.
2. Nếu repo đang Private: vào **Settings** → kéo xuống cuối, phần **Danger Zone** → **Change visibility** → **Public**.
3. Vào **Settings** → menu bên trái chọn **Pages**.
4. Ở mục **Build and deployment**:
   - **Source**: chọn **Deploy from a branch**.
   - **Branch**: chọn **main**, thư mục **/ (root)**, rồi bấm **Save**.
5. Chờ 1–2 phút rồi tải lại trang Settings → Pages. Khi thấy dòng *"Your site is live at …"* là xong.

Địa chỉ app sẽ là:

```
https://hanguyen051.github.io/contour-lines-lab/
```

(Tên tài khoản trong địa chỉ luôn viết thường.)

### Bước 3: Mở trên iPhone

1. Mở **Safari** (nên dùng Safari để "Thêm vào màn hình chính" ở Cách 2).
2. Gõ địa chỉ ở trên. Lần đầu có thể chờ vài giây vì phải tải ảnh mở sẵn (~300 KB).

### Cập nhật sau khi sửa code

Mỗi lần sửa xong, chỉ cần **commit + push** như Bước 1. GitHub tự đăng lại sau khoảng 1 phút.

Nếu điện thoại vẫn hiện bản cũ, Safari đang giữ bản cũ trong bộ nhớ đệm:
- Kéo trang xuống để tải lại, hoặc giữ nút tải lại ↻ trên thanh địa chỉ.
- Vẫn chưa được: thêm `?v=2` vào cuối địa chỉ (lần sau đổi thành `?v=3`…).
- App đã thêm ra màn hình chính: vuốt tắt hẳn app trong trình chuyển app rồi mở lại.

---

## 4. Cách 2: Thêm vào màn hình chính (như một app)

Sau khi mở được app bằng Cách 1 (hoặc Cách 3):

**iPhone / iPad (Safari):**
1. Bấm nút **Chia sẻ** (ô vuông có mũi tên chỉ lên, ở thanh dưới hoặc thanh trên).
2. Kéo danh sách xuống, chọn **Thêm vào MH chính** (*Add to Home Screen*).
3. Tên mặc định là *Contour Lines*, đổi được. Bấm **Thêm**.

**Android (Chrome):**
1. Bấm nút **⋮** góc trên bên phải.
2. Chọn **Thêm vào màn hình chính** hoặc **Cài đặt ứng dụng**.

Kết quả:
- Có biểu tượng riêng (nét viền cành gai trên nền đen) ngoài màn hình chính.
- Mở ra **toàn màn hình**, không có thanh địa chỉ Safari, giống một app thật.
- Mỗi lần mở, app lấy bản mới nhất từ GitHub Pages.

Lưu ý:
- **Cần có mạng** mỗi lần mở; app chưa có chế độ ngoại tuyến.
- Thêm từ địa chỉ Wi-Fi của Cách 3 cũng được, nhưng biểu tượng đó chỉ chạy khi máy tính đang bật máy chủ và cùng mạng. Nên thêm từ link GitHub Pages.

---

## 5. Cách 3: Thử nhanh qua Wi-Fi khi đang sửa code

Dùng khi muốn xem ngay trên điện thoại mà chưa đẩy lên GitHub. Máy tính và điện thoại phải **cùng một mạng Wi-Fi**.

### Bước 1: Chạy máy chủ trên máy tính

Mở Terminal trong VS Code (`` Ctrl+` ``) ở thư mục dự án, gõ:

```
python -m http.server 8000 --bind 0.0.0.0
```

Để cửa sổ đó mở. Muốn tắt thì nhấn `Ctrl+C`.

Lần đầu, Windows có thể hỏi có cho Python truy cập mạng không: tích **Private networks** (mạng riêng) rồi bấm **Allow access**.

### Bước 2: Tìm địa chỉ IP của máy tính

Mở một Terminal khác, gõ:

```
ipconfig
```

Tìm dòng **IPv4 Address** trong phần *Wireless LAN adapter Wi-Fi*, ví dụ `192.168.1.23`.

### Bước 3: Mở trên điện thoại

Mở Safari, gõ (thay đúng IP của bạn):

```
http://192.168.1.23:8000
```

Sửa code xong, lưu file, rồi **tải lại trang trên điện thoại** là thấy thay đổi (máy chủ này không tự tải lại như Live Server).

**Không vào được?**
- Kiểm tra hai máy cùng một Wi-Fi (không phải một máy Wi-Fi, một máy 4G).
- Wi-Fi quán cà phê, công ty thường chặn các máy nhìn thấy nhau. Thử phát Wi-Fi từ điện thoại cho máy tính dùng, rồi làm lại Bước 2.
- Tường lửa Windows chặn: vào *Windows Security → Firewall & network protection → Allow an app through firewall*, cho phép **Python** ở mạng Private.

---

## 6. Dùng app trên điện thoại

### Màn hình chính (chế độ xem)

Ảnh hiện toàn màn hình. Thanh nút dưới đáy:

| Nút | Tác dụng |
|---|---|
| **Tải ảnh** | Chọn ảnh từ **Thư viện ảnh**, **Chụp ảnh** mới, hoặc chọn từ app **Tệp** |
| **⏸ / ▶** | Dừng / chạy hoạt hình. Lúc dừng, ảnh đứng im hoàn toàn |
| **Lưu PNG** | Mở bảng **Chia sẻ** → chọn **Lưu hình ảnh** để cất vào app **Ảnh** |
| **Tuỳ chỉnh** | Mở bảng chỉnh thông số |

### Tương tác

- **Đặt ngón tay lên ảnh rồi vuốt**: vùng quanh ngón tay bị hút dồn về phía ngón tay, giống rê chuột trên máy tính. Vuốt càng nhanh biến dạng càng mạnh.
- **Nhấc tay**: ảnh từ từ duỗi về phẳng (khoảng 3 giây).
- Chỉ ngón đầu tiên có tác dụng; ngón thứ hai bị bỏ qua.
- Chạm vào viền đen trống quanh ảnh, hoặc kéo thanh trượt trong bảng Tuỳ chỉnh, thì ảnh không biến dạng.

### Bảng Tuỳ chỉnh

- Bấm **Tuỳ chỉnh**: ảnh thu lên nửa trên, bảng trượt từ dưới lên. Kéo thanh trượt là thấy ảnh đổi ngay.
- Hàng nút nhỏ ngay dưới ảnh (**0 Ảnh gốc … 6 Texture**): vuốt ngang để xem hết, chạm để xem kết quả tới bước đó.
- Các lớp gập sẵn; **chạm vào tên lớp** để mở. Công tắc bên phải tên lớp để bật/tắt lớp đó.
- Đóng bảng: bấm **Xong**, hoặc **kéo thanh nắm** (vạch xám trên cùng) xuống.
- **VI / EN** để đổi ngôn ngữ.
- Xoay ngang điện thoại: ảnh bên trái, bảng bên phải.

### Ảnh HEIC của iPhone

iPhone thường lưu ảnh dạng HEIC. Khi chọn từ Thư viện ảnh, iOS thường **tự đổi sang JPEG**, và Safari 17 trở lên cũng đọc được HEIC, nên phần lớn trường hợp chạy bình thường. Nếu vẫn báo lỗi "ảnh HEIC", hãy chụp màn hình ảnh đó rồi chọn ảnh chụp màn hình, hoặc đổi cài đặt máy ảnh: **Cài đặt → Camera → Định dạng → Tương thích nhất**.

### Trên điện thoại chưa có

Để giữ giao diện gọn, điện thoại hiện **chưa có**: chọn preset, đổi khung hình, đổi độ phân giải, quay video, lưu/mở preset, ảnh mẫu mới. Các chức năng này vẫn đầy đủ trên máy tính. Điện thoại tự xử lý ở **1080 px** cho nhẹ máy.

---

## 7. Kiểm tra sau khi cài

Trên iPhone, mở app rồi đi lần lượt:

1. Ảnh hiện đầy màn hình, không bị tai thỏ che phía trên, thanh nút không đè lên vạch Home.
2. Vuốt ngón tay trên ảnh: ảnh biến dạng theo tay; nhấc tay: ảnh từ từ về phẳng; trang **không bị cuộn** theo ngón tay.
3. Chạm xuống một chỗ khác rồi giữ yên: ảnh **không giật**.
4. Bấm **Tuỳ chỉnh**: bảng trượt lên, ảnh vẫn thấy ở nửa trên. Mở lớp *Elastic Grid*, kéo *Độ co giãn*: ảnh đổi ngay, ảnh **không** biến dạng theo ngón tay đang kéo thanh trượt.
5. Chạm vào một ô chọn (ví dụ *Chế độ* ở lớp Threshold): trang **không tự phóng to**.
6. Kéo thanh nắm xuống: bảng đóng lại.
7. **Tải ảnh** → chọn một ảnh trong Thư viện: ảnh mới hiện ra kèm thông báo "Đã tải".
8. **Lưu PNG** → **Lưu hình ảnh**: mở app Ảnh thấy ảnh vừa lưu.
9. Xoay ngang: bố cục đổi thành ảnh trái / bảng phải.
10. Thêm vào màn hình chính rồi mở: toàn màn hình, không có thanh Safari.

---

## 8. Lỗi thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Trang trắng khi mở file HTML từ Zalo / app Tệp | Bản xem trước của iOS không chạy WebGL | Mở bằng Safari qua địa chỉ web (Cách 1 hoặc 3) |
| Báo "Trình duyệt không cấp được WebGL" | Safari quá cũ, hoặc tắt WebGL trong cài đặt thử nghiệm | Cập nhật iOS; kiểm tra *Cài đặt → Safari → Nâng cao → Tính năng* xem WebGL có bị tắt không |
| Hình biến mất khi quay lại app sau một lúc | iOS thu hồi bộ nhớ GPU khi app chạy nền | App tự báo "Mất kết nối GPU" rồi tự dựng lại; nếu không, tải lại trang |
| Điện thoại nóng, hoạt hình giật | GPU làm việc liên tục | Bấm ⏸ khi không xem; tắt *Chế độ nguồn điện thấp* (chế độ này làm Safari chạy chậm) |
| Bấm Lưu PNG không thấy "Lưu hình ảnh" | iOS cũ hơn 15 không chia sẻ được file ảnh từ web | App tự tải về app **Tệp** (thư mục Tải về) |
| Không thấy "Thêm vào MH chính" | Đang mở bằng Chrome trên iPhone, hoặc bằng bản xem trước | Mở bằng **Safari** |
| Sửa code rồi mà điện thoại vẫn hiện bản cũ | Bộ nhớ đệm của Safari / GitHub chưa đăng xong | Chờ 1–2 phút; tải lại; thêm `?v=2` vào địa chỉ (xem mục 3) |
| GitHub Pages báo lỗi 404 | Pages chưa bật, sai nhánh, hoặc repo Private | Làm lại Bước 2 của Cách 1; kiểm tra repo Public |
| Cách 3 không vào được | Khác mạng, Wi-Fi chặn, tường lửa | Xem mục "Không vào được?" ở Cách 3 |
