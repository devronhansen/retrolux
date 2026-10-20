// 2D-Komposition: setzt das gefilterte Bild in Rahmen und druckt den Datumsstempel ein.
(function () {
  const MONTHS = ['JAN.', 'FEB.', 'MÄR.', 'APR.', 'MAI', 'JUN.', 'JUL.', 'AUG.', 'SEP.', 'OKT.', 'NOV.', 'DEZ.'];

  // Ränder relativ zur Bildbreite bzw. -höhe.
  function layout(frame, iw, ih) {
    if (frame === 'instant') {
      const s = Math.round(iw * 0.06), b = Math.round(iw * 0.26);
      return { W: iw + 2 * s, H: ih + s + b, x: s, y: s };
    }
    if (frame === 'mini') {
      const s = Math.round(iw * 0.08), t = Math.round(iw * 0.13), b = Math.round(iw * 0.33);
      return { W: iw + 2 * s, H: ih + t + b, x: s, y: t };
    }
    if (frame === 'strip') {
      const portrait = ih > iw;
      const short = Math.min(iw, ih), band = Math.round(short * 0.17), edge = Math.round(short * 0.035);
      return portrait
        ? { W: iw + 2 * band, H: ih + 2 * edge, x: band, y: edge, portrait }
        : { W: iw + 2 * edge, H: ih + 2 * band, x: edge, y: band, portrait };
    }
    return { W: iw, H: ih, x: 0, y: 0 };
  }

  function paper(ctx, W, H, base) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(120,100,70,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function insetShadow(ctx, x, y, w, h) {
    const d = Math.max(2, w * 0.006);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = d;
    ctx.strokeRect(x + d / 2, y + d / 2, w - d, h - d);
    ctx.restore();
  }

  function filmStrip(ctx, L, o) {
    const { W, H } = L;
    ctx.save();
    if (L.portrait) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
    const len = L.portrait ? H : W, thick = L.portrait ? W : H;
    const band = L.portrait ? L.x : L.y;

    // Perforation
    const hw = band * 0.32, hh = band * 0.42, step = hw * 2.1, r = hw * 0.18;
    ctx.fillStyle = '#e9e2d0';
    for (const yy of [band * 0.14, thick - band * 0.14 - hh]) {
      for (let x = step * 0.3; x < len; x += step) {
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, yy, hw, hh, r) : ctx.rect(x, yy, hw, hh);
        ctx.fill();
      }
    }
    // Randbeschriftung
    const fs = band * 0.2;
    ctx.fillStyle = 'rgba(255,170,60,0.85)';
    ctx.font = `bold ${fs}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'middle';
    const n = o.frameNo || 1;
    ctx.fillText('KONTAKT 400', len * 0.08, band * 0.78);
    ctx.fillText(`${n}`, len * 0.62, band * 0.78);
    ctx.fillText(`▸ ${n}A`, len * 0.8, band * 0.78);
    ctx.fillText(`${n + 1}`, len * 0.3, thick - band * 0.78);
    ctx.restore();
  }

  // 7-Segment-Ziffern im Stil alter Datumsrückwände
  const SEG = {
    a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1],
  };
  const DIGITS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];

  function drawSegText(ctx, text, x, y, h) {
    const w = h * 0.52, t = h * 0.12, gap = t * 0.55, adv = w + h * 0.3, half = h / 2;
    let cx = x;
    ctx.lineWidth = t;
    ctx.lineCap = 'round';
    for (const ch of text) {
      if (ch === ' ') { cx += adv * 0.5; continue; }
      if (ch === "'") {
        ctx.beginPath();
        ctx.moveTo(cx + t, y + gap);
        ctx.lineTo(cx + t * 0.6, y + h * 0.3);
        ctx.stroke();
        cx += h * 0.3;
        continue;
      }
      for (const s of DIGITS[+ch]) {
        const [x1, y1, x2, y2] = SEG[s];
        const dx = Math.sign(x2 - x1) * gap, dy = Math.sign(y2 - y1) * gap;
        ctx.beginPath();
        ctx.moveTo(cx + x1 * w + dx, y + y1 * half + dy);
        ctx.lineTo(cx + x2 * w - dx, y + y2 * half - dy);
        ctx.stroke();
      }
      cx += adv;
    }
    return cx - x;
  }

  function segWidth(text, h) {
    let wsum = 0;
    for (const ch of text) wsum += ch === ' ' ? (h * 0.82) * 0.5 : ch === "'" ? h * 0.3 : h * 0.82;
    return wsum;
  }

  function dateSeg(ctx, x, y, w, h, when) {
    const short = Math.min(w, h);
    const dh = short * 0.042;
    const yy = String(when.getFullYear()).slice(2);
    const text = `'${yy} ${String(when.getMonth() + 1).padStart(2, '0')} ${String(when.getDate()).padStart(2, '0')}`;
    const tw = segWidth(text, dh);
    const px = x + w - tw - short * 0.06, py = y + h - dh - short * 0.06;
    ctx.save();
    ctx.transform(1, 0, -0.1, 1, (py + dh) * 0.1, 0); // leicht kursiv
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,110,20,0.55)';
    ctx.shadowColor = 'rgba(255,90,10,0.9)';
    ctx.shadowBlur = dh * 0.6;
    drawSegText(ctx, text, px, py, dh);
    ctx.shadowBlur = dh * 0.15;
    ctx.strokeStyle = 'rgba(255,190,90,0.95)';
    drawSegText(ctx, text, px, py, dh);
    ctx.restore();
  }

  function dateVhs(ctx, x, y, w, h, when) {
    const short = Math.min(w, h);
    const fs = Math.round(short * 0.05), m = short * 0.06;
    ctx.save();
    ctx.font = `bold ${fs}px ui-monospace, "Courier New", Menlo, monospace`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f4f4f4';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowOffsetX = fs * 0.08;
    ctx.shadowOffsetY = fs * 0.08;
    ctx.fillText('PLAY ▶', x + m, y + m + fs);
    const hrs = when.getHours(), mins = String(when.getMinutes()).padStart(2, '0');
    const ampm = hrs < 12 ? 'AM' : 'PM', h12 = (hrs % 12) || 12;
    ctx.fillText(`${ampm} ${h12}:${mins}`, x + m, y + h - m - fs * 1.25);
    ctx.fillText(`${MONTHS[when.getMonth()]} ${String(when.getDate()).padStart(2, '0')} ${when.getFullYear()}`, x + m, y + h - m);
    ctx.restore();
  }

  // out: Ziel-Canvas, src: gefiltertes Bild (WebGL-Canvas)
  // o: { frame: bool, date: bool, when: Date, frameNo }
  function compose(out, src, preset, o) {
    const iw = src.width, ih = src.height;
    const frame = o.frame ? preset.frame : 'none';
    const L = layout(frame, iw, ih);
    if (out.width !== L.W || out.height !== L.H) { out.width = L.W; out.height = L.H; }
    const ctx = out.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (frame === 'instant') paper(ctx, L.W, L.H, '#f2eee4');
    else if (frame === 'mini') paper(ctx, L.W, L.H, '#fbfaf6');
    else if (frame === 'strip') { ctx.fillStyle = '#16120e'; ctx.fillRect(0, 0, L.W, L.H); }

    ctx.drawImage(src, L.x, L.y, iw, ih);

    if (frame === 'instant' || frame === 'mini') insetShadow(ctx, L.x, L.y, iw, ih);
    if (frame === 'strip') filmStrip(ctx, L, o);

    if (o.date) {
      if (preset.date === 'seg') dateSeg(ctx, L.x, L.y, iw, ih, o.when);
      else if (preset.date === 'vhs') dateVhs(ctx, L.x, L.y, iw, ih, o.when);
    }
  }

  window.Compose = { compose, layout };
})();
