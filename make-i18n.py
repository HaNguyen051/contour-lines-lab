#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-i18n.py — sinh js/i18n.js (từ điển Việt → Anh cho giao diện).

    python3 make-i18n.py
    python3 build.py        # cập nhật bản gộp một file

Sửa bản dịch ở bảng P bên dưới rồi chạy lại. Mỗi dòng là (tiếng Việt, tiếng Anh, cờ).
Cờ = 1 nghĩa là chuỗi có chỗ điền %1, %2… (xem CL.t trong js/i18n.js).

Khoá từ điển là CHÍNH chuỗi tiếng Việt, nên tiếng Việt vừa là bản gốc vừa là bản dự
phòng: thiếu bản dịch nào thì giao diện hiện lại tiếng Việt chứ không vỡ. Đổi chữ tiếng
Việt trong mã nguồn thì phải đổi khoá tương ứng ở đây, nếu không chỗ đó thôi dịch.

Kiểm tra còn sót không: mở trang, bấm EN, rồi soi xem còn chữ có dấu nào không.
"""
import json, pathlib, sys
# (tiếng Việt, tiếng Anh, có phải dạng mới có %1 không)
P = [
# ---- tiêu đề lớp
("Ảnh gốc","Source image",0),("Chuyển động","Motion",0),
# ---- nhãn
("Điểm đen","Black point",0),("Điểm trắng","White point",0),
("Rung nét","Line wobble",0),("Rung nét: mật độ","Wobble: density",0),("Rung nét: tốc độ","Wobble: speed",0),
("Shake: độ dịch","Shake: offset",0),("Shake: độ xoay","Shake: rotation",0),
("Phóng to","Zoom in",0),("Vòng lặp","Loop",0),
("Độ co giãn","Stretch",0),("Vùng ảnh hưởng","Reach",0),("Độ dẻo","Jelliness",0),
("Độ mềm","Softness",0),("Độ nảy","Bounce",0),("Độ nhạy chuột","Mouse sensitivity",0),
("Thời gian về phẳng","Settle time",0),("Chuột hút vào","Cursor attracts",0),
("Số cột","Columns",0),("Số hàng","Rows",0),
("Mượt khi tương tác","Smooth while interacting",0),("Hiện lưới (phím G)","Show grid (G)",0),
("Chế độ","Mode",0),("Làm mềm trước","Pre-blur",0),("Ngưỡng sáng","Brightness threshold",0),
("Độ dày nét","Line width",0),("Độ nhám","Roughness",0),
("Bán kính","Radius",0),("Độ trộn","Blend",0),
("Bộ ký tự","Character set",0),("Cỡ ô","Cell size",0),("Mật độ","Density",0),
("Khuếch đại","Gain",0),("Độ phủ tối thiểu","Minimum coverage",0),("Ngẫu nhiên","Jitter",0),
("Độ đậm ký tự","Character opacity",0),("Giữ ảnh bên dưới","Keep image underneath",0),
("Nhấp nháy theo khung","Flicker every frame",0),
("Hoa văn","Pattern",0),("Cỡ ô theo thời gian","Cell size over time",0),("Nhảy cỡ ô","Cell size jump",0),
("Độ lan","Spread",0),("Ngưỡng bật ô","Cell threshold",0),("Cỡ điểm hoa văn","Pattern dot size",0),
("Nền tối","Dark background",0),("Ngưỡng nền","Background threshold",0),("Hạt","Grain",0),
("Vệt quét","Scan streaks",0),("Mép tờ giấy","Paper edge",0),("Tông ấm","Warm tone",0),
# ---- tên preset
("Contour Lines (giống video)","Contour Lines (like the video)",0),("Bản tĩnh","Still version",0),
("Giấy sáng","Light paper",0),("Chỉ nét viền","Outline only",0),("ASCII dày","Dense ASCII",0),
("ASCII cổ điển","Classic ASCII",0),("Dither MacPaint","MacPaint dither",0),
# ---- lựa chọn trong ô chọn
("Edge: chỉ nét viền","Edge: outline only",0),("Fill: mảng đen trắng","Fill: solid black & white",0),
("Theo video (vòng 6 giây)","Follow the video (6-second loop)",0),("Tắt (dùng Nhảy cỡ ô)","Off (use Cell size jump)",0),
("Tự động theo mật độ","Auto by density",0),
("Chấm thưa","Sparse dots",0),("Chấm lưới","Dot grid",0),("Sọc chéo mảnh","Thin diagonal",0),
("Lưới 25%","25% grid",0),("Sọc ngang","Horizontal stripes",0),("Đan chéo","Crosshatch",0),
("Gạch","Bricks",0),("Bàn cờ 50%","50% checker",0),("Sọc chéo dày","Thick diagonal",0),
("Dày 75%","75% dense",0),("Gần đặc","Nearly solid",0),("Đặc","Solid",0),
("Contour Lines (mặc định)","Contour Lines (default)",0),("Paul Bourke (cổ điển)","Paul Bourke (classic)",0),
("Khối","Blocks",0),("Chữ đậm + khối","Bold letters + blocks",0),("Chữ số","Digits",0),
# ---- mô tả
("Levels: kéo điểm đen và điểm trắng để tăng tương phản trước khi tách nét.",
 "Levels: drag the black and white points to boost contrast before edges are extracted.",0),
("Mọi chỗ tối hơn mức này thành đen hẳn.","Anything darker than this goes pure black.",0),
("Mọi chỗ sáng hơn mức này thành trắng hẳn. Ảnh nền xám thì kéo xuống để nền thành trắng.",
 "Anything brighter than this goes pure white. If the background is grey, drag this down to whiten it.",0),
("Frame drop + Camera shake: ảnh giật và rung theo từng khung. Lưới đàn hồi nằm ở lớp Elastic Grid ngay dưới.",
 "Frame drop + camera shake: the image steps and jitters frame by frame. The elastic grid lives in the Elastic Grid layer just below.",0),
("Thời gian được làm tròn xuống thành từng bước 1/fps giây. Đo từ video mẫu: 6.97 hình/giây (34 lần đổi hình trong 5 giây), nên mặc định để 7. 24–30 thì mượt.",
 "Time is rounded down into steps of 1/fps second. Measured from the reference video: 6.97 fps (34 image changes in 5 seconds), hence the default of 7. Use 24–30 for smooth motion.",0),
("Uốn ảnh theo nhiễu trôi, làm nét \"sôi\" kiểu chất lỏng. Video mẫu không có kiểu này nên mặc định 0.",
 "Warps the image with drifting noise so the lines \"boil\" like liquid. The reference video has none of this, so it defaults to 0.",0),
("Số ô lưới trên cạnh ngắn. Ít = sóng to và mềm, nhiều = gợn nhỏ.",
 "Grid cells along the short edge. Few = large soft waves, many = fine ripples.",0),
("Lưới nhiễu trôi nhanh hay chậm. 0 = lưới đứng yên.","How fast the noise grid drifts. 0 = frozen.",0),
("Mỗi khung dịch cả ảnh đi ngẫu nhiên tối đa bao nhiêu px.",
 "How many pixels the whole image can shift randomly each frame.",0),
("Góc xoay ngẫu nhiên tối đa mỗi khung.","Maximum random rotation per frame.",0),
("Phóng ảnh quanh tâm để khi rung không lộ mép.",
 "Scales the image up around its centre so the shake never exposes an edge.",0),
("0 = không lặp. Lớn hơn 0 thì sau khoảng này mọi chuyển động lặp lại, hợp để quay video lặp.",
 "0 = no loop. Above 0, all motion repeats after this interval — handy for recording a seamless loop.",0),
("Tấm thạch 2D do CON TRỎ điều khiển. Rê chuột (không cần bấm): vùng quanh con trỏ bị hút dồn về phía con trỏ, tâm biến dạng nằm đúng chỗ con trỏ chứ không nhảy về góc. Ngừng rê thì ảnh từ từ trở về phẳng. Không đụng chuột thì ảnh đứng yên.",
 "A 2D jelly sheet driven by the CURSOR. Move the mouse (no clicking): the area around the cursor is pulled in towards it, and the centre of the deformation sits exactly where the cursor is instead of snapping to a corner. Stop moving and the image slowly flattens out. Touch nothing and it stays perfectly still.",0),
("Ô phình ra / co lại nhiều hay ít. 0.15 cho ô to nhất ~1.7×, nhỏ nhất ~0.6× như video; mặc định 0.2 thì mạnh hơn video một chút.",
 "How much cells swell and shrink. 0.15 gives the largest cell ~1.7x and the smallest ~0.6x, like the video; the default of 0.2 is a little stronger than the video.",0),
("Biến dạng toả rộng bao xa quanh con trỏ (tính theo cạnh ngang). Nhỏ = chỉ một vùng hẹp quanh con trỏ bị dồn, phần còn lại đứng yên; lớn = gần cả ảnh cùng dồn về con trỏ.",
 "How far the deformation spreads around the cursor (measured along the horizontal edge). Small = only a narrow area is pulled in and the rest stays put; large = nearly the whole image moves towards the cursor.",0),
("Các ô kéo theo nhau nhiều hay ít, và cũng là thanh quyết định độ trễ lan truyền. 0 = mỗi hàng, mỗi cột chạy riêng, chỗ xa con trỏ không đi sau; cao = biến dạng lan ra như miếng thạch, đường lưới cong, chỗ xa tới muộn hơn.",
 "How strongly cells drag each other along — this is also the slider that sets the propagation delay. 0 = every row and column moves on its own, so distant areas never lag; high = the deformation spreads like jelly, grid lines curve, and far-away areas arrive later.",0),
("Thấp = búng về chỗ mới ngay, đanh. Cao = trôi chậm, lừ đừ.",
 "Low = snaps to the new shape at once, crisp. High = drifts slowly, sluggish.",0),
("Cao = vượt quá chỗ mới rồi dội qua dội lại vài nhịp. 0 = tới nơi là dừng.",
 "High = overshoots and rocks back and forth a few times. 0 = stops on arrival.",0),
("Rê con trỏ hết một cạnh khung thì biến dạng lên tới mức này lần biên độ đầy. Cao = nhích nhẹ đã biến dạng mạnh; thấp = phải rê nhiều mới thấy.",
 "Dragging the cursor across one full edge builds the deformation up to this many times the full amplitude. High = a small nudge already deforms a lot; low = you have to move a lot to see anything.",0),
("Ngừng rê thì sau khoảng này biến dạng tiêu hết và ảnh về phẳng. Lớn = ảnh giữ hình lâu hơn rồi mới duỗi ra.",
 "Once you stop moving, the deformation fades out over roughly this long and the image flattens. Larger = the image holds its shape longer before relaxing.",0),
("Bật: chỗ có con trỏ HÚT ảnh về phía mình. Tắt: chỗ có con trỏ ĐẨY ảnh ra xa. Hai kiểu là ảnh gương của nhau qua tâm khung.",
 "On: the cursor PULLS the image towards itself. Off: the cursor PUSHES the image away. The two modes are mirror images of each other through the centre of the frame.",0),
("Ít cột = sóng to và mềm, nhiều cột = gợn nhỏ và chi tiết hơn.",
 "Fewer columns = large soft waves; more columns = finer, more detailed ripples.",0),
("Bật: đang rê chuột, hoặc vừa ngừng mà lưới chưa yên, thì vẽ mỗi khung (~60 hình/giây). Còn lại vẽ theo Frame drop như video.",
 "On: while you are moving the mouse, or just after stopping while the grid is still settling, the page redraws every frame (~60 fps). Otherwise it redraws on the Frame drop step, like the video.",0),
("Vẽ đường lưới màu xanh lên ảnh để thấy tấm thạch đang cong thế nào. Không lọt vào PNG hay video xuất ra.",
 "Draws blue grid lines over the image so you can see how the jelly sheet is bending. Never appears in exported PNGs or videos.",0),
("Tách nét: vẽ đường viền mảnh tại ranh giới sáng/tối (edge) hoặc tô mảng đen trắng (fill).",
 "Edge extraction: draw a thin outline along the light/dark boundary (edge), or fill flat black and white areas (fill).",0),
("Edge cho ra đường bao quanh vật; Fill cho ra hình bóng đen đặc.",
 "Edge gives you an outline around the subject; Fill gives you a solid black silhouette.",0),
("Blur ảnh trước khi tách nét, để nét cong mượt và bỏ qua chi tiết vụn.",
 "Blurs the image before extracting edges, so lines curve smoothly and tiny details are ignored.",0),
("Nét nằm ở chỗ độ sáng bằng đúng mức này. Tăng thì nét dịch về phía vùng sáng.",
 "Lines sit exactly where brightness equals this value. Raise it and the lines move towards the lighter areas.",0),
("Cộng nhiễu trước khi so ngưỡng: mép nét lởm chởm và đổi theo từng khung.",
 "Adds noise before thresholding, so line edges come out ragged and change every frame.",0),
("Làm mờ nét rồi trộn lại một phần (30%) để nét mềm, bớt răng cưa.",
 "Blurs the lines then mixes part of it back (30%) to soften them and reduce jaggies.",0),
("0.3 = \"Gaussian blur 30%\" trong preset gốc.","0.3 = \"Gaussian blur 30%\" from the original recipe.",0),
("Chia ảnh thành ô, đo độ phủ mực từng ô, rắc ký tự có độ đậm tương ứng.",
 "Splits the image into cells, measures how much ink each one holds, and scatters a character of matching weight.",0),
("Xếp từ nhạt đến đậm. Tối đa 64 ký tự; ký tự lặp bị bỏ.",
 "Ordered from lightest to darkest. 64 characters maximum; duplicates are dropped.",0),
("Tỉ lệ ô có nét được hiện ký tự. Thấp = rắc thưa.",
 "What fraction of the cells containing a line actually get a character. Low = sparse scattering.",0),
("Nét mảnh chỉ phủ một phần nhỏ ô; khuếch đại để chọn được ký tự đậm hơn.",
 "A thin line only covers a small part of a cell; the gain lets a heavier character be picked.",0),
("Ô có ít mực hơn mức này thì bỏ trống, giữ nền sạch.",
 "Cells holding less ink than this are left empty, keeping the background clean.",0),
("Làm lệch lựa chọn ký tự để các ô cạnh nhau không giống hệt nhau.",
 "Skews the character choice so neighbouring cells do not come out identical.",0),
("1 = ký tự chồng lên nét; 0 = chỉ còn ký tự (tranh ASCII thuần).",
 "1 = characters sit on top of the lines; 0 = characters only (pure ASCII art).",0),
("Mỗi khung chọn lại ô và ký tự, nên ký tự \"nhảy\" liên tục.",
 "Cells and characters are re-picked every frame, so the characters keep \"jumping\".",0),
("Ô nào nằm gần nét thì tô hoa văn 1-bit 8×8 kiểu MacPaint; trộn 40% nên thành khối xám bậc thang.",
 "Cells near a line get filled with an 8x8 one-bit MacPaint pattern; blended at 40% they read as stepped grey blocks.",0),
("Một hoa văn cố định, hoặc \"Tự động\" chọn hoa văn đậm hơn cho ô nhiều mực hơn (ra dither).",
 "A fixed pattern, or \"Auto\" picks a denser pattern for inkier cells (giving dithering).",0),
("Theo video: cỡ ô to nhỏ theo đúng nhịp đo từ video mẫu (9–45 px, lặp mỗi 6 giây); khi đó Nhảy cỡ ô bị bỏ qua.",
 "Follow the video: cell size grows and shrinks on the exact rhythm measured from the reference video (9–45 px, repeating every 6 seconds); Cell size jump is ignored while this is on.",0),
("Mỗi khung, cỡ ô đổi ngẫu nhiên trong khoảng ±(animate × 100)% (chỉ khi Chuyển động đang bật).",
 "Each frame the cell size changes randomly within ±(animate x 100)% — only while Motion is on.",0),
("Khối xám ôm rộng bao xa quanh nét.","How far the grey blocks hug outwards around a line.",0),
("Thấp = nhiều ô được tô hơn.","Lower = more cells get filled.",0),
("Làm mép khối lởm chởm và đổi theo khung.","Makes block edges ragged and changes them every frame.",0),
("0.4 = \"MacPaint 40%\". Bàn cờ trộn 40% ra màu xám khoảng 0.8.",
 "0.4 = \"MacPaint 40%\". A checker blended at 40% reads as roughly 0.8 grey.",0),
("Giấy nhám (multiply) + nền đen photocopy có vệt quét ngang + mép tờ giấy sáng loang.",
 "Rough paper (multiply) + a black photocopy background with horizontal scan streaks + a bright bleed along the paper edge.",0),
("Thay phần nền trắng bằng mặt giấy đen. 0 = giữ giấy sáng.",
 "Replaces the white background with black paper. 0 = keep the paper light.",0),
("Vùng sáng hơn mức này (tính trung bình 3×3) bị coi là nền. Khối xám ~0.8 nên được giữ lại.",
 "Areas brighter than this (averaged over 3x3) count as background. Grey blocks sit around 0.8, so they survive.",0),
("Vệt ngang như trục máy scan.","Horizontal streaks, like a scanner bar.",0),
("Mép ảnh sáng loang như tờ giấy đặt lệch trên máy scan.",
 "A bright bleed along the edge, like a sheet of paper lying askew on a scanner.",0),
# ---- ui.js
("Nâng cao","Advanced",0),("Bật/tắt lớp này","Turn this layer on/off",0),("Tự nhập…","Type your own…",0),
("Xem kết quả tới bước %1 (phím %1)","View the result up to step %1 (key %1)",1),
# ---- index.html
("Tải ảnh lên","Upload image",0),("Ảnh mẫu mới","New sample image",0),("Lưu PNG","Save PNG",0),
("3 giây","3 seconds",0),("4 giây","4 seconds",0),("6 giây","6 seconds",0),("10 giây","10 seconds",0),
("1 vòng lặp","1 loop",0),("Quay video","Record video",0),
("Lưu preset","Save preset",0),("Mở preset","Open preset",0),("Xử lý","Process",0),("Chú thích","Notes",0),
("✕ Chế độ xem","✕ Viewer mode",0),("Thả ảnh vào đây","Drop an image here",0),("Tải ảnh","Load image",0),
("⚙ Tuỳ chỉnh","⚙ Settings",0),("Tuỳ chỉnh","Settings",0),
("Rê chuột qua ảnh (không cần bấm): ảnh bị hút về phía con trỏ · ngừng rê: ảnh về phẳng · G hiện lưới · Ctrl+V dán ảnh · H mở tuỳ chỉnh",
 "Move the mouse over the image (no clicking): the image is pulled towards the cursor · stop moving: it flattens · G shows the grid · Ctrl+V pastes an image · H opens settings",0),
("Độ dài video","Video length",0),("Độ phân giải xử lý (cạnh dài)","Processing resolution (long edge)",0),
("Chế độ xem (H)","Viewer mode (H)",0),("Tuỳ chỉnh (H)","Settings (H)",0),
("Tạm dừng (Space)","Pause (Space)",0),("Chạy (Space)","Play (Space)",0),
("■ Dừng quay","■ Stop recording",0),(" (GPU không hỗ trợ)"," (GPU does not support this)",0),
# ---- toast / lỗi
("ảnh dán","pasted image",0),
("\"%1\" là ảnh HEIC (iPhone), trình duyệt chưa đọc được. Hãy đổi sang JPG/PNG, hoặc chụp màn hình ảnh đó rồi Ctrl+V.",
 "\"%1\" is a HEIC image (iPhone) that the browser cannot read yet. Convert it to JPG/PNG, or screenshot it and press Ctrl+V.",1),
("Đã tải: %1 (%2×%3)","Loaded: %1 (%2x%3)",1),
("Không đọc được \"%1\". Hãy dùng ảnh JPG, PNG, WebP, GIF hoặc BMP.",
 "Could not read \"%1\". Use a JPG, PNG, WebP, GIF or BMP image.",1),
("Ảnh mẫu #%1","Sample image #%1",1),
("Đã mở preset (bỏ qua %1 giá trị sai kiểu).","Preset opened (%1 value(s) of the wrong type were skipped).",1),
("Đã mở preset.","Preset opened.",0),
("File preset không hợp lệ: %1","Invalid preset file: %1",1),
("Bộ ký tự dài quá 64 ký tự, chỉ dùng 64 ký tự đầu.",
 "The character set is longer than 64 characters; only the first 64 are used.",0),
("Kéo ảnh thẳng từ trang web khác thì trình duyệt chặn (bảo mật). Hãy lưu ảnh về máy rồi kéo file, hoặc chuột phải ảnh → Sao chép hình ảnh → Ctrl+V tại đây.",
 "Dragging an image straight from another website is blocked by the browser for security. Save the image to your computer and drag the file instead, or right-click the image → Copy image → Ctrl+V here.",0),
("Hãy đặt \"Vòng lặp\" (lớp Chuyển động) lớn hơn 0 trước khi quay 1 vòng lặp.",
 "Set \"Loop\" (Motion layer) above 0 before recording a single loop.",0),
("Mất kết nối GPU (driver lỗi hoặc máy thiếu bộ nhớ). Đang chờ khôi phục…",
 "Lost the GPU connection (driver fault or the machine ran out of memory). Waiting for it to come back…",0),
("Đã khôi phục GPU.","GPU restored.",0),
("Máy đang bật \"giảm chuyển động\" nên hiệu ứng mở ở trạng thái dừng. Nhấn Space để chạy.",
 "Your system has \"reduce motion\" turned on, so the effect opens paused. Press Space to start it.",0),
("Không tạo được PNG.","Could not create the PNG.",0),("Đã lưu PNG.","PNG saved.",0),
("Trình duyệt này không hỗ trợ quay video từ canvas. Hãy thử Chrome, Edge, Firefox hoặc Safari bản mới.",
 "This browser cannot record video from a canvas. Try a recent Chrome, Edge, Firefox or Safari.",0),
("Không khởi tạo được bộ quay video: %1","Could not start the video recorder: %1",1),
("Đã lưu video (%1 MB, %2).","Video saved (%1 MB, %2).",1),
("File %1 bị rỗng, đang quay lại với %2…","The %1 file came out empty, retrying with %2…",1),
("Quay video thất bại: mọi định dạng đều cho file rỗng.",
 "Video recording failed: every format produced an empty file.",0),
("thiếu trường \"state\"","missing \"state\" field",0),
("file của ứng dụng khác (\"%1\")","file from a different app (\"%1\")",1),
("Trình duyệt không cấp được WebGL cho trang này.","This browser would not give the page WebGL.",0),
("\nTrình duyệt báo: ","\nThe browser said: ",0),
("\n\nCách xử lý:","\n\nHow to fix it:",0),
("\n 1. Chrome/Edge: mở chrome://settings/system → bật \"Sử dụng tính năng tăng tốc đồ hoạ khi có\" → khởi động lại trình duyệt.",
 "\n 1. Chrome/Edge: open chrome://settings/system → turn on \"Use graphics acceleration when available\" → restart the browser.",0),
("\n 2. Mở chrome://gpu và xem dòng \"WebGL\": nếu ghi Disabled / Software only thì GPU đang bị chặn.",
 "\n 2. Open chrome://gpu and look at the \"WebGL\" row: if it says Disabled / Software only, the GPU is blocked.",0),
("\n 3. Tắt thử các tiện ích mở rộng chống theo dõi (nhiều tiện ích chặn WebGL để chống fingerprint).",
 "\n 3. Try disabling anti-tracking extensions — many of them block WebGL to prevent fingerprinting.",0),
("\n 4. Thử Safari hoặc Firefox để biết lỗi ở trình duyệt hay ở máy.",
 "\n 4. Try Safari or Firefox to find out whether the problem is the browser or the machine.",0),
("Tiếng Việt","Vietnamese",0),
("hình/giây","fps",0),("giây","s",0),
# ---- khung hình
("Khung","Frame",0),
("Khung hình: cắt cân từ giữa ảnh, phủ kín khung","Aspect ratio: cropped evenly from the centre to fill the frame",0),
("Theo ảnh gốc","Same as the image",0),
("1:1 · vuông","1:1 · square",0),
("4:5 · dọc, Instagram","4:5 · portrait, Instagram",0),
("3:4 · dọc","3:4 · portrait",0),
("2:3 · dọc, in ảnh","2:3 · portrait, print",0),
("9:16 · dọc, story / reel","9:16 · portrait, story / reel",0),
("4:3 · ngang","4:3 · landscape",0),
("3:2 · ngang, máy ảnh","3:2 · landscape, camera",0),
("16:9 · ngang, màn hình","16:9 · landscape, screen",0),
]
vi=[p[0] for p in P]
dup=[x for x in set(vi) if vi.count(x)>1]
if dup: sys.exit('TRÙNG KHOÁ: '+repr(dup))
body=",\n".join("  %s: %s"%(json.dumps(a,ensure_ascii=False),json.dumps(b,ensure_ascii=False)) for a,b,_ in P)
pathlib.Path('js/i18n.js').write_text('''/*
 * i18n.js — Chuyển giao diện giữa tiếng Việt và tiếng Anh. FILE NÀY SINH TỰ ĐỘNG.
 * Sửa bản dịch ở make-i18n.py rồi chạy lại nó. Đừng sửa tay file này.
 *
 * Từ điển khoá bằng CHÍNH chuỗi tiếng Việt, nên tiếng Việt vừa là bản gốc vừa là bản
 * dự phòng: thiếu bản dịch nào thì CL.t() trả lại nguyên tiếng Việt chứ không vỡ.
 * %%1, %%2… là chỗ điền tham số.
 */
window.CL = window.CL || {};

CL.EN = {
%s,
};

CL.lang = 'vi';
try {
  CL.lang = localStorage.getItem('cl-lang') || (/^vi/i.test(navigator.language || '') ? 'vi' : 'en');
} catch (e) { /* chế độ riêng tư chặn localStorage: cứ dùng tiếng Việt */ }

// Dịch một chuỗi, rồi điền %%1, %%2… bằng các tham số truyền thêm.
CL.t = function (s, ...args) {
  let out = (CL.lang === 'en' && CL.EN[s]) || s;
  args.forEach((v, i) => { out = out.split('%%' + (i + 1)).join(String(v)); });
  return out;
};
''' % body, encoding='utf-8')
print(f'js/i18n.js: {len(P)} cặp dịch')
