/*
 * gl.js — Tiện ích WebGL dùng chung.
 *
 * WebGL rất dài dòng: muốn vẽ phải tạo shader, biên dịch, liên kết thành program,
 * tạo buffer, texture, framebuffer... File này gói các thao tác đó thành vài hàm ngắn.
 *
 * Khái niệm:
 *  - Program: một cặp vertex shader + fragment shader đã liên kết.
 *  - Texture: ảnh nằm trong bộ nhớ GPU, shader đọc được.
 *  - Target (render target): texture + framebuffer, để VẼ VÀO texture thay vì ra màn hình.
 *    Nhờ vậy kết quả bước trước thành đầu vào bước sau.
 */
window.CL = window.CL || {};

CL.gl = (() => {
  'use strict';

  // Biên dịch 1 shader. Lỗi thì ném ra thông báo kèm mã nguồn có đánh số dòng.
  function compile(gl, type, source, name) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(shader);
      const numbered = source.split('\n').map((l, i) => String(i + 1).padStart(3) + '| ' + l).join('\n');
      throw new Error(`Lỗi biên dịch shader "${name}":\n${log}\n${numbered}`);
    }
    return shader;
  }

  // Tạo program từ fragment shader (vertex shader dùng chung CL.shaders.vert).
  // Trả về { program, loc(tên) } — loc() lấy vị trí uniform, có cache.
  function program(gl, fragmentSource, name) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, CL.shaders.vert, name + '.vert'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragmentSource, name));
    gl.bindAttribLocation(p, 0, 'aPos'); // mọi program dùng chung buffer hình ở vị trí 0
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Lỗi liên kết program "${name}": ${gl.getProgramInfoLog(p)}`);
    }
    // Ghi lại kiểu của mọi uniform (float, vec4...). Uniform mảng như "uGX[0]" được lưu
    // theo tên bỏ "[0]", để setUniforms biết gọi uniform1fv hay uniform4fv.
    const types = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(p, i);
      if (info) types[info.name.replace(/\[0\]$/, '')] = info.type;
    }
    const cache = {};
    return {
      name,
      program: p,
      types,
      loc(u) {
        if (!(u in cache)) cache[u] = gl.getUniformLocation(p, u);
        return cache[u];
      },
    };
  }

  // Một tam giác lớn phủ kín màn hình (ít đỉnh hơn 2 tam giác ghép; phần thừa GPU tự cắt).
  function fullscreenTriangle(gl) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return buffer;
  }

  // Tạo texture.
  //  filter : gl.LINEAR (mượt) | gl.NEAREST (giữ pixel sắc cạnh)
  //  mipmap : true thì tạo sẵn các bản thu nhỏ (chỉ dùng cho ảnh cạnh là lũy thừa của 2)
  //  WebGL1 bắt buộc CLAMP_TO_EDGE với ảnh có cạnh không phải lũy thừa của 2.
  function texture(gl, { width = 1, height = 1, source = null, filter = gl.LINEAR, mipmap = false, flipY = true } = {}) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : filter);
    if (source) upload(gl, tex, source, { flipY, mipmap });
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  // Đưa ảnh (img, canvas...) vào texture.
  // UNPACK_FLIP_Y: WebGL đặt gốc (0,0) ở góc DƯỚI trái, còn ảnh web có gốc ở góc TRÊN trái → lật dọc.
  function upload(gl, tex, source, { flipY = true, mipmap = false } = {}) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  }

  // Đưa mảng byte RGBA thô vào texture (bảng tra đổi theo từng khung).
  // Không lật dọc: hàng 0 của mảng là hàng 0 của texture.
  function uploadData(gl, tex, width, height, data) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  // Render target RGBA8, LINEAR, CLAMP_TO_EDGE.
  function target(gl, width, height) {
    const tex = texture(gl, { width, height });
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, width, height };
  }

  function deleteTarget(gl, t) {
    if (!t) return;
    gl.deleteFramebuffer(t.fbo);
    gl.deleteTexture(t.tex);
  }

  // Gán uniform theo kiểu giá trị:
  //  số / true-false → float (true = 1.0)
  //  mảng 2/3/4 số   → vec2 / vec3 / vec4
  //  Float32Array    → uniform mảng, ví dụ uniform float uGX[17] (đặt tên "uGX[0]"); kiểu lấy từ shader
  //  WebGLTexture    → sampler2D (tự gán texture unit 0, 1, 2...)
  function setUniforms(gl, prog, uniforms) {
    let unit = 0;
    for (const name in uniforms) {
      const loc = prog.loc(name);
      if (loc === null) continue; // shader không dùng uniform này → trình biên dịch đã bỏ
      const v = uniforms[name];
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (typeof v === 'boolean') gl.uniform1f(loc, v ? 1 : 0);
      else if (v instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v);
        gl.uniform1i(loc, unit++);
      } else if (v instanceof Float32Array) {
        // Uniform mảng: đặt tên "uGX[0]" hoặc "uGX", kiểu lấy từ chính shader.
        const t = prog.types[name.replace(/\[0\]$/, '')];
        if (t === gl.FLOAT_VEC4) gl.uniform4fv(loc, v);
        else if (t === gl.FLOAT_VEC3) gl.uniform3fv(loc, v);
        else if (t === gl.FLOAT_VEC2) gl.uniform2fv(loc, v);
        else gl.uniform1fv(loc, v);
      } else if (v.length === 2) gl.uniform2fv(loc, v);
      else if (v.length === 3) gl.uniform3fv(loc, v);
      else if (v.length === 4) gl.uniform4fv(loc, v);
    }
  }

  return { program, fullscreenTriangle, texture, upload, uploadData, target, deleteTarget, setUniforms };
})();
