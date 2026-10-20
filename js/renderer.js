// WebGL-Renderer: wendet den Film-Look eines Presets in einem einzigen Fragment-Shader an.
(function () {
  const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec4 uCrop;
uniform float uMirror, uTime, uSeed;
uniform float uExposure, uContrast, uSaturation, uTemp, uTint, uFade, uMono;
uniform vec3 uShadow, uHigh, uHalColor, uLeakA, uLeakB;
uniform float uVignette, uGrain, uChroma, uHalation, uSoft, uLeak, uFisheye, uScan, uDust, uFlash;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 tex(vec2 uv) {
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  return texture2D(uTex, uCrop.xy + clamp(uv, 0.0, 1.0) * uCrop.zw).rgb;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  float mask = 1.0;

  // Fischauge: tonnenförmige Verzeichnung mit runder Maske
  if (uFisheye > 0.0) {
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= aspect;
    float r = length(p);
    float k = 0.6 * uFisheye;
    vec2 q = p * (1.0 + k * r * r) / (1.0 + k);
    q.x /= aspect;
    uv = q * 0.5 + 0.5;
    mask = 1.0 - smoothstep(0.975, 1.0, r);
  }

  // Videoband: Zeilenzittern und wandernde Tracking-Störung
  float track = 0.0;
  if (uScan > 0.0) {
    float line = floor(uv.y * 240.0);
    uv.x += (hash(vec2(line, floor(uTime * 30.0))) - 0.5) * 0.002 * uScan;
    float ty = fract(uTime * 0.09) * 1.6 - 0.3;
    track = exp(-pow((uv.y - ty) * 40.0, 2.0));
    uv.x += track * 0.012 * uScan;
  }

  // Chromatische Aberration
  vec2 dir = (uv - 0.5) * 2.0 * uChroma + vec2(uChroma * uScan, 0.0);
  vec3 c = vec3(tex(uv + dir).r, tex(uv).g, tex(uv - dir).b);

  // Weichzeichnung (Radius relativ zur Bildhöhe, damit Vorschau = Foto)
  vec2 unit = vec2(1.0 / aspect, 1.0);
  if (uSoft > 0.0) {
    vec2 r = unit * 0.0022;
    vec3 b = tex(uv + vec2(r.x, 0.0)) + tex(uv - vec2(r.x, 0.0)) + tex(uv + vec2(0.0, r.y)) + tex(uv - vec2(0.0, r.y));
    b += tex(uv + r * 0.7) + tex(uv - r * 0.7) + tex(uv + vec2(r.x, -r.y) * 0.7) + tex(uv + vec2(-r.x, r.y) * 0.7);
    c = mix(c, b / 8.0, uSoft);
  }

  // Halation: helle Bereiche glühen rötlich
  vec3 glow = vec3(0.0);
  if (uHalation > 0.0) {
    vec2 r = unit * 0.012;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      vec3 s = tex(uv + vec2(cos(a), sin(a)) * r);
      glow += vec3(max(luma(s) - 0.62, 0.0));
    }
    glow = glow / 8.0 * uHalColor * uHalation * 2.5;
  }

  c *= exp2(uExposure);

  // Blitz-Look: heller Mittelpunkt, härterer Kontrast
  if (uFlash > 0.0) {
    vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
    float f = exp(-dot(d, d) * 3.0);
    c = c * (1.0 + uFlash * 0.22 * f) + uFlash * 0.015 * f;
    c = mix(c, c * c * 1.3, uFlash * 0.15);
  }

  // Farbtemperatur und Tönung
  c.r += uTemp * 0.08;
  c.b -= uTemp * 0.08;
  c.g -= uTint * 0.06;
  c.rb += uTint * 0.02;

  c = (c - 0.5) * uContrast + 0.5;
  float l = luma(c);
  c = mix(vec3(l), c, uSaturation);
  c = mix(c, vec3(l), uMono);

  // Split-Toning
  l = clamp(luma(c), 0.0, 1.0);
  c += uShadow * (1.0 - l) * (1.0 - l) + uHigh * l * l;
  c += glow;

  // Verblassen: Schwarz anheben, Lichter abrunden
  c = mix(vec3(uFade), vec3(1.0 - uFade * 0.4), clamp(c, 0.0, 1.2));

  // Lichtlecks (zufällig pro Aufnahme über uSeed)
  if (uLeak > 0.0) {
    vec2 a = vec2(hash(vec2(uSeed, 1.0)), hash(vec2(uSeed, 2.0)));
    float side = floor(hash(vec2(uSeed, 3.0)) * 4.0);
    vec2 p1 = side < 1.0 ? vec2(-0.12, a.y) : side < 2.0 ? vec2(1.12, a.y) : side < 3.0 ? vec2(a.x, -0.12) : vec2(a.x, 1.12);
    vec2 d1 = (vUv - p1) * vec2(aspect, 1.0);
    float g1 = exp(-dot(d1, d1) * (1.2 + 2.0 * a.x));
    vec2 p2 = p1 + (vec2(hash(vec2(uSeed, 4.0)), hash(vec2(uSeed, 5.0))) - 0.5) * 0.6;
    vec2 d2 = (vUv - p2) * vec2(aspect, 1.0);
    float g2 = exp(-dot(d2, d2) * 6.0);
    vec3 leak = (uLeakA * g1 + uLeakB * g2 * 0.8) * uLeak * (0.9 + 0.7 * hash(vec2(uSeed, 6.0)));
    c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - clamp(leak, 0.0, 1.0));
  }

  // Vignette
  float vr = length(vUv - 0.5) * 1.414;
  c *= mix(1.0, 1.0 - smoothstep(0.35, 1.05, vr), uVignette * 0.85);

  // Staub und Kratzer
  if (uDust > 0.0) {
    vec2 sp = vUv * vec2(aspect, 1.0) * 50.0;
    vec2 cell = floor(sp);
    float h = hash(cell + uSeed * 7.13);
    if (h > 1.0 - 0.015 * uDust) {
      vec2 cp = cell + vec2(hash(cell + 1.3), hash(cell + 2.7));
      float d = length(sp - cp) / 50.0 * uRes.y;
      float s = (0.8 + 2.2 * hash(cell + 5.1)) * max(1.0, uRes.y / 900.0);
      float spot = 1.0 - smoothstep(s * 0.4, s, d);
      c = mix(c, vec3(h > 1.0 - 0.006 * uDust ? 0.92 : 0.06), spot * 0.75);
    }
  }

  // Filmkorn, an die Auflösung gekoppelt
  float gs = max(1.0, uRes.y / 900.0);
  vec2 gp = floor(gl_FragCoord.xy / gs);
  float n = hash(gp + fract(uTime) * vec2(91.7, 37.3)) + hash(gp * 1.7 + fract(uTime * 1.31) * vec2(13.1, 71.9)) - 1.0;
  c += n * uGrain * (1.0 - abs(luma(c) - 0.5) * 1.2);

  // Scanlines und Bandrauschen
  if (uScan > 0.0) {
    c *= 1.0 - 0.1 * uScan * (0.5 + 0.5 * sin(vUv.y * 480.0 * 3.14159));
    c += track * uScan * 0.35 * hash(gp + uTime);
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0) * mask, 1.0);
}`;

  const LEAK_PALETTES = {
    warm: [[[1.0, 0.45, 0.1], [1.0, 0.12, 0.08]], [[1.0, 0.6, 0.2], [0.95, 0.25, 0.4]], [[1.0, 0.3, 0.05], [1.0, 0.75, 0.3]]],
    pink: [[[1.0, 0.5, 0.75], [1.0, 0.8, 0.5]], [[0.9, 0.55, 1.0], [1.0, 0.6, 0.6]]],
  };

  const UNIFORMS = ['uTex', 'uRes', 'uCrop', 'uMirror', 'uTime', 'uSeed', 'uExposure', 'uContrast', 'uSaturation',
    'uTemp', 'uTint', 'uFade', 'uMono', 'uShadow', 'uHigh', 'uHalColor', 'uLeakA', 'uLeakB', 'uVignette', 'uGrain',
    'uChroma', 'uHalation', 'uSoft', 'uLeak', 'uFisheye', 'uScan', 'uDust', 'uFlash'];

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
      if (!gl) throw new Error('WebGL wird nicht unterstützt');
      this.gl = gl;
      const prog = gl.createProgram();
      gl.attachShader(prog, this._shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, this._shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.u = {};
      for (const name of UNIFORMS) this.u[name] = gl.getUniformLocation(prog, name);

      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.uniform1i(this.u.uTex, 0);

      const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), dims[0], dims[1], 4096);
    }

    _shader(type, src) {
      const gl = this.gl;
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }

    upload(source) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    }

    // Mittiger Zuschnitt (cover) in Texturkoordinaten, optional mit Digitalzoom.
    static crop(srcW, srcH, outAspect, zoom = 1) {
      let w = 1, h = 1;
      const srcAspect = srcW / srcH;
      if (srcAspect > outAspect) w = outAspect / srcAspect; else h = srcAspect / outAspect;
      w /= zoom; h /= zoom;
      return [(1 - w) / 2, (1 - h) / 2, w, h];
    }

    // opts: { width, height, crop, mirror, look, seed, time, leak, grain, flash, exposure }
    render(o) {
      const gl = this.gl, u = this.u, L = o.look;
      if (this.canvas.width !== o.width || this.canvas.height !== o.height) {
        this.canvas.width = o.width;
        this.canvas.height = o.height;
      }
      gl.viewport(0, 0, o.width, o.height);

      const palettes = LEAK_PALETTES[L.leakPalette] || LEAK_PALETTES.warm;
      const pal = palettes[Math.floor(o.seed * 7.31) % palettes.length];

      gl.uniform2f(u.uRes, o.width, o.height);
      gl.uniform4fv(u.uCrop, o.crop);
      gl.uniform1f(u.uMirror, o.mirror ? 1 : 0);
      gl.uniform1f(u.uTime, o.time % 1000);
      gl.uniform1f(u.uSeed, o.seed);
      gl.uniform1f(u.uExposure, L.exposure + (o.exposure || 0));
      gl.uniform1f(u.uContrast, L.contrast);
      gl.uniform1f(u.uSaturation, L.saturation);
      gl.uniform1f(u.uTemp, L.temp);
      gl.uniform1f(u.uTint, L.tint);
      gl.uniform1f(u.uFade, L.fade);
      gl.uniform1f(u.uMono, L.mono);
      gl.uniform3fv(u.uShadow, L.shadow);
      gl.uniform3fv(u.uHigh, L.high);
      gl.uniform3fv(u.uHalColor, L.halColor);
      gl.uniform3fv(u.uLeakA, pal[0]);
      gl.uniform3fv(u.uLeakB, pal[1]);
      gl.uniform1f(u.uVignette, L.vignette);
      gl.uniform1f(u.uGrain, o.grain === false ? 0 : L.grain);
      gl.uniform1f(u.uChroma, L.chroma);
      gl.uniform1f(u.uHalation, L.halation);
      gl.uniform1f(u.uSoft, L.soft);
      gl.uniform1f(u.uLeak, o.leak ? L.leak : 0);
      gl.uniform1f(u.uFisheye, L.fisheye);
      gl.uniform1f(u.uScan, L.scan);
      gl.uniform1f(u.uDust, L.dust);
      gl.uniform1f(u.uFlash, o.flash ? L.flashLook : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  window.Renderer = Renderer;
})();
