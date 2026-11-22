// Interior recorrible de la ISS: cada módulo presurizado por dentro, con escotillas, racks, la Cúpula y puntos de interés.
import * as THREE from 'three';
import { MODS, MOD, LINKS, CLOSED, SPOTS } from './datos.js';
import { modDir, orientQ } from './modelo.js';
import { rng, canvas, tex, grain, normalFrom } from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AXV = { '+x':V(1,0,0), '-x':V(-1,0,0), '+y':V(0,1,0), '-y':V(0,-1,0), '+z':V(0,0,1), '-z':V(0,0,-1) };
const US = new Set(['us','nodo']);
const HW = 1.05;                               // medio ancho del pasillo (2,1 m de cara a cara de los racks)
const RW = 1.06;                               // ancho de un rack (a lo largo del módulo)
const FW = 1.55;                               // alto visible de la cara del rack (de esquina a esquina)
const CH = (HW - FW/2) * Math.SQRT2;           // ancho de las esquinas biseladas (luces y cables)

// ================= texturas del interior =================
function txt(g, s, x, y, size = 14, col = '#222', font = 'IBM Plex Mono, monospace', w = 600){ g.fillStyle = col; g.font = `${w} ${size}px ${font}`; g.fillText(s, x, y); }
function barcode(g, x, y, w, h, r){ g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#111'; for (let i = 3; i < w - 3; i += 2 + (r()*3|0)) g.fillRect(x + i, y + 2, 1 + (r()*2|0), h - 4); }
function label(g, x, y, w, h, r, lines){
  g.fillStyle = '#f7f7f2'; g.fillRect(x, y, w, h); g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
  lines.forEach((l, i) => txt(g, l, x + 5, y + 14 + i*13, 11)); barcode(g, x + w - 46, y + 3, 42, h - 6, r);
}
const WORDS = ['MDL','ISPR','CTB','EXPRESS','FOOD','CREW PREF','SPARES','HRF','MSG','WRS','OGS','CDRA','MSRR','FIR','EPM','BIOLAB','FSL','RYUTAI','SAIBO','KOBAIRO','PWD','CHeCS','DDCU','LAPTOP','ELITE','TVIS','CEVIS'];
const VEL = (g, x, y, w, h) => { g.fillStyle = '#d9cfae'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < w; i += 3) g.fillRect(x+i, y, 1, h); };

// Una cara de rack de 1,06 × 2 m (512 × 1024 px): devuelve mapa de color, normal y emisivo
function rackTex(kind, seed){
  const W = 512, H = 1024, [c, g] = canvas(W, H), [h, gh] = canvas(W, H), [e, ge] = canvas(W, H), r = rng(seed);
  ge.fillStyle = '#000'; ge.fillRect(0,0,W,H); gh.fillStyle = '#7a7a7a'; gh.fillRect(0,0,W,H);
  const frame = () => { g.strokeStyle = '#7d8388'; g.lineWidth = 10; g.strokeRect(5,5,W-10,H-10); gh.strokeStyle = '#a0a0a0'; gh.lineWidth = 12; gh.strokeRect(6,6,W-12,H-12);
    for (const y of [40, H-40]) for (const x of [26, W-26]){ g.fillStyle = '#3e4246'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); } };
  const box3 = (x, y, w, hh, col, lift = 40) => { g.fillStyle = col; g.fillRect(x, y, w, hh); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(x, y, w, hh);
    gh.fillStyle = `rgb(${122+lift},${122+lift},${122+lift})`; gh.fillRect(x, y, w, hh); gh.strokeStyle = '#4a4a4a'; gh.lineWidth = 3; gh.strokeRect(x, y, w, hh); };
  const latch = (x, y) => { g.fillStyle = '#2f3337'; g.fillRect(x, y, 34, 12); g.fillStyle = '#8c939a'; g.fillRect(x+3, y+3, 28, 6); gh.fillStyle = '#d0d0d0'; gh.fillRect(x, y, 34, 12); };
  const screen = (x, y, w, hh, hue) => { g.fillStyle = '#0b0f14'; g.fillRect(x-4, y-4, w+8, hh+8);
    const col = hue === 'g' ? '#41d17a' : hue === 'a' ? '#ffb14a' : '#6fb6ff'; g.fillStyle = '#0d1a24'; g.fillRect(x, y, w, hh);
    ge.fillStyle = col; for (let i = 0; i < hh/12 - 1; i++){ const lw = 10 + r()*(w-20); ge.globalAlpha = .55 + r()*.4; ge.fillRect(x + 6, y + 8 + i*12, lw, 5); g.fillStyle = col; g.globalAlpha = .5; g.fillRect(x + 6, y + 8 + i*12, lw, 5); g.globalAlpha = 1; } ge.globalAlpha = 1; };
  const led = (x, y, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); ge.fillStyle = col; ge.beginPath(); ge.arc(x, y, 4, 0, 7); ge.fill(); };
  const sw = (x, y) => { g.fillStyle = '#c8ccd0'; g.fillRect(x-7, y-12, 14, 24); g.fillStyle = '#25282b'; g.fillRect(x-3, y-14 + (r()<.5?0:14), 6, 12); gh.fillStyle = '#e0e0e0'; gh.fillRect(x-7,y-12,14,24); };
  const bag = (x, y, w, hh, col = '#e8dfca') => { // bolsa de tela CTB con correas
    const gr = g.createLinearGradient(x, y, x, y + hh); gr.addColorStop(0, col); gr.addColorStop(1, '#cdbf9f');
    g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, hh, 18); g.fill(); g.strokeStyle = 'rgba(90,80,60,.55)'; g.lineWidth = 2; g.stroke();
    const hg = gh.createRadialGradient(x+w/2, y+hh/2, 5, x+w/2, y+hh/2, Math.max(w, hh)*.6); hg.addColorStop(0, '#e8e8e8'); hg.addColorStop(1, '#8a8a8a'); gh.fillStyle = hg; gh.beginPath(); gh.roundRect(x, y, w, hh, 18); gh.fill();
    g.fillStyle = '#b9a77a'; g.fillRect(x + w*.2, y, 14, hh); g.fillRect(x + w*.75, y, 14, hh); // correas
    label(g, x + w*.3, y + hh*.3, 150, 44, r, [WORDS[r()*WORDS.length|0] + ' ' + (100 + r()*899|0), 'P/N SEG' + (1000 + r()*8999|0)]);
  };
  if (kind === 'lockers' || kind === 'stow'){
    g.fillStyle = '#c3c8cc'; g.fillRect(0,0,W,H); frame();
    const rows = 5;
    for (let j = 0; j < rows; j++) for (let i = 0; i < 2; i++){
      const x = 26 + i*236, y = 70 + j*180;
      box3(x, y, 222, 164, '#eceeef', 30); latch(x + 18, y + 72); latch(x + 170, y + 72);
      label(g, x + 60, y + 14, 140, 30, r, ['MDL ' + String.fromCharCode(65 + j) + (i + 1)]);
      if (r() < .4) VEL(g, x + 30, y + 120, 40, 22);
    }
    if (kind === 'stow'){ const n = 2 + (r()*2|0); for (let k = 0; k < n; k++){ const w = 260 + r()*200, hh = 180 + r()*170; bag(20 + r()*(W - w - 40), 60 + r()*(H - hh - 120), Math.min(w, W - 40), hh, r() < .25 ? '#f1f1ea' : '#e8dfca'); } }
  } else if (kind === 'exp' || kind === 'esa' || kind === 'jaxa'){
    const base = kind === 'jaxa' ? '#e7e9ea' : '#a3a8ad'; g.fillStyle = base; g.fillRect(0,0,W,H); frame();
    let y = 60;
    while (y < H - 100){
      const hh = 90 + r()*190, dark = r() < .45;
      box3(24, y, W - 48, hh, dark ? '#3b4046' : kind === 'esa' ? '#d8dde3' : '#cfd3d7', dark ? 10 : 30);
      const nScr = r() < .6 ? 1 : 0; if (nScr) screen(48 + r()*120, y + 20, 140 + r()*80, Math.min(hh - 40, 110), r() < .5 ? 'b' : 'g');
      for (let k = 0; k < 4 + r()*8; k++) (r() < .5 ? led : (xx, yy) => sw(xx, yy))(300 + r()*170, y + 20 + r()*(hh - 40), ['#3f6','#f44','#fd3','#39f'][r()*4|0]);
      for (let k = 0; k < 3; k++){ g.fillStyle = '#1c1f22'; g.beginPath(); g.arc(60 + k*40, y + hh - 22, 11, 0, 7); g.fill(); g.fillStyle = '#9aa1a8'; g.beginPath(); g.arc(60 + k*40, y + hh - 22, 6, 0, 7); g.fill(); }
      txt(g, WORDS[r()*WORDS.length|0], 46, y + hh - 50, 15, dark ? '#e8e8e8' : '#222');
      if (kind === 'esa' && r() < .4){ g.fillStyle = '#1b4fa3'; g.fillRect(W - 120, y + 10, 80, 20); txt(g, 'esa', W - 104, y + 26, 16, '#fff', 'Jost, sans-serif', 700); }
      if (kind === 'jaxa' && r() < .35){ txt(g, 'JAXA', W - 130, y + 30, 18, '#c22', 'Jost, sans-serif', 700); }
      y += hh + 14;
    }
    if (r() < .5) VEL(g, 30 + r()*300, 40 + r()*800, 50, 30);
  } else if (kind === 'sys'){
    g.fillStyle = '#9aa0a5'; g.fillRect(0,0,W,H); frame();
    for (let j = 0; j < 3; j++){ const y = 70 + j*310; box3(28, y, W - 56, 280, '#b9bec3', 20);
      g.fillStyle = '#2b2e31'; for (let i = 0; i < 18; i++) g.fillRect(60, y + 30 + i*12, 180, 5); // rejilla del ventilador
      for (let k = 0; k < 6; k++) sw(290 + (k%3)*50, y + 50 + (k/3|0)*60);
      g.fillStyle = '#e6c622'; g.fillRect(270, y + 200, 200, 26); for (let s = 0; s < 200; s += 22){ g.fillStyle = '#111'; g.beginPath(); g.moveTo(270 + s, y + 226); g.lineTo(280 + s, y + 200); g.lineTo(290 + s, y + 200); g.lineTo(280 + s, y + 226); g.fill(); }
      txt(g, 'CAUTION · HOT', 290, y + 252, 12); label(g, 60, y + 240, 180, 30, r, [WORDS[r()*WORDS.length|0] + ' RACK']); led(450, y + 30, '#3f6'); }
  } else if (kind === 'cq'){
    g.fillStyle = '#e6e8ea'; g.fillRect(0,0,W,H); frame();
    box3(40, 50, W - 80, H - 100, '#f2f3f4', 20); g.fillStyle = '#c9ced3'; g.fillRect(W/2 - 6, 60, 12, H - 120);
    g.fillStyle = '#2c3a50'; g.fillRect(80, 120, 140, 100); g.fillStyle = '#c9944a'; g.fillRect(90, 130, 120, 80); // foto
    g.fillStyle = '#4b86c5'; g.fillRect(300, 140, 120, 160); g.fillStyle = '#f1d16b'; g.beginPath(); g.arc(360, 200, 30, 0, 7); g.fill();
    label(g, 150, 430, 210, 44, r, ['CREW QUARTERS', 'CQ‑' + (1 + r()*4|0)]); for (let k = 0; k < 8; k++) g.fillRect(140 + k*30, 600, 18, 60);
    g.fillStyle = '#2a2d31'; for (let i = 0; i < 10; i++) g.fillRect(150, 800 + i*10, 210, 4);
  } else if (kind === 'whc'){
    g.fillStyle = '#d6dadd'; g.fillRect(0,0,W,H); frame(); box3(36, 50, W - 72, H - 100, '#eef0f1');
    g.fillStyle = '#2f5d8a'; g.fillRect(56, 80, W - 112, 30); txt(g, 'WASTE & HYGIENE', 120, 101, 18, '#fff');
    for (let i = 0; i < 6; i++){ g.fillStyle = 'rgba(80,90,100,.25)'; g.fillRect(70 + i*62, 130, 40, H - 220); }
    label(g, 150, 860, 220, 44, r, ['UWMS', 'NO DESCONECTAR']);
  } else if (kind === 'worf'){
    g.fillStyle = '#5d6268'; g.fillRect(0,0,W,H); frame(); box3(30, 40, W - 60, H - 80, '#3a3e43', 10);
    txt(g, 'WINDOW OBSERVATIONAL RESEARCH FACILITY', 40, 80, 12, '#ddd'); label(g, 160, 900, 200, 30, r, ['WORF']);
  } else if (kind === 'hatch'){
    g.fillStyle = '#b7bcc0'; g.fillRect(0,0,W,H); frame();
    for (let i = 0; i < 28; i++){ g.fillStyle = '#5b6166'; const a = i/28*Math.PI*2; g.beginPath(); g.arc(W/2 + Math.cos(a)*215, H/2 + Math.sin(a)*215*1.9, 6, 0, 7); g.fill(); }
    g.fillStyle = '#d32'; g.fillRect(40, 60, 160, 26); txt(g, '→ ESCOTILLA', 48, 80, 15, '#fff');
  }
  grain(g, W, H, 8, seed + 1);
  return { map:tex(c), normalMap:tex(normalFrom(h, 2.2), { srgb:false }), emissiveMap:tex(e) };
}
// Paneles rusos: crema con remaches, rótulos en cirílico; piso verde oliva
function ruTex(kind, seed){
  const W = 512, H = 512, [c, g] = canvas(W, H), [h, gh] = canvas(W, H), [e, ge] = canvas(W, H), r = rng(seed);
  ge.fillStyle = '#000'; ge.fillRect(0,0,W,H); gh.fillStyle = '#808080'; gh.fillRect(0,0,W,H);
  const RU = ['ПАНЕЛЬ','СОЖ','БИТС','ВЕНТИЛЯТОР','ОСТОРОЖНО','КОНТЕЙНЕР','ПИТАНИЕ','СВЯЗЬ','ЭЛЕКТРОН','ПРИБОР','СТОЛ','ТВ'];
  if (kind === 'floor'){
    g.fillStyle = '#4e5546'; g.fillRect(0,0,W,H);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++){ const k = (r()-.5)*14; g.fillStyle = `rgb(${78+k},${85+k},${70+k})`; g.fillRect(i*64+2, j*64+2, 60, 60); }
    g.strokeStyle = '#2f342a'; g.lineWidth = 4; g.strokeRect(4,4,W-8,H-8); g.fillStyle = '#c9c0a0'; g.fillRect(W/2 - 80, 40, 160, 30); txt(g, RU[r()*RU.length|0], W/2 - 70, 62, 16);
    gh.strokeStyle = '#3a3a3a'; gh.lineWidth = 8; gh.strokeRect(4,4,W-8,H-8);
  } else if (kind === 'light'){
    g.fillStyle = '#e3dfd2'; g.fillRect(0,0,W,H); g.fillStyle = '#f9f7ef'; g.fillRect(70, 150, W - 140, 210); ge.fillStyle = '#fff6e0'; ge.fillRect(70, 150, W - 140, 210);
    g.strokeStyle = '#a19d90'; g.lineWidth = 6; g.strokeRect(66, 146, W - 132, 218);
    for (let i = 0; i < 8; i++){ g.fillStyle = 'rgba(160,150,130,.45)'; g.fillRect(70 + i*48, 150, 2, 210); }
  } else {
    const base = kind === 'green' ? '#a9b49c' : '#e4dcc4';
    g.fillStyle = base; g.fillRect(0,0,W,H);
    const n = 2 + (r()*3|0);
    for (let k = 0; k < n; k++){ const x = 16 + r()*240, y = 16 + r()*280, w = 120 + r()*220, hh = 90 + r()*180;
      g.fillStyle = r() < .3 ? '#c9d1bb' : '#efe8d4'; g.fillRect(x, y, Math.min(w, W - x - 16), Math.min(hh, H - y - 16));
      g.strokeStyle = 'rgba(90,80,60,.6)'; g.lineWidth = 3; g.strokeRect(x, y, Math.min(w, W - x - 16), Math.min(hh, H - y - 16));
      gh.fillStyle = '#9a9a9a'; gh.fillRect(x, y, Math.min(w, W - x - 16), Math.min(hh, H - y - 16));
      for (const [xx, yy] of [[x+8,y+8],[x+w-12,y+8],[x+8,y+hh-12],[x+w-12,y+hh-12]]) if (xx < W-10 && yy < H-10){ g.fillStyle = '#6d675a'; g.beginPath(); g.arc(xx, yy, 4, 0, 7); g.fill(); }
      txt(g, RU[r()*RU.length|0] + ' ' + (1 + r()*120|0), x + 14, y + 30, 15, '#3b3628', 'IBM Plex Sans, sans-serif');
    }
    if (r() < .5){ const x = 60 + r()*300, y = 300 + r()*150; g.fillStyle = '#2d2f2c'; g.fillRect(x, y, 90, 50); for (let i = 0; i < 4; i++){ g.fillStyle = ['#f44','#3d6','#fc3','#ddd'][i]; g.beginPath(); g.arc(x + 15 + i*20, y + 25, 5, 0, 7); g.fill(); ge.fillStyle = g.fillStyle; ge.beginPath(); ge.arc(x + 15 + i*20, y + 25, 5, 0, 7); ge.fill(); } }
    if (r() < .6){ g.fillStyle = '#d4c9a8'; g.beginPath(); g.roundRect(20 + r()*200, 200 + r()*200, 180 + r()*100, 120, 16); g.fill(); g.strokeStyle = '#8f8260'; g.stroke(); }
    for (let k = 0; k < 5; k++){ g.fillStyle = '#7d7564'; g.beginPath(); g.arc(r()*W, r()*H, 3, 0, 7); g.fill(); }
  }
  grain(g, W, H, 10, seed);
  return { map:tex(c), normalMap:tex(normalFrom(h, 2), { srgb:false }), emissiveMap:tex(e) };
}
function fabricTex(){ // BEAM: tela blanca acolchada
  const W = 512, H = 512, [c, g] = canvas(W, H), [h, gh] = canvas(W, H), r = rng(77);
  g.fillStyle = '#eceae3'; g.fillRect(0,0,W,H); gh.fillStyle = '#808080'; gh.fillRect(0,0,W,H);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++){ const gr = gh.createRadialGradient(i*64+32, j*64+32, 4, i*64+32, j*64+32, 44); gr.addColorStop(0,'#bbb'); gr.addColorStop(1,'#555'); gh.fillStyle = gr; gh.fillRect(i*64, j*64, 64, 64);
    g.fillStyle = `rgba(150,145,130,${.15 + r()*.1})`; g.fillRect(i*64, j*64, 64, 2); g.fillRect(i*64, j*64, 2, 64); }
  grain(g, W, H, 8, 3);
  return { map:tex(c, { rep:[4, 2] }), normalMap:tex(normalFrom(h, 3), { srgb:false, rep:[4, 2] }) };
}
function cableTex(){ // túneles: metal con mazos de cables
  const W = 256, H = 512, [c, g] = canvas(W, H), r = rng(31);
  g.fillStyle = '#8f969c'; g.fillRect(0,0,W,H);
  for (let i = 0; i < 14; i++){ const x = r()*W, w = 6 + r()*16; g.fillStyle = ['#2b2f33','#d8d8d0','#5a6a7a','#c9a04a','#3a3a3a'][r()*5|0]; g.fillRect(x, 0, w, H); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 1, 0, 2, H); }
  for (let j = 0; j < H; j += 60){ g.fillStyle = '#e2e2dc'; g.fillRect(0, j, W, 10); }
  grain(g, W, H, 12, 9);
  return tex(c);
}

// ================= geometría =================
const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
// rectángulo con agujero (redondo o cuadrado con esquinas redondeadas) → malla plana en XY
function holed(w, h, hole, m, uvRep = 1){
  const s = new THREE.Shape(); s.moveTo(-w/2, -h/2); s.lineTo(w/2, -h/2); s.lineTo(w/2, h/2); s.lineTo(-w/2, h/2); s.closePath();
  const p = new THREE.Path();
  if (hole.r) p.absarc(hole.x || 0, hole.y || 0, hole.r, 0, Math.PI*2, true);
  else { const a = hole.a, k = hole.k || .12, x = hole.x || 0, y = hole.y || 0;
    p.moveTo(x - a + k, y - a); p.lineTo(x + a - k, y - a); p.quadraticCurveTo(x + a, y - a, x + a, y - a + k); p.lineTo(x + a, y + a - k); p.quadraticCurveTo(x + a, y + a, x + a - k, y + a);
    p.lineTo(x - a + k, y + a); p.quadraticCurveTo(x - a, y + a, x - a, y + a - k); p.lineTo(x - a, y - a + k); p.quadraticCurveTo(x - a, y - a, x - a + k, y - a); }
  s.holes.push(p);
  const g = new THREE.ShapeGeometry(s, 24), uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i)/w + .5)*uvRep, pos.getY(i)/h + .5);
  return new THREE.Mesh(g, m);
}
// anillo de escotilla (marco) alrededor de un agujero, mirando a +z
function hatchRing(hole, m){
  const g = new THREE.Group();
  if (hole.r){ const t = new THREE.Mesh(new THREE.TorusGeometry(hole.r + .02, .05, 10, 40), m); g.add(t); }
  else { const a = hole.a; for (const [x, y, w, h] of [[0,a+.03,2*a+.12,.08],[0,-a-.03,2*a+.12,.08],[a+.03,0,.08,2*a],[-a-.03,0,.08,2*a]]){ const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .1), m); b.position.set(x, y, 0); g.add(b); } }
  return g;
}

// ================= construcción =================
export function buildInterior(opts = {}){
  const root = new THREE.Group(); root.name = 'interior';
  const r = rng(2024);
  // materiales
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const rackKinds = { lockers:[], stow:[], exp:[], esa:[], jaxa:[], sys:[], cq:[], whc:[], worf:[], hatch:[] };
  const rackMat = (kind) => { const a = rackKinds[kind]; if (a.length < (kind === 'exp' || kind === 'stow' ? 4 : kind === 'cq' || kind === 'whc' || kind === 'worf' || kind === 'hatch' ? 1 : 3)){
      const t = rackTex(kind, 100 + Object.keys(rackKinds).indexOf(kind)*10 + a.length);
      a.push(std({ map:t.map, normalMap:t.normalMap, normalScale:new THREE.Vector2(.8,.8), emissiveMap:t.emissiveMap, emissive:0xffffff, emissiveIntensity:.9, roughness:.62, metalness:.08 })); }
    return a[r()*a.length|0]; };
  const ruMats = {}; const ruMat = (kind) => { const a = ruMats[kind] ||= []; if (a.length < (kind === 'wall' ? 5 : 2)){ const t = ruTex(kind, 300 + a.length + kind.length*7);
      a.push(std({ map:t.map, normalMap:t.normalMap, normalScale:new THREE.Vector2(.6,.6), emissiveMap:t.emissiveMap, emissive:0xffffff, emissiveIntensity:kind === 'light' ? 1.4 : .8, roughness:.75, metalness:.02, side:THREE.DoubleSide })); }
    return a[r()*a.length|0]; };
  const M = {
    chamfer: std({ color:0xb4b9be, roughness:.5, metalness:.5 }),
    lightPanel: std({ color:0xffffff, emissive:0xf2f5ff, emissiveIntensity:2.2, roughness:.4 }),
    endwall: std({ color:0xaeb3b8, roughness:.45, metalness:.6, side:THREE.DoubleSide }),
    ring: std({ color:0x8d949a, roughness:.35, metalness:.85 }),
    tunnel: std({ map:cableTex(), roughness:.55, metalness:.5, side:THREE.BackSide }),
    tunnelSq: std({ color:0xa9afb4, roughness:.42, metalness:.6, side:THREE.DoubleSide }),
    rail: std({ color:0xe7e9ea, roughness:.4, metalness:.3 }),
    railRu: std({ color:0xd8d0b8, roughness:.45, metalness:.3 }),
    dark: std({ color:0x26292c, roughness:.5, metalness:.4 }),
    alu: std({ color:0xc5cad0, roughness:.3, metalness:.9 }),
    blue: std({ color:0x2f5f9a, roughness:.6 }),
    laptop: std({ color:0x2b2d30, roughness:.45, metalness:.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color:0xffffff, roughness:.02, metalness:0, transparent:true, opacity:.08, envMapIntensity:1.6, side:THREE.DoubleSide, depthWrite:false }),
    fabric: (() => { const t = fabricTex(); return std({ map:t.map, normalMap:t.normalMap, roughness:.92, side:THREE.BackSide }); })(),
    bag: [0xe8dfca, 0xf1f0ea, 0xd9cdb0, 0xece3cc].map(c => std({ color:c, roughness:.95 })),
    strap: std({ color:0xb9a77a, roughness:.9 }),
    cable: [0x2b2f33, 0xe0e0d8, 0x45607a, 0xc9a04a].map(c => std({ color:c, roughness:.6, metalness:.1 })),
    suitW: std({ color:0xf3f2ee, roughness:.85 }), visor: std({ color:0xd4a64a, roughness:.08, metalness:1 }),
    table: std({ color:0x9aa2a8, roughness:.4, metalness:.6 }),
    food: [0xd9502f, 0xe8c547, 0x5aa45e, 0xd8d8d8, 0x8a5a3a].map(c => std({ color:c, roughness:.5, metalness:.2 })),
  };
  const screenTex = (() => { const [c, g] = canvas(256, 160); g.fillStyle = '#0d2a46'; g.fillRect(0,0,256,160); g.fillStyle = '#1e6fb0'; g.fillRect(0,0,256,22);
    g.fillStyle = '#fff'; g.font = '600 12px sans-serif'; g.fillText('OPS · Procedure 2.105 · Step 7', 8, 15);
    for (let i = 0; i < 8; i++){ g.fillStyle = i === 3 ? '#ffd36b' : '#cfe3ff'; g.fillRect(10, 34 + i*14, 60 + Math.random()*170, 6); }
    const t = tex(c); return std({ map:t, emissiveMap:t, emissive:0xffffff, emissiveIntensity:1.1, roughness:.2 }); })();
  const screenTex2 = (() => { const [c, g] = canvas(256, 160); g.fillStyle = '#041018'; g.fillRect(0,0,256,160);
    g.strokeStyle = '#2f7'; g.lineWidth = 1; for (let k = 0; k < 4; k++){ g.beginPath(); for (let x = 0; x < 256; x += 4) g.lineTo(x, 80 + Math.sin(x*.05 + k)*30*Math.sin(k+1)); g.stroke(); }
    g.fillStyle = '#9fd'; g.font = '600 11px monospace'; g.fillText('ISS ORBIT · GMT 326/14:05', 8, 14); const t = tex(c); return std({ map:t, emissiveMap:t, emissive:0xffffff, emissiveIntensity:1.1, roughness:.2 }); })();

  const vols = [], openings = {}, info = {}, windows = [];
  const add = (parent, o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); parent.add(o); return o; };

  // --- aberturas por módulo (para enlaces y escotillas cerradas) ---
  const local = {}; // matrices de cada módulo
  for (const m of MODS){
    const q = orientQ(modDir(m)), mat = new THREE.Matrix4().compose(V(...m.c), q, V(1,1,1));
    local[m.id] = { q, mat, inv:mat.clone().invert(), dir:modDir(m) }; openings[m.id] = [];
  }
  const toLocal = (id, v) => v.clone().applyMatrix4(local[id].inv);
  const dirLocal = (id, d) => d.clone().applyQuaternion(local[id].q.clone().invert()).round();
  // largo interior útil
  const half = (m) => US.has(m.tipo) ? m.L/2 - .75 : m.tipo === 'cupula' ? .55 : m.tipo === 'inflable' ? m.L/2 - .25 : m.tipo === 'tunel' ? m.L/2 : m.tipo === 'esfera' ? 1.25 : m.L/2 - .4;
  const apo = (m, x) => { // apotema interior de un módulo ruso en la posición x local
    if (m.tipo === 'esfera') return 1.25; if (m.tipo === 'tunel') return .9; if (m.tipo === 'inflable') return 1.45;
    const R = m.R - .5, Rn = (m.Rn || m.R) - .42, nL = m.nLen || 0; if (!nL) return R;
    const x1 = m.L/2 - nL, x0 = x1 - .9; return x >= x1 ? Rn : x <= x0 ? R : R + (Rn - R)*(x - x0)/.9; };
  // en estos enlaces el primer módulo tiene la escotilla en un costado; en los demás, las dos están en los extremos
  const RADIAL = new Set(['unity|quest','unity|tranquility','harmony|columbus','harmony|kibo','kibo|jlp','tranquility|cupola','tranquility|pmm','tranquility|beam','zarya|rassvet','zvezda|poisk','zvezda|nauka']);
  for (const [a, b] of LINKS){
    for (const [p, q] of [[a, b], [b, a]]){
      const mp = MOD[p], mq = MOD[q], dW = V(...mq.c).sub(V(...mp.c)), axisW = local[p].dir;
      const along = dW.dot(axisW), perp = dW.clone().addScaledVector(axisW, -along);
      let kind, pos, dir;
      if (!RADIAL.has(p + '|' + q)){ kind = 'axial'; dir = along >= 0 ? 1 : -1; pos = dir * half(mp); }
      else { kind = 'radial'; pos = along; dir = dirLocal(p, perp.normalize()); }
      openings[p].push({ to:q, kind, pos, dir });
    }
  }
  for (const c of CLOSED){
    const m = MOD[c.m], d = AXV[c.dir], ax = local[c.m].dir, al = d.dot(ax);
    if (Math.abs(al) > .5) openings[c.m].push({ kind:'axial', pos:Math.sign(al) * half(m), dir:Math.sign(al), closed:c.t });
    else openings[c.m].push({ kind:'radial', pos:0, dir:dirLocal(c.m, d), closed:c.t });
  }
  // ventanas (agujeros con vidrio por donde se ve la Tierra)
  openings.zvezda.push({ kind:'radial', pos:-1.85, dir:V(0,-1,0), win:true });
  openings.zvezda.push({ kind:'radial', pos:.6, dir:V(0,0,1), win:true });
  // punto de la abertura en coordenadas locales del módulo
  const openPt = (m, o) => {
    if (o.kind === 'axial'){ const x = o.pos; return V(x, 0, 0); }
    const w = US.has(m.tipo) ? HW : apo(m, o.pos); return V(o.pos, 0, 0).addScaledVector(o.dir, w);
  };

  // --- piezas comunes ---
  const handrail = (len, mat = M.rail) => { const g = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, len, 8), mat); bar.rotation.z = Math.PI/2; g.add(bar);
    for (const s of [-1, 1]){ const f = new THREE.Mesh(new THREE.BoxGeometry(.03, .06, .03), mat); f.position.set(s*(len/2 - .03), 0, -.03); g.add(f); } return g; };
  // laptop en su brazo: pantalla paralela a la pared mirando al pasillo (+z), teclado hacia afuera por debajo
  const laptop = () => { const g = new THREE.Group();
    const lid = new THREE.Mesh(new THREE.BoxGeometry(.34, .24, .014), M.laptop); lid.position.set(0, .06, .3); g.add(lid);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(.31, .2), r() < .5 ? screenTex : screenTex2); sc.position.set(0, .06, .308); g.add(sc);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(.34, .018, .24), M.laptop); kb.position.set(0, -.065, .42); kb.rotation.x = .15; g.add(kb);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .3, 6), M.alu); arm.rotation.x = Math.PI/2; arm.position.set(0, .02, .15); g.add(arm); return g; };
  const ctb = (s = 1) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.5*s, .42*s, .25*s, 2, 2, 2), M.bag[r()*4|0]);
    const p = b.geometry.attributes.position; for (let i = 0; i < p.count; i++){ const v = V(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 - .06*Math.abs(Math.sin(i))); p.setXYZ(i, v.x, v.y, v.z); } b.geometry.computeVertexNormals(); g.add(b);
    for (const x of [-.12, .12]){ const st = new THREE.Mesh(new THREE.BoxGeometry(.035*s, .43*s, .26*s), M.strap); st.position.x = x*s; g.add(st); } return g; };
  const cables = (pts, k = 0) => { const c = new THREE.CatmullRomCurve3(pts); return new THREE.Mesh(new THREE.TubeGeometry(c, 40, .012 + r()*.012, 6), M.cable[k % 4]); };

  // ======= módulo estadounidense / europeo / japonés =======
  function usInterior(m){
    const g = new THREE.Group(), hl = half(m), L = 2*hl, ops = openings[m.id];
    const kinds = { destiny:['exp','sys','exp','lockers','exp','exp'], harmony:['stow','sys','lockers','stow'], columbus:['esa','esa','esa','esa'], kibo:['jaxa','jaxa','lockers','jaxa','jaxa','stow','jaxa','jaxa','jaxa'],
      jlp:['stow','stow'], tranquility:['sys','sys','stow','sys'], pmm:['stow','stow','stow','lockers','stow'], quest:['sys','lockers'], unity:['stow','sys','stow'] }[m.id] || ['stow'];
    // cuatro paredes: (normal local, vector "arriba" de la cara, posición)
    const walls = [ { n:V(0,-1,0), id:'deck' }, { n:V(0,1,0), id:'ovhd' }, { n:V(0,0,1), id:'stbd' }, { n:V(0,0,-1), id:'port' } ];
    walls.forEach((w, wi) => {
      const holes = ops.filter(o => o.kind === 'radial' && o.dir.equals(w.n));
      // reparto de espacios: abertura de 1,06 m centrada en cada agujero, racks en lo demás
      const slots = []; let x = -hl;
      const marks = holes.map(o => o.pos).sort((a, b) => a - b);
      for (const hp of [...marks, Infinity]){
        const end = hp === Infinity ? hl : hp - RW/2;
        while (x + RW <= end + .01){ slots.push({ x:x + RW/2, w:RW, k:'rack' }); x += RW; }
        if (end - x > .05) { slots.push({ x:(x + end)/2, w:end - x, k:'fill' }); x = end; }
        if (hp !== Infinity){ const o = holes.find(o => o.pos === hp); slots.push({ x:hp, w:RW, k:'hole', o }); x = hp + RW/2; }
      }
      slots.forEach((s, si) => {
        let mesh;
        const kind = s.k === 'rack' ? (m.id === 'harmony' && si === 0 ? 'cq' : m.id === 'destiny' && w.id === 'deck' && si === 3 ? 'worf' : m.id === 'tranquility' && w.id === 'stbd' && si === 0 ? 'whc' : kinds[(si + wi*2) % kinds.length]) : null;
        if (s.k === 'hole' || kind === 'worf'){
          const hole = kind === 'worf' ? { r:.25 } : { a:.46, k:.14 };
          mesh = holed(s.w, FW, hole, s.k === 'hole' ? rackMat('hatch') : rackMat('worf'));
        } else if (s.k === 'fill'){ mesh = plane(s.w, FW, M.chamfer); }
        else mesh = plane(RW, FW, rackMat(kind));
        // orientar la cara: mirando hacia el centro, a lo largo del eje x
        const o = new THREE.Object3D(); o.position.copy(w.n).multiplyScalar(HW); o.position.x = s.x;
        // las paredes laterales quedan con el texto derecho (arriba = techo)
        const xAx = V(w.n.z > .5 ? -1 : 1, 0, 0), zAx = w.n.clone().negate(), yAx = zAx.clone().cross(xAx);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
        mesh.position.copy(o.position); g.add(mesh);
        if (kind === 'worf' || (s.o && s.o.win)){ const gl = new THREE.Mesh(new THREE.CircleGeometry(.25, 32), M.glass); gl.quaternion.copy(mesh.quaternion); gl.position.copy(mesh.position).addScaledVector(w.n, .02); g.add(gl);
          const rg = new THREE.Mesh(new THREE.TorusGeometry(.26, .03, 8, 32), M.ring); rg.quaternion.copy(mesh.quaternion); rg.position.copy(mesh.position).addScaledVector(w.n, -.01); g.add(rg); }
        if (s.k === 'hole' && s.o){
          const ring = hatchRing({ a:.46 }, M.ring); ring.position.copy(mesh.position).addScaledVector(w.n, -.04); ring.quaternion.copy(mesh.quaternion); g.add(ring);
          if (s.o.closed) closedHatch(g, mesh.position.clone().addScaledVector(w.n, .25), mesh.quaternion, s.o.closed, false);
          else tunnelFrom(m, s.o, mesh.position.clone());
        }
        if (s.k === 'rack' && kind !== 'cq'){
          // pasamanos y algo de equipo sobre la cara
          const h = handrail(.6); h.quaternion.copy(mesh.quaternion); h.position.copy(mesh.position).addScaledVector(w.n, -.07).addScaledVector(yAx, (r() - .5)*.6); h.rotateZ(Math.PI/2*(r() < .5 ? 0 : 1)); g.add(h);
          if (r() < .3 && w.id !== 'deck'){ const lt = laptop(); lt.quaternion.copy(mesh.quaternion); lt.position.copy(mesh.position).addScaledVector(xAx, (r()-.5)*.4).addScaledVector(yAx, .15); g.add(lt); }
          else if (r() < .35){ const b = ctb(.9); b.quaternion.copy(mesh.quaternion); b.position.copy(mesh.position).addScaledVector(w.n, -.13).addScaledVector(xAx, (r()-.5)*.4).addScaledVector(yAx, (r()-.5)*.6); b.rotateZ((r()-.5)*.5); g.add(b); }
        }
      });
    });
    // esquinas biseladas: luces arriba, servicios abajo
    for (const [sy, sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
      const n = V(0, sy, sz).normalize(), c = V(0, sy*(HW + FW/2)/2, sz*(HW + FW/2)/2);
      const p = plane(L, CH, M.chamfer); const zAx = n.clone().negate(), xAx = V(1,0,0), yAx = zAx.clone().cross(xAx);
      p.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx)); p.position.copy(c); g.add(p);
      if (sy > 0) for (let x = -hl + .6; x < hl - .4; x += 1.6){ const lp = plane(.9, .16, M.lightPanel); lp.quaternion.copy(p.quaternion); lp.position.copy(c).addScaledVector(n, -.01); lp.position.x = x; g.add(lp); }
      else for (let k = 0; k < 3; k++){ const y0 = c.clone().addScaledVector(n, -.04 - k*.025); g.add(cables([V(-hl, y0.y, y0.z), V(-hl/3, y0.y - sy*.01*(k-1), y0.z + .02*(k-1)), V(hl/3, y0.y, y0.z - .02), V(hl, y0.y, y0.z)], k)); }
    }
    // paredes de los extremos con su escotilla
    for (const s of [-1, 1]){
      const o = ops.find(o => o.kind === 'axial' && o.dir === s);
      const shape = new THREE.Shape(); const a = HW, b = FW/2;
      shape.moveTo(-b, -a); shape.lineTo(b, -a); shape.lineTo(a, -b); shape.lineTo(a, b); shape.lineTo(b, a); shape.lineTo(-b, a); shape.lineTo(-a, b); shape.lineTo(-a, -b); shape.closePath();
      if (o){ const p = new THREE.Path(); const k = .14, h = .46; p.moveTo(-h + k, -h); p.lineTo(h - k, -h); p.quadraticCurveTo(h, -h, h, -h + k); p.lineTo(h, h - k); p.quadraticCurveTo(h, h, h - k, h); p.lineTo(-h + k, h); p.quadraticCurveTo(-h, h, -h, h - k); p.lineTo(-h, -h + k); p.quadraticCurveTo(-h, -h, -h + k, -h); shape.holes.push(p); }
      const ew = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), M.endwall); ew.rotation.y = s > 0 ? -Math.PI/2 : Math.PI/2; ew.position.x = s*hl; g.add(ew);
      if (!o){ // pared ciega con equipo
        for (let k = 0; k < 3; k++){ const b = ctb(1.1); b.position.set(s*(hl - .25), -.4 + k*.4, (r()-.5)*.8); g.add(b); }
        continue;
      }
      const ring = hatchRing({ a:.46 }, M.ring); ring.rotation.y = ew.rotation.y; ring.position.x = s*(hl - .03); g.add(ring);
      for (const z of [-.62, .62]){ const h = handrail(.7); h.rotation.set(0, ew.rotation.y, Math.PI/2); h.position.set(s*(hl - .06), 0, z); g.add(h); }
      if (o.closed) closedHatch(g, V(s*(hl + .2), 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ew.rotation.y, 0)), o.closed, false);
      else tunnelFrom(m, o, V(s*hl, 0, 0));
    }
    // volúmenes recorribles
    vols.push({ m:m.id, kind:'box', inv:local[m.id].inv, min:V(-hl + .25, -HW + .3, -HW + .3), max:V(hl - .25, HW - .3, HW - .3) });
    return g;
  }

  // ======= módulo ruso (sección octogonal) =======
  function ruInterior(m){
    const g = new THREE.Group(), hl = half(m), ops = openings[m.id];
    const fab = m.tipo === 'inflable';
    // tramos de 1 m a lo largo del eje
    const n = 2*Math.floor(Math.max(2, Math.round(2*hl / 1.0))/2) + 1, dx = 2*hl / n;
    for (let i = 0; i < n; i++){
      const x0 = -hl + i*dx, x1 = x0 + dx, xm = (x0 + x1)/2, a0 = apo(m, x0), a1 = apo(m, x1);
      for (let k = 0; k < 8; k++){
        const ang = k*Math.PI/4, nrm = V(0, Math.cos(ang), Math.sin(ang)); // k=0 arriba, k=4 piso
        const am = (a0 + a1)/2, w = 2*am*Math.tan(Math.PI/8);
        const hole = ops.find(o => o.kind === 'radial' && Math.abs(o.pos - xm) < dx/2 && o.dir.dot(nrm) > .95);
        let mat = fab ? null : k === 4 ? ruMat('floor') : (k === 1 || k === 7) && i % 2 ? ruMat('light') : k === 3 || k === 5 ? ruMat('green') : ruMat('wall');
        let mesh;
        if (fab){ continue; }
        if (hole){ mesh = holed(dx, w, { r:Math.min(.4, w*.42), x:hole.pos - xm }, mat); }
        else if (Math.abs(a0 - a1) > .01){ // tramo cónico: trapecio
          const geo = new THREE.BufferGeometry(), w0 = 2*a0*Math.tan(Math.PI/8), w1 = 2*a1*Math.tan(Math.PI/8);
          const pos = new Float32Array([-dx/2,-w0/2,(a0-am), dx/2,-w1/2,(a1-am), dx/2,w1/2,(a1-am), -dx/2,w0/2,(a0-am)]);
          // la cara mira hacia −z local de la cara (hacia el eje) después de orientarla; z positivo = hacia afuera
          for (let q = 2; q < 12; q += 3) pos[q] = -pos[q];
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]), 2)); geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
          mesh = new THREE.Mesh(geo, mat);
        } else mesh = plane(dx, w, mat);
        const zAx = nrm.clone().negate(), xAx = V(1,0,0), yAx = zAx.clone().cross(xAx);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx)); mesh.position.copy(nrm).multiplyScalar(am); mesh.position.x = xm; g.add(mesh);
        if (hole){
          const ring = hatchRing({ r:Math.min(.4, w*.42) }, M.ring); ring.quaternion.copy(mesh.quaternion); ring.position.copy(mesh.position).addScaledVector(nrm, -.03); ring.position.x = hole.pos; g.add(ring);
          if (hole.closed) closedHatch(g, ring.position.clone().addScaledVector(nrm, .2), mesh.quaternion, hole.closed, true);
          else if (hole.win){ const gl = new THREE.Mesh(new THREE.CircleGeometry(Math.min(.4, w*.42), 32), M.glass); gl.quaternion.copy(mesh.quaternion); gl.position.copy(ring.position).addScaledVector(nrm, .03); g.add(gl); }
          else tunnelFrom(m, hole, V(hole.pos, 0, 0).addScaledVector(nrm, am));
        }
        if (!hole && (k === 2 || k === 6) && r() < .55){ const h = handrail(.55, M.railRu); h.quaternion.copy(mesh.quaternion); h.position.copy(mesh.position).addScaledVector(nrm, -.06); g.add(h); }
        if (!hole && k !== 4 && k !== 0 && r() < .22){ const b = ctb(.8); b.quaternion.copy(mesh.quaternion); b.position.copy(mesh.position).addScaledVector(nrm, -.14); b.rotateZ(r()); g.add(b); }
      }
    }
    if (fab){ // BEAM: cilindro de tela con mamparos
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 2*hl, 32, 1, true), M.fabric); cyl.rotation.z = Math.PI/2; g.add(cyl);
      for (const x of [-hl*.4, hl*.4]){ const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.35, .04, 8, 36), M.alu); ringB.rotation.y = Math.PI/2; ringB.position.x = x; g.add(ringB); }
      for (let k = 0; k < 10; k++){ const b = ctb(1); const a = r()*Math.PI*2; b.position.set((r()-.5)*2*hl*.8, Math.cos(a)*1.15, Math.sin(a)*1.15); b.lookAt(0, 0, 0); g.add(b); }
    }
    // extremos (octógono con escotilla redonda)
    for (const s of [-1, 1]){
      const a = apo(m, s*hl), o = ops.find(o => o.kind === 'axial' && o.dir === s), rh = Math.min(.4, a*.45);
      const shape = new THREE.Shape(); for (let k = 0; k < 8; k++){ const an = (k + .5)*Math.PI/4, rr = a / Math.cos(Math.PI/8); const yy = Math.cos(an)*rr, zz = Math.sin(an)*rr; k ? shape.lineTo(zz, yy) : shape.moveTo(zz, yy); } shape.closePath();
      if (o){ const p = new THREE.Path(); p.absarc(0, 0, rh, 0, Math.PI*2, true); shape.holes.push(p); }
      const ew = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), fab ? M.endwall : ruMat('green')); ew.rotation.y = s > 0 ? -Math.PI/2 : Math.PI/2; ew.position.x = s*hl; g.add(ew);
      if (!o) continue;
      const ring = hatchRing({ r:rh }, M.ring); ring.rotation.y = ew.rotation.y; ring.position.x = s*(hl - .03); g.add(ring);
      if (o.closed) closedHatch(g, V(s*(hl + .15), 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ew.rotation.y, 0)), o.closed, true);
      else tunnelFrom(m, o, V(s*hl, 0, 0));
    }
    // volúmenes: por tramos (ancho y angosto)
    const steps = 6; for (let i = 0; i < steps; i++){ const x0 = -hl + i*2*hl/steps, x1 = x0 + 2*hl/steps; vols.push({ m:m.id, kind:'cyl', inv:local[m.id].inv, x0:x0 + (i ? -.05 : .25), x1:x1 + (i === steps-1 ? -.25 : .05), r:Math.min(apo(m, x0), apo(m, x1)) - .3 }); }
    return g;
  }

  // ======= Cúpula =======
  function cupolaInterior(m){
    const g = new THREE.Group(); // en local: +x hacia abajo (hacia la Tierra)
    const R0 = 1.2, R1 = .66, x0 = -.55, x1 = .55, hexPt = (R, k, x) => V(x, Math.cos(k*Math.PI/3)*R, Math.sin(k*Math.PI/3)*R);
    for (let k = 0; k < 6; k++){
      const a = hexPt(R0, k, x0), b = hexPt(R0, k+1, x0), c = hexPt(R1, k+1, x1), d = hexPt(R1, k, x1);
      // marco del vidrio trapezoidal: cuatro tiras
      const frame = (p, q, w) => { const len = p.distanceTo(q), mid = p.clone().add(q).multiplyScalar(.5), bx = new THREE.Mesh(new THREE.BoxGeometry(len, w, .08), M.alu);
        bx.position.copy(mid); bx.quaternion.setFromUnitVectors(V(1,0,0), q.clone().sub(p).normalize()); g.add(bx); };
      frame(a, b, .16); frame(d, c, .1); frame(a, d, .12);
      const glass = new THREE.BufferGeometry(); const sh = (v, t) => v.clone().lerp(V(v.x, 0, 0), t);
      const p = [sh(a,.08), sh(b,.08), sh(c,.1), sh(d,.1)]; glass.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.flatMap(v => [v.x, v.y, v.z])), 3)); glass.setIndex([0,1,2,0,2,3]); glass.computeVertexNormals();
      g.add(new THREE.Mesh(glass, M.glass));
    }
    // ventana central redonda de 80 cm
    const topS = new THREE.Shape(); for (let k = 0; k < 6; k++){ const v = hexPt(R1 + .04, k, 0); k ? topS.lineTo(v.z, v.y) : topS.moveTo(v.z, v.y); } topS.closePath();
    const hp = new THREE.Path(); hp.absarc(0, 0, .4, 0, Math.PI*2, true); topS.holes.push(hp);
    const top = new THREE.Mesh(new THREE.ShapeGeometry(topS, 32), M.endwall); top.rotation.y = -Math.PI/2; top.position.x = x1; g.add(top);
    const tg = new THREE.Mesh(new THREE.CircleGeometry(.4, 40), M.glass); tg.rotation.y = -Math.PI/2; tg.position.x = x1 + .02; g.add(tg);
    const tr = new THREE.Mesh(new THREE.TorusGeometry(.41, .035, 8, 40), M.ring); tr.rotation.y = Math.PI/2; tr.position.x = x1 - .01; g.add(tr);
    // base: anillo hexagonal con la entrada cuadrada
    const baseS = new THREE.Shape(); for (let k = 0; k < 6; k++){ const v = hexPt(R0 + .02, k, 0); k ? baseS.lineTo(v.z, v.y) : baseS.moveTo(v.z, v.y); } baseS.closePath();
    const bh = new THREE.Path(); const h = .46, kk = .14; bh.moveTo(-h+kk,-h); bh.lineTo(h-kk,-h); bh.quadraticCurveTo(h,-h,h,-h+kk); bh.lineTo(h,h-kk); bh.quadraticCurveTo(h,h,h-kk,h); bh.lineTo(-h+kk,h); bh.quadraticCurveTo(-h,h,-h,h-kk); bh.lineTo(-h,-h+kk); bh.quadraticCurveTo(-h,-h,-h+kk,-h); baseS.holes.push(bh);
    const base = new THREE.Mesh(new THREE.ShapeGeometry(baseS, 16), M.endwall); base.rotation.y = Math.PI/2; base.position.x = x0; g.add(base);
    // estación robótica: dos palancas y laptops
    for (const s of [-1, 1]){ const hc = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .18, 8), M.dark); st.position.y = .09; hc.add(st);
      const kn = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), M.dark); kn.position.y = .2; hc.add(kn); const bs = new THREE.Mesh(new THREE.BoxGeometry(.14, .05, .14), M.alu); hc.add(bs);
      hc.position.set(x0 + .12, -.75, s*.55); hc.rotation.z = -Math.PI/2*.0; g.add(hc); }
    for (const s of [-1, 0, 1]){ const lt = laptop(); lt.position.set(x0 + .1, -.95, s*.42); lt.rotation.set(0, Math.PI/2, Math.PI/2*.9); lt.scale.setScalar(.9); g.add(lt); }
    for (let k = 0; k < 6; k++){ const v = hexPt(R0 - .1, k + .5, x0 + .08); const hr = handrail(.5); hr.position.copy(v); hr.lookAt(V(x0, 0, 0)); g.add(hr); }
    vols.push({ m:m.id, kind:'cyl', inv:local[m.id].inv, x0:x0 - .3, x1:x1 - .25, r:.62 });
    return g;
  }

  // ======= túneles entre módulos =======
  const tunnelDone = new Set(), tunnels = {};
  function tunnelFrom(m, o, ptLocal){
    const key = [m.id, o.to].sort().join('|'); if (tunnelDone.has(key)) { return; }
    const pairs = openings[o.to].find(p => p.to === m.id); if (!pairs) return;
    tunnelDone.add(key);
    const mq = MOD[o.to], a = ptLocal.clone().applyMatrix4(local[m.id].mat), b = openPt(mq, pairs).applyMatrix4(local[o.to].mat);
    const len = a.distanceTo(b); if (len < .02) return;
    const d = b.clone().sub(a).normalize(), mid = a.clone().add(b).multiplyScalar(.5);
    const square = US.has(m.tipo) && US.has(mq.tipo);
    let t;
    if (square){ t = new THREE.Mesh(new THREE.BoxGeometry(len + .02, .92, .92, 1, 1, 1), M.tunnelSq); t.geometry.groups = t.geometry.groups.filter((_, i) => i > 1);
      // mazos de cables en las esquinas del vestíbulo y anillos de pernos
      for (const [y, z] of [[.4,.4],[-.4,.4],[.4,-.4],[-.4,-.4]]){ const c = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, len, 8), M.cable[(y > 0 ? 1 : 0) + (z > 0 ? 2 : 0)]); c.rotation.z = Math.PI/2; c.position.set(0, y*.92, z*.92); t.add(c); }
      for (const x of [-len/2 + .05, len/2 - .05]){ const ring = hatchRing({ a:.44 }, M.ring); ring.rotation.y = Math.PI/2; ring.position.x = x; t.add(ring); } }
    else { const rr = Math.min(.4, ...[m, mq].map(mm => mm.tipo === 'cupula' ? .46 : US.has(mm.tipo) ? .46 : apo(mm, 0) * .45)); t = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, len + .02, 24, 1, true), M.tunnel); t.geometry.rotateZ(Math.PI/2); }
    t.position.copy(mid); t.quaternion.setFromUnitVectors(V(1,0,0), d); root.add(t);
    tunnels[key] = { [m.id]:{ wall:a.clone(), axis:V(o.kind === 'axial' ? o.pos - Math.sign(o.pos)*.3 : o.pos, 0, 0).applyMatrix4(local[m.id].mat) },
                     [o.to]:{ wall:b.clone(), axis:V(pairs.kind === 'axial' ? pairs.pos - Math.sign(pairs.pos)*.3 : pairs.pos, 0, 0).applyMatrix4(local[o.to].mat) } };
    vols.push({ m:null, kind:'seg', a:a.clone().addScaledVector(d, -.6), b:b.clone().addScaledVector(d, .6), r:square ? .33 : t.geometry.parameters.radiusTop*.72, link:[m.id, o.to] });
  }
  // escotilla cerrada con rótulo
  function closedHatch(g, pos, q, text, round){
    const door = round ? new THREE.Mesh(new THREE.CircleGeometry(.4, 32), M.endwall) : new THREE.Mesh(new THREE.PlaneGeometry(.92, .92), M.endwall);
    door.quaternion.copy(q); door.position.copy(pos); g.add(door);
    // paredes del vestíbulo entre la pared del módulo y la escotilla, para que no se vea el espacio por los lados
    const vg = round ? new THREE.CylinderGeometry(.41, .41, .3, 28, 1, true) : new THREE.BoxGeometry(.94, .3, .94);
    if (!round) vg.groups = vg.groups.filter((_, i) => i !== 2 && i !== 3);
    vg.rotateX(Math.PI/2); const vest = new THREE.Mesh(vg, M.tunnelSq); vest.quaternion.copy(q); vest.position.copy(pos).add(V(0, 0, .14).applyQuaternion(q)); g.add(vest);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(.1, .02, 6, 16), M.dark); hd.quaternion.copy(q); hd.position.copy(pos).add(V(0,0,.02).applyQuaternion(q)); g.add(hd);
    const [c, cg] = canvas(512, 96); cg.fillStyle = 'rgba(10,14,20,.82)'; cg.fillRect(0,0,512,96); cg.fillStyle = '#ffd36b'; cg.font = '600 22px IBM Plex Sans, sans-serif'; cg.fillText('ESCOTILLA CERRADA', 18, 34); cg.fillStyle = '#fff'; cg.font = '600 26px IBM Plex Sans, sans-serif'; cg.fillText(text.slice(0, 32), 18, 74);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.62, .116), new THREE.MeshBasicMaterial({ map:tex(c), transparent:true })); lab.quaternion.copy(q); lab.position.copy(pos).add(V(0, .3, .03).applyQuaternion(q)); g.add(lab);
  }

  // ======= equipos especiales =======
  function extras(m, g){
    if (m.id === 'unity'){ // mesa del comedor
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.1, .04, .62), M.table); t.position.set(0, -.55, 0); g.add(t);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .4, 8), M.alu); leg.position.set(0, -.78, 0); g.add(leg);
      for (let k = 0; k < 7; k++){ const f = new THREE.Mesh(new THREE.BoxGeometry(.12, .02, .16), M.food[k % 5]); f.position.set(-.4 + k*.13, -.52, (r()-.5)*.35); f.rotation.y = r(); g.add(f); }
      const sp = new THREE.Mesh(new THREE.BoxGeometry(.16, .005, .02), M.alu); sp.position.set(.2, -.5, .2); g.add(sp); sp.userData.float = true;
    }
    if (m.id === 'tranquility'){ // T2, ARED
      const t2 = new THREE.Group(); const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, .18, .6), M.dark); t2.add(deck); const belt = new THREE.Mesh(new THREE.BoxGeometry(1.4, .02, .5), M.laptop); belt.position.y = .1; t2.add(belt);
      for (const s of [-1, 1]){ const bg = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .9, 6), M.blue); bg.position.set(0, .55, s*.22); t2.add(bg); }
      const h = new THREE.Mesh(new THREE.TorusGeometry(.2, .04, 8, 20), M.blue); h.position.y = 1.0; h.rotation.x = Math.PI/2; t2.add(h);
      t2.rotation.x = Math.PI/2; t2.position.set(0, 0, -HW + .12); t2.rotation.z = 0; g.add(t2);
      const ared = new THREE.Group(); const fr = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .08), M.alu); ared.add(fr);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.3, 8), M.alu); bar.rotation.x = Math.PI/2; bar.position.set(.4, .4, 0); ared.add(bar);
      for (const s of [-1, 1]){ const cy = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .45, 14), M.dark); cy.position.set(-.3, .25, s*.35); ared.add(cy); }
      ared.position.set(.9, -HW + .2, .3); g.add(ared);
    }
    if (m.id === 'quest'){ // dos trajes EMU
      for (const s of [-1, 1]){ const suit = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.26, .4, 6, 16), M.suitW); suit.add(torso);
        const helm = new THREE.Mesh(new THREE.SphereGeometry(.19, 20, 14), M.suitW); helm.position.y = .55; suit.add(helm);
        const vis = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14, -.9, 1.8, .9, 1.1), M.visor); vis.position.set(0, .55, .03); vis.rotation.y = Math.PI/2; suit.add(vis);
        const pack = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .22), M.suitW); pack.position.z = -.3; suit.add(pack);
        for (const a of [-1, 1]){ const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.08, .5, 4, 10), M.suitW); arm.position.set(a*.36, .05, 0); arm.rotation.z = a*.25; suit.add(arm);
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .55, 4, 10), M.suitW); leg.position.set(a*.13, -.7, 0); suit.add(leg); }
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(.12, .07), M.blue); flag.position.set(.27, .2, .2); suit.add(flag);
        suit.position.set(-.6 + (s+1)*.55, -.1, s*.45); suit.rotation.y = s > 0 ? -Math.PI/2 : Math.PI/2; suit.rotation.x = .1; g.add(suit); }
    }
    if (m.id === 'zvezda'){ // mesa y cabinas
      const t = new THREE.Mesh(new THREE.BoxGeometry(.9, .06, .7), M.table); t.position.set(0, -1.05, 0); g.add(t);
      for (let k = 0; k < 5; k++){ const can = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .06, 14), M.alu); can.position.set(-.2 + k*.1, -1.0, (r()-.5)*.4); g.add(can); }
      for (const s of [-1, 1]){ const cab = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.7, .35), ruMat('wall')); cab.position.set(-.5, 0, s*(apo(m, -.5) - .25)); g.add(cab);
        const w = new THREE.Mesh(new THREE.CircleGeometry(.09, 20), M.glass); w.position.set(-.5, .5, s*(apo(m, -.5) - .43)); w.rotation.y = s > 0 ? Math.PI : 0; g.add(w); }
      const bd2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, .14, .5), M.dark); bd2.position.set(-3.4, -apo(m, -3.4) + .1, 0); g.add(bd2);
    }
    if (m.id === 'kibo'){ const con = new THREE.Group(); for (let k = 0; k < 3; k++){ const lt = laptop(); lt.position.set(-.4 + k*.4, 0, 0); con.add(lt); } con.position.set(3.4, -.75, .55); g.add(con); }
  }

  for (const m of MODS){
    let g;
    if (US.has(m.tipo)) g = usInterior(m);
    else if (m.tipo === 'cupula') g = cupolaInterior(m);
    else g = ruInterior(m);
    extras(m, g);
    g.position.set(...m.c); g.quaternion.copy(local[m.id].q); g.userData.mod = m.id; root.add(g); info[m.id] = g;
  }
  // objetos que flotan (cámara, bolígrafo, bolsa de comida, botella)
  const floaters = [];
  for (const [mid, sx, kind] of [['destiny',.3,'cam'],['harmony',.7,'pen'],['unity',.5,'food'],['kibo',.4,'bottle'],['zvezda',.4,'food'],['tranquility',.5,'pen'],['columbus',.5,'bottle']]){
    const m = MOD[mid], o = new THREE.Group();
    if (kind === 'cam'){ o.add(new THREE.Mesh(new THREE.BoxGeometry(.14, .1, .08), M.laptop)); const l = new THREE.Mesh(new THREE.CylinderGeometry(.035, .04, .09, 16), M.dark); l.rotation.x = Math.PI/2; l.position.z = .08; o.add(l); }
    if (kind === 'pen') o.add(new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .14, 8), M.blue));
    if (kind === 'food') o.add(new THREE.Mesh(new THREE.BoxGeometry(.12, .02, .16), M.food[r()*5|0]));
    if (kind === 'bottle') o.add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .18, 12), M.bag[1]));
    const hl = half(m), p = V(-hl + sx*2*hl, (r()-.5)*.6, (r()-.5)*.6).applyMatrix4(local[mid].mat);
    o.position.copy(p); o.userData = { p0:p.clone(), w:V(r()-.5, r()-.5, r()-.5).multiplyScalar(.6), ph:r()*6 }; root.add(o); floaters.push(o);
  }

  // puntos de interés en coordenadas de la estación
  const spots = SPOTS.map((s, i) => {
    const m = MOD[s.m], hl = half(m), x = -hl + s.s*2*hl, dl = dirLocal(s.m, AXV[s.w]);
    const p = V(x, 0, 0).addScaledVector(dl, s.d).applyMatrix4(local[s.m].mat);
    return { ...s, i, p, mod:m };
  });
  // grafo para viajar: centro de cada módulo y puntos medios de los túneles
  const center = (id) => { const m = MOD[id]; if (m.tipo === 'cupula') return V(0, 0, 0).applyMatrix4(local[id].mat); return V(0, 0, 0).applyMatrix4(local[id].mat); };
  const edges = {}; for (const [a, b] of LINKS){ (edges[a] ||= []).push(b); (edges[b] ||= []).push(a); }

  function route(from, to){
    const prev = { [from]:null }, q = [from];
    while (q.length){ const c = q.shift(); if (c === to) break; for (const n of edges[c] || []) if (!(n in prev)){ prev[n] = c; q.push(n); } }
    if (!(to in prev)) return null;
    const ids = []; for (let c = to; c; c = prev[c]) ids.unshift(c);
    const pts = [];
    // centro → eje frente a la escotilla → boca del túnel → otra boca → eje del otro módulo → centro
    ids.forEach((id, i) => { if (i){ const a = ids[i-1], t = tunnels[[a, id].sort().join('|')];
      if (t){ pts.push(t[a].axis, t[a].wall, t[id].wall, t[id].axis); } } pts.push(center(id)); });
    return { ids, pts };
  }
  // ¿está el punto dentro de algún volumen? devuelve el módulo
  const tmp = V(0,0,0);
  function inside(p){
    for (const v of vols){
      if (v.kind === 'seg'){ const ab = v.b.clone().sub(v.a), t = Math.max(0, Math.min(1, p.clone().sub(v.a).dot(ab) / ab.lengthSq())); if (v.a.clone().addScaledVector(ab, t).distanceTo(p) < v.r) return v.link[0]; continue; }
      tmp.copy(p).applyMatrix4(v.inv);
      if (v.kind === 'box'){ if (tmp.x > v.min.x && tmp.x < v.max.x && tmp.y > v.min.y && tmp.y < v.max.y && tmp.z > v.min.z && tmp.z < v.max.z) return v.m; }
      else if (v.kind === 'cyl'){ if (tmp.x > v.x0 && tmp.x < v.x1 && Math.hypot(tmp.y, tmp.z) < v.r) return v.m; }
    }
    return null;
  }
  function whichModule(p){ // el módulo cuyo volumen (no túnel) contiene p
    for (const v of vols){ if (v.kind === 'seg') continue; tmp.copy(p).applyMatrix4(v.inv);
      if (v.kind === 'box' && tmp.x > v.min.x - .5 && tmp.x < v.max.x + .5 && Math.abs(tmp.y) < HW && Math.abs(tmp.z) < HW) return v.m;
      if (v.kind === 'cyl' && tmp.x > v.x0 - .3 && tmp.x < v.x1 + .3 && Math.hypot(tmp.y, tmp.z) < v.r + .4) return v.m; }
    return null;
  }
  const update = (t) => { for (const o of floaters){ const u = o.userData, k = t*.25 + u.ph; o.position.copy(u.p0).add(V(Math.sin(k)*.15, Math.sin(k*.7)*.1, Math.cos(k*.8)*.12)); o.rotation.x += u.w.x*.01; o.rotation.y += u.w.y*.01; o.rotation.z += u.w.z*.01; } };
  root.traverse(o => { if (o.isMesh && o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = .45; });
  return { root, vols, spots, inside, whichModule, route, center, update, local, half };
}
