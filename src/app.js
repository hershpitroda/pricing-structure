import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as C from './catalog.js';
import { PRICELIST, PEDESTAL_PRICES } from './pricelist.js';
import { makeMaterials, buildCluster, buildDimensions } from './geometry.js';
import { loadModel, prepareModel } from './models.js';

const FTM = 0.3048;
const $ = (s) => document.querySelector(s);
const el = (t, a = {}, h = '') => { const n = document.createElement(t); Object.entries(a).forEach(([k, v]) => n.setAttribute(k, v)); if (h) n.innerHTML = h; return n; };
const money = C.money;

/* ---------------------------------------------------------- pricelist */
// Option trees mirror the PRICELIST sheet columns. Workstations: linear only,
// SH / NSH (col C), size (col E), screen (col F), top (col D/M).
const ROWS = PRICELIST.filter((r) => r.p[0] > 0 || true);
const CATS = {
  WORKSTATION: {
    tab: 'Workstations', unit: 'user',
    base: (r) => r.cat === 'WORKSTATION',
    fields: [
      { k: 'range', label: 'Range', col: 3, name: (v) => title(v) },
      { k: 'asm', label: 'Layout', col: 2, name: (v) => title(v).replace('-W/Su', ' with side unit') },
      { k: 'form', label: 'Type', col: 3, name: (v) => title(v), code: true },
      { k: 'a', label: 'Size', col: 3, name: (v) => v + ' mm' },
      { k: 'scr', label: 'Screen', col: 3, name: (v) => ({ FABRIC: 'Fabric', GLASS: 'Glass', NONE: 'None' }[v] || v), codeOf: (r) => r.b },
      { k: 'top', label: 'Top', col: 3, name: (v) => topName(v) },
    ],
  },
  MEETING: {
    tab: 'Meeting', unit: 'table',
    base: (r) => r.cat === 'MEETING',
    fields: [
      { k: 'range', label: 'Range', col: 3, name: (v) => title(v) },
      { k: 'fc', label: 'Size', col: 2, name: (v, r) => title(r.form) + ' · ' + r.size.replace('x', ' × ') },
      { k: 'top', label: 'Top', col: 3, name: (v) => topName(v) },
    ],
  },
  CABINS: {
    tab: 'Cabins', unit: 'cabin',
    base: (r) => r.cat === 'CABINS',
    fields: [
      { k: 'range', label: 'Range', col: 3, name: (v) => title(v) },
      { k: 'fc', label: 'Type', col: 3, name: (v, r) => title(r.form) },
      { k: 'a', label: 'Size', col: 3, name: (v) => v.replace('x', ' × ') },
      { k: 'top', label: 'Top', col: 3, name: (v) => topName(v) },
    ],
  },
};
// Placeholder prices — replace with sheet rates when available.
const ADDON_GROUPS = [
  { label: 'Add ons', items: [
    { id: 'ped_mobile', name: 'Mobile Pedestal', price: (PEDESTAL_PRICES[0] || {}).p || 7000, ped: C.PEDESTALS.find((p) => p.id === 'd3') },
    { id: 'lhs_120', name: 'LHS 120 × 120 cm', price: 9800 },
  ] },
];
const ADDON_ITEMS = ADDON_GROUPS.flatMap((g) => g.items);
CATS.ADDONS = { tab: 'Add ons', unit: 'unit', base: () => false, fields: [] };
const addonRow = (it) => ({ cat: 'ADDON', sku: 'ADD-' + it.id.toUpperCase(), name: it.name, range: '', p: [it.price, it.price, it.price, it.price, it.price] });
const title = (s) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
const TOPNAMES = { 'PLPB BSL': 'PLPB BSL', 'PLMDF BSL': 'PLMDF', PoLMDF: 'PoLMDF', 'LUVIH-MDF': 'LUVIH-MDF', 'LUVIH-PLY': 'LUVIH-PLY', MEMBRANE: 'Membrane', GLASS: 'Glass', VENEER: 'Veneer', MARBLE: 'Marble' };
const topName = (v) => TOPNAMES[v] || title(v);
const valOf = (r, k) => (k === 'scr' ? r.scr : r[k]);
const distinct = (rows, k) => { const s = []; rows.forEach((r) => { const v = valOf(r, k); if (!s.some((x) => x.v === v)) s.push({ v, r }); }); return s; };

function options(cat, sel) {
  const def = CATS[cat]; let pool = ROWS.filter(def.base);
  return def.fields.map((f) => {
    const opts = distinct(pool, f.k).map(({ v, r }) => {
      const priced = pool.some((x) => valOf(x, f.k) === v && x.p[0] > 0);
      return { v, label: f.name(v, r), code: f.k === 'form' && cat === 'WORKSTATION' ? r.fc : f.k === 'scr' && /^[FGX]$/.test(r.b) ? r.b : '', priced };
    });
    const chosen = sel[f.k];
    pool = pool.filter((x) => valOf(x, f.k) === chosen);
    return { ...f, opts };
  });
}
function normalise(cat) {
  const sel = S.sel[cat] = S.sel[cat] || {};
  const def = CATS[cat]; let pool = ROWS.filter(def.base);
  def.fields.forEach((f) => {
    const vals = distinct(pool, f.k).map((o) => o.v);
    const pricedVals = vals.filter((v) => pool.some((x) => valOf(x, f.k) === v && x.p[0] > 0));
    if (!vals.includes(sel[f.k]) || (!pricedVals.includes(sel[f.k]) && pricedVals.length)) sel[f.k] = pricedVals[0] || vals[0];
    pool = pool.filter((x) => valOf(x, f.k) === sel[f.k]);
  });
  return pool[0];
}
function current() {
  if (S.cat === 'ADDONS') {
    const n = Object.values(S.aq || {}).reduce((a, b) => a + (b || 0), 0);
    return { row: null, cat: 'ADDONS', sel: {}, priced: n > 0 };
  }
  const row = normalise(S.cat);
  return { row, cat: S.cat, sel: S.sel[S.cat], priced: !!(row && row.p[0] > 0) };
}

// 3D config from a pricelist row.
function cfgFor(row, qty, extras) {
  const ex = extras || { addons: {}, pedestal: C.PEDESTALS[0], pedSide: S.pedSide };
  if (row.cat === 'WORKSTATION') {
    const sh = row.fc === 'SH';
    const seats = sh ? Math.min(8, Math.max(2, qty + (qty % 2))) : Math.min(4, Math.max(1, qty));
    return { formation: sh ? 'sharing' : 'nonsharing', system: row.range === 'PANEL BASED' ? 'panel' : '', seats, unit: +row.a / 1000, screen: /^[FGX]$/.test(row.b) ? row.b : 'F', topMat: row.top, ...ex, chairs: S.chairs };
  }
  if (row.cat === 'MEETING') return { formation: 'meeting', W: +row.a / 1000, D: +row.b / 1000, topMat: row.top, addons: {}, pedestal: C.PEDESTALS[0], chairs: S.chairs };
  const [w, d] = row.a.split('x').map((n) => +n / 1000);
  return { formation: 'cabin', W: w, D: d, su: row.b === 'X' ? 0 : +row.b / 1000, type: row.fc, topMat: row.top, ...ex, chairs: S.chairs };
}
function describe(row) {
  if (row.cat === 'ADDON') return row.name;
  if (row.cat === 'WORKSTATION') return `${title(row.range)} ${title(row.form)} · ${title(row.asm).replace('-W/Su', ' + side unit')} · ${row.a} mm · ${title(row.scr)} screen · ${topName(row.top)} top`;
  if (row.cat === 'MEETING') return `${title(row.range)} meeting · ${row.size.replace('x', ' × ')} · ${topName(row.top)} top`;
  return `${title(row.range)} cabin, ${title(row.form).toLowerCase()} · ${row.a.replace('x', ' × ')}${row.b !== 'X' ? ' + ' + row.b + ' side unit' : ''} · ${topName(row.top)} top`;
}

/* -------------------------------------------------------------- state */

const DEF = {
  step: 'config', cat: 'WORKSTATION', qty: 4,
  sel: { WORKSTATION: { range: 'FLEXI', fc: 'SH', a: '1200', scr: 'GLASS', top: 'PLMDF BSL' } },
  top: 'walnut', frame: 'pista', glass: 'pista', fabric: 'slate', ped: 'white',
  pedSide: 'right', aq: {}, chairs: true, dims: false,
  basket: [], quotes: [], estSeq: 0,
};
let S = load();
function load() {
  try { const r = JSON.parse(localStorage.getItem('burosys.studio.v2')); if (r && r.basket) return { ...DEF, ...r }; } catch (e) {}
  return structuredClone(DEF);
}
const save = () => { try { localStorage.setItem('burosys.studio.v2', JSON.stringify(S)); } catch (e) {} };

const FABRICS = [
  { id: 'slate', name: 'Slate', hex: '#5B615D' },
  { id: 'charcoal', name: 'Charcoal', hex: '#34363A' },
  { id: 'pista', name: 'Pista', hex: '#9BB487' },
  { id: 'sand', name: 'Sand', hex: '#C9B795' },
  { id: 'rust', name: 'Rust', hex: '#A4532E' },
];
const finishes = (topMat) => ({
  top: C.find(C.TOPS, S.top), frame: C.find(C.FRAMES, S.frame), glass: C.find(C.GLASS, S.glass),
  fabric: C.find(FABRICS, S.fabric), ped: C.find(C.PEDCOLS, S.ped), topMat,
});

/* ------------------------------------------------------------ scene */

let renderer, scene, cam, controls, M, productGroup, dimGroup, ground, idle = 0, mode = 'product', planMode = false;

function initScene() {
  const host = $('#view');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121211);
  scene.fog = new THREE.Fog(0x121211, 20, 64);

  cam = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.05, 300);
  cam.position.set(4.4, 2.9, 5.2);

  scene.add(new THREE.HemisphereLight(0x9FB0C0, 0x1A1A18, 0.42));
  const key = new THREE.DirectionalLight(0xFFF8F0, 2.7);
  key.position.set(5.5, 8.5, 4.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const d = 9; Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 0.5, far: 40 });
  key.shadow.bias = -0.0007; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xBFD4E8, 0.55); fill.position.set(-6, 4, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xFFC9A0, 0.38); rim.position.set(-2, 2.4, -7); scene.add(rim);

  ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x1A1A18, roughness: 0.92, metalness: 0.04 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  controls = new OrbitControls(cam, renderer.domElement);
  controls.target.set(0, 0.72, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.075;
  controls.minDistance = 1.6; controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.autoRotateSpeed = 0.55;
  controls.addEventListener('start', () => { idle = 0; controls.autoRotate = false; });

  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(host);
  requestAnimationFrame(tick);
  $('#load').remove();
}
function resize() {
  const h = $('#view'); if (!renderer || !h.clientWidth) return;
  renderer.setSize(h.clientWidth, h.clientHeight);
  cam.aspect = h.clientWidth / h.clientHeight; cam.updateProjectionMatrix();
}

let last = performance.now();
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (planMode) { requestAnimationFrame(tick); return; }
  if (mode === 'product') {
    idle += dt;
    if (idle > 7) controls.autoRotate = true;
    controls.update();
  }
  renderer.render(scene, cam);
  requestAnimationFrame(tick);
}

function dispose(g) {
  if (!g) return;
  g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
  scene.remove(g);
}

/* --------------------------------------------------------- product 3D */

let buildToken = 0;
function rebuildProduct(refit = true) {
  const token = ++buildToken;
  const cur = current();
  dispose(productGroup); dispose(dimGroup); dimGroup = null;
  if (S.cat === 'ADDONS') {
    const ws = normalise('WORKSTATION');
    const aq = S.aq || {}, addons = {};
    C.ADDONS.forEach((a) => { if (aq[a.id] > 0) addons[a.id] = true; });
    const pedIt = ADDON_ITEMS.find((it) => it.ped && aq[it.id] > 0);
    M = makeMaterials(finishes(ws.top));
    const { group } = buildCluster({ ...cfgFor(ws, 2, { addons, pedestal: pedIt ? pedIt.ped : C.PEDESTALS[0], pedSide: S.pedSide }), chairs: aq.chair > 0 || S.chairs }, M);
    productGroup = group; scene.add(group);
    if (refit) frame(group);
    $('#cap-t').textContent = 'Add ons preview';
    $('#cap-s').textContent = 'Shown on ' + describe(ws);
    return;
  }
  if (!cur.row) return;
  M = makeMaterials(finishes(cur.row.top));
  const cfg = cfgFor(cur.row, S.qty);
  const { group } = buildCluster(cfg, M);
  productGroup = group; scene.add(group);
  if (S.dims) { dimGroup = buildDimensions(group); scene.add(dimGroup); }
  if (refit) frame(S.dims && dimGroup ? dimGroup : group);
  const b = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  $('#cap-t').textContent = describe(cur.row);
  const shown = cur.row.cat === 'WORKSTATION' && cfg.seats !== S.qty ? ` · showing ${cfg.seats} of ${S.qty} seats` : '';
  $('#cap-s').textContent = `${cur.row.sku} · ${Math.round(b.x * 1000)} × ${Math.round(b.z * 1000)} × ${Math.round(b.y * 1000)} mm${shown}`;
  if (cur.row.model) swapInModel(cur.row, M, token, refit);
}

// Uploaded model (models/<file>, named in the sheet's MODEL column) replaces the built-in one once loaded.
function swapInModel(row, mats, token, refit) {
  $('#cap-s').textContent += ' · loading ' + row.model;
  loadModel(row.model).then((obj) => {
    if (token !== buildToken) return;
    const g = prepareModel(obj, mats);
    dispose(productGroup); dispose(dimGroup); dimGroup = null;
    productGroup = g; scene.add(g);
    if (S.dims) { dimGroup = buildDimensions(g); scene.add(dimGroup); }
    if (refit) frame(S.dims && dimGroup ? dimGroup : g);
    const b = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    $('#cap-s').textContent = `${row.sku} · ${Math.round(b.x * 1000)} × ${Math.round(b.z * 1000)} × ${Math.round(b.y * 1000)} mm · model ${row.model}`;
  }).catch((e) => {
    if (token !== buildToken) return;
    console.warn('Model failed, using built-in:', row.model, e);
    $('#cap-s').textContent = $('#cap-s').textContent.replace(' · loading ' + row.model, '') + ' · ' + row.model + ' not found, showing built-in';
  });
}

function frame(g, angle = 0.72) {
  const b = new THREE.Box3().setFromObject(g);
  const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const r = Math.max(s.x, s.z, s.y) * 0.62 + 0.6;
  const dist = r / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.05;
  cam.position.set(c.x + Math.sin(angle) * dist * 0.78, s.y * 1.25 + 0.5, c.z + Math.cos(angle) * dist * 0.78);
  controls.target.set(c.x, s.y * 0.42, c.z);
  controls.update();
}

function camView(v) {
  if (mode !== 'product' || !productGroup) return;
  const b = new THREE.Box3().setFromObject(productGroup);
  const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  controls.autoRotate = false; idle = 0;
  const dist = Math.max(s.x, s.z) * 1.15 + 1.6;
  if (v === 'FRONT') { cam.position.set(c.x, 1.35, c.z + dist); controls.target.set(c.x, 0.8, c.z); }
  if (v === 'TOP') { cam.position.set(c.x + 0.01, dist * 1.25, c.z); controls.target.set(c.x, 0.7, c.z); }
  if (v === 'SEAT') { cam.position.set(c.x + s.x * 0.32, 1.22, c.z + s.z / 2 + 0.75); controls.target.set(c.x, 0.85, c.z - 0.2); }
  if (v === '3⁄4') frame(productGroup);
  controls.update();
}

/* ------------------------------------------------------- floor layout */

// Floor units come from the basket (or the live selection if it is empty).
function floorUnits() {
  const lines = S.basket.length ? S.basket : (current().row ? [{ row: current().row, qty: S.qty, ex: null }] : []);
  const out = [];
  let n = 0;
  lines.forEach((l) => {
    const row = l.row;
    if (!row || row.cat === 'ADDON') return;
    if (row.cat === 'WORKSTATION') {
      const sh = row.fc === 'SH', chunk = sh ? 4 : 3, u = +row.a / 1000;
      let left = l.qty;
      while (left > 0) {
        const seats = Math.min(chunk, left); left -= seats;
        const cfg = cfgFor(row, seats, l.ex);
        const per = sh ? cfg.seats / 2 : cfg.seats;
        out.push({ kind: 'cluster', row, cfg, w: per * u + 0.2, d: sh ? 2.4 : 1.8, deskW: per * u, deskD: sh ? 1.2 : 0.6, per, u, label: `Cluster ${++n}` });
      }
    } else {
      for (let i = 0; i < l.qty; i++) {
        const cfg = cfgFor(row, 1, l.ex);
        const meet = row.cat === 'MEETING';
        const fr = !meet && cfg.su && cfg.type === 'FR';
        out.push({ kind: 'room', row, cfg, w: (meet ? cfg.W + 1.8 : Math.max(cfg.W, cfg.su || 0) + 1.4), d: meet ? cfg.D + 1.8 : cfg.D + (fr ? 1.0 : 0) + 1.6,
          tw: cfg.W, td: cfg.D, label: `${meet ? 'Meeting' : 'Cabin'} ${out.filter((o) => o.row.cat === row.cat).length + 1}` });
      }
    }
  });
  return out;
}
const basketSeats = () => (S.basket.length ? S.basket : [{ row: current().row, qty: S.qty }]).reduce((n, l) => n + (l.row && l.row.cat === 'WORKSTATION' ? l.qty : 0), 0);

function computeLayout() {
  const all = floorUnits();
  const roomList = all.filter((u) => u.kind === 'room');
  const cl = all.filter((u) => u.kind === 'cluster');
  const M0 = 0.5, GAPX = 0.6, GAPZ = 0.7;
  const roomD = roomList.length ? Math.max(...roomList.map((r) => r.d)) : 0;
  const clD = cl.length ? Math.max(...cl.map((c) => c.d)) : 0;
  const n = all.length || 1;
  const rowsN = Math.max(1, Math.ceil(n / Math.max(1, Math.ceil(Math.sqrt(n * 1.6)))));
  const perRow = Math.max(1, Math.ceil(n / rowsN));
  const widest = Math.max(0.1, ...all.map((c) => c.w));
  const avg = all.length ? all.reduce((s, u) => s + u.w, 0) / all.length : 2;
  const target = Math.max(widest, perRow * avg + (perRow - 1) * GAPX);
  const rooms = [], items = [];
  let x = 0, z = 0, rowW = 0, maxW = 0;
  roomList.forEach((r) => {
    if (x > 0 && x + r.w > target + 0.01) { maxW = Math.max(maxW, rowW); x = 0; z += roomD + 0.3; }
    rooms.push({ ...r, x: x + r.w / 2, z: z + r.d / 2 });
    x += r.w + 0.3; rowW = x - 0.3;
  });
  maxW = Math.max(maxW, rowW);
  if (roomList.length) z += roomD + 0.8;
  x = 0; rowW = 0;
  cl.forEach((c) => {
    if (x > 0 && x + c.w > target + 0.01) { maxW = Math.max(maxW, rowW); x = 0; z += clD + GAPZ; }
    items.push({ ...c, x: x + c.w / 2, z: z + c.d / 2 });
    x += c.w + GAPX; rowW = x - GAPX;
  });
  maxW = Math.max(maxW, rowW);
  const contentD = cl.length ? z + clD : Math.max(0, z - 0.8);
  const W = maxW + M0 * 2, D = contentD + M0 * 2;
  const ox = -W / 2 + M0, oz = -D / 2 + M0;
  rooms.forEach((r) => { r.x += ox; r.z += oz; });
  items.forEach((it) => { it.x += ox; it.z += oz; });
  return { W, D, rooms, items };
}
const deskZ = (it) => (it.row.fc === 'SH' ? it.z : it.z - (it.d - it.deskD) / 2);


/* ---------------------------------------------------------- plan SVG */

function renderPlan() {
  const L = computeLayout();
  const pad = 1.2, W = L.W + pad * 2, D = L.D + pad * 2;
  const px = (v) => (v + L.W / 2 + pad).toFixed(2), pz = (v) => (v + L.D / 2 + pad).toFixed(2);
  const ft = (m) => Math.round(m / FTM);
  let s = `<svg viewBox="0 0 ${W.toFixed(2)} ${D.toFixed(2)}" preserveAspectRatio="xMidYMid meet">
  <defs><pattern id="hatch" width="0.3" height="0.3" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0" y2="0.3" stroke="#2A2A27" stroke-width="0.04"/></pattern></defs>
  <rect x="${pad}" y="${pad}" width="${L.W.toFixed(2)}" height="${L.D.toFixed(2)}" fill="#191918" stroke="#4A4A44" stroke-width="0.09"/>`;
  L.rooms.forEach((r) => {
    s += `<rect x="${px(r.x - r.w / 2)}" y="${pz(r.z - r.d / 2)}" width="${r.w.toFixed(2)}" height="${r.d.toFixed(2)}" fill="url(#hatch)" stroke="#6A665E" stroke-width="0.055" stroke-dasharray="0.22 0.14"/>
    <rect x="${px(r.x - r.tw / 2)}" y="${pz(r.z - r.td / 2)}" width="${r.tw}" height="${r.td}" fill="#3A342C" stroke="#8C8880" stroke-width="0.04"/>
    <text x="${px(r.x)}" y="${pz(r.z + r.d / 2 - 0.28)}" fill="#9C988F" font-size="0.3" font-family="Archivo" text-anchor="middle" letter-spacing="0.03">${r.label.toUpperCase()}</text>`;
  });
  L.items.forEach((it) => {
    const share = it.row.fc === 'SH', cx = it.x, cz = deskZ(it), dw = it.deskW, dd = it.deskD;
    s += `<rect x="${px(cx - dw / 2)}" y="${pz(cz - dd / 2)}" width="${dw}" height="${dd}" fill="#4A3E31" stroke="#C08A55" stroke-width="0.05"/>`;
    for (let i = 1; i < it.per; i++) s += `<line x1="${px(cx - dw / 2 + i * it.u)}" y1="${pz(cz - dd / 2)}" x2="${px(cx - dw / 2 + i * it.u)}" y2="${pz(cz + dd / 2)}" stroke="#C08A55" stroke-width="0.03"/>`;
    if (share) s += `<line x1="${px(cx - dw / 2)}" y1="${pz(cz)}" x2="${px(cx + dw / 2)}" y2="${pz(cz)}" stroke="#E2552B" stroke-width="0.055"/>`;
    s += `<text x="${px(cx)}" y="${pz(cz - dd / 2 - 0.22)}" fill="#9C988F" font-size="0.26" font-family="Archivo" text-anchor="middle">${it.cfg.seats} PAX ${share ? 'SH' : 'NSH'} · ${it.row.a}</text>`;
  });
  s += `<line x1="${pad}" y1="${(pad - 0.45).toFixed(2)}" x2="${(pad + L.W).toFixed(2)}" y2="${(pad - 0.45).toFixed(2)}" stroke="#E2552B" stroke-width="0.05"/>
  <text x="${(pad + L.W / 2).toFixed(2)}" y="${(pad - 0.62).toFixed(2)}" fill="#E2552B" font-size="0.34" font-family="Archivo" text-anchor="middle" font-weight="600">${ft(L.W)}′</text>
  <line x1="${(pad - 0.45).toFixed(2)}" y1="${pad}" x2="${(pad - 0.45).toFixed(2)}" y2="${(pad + L.D).toFixed(2)}" stroke="#E2552B" stroke-width="0.05"/>
  <text x="${(pad - 0.62).toFixed(2)}" y="${(pad + L.D / 2).toFixed(2)}" fill="#E2552B" font-size="0.34" font-family="Archivo" text-anchor="middle" font-weight="600" transform="rotate(-90 ${(pad - 0.62).toFixed(2)} ${(pad + L.D / 2).toFixed(2)})">${ft(L.D)}′</text>
  </svg>`;
  $('#plan').innerHTML = s;
  $('#cap-t').textContent = `Basket layout · ${ft(L.W)}′ × ${ft(L.D)}′ footprint`;
  $('#cap-s').textContent = `${basketSeats()} workstation seats · ${L.rooms.filter((r) => r.row.cat === 'MEETING').length} meeting · ${L.rooms.filter((r) => r.row.cat === 'CABINS').length} cabins`;
}

/* ------------------------------------------------------------- basket */
// Slabs from PRICELIST cols P–S, applied on the list total of
// workstations + meeting + cabins. Add-ons and styling stay at list.
const SLABS = [
  { max: 1000000, idx: 1, pct: 10, label: 'Up to ₹10L' },
  { max: 2000000, idx: 2, pct: 15, label: '₹10L – 20L' },
  { max: 4000000, idx: 3, pct: 20, label: '₹20L – 40L' },
  { max: Infinity, idx: 4, pct: 30, label: 'Above ₹40L' },
];
const extrasFor = (ex) => {
  const out = [];
  if (!ex) return out;
  if (ex.pedestal && ex.pedestal.price) out.push({ n: ex.pedestal.name + ' pedestal', unit: ex.pedestal.price });
  C.ADDONS.forEach((a) => { if (ex.addons && ex.addons[a.id]) out.push({ n: a.name, unit: a.price }); });
  return out;
};
function totals() {
  const furn = S.basket.filter((l) => l.row.cat !== 'ADDON');
  const furnList = furn.reduce((n, l) => n + l.row.p[0] * l.qty, 0);
  const slab = SLABS.find((s) => furnList <= s.max);
  const furnNet = furn.reduce((n, l) => n + l.row.p[slab.idx] * l.qty, 0);
  const extras = S.basket.filter((l) => l.row.cat === 'ADDON').reduce((n, l) => n + l.row.p[0] * l.qty, 0)
    + S.basket.reduce((n, l) => n + extrasFor(l.ex).reduce((m, e) => m + e.unit, 0) * l.qty, 0);
  const next = SLABS[SLABS.indexOf(slab) + 1];
  return { furnList, furnNet, slab, extras, list: furnList + extras, net: furnNet + extras, toNext: next ? slab.max - furnList : 0, next };
}

function addToBasket() {
  const cur = current();
  if (!cur.priced) return;
  if (S.cat === 'ADDONS') {
    ADDON_ITEMS.forEach((it) => {
      const q = (S.aq || {})[it.id] || 0; if (!q) return;
      const same = S.basket.find((l) => l.row.sku === addonRow(it).sku);
      if (same) same.qty += q; else S.basket.push({ id: Date.now() + Math.random(), row: addonRow(it), qty: q, ex: null });
    });
    S.aq = {}; save(); return;
  }
  const ex = null;
  const same = S.basket.find((l) => l.row.sku === cur.row.sku && JSON.stringify(l.ex) === JSON.stringify(ex));
  if (same) same.qty += S.qty;
  else S.basket.push({ id: Date.now(), row: cur.row, qty: S.qty, ex, fin: { top: S.top, frame: S.frame, glass: S.glass, fabric: S.fabric, ped: S.ped } });
  save();
}

function lineAmount(l, t) {
  const idx = l.row.cat === 'ADDON' ? 0 : t.slab.idx;
  const ex = extrasFor(l.ex).reduce((m, e) => m + e.unit, 0);
  return { unitNet: l.row.p[idx], amount: (l.row.p[idx] + ex) * l.qty, ex };
}

const n2 = (v) => (Math.round(v * 100) / 100).toLocaleString('en-IN');
function workingPanel(l, a, t) {
  const w = l.row.w, d = el('div', { class: 'bw' });
  const dims = w.L ? `${n2(w.L)} × ${n2(w.W)} m` : '';
  d.innerHTML = `<div class="bwh"><b>Working · ${l.row.sku}</b><span>${w.sh}${dims ? ' · ' + dims : ''}${w.users > 1 ? ' · ' + w.users + ' users' : ''} · rates from MASTER DATA</span></div>
    <div class="bwt">
      <div class="bwr bwhd"><span>COMPONENT</span><span class="r">QTY</span><span>UNIT</span><span class="r">RATE</span><span class="r">AMOUNT</span></div>
      ${w.lines.map(([n, q, u, rt, am]) => `<div class="bwr"><span>${esc(n)}</span><span class="r">${n2(q)}</span><span>${u}</span><span class="r">${money(rt)}</span><span class="r">${money(am)}</span></div>`).join('')}
    </div>
    <div class="bwf">
      <div><span>Cost</span><b>${money(w.total)}</b></div>
      ${w.users > 1 ? `<div><span>÷ ${w.users} users</span><b>${money(w.per)}</b></div>` : ''}
      <div><span>× ${w.mult} margin</span><b>${money(w.per * w.mult)}</b></div>
      <div><span>List (rounded to 100)</span><b>${money(w.price)}</b></div>
      ${l.row.cat !== 'ADDON' ? `<div class="acc"><span>Net at ${t.slab.pct}% slab</span><b>${money(a.unitNet)}</b></div>` : ''}
    </div>`;
  return d;
}
function renderBasket() {
  const t = totals();
  const host = $('#blines');
  if (!S.basket.length) {
    host.innerHTML = '<div class="bempty">Your basket is empty.<br>Configure workstations, meeting tables, cabins or add ons and add them here.</div>';
  } else {
    host.innerHTML = `<div class="bt bth"><span>ITEM</span><span>WORKING</span><span>SKU</span><span class="r">LIST</span><span class="r">NET</span><span class="c">QTY</span><span class="r">AMOUNT</span><span></span></div>`;
    S.basket.forEach((l, i) => {
      const a = lineAmount(l, t);
      const isAdd = l.row.cat === 'ADDON';
      const name = isAdd ? l.row.name : `${CATS[l.row.cat].tab.replace(/s$/, '')} · ${title(l.row.range)}`;
      const sub = isAdd ? 'Add on · list price' : describe(l.row).split(' · ').slice(1).join(' · ') + (extrasFor(l.ex).length ? ' · with ' + extrasFor(l.ex).map((e) => e.n).join(', ') : '');
      const row = el('div', { class: 'bt' });
      const w = l.row.w;
      row.innerHTML = `<span class="nm"><b>${name}</b><em>${sub}</em></span><span class="wk"></span><span class="sku">${l.row.sku}</span>
        <span class="r">${money(l.row.p[0])}</span><span class="r">${money(a.unitNet)}</span><span class="c"></span><span class="r amt">${money(a.amount)}</span><span class="c"></span>`;
      const c = el('div', { class: 'count' });
      const minus = el('button', {}, '−'), plus = el('button', {}, '+');
      const val = el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '9999', value: l.qty });
      const upd = () => { save(); renderBasket(); total(); };
      minus.onclick = () => { l.qty = Math.max(1, l.qty - 1); upd(); };
      plus.onclick = () => { l.qty++; upd(); };
      val.onfocus = () => val.select();
      val.onkeydown = (e) => { if (e.key === 'Enter') val.blur(); };
      val.onchange = () => { l.qty = clampQty(val.value); upd(); };
      c.append(minus, val, plus);
      row.children[5].appendChild(c);
      if (w) {
        const btn = el('button', { class: 'wkb', 'data-open': S.wOpen === l.id ? 1 : 0 });
        btn.innerHTML = `<span>${money(w.total)}${w.users > 1 ? ' ÷ ' + w.users : ''} × ${w.mult}</span><i>${S.wOpen === l.id ? 'Hide' : 'View'}</i>`;
        btn.onclick = () => { S.wOpen = S.wOpen === l.id ? null : l.id; renderBasket(); };
        row.children[1].appendChild(btn);
      } else row.children[1].innerHTML = '<em class="wkn">List price</em>';
      const del = el('button', { class: 'bdel', title: 'Remove' }, '×');
      del.onclick = () => { S.basket.splice(i, 1); upd(); };
      row.children[7].appendChild(del);
      host.appendChild(row);
      if (w && S.wOpen === l.id) host.appendChild(workingPanel(l, a, t));
    });
  }
  $('#slabs').innerHTML = SLABS.map((s) => `<div data-on="${s === t.slab && t.furnList > 0 ? 1 : 0}"><b>${s.pct}%</b><span>${s.label}</span></div>`).join('');
  $('#bsum').innerHTML = `
    <div class="qline"><span>Furniture, list<em>Workstations, meeting &amp; cabins</em></span><b>${money(t.furnList)}</b></div>
    <div class="qline"><span>Slab discount ${t.slab.pct}%<em>${t.slab.label}</em></span><b style="color:var(--accent)">− ${money(t.furnList - t.furnNet)}</b></div>
    <div class="qline"><span>Add ons<em>List price, no slab discount</em></span><b>${money(t.extras)}</b></div>`;
  $('#qtotal').textContent = money(t.net);
  $('#slabnote').innerHTML = t.next && t.furnList > 0
    ? `Go above ${t.slab.label.split(' ').pop()} in furniture (<b>${money(t.toNext)}</b> more) to reach the ${t.next.pct}% slab.`
    : t.furnList > 0 ? 'Top slab reached: 30% off furniture.' : '';
  $('#bookbtn').disabled = !S.basket.length;
  $('#bcount').textContent = S.basket.length ? `${S.basket.length} line${S.basket.length > 1 ? 's' : ''} · ${S.basket.reduce((n, l) => n + l.qty, 0)} units` : '';
}

function renderQuotes() {
  const host = $('#qlist'); host.innerHTML = '';
  const qs = S.quotes || [];
  if (!qs.length) { host.innerHTML = '<div class="bempty">No saved quotes yet.<br>Build a basket and press Book Order to save one here.</div>'; return; }
  qs.slice().reverse().forEach((q) => {
    const card = el('div', { class: 'qcard' });
    const units = q.basket.reduce((n, l) => n + l.qty, 0);
    card.innerHTML = `<div class="qh"><b>${q.est}</b><span>${fmtDate(q.date)}</span></div>
      <div class="qp">${esc(q.name)}</div>
      <div class="qm">Client: ${esc(q.client)} · Sales: ${esc(q.sales)}</div>
      <div class="qm">${q.basket.length} lines · ${units} units · slab ${q.slab}%</div>
      <div class="qf"><b>${money(q.net)}</b><span>ex GST</span></div>`;
    const act = el('div', { class: 'qa' });
    const pdf = el('button', { class: 'rowbtn pri' }, 'Download PDF');
    pdf.onclick = () => openZoho(q);
    const open = el('button', { class: 'rowbtn' }, 'Open in basket');
    open.onclick = () => { S.basket = structuredClone(q.basket); save(); goto('basket'); };
    act.append(pdf, open); card.appendChild(act); host.appendChild(card);
  });
}

const SALES = ['Hersh', 'Neil', 'Disha', 'Shturi', 'Bianca'];
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (d) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; };
// EST-CL1, EST-CL2… never reused; quotes cannot be deleted.
function nextEst() { S.estSeq = (S.estSeq || 0) + 1; return 'EST-CL' + S.estSeq; }
function migrateQuotes() {
  (S.quotes || []).forEach((q) => { if (!q.est) q.est = nextEst(); q.sales = q.sales || '—'; q.client = q.client || '—'; });
}

function saveQuote() {
  const f = { name: $('#pname'), sales: $('#psales'), client: $('#pclient') };
  let bad = false;
  Object.values(f).forEach((n) => { if (!n.value.trim()) { n.dataset.err = 1; bad = bad || n; } });
  if (bad) { bad.focus(); return; }
  const t = totals();
  S.quotes = S.quotes || [];
  const q = { id: Date.now(), est: nextEst(), name: f.name.value.trim(), sales: f.sales.value, client: f.client.value.trim(), date: Date.now(),
    basket: structuredClone(S.basket), net: t.net, list: t.list, slab: t.slab.pct, slabIdx: t.slab.idx };
  S.quotes.push(q);
  S.basket = []; save();
  Object.values(f).forEach((n) => { n.value = ''; });
  $('#bookform').dataset.open = 0;
  goto('quotes');
}

/* ------------------------------------------------- quotation PDF (print) */

const TOPSPEC = {
  'PLPB BSL': '18mm thick Pre Laminated Particle Board with BSL edge',
  'PLMDF BSL': '18mm thick Pre Laminated MDF Board with BSL edge',
  PoLMDF: '25mm thick Post-formed Laminated MDF Board',
  'LUVIH-MDF': '18mm thick LUVIH finish on MDF Board',
  'LUVIH-PLY': '18mm thick LUVIH finish on Plywood',
  MEMBRANE: '25mm thick Membrane pressed MDF Board',
  GLASS: '12mm thick Toughened Glass',
  VENEER: '25mm thick Natural Veneer on MDF Board',
  MARBLE: 'Natural Marble top',
};
const colourSpec = (l) => {
  const f = l.fin || {};
  return `Color Specs - ${C.find(C.TOPS, f.top || S.top).name} top, ${C.find(C.FRAMES, f.frame || S.frame).name} frame`;
};
function lineSpec(l) {
  const r = l.row, top = TOPSPEC[r.top] || r.top;
  if (r.desc && r.cat !== 'ADDON') {
    const kind = { WORKSTATION: `${title(r.range)} ${title(r.asm).replace('-W/Su', ' with side unit')} Workstations - ${title(r.form)}`, MEETING: `${title(r.range)} Meeting Table - ${title(r.form)}`, CABINS: `${title(r.range)} Cabin Table - ${title(r.form)}` }[r.cat];
    return { title: kind, body: [...r.desc.split('\n').map((x) => x.trim()).filter((x, i, a) => x || (a[i - 1] && a[i - 1].trim())), '', colourSpec(l)],
      notes: { WORKSTATION: 'WORKSTATIONS', MEETING: 'Meeting', CABINS: 'Cabins' }[r.cat], unit: r.cat === 'WORKSTATION' ? '' : 'Nos' };
  }
  if (r.cat === 'ADDON') return { title: r.name, body: [r.id === 'lhs_120' || /LHS/.test(r.name) ? 'Left hand side return, 1200 x 1200mm' : 'Mobile pedestal on castors with central locking', 'Carcass in 18mm Prelam board'], notes: 'Add ons', unit: 'Nos' };
  if (r.cat === 'WORKSTATION') {
    const scr = { FABRIC: 'Fabric screen above desk', GLASS: 'Glass screen above desk', NONE: 'No screen above desk' }[r.scr] || r.scr;
    return { title: `${title(r.range)} Linear Workstations - ${r.fc === 'SH' ? 'Sharing' : 'Non Sharing'}`, body: [
      `Size per user - L${r.a} x D600`, '', `1. Top - ${top}`, '', `2. Screen - ${scr}, modesty panel below desk`, '',
      '3. Electrification - 450mm access flap with concealed cable tray under top', '', colourSpec(l)], notes: 'WORKSTATIONS', unit: '' };
  }
  if (r.cat === 'MEETING') return { title: `${title(r.range)} Meeting Table`, body: [
    `ACTUAL SIZE - ${r.size.replace('x', ' x ')}mm`, `System - ${r.range}`, '', `1. Top - ${top}`, '', '2. Legs - Powder Coated Finish', '', colourSpec(l)], notes: 'Meeting', unit: 'Nos' };
  return { title: `${title(r.range)} Cabin Table`, body: [
    `ACTUAL SIZE - ${r.a.replace('x', ' x ')}mm`, `System - ${title(r.range)}`, `Formation - ${title(r.form)}`, '', `1. Top - ${top}`, '',
    ...(r.b !== 'X' ? [`2. Side Unit - L ${r.b}mm, carcass in Pre Laminated board similar to top`, ''] : []),
    '3. Electrification - Access flap with switch plate provided under top', '', colourSpec(l)], notes: 'Cabins', unit: 'Nos' };
}

function inWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? '-' + a[x % 10] : ''));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  n = Math.round(n); if (!n) return 'Zero';
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(inWords(cr) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh');
  if (th) parts.push(two(th) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ');
}
const amt = (v) => (Math.round(v * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildQuoteSheet(q) {
  const z = q.zoho || {};
  const lines = (s) => esc(s || '').split('\n').map((x) => `<div>${x}</div>`).join('');
  const idx = q.slabIdx || ({ 10: 1, 15: 2, 20: 3, 30: 4 }[q.slab] || 1);
  let sub = 0;
  const rows = q.basket.map((l, i) => {
    const sp = lineSpec(l);
    const ex = extrasFor(l.ex).reduce((m, e) => m + e.unit, 0);
    const rate = l.row.p[l.row.cat === 'ADDON' ? 0 : idx] + ex;
    const a = rate * l.qty; sub += a;
    return `<tr class="it"><td class="c">${i + 1}</td>
      <td class="img"><div class="ph">IMAGE</div></td>
      <td class="d"><div class="t">${esc(sp.title)}</div>${sp.body.map((x) => x ? `<div>${esc(x)}</div>` : '<div class="gap"></div>').join('')}${ex ? `<div class="gap"></div><div>Includes: ${esc(extrasFor(l.ex).map((e) => e.n).join(', '))}</div>` : ''}</td>
      <td class="n">${esc((z.notes && z.notes[i]) || sp.notes)}</td><td class="r">${l.qty}${sp.unit ? '<br>' + sp.unit : ''}</td><td class="r">${amt(rate)}</td><td class="r">${amt(a)}</td></tr>`;
  }).join('');
  const transport = +z.transport || 0;
  const taxable = sub + transport, cgst = taxable * 0.09, sgst = taxable * 0.09, total = taxable + cgst + sgst;
  const d = new Date(q.date), exp = z.expiry ? new Date(z.expiry) : new Date(q.date + 26 * 864e5);
  $('#sheet').innerHTML = `
  <table class="pg"><tbody><tr><td>
  <div class="frame">
    <div class="top">
      <div class="addr">12, Chunilal Mehta Compound,<br>Mumbai Maharashtra 400027<br>burosys.com<br>PAN : AACCB5957A<br>GSTIN 27AACCB5957A1ZV<br>MSME/Udyam No: UDYAM-MH-18-0066468<br><br>LUT: AD270425062100K 17/04/2025</div>
      <div class="qt">QUOTATION</div>
    </div>
    <div class="meta">
      <div class="kv"><span>#</span><b>: ${q.est}</b><span>Estimate Date</span><b>: ${fmtDate(d)}</b><span>Expiry Date</span><b>: ${fmtDate(exp)}</b><span>Reference#</span><b>: ${esc(q.name)}</b></div>
      <div class="kv"><span>Place Of Supply</span><b>: ${esc(z.pos || 'Maharashtra (27)')}</b><span>Project Manager</span><b>: ${esc(q.sales)}</b></div>
    </div>
    <div class="addrs">
      <div><div class="h">Billing Address</div><div class="b"><b>${esc(q.client)}</b>${lines(z.bill)}</div></div>
      <div><div class="h">Delivery Address</div><div class="b">${z.del ? lines(z.del) : '<div>' + esc(q.client) + '</div>'}${z.contact ? '<div>' + esc(z.contact) + '</div>' : ''}${z.phone ? '<div>' + esc(z.phone) + '</div>' : ''}${z.email ? '<div>' + esc(z.email) + '</div>' : ''}</div></div>
    </div>
    <div class="subj">Subject :<br><br>${esc(z.subject || 'Delivery time - 5-6 weeks after PO+Advance+All finishes finalised')}</div>
    <table class="items"><thead><tr><th class="c">#</th><th colspan="2">Item &amp; Description</th><th>Notes</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="foot">
      <div class="fl">
        <div>Total In Words</div>
        <div class="w">Indian Rupee ${inWords(total)} Only</div>
        <div style="margin-top:10px">Notes</div>
        <div>1 year warranty on mechanical parts. Not applicable on fabric or laminate wear and tear or cosmetic damages.</div>
        <div class="bank">Beneficiary Name - Burosys Furniture Pvt Ltd<br>Bank/Branch- HDFC Bank, Tardeo Branch<br>Bank Address - 544- Tardeo, Wadia St,<br>Venus Apt, Gr Fl, Tardeo, Mumbai 400034<br>Account no - 05442560001853<br>IFSC Code - HDFC0000544</div>
      </div>
      <div class="fr">
        <table class="tot">
          <tr><td>Sub Total</td><td>${amt(sub)}</td></tr>
          <tr><td>Transport/Labour<br><small>(GST18 (18%) )<br>SAC: 965511</small></td><td>${amt(transport)}</td></tr>
          <tr><td>CGST9 (9%)</td><td>${amt(cgst)}</td></tr>
          <tr><td>SGST9 (9%)</td><td>${amt(sgst)}</td></tr>
          <tr class="g"><td>Total</td><td>₹${amt(total)}</td></tr>
        </table>
        <div class="sig"><div>Mr Hersh Pitroda (Director)</div><div>Authorized Signature</div></div>
      </div>
    </div>
    <div class="tc">Terms &amp; Conditions
      <div><span>1</span>PO to be drawn in favour of Burosys Furniture</div>
      <div><span>2</span>Payment Terms - 50% Advance, 40% prior dispatch, 10% post installation within 15 days</div>
      <div><span>3</span>Mathadi if applicable, payable by customer. Not in Burosys scope.</div>
      <div><span>4</span>All disputes are subject to Mumbai Jurisdiction.</div>
      <div><span>4a</span>Lift must be available for higher floor unloading</div>
      <div><span>5</span>Payments to be made against Proforma Invoice.</div>
      <div><span>6</span>Tax invoice shall be submitted on receipt of full &amp; final payment.</div>
      <div><span>7</span>Installation must happen in single phase, during working hours.</div>
      <div><span>8</span>Transport cost to be adjusted as per actuals.</div>
    </div>
  </div>
  </td></tr></tbody></table>`;
}
let zq = null;
const isoDate = (t) => new Date(t).toISOString().slice(0, 10);
function openZoho(q) {
  zq = q; const z = q.zoho || {};
  $('#zest').textContent = `${q.est} · ${q.name} · ${q.client}`;
  $('#z_bill').value = z.bill || '';
  $('#z_del').value = z.del || '';
  $('#z_contact').value = z.contact || '';
  $('#z_phone').value = z.phone || '';
  $('#z_email').value = z.email || '';
  $('#z_pos').value = z.pos || 'Maharashtra (27)';
  $('#z_exp').value = z.expiry || isoDate(q.date + 26 * 864e5);
  $('#z_trans').value = z.transport ?? '';
  $('#z_subj').value = z.subject || 'Delivery time - 5-6 weeks after PO+Advance+All finishes finalised';
  $('#z_lines').innerHTML = q.basket.map((l, i) => `<div class="zl"><span>${i + 1}. ${esc(lineSpec(l).title)} × ${l.qty}</span><input class="fin" data-i="${i}" type="text" value="${esc((z.notes && z.notes[i]) || lineSpec(l).notes)}"></div>`).join('');
  $('#zbusy').textContent = '';
  $('#zoho').dataset.on = 1;
}
function readZoho() {
  return {
    bill: $('#z_bill').value.trim(), del: $('#z_del').value.trim(), contact: $('#z_contact').value.trim(),
    phone: $('#z_phone').value.trim(), email: $('#z_email').value.trim(), pos: $('#z_pos').value.trim(),
    expiry: $('#z_exp').value, transport: $('#z_trans').value === '' ? 0 : +$('#z_trans').value,
    subject: $('#z_subj').value.trim(), notes: [...document.querySelectorAll('#z_lines input')].map((n) => n.value.trim()),
  };
}
let pdfLib = null;
function loadPdfLib() {
  return window.html2pdf ? Promise.resolve(window.html2pdf) : Promise.reject(new Error('PDF library missing'));
}
async function downloadQuote(q) {
  const lib = await loadPdfLib();
  buildQuoteSheet(q);
  const node = $('#sheet'); node.dataset.on = 1;
  try {
    await lib().set({
      margin: [22, 9, 12, 9], filename: q.est + '.pdf',
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2.2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css'], avoid: ['tr.it', '.foot', '.tc', '.top', '.meta', '.addrs'] },
    }).from(node).toPdf().get('pdf').then((pdf) => {
      const n = pdf.internal.getNumberOfPages(), W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
      for (let p = 1; p <= n; p++) {
        pdf.setPage(p);
        pdf.setFont('times', 'normal'); pdf.setFontSize(17); pdf.setTextColor(0);
        const txt = 'BUROSYS FURNITURE', cs = 1.55;
        const tw = pdf.getTextWidth(txt) + cs * (txt.length - 1);
        pdf.text(txt, (W - tw) / 2, 12, { charSpace: cs });
        pdf.setLineWidth(0.25); pdf.line((W - tw) / 2 - 1, 13.4, (W + tw) / 2 + 1, 13.4);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.6);
        pdf.text('WORKSPACE & LIFESTYLE FURNITURE', W / 2, 18, { align: 'center' });
        pdf.setFontSize(6.5); pdf.text(String(p), W - 10, H - 5, { align: 'right' });
      }
    }).save();
  } finally { node.dataset.on = 0; }
}
async function zohoGo(keep) {
  if (!zq) return;
  if (keep) { zq.zoho = readZoho(); save(); }
  $('#zbusy').textContent = 'Preparing ' + zq.est + '.pdf…';
  ['#zsave', '#zskip', '#zcancel'].forEach((s) => { $(s).disabled = true; });
  try { await downloadQuote(zq); $('#zoho').dataset.on = 0; }
  catch (e) { $('#zbusy').textContent = 'Could not create the PDF: ' + e.message; }
  finally { ['#zsave', '#zskip', '#zcancel'].forEach((s) => { $(s).disabled = false; }); }
}

/* ----------------------------------------------------------- exports */

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportOBJ() {
  if (!productGroup) return;
  const base = `burosys-${current().row ? current().row.sku : S.cat}`;
  download(new Blob([new OBJExporter().parse(productGroup)], { type: 'text/plain' }), base + '.obj');
  const seen = new Set(); let mtl = '# Burosys materials\n';
  productGroup.traverse((o) => {
    if (o.isMesh && o.material && !seen.has(o.material.name)) {
      seen.add(o.material.name);
      const c = o.material.color;
      mtl += `newmtl ${o.material.name}\nKd ${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}\nKa 0 0 0\nKs 0.1 0.1 0.1\nd ${o.material.opacity ?? 1}\nillum 2\n\n`;
    }
  });
  download(new Blob([mtl], { type: 'text/plain' }), base + '.mtl');
}
function exportGLB() {
  if (!productGroup) return;
  new GLTFExporter().parse(productGroup, (r) => {
    download(new Blob([r], { type: 'model/gltf-binary' }), `burosys-${current().row ? current().row.sku : S.cat}.glb`);
  }, (e) => console.error(e), { binary: true });
}

/* ---------------------------------------------------------------- UI */

const STEPS = [['config', 'Configure'], ['basket', 'Basket'], ['quotes', 'Quotes']];

function renderSteps() {
  const html = STEPS.map(([k, s], i) => {
    const badge = k === 'basket' && S.basket.length ? ' · ' + S.basket.reduce((n, l) => n + l.qty, 0) : k === 'quotes' && (S.quotes || []).length ? ' · ' + S.quotes.length : '';
    return `<button class="step" data-s="${k}" data-on="${k === S.step ? 1 : 0}"><span class="n">0${i + 1}${badge}</span><span class="l">${s.toUpperCase()}</span></button>`;
  }).join('');
  ['#steps', '#steps2', '#steps3'].forEach((sel) => { $(sel).innerHTML = html; $(sel).querySelectorAll('.step').forEach((b) => { b.onclick = () => goto(b.dataset.s); }); });
}

function swatches(hostSel, list, key) {
  const host = $(hostSel); if (!host) return; host.innerHTML = '';
  host.setAttribute('data-grid', '1');
  host.style.gridTemplateColumns = `repeat(${list.length},minmax(0,1fr))`;
  list.forEach((o) => {
    const b = el('button', { class: 'sw', 'data-on': S[key] === o.id ? 1 : 0, title: o.name }, `<i style="background:${o.hex}"></i><b>${o.name}</b>`);
    b.onclick = () => { S[key] = o.id; save(); swatches(hostSel, list, key); rebuildProduct(false); };
    host.appendChild(b);
  });
}

function renderConfig() {
  $('#cattabs').innerHTML = '';
  Object.entries(CATS).forEach(([k, d]) => {
    const b = el('button', { class: 'chip', 'data-on': S.cat === k ? 1 : 0 }, d.tab);
    b.onclick = () => { S.cat = k; S.qty = k === 'WORKSTATION' ? 4 : 1; save(); renderConfig(); rebuildProduct(); };
    $('#cattabs').appendChild(b);
  });
  const isAdd = S.cat === 'ADDONS';
  ['#fields', '#pricebox', '#qtyrow'].forEach((s) => { $(s).style.display = isAdd ? 'none' : ''; });
  $('#addonlist').style.display = isAdd ? '' : 'none';
  $('#opendrawer').style.display = isAdd ? 'none' : '';
  if (isAdd) { renderAddons(); total(); return; }
  const cur = current();
  const host = $('#fields'); host.innerHTML = '';
  options(S.cat, cur.sel).forEach((f) => {
    const row = el('div', { class: 'frow' });
    row.appendChild(el('div', { class: 'flabel' }, f.label.toUpperCase()));
    const opts = el('div', { class: 'opts', style: `grid-template-columns:repeat(${Math.min(f.col, f.opts.length)},minmax(0,1fr))` });
    f.opts.forEach((o) => {
      const b = el('button', { class: 'opt', 'data-on': cur.sel[f.k] === o.v ? 1 : 0, 'data-off': o.priced ? 0 : 1 },
        `<span>${o.label}</span>${o.code ? `<i>${o.code}</i>` : ''}${o.priced ? '' : '<i>On request</i>'}`);
      b.onclick = () => { cur.sel[f.k] = o.v; save(); renderConfig(); rebuildProduct(); };
      opts.appendChild(b);
    });
    row.appendChild(opts); host.appendChild(row);
  });
  const c2 = current();
  $('#pricebox').innerHTML = c2.priced
    ? `<div><b>${money(c2.row.p[0])}</b><span>LIST / ${CATS[S.cat].unit.toUpperCase()} · ${c2.row.sku}</span></div><div class="ln"><b>${money(c2.row.p[0] * S.qty)}</b><span>× ${S.qty}</span></div>`
    : `<div><b>On request</b><span>${c2.row ? c2.row.sku : ''} has no list price in the sheet yet</span></div>`;
  $('#qtyunit').textContent = S.cat === 'WORKSTATION' ? 'Users / seats' : S.cat === 'MEETING' ? 'Tables' : 'Cabins';
  if (document.activeElement !== $('#v-qty')) $('#v-qty').value = S.qty;
  total();
}

function renderAddons() {
  const host = $('#addonlist'); host.innerHTML = '';
  S.aq = S.aq || {};
  const list = el('div', { class: 'alist' });
  ADDON_GROUPS.forEach((g) => {
    list.appendChild(el('div', { class: 'grouplabel', style: 'margin:12px 0 2px' }, g.label.toUpperCase()));
    g.items.forEach((it) => {
      const row = el('div', { class: 'toggle', style: 'min-height:50px' });
      row.appendChild(el('div', { class: 'tl' }, `${it.name}<em>${money(it.price)}${it.per ? ' per ' + it.per : ' each'}</em>`));
      const c = el('div', { class: 'count' });
      const minus = el('button', {}, '−'), plus = el('button', {}, '+');
      const val = el('input', { type: 'number', inputmode: 'numeric', min: '0', max: '9999', value: S.aq[it.id] || 0 });
      const set = (v) => { S.aq[it.id] = Math.max(0, Math.min(9999, Math.round(+v) || 0)); save(); val.value = S.aq[it.id]; addonTotal(); rebuildProduct(false); };
      minus.onclick = () => set((S.aq[it.id] || 0) - 1);
      plus.onclick = () => set((S.aq[it.id] || 0) + 1);
      val.onfocus = () => val.select();
      val.onkeydown = (e) => { if (e.key === 'Enter') val.blur(); };
      val.onchange = () => set(val.value);
      c.append(minus, val, plus); row.appendChild(c); list.appendChild(row);
    });
  });
  host.appendChild(list);
  host.appendChild(el('div', { class: 'pricebox', id: 'addonsum' }));
  addonTotal();
}
function addonTotal() {
  const n = ADDON_ITEMS.reduce((a, it) => a + (S.aq[it.id] || 0), 0);
  const v = ADDON_ITEMS.reduce((a, it) => a + (S.aq[it.id] || 0) * it.price, 0);
  $('#addonsum').innerHTML = `<div><b>${money(v)}</b><span>${n} ITEM${n === 1 ? '' : 'S'} SELECTED · LIST, NO SLAB</span></div>`;
  total();
}

function renderDrawer() {
  const isWS = S.cat === 'WORKSTATION';
  swatches('#sw-top', C.TOPS, 'top');
  swatches('#sw-frame', C.FRAMES, 'frame');
  swatches('#sw-glass', C.GLASS, 'glass');
  swatches('#sw-fabric', FABRICS, 'fabric');
  swatches('#sw-ped', C.PEDCOLS, 'ped');
  document.querySelectorAll('[data-ws]').forEach((n) => { n.style.display = isWS ? '' : 'none'; });
  $('#addoncount').textContent = `${C.find(C.TOPS, S.top).name} / ${C.find(C.FRAMES, S.frame).name}`;
}

function total() {
  const t = totals();
  const items = S.basket.reduce((n, l) => n + l.qty, 0);
  $('#runtot').textContent = money(t.net);
  $('#runsub').textContent = items ? `BASKET · ${items} ITEMS · ${t.slab.pct}% SLAB` : 'BASKET EMPTY';
  const cur = S.step === 'config' ? current() : null;
  $('#next').disabled = S.step === 'config' && !(cur && cur.priced);
  $('#next').textContent = 'ADD TO BASKET';
  renderSteps();
}

function goto(step) {
  S.step = step; save();
  document.querySelectorAll('.pane').forEach((p) => p.setAttribute('data-on', p.dataset.pane === step ? 1 : 0));
  planMode = step !== 'config';
  document.body.dataset.page = planMode ? step : '';
  $('#bpage').dataset.on = step === 'basket' ? 1 : 0;
  $('#qpage').dataset.on = step === 'quotes' ? 1 : 0;
  ['#t-dims', '#t-chairs'].forEach((s) => { $(s).style.display = step === 'config' ? '' : 'none'; });
  if (step === 'config') { mode = 'product'; renderConfig(); rebuildProduct(); }
  if (step === 'basket') { if (!productGroup) rebuildProduct(false); renderBasket(); }
  if (step === 'quotes') renderQuotes();
  renderer.domElement.style.visibility = planMode ? 'hidden' : 'visible';
  controls.enabled = !planMode && mode === 'product';
  total();
}

/* ------------------------------------------------------------- wiring */

const clampQty = (v) => Math.max(1, Math.min(9999, Math.round(+v) || 1));
const setQty = (v) => { S.qty = clampQty(v); save(); renderConfig(); if (S.cat === 'WORKSTATION') rebuildProduct(false); };
$('#qty').querySelectorAll('button').forEach((b) => { b.onclick = () => setQty(S.qty + +b.dataset.d); });
$('#v-qty').addEventListener('focus', (e) => e.target.select());
$('#v-qty').addEventListener('input', (e) => { if (e.target.value !== '' && +e.target.value >= 1) setQty(e.target.value); });
$('#v-qty').addEventListener('change', (e) => { setQty(e.target.value); e.target.value = S.qty; });
$('#v-qty').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('#opendrawer').onclick = () => { renderDrawer(); document.body.dataset.drawer = 1; };
$('#closedrawer').onclick = () => { document.body.dataset.drawer = 0; renderConfig(); };
$('#scrim').onclick = () => { document.body.dataset.drawer = 0; renderConfig(); };
$('#next').onclick = () => {
  if (S.step === 'config') { addToBasket(); goto('basket'); }

};
$('#addmore').onclick = () => goto('config');
$('#bookbtn').onclick = () => { $('#bookform').dataset.open = 1; setTimeout(() => $('#pname').focus(), 50); };
$('#cancelbook').onclick = () => { $('#bookform').dataset.open = 0; };
$('#savequote').onclick = saveQuote;
['#pname', '#psales', '#pclient'].forEach((s) => { $(s).addEventListener('input', (e) => { e.target.dataset.err = 0; }); $(s).addEventListener('change', (e) => { e.target.dataset.err = 0; }); });
$('#pname').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#psales').focus(); });
$('#pclient').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveQuote(); });
$('#psales').innerHTML = '<option value="">Select sales person</option>' + SALES.map((s) => `<option>${s}</option>`).join('');
$('#newquote').onclick = () => goto('config');
$('#zcancel').onclick = () => { $('#zoho').dataset.on = 0; };
$('#zskip').onclick = () => zohoGo(false);
$('#zsave').onclick = () => zohoGo(true);
$('#t-dims').onclick = () => { S.dims = !S.dims; save(); $('#t-dims').dataset.on = S.dims ? 1 : 0; rebuildProduct(true); };
$('#t-chairs').onclick = () => { S.chairs = !S.chairs; save(); $('#t-chairs').dataset.on = S.chairs ? 1 : 0; rebuildProduct(false); };
const VIEWS = ['3⁄4', 'FRONT', 'TOP', 'SEAT'];
let vi = 0;

function bookNow() {
  if (!S.basket.length) return;
  const t = totals();
  const body = [
    'I would like to book the following order.', '',
    ...S.basket.map((l) => `${l.qty} × ${l.row.sku} — ${describe(l.row)}${extrasFor(l.ex).length ? ' (with ' + extrasFor(l.ex).map((e) => e.n).join(', ') + ')' : ''}`), '',
    `Furniture list: ${money(t.furnList)}`,
    `Slab ${t.slab.pct}% (${t.slab.label}): − ${money(t.furnList - t.furnNet)}`,
    t.extras ? `Add ons (list): ${money(t.extras)}` : '',
    `Total ex GST: ${money(t.net)}`, '',
    `Finishes: ${C.find(C.TOPS, S.top).name} top / ${C.find(C.FRAMES, S.frame).name} frame`,
  ].filter((x) => x !== '').join('\n');
  location.href = `mailto:${C.ENQUIRY_EMAIL}?subject=${encodeURIComponent('Order enquiry — ' + money(t.net) + ' ex GST')}&body=${encodeURIComponent(body)}`;
}

/* --------------------------------------------------------------- boot */

migrateQuotes();
{ const bySku = new Map(PRICELIST.map((r) => [r.sku, r]));
  S.basket = S.basket.filter((l) => l.row && (l.row.cat === 'ADDON' || bySku.has(l.row.sku))).map((l) => (l.row.cat === 'ADDON' ? l : { ...l, row: bySku.get(l.row.sku) })); }
save();
initScene();
$('#t-dims').dataset.on = S.dims ? 1 : 0;
$('#t-chairs').dataset.on = S.chairs ? 1 : 0;
renderDrawer();
goto(STEPS.some((s) => s[0] === S.step) ? S.step : 'config');
