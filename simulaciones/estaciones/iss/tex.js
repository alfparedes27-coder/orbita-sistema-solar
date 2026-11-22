// Texturas procedurales dibujadas en canvas (no se descarga ninguna imagen).
import * as THREE from 'three';

export function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
export function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, { srgb = true, rep = [1,1], aniso = 8 } = {}){
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso;
  return t;
}
// ruido de grano fino encima de un canvas
export function grain(g, w, h, amt = 10, seed = 7){
  const r = rng(seed), d = g.getImageData(0,0,w,h), p = d.data;
  for (let i = 0; i < p.length; i += 4){ const n = (r() - .5) * amt; p[i] += n; p[i+1] += n; p[i+2] += n; }
  g.putImageData(d, 0, 0);
}
// mapa de relieve (gris) → mapa normal
export function normalFrom(c, strength = 2){
  const w = c.width, h = c.height, src = c.getContext('2d').getImageData(0,0,w,h).data;
  const [o, g] = canvas(w, h), out = g.createImageData(w, h), q = out.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const dx = (H(x+1,y) - H(x-1,y)) * strength, dy = (H(x,y+1) - H(x,y-1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y*w + x) * 4;
    q[i] = (-dx/l*.5+.5)*255; q[i+1] = (dy/l*.5+.5)*255; q[i+2] = (1/l*.5+.5)*255; q[i+3] = 255;
  }
  g.putImageData(out, 0, 0); return o;
}

// ---------- exterior ----------
// Mantas antimeteoritos de los módulos de EE. UU., Europa y Japón: paneles blancos acolchados con costuras
export function betaCloth(seed = 1, tint = '#e9e7e0'){
  const W = 512, H = 512, [c, g] = canvas(W, H), [b, gb] = canvas(W, H), r = rng(seed);
  g.fillStyle = tint; g.fillRect(0,0,W,H); gb.fillStyle = '#808080'; gb.fillRect(0,0,W,H);
  const cols = 4, rows = 3;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++){
    const x = i*W/cols, y = j*H/rows, w = W/cols, h = H/rows, k = 225 + r()*22;
    g.fillStyle = `rgb(${k},${k-2},${k-7})`; g.fillRect(x+3, y+3, w-6, h-6);
    // acolchado: abultado en el centro del panel
    const gr = gb.createRadialGradient(x+w/2, y+h/2, 4, x+w/2, y+h/2, Math.max(w,h)*.7);
    gr.addColorStop(0,'#9a9a9a'); gr.addColorStop(1,'#6e6e6e'); gb.fillStyle = gr; gb.fillRect(x+3,y+3,w-6,h-6);
    // costuras y puntos de sujeción
    g.strokeStyle = 'rgba(120,115,100,.55)'; g.lineWidth = 2; g.strokeRect(x+3, y+3, w-6, h-6);
    gb.strokeStyle = '#3a3a3a'; gb.lineWidth = 4; gb.strokeRect(x+3,y+3,w-6,h-6);
    g.fillStyle = 'rgba(90,90,90,.6)';
    for (let t = 0; t < 4; t++) g.fillRect(x + 10 + r()*(w-20), y + 10 + r()*(h-20), 4, 4);
    if (r() < .25){ g.fillStyle = 'rgba(170,160,130,.25)'; g.fillRect(x+6, y+6, w*.4, h*.3); } // manchas por el sol
  }
  grain(g, W, H, 9, seed+3);
  return { map: tex(c), bump: tex(normalFrom(b, 3), { srgb:false }) };
}
// Segmento ruso: mantas blancas con tiras verde grisáceo
export function ruBlanket(seed = 2){
  const W = 512, H = 256, [c, g] = canvas(W, H), r = rng(seed);
  g.fillStyle = '#dcddd2'; g.fillRect(0,0,W,H);
  for (let i = 0; i < 10; i++){ const x = r()*W, w = 20 + r()*80; g.fillStyle = r() < .5 ? 'rgba(160,170,150,.35)' : 'rgba(250,250,245,.4)'; g.fillRect(x, 0, w, H); }
  g.strokeStyle = 'rgba(100,105,90,.45)'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++){ g.beginPath(); g.moveTo(i*W/8, 0); g.lineTo(i*W/8, H); g.stroke(); }
  for (let j = 0; j <= 3; j++){ g.beginPath(); g.moveTo(0, j*H/3); g.lineTo(W, j*H/3); g.stroke(); }
  grain(g, W, H, 12, seed);
  return tex(c);
}
// Celdas solares: 'us' (alas originales, dorado‑cobrizo), 'rosa' (iROSA, azul oscuro), 'ru' (azul ruso)
export function solar(kind = 'us'){
  const W = 256, H = 1024, [c, g] = canvas(W, H), r = rng(kind.length * 17);
  const base = kind === 'us' ? [122, 78, 44] : kind === 'rosa' ? [22, 28, 52] : [26, 40, 88];
  g.fillStyle = kind === 'us' ? '#d9d2c2' : `rgb(${base})`; g.fillRect(0,0,W,H);
  const nx = kind === 'us' ? 16 : 6, ny = kind === 'us' ? 96 : 30, cw = W/nx, ch = H/ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++){
    const v = (r() - .5) * (kind === 'us' ? 14 : 26);
    g.fillStyle = `rgb(${base[0]+v},${base[1]+v*.8},${base[2]+v*.6})`; g.fillRect(i*cw+1, j*ch+1, cw-2, ch-2);
    if (kind !== 'us'){ g.strokeStyle = 'rgba(180,190,210,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(i*cw+cw/2, j*ch+1); g.lineTo(i*cw+cw/2, j*ch+ch-1); g.stroke(); }
  }
  if (kind !== 'us'){ g.strokeStyle = 'rgba(150,160,180,.5)'; g.lineWidth = 1.2;
    for (let i = 0; i <= nx; i++){ g.beginPath(); g.moveTo(i*cw, 0); g.lineTo(i*cw, H); g.stroke(); }
    for (let j = 0; j <= ny; j += 2){ g.beginPath(); g.moveTo(0, j*ch); g.lineTo(W, j*ch); g.stroke(); } }
  else { g.fillStyle = 'rgba(70,45,25,.5)'; for (let j = 0; j < ny; j += 12) g.fillRect(0, j*ch - 1, W, 2); } // bisagras entre paneles
  return tex(c);
}
// Armazón: celosía de aluminio con huecos (alphaTest)
export function lattice(){
  const W = 256, H = 256, [c, g] = canvas(W, H);
  g.clearRect(0,0,W,H); g.strokeStyle = '#c9ccd0'; g.lineCap = 'square';
  g.lineWidth = 14; g.strokeRect(7,7,W-14,H-14);
  g.lineWidth = 9; g.beginPath(); g.moveTo(10,10); g.lineTo(W-10,H-10); g.moveTo(W/2, 8); g.lineTo(W/2, H-8); g.stroke();
  g.strokeStyle = 'rgba(90,95,100,.9)'; g.lineWidth = 2; g.strokeRect(14,14,W-28,H-28);
  return tex(c);
}
export function radiator(){
  const W = 128, H = 512, [c, g] = canvas(W, H), r = rng(5);
  g.fillStyle = '#f2f2ee'; g.fillRect(0,0,W,H);
  g.strokeStyle = 'rgba(150,150,150,.6)'; g.lineWidth = 2;
  for (let j = 0; j <= 8; j++){ g.beginPath(); g.moveTo(0, j*H/8); g.lineTo(W, j*H/8); g.stroke(); }
  g.strokeStyle = 'rgba(190,190,185,.6)'; g.lineWidth = 1;
  for (let i = 1; i < 16; i++){ g.beginPath(); g.moveTo(i*W/16, 0); g.lineTo(i*W/16, H); g.stroke(); }
  for (let k = 0; k < 40; k++){ g.fillStyle = `rgba(200,190,170,${r()*.2})`; g.fillRect(r()*W, r()*H, 10+r()*30, 6+r()*20); }
  return tex(c);
}
// Placas de electrónica / cajas con rótulos (exterior)
export function orubox(seed = 3){
  const W = 256, H = 256, [c, g] = canvas(W, H), r = rng(seed);
  g.fillStyle = '#b9bcbf'; g.fillRect(0,0,W,H);
  for (let k = 0; k < 6; k++){ const x = r()*W*.8, y = r()*H*.8, w = 30 + r()*90, h = 20 + r()*70;
    g.fillStyle = r() < .4 ? '#e8e6de' : r() < .6 ? '#8a8d90' : '#d4b56a'; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(40,40,40,.6)'; g.strokeRect(x, y, w, h); }
  g.fillStyle = '#e1c83a'; for (let k = 0; k < 3; k++) g.fillRect(r()*W, r()*H, 50, 6);
  grain(g, W, H, 14, seed);
  return tex(c);
}
