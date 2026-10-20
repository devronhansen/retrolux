// Kamera-Presets. Jedes Preset beschreibt Look (Shader-Parameter), Format, Rahmen und Datumsstempel.
// aspect = langes/kurzes Seitenverhältnis; die Ausrichtung folgt dem Sucher (hoch/quer).
(function () {
  const BASE = {
    exposure: 0, contrast: 1, saturation: 1, temp: 0, tint: 0, fade: 0, mono: 0,
    shadow: [0, 0, 0], high: [0, 0, 0],
    vignette: 0.3, grain: 0.05, chroma: 0, halation: 0, halColor: [1, 0.35, 0.15],
    soft: 0, leak: 0.6, leakPalette: 'warm', fisheye: 0, scan: 0, dust: 0, flashLook: 0.5,
  };

  const P = (o) => Object.assign({}, BASE, o, { look: Object.assign({}, BASE, o.look) });

  const PRESETS = [
    P({
      id: 'classic35', name: 'Classic 35', sub: '35 mm · warm & verblasst',
      aspect: 1.5, frame: 'none', date: 'seg', body: '#c9c2b4', accent: '#2b2a28',
      look: { contrast: 1.08, saturation: 0.92, temp: 0.35, tint: 0.05, fade: 0.06,
        shadow: [0.02, 0.03, 0.05], high: [0.06, 0.03, -0.03], vignette: 0.35, grain: 0.07, soft: 0.15, halation: 0.12 },
    }),
    P({
      id: 'instant', name: 'Sofortbild', sub: 'quadratisch · weißer Rahmen',
      aspect: 1, frame: 'instant', date: 'none', body: '#efe9dd', accent: '#d9472b',
      look: { exposure: 0.1, contrast: 0.88, saturation: 0.85, temp: 0.1, fade: 0.1,
        shadow: [-0.03, 0.03, 0.06], high: [0.05, 0.04, -0.02], vignette: 0.4, grain: 0.05, soft: 0.35, leak: 0.4 },
    }),
    P({
      id: 'mini', name: 'Sofort Mini', sub: 'Hochformat · Kreditkartengröße',
      aspect: 4 / 3, portraitOnly: true, frame: 'mini', date: 'none', body: '#a8d5e2', accent: '#ffffff',
      look: { exposure: 0.2, contrast: 0.95, saturation: 1.1, temp: -0.05, fade: 0.08,
        shadow: [0, 0.02, 0.06], high: [0.04, 0.02, 0.03], vignette: 0.25, grain: 0.04, soft: 0.25, flashLook: 0.8 },
    }),
    P({
      id: 'sunny78', name: 'Sonnig ’78', sub: 'satte Farben · Sommer',
      aspect: 1.5, frame: 'none', date: 'seg', body: '#e3a33b', accent: '#3a2a1a',
      look: { contrast: 1.15, saturation: 1.3, temp: 0.55, tint: -0.05, fade: 0.04,
        shadow: [0.04, 0.0, -0.04], high: [0.08, 0.04, -0.06], vignette: 0.55, grain: 0.06, halation: 0.2, leak: 0.8 },
    }),
    P({
      id: 'einweg', name: 'Einweg', sub: 'Wegwerfkamera · Blitz-Look',
      aspect: 1.5, frame: 'none', date: 'seg', body: '#2f8a4a', accent: '#f3d22c',
      look: { exposure: 0.05, contrast: 1.2, saturation: 1.05, temp: 0.15, tint: -0.12, fade: 0.08,
        shadow: [-0.02, 0.05, 0.02], high: [0.05, 0.05, 0.0], vignette: 0.6, grain: 0.12, soft: 0.3,
        chroma: 0.0025, leak: 1.0, dust: 0.5, flashLook: 1.0 },
    }),
    P({
      id: 'noir400', name: 'Noir 400', sub: 'Schwarzweiß · hart & körnig',
      aspect: 1.5, frame: 'none', date: 'none', body: '#1e1e1e', accent: '#e8e8e8',
      look: { mono: 1, contrast: 1.45, exposure: -0.05, fade: 0.02, vignette: 0.55, grain: 0.16, leak: 0.0, dust: 0.6 },
    }),
    P({
      id: 'silber', name: 'Silber', sub: 'Schwarzweiß · weich',
      aspect: 4 / 3, frame: 'none', date: 'none', body: '#b9bcc0', accent: '#2a2c30',
      look: { mono: 1, contrast: 0.85, exposure: 0.1, fade: 0.12, shadow: [0.0, 0.01, 0.03], high: [0.03, 0.02, 0.0],
        vignette: 0.3, grain: 0.07, soft: 0.3, leak: 0.0, halation: 0.15, halColor: [1, 1, 1] },
    }),
    P({
      id: 'cine500', name: 'Cine 500', sub: 'Kunstlichtfilm · Halation',
      aspect: 16 / 9, frame: 'none', date: 'none', body: '#3b3f46', accent: '#e04a2f',
      look: { contrast: 1.12, saturation: 0.95, temp: -0.35, tint: 0.03, fade: 0.05,
        shadow: [-0.04, 0.03, 0.07], high: [0.08, 0.03, -0.04], vignette: 0.35, grain: 0.08,
        halation: 0.55, halColor: [1, 0.25, 0.1], leak: 0.2 },
    }),
    P({
      id: 'lomo', name: 'Lomo X', sub: 'Crossentwicklung · Tunnel',
      aspect: 1.5, frame: 'none', date: 'seg', body: '#c0392b', accent: '#111111',
      look: { contrast: 1.35, saturation: 1.45, temp: 0.1, tint: -0.1, fade: 0.0,
        shadow: [0.0, 0.04, 0.12], high: [0.1, 0.08, -0.12], vignette: 0.95, grain: 0.07, chroma: 0.0015, leak: 0.7 },
    }),
    P({
      id: 'pastell', name: 'Pastell', sub: 'hell · zart · verträumt',
      aspect: 4 / 3, frame: 'none', date: 'seg', body: '#f2c6cf', accent: '#ffffff',
      look: { exposure: 0.25, contrast: 0.8, saturation: 0.7, temp: 0.05, tint: 0.12, fade: 0.16,
        shadow: [0.02, 0.0, 0.05], high: [0.06, 0.02, 0.04], vignette: 0.15, grain: 0.04, soft: 0.4, leakPalette: 'pink' },
    }),
    P({
      id: 'kontakt', name: 'Kontakt 35', sub: 'Filmstreifen · Randbeschriftung',
      aspect: 1.5, frame: 'strip', date: 'none', body: '#d1b16a', accent: '#1a1a1a',
      look: { contrast: 1.1, saturation: 1.05, temp: 0.25, fade: 0.05,
        shadow: [0.0, 0.02, 0.03], high: [0.05, 0.03, -0.02], vignette: 0.3, grain: 0.08, leak: 0.5 },
    }),
    P({
      id: 'fisch', name: 'Fischauge', sub: '180° · rund',
      aspect: 1, frame: 'none', date: 'seg', body: '#4a6fa5', accent: '#f0f0f0',
      look: { contrast: 1.2, saturation: 1.2, temp: 0.1, fade: 0.03, vignette: 0.4, grain: 0.06,
        fisheye: 1, chroma: 0.002, leak: 0.4 },
    }),
    P({
      id: 'vhs', name: 'Video 90', sub: 'Camcorder · Bandrauschen',
      aspect: 4 / 3, frame: 'none', date: 'vhs', body: '#2b2b33', accent: '#6fd3ff',
      look: { contrast: 1.05, saturation: 1.25, temp: 0.05, tint: 0.04, fade: 0.08,
        shadow: [0.0, 0.0, 0.05], vignette: 0.25, grain: 0.06, soft: 0.45, chroma: 0.004, scan: 1, leak: 0.0, flashLook: 0.2 },
    }),
  ];

  window.PRESETS = PRESETS;
})();
