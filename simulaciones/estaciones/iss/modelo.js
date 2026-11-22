// Modelo exterior de la Estación Espacial Internacional (procedural, a escala real en metros).
import * as THREE from 'three';
import { MODS, MOD, MOVES, FLIGHTS, VISIT, D } from './datos.js';
import * as T from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AX = { '+x':V(1,0,0), '-x':V(-1,0,0), '+y':V(0,1,0), '-y':V(0,-1,0), '+z':V(0,0,1), '-z':V(0,0,-1) };
// hacia dónde apunta el eje local +x de cada módulo (el extremo estrecho de los rusos queda en +x)
const DIRS = { kibo:'-z', tranquility:'-z', nauka:'-y', rassvet:'-y', cupola:'-y', beam:'-x', pma1:'-x', prichal:'-y' };
export const modDir = (m) => AX[DIRS[m.id] || ('+' + m.ax)];
// cuaternión que lleva +x local a la dirección d, con +y local hacia el cenit (o hacia adelante si d es vertical)
export function orientQ(d){
  const x = d.clone().normalize(), up = Math.abs(x.y) > .5 ? V(1,0,0) : V(0,1,0);
  const z = x.clone().cross(up).normalize(), y = z.clone().cross(x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// Puertos (punto de unión y dirección hacia afuera)
const P = (p, n) => ({ p: V(...p), n: AX[n] });
export const PORTS = {
  'unity+x':P([2.75,0,0],'+x'), 'unity-x':P([-2.75,0,0],'-x'), 'unity+y':P([0,2.28,0],'+y'), 'unity-y':P([0,-2.28,0],'-y'), 'unity+z':P([0,0,2.28],'+z'), 'unity-z':P([0,0,-2.28],'-z'),
  'destiny+x':P([11.4,0,0],'+x'),
  'harmony+x':P([18.65,0,0],'+x'), 'harmony+y':P([15.05,2.2,0],'+y'), 'harmony-y':P([15.05,-2.2,0],'-y'), 'harmony+z':P([15.05,0,2.2],'+z'), 'harmony-z':P([15.05,0,-2.2],'-z'),
  'tranquility-z':P([0,0,-9.0],'-z'), 'tranquility-y':P([0,-2.24,-6.15],'-y'), 'tranquility+x':P([2.24,0,-6.15],'+x'), 'tranquility-x':P([-2.24,0,-6.15],'-x'),
  'kibo+y':P([15.05,2.2,-6.4],'+y'), 'zvezda-x':P([-30.3,0,0],'-x'), 'zvezda-y':P([-18.45,-1.2,0],'-y'),
  'poisk+y':P([-18.45,5.35,0],'+y'), 'rassvet-y':P([-6.3,-7.6,0],'-y'),
};

// ---------- materiales ----------
let MAT = null;
function mats(){
  if (MAT) return MAT;
  const bc = [T.betaCloth(1), T.betaCloth(4, '#ecebe6'), T.betaCloth(9, '#e4e2da')];
  const sol = T.solar('us'), rosa = T.solar('rosa'), ru = T.solar('ru'), lat = T.lattice(), rad = T.radiator(), oru = T.orubox(3);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  MAT = {
    bc: bc.map(b => std({ map:b.map, normalMap:b.bump, normalScale:new THREE.Vector2(.6,.6), roughness:.82, metalness:0 })),
    ru: std({ map:T.ruBlanket(2), roughness:.85, metalness:0 }),
    ruG: std({ color:0x9aa597, roughness:.7, metalness:.1 }),
    alu: std({ color:0xc8ccd0, roughness:.38, metalness:.85 }),
    dark: std({ color:0x2a2c30, roughness:.6, metalness:.4 }),
    gold: std({ color:0xd8a64a, roughness:.32, metalness:.95 }),
    white: std({ color:0xf0f0ec, roughness:.55, metalness:.05 }),
    yellow: std({ color:0xe4c021, roughness:.5, metalness:.1 }),
    sol: std({ map:sol, roughness:.38, metalness:.55, side:THREE.DoubleSide, color:0xffffff }),
    solBack: std({ color:0x9c9a94, roughness:.7, metalness:.2, side:THREE.DoubleSide }),
    rosa: std({ map:rosa, roughness:.25, metalness:.5, side:THREE.DoubleSide }),
    ruSol: std({ map:ru, roughness:.28, metalness:.5, side:THREE.DoubleSide }),
    lat: std({ map:lat, alphaTest:.5, transparent:false, side:THREE.DoubleSide, roughness:.45, metalness:.8, color:0xffffff }),
    rad: std({ map:rad, roughness:.6, metalness:0, side:THREE.DoubleSide }),
    oru: std({ map:oru, roughness:.55, metalness:.4 }),
    blackGlass: std({ color:0x05070a, roughness:.05, metalness:.9 }),
    soyuzG: std({ color:0x7f8b6c, roughness:.85, metalness:0 }),
    soyuzS: std({ color:0xcfd2cc, roughness:.6, metalness:.2 }),
  };
  MAT.bc.forEach(m => { m.map.repeat.set(3, 1); m.normalMap.repeat.set(3, 1); });
  return MAT;
}

// ---------- piezas básicas ----------
const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
// cilindro a lo largo de +x
function cylX(r1, r2, len, m, seg = 32, open = false){
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, open); g.rotateZ(-Math.PI/2); return mesh(g, m);
}
function box(w, h, d, m){ return mesh(new THREE.BoxGeometry(w, h, d), m); }
function rail(len, ax = 'x'){ // pasamanos amarillo
  const g = new THREE.CylinderGeometry(.025, .025, len, 6); if (ax === 'x') g.rotateZ(Math.PI/2); if (ax === 'z') g.rotateX(Math.PI/2);
  return mesh(g, mats().yellow, false);
}
function cbmRing(r = 1.1){ const g = new THREE.TorusGeometry(r, .09, 8, 32); g.rotateY(Math.PI/2); return mesh(g, mats().alu); }

// Módulo estadounidense/europeo/japonés: cilindro con mantas + conos de los extremos
function usModule(m, k = 0){
  const M = mats(), g = new THREE.Group(), L = m.L, R = m.R, cone = Math.min(.8, L*.12);
  const body = cylX(R, R, L - 2*cone, M.bc[k % 3], 40); g.add(body);
  for (const s of [-1, 1]){
    const c = cylX(s > 0 ? R : R*.62, s > 0 ? R*.62 : R, cone, M.alu, 40); c.position.x = s * (L/2 - cone/2); g.add(c);
    const ring = cbmRing(R*.55); ring.position.x = s*L/2; g.add(ring);
  }
  // nervios y pasamanos
  for (let i = 0; i < 4; i++){ const a = i*Math.PI/2 + .4, h = rail(L - 2*cone - .4); h.position.set(0, Math.cos(a)*(R+.12), Math.sin(a)*(R+.12)); g.add(h); }
  const ring = new THREE.TorusGeometry(R + .01, .03, 6, 48); ring.rotateY(Math.PI/2);
  for (let x = -L/2 + cone + .9; x < L/2 - cone; x += 1.8){ const r = mesh(ring, M.alu, false); r.position.x = x; g.add(r); }
  return g;
}
function nodeModule(m, k){
  const g = usModule(m, k), M = mats();
  for (const [y, z] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const r = mesh(new THREE.TorusGeometry(.95, .09, 8, 32), M.alu); r.lookAt(0, y, z);
    r.position.set(0, y*(m.R+.05), z*(m.R+.05)); g.add(r);
    const d = mesh(new THREE.CircleGeometry(.9, 28), M.alu, false); d.position.copy(r.position).multiplyScalar(1.01); d.lookAt(d.position.clone().multiplyScalar(2)); g.add(d);
  }
  return g;
}
// Módulo ruso: cuerpo ancho + transición + sección estrecha en +x
function ruModule(m){
  const M = mats(), g = new THREE.Group(), L = m.L, R = m.R, Rn = m.Rn || R, nL = m.nLen || 0, tap = nL ? .9 : 0;
  const wide = L - nL - tap, x0 = -L/2;
  const w = cylX(R, R, wide, M.ru, 36); w.position.x = x0 + wide/2; g.add(w);
  if (nL){
    const t = cylX(R, Rn, tap, M.ru, 36); t.position.x = x0 + wide + tap/2; g.add(t);
    const n = cylX(Rn, Rn, nL, M.ru, 32); n.position.x = x0 + wide + tap + nL/2; g.add(n);
  }
  // tapas, puertos de acoplamiento (sonda/cono) y bandas verdes
  for (const s of [-1, 1]){
    const r = s > 0 ? (nL ? Rn : R) : R;
    const cap = cylX(s > 0 ? r : .6, s > 0 ? .6 : r, .5, M.ruG, 28); cap.position.x = s*(L/2 - .25); g.add(cap);
    const dock = cylX(.45, .45, .35, M.alu, 20); dock.position.x = s*(L/2 + .1); g.add(dock);
  }
  for (let i = 0; i < 3; i++){ const b = cylX(R+.02, R+.02, .25, M.ruG, 36); b.position.x = x0 + .6 + i*wide/3; g.add(b); }
  for (let i = 0; i < 2; i++){ const h = rail(wide - .6); h.position.set(x0 + wide/2, 0, (i ? -1 : 1)*(R+.12)); g.add(h); }
  // antenas Kurs y pequeños detalles
  const ant = new THREE.Mesh(new THREE.SphereGeometry(.35, 16, 8, 0, Math.PI*2, 0, Math.PI/2), M.white); ant.position.set(x0 + wide*.7, R + .1, .6); g.add(ant);
  const rod = box(.04, 1.4, .04, M.alu); rod.position.set(x0 + wide*.3, R + .7, -.5); g.add(rod);
  return g;
}
function cupolaModel(){
  const M = mats(), g = new THREE.Group();
  const base = cylX(1.48, 1.48, .5, M.bc[1], 6); base.position.x = -.5; g.add(base);
  const frus = cylX(1.48, .95, .7, M.alu, 6); frus.position.x = .1; g.add(frus);
  const top = cylX(.95, .95, .12, M.alu, 6); top.position.x = .5; g.add(top);
  const win = mesh(new THREE.CircleGeometry(.4, 32), M.blackGlass, false); win.rotation.y = Math.PI/2; win.position.x = .565; g.add(win);
  for (let i = 0; i < 6; i++){ // persianas abiertas
    const a = i*Math.PI/3 + Math.PI/6, s = box(.05, .9, .7, M.alu); s.position.set(.25, Math.cos(a)*1.55, Math.sin(a)*1.55); s.rotation.x = -a; g.add(s);
    const w = box(.02, .55, .62, M.blackGlass); w.position.set(.12, Math.cos(a)*1.2, Math.sin(a)*1.2); w.rotation.x = -a; w.rotation.z = .65*Math.sign(Math.cos(a)) * 0; g.add(w);
  }
  return g;
}
function pmaModel(){ const M = mats(), g = new THREE.Group(); const c = cylX(1.2, .95, 1.9, M.white, 24); g.add(c); const r = cbmRing(.95); r.position.x = .95; g.add(r); return g; }
function idaModel(){ const M = mats(), g = new THREE.Group(); const c = cylX(1.2, 1.2, .55, M.alu, 28); g.add(c);
  for (let i = 0; i < 3; i++){ const p = box(.4, .25, .25, M.gold); const a = i*2.09; p.position.set(.3, Math.cos(a)*1.0, Math.sin(a)*1.0); g.add(p); } return g; }
function beamModel(){ const M = mats(), g = new THREE.Group(); const c = mesh(new THREE.CapsuleGeometry(1.55, 2.4, 8, 24), M.bc[2]); c.rotation.z = Math.PI/2; g.add(c); return g; }
function sphereNode(m){ const M = mats(), g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(m.R, 32, 24), M.ru));
  for (const [y,z] of [[1,0],[-1,0],[0,1],[0,-1]]){ const d = cylX(.5, .5, .5, M.alu, 18); d.rotation.set(0,0,0); d.position.set(0, y*m.R, z*m.R); d.lookAt(0, y*9, z*9); d.rotateY(Math.PI/2); g.add(d); }
  const d = cylX(.5,.5,.5,M.alu,18); d.position.x = m.R; g.add(d); return g; }
function questModel(m){ // esclusa: equipo (ancha) + tripulación (angosta, afuera)
  const M = mats(), g = new THREE.Group();
  const eq = cylX(2.0, 2.0, 3.2, M.bc[0], 36); eq.position.x = -1.1; g.add(eq);
  const cl = cylX(1.0, 1.0, 2.0, M.bc[1], 28); cl.position.x = 1.55; g.add(cl);
  const t = cylX(2.0, 1.0, .5, M.alu, 36); t.position.x = .7; g.add(t);
  const hatch = mesh(new THREE.CircleGeometry(.5, 24), M.alu); hatch.rotation.y = Math.PI/2; hatch.position.x = 2.56; g.add(hatch);
  for (let i = 0; i < 4; i++){ const tk = mesh(new THREE.SphereGeometry(.45, 16, 12), M.white); tk.position.set(-1.5 + (i%2)*1.1, 2.2, i < 2 ? .9 : -.9); g.add(tk); } // tanques de O₂/N₂
  return g;
}
function bishopModel(){ const M = mats(), g = new THREE.Group(); const c = cylX(1.0, .55, 1.8, M.white, 28); g.add(c); const cap = cylX(1.0,1.0,.15,M.alu,28); cap.position.x = -.9; g.add(cap); return g; }

export function buildModule(m, k = 0){
  if (m.id === 'quest') return questModel(m);
  if (m.tipo === 'nodo') return nodeModule(m, k);
  if (m.tipo === 'us') return usModule(m, k);
  if (m.tipo === 'ru') return ruModule(m);
  if (m.tipo === 'cupula') return cupolaModel();
  if (m.tipo === 'tunel') return pmaModel();
  if (m.tipo === 'inflable') return beamModel();
  if (m.tipo === 'esfera') return sphereNode(m);
  return usModule(m, k);
}

// ---------- armazón, alas solares y radiadores ----------
const TY = 4.75, TX = 7.0;            // eje de la armazón: encima de Destiny
export const TRUSS_Y = TY, TRUSS_X = TX;
// tramos: [id, z0, z1]
const SEGS = { s0:[-6.7,6.7], s1:[6.7,21.7], p1:[-21.7,-6.7], s3s4:[21.7,35.5], p3p4:[-35.5,-21.7], s5:[35.5,38.9], p5:[-38.9,-35.5], s6:[38.9,52.8], p6:[-52.8,-38.9] };
function trussSeg(z0, z1, tri = false){
  const M = mats(), g = new THREE.Group(), L = z1 - z0, h = 4.2, w = 3.9;
  // caras de celosía
  const latM = M.lat.clone(); latM.map = M.lat.map.clone(); latM.map.repeat.set(Math.max(1, Math.round(L/3.6)), 1); latM.map.needsUpdate = true;
  for (const [x, y, ry, rx, W] of [[w/2,0,Math.PI/2,0,h],[-w/2,0,Math.PI/2,0,h],[0,h/2,0,Math.PI/2,w],[0,-h/2,0,Math.PI/2,w]]){
    const f = mesh(new THREE.PlaneGeometry(L, W), latM); f.rotation.set(rx, ry, 0); if (rx) f.rotation.set(Math.PI/2, 0, Math.PI/2);
    f.position.set(x, y, (z0+z1)/2); g.add(f);
  }
  // largueros de las esquinas
  for (const [x, y] of [[w/2,h/2],[-w/2,h/2],[w/2,-h/2],[-w/2,-h/2]]){
    const r = mesh(new THREE.BoxGeometry(.18, .18, L), M.alu); r.position.set(x, y, (z0+z1)/2); g.add(r);
  }
  // cajas de electrónica y cableado adentro y en las caras
  const rr = T.rng(Math.abs(z0*13|0) + 5);
  for (let z = z0 + 1.2; z < z1 - 1; z += 1.6 + rr()*1.2){
    const b = box(.9 + rr()*1.2, .6 + rr()*.8, .9 + rr()*.8, rr() < .5 ? M.oru : M.white);
    b.position.set((rr()-.5)*w*.5, (rr() < .5 ? -1 : 1)*(h/2 - .5), z); g.add(b);
  }
  // rieles del carro móvil (cara delantera)
  for (const y of [-1.2, 1.2]){ const rl = box(.12,.12,L, M.alu); rl.position.set(w/2 + .15, y, (z0+z1)/2); g.add(rl); }
  g.position.set(TX, TY, 0);
  return g;
}
// Ala solar (SAW): 2 mantas de 34 × 4,6 m con el mástil al medio; se extiende en +x local
function solarWing(len = 34, irosa = null){
  const M = mats(), g = new THREE.Group(), bw = 4.6, gap = 1.0;
  const can = box(1.6, .6, 1.6, M.white); can.position.x = .8; g.add(can);
  for (const s of [-1, 1]){
    const p = mesh(new THREE.PlaneGeometry(len, bw), M.sol); p.rotation.x = -Math.PI/2; p.position.set(1.6 + len/2, 0, s*(gap/2 + bw/2)); g.add(p);
  }
  const mast = mesh(new THREE.CylinderGeometry(.18, .18, len, 6), M.alu); mast.rotation.z = Math.PI/2; mast.position.x = 1.6 + len/2; g.add(mast);
  const tip = box(.4, .2, bw*2 + gap, M.white); tip.position.x = 1.6 + len; g.add(tip);
  const ir = new THREE.Group(); ir.name = 'iROSA';
  const pr = mesh(new THREE.PlaneGeometry(18.3, 6.0), M.rosa); pr.rotation.x = -Math.PI/2; pr.position.set(2.4 + 18.3/2, -.9, 0); ir.add(pr);
  const mk = box(1.0, 1.0, 6.2, M.alu); mk.position.set(2.2, -.5, 0); ir.add(mk);
  for (const s of [-1,1]){ const boom = mesh(new THREE.CylinderGeometry(.08,.08,18.3,6), M.alu); boom.rotation.z = Math.PI/2; boom.position.set(2.4+18.3/2, -.92, s*3.05); ir.add(boom); }
  ir.rotation.z = -.07; ir.visible = false; g.add(ir); g.userData.irosa = ir;
  return g;
}
// Módulo fotovoltaico: caja IEA + dos alas (una hacia +x, otra hacia −x) en una junta que gira
function pvm(zc, chans){
  const M = mats(), g = new THREE.Group();
  const iea = box(3.6, 3.6, 9, M.oru); g.add(iea);
  const rad = mesh(new THREE.PlaneGeometry(13.6, 3.1), M.rad); rad.position.set(0, 3.6/2 + 6.8, 0); rad.rotation.set(0, Math.PI/2, Math.PI/2); g.add(rad);
  const wings = [];
  chans.forEach((ch, i) => {
    const s = i ? -1 : 1, bga = new THREE.Group(); bga.position.set(s*1.8, 0, s*3.2); bga.rotation.y = i ? Math.PI : 0;
    const w = solarWing(); bga.add(w); g.add(bga); wings.push({ ch, bga, wing:w });
  });
  g.position.set(0, 0, zc);
  return { g, wings };
}

// ---------- brazos robóticos ----------
function arm(seg = 7.1, pose = [.5, -1.1, .9]){
  const M = mats(), g = new THREE.Group();
  const j = () => mesh(new THREE.CylinderGeometry(.33, .33, .9, 16), M.white);
  const boom = (l) => { const b = mesh(new THREE.CylinderGeometry(.18, .18, l, 16), M.white); b.position.y = l/2; return b; };
  const s0 = new THREE.Group(); s0.add(j()); g.add(s0);
  const a1 = new THREE.Group(); a1.position.y = .45; a1.rotation.z = pose[0]; s0.add(a1); a1.add(boom(seg));
  const el = new THREE.Group(); el.position.y = seg; el.rotation.z = pose[1]; a1.add(el); el.add(j()); el.add(boom(seg));
  const wr = new THREE.Group(); wr.position.y = seg; wr.rotation.z = pose[2]; el.add(wr); wr.add(j());
  const ee = mesh(new THREE.CylinderGeometry(.3, .3, .9, 16), M.dark); ee.position.y = .7; wr.add(ee);
  for (const b of [a1, el]){ const band = mesh(new THREE.CylinderGeometry(.19,.19,.3,16), M.dark); band.position.y = seg*.15; b.add(band); }
  return g;
}

// ---------- naves visitantes ----------
export function buildVehicle(tipo, folded = false){
  const M = mats(), g = new THREE.Group();
  if (tipo === 'dragon' || tipo === 'dragonc'){
    // eje +x: desde el puerto hacia afuera. Nariz abierta, cápsula y baúl
    const nose = box(.5, .2, 1.2, M.white); nose.position.set(.3, 1.0, 0); nose.rotation.z = -.8; g.add(nose);
    const dk = cylX(.6, .6, .35, M.alu, 20); dk.position.x = .18; g.add(dk);
    const cap = cylX(1.0, 1.85, 2.4, M.white, 40); cap.position.x = .35 + 1.2; g.add(cap);
    const heat = cylX(1.85, 1.85, .25, M.dark, 40); heat.position.x = 2.9; g.add(heat);
    if (tipo === 'dragon') for (let i = 0; i < 4; i++){ const a = i*Math.PI/2 + .5, w = box(.05, .3, .3, M.blackGlass); w.position.set(1.5, Math.cos(a)*1.38, Math.sin(a)*1.38); w.lookAt(1.5, Math.cos(a)*9, Math.sin(a)*9); g.add(w); }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 2.8, 40, 1, false), [M.white]);
    trunk.geometry.rotateZ(-Math.PI/2); trunk.position.x = 4.45; trunk.castShadow = true; g.add(trunk);
    const cells = mesh(new THREE.CylinderGeometry(1.87, 1.87, 2.6, 40, 1, true, 0, Math.PI), M.rosa); cells.geometry.rotateZ(-Math.PI/2); cells.position.x = 4.45; g.add(cells);
    for (let i = 0; i < 4; i++){ const f = box(1.0, .05, .9, M.white); const a = i*Math.PI/2 + Math.PI/4; f.position.set(5.6, Math.cos(a)*2.1, Math.sin(a)*2.1); f.rotation.x = a; g.add(f); }
  } else if (tipo === 'soyuz' || tipo === 'progress'){
    const om = tipo === 'soyuz' ? mesh(new THREE.SphereGeometry(1.15, 28, 20), M.soyuzG) : cylX(1.1, 1.1, 2.6, M.soyuzG, 28);
    om.position.x = tipo === 'soyuz' ? 1.35 : 1.6; if (tipo === 'soyuz') om.scale.x = 1.15; g.add(om);
    const pr = cylX(.3, .3, .5, M.alu, 12); pr.position.x = .2; g.add(pr);
    const dm = tipo === 'soyuz' ? cylX(1.1, 1.1, 2.1, M.soyuzG, 32) : cylX(1.1, 1.1, 1.4, M.soyuzG, 32);
    if (tipo === 'soyuz'){ dm.geometry = new THREE.CylinderGeometry(1.1, 1.0, 2.1, 32); dm.geometry.rotateZ(-Math.PI/2); }
    dm.position.x = tipo === 'soyuz' ? 3.5 : 3.6; g.add(dm);
    const sm = cylX(1.36, 1.36, 2.3, M.soyuzS, 32); sm.position.x = 5.7; g.add(sm);
    const band = cylX(1.38,1.38,.4,M.soyuzG,32); band.position.x = 5.0; g.add(band);
    if (!folded) for (const s of [-1, 1]){
      const arr = mesh(new THREE.PlaneGeometry(1.4, 4.2), M.ruSol); arr.position.set(5.6, 0, s*(1.36 + 2.2)); arr.rotation.x = -Math.PI/2; g.add(arr);
    }
    const ant = box(.03, .03, 2.4, M.alu); ant.position.set(1.6, 1.3, 0); g.add(ant);
  }
  return g;
}

// ---------- estación completa ----------
// Devuelve { root, parts, setDate(ms), track(sunDirLocal), info } — todas las piezas, visibles según la fecha
export function buildStation(){
  const M = mats(), root = new THREE.Group(), parts = new Map();
  const add = (id, obj) => { obj.name = id; obj.userData.id = id; root.add(obj); parts.set(id, obj); return obj; };
  const place = (obj, port, L) => { const p = PORTS[port]; obj.position.copy(p.p).addScaledVector(p.n, L/2 + .03); obj.quaternion.copy(orientQ(p.n)); };
  // módulos
  MODS.forEach((m, i) => {
    const o = buildModule(m, i); o.position.set(...m.c); o.quaternion.copy(orientQ(modDir(m)));
    o.userData.home = { p:o.position.clone(), q:o.quaternion.clone() }; add(m.id, o);
  });
  // Pirs (2001–2021) donde hoy está Naúka
  const pirs = buildModule({ id:'pirs', tipo:'ru', L:4.9, R:1.28 }); place(pirs, 'zvezda-y', 4.9); add('pirs', pirs);
  // adaptadores, IDA, Bishop
  const pma2 = pmaModel(), pma3 = pmaModel(); add('pma2', pma2); add('pma3', pma3);
  const ida2 = idaModel(), ida3 = idaModel(); add('ida2', ida2); add('ida3', ida3);
  place(pma2, 'harmony+x', 1.9); place(pma3, 'harmony+y', 1.9);
  ida2.position.copy(PORTS['harmony+x'].p).addScaledVector(V(1,0,0), 2.2); ida2.quaternion.copy(pma2.quaternion);
  ida3.position.copy(PORTS['harmony+y'].p).addScaledVector(V(0,1,0), 2.2); ida3.quaternion.copy(pma3.quaternion);
  const bishop = bishopModel(); place(bishop, 'tranquility-z', 1.8); add('bishop', bishop);
  // Z1 encima de Unity, con los giroscopios
  const z1 = new THREE.Group(); const zb = box(3.2, 2.8, 3.2, M.oru); zb.position.y = 2.28 + 1.4; z1.add(zb);
  for (let i = 0; i < 4; i++){ const d = mesh(new THREE.SphereGeometry(.55, 16, 10, 0, Math.PI*2, 0, Math.PI/2), M.white); d.position.set(i%2 ? .8 : -.8, 5.08, i<2 ? .8 : -.8); z1.add(d); }
  const zant = box(.1, 2.4, .1, M.alu); zant.position.set(1.2, 6.2, 1.2); z1.add(zant);
  const dish = mesh(new THREE.SphereGeometry(.9, 20, 8, 0, Math.PI*2, 0, Math.PI*.3), M.white); dish.position.set(1.2, 7.4, 1.2); dish.rotation.x = Math.PI; z1.add(dish);
  add('z1', z1);
  // soporte de la armazón sobre Destiny
  const s0 = trussSeg(...SEGS.s0); s0.add((() => { const b = box(2.2, 1.2, 2.2, M.alu); b.position.set(0, -2.6, 0); return b; })()); add('s0', s0);
  for (const id of ['s1','p1','s5','p5']) add(id, trussSeg(...SEGS[id]));
  // radiadores grandes en S1 y P1 (3 por lado), apuntando hacia atrás y abajo
  for (const side of ['s1','p1']){
    const seg = parts.get(side), sg = side === 's1' ? 1 : -1;
    for (let i = 0; i < 3; i++){
      const r = new THREE.Group(); r.position.set(-2.1, -1.8, sg*(9.4 + i*4.6) - 0); r.rotation.z = -2.2;
      const pnl = mesh(new THREE.PlaneGeometry(23.3, 3.4), M.rad); pnl.position.x = 11.8; pnl.rotation.x = Math.PI/2; r.add(pnl);
      const hub = box(.8, .8, 3.5, M.alu); r.add(hub); seg.add(r);
    }
  }
  // alas solares: P6 y S6 afuera, P4 y S4 en los tramos con junta SARJ
  const wings = [];
  const mkPV = (id, zc, chans, seg) => { const pv = pvm(zc - (seg ? 0 : 0), chans); seg.add(pv.g); pv.g.position.set(0, 0, zc); wings.push(...pv.wings.map(w => ({ ...w, seg:id }))); return pv; };
  const s34 = trussSeg(...SEGS.s3s4); add('s3s4', s34);
  const sarjS = new THREE.Group(); sarjS.position.set(0,0,0); s34.add(sarjS); s34.userData.sarj = sarjS;
  const jS = cylX(2.3, 2.3, 1.2, M.alu, 32); jS.rotation.y = Math.PI/2; jS.position.z = 25.6; s34.add(jS);
  mkPV('s3s4', 30.8, ['1A','3A'], sarjS);
  const p34 = trussSeg(...SEGS.p3p4); add('p3p4', p34);
  const sarjP = new THREE.Group(); p34.add(sarjP); p34.userData.sarj = sarjP;
  const jP = jS.clone(); jP.position.z = -25.6; p34.add(jP);
  mkPV('p3p4', -30.8, ['2A','4A'], sarjP);
  const s6 = trussSeg(...SEGS.s6); add('s6', s6); const sarj6 = new THREE.Group(); s6.add(sarj6); s6.userData.sarj = sarj6; mkPV('s6', 46.2, ['1B','3B'], sarj6);
  // P6: grupo con origen en su extremo interior, para poder montarlo encima de Z1 (2000–2007)
  const p6 = new THREE.Group(), p6in = trussSeg(...SEGS.p6); p6in.position.set(0, 0, 38.9); p6.add(p6in);
  const sarj6p = new THREE.Group(); p6in.add(sarj6p); p6.userData.sarj = sarj6p; mkPV('p6', -46.2, ['2B','4B'], sarj6p);
  p6.position.set(TX, TY, -38.9); add('p6', p6);
  // Canadarm2 sobre su base móvil
  const mbs = new THREE.Group(); const mb = box(1.6, 2.6, 3.0, M.oru); mb.position.set(TX + 2.9, TY, 4.0); mbs.add(mb); add('mbs', mbs);
  const c2 = arm(7.1, [.55, -1.35, 1.1]); c2.position.set(TX + 3.9, TY + .4, 4.0); c2.rotation.set(0, 0, -1.2); add('canadarm2', c2);
  const dex = new THREE.Group(); const db = box(1.2, 3.0, 1.2, M.white); dex.add(db);
  for (const s of [-1, 1]){ const a = arm(1.6, [s*.6, -s*.9, .4]); a.scale.setScalar(.55); a.position.set(0, .9, s*.8); a.rotation.x = s*1.4; dex.add(a); }
  dex.position.set(TX + 3.1, TY - .5, 7.6); add('dextre', dex);
  // Kibō: plataforma exterior y brazo japonés
  const jef = new THREE.Group(); const jp = box(5.0, .8, 5.6, M.white); jp.position.set(15.05, -1.0, -16.4); jef.add(jp);
  const jr = T.rng(41); for (let i = 0; i < 6; i++){ const b = box(1.4, .8 + jr()*.8, 1.6, jr() < .5 ? M.oru : M.gold); b.position.set(15.05 + (i%2 ? 1.2 : -1.2), -.2 + .4, -14.6 - Math.floor(i/2)*1.9); jef.add(b); }
  add('jef', jef);
  const jarm = arm(4.9, [.9, -1.6, 1.2]); jarm.position.set(15.05, 2.3, -11.8); jarm.rotation.set(-1.4, 0, 0); jarm.scale.setScalar(.8); add('jemrms', jarm);
  // AMS‑02 y plataformas de repuestos (ELC)
  const ams = new THREE.Group(); const ar = mesh(new THREE.TorusGeometry(1.4, .45, 12, 24), M.alu); ar.rotation.x = Math.PI/2; ams.add(ar);
  const ab = box(3.6, 1.6, 3.6, M.oru); ab.position.y = 1.1; ams.add(ab); const ad = box(3.0, .9, 3.0, M.gold); ad.position.y = -.8; ams.add(ad);
  ams.position.set(TX, TY + 3.3, 23.2); add('ams', ams);
  const elc = (x, y, z) => { const e = new THREE.Group(); const b = box(3.8, .4, 4.2, M.alu); e.add(b); const r = T.rng(z*7|0);
    for (let i = 0; i < 5; i++){ const k = box(.8 + r()*1.2, .5 + r()*.9, .8 + r(), r() < .5 ? M.white : M.oru); k.position.set((r()-.5)*2.4, .5, (r()-.5)*2.8); e.add(k); }
    e.position.set(x, y, z); return e; };
  parts.get('s3s4').add(elc(0, -2.75, 23.6)); parts.get('p3p4').add(elc(0, 2.75, -23.6)); parts.get('p3p4').add(elc(0, -2.75, -23.6));
  // Zvezdá: dos alas azules
  const zv = parts.get('zvezda');
  for (const s of [-1, 1]){ const w = new THREE.Group(); const p = mesh(new THREE.PlaneGeometry(3.3, 12.4), M.ruSol); p.rotation.x = -Math.PI/2; p.position.z = s*(2.2 + 6.4); w.add(p);
    const mast = box(.1,.1,12.4,M.alu); mast.position.z = s*(2.2+6.4); w.add(mast); w.position.x = -3.6; zv.add(w); zv.userData.arrays = (zv.userData.arrays || []).concat(w); }
  // Zariá: alas plegadas (se recogieron al instalar las de la armazón)
  const za = parts.get('zarya'); for (const s of [-1, 1]){ const p = box(2.0, .4, 1.4, M.ruSol); p.position.set(-2.5, 0, s*2.6); za.add(p); }
  // Brazo europeo ERA en Naúka
  const era = arm(5.0, [.6, -1.5, 1.0]); era.position.set(-18.45 + 2.3, -9.5, 0); era.rotation.set(0, 0, -1.6); era.scale.setScalar(.85); add('era', era);
  // iROSA: se encienden por canal según la fecha
  const iro = {}; for (const w of wings){ iro['iro' + w.ch] = w.wing.userData.irosa; }
  for (const k in iro) parts.set(k, iro[k]);
  // naves visitantes actuales
  for (const v of VISIT){
    const o = buildVehicle(v.tipo), p = PORTS[v.port], off = v.port.startsWith('harmony') ? 2.6 : .05;
    o.position.copy(p.p).addScaledVector(p.n, off); o.quaternion.copy(orientQ(p.n)); add(v.id, o); o.userData.visit = v;
  }

  // ---------- fechas ----------
  const addDate = {}, remDate = {};
  for (const f of FLIGHTS){ for (const id of f.add) addDate[id] = D(f.d) + 864e5*2; for (const id of (f.rem || [])) remDate[id] = D(f.d) + 864e5*6; }
  addDate.pirs ??= D('2001-09-17'); remDate.pirs = D('2021-07-26');
  addDate.jemrms = addDate.kibo; addDate.ida2 = D('2016-08-19'); addDate.ida3 = D('2019-08-21');
  addDate.nauka = D('2021-07-29'); addDate.era = D('2021-07-29');
  const VIS_FROM = D('2026-10-16');
  const setDate = (t) => {
    for (const [id, o] of parts){
      if (id.startsWith('v-')){ o.visible = t >= VIS_FROM; continue; }
      const a = addDate[id]; if (a === undefined) continue;
      o.visible = t >= a && !(remDate[id] && t >= remDate[id]);
    }
    // elementos que cambiaron de lugar
    for (const id in MOVES){
      const o = parts.get(id); if (!o) continue; let at = null;
      for (const [d, where] of MOVES[id]) if (t >= D(d)) at = where;
      if (!at) continue;
      if (id === 'p6'){
        if (at === 'z1'){ // encima de Z1, con las alas hacia babor y estribor
          o.position.set(0, 5.15, 0); o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0,0,1), V(-1,0,0), V(0,-1,0)));
          // el tramo va de z=−13.9..0 en local: lo giramos para que suba
        } else { o.position.set(TX, TY, -38.9); o.quaternion.identity(); }
        continue;
      }
      const m = MOD[id], L = m ? m.L : 1.9, p = PORTS[at];
      if (p && !(m && at === m.id)){
        const home = o.userData.home;
        const final = home && home.p.distanceTo(p.p.clone().addScaledVector(p.n, L/2 + .03)) < .6;
        if (final && home){ o.position.copy(home.p); o.quaternion.copy(home.q); }
        else { o.position.copy(p.p).addScaledVector(p.n, L/2 + .03); o.quaternion.copy(orientQ(p.n)); }
      }
    }
    // los IDA siguen a sus PMA
    const p2 = parts.get('pma2'), p3 = parts.get('pma3');
    const dir2 = V(1,0,0).applyQuaternion(p2.quaternion), dir3 = V(1,0,0).applyQuaternion(p3.quaternion);
    parts.get('ida2').position.copy(p2.position).addScaledVector(dir2, 1.25); parts.get('ida2').quaternion.copy(p2.quaternion);
    parts.get('ida3').position.copy(p3.position).addScaledVector(dir3, 1.25); parts.get('ida3').quaternion.copy(p3.quaternion);
    // canadarm2 antes de la base móvil: sobre Destiny
    const c2 = parts.get('canadarm2');
    if (t < addDate.mbs){ c2.position.set(9.0, 2.3, 1.6); c2.rotation.set(-.4, 0, -.6); } else { c2.position.set(TX + 3.9, TY + .4, 4.0); c2.rotation.set(0, 0, -1.2); }
  };
  // ---------- seguir al Sol ----------
  const sunL = V(0, 1, 0);
  const track = (sun) => { // sun: dirección al Sol en ejes de la estación
    sunL.copy(sun).normalize();
    const th = Math.atan2(sunL.x, -sunL.y), beta = Math.atan2(sunL.z, Math.hypot(sunL.x, sunL.y));
    for (const id of ['s3s4','p3p4','s6','p6']){ const g = parts.get(id).userData.sarj; if (g) g.rotation.z = th; }
    for (const w of wings) w.wing.rotation.x = (w.bga.rotation.y ? 1 : -1) * beta * .9;
  };
  // en P6 montado sobre Z1 la junta no existía: mismo cálculo sirve como aproximación visual
  return { root, parts, setDate, track, wings, addDate };
}
