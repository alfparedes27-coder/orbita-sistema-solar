// Lanzamiento de cada pieza de la ISS desde su cohete original, y su llegada a la estación.
// Cohetes procedurales a escala: Protón‑K/M, Transbordador espacial, Soyuz‑U / Soyuz‑2.1b y Falcon 9 con Dragon.
import * as THREE from 'three';
import { MOD, PADS, D } from './datos.js';
import { buildModule, buildVehicle, PORTS, orientQ } from './modelo.js';
import { makeSky, MESH_TO_ECEF } from './orbita.js';
import { rng, canvas, tex, grain } from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RE = 6378.137;
const std = (o) => new THREE.MeshStandardMaterial(o);
let MT = null;
function mats(){
  if (MT) return MT;
  const foam = (() => { const [c, g] = canvas(256, 512), r = rng(5); g.fillStyle = '#c0712f'; g.fillRect(0,0,256,512);
    for (let i = 0; i < 900; i++){ const k = (r()-.5)*40; g.fillStyle = `rgba(${150+k},${80+k*.6},${30},.35)`; g.fillRect(r()*256, r()*512, 3 + r()*14, 2 + r()*8); }
    g.fillStyle = 'rgba(90,50,20,.5)'; for (let j = 0; j < 512; j += 64) g.fillRect(0, j, 256, 2); grain(g, 256, 512, 14, 2); return tex(c, { rep:[3, 1] }); })();
  MT = {
    white: std({ color:0xf1f1ec, roughness:.55, metalness:.05 }), grey: std({ color:0xc6c8c2, roughness:.45, metalness:.35 }), silver: std({ color:0xd5d8db, roughness:.3, metalness:.75 }),
    dark: std({ color:0x26282b, roughness:.5, metalness:.5 }), black: std({ color:0x111214, roughness:.6, metalness:.2 }), bell: std({ color:0x3a3634, roughness:.35, metalness:.9 }),
    copper: std({ color:0x9a5a32, roughness:.35, metalness:.9 }), foam: std({ map:foam, roughness:.85 }), band: std({ color:0x5e6460, roughness:.5, metalness:.3 }),
    orbiter: std({ vertexColors:true, roughness:.6, metalness:.05 }), glass: std({ color:0x0a0c10, roughness:.05, metalness:.9 }),
    concrete: std({ color:0x9a9890, roughness:.95 }), steel: std({ color:0x8a3a2a, roughness:.7, metalness:.4 }), steelG: std({ color:0x9aa0a4, roughness:.6, metalness:.6 }),
  };
  return MT;
}
const M = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
const cyl = (r1, r2, h, m, seg = 40, open = false) => M(new THREE.CylinderGeometry(r2, r1, h, seg, 1, open), m); // r1 abajo, r2 arriba
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
function ogive(r, h, m, base = 0){ const pts = []; for (let i = 0; i <= 16; i++){ const t = i/16; pts.push(new THREE.Vector2(r*Math.sqrt(1 - t*t*.98) + .001, base + h*t)); } return M(new THREE.LatheGeometry(pts, 40), m); }
function bell(rt, rb, h, m = mats().bell){ const b = M(new THREE.CylinderGeometry(rt, rb, h, 24, 1, true), m); b.material.side = THREE.DoubleSide; return b; }
// colorea por normal: panza negra (losetas) y lomo blanco
function twoTone(geo, threshold = -.25){
  geo.computeVertexNormals(); const n = geo.attributes.normal, c = new Float32Array(n.count*3);
  for (let i = 0; i < n.count; i++){ const k = n.getZ(i) < threshold ? .06 : .92; c[i*3] = k; c[i*3+1] = k; c[i*3+2] = k*.98; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}

// ---------- orbitador (nariz en +y, lomo en +z, panza en −z) ----------
export function buildOrbiter(openBay = false){
  const T = mats(), g = new THREE.Group();
  const fus = new THREE.CylinderGeometry(2.6, 2.6, 22, 32); fus.scale(1, 1, .95); fus.translate(0, -3, 0); g.add(M(twoTone(fus), T.orbiter));
  const nose = new THREE.SphereGeometry(2.6, 32, 20, 0, Math.PI*2, 0, Math.PI/2); nose.scale(1, 2.9, .95); nose.translate(0, 8, 0); g.add(M(twoTone(nose), T.orbiter));
  const cab = new THREE.SphereGeometry(1.6, 20, 12); cab.scale(1, 1.6, .7); cab.translate(0, 9.2, 1.7); g.add(M(twoTone(cab), T.orbiter));
  for (let i = -2; i <= 2; i++){ const w = M(new THREE.BoxGeometry(.5, .6, .1), T.glass); w.position.set(i*.55, 11.2, 2.45 - Math.abs(i)*.12); w.rotation.x = -.7; g.add(w); }
  // alas en delta doble
  const wing = new THREE.Shape(); wing.moveTo(2.2, 6.5); wing.lineTo(5.0, -1.5); wing.lineTo(11.9, -10.8); wing.lineTo(11.9, -13.6); wing.lineTo(2.2, -13.6); wing.closePath();
  for (const s of [-1, 1]){ const wg = new THREE.ExtrudeGeometry(wing, { depth:.7, bevelEnabled:true, bevelSize:.15, bevelThickness:.15, bevelSegments:1 }); wg.translate(0, 0, -2.2); if (s < 0) wg.scale(-1, 1, 1); g.add(M(twoTone(wg, -.5), T.orbiter)); }
  // timón y cajas de los motores OMS
  const tail = new THREE.Shape(); tail.moveTo(-14.2, 2.2); tail.lineTo(-7.5, 2.2); tail.lineTo(-13.0, 10.8); tail.lineTo(-15.6, 10.8); tail.closePath();
  // la forma del timón está en (y, z) del orbitador: se reordenan los ejes
  const tg = new THREE.ExtrudeGeometry(tail, { depth:.5, bevelEnabled:false }), tpos = tg.attributes.position;
  for (let i = 0; i < tpos.count; i++){ const x = tpos.getX(i), y = tpos.getY(i), z = tpos.getZ(i); tpos.setXYZ(i, z - .25, x, y); } tg.computeVertexNormals(); g.add(M(tg, T.white));
  for (const s of [-1, 1]){ const oms = M(new THREE.CapsuleGeometry(1.0, 4.2, 6, 16), T.white); oms.position.set(s*1.9, -12.2, 2.0); g.add(oms);
    const ob = bell(.18, .45, 1.1); ob.position.set(s*1.9, -15.2, 2.0); g.add(ob); }
  for (const [x, z] of [[0, 1.3], [-1.35, -.8], [1.35, -.8]]){ const b = bell(.55, 1.15, 3.1); b.position.set(x, -15.6, z); g.add(b); }
  const flap = M(new THREE.BoxGeometry(5.0, 1.6, .4), T.black); flap.position.set(0, -14.6, -2.0); g.add(flap);
  // compuertas de la bodega
  const doorM = std({ color:0xf0f0eb, roughness:.5, side:THREE.DoubleSide });
  for (const s of [-1, 1]){ const hinge = new THREE.Group(); hinge.position.set(s*2.62, -3.6, 0);
    const dg = new THREE.CylinderGeometry(2.62, 2.62, 18.3, 24, 1, true, s > 0 ? 0 : -Math.PI/2, Math.PI/2); dg.translate(-s*2.62, 0, 0); hinge.add(M(dg, doorM));
    if (openBay) hinge.rotation.y = s*2.75;
    g.add(hinge); }
  if (openBay){ const bay = M(new THREE.BoxGeometry(4.4, 18.2, .1), std({ color:0xe9e9e4, roughness:.6 })); bay.position.set(0, -3.6, .2); g.add(bay); }
  if (openBay){ const ods = M(new THREE.CylinderGeometry(.8, .8, 1.6, 20), T.grey); ods.rotation.x = Math.PI/2; ods.position.set(0, 3.5, 2.8); g.add(ods); g.userData.ods = V(0, 3.5, 3.6); }
  return g;
}

// ---------- cohetes (+y hacia arriba, base en y = 0) ----------
// devuelve { g, parts:[{o, drop, kick, spin}], burns:[{o (pluma), t0, t1, r, len, kind}], payload, fairing }
function plumeMat(kind){
  const col = kind === 'srb' ? [1,.82,.5] : kind === 'h2' ? [.65,.75,1] : kind === 'ker' ? [1,.62,.28] : [1,.7,.4];
  return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    uniforms:{ t:{value:0}, k:{value:1}, col:{value:new THREE.Vector3(...col)}, op:{value:kind === 'h2' ? .55 : 1} },
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:`uniform float t, k, op; uniform vec3 col; varying vec2 vUv;
      void main(){ float a = 1. - vUv.y; float core = pow(a, 1.6); float edge = sin(vUv.x*6.2832*3. + t*40.)*.04 + sin(t*31. + vUv.y*30.)*.05;
        float f = smoothstep(0., .25, vUv.y) * (core + edge); vec3 c = mix(col, vec3(1.,.98,.9), pow(a, 6.));
        gl_FragColor = vec4(c * (1.4 + k*.5), clamp(f*op*k, 0., 1.)); }` });
}
function addBurn(R, parent, x, y, z, r, len, kind, t0, t1){
  const geo = new THREE.CylinderGeometry(r, r*2.2, len, 20, 1, true); geo.translate(0, -len/2, 0);
  const p = new THREE.Mesh(geo, plumeMat(kind)); p.position.set(x, y, z); p.renderOrder = 5; parent.add(p);
  R.burns.push({ o:p, t0, t1, r, len, kind }); return p;
}
function protonRocket(M_, payloadId, isM){
  const T = mats(), R = { g:new THREE.Group(), parts:[], burns:[] }, s1 = new THREE.Group(), s2 = new THREE.Group(), s3 = new THREE.Group(), pl = new THREE.Group();
  s1.add(at(cyl(2.05, 2.05, 21, T.silver), 0, 10.5 + 1.2, 0));
  for (let i = 0; i < 6; i++){ const a = i*Math.PI/3, x = Math.cos(a)*2.9, z = Math.sin(a)*2.9;
    s1.add(at(cyl(.8, .8, 19, T.grey, 24), x, 11.0, z)); s1.add(at(ogive(.8, 1.6, T.grey, 20.5), x, 0, z)); s1.add(at(bell(.35, .65, 1.6), x, .8, z)); addBurn(R, s1, x, 0, z, .62, 26, isM ? 'ker' : 'hyp', 0, 124);
    s1.add(at(cyl(.82, .82, .4, T.dark, 24), x, 4, z)); }
  s1.add(at(cyl(2.07, 2.07, .5, T.dark), 0, 15, 0));
  s2.add(at(cyl(2.05, 2.05, 14, T.silver), 0, 22.2 + 7, 0)); s2.add(at(cyl(2.07, 2.07, .4, T.dark), 0, 30, 0));
  for (let i = 0; i < 4; i++){ const a = i*Math.PI/2 + .78; s2.add(at(bell(.3, .5, 1.4), Math.cos(a)*1.0, 21.9, Math.sin(a)*1.0)); addBurn(R, s2, Math.cos(a)*1.0, 21.2, Math.sin(a)*1.0, .5, 18, 'hyp', 124, 334); }
  s3.add(at(cyl(2.05, 2.05, 5, T.silver), 0, 36.2 + 2.5, 0)); s3.add(at(bell(.3, .55, 1.3), 0, 36, 0)); addBurn(R, s3, 0, 35.4, 0, .55, 14, 'hyp', 334, 580);
  // carga y cubierta
  const mod = MOD[payloadId]; if (mod){ const m = buildModule(mod); m.rotation.z = Math.PI/2; m.position.y = 41.7 + mod.L/2; m.scale.setScalar(Math.min(1, 12.5/mod.L)); pl.add(m); }
  const fair = new THREE.Group(); for (const s of [-1, 1]){ const half = new THREE.Group();
    const c = M(new THREE.CylinderGeometry(2.25, 2.25, 11, 32, 1, true, s > 0 ? 0 : Math.PI, Math.PI), T.white); c.position.y = 41.2 + 5.5; half.add(c);
    const o = M(new THREE.LatheGeometry(Array.from({ length:17 }, (_, i) => new THREE.Vector2(2.25*Math.sqrt(1 - (i/16)**2*.98) + .001, 52.2 + 4.5*i/16)), 32, s > 0 ? 0 : Math.PI, Math.PI), T.white); half.add(o);
    half.userData.side = s; fair.add(half); }
  [s1, s2, s3, pl, fair].forEach(o => R.g.add(o));
  R.parts.push({ o:s1, drop:124, kick:V(0,-1,0) }, { o:s2, drop:334, kick:V(0,-1,0) }, { o:s3, drop:590, kick:V(0,-1,0) });
  fair.children.forEach(h => R.parts.push({ o:h, drop:isM ? 180 : 183, kick:V(0,0,h.userData.side*1), spin:V(h.userData.side*.6, 0, 0) }));
  R.payload = pl; R.top = 57; return R;
}
function soyuzRocket(is21b, payloadLabel){
  const T = mats(), R = { g:new THREE.Group(), parts:[], burns:[] };
  const core = new THREE.Group(), s3 = new THREE.Group(), pl = new THREE.Group();
  core.add(at(cyl(1.03, 1.48, 27.8, T.grey), 0, 13.9 + .4, 0));
  core.add(at(cyl(1.49, 1.49, 1.4, T.band), 0, 27.6, 0));
  for (let i = 0; i < 4; i++){ const a = i*Math.PI/2 + Math.PI/4; core.add(at(bell(.2, .42, 1.2), Math.cos(a)*.55, .2, Math.sin(a)*.55)); addBurn(R, core, Math.cos(a)*.55, -.4, Math.sin(a)*.55, .4, 20, 'ker', 0, 288); }
  // laterales cónicos
  for (let i = 0; i < 4; i++){ const a = i*Math.PI/2, b = new THREE.Group();
    const geo = new THREE.LatheGeometry([new THREE.Vector2(.001, .4), new THREE.Vector2(1.34, .4), new THREE.Vector2(1.34, 2.0), new THREE.Vector2(.35, 19.6), new THREE.Vector2(.001, 21.2)], 32);
    const m = M(geo, T.grey); b.add(m); b.add(at(cyl(1.36, 1.36, .5, T.band, 32), 0, 6.5, 0));
    for (let k = 0; k < 4; k++){ const q = k*Math.PI/2 + Math.PI/4; b.add(at(bell(.18, .38, 1.1), Math.cos(q)*.55, .1, Math.sin(q)*.55)); addBurn(R, b, Math.cos(q)*.55, -.5, Math.sin(q)*.55, .37, 18, 'ker', 0, 118); }
    const fin = M(new THREE.BoxGeometry(.1, 1.8, 1.2), T.grey); fin.position.set(0, 1.4, 1.5); b.add(fin);
    b.position.set(Math.cos(a)*2.2, 0, Math.sin(a)*2.2); b.rotation.y = -a + Math.PI/2; b.rotateX(-.025); R.g.add(b);
    R.parts.push({ o:b, drop:118, kick:V(Math.cos(a), -.3, Math.sin(a)).normalize(), spin:V(Math.sin(a)*.5, 0, -Math.cos(a)*.5), cross:true }); }
  // armadura de enlace y tercera etapa
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(1.33, 1.48, 1.2, 16, 1, true), std({ color:0x5d625e, wireframe:true })); tr.position.y = 28.9; s3.add(tr);
  s3.add(at(cyl(1.33, 1.33, 6.7, T.grey), 0, 29.5 + 3.35, 0)); s3.add(at(bell(.3, .6, 1.2), 0, 29.2, 0)); addBurn(R, s3, 0, 28.6, 0, .6, 12, 'ker', 288, 528);
  // carga: nave Progress con el módulo
  const pv = buildVehicle('progress', true); pv.rotation.z = -Math.PI/2; pv.position.y = 43.2; pv.scale.setScalar(.95); pl.add(pv);
  const fair = new THREE.Group(); for (const s of [-1, 1]){ const half = new THREE.Group();
    const c = M(new THREE.CylinderGeometry(1.5, 1.5, 7, 32, 1, true, s > 0 ? 0 : Math.PI, Math.PI), T.white); c.position.y = 36.2 + 3.5; half.add(c);
    const o = M(new THREE.LatheGeometry(Array.from({ length:17 }, (_, i) => new THREE.Vector2(1.5*Math.sqrt(1 - (i/16)**2*.98) + .001, 39.7 + 3.8*i/16)), 32, s > 0 ? 0 : Math.PI, Math.PI), T.white); half.add(o);
    half.userData.side = s; fair.add(half); }
  [core, s3, pl, fair].forEach(o => R.g.add(o));
  R.parts.push({ o:core, drop:288, kick:V(0,-1,0) }, { o:s3, drop:531, kick:V(0,-1,0) });
  fair.children.forEach(h => R.parts.push({ o:h, drop:is21b ? 165 : 160, kick:V(0,0,h.userData.side), spin:V(h.userData.side*.7, 0, 0) }));
  R.payload = pl; R.top = 44; return R;
}
function shuttleStack(){
  const T = mats(), R = { g:new THREE.Group(), parts:[], burns:[] };
  const et = new THREE.Group(); et.add(at(cyl(4.2, 4.2, 38, T.foam, 48), 0, 21, 0)); et.add(ogive(4.2, 8.9, T.foam, 40)); et.add(at(cyl(4.22, 4.22, 6.8, std({ color:0xb36a2e, roughness:.8 }), 48), 0, 30, 0));
  et.add(at(M(new THREE.SphereGeometry(4.2, 32, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2), T.foam), 0, 2, 0));
  const srbs = [-1, 1].map(s => { const b = new THREE.Group(); b.add(at(cyl(1.85, 1.85, 37, T.white), 0, 3 + 18.5, 0)); b.add(at(M(new THREE.ConeGeometry(1.85, 6, 32), T.white), 0, 43.5, 0));
    b.add(at(cyl(2.6, 1.85, 3, T.white), 0, 1.5, 0)); b.add(at(bell(.9, 1.9, 3.6, T.dark), 0, -1.2, 0)); for (const y of [10, 20, 30]) b.add(at(cyl(1.87, 1.87, .5, T.grey), 0, y, 0));
    addBurn(R, b, 0, -3, 0, 1.8, 60, 'srb', 0, 124); b.position.set(s*6.3, 0, 0); R.g.add(b); R.parts.push({ o:b, drop:124, kick:V(s, -.2, 0).normalize(), spin:V(0, 0, -s*.4) }); return b; });
  const orb = buildOrbiter(false); orb.position.set(0, 21, 7.9); R.g.add(orb); R.orbiter = orb;
  for (const [x, z] of [[0, 1.3], [-1.35, -.8], [1.35, -.8]]) addBurn(R, orb, x, -17.2, z, 1.05, 30, 'h2', -6, 510);
  R.g.add(et); R.parts.push({ o:et, drop:528, kick:V(0, 0, -1), spin:V(.25, 0, 0) });
  R.payload = null; R.top = 56; return R;
}
function falconRocket(){
  const T = mats(), R = { g:new THREE.Group(), parts:[], burns:[] }, s1 = new THREE.Group(), s2 = new THREE.Group(), dr = new THREE.Group();
  s1.add(at(cyl(1.83, 1.83, 40.4, T.white, 48), 0, 20.2 + .8, 0)); s1.add(at(cyl(1.85, 1.85, 6.5, T.black, 48), 0, 41.2 + 3.25, 0));
  s1.add(at(cyl(1.9, 1.85, .8, T.dark, 48), 0, .4, 0));
  for (let i = 0; i < 9; i++){ const a = i*Math.PI*2/8, rr = i === 8 ? 0 : 1.15; s1.add(at(bell(.2, .46, 1.0), Math.cos(a)*rr, -.3, Math.sin(a)*rr)); addBurn(R, s1, Math.cos(a)*rr, -.8, Math.sin(a)*rr, .44, 24, 'ker', 0, 150); }
  for (let i = 0; i < 4; i++){ const a = i*Math.PI/2 + Math.PI/4; const leg = M(new THREE.BoxGeometry(.5, 9.5, .3), T.black); leg.position.set(Math.cos(a)*1.9, 5.6, Math.sin(a)*1.9); leg.rotation.y = -a; s1.add(leg);
    const fin = M(new THREE.BoxGeometry(1.2, 1.4, .12), T.steelG); fin.position.set(Math.cos(a)*2.2, 46.5, Math.sin(a)*2.2); fin.rotation.y = -a + Math.PI/2; s1.add(fin); }
  s2.add(at(cyl(1.83, 1.83, 12.6, T.white, 48), 0, 47.7 + 6.3, 0)); s2.add(at(bell(.3, 1.2, 3.2, T.dark), 0, 46.5, 0)); addBurn(R, s2, 0, 44.9, 0, 1.15, 22, 'ker', 157, 525);
  const d = buildVehicle('dragonc'); d.rotation.z = -Math.PI/2; d.position.y = 66.5; dr.add(d);
  [s1, s2, dr].forEach(o => R.g.add(o));
  R.parts.push({ o:s1, drop:154, kick:V(0,-1,0), spin:V(.08,0,0) }, { o:s2, drop:710, kick:V(0,-1,0) });
  R.payload = dr; R.top = 70; return R;
}
function buildRocket(f){
  const k = f.veh, pid = f.add.find(id => MOD[id]);
  if (k === 'protonK' || k === 'protonM') return protonRocket(null, pid, k === 'protonM');
  if (k === 'shuttle') return shuttleStack();
  if (k === 'falcon9') return falconRocket();
  return soyuzRocket(k === 'soyuz21b');
}

// ---------- plataforma y terreno ----------
function groundTex(kind){
  const [c, g] = canvas(1024, 1024), r = rng(kind === 'steppe' ? 3 : 8);
  g.fillStyle = kind === 'steppe' ? '#a39a73' : '#5d6e45'; g.fillRect(0,0,1024,1024);
  for (let i = 0; i < 4000; i++){ const k = (r()-.5)*40; g.fillStyle = kind === 'steppe' ? `rgba(${150+k},${140+k},${100+k*.6},.35)` : `rgba(${80+k},${100+k},${60+k*.5},.4)`; const s = 4 + r()*40; g.fillRect(r()*1024, r()*1024, s, s*.6); }
  g.strokeStyle = 'rgba(70,65,55,.6)'; g.lineWidth = 3; for (let i = 0; i < 6; i++){ g.beginPath(); g.moveTo(r()*1024, 0); g.lineTo(r()*1024, 1024); g.stroke(); }
  grain(g, 1024, 1024, 12, 4); return tex(c, { rep:[60, 60] });
}
function buildPad(kind, veh){
  const T = mats(), g = new THREE.Group();
  const gm = std({ map:groundTex(kind), roughness:.95 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60000, 64), gm); ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; g.add(ground);
  if (kind === 'florida'){ const sea = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000), std({ color:0x1e4a66, roughness:.15, metalness:.2 })); sea.rotation.x = -Math.PI/2; sea.position.set(62000, .3, 0); g.add(sea);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(400, 120000), std({ color:0xd9cfa8, roughness:.9 })); beach.rotation.x = -Math.PI/2; beach.position.set(1900, .2, 0); g.add(beach); }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(70, 75, 3, 48), T.concrete); pad.position.y = -1.2; pad.receiveShadow = true; g.add(pad);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 60), T.black); trench.position.set(0, .35, -30); g.add(trench);
  // torre de servicio
  const towerH = veh === 'shuttle' ? 75 : veh === 'falcon9' ? 72 : 52, lat = std({ color:veh === 'shuttle' ? 0x9b3a2a : 0x8f9599, roughness:.6, metalness:.5, wireframe:true });
  const tw = new THREE.Mesh(new THREE.BoxGeometry(9, towerH, 9, 2, Math.round(towerH/4), 2), lat); tw.position.set(veh === 'shuttle' ? -2 : 17, towerH/2, veh === 'shuttle' ? -22 : -6); g.add(tw);
  const twc = new THREE.Mesh(new THREE.BoxGeometry(8.6, towerH, 8.6), std({ color:0x4a4f52, roughness:.8, transparent:true, opacity:.35 })); twc.position.copy(tw.position); g.add(twc);
  if (kind === 'florida') for (const [x, z] of [[-60, 60], [60, 60], [0, -80]]){ const lt = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.4, 110, 8), T.steelG); lt.position.set(x, 55, z); g.add(lt); }
  if (kind === 'steppe' && veh.startsWith('soyuz')) for (let i = 0; i < 4; i++){ const a = i*Math.PI/2 + Math.PI/4, arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, 1.2), T.steelG); arm.position.set(Math.cos(a)*6.5, 7, Math.sin(a)*6.5); arm.rotation.z = Math.cos(a)*.35; arm.rotation.x = -Math.sin(a)*.35; g.add(arm); }
  // edificios a lo lejos
  const r = rng(11); for (let i = 0; i < 40; i++){ const w = 15 + r()*60, h = 6 + r()*30, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w*(.5 + r())), std({ color:kind === 'steppe' ? 0xb7ae94 : 0xd5d5d0, roughness:.9 })); const a = r()*Math.PI*2, d = 700 + r()*5000; b.position.set(Math.cos(a)*d, h/2, Math.sin(a)*d); g.add(b); }
  if (veh === 'shuttle'){ const vab = new THREE.Mesh(new THREE.BoxGeometry(160, 160, 200), std({ color:0xd8d8d2, roughness:.9 })); vab.position.set(-2500, 80, 4800); g.add(vab); }
  return g;
}
function smokeTex(){ const [c, g] = canvas(128, 128); const gr = g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,.9)'); gr.addColorStop(.5,'rgba(235,235,230,.45)'); gr.addColorStop(1,'rgba(220,220,215,0)'); g.fillStyle = gr; g.fillRect(0,0,128,128); return new THREE.CanvasTexture(c); }

// ---------- perfil del ascenso ----------
function profile(prof){
  const T = prof.map(p => p[0]), H = prof.map(p => p[1]), Vv = prof.map(p => p[2]);
  const n = T.length, m = new Array(n).fill(0), dk = [];
  for (let i = 0; i < n-1; i++) dk.push((H[i+1]-H[i])/(T[i+1]-T[i]));
  for (let i = 1; i < n-1; i++) m[i] = dk[i-1]*dk[i] <= 0 ? 0 : 2/(1/dk[i-1] + 1/dk[i]);
  m[0] = 0; m[n-1] = dk[n-2]*.3;
  const h = (t) => { if (t <= 0) return 0; if (t >= T[n-1]) return H[n-1] + m[n-1]*(t - T[n-1]); let i = 0; while (t > T[i+1]) i++;
    const dt = T[i+1]-T[i], s = (t - T[i])/dt, s2 = s*s, s3 = s2*s; return (2*s3-3*s2+1)*H[i] + (s3-2*s2+s)*dt*m[i] + (-2*s3+3*s2)*H[i+1] + (s3-s2)*dt*m[i+1]; };
  const v = (t) => { if (t <= 0) return 0; if (t >= T[n-1]) return Vv[n-1]; let i = 0; while (t > T[i+1]) i++; const s = (t - T[i])/(T[i+1]-T[i]); return Vv[i] + (Vv[i+1]-Vv[i])*s*s*(3-2*s)*.5 + (Vv[i+1]-Vv[i])*s*.5; };
  return { h, v };
}

// =====================================================================
export class Launch {
  constructor(ctx, f, veh, siteName, hud){
    Object.assign(this, { ctx, f, veh, hud, speed:5, t:-12, phase:'asc', camMode:0, autoCam:true, dropped:[], downrange:0, done:false });
    const [lat, lon, kind, az] = PADS[f.site]; this.site = { lat, lon, kind, az };
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(30, innerWidth/innerHeight, .5, 1.2e5);
    this.sky = makeSky(); this.sky.cam.near = .001;
    this.prof = profile(veh.prof);
    // luz: Sol a media mañana
    this.sunDir = V(Math.sin(az*Math.PI/180 + 1.2), .62, -Math.cos(az*Math.PI/180 + 1.2)).normalize();
    const sun = new THREE.DirectionalLight(0xfff3e2, 3.2); sun.position.copy(this.sunDir).multiplyScalar(200); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left:-60, right:60, top:90, bottom:-20, near:1, far:500 }); this.scene.add(sun, sun.target); this.sun = sun;
    this.hemi = new THREE.HemisphereLight(0xa8c8ff, 0x6b6450, .9); this.scene.add(this.hemi);
    this.ground = buildPad(kind, f.veh); this.scene.add(this.ground);
    this.R = buildRocket(f); this.rocket = new THREE.Group(); this.rocket.add(this.R.g); this.scene.add(this.rocket);
    // humo
    const N = 500; this.smoke = { n:N, p:new Float32Array(N*3), v:new Float32Array(N*3), age:new Float32Array(N).fill(-1), i:0 };
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.smoke.p, 3)); sg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1)); sg.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    this.smokePts = new THREE.Points(sg, new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:{ map:{value:smokeTex()}, scale:{value:innerHeight} },
      vertexShader:'attribute float size; attribute float alpha; varying float va; uniform float scale; void main(){ va = alpha; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size*projectionMatrix[1][1]*scale*.5/(-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader:'uniform sampler2D map; varying float va; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(.86,.85,.82)*c.rgb, c.a*va); }' }));
    this.smokePts.frustumCulled = false; this.ground.add(this.smokePts);
    this.dir = V(Math.sin(az*Math.PI/180), 0, -Math.cos(az*Math.PI/180));
    this.tower = V(-420, 25, 380).addScaledVector(this.dir, -600);
    this.evIdx = -1; this.events = veh.ev;
    this.scene.fog = new THREE.Fog(0xb8cbe0, 3000, 55000);
  }
  nextCam(){ this.camMode = (this.camMode + 1) % 3; this.autoCam = false; }
  skip(){ if (this.phase === 'asc') this.toOrbit(); }
  // posición del cohete: altura y distancia recorrida (km)
  state(t){ const h = this.prof.h(t), v = this.prof.v(t); return { h, v }; }
  step(dt){
    if (this.phase === 'orb') return this.stepOrb(dt);
    const sdt = dt*this.speed; let t = this.t;
    // integración de la distancia horizontal (pasos de 0,5 s)
    for (let k = 0, n = Math.ceil(sdt/.5); k < n; k++){ const d = sdt/n, h0 = this.prof.h(t), h1 = this.prof.h(t + d), vy = (h1 - h0)/d, v = this.prof.v(t + d/2);
      if (t > 0) this.downrange += Math.sqrt(Math.max(0, v*v - vy*vy))*d; t += d; }
    this.t = t;
    const h = this.prof.h(Math.max(0, t)), vy = (this.prof.h(t + .5) - this.prof.h(t - .5)), v = this.prof.v(t), vx = Math.sqrt(Math.max(1e-6, v*v - vy*vy));
    const gam = t <= 8 ? Math.PI/2 : Math.atan2(vy, vx);
    // marco curvo de la Tierra
    const th = this.downrange / RE, up = V(0, Math.cos(th), 0).addScaledVector(this.dir, Math.sin(th)), fw = this.dir.clone().multiplyScalar(Math.cos(th)).add(V(0, -Math.sin(th), 0));
    const axis = up.clone().multiplyScalar(Math.sin(gam)).addScaledVector(fw, Math.cos(gam)).normalize();
    this.rocket.quaternion.setFromUnitVectors(V(0,1,0), axis);
    this.posKm = V(0, -RE, 0).addScaledVector(up, RE + h); this.up = up; this.axis = axis;
    // suelo: origen flotante (aproximación plana)
    const flat = this.dir.clone().multiplyScalar(this.downrange*1000).add(V(0, h*1000, 0));
    this.ground.position.copy(flat).negate(); this.ground.visible = h < 45;
    // separaciones
    for (const p of this.R.parts) if (!p.gone && t >= p.drop){ p.gone = true; this.detach(p); }
    for (const d of this.dropped){ d.age += sdt; d.vel.addScaledVector(this.axis, -sdt*(t < 150 ? 22 : 12)); d.o.position.addScaledVector(d.vel, sdt); if (d.spin){ d.o.rotation.x += d.spin.x*sdt; d.o.rotation.z += d.spin.z*sdt; } if (d.age > 40) d.o.visible = false; }
    // plumas
    const thin = Math.min(1, h/40);
    for (const b of this.R.burns){ const on = t >= b.t0 && t <= b.t1 && !(b.o.parent?.userData.gone);
      const ign = b.t0 < 0 ? Math.min(1, Math.max(0, (t - b.t0)/3)) : Math.min(1, Math.max(0, (t - Math.max(b.t0, -3))/1.5));
      b.o.visible = on && ign > 0; b.o.material.uniforms.t.value = performance.now()/1000; b.o.material.uniforms.k.value = ign;
      b.o.scale.set(1 + thin*3.5, (1 + thin*1.2)*ign, 1 + thin*3.5); }
    // humo en la plataforma y estela
    this.emitSmoke(t, sdt, h);
    // cielo
    const k = Math.min(1, h/55), sky = new THREE.Color(.42, .62, .92).lerp(new THREE.Color(.0, .0, .02), k);
    this.ctx.renderer.setClearColor(sky); this.scene.fog.color.copy(sky).lerp(new THREE.Color(.75,.82,.9), 1 - k); this.scene.fog.far = 55000 + h*4000;
    this.hemi.intensity = .9*(1 - k) + .15;
    // eventos y tablero
    let ev = ''; for (let i = this.events.length - 1; i >= 0; i--) if (t >= this.events[i][0]){ ev = this.events[i][1]; break; }
    if (t < 0) ev = t > -3 ? 'Encendido de los motores' : 'Cuenta regresiva · ' + this.f.id;
    const s = Math.abs(Math.round(t)), mm = String(Math.floor(s/60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    this.hud({ t:(t < 0 ? 'T−' : 'T+') + mm + ':' + ss, ev, h:h.toFixed(1).replace('.', ',') + ' km', v:Math.round(v*3600).toLocaleString('es') + ' km/h' });
    // cámara
    if (this.autoCam) this.camMode = t < 35 ? 0 : t < this.veh.tEnd - 40 ? 1 : 2;
    this.placeCam(t, h);
    if (t > this.veh.tEnd + 5) this.toOrbit();
  }
  detach(p){
    const o = p.o, w = new THREE.Vector3(); o.updateMatrixWorld(); o.getWorldPosition(w);
    const q = new THREE.Quaternion(); o.getWorldQuaternion(q); o.parent.remove(o); this.scene.add(o); o.position.copy(w); o.quaternion.copy(q); o.userData.gone = true;
    const kick = p.kick.clone().applyQuaternion(this.rocket.quaternion).multiplyScalar(p.cross ? 9 : 4);
    this.dropped.push({ o, vel:kick, spin:p.spin, age:0 });
  }
  emitSmoke(t, sdt, h){
    const S = this.smoke, pos = this.smokePts.geometry.attributes.position, size = this.smokePts.geometry.attributes.size, al = this.smokePts.geometry.attributes.alpha;
    const emit = (p, v) => { const i = S.i++ % S.n; S.p.set([p.x, p.y, p.z], i*3); S.v.set([v.x, v.y, v.z], i*3); S.age[i] = 0; };
    const r = Math.random;
    if (t > -3 && t < 18){ for (let k = 0; k < Math.min(25, sdt*40); k++){ const s = r() < .5 ? -1 : 1; emit(V((r()-.5)*20, 4, -50*s + (r()-.5)*10), V((r()-.5)*25, 4 + r()*10, -s*(30 + r()*40))); } }
    if (t > 0 && h < 18){ const flat = this.dir.clone().multiplyScalar(this.downrange*1000).add(V(0, h*1000, 0)).addScaledVector(this.axis, -30);
      for (let k = 0; k < Math.min(10, sdt*14); k++) emit(flat.clone().add(V((r()-.5)*8, (r()-.5)*8, (r()-.5)*8)), V((r()-.5)*3, (r()-.5)*2, (r()-.5)*3)); }
    for (let i = 0; i < S.n; i++){ if (S.age[i] < 0){ size.array[i] = 0; continue; } S.age[i] += sdt; const a = S.age[i];
      for (let c = 0; c < 3; c++){ S.p[i*3+c] += S.v[i*3+c]*sdt; S.v[i*3+c] *= Math.pow(.92, sdt); }
      size.array[i] = 30 + a*9; al.array[i] = Math.max(0, .7 - a/90); if (a > 90) S.age[i] = -1; }
    pos.needsUpdate = true; size.needsUpdate = true; al.needsUpdate = true;
  }
  placeCam(t, h){
    const c = this.cam;
    if (this.camMode === 0){ // cámara de seguimiento desde tierra (teleobjetivo)
      const flat = this.dir.clone().multiplyScalar(this.downrange*1000).add(V(0, h*1000, 0));
      c.position.copy(this.tower).sub(flat); c.up.set(0,1,0); c.lookAt(this.axis.clone().multiplyScalar(this.R.top*.45));
      const dist = c.position.length(); c.fov = THREE.MathUtils.clamp(2*Math.atan(55/dist)*180/Math.PI, .6, 45);
    } else if (this.camMode === 1){ // persecución
      const side = this.axis.clone().cross(this.up).normalize(); if (side.lengthSq() < .5) side.set(1,0,0);
      c.position.copy(this.axis).multiplyScalar(-55).addScaledVector(side, 42).addScaledVector(this.up, 14); c.up.copy(this.up); c.lookAt(this.axis.clone().multiplyScalar(this.R.top*.5)); c.fov = 38;
    } else { // a bordo, mirando hacia atrás y abajo
      const side = this.axis.clone().cross(this.up).normalize(); if (side.lengthSq() < .5) side.set(1,0,0);
      c.position.copy(this.axis).multiplyScalar(this.R.top*.62).addScaledVector(side, 3.2); c.up.copy(side); c.lookAt(this.axis.clone().multiplyScalar(-40).addScaledVector(side, 3.4)); c.fov = 75;
    }
    c.aspect = innerWidth/innerHeight; c.updateProjectionMatrix();
    // fondo: la Tierra real debajo del sitio de lanzamiento
    const s = this.site, la = s.lat*Math.PI/180, lo = s.lon*Math.PI/180;
    const E = V(-Math.sin(lo), Math.cos(lo), 0), N = V(-Math.sin(la)*Math.cos(lo), -Math.sin(la)*Math.sin(lo), Math.cos(la)), U = V(Math.cos(la)*Math.cos(lo), Math.cos(la)*Math.sin(lo), Math.sin(la));
    const sceneFromEcef = new THREE.Matrix4().makeBasis(E, U, N.clone().negate()).invert();
    const Mx = new THREE.Matrix4().multiplyMatrices(sceneFromEcef, MESH_TO_ECEF); Mx.setPosition(0, -RE, 0);
    this.sky.earth.matrix.copy(Mx); this.sky.scene.children[1].matrix.copy(Mx); this.sky.earth.matrixWorldNeedsUpdate = this.sky.scene.children[1].matrixWorldNeedsUpdate = true;
    this.sky.U.sun.value.copy(this.sunDir);
    this.sky.cam.position.copy(this.posKm).addScaledVector(c.position, .001); this.sky.cam.quaternion.copy(c.quaternion); this.sky.cam.fov = c.fov; this.sky.cam.aspect = c.aspect; this.sky.cam.near = Math.max(.002, h*.0005); this.sky.cam.far = 4e5; this.sky.cam.updateProjectionMatrix();
  }
  render(){
    const r = this.ctx.renderer;
    if (this.phase === 'orb'){ this.ctx.draw(); return; }
    r.clear(); const hKm = this.posKm ? this.posKm.length() - RE : 0;
    if (hKm > 2) r.render(this.sky.scene, this.sky.cam);
    r.clearDepth(); r.render(this.scene, this.cam);
  }
  // ---------- llegada a la estación ----------
  toOrbit(){
    if (this.phase === 'orb') return;
    this.phase = 'orb'; this.ctx.renderer.setClearColor(0x000000); const { station, ext, cam, ctl } = this.ctx, f = this.f;
    this.hud({ t:'En órbita', ev:'Rumbo a la estación…', h:'≈ 415 km', v:'27 600 km/h' });
    const before = D(f.d) - 864e5, after = D(f.d) + 20*864e5;
    station.setDate(after);
    const ids = [...f.add].filter(id => station.parts.get(id)), fin = ids.map(id => { const o = station.parts.get(id); return { id, o, p:o.position.clone(), q:o.quaternion.clone(), s:o.scale.clone() }; });
    const mv = (f.move || []).map(id => { const o = station.parts.get(id); return { id, o, p:o.position.clone(), q:o.quaternion.clone() }; });
    station.setDate(before); for (const x of fin){ x.o.visible = true; x.o.position.copy(x.p); x.o.quaternion.copy(x.q); }
    for (const x of mv){ x.p0 = x.o.position.clone(); x.q0 = x.o.quaternion.clone(); x.moved = true; }
    for (const id of (f.rem || [])){ const o = station.parts.get(id); if (o) o.visible = false; }
    if (f.move) for (const id of f.move){ const o = station.parts.get(id); /* se ve en su nuevo lugar */ }
    // de dónde llega cada pieza
    const box = new THREE.Box3(); station.root.children.forEach(o => { if (o.visible && !fin.some(x => x.o === o)) box.expandByObject(o); });
    const ctr = box.isEmpty() ? V(0,0,0) : box.getCenter(V(0,0,0));
    let base = null;
    this.extra = [];
    if (f.veh === 'shuttle'){
      const p2 = station.parts.get('pma2'), tip = p2.visible ? p2.position.clone().add(V(1,0,0).applyQuaternion(p2.quaternion).multiplyScalar(1.0)) : V(9, 0, 0);
      const nOut = p2.visible ? V(1,0,0).applyQuaternion(p2.quaternion) : V(1,0,0);
      const orb = buildOrbiter(true);
      // eje +y del orbitador (nariz) → cenit si el puerto es horizontal; +z (bodega) → hacia la estación
      const zA = nOut.clone().negate(), yA = Math.abs(zA.y) > .5 ? V(1,0,0) : V(0,1,0), xA = yA.clone().cross(zA).normalize();
      orb.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA.clone(), zA));
      orb.position.copy(tip).sub(orb.userData.ods.clone().applyQuaternion(orb.quaternion)); orb.updateMatrixWorld(true);
      orb.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
      ext.add(orb); this.extra.push(orb);
      base = orb.localToWorld(V(0, -3.6, 1.2));
      if (!station.parts.get('unity').visible || f.add.includes('unity')) base = orb.localToWorld(V(0, -3.6, 1.0));
    } else if (f.veh === 'falcon9'){
      const h2 = station.parts.get('harmony'), d = buildVehicle('dragonc'); d.position.copy(PORTS['harmony-y'].p).addScaledVector(V(0,-1,0), .3); d.quaternion.copy(orientQ(V(0,-1,0))); d.updateMatrixWorld(true);
      d.traverse(o => { if (o.isMesh){ o.castShadow = true; } }); ext.add(d); this.extra.push(d); base = d.localToWorld(V(4.5, 0, 0));
    }
    this.anim = fin.map(x => {
      const isIro = x.id.startsWith('iro');
      let p0, q0 = x.q.clone();
      if (isIro){ p0 = x.p.clone(); x.o.scale.set(.03, 1, 1); }
      else if (base){ p0 = x.o.parent.worldToLocal(base.clone()); }
      else { const d = x.p.clone().sub(ctr); const ax = ['x','y','z'].reduce((a, k) => Math.abs(d[k]) > Math.abs(d[a]) ? k : a, 'x'); const out = V(0,0,0); out[ax] = Math.sign(d[ax]) || 1; p0 = x.p.clone().addScaledVector(out, ids.includes('zarya') ? 0 : 40); if (ids.includes('zarya')) p0.add(V(-25, 8, 12)); }
      return { ...x, p0, q0, iro:isIro };
    }).concat(mv);
    this.oT = 0;
    const tgt = fin.length ? fin[0].p.clone() : V(0,0,0); if (fin[0] && fin[0].o.parent !== station.root) fin[0].o.getWorldPosition(tgt);
    const a0 = this.anim[0], ap = a0 && !a0.iro ? a0.o.parent.localToWorld(a0.p0.clone()).sub(tgt) : V(1,0,0); if (ap.lengthSq() < 1) ap.set(1,0,0); ap.normalize();
    const side = ap.clone().cross(Math.abs(ap.y) > .8 ? V(1,0,0) : V(0,1,0)).normalize();
    ctl.target.copy(tgt).addScaledVector(ap, 10); cam.position.copy(tgt).addScaledVector(ap, 16).addScaledVector(side, 52).add(V(0, 40, 0)); cam.near = .5; cam.fov = 50; cam.updateProjectionMatrix(); ctl.enabled = true;
    this.ctx.onOrbit && this.ctx.onOrbit();
  }
  stepOrb(dt){
    this.oT += dt*Math.min(this.speed, 5)/5*1.0;
    const u = Math.min(1, this.oT/14), k = u < .5 ? 4*u*u*u : 1 - Math.pow(-2*u + 2, 3)/2;
    for (const a of this.anim){
      if (a.iro){ a.o.scale.x = .03 + .97*k; continue; }
      if (a.moved){ a.o.position.copy(a.p0).lerp(a.p, k).add(V(0, Math.sin(k*Math.PI)*8, 0)); a.o.quaternion.copy(a.q0).slerp(a.q, k); continue; }
      if (this.f.veh === 'shuttle' || this.f.veh === 'falcon9'){ const mid = a.p0.clone().lerp(a.p, .5).add(V(0, 6, 0)); const q1 = a.p0.clone().lerp(mid, k), q2 = mid.clone().lerp(a.p, k); a.o.position.copy(q1.lerp(q2, k)); }
      else a.o.position.copy(a.p0).lerp(a.p, k);
    }
    if (u >= 1 && !this.done){ this.done = true; this.hud({ t:'¡Listo!', ev:this.f.t + ' · ya es parte de la estación', h:'≈ 415 km', v:'27 600 km/h' }); }
    else if (!this.done) this.hud({ t:'Acercamiento', ev:this.f.veh === 'shuttle' ? 'El brazo robótico coloca la pieza' : this.f.veh === 'falcon9' ? 'El Canadarm2 saca la carga del baúl de la Dragon' : 'Acoplamiento automático', h:'≈ 415 km', v:Math.max(0, (1 - u)*.3).toFixed(2).replace('.', ',') + ' m/s relativos' });
  }
  dispose(){
    for (const o of this.extra || []) o.parent && o.parent.remove(o);
    for (const a of this.anim || []){ a.o.position.copy(a.p); a.o.quaternion.copy(a.q); if (a.iro) a.o.scale.x = 1; }
    this.ctx.renderer.setClearColor(0x000000);
  }
}
