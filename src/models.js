// Loads uploaded 3D models from models/ and recolours them with the configurator finishes.
// Part names (mesh or material) decide which finish applies — see models/README.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

export const MODEL_DIR = 'models/';
const cache = new Map();

function loadRaw(file) {
  const url = MODEL_DIR + file;
  const ext = file.split('.').pop().toLowerCase();
  if (ext === 'glb' || ext === 'gltf') {
    return new GLTFLoader().loadAsync(url).then((g) => g.scene);
  }
  if (ext === 'obj') {
    const mtl = url.replace(/\.obj$/i, '.mtl');
    return new MTLLoader().loadAsync(mtl)
      .then((m) => { m.preload(); return new OBJLoader().setMaterials(m).loadAsync(url); })
      .catch(() => new OBJLoader().loadAsync(url));
  }
  return Promise.reject(new Error('Unsupported model type: ' + ext));
}

export function loadModel(file) {
  if (!cache.has(file)) cache.set(file, loadRaw(file).catch((e) => { cache.delete(file); throw e; }));
  return cache.get(file).then((src) => src.clone(true));
}

const RULES = [
  [/glass/i, 'glass'],
  [/fabric|panel_fab|pinup/i, 'fabricScr'],
  [/fascia|drawer|shutter/i, 'fascia'],
  [/pedestal|carcass|credenza|side.?unit|storage/i, 'ped'],
  [/top|worksurface|desk_?top|table_?top/i, 'top'],
  [/edge/i, 'edge'],
  [/frame|leg|beam|spine|modesty|bracket|metal/i, 'frame'],
  [/screen/i, 'glass'],
];
const keyFor = (name) => { for (const [re, k] of RULES) if (re.test(name)) return k; return null; };

// Units: models exported in mm or cm are scaled to metres; sits the model on the floor, centred.
export function prepareModel(obj, M) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      const k = keyFor(o.name) || keyFor((m && m.name) || '') || keyFor((o.parent && o.parent.name) || '');
      return k && M[k] ? M[k] : m;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  let b = new THREE.Box3().setFromObject(obj);
  const size = b.getSize(new THREE.Vector3());
  const big = Math.max(size.x, size.y, size.z);
  if (big > 100) obj.scale.multiplyScalar(0.001);
  else if (big > 12) obj.scale.multiplyScalar(0.01);
  obj.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b.min.y;
  const g = new THREE.Group(); g.name = 'uploaded_model'; g.add(obj);
  return g;
}
