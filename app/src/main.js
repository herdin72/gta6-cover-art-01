// Neon Coast Cover Studio — wires the page.
//
// State is one plain object; every committed change pushes a snapshot onto
// the undo stack. Dragging a panel pans its photo, the wheel zooms it, and
// Export renders the same draw() at full size, so the PNG is exactly the
// preview. A `?shot=` query sets up a fixed scene for screenshots instead.

import { LAYOUTS, GRADES, SIZES, layoutRects, drawCover } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
  { name: 'Rooftop', src: 'samples/rooftop.jpg' },
  { name: 'Neon Street', src: 'samples/neon.jpg' },
];

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const photos = []; // { name, img } in load order; panel.photo indexes into this
const gradeCache = new Map();

let state = defaultState();
let selectedPanel = 0;
let history = [snapshot()];
let historyIndex = 0;

function defaultState() {
  return {
    layout: 'grid9',
    grade: 'sunset',
    title: 'NEON COAST',
    subtitle: 'Vice City nights',
    titleSize: 1,
    grain: true,
    vignette: true,
    size: 'square',
    panels: Array.from({ length: 9 }, (_, i) => ({
      photo: i % 4, scale: 1, ox: 0, oy: 0,
    })),
  };
}

function snapshot() {
  return JSON.stringify(state);
}

function restore(json) {
  state = JSON.parse(json);
  syncControls();
  redraw();
}

function pushHistory() {
  const snap = snapshot();
  if (snap === history[historyIndex]) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snap);
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  syncUndoButtons();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restore(history[historyIndex]);
  syncUndoButtons();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restore(history[historyIndex]);
  syncUndoButtons();
}

function syncUndoButtons() {
  document.getElementById('undo').disabled = historyIndex <= 0;
  document.getElementById('redo').disabled = historyIndex >= history.length - 1;
}

// Panels follow the layout: switching layout keeps each photo where it was
// where a panel exists, and fills new panels by cycling the photos.
function applyLayout(layout) {
  const count = LAYOUTS[layout].panels;
  const old = state.panels;
  state.layout = layout;
  state.panels = Array.from({ length: count }, (_, i) => {
    const keep = old[i];
    return keep ? { ...keep } : { photo: i % Math.max(1, photos.length), scale: 1, ox: 0, oy: 0 };
  });
  selectedPanel = Math.min(selectedPanel, count - 1);
}

function previewSize() {
  const size = SIZES[state.size] || SIZES.square;
  const scale = Math.min(1, 720 / Math.max(size.w, size.h));
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state, photos.map((p) => p.img), gradeCache);
  drawSelection();
  syncPanelEditor();
}

// A thin outline around the selected panel, in preview coordinates.
function drawSelection() {
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  const rect = rects[selectedPanel];
  if (!rect) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  if (rect.rot) ctx.rotate(rect.rot);
  ctx.strokeStyle = '#2de2ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
  ctx.restore();
}

// ---------------------------------------------------------------- controls

function el(id) {
  return document.getElementById(id);
}

function buildControlGroups() {
  const layoutBox = el('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = def.name;
    b.dataset.layout = key;
    b.addEventListener('click', () => {
      applyLayout(key);
      pushHistory();
      syncControls();
      redraw();
    });
    layoutBox.appendChild(b);
  });
  const gradeBox = el('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = def.name;
    b.dataset.grade = key;
    b.addEventListener('click', () => {
      state.grade = key;
      gradeCache.clear();
      pushHistory();
      syncControls();
      redraw();
    });
    gradeBox.appendChild(b);
  });
  const sizeBox = el('sizes');
  Object.entries(SIZES).forEach(([key, def]) => {
    const label = document.createElement('label');
    label.className = 'radio';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'size';
    input.value = key;
    input.checked = key === state.size;
    input.addEventListener('change', () => {
      state.size = key;
      pushHistory();
      redraw();
    });
    label.append(input, document.createTextNode(`${def.name} ${def.label}`));
    sizeBox.appendChild(label);
  });
}

function syncControls() {
  document.querySelectorAll('#layouts .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grades .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#sizes input').forEach((i) => {
    i.checked = i.value === state.size;
  });
  el('title').value = state.title;
  el('subtitle').value = state.subtitle;
  el('titleSize').value = state.titleSize;
  el('titleSizeVal').textContent = `${Math.round(state.titleSize * 100)}%`;
  el('grain').checked = state.grain !== false;
  el('vignette').checked = state.vignette !== false;
  syncPanelEditor();
  syncUndoButtons();
}

function syncPanelEditor() {
  const panel = state.panels[selectedPanel];
  el('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  const select = el('panelPhoto');
  select.innerHTML = '';
  photos.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i + 1}. ${p.name}`;
    select.appendChild(opt);
  });
  if (panel) {
    select.value = String(panel.photo);
    el('zoom').value = panel.scale;
    el('zoomVal').textContent = `${Math.round(panel.scale * 100)}%`;
    el('panX').value = Math.round((panel.ox || 0) * 100);
    el('panXVal').textContent = `${Math.round((panel.ox || 0) * 100)}`;
    el('panY').value = Math.round((panel.oy || 0) * 100);
    el('panYVal').textContent = `${Math.round((panel.oy || 0) * 100)}`;
  }
  select.disabled = !panel;
  ['zoom', 'panX', 'panY'].forEach((id) => { el(id).disabled = !panel; });
}

// ---------------------------------------------------------------- photos

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addPhoto(name, src) {
  const img = await loadImage(src);
  photos.push({ name, img });
  return photos.length - 1;
}

function renderPhotoStrip() {
  const strip = el('photoStrip');
  strip.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = p.name;
    const thumb = document.createElement('img');
    thumb.src = p.img.src;
    thumb.alt = p.name;
    b.appendChild(thumb);
    b.addEventListener('click', () => {
      const panel = state.panels[selectedPanel];
      if (!panel) return;
      panel.photo = i;
      pushHistory();
      redraw();
    });
    strip.appendChild(b);
  });
}

// ---------------------------------------------------------------- export

function renderExport(sizeKey) {
  const size = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, photos.map((p) => p.img), gradeCache);
  return off;
}

function downloadCanvas(off, filename) {
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

async function exportAll() {
  const all = el('exportAll').checked;
  const keys = all ? Object.keys(SIZES) : [state.size];
  const names = [];
  for (const key of keys) {
    const off = renderExport(key);
    const size = SIZES[key];
    const filename = `cover-${size.w}x${size.h}.png`;
    await downloadCanvas(off, filename);
    names.push(filename);
  }
  statusEl.textContent = `Saved ${names.join(', ')}`;
}

// ---------------------------------------------------------------- pointer

function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const px = (clientX - box.left) * (canvas.width / box.width);
  const py = (clientY - box.top) * (canvas.height / box.height);
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  const panel = state.panels[i];
  drag = { x: e.clientX, y: e.clientY, ox: panel.ox || 0, oy: panel.oy || 0, moved: false };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const panel = state.panels[selectedPanel];
  const box = canvas.getBoundingClientRect();
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  const rect = rects[selectedPanel];
  const dx = ((e.clientX - drag.x) / box.width) * (canvas.width / rect.w);
  const dy = ((e.clientY - drag.y) / box.height) * (canvas.height / rect.h);
  if (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005) drag.moved = true;
  panel.ox = Math.max(-1, Math.min(1, drag.ox + dx));
  panel.oy = Math.max(-1, Math.min(1, drag.oy + dy));
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushHistory();
  drag = null;
  redraw();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.scale = Math.max(1, Math.min(3, (panel.scale || 1) * Math.exp(-e.deltaY * 0.0012)));
  redraw();
  clearTimeout(canvas._wheelTimer);
  canvas._wheelTimer = setTimeout(pushHistory, 250);
}, { passive: false });

// ---------------------------------------------------------------- wiring

function wire() {
  buildControlGroups();
  el('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  el('title').addEventListener('change', pushHistory);
  el('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  el('subtitle').addEventListener('change', pushHistory);
  el('titleSize').addEventListener('input', (e) => {
    state.titleSize = Number(e.target.value);
    el('titleSizeVal').textContent = `${Math.round(state.titleSize * 100)}%`;
    redraw();
  });
  el('titleSize').addEventListener('change', pushHistory);
  el('grain').addEventListener('change', (e) => { state.grain = e.target.checked; pushHistory(); redraw(); });
  el('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; pushHistory(); redraw(); });
  el('panelPhoto').addEventListener('change', (e) => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.photo = Number(e.target.value);
    pushHistory();
    redraw();
  });
  el('zoom').addEventListener('input', (e) => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.scale = Number(e.target.value) / 100;
    el('zoomVal').textContent = `${e.target.value}%`;
    redraw();
  });
  el('zoom').addEventListener('change', pushHistory);
  el('panX').addEventListener('input', (e) => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.ox = Number(e.target.value) / 100;
    el('panXVal').textContent = e.target.value;
    redraw();
  });
  el('panX').addEventListener('change', pushHistory);
  el('panY').addEventListener('input', (e) => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.oy = Number(e.target.value) / 100;
    el('panYVal').textContent = e.target.value;
    redraw();
  });
  el('panY').addEventListener('change', pushHistory);
  el('fillAll').addEventListener('click', () => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    state.panels.forEach((p) => { p.photo = panel.photo; });
    pushHistory();
    redraw();
  });
  el('upload').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const url = URL.createObjectURL(file);
      try {
        await addPhoto(file.name.replace(/\.[^.]+$/, ''), url);
      } catch {
        statusEl.textContent = `Could not read ${file.name}`;
      }
    }
    renderPhotoStrip();
    redraw();
  });
  el('undo').addEventListener('click', undo);
  el('redo').addEventListener('click', redo);
  el('export').addEventListener('click', exportAll);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });
}

// ---------------------------------------------------------------- boot

async function boot() {
  wire();
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // The vendored fonts are local files; if one fails to load the canvas
    // falls back to a bold sans — the cover still renders.
  }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    // Fixed scene for a screenshot: samples only, no upload needed.
    for (const s of SAMPLES) await addPhoto(s.name, s.src);
    renderPhotoStrip();
    runShot(shot, query, { get state() { return state; }, applyLayout, setState: (next) => { state = next; }, photos, redraw, pushHistory, syncControls });
    return;
  }
  for (const s of SAMPLES) {
    try {
      await addPhoto(s.name, s.src);
    } catch {
      statusEl.textContent = `Sample ${s.name} failed to load`;
    }
  }
  renderPhotoStrip();
  syncControls();
  redraw();
}

// Test hooks: the verification script drives the app through these.
window.__app = {
  get state() { return state; },
  get photos() { return photos; },
  get selectedPanel() { return selectedPanel; },
  set selectedPanel(i) { selectedPanel = i; redraw(); },
  undo,
  redo,
  applyLayout,
  renderExport,
  redraw,
  pushHistory,
  SIZES,
  LAYOUTS,
  GRADES,
};

boot();
