# Retrolux

Analoge Filterkamera als Web-App (PWA): Live-Sucher mit Film-Looks, Lichtlecks, Filmkorn,
Datumsstempel, Sofortbild-/Filmstreifen-Rahmen, Video, Import und Galerie.

## Starten

```sh
python3 -m http.server 8642
# → http://localhost:8642
```

Die Kamera braucht **HTTPS** (oder localhost). Fürs iPhone die App auf einem HTTPS-Host
ablegen (z. B. GitHub Pages, Netlify, Cloudflare Pages), in Safari öffnen und über
„Teilen → Zum Home-Bildschirm“ installieren.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/presets.js` | 13 Kameras: Look-Parameter, Format, Rahmen, Datumsstil |
| `js/renderer.js` | WebGL-Shader (Farbe, Korn, Halation, Lecks, Vignette, Fischauge, VHS) |
| `js/compose.js` | Rahmen und Datumsstempel (7-Segment / VHS) |
| `js/store.js` | Galerie in IndexedDB (bleibt lokal auf dem Gerät) |
| `js/app.js` | Kamera, Sucher, Auslöser, Timer, Blitz, Video, Import, Galerie |
| `sw.js` | Offline-Cache |

Neue Kamera: einen Eintrag in `js/presets.js` ergänzen. Nach Dateiänderungen `CACHE` in `sw.js` hochzählen.

Tastatur (Desktop): Leertaste = Auslöser, ←/→ = Kamera wechseln, Esc = schließen.
