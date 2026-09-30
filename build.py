#!/usr/bin/env python3
"""
build.py — gộp cả dự án thành MỘT file HTML tự chứa, để gửi cho người khác.

    python3 build.py                 -> contour-lines-lab.html

Dự án không có bước build thật sự (không bundler, không package.json). Script này chỉ
nhúng thẳng nội dung css/style.css và mọi file js/*.js (hiện là 12 file) vào index.html, giữ nguyên thứ tự
nạp — thứ tự đó quan trọng vì các file gán lên cùng một object CL.
Chạy lại script mỗi khi bạn sửa code.
"""
import re, sys, pathlib

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')

def esc(code):
    # Chuỗi "</script" nằm trong code sẽ đóng sớm thẻ <script> của trang. Ở đây không có,
    # nhưng vẫn chặn sẵn để sau này sửa code không vỡ âm thầm.
    return code.replace('</script', '<\\/script')

# 1. CSS
css = (root / 'css' / 'style.css').read_text(encoding='utf-8')
html, n = re.subn(r'<link rel="stylesheet" href="css/style\.css">',
                  '<style>\n' + css + '\n  </style>', html, count=1)
assert n == 1, 'không tìm thấy thẻ <link> tới css/style.css'

# 2. JS — thay từng thẻ <script src="..."> bằng nội dung file, đúng chỗ, đúng thứ tự
used = []
def inline(m):
    p = root / m.group(1)
    used.append(m.group(1))
    return '<script>\n' + esc(p.read_text(encoding='utf-8')) + '\n  </script>'

html, n = re.subn(r'<script src="(js/[^"]+)"></script>', inline, html)
assert n >= 1, 'không tìm thấy thẻ <script src="js/...">'

out = root / 'contour-lines-lab.html'
out.write_text(html, encoding='utf-8')
print(f'Đã gộp {n} file JS + 1 file CSS')
for u in used:
    print(f'   {u}')
print(f'-> {out.name}  ({out.stat().st_size/1024:.0f} KB)')
print('Gửi đúng file này, người nhận nhấp đúp là chạy.')
