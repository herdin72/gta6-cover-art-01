// Fixed scenes for screenshots: ?shot=cover shows the cover alone at full
// export resolution; ?shot=editor shows the app with a photo loaded;
// ?shot=tilted and ?shot=story show other layouts and sizes. `photo`
// picks the first sample (samples/<photo>.jpg) and `caption` the title.
// window.__shotReady is set once the scene has painted.

import { LAYOUTS, SIZES, drawCover } from './cover.js';

const SCENES = {
  cover: { layout: 'grid9', grade: 'sunset', title: 'NEON COAST', subtitle: 'Vice City nights', size: 'square' },
  editor: { layout: 'hero3', grade: 'golden', title: 'BOULEVARD QUEEN', subtitle: 'Golden hour heist', size: 'square' },
  tilted: { layout: 'tilted', grade: 'neon', title: 'NIGHT SHIFT', subtitle: 'Neon streets', size: 'square' },
  story: { layout: 'grid9', grade: 'vice', title: 'PIER PRESSURE', subtitle: 'Vice City nights', size: 'portrait' },
};

function makeState(scene, query) {
  const layout = query.get('layout') || scene.layout;
  const count = LAYOUTS[layout].panels;
  const firstPhoto = { pier: 1, boulevard: 0, rooftop: 2, neon: 3 }[query.get('photo')] ?? 0;
  return {
    layout,
    grade: query.get('grade') || scene.grade,
    title: query.get('caption') || scene.title,
    subtitle: query.get('subtitle') || scene.subtitle,
    titleSize: 1,
    grain: true,
    vignette: true,
    size: query.get('size') || scene.size,
    panels: Array.from({ length: count }, (_, i) => ({
      photo: (firstPhoto + i) % 4, scale: 1, ox: 0, oy: 0,
    })),
  };
}

export async function runShot(shot, query, app) {
  const scene = SCENES[shot] || SCENES.cover;
  const next = makeState(scene, query);
  app.setState(next);

  const canvas = document.getElementById('preview');
  if (shot === 'editor') {
    // The app itself, controls and all, with a photo loaded.
    app.syncControls();
    app.redraw();
  } else {
    // The cover alone, drawn at the full export size for a crisp shot.
    document.body.classList.add('shot-cover');
    const size = SIZES[next.size] || SIZES.square;
    canvas.width = size.w;
    canvas.height = size.h;
    drawCover(canvas, next, app.photos.map((p) => p.img), new Map());
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
