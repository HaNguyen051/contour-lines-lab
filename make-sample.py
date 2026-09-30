#!/usr/bin/env python3
"""
make-sample.py — đổi ẢNH MỞ SẴN của app.

    python3 make-sample.py <đường-dẫn-ảnh>     # đổi sang ảnh mới
    python3 make-sample.py                     # dựng lại từ assets/xuong-rong.jpg

Việc nó làm: thu ảnh về cạnh dài 1600 px (đúng độ phân giải xử lý mặc định), lưu vào
assets/, rồi sinh js/sample-image.js chứa ảnh dưới dạng data URI base64.

Phải nhúng chứ không trỏ <img src="assets/..."> được: mở trang bằng file:// thì ảnh cục bộ
bị coi là khác nguồn, WebGL nạp texture sẽ ném SECURITY_ERR.

Chạy xong nhớ: python3 build.py   (để bản gộp một file cũng có ảnh mới)
"""
import base64, pathlib, subprocess, sys

root = pathlib.Path(__file__).parent
dest = root / 'assets' / 'xuong-rong.jpg'
src = pathlib.Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else dest
if not src.exists():
    sys.exit(f'Không thấy ảnh: {src}')

if src != dest:
    dest.parent.mkdir(exist_ok=True)
    tmp = root / '.tmp-sample.jpg'
    subprocess.run(['sips', '-Z', '1600', str(src), '--out', str(tmp)],
                   check=True, capture_output=True)
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82',
                    str(tmp), '--out', str(dest)], check=True, capture_output=True)
    tmp.unlink(missing_ok=True)
    print(f'Đã thu nhỏ và lưu: {dest.relative_to(root)}')

b64 = base64.b64encode(dest.read_bytes()).decode()
(root / 'js' / 'sample-image.js').write_text(
    '/*\n'
    ' * sample-image.js — ẢNH MỞ SẴN, nhúng thẳng dưới dạng data URI. FILE NÀY SINH TỰ ĐỘNG.\n'
    ' * Đừng sửa tay. Đổi ảnh: python3 make-sample.py <ảnh>  rồi  python3 build.py\n'
    ' *\n'
    ' * Vì sao không để <img src="assets/...">: mở bằng file:// thì ảnh cục bộ bị coi là khác\n'
    ' * nguồn, canvas nhiễm bẩn và gl.texImage2D ném SECURITY_ERR. data URI thì cùng nguồn.\n'
    ' */\n'
    'window.CL = window.CL || {};\n'
    "CL.sampleImageData = 'data:image/jpeg;base64," + b64 + "';\n", encoding='utf-8')
kb = (root / 'js' / 'sample-image.js').stat().st_size / 1024
print(f'Đã sinh js/sample-image.js ({kb:.0f} KB). Giờ chạy: python3 build.py')
