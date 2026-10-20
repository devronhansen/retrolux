// Retrolux – App-Logik: Kamera, Sucher, Auslöser, Video, Import und Galerie.
(function () {
  const $ = (id) => document.getElementById(id);
  const PRESETS = window.PRESETS;

  // ---------- Einstellungen ----------
  const saved = (() => { try { return JSON.parse(localStorage.getItem('retrolux') || '{}'); } catch { return {}; } })();
  const state = {
    presetId: saved.presetId || PRESETS[0].id,
    facing: saved.facing || 'environment',
    flash: false, timer: 0, exposure: 0, zoom: 1,
    date: saved.date ?? true, leak: saved.leak ?? true, frame: saved.frame ?? true,
    mode: 'photo', recording: false, busy: false,
    seed: Math.random(),
    frameNo: saved.frameNo || 1,
  };
  function persist() {
    try {
      localStorage.setItem('retrolux', JSON.stringify({
        presetId: state.presetId, facing: state.facing, date: state.date, leak: state.leak, frame: state.frame, frameNo: state.frameNo,
      }));
    } catch { /* privater Modus */ }
  }
  const preset = () => PRESETS.find((p) => p.id === state.presetId) || PRESETS[0];

  // ---------- Icons ----------
  const ICONS = {
    flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    leak: '<circle cx="8" cy="8" r="4"/><path d="M13.5 20.5a8 8 0 0 0 7-7M10 22a12 12 0 0 0 12-12"/>',
    frame: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><rect x="7" y="6" width="10" height="9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    import: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    flip: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M5 3v5h5M19 21v-5h-5"/>',
  };
  document.querySelectorAll('.ico[data-icon]').forEach((el) => {
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[el.dataset.icon]}</svg>`;
  });

  // Kleine Kamera-Illustration pro Preset
  function cameraSvg(p) {
    const b = p.body, a = p.accent;
    if (p.frame === 'instant' || p.frame === 'mini') {
      return `<svg viewBox="0 0 64 64"><rect x="10" y="12" width="44" height="42" rx="7" fill="${b}"/>
        <rect x="10" y="44" width="44" height="10" rx="3" fill="rgba(0,0,0,.12)"/>
        <circle cx="32" cy="31" r="11" fill="#222"/><circle cx="32" cy="31" r="7" fill="#3a3f48"/><circle cx="29.5" cy="28.5" r="2" fill="#9ab"/>
        <rect x="15" y="16" width="9" height="6" rx="1.5" fill="#222"/><circle cx="47" cy="19" r="3" fill="${a}"/>
        <rect x="18" y="48" width="28" height="2" rx="1" fill="#222"/></svg>`;
    }
    if (p.date === 'vhs') {
      return `<svg viewBox="0 0 64 64"><rect x="8" y="20" width="38" height="26" rx="5" fill="${b}"/>
        <rect x="46" y="25" width="10" height="16" rx="2" fill="#111"/><circle cx="51" cy="33" r="5" fill="#3a3f48"/><circle cx="50" cy="32" r="1.6" fill="#9ab"/>
        <rect x="12" y="13" width="16" height="9" rx="2" fill="#111"/><rect x="12" y="38" width="20" height="3" rx="1.5" fill="${a}"/>
        <circle cx="38" cy="27" r="2.5" fill="#e33"/></svg>`;
    }
    const lens = p.look.fisheye ? 13 : 10;
    return `<svg viewBox="0 0 64 64"><rect x="6" y="18" width="52" height="32" rx="6" fill="${b}"/>
      <rect x="6" y="40" width="52" height="10" rx="4" fill="rgba(0,0,0,.12)"/>
      <rect x="12" y="13" width="10" height="6" rx="1.5" fill="${a}"/><rect x="44" y="22" width="9" height="6" rx="1.5" fill="#222"/>
      <circle cx="32" cy="34" r="${lens}" fill="#1c1c1e"/><circle cx="32" cy="34" r="${lens * 0.62}" fill="#353a44"/><circle cx="${32 - lens * 0.25}" cy="${34 - lens * 0.25}" r="${lens * 0.18}" fill="#9ab"/>
      <rect x="10" y="22" width="5" height="5" rx="1" fill="${a}" opacity=".8"/></svg>`;
  }

  // ---------- Elemente ----------
  const vf = $('viewfinder'), view = $('view'), vfMsg = $('vfMsg');
  const glCanvas = document.createElement('canvas');
  let renderer;
  try { renderer = new Renderer(glCanvas); } catch (e) {
    vfMsg.innerHTML = `<p>Dein Browser unterstützt kein WebGL.</p><p class="small">${e.message}</p>`;
    return;
  }

  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.autoplay = true;
  video.className = 'hidden-video';
  document.body.appendChild(video);

  let stream = null;

  // ---------- Kamera ----------
  async function startCamera() {
    stopCamera();
    vfMsg.hidden = false;
    vfMsg.innerHTML = '<p>Kamera wird gestartet …</p>';
    if (!navigator.mediaDevices?.getUserMedia) return cameraError(new Error('insecure'));
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      vfMsg.hidden = true;
    } catch (e) {
      cameraError(e);
    }
  }
  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  function cameraError(e) {
    const insecure = !window.isSecureContext || e.message === 'insecure';
    const denied = e.name === 'NotAllowedError';
    vfMsg.hidden = false;
    vfMsg.innerHTML = `
      <p>${insecure ? 'Die Kamera funktioniert nur über HTTPS oder localhost.' : denied ? 'Kamerazugriff wurde verweigert.' : 'Keine Kamera gefunden.'}</p>
      <p class="small">Du kannst trotzdem Fotos aus deiner Mediathek importieren und filtern.</p>
      <div class="row"><button class="pill" data-act="retry">Erneut versuchen</button><button class="pill" data-act="import">Foto importieren</button></div>`;
  }
  vfMsg.addEventListener('click', (e) => {
    const act = e.target.dataset?.act;
    if (act === 'retry') startCamera();
    if (act === 'import') $('fileInput').click();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!state.recording) stopCamera(); } else if (!stream) startCamera();
  });

  // ---------- Sucher ----------
  const isPortrait = () => vf.clientHeight >= vf.clientWidth;
  function imageAspect(p, portrait = isPortrait()) {
    return p.portraitOnly || portrait ? 1 / p.aspect : p.aspect;
  }

  let lastViewCss = '';
  function previewSize(p) {
    const a = imageAspect(p);
    const L = Compose.layout(state.frame ? p.frame : 'none', 1000 * a, 1000);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = vf.clientWidth - 16, H = vf.clientHeight - 16;
    const R = L.W / L.H;
    if (W / H > R) W = H * R; else H = W / R;
    const css = `${Math.round(W)}px|${Math.round(H)}px`;
    if (css !== lastViewCss || state.recording) {
      // Während einer Aufnahme bleibt die Größe stabil
      if (!state.recording) {
        view.style.width = `${Math.round(W)}px`;
        view.style.height = `${Math.round(H)}px`;
        lastViewCss = css;
      }
    }
    let s = (W * dpr) / L.W;
    s = Math.min(s, 1440 / (Math.max(L.W, L.H)));
    return { w: Math.round(1000 * a * s), h: Math.round(1000 * s) };
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (state.busy || !video.videoWidth || video.readyState < 2) return;
    const p = preset();
    const { w, h } = state.recording ? recSize : previewSize(p);
    renderer.upload(video);
    renderer.render({
      width: w, height: h, crop: Renderer.crop(video.videoWidth, video.videoHeight, w / h, state.zoom),
      mirror: state.facing === 'user', look: p.look, seed: state.seed, time: t / 1000,
      leak: state.leak, flash: state.flash, exposure: state.exposure,
    });
    Compose.compose(view, glCanvas, p, { frame: state.frame, date: state.date, when: new Date(), frameNo: state.frameNo });
  }
  requestAnimationFrame(loop);

  // ---------- Ton & Haptik ----------
  let ac;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function click(t, freq, dur, vol) {
    const a = audio(); if (!a) return;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(bp).connect(g).connect(a.destination);
    src.start(t);
  }
  function shutterSound() {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    click(t, 2600, 0.035, 0.9);
    click(t + 0.075, 1500, 0.06, 0.7);
  }
  function beep(freq = 880) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = freq; g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.12);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.13);
  }
  const buzz = (ms = 15) => navigator.vibrate?.(ms);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Toast ----------
  let toastT;
  function toast(text) {
    const el = $('toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2200);
  }

  // ---------- Aufnahme ----------
  async function countdown(sec) {
    const el = $('countdown');
    el.hidden = false;
    for (let i = sec; i > 0; i--) {
      el.textContent = i; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      beep(i === 1 ? 1320 : 880);
      await wait(1000);
    }
    el.hidden = true;
  }

  async function withFlash(fn) {
    if (!state.flash) return fn();
    const track = stream?.getVideoTracks()[0];
    const torch = state.facing === 'environment' && track?.getCapabilities?.().torch;
    const overlay = $('flashOverlay');
    if (torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {});
      await wait(350);
    } else {
      overlay.classList.add('screen');
      await wait(220);
    }
    try { return await fn(); } finally {
      if (torch) track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
      overlay.classList.remove('screen');
    }
  }

  function blink() {
    const o = $('flashOverlay');
    o.classList.remove('blink'); void o.offsetWidth; o.classList.add('blink');
  }

  // Rendert eine Quelle (Video oder Bild) in voller Auflösung und gibt die Komposition zurück.
  function renderFull(src, sw, sh, p, opts) {
    const a = imageAspect(p, opts.portrait);
    const crop = Renderer.crop(sw, sh, a, opts.zoom || 1);
    let ow = crop[2] * sw, oh = crop[3] * sh;
    const longest = Math.max(ow, oh);
    const scale = Math.min(Math.min(renderer.maxSize, 3200) / longest, Math.max(1, 1600 / longest));
    ow = Math.round(ow * scale); oh = Math.round(oh * scale);
    renderer.upload(src);
    renderer.render({
      width: ow, height: oh, crop, mirror: opts.mirror, look: p.look, seed: state.seed, time: Math.random() * 100,
      leak: state.leak, flash: opts.flash, exposure: state.exposure,
    });
    const out = document.createElement('canvas');
    Compose.compose(out, glCanvas, p, { frame: state.frame, date: state.date, when: opts.when, frameNo: state.frameNo });
    return out;
  }

  const toBlob = (canvas, type = 'image/jpeg', q = 0.92) => new Promise((r) => canvas.toBlob(r, type, q));

  async function makeThumb(canvas) {
    const s = 360 / Math.max(canvas.width, canvas.height);
    const t = document.createElement('canvas');
    t.width = Math.round(canvas.width * s); t.height = Math.round(canvas.height * s);
    t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    return toBlob(t, 'image/jpeg', 0.8);
  }

  async function saveShot(blob, thumb, type, p, when) {
    const shot = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blob, thumb, type, preset: p.name, created: when.getTime() };
    await Store.add(shot);
    state.seed = Math.random();
    state.frameNo = state.frameNo >= 36 ? 1 : state.frameNo + 1;
    persist();
    setLastThumb(thumb);
  }

  async function takePhoto() {
    if (state.busy) return;
    if (!video.videoWidth) { toast('Keine Kamera aktiv – importiere ein Foto.'); return; }
    state.busy = true;
    try {
      if (state.timer) await countdown(state.timer);
      const p = preset();
      const when = new Date();
      const canvas = await withFlash(async () => {
        shutterSound(); buzz(); blink();
        return renderFull(video, video.videoWidth, video.videoHeight, p, {
          portrait: isPortrait(), zoom: state.zoom, mirror: state.facing === 'user', flash: state.flash, when,
        });
      });
      state.busy = false; // Sucher sofort weiterlaufen lassen, Kodierung im Hintergrund
      const [blob, thumb] = await Promise.all([toBlob(canvas), makeThumb(canvas)]);
      await saveShot(blob, thumb, 'image', p, when);
    } catch (e) {
      console.error(e);
      toast('Aufnahme fehlgeschlagen.');
    } finally {
      state.busy = false;
    }
  }

  // ---------- Video ----------
  let recorder, recChunks, recSize, recStart, recTimer, micStream, recThumb;
  function pickMime() {
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  }
  async function startRecording() {
    if (!window.MediaRecorder || !view.captureStream) { toast('Videoaufnahme wird hier nicht unterstützt.'); return; }
    if (!video.videoWidth) { toast('Keine Kamera aktiv.'); return; }
    if (state.timer) { state.busy = true; await countdown(state.timer); state.busy = false; }
    const p = preset();
    const size = previewSize(p);
    // Gerade Pixelmaße für Video-Encoder
    recSize = { w: size.w & ~1, h: size.h & ~1 };
    state.recording = true;
    const vs = view.captureStream(30);
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getAudioTracks().forEach((t) => vs.addTrack(t));
    } catch { micStream = null; }
    const mimeType = pickMime();
    recorder = new MediaRecorder(vs, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
    recChunks = [];
    recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    recorder.onstop = finishRecording;
    recorder.start(1000);
    recStart = Date.now();
    recThumb = null;
    setTimeout(async () => { recThumb = await makeThumb(view); }, 400);
    $('recBadge').hidden = false;
    $('btnShutter').classList.add('recording');
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000);
      $('recTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
    buzz(30);
  }
  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }
  async function finishRecording() {
    clearInterval(recTimer);
    micStream?.getTracks().forEach((t) => t.stop());
    state.recording = false;
    $('recBadge').hidden = true;
    $('recTime').textContent = '00:00';
    $('btnShutter').classList.remove('recording');
    const type = recorder.mimeType || 'video/webm';
    const blob = new Blob(recChunks, { type });
    if (!blob.size) { toast('Video war leer.'); return; }
    await saveShot(blob, recThumb || (await makeThumb(view)), 'video', preset(), new Date(recStart));
    toast('Video gespeichert');
  }

  // ---------- Import ----------
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden')); };
      img.src = url;
    });
  }
  async function importFiles(files) {
    if (!files.length) return;
    state.busy = true;
    let ok = 0;
    try {
      for (const file of files) {
        try {
          const img = await loadImage(file);
          // In ein Canvas zeichnen: verkleinert große Bilder und vereinheitlicht die Upload-Quelle
          const s = Math.min(1, renderer.maxSize / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const p = preset();
          const when = new Date(file.lastModified || Date.now());
          const out = renderFull(c, c.width, c.height, p, { portrait: c.height > c.width, zoom: 1, mirror: false, flash: false, when });
          const [blob, thumb] = await Promise.all([toBlob(out), makeThumb(out)]);
          await saveShot(blob, thumb, 'image', p, when);
          ok++;
        } catch (e) { console.error(e); }
      }
    } finally {
      state.busy = false;
    }
    toast(ok ? `${ok} Foto${ok > 1 ? 's' : ''} mit „${preset().name}“ entwickelt` : 'Import fehlgeschlagen');
    if (!$('gallery').hidden) renderGallery();
  }
  $('fileInput').addEventListener('change', (e) => { importFiles([...e.target.files]); e.target.value = ''; });

  // ---------- Kameraauswahl ----------
  const carousel = $('carousel');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'cam';
    b.dataset.id = p.id;
    b.setAttribute('role', 'option');
    b.setAttribute('aria-label', p.name);
    b.innerHTML = `${cameraSvg(p)}<span>${p.name}</span>`;
    b.addEventListener('click', () => { selectPreset(p.id); b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); });
    carousel.appendChild(b);
  });
  function selectPreset(id) {
    if (state.presetId === id && $('presetName').textContent !== '–') return;
    state.presetId = id;
    const p = preset();
    $('presetName').textContent = p.name;
    $('presetSub').textContent = p.sub;
    carousel.querySelectorAll('.cam').forEach((el) => el.classList.toggle('on', el.dataset.id === id));
    state.seed = Math.random();
    persist();
    buzz(8);
  }
  let scrollT;
  carousel.addEventListener('scroll', () => {
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const mid = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
      let best, bestD = Infinity;
      carousel.querySelectorAll('.cam').forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestD) { bestD = d; best = el; }
      });
      if (best && best.dataset.id !== state.presetId) selectPreset(best.dataset.id);
    }, 120);
  });

  // ---------- Schnelleinstellungen ----------
  function setToggle(id, on, label) {
    const b = $(id);
    b.classList.toggle('on', on);
    if (label !== undefined) b.querySelector('.tb-label').textContent = label;
  }
  $('btnFlash').onclick = () => { state.flash = !state.flash; setToggle('btnFlash', state.flash, state.flash ? 'An' : 'Aus'); };
  $('btnTimer').onclick = () => {
    state.timer = state.timer === 0 ? 3 : state.timer === 3 ? 10 : 0;
    setToggle('btnTimer', state.timer > 0, state.timer ? `${state.timer} s` : 'Aus');
  };
  $('btnDate').onclick = () => { state.date = !state.date; setToggle('btnDate', state.date); persist(); };
  $('btnLeak').onclick = () => { state.leak = !state.leak; setToggle('btnLeak', state.leak); state.seed = Math.random(); persist(); };
  $('btnFrame').onclick = () => { state.frame = !state.frame; setToggle('btnFrame', state.frame); persist(); };
  $('btnExpo').onclick = () => { $('expoRow').hidden = !$('expoRow').hidden; };
  $('expoSlider').oninput = (e) => {
    state.exposure = +e.target.value;
    const v = state.exposure;
    setToggle('btnExpo', v !== 0, v === 0 ? '±0' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1));
  };
  $('btnImport').onclick = () => $('fileInput').click();
  $('btnZoom').onclick = () => { state.zoom = state.zoom === 1 ? 2 : 1; $('btnZoom').textContent = `${state.zoom}×`; };
  $('btnFlip').onclick = () => {
    if (state.recording) return;
    state.facing = state.facing === 'user' ? 'environment' : 'user';
    persist();
    startCamera();
  };
  document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => {
    if (state.recording) return;
    state.mode = b.dataset.mode;
    document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('on', m === b));
    $('btnShutter').classList.toggle('video', state.mode === 'video');
  }));
  function shutter() {
    audio();
    if (state.mode === 'photo') takePhoto();
    else if (state.recording) stopRecording();
    else startRecording();
  }
  $('btnShutter').onclick = shutter;
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && $('gallery').hidden && $('viewer').hidden) { e.preventDefault(); shutter(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (!$('viewer').hidden) return step(e.key === 'ArrowRight' ? 1 : -1);
      const i = PRESETS.indexOf(preset()) + (e.key === 'ArrowRight' ? 1 : -1);
      const p = PRESETS[(i + PRESETS.length) % PRESETS.length];
      carousel.querySelector(`[data-id="${p.id}"]`).click();
    }
    if (e.key === 'Escape') { $('viewer').hidden ? ($('gallery').hidden = true) : closeViewer(); }
  });

  // ---------- Galerie ----------
  let shots = [], urls = [], current = -1;
  function setLastThumb(blob) {
    const img = $('lastThumb');
    if (img.src) URL.revokeObjectURL(img.src);
    if (blob) { img.src = URL.createObjectURL(blob); img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
  }
  async function renderGallery() {
    urls.forEach(URL.revokeObjectURL);
    shots = await Store.all();
    urls = shots.map((s) => URL.createObjectURL(s.thumb || s.blob));
    const grid = $('grid');
    grid.innerHTML = '';
    shots.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'cell';
      b.innerHTML = `<img src="${urls[i]}" alt="">${s.type === 'video' ? '<span class="badge">▶</span>' : ''}`;
      b.onclick = () => openViewer(i);
      grid.appendChild(b);
    });
    $('galEmpty').hidden = shots.length > 0;
  }
  $('btnGallery').onclick = () => { $('gallery').hidden = false; renderGallery(); };
  $('galClose').onclick = () => { $('gallery').hidden = true; };
  $('galImport').onclick = () => $('fileInput').click();

  let viewerUrl;
  function openViewer(i) {
    current = i;
    const s = shots[i];
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = URL.createObjectURL(s.blob);
    const stage = $('vwStage');
    stage.innerHTML = s.type === 'video'
      ? `<video src="${viewerUrl}" controls playsinline autoplay loop></video>`
      : `<img src="${viewerUrl}" alt="">`;
    const d = new Date(s.created);
    $('vwTitle').textContent = `${s.preset} · ${d.toLocaleDateString('de-DE')}`;
    $('vwPrev').disabled = i <= 0;
    $('vwNext').disabled = i >= shots.length - 1;
    $('viewer').hidden = false;
  }
  function closeViewer() {
    $('viewer').hidden = true;
    $('vwStage').innerHTML = '';
  }
  function step(d) {
    const i = current + d;
    if (i >= 0 && i < shots.length) openViewer(i);
  }
  $('vwClose').onclick = closeViewer;
  $('vwPrev').onclick = () => step(-1);
  $('vwNext').onclick = () => step(1);

  let touchX = null;
  $('vwStage').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('vwStage').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });

  function fileFor(s) {
    const ext = s.type === 'video' ? (s.blob.type.includes('mp4') ? 'mp4' : 'webm') : 'jpg';
    const d = new Date(s.created);
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    return new File([s.blob], `retrolux_${stamp}.${ext}`, { type: s.blob.type });
  }
  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $('vwShare').onclick = async () => {
    const file = fileFor(shots[current]);
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') toast('Teilen fehlgeschlagen'); }
    } else download(file);
  };
  $('vwSave').onclick = () => download(fileFor(shots[current]));
  $('vwDelete').onclick = async () => {
    const s = shots[current];
    if (!s) return;
    await Store.remove(s.id);
    toast('Gelöscht');
    await renderGallery();
    if (!shots.length) { closeViewer(); setLastThumb(null); return; }
    setLastThumb(shots[0].thumb || shots[0].blob);
    openViewer(Math.min(current, shots.length - 1));
  };

  // ---------- Start ----------
  setToggle('btnDate', state.date);
  setToggle('btnLeak', state.leak);
  setToggle('btnFrame', state.frame);
  selectPreset(state.presetId);
  requestAnimationFrame(() => carousel.querySelector('.cam.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  Store.all().then((list) => setLastThumb(list[0] ? list[0].thumb || list[0].blob : null)).catch(() => {});
  startCamera();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
