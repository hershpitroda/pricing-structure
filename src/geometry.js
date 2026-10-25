import * as THREE from 'three';

const TUBE = 0.05;        // MS square tube section
const TOP_T = 0.025;      // worksurface thickness
const H = 0.75;           // worksurface height
const SCREEN_TOP = 1.15;  // floor to top of screen
const UNIT = 1.2;         // per-user width
const DEEP = 0.6;         // per-user depth

export function makeMaterials(f) {
  const std = (color, rough, metal, name) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal });
    m.name = name; return m;
  };
  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(f.glass.hex), roughness: 0.08, metalness: 0,
    transparent: true, opacity: f.glass.id === 'frosted' ? 0.62 : 0.42,
    side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  glass.name = 'glass_' + f.glass.id;
  let top = std(f.top.hex, f.top.rough ?? 0.55, 0.02, 'laminate_' + f.top.id);
  if (f.topMat === 'GLASS') {
    top = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#B9CBC6'), roughness: 0.06, transparent: true, opacity: 0.55, clearcoat: 1 });
    top.name = 'top_glass';
  } else if (f.topMat === 'MARBLE') top = std('#E4E0D8', 0.22, 0.05, 'top_marble');
  else if (f.topMat === 'MEMBRANE') top.roughness = 0.3;
  return {
    top,
    fabricScr: std((f.fabric && f.fabric.hex) || '#5B615D', 0.95, 0, 'screen_fabric_' + ((f.fabric && f.fabric.id) || 'std')),
    edge: std(f.top.hex, 0.7, 0.02, 'edgeband_' + f.top.id),
    frame: std(f.frame.hex, 0.42, 0.25, 'powdercoat_' + f.frame.id),
    glass,
    ped: std(f.ped.hex, 0.45, 0.1, 'pedestal_' + f.ped.id),
    fascia: std(f.top.hex, 0.5, 0.02, 'fascia_' + f.top.id),
    steel: std('#8E8E8A', 0.35, 0.6, 'steel'),
    dark: std('#2B2B29', 0.6, 0.3, 'dark_trim'),
    black: std('#131312', 0.55, 0.2, 'black_plastic'),
    fabric: std('#3E4340', 0.9, 0, 'chair_fabric'),
    screenglow: std('#1B2126', 0.25, 0.4, 'monitor_screen'),
    leaf: std('#5C7A4A', 0.85, 0, 'foliage'),
    cushion: std('#7D8B78', 0.95, 0, 'cushion'),
  };
}

function box(w, h, d, mat, name, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.name = name; m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(r1, r2, h, mat, name, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.name = name; m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------- frames */

function endFrame(M, depth, name) {
  const g = new THREE.Group(); g.name = name;
  const zp = depth / 2 - TUBE;
  [-1, 1].forEach((s, i) => {
    if (depth <= DEEP + 0.01 && i === 1 && depth < 0.7) { /* keep both posts */ }
    g.add(box(TUBE, H - TOP_T - 0.03, TUBE, M.frame, 'frame_post', 0, (H - TOP_T - 0.03) / 2, s * zp));
  });
  g.add(box(0.07, 0.045, depth, M.frame, 'frame_foot', 0, 0.0225, 0));
  g.add(box(TUBE, TUBE, depth - 2 * TUBE, M.frame, 'frame_crossrail', 0, H - TOP_T - 0.055, 0));
  [-1, 1].forEach((s) => {
    g.add(cyl(0.022, 0.028, 0.012, M.black, 'levelling_glide', 12).translateY(0.006).translateZ(s * zp));
  });
  return g;
}

function spine(M, len, y) {
  const g = new THREE.Group(); g.name = 'beam_spine';
  g.add(box(len, 0.08, 0.045, M.frame, 'spine_beam', 0, y, 0));
  // concealed cable tray
  const t = new THREE.Group(); t.name = 'cable_tray';
  t.add(box(len * 0.94, 0.008, 0.20, M.steel, 'tray_base', 0, y - 0.1, 0));
  [-1, 1].forEach((s) => t.add(box(len * 0.94, 0.055, 0.008, M.steel, 'tray_wall', 0, y - 0.073, s * 0.1)));
  g.add(t);
  return g;
}

/* -------------------------------------------------------------- tops */

function worksurface(M, w, d, x, z, flap) {
  const g = new THREE.Group(); g.name = 'worksurface';
  g.add(box(w - 0.004, TOP_T, d - 0.004, M.top, 'top_laminate', x, H - TOP_T / 2, z));
  if (flap) {
    const fw = flap.w || 0.45;
    g.add(box(fw, 0.004, 0.105, M.dark, 'access_flap', x + flap.dx, H + 0.001, z + flap.dz));
    g.add(box(fw, 0.006, 0.008, M.steel, 'flap_hinge', x + flap.dx, H + 0.002, z + flap.dz - 0.056));
  }
  return g;
}

function screen(M, len, z, type = 'G', thick = 0.018) {
  const g = new THREE.Group(); g.name = 'screen';
  g.add(box(len, H - 0.02, thick, M.frame, 'modesty_panel', 0, (H - 0.02) / 2, z));
  if (type === 'X') return g;
  if (type === 'F') g.add(box(len, SCREEN_TOP - H - 0.02, 0.032, M.fabricScr, 'fabric_screen', 0, H + (SCREEN_TOP - H) / 2, z));
  else g.add(box(len, SCREEN_TOP - H - 0.02, 0.01, M.glass, 'glass_screen', 0, H + (SCREEN_TOP - H) / 2, z));
  const n = Math.max(2, Math.round(len / 1.2) + 1);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / (n - 1)) * i;
    g.add(box(0.035, 0.09, 0.05, M.steel, 'screen_bracket', x, H + 0.03, z));
  }
  return g;
}

/* ------------------------------------------------- 60mm panel system */
// Aluminium 60mm frame: posts at every joint, stacked 9mm tiles both faces,
// skirting raceway, desk-level raceway with sockets, fabric pin tile, top cap.
const PT = 0.06, PH = 1.2;
function panelRun(M, len, upper, name) {
  const g = new THREE.Group(); g.name = name;
  const w = len - PT;
  const tiers = [
    [0.012, 0.11, M.frame, 'raceway_skirting'],
    [0.11, 0.70, M.fascia, 'tile_laminate'],
    [0.70, 0.80, M.frame, 'raceway_desk'],
    [0.80, PH - 0.03, upper, upper === M.glass ? 'tile_glass' : 'tile_fabric_pinboard'],
  ];
  tiers.forEach(([y0, y1, mat, n]) => {
    const t = mat === M.frame ? PT - 0.004 : PT - 0.014;
    g.add(box(w, y1 - y0 - 0.008, t, mat, n, 0, (y0 + y1) / 2, 0));
    g.add(box(w, 0.008, PT - 0.006, M.frame, 'rail_aluminium', 0, y1 - 0.004, 0));
  });
  g.add(box(len, 0.03, PT, M.frame, 'top_cap', 0, PH - 0.015, 0));
  const n = Math.max(1, Math.round(w / 0.6));
  for (let i = 0; i < n; i++) [-1, 1].forEach((s) => {
    g.add(box(0.07, 0.045, 0.004, M.dark, 'socket_plate', -w / 2 + (w / n) * (i + 0.5), 0.75, s * (PT / 2)));
  });
  return g;
}
function panelPost(M, x, z, name) {
  const g = new THREE.Group(); g.name = name;
  g.add(box(PT, PH - 0.012, PT, M.frame, 'post_aluminium_60', x, (PH - 0.012) / 2 + 0.012, z));
  const lv = cyl(0.022, 0.022, 0.012, M.black, 'leveller'); lv.position.set(x, 0.006, z); g.add(lv);
  return g;
}
function panelCluster(M, cfg, seats) {
  const g = new THREE.Group(); g.name = 'panel_system_60mm';
  const shared = cfg.formation === 'sharing', U = cfg.unit || 1.2;
  const per = shared ? Math.max(1, cfg.seats / 2) : cfg.seats;
  const len = per * U, depth = shared ? DEEP * 2 : DEEP;
  const zs = shared ? 0 : -DEEP / 2;
  const upper = cfg.screen === 'G' ? M.glass : M.fabricScr;
  const sp = panelRun(M, len, upper, 'spine_panel'); sp.position.z = zs; g.add(sp);
  const zA = shared ? -DEEP : -DEEP / 2, zB = shared ? DEEP : DEEP / 2;
  for (let i = 0; i <= per; i++) {
    const x = -len / 2 + i * U;
    g.add(panelPost(M, x, zs, 'post_spine_' + i));
    const cl = depth - (shared ? 0 : 0);
    const cr = panelRun(M, (shared ? DEEP : DEEP) , upper, 'cross_panel_' + i);
    cr.rotation.y = Math.PI / 2;
    if (shared) {
      [-1, 1].forEach((s) => {
        const c = i === 0 && s < 0 ? cr : cr.clone(); c.rotation.y = Math.PI / 2;
        c.position.set(x, 0, s * DEEP / 2); g.add(c);
        g.add(panelPost(M, x, s * DEEP, 'post_end_' + i + (s < 0 ? 'a' : 'b')));
      });
    } else {
      cr.position.set(x, 0, 0); g.add(cr);
      g.add(panelPost(M, x, DEEP / 2, 'post_end_' + i));
    }
  }
  for (let i = 0; i < per; i++) {
    const x = -len / 2 + U * (i + 0.5), w = U - PT;
    const sides = shared ? [1, -1] : [1];
    sides.forEach((s) => {
      const dz = DEEP - PT / 2 - 0.004;
      const zc = shared ? s * (PT / 2 + dz / 2) : zs + PT / 2 + dz / 2;
      g.add(box(w - 0.004, TOP_T, dz, M.top, 'top_laminate', x, H - TOP_T / 2, zc));
      [-1, 1].forEach((k) => g.add(box(0.012, 0.05, dz * 0.7, M.frame, 'top_bracket', x + k * (w / 2 - 0.02), H - TOP_T - 0.025, zc)));
      seats.push({ x, z: shared ? s * DEEP / 2 : 0, dir: s });
    });
  }
  return g;
}

/* ---------------------------------------------------------- pedestal */

export function buildPedestal(M, type) {
  const g = new THREE.Group(); g.name = 'drawer_pedestal';
  const W = 0.40, D = 0.50, HT = 0.62, base = 0.065;
  g.add(box(W, HT, D, M.ped, 'pedestal_carcass', 0, base + HT / 2, 0));
  const drawers = type.drawers || 3;
  const fh = (HT - 0.03) / drawers;
  for (let i = 0; i < drawers; i++) {
    const y = base + 0.015 + fh * i + fh / 2;
    g.add(box(W - 0.02, fh - 0.008, 0.012, M.fascia, 'drawer_fascia', 0, y, D / 2 + 0.004));
    g.add(box(0.16, 0.012, 0.022, M.steel, 'drawer_handle', 0, y + fh / 2 - 0.05, D / 2 + 0.018));
  }
  if (type.cushion) g.add(box(W + 0.01, 0.05, D + 0.01, M.cushion, 'caddy_cushion', 0, base + HT + 0.025, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const c = cyl(0.028, 0.028, 0.02, M.black, 'castor', 14);
    c.rotation.z = Math.PI / 2; c.position.set(sx * (W / 2 - 0.06), 0.028, sz * (D / 2 - 0.07));
    g.add(c);
    g.add(box(0.02, 0.035, 0.02, M.black, 'castor_stem', sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.07)));
  });
  return g;
}

/* ------------------------------------------------------------- chair */

export function buildChair(M) {
  const g = new THREE.Group(); g.name = 'task_chair';
  g.add(box(0.47, 0.07, 0.46, M.fabric, 'chair_seat', 0, 0.46, 0));
  const back = box(0.44, 0.50, 0.06, M.fabric, 'chair_back', 0, 0.76, -0.22);
  back.rotation.x = -0.12; g.add(back);
  g.add(box(0.46, 0.035, 0.05, M.black, 'chair_lumbar', 0, 0.55, -0.235));
  const col = cyl(0.032, 0.038, 0.30, M.black, 'gas_column'); col.position.y = 0.30; g.add(col);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = box(0.30, 0.03, 0.05, M.black, 'base_arm', Math.cos(a) * 0.15, 0.045, Math.sin(a) * 0.15);
    arm.rotation.y = -a; g.add(arm);
    const c = cyl(0.025, 0.025, 0.018, M.black, 'chair_castor', 12);
    c.rotation.z = Math.PI / 2; c.position.set(Math.cos(a) * 0.29, 0.025, Math.sin(a) * 0.29); g.add(c);
  }
  [-1, 1].forEach((s) => {
    g.add(box(0.05, 0.20, 0.05, M.black, 'armrest_post', s * 0.26, 0.57, -0.04));
    g.add(box(0.06, 0.03, 0.22, M.black, 'armrest_pad', s * 0.26, 0.68, 0.0));
  });
  return g;
}

/* ------------------------------------------------------------ addons */

function addonGroup(M, id, seat) {
  const g = new THREE.Group(); g.name = 'addon_' + id;
  const d = seat.dir, z = seat.z, x = seat.x;
  const far = (o) => z - d * o, near = (o) => z + d * o;
  switch (id) {
    case 'arm': {
      g.add(cyl(0.03, 0.03, 0.34, M.black, 'arm_post').translateX(x).translateY(H + 0.17).translateZ(far(0.24)));
      const a = box(0.30, 0.035, 0.035, M.black, 'arm_link', x + 0.15, H + 0.32, far(0.24));
      g.add(a);
      const panel = box(0.56, 0.34, 0.02, M.black, 'monitor_shell', x, H + 0.34, far(0.20));
      panel.rotation.x = d * 0.06; g.add(panel);
      const scr = box(0.53, 0.31, 0.004, M.screenglow, 'monitor_screen', x, H + 0.34, far(0.20) + d * 0.013);
      scr.rotation.x = d * 0.06; g.add(scr);
      break;
    }
    case 'stand': {
      g.add(box(0.52, 0.085, 0.24, M.dark, 'monitor_riser', x, H + 0.045, far(0.16)));
      const panel = box(0.52, 0.32, 0.02, M.black, 'monitor_shell', x, H + 0.26, far(0.16));
      g.add(panel);
      g.add(box(0.49, 0.29, 0.004, M.screenglow, 'monitor_screen', x, H + 0.26, far(0.16) + d * 0.013));
      break;
    }
    case 'kbtray':
      g.add(box(0.56, 0.018, 0.28, M.steel, 'keyboard_tray', x, H - 0.075, near(0.13)));
      [-1, 1].forEach((s) => g.add(box(0.03, 0.05, 0.16, M.steel, 'tray_slide', x + s * 0.26, H - 0.048, near(0.13))));
      break;
    case 'cpu':
      g.add(box(0.19, 0.40, 0.44, M.steel, 'cpu_holder', x - 0.36, 0.45, far(0.12)));
      g.add(box(0.16, 0.02, 0.40, M.steel, 'cpu_tray', x - 0.36, 0.25, far(0.12)));
      break;
    case 'footrest': {
      const f = box(0.44, 0.05, 0.30, M.dark, 'footrest', x, 0.10, near(0.22));
      f.rotation.x = -d * 0.22; g.add(f);
      g.add(box(0.40, 0.06, 0.05, M.black, 'footrest_base', x, 0.03, near(0.32)));
      break;
    }
    case 'mat':
      g.add(box(0.72, 0.005, 0.34, M.dark, 'desk_mat', x, H + 0.003, near(0.09)));
      break;
    case 'light':
      g.add(cyl(0.07, 0.08, 0.018, M.black, 'lamp_base').translateX(x + 0.44).translateY(H + 0.01).translateZ(far(0.20)));
      g.add(cyl(0.014, 0.014, 0.42, M.black, 'lamp_stem').translateX(x + 0.44).translateY(H + 0.22).translateZ(far(0.20)));
      g.add(box(0.30, 0.03, 0.05, M.black, 'lamp_head', x + 0.32, H + 0.42, far(0.20)));
      break;
    case 'charger':
      g.add(cyl(0.055, 0.055, 0.012, M.black, 'wireless_charger').translateX(x + 0.30).translateY(H + 0.007).translateZ(near(0.02)));
      break;
    case 'power':
      g.add(box(0.22, 0.055, 0.14, M.dark, 'power_box', x - 0.30, H + 0.028, far(0.08)));
      [-1, 0, 1].forEach((i) => g.add(box(0.04, 0.004, 0.04, M.black, 'socket', x - 0.30 + i * 0.06, H + 0.057, far(0.08))));
      break;
    case 'grommet': {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 8, 24), M.black);
      t.name = 'cable_grommet'; t.rotation.x = Math.PI / 2; t.position.set(x + 0.16, H + 0.004, far(0.04));
      g.add(t); break;
    }
    default: break;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ------------------------------------------------------------ cluster */

export function buildCluster(cfg, M) {
  const g = new THREE.Group(); g.name = 'burosys_' + cfg.formation;
  const seats = [];
  const f = cfg.formation;

  if ((f === 'sharing' || f === 'nonsharing' || f === 'single') && cfg.system === 'panel') {
    g.add(panelCluster(M, cfg, seats));
  } else if (f === 'sharing' || f === 'nonsharing' || f === 'single') {
    const shared = f === 'sharing';
    const UNIT = cfg.unit || 1.2;
    const perSide = shared ? Math.max(1, cfg.seats / 2) : cfg.seats;
    const len = perSide * UNIT;
    const depth = shared ? DEEP * 2 : DEEP;

    const frames = [];
    for (let i = 0; i <= perSide; i++) if (i === 0 || i === perSide || i % 2 === 0) frames.push(-len / 2 + i * UNIT);
    frames.forEach((fx, i) => {
      const fr = endFrame(M, depth, 'frame_' + i);
      fr.position.x = Math.max(-len / 2 + TUBE, Math.min(len / 2 - TUBE, fx));
      g.add(fr);
    });
    g.add(spine(M, len - 0.1, H - TOP_T - 0.055));

    for (let i = 0; i < perSide; i++) {
      const x = -len / 2 + UNIT * (i + 0.5);
      if (shared) {
        g.add(worksurface(M, UNIT, DEEP, x, DEEP / 2, { dx: 0, dz: -0.16, w: Math.min(0.45, UNIT - 0.3) }));
        g.add(worksurface(M, UNIT, DEEP, x, -DEEP / 2, { dx: 0, dz: 0.16, w: Math.min(0.45, UNIT - 0.3) }));
        seats.push({ x, z: DEEP / 2, dir: 1 }, { x, z: -DEEP / 2, dir: -1 });
      } else {
        g.add(worksurface(M, UNIT, DEEP, x, 0, { dx: 0, dz: -0.19 }));
        seats.push({ x, z: 0, dir: 1 });
      }
    }
    g.add(screen(M, len, shared ? 0 : -DEEP / 2 - 0.012, cfg.screen || 'G'));
    if (cfg.addons.planter && cfg.screen !== 'X') {
      const n = Math.max(1, Math.round(perSide / 2));
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + (len / n) * (i + 0.5);
        const zz = shared ? 0 : -DEEP / 2 - 0.012;
        g.add(box(0.80, 0.15, 0.17, M.dark, 'planter_box', x, SCREEN_TOP + 0.055, zz));
        for (let k = 0; k < 5; k++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.leaf);
          s.name = 'foliage'; s.castShadow = true;
          s.position.set(x - 0.3 + k * 0.15, SCREEN_TOP + 0.15, zz + (k % 2 ? 0.03 : -0.03));
          g.add(s);
        }
      }
    }
    if (cfg.addons.sidescr) [-1, 1].forEach((s) => {
      g.add(box(0.014, 0.40, depth * 0.9, M.glass, 'side_screen', s * (len / 2), H + 0.20, 0));
    });
  }

  if (f === 'manager') {
    const W = 1.5, D = 0.75;
    g.add(worksurface(M, W, D, 0, 0, { dx: 0, dz: -0.24 }));
    [-1, 1].forEach((s, i) => { const fr = endFrame(M, D, 'frame_' + i); fr.position.x = s * (W / 2 - TUBE); g.add(fr); });
    g.add(spine(M, W - 0.1, H - TOP_T - 0.055));
    g.add(worksurface(M, 0.45, 0.90, W / 2 + 0.225, -0.10, null));
    const rf = endFrame(M, 0.45, 'return_frame'); rf.rotation.y = Math.PI / 2;
    rf.position.set(W / 2 + 0.225, 0, -0.50); g.add(rf);
    g.add(box(W, H - 0.06, 0.018, M.frame, 'modesty_panel', 0, (H - 0.06) / 2, -D / 2 + 0.02));
    seats.push({ x: 0, z: 0, dir: 1 });
  }

  if (f === 'cabin') {
    const W = cfg.W || 1.8, D = cfg.D || 0.75, SU = cfg.su || 0, type = cfg.type || 'FR';
    const resting = type === 'RST' && SU;
    g.add(worksurface(M, W, D, 0, 0, { dx: 0, dz: -D / 2 + 0.13 }));
    const fl = endFrame(M, D, 'frame_0'); fl.position.x = -W / 2 + TUBE; g.add(fl);
    if (!resting) { const fr = endFrame(M, D, 'frame_1'); fr.position.x = W / 2 - TUBE; g.add(fr); }
    g.add(spine(M, W - 0.1, H - TOP_T - 0.055));
    g.add(box(W, H - 0.06, 0.018, M.frame, 'apron_modesty', 0, (H - 0.06) / 2, -D / 2 + 0.02));
    if (SU) {
      const su = new THREE.Group(); su.name = 'side_unit';
      const n = Math.max(2, Math.round(SU / 0.45)), sw = SU / n, sd = 0.45, sh = resting ? H - TOP_T : 0.665;
      su.add(box(SU, sh - 0.09, sd, M.ped, 'side_unit_carcass', 0, 0.06 + (sh - 0.09) / 2, 0));
      for (let i = 0; i < n; i++) {
        su.add(box(sw - 0.012, sh - 0.11, 0.012, M.fascia, 'su_shutter', -SU / 2 + sw * (i + 0.5), 0.06 + (sh - 0.09) / 2, sd / 2 + 0.006));
        su.add(box(0.12, 0.012, 0.02, M.steel, 'su_handle', -SU / 2 + sw * (i + 0.5), sh - 0.1, sd / 2 + 0.02));
      }
      if (!resting) su.add(box(SU + 0.02, 0.03, sd + 0.02, M.top, 'su_top', 0, sh, 0));
      su.add(box(SU - 0.04, 0.06, sd - 0.05, M.dark, 'su_plinth', 0, 0.03, 0));
      if (resting) { su.rotation.y = -Math.PI / 2; su.position.set(W / 2 - sd / 2, 0, -D / 2 + SU / 2); }
      else su.position.set(0, 0, -D / 2 - 0.55 - sd / 2);
      g.add(su);
    }
    seats.push({ x: 0, z: 0, dir: 1 });
  }

  if (f === 'meeting') {
    const W = cfg.W || 2.4, D = cfg.D || 1.2;
    g.add(box(W - 0.004, TOP_T, D - 0.004, M.top, 'top_' + (cfg.topMat || 'laminate').toLowerCase(), 0, H - TOP_T / 2, 0));
    [-1, 1].forEach((s, i) => { const fr = endFrame(M, D, 'frame_' + i); fr.position.x = s * (W / 2 - 0.25); g.add(fr); });
    g.add(spine(M, W - 0.6, H - TOP_T - 0.055));
    const flaps = Math.max(1, Math.round(W / 1.2) - 1);
    for (let i = 0; i < flaps; i++) {
      const x = -W / 2 + (W / (flaps + 1)) * (i + 1);
      g.add(box(0.30, 0.005, 0.16, M.dark, 'access_flap', x, H + 0.001, 0));
    }
    const perSide = Math.max(2, Math.floor(W / 0.75));
    for (let i = 0; i < perSide; i++) {
      const x = -W / 2 + (W / perSide) * (i + 0.5);
      seats.push({ x, z: D / 2 + 0.05, dir: 1 }, { x, z: -D / 2 - 0.05, dir: -1 });
    }
    if (W >= 2.4) seats.push({ x: -W / 2 - 0.1, z: 0, dir: 1, end: true }, { x: W / 2 + 0.1, z: 0, dir: -1, end: true });
  }

  if (f === 'meet24' || f === 'meet36') {
    const W = f === 'meet24' ? 2.4 : 3.6, D = 1.2;
    g.add(box(W - 0.004, TOP_T, D - 0.004, M.top, 'top_laminate', 0, H - TOP_T / 2, 0));
    [-1, 1].forEach((s, i) => { const fr = endFrame(M, D, 'frame_' + i); fr.position.x = s * (W / 2 - 0.25); g.add(fr); });
    g.add(spine(M, W - 0.6, H - TOP_T - 0.055));
    const flaps = f === 'meet24' ? 2 : 3;
    for (let i = 0; i < flaps; i++) {
      const x = -W / 2 + (W / (flaps + 1)) * (i + 1);
      g.add(box(0.30, 0.005, 0.16, M.dark, 'access_flap', x, H + 0.001, 0));
    }
    const perSide = f === 'meet24' ? 2 : 4;
    for (let i = 0; i < perSide; i++) {
      const x = -W / 2 + (W / perSide) * (i + 0.5);
      seats.push({ x, z: D / 2 + 0.05, dir: 1 }, { x, z: -D / 2 - 0.05, dir: -1 });
    }
    seats.push({ x: -W / 2 - 0.1, z: 0, dir: 1 }, { x: W / 2 + 0.1, z: 0, dir: -1 });
  }

  // per-seat kit
  const isDesk = ['sharing', 'nonsharing', 'single', 'manager', 'cabin'].includes(f);
  if (isDesk) {
    seats.forEach((s, i) => {
      Object.keys(cfg.addons).forEach((k) => {
        if (cfg.addons[k] && !['planter', 'sidescr'].includes(k)) g.add(addonGroup(M, k, s));
      });
      if (cfg.pedestal && cfg.pedestal.id !== 'none') {
        const p = buildPedestal(M, cfg.pedestal);
        const side = cfg.pedSide === 'left' ? -1 : 1;
        p.position.set(s.x + side * s.dir * 0.37, 0, s.z - s.dir * 0.04);
        p.rotation.y = s.dir > 0 ? 0 : Math.PI;
        g.add(p);
      }
    });
  }
  if (cfg.chairs) seats.forEach((s) => {
    const c = buildChair(M);
    const back = isDesk ? 0.42 : 0.40;
    c.position.set(s.x, 0, s.z + s.dir * back);
    c.rotation.y = s.dir > 0 ? Math.PI : 0;
    if (s.end) {
      c.position.set(s.x + s.dir * -0.45, 0, 0); c.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    g.add(c);
  });

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, seats };
}

/* -------------------------------------------------------- dimensions */

function label(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(18,18,17,0.86)'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#F2F0EC'; x.font = '600 34px Archivo, system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(0.46, 0.115, 1); s.name = 'dim_label';
  return s;
}

export function buildDimensions(group) {
  const b = new THREE.Box3().setFromObject(group);
  const g = new THREE.Group(); g.name = 'dimensions';
  const mm = (m) => Math.round(m * 1000) + ' mm';
  const mat = new THREE.LineBasicMaterial({ color: 0xE2552B });
  const line = (a, c) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, c]), mat);
  const V = THREE.Vector3;
  const pad = 0.22;
  const z = b.max.z + pad, x = b.max.x + pad;
  g.add(line(new V(b.min.x, 0.01, z), new V(b.max.x, 0.01, z)));
  g.add(label(mm(b.max.x - b.min.x)).translateX((b.min.x + b.max.x) / 2).translateY(0.12).translateZ(z));
  g.add(line(new V(x, 0.01, b.min.z), new V(x, 0.01, b.max.z)));
  g.add(label(mm(b.max.z - b.min.z)).translateX(x).translateY(0.12).translateZ((b.min.z + b.max.z) / 2));
  g.add(line(new V(b.min.x - pad, b.min.y, z), new V(b.min.x - pad, b.max.y, z)));
  g.add(label(mm(b.max.y - b.min.y)).translateX(b.min.x - pad).translateY((b.min.y + b.max.y) / 2).translateZ(z));
  return g;
}

export { H as DESK_H, UNIT, DEEP };
