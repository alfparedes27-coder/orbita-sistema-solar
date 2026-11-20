// Mandos interactivos de las cabinas (Dragon, Soyuz, Starliner): interruptores de palanca, botones con leyenda iluminada,
// teclas, perillas, lámparas, manijas, objetos con explicación, y un pequeño «sistema operativo» para las pantallas
// (encendido/apagado con arranque, páginas extra y barra de navegación táctil). Todos los sonidos se sintetizan con
// Web Audio: no hay archivos de audio. Cada cabina coloca sus mandos con su distribución real.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { A, toast, canvasTex, FD, FM, EARTH_DAY, screenMeshes, scr } from './comun.js';

/* ======================= SONIDO ======================= */
let soundGate = () => true, own = null, bus = null, noiseBuf = null;
export function setSoundGate(f) { soundGate = f; }
function ctx() {
  if (!soundGate()) return null;
  let c = A.ctx;
  if (!c) { try { own = own || new (window.AudioContext || window.webkitAudioContext)(); c = own; } catch (e) { return null; } }
  if (c.state === 'suspended') c.resume();
  if (!bus || bus.context !== c) {
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    bus = c.createGain(); bus.gain.value = .9; bus.connect(comp);
    const n = c.sampleRate, b = c.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b;
  }
  return c;
}
function tone(f, dur, { type = 'sine', vol = .1, f2 = 0, delay = 0, attack = .004 } = {}) {
  const c = ctx(); if (!c) return; const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, { vol = .2, type = 'bandpass', f = 2000, q = 1, delay = 0, attack = .002, f2 = 0 } = {}) {
  const c = ctx(); if (!c) return; const t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl).connect(g).connect(bus); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
}
const loops = {};
function loop(key, on, { f = 900, q = .6, vol = .05, type = 'bandpass' } = {}) {
  const c = ctx(); const L = loops[key];
  if (!on) { if (L && c) { L.g.gain.cancelScheduledValues(c.currentTime); L.g.gain.setTargetAtTime(0, c.currentTime, .25); setTimeout(() => { try { L.s.stop(); } catch (e) {} }, 1500); } delete loops[key]; return; }
  if (L || !c) return;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0;
  s.connect(fl).connect(g).connect(bus); s.start(); g.gain.setTargetAtTime(vol, c.currentTime, .4); loops[key] = { s, g };
}
let alarmTimer = null;
export const sfx = {
  toggle() { noise(.018, { f: 3400, q: 2.5, vol: .5 }); tone(170, .045, { type: 'triangle', vol: .22, f2: 80 }); noise(.012, { f: 5200, q: 3, vol: .2, delay: .03 }); },
  push() { noise(.012, { f: 2600, q: 2, vol: .35 }); tone(230, .03, { type: 'triangle', vol: .14, f2: 120 }); noise(.01, { f: 1900, q: 2, vol: .22, delay: .085 }); },
  cover() { noise(.025, { f: 4300, q: 5, vol: .38 }); tone(950, .05, { type: 'square', vol: .03, f2: 620 }); },
  key() { noise(.008, { f: 3000, q: 2, vol: .25 }); tone(1180, .06, { type: 'square', vol: .045 }); },
  touch() { tone(1760, .045, { vol: .07 }); tone(2640, .06, { vol: .045, delay: .028 }); },
  bezel() { noise(.01, { f: 2400, q: 2, vol: .3 }); tone(1000, .035, { vol: .045, delay: .01 }); },
  knob() { for (let i = 0; i < 3; i++) noise(.006, { f: 5200, q: 4, vol: .28, delay: i * .035 }); },
  handle() { tone(72, .4, { vol: .55, f2: 38 }); noise(.18, { type: 'lowpass', f: 700, vol: .55 }); for (let i = 0; i < 4; i++) noise(.012, { f: 2600, q: 3, vol: .25, delay: .12 + i * .045 }); },
  valve() { noise(.9, { f: 5800, q: .7, vol: .16, attack: .08 }); noise(.012, { f: 1500, q: 3, vol: .3 }); },
  screenOn() { tone(180, .28, { vol: .04, f2: 1400, type: 'triangle' }); tone(1500, .09, { vol: .05, delay: .34 }); tone(2250, .12, { vol: .04, delay: .42 }); },
  screenOff() { tone(1100, .18, { vol: .05, f2: 70 }); noise(.05, { f: 3000, q: 1, vol: .12 }); },
  lamp() { tone(2900, .03, { vol: .025 }); },
  denied() { tone(330, .12, { type: 'square', vol: .045 }); tone(250, .16, { type: 'square', vol: .045, delay: .13 }); },
  confirm() { tone(880, .07, { vol: .06 }); tone(1320, .1, { vol: .06, delay: .08 }); },
  // «quindar»: los dos tonos que la NASA usa al abrir (2525 Hz) y cerrar (2475 Hz) cada transmisión de radio
  radio(nasa = true) { if (nasa) tone(2525, .25, { vol: .05 }); noise(1.0, { f: 1700, q: .5, vol: .07, delay: .3 }); for (let i = 0; i < 6; i++) noise(.03, { f: 3000 + Math.random() * 2000, q: 2, vol: .08, delay: .35 + Math.random() * .9 }); if (nasa) tone(2475, .25, { vol: .05, delay: 1.35 }); else tone(1000, .15, { vol: .05, delay: 1.35 }); },
  alarm(kind = 'soyuz', secs = 2.6) {
    clearInterval(alarmTimer); let n = 0;
    const one = () => {
      if (kind === 'soyuz') { tone(900, .2, { type: 'square', vol: .06 }); tone(640, .2, { type: 'square', vol: .06, delay: .22 }); }
      else if (kind === 'dragon') { tone(1318, .22, { vol: .08 }); tone(1046, .22, { vol: .08, delay: .24 }); tone(1568, .3, { vol: .08, delay: .48 }); }
      else { tone(1050, .14, { type: 'triangle', vol: .09 }); tone(1050, .14, { type: 'triangle', vol: .09, delay: .2 }); tone(1050, .14, { type: 'triangle', vol: .09, delay: .4 }); }
    };
    one(); const per = kind === 'dragon' ? 900 : kind === 'soyuz' ? 460 : 800;
    alarmTimer = setInterval(() => { n += per; if (n >= secs * 1000) { clearInterval(alarmTimer); alarmTimer = null; return; } one(); }, per);
  },
  stopAlarm() { clearInterval(alarmTimer); alarmTimer = null; },
  fans(on, key = 'fan', f = 900) { loop(key, on, { f, q: .5, vol: .045 }); },
};

/* ======================= TEXTURAS DE LEYENDAS ======================= */
const TC = new Map();
export function legend(text, { w = 256, h = 64, bg = '#15171b', fg = '#e8ecf4', font = FD, weight = 600, size = 0, border = '', lit = false, stripes = '' } = {}) {
  const key = [text, w, h, bg, fg, font, weight, size, border, lit, stripes].join('|'); if (TC.has(key)) return TC.get(key);
  const t = canvasTex(w, h, (c) => {
    c.fillStyle = lit ? '#000' : bg; c.fillRect(0, 0, w, h);
    if (stripes && !lit) { c.save(); c.beginPath(); c.rect(0, 0, w, h); c.rect(6, 6, w - 12, h - 12); c.clip('evenodd'); for (let i = -h; i < w + h; i += 16) { c.fillStyle = stripes; c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 8, 0); c.lineTo(i + 8 - h, h); c.lineTo(i - h, h); c.fill(); } c.restore(); }
    if (border && !lit) { c.strokeStyle = border; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); }
    const lines = String(text).split('\n'); let s = size || Math.min(h * .52 / lines.length * 1.15, h * .5);
    c.font = `${weight} ${s}px ${font}`; let mw = Math.max(...lines.map(l => c.measureText(l).width)); if (mw > w * .9) { s *= w * .9 / mw; c.font = `${weight} ${s}px ${font}`; }
    c.fillStyle = lit ? '#fff' : fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * s * 1.08 + 1));
  });
  TC.set(key, t); return t;
}
export function plate(parent, text, x, y, z, w, h, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: legend(text, { w: Math.round(256 * Math.max(1, w / h / 4)), h: 64, ...o }), roughness: .6, metalness: .1 }));
  m.position.set(x, y, z); parent.add(m); return m;
}

/* ======================= REGISTRO DE MANDOS ======================= */
export const ctrls = [], pick = [];
const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: .22, metalness: .95 });
const nutMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: .35, metalness: .9 });
const darkPl = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: .55, metalness: .2 });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function hitBox(parent, w, h, d, x, y, z, ctrl) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); m.position.set(x, y, z); m.userData.ctrl = ctrl; parent.add(m); pick.push(m); return m; }
function info(c) { if (c.info) toast(typeof c.info === 'function' ? c.info(c) : c.info); }
function reg(c) { ctrls.push(c); return c; }

// Interruptor de palanca. lock: hay que sacarlo antes de moverlo (como en Starliner). guard: dos barras laterales de protección.
export function toggle(parent, { x, y, z = .03, label = '', info: inf = '', on = false, lock = false, guard = false, lamp = null, s = 1, plateOpts = {}, onChange } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .007, 6).rotateX(Math.PI / 2), nutMat); nut.position.z = .0035; g.add(nut);
  const piv = new THREE.Group(); piv.position.z = .007; g.add(piv);
  const lev = new THREE.Mesh(new THREE.CylinderGeometry(.0028, .0042, .03, 10).translate(0, .015, 0).rotateX(Math.PI / 2), chrome); piv.add(lev);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.0055, 12, 8), chrome); tip.position.z = .03; piv.add(tip);
  if (guard) for (const k of [-1, 1]) { const r = new THREE.Mesh(new RoundedBoxGeometry(.004, .05, .03, 2, .0015), darkPl); r.position.set(k * .014, 0, .015); g.add(r); }
  let lampM = null; if (lamp) { lampM = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .004, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x222, emissive: lamp, emissiveIntensity: 0 })); lampM.position.set(0, .028, .002); g.add(lampM); }
  if (label) plate(g, label, 0, -.03, .0005, .05, .011, plateOpts);
  const c = reg({ type: 'toggle', g, piv, on, lock, label, info: inf, onChange, lampM, a: on ? -.45 : .45, out: 0 });
  hitBox(g, .036, .06, .045, 0, 0, .02, c); piv.rotation.x = c.a; if (lampM) lampM.material.emissiveIntensity = on ? 2.2 : 0; return c;
}
// Botón con leyenda (cuadrado o redondo). lit: color de la leyenda iluminada. momentary: vuelve solo.
export function push(parent, { x, y, z = .03, w = .04, h = .03, label = '', info: inf = '', lit = 0x9fe1ff, on = false, momentary = false, round = false, face = '#24272c', fg = '#e8ecf4', fontSize = 0, cover = false, stripes = '', onChange } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const base = new THREE.Mesh(round ? new THREE.CylinderGeometry(w / 2 + .004, w / 2 + .004, .008, 28).rotateX(Math.PI / 2) : new RoundedBoxGeometry(w + .008, h + .008, .008, 2, .002), stripes ? new THREE.MeshStandardMaterial({ map: legend('', { w: 64, h: 64, bg: '#111', stripes }), roughness: .6 }) : darkPl); base.position.z = .004; g.add(base);
  const capM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: legend(label, { bg: face, fg, size: fontSize, w: 256, h: Math.round(256 * h / w) }), emissive: lit, emissiveMap: legend(label, { lit: true, w: 256, h: Math.round(256 * h / w), size: fontSize }), emissiveIntensity: 0, roughness: .45, metalness: .05 });
  const cap = new THREE.Mesh(round ? new THREE.CylinderGeometry(w / 2, w / 2, .012, 28).rotateX(Math.PI / 2) : new RoundedBoxGeometry(w, h, .012, 2, .003), capM); cap.position.z = .012; g.add(cap);
  let cov = null; if (cover) { cov = new THREE.Group(); cov.position.set(0, h / 2 + .006, .02); g.add(cov); const cm = new THREE.Mesh(new RoundedBoxGeometry(w + .012, h + .012, .02, 2, .004).translate(0, -(h / 2 + .006), 0), new THREE.MeshPhysicalMaterial({ color: typeof cover === 'number' ? cover : 0xffffff, transparent: true, opacity: .28, roughness: .05, clearcoat: 1, depthWrite: false })); cov.add(cm); }
  const c = reg({ type: 'push', g, cap, capM, on, momentary, label, info: inf, onChange, cover: cov, open: false, openT: 0, press: 0 });
  hitBox(g, w + .01, h + .01, .04, 0, 0, .018, c); if (on) capM.emissiveIntensity = 1.8; return c;
}
// Perilla giratoria con índice y escala. steps: número de posiciones.
export function knob(parent, { x, y, z = .03, r = .018, label = '', info: inf = '', steps = 5, pos = 0, color = 0x1c1e22, sound = 'knob', onChange } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(r * 1.7, 32), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c) => { c.fillStyle = '#2a2d33'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#e8ecf4'; c.lineWidth = 3; for (let i = 0; i < steps; i++) { const a = (-135 + i * 270 / Math.max(1, steps - 1)) * Math.PI / 180; c.beginPath(); c.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); c.lineTo(64 + Math.sin(a) * 60, 64 - Math.cos(a) * 60); c.stroke(); } }), roughness: .6 })); dial.position.z = .001; g.add(dial);
  const rot = new THREE.Group(); g.add(rot);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r, .018, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .15 })); body.position.z = .01; rot.add(body);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const k = new THREE.Mesh(new THREE.BoxGeometry(.002, .002, .016), body.material); k.position.set(Math.cos(a) * r, Math.sin(a) * r, .01); rot.add(k); }
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(.003, r * .8, .002), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .4 })); ptr.position.set(0, r * .45, .0195); rot.add(ptr);
  if (label) plate(g, label, 0, -r * 1.7 - .008, .001, .06, .012);
  const c = reg({ type: 'knob', g, rot, pos, steps, label, info: inf, onChange, sound, a: 0 });
  c.a = c.target = (135 - pos * 270 / Math.max(1, steps - 1)) * Math.PI / 180; rot.rotation.z = c.a;
  hitBox(g, r * 2.6, r * 2.6, .04, 0, 0, .015, c); return c;
}
// Tecla de teclado (sin estado). onKey(key)
export function key(parent, { x, y, z = .03, w = .026, h = .022, label = '', k = label, face = '#e6e4dc', fg = '#15171b', info: inf = '', onKey } = {}) {
  const capM = new THREE.MeshStandardMaterial({ map: legend(label, { bg: face, fg, w: 128, h: Math.round(128 * h / w), font: FM, weight: 700 }), roughness: .5 });
  const cap = new THREE.Mesh(new RoundedBoxGeometry(w, h, .012, 2, .004), capM); cap.position.set(x, y, z + .008); cap.castShadow = true; parent.add(cap);
  const c = reg({ type: 'key', cap, z0: z + .008, press: 0, k, label, info: inf, onKey });
  hitBox(parent, w + .004, h + .004, .03, x, y, z + .01, c); return c;
}
// Lámpara indicadora (no se toca, o se toca para probarla)
export function lamp(parent, { x, y, z = .031, w = .05, h = .022, label = '', color = 0x7ee2a8, bg = '#202326', fg = '#8a9198', on = false, info: inf = '', round = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: legend(label, { bg, fg, w: 256, h: Math.round(256 * h / w) }), emissive: color, emissiveMap: round ? null : legend(label, { lit: true, w: 256, h: Math.round(256 * h / w) }), emissiveIntensity: 0, roughness: .35 });
  const mesh = new THREE.Mesh(round ? new THREE.CylinderGeometry(w / 2, w / 2, .008, 24).rotateX(Math.PI / 2) : new RoundedBoxGeometry(w, h, .008, 2, .002), m); mesh.position.set(x, y, z); parent.add(mesh);
  const c = reg({ type: 'lamp', mesh, m, on, blink: 0, label, info: inf, test: 0 });
  if (inf) hitBox(parent, w + .006, h + .006, .02, x, y, z, c); c.set = (v, blink = 0) => { c.on = v; c.blink = blink; }; return c;
}
// Manija: 'eject' (barra en T roja y negra que se tira y se gira) o 'ring' (anillo de aborto).
export function handle(parent, { x, y, z = .03, kind = 'eject', label = '', info: inf = '', onPull } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const mov = new THREE.Group(); g.add(mov);
  const red = new THREE.MeshStandardMaterial({ color: 0xc8261c, roughness: .4, metalness: .1 }), blk = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: .55 });
  if (kind === 'eject') {
    const cup = new THREE.Mesh(new RoundedBoxGeometry(.15, .06, .02, 3, .006), new THREE.MeshStandardMaterial({ map: legend('', { w: 128, h: 64, bg: '#0b0b0c', stripes: '#c8261c' }), roughness: .6 })); cup.position.z = .006; g.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .03, 12).rotateX(Math.PI / 2), blk); stem.position.z = .02; mov.add(stem);
    const bar = new THREE.Mesh(new RoundedBoxGeometry(.11, .022, .022, 3, .009), red); bar.position.z = .038; mov.add(bar);
    for (const k of [-1, 1]) { const gr = new THREE.Mesh(new RoundedBoxGeometry(.035, .025, .025, 3, .01), blk); gr.position.set(k * .04, 0, .038); mov.add(gr); }
  } else {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .012, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: legend('', { w: 128, h: 128, bg: '#0b0b0c', stripes: '#f2c230' }), roughness: .6 })); cup.position.z = .006; g.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .025, 12).rotateX(Math.PI / 2), blk); stem.position.z = .018; mov.add(stem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.036, .009, 14, 40), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: .4 })); ring.position.z = .032; mov.add(ring);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(.036, .0095, 8, 6, Math.PI / 6), blk); b.rotation.z = i * Math.PI / 3; b.position.z = .032; mov.add(b); }
  }
  if (label) plate(g, label, 0, kind === 'eject' ? .045 : .075, .001, kind === 'eject' ? .07 : .09, .016, { bg: '#0d0e10', fg: '#ffffff' });
  const c = reg({ type: 'handle', g, mov, kind, label, info: inf, onPull, t: -1 });
  hitBox(g, kind === 'eject' ? .16 : .13, kind === 'eject' ? .07 : .13, .06, 0, 0, .03, c); return c;
}
// Cualquier objeto con explicación y sonido (bolsas, puntero, válvulas decorativas, juguete...)
export function thing(obj, { label = '', info: inf = '', sound = 'push', onTap, w, h, d } = {}) {
  const c = reg({ type: 'thing', obj, label, info: inf, sound, onTap, wob: 0 });
  obj.traverse(o => { if (o.isMesh) { o.userData.ctrl = c; pick.push(o); } }); return c;
}

/* ======================= TOQUE Y ANIMACIÓN ======================= */
function findCtrl(o) { while (o) { if (o.userData && o.userData.ctrl) return o.userData.ctrl; o = o.parent; } return null; }
export function tapCtrl(o) {
  const c = findCtrl(o); if (!c) return false;
  switch (c.type) {
    case 'toggle':
      if (c.lock) { c.out = .4; }
      c.on = !c.on; sfx.toggle(); if (c.lampM) c.lampM.material.emissiveIntensity = c.on ? 2.2 : 0;
      c.onChange?.(c.on, c); info(c); break;
    case 'push':
      if (c.cover && !c.open) { c.open = true; c.openT = 7; sfx.cover(); toast((c.label || 'Botón') + ': tapa abierta. Tócalo otra vez para pulsarlo; la tapa se cierra sola.'); break; }
      c.press = .16; sfx.push(); if (c.cover) c.openT = 7;
      if (c.momentary) { c.flash = .5; c.onChange?.(true, c); } else { c.on = !c.on; c.onChange?.(c.on, c); }
      info(c); break;
    case 'knob':
      c.pos = (c.pos + 1) % c.steps; c.target = (135 - c.pos * 270 / Math.max(1, c.steps - 1)) * Math.PI / 180; (sfx[c.sound] || sfx.knob)(); c.onChange?.(c.pos, c); info(c); break;
    case 'key':
      c.press = .12; sfx.key(); c.onKey?.(c.k, c); if (c.info) info(c); break;
    case 'lamp':
      c.test = 1.2; sfx.lamp(); info(c); break;
    case 'handle':
      if (c.t >= 0) break; c.t = 0; sfx.handle(); c.onPull?.(c); info(c); break;
    case 'thing':
      c.wob = 1; (sfx[c.sound] || sfx.push)(); c.onTap?.(c); info(c); break;
  }
  return true;
}
let blinkT = 0;
export function updateMandos(dt) {
  blinkT += dt; const bl = Math.sin(blinkT * 9) > 0;
  for (const c of ctrls) switch (c.type) {
    case 'toggle': { const tgt = c.on ? -.45 : .45; c.a += (tgt - c.a) * Math.min(1, dt * 22); c.piv.rotation.x = c.a; if (c.lock) { c.out = Math.max(0, c.out - dt); c.piv.position.z = .007 + Math.min(.2, c.out) * .03; } break; }
    case 'push': { c.press = Math.max(0, c.press - dt); c.cap.position.z = .012 - (c.press > 0 ? .0055 : 0);
      if (c.momentary) { c.flash = Math.max(0, (c.flash || 0) - dt); c.capM.emissiveIntensity = c.flash > 0 || c.test > 0 ? 1.8 : 0; }
      else c.capM.emissiveIntensity = (c.on || c.test > 0) ? (c.blink && !bl ? .2 : 1.8) : 0;
      c.test = Math.max(0, (c.test || 0) - dt);
      if (c.cover) { if (c.openT > 0) { c.openT -= dt; if (c.openT <= 0) c.open = false; } c.cover.rotation.x += ((c.open ? -1.9 : 0) - c.cover.rotation.x) * Math.min(1, dt * 10); } break; }
    case 'knob': c.a += (c.target - c.a) * Math.min(1, dt * 16); c.rot.rotation.z = c.a; break;
    case 'key': c.press = Math.max(0, c.press - dt); c.cap.position.z = c.z0 - (c.press > 0 ? .005 : 0); break;
    case 'lamp': { c.test = Math.max(0, c.test - dt); const v = c.test > 0 || (c.on && (!c.blink || bl)); c.m.emissiveIntensity = v ? 2.1 : 0; break; }
    case 'handle': if (c.t >= 0) { c.t += dt; const t = c.t; const out = t < .25 ? t / .25 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / .5); const tw = t < .25 ? 0 : t < .55 ? (t - .25) / .3 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / .5);
      c.mov.position.z = out * .05; c.mov.rotation.z = tw * (c.kind === 'eject' ? Math.PI / 4 : Math.PI / 2); if (t > 2.2) { c.t = -1; c.mov.position.z = 0; c.mov.rotation.z = 0; } } break;
    case 'thing': if (c.wob > 0) { c.wob = Math.max(0, c.wob - dt * 2.5); const s = 1 + Math.sin(c.wob * 18) * .04 * c.wob; c.obj.scale.setScalar(s); } break;
  }
}
// Prueba de lámparas: todo se enciende unos segundos (los niños la adoran; las tripulaciones la hacen antes de cada vuelo)
export function lampTest(secs = 2.5) { for (const c of ctrls) if (c.type === 'lamp' || c.type === 'push') c.test = secs; for (const t of ctrls) if (t.type === 'toggle' && t.lampM) { const m = t.lampM.material; m.emissiveIntensity = 2.2; setTimeout(() => m.emissiveIntensity = t.on ? 2.2 : 0, secs * 1000); } }

/* ======================= LUCES DE LA CABINA ======================= */
const LG = { main: [], accent: [] };
export function registerCabinLights(root) {
  const isBlue = c => c.b > c.r * 1.35 && c.b > .5;
  root.traverse(o => {
    if (o.isLight && !o.isHemisphereLight && !o.isAmbientLight && !o.isDirectionalLight) (isBlue(o.color) ? LG.accent : LG.main).push({ o, base: o.intensity });
    else if (o.isMesh && o.material && o.material.emissive && !o.material.emissiveMap && o.material.emissiveIntensity >= 1.5 && !screenMeshes.includes(o) && !findCtrl(o)) {
      const m = o.material; const g = isBlue(m.emissive) ? LG.accent : LG.main; if (!g.some(e => e.m === m)) g.push({ m, base: m.emissiveIntensity });
    }
  });
}
export const lights = { main: 1, accent: 1 };
export function setCabinLights(group, level) { lights[group] = level; for (const e of LG[group]) { if (e.o) e.o.intensity = e.base * level; else e.m.emissiveIntensity = e.base * level; } }

/* ======================= SISTEMA DE LAS PANTALLAS ======================= */
// theme: {bg, ink, dim, faint, line, accent, ok, warn, bad, font, mono}; nav: 'touch' (barra táctil abajo, como Dragon) o null.
const NAVH = 44, NAVK = (576 - NAVH) / 576;
export function osInit(sc, { theme, pages = [], nav = null, boot = 'dragon' }) { sc.os = { on: true, boot: 0, page: 0, pages: [{ name: pages.missionName || 'MISIÓN' }, ...pages], nav, theme, bootKind: boot, bright: 1 }; }
export function osPower(sc, on) { const o = sc.os; if (o.on === on) return; o.on = on; if (on) { o.boot = 1.6; sfx.screenOn(); } else { sfx.screenOff(); o.boot = 0; } }
export function osPage(sc, i) { const o = sc.os; if (!o.on) { osPower(sc, true); } o.page = (i + o.pages.length) % o.pages.length; }
export function osBright(sc, k) { const o = sc.os; o.bright = THREE.MathUtils.clamp(o.bright + k, .25, 1.4); const m = screenMeshes.find(m => m.userData.screen === sc); if (m) m.material.emissiveIntensity = 1.15 * o.bright; }
let lastStep = -1;
export function osStep(step, needsScreens) { if (step === lastStep) return; lastStep = step; if (!needsScreens) return; for (const k in scr) { const sc = scr[k]; if (!sc.os) continue; if (!sc.os.on) osPower(sc, true); sc.os.page = 0; } }
export function osDraw(sc, mission, now) {
  const o = sc.os, c = sc.x; if (!o) { mission(); return; }
  if (!o.on) { sc.hits = []; c.fillStyle = '#020304'; c.fillRect(0, 0, 1024, 576); const g = c.createLinearGradient(0, 0, 1024, 576); g.addColorStop(0, 'rgba(255,255,255,.035)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 1024, 576); sc.tex.needsUpdate = true; return; }
  if (o.boot > 0) { o.boot = Math.max(0, o.boot - 1 / 20); sc.hits = []; bootScreen(sc, 1 - o.boot / 1.6); sc.tex.needsUpdate = true; return; }
  if (o.page === 0) {
    if (o.nav) { c.save(); c.setTransform(1, 0, 0, NAVK, 0, 0); mission(); c.restore(); for (const h of sc.hits) { h.y *= NAVK; h.h *= NAVK; } drawNav(sc, now); }
    else mission();
  } else { sc.hits = []; const P = o.pages[o.page]; c.save(); P.draw(c, sc, now, o.theme); c.restore(); if (o.nav) drawNav(sc, now); }
  sc.tex.needsUpdate = true;
}
function bootScreen(sc, u) {
  const c = sc.x, th = sc.os.theme, k = sc.os.bootKind; c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 576);
  if (k === 'starliner' && u < .45) { const cols = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000']; cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 128, 0, 128, 576); }); c.fillStyle = '#000'; c.font = `700 30px ${FM}`; c.textAlign = 'center'; c.fillText('AUTOPRUEBA DE PANTALLA', 512, 520); return; }
  if (k === 'soyuz' && u < .5) { c.fillStyle = '#0a0'; c.font = `500 22px ${FM}`; c.textAlign = 'left'; const L = ['НЕПТУН-МЭ  ВЕР. 5.2', 'ТЕСТ ОЗУ ........ НОРМА', 'ТЕСТ ПЗУ ........ НОРМА', 'СВЯЗЬ С БЦВМ .... НОРМА', 'ЗАГРУЗКА ФОРМАТОВ']; L.slice(0, Math.ceil(u / .5 * L.length)).forEach((l, i) => c.fillText(l, 60, 80 + i * 40)); return; }
  c.fillStyle = th.ink; c.font = `600 40px ${th.font || FD}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(k === 'dragon' ? 'DRAGON' : k === 'soyuz' ? 'НЕПТУН-МЭ' : 'CST‑100 STARLINER', 512, 250);
  c.font = `500 20px ${FM}`; c.fillStyle = th.dim; c.fillText(k === 'soyuz' ? 'ЗАГРУЗКА…' : 'INICIANDO…', 512, 300);
  c.fillStyle = th.line; c.fillRect(312, 340, 400, 6); c.fillStyle = th.accent; c.fillRect(312, 340, 400 * Math.min(1, u * 1.15), 6);
}
function drawNav(sc, now) {
  const o = sc.os, th = o.theme, c = sc.x, y = 576 - NAVH; c.fillStyle = '#000'; c.fillRect(0, y, 1024, NAVH); c.fillStyle = th.line; c.fillRect(0, y, 1024, 1.5);
  const n = o.pages.length, w = 760 / n; c.textBaseline = 'middle'; c.textAlign = 'center';
  o.pages.forEach((p, i) => { const x = i * w; const on = i === o.page; c.font = `${on ? 600 : 500} 17px ${th.font || FD}`; if ('letterSpacing' in c) c.letterSpacing = '2px'; c.fillStyle = on ? th.ink : th.dim; c.fillText(p.name, x + w / 2, y + NAVH / 2 + 1); if (on) { c.fillStyle = th.accent; c.fillRect(x + 18, y + NAVH - 5, w - 36, 3); } if ('letterSpacing' in c) c.letterSpacing = '0px'; sc.hit('os:nav:' + i, x, y, w, NAVH); });
  c.font = `500 16px ${FM}`; c.fillStyle = th.dim; c.textAlign = 'right'; c.fillText(new Date(Date.now()).toISOString().slice(11, 19) + ' UTC', 1008, y + NAVH / 2 + 1);
}
export function osTap(sc, u, v) {
  const o = sc.os; if (!o) return false;
  if (!o.on) { osPower(sc, true); return true; }
  if (o.boot > 0) return true;
  const h = sc.pick(u, v);
  if (h && h.id.startsWith('os:nav:')) { const i = +h.id.split(':')[2]; if (i !== o.page) { o.page = i; sfx.touch(); } return true; }
  if (o.page !== 0) { const P = o.pages[o.page]; if (h && h.en !== false && P.tap) P.tap(h.id, sc); else if (o.nav) sfx.touch(); return true; }
  return false;
}

/* ======================= PÁGINAS EXTRA ======================= */
function sp(c, v) { if ('letterSpacing' in c) c.letterSpacing = v; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function head(c, th, title, right = '') { c.fillStyle = th.bg; c.fillRect(0, 0, 1024, 576); c.fillStyle = th.head || '#0a0f19'; c.fillRect(0, 0, 1024, 58); c.fillStyle = th.line; c.fillRect(0, 58, 1024, 2); c.font = `600 24px ${th.font || FD}`; sp(c, '4px'); c.fillStyle = th.accent; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(title, 28, 30); sp(c, '0px'); c.font = `500 22px ${th.mono || FM}`; c.fillStyle = th.ink; c.textAlign = 'right'; c.fillText(right, 996, 30); }
function btn(c, sc, th, id, x, y, w, h, label, on = false, size = 22) { rr(c, x, y, w, h, th.radius ?? 10); c.fillStyle = on ? th.onBg || '#123247' : th.btn || '#0e1522'; c.fill(); c.lineWidth = 2; c.strokeStyle = on ? th.accent : th.line; c.stroke(); c.fillStyle = th.ink; c.font = `600 ${size}px ${th.font || FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x + w / 2, y + h / 2 + 1); sc.hit(id, x, y, w, h); }
const jit = (k, a) => Math.sin(performance.now() / 1000 * (.7 + k * .13) + k * 7) * a;
const earthImg = new Image(); earthImg.src = EARTH_DAY;

// Mapa de la Tierra con la traza de la órbita (inclinación de la Estación Espacial, 51,6°)
export function pageMap({ name = 'MAPA', title = 'TRAZA TERRESTRE', labels = {} } = {}) {
  return { name, draw(c, sc, now, th) {
    head(c, th, title, labels.alt || 'ÓRBITA 51,6°');
    const X = 24, Y = 74, W = 976, H = 488;
    if (earthImg.complete && earthImg.naturalWidth) { c.globalAlpha = .9; c.drawImage(earthImg, X, Y, W, H); c.globalAlpha = 1; } else { c.fillStyle = '#0d2238'; c.fillRect(X, Y, W, H); }
    // noche aproximada: el Sol está sobre la longitud donde es mediodía UTC
    const d = new Date(), subLon = -((d.getUTCHours() + d.getUTCMinutes() / 60) - 12) * 15; c.fillStyle = 'rgba(0,4,12,.55)';
    for (let i = 0; i < W; i += 4) { const lon = -180 + i / W * 360; const dl = ((lon - subLon + 540) % 360) - 180; if (Math.abs(dl) > 90) c.fillRect(X + i, Y, 4, H); }
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(X + i * W / 12, Y); c.lineTo(X + i * W / 12, Y + H); c.stroke(); } for (let j = 1; j < 6; j++) { c.beginPath(); c.moveTo(X, Y + j * H / 6); c.lineTo(X + W, Y + j * H / 6); c.stroke(); }
    const inc = 51.6 * Math.PI / 180, per = 92.7 * 60, t = performance.now() / 1000 * 60 + 1800, u0 = (t / per) * Math.PI * 2;
    const pt = u => { const lat = Math.asin(Math.sin(inc) * Math.sin(u)); let lon = Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)) * 180 / Math.PI - (u - u0) / (Math.PI * 2) * per / 86164 * 360 - 80; lon = ((lon + 540) % 360) - 180; return [X + (lon + 180) / 360 * W, Y + (90 - lat * 180 / Math.PI) / 180 * H]; };
    c.strokeStyle = th.accent; c.lineWidth = 2.5; let prev = null; c.beginPath();
    for (let k = -60; k <= 140; k++) { const p = pt(u0 + k / 100 * Math.PI * 2); if (prev && Math.abs(p[0] - prev[0]) > W / 2) { c.stroke(); c.beginPath(); c.moveTo(...p); } else if (!prev) c.moveTo(...p); else c.lineTo(...p); prev = p; if (k === 0) { c.stroke(); c.setLineDash([8, 8]); c.beginPath(); c.moveTo(...p); } }
    c.stroke(); c.setLineDash([]);
    const p = pt(u0); c.fillStyle = th.ink; c.beginPath(); c.arc(p[0], p[1], 9, 0, 7); c.fill(); c.strokeStyle = th.accent; c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], 16 + 4 * Math.sin(now * 4), 0, 7); c.stroke();
    // Ecuador (Guayaquil) como referencia
    const [hl, hn] = labels.homeLL || [-2.2, -79.9], gx = X + (hn + 180) / 360 * W, gy = Y + (90 - hl) / 180 * H; c.fillStyle = th.warn; c.beginPath(); c.arc(gx, gy, 5, 0, 7); c.fill(); c.font = `500 15px ${th.mono || FM}`; c.textAlign = 'left'; c.fillText(labels.home || 'GUAYAQUIL', gx + 8, gy + 4);
  } };
}
// Sistemas de soporte vital y energía, con valores que respiran un poco (en la realidad cambian despacio)
export function pageSystems({ name = 'SISTEMAS', title = 'SOPORTE VITAL Y ENERGÍA', rows, fans, onFan } = {}) {
  const R = rows || [['PRESIÓN CABINA', () => (101.3 + jit(1, .08)).toFixed(1) + ' kPa'], ['OXÍGENO (ppO2)', () => (21.2 + jit(2, .1)).toFixed(1) + ' kPa'], ['CO2', () => (0.31 + jit(3, .02)).toFixed(2) + ' kPa'], ['TEMPERATURA', () => (22.4 + jit(4, .2)).toFixed(1) + ' °C'], ['HUMEDAD', () => Math.round(44 + jit(5, 2)) + ' %'], ['BATERÍA A', () => (28.1 + jit(6, .05)).toFixed(1) + ' V'], ['BATERÍA B', () => (28.0 + jit(7, .05)).toFixed(1) + ' V']];
  return { name, draw(c, sc, now, th) {
    head(c, th, title, '');
    c.textBaseline = 'middle';
    R.forEach(([k, f], i) => { const y = 100 + i * 52; c.textAlign = 'left'; c.font = `500 19px ${th.font || FD}`; sp(c, '2px'); c.fillStyle = th.dim; c.fillText(k, 32, y); sp(c, '0px'); c.textAlign = 'right'; c.font = `500 26px ${th.mono || FM}`; c.fillStyle = th.ink; c.fillText(f(), 470, y);
      c.strokeStyle = th.line; c.lineWidth = 1; c.beginPath(); c.moveTo(32, y + 24); c.lineTo(470, y + 24); c.stroke(); });
    // gráfico de CO2 y presión de los últimos minutos
    const gx = 520, gy = 90, gw = 470, gh = 210; c.strokeStyle = th.line; c.lineWidth = 2; c.strokeRect(gx, gy, gw, gh);
    c.font = `500 15px ${th.mono || FM}`; c.fillStyle = th.dim; c.textAlign = 'left'; c.fillText(th.lang === 'ru' ? 'ДАВЛЕНИЕ · 10 МИН' : 'PRESIÓN · ÚLTIMOS 10 MIN', gx + 10, gy + 18);
    c.strokeStyle = th.accent; c.lineWidth = 2.5; c.beginPath(); for (let i = 0; i <= 100; i++) { const x = gx + i / 100 * gw, v = Math.sin(i * .21 + now * .3) * .3 + Math.sin(i * .07) * .5; const y = gy + gh / 2 - v * 50; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    if (fans) { const F = fans(); c.textAlign = 'left'; c.font = `500 18px ${th.font || FD}`; c.fillStyle = th.dim; c.fillText(th.lang === 'ru' ? 'ВЕНТИЛЯТОРЫ' : 'VENTILADORES', gx, 340);
      F.forEach((on, i) => { if (onFan) btn(c, sc, th, 'fan:' + i, gx + i * 158, 360, 146, 64, (th.lang === 'ru' ? 'ВЕНТ ' : 'VENT. ') + (i + 1), on, 20); else { c.fillStyle = on ? th.ok : th.faint; c.fillText((on ? '● ' : '○ ') + 'VENT ' + (i + 1), gx + i * 158, 390); } });
      c.fillStyle = th.faint; c.font = `500 15px ${th.mono || FM}`; c.fillText(th.lang === 'ru' ? 'Значения иллюстративные' : 'Valores ilustrativos, cercanos a los reales.', gx, 470); }
  }, tap(id) { if (id.startsWith('fan:') && onFan) { onFan(+id.split(':')[1]); sfx.touch(); } } };
}
// Ajustes de cabina (pantalla táctil de Dragon): luces, brillo, ventiladores, alarma de prueba, radio, apagar pantalla
export function pageCabin({ name = 'CABINA', onAlarm, onRadio, fansOn, onFans } = {}) {
  return { name, draw(c, sc, now, th) {
    head(c, th, 'AJUSTES DE CABINA', '');
    c.textAlign = 'left'; c.font = `500 18px ${th.font || FD}`; sp(c, '3px'); c.fillStyle = th.dim; c.fillText('LUCES', 32, 92); c.fillText('PANTALLA', 32, 232); c.fillText('PRUEBAS Y RADIO', 520, 92); sp(c, '0px');
    const L = lights.main; btn(c, sc, th, 'lt:1', 32, 110, 140, 80, '100 %', L > .9); btn(c, sc, th, 'lt:.5', 186, 110, 140, 80, '50 %', L > .4 && L < .6); btn(c, sc, th, 'lt:.12', 340, 110, 140, 80, 'NOCHE', L < .2);
    btn(c, sc, th, 'br:-', 32, 250, 140, 80, 'BRILLO −'); btn(c, sc, th, 'br:+', 186, 250, 140, 80, 'BRILLO +'); btn(c, sc, th, 'off', 340, 250, 140, 80, 'APAGAR', false, 20);
    btn(c, sc, th, 'alarm', 520, 110, 220, 80, 'PROBAR ALARMA', false, 20); btn(c, sc, th, 'lamps', 756, 110, 236, 80, 'PROBAR LUCES', false, 20);
    btn(c, sc, th, 'radio', 520, 250, 220, 80, 'LLAMAR A TIERRA', false, 20); btn(c, sc, th, 'fans', 756, 250, 236, 80, 'VENTILADORES', fansOn && fansOn(), 20);
    c.fillStyle = th.faint; c.font = `500 16px ${th.mono || FM}`; c.textAlign = 'left';
    ['En la Dragon real esta página existe: luces, audio y video se ajustan', 'desde las pantallas táctiles, con guantes puestos.'].forEach((l, i) => c.fillText(l, 32, 400 + i * 26));
  }, tap(id, sc) {
    sfx.touch();
    if (id.startsWith('lt:')) setCabinLights('main', +id.slice(3));
    else if (id === 'br:-') osBright(sc, -.2); else if (id === 'br:+') osBright(sc, .2);
    else if (id === 'off') osPower(sc, false);
    else if (id === 'alarm') { sfx.alarm('dragon', 2.6); onAlarm && onAlarm(); toast('Prueba de alarma: suena el tono de precaución de la Dragon. En vuelo, la tripulación lo apaga desde la pantalla.'); }
    else if (id === 'lamps') { lampTest(2.5); toast('Prueba de luces: se encienden todos los botones físicos para comprobar que ninguna bombilla está fundida.'); }
    else if (id === 'radio') { sfx.radio(true); onRadio && onRadio(); toast('Llamada a Tierra: los dos «bips» al empezar y terminar son los tonos Quindar que la NASA usa desde las misiones Apolo.'); }
    else if (id === 'fans') { onFans && onFans(); }
  } };
}
// Esfera de actitud («bola ocho») de Starliner y de Orion: cielo arriba, suelo abajo, escala de cabeceo
export function pageADI({ name = 'ACTITUD', att } = {}) {
  return { name, draw(c, sc, now, th) {
    head(c, th, 'ACTITUD (BOLA OCHO)', '');
    const a = att ? att() : { roll: Math.sin(now * .2) * .25, pitch: Math.sin(now * .13) * .2, yaw: now * .05 };
    const cx = 330, cy = 318, R = 210;
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.translate(cx, cy); c.rotate(-a.roll);
    const off = a.pitch * R * 1.6; c.fillStyle = '#2a6fc9'; c.fillRect(-R * 2, -R * 2 + off, R * 4, R * 2); c.fillStyle = '#7a4f2a'; c.fillRect(-R * 2, off, R * 4, R * 2);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(-R * 2, off); c.lineTo(R * 2, off); c.stroke();
    c.font = `500 16px ${th.mono || FM}`; c.fillStyle = '#fff'; c.textAlign = 'left'; c.lineWidth = 2;
    for (let p = -60; p <= 60; p += 10) { if (!p) continue; const y = off - p / 90 * R * 1.6; const w = p % 30 ? 40 : 80; c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); if (!(p % 30)) c.fillText(Math.abs(p), w + 8, y + 5); }
    c.restore();
    c.strokeStyle = th.ink; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    c.strokeStyle = '#ffd34d'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx - 110, cy); c.lineTo(cx - 40, cy); c.lineTo(cx - 20, cy + 18); c.moveTo(cx + 110, cy); c.lineTo(cx + 40, cy); c.lineTo(cx + 20, cy + 18); c.stroke(); c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill();
    c.save(); c.translate(cx, cy); c.rotate(-a.roll); c.fillStyle = th.ink; c.beginPath(); c.moveTo(0, -R + 4); c.lineTo(-10, -R + 22); c.lineTo(10, -R + 22); c.fill(); c.restore();
    const deg = v => ((v * 180 / Math.PI) % 360 + 360) % 360;
    const rows = [['ALABEO', (a.roll * 180 / Math.PI).toFixed(1) + '°'], ['CABECEO', (a.pitch * 180 / Math.PI).toFixed(1) + '°'], ['GUIÑADA', deg(a.yaw).toFixed(1) + '°'], ['VEL. ANGULAR', (Math.abs(Math.cos(now * .2)) * .05).toFixed(2) + ' °/s']];
    rows.forEach(([k, v], i) => { const y = 120 + i * 80; c.textAlign = 'left'; c.font = `500 18px ${th.font || FD}`; sp(c, '3px'); c.fillStyle = th.dim; c.fillText(k, 600, y); sp(c, '0px'); c.font = `500 36px ${th.mono || FM}`; c.fillStyle = th.ink; c.fillText(v, 600, y + 40); });
  } };
}
// Comunicaciones: bandas de radio, intensidad de señal y botón para hablar
export function pageComm({ name = 'COMUNIC.', nasa = true, labels } = {}) {
  let talk = 0;
  return { name, talk() { talk = 1.6; sfx.radio(nasa); }, draw(c, sc, now, th) {
    const ru = th.lang === 'ru'; head(c, th, ru ? 'СВЯЗЬ' : 'COMUNICACIONES', talk > 0 ? (ru ? 'ПЕРЕДАЧА' : 'TRANSMITIENDO') : ''); talk = Math.max(0, talk - 1 / 20);
    const L = labels || (ru ? [['УКВ-1 · 121,75 МГц', .8], ['УКВ-2 · 130,167 МГц', .6], ['КВ · 9,019 МГц', .3]] : [['BANDA S · TDRS', .85], ['UHF · ESTACIÓN', .55], ['BANDA S · TIERRA', .4]]);
    L.forEach(([k, s], i) => { const y = 110 + i * 110; c.textAlign = 'left'; c.font = `500 22px ${th.font || FD}`; c.fillStyle = th.ink; c.fillText(k, 32, y); for (let b = 0; b < 8; b++) { const on = b / 8 < s + jit(i, .06); c.fillStyle = on ? th.ok : th.line; c.fillRect(32 + b * 34, y + 22, 26, 40 - b * 2 + b * 4); } });
    c.strokeStyle = th.accent; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 400; i++) { const x = 560 + i, v = talk > 0 ? Math.sin(i * .3 + now * 40) * Math.sin(i * .05) * 60 * Math.random() : Math.sin(i * .2 + now * 3) * 3; i ? c.lineTo(x, 200 + v) : c.moveTo(x, 200 + v); } c.stroke();
    c.font = `500 16px ${th.mono || FM}`; c.fillStyle = th.dim; c.textAlign = 'left'; c.fillText(ru ? 'ГОЛОС' : 'VOZ', 560, 120);
    if (sc.os.nav) btn(c, sc, th, 'ptt', 560, 330, 400, 110, ru ? 'ПЕРЕДАЧА' : 'HABLAR CON TIERRA', talk > 0, 26);
    else { c.fillStyle = th.faint; c.font = `500 17px ${th.mono || FM}`; c.fillText(ru ? 'Кнопка ПРД на пульте связи' : 'Usa la tecla HABLAR del marco', 560, 400); }
  }, tap(id) { if (id === 'ptt') { talk = 1.6; sfx.radio(nasa); } } };
}
// Neptun‑ME: matriz de botones virtuales que se eligen con las flechas y se pulsan con ВВОД, y ventanas numéricas
// (así lo describió Charles Simonyi, que voló en Soyuz en 2007: cursor sobre botones virtuales y números por teclado).
export function pageNeptun({ name = 'КНОПКИ', cells } = {}) {
  const C = cells || [['СОЖ', 'Soporte vital'], ['СУД', 'Control de movimiento'], ['СЭП', 'Energía eléctrica'], ['СТР', 'Control térmico'], ['КУРС', 'Radar de acoplamiento Kurs'],
    ['ДПО', 'Propulsores de acoplamiento'], ['СКД', 'Motor principal'], ['ТОРУ', 'Pilotaje a distancia desde la Estación'], ['БДУС', 'Giroscopios'], ['ПРК', 'Programa de reentrada'],
    ['ОСВЕЩ', 'Luces de cabina'], ['ВЕНТ', 'Ventiladores'], ['ЧАСЫ', 'Reloj de a bordo'], ['ТЕСТ', 'Prueba de lámparas'], ['СИГН', 'Alarma de prueba']];
  const st = { cur: 0, on: new Set([0, 2, 3, 8]), num: '', field: ['000000', '000.0', '00:00:00'], fi: 0, msg: '' };
  const pg = { name, st, cells: C, draw(c, sc, now, th) {
    head(c, th, 'ФОРМАТ  КНОПКИ', 'ВВОД ЧИСЕЛ');
    const cols = 5, bw = 120, bh = 80;
    C.forEach(([k], i) => { const x = 24 + (i % cols) * (bw + 10), y = 84 + Math.floor(i / cols) * (bh + 12), on = st.on.has(i), cur = i === st.cur;
      c.fillStyle = on ? '#123018' : '#0d1310'; c.fillRect(x, y, bw, bh); c.lineWidth = cur ? 4 : 2; c.strokeStyle = cur ? '#ffd36a' : on ? '#7ee27e' : '#2a3a2c'; c.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      c.font = `700 24px ${FM}`; c.fillStyle = on ? '#b8ffb0' : '#9db09a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(k, x + bw / 2, y + bh / 2); });
    const sel = C[st.cur]; c.textAlign = 'left'; c.font = `500 18px ${FM}`; c.fillStyle = '#ffd36a'; c.fillText('► ' + sel[0] + ' — ' + sel[1], 24, 400); c.fillStyle = '#9db09a'; c.fillText(st.msg || 'Flechas: mover · ВВОД: pulsar · números: escribir', 24, 432);
    const names = ['ИМПУЛЬС', 'ДЕЛЬТА V', 'ВРЕМЯ']; names.forEach((n, i) => { const x = 680, y = 96 + i * 92; c.fillStyle = '#9db09a'; c.font = `500 17px ${FM}`; c.fillText(n, x, y); c.fillStyle = i === st.fi ? '#1b2a1d' : '#0d1310'; c.fillRect(x, y + 12, 320, 52); c.strokeStyle = i === st.fi ? '#ffd36a' : '#2a3a2c'; c.lineWidth = 2; c.strokeRect(x, y + 12, 320, 52);
      c.font = `700 32px ${FM}`; c.fillStyle = '#eef2ea'; c.textAlign = 'right'; c.fillText(i === st.fi && st.num ? st.num + (Math.sin(now * 8) > 0 ? '_' : ' ') : st.field[i], x + 306, y + 40); c.textAlign = 'left'; });
  } };
  pg.key = (k, onCell) => {
    const cols = 5, n = C.length;
    if (k === '↑') st.cur = (st.cur - cols + n) % n; else if (k === '↓') st.cur = (st.cur + cols) % n; else if (k === '←') st.cur = (st.cur - 1 + n) % n; else if (k === '→') st.cur = (st.cur + 1) % n;
    else if (k === 'ВВ') { if (st.num) { st.field[st.fi] = st.num; st.num = ''; st.fi = (st.fi + 1) % 3; st.msg = 'Número guardado.'; sfx.confirm(); } else { const on = !st.on.has(st.cur); on ? st.on.add(st.cur) : st.on.delete(st.cur); st.msg = C[st.cur][0] + (on ? ' ВКЛ (encendido)' : ' ОТКЛ (apagado)'); onCell && onCell(st.cur, on, C[st.cur]); } }
    else if (k === 'СБ') { st.num = ''; st.msg = 'Borrado.'; }
    else if (/^[0-9]$/.test(k)) { if (st.num.length < 8) st.num += k; }
  };
  return pg;
}
// Telemetría de la Soyuz (en ruso, con traducción abajo)
export function pageTelemetry({ name = 'ТЕЛЕМ' } = {}) {
  return pageSystems({ name, title: 'ТЕЛЕМЕТРИЯ  СА', rows: [['ДАВЛЕНИЕ (presión)', () => (101.1 + jit(1, .08)).toFixed(1) + ' кПа'], ['ПАРЦ. O2 (oxígeno)', () => (21.4 + jit(2, .1)).toFixed(1) + ' кПа'], ['CO2', () => (0.36 + jit(3, .02)).toFixed(2) + ' кПа'], ['ТЕМП. (temperatura)', () => (21.8 + jit(4, .2)).toFixed(1) + ' °C'], ['ВЛАЖН. (humedad)', () => Math.round(48 + jit(5, 2)) + ' %'], ['НАПР. ШИНЫ (voltaje)', () => (27.6 + jit(6, .08)).toFixed(1) + ' В'], ['ТОК (corriente)', () => (31 + jit(7, .5)).toFixed(0) + ' А']] });
}
// acceso para pruebas automáticas
window.__mandos = { ctrls, pick, tapCtrl, osPage, osPower, scr, lampTest, setCabinLights };
