// Neon Coast Cover Studio — the cover engine.
//
// Draws a GTA-style multi-panel poster onto any 2D canvas: the photos in their
// panels, a gradient-map grade over each one, a halftone title block with bold
// Anton lettering and a neon Pacifico subtitle, then grain and a vignette.
// Everything here is drawn by hand on canvas — no image model, no Rockstar
// artwork, no borrowed art. The same draw() serves the on-screen preview and
// the exported PNGs, so what you see is exactly what you share.

export const LAYOUTS = {
  grid9: { name: 'Cover Grid', panels: 9 },
  hero3: { name: 'Hero + Three', panels: 4 },
  fullbleed: { name: 'Full Bleed', panels: 1 },
  tilted: { name: 'Tilted Snapshots', panels: 3 },
};

export const GRADES = {
  sunset: {
    name: 'Sunset',
    stops: [
      [0.0, 26, 8, 46],
      [0.35, 122, 28, 92],
      [0.65, 255, 94, 62],
      [1.0, 255, 209, 102],
    ],
  },
  neon: {
    name: 'Neon Nights',
    stops: [
      [0.0, 10, 8, 38],
      [0.4, 190, 20, 120],
      [0.7, 255, 80, 160],
      [1.0, 120, 240, 255],
    ],
  },
  golden: {
    name: 'Golden Hour',
    stops: [
      [0.0, 30, 18, 8],
      [0.4, 146, 84, 28],
      [0.7, 255, 166, 60],
      [1.0, 255, 236, 180],
    ],
  },
  night: {
    name: 'Night Drive',
    stops: [
      [0.0, 6, 8, 32],
      [0.4, 28, 32, 96],
      [0.7, 90, 90, 200],
      [1.0, 160, 220, 255],
    ],
  },
  vice: {
    name: 'Vice Purple',
    stops: [
      [0.0, 20, 6, 44],
      [0.4, 120, 24, 140],
      [0.7, 255, 60, 140],
      [1.0, 255, 180, 90],
    ],
  },
  original: { name: 'Original', stops: null },
};

export const SIZES = {
  square: { name: 'Square', w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { name: 'Story', w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { name: 'Wide', w: 1920, h: 1080, label: '1920 x 1080' },
};

// ---------------------------------------------------------------- layouts

// Panel rects for a layout at W x H, in pixels. A rect is { x, y, w, h, rot }
// (rot in radians, around the rect centre; 0 for the straight layouts).
export function layoutRects(layout, W, H) {
  const gap = Math.max(2, Math.round(Math.min(W, H) * 0.008));
  if (layout === 'grid9') {
    const cw = (W - gap * 4) / 3;
    const ch = (H - gap * 4) / 3;
    const rects = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        rects.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch, rot: 0 });
      }
    }
    return rects;
  }
  if (layout === 'hero3') {
    const heroW = W * 0.62;
    const topH = H * 0.68;
    const sideW = W - heroW;
    const rects = [{ x: 0, y: 0, w: heroW, h: topH, rot: 0 }];
    for (let i = 0; i < 3; i++) {
      rects.push({ x: heroW, y: (topH / 3) * i, w: sideW, h: topH / 3, rot: 0 });
    }
    return rects;
  }
  if (layout === 'fullbleed') {
    return [{ x: 0, y: 0, w: W, h: H, rot: 0 }];
  }
  // tilted: three polaroid-style snapshots over a full-bleed backdrop.
  return [
    { x: W * 0.07, y: H * 0.05, w: W * 0.52, h: H * 0.42, rot: -0.1 },
    { x: W * 0.47, y: H * 0.27, w: W * 0.47, h: H * 0.38, rot: 0.07 },
    { x: W * 0.2, y: H * 0.52, w: W * 0.42, h: H * 0.32, rot: -0.05 },
  ];
}

// The title band for a layout at W x H. The band is drawn over the panels.
export function titleBand(layout, W, H) {
  if (layout === 'hero3') return { x: 0, y: H * 0.68, w: W, h: H * 0.32 };
  if (layout === 'tilted') return { x: 0, y: H * 0.86, w: W, h: H * 0.14 };
  return { x: 0, y: H * 0.74, w: W, h: H * 0.26 };
}

// ---------------------------------------------------------------- grades

// A graded copy of an image: the photo's luminance remapped through the
// grade's colour stops, blended 85% over the original so the photo still
// reads. Graded at most 1920 px on the long side and cached by the caller.
function gradeImage(img, gradeKey) {
  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, w, h);
  if (!grade.stops) return off; // "Original": no grade at all.
  const data = octx.getImageData(0, 0, w, h);
  const px = data.data;
  const stops = grade.stops;
  for (let i = 0; i < px.length; i += 4) {
    const luma = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    let s = 0;
    while (s < stops.length - 2 && luma > stops[s + 1][0]) s++;
    const a = stops[s];
    const b = stops[s + 1];
    const t = Math.min(1, Math.max(0, (luma - a[0]) / (b[0] - a[0] || 1)));
    const mr = a[1] + (b[1] - a[1]) * t;
    const mg = a[2] + (b[2] - a[2]) * t;
    const mb = a[3] + (b[3] - a[3]) * t;
    px[i] = px[i] * 0.15 + mr * 0.85;
    px[i + 1] = px[i + 1] * 0.15 + mg * 0.85;
    px[i + 2] = px[i + 2] * 0.15 + mb * 0.85;
  }
  octx.putImageData(data, 0, 0);
  return off;
}

// ---------------------------------------------------------------- drawing

let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = 128;
  noiseTile.height = 128;
  const nctx = noiseTile.getContext('2d');
  const data = nctx.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseTile;
}

// Draws one photo into a panel rect with cover-fit, the panel's zoom and
// pan. `graded` is the pre-graded canvas for the photo.
function drawPhotoInto(ctx, graded, rect, panel) {
  const { x, y, w, h, rot } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  if (!graded) {
    // No photo yet: a dark placeholder with a dashed frame.
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#2a1840');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  const scale = Math.max(w / graded.width, h / graded.height) * (panel.scale || 1);
  const dw = graded.width * scale;
  const dh = graded.height * scale;
  const dx = -dw / 2 + (panel.ox || 0) * w;
  const dy = -dh / 2 + (panel.oy || 0) * h;
  ctx.drawImage(graded, dx, dy, dw, dh);
  ctx.restore();
}

// Halftone dots across the title band: rows of circles that grow towards
// the band's foot, in a faint pink — the print-poster texture.
function drawHalftone(ctx, band) {
  const step = Math.max(10, band.h / 9);
  ctx.fillStyle = 'rgba(255, 120, 180, 0.16)';
  for (let row = 0; row < band.h / step; row++) {
    const cy = band.y + row * step + step / 2;
    const r = (step * 0.16) + (row / (band.h / step)) * step * 0.2;
    for (let col = 0; col < band.w / step; col++) {
      const cx = band.x + col * step + step / 2 + (row % 2 ? step / 2 : 0);
      if (cx > band.x + band.w) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The title band: dark ground, halftone, a neon top edge, the Anton title
// in a sunset gradient, the Pacifico subtitle glowing beneath it, and a
// small star heat-meter with a Vice City ribbon at the band's foot.
function drawTitleBand(ctx, band, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(14, 6, 26, 0.88)';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  drawHalftone(ctx, band);
  const edge = ctx.createLinearGradient(band.x, 0, band.x + band.w, 0);
  edge.addColorStop(0, '#ff5e78');
  edge.addColorStop(0.5, '#ffb347');
  edge.addColorStop(1, '#2de2ff');
  ctx.fillStyle = edge;
  ctx.fillRect(band.x, band.y, band.w, Math.max(3, band.h * 0.02));

  const pad = band.w * 0.045;
  const cx = band.x + band.w / 2;
  const title = (state.title || 'NEON COAST').trim().toUpperCase() || 'NEON COAST';
  const subtitle = (state.subtitle || '').trim();

  // Title: Anton, sized to fit, sunset-gradient fill, dark outline.
  let size = band.h * 0.42 * (state.titleSize || 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleY = band.y + band.h * (subtitle ? 0.36 : 0.5);
  const setTitleFont = () => { ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`; };
  setTitleFont();
  while (ctx.measureText(title).width > band.w - pad * 2 && size > 10) {
    size -= 2;
    setTitleFont();
  }
  const grad = ctx.createLinearGradient(0, titleY - size * 0.55, 0, titleY + size * 0.55);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.55, '#ff7e5f');
  grad.addColorStop(1, '#ff2e88');
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = 'rgba(10, 4, 20, 0.9)';
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, cx, titleY);

  // Subtitle: Pacifico, neon glow.
  if (subtitle) {
    const subSize = Math.max(12, band.h * 0.17);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = '#2de2ff';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillStyle = '#b8f6ff';
    ctx.fillText(subtitle, cx, band.y + band.h * 0.72);
    ctx.shadowBlur = 0;
  }

  // Star heat-meter + ribbon at the foot of the band.
  const starY = band.y + band.h * 0.9;
  const starSize = Math.max(10, band.h * 0.09);
  ctx.font = `${starSize}px sans-serif`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText('★★★★★', cx, starY);
  const starW = ctx.measureText('★★★★★').width;
  ctx.font = `bold ${Math.max(9, band.h * 0.07)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  const ribbon = 'VICE CITY';
  ctx.textAlign = 'right';
  ctx.fillText(ribbon, cx - starW / 2 - band.w * 0.02, starY);
  ctx.textAlign = 'left';
  ctx.fillText('EST. 2026', cx + starW / 2 + band.w * 0.02, starY);
  ctx.textAlign = 'center';
  ctx.restore();
}

function drawGrain(ctx, W, H) {
  const tile = getNoiseTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(5,2,12,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- entry

// Renders the whole cover for `state` onto `canvas` at W x H.
// `photos` is the list of loaded images; `gradeCache` (a Map) holds the
// graded copies so a drag redraw never re-grades a photo.
export function drawCover(canvas, state, photos, gradeCache) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(state.layout, W, H);
  const panels = state.panels || [];

  // Tilted layout: the first photo also washes the backdrop, darkened.
  if (state.layout === 'tilted' && photos.length) {
    const first = panels[0] ? photos[panels[0].photo] : photos[0];
    if (first) {
      const graded = gradedFor(first, state.grade, gradeCache);
      const s = Math.max(W / graded.width, H / graded.height);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(graded, (W - graded.width * s) / 2, (H - graded.height * s) / 2, graded.width * s, graded.height * s);
      ctx.restore();
      ctx.fillStyle = 'rgba(10,4,20,0.45)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  rects.forEach((rect, i) => {
    const panel = panels[i] || { photo: 0, scale: 1, ox: 0, oy: 0 };
    const img = photos[panel.photo];
    const graded = img ? gradedFor(img, state.grade, gradeCache) : null;
    if (state.layout === 'tilted') {
      // Polaroid frame: white border, soft shadow, then the photo inside.
      const border = Math.max(4, Math.min(rect.w, rect.h) * 0.045);
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      if (rect.rot) ctx.rotate(rect.rot);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.max(8, rect.w * 0.05);
      ctx.shadowOffsetY = Math.max(4, rect.h * 0.02);
      ctx.fillStyle = '#f7f2ea';
      ctx.fillRect(-rect.w / 2 - border, -rect.h / 2 - border, rect.w + border * 2, rect.h + border * 2 + border * 2.2);
      ctx.restore();
      drawPhotoInto(ctx, graded, { ...rect, w: rect.w, h: rect.h }, panel);
    } else {
      drawPhotoInto(ctx, graded, rect, panel);
    }
  });

  drawTitleBand(ctx, titleBand(state.layout, W, H), state);
  if (state.grain !== false) drawGrain(ctx, W, H);
  if (state.vignette !== false) drawVignette(ctx, W, H);
}

function gradedFor(img, grade, cache) {
  const key = `${img.currentSrc || img.src}|${grade}`;
  if (cache && cache.has(key)) return cache.get(key);
  const graded = gradeImage(img, grade);
  if (cache) {
    if (cache.size > 24) cache.clear();
    cache.set(key, graded);
  }
  return graded;
}
